/**
 * Pure calculation logic for working hours analytics.
 * Testable without Prisma/DB.
 */

export const LATE_THRESHOLD_MINUTES = 9 * 60; // 9:00
export const EARLY_THRESHOLD_MINUTES = 8 * 60; // 8:00
export const LATE_END_MINUTES = 18 * 60; // 18:00

export type OrderInput = { date: Date; time: string; manager: string };

export function parseTimeToMinutes(timeStr: string): number | null {
  if (!timeStr) return null;
  const parts = String(timeStr).trim().split(':');
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) || 0;
  const s = parseInt(parts[2], 10) || 0;
  if (isNaN(h)) return null;
  return h * 60 + m + s / 60;
}

export function minutesToTime(m: number): string {
  const h = Math.floor(m / 60);
  const min = Math.floor(m % 60);
  return `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
}

export type DayRecord = {
  date: string;
  firstOrder: string;
  lastOrder: string;
  firstMinutes: number;
  lastMinutes: number;
  duration: number;
  orderCount: number;
};

export type ManagerStat = {
  name: string;
  workDays: number;
  totalOrders: number;
  avgStartMinutes: number;
  avgEndMinutes: number;
  avgDurationHours: number;
  avgStart: string;
  avgEnd: string;
  medianStart: string;
  medianEnd: string;
  minStart: string;
  maxEnd: string;
  lateCount: number;
  latePercent: number;
  earlyCount: number;
  lateEndCount: number;
  lateEndPercent: number;
  avgOrdersPerDay: number;
  varianceStartMinutes: number;
  peakStartHour: string;
  peakEndHour: string;
  deviationFromTargetMinutes: number;
  complianceScore: number;
  byDayOfWeek: { day: string; avgStart: number; count: number }[];
  dayByDay: DayRecord[];
};

export function computeWorkingHoursStats(
  orders: OrderInput[],
  formatDate: (d: Date) => string = (d) => d.toISOString().slice(0, 10)
): ManagerStat[] {
  const dayNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  type DayRec = { firstMinutes: number; lastMinutes: number; orderCount: number };
  const byManagerDay = new Map<string, Map<string, DayRec>>();

  for (const o of orders) {
    const dayOfWeek = o.date.getDay(); // 0=Вс, 6=Сб
    if (dayOfWeek === 0 || dayOfWeek === 6) continue; // выходные не учитываем

    const manager = o.manager || 'Не указан';
    const dateKey = formatDate(o.date);
    const minutes = parseTimeToMinutes(o.time);
    if (minutes === null) continue;

    if (!byManagerDay.has(manager)) byManagerDay.set(manager, new Map());
    const days = byManagerDay.get(manager)!;

    if (!days.has(dateKey)) {
      days.set(dateKey, { firstMinutes: minutes, lastMinutes: minutes, orderCount: 1 });
    } else {
      const rec = days.get(dateKey)!;
      rec.firstMinutes = Math.min(rec.firstMinutes, minutes);
      rec.lastMinutes = Math.max(rec.lastMinutes, minutes);
      rec.orderCount += 1;
    }
  }

  const MIN_ORDERS_FOR_WORKING_DAY = 1; // день с 1+ заказом учитываем (дни без данных/0 заказов — исключены)

  return Array.from(byManagerDay.entries()).map(([name, days]) => {
    const allDayRecs = Array.from(days.entries());
    const dayRecs = allDayRecs
      .filter(([, rec]) => rec.orderCount >= MIN_ORDERS_FOR_WORKING_DAY)
      .map(([, rec]) => rec);
    const firstTimes = dayRecs.map((d) => d.firstMinutes);
    const lastTimes = dayRecs.map((d) => d.lastMinutes);
    const orderCounts = dayRecs.map((d) => d.orderCount);

    const avgStart = firstTimes.length ? firstTimes.reduce((a, b) => a + b, 0) / firstTimes.length : 0;
    const avgEnd = lastTimes.length ? lastTimes.reduce((a, b) => a + b, 0) / lastTimes.length : 0;
    const avgDuration = avgEnd - avgStart;

    const lateCount = firstTimes.filter((m) => m > LATE_THRESHOLD_MINUTES).length;
    const earlyCount = firstTimes.filter((m) => m < EARLY_THRESHOLD_MINUTES).length;
    const lateEndCount = lastTimes.filter((m) => m > LATE_END_MINUTES).length;

    const sortedFirst = [...firstTimes].sort((a, b) => a - b);
    const sortedLast = [...lastTimes].sort((a, b) => a - b);
    const medianStart = sortedFirst.length ? sortedFirst[Math.floor(sortedFirst.length / 2)] : 0;
    const medianEnd = sortedLast.length ? sortedLast[Math.floor(sortedLast.length / 2)] : 0;

    const minStart = firstTimes.length ? Math.min(...firstTimes) : 0;
    const maxEnd = lastTimes.length ? Math.max(...lastTimes) : 0;

    const varianceStart =
      firstTimes.length > 1
        ? firstTimes.reduce((s, v) => s + (v - avgStart) ** 2, 0) / firstTimes.length
        : 0;

    const byDayOfWeek = new Map<number, number[]>();
    for (let i = 0; i < 7; i++) byDayOfWeek.set(i, []);
    for (const [dateKey, rec] of allDayRecs) {
      if (rec.orderCount < MIN_ORDERS_FOR_WORKING_DAY) continue;
      const d = new Date(dateKey + 'T12:00:00');
      const dow = d.getDay();
      byDayOfWeek.get(dow)!.push(rec.firstMinutes);
    }

    const avgByDay = Array.from(byDayOfWeek.entries()).map(([dow, arr]) => ({
      day: dayNames[dow],
      avgStart: arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0,
      count: arr.length,
    }));

    const totalOrders = orderCounts.reduce((a, b) => a + b, 0);
    const totalAllOrders = Array.from(days.values()).reduce((s, r) => s + r.orderCount, 0);
    const avgOrdersPerDay = dayRecs.length ? totalOrders / dayRecs.length : 0;

    const peakStartHour = firstTimes.length
      ? (() => {
          const byHour = new Map<number, number>();
          for (const m of firstTimes) {
            const h = Math.floor(m / 60);
            byHour.set(h, (byHour.get(h) ?? 0) + 1);
          }
          return [...byHour.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
        })()
      : 0;

    const peakEndHour = lastTimes.length
      ? (() => {
          const byHour = new Map<number, number>();
          for (const m of lastTimes) {
            const h = Math.floor(m / 60);
            byHour.set(h, (byHour.get(h) ?? 0) + 1);
          }
          return [...byHour.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
        })()
      : 0;

    const targetStart = 8 * 60;
    const deviationFromTarget = avgStart - targetStart;
    const complianceScore =
      dayRecs.length > 0
        ? 100 - (lateCount / dayRecs.length) * 50 - Math.max(0, (avgStart - targetStart) / 60) * 5
        : 0;

    const dayByDay = allDayRecs
      .filter(([, rec]) => rec.orderCount >= MIN_ORDERS_FOR_WORKING_DAY)
      .map(([dateKey, rec]) => ({
        date: dateKey,
        firstOrder: minutesToTime(rec.firstMinutes),
        lastOrder: minutesToTime(rec.lastMinutes),
        firstMinutes: rec.firstMinutes,
        lastMinutes: rec.lastMinutes,
        duration: Math.round((rec.lastMinutes - rec.firstMinutes) / 6) / 10,
        orderCount: rec.orderCount,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      name,
      workDays: dayRecs.length,
      totalOrders: totalAllOrders,
      avgStartMinutes: Math.round(avgStart * 10) / 10,
      avgEndMinutes: Math.round(avgEnd * 10) / 10,
      avgDurationHours: Math.round((avgDuration / 60) * 10) / 10,
      avgStart: minutesToTime(avgStart),
      avgEnd: minutesToTime(avgEnd),
      medianStart: minutesToTime(medianStart),
      medianEnd: minutesToTime(medianEnd),
      minStart: minutesToTime(minStart),
      maxEnd: minutesToTime(maxEnd),
      lateCount,
      latePercent: dayRecs.length ? Math.round((lateCount / dayRecs.length) * 100) : 0,
      earlyCount,
      lateEndCount,
      lateEndPercent: dayRecs.length ? Math.round((lateEndCount / dayRecs.length) * 100) : 0,
      avgOrdersPerDay: Math.round(avgOrdersPerDay * 10) / 10,
      varianceStartMinutes: Math.round(varianceStart * 10) / 10,
      peakStartHour: `${peakStartHour}:00`,
      peakEndHour: `${peakEndHour}:00`,
      deviationFromTargetMinutes: Math.round(deviationFromTarget),
      complianceScore: Math.round(Math.max(0, complianceScore)),
      byDayOfWeek: avgByDay,
      dayByDay,
    };
  });
}
