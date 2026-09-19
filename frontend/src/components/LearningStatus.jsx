import React from 'react'
import '../learning.css'

export function LearningStatus({ active, lastLearnedAt }) {
  if (!active) return null
  return <span className={`learningStatus ${lastLearnedAt ? 'learned' : 'pending'}`}>{lastLearnedAt ? `上次学习：${new Date(lastLearnedAt).toLocaleDateString()}` : '待学习'}</span>
}
