import React from 'react'
import { highlightParts } from '../lib/searchHighlight.js'

export function HighlightedText({ text, query }) {
  return highlightParts(text, query).map((part, index) => (
    part.match ? <mark className="searchHighlight" key={index}>{part.text}</mark> : <React.Fragment key={index}>{part.text}</React.Fragment>
  ))
}
