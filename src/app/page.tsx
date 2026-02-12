'use client';

import { useEffect, useState, useCallback } from 'react';
import { Loader } from './components/Loader';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts';

const COLORS = [
  '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
  '#f43f5e', '#f97316', '#eab308', '#84cc16', '#22c55e',
  '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
];

const CARD_COLORS = [
  'from-violet-600 to-indigo-700',
  'from-emerald-600 to-teal-700',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-600',
  'from-cyan-500 to-blue-600',
];

type Analytics = {
  period?: string;
  startDate?: string;
  endDate?: string;
  summary: { totalRevenue: number; totalOrders: number; avgOrder: number };
  managerStats: { name: string; revenue: number; orders: number; avgOrder: number; workHours: number }[];
  regionStats: { name: string; revenue: number; orders: number; avgOrder: number }[];
  hourDistribution: { hour: number; count: number }[];
  dayDistribution: { day: string; count: number; revenue: number }[];
  trendData: { date: string; count: number; revenue: number }[];
  statusDistribution: { name: string; count: number }[];
  topClients: { name: string; revenue: number }[];
  peakHours: { hour: number; count: number }[];
};

const PERIODS = [
  { value: 'yesterday', label: 'За вчера' },
  { value: 'week', label: 'За неделю' },
  { value: 'month', label: 'За месяц' },
];

export default function Dashboard() {
  const [period, setPeriod] = useState('week');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [useCustomRange, setUseCustomRange] = useState(false);
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(() => {
    setLoading(true);
    const params = useCustomRange && dateFrom && dateTo
      ? `from=${dateFrom}&to=${dateTo}`
      : `period=${period}`;
    fetch(`/api/analytics?${params}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [period, useCustomRange, dateFrom, dateTo]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleApplyCustomRange = () => {
    if (dateFrom && dateTo) {
      setUseCustomRange(true);
      setLoading(true);
      fetch(`/api/analytics?from=${dateFrom}&to=${dateTo}`)
        .then((r) => r.json())
        .then(setData)
        .finally(() => setLoading(false));
    }
  };

  if (loading) {
    return <Loader label="Загрузка аналитики..." size="full" />;
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-red-400">
        Ошибка загрузки данных
      </div>
    );
  }

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('ru-RU', { style: 'decimal', maximumFractionDigits: 0 }).format(n) + ' ₽';

  const kpiCards = [
    { title: 'Общая выручка', value: formatCurrency(data.summary.totalRevenue), sub: 'Заработано всего', color: CARD_COLORS[0] },
    { title: 'Всего заказов', value: data.summary.totalOrders.toLocaleString('ru'), sub: 'Записей в системе', color: CARD_COLORS[1] },
    { title: 'Средний чек', value: formatCurrency(data.summary.avgOrder), sub: 'На один заказ', color: CARD_COLORS[2] },
    { title: 'Менеджеров', value: data.managerStats.length.toString(), sub: 'В системе', color: CARD_COLORS[3] },
    { title: 'Регионов', value: data.regionStats.length.toString(), sub: 'География заказов', color: CARD_COLORS[4] },
  ];

  const hourChartData = data.hourDistribution.map((d) => ({
    ...d,
    label: `${d.hour}:00`,
  }));

  return (
    <main className="max-w-[1800px] mx-auto px-6 py-8 space-y-10 text-slate-100 font-sans">
      {/* Фильтр по датам */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-100">Дашборд</h2>
            {data?.startDate && data?.endDate && (
              <p className="text-slate-500 text-sm mt-1">
                {data.startDate} — {data.endDate}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-2 p-2 bg-slate-900/80 rounded-xl border border-slate-800/50">
              {PERIODS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => { setUseCustomRange(false); setPeriod(p.value); }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    !useCustomRange && period === p.value
                      ? 'bg-violet-600 text-white'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500 text-sm">Или период:</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => { setUseCustomRange(true); setDateFrom(e.target.value); }}
                className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-200"
              />
              <span className="text-slate-500">—</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => { setUseCustomRange(true); setDateTo(e.target.value); }}
                className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-200"
              />
              <button
                onClick={handleApplyCustomRange}
                disabled={!dateFrom || !dateTo}
                className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Применить
              </button>
            </div>
          </div>
        </div>
      </div>

        {/* KPI Cards - 5 of 20 params */}
        <section>
          <h2 className="text-slate-400 text-sm font-medium uppercase tracking-wider mb-4">Ключевые показатели</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {kpiCards.map((card, i) => (
              <div
                key={i}
                className={`rounded-2xl bg-gradient-to-br ${card.color} p-5 shadow-xl text-white`}
              >
                <p className="text-white/80 text-sm">{card.title}</p>
                <p className="text-2xl font-bold mt-1">{card.value}</p>
                <p className="text-white/70 text-xs mt-1">{card.sub}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Params 6-8: Manager stats */}
        <section>
          <h2 className="text-slate-400 text-sm font-medium uppercase tracking-wider mb-4">
            6–8. Выручка и заказы по менеджерам
          </h2>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 overflow-x-auto">
            <div className="min-w-[600px] h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.managerStats.slice(0, 15)} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#94a3b8' }} tickFormatter={(v) => (v >= 1000 ? v / 1000 + 'k' : v)} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                    formatter={(value: number | undefined) => [value != null ? formatCurrency(value) : '-', 'Выручка']}
                  />
                  <Bar dataKey="revenue" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        {/* Params 9–10: Work hours & Regions */}
        <div className="grid lg:grid-cols-2 gap-6">
          <section>
            <h2 className="text-slate-400 text-sm font-medium uppercase tracking-wider mb-4">
              9. Распределение по часам работы
            </h2>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourChartData} margin={{ top: 20, right: 20, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#94a3b8' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} />
                  <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
          <section>
            <h2 className="text-slate-400 text-sm font-medium uppercase tracking-wider mb-4">
              10. Активность по дням недели
            </h2>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.dayDistribution} margin={{ top: 20, right: 20, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="day" tick={{ fill: '#94a3b8' }} />
                  <YAxis tick={{ fill: '#94a3b8' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} />
                  <Bar dataKey="count" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="revenue" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  <Legend />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>

        {/* 11–12: Regions & Trend */}
        <div className="grid lg:grid-cols-2 gap-6">
          <section>
            <h2 className="text-slate-400 text-sm font-medium uppercase tracking-wider mb-4">
              11–12. Регионы — выручка и заказы
            </h2>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 h-80 overflow-x-auto">
              <div className="min-w-[400px] h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.regionStats.slice(0, 12)} layout="vertical" margin={{ top: 20, right: 30, left: 80, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis type="number" tick={{ fill: '#94a3b8' }} tickFormatter={(v) => v / 1000 + 'k'} />
                    <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} width={75} />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} />
                    <Bar dataKey="revenue" fill="#ec4899" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>
          <section>
            <h2 className="text-slate-400 text-sm font-medium uppercase tracking-wider mb-4">
              13. Динамика выручки по датам
            </h2>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.trendData.slice(-60)} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#94a3b8' }} tickFormatter={(v) => v / 1000 + 'k'} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} />
                  <Line type="monotone" dataKey="revenue" stroke="#f97316" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} dot={false} />
                  <Legend />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>

        {/* 14–15: Status & Top clients */}
        <div className="grid lg:grid-cols-2 gap-6">
          <section>
            <h2 className="text-slate-400 text-sm font-medium uppercase tracking-wider mb-4">
              14. Статусы заказов
            </h2>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.statusDistribution}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  >
                    {data.statusDistribution.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </section>
          <section>
            <h2 className="text-slate-400 text-sm font-medium uppercase tracking-wider mb-4">
              15. Топ-15 клиентов по выручке
            </h2>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 h-72 overflow-y-auto">
              <div className="space-y-2">
                {data.topClients.map((c, i) => (
                  <div key={i} className="flex justify-between items-center py-2 border-b border-slate-800/50 last:border-0">
                    <span className="text-slate-300 text-sm truncate max-w-[60%]">{c.name}</span>
                    <span className="text-emerald-400 font-medium">{formatCurrency(c.revenue)}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        {/* 16–17: Avg order by manager, Peak hours */}
        <div className="grid lg:grid-cols-2 gap-6">
          <section>
            <h2 className="text-slate-400 text-sm font-medium uppercase tracking-wider mb-4">
              16. Средний чек по менеджерам
            </h2>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.managerStats.slice(0, 12)} margin={{ top: 20, right: 20, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={60} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#94a3b8' }} tickFormatter={(v) => v / 1000 + 'k'} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} />
                  <Bar dataKey="avgOrder" fill="#eab308" radius={[4, 4, 0, 0]} name="Средний чек" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
          <section>
            <h2 className="text-slate-400 text-sm font-medium uppercase tracking-wider mb-4">
              17. Пиковые часы активности
            </h2>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
              <div className="grid grid-cols-5 gap-3">
                {data.peakHours.map((p, i) => (
                  <div key={i} className="rounded-xl bg-slate-800/50 p-4 text-center">
                    <p className="text-2xl font-bold text-violet-400">{p.hour}:00</p>
                    <p className="text-slate-500 text-sm">заказов: {p.count.toLocaleString('ru')}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        {/* 18–20: Work hours by manager, Region avg, Manager table */}
        <section>
          <h2 className="text-slate-400 text-sm font-medium uppercase tracking-wider mb-4">
            18–20. Детальная таблица менеджеров
          </h2>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700 bg-slate-800/50">
                    <th className="text-left py-3 px-4 font-medium text-slate-400">Менеджер</th>
                    <th className="text-right py-3 px-4 font-medium text-slate-400">Выручка</th>
                    <th className="text-right py-3 px-4 font-medium text-slate-400">Заказов</th>
                    <th className="text-right py-3 px-4 font-medium text-slate-400">Средний чек</th>
                    <th className="text-right py-3 px-4 font-medium text-slate-400">Часов работы</th>
                  </tr>
                </thead>
                <tbody>
                  {data.managerStats.map((m, i) => (
                    <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                      <td className="py-3 px-4 text-slate-200">{m.name}</td>
                      <td className="py-3 px-4 text-right text-emerald-400">{formatCurrency(m.revenue)}</td>
                      <td className="py-3 px-4 text-right text-slate-300">{m.orders.toLocaleString('ru')}</td>
                      <td className="py-3 px-4 text-right text-amber-400">{formatCurrency(m.avgOrder)}</td>
                      <td className="py-3 px-4 text-right text-cyan-400">{m.workHours}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Region avg */}
        <section>
          <h2 className="text-slate-400 text-sm font-medium uppercase tracking-wider mb-4">
            Средний чек по регионам
          </h2>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
            <div className="flex flex-wrap gap-3">
              {data.regionStats.slice(0, 20).map((r, i) => (
                <div key={i} className="rounded-lg bg-slate-800/50 px-4 py-2 flex items-center gap-2">
                  <span className="text-slate-400 text-sm">{r.name}</span>
                  <span className="text-emerald-400 font-medium">{formatCurrency(r.avgOrder)}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <footer className="text-center text-slate-600 text-sm py-8">
          Аналитика менеджеров • 20 параметров • Заказы.xlsx
        </footer>
    </main>
  );
}
