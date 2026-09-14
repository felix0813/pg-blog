package handlers

import (
	"strings"
	"testing"
)

func TestDiagramMarkupPolicy(t *testing.T) {
	policy := New(nil, nil, nil, nil).policy
	clean := policy.Sanitize(`<pre><code class="language-mermaid">flowchart LR; A--&gt;B<script>alert(1)</script></code></pre><svg onload="alert(1)"></svg>`)

	if !strings.Contains(clean, `class="language-mermaid"`) {
		t.Fatalf("diagram language class was removed: %s", clean)
	}
	if strings.Contains(clean, "script") || strings.Contains(clean, "onload") || strings.Contains(clean, "<svg") {
		t.Fatalf("unsafe diagram markup survived sanitization: %s", clean)
	}
}
