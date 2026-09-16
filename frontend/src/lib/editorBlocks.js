export function insertMermaidBlock(editor) {
  if (!editor) return
  // A zero-width insertion preserves selected text and lets ProseMirror split
  // surrounding paragraphs, instead of converting them to diagram source.
  editor.chain().focus().insertContentAt(editor.state.selection.to, [
    {
      type: 'codeBlock',
      attrs: { language: 'mermaid' },
      content: [{ type: 'text', text: 'flowchart LR\n  A[开始] --> B[结束]' }],
    },
    { type: 'paragraph' },
  ]).run()
}

export function continueWritingAfterCode(editor) {
  if (!editor?.isActive('codeBlock')) return
  const position = editor.state.selection.$from.after()
  editor.chain().focus()
    .insertContentAt(position, { type: 'paragraph' })
    .setTextSelection(position + 1)
    .run()
}
