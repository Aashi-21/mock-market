export function createId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function roundPrice(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Skip weekends for a crude NSE calendar (stub until real calendar API). */
export function nextTradingDay(isoDate: string): string {
  let next = addDays(isoDate, 1);
  for (let i = 0; i < 10; i += 1) {
    const day = new Date(`${next}T00:00:00.000Z`).getUTCDay();
    if (day !== 0 && day !== 6) return next;
    next = addDays(next, 1);
  }
  return next;
}
