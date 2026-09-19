/** 重大度（warn / critical）。シグナル由来でなければ origin（ai / manual）を出す */
export function SeverityBadge({
  severity,
  fallback,
}: {
  severity: string | null
  fallback: string
}) {
  return <span className={severity ?? ''}>{severity ?? fallback}</span>
}
