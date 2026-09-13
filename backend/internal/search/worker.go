package search

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"html"
	"log"
	"regexp"
	"strings"
	"time"
	"unicode"

	"pg-blog/backend/internal/config"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Worker struct {
	db  *pgxpool.Pool
	cfg config.Config
}

func NewWorker(db *pgxpool.Pool, cfg config.Config) *Worker {
	return &Worker{db: db, cfg: cfg}
}

func (w *Worker) Run(ctx context.Context) {
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			w.process(ctx)
		}
	}
}

func (w *Worker) process(ctx context.Context) {
	var id, postID int64
	err := w.db.QueryRow(ctx, `
		UPDATE search_index_jobs
		SET status='processing',locked_at=now(),attempts=attempts+1
		WHERE id=(
			SELECT id FROM search_index_jobs
			WHERE status='pending' AND run_after<=now()
			ORDER BY run_after,id FOR UPDATE SKIP LOCKED LIMIT 1
		)
		RETURNING id,post_id`).Scan(&id, &postID)
	if err != nil {
		if err != pgx.ErrNoRows {
			log.Printf("claim search index job failed: %v", err)
		}
		return
	}

	err = w.index(ctx, postID)
	if err != nil {
		_, _ = w.db.Exec(ctx, `
			UPDATE search_index_jobs
			SET status=CASE WHEN attempts>=5 THEN 'failed' ELSE 'pending' END,
				run_after=now()+make_interval(secs => (30*power(2,LEAST(attempts-1,6)))::int),
				last_error=$2
			WHERE id=$1`, id, truncateError(err))
		return
	}
	_, _ = w.db.Exec(ctx, `UPDATE search_index_jobs SET status='completed',last_error='' WHERE id=$1`, id)
}

func (w *Worker) index(ctx context.Context, id int64) error {
	var userID int64
	var status, title, summary, body, category, tagNames string
	err := w.db.QueryRow(ctx, `
		SELECT p.user_id,p.status,p.title,p.summary,p.content_html,
			COALESCE(c.name,''),COALESCE(string_agg(t.name,' ' ORDER BY t.name),'')
		FROM posts p
		LEFT JOIN categories c ON c.id=p.category_id
		LEFT JOIN post_tags pt ON pt.post_id=p.id
		LEFT JOIN tags t ON t.id=pt.tag_id
		WHERE p.id=$1
		GROUP BY p.id,c.name`, id).Scan(&userID, &status, &title, &summary, &body, &category, &tagNames)
	if err == pgx.ErrNoRows {
		_, err = w.db.Exec(ctx, `DELETE FROM post_search_documents WHERE post_id=$1`, id)
		return err
	}
	if err != nil {
		return err
	}

	body = stripHTML(body)
	searchText := strings.TrimSpace(strings.Join([]string{title, category, tagNames, summary, body}, "\n"))
	hash := contentHash(status + string(rune(10)) + searchText)
	_, err = w.db.Exec(ctx, `
		INSERT INTO post_search_documents(
			post_id,user_id,status,search_text,search_tsv,content_hash,embedding_model,embedding_status,indexed_at,last_error
		)
		VALUES(
			$1,$2,$3,$4,
			setweight(to_tsvector('simple',$5),'A') || setweight(to_tsvector('simple',$6),'A') ||
			setweight(to_tsvector('simple',$7),'B') || setweight(to_tsvector('simple',$8),'C'),
			$9,$10,'pending',now(),''
		)
		ON CONFLICT(post_id) DO UPDATE SET
			user_id=excluded.user_id,status=excluded.status,search_text=excluded.search_text,
			search_tsv=excluded.search_tsv,content_hash=excluded.content_hash,
			embedding_model=excluded.embedding_model,
			embedding_status=CASE
				WHEN post_search_documents.content_hash=excluded.content_hash
				 AND post_search_documents.embedding_model=excluded.embedding_model
				THEN post_search_documents.embedding_status ELSE 'pending' END,
			indexed_at=now(),last_error=''`,
		id, userID, status, searchText, Tokenize(title), Tokenize(category+" "+tagNames),
		Tokenize(summary), Tokenize(body), hash, w.cfg.EmbeddingModel)
	if err != nil {
		return err
	}
	return w.embedIndex(ctx, id, userID, status, title, summary, body, category, tagNames)
}

var htmlTags = regexp.MustCompile("<[^>]*>")

func stripHTML(s string) string {
	return strings.Join(strings.Fields(html.UnescapeString(htmlTags.ReplaceAllString(s, " "))), " ")
}

// Tokenize keeps ASCII technical terms and emits Han unigrams/bigrams so the
// PostgreSQL simple dictionary can match Chinese without a server extension.
func Tokenize(text string) string {
	var tokens []string
	var latin, han []rune
	flushLatin := func() {
		if len(latin) > 0 {
			tokens = append(tokens, strings.ToLower(string(latin)))
			latin = latin[:0]
		}
	}
	flushHan := func() {
		for i, r := range han {
			tokens = append(tokens, string(r))
			if i+1 < len(han) {
				tokens = append(tokens, string(han[i:i+2]))
			}
		}
		han = han[:0]
	}
	for _, r := range []rune(strings.TrimSpace(text)) {
		switch {
		case unicode.Is(unicode.Han, r):
			flushLatin()
			han = append(han, r)
		case unicode.IsLetter(r) || unicode.IsDigit(r) || r == '_' || r == '-' || r == '.' || r == '+':
			flushHan()
			latin = append(latin, r)
		default:
			flushLatin()
			flushHan()
		}
	}
	flushLatin()
	flushHan()
	return strings.Join(tokens, " ")
}

func splitText(text string) []string {
	const size, overlap = 700, 100
	runes := []rune(strings.TrimSpace(text))
	if len(runes) == 0 {
		return nil
	}
	chunks := make([]string, 0, (len(runes)+size-1)/size)
	for start := 0; start < len(runes); {
		end := start + size
		if end >= len(runes) {
			chunks = append(chunks, string(runes[start:]))
			break
		}
		chunks = append(chunks, string(runes[start:end]))
		start = end - overlap
	}
	return chunks
}

func contentHash(text string) string {
	sum := sha256.Sum256([]byte(text))
	return hex.EncodeToString(sum[:])
}

func truncateError(err error) string {
	message := err.Error()
	if len(message) > 2000 {
		return message[:2000]
	}
	return message
}
