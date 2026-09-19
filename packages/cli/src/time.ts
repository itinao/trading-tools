const JST_OFFSET_MS = 9 * 60 * 60 * 1000

function jstParts(date: Date) {
  const shifted = new Date(date.getTime() + JST_OFFSET_MS)
  const p = (n: number, w = 2) => String(n).padStart(w, '0')
  return {
    date: `${shifted.getUTCFullYear()}-${p(shifted.getUTCMonth() + 1)}-${p(shifted.getUTCDate())}`,
    time: `${p(shifted.getUTCHours())}:${p(shifted.getUTCMinutes())}:${p(shifted.getUTCSeconds())}`,
  }
}

/** 現在時刻を Asia/Tokyo の ISO 8601（秒まで、+09:00）で返す。Design Doc 0002 §3.3 */
export function nowJst(date: Date = new Date()): string {
  const { date: d, time } = jstParts(date)
  return `${d}T${time}+09:00`
}

/** 今日の日付を Asia/Tokyo の YYYY-MM-DD で返す */
export function todayJst(date: Date = new Date()): string {
  return jstParts(date).date
}

export function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))
}
