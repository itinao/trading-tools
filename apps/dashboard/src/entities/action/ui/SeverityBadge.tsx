/** 重大度（warn / critical）はバッジ（面つき）で示す。シグナル由来でなければ origin（ai / manual）を neutral で出す */
export function SeverityBadge({
  severity,
  fallback,
  offense = false,
}: {
  severity: string | null
  fallback: string
  offense?: boolean
}) {
  // 攻め（買い検討）は重大度ではなく候補の強さ。紺のバッジで守りと区別する（Design Doc 0013 §3.3）
  if (offense)
    return (
      <span className="badge badge-primary">買い検討{severity === 'critical' ? '（強）' : ''}</span>
    )
  const kind = severity === 'warn' || severity === 'critical' ? severity : 'neutral'
  return <span className={`badge badge-${kind}`}>{severity ?? fallback}</span>
}
