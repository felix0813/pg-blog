import { Node, mergeAttributes } from '@tiptap/core'

const cellAttributes = {
  colspan: {
    default: 1,
    parseHTML: (element) => Number(element.getAttribute('colspan')) || 1,
    renderHTML: ({ colspan }) => colspan === 1 ? {} : { colspan },
  },
  rowspan: {
    default: 1,
    parseHTML: (element) => Number(element.getAttribute('rowspan')) || 1,
    renderHTML: ({ rowspan }) => rowspan === 1 ? {} : { rowspan },
  },
}

const Table = Node.create({
  name: 'table',
  group: 'block',
  content: 'tableRow+',
  isolating: true,
  parseHTML: () => [{ tag: 'table' }],
  renderHTML: ({ HTMLAttributes }) => ['table', mergeAttributes(HTMLAttributes), ['tbody', 0]],
})

const TableRow = Node.create({
  name: 'tableRow',
  content: '(tableHeader | tableCell)+',
  parseHTML: () => [{ tag: 'tr' }],
  renderHTML: ({ HTMLAttributes }) => ['tr', mergeAttributes(HTMLAttributes), 0],
})

const TableHeader = Node.create({
  name: 'tableHeader',
  content: 'block+',
  isolating: true,
  addAttributes: () => cellAttributes,
  parseHTML: () => [{ tag: 'th' }],
  renderHTML: ({ HTMLAttributes }) => ['th', mergeAttributes(HTMLAttributes), 0],
})

const TableCell = Node.create({
  name: 'tableCell',
  content: 'block+',
  isolating: true,
  addAttributes: () => cellAttributes,
  parseHTML: () => [{ tag: 'td' }],
  renderHTML: ({ HTMLAttributes }) => ['td', mergeAttributes(HTMLAttributes), 0],
})

const MarkdownImage = Node.create({
  name: 'image',
  inline: true,
  group: 'inline',
  draggable: true,
  atom: true,
  addAttributes: () => ({
    src: { default: null },
    alt: { default: null },
    title: { default: null },
  }),
  parseHTML: () => [{ tag: 'img[src]' }],
  renderHTML: ({ HTMLAttributes }) => ['img', mergeAttributes(HTMLAttributes)],
})

export const markdownExtensions = [Table, TableRow, TableHeader, TableCell, MarkdownImage]
