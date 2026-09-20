/** スクリーナーのプリセット（config/screen.json）の画面用の名前と説明。条件の JSON を言葉にする */

export const PRESET_LABEL: Record<string, string> = {
  value: '割安',
  growth: '成長',
  quality: '優良',
}

export const PRESET_DESCRIPTION: Record<string, string> = {
  value: 'PER・PBR が低く、配当利回りが高い銘柄です',
  growth: '増収増益が続いている銘柄です',
  quality: 'ROE・利益率・自己資本比率が高く、配当も出している銘柄です',
}

const SEGMENT_LABEL: Record<string, string> = {
  prime: 'プライム',
  standard: 'スタンダード',
  growth: 'グロース',
  other: 'その他',
}
const SORT_LABEL: Record<string, string> = {
  dividendYield: '配当利回りの高い順',
  per: 'PER の低い順',
  pbr: 'PBR の低い順',
  marketCap: '時価総額の大きい順',
  growthYears: '増収増益の年数順',
}

const oku = (n: number) => `${Math.round(n / 1e8).toLocaleString('ja-JP')} 億円`

/** criteria_json を条件のチップ（文字列の配列）にする。読めない JSON はそのまま 1 つのチップに */
export function describeCriteria(criteriaJson: string): string[] {
  let c: Record<string, unknown>
  try {
    c = JSON.parse(criteriaJson) as Record<string, unknown>
  } catch {
    return [criteriaJson]
  }
  const out: string[] = []
  const num = (k: string) => (typeof c[k] === 'number' ? (c[k] as number) : undefined)
  if (Array.isArray(c.segments) && c.segments.length > 0)
    out.push(c.segments.map((s) => SEGMENT_LABEL[String(s)] ?? String(s)).join('・'))
  if (Array.isArray(c.sectors) && c.sectors.length > 0) out.push(`業種: ${c.sectors.join('・')}`)
  const perMax = num('perMax')
  if (perMax !== undefined) out.push(`PER ≤ ${perMax} 倍`)
  const pbrMax = num('pbrMax')
  if (pbrMax !== undefined) out.push(`PBR ≤ ${pbrMax.toFixed(1)} 倍`)
  const dividendMin = num('dividendMin')
  if (dividendMin !== undefined) out.push(`配当利回り ≥ ${dividendMin.toFixed(1)}%`)
  const roeMin = num('roeMin')
  if (roeMin !== undefined) out.push(`ROE ≥ ${roeMin}%`)
  const operatingMarginMin = num('operatingMarginMin')
  if (operatingMarginMin !== undefined) out.push(`営業利益率 ≥ ${operatingMarginMin}%`)
  const equityRatioMin = num('equityRatioMin')
  if (equityRatioMin !== undefined) out.push(`自己資本比率 ≥ ${equityRatioMin}%`)
  const growthYears = num('growthYears')
  if (growthYears !== undefined) out.push(`増収増益 ${growthYears} 年以上`)
  const marketCapMin = num('marketCapMin')
  if (marketCapMin !== undefined) out.push(`時価総額 ≥ ${oku(marketCapMin)}`)
  if (typeof c.sort === 'string') out.push(SORT_LABEL[c.sort] ?? `${c.sort} 順`)
  const limit = num('limit')
  if (limit !== undefined) out.push(`上位 ${limit} 件`)
  return out
}
