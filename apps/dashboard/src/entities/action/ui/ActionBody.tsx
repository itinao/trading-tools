/** アクションの本文を折りたたみで表示する */
export function ActionBody({
  title,
  body,
  note,
}: {
  title: string
  body: string
  note: string | null
}) {
  return (
    <>
      <details>
        <summary>{title}</summary>
        <pre className="detail-body">{body}</pre>
      </details>
      {note && <div className="muted">メモ: {note}</div>}
    </>
  )
}
