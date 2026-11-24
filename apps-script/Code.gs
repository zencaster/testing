const SHEET_ID = '18hYx94mb6zrObubgV4nZ8D-u83mYPNXXNBBfaPyAbxI';
const TX_SHEET_NAME = 'Planner';
const FALLBACK_TX_SHEET_NAME = 'Sheet1';
const INVEST_SHEET_NAME = 'Invest';
const USERS_SHEET_NAME = 'Users';
const BUDGET_SHEET_NAME = 'Budget';
const GOALS_SHEET_NAME = 'Goals';
const MARKET_PRICE_CACHE_KEY = 'market_prices_v1';
const MARKET_PRICE_CACHE_TTL_SECONDS = 21600; // 6 jam

const DEFAULT_USERS_SEED = [
  ['Kevin', 'Kevin', '#6366F1'],
  ['Vivie', 'Vivie', '#EC4899']
];

function getOrCreateSheet(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  if (sheet.getLastRow() === 0 && headers && headers.length > 0) {
    sheet.appendRow(headers);
  }
  return sheet;
}

function getTxSheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet =
    ss.getSheetByName(TX_SHEET_NAME) ||
    ss.getSheetByName(FALLBACK_TX_SHEET_NAME) ||
    ss.getSheets()[0];
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Date', 'Type', 'Amount', 'Keterangan', 'Kategori', 'user', 'Timestamp']);
  }
  return sheet;
}

function getInvestSheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  return getOrCreateSheet(ss, INVEST_SHEET_NAME, [
    'Date', 'Type', 'Amount', 'Lot lembar', 'Average Buy', 'Saham', 'Keterangan', 'Kategori', 'user', 'Timestamp'
  ]);
}

function getBudgetSheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  return getOrCreateSheet(ss, BUDGET_SHEET_NAME, [
    'Kategori', 'LimitBulanan', 'UpdatedAt'
  ]);
}

function getGoalsSheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  return getOrCreateSheet(ss, GOALS_SHEET_NAME, [
    'GoalID', 'Nama', 'TargetRp', 'TerkumpulRp', 'TargetDate', 'UpdatedAt'
  ]);
}

function readBudgetsList(tz) {
  const sheet = getBudgetSheet();
  if (!sheet || sheet.getLastRow() <= 1) return [];
  const rows = sheet.getDataRange().getValues();
  const budgets = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const kategori = String(row[0] || '').trim().toUpperCase();
    if (!kategori) continue;
    const limit = parseNumber(row[1]);
    if (limit <= 0) continue;
    budgets.push({
      kategori: kategori,
      limit: Math.round(limit),
      updatedAt: formatCellTimestamp(row[2], tz)
    });
  }
  return budgets;
}

function readGoalsList(tz) {
  const sheet = getGoalsSheet();
  if (!sheet || sheet.getLastRow() <= 1) return [];
  const rows = sheet.getDataRange().getValues();
  const goals = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const id = String(row[0] || '').trim();
    const nama = String(row[1] || '').trim();
    if (!id && !nama) continue;
    const target = Math.round(parseNumber(row[2]));
    const terkumpul = Math.round(parseNumber(row[3]));
    if (target <= 0) continue;
    goals.push({
      id: id || ('GOAL-' + i),
      nama: nama,
      target: target,
      terkumpul: Math.max(0, terkumpul),
      targetDate: formatCellDate(row[4], tz),
      updatedAt: formatCellTimestamp(row[5], tz)
    });
  }
  return goals;
}

function handleSaveBudgetAction(payload, tz) {
  const items = Array.isArray(payload.budgets)
    ? payload.budgets
    : [{ kategori: payload.kategori, limit: payload.limit }];

  if (!items || items.length === 0) {
    return jsonResponse({ status: 'error', message: 'Data budget kosong.' });
  }

  const sheet = getBudgetSheet();
  const rows = sheet.getDataRange().getValues();
  const rowIndexByCat = {};
  for (let i = 1; i < rows.length; i++) {
    const cat = String(rows[i][0] || '').trim().toUpperCase();
    if (cat) rowIndexByCat[cat] = i + 1;
  }

  const updatedAt = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm:ss');
  const saved = [];

  for (let j = 0; j < items.length; j++) {
    const item = items[j] || {};
    const kategori = String(item.kategori || '').trim().toUpperCase();
    const limit = Math.max(0, Math.round(parseNumber(item.limit)));
    if (!kategori) continue;

    if (rowIndexByCat[kategori]) {
      const rNum = rowIndexByCat[kategori];
      sheet.getRange(rNum, 2).setValue(limit);
      sheet.getRange(rNum, 3).setValue(updatedAt);
    } else {
      sheet.appendRow([kategori, limit, updatedAt]);
      rowIndexByCat[kategori] = sheet.getLastRow();
    }
    saved.push({ kategori: kategori, limit: limit, updatedAt: updatedAt });
  }

  if (saved.length === 0) {
    return jsonResponse({ status: 'error', message: 'Kategori budget wajib diisi.' });
  }

  return jsonResponse({
    status: 'success',
    message: 'Budget berhasil disimpan',
    saved: saved
  });
}

function handleSaveGoalAction(payload, tz) {
  const nama = String(payload.nama || payload.name || '').trim();
  const target = Math.round(pickNumber(payload, ['target', 'targetRp'], 0));
  const terkumpul = Math.max(0, Math.round(pickNumber(payload, ['terkumpul', 'saved', 'terkumpulRp'], 0)));
  const targetDate = String(payload.targetDate || '').trim();

  if (!nama) {
    return jsonResponse({ status: 'error', message: 'Nama target wajib diisi.' });
  }
  if (target <= 0) {
    return jsonResponse({ status: 'error', message: 'Nominal target harus lebih dari 0.' });
  }

  const sheet = getGoalsSheet();
  const rows = sheet.getDataRange().getValues();
  const updatedAt = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm:ss');
  const goalId = String(payload.id || payload.goalId || ('GOAL-' + new Date().getTime())).trim();

  let foundRow = -1;
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0] || '').trim() === goalId) {
      foundRow = i + 1;
      break;
    }
  }

  if (foundRow > 0) {
    sheet.getRange(foundRow, 2).setValue(nama);
    sheet.getRange(foundRow, 3).setValue(target);
    sheet.getRange(foundRow, 4).setValue(terkumpul);
    sheet.getRange(foundRow, 5).setValue(targetDate);
    sheet.getRange(foundRow, 6).setValue(updatedAt);
  } else {
    sheet.appendRow([goalId, nama, target, terkumpul, targetDate, updatedAt]);
  }

  return jsonResponse({
    status: 'success',
    message: 'Target bersama berhasil disimpan',
    goal: {
      id: goalId,
      nama: nama,
      target: target,
      terkumpul: terkumpul,
      targetDate: targetDate,
      updatedAt: updatedAt
    }
  });
}

function handleDeleteGoalAction(payload) {
  const goalId = String(payload.id || payload.goalId || '').trim();
  if (!goalId) {
    return jsonResponse({ status: 'error', message: 'Goal ID wajib diisi.' });
  }
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(GOALS_SHEET_NAME);
  if (!sheet || sheet.getLastRow() <= 1) {
    return jsonResponse({ status: 'error', message: 'Target tidak ditemukan.' });
  }
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0] || '').trim() === goalId) {
      if (typeof sheet.deleteRow === 'function') {
        sheet.deleteRow(i + 1);
      } else {
        sheet.getRange(i + 1, 3).setValue(0);
      }
      return jsonResponse({ status: 'success', message: 'Target berhasil dihapus', id: goalId });
    }
  }
  return jsonResponse({ status: 'error', message: 'Target tidak ditemukan.' });
}

function getUsersSheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const tz = Session.getScriptTimeZone() || 'Asia/Jakarta';
  const sheet = getOrCreateSheet(ss, USERS_SHEET_NAME, [
    'Username', 'Password', 'BadgeColor', 'UpdatedAt'
  ]);

  if (sheet.getLastRow() <= 1) {
    const nowTs = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm:ss');
    for (let i = 0; i < DEFAULT_USERS_SEED.length; i++) {
      const seed = DEFAULT_USERS_SEED[i];
      sheet.appendRow([seed[0], seed[1], seed[2], nowTs]);
      const rowNum = sheet.getLastRow();
      sheet.getRange(rowNum, 2).setNumberFormat('@').setValue(String(seed[1]));
    }
  }
  return sheet;
}

function findUserRow(usersSheet, username) {
  const target = String(username || '').trim().toLowerCase();
  if (!target) return null;

  const rows = usersSheet.getDataRange().getDisplayValues();
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const sheetUser = String(row[0] || '').trim();
    if (sheetUser && sheetUser.toLowerCase() === target) {
      return {
        rowNumber: i + 1,
        username: sheetUser,
        password: String(row[1] || ''),
        badgeColor: String(row[2] || '').trim() || (sheetUser.toLowerCase() === 'vivie' ? '#EC4899' : '#6366F1'),
        updatedAt: String(row[3] || '').trim()
      };
    }
  }
  return null;
}

function handleLoginAction(payload) {
  const username = String(payload.username || '').trim();
  const password = String(payload.password || '');

  if (!username || !password) {
    return jsonResponse({ status: 'error', message: 'Username dan password wajib diisi.' });
  }

  const usersSheet = getUsersSheet();
  const found = findUserRow(usersSheet, username);

  if (!found || found.password !== password) {
    return jsonResponse({ status: 'error', message: 'Username atau password salah!' });
  }

  return jsonResponse({
    status: 'success',
    message: 'Login berhasil',
    user: {
      username: found.username,
      badgeColor: found.badgeColor
    }
  });
}

function handleChangePasswordAction(payload, tz) {
  const username = String(payload.username || '').trim();
  const currentPassword = String(payload.currentPassword || '');
  const newPassword = String(payload.newPassword || '');

  if (!username || !currentPassword || !newPassword) {
    return jsonResponse({ status: 'error', message: 'Semua kolom password wajib diisi.' });
  }
  if (newPassword.length < 4) {
    return jsonResponse({ status: 'error', message: 'Password baru minimal 4 karakter.' });
  }
  if (newPassword === currentPassword) {
    return jsonResponse({ status: 'error', message: 'Password baru harus berbeda dari password lama.' });
  }

  const usersSheet = getUsersSheet();
  const found = findUserRow(usersSheet, username);

  if (!found) {
    return jsonResponse({ status: 'error', message: 'Akun tidak ditemukan di sheet Users.' });
  }
  if (found.password !== currentPassword) {
    return jsonResponse({ status: 'error', message: 'Password lama tidak sesuai!' });
  }

  const updatedAt = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm:ss');
  // Set format teks (@) agar password angka seperti "001234" tidak hilang angka nol di depan
  usersSheet.getRange(found.rowNumber, 2).setNumberFormat('@').setValue(newPassword);
  usersSheet.getRange(found.rowNumber, 4).setNumberFormat('@').setValue(updatedAt);

  return jsonResponse({
    status: 'success',
    message: 'Password berhasil diperbarui!',
    updatedAt: updatedAt
  });
}

function formatCellDate(val, tz) {
  if (!val) return '';
  if (val instanceof Date) {
    return Utilities.formatDate(val, tz, 'yyyy-MM-dd');
  }
  return String(val).trim();
}

function formatCellTimestamp(val, tz) {
  if (!val) return '';
  if (val instanceof Date) {
    return Utilities.formatDate(val, tz, 'yyyy-MM-dd HH:mm:ss');
  }
  return String(val).trim();
}

function parseNumber(val) {
  if (typeof val === 'number') return isFinite(val) ? val : 0;
  if (val === undefined || val === null || String(val).trim() === '') return 0;

  const str = String(val).trim().replace(/^rp\s*/i, '');
  const cleaned = str.replace(/[^0-9.,-]/g, '');
  if (!cleaned || cleaned === '-' || cleaned === '.' || cleaned === ',') return 0;

  let normalized = cleaned;
  const hasComma = cleaned.indexOf(',') !== -1;
  const hasDot = cleaned.indexOf('.') !== -1;

  if (hasComma && hasDot) {
    if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
      normalized = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = cleaned.replace(/,/g, '');
    }
  } else if (hasComma) {
    const parts = cleaned.split(',');
    const intDigits = parts[0].replace('-', '');
    if (parts.length > 2) {
      normalized = cleaned.replace(/,/g, '');
    } else if (intDigits === '0' || parts[1].length !== 3 || intDigits.length > 3) {
      normalized = parts[0] + '.' + parts[1];
    } else {
      normalized = cleaned.replace(/,/g, '');
    }
  } else if (hasDot) {
    const parts = cleaned.split('.');
    const intDigits = parts[0].replace('-', '');
    if (parts.length > 2) {
      normalized = cleaned.replace(/\./g, '');
    } else if (intDigits === '0' || parts[1].length !== 3 || intDigits.length > 3) {
      normalized = cleaned;
    } else {
      normalized = cleaned.replace(/\./g, '');
    }
  }

  const num = Number(normalized);
  return isFinite(num) ? num : 0;
}

function pickNumber(obj, keys, fallback) {
  if (fallback === undefined) fallback = 0;
  if (!obj || typeof obj !== 'object') return fallback;
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== '') {
      const parsed = parseNumber(obj[k]);
      if (isFinite(parsed)) return parsed;
    }
  }
  return fallback;
}

function fetchMarketPrices(forceRefresh) {
  const cache = CacheService.getScriptCache();
  const cachedJson = cache.get(MARKET_PRICE_CACHE_KEY);
  let cached = {};
  if (cachedJson) {
    try {
      cached = JSON.parse(cachedJson) || {};
    } catch (e) {
      cached = {};
    }
  }

  const tz = Session.getScriptTimeZone() || 'Asia/Jakarta';
  let bbcaPrice = Number(cached.bbca) || 0;
  let btcPrice = Number(cached.btc) || 0;
  let updatedAt = cached.updatedAt || Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm:ss');

  if (!forceRefresh && bbcaPrice > 0 && btcPrice > 0) {
    return {
      'BBCA/IDR': bbcaPrice,
      'BTC/IDR': btcPrice,
      updatedAt: updatedAt,
      cached: true
    };
  }

  let updatedAny = false;

  // 1. Ambil harga BTC/IDR dari CoinGecko (24/7)
  try {
    const resBtc = UrlFetchApp.fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=idr',
      { muteHttpExceptions: true }
    );
    if (resBtc.getResponseCode() === 200) {
      const jsonBtc = JSON.parse(resBtc.getContentText());
      if (jsonBtc && jsonBtc.bitcoin && Number(jsonBtc.bitcoin.idr) > 0) {
        btcPrice = Number(jsonBtc.bitcoin.idr);
        updatedAny = true;
      }
    }
  } catch (e) {}

  // 2. Ambil harga BBCA/IDR dari Yahoo Finance (fallback ke cache jika gagal / luar jam bursa)
  try {
    const resBbca = UrlFetchApp.fetch(
      'https://query1.finance.yahoo.com/v8/finance/chart/BBCA.JK?interval=1d&range=5d',
      {
        muteHttpExceptions: true,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      }
    );
    if (resBbca.getResponseCode() === 200) {
      const jsonBbca = JSON.parse(resBbca.getContentText());
      const result0 = jsonBbca && jsonBbca.chart && jsonBbca.chart.result && jsonBbca.chart.result[0];
      const meta = result0 && result0.meta;
      const regularPrice = Number((meta && meta.regularMarketPrice) || 0);
      const prevClose = Number((meta && (meta.chartPreviousClose || meta.previousClose)) || 0);
      if (regularPrice > 0) {
        bbcaPrice = regularPrice;
        updatedAny = true;
      } else if (prevClose > 0) {
        bbcaPrice = prevClose;
        updatedAny = true;
      }
    }
  } catch (e) {}

  if (updatedAny && (bbcaPrice > 0 || btcPrice > 0)) {
    updatedAt = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm:ss');
    cache.put(
      MARKET_PRICE_CACHE_KEY,
      JSON.stringify({
        bbca: bbcaPrice,
        btc: btcPrice,
        updatedAt: updatedAt
      }),
      MARKET_PRICE_CACHE_TTL_SECONDS
    );
  }

  return {
    'BBCA/IDR': bbcaPrice,
    'BTC/IDR': btcPrice,
    updatedAt: updatedAt,
    cached: !updatedAny
  };
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  try {
    const tz = Session.getScriptTimeZone() || 'Asia/Jakarta';
    const params = (e && e.parameter) || {};
    const forceRefresh = params.refresh === '1' || params.refresh === 'true';

    const txSheet = getTxSheet();
    const txData = txSheet.getDataRange().getValues();
    const transactions = [];

    for (let i = 1; i < txData.length; i++) {
      const row = txData[i];
      if (!row[0] && !row[2] && !row[3]) continue;
      const rawType = String(row[1] || 'Pengeluaran').trim();
      const normalizedType = rawType.toLowerCase() === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran';
      transactions.push({
        tanggal: formatCellDate(row[0], tz),
        type: normalizedType,
        nominal: parseNumber(row[2]),
        keterangan: String(row[3] || '').trim(),
        kategori: String(row[4] || 'OTHER').trim().toUpperCase(),
        user: String(row[5] || '').trim(),
        timestamp: formatCellTimestamp(row[6], tz)
      });
    }

    const investSheet = getInvestSheet();
    const invData = investSheet.getDataRange().getValues();
    const investments = [];

    for (let i = 1; i < invData.length; i++) {
      const row = invData[i];
      if (!row[0] && !row[2] && !row[3] && !row[5]) continue;
      const lot = parseNumber(row[3]);
      let avgBuy = parseNumber(row[4]);
      let amount = parseNumber(row[2]);

      if (avgBuy === 0 && amount > 0 && lot > 0) {
        avgBuy = amount / lot;
      }
      if (amount === 0 && lot > 0 && avgBuy > 0) {
        amount = Math.round(lot * avgBuy);
      }

      investments.push({
        tanggal: formatCellDate(row[0], tz),
        type: String(row[1] || 'Invest').trim(),
        amount: amount,
        lot: lot,
        avgBuy: avgBuy,
        saham: String(row[5] || '').trim().toUpperCase(),
        keterangan: String(row[6] || '').trim(),
        kategori: String(row[7] || 'INVEST').trim().toUpperCase(),
        user: String(row[8] || '').trim(),
        timestamp: formatCellTimestamp(row[9], tz)
      });
    }

    const prices = fetchMarketPrices(forceRefresh);
    const budgets = readBudgetsList(tz);
    const goals = readGoalsList(tz);

    // Catatan keamanan: sheet Users TIDAK pernah dikembalikan oleh doGet
    return jsonResponse({
      status: 'success',
      data: transactions,
      investments: investments,
      budgets: budgets,
      goals: goals,
      prices: prices
    });
  } catch (err) {
    return jsonResponse({ status: 'error', message: err.toString() });
  }
}

function doPost(e) {
  try {
    const tz = Session.getScriptTimeZone() || 'Asia/Jakarta';
    const rawBody = (e && e.postData && e.postData.contents) || '{}';
    const payload = JSON.parse(rawBody);
    const action = String(payload.action || '').trim().toLowerCase();

    if (action === 'login') {
      return handleLoginAction(payload);
    }
    if (action === 'changepassword' || action === 'change_password') {
      return handleChangePasswordAction(payload, tz);
    }
    if (action === 'savebudget' || action === 'save_budget') {
      return handleSaveBudgetAction(payload, tz);
    }
    if (action === 'savegoal' || action === 'save_goal') {
      return handleSaveGoalAction(payload, tz);
    }
    if (action === 'deletegoal' || action === 'delete_goal') {
      return handleDeleteGoalAction(payload);
    }

    const rawType = String(payload.type || 'Pengeluaran').trim();
    const isInvest = rawType.toLowerCase() === 'invest' || String(payload.targetSheet || '').toLowerCase() === 'invest';
    const tanggal = String(
      payload.tanggal || payload.date || Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd')
    ).trim();
    const user = String(payload.user || 'Kevin').trim();
    const keterangan = String(payload.keterangan || '').trim();
    const kategori = String(payload.kategori || (isInvest ? 'INVEST' : 'OTHER')).trim().toUpperCase();
    const timestamp = String(
      payload.timestamp || Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm:ss')
    ).trim();

    if (isInvest) {
      const investSheet = getInvestSheet();
      const lot = pickNumber(payload, ['lot', 'lembar', 'lotLembar', 'lot_lembar', 'amountLot', 'amount_lot'], 0);
      let avgBuy = pickNumber(payload, ['avgBuy', 'avgPrice', 'averageBuy', 'average_buy', 'avg_buy', 'price', 'priceBuy'], 0);
      let amount = pickNumber(payload, ['amount', 'nominal', 'totalAmount', 'total_amount'], 0);

      if (lot <= 0) {
        return jsonResponse({ status: 'error', message: 'Jumlah lembar/unit harus lebih dari 0' });
      }

      if (avgBuy === 0 && amount > 0 && lot > 0) {
        avgBuy = amount / lot;
      }
      if (amount === 0 && lot > 0 && avgBuy > 0) {
        amount = Math.round(lot * avgBuy);
      }

      if (avgBuy <= 0 || amount <= 0) {
        return jsonResponse({ status: 'error', message: 'Harga beli atau total modal harus lebih dari 0' });
      }

      const saham = String(payload.saham || payload.kodeInvest || payload.kode_invest || 'BBCA/IDR').trim().toUpperCase();

      investSheet.appendRow([
        tanggal,
        'Invest',
        amount,
        lot,
        avgBuy,
        saham,
        keterangan,
        kategori || 'INVEST',
        user,
        timestamp
      ]);

      return jsonResponse({
        status: 'success',
        message: 'Data investasi berhasil ditambahkan',
        saved: { tanggal: tanggal, amount: amount, lot: lot, avgBuy: avgBuy, saham: saham }
      });
    }

    const txSheet = getTxSheet();
    const nominal = pickNumber(payload, ['nominal', 'amount'], 0);
    if (nominal <= 0) {
      return jsonResponse({ status: 'error', message: 'Nominal transaksi harus lebih dari 0' });
    }

    const normalizedType = rawType.toLowerCase() === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran';

    txSheet.appendRow([
      tanggal,
      normalizedType,
      nominal,
      keterangan,
      kategori || 'OTHER',
      user,
      timestamp
    ]);

    return jsonResponse({
      status: 'success',
      message: 'Data transaksi berhasil ditambahkan',
      saved: { tanggal: tanggal, type: normalizedType, nominal: nominal, kategori: kategori || 'OTHER' }
    });
  } catch (err) {
    return jsonResponse({ status: 'error', message: err.toString() });
  }
}
