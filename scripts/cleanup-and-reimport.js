#!/usr/bin/env node
/**
 * Удалить заказы за дату и переимпортировать из архивов с правильной кодировкой
 *
 * Usage: node scripts/cleanup-and-reimport.js [--dry-run] [--date=YYYY-MM-DD]
 *        npm run cleanup-reimport -- --dry-run
 */

const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const extract = require('extract-zip');

const prisma = new PrismaClient();
const UPLOAD_DIR = process.env.UPLOAD_DIR || '/home/ftp1c/upload';
const ARCHIVE_DIR = path.join(UPLOAD_DIR, 'archive');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const dateArg = args.find((a) => a.startsWith('--date='));
const TARGET_DATE = dateArg
  ? dateArg.split('=')[1]
  : new Date(Date.now() - 864e5).toISOString().slice(0, 10);

function parseDate(dateStr) {
  if (!dateStr) return null;
  const str = String(dateStr).trim();
  const m = str.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (m) return new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]));
  const iso = str.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(parseInt(iso[1]), parseInt(iso[2]) - 1, parseInt(iso[3]));
  return null;
}

function parseAmount(val) {
  if (val == null || val === '') return 0;
  const num = parseFloat(String(val).replace(/\s/g, '').replace(',', '.'));
  return isNaN(num) ? 0 : num;
}

function cell(val) {
  if (val == null || val === '') return '';
  return String(val).trim();
}

function findExcelInDir(dir) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) {
      const found = findExcelInDir(p);
      if (found) return found;
    } else if (/\.(xlsx|xls)$/i.test(f)) return p;
  }
  return null;
}

async function countToDelete() {
  const [y, m, d] = TARGET_DATE.split('-').map(Number);
  const start = new Date(y, m - 1, d, 0, 0, 0);
  const end = new Date(y, m - 1, d, 23, 59, 59);
  return prisma.order.count({
    where: { date: { gte: start, lte: end } },
  });
}

async function deleteByDate() {
  const [y, m, d] = TARGET_DATE.split('-').map(Number);
  const start = new Date(y, m - 1, d, 0, 0, 0);
  const end = new Date(y, m - 1, d, 23, 59, 59);
  const result = await prisma.order.deleteMany({
    where: { date: { gte: start, lte: end } },
  });
  return result.count;
}

async function importFromExcel(excelPath) {
  const wb = XLSX.readFile(excelPath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  const rows = data.slice(4).filter((r) => r && r.length >= 6);
  let imported = 0;

  for (const row of rows) {
    const orderNumber = cell(row[0]) || null;
    if (!orderNumber) continue;
    const date = parseDate(row[2]);
    if (!date) continue;
    const manager = cell(row[9]) || 'Unknown';
    if (!manager) continue;

    if (DRY_RUN) {
      imported++;
      continue;
    }
    try {
      await prisma.order.upsert({
        where: { orderNumber_date: { orderNumber, date } },
        create: {
          orderNumber, date, time: cell(row[4]), amount: parseAmount(row[5]),
          client: cell(row[6]) || null, status: cell(row[8]) || null, manager,
          comment: cell(row[10]) || null, businessRegion: cell(row[11]) || null,
          link: cell(row[12]) || null, siteOrderNumber: cell(row[13]) || null,
        },
        update: {
          date, time: cell(row[4]), amount: parseAmount(row[5]),
          client: cell(row[6]) || null, status: cell(row[8]) || null, manager,
          comment: cell(row[10]) || null, businessRegion: cell(row[11]) || null,
          link: cell(row[12]) || null, siteOrderNumber: cell(row[13]) || null,
        },
      });
      imported++;
    } catch (e) {
      console.error('  Error:', orderNumber, e.message);
    }
  }
  return imported;
}

async function main() {
  console.log(DRY_RUN ? '[DRY RUN]' : '[RUN]', `Очистка и переимпорт за ${TARGET_DATE}\n`);

  const toDelete = await countToDelete();
  console.log(`  К удалению: ${toDelete} заказов за ${TARGET_DATE}`);

  if (!fs.existsSync(ARCHIVE_DIR)) {
    console.error('  Папка архивов не найдена:', ARCHIVE_DIR);
    await prisma.$disconnect();
    process.exit(1);
  }

  const zips = fs.readdirSync(ARCHIVE_DIR)
    .filter((f) => f.toLowerCase().endsWith('.zip') && f.includes(TARGET_DATE))
    .map((f) => path.join(ARCHIVE_DIR, f))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);

  console.log(`  Архивов для ${TARGET_DATE}: ${zips.length}`);

  if (zips.length === 0 && toDelete > 0) {
    console.warn('  Внимание: архивы не найдены, удаление без переимпорта');
  }

  if (DRY_RUN) {
    let wouldImport = 0;
    const tempBase = path.join(UPLOAD_DIR, '_dry_tmp');
    for (const zipPath of zips) {
      const tempDir = path.join(tempBase, path.basename(zipPath, '.zip'));
      try {
        fs.mkdirSync(tempDir, { recursive: true });
        await extract(zipPath, { dir: tempDir });
        const excel = findExcelInDir(tempDir);
        if (excel) {
          const wb = XLSX.readFile(excel);
          const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
          const rows = data.slice(4).filter((r) => r && r.length >= 6);
          wouldImport += rows.length;
          console.log('  ', path.basename(zipPath), '->', rows.length, 'заказов (будет импортировано)');
        }
        try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
      } catch (e) {
        console.error('  Ошибка:', path.basename(zipPath), e.message);
      }
    }
    try { fs.rmSync(tempBase, { recursive: true, force: true }); } catch {}
    console.log(`\n  Будет удалено: ${toDelete}, будет загружено: ${wouldImport}`);
    await prisma.$disconnect();
    return;
  }

  const deleted = await deleteByDate();
  console.log(`  Удалено: ${deleted}`);

  let total = 0;
  const tempBase = path.join(UPLOAD_DIR, '_reimport_tmp');

  for (const zipPath of zips) {
    const tempDir = path.join(tempBase, path.basename(zipPath, '.zip'));
    try {
      fs.mkdirSync(tempDir, { recursive: true });
      await extract(zipPath, { dir: tempDir });
      const excel = findExcelInDir(tempDir);
      if (!excel) {
        console.log('  Пропуск (нет Excel):', path.basename(zipPath));
        continue;
      }
      const n = await importFromExcel(excel);
      total += n;
      console.log('  ', path.basename(zipPath), '->', n, 'заказов');
    } catch (e) {
      console.error('  Ошибка:', path.basename(zipPath), e.message);
    } finally {
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
    }
  }

  try { fs.rmSync(tempBase, { recursive: true, force: true }); } catch {}
  console.log('\nГотово. Загружено:', total);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
