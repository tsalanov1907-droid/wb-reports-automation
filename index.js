const { google } = require('googleapis');
const axios = require('axios');

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const API_KEY = process.env.WB_API_KEY;
const PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');
const CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;

async function getWBData() {
  console.log('🔄 Загружаю данные из WB API...');
  
  const headers = {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json'
  };

  const data = {};

  // Финансы
  try {
    const res = await axios.get('https://api.wildberries.ru/api/v1/account/balance', { headers });
    data.финансы = res.data;
    console.log('✓ финансы');
  } catch (e) {
    console.log('✗ финансы:', e.message);
  }

  // Аналитика
  try {
    const begin = new Date(Date.now() - 7*24*60*60*1000).toISOString().split('T')[0];
    const end = new Date().toISOString().split('T')[0];
    const payload = { period: { begin, end } };
    const res = await axios.post(
      'https://api.wildberries.ru/api/analytics/v3/sales-funnel/products',
      payload,
      { headers }
    );
    data.аналитика = res.data;
    console.log('✓ аналитика');
  } catch (e) {
    console.log('✗ аналитика:', e.message);
  }

  // Остатки
  try {
    const res = await axios.post(
      'https://api.wildberries.ru/api/analytics/v1/stocks-report/wb-warehouses',
      {},
      { headers }
    );
    data.остатки = res.data;
    console.log('✓ остатки');
  } catch (e) {
    console.log('✗ остатки:', e.message);
  }

  return data;
}

function formatData(wbData) {
  const rows = [
    ['Категория', 'Метрика', 'Значение', 'Дата', 'Обновлено']
  ];

  const now = new Date().toLocaleString('ru-RU');
  const today = new Date().toLocaleDateString('ru-RU');

  if (wbData.финансы?.data?.available_balance) {
    rows.push(['Финансы', 'Баланс ₽', wbData.финансы.data.available_balance, today, now]);
  }

  if (Array.isArray(wbData.аналитика) && wbData.аналитика.length > 0) {
    rows.push(['Аналитика', 'Товаров', wbData.аналитика.length, today, now]);
  }

  if (Array.isArray(wbData.остатки) && wbData.остатки.length > 0) {
    rows.push(['Остатки', 'Позиций', wbData.остатки.length, today, now]);
  }

  return rows;
}

async function saveToSheet(rows) {
  const auth = new google.auth.JWT({
    email: CLIENT_EMAIL,
    key: PRIVATE_KEY,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });

  const sheets = google.sheets({ version: 'v4', auth });

  // Очищаем старые данные
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SHEET_ID,
    range: 'ВБ Отчет!A:F'
  });

  // Добавляем новые
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: 'ВБ Отчет!A1',
    valueInputOption: 'RAW',
    resource: { values: rows }
  });

  console.log(`✓ Сохранено ${rows.length} строк в Google Sheet`);
}

async function main() {
  console.log('================================');
  console.log('   WB ANALYTICS ОТЧЕТ');
  console.log('================================');

  try {
    const data = await getWBData();
    const rows = formatData(data);
    await saveToSheet(rows);
    console.log('✅ Готово!');
  } catch (error) {
    console.error('❌ Ошибка:', error);
  }
}

main();
