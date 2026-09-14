package handlers

import (
	"encoding/json"
	"fmt"
	"strings"
)

const (
	maxDiagramSourceBytes = 20_000
	maxDiagramsPerPost    = 50
)

type tiptapContentNode struct {
	Type    string                     `json:"type"`
	Attrs   map[string]json.RawMessage `json:"attrs"`
	Text    string                     `json:"text"`
	Content []tiptapContentNode        `json:"content"`
}

func validateDiagramContent(raw json.RawMessage) error {
	var root tiptapContentNode
	if err := json.Unmarshal(raw, &root); err != nil {
		return fmt.Errorf("content_json must be a Tiptap document: %w", err)
	}

	diagramCount := 0
	var visit func(tiptapContentNode) error
	visit = func(node tiptapContentNode) error {
		if node.Type == "codeBlock" && strings.EqualFold(nodeLanguage(node), "mermaid") {
			diagramCount++
			if diagramCount > maxDiagramsPerPost {
				return fmt.Errorf("a post may contain at most %d diagrams", maxDiagramsPerPost)
			}
			if sourceBytes(node) > maxDiagramSourceBytes {
				return fmt.Errorf("diagram source may not exceed %d bytes", maxDiagramSourceBytes)
			}
		}
		for _, child := range node.Content {
			if err := visit(child); err != nil {
				return err
			}
		}
		return nil
	}

	return visit(root)
}

func nodeLanguage(node tiptapContentNode) string {
	value, ok := node.Attrs["language"]
	if !ok {
		return ""
	}
	var language string
	_ = json.Unmarshal(value, &language)
	return strings.TrimSpace(language)
}

func sourceBytes(node tiptapContentNode) int {
	total := len(node.Text)
	for _, child := range node.Content {
		total += sourceBytes(child)
	}
	return total
}
