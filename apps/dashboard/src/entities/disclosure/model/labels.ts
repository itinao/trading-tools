export const CATEGORY_LABEL: Record<string, string> = {
  earnings: '決算短信',
  forecast_revision: '業績予想修正',
  dividend: '配当',
  other: 'その他',
}
export function categoryLabel(category: string): string {
  return CATEGORY_LABEL[category] ?? category
}
