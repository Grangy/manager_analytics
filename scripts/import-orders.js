/**
 * Import orders from Excel file into SQLite via Prisma
 * Usage: node scripts/import-orders.js [path-to-file.xlsx]
 *        npm run import  (uses ./Заказы.xlsx by default)
 */

const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const prisma = new PrismaClient();
const DEFAULT_EXCEL = path.join(__dirname, '..', 'Заказы.xlsx');

function parseDate(dateStr) {
  if (!dateStr) return null;
  const str = String(dateStr).trim();
  const match = str.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (match) {
    const [, day, month, year] = match;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }
  return null;
}

function parseAmount(val) {
  if (val === null || val === undefined || val === '') return 0;
  const num = parseFloat(String(val).replace(/\s/g, '').replace(',', '.'));
  return isNaN(num) ? 0 : num;
}

async function importOrders() {
  const excelPath = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_EXCEL;
  if (!fs.existsSync(excelPath)) {
    console.error('File not found:', excelPath);
    console.error('Usage: node scripts/import-orders.js [path-to-orders.xlsx]');
    process.exit(1);
  }

  console.log('Reading Excel file...');
  const wb = XLSX.readFile(excelPath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  const rows = data.slice(4).filter(row => row && row.length >= 6);
  console.log(`Found ${rows.length} rows to import`);

  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    const orderNumber = row[0] ? String(row[0]).trim() : null;
    if (!orderNumber) { skipped++; continue; }

    const date = parseDate(row[2]);
    if (!date) { skipped++; continue; }

    const amount = parseAmount(row[5]);
    const manager = row[9] ? String(row[9]).trim() : 'Unknown';
    if (!manager) { skipped++; continue; }

    try {
      await prisma.order.upsert({
        where: { orderNumber_date: { orderNumber, date } },
        create: {
          orderNumber,
          date,
          time: row[4] ? String(row[4]).trim() : '',
          amount,
          client: row[6] ? String(row[6]).trim() : null,
          status: row[8] ? String(row[8]).trim() : null,
          manager,
          comment: row[10] ? String(row[10]).trim() : null,
          businessRegion: row[11] ? String(row[11]).trim() : null,
          link: row[12] ? String(row[12]).trim() : null,
          siteOrderNumber: row[13] ? String(row[13]).trim() : null,
        },
        update: {
          date, time: row[4] ? String(row[4]).trim() : '',
          amount,
          client: row[6] ? String(row[6]).trim() : null,
          status: row[8] ? String(row[8]).trim() : null,
          manager,
          comment: row[10] ? String(row[10]).trim() : null,
          businessRegion: row[11] ? String(row[11]).trim() : null,
          link: row[12] ? String(row[12]).trim() : null,
          siteOrderNumber: row[13] ? String(row[13]).trim() : null,
        },
      });
      imported++;
      if (imported % 2000 === 0) console.log(`Imported ${imported}...`);
    } catch (err) {
      console.error('Error:', orderNumber, err.message);
      skipped++;
    }
  }

  console.log(`\nDone! Imported: ${imported}, Skipped: ${skipped}`);
  await prisma.$disconnect();
}

importOrders().catch(e => {
  console.error(e);
  process.exit(1);
});
