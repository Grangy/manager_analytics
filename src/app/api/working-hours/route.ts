import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { format, subDays, startOfDay, endOfDay, parseISO } from 'date-fns';
import { computeWorkingHoursStats } from '@/lib/working-hours';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const period = searchParams.get('period') || 'week';
  const dateFrom = searchParams.get('from'); // yyyy-mm-dd
  const dateTo = searchParams.get('to');   // yyyy-mm-dd

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
    orderBy: [{ date: 'asc' }, { time: 'asc' }],
  });

  const orderInputs = orders.map((o) => ({
    date: o.date,
    time: o.time,
    manager: o.manager,
  }));

  const managerStats = computeWorkingHoursStats(orderInputs, (d) =>
    format(d, 'yyyy-MM-dd')
  );
  const sortedStats = managerStats.sort((a, b) => b.workDays - a.workDays);

  return NextResponse.json({
    period,
    startDate: format(startDate, 'yyyy-MM-dd'),
    endDate: format(endDate, 'yyyy-MM-dd'),
    managerStats: sortedStats,
  });
}
