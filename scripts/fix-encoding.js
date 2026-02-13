#!/usr/bin/env node
/**
 * Исправление кодировки в БД: пробует перекодировать строки
 * которые выглядят как CP1251/mojibake в UTF-8
 *
 * Usage: node scripts/fix-encoding.js [--dry-run]
 */

const { PrismaClient } = require('@prisma/client');
const iconv = require('iconv-lite');

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');

function hasCyrillic(s) {
  if (!s || typeof s !== 'string') return false;
  return /[а-яА-ЯёЁ]/.test(s);
}

function looksLikeMojibake(s) {
  if (!s || typeof s !== 'string' || s.length < 2) return false;
  if (hasCyrillic(s)) return false;
  const extAscii = /[\x80-\xff]/.test(s);
  const suspicious = /[<>?=;@0-9]{3,}/.test(s) || /[^\x20-\x7e\u0400-\u04ff]/.test(s);
  return extAscii || (s.length > 3 && !/^[A-Za-z0-9\s\-_.,]+$/.test(s));
}

function tryFix(str) {
  if (!str || typeof str !== 'string') return null;
  const s = str.trim();
  if (!s) return null;

  const attempts = [
    { name: 'latin1->cp1251', fn: () => iconv.decode(Buffer.from(s, 'latin1'), 'win1251') },
    { name: 'utf8-as-cp1251', fn: () => iconv.decode(Buffer.from(s, 'utf8'), 'win1251') },
    { name: 'cp1251-as-utf8', fn: () => iconv.encode(s, 'win1251').toString('utf8') },
  ];

  for (const { name, fn } of attempts) {
    try {
      const result = fn();
      if (result && hasCyrillic(result) && result.length > 0) {
        return result;
      }
    } catch {}
  }
  return null;
}

async function main() {
  console.log(DRY_RUN ? '[DRY RUN]' : '[FIX]', 'Проверка кодировки в БД...\n');

  const orders = await prisma.order.findMany({
    select: {
      id: true,
      orderNumber: true,
      client: true,
      manager: true,
      status: true,
      comment: true,
      businessRegion: true,
    },
  });

  let updated = 0;
  const textFields = ['orderNumber', 'client', 'manager', 'status', 'comment', 'businessRegion'];

  for (const o of orders) {
    const updates = {};
    let changed = false;

    for (const field of textFields) {
      const val = o[field];
      if (!val) continue;
      if (hasCyrillic(val)) continue;
      if (!looksLikeMojibake(val)) continue;

      const fixed = tryFix(val);
      if (fixed) {
        updates[field] = fixed;
        changed = true;
      }
    }

    if (changed && !DRY_RUN) {
      await prisma.order.update({
        where: { id: o.id },
        data: updates,
      });
      updated++;
      if (updated <= 5) {
        console.log('Пример:', o.manager, '->', updates.manager || updates.client || Object.values(updates)[0]);
      }
    } else if (changed && DRY_RUN) {
      updated++;
      console.log('Будет исправлено:', o.id, updates);
    }
  }

  console.log(`\n${DRY_RUN ? 'Будет обновлено' : 'Обновлено'}: ${updated} записей`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
