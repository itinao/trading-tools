import { pctOf } from '../../../shared/lib'

/** 保有の現在価値。株価がなければスナップショット時点の値を使う */
export function valuation(
  h: { quantity: number; averageCost: number; marketValue: number; unrealizedPnl: number },
  price: number | null,
): { marketValue: number; unrealizedPnl: number; costChangePct: number | null } {
  if (price == null)
    return { marketValue: h.marketValue, unrealizedPnl: h.unrealizedPnl, costChangePct: null }
  return {
    marketValue: Math.round(price * h.quantity),
    unrealizedPnl: Math.round((price - h.averageCost) * h.quantity),
    costChangePct: pctOf(price, h.averageCost),
  }
}
