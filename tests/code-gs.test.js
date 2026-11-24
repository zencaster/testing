const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const CODE_GS_PATH = path.resolve(__dirname, '../apps-script/Code.gs');
const codeGsSource = fs.readFileSync(CODE_GS_PATH, 'utf8');

function createMockGasEnv(options = {}) {
  const sheets = {};
  const initialSheets = options.sheets || {
    Planner: [
      ['Date', 'Type', 'Amount', 'Keterangan', 'Kategori', 'user', 'Timestamp'],
    ],
    Invest: [
      ['Date', 'Type', 'Amount', 'Lot lembar', 'Average Buy', 'Saham', 'Keterangan', 'Kategori', 'user', 'Timestamp'],
    ],
  };

  function makeSheet(name, initialRows = []) {
    const rows = initialRows.map((r) => r.slice());
    const formats = {};
    return {
      name,
      rows,
      formats,
      getLastRow() {
        return this.rows.length;
      },
      appendRow(row) {
        this.rows.push(Array.from(row));
      },
      deleteRow(rowNum) {
        if (rowNum >= 1 && rowNum <= this.rows.length) {
          this.rows.splice(rowNum - 1, 1);
        }
      },
      getRange(rowNum, colNum) {
        const self = this;
        return {
          setNumberFormat(fmt) {
            self.formats[`${rowNum}:${colNum}`] = fmt;
            return this;
          },
          setValue(val) {
            while (self.rows.length < rowNum) self.rows.push([]);
            while (self.rows[rowNum - 1].length < colNum) self.rows[rowNum - 1].push('');
            self.rows[rowNum - 1][colNum - 1] = val;
            return this;
          },
        };
      },
      getDataRange() {
        return {
          getValues: () => this.rows.map((r) => r.slice()),
          getDisplayValues: () => this.rows.map((r) => r.map((cell) => (cell === null || cell === undefined ? '' : String(cell)))),
        };
      },
    };
  }

  Object.keys(initialSheets).forEach((name) => {
    sheets[name] = makeSheet(name, initialSheets[name]);
  });

  const cacheStore = Object.assign({}, options.cache || {});
  const fetchCalls = [];
  const fetchResponder =
    options.fetchResponder ||
    ((url) => {
      if (url.includes('coingecko')) {
        return {
          getResponseCode: () => 200,
          getContentText: () => JSON.stringify({ bitcoin: { idr: 1500000000 } }),
        };
      }
      if (url.includes('yahoo')) {
        return {
          getResponseCode: () => 200,
          getContentText: () =>
            JSON.stringify({
              chart: { result: [{ meta: { regularMarketPrice: 9800, chartPreviousClose: 9700 } }] },
            }),
        };
      }
      return { getResponseCode: () => 404, getContentText: () => '{}' };
    });

  const mockSpreadsheet = {
    getSheetByName(name) {
      return sheets[name] || null;
    },
    getSheets() {
      return Object.values(sheets);
    },
    insertSheet(name) {
      sheets[name] = makeSheet(name, []);
      return sheets[name];
    },
  };

  const sandbox = {
    console,
    Date,
    Math,
    Number,
    String,
    Array,
    Object,
    JSON,
    isFinite,
    isNaN,
    SpreadsheetApp: {
      openById: () => mockSpreadsheet,
    },
    CacheService: {
      getScriptCache: () => ({
        get: (key) => (Object.prototype.hasOwnProperty.call(cacheStore, key) ? cacheStore[key] : null),
        put: (key, val) => {
          cacheStore[key] = val;
        },
      }),
    },
    UrlFetchApp: {
      fetch: (url, params) => {
        fetchCalls.push({ url, params });
        return fetchResponder(url, params);
      },
    },
    Session: {
      getScriptTimeZone: () => 'Asia/Jakarta',
    },
    Utilities: {
      formatDate: (date, _tz, pattern) => {
        const d = new Date(date.getTime() + 7 * 60 * 60 * 1000); // UTC+7 WIB
        const pad = (n) => String(n).padStart(2, '0');
        const yyyy = d.getUTCFullYear();
        const MM = pad(d.getUTCMonth() + 1);
        const dd = pad(d.getUTCDate());
        const HH = pad(d.getUTCHours());
        const mm = pad(d.getUTCMinutes());
        const ss = pad(d.getUTCSeconds());
        if (pattern === 'yyyy-MM-dd') return `${yyyy}-${MM}-${dd}`;
        if (pattern === 'yyyy-MM-dd HH:mm:ss') return `${yyyy}-${MM}-${dd} ${HH}:${mm}:${ss}`;
        return `${yyyy}-${MM}-${dd}`;
      },
    },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (text) => ({
        text,
        mimeType: null,
        setMimeType(type) {
          this.mimeType = type;
          return this;
        },
        getContent() {
          return this.text;
        },
      }),
    },
  };

  vm.createContext(sandbox);
  vm.runInContext(codeGsSource, sandbox, { filename: 'Code.gs' });

  return { sandbox, sheets, cacheStore, fetchCalls };
}

describe('Google Apps Script (apps-script/Code.gs)', () => {
  describe('parseNumber & pickNumber', () => {
    it('parses decimal crypto quantities without corrupting 3-decimal numbers like 0.005', () => {
      const { sandbox } = createMockGasEnv();
      assert.equal(sandbox.parseNumber(0.005), 0.005);
      assert.equal(sandbox.parseNumber('0.005'), 0.005);
      assert.equal(sandbox.parseNumber('0,005'), 0.005);
      assert.equal(sandbox.parseNumber('0.000125'), 0.000125);
      assert.equal(sandbox.parseNumber('12.5'), 12.5);
      assert.equal(sandbox.parseNumber('1234.567'), 1234.567);
    });

    it('parses Indonesian and US currency/thousands formats', () => {
      const { sandbox } = createMockGasEnv();
      assert.equal(sandbox.parseNumber('50.000'), 50000);
      assert.equal(sandbox.parseNumber('Rp 1.500.000'), 1500000);
      assert.equal(sandbox.parseNumber('Rp 1.500.000,50'), 1500000.5);
      assert.equal(sandbox.parseNumber('1,500,000.50'), 1500000.5);
      assert.equal(sandbox.parseNumber('9.250'), 9250);
      assert.equal(sandbox.parseNumber(''), 0);
      assert.equal(sandbox.parseNumber(null), 0);
      assert.equal(sandbox.parseNumber('abc'), 0);
    });

    it('pickNumber returns first valid numeric key in priority order', () => {
      const { sandbox } = createMockGasEnv();
      assert.equal(sandbox.pickNumber({ avgPrice: '9.250' }, ['avgBuy', 'avgPrice'], 0), 9250);
      assert.equal(sandbox.pickNumber({ avgBuy: 9500, avgPrice: 9250 }, ['avgBuy', 'avgPrice'], 0), 9500);
      assert.equal(sandbox.pickNumber({}, ['avgBuy', 'avgPrice'], 42), 42);
    });
  });

  describe('formatCellDate & formatCellTimestamp', () => {
    it('formats Date objects into date-only and full timestamp WIB strings', () => {
      const { sandbox } = createMockGasEnv();
      const utcDate = new Date('2026-11-20T03:45:12Z'); // 10:45:12 WIB
      assert.equal(sandbox.formatCellDate(utcDate, 'Asia/Jakarta'), '2026-11-20');
      assert.equal(sandbox.formatCellTimestamp(utcDate, 'Asia/Jakarta'), '2026-11-20 10:45:12');
    });
  });

  describe('fetchMarketPrices caching', () => {
    it('uses 6h cache when both prices exist and forceRefresh is false', () => {
      const { sandbox, fetchCalls } = createMockGasEnv({
        cache: {
          market_prices_v1: JSON.stringify({
            bbca: 9650,
            btc: 1450000000,
            updatedAt: '2026-11-20 10:00:00',
          }),
        },
      });
      const prices = sandbox.fetchMarketPrices(false);
      assert.equal(prices['BBCA/IDR'], 9650);
      assert.equal(prices['BTC/IDR'], 1450000000);
      assert.equal(prices.cached, true);
      assert.equal(fetchCalls.length, 0);
    });

    it('fetches live prices and populates cache when forceRefresh is true', () => {
      const { sandbox, fetchCalls, cacheStore } = createMockGasEnv({
        cache: {
          market_prices_v1: JSON.stringify({
            bbca: 9650,
            btc: 1450000000,
            updatedAt: '2026-11-20 10:00:00',
          }),
        },
      });
      const prices = sandbox.fetchMarketPrices(true);
      assert.equal(prices['BBCA/IDR'], 9800);
      assert.equal(prices['BTC/IDR'], 1500000000);
      assert.equal(prices.cached, false);
      assert.equal(fetchCalls.length, 2);
      assert.ok(cacheStore.market_prices_v1);
    });
  });

  describe('doGet', () => {
    it('returns transactions from Planner, investments from Invest, and market prices', () => {
      const { sandbox } = createMockGasEnv({
        sheets: {
          Planner: [
            ['Date', 'Type', 'Amount', 'Keterangan', 'Kategori', 'user', 'Timestamp'],
            [new Date('2026-11-20T00:00:00Z'), 'Pengeluaran', 50000, 'Bakmie', 'food', 'Kevin', new Date('2026-11-20T05:15:00Z')],
            ['', '', '', '', '', '', ''],
          ],
          Invest: [
            ['Date', 'Type', 'Amount', 'Lot lembar', 'Average Buy', 'Saham', 'Keterangan', 'Kategori', 'user', 'Timestamp'],
            ['2026-11-20', 'Invest', 0, 5000, 9250, 'bbca/idr', 'ajaib', 'invest', 'Kevin', '2026-11-20 12:00:00'],
            ['2026-11-20', 'Invest', 7000000, '0.005', 0, 'BTC/IDR', 'binance', 'INVEST', 'Vivie', '2026-11-20 12:05:00'],
          ],
        },
      });

      const res = JSON.parse(sandbox.doGet({}).getContent());
      assert.equal(res.status, 'success');
      assert.equal(res.data.length, 1);
      assert.equal(res.data[0].tanggal, '2026-11-20');
      assert.equal(res.data[0].nominal, 50000);
      assert.equal(res.data[0].kategori, 'FOOD');
      assert.equal(res.data[0].timestamp, '2026-11-20 12:15:00');

      assert.equal(res.investments.length, 2);
      // Direct lembar calculation: 5000 * 9250 = 46,250,000 (NO x100)
      assert.equal(res.investments[0].amount, 46250000);
      assert.equal(res.investments[0].lot, 5000);
      assert.equal(res.investments[0].avgBuy, 9250);
      assert.equal(res.investments[0].saham, 'BBCA/IDR');

      // 0.005 BTC fallback avgBuy = 7,000,000 / 0.005 = 1,400,000,000
      assert.equal(res.investments[1].lot, 0.005);
      assert.equal(res.investments[1].avgBuy, 1400000000);

      assert.equal(res.prices['BBCA/IDR'], 9800);
      assert.equal(res.prices['BTC/IDR'], 1500000000);
    });

    it('falls back to Sheet1 when Planner does not exist', () => {
      const { sandbox } = createMockGasEnv({
        sheets: {
          Sheet1: [
            ['Date', 'Type', 'Amount', 'Keterangan', 'Kategori', 'user', 'Timestamp'],
            ['2026-11-19', 'Pemasukan', 10000000, 'Gaji', 'GAJI', 'Vivie', '2026-11-19 09:00:00'],
          ],
        },
      });
      const res = JSON.parse(sandbox.doGet({}).getContent());
      assert.equal(res.status, 'success');
      assert.equal(res.data.length, 1);
      assert.equal(res.data[0].type, 'Pemasukan');
      assert.equal(res.data[0].nominal, 10000000);
    });
  });

  describe('doPost', () => {
    it('appends standard transaction accepting date/tanggal and nominal/amount', () => {
      const { sandbox, sheets } = createMockGasEnv();
      const postEvent = {
        postData: {
          contents: JSON.stringify({
            date: '2026-11-15',
            type: 'Pengeluaran',
            amount: 75000,
            keterangan: 'Kopi',
            kategori: 'food',
            user: 'Kevin',
            timestamp: '2026-11-15 08:30:00',
          }),
        },
      };
      const res = JSON.parse(sandbox.doPost(postEvent).getContent());
      assert.equal(res.status, 'success');
      assert.equal(sheets.Planner.rows.length, 2);
      assert.deepEqual(sheets.Planner.rows[1], [
        '2026-11-15',
        'Pengeluaran',
        75000,
        'Kopi',
        'FOOD',
        'Kevin',
        '2026-11-15 08:30:00',
      ]);
    });

    it('appends Invest row with direct lembar calculation and accepts avgPrice/avgBuy', () => {
      const { sandbox, sheets } = createMockGasEnv();
      const postEvent = {
        postData: {
          contents: JSON.stringify({
            date: '2026-11-18',
            type: 'Invest',
            lot: 5000,
            avgPrice: 9250,
            saham: 'BBCA/IDR',
            keterangan: 'ajaib',
            user: 'Kevin',
            timestamp: '2026-11-18 14:00:00',
          }),
        },
      };
      const res = JSON.parse(sandbox.doPost(postEvent).getContent());
      assert.equal(res.status, 'success');
      assert.equal(res.saved.amount, 46250000);
      assert.equal(res.saved.lot, 5000);
      assert.equal(res.saved.avgBuy, 9250);
      assert.equal(sheets.Invest.rows.length, 2);
      assert.deepEqual(sheets.Invest.rows[1], [
        '2026-11-18',
        'Invest',
        46250000,
        5000,
        9250,
        'BBCA/IDR',
        'ajaib',
        'INVEST',
        'Kevin',
        '2026-11-18 14:00:00',
      ]);
    });

    it('preserves decimal BTC quantity 0.005 on doPost', () => {
      const { sandbox, sheets } = createMockGasEnv();
      const postEvent = {
        postData: {
          contents: JSON.stringify({
            tanggal: '2026-11-20',
            type: 'Invest',
            lot: '0.005',
            avgBuy: 1400000000,
            saham: 'BTC/IDR',
            keterangan: 'binance',
            user: 'Vivie',
          }),
        },
      };
      const res = JSON.parse(sandbox.doPost(postEvent).getContent());
      assert.equal(res.status, 'success');
      assert.equal(res.saved.lot, 0.005);
      assert.equal(res.saved.amount, 7000000);
      assert.equal(sheets.Invest.rows[1][3], 0.005);
    });

    it('rejects invalid payloads with nominal <= 0 or lot <= 0', () => {
      const { sandbox } = createMockGasEnv();
      const badTx = JSON.parse(
        sandbox.doPost({ postData: { contents: JSON.stringify({ type: 'Pengeluaran', nominal: 0 }) } }).getContent()
      );
      assert.equal(badTx.status, 'error');

      const badInv = JSON.parse(
        sandbox.doPost({ postData: { contents: JSON.stringify({ type: 'Invest', lot: 0, avgBuy: 9000 }) } }).getContent()
      );
      assert.equal(badInv.status, 'error');
    });
  });

  describe('Users Sheet Authentication & Change Password', () => {
    it('auto-creates Users sheet with plain-text seed accounts and validates login', () => {
      const { sandbox, sheets } = createMockGasEnv();

      const okRes = JSON.parse(
        sandbox.doPost({
          postData: { contents: JSON.stringify({ action: 'login', username: 'kevin', password: 'Kevin' }) },
        }).getContent()
      );
      assert.equal(okRes.status, 'success');
      assert.equal(okRes.user.username, 'Kevin');
      assert.equal(okRes.user.badgeColor, '#6366F1');
      assert.ok(sheets.Users, 'Users sheet should be auto-created');
      assert.equal(sheets.Users.rows.length, 3);
      assert.equal(sheets.Users.rows[1][1], 'Kevin');

      const wrongPass = JSON.parse(
        sandbox.doPost({
          postData: { contents: JSON.stringify({ action: 'login', username: 'Kevin', password: 'wrong' }) },
        }).getContent()
      );
      assert.equal(wrongPass.status, 'error');

      const unknownUser = JSON.parse(
        sandbox.doPost({
          postData: { contents: JSON.stringify({ action: 'login', username: 'Budi', password: 'Kevin' }) },
        }).getContent()
      );
      assert.equal(unknownUser.status, 'error');
    });

    it('changes plain-text password in Users sheet, formats as text (@), and verifies new login', () => {
      const { sandbox, sheets } = createMockGasEnv();

      // Trigger auto-seed then change password to leading-zero numeric string
      const changeRes = JSON.parse(
        sandbox.doPost({
          postData: {
            contents: JSON.stringify({
              action: 'changePassword',
              username: 'vivie',
              currentPassword: 'Vivie',
              newPassword: '001234',
            }),
          },
        }).getContent()
      );
      assert.equal(changeRes.status, 'success');
      assert.equal(sheets.Users.rows[2][1], '001234');
      assert.equal(sheets.Users.formats['3:2'], '@');

      // Old password fails
      const oldLogin = JSON.parse(
        sandbox.doPost({
          postData: { contents: JSON.stringify({ action: 'login', username: 'Vivie', password: 'Vivie' }) },
        }).getContent()
      );
      assert.equal(oldLogin.status, 'error');

      // New password succeeds
      const newLogin = JSON.parse(
        sandbox.doPost({
          postData: { contents: JSON.stringify({ action: 'login', username: 'Vivie', password: '001234' }) },
        }).getContent()
      );
      assert.equal(newLogin.status, 'success');
      assert.equal(newLogin.user.username, 'Vivie');
    });

    it('rejects changePassword with wrong current password, short password, or identical password', () => {
      const { sandbox } = createMockGasEnv();
      const wrongOld = JSON.parse(
        sandbox.doPost({
          postData: { contents: JSON.stringify({ action: 'changePassword', username: 'Kevin', currentPassword: 'bad', newPassword: 'newpass' }) },
        }).getContent()
      );
      assert.equal(wrongOld.status, 'error');

      const tooShort = JSON.parse(
        sandbox.doPost({
          postData: { contents: JSON.stringify({ action: 'changePassword', username: 'Kevin', currentPassword: 'Kevin', newPassword: '123' }) },
        }).getContent()
      );
      assert.equal(tooShort.status, 'error');

      const samePass = JSON.parse(
        sandbox.doPost({
          postData: { contents: JSON.stringify({ action: 'changePassword', username: 'Kevin', currentPassword: 'Kevin', newPassword: 'Kevin' }) },
        }).getContent()
      );
      assert.equal(samePass.status, 'error');
    });

    it('doGet never exposes Users sheet or passwords', () => {
      const { sandbox } = createMockGasEnv();
      sandbox.getUsersSheet(); // ensure Users exists
      const res = JSON.parse(sandbox.doGet({}).getContent());
      assert.equal(res.status, 'success');
      assert.equal(res.users, undefined);
      assert.ok(!JSON.stringify(res).includes('Password'));
    });
  });

  describe('Budget & Goals Sheets (Fase 2 & Fase 3)', () => {
    it('auto-creates Budget sheet, upserts limits by category, and returns them in doGet', () => {
      const { sandbox, sheets } = createMockGasEnv();

      const res1 = JSON.parse(
        sandbox.doPost({
          postData: { contents: JSON.stringify({ action: 'saveBudget', kategori: 'food', limit: 3500000 }) },
        }).getContent()
      );
      assert.equal(res1.status, 'success');
      assert.ok(sheets.Budget, 'Budget sheet should be auto-created');
      assert.equal(sheets.Budget.rows.length, 2);

      // Upsert same category updates existing row instead of duplicating
      const res2 = JSON.parse(
        sandbox.doPost({
          postData: { contents: JSON.stringify({ action: 'saveBudget', kategori: 'FOOD', limit: 4000000 }) },
        }).getContent()
      );
      assert.equal(res2.status, 'success');
      assert.equal(sheets.Budget.rows.length, 2);
      assert.equal(sheets.Budget.rows[1][1], 4000000);

      const getRes = JSON.parse(sandbox.doGet({}).getContent());
      assert.equal(getRes.budgets.length, 1);
      assert.equal(getRes.budgets[0].kategori, 'FOOD');
      assert.equal(getRes.budgets[0].limit, 4000000);
    });

    it('creates, updates, lists, and deletes Goals cleanly', () => {
      const { sandbox, sheets } = createMockGasEnv();

      const createRes = JSON.parse(
        sandbox.doPost({
          postData: {
            contents: JSON.stringify({
              action: 'saveGoal',
              id: 'GOAL-1',
              nama: 'Dana Darurat',
              target: 60000000,
              terkumpul: 15000000,
              targetDate: '2027-12-31',
            }),
          },
        }).getContent()
      );
      assert.equal(createRes.status, 'success');
      assert.ok(sheets.Goals, 'Goals sheet should be auto-created');
      assert.equal(sheets.Goals.rows.length, 2);

      // Update saved progress
      const updateRes = JSON.parse(
        sandbox.doPost({
          postData: {
            contents: JSON.stringify({
              action: 'saveGoal',
              id: 'GOAL-1',
              nama: 'Dana Darurat 6x',
              target: 60000000,
              terkumpul: 25000000,
              targetDate: '2027-12-31',
            }),
          },
        }).getContent()
      );
      assert.equal(updateRes.status, 'success');
      assert.equal(sheets.Goals.rows.length, 2);

      const getRes = JSON.parse(sandbox.doGet({}).getContent());
      assert.equal(getRes.goals.length, 1);
      assert.equal(getRes.goals[0].nama, 'Dana Darurat 6x');
      assert.equal(getRes.goals[0].terkumpul, 25000000);

      // Delete goal
      const delRes = JSON.parse(
        sandbox.doPost({
          postData: { contents: JSON.stringify({ action: 'deleteGoal', id: 'GOAL-1' }) },
        }).getContent()
      );
      assert.equal(delRes.status, 'success');
      const getAfterDel = JSON.parse(sandbox.doGet({}).getContent());
      assert.equal(getAfterDel.goals.length, 0);
    });
  });
});
