'use client';

import { useEffect, useState, useCallback } from 'react';
import { Loader } from '../components/Loader';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

type DayRecord = { date: string; firstOrder: string; lastOrder: string; duration: number; orderCount: number };

type ManagerStat = {
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
  dayByDay?: DayRecord[];
};

type WorkingHoursData = {
  period: string;
  startDate: string;
  endDate: string;
  managerStats: ManagerStat[];
};

const PERIODS = [
  { value: 'yesterday', label: 'За вчера' },
  { value: 'week', label: 'За неделю' },
  { value: 'month', label: 'За месяц' },
];

function minutesToTime(m: number): string {
  const h = Math.floor(m / 60);
  const min = Math.round(m % 60);
  return `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
}

type OrderRow = { orderNumber: string; date: string; time: string; amount: number; client: string | null; status: string | null; region: string | null };

export default function WorkingHoursPage() {
  const [period, setPeriod] = useState('week');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [useCustomRange, setUseCustomRange] = useState(false);
  const [data, setData] = useState<WorkingHoursData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterDurationMin, setFilterDurationMin] = useState<number | ''>('');
  const [filterDurationMax, setFilterDurationMax] = useState<number | ''>('');
  const [filterOrdersMin, setFilterOrdersMin] = useState<number | ''>('');
  const [sortBy, setSortBy] = useState<'duration' | 'orders' | 'late'>('duration');
  const [modalManager, setModalManager] = useState<ManagerStat | null>(null);
  const [modalOrders, setModalOrders] = useState<OrderRow[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const loadData = useCallback(() => {
    setLoading(true);
    const params = useCustomRange && dateFrom && dateTo
      ? `from=${dateFrom}&to=${dateTo}`
      : `period=${period}`;
    fetch(`/api/working-hours?${params}`)
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
      fetch(`/api/working-hours?from=${dateFrom}&to=${dateTo}`)
        .then((r) => r.json())
        .then(setData)
        .finally(() => setLoading(false));
    }
  };

  const openOrdersModal = (m: ManagerStat) => {
    setModalManager(m);
    setModalOpen(true);
    setModalOrders([]);
    setModalLoading(true);
    const params = useCustomRange && dateFrom && dateTo
      ? `from=${dateFrom}&to=${dateTo}`
      : `period=${period}`;
    fetch(`/api/working-hours/orders?manager=${encodeURIComponent(m.name)}&${params}`)
      .then((r) => r.json())
      .then((res) => setModalOrders(res.orders || []))
      .finally(() => setModalLoading(false));
  };

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setModalManager(null);
    setModalOrders([]);
  }, []);

  useEffect(() => {
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };
    if (modalOpen) {
      document.addEventListener('keydown', onEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', onEscape);
      document.body.style.overflow = '';
    };
  }, [modalOpen, closeModal]);

  if (loading) {
    return <Loader label="Загрузка данных..." size="full" />;
  }

  if (!data) {
    return (
      <main className="max-w-[1800px] mx-auto px-6 py-8 text-red-400">
        Ошибка загрузки данных
      </main>
    );
  }

  const chartData = data.managerStats.slice(0, 15).map((m) => ({
    name: m.name.length > 12 ? m.name.slice(0, 12) + '...' : m.name,
    fullName: m.name,
    avgStart: m.avgStartMinutes / 60,
    avgEnd: m.avgEndMinutes / 60,
    lateCount: m.lateCount,
    workDays: m.workDays,
  }));

  const filteredManagers = data.managerStats
    .filter((m) => {
      if (filterDurationMin !== '' && m.avgDurationHours < Number(filterDurationMin)) return false;
      if (filterDurationMax !== '' && m.avgDurationHours > Number(filterDurationMax)) return false;
      if (filterOrdersMin !== '' && m.totalOrders < Number(filterOrdersMin)) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'duration') return b.avgDurationHours - a.avgDurationHours;
      if (sortBy === 'orders') return b.totalOrders - a.totalOrders;
      return b.lateCount - a.lateCount;
    });

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(n) + ' ₽';

  return (
    <main className="max-w-[1800px] mx-auto px-6 py-8 space-y-8 text-slate-100 font-sans">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-100">Рабочее время</h2>
            <p className="text-slate-500 text-sm mt-1">
              {data.startDate} — {data.endDate}
            </p>
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
        <div className="rounded-lg bg-slate-800/50 border border-slate-700/50 px-4 py-3 text-slate-400 text-sm">
          <strong className="text-slate-300">Методика расчёта:</strong> Учитываем только будние дни (сб, вс исключены). Для каждого дня находим
          <strong className="text-violet-400"> первый заказ</strong> и
          <strong className="text-cyan-400"> последний заказ</strong>. По ним вычисляем среднее время начала и окончания.
        </div>
      </div>

      {/* Сводка по менеджерам — ключевые показатели */}
      <section>
        <h3 className="text-slate-400 text-sm font-medium uppercase tracking-wider mb-4">
          Сводка по менеджерам
        </h3>
        <div className="flex flex-wrap items-center gap-4 mb-4 p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
          <span className="text-slate-500 text-sm">Фильтры:</span>
          <div className="flex items-center gap-2">
            <label className="text-slate-400 text-sm">Длительность, ч</label>
            <input
              type="number"
              placeholder="мин"
              value={filterDurationMin}
              onChange={(e) => setFilterDurationMin(e.target.value === '' ? '' : parseFloat(e.target.value) || '')}
              className="w-16 rounded-lg bg-slate-700 border border-slate-600 px-2 py-1.5 text-sm text-slate-200"
              step={0.5}
              min={0}
            />
            <span className="text-slate-500">—</span>
            <input
              type="number"
              placeholder="макс"
              value={filterDurationMax}
              onChange={(e) => setFilterDurationMax(e.target.value === '' ? '' : parseFloat(e.target.value) || '')}
              className="w-16 rounded-lg bg-slate-700 border border-slate-600 px-2 py-1.5 text-sm text-slate-200"
              step={0.5}
              min={0}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-slate-400 text-sm">Заказов от</label>
            <input
              type="number"
              placeholder="—"
              value={filterOrdersMin}
              onChange={(e) => setFilterOrdersMin(e.target.value === '' ? '' : parseInt(e.target.value, 10) || '')}
              className="w-20 rounded-lg bg-slate-700 border border-slate-600 px-2 py-1.5 text-sm text-slate-200"
              min={0}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-slate-400 text-sm">Сортировка</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'duration' | 'orders' | 'late')}
              className="rounded-lg bg-slate-700 border border-slate-600 px-3 py-1.5 text-sm text-slate-200"
            >
              <option value="duration">По длительности дня</option>
              <option value="orders">По кол-ву заказов</option>
              <option value="late">По опозданиям</option>
            </select>
          </div>
          <span className="text-slate-500 text-sm">Нажмите на карточку — все заказы</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredManagers.map((m, i) => (
            <button
              key={i}
              type="button"
              onClick={() => openOrdersModal(m)}
              className="rounded-2xl bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-slate-700/50 p-5 hover:border-violet-500/50 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 text-left cursor-pointer group"
            >
              <div className="flex items-start justify-between mb-3">
                <p className="font-medium text-slate-100 truncate pr-2 group-hover:text-violet-300">{m.name}</p>
                {m.complianceScore >= 70 && (
                  <span className="shrink-0 px-2 py-0.5 rounded-full text-xs bg-emerald-500/20 text-emerald-400">
                    {m.complianceScore}%
                  </span>
                )}
                {m.lateCount > 0 && m.complianceScore < 70 && (
                  <span className="shrink-0 px-2 py-0.5 rounded-full text-xs bg-rose-500/20 text-rose-400">
                    {m.lateCount} опозд.
                  </span>
                )}
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-violet-400 font-semibold">{m.avgStart}</span>
                  <span className="text-slate-500">—</span>
                  <span className="text-cyan-400 font-semibold">{m.avgEnd}</span>
                  <span className="text-slate-500 text-xs">({m.avgDurationHours} ч)</span>
                </div>
                <div className="text-slate-500 text-xs">
                  мин. начало {m.minStart} · макс. конец {m.maxEnd}
                </div>
                <div className="flex gap-4 text-slate-400 text-xs">
                  <span>{m.workDays} дней</span>
                  <span>{m.totalOrders} заказов</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Summary cards */}
      <section>
        <h3 className="text-slate-400 text-sm font-medium uppercase tracking-wider mb-4">
          Сводка по среднему рабочему дню
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
          {data.managerStats.slice(0, 6).map((m, i) => (
            <div
              key={i}
              className="rounded-2xl bg-slate-800/50 border border-slate-700/50 p-4"
            >
              <p className="text-slate-500 text-xs truncate">{m.name}</p>
              <p className="text-violet-400 font-bold mt-1">{m.avgStart}</p>
              <p className="text-cyan-400 text-sm">— {m.avgEnd}</p>
              <p className="text-slate-500 text-xs mt-1">
                {m.avgDurationHours} ч • опозданий: {m.lateCount}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Charts - на всю ширину */}
      <section>
        <h3 className="text-slate-400 text-sm font-medium uppercase tracking-wider mb-4">
          Среднее начало и конец дня по менеджерам (часы)
        </h3>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <YAxis tick={{ fill: '#94a3b8' }} domain={[0, 24]} tickFormatter={(v) => v + ':00'} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                formatter={(value: number | undefined) => [value != null ? minutesToTime(value * 60) : '-', '']}
                labelFormatter={(_, payload) => payload[0]?.payload?.fullName}
              />
              <Bar dataKey="avgStart" fill="#6366f1" radius={[4, 4, 0, 0]} name="Начало" />
              <Bar dataKey="avgEnd" fill="#22c55e" radius={[4, 4, 0, 0]} name="Окончание" />
              <Legend />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
      <section>
        <h3 className="text-slate-400 text-sm font-medium uppercase tracking-wider mb-4">
          Опоздания по менеджерам
        </h3>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 20, left: 20, bottom: 80 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <YAxis tick={{ fill: '#94a3b8' }} />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} />
              <Bar dataKey="lateCount" fill="#f43f5e" radius={[4, 4, 0, 0]} name="Опозданий" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Модал заказов */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-modal-backdrop"
          onClick={closeModal}
        >
          <div
            className="relative w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl animate-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800/50">
              <h3 className="text-lg font-semibold text-slate-100">
                {modalManager?.name} — все заказы
              </h3>
              <button
                onClick={closeModal}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                aria-label="Закрыть"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto max-h-[calc(85vh-80px)] p-4">
              {modalLoading ? (
                <Loader size="icon" />
              ) : modalOrders.length === 0 ? (
                <p className="text-slate-500 text-center py-8">Заказов нет</p>
              ) : (
                <div className="space-y-2">
                  {modalOrders.map((o, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-4 py-3 px-4 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-slate-600 hover:bg-slate-800 transition-all duration-150 animate-order-item"
                      style={{ animationDelay: `${Math.min(i * 20, 300)}ms` }}
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-violet-400 truncate">{o.orderNumber}</p>
                        <p className="text-slate-500 text-sm truncate">{o.client || '—'}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-emerald-400 font-medium">{formatCurrency(o.amount)}</p>
                        <p className="text-slate-500 text-sm">{o.date} {o.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {modalOrders.length > 0 && (
              <div className="p-4 border-t border-slate-700 bg-slate-800/30 text-slate-400 text-sm">
                Всего: {modalOrders.length} заказов
              </div>
            )}
          </div>
        </div>
      )}

      {/* Day-by-day breakdown */}
      {data.managerStats.some((m) => m.dayByDay && m.dayByDay.length > 0) && (
        <section>
          <h3 className="text-slate-400 text-sm font-medium uppercase tracking-wider mb-4">
            Разбивка по дням: первый и последний заказ
          </h3>
          <p className="text-slate-500 text-sm mb-4">
            Для каждого дня — время первого и последнего заказа. Среднее считается по этим значениям.
          </p>
          <div className="space-y-6">
            {data.managerStats.slice(0, 8).map((m, i) => (
              m.dayByDay && m.dayByDay.length > 0 && (
                <div key={i} className="rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden">
                  <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-700/50 font-medium text-violet-400">
                    {m.name} — среднее: {m.avgStart} — {m.avgEnd}
                  </div>
                  <div className="overflow-x-auto max-h-48 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-800/30">
                          <th className="text-left py-2 px-4 text-slate-400 font-medium">Дата</th>
                          <th className="text-left py-2 px-4 text-slate-400 font-medium">Первый заказ</th>
                          <th className="text-left py-2 px-4 text-slate-400 font-medium">Последний заказ</th>
                          <th className="text-left py-2 px-4 text-slate-400 font-medium">Длительность</th>
                          <th className="text-right py-2 px-4 text-slate-400 font-medium">Заказов</th>
                        </tr>
                      </thead>
                      <tbody>
                        {m.dayByDay.map((d, j) => (
                          <tr key={j} className="border-t border-slate-800/50">
                            <td className="py-2 px-4 text-slate-300">{d.date}</td>
                            <td className="py-2 px-4 text-violet-400">{d.firstOrder}</td>
                            <td className="py-2 px-4 text-cyan-400">{d.lastOrder}</td>
                            <td className="py-2 px-4 text-slate-400">{d.duration} ч</td>
                            <td className="py-2 px-4 text-right text-slate-400">{d.orderCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            ))}
          </div>
        </section>
      )}

      {/* By day of week - first manager as example */}
      {data.managerStats[0]?.byDayOfWeek && data.managerStats[0].byDayOfWeek.some((d) => d.count > 0) && (
        <section>
          <h3 className="text-slate-400 text-sm font-medium uppercase tracking-wider mb-4">
            Среднее начало дня по дням недели (топ-3 менеджера)
          </h3>
          <div className="grid md:grid-cols-3 gap-4">
            {data.managerStats.slice(0, 3).map((m, i) => (
              <div key={i} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
                <p className="text-violet-400 font-medium mb-3">{m.name}</p>
                <div className="space-y-2">
                  {m.byDayOfWeek
                    .filter((d) => d.count > 0)
                    .map((d, j) => (
                      <div key={j} className="flex justify-between text-sm">
                        <span className="text-slate-400">{d.day}</span>
                        <span className="text-cyan-400">{minutesToTime(d.avgStart)}</span>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
