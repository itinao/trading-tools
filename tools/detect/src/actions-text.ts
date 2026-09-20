import type { MonitoredInstrument } from '@trading/domain'
import type { RuleHit } from './rules/index.ts'

const yen = (n: number | null | undefined) =>
  n == null ? '-' : `${Math.round(n).toLocaleString('ja-JP')} 円`
const price = (n: number | null | undefined) =>
  n == null ? '-' : `${n.toLocaleString('ja-JP')} 円`
const oku = (n: number | null | undefined) =>
  n == null ? '-' : `${(n / 1e8).toLocaleString('ja-JP', { maximumFractionDigits: 0 })} 億円`
const FOOTER = '\n\n売る / 持つの判断は人が行う。これは事実の整理であり、助言ではない。'

/** ルール生成アクションの文面（Design Doc 0005 §3.3、0011 §3.5）。判断は含めない */
export function actionText(
  hit: RuleHit,
  subject: MonitoredInstrument,
  asOf: string,
): { title: string; body: string } {
  const d = hit.details
  const n = subject.name
  const quantity = subject.position?.quantity ?? 0
  const averageCost = subject.position?.averageCost ?? 0
  const num = (k: string) => Number(d[k])
  switch (hit.kind) {
    case 'price_drop_cost':
      return {
        title: `${n}: 取得単価比 ${hit.value}%`,
        body:
          `- 日付: ${asOf}\n- 平均取得単価: ${price(num('averageCost'))}\n- 当日の株価: ${price(num('price'))}\n` +
          `- 保有数量: ${quantity.toLocaleString('ja-JP')} 株\n- 含み損益: ${yen((num('price') - averageCost) * quantity)}` +
          FOOTER,
      }
    case 'drawdown_60d':
      return {
        title: `${n}: 直近高値から ${hit.value}%`,
        body:
          `- 日付: ${asOf}\n- 直近 ${d.window} 営業日の高値: ${price(num('high'))}（${d.highAsOf}）\n- 当日の株価: ${price(num('price'))}\n` +
          `- 取得単価比: ${pctText(num('price'), averageCost)}` +
          FOOTER,
      }
    case 'below_ma200':
      return {
        title: `${n}: 200 日線を下回った`,
        body:
          `- 日付: ${asOf}\n- 200 日移動平均: ${price(num('ma'))}\n- 当日の株価: ${price(num('price'))}（乖離 ${hit.value}%）\n` +
          `- 前日: ${price(num('previousPrice'))}（平均 ${price(num('previousMa'))}）` +
          FOOTER,
      }
    case 'price_drop_day':
      return {
        title: `${n}: 前日比 ${hit.value}%`,
        body:
          `- 日付: ${asOf}\n- 前日（${d.previousAsOf}）: ${price(num('previous'))}\n- 当日の株価: ${price(num('price'))}\n` +
          `- 評価額の変化: ${yen((num('price') - num('previous')) * quantity)}\n- ニュース・開示を確認する` +
          FOOTER,
      }
    case 'news_negative':
      return {
        title: `${n}: 悪材料のニュース（${d.count} 件）`,
        body:
          `- 見出し: ${d.title}\n- 判定の要約: ${d.summary}\n- 根拠: ${d.rationale}\n- 判定 id: ${d.assessmentId}（\`pnpm assess override\` で上書きできる）` +
          FOOTER,
      }
    case 'forecast_down':
      return {
        title: `${n}: 業績予想の下方修正`,
        body:
          `- 開示: ${d.title}（${d.disclosedAt}）\n- 判定の要約: ${d.summary}\n- 根拠: ${d.rationale}\n- 判定 id: ${d.assessmentId}` +
          FOOTER,
      }
    case 'dividend_cut':
      return {
        title: `${n}: 減配・無配`,
        body:
          `- 開示: ${d.title}（${d.disclosedAt}）\n- 判定の要約: ${d.summary}\n- 根拠: ${d.rationale}\n- 判定 id: ${d.assessmentId}` +
          FOOTER,
      }
    case 'margin_deterioration':
      return {
        title: `${n}: 営業利益率が前年比 ${hit.value} pt`,
        body:
          `- ${d.previousPeriod}: 売上 ${oku(num('previousRevenue'))}、営業利益 ${oku(num('previousOperatingIncome'))}、利益率 ${d.previousMargin}%\n` +
          `- ${d.currentPeriod}: 売上 ${oku(num('currentRevenue'))}、営業利益 ${oku(num('currentOperatingIncome'))}、利益率 ${d.currentMargin}%` +
          FOOTER,
      }
    case 'equity_ratio_drop':
      return {
        title: `${n}: 自己資本比率が前年比 ${hit.value} pt`,
        body:
          `- ${d.previousPeriod}: 総資産 ${oku(num('previousAssets'))}、自己資本 ${oku(num('previousEquity'))}、比率 ${d.previousRatio}%\n` +
          `- ${d.currentPeriod}: 総資産 ${oku(num('currentAssets'))}、自己資本 ${oku(num('currentEquity'))}、比率 ${d.currentRatio}%` +
          FOOTER,
      }
    case 'valuation_cheap':
      return {
        title: `${n}: 割安の候補（PER ${d.per} / PBR ${d.pbr} / 配当利回り ${d.dividendYield}%）`,
        body:
          `- 日付: ${asOf}（指標は ${d.asOf}）\n- PER ${d.per}、PBR ${d.pbr}、配当利回り ${d.dividendYield}%\n- 買い検討の候補。業績・開示を確認する` +
          FOOTER,
      }
    case 'growth_streak':
      return {
        title: `${n}: 増収増益 ${d.years} 年連続`,
        body:
          `- 日付: ${asOf}\n- ${d.periods}\n- 買い検討の候補。株価の位置と評価（PER）を確認する` +
          FOOTER,
      }
    case 'oversold_quality':
      return {
        title: `${n}: 売られすぎの候補（高値から ${hit.value}%、${d.quality === 'valuation_cheap' ? '割安' : '成長'}）`,
        body:
          `- 日付: ${asOf}\n- 当日の株価: ${price(num('price'))}、200 日線 ${price(num('ma200'))}、60 日高値 ${price(num('high60'))}（${d.drawdown}%）\n- 企業側: ${d.quality === 'valuation_cheap' ? '割安（valuation_cheap）' : '増収増益（growth_streak）'}\n- 最も強い買い検討の候補。下落の理由（ニュース・開示）を確認する` +
          FOOTER,
      }
    case 'score_low':
      return {
        title: `${n}: スコア ${hit.value}`,
        body:
          `- 日付: ${asOf}\n- スコア: ${d.score}（判定 ${d.assessment} / 株価 ${d.price} / 財務 ${d.financials}）\n- 内訳は銘柄詳細で確認する` +
          FOOTER,
      }
  }
}

function pctText(current: number, base: number): string {
  if (base <= 0) return '-'
  return `${(Math.round(((current - base) / base) * 10000) / 100).toFixed(2)}%`
}
