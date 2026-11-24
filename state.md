# Project State — Finansialku (KV Finance & Invest)

Aplikasi web mobile-first (`max-width: 430px`) untuk pencatatan keuangan rumah tangga dan pemantauan portofolio investasi untuk 2 pengguna (**Kevin** & **Vivie**), dengan penyimpanan Google Sheets dan deployment statis melalui **GitHub → Vercel**.

## Tech Stack
- **Frontend:** Single-file static HTML/CSS/JS (`index.html`), Chart.js, mobile-first UI (`max-width: 430px`)
- **Market Price API:** Vercel Serverless Function (`api/prices.mjs` → `/api/prices`, Yahoo Finance `BBCA.JK` + Indodax/Coinbase/CoinGecko `BTC/IDR`) dengan fallback Apps Script & client-side API
- **Backend Bridge:** Google Apps Script Web App (`apps-script/Code.gs`) + fallback read via Google Sheets Visualization API (`gviz`)
- **Database:** Google Spreadsheet (`18hYx94mb6zrObubgV4nZ8D-u83mYPNXXNBBfaPyAbxI` — sheets `Planner`/`Sheet1`, `Invest`, `Users`, `Budget`, `Goals`)
- **Testing:** Node.js native test runner (`npm test` → `node --test tests/*.test.js`)
- **Deployment:** Static hosting via GitHub → Vercel (Framework Preset: *Other*, tanpa build command)
- **Antigravity Skills & Plugins:** Menggunakan konfigurasi **Global** (`C:\Users\User\.gemini\config\skills` → Junction ke `G:\My Drive\Gemini AG\skills`, 37 skills + 7 plugins + global `GEMINI.md`), aktif otomatis tanpa duplikasi lokal di repo.

## Current Progress
- **Selesai:**
  - Implementasi Fase 1–3 pada `index.html` & `apps-script/Code.gs` (sesuai `docs/PRD.md`):
    - Autentikasi via sheet `Users` (`login` & `changePassword`, tanpa kredensial hardcoded maupun template `Code.gs` tertanam di HTML).
    - **UI/UX Full Overhaul & Hardening (24 Nov 2026):**
      - **Edit & Hapus Transaksi/Investasi di dalam app** (tap baris riwayat → bottom sheet edit/hapus) + **Undo 5 detik** pada toast + endpoint `updateTransaction`, `deleteTransaction`, `updateInvestment`, `deleteInvestment` di `apps-script/Code.gs`.
      - **Antrean Sync Offline (`kv_v6_pending_ops`)** dengan badge `"Menunggu Sync"` & flush otomatis sebelum menarik data server agar catatan offline tidak pernah terhapus saat sync.
      - **Tab 1 (Catat):** Dipadatkan sehingga seluruh form inti + `Simpan Pengeluaran` pas di atas lipatan layar `390×844` tanpa scroll; Smart Bar mendukung kuantitas (`"kopi 2 gelas 35k"` → `Rp 35.000`) + aksi `Simpan ↵` inline; 1 baris chip kategori non-wrapping + hint sisa budget; pil tanggal ringkas.
      - **Header & Pengaturan:** Hapus 674 baris `<textarea id="appsScriptTemplate">` dari `index.html`; 3 ikon header disatukan ke 1 menu Akun & Pengaturan (`≥44×44px`) dengan konfirmasi Logout & Pengaturan Koneksi terlipat.
      - **Tab 2 (Budget & Target):** Tombol **Edit** pada kartu Goal, konfirmasi hapus Goal & Budget (plus Undo 5 detik), legenda strip 30 hari, prioritas peringatan kategori terparah.
      - **Tab 3 (Laporan & Aset) & Tab 4 (Riwayat):** Default filter ke bulan berjalan, hapus paginasi bawah & duplikasi list Invest, perbaiki `Aktivitas Pasangan` & wrapping nominal `Rp`, sort Tab 4 deterministik `date DESC, timestamp DESC`, tambah ringkasan total filter & tombol `Reset`.
      - **Aksesibilitas & Tipografi:** Beralih ke `IBM Plex Sans`, kontras WCAG AA (`≥4.5:1` termasuk placeholder & angka profit `#047857`), seluruh touch target `≥44×44px`, aktifkan pinch-zoom, `Esc`/backdrop dismiss modal, dan inline SVG favicon.
  - Unit test terverifikasi lulus **49/49 tests (19 suites)** via `node --test tests/*.test.js` (24 Nov 2026).
  - Remote GitHub terhubung ke `https://github.com/zencaster/testing` (branch `main`) untuk preview langsung di Vercel.
- **Belum Selesai:**
  - Deploy versi baru `apps-script/Code.gs` di Google Apps Script Editor agar endpoint `updateTransaction` / `deleteTransaction` / `updateInvestment` / `deleteInvestment` aktif di server.

## Key Decisions & Constraints
- **Keamanan Autentikasi & Kebersihan HTML:** Tidak ada username/password atau kode backend `Code.gs` yang disimpan di `index.html` publik; `doGet` tidak pernah mengembalikan sheet `Users`; password tidak pernah disimpan di `localStorage`.
- **Kontrak POST Bebas CORS:** Request `POST` ke Apps Script memakai `Content-Type: text/plain;charset=utf-8` dengan key kanonik (`tanggal`, `nominal`, `avgBuy`) dan alias kompatibilitas (`date`, `amount`, `avgPrice`).
- **Kalkulasi Investasi:** `BBCA/IDR` menggunakan satuan lembar langsung (tanpa pengali `×100`), `BTC/IDR` mendukung angka desimal (misal `0.005`).
- **Deploy Apps Script:** Setiap perubahan di `apps-script/Code.gs` wajib di-deploy sebagai *New version* di Apps Script (`Deploy > Manage deployments > Edit > Version: New version`).
- **Skill Management:** Seluruh skill terbaru dikelola di level global (`~/.gemini/config/skills`) agar selalu ter-update lintas project dan tidak ikut ter-push ke GitHub/Vercel.

## Next Steps
1. Deploy *New version* dari `apps-script/Code.gs` di Google Apps Script Editor agar fitur Edit & Hapus di app langsung tersinkron ke Google Sheet.
2. Cek hasil tampilan & interaksi terbaru langsung di preview Vercel setelah push ke `https://github.com/zencaster/testing`.
3. Jalankan ulang `/impeccable critique` kapan saja setelah review di Vercel untuk melihat kenaikan skor heuristik.
