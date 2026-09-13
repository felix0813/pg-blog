package search

import (
	"strings"
	"testing"
)

func TestTokenizeChineseAndTechnicalTerms(t *testing.T) {
	got := Tokenize("PostgreSQL 中文搜索 API-v2")
	for _, want := range []string{"postgresql", "中", "中文", "文", "文搜", "搜索", "api-v2"} {
		if !strings.Contains(" "+got+" ", " "+want+" ") {
			t.Fatalf("Tokenize() = %q, missing %q", got, want)
		}
	}
}

func TestSplitTextUsesOverlap(t *testing.T) {
	input := strings.Repeat("字", 800)
	chunks := splitText(input)
	if len(chunks) != 2 || len([]rune(chunks[0])) != 700 || len([]rune(chunks[1])) != 200 {
		t.Fatalf("unexpected chunks: count=%d lengths=%v", len(chunks), chunkLengths(chunks))
	}
}

func chunkLengths(chunks []string) []int {
	lengths := make([]int, len(chunks))
	for i, chunk := range chunks {
		lengths[i] = len([]rune(chunk))
	}
	return lengths
}
