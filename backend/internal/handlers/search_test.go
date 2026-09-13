package handlers

import "testing"

func TestSearchCursorRoundTrip(t *testing.T) {
	encoded := encodeSearchCursor(30)
	decoded, err := decodeSearchCursor(encoded)
	if err != nil || decoded != 30 {
		t.Fatalf("cursor round trip failed: decoded=%d err=%v", decoded, err)
	}
	if _, err := decodeSearchCursor("not-base64!"); err == nil {
		t.Fatal("invalid cursor was accepted")
	}
}

func TestWebsearchQueryUsesChineseTokens(t *testing.T) {
	got := websearchQuery("中文")
	if got != `"中" OR "中文" OR "文"` {
		t.Fatalf("unexpected query: %s", got)
	}
}
