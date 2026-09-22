import { pctClass, yen } from '../lib'

export function YenCell({
  value,
  signed = false,
  className = '',
}: {
  value: number | null | undefined
  signed?: boolean
  className?: string
}) {
  return (
    <td className={`num ${signed ? pctClass(value) : ''} ${className}`.trim()}>{yen(value)}</td>
  )
}
