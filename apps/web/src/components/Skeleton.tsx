/**
 * Skeleton — shimmer placeholder počas načítavania.
 *
 * Usage:
 *   <Skeleton w={200} h={16} />
 *   <SkeletonLine />         // default row
 *   <SkeletonCard />         // pre ListItem/AttentionCard placeholders
 */

export function Skeleton({
  w = '100%',
  h = 16,
  radius = 6,
  style,
}: {
  w?: number | string;
  h?: number | string;
  radius?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className="sk"
      style={{ width: w, height: h, borderRadius: radius, ...style }}
      aria-hidden="true"
    />
  );
}

export function SkeletonLine({ w = '70%' }: { w?: number | string }) {
  return <Skeleton w={w} h={14} />;
}

export function SkeletonCard() {
  return (
    <div className="sk-card" aria-hidden="true">
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <Skeleton w={40} h={40} radius={8} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Skeleton w="40%" h={14} />
          <Skeleton w="70%" h={12} />
        </div>
      </div>
    </div>
  );
}

export function SkeletonList({ n = 3 }: { n?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Array.from({ length: n }).map((_, i) => <SkeletonCard key={i} />)}
    </div>
  );
}

export function SkeletonKPIs({ n = 4 }: { n?: number }) {
  return (
    <div className="dp-grid-sm">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="sk-card" aria-hidden="true">
          <Skeleton w={80} h={11} />
          <div style={{ height: 8 }} />
          <Skeleton w={120} h={28} />
        </div>
      ))}
    </div>
  );
}
