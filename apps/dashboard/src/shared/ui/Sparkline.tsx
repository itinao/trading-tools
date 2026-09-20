export interface SparkPoint {
  x: string
  y: number
  mark?: boolean
}

/**
 * 小さな折れ線（素の SVG）。目盛りは最小値と最大値だけ、印はアクションの日（Design Doc 0014 §3.1）。
 * 幅は親に合わせ、高さは 48px。
 */
export function Sparkline({
  points,
  height = 48,
  format = (v: number) => String(v),
}: {
  points: SparkPoint[]
  height?: number
  format?: (v: number) => string
}) {
  if (points.length < 2) return <span className="muted">データ不足</span>
  const width = 600
  const pad = 2
  const ys = points.map((p) => p.y)
  const min = Math.min(...ys)
  const max = Math.max(...ys)
  const span = max - min || 1
  const sx = (i: number) => pad + (i / (points.length - 1)) * (width - pad * 2)
  const sy = (y: number) => pad + (1 - (y - min) / span) * (height - pad * 2)
  const d = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(i).toFixed(1)},${sy(p.y).toFixed(1)}`)
    .join(' ')
  const first = points[0] as SparkPoint
  const last = points[points.length - 1] as SparkPoint
  return (
    <div className="sparkline">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`${first.x} から ${last.x}、最小 ${format(min)}、最大 ${format(max)}`}
      >
        <path
          d={d}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
        {points.map((p, i) =>
          p.mark ? <circle key={p.x} cx={sx(i)} cy={sy(p.y)} r="3" className="mark" /> : null,
        )}
      </svg>
      <div className="sparkline-legend muted">
        <span>{first.x}</span>
        <span>
          最小 {format(min)} / 最大 {format(max)}
        </span>
        <span>{last.x}</span>
      </div>
    </div>
  )
}
