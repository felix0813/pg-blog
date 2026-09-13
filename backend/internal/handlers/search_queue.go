package handlers

import "github.com/gin-gonic/gin"

// Taxonomy names are part of the search document, so renaming a category or
// tag queues every affected owner's post. Existing active jobs are de-duplicated.
func (h *Handler) enqueueTaxonomySearchJobs(c *gin.Context, userID int64) {
	_, _ = h.db.Exec(c, `
		INSERT INTO search_index_jobs (post_id,job_type)
		SELECT p.id,'upsert' FROM posts p
		WHERE p.user_id=$1 AND NOT EXISTS (
			SELECT 1 FROM search_index_jobs j
			WHERE j.post_id=p.id AND j.status IN ('pending','processing')
		)`, userID)
}
