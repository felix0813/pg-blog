export function learningGoalMap(items = []) {
  return Object.fromEntries(items.map((item) => [String(item.post_id), item.last_learned_at || null]))
}
