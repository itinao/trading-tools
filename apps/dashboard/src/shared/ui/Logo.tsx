/**
 * ロゴのワードマーク（DESIGN.md「ロゴ」）。マークが "Trading" の T で、続けて "rading" を置く。
 * 色は .logo が primary（幹と横棒）と --logo-accent = gain（赤の一片）を決める。暗い面に置くときは両方を上書きする。
 */
export function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`logo ${className}`.trim()} role="img" aria-label="Trading">
      <svg viewBox="0 0 32 32" className="logo-mark" aria-hidden="true">
        <path d="M2 7 C 11 2, 22 2, 30 5 L 29 9.5 C 21 7.5, 12 8, 4.5 12 Z" fill="currentColor" />
        <path d="M13 9 L 20.5 9 L 17.5 29 L 10 29 Z" fill="currentColor" />
        <path d="M18.5 21 L 30 12.5 L 31 17 L 20 25 Z" fill="var(--logo-accent)" />
      </svg>
      <span aria-hidden="true">rading</span>
    </span>
  )
}
