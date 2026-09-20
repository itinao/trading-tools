import { categoryLabel } from '../model/labels.ts'

/** 開示の種別。決算・業績予想修正・配当は目立たせ、その他は neutral */
export function CategoryBadge({ category }: { category: string }) {
  const kind = category === 'other' ? 'neutral' : 'primary'
  return <span className={`badge badge-${kind}`}>{categoryLabel(category)}</span>
}
