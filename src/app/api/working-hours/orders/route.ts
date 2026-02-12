import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { format, subDays, startOfDay, endOfDay, parseISO } from 'date-fns';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const manager = searchParams.get('manager');
  const period = searchParams.get('period') || 'week';
  const dateFrom = searchParams.get('from');
  const dateTo = searchParams.get('to');

  if (!manager) {
    return NextResponse.json({ error: 'manager required' }, { status: 400 });
  }

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
      manager,
      date: { gte: startDate, lte: endDate },
    },
    orderBy: [{ date: 'desc' }, { time: 'desc' }],
  });

  const formatted = orders.map((o) => ({
    orderNumber: o.orderNumber,
    date: format(o.date, 'yyyy-MM-dd'),
    time: o.time,
    amount: o.amount,
    client: o.client,
    status: o.status,
    region: o.businessRegion,
  }));

  return NextResponse.json({ orders: formatted });
}
