#!/usr/bin/env node
/**
 * Обработка заказов из папки загрузок (1C, cron 21:00)
 * 1. Сканирует UPLOAD_DIR на новые .zip
 * 2. Переименовывает (фикс кириллицы CP1251)
 * 3. Распаковывает, парсит Excel, импортирует в БД
 * 4. Держит только 5 последних архивов
 *
 * Usage: node scripts/process-uploaded-orders.js
 * Cron: 0 21 * * * cd /var/www/manager_analytics && npm run process-orders
 */

const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const iconv = require('iconv-lite');
const extract = require('extract-zip');

const prisma = new PrismaClient();

const UPLOAD_DIR = process.env.UPLOAD_DIR || '/home/ftp1c/upload';
const ARCHIVE_DIR = path.join(UPLOAD_DIR, 'archive');
const ARCHIVE_KEEP_COUNT = 5;

function fixCyrillicFilename(raw) {
  if (!raw || typeof raw !== 'string') return 'unknown';
  try {
    const bytes = Buffer.from(raw, 'latin1');
    const decoded = iconv.decode(bytes, 'win1251');
    return decoded;
  } catch {
    return raw;
  }
}

function extractDateFromFilename(filename) {
  const m = filename.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const m2 = filename.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (m2) return `${m2[3]}-${m2[2].padStart(2, '0')}-${m2[1].padStart(2, '0')}`;
  return new Date().toISOString().slice(0, 10);
}

function parseDate(dateStr) {
  if (!dateStr) return null;
  const str = String(dateStr).trim();
  const match = str.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (match) {
    const [, day, month, year] = match;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }
  const iso = str.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    return new Date(parseInt(iso[1]), parseInt(iso[2]) - 1, parseInt(iso[3]));
  }
  return null;
}

function parseAmount(val) {
  if (val === null || val === undefined || val === '') return 0;
  const num = parseFloat(String(val).replace(/\s/g, '').replace(',', '.'));
  return isNaN(num) ? 0 : num;
}

function cell(val) {
  if (val == null || val === '') return '';
  return String(val).trim();
}

async function importFromExcel(excelPath) {
  const wb = XLSX.readFile(excelPath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  const rows = data.slice(4).filter((row) => row && row.length >= 6);
  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    const orderNumber = cell(row[0]) || null;
    if (!orderNumber) {
      skipped++;
      continue;
    }

    const date = parseDate(row[2]);
    if (!date) {
      skipped++;
      continue;
    }

    const amount = parseAmount(row[5]);
    const manager = cell(row[9]) || 'Unknown';
    if (!manager) {
      skipped++;
      continue;
    }

    try {
      await prisma.order.upsert({
        where: { orderNumber_date: { orderNumber, date } },
        create: {
          orderNumber,
          date,
          time: cell(row[4]),
          amount,
          client: cell(row[6]) || null,
          status: cell(row[8]) || null,
          manager,
          comment: cell(row[10]) || null,
          businessRegion: cell(row[11]) || null,
          link: cell(row[12]) || null,
          siteOrderNumber: cell(row[13]) || null,
        },
        update: {
          date,
          time: cell(row[4]),
          amount,
          client: cell(row[6]) || null,
          status: cell(row[8]) || null,
          manager,
          comment: cell(row[10]) || null,
          businessRegion: cell(row[11]) || null,
          link: cell(row[12]) || null,
          siteOrderNumber: cell(row[13]) || null,
        },
      });
      imported++;
      if (imported % 500 === 0) console.log(`  Imported ${imported}...`);
    } catch (err) {
      console.error('  Error:', orderNumber, err.message);
      skipped++;
    }
  }

  return { imported, skipped };
}

function findExcelInDir(dir) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) {
      const found = findExcelInDir(p);
      if (found) return found;
    } else if (/\.(xlsx|xls)$/i.test(f)) {
      return p;
    }
  }
  return null;
}

function pruneArchives() {
  if (!fs.existsSync(ARCHIVE_DIR)) return;
  const files = fs.readdirSync(ARCHIVE_DIR)
    .filter((f) => f.endsWith('.zip'))
    .map((f) => ({
      name: f,
      path: path.join(ARCHIVE_DIR, f),
      mtime: fs.statSync(path.join(ARCHIVE_DIR, f)).mtime.getTime(),
    }))
    .sort((a, b) => b.mtime - a.mtime);

  if (files.length <= ARCHIVE_KEEP_COUNT) return;
  for (let i = ARCHIVE_KEEP_COUNT; i < files.length; i++) {
    try {
      fs.unlinkSync(files[i].path);
      console.log(`  Удалён старый архив: ${files[i].name}`);
    } catch (e) {
      console.error('  Ошибка удаления:', files[i].name, e.message);
    }
  }
}

async function processZip(zipPath, rawName) {
  const fixedName = fixCyrillicFilename(rawName);
  const dateStr = extractDateFromFilename(fixedName || rawName);
  const ts = `${Date.now()}`.slice(-8);
  const archiveName = `orders_${dateStr}_${ts}.zip`;
  const renamedPath = path.join(path.dirname(zipPath), archiveName);

  if (rawName !== archiveName) {
    try {
      const srcBuf = Buffer.from(zipPath, 'latin1');
      fs.renameSync(srcBuf, renamedPath);
      console.log(`  Переименован: ${fixedName || rawName} -> ${archiveName}`);
    } catch (e) {
      console.error('  Ошибка переименования:', e.message);
      return;
    }
  }

  const tempDir = path.join(UPLOAD_DIR, `_tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    await extract(renamedPath, { dir: tempDir });
    const excelPath = findExcelInDir(tempDir);
    if (!excelPath) {
      console.error('  Excel не найден в архиве');
      return;
    }
    const { imported, skipped } = await importFromExcel(excelPath);
    console.log(`  Импорт: ${imported} заказов, ${skipped} пропущено`);

    fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
    const finalArchive = path.join(ARCHIVE_DIR, archiveName);
    if (renamedPath !== finalArchive) {
      fs.renameSync(renamedPath, finalArchive);
    }
    pruneArchives();
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  }
}

async function main() {
  console.log(`[${new Date().toISOString()}] Запуск обработки заказов`);
  console.log('  Папка:', UPLOAD_DIR);

  if (!fs.existsSync(UPLOAD_DIR)) {
    console.error('Папка не найдена:', UPLOAD_DIR);
    process.exit(1);
  }

  // latin1 сохраняет сырые байты имён (кириллица CP1251 от 1C)
  const rawNames = fs.readdirSync(UPLOAD_DIR, { encoding: 'latin1' });
  const files = rawNames
    .filter((n) => n.toLowerCase().endsWith('.zip'))
    .filter((n) => {
      const p = path.join(UPLOAD_DIR, n);
      try {
        const buf = Buffer.from(p, 'latin1');
        return fs.statSync(buf).isFile();
      } catch {
        return false;
      }
    })
    .map((n) => ({ path: path.join(UPLOAD_DIR, n), rawName: n }));

  if (files.length === 0) {
    console.log('  Новых zip-файлов нет');
    await prisma.$disconnect();
    return;
  }

  for (const { path: fp, rawName } of files) {
    console.log('  Обработка:', fixCyrillicFilename(rawName) || rawName);
    try {
      await processZip(fp, rawName);
    } catch (e) {
      console.error('  Ошибка:', e.message);
    }
  }

  await prisma.$disconnect();
  console.log('Готово.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
