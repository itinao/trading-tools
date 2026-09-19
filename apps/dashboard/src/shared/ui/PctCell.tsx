import { pctClass, pctText } from '../lib'

export function PctCell({ value }: { value: number | null | undefined }) {
  return <td className={`num ${pctClass(value)}`}>{pctText(value)}</td>
}
