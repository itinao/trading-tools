/** 重大度（warn / critical）はバッジ（面つき）で示す。シグナル由来でなければ origin（ai / manual）を neutral で出す */
export function SeverityBadge({
  severity,
  fallback,
}: {
  severity: string | null
  fallback: string
}) {
  const kind = severity === 'warn' || severity === 'critical' ? severity : 'neutral'
  return <span className={`badge badge-${kind}`}>{severity ?? fallback}</span>
}
