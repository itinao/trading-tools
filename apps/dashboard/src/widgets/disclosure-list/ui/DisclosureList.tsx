import { CategoryBadge } from '../../../entities/disclosure/index.ts'

export interface DisclosureRow {
  id: number
  disclosedAt: string
  title: string
  pdfUrl: string
  category: string
}

/** 適時開示の一覧（PDF への外部リンク） */
export function DisclosureList({ items }: { items: DisclosureRow[] }) {
  if (items.length === 0) return <p className="empty">なし</p>
  return (
    <table>
      <thead>
        <tr>
          <th>日時</th>
          <th>種別</th>
          <th>表題</th>
        </tr>
      </thead>
      <tbody>
        {items.map((d) => (
          <tr key={d.id}>
            <td className="muted nowrap">{d.disclosedAt.slice(0, 16).replace('T', ' ')}</td>
            <td>
              <CategoryBadge category={d.category} />
            </td>
            <td>
              <a href={d.pdfUrl} target="_blank" rel="noreferrer noopener">
                {d.title}
              </a>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
