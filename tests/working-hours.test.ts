/**
 * Синтетические тесты для проверки расчёта рабочего времени.
 * Запуск: npx tsx tests/working-hours.test.ts  или  npm test
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  computeWorkingHoursStats,
  parseTimeToMinutes,
  minutesToTime,
} from '../src/lib/working-hours';
import type { OrderInput } from '../src/lib/working-hours';

function order(date: string, time: string, manager: string): OrderInput {
  return { date: new Date(date + 'T12:00:00'), time, manager };
}

describe('parseTimeToMinutes', () => {
  it('парсит "9:42:17" в минуты', () => {
    assert.strictEqual(parseTimeToMinutes('9:42:17'), 9 * 60 + 42 + 17 / 60);
  });
  it('парсит "08:00:00" в 480', () => {
    assert.strictEqual(parseTimeToMinutes('08:00:00'), 8 * 60);
  });
  it('парсит "8:41:38" (однозначный час)', () => {
    const m = parseTimeToMinutes('8:41:38');
    assert.ok(m !== null);
    assert.strictEqual(Math.floor(m! / 60), 8);
    assert.strictEqual(Math.floor(m! % 60), 41);
  });
  it('возвращает null для пустой строки', () => {
    assert.strictEqual(parseTimeToMinutes(''), null);
  });
});

describe('minutesToTime', () => {
  it('конвертирует 540 в "09:00"', () => {
    assert.strictEqual(minutesToTime(9 * 60), '09:00');
  });
  it('конвертирует 521 в "08:41"', () => {
    assert.strictEqual(minutesToTime(8 * 60 + 41), '08:41');
  });
});

describe('computeWorkingHoursStats - первый и последний заказ по дням', () => {
  it('один менеджер, один день: первый 08:00, последний 18:00', () => {
    const orders: OrderInput[] = [
      order('2026-02-10', '08:00:00', 'Иван'),
      order('2026-02-10', '12:00:00', 'Иван'),
      order('2026-02-10', '18:00:00', 'Иван'),
    ];
    const stats = computeWorkingHoursStats(orders);
    assert.strictEqual(stats.length, 1);
    assert.strictEqual(stats[0].name, 'Иван');
    assert.strictEqual(stats[0].avgStart, '08:00');
    assert.strictEqual(stats[0].avgEnd, '18:00');
    assert.strictEqual(stats[0].workDays, 1);
    assert.strictEqual(stats[0].totalOrders, 3);
    assert.strictEqual(stats[0].dayByDay[0].firstOrder, '08:00');
    assert.strictEqual(stats[0].dayByDay[0].lastOrder, '18:00');
  });

  it('один менеджер, один день: порядок заказов не важен (берём min/max)', () => {
    const orders: OrderInput[] = [
      order('2026-02-10', '15:00:00', 'Петр'),
      order('2026-02-10', '09:00:00', 'Петр'),
      order('2026-02-10', '17:30:00', 'Петр'),
    ];
    const stats = computeWorkingHoursStats(orders);
    assert.strictEqual(stats[0].avgStart, '09:00');
    assert.strictEqual(stats[0].avgEnd, '17:30');
  });

  it('два дня: среднее первого и последнего заказа', () => {
    // День 1: 08:00 - 17:00, День 2: 10:00 - 19:00
    // Среднее начало: (480+600)/2 = 540 мин = 09:00
    // Среднее окончание: (1020+1140)/2 = 1080 мин = 18:00
    const orders: OrderInput[] = [
      order('2026-02-10', '08:00:00', 'Мария'),
      order('2026-02-10', '17:00:00', 'Мария'),
      order('2026-02-11', '10:00:00', 'Мария'),
      order('2026-02-11', '19:00:00', 'Мария'),
    ];
    const stats = computeWorkingHoursStats(orders);
    assert.strictEqual(stats[0].workDays, 2);
    assert.strictEqual(stats[0].avgStart, '09:00');
    assert.strictEqual(stats[0].avgEnd, '18:00');
    assert.strictEqual(stats[0].dayByDay.length, 2);
    assert.strictEqual(stats[0].dayByDay[0].firstOrder, '08:00');
    assert.strictEqual(stats[0].dayByDay[0].lastOrder, '17:00');
    assert.strictEqual(stats[0].dayByDay[1].firstOrder, '10:00');
    assert.strictEqual(stats[0].dayByDay[1].lastOrder, '19:00');
  });

  it('три дня: 08:00, 09:00, 10:00 — среднее 09:00', () => {
    const orders: OrderInput[] = [
      order('2026-02-10', '08:00:00', 'Алекс'),
      order('2026-02-10', '18:00:00', 'Алекс'),
      order('2026-02-11', '09:00:00', 'Алекс'),
      order('2026-02-11', '18:00:00', 'Алекс'),
      order('2026-02-12', '10:00:00', 'Алекс'),
      order('2026-02-12', '18:00:00', 'Алекс'),
    ];
    const stats = computeWorkingHoursStats(orders);
    // (480 + 540 + 600) / 3 = 540 = 09:00
    assert.strictEqual(stats[0].avgStart, '09:00');
    assert.strictEqual(stats[0].avgEnd, '18:00');
  });
});

describe('computeWorkingHoursStats - опоздания (после 9:00)', () => {
  it('все три дня после 9:00 — 3 опоздания, 100%', () => {
    const orders: OrderInput[] = [
      order('2026-02-10', '10:00:00', 'Опаздывающий'),
      order('2026-02-10', '18:00:00', 'Опаздывающий'),
      order('2026-02-11', '11:00:00', 'Опаздывающий'),
      order('2026-02-11', '18:00:00', 'Опаздывающий'),
      order('2026-02-12', '12:00:00', 'Опаздывающий'),
      order('2026-02-12', '18:00:00', 'Опаздывающий'),
    ];
    const stats = computeWorkingHoursStats(orders);
    assert.strictEqual(stats[0].lateCount, 3);
    assert.strictEqual(stats[0].latePercent, 100);
  });

  it('ровно 9:00 — не опоздание', () => {
    const orders: OrderInput[] = [
      order('2026-02-10', '09:00:00', 'Точный'),
      order('2026-02-10', '17:00:00', 'Точный'),
    ];
    const stats = computeWorkingHoursStats(orders);
    assert.strictEqual(stats[0].lateCount, 0);
  });

  it('9:01 — опоздание', () => {
    const orders: OrderInput[] = [
      order('2026-02-10', '09:01:00', 'Минута'),
      order('2026-02-10', '17:00:00', 'Минута'),
    ];
    const stats = computeWorkingHoursStats(orders);
    assert.strictEqual(stats[0].lateCount, 1);
  });

  it('2 из 3 дней опоздания — 66%', () => {
    const orders: OrderInput[] = [
      order('2026-02-10', '08:00:00', 'Смешанный'),
      order('2026-02-10', '17:00:00', 'Смешанный'),
      order('2026-02-11', '10:00:00', 'Смешанный'),
      order('2026-02-11', '17:00:00', 'Смешанный'),
      order('2026-02-12', '11:00:00', 'Смешанный'),
      order('2026-02-12', '17:00:00', 'Смешанный'),
    ];
    const stats = computeWorkingHoursStats(orders);
    assert.strictEqual(stats[0].lateCount, 2);
    assert.strictEqual(stats[0].latePercent, 67);
  });
});

describe('computeWorkingHoursStats - min/max', () => {
  it('minStart и maxEnd за период', () => {
    const orders: OrderInput[] = [
      order('2026-02-10', '07:00:00', 'Разброс'),
      order('2026-02-10', '20:00:00', 'Разброс'),
      order('2026-02-11', '09:00:00', 'Разброс'),
      order('2026-02-11', '17:00:00', 'Разброс'),
    ];
    const stats = computeWorkingHoursStats(orders);
    assert.strictEqual(stats[0].minStart, '07:00');
    assert.strictEqual(stats[0].maxEnd, '20:00');
  });
});

describe('computeWorkingHoursStats - несколько менеджеров', () => {
  it('изолирует статистику по менеджерам', () => {
    const orders: OrderInput[] = [
      order('2026-02-10', '08:00:00', 'А'),
      order('2026-02-10', '18:00:00', 'А'),
      order('2026-02-10', '10:00:00', 'Б'),
      order('2026-02-10', '16:00:00', 'Б'),
    ];
    const stats = computeWorkingHoursStats(orders);
    assert.strictEqual(stats.length, 2);
    const a = stats.find((s) => s.name === 'А')!;
    const b = stats.find((s) => s.name === 'Б')!;
    assert.strictEqual(a.avgStart, '08:00');
    assert.strictEqual(a.avgEnd, '18:00');
    assert.strictEqual(b.avgStart, '10:00');
    assert.strictEqual(b.avgEnd, '16:00');
  });
});

describe('computeWorkingHoursStats - formatDate', () => {
  it('использует переданный formatDate для группировки по дням', () => {
    const orders: OrderInput[] = [
      order('2026-02-10', '08:00:00', 'Тест'),
      order('2026-02-10', '18:00:00', 'Тест'),
    ];
    const formatDate = (d: Date) => d.toISOString().slice(0, 10);
    const stats = computeWorkingHoursStats(orders, formatDate);
    assert.strictEqual(stats[0].dayByDay[0].date, '2026-02-10');
  });
});

describe('computeWorkingHoursStats - крайние случаи', () => {
  it('день с одним заказом — считается (первый = последний)', () => {
    const orders: OrderInput[] = [order('2026-02-10', '12:30:00', 'Один')];
    const stats = computeWorkingHoursStats(orders);
    assert.strictEqual(stats[0].workDays, 1);
    assert.strictEqual(stats[0].avgStart, '12:30');
    assert.strictEqual(stats[0].avgEnd, '12:30');
  });

  it('пустой массив — возвращает пустой результат', () => {
    const stats = computeWorkingHoursStats([]);
    assert.strictEqual(stats.length, 0);
  });

  it('заказ с пустым временем — пропускается, менеджер без валидных дней не показывается', () => {
    const orders: OrderInput[] = [
      order('2026-02-10', '', 'Плохой'),
      order('2026-02-10', '09:00:00', 'Хороший'),
    ];
    const stats = computeWorkingHoursStats(orders);
    assert.strictEqual(stats.length, 1);
    assert.strictEqual(stats[0].name, 'Хороший');
  });

  it('длительность дня в часах считается правильно', () => {
    const orders: OrderInput[] = [
      order('2026-02-10', '08:00:00', 'Длительность'),
      order('2026-02-10', '17:00:00', 'Длительность'), // 9 часов
    ];
    const stats = computeWorkingHoursStats(orders);
    assert.strictEqual(stats[0].avgDurationHours, 9);
  });

  it('день с 2+ заказами — полный диапазон', () => {
    const orders: OrderInput[] = [
      order('2026-02-10', '09:00:00', 'Два'),
      order('2026-02-10', '17:00:00', 'Два'),
    ];
    const stats = computeWorkingHoursStats(orders);
    assert.strictEqual(stats[0].workDays, 1);
    assert.strictEqual(stats[0].avgStart, '09:00');
    assert.strictEqual(stats[0].avgEnd, '17:00');
  });

  it('выходные (сб, вс) не учитываются', () => {
    // 2026-02-07 = суббота, 2026-02-08 = воскресенье
    const orders: OrderInput[] = [
      order('2026-02-07', '09:00:00', 'Выходной'),
      order('2026-02-07', '18:00:00', 'Выходной'),
      order('2026-02-08', '10:00:00', 'Выходной'),
      order('2026-02-10', '08:00:00', 'Выходной'), // понедельник
      order('2026-02-10', '17:00:00', 'Выходной'),
    ];
    const stats = computeWorkingHoursStats(orders);
    assert.strictEqual(stats[0].workDays, 1);
    assert.strictEqual(stats[0].avgStart, '08:00');
    assert.strictEqual(stats[0].avgEnd, '17:00');
    assert.strictEqual(stats[0].totalOrders, 2);
  });
});
