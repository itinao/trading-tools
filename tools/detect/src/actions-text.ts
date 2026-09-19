import type { Position } from '@trading/domain'
import type { RuleHit } from './rules.ts'

const yen = (n: number) => `${Math.round(n).toLocaleString('ja-JP')} 円`
const price = (n: number) => `${n.toLocaleString('ja-JP')} 円`
const FOOTER = '\n\n売る / 持つの判断は人が行う。これは事実の整理であり、助言ではない。'

/** ルール生成アクションの文面（Design Doc 0005 §3.3）。判断は含めない */
export function actionText(
  hit: RuleHit,
  position: Position,
  asOf: string,
): { title: string; body: string } {
  const d = hit.details
  const n = position.name
  switch (hit.kind) {
    case 'price_drop_cost':
      return {
        title: `${n}: 取得単価比 ${hit.value}%`,
        body:
          `- 日付: ${asOf}\n- 平均取得単価: ${price(Number(d.averageCost))}\n- 当日の株価: ${price(Number(d.price))}\n` +
          `- 保有数量: ${position.quantity.toLocaleString('ja-JP')} 株\n- 含み損益: ${yen((Number(d.price) - position.averageCost) * position.quantity)}` +
          FOOTER,
      }
    case 'drawdown_60d':
      return {
        title: `${n}: 直近高値から ${hit.value}%`,
        body:
          `- 日付: ${asOf}\n- 直近 ${d.window} 営業日の高値: ${price(Number(d.high))}（${d.highAsOf}）\n- 当日の株価: ${price(Number(d.price))}\n` +
          `- 取得単価比: ${pctText(Number(d.price), position.averageCost)}` +
          FOOTER,
      }
    case 'below_ma200':
      return {
        title: `${n}: 200 日線を下回った`,
        body:
          `- 日付: ${asOf}\n- 200 日移動平均: ${price(Number(d.ma))}\n- 当日の株価: ${price(Number(d.price))}（乖離 ${hit.value}%）\n` +
          `- 前日: ${price(Number(d.previousPrice))}（平均 ${price(Number(d.previousMa))}）` +
          FOOTER,
      }
    case 'price_drop_day':
      return {
        title: `${n}: 前日比 ${hit.value}%`,
        body:
          `- 日付: ${asOf}\n- 前日（${d.previousAsOf}）: ${price(Number(d.previous))}\n- 当日の株価: ${price(Number(d.price))}\n` +
          `- 評価額の変化: ${yen((Number(d.price) - Number(d.previous)) * position.quantity)}\n- ニュース・開示を確認する` +
          FOOTER,
      }
  }
}

function pctText(current: number, base: number): string {
  if (base <= 0) return '-'
  return `${(Math.round(((current - base) / base) * 10000) / 100).toFixed(2)}%`
}
