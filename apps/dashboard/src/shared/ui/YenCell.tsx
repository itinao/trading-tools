import { pctClass, yen } from '../lib'

export function YenCell({
  value,
  signed = false,
}: {
  value: number | null | undefined
  signed?: boolean
}) {
  return <td className={`num ${signed ? pctClass(value) : ''}`}>{yen(value)}</td>
}
