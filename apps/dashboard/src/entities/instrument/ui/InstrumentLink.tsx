import { Link } from '@tanstack/react-router'

/** 銘柄名（リンク）と証券コード */
export function InstrumentLink({ id, name, code }: { id: string; name: string; code: string }) {
  return (
    <>
      <Link to="/instruments/$id" params={{ id }}>
        {name}
      </Link>
      <div className="muted">{code}</div>
    </>
  )
}
