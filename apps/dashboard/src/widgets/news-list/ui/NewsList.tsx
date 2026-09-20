export interface NewsRow {
  id: number
  publishedAt: string
  title: string
  url: string
  publisher: string | null
}

/** ニュースの見出し一覧（外部リンク） */
export function NewsList({ items }: { items: NewsRow[] }) {
  if (items.length === 0) return <p className="empty">なし</p>
  return (
    <table>
      <thead>
        <tr>
          <th>日時</th>
          <th>見出し</th>
          <th>媒体</th>
        </tr>
      </thead>
      <tbody>
        {items.map((n) => (
          <tr key={n.id}>
            <td className="muted nowrap">{n.publishedAt.slice(0, 16).replace('T', ' ')}</td>
            <td>
              <a href={n.url} target="_blank" rel="noreferrer noopener">
                {n.title}
              </a>
            </td>
            <td className="muted">{n.publisher ?? '-'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
