package search

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"pg-blog/backend/internal/config"
)

func (w *Worker) embedIndex(ctx context.Context, postID, userID int64, status, title, summary, body, category, tagNames string) (returnErr error) {
	if w.cfg.DashScopeAPIKey == "" {
		return nil
	}
	var embeddingStatus string
	if err := w.db.QueryRow(ctx, `SELECT embedding_status FROM post_search_documents WHERE post_id=$1`, postID).Scan(&embeddingStatus); err != nil {
		return err
	}
	if embeddingStatus == "completed" {
		return nil
	}
	if _, err := w.db.Exec(ctx, `UPDATE post_search_documents SET embedding_status='processing' WHERE post_id=$1`, postID); err != nil {
		return err
	}
	defer func() {
		if returnErr != nil {
			_, _ = w.db.Exec(ctx, `UPDATE post_search_documents SET embedding_status='failed',last_error=$2 WHERE post_id=$1`, postID, truncateError(returnErr))
		}
	}()

	prefix := strings.TrimSpace(strings.Join([]string{title, summary, category, tagNames}, "\n"))
	chunks := splitText(body)
	if len(chunks) == 0 {
		chunks = []string{prefix}
	} else {
		for i := range chunks {
			chunks[i] = strings.TrimSpace(prefix + "\n" + chunks[i])
		}
	}
	vectors, err := EmbedBatch(ctx, w.cfg, chunks)
	if err != nil {
		return err
	}

	tx, err := w.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `DELETE FROM post_search_chunks WHERE post_id=$1`, postID); err != nil {
		return err
	}
	for i, chunk := range chunks {
		if _, err := tx.Exec(ctx, `
			INSERT INTO post_search_chunks(post_id,user_id,status,chunk_no,content,content_hash,embedding,embedding_model)
			VALUES($1,$2,$3,$4,$5,$6,$7::vector,$8)`, postID, userID, status, i, chunk,
			contentHash(chunk), VectorLiteral(vectors[i]), w.cfg.EmbeddingModel); err != nil {
			return err
		}
	}
	if _, err := tx.Exec(ctx, `
		UPDATE post_search_documents
		SET embedding_status='completed',indexed_at=now(),last_error=''
		WHERE post_id=$1`, postID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// EmbedBatch uses the OpenAI-compatible endpoint in batches of 20, the
// documented maximum for qwen3.7-text-embedding.
func EmbedBatch(ctx context.Context, cfg config.Config, inputs []string) ([][]float64, error) {
	client := &http.Client{Timeout: 60 * time.Second}
	all := make([][]float64, 0, len(inputs))
	for start := 0; start < len(inputs); start += 20 {
		end := start + 20
		if end > len(inputs) {
			end = len(inputs)
		}
		payload, err := json.Marshal(map[string]any{
			"model": cfg.EmbeddingModel, "input": inputs[start:end],
			"dimensions": cfg.EmbeddingDimensions, "encoding_format": "float",
		})
		if err != nil {
			return nil, err
		}
		req, err := http.NewRequestWithContext(ctx, http.MethodPost,
			strings.TrimRight(cfg.DashScopeBaseURL, "/")+"/embeddings", bytes.NewReader(payload))
		if err != nil {
			return nil, err
		}
		req.Header.Set("Authorization", "Bearer "+cfg.DashScopeAPIKey)
		req.Header.Set("Content-Type", "application/json")
		res, err := client.Do(req)
		if err != nil {
			return nil, err
		}
		var response struct {
			Data []struct {
				Embedding []float64 `json:"embedding"`
				Index     int       `json:"index"`
			} `json:"data"`
			Error any `json:"error"`
		}
		decodeErr := json.NewDecoder(io.LimitReader(res.Body, 32<<20)).Decode(&response)
		res.Body.Close()
		if decodeErr != nil {
			return nil, decodeErr
		}
		if res.StatusCode/100 != 2 || len(response.Data) != end-start {
			return nil, fmt.Errorf("embedding request failed (status %d): %v", res.StatusCode, response.Error)
		}
		batch := make([][]float64, end-start)
		for _, item := range response.Data {
			if item.Index < 0 || item.Index >= len(batch) || len(item.Embedding) != cfg.EmbeddingDimensions {
				return nil, fmt.Errorf("embedding response has invalid index or dimension")
			}
			batch[item.Index] = item.Embedding
		}
		all = append(all, batch...)
	}
	return all, nil
}

func VectorLiteral(vector []float64) string {
	parts := make([]string, len(vector))
	for i, value := range vector {
		parts[i] = strconv.FormatFloat(value, 'g', -1, 64)
	}
	return "[" + strings.Join(parts, ",") + "]"
}
