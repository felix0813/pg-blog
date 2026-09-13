package search

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"

	"pg-blog/backend/internal/config"
)

func TestEmbedBatchSplitsAtTwentyAndPreservesOrder(t *testing.T) {
	var calls int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&calls, 1)
		if r.Header.Get("Authorization") != "Bearer test-key" {
			t.Fatal("missing authorization header")
		}
		var request struct {
			Input []string `json:"input"`
		}
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			t.Fatal(err)
		}
		data := make([]map[string]any, len(request.Input))
		for i := range request.Input {
			data[i] = map[string]any{"index": i, "embedding": []float64{float64(i), 1}}
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"data": data})
	}))
	defer server.Close()

	inputs := make([]string, 21)
	for i := range inputs {
		inputs[i] = fmt.Sprintf("chunk-%d", i)
	}
	vectors, err := EmbedBatch(context.Background(), config.Config{
		DashScopeAPIKey: "test-key", DashScopeBaseURL: server.URL,
		EmbeddingModel: "qwen3.7-text-embedding", EmbeddingDimensions: 2,
	}, inputs)
	if err != nil {
		t.Fatal(err)
	}
	if len(vectors) != 21 || atomic.LoadInt32(&calls) != 2 {
		t.Fatalf("vectors=%d calls=%d", len(vectors), calls)
	}
	if got := VectorLiteral(vectors[20]); !strings.HasPrefix(got, "[0,") {
		t.Fatalf("second batch index was not preserved: %s", got)
	}
}
