import { pctClass, pctText } from '../lib'

export function PctCell({
  value,
  className = '',
}: {
  value: number | null | undefined
  className?: string
}) {
  return <td className={`num ${pctClass(value)} ${className}`.trim()}>{pctText(value)}</td>
}
