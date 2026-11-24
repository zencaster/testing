# Project State — Finansialku (KV Finance & Invest)

Aplikasi web mobile-first (`max-width: 430px`) untuk pencatatan keuangan rumah tangga dan pemantauan portofolio investasi untuk 2 pengguna (**Kevin** & **Vivie**), dengan penyimpanan Google Sheets dan deployment statis melalui **GitHub → Vercel**.

## Tech Stack
- **Frontend:** Single-file static HTML/CSS/JS (`index.html`), Chart.js, mobile-first UI (`max-width: 430px`)
- **Backend Bridge:** Google Apps Script Web App (`apps-script/Code.gs`) + fallback read via Google Sheets Visualization API (`gviz`)
- **Database:** Google Spreadsheet (`18hYx94mb6zrObubgV4nZ8D-u83mYPNXXNBBfaPyAbxI` — sheets `Planner`/`Sheet1`, `Invest`, `Users`, `Budget`, `Goals`)
- **Testing:** Node.js native test runner (`npm test` → `node --test tests/*.test.js`)
- **Deployment:** Static hosting via GitHub → Vercel (Framework Preset: *Other*, tanpa build command)
- **Antigravity Skills & Plugins:** Menggunakan konfigurasi **Global** (`C:\Users\User\.gemini\config\skills` → Junction ke `G:\My Drive\Gemini AG\skills`, 37 skills + 7 plugins + global `GEMINI.md`), aktif otomatis tanpa duplikasi lokal di repo.

## Current Progress
- **Selesai:**
  - Implementasi Fase 1–3 pada `index.html` & `apps-script/Code.gs` (sesuai `docs/PRD.md`):
    - Autentikasi via sheet `Users` (`login` & `changePassword`, tanpa kredensial hardcoded di HTML).
    - **Tab 1 (Catat Transaksi):** Smart Bar 1 baris, Searchable Category Picker terpisah per tipe, input `Invest` (`BBCA/IDR` per lembar, `BTC/IDR` per unit desimal).
    - **Tab 2 (Budget & Target Bersama):** Safe-to-Spend Hero, 30-Day Pacing Strip, Amplop Budget per kategori, Shared Goals + auto Dana Darurat 6×.
    - **Tab 3 (Laporan & Aset):** 3 halaman terpisah (Bulanan & Kesehatan Finansial, Report Kategori, Value Investment Today + harga live/edit manual).
    - **Tab 4 (Riwayat Data):** Filter bulan, kategori/saham, user, dan pencarian teks.
  - Unit test terverifikasi lulus **41/41 tests (17 suites)** via `node --test tests/*.test.js` (24 Nov 2026).
  - Inisialisasi Git lokal (branch `main`), `.gitignore`, `state.md`, konfigurasi global Git (`zencaster <kevinzencaster@gmail.com>`), dan initial commit (24 Nov 2026).
- **Belum Selesai:**
  - Penghubungan remote GitHub & deployment Vercel.

## Key Decisions & Constraints
- **Keamanan Autentikasi:** Tidak ada username/password yang disimpan di HTML publik; `doGet` tidak pernah mengembalikan sheet `Users`; password tidak pernah disimpan di `localStorage`.
- **Kontrak POST Bebas CORS:** Request `POST` ke Apps Script memakai `Content-Type: text/plain;charset=utf-8` dengan key kanonik (`tanggal`, `nominal`, `avgBuy`) dan alias kompatibilitas (`date`, `amount`, `avgPrice`).
- **Kalkulasi Investasi:** `BBCA/IDR` menggunakan satuan lembar langsung (tanpa pengali `×100`), `BTC/IDR` mendukung angka desimal (misal `0.005`).
- **Deploy Apps Script:** Setiap perubahan di `apps-script/Code.gs` wajib di-deploy sebagai *New version* di Apps Script (`Deploy > Manage deployments > Edit > Version: New version`).
- **Skill Management:** Seluruh skill terbaru dikelola di level global (`~/.gemini/config/skills`) agar selalu ter-update lintas project dan tidak ikut ter-push ke GitHub/Vercel.

## Next Steps
1. Hubungkan repository lokal ke remote GitHub (`git remote add origin <url> && git push -u origin main`) untuk deploy ke Vercel.
2. (Opsional) Pindahkan project ke `G:\My Drive\Gemini AG\Projects\Finansialku` dengan Junction di `C:\Users\User\.gemini\Finansialku` jika ingin sinkronisasi lintas PC via Google Drive.
3. Lanjutkan pengembangan fitur, polish UI/UX, atau audit keamanan menggunakan skill global yang sudah aktif (`impeccable`, `emil-design-eng`, `vibesec`, `playwright-skill`, `lean-qa-testcase`, dll.).
