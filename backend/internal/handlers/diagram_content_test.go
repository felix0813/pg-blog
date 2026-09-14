package handlers

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestValidateDiagramContent(t *testing.T) {
	tests := []struct {
		name    string
		content string
		wantErr bool
	}{
		{
			name:    "mermaid code block",
			content: `{"type":"doc","content":[{"type":"codeBlock","attrs":{"language":"mermaid"},"content":[{"type":"text","text":"flowchart LR; A-->B"}]}]}`,
		},
		{
			name:    "ordinary code block",
			content: `{"type":"doc","content":[{"type":"codeBlock","attrs":{"language":"javascript"},"content":[{"type":"text","text":"alert(1)"}]}]}`,
		},
		{
			name:    "oversized diagram",
			content: `{"type":"doc","content":[{"type":"codeBlock","attrs":{"language":"mermaid"},"content":[{"type":"text","text":"` + strings.Repeat("x", maxDiagramSourceBytes+1) + `"}]}]}`,
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateDiagramContent(json.RawMessage(tt.content))
			if (err != nil) != tt.wantErr {
				t.Fatalf("validateDiagramContent() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}
