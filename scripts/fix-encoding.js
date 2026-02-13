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
  return /[<>?=;@:]/.test(s) && !/^[A-Za-z0-9\s\-_.,()%+]+$/.test(s);
}

/**
 * Обратное преобразование fixCyrillicCell:
 * UTF-8 Cyrillic -> low byte of code point -> decode(win1251) = мусор
 * Обратно: encode(мусор, win1251) -> байты -> U+0400 + byte = Cyrillic
 * ASCII (пробел, цифры, пунктуация) сохраняем
 */
function reverseFixCyrillicCell(str) {
  if (!str || typeof str !== 'string') return null;
  try {
    const bytes = iconv.encode(str, 'win1251');
    const preserve = new Set([0x20, 0x0a, 0x0d, 0x2e, 0x2c, 0x2d, 0x2f, 0x28, 0x29, 0x2b, 0x25]);
    let out = '';
    for (let i = 0; i < bytes.length; i++) {
      const b = bytes[i] & 0xFF;
      if ((b >= 0x30 && b <= 0x39) || preserve.has(b) || (b >= 0x41 && b <= 0x5A) || (b >= 0x61 && b <= 0x7A)) {
        out += String.fromCharCode(b);
      } else {
        out += String.fromCharCode(0x0400 + b);
      }
    }
    return out.length > 0 && hasCyrillic(out) ? out : null;
  } catch {
    return null;
  }
}

function tryFix(str) {
  if (!str || typeof str !== 'string') return null;
  const s = str.trim();
  if (!s) return null;

  let result = reverseFixCyrillicCell(s);
  if (result) return result;

  const attempts = [
    { fn: () => iconv.decode(Buffer.from(s, 'latin1'), 'win1251') },
    { fn: () => iconv.decode(Buffer.from(s, 'latin1'), 'cp866') },
    { fn: () => iconv.decode(Buffer.from(s, 'latin1'), 'koi8r') },
  ];

  for (const { fn } of attempts) {
    try {
      result = fn();
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
