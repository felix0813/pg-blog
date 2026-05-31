export function StatStrip({ stats }) {
  const items = [
    ['文章', stats?.post_count ?? 0],
    ['分类', stats?.category_count ?? 0],
    ['标签', stats?.tag_count ?? 0],
  ];
  return (
    <div className="statStrip">
      {items.map(([label, value]) => (
        <div className="statItem" key={label}>
          <strong>{value}</strong>
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}
