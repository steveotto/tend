export function PersonPrayerCountBadge({ count }: { count: number }) {
  return (
    <span className="person-prayer-card__prayer-count">
      Prayed {count} {count === 1 ? 'time' : 'times'}
    </span>
  );
}
