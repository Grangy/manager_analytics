import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { format, getDay, getHours, subDays, startOfDay, endOfDay, parseISO } from 'date-fns';

function parseTime(timeStr: string, date: Date): Date | null {
  if (!timeStr) return null;
  const [h, m, s] = timeStr.split(':').map(Number);
  if (isNaN(h)) return null;
  const d = new Date(date);
  d.setHours(h ?? 0, m ?? 0, s ?? 0, 0);
  return d;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const period = searchParams.get('period') || 'week';
  const dateFrom = searchParams.get('from');
  const dateTo = searchParams.get('to');

  const now = new Date();
  let startDate: Date;
  let endDate: Date;

  if (dateFrom && dateTo) {
    startDate = startOfDay(parseISO(dateFrom));
    endDate = endOfDay(parseISO(dateTo));
  } else {
    switch (period) {
      case 'yesterday':
        startDate = startOfDay(subDays(now, 1));
        endDate = endOfDay(subDays(now, 1));
        break;
      case 'month':
        startDate = startOfDay(subDays(now, 30));
        endDate = endOfDay(now);
        break;
      case 'week':
      default:
        startDate = startOfDay(subDays(now, 7));
        endDate = endOfDay(now);
        break;
    }
  }

  const orders = await prisma.order.findMany({
    where: {
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    orderBy: { date: 'asc' },
  });

  const totalRevenue = orders.reduce((s, o) => s + o.amount, 0);
  const totalOrders = orders.length;
  const avgOrder = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // By manager
  const byManager = new Map<string, { revenue: number; count: number; hours: Set<string> }>();
  for (const o of orders) {
    const m = o.manager || 'Не указан';
    if (!byManager.has(m)) byManager.set(m, { revenue: 0, count: 0, hours: new Set() });
    const rec = byManager.get(m)!;
    rec.revenue += o.amount;
    rec.count += 1;
    const dt = parseTime(o.time, o.date);
    if (dt) rec.hours.add(`${format(o.date, 'yyyy-MM-dd')}-${getHours(dt)}`);
  }

  const managerStats = Array.from(byManager.entries()).map(([name, rec]) => ({
    name,
    revenue: Math.round(rec.revenue * 100) / 100,
    orders: rec.count,
    avgOrder: Math.round((rec.revenue / rec.count) * 100) / 100,
    workHours: rec.hours.size,
  })).sort((a, b) => b.revenue - a.revenue);

  // By region
  const byRegion = new Map<string, { revenue: number; count: number }>();
  for (const o of orders) {
    const r = o.businessRegion || 'Не указан';
    if (!byRegion.has(r)) byRegion.set(r, { revenue: 0, count: 0 });
    const rec = byRegion.get(r)!;
    rec.revenue += o.amount;
    rec.count += 1;
  }

  const regionStats = Array.from(byRegion.entries())
    .map(([name, rec]) => ({
      name,
      revenue: Math.round(rec.revenue * 100) / 100,
      orders: rec.count,
      avgOrder: Math.round((rec.revenue / rec.count) * 100) / 100,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  // By hour
  const byHour = new Map<number, number>();
  for (let h = 0; h < 24; h++) byHour.set(h, 0);
  for (const o of orders) {
    const dt = parseTime(o.time, o.date);
    if (dt) {
      const h = getHours(dt);
      byHour.set(h, (byHour.get(h) ?? 0) + 1);
    }
  }

  const hourDistribution = Array.from(byHour.entries()).map(([hour, count]) => ({ hour, count }));

  // By day of week
  const dayNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  const byDay = new Map<number, { count: number; revenue: number }>();
  for (let d = 0; d < 7; d++) byDay.set(d, { count: 0, revenue: 0 });
  for (const o of orders) {
    const d = getDay(o.date);
    const rec = byDay.get(d)!;
    rec.count += 1;
    rec.revenue += o.amount;
  }
  const dayDistribution = Array.from(byDay.entries()).map(([day, rec]) => ({
    day: dayNames[day],
    count: rec.count,
    revenue: Math.round(rec.revenue * 100) / 100,
  }));

  // By date (trend)
  const byDate = new Map<string, { count: number; revenue: number }>();
  for (const o of orders) {
    const key = format(o.date, 'yyyy-MM-dd');
    if (!byDate.has(key)) byDate.set(key, { count: 0, revenue: 0 });
    const rec = byDate.get(key)!;
    rec.count += 1;
    rec.revenue += o.amount;
  }
  const trendData = Array.from(byDate.entries())
    .map(([date, rec]) => ({ date, count: rec.count, revenue: Math.round(rec.revenue * 100) / 100 }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // By status
  const byStatus = new Map<string, number>();
  for (const o of orders) {
    const s = o.status || 'Не указан';
    byStatus.set(s, (byStatus.get(s) ?? 0) + 1);
  }
  const statusDistribution = Array.from(byStatus.entries()).map(([name, count]) => ({ name, count }));

  // Top clients
  const byClient = new Map<string, number>();
  for (const o of orders) {
    const c = o.client || 'Не указан';
    byClient.set(c, (byClient.get(c) ?? 0) + o.amount);
  }
  const topClients = Array.from(byClient.entries())
    .map(([name, revenue]) => ({ name, revenue: Math.round(revenue * 100) / 100 }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 15);

  // Peak hours (top 5)
  const peakHours = [...hourDistribution].sort((a, b) => b.count - a.count).slice(0, 5);

  return NextResponse.json({
    period,
    startDate: format(startDate, 'yyyy-MM-dd'),
    endDate: format(endDate, 'yyyy-MM-dd'),
    summary: {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalOrders,
      avgOrder: Math.round(avgOrder * 100) / 100,
    },
    managerStats,
    regionStats,
    hourDistribution,
    dayDistribution,
    trendData,
    statusDistribution,
    topClients,
    peakHours,
  });
}
