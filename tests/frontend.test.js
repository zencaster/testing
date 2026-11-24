const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const INDEX_HTML_PATH = path.resolve(__dirname, '../index.html');
const indexHtml = fs.readFileSync(INDEX_HTML_PATH, 'utf8');

function extractMainScript(html) {
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  const appScript = scripts.find((m) => m[1].includes('const SPREADSHEET_ID'));
  assert.ok(appScript, 'Main application <script> block must exist in index.html');
  return appScript[1];
}

function extractEmbeddedGasTemplate(html) {
  const match = html.match(/<textarea id="appsScriptTemplate"[^>]*>([\s\S]*?)<\/textarea>/i);
  assert.ok(match, '#appsScriptTemplate textarea must exist in index.html');
  return match[1];
}

function createMockElement(id = '') {
  return {
    id,
    value: '',
    textContent: '',
    innerHTML: '',
    className: '',
    disabled: false,
    required: false,
    checked: false,
    placeholder: '',
    style: {},
    children: [],
    classList: {
      set: new Set(),
      add(...cls) { cls.forEach((c) => this.set.add(c)); },
      remove(...cls) { cls.forEach((c) => this.set.delete(c)); },
      contains(c) { return this.set.has(c); },
      toggle(c) {
        if (this.set.has(c)) this.set.delete(c);
        else this.set.add(c);
      },
    },
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    focus() {},
    select() {},
  };
}

function loadFrontendContext() {
  const scriptCode = extractMainScript(indexHtml);
  const elements = new Map();
  const storage = new Map();
  const toasts = [];

  const getEl = (id) => {
    if (!elements.has(id)) elements.set(id, createMockElement(id));
    return elements.get(id);
  };

  const sandbox = {
    console,
    Date,
    Math,
    Number,
    String,
    Array,
    Object,
    Set,
    JSON,
    Intl,
    encodeURIComponent,
    isFinite,
    isNaN,
    parseInt,
    parseFloat,
    setTimeout,
    clearTimeout,
    window: {},
    localStorage: {
      getItem: (k) => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => storage.set(k, String(v)),
      removeItem: (k) => storage.delete(k),
    },
    document: {
      addEventListener: () => {},
      getElementById: (id) => getEl(id),
      querySelector: () => null,
      createElement: (tag) => createMockElement(tag),
      body: { appendChild: () => {}, removeChild: () => {} },
    },
    navigator: {},
    fetch: async () => ({ ok: true, json: async () => ({ status: 'success' }) }),
  };

  vm.createContext(sandbox);
  vm.runInContext(scriptCode, sandbox, { filename: 'index.html#script' });

  const originalShowToast = sandbox.showToast;
  sandbox.showToast = (msg, icon) => {
    toasts.push({ msg, icon });
    originalShowToast(msg, icon);
  };

  return { sandbox, elements, storage, toasts, getEl };
}

describe('Frontend Application (index.html)', () => {
  describe('Syntax, Configuration & Copywriting', () => {
    it('parses main <script> and embedded #appsScriptTemplate without SyntaxError', () => {
      const mainScript = extractMainScript(indexHtml);
      assert.doesNotThrow(() => new vm.Script(mainScript));

      const gasTemplate = extractEmbeddedGasTemplate(indexHtml);
      assert.doesNotThrow(() => new vm.Script(gasTemplate));
      assert.ok(gasTemplate.includes("const TX_SHEET_NAME = 'Planner'"));
    });

    it('hardcodes the published Apps Script Web App URL and auto-migrates deprecated URL in localStorage', () => {
      const { sandbox, storage } = loadFrontendContext();
      const expectedUrl =
        'https://script.google.com/macros/s/AKfycbyE5U_RkaYU6AeXpzogGbeRbKo7SFbkdvQiN5dnUXxZWaMUqBTS4LsEskjCO_1ZNmYK/exec';
      assert.equal(sandbox.getScriptUrl(), expectedUrl);

      storage.set(
        'kv_finance_script_url',
        'https://script.google.com/macros/s/AKfycbyewqVq7M8Lf7KPkRbmTMJdbtBjou6c37mxjFUQ4v1miVnrI4jzRcoAZ7aJzPkKirpY/exec'
      );
      assert.equal(sandbox.getScriptUrl(), expectedUrl);
      assert.equal(storage.get('kv_finance_script_url'), expectedUrl);
    });

    it('uses Lembar copywriting for BBCA/IDR and removes x100 lot multiplier wording', () => {
      assert.ok(indexHtml.includes('IDX (Lembar)'));
      assert.ok(indexHtml.includes('Jumlah Lembar Saham'));
      assert.ok(indexHtml.includes('Total Lembar Dimiliki'));
      assert.ok(!indexHtml.includes('1 lot = 100 lbr'));
      assert.ok(!indexHtml.includes('Lot × 100'));
    });
  });

  describe('Authentication & Change Password (Google Sheet Users)', () => {
    it('does not contain hardcoded login credentials or quickFillAccount buttons in HTML', () => {
      assert.ok(!indexHtml.includes('quickFillAccount'));
      assert.ok(!indexHtml.includes('validateLoginCredentials'));
      assert.ok(indexHtml.includes('id="change-password-modal"'));
      assert.ok(indexHtml.includes('openChangePasswordModal()'));
    });

    it('authenticates via Apps Script POST and never stores password in localStorage', async () => {
      const { sandbox, storage, getEl } = loadFrontendContext();
      let sentBody = null;
      sandbox.fetch = async (_url, opts) => {
        if (opts && opts.method === 'POST') {
          sentBody = JSON.parse(opts.body);
          return {
            ok: true,
            json: async () => ({
              status: 'success',
              user: { username: 'Kevin', badgeColor: '#6366F1' },
            }),
          };
        }
        return { ok: true, json: async () => ({ status: 'success', data: [], investments: [] }) };
      };

      getEl('login-username').value = 'kevin';
      getEl('login-password').value = 'rahasia123';
      await sandbox.handleLogin();

      assert.equal(sentBody.action, 'login');
      assert.equal(sentBody.username, 'kevin');
      assert.equal(sentBody.password, 'rahasia123');
      assert.equal(storage.get('kv_finance_user'), 'Kevin');
      assert.equal(storage.get('kv_finance_user_badge'), '#6366F1');
      assert.equal(getEl('login-password').value, '');
      assert.ok(!Array.from(storage.values()).includes('rahasia123'));
    });

    it('validates change password inputs client-side and submits to Apps Script', async () => {
      const { sandbox, toasts, getEl } = loadFrontendContext();
      assert.equal(sandbox.validateChangePasswordInput('', '1234', '1234').ok, false);
      assert.equal(sandbox.validateChangePasswordInput('oldp', '123', '123').ok, false);
      assert.equal(sandbox.validateChangePasswordInput('oldp', '1234', '5678').ok, false);
      assert.equal(sandbox.validateChangePasswordInput('oldp', 'oldp', 'oldp').ok, false);
      assert.equal(sandbox.validateChangePasswordInput('oldp', 'newp123', 'newp123').ok, true);

      let sentBody = null;
      sandbox.fetch = async (_url, opts) => {
        sentBody = JSON.parse(opts.body);
        return { ok: true, json: async () => ({ status: 'success', message: 'Password berhasil diperbarui!' }) };
      };

      vm.runInContext('currentUser = "Vivie";', sandbox);
      sandbox.openChangePasswordModal();
      getEl('cp-current-password').value = 'Vivie';
      getEl('cp-new-password').value = 'VivieBaru99';
      getEl('cp-confirm-password').value = 'VivieBaru99';

      await sandbox.handleChangePassword({ preventDefault() {} });
      assert.equal(sentBody.action, 'changePassword');
      assert.equal(sentBody.username, 'Vivie');
      assert.equal(sentBody.currentPassword, 'Vivie');
      assert.equal(sentBody.newPassword, 'VivieBaru99');
      assert.ok(toasts.some((t) => t.msg.includes('Password berhasil diperbarui')));
    });
  });

  describe('Number & Date Parsers', () => {
    it('parses decimal and Rupiah strings accurately including 0.005 and 0,005', () => {
      const { sandbox } = loadFrontendContext();
      assert.equal(sandbox.cleanFloatAmount('0.005'), 0.005);
      assert.equal(sandbox.cleanFloatAmount('0,005'), 0.005);
      assert.equal(sandbox.cleanFloatAmount('5000'), 5000);
      assert.equal(sandbox.cleanNumericAmount('Rp 50.000'), 50000);
      assert.equal(sandbox.cleanNumericAmount('Rp 1.250.000,00'), 1250000);
    });

    it('prioritizes unambiguous gviz Date(y,m,d) over formatted date strings', () => {
      const { sandbox } = loadFrontendContext();
      const cell = { v: 'Date(2026,10,5)', f: '05/11/2026' };
      const raw = sandbox.extractGvizDateRaw(cell);
      assert.equal(raw, 'Date(2026,10,5)');
      assert.equal(sandbox.parseFlexibleDateToISO(raw), '2026-11-05');
    });
  });

  describe('API Contract Alignment (GET & POST)', () => {
    it('normalizes both Code.gs (data/investments) and legacy (sheet1/invest) responses', () => {
      const { sandbox } = loadFrontendContext();
      const modernPayload = {
        status: 'success',
        data: [{ tanggal: '2026-11-20', type: 'Pengeluaran', nominal: 45000, keterangan: 'Bakmie', kategori: 'food', user: 'Kevin', timestamp: '2026-11-20 12:00:00' }],
        investments: [{ tanggal: '2026-11-20', type: 'Invest', amount: 0, lot: 5000, avgBuy: 9250, saham: 'BBCA/IDR', keterangan: 'ajaib', kategori: 'INVEST', user: 'Kevin', timestamp: '2026-11-20 12:05:00' }],
      };

      const extracted = sandbox.extractApiDataset(modernPayload);
      const txs = sandbox.normalizeApiTransactions(extracted.txList);
      const invs = sandbox.normalizeApiInvestments(extracted.invList);

      assert.equal(txs.length, 1);
      assert.equal(txs[0].date, '2026-11-20');
      assert.equal(txs[0].amount, 45000);
      assert.equal(txs[0].kategori, 'FOOD');

      assert.equal(invs.length, 1);
      assert.equal(invs[0].date, '2026-11-20');
      assert.equal(invs[0].lot, 5000);
      assert.equal(invs[0].avgPrice, 9250);
      assert.equal(invs[0].amount, 46250000); // direct lembar, no x100
    });

    it('builds POST payloads containing both canonical and compatibility keys', () => {
      const { sandbox } = loadFrontendContext();
      const invPayload = sandbox.buildInvestmentPayload({
        date: '2026-11-20',
        lot: 5000,
        avgBuy: 9250,
        saham: 'BBCA/IDR',
        keterangan: 'ajaib',
        user: 'Kevin',
        timestamp: '2026-11-20 13:00:00',
      });
      assert.equal(invPayload.tanggal, '2026-11-20');
      assert.equal(invPayload.date, '2026-11-20');
      assert.equal(invPayload.avgBuy, 9250);
      assert.equal(invPayload.avgPrice, 9250);
      assert.equal(invPayload.amount, 46250000);
      assert.equal(invPayload.targetSheet, 'Invest');

      const txPayload = sandbox.buildTransactionPayload({
        date: '2026-11-20',
        type: 'Pemasukan',
        amount: 5000000,
        keterangan: 'Gaji',
        kategori: 'gaji',
        user: 'Vivie',
        timestamp: '2026-11-20 13:01:00',
      });
      assert.equal(txPayload.tanggal, '2026-11-20');
      assert.equal(txPayload.nominal, 5000000);
      assert.equal(txPayload.amount, 5000000);
      assert.equal(txPayload.kategori, 'GAJI');
      assert.equal(txPayload.targetSheet, 'Planner');
    });
  });

  describe('Category Isolation per Transaction Type', () => {
    it('keeps Pengeluaran and Pemasukan custom categories strictly separated', () => {
      const { sandbox } = loadFrontendContext();
      vm.runInContext(`
        sheet1Transactions = [
          { date: '2026-11-20', type: 'Pemasukan', amount: 1000000, kategori: 'DIVIDEN', user: 'Kevin' },
          { date: '2026-11-20', type: 'Pengeluaran', amount: 50000, kategori: 'KOPI', user: 'Vivie' }
        ];
        syncCategoriesFromData();
      `, sandbox);

      const expCats = sandbox.getAllAvailableCategories('Pengeluaran');
      const incCats = sandbox.getAllAvailableCategories('Pemasukan');

      assert.ok(expCats.includes('KOPI'));
      assert.ok(!expCats.includes('DIVIDEN'));
      assert.ok(!expCats.includes('GAJI'));

      assert.ok(incCats.includes('DIVIDEN'));
      assert.ok(!incCats.includes('KOPI'));
      assert.ok(!incCats.includes('FOOD'));
    });
  });

  describe('Dashboard Calculations (Monthly, Category, Investment)', () => {
    it('computes monthly KPI totals and status accurately', () => {
      const { sandbox } = loadFrontendContext();
      const txs = [
        { date: '2026-10-10', type: 'Pemasukan', amount: 10000000, kategori: 'GAJI', user: 'Kevin' },
        { date: '2026-10-15', type: 'Pengeluaran', amount: 3500000, kategori: 'FOOD', user: 'Vivie' },
        { date: '2026-11-05', type: 'Pengeluaran', amount: 2000000, kategori: 'TRAVEL', user: 'Kevin' },
      ];

      const all = sandbox.computeMonthlySummary(txs, 'ALL');
      assert.equal(all.totalIncome, 10000000);
      assert.equal(all.totalExpense, 5500000);
      assert.equal(all.balance, 4500000);
      assert.equal(all.status, 'Surplus');

      const nov = sandbox.computeMonthlySummary(txs, '2026-11');
      assert.equal(nov.totalIncome, 0);
      assert.equal(nov.totalExpense, 2000000);
      assert.equal(nov.balance, -2000000);
      assert.equal(nov.status, 'Defisit');
    });

    it('computes category breakdown sorted descending by total', () => {
      const { sandbox } = loadFrontendContext();
      const txs = [
        { date: '2026-11-01', type: 'Pengeluaran', amount: 100000, kategori: 'FOOD' },
        { date: '2026-11-02', type: 'Pengeluaran', amount: 250000, kategori: 'FOOD' },
        { date: '2026-11-03', type: 'Pengeluaran', amount: 500000, kategori: 'TRAVEL' },
        { date: '2026-11-04', type: 'Pemasukan', amount: 1000000, kategori: 'GAJI' },
      ];
      const summary = sandbox.computeCategorySummary(txs, 'Pengeluaran', '2026-11');
      assert.equal(summary.grandTotal, 850000);
      assert.equal(summary.sortedCats[0][0], 'TRAVEL');
      assert.equal(summary.sortedCats[0][1].total, 500000);
      assert.equal(summary.sortedCats[1][0], 'FOOD');
      assert.equal(summary.sortedCats[1][1].count, 2);
    });

    it('computes investment weighted average, return, and avoids double minus percentage', () => {
      const { sandbox } = loadFrontendContext();
      const invs = [
        { saham: 'BBCA/IDR', lot: 2000, avgPrice: 9000, amount: 18000000 },
        { saham: 'BBCA/IDR', lot: 3000, avgPrice: 10000, amount: 30000000 },
        { saham: 'BTC/IDR', lot: 0.005, avgPrice: 1500000000, amount: 7500000 },
      ];

      // BBCA: 5000 lembar, modal 48,000,000, avg = 9,600. At price 10,000 => current 50,000,000 => return +2,000,000
      const bbcaProfit = sandbox.computeAssetSummary('BBCA/IDR', invs, 10000);
      assert.equal(bbcaProfit.totalQty, 5000);
      assert.equal(bbcaProfit.avgPrice, 9600);
      assert.equal(bbcaProfit.totalModal, 48000000);
      assert.equal(bbcaProfit.currentVal, 50000000);
      assert.equal(bbcaProfit.returnVal, 2000000);

      const profitDisplay = sandbox.formatReturnDisplay(bbcaProfit.returnVal, bbcaProfit.returnPct);
      assert.equal(profitDisplay.colorHex, '#10B981');
      assert.equal(profitDisplay.pctText, '+4.17%');

      // BTC: 0.005 unit, modal 7,500,000. At price 1,400,000,000 => current 7,000,000 => return -500,000 (-6.67%)
      const btcLoss = sandbox.computeAssetSummary('BTC/IDR', invs, 1400000000);
      assert.equal(btcLoss.totalQty, 0.005);
      assert.equal(btcLoss.currentVal, 7000000);
      assert.equal(btcLoss.returnVal, -500000);

      const lossDisplay = sandbox.formatReturnDisplay(btcLoss.returnVal, btcLoss.returnPct);
      assert.equal(lossDisplay.colorHex, '#EF4444');
      assert.equal(lossDisplay.pctText, '-6.67%'); // MUST NOT be --6.67%!
      assert.ok(!lossDisplay.pctText.startsWith('--'));
    });

    it('renders lembar label for BBCA/IDR and unit label for BTC/IDR', () => {
      const { sandbox } = loadFrontendContext();
      const bbcaHtml = sandbox.createInvestItemHTML({
        saham: 'BBCA/IDR',
        lot: 5000,
        avgPrice: 9250,
        amount: 46250000,
        date: '2026-11-20',
        user: 'Kevin',
      });
      assert.ok(bbcaHtml.includes('lembar'));
      assert.ok(!bbcaHtml.includes('lot @'));

      const btcHtml = sandbox.createInvestItemHTML({
        saham: 'BTC/IDR',
        lot: 0.005,
        avgPrice: 1400000000,
        amount: 7000000,
        date: '2026-11-20',
        user: 'Vivie',
      });
      assert.ok(btcHtml.includes('unit'));
    });
  });

  describe('History Filtering, Manual Price Toast & Escaping', () => {
    it('filters history by user, month, category/saham, and search text', () => {
      const { sandbox } = loadFrontendContext();
      const txs = [
        { date: '2026-11-01', kategori: 'FOOD', keterangan: 'Bakmie GM', user: 'Kevin' },
        { date: '2026-11-05', kategori: 'TRAVEL', keterangan: 'Tiket Kereta', user: 'Vivie' },
        { date: '2026-10-12', kategori: 'FOOD', keterangan: 'Bakmie Ayam', user: 'Kevin' },
      ];
      const filtered = sandbox.filterHistoryItems(txs, 'sheet1', {
        user: 'Kevin',
        month: '2026-11',
        category: 'FOOD',
        search: 'bakmie',
      });
      assert.equal(filtered.length, 1);
      assert.equal(filtered[0].keterangan, 'Bakmie GM');
    });

    it('shows the actual asset code (not null) in toast when saving manual price', () => {
      const { sandbox, toasts, getEl } = loadFrontendContext();
      sandbox.openManualPriceEditor('BBCA/IDR');
      getEl('manual-price-input').value = '9.900';
      sandbox.saveManualPrice();

      assert.ok(toasts.some((t) => t.msg === 'Harga BBCA/IDR diperbarui!'));
      assert.ok(!toasts.some((t) => t.msg.includes('null')));
    });

    it('escapes HTML special characters including single quotes', () => {
      const { sandbox } = loadFrontendContext();
      assert.equal(
        sandbox.escapeHTML(`<script>'alert("x")' &</script>`),
        '&lt;script&gt;&#39;alert(&quot;x&quot;)&#39; &amp;&lt;/script&gt;'
      );
    });

    it('syncs Apps Script data and resets submit button text cleanly after Invest submission', async () => {
      const { sandbox, toasts, getEl } = loadFrontendContext();

      // Mock querySelector for radio inputs
      const txTypeExpense = createMockElement('tx-type-exp');
      txTypeExpense.value = 'Pengeluaran';
      const txTypeInvest = createMockElement('tx-type-inv');
      txTypeInvest.value = 'Invest';
      txTypeInvest.checked = true;
      const dateModeToday = createMockElement('date-today');
      dateModeToday.value = 'today';
      dateModeToday.checked = true;

      sandbox.document.querySelector = (sel) => {
        if (sel === 'input[name="tx-type"]:checked') return txTypeInvest.checked ? txTypeInvest : txTypeExpense;
        if (sel === 'input[name="tx-type"][value="Pengeluaran"]') {
          return {
            set checked(v) {
              txTypeExpense.checked = v;
              if (v) txTypeInvest.checked = false;
            },
            get checked() {
              return txTypeExpense.checked;
            },
          };
        }
        if (sel === 'input[name="tx-date-mode"]:checked') return dateModeToday;
        if (sel === 'input[name="tx-date-mode"][value="today"]') return dateModeToday;
        return null;
      };

      // Simulate server returning status: error on POST
      sandbox.fetch = async () => ({
        ok: true,
        json: async () => ({ status: 'error', message: 'Sheet terkunci' }),
      });

      vm.runInContext('currentUser = "Kevin";', sandbox);
      getEl('inv-kode').value = 'BBCA/IDR';
      getEl('inv-lot').value = '5000';
      getEl('inv-avg-price').value = '9.250';
      getEl('inv-note').value = 'ajaib';
      getEl('submit-btn-text').textContent = 'Simpan ke Sheet Invest';

      await sandbox.handleTransactionSubmit({ preventDefault() {} });

      // Must surface server error toast instead of false success
      assert.ok(toasts.some((t) => t.msg.includes('Sheet terkunci')));
      // Must reset radio to Pengeluaran and button text to "Simpan Pengeluaran" (not stay "Simpan ke Sheet Invest")
      assert.equal(getEl('submit-btn-text').textContent, 'Simpan Pengeluaran');
    });
  });

  describe('Fase 2 & Fase 3: Smart Bar, Budget Pulse, Goals & Financial Health', () => {
    it('parses Indonesian natural 1-line smart inputs into amount, description, category, and type', () => {
      const { sandbox } = loadFrontendContext();

      const kopi = sandbox.parseSmartTransactionLine('kopi kenangan 38k', 'Pengeluaran');
      assert.equal(kopi.amount, 38000);
      assert.equal(kopi.keterangan, 'kopi kenangan');
      assert.equal(kopi.detectedCategory, 'FOOD');

      const bensin = sandbox.parseSmartTransactionLine('bensin pertamax 150rb', 'Pengeluaran');
      assert.equal(bensin.amount, 150000);
      assert.equal(bensin.detectedCategory, 'TRAVEL');

      const gaji = sandbox.parseSmartTransactionLine('gaji bulanan 18.5jt', 'Pengeluaran');
      assert.equal(gaji.amount, 18500000);
      assert.equal(gaji.detectedType, 'Pemasukan');
      assert.equal(gaji.detectedCategory, 'GAJI');
    });

    it('creates new custom categories from searchable picker sheet isolated per transaction type', () => {
      const { sandbox } = loadFrontendContext();
      sandbox.addCategoryFromPicker('anabul');
      const expCats = sandbox.getAllAvailableCategories('Pengeluaran');
      const incCats = sandbox.getAllAvailableCategories('Pemasukan');
      assert.ok(expCats.includes('ANABUL'));
      assert.ok(!incCats.includes('ANABUL'));
    });

    it('computes Safe-to-Spend, burn-rate status, and CC monthly estimate accurately', () => {
      const { sandbox } = loadFrontendContext();
      const txs = [
        { date: '2026-11-05', type: 'Pengeluaran', amount: 2500000, kategori: 'FOOD', user: 'Kevin' },
        { date: '2026-11-10', type: 'Pengeluaran', amount: 1500000, kategori: 'LIFE', user: 'Vivie' },
        { date: '2026-11-12', type: 'Pengeluaran', amount: 850000, kategori: 'CC', user: 'Kevin' },
        { date: '2026-10-20', type: 'Pengeluaran', amount: 900000, kategori: 'FOOD', user: 'Kevin' },
      ];
      const budgets = [
        { kategori: 'FOOD', limit: 3500000 },
        { kategori: 'LIFE', limit: 3000000 },
      ];

      // Ref date: 2026-11-20 => 30 days in Nov, 11 days remaining (20..30 inclusive)
      const pulse = sandbox.computeBudgetPulse(txs, budgets, '2026-11-20');
      assert.equal(pulse.totalLimit, 6500000);
      assert.equal(pulse.totalSpent, 4000000);
      assert.equal(pulse.remaining, 2500000);
      assert.equal(pulse.daysRemaining, 11);
      assert.equal(pulse.safePerDay, Math.floor(2500000 / 11));
      assert.equal(pulse.ccThisMonth, 850000);
      assert.equal(pulse.status, 'ontrack');
    });

    it('computes Goals summary, Financial Health ratios, and couple logging streak', () => {
      const { sandbox } = loadFrontendContext();
      const goalsSum = sandbox.computeGoalsSummary([
        { id: 'G1', nama: 'Dana Darurat', target: 60000000, terkumpul: 30000000 },
        { id: 'G2', nama: 'Liburan', target: 20000000, terkumpul: 10000000 },
      ]);
      assert.equal(goalsSum.totalSaved, 40000000);
      assert.equal(goalsSum.totalTarget, 80000000);
      assert.equal(goalsSum.overallPct, 50);

      const txs = [
        { date: '2026-11-18', type: 'Pemasukan', amount: 20000000, kategori: 'GAJI', user: 'Kevin' },
        { date: '2026-11-19', type: 'Pengeluaran', amount: 6000000, kategori: 'FOOD', user: 'Kevin' },
        { date: '2026-11-20', type: 'Pengeluaran', amount: 4000000, kategori: 'LIFE', user: 'Vivie' },
      ];
      const invs = [
        { date: '2026-11-20', saham: 'BBCA/IDR', lot: 500, avgPrice: 10000, amount: 5000000 },
      ];
      const health = sandbox.computeFinancialHealth(txs, invs, { 'BBCA/IDR': 10400, 'BTC/IDR': 0 }, '2026-11');
      assert.equal(health.savingRate, 50);
      assert.equal(health.investRatio, 25);
      assert.equal(health.totalInvestValue, 5200000);
      assert.equal(health.emergencyTarget6x, 60000000);
      assert.equal(health.coupleStats.kevinAmt, 6000000);
      assert.equal(health.coupleStats.vivieAmt, 4000000);

      const streak = sandbox.computeLoggingStreak(txs, invs, '2026-11-20');
      assert.equal(streak, 3);
    });
  });
});
