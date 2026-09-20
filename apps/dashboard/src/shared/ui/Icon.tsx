/** Material Symbols Outlined のアイコン。必ずラベルと一緒に置き、単独で意味を持たせない（DESIGN.md Icons） */
export function Icon({ name, className = '' }: { name: string; className?: string }) {
  return (
    <span className={`material-symbols-outlined icon ${className}`.trim()} aria-hidden="true">
      {name}
    </span>
  )
}
