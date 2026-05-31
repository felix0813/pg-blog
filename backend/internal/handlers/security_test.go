package handlers

import (
	"testing"

	"github.com/microcosm-cc/bluemonday"
)

func TestBluemondayRemovesScript(t *testing.T) {
	policy := bluemonday.UGCPolicy()
	clean := policy.Sanitize(`<p>ok</p><script>alert(1)</script>`)
	if clean != "<p>ok</p>" {
		t.Fatalf("unexpected sanitized html: %s", clean)
	}
}
