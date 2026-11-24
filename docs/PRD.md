# Product Requirements Document (PRD) & Technical Handoff
## KV Finance & Invest — Aplikasi Pencatatan Keuangan & Portofolio Investasi Rumah Tangga

---

## 1. Ringkasan Proyek & Tujuan
Aplikasi web **mobile-first** (`max-width: 430px`) untuk pencatatan keuangan rumah tangga dan pemantauan portofolio investasi khusus untuk 2 pengguna (**Kevin** dan **Vivie**), dengan penyimpanan langsung ke Google Spreadsheet dan deployment statis melalui **GitHub → Vercel**.

- **Target Device:** Mobile View (`max-width: 430px`, centered viewport di desktop)
- **Target Hosting:** GitHub Repository terhubung ke Vercel (Single-file `index.html`)
- **Database Utama:** Google Spreadsheet ID `18hYx94mb6zrObubgV4nZ8D-u83mYPNXXNBBfaPyAbxI`
- **Backend Bridge:** Google Apps Script Web App (`apps-script/Code.gs`) + Fallback Read via Google Sheets Visualization API (`gviz`)
- **Published Web App URL:** `https://script.google.com/macros/s/AKfycbyE5U_RkaYU6AeXpzogGbeRbKo7SFbkdvQiN5dnUXxZWaMUqBTS4LsEskjCO_1ZNmYK/exec`

---

## 2. Autentikasi & Hak Akses
Aplikasi menggunakan autentikasi berbasis **Google Sheet `Users`** melalui Google Apps Script (`POST action: "login"` & `action: "changePassword"`). **Tidak ada username/password yang disimpan di kode HTML publik.**

- Validasi **username** bersifat *case-insensitive*, sedangkan **password** bersifat *case-sensitive* dan disimpan sebagai teks biasa di sheet `Users` (format sel teks `@` agar angka dengan nol di depan seperti `001234` tidak terpotong).
- Jika sheet `Users` belum ada/kosong saat pertama diakses, Apps Script otomatis membuatnya dengan akun awal:

| User | Username Awal | Password Awal | Badge Warna |
| :--- | :--- | :--- | :--- |
| **Kevin** | `Kevin` | `Kevin` | Indigo (`#6366F1`) |
| **Vivie** | `Vivie` | `Vivie` | Pink (`#EC4899`) |

- Pengguna dapat langsung mengganti password dari dalam aplikasi lewat tombol **Ganti Password** (ikon kunci di header) dengan verifikasi password lama.
- Sesi aktif disimpan di `localStorage` (`kv_finance_user` & `kv_finance_user_badge`) tanpa pernah menyimpan password di browser.
- Endpoint `doGet` tidak pernah mengembalikan data sheet `Users`.

---

## 3. Spesifikasi Fitur Utama

### A. Tab 1: Catat Transaksi (Swiss Minimal • Smart Bar + Searchable Picker)
Terdapat mini banner **Aman Hari Ini** (*Safe-to-Spend*) di bagian atas + 3 pilihan **Type** (*segmented radio*):

1. **Type = `Pengeluaran` atau `Pemasukan` → Masuk ke baris paling bawah `Planner` (fallback `Sheet1`)**
   - **Ketik Cepat 1 Baris (Smart Bar):** Mendukung input natural seperti `kopi kenangan 38k`, `bensin 150rb`, atau `gaji 18.5jt` yang otomatis mengisi nominal, keterangan, serta menebak kategori/tipe.
   - **Nominal (Rp):** Input numerik dengan pemisah ribuan otomatis + tombol cepat (`+10rb`, `+50rb`, `+100rb`, `Reset`).
   - **Keterangan:** *Free text* deskripsi transaksi.
   - **Kategori:** Menampilkan 5 kategori paling sering dipakai + **Searchable Category Picker Sheet** (`Semua / + Baru`) untuk mencari seluruh kategori sekaligus membuat kategori baru dalam 1 ketukan (terpisah per tipe transaksi).
   - **Tanggal Transaksi:** Opsi `Hari Ini` (otomatis WIB `YYYY-MM-DD`) atau `Custom` (*date picker*).

2. **Type = `Invest` → Masuk ke baris paling bawah sheet `Invest`**
   - **Kode Invest / Saham:** Pilihan radio button **`BBCA/IDR`** (IDX, satuan **Lembar**) atau **`BTC/IDR`** (Crypto, satuan **Unit**).
   - **Jumlah Lembar / Unit (`Lot lembar` di sheet):** Nilai jumlah lembar/unit yang dibeli secara langsung (mendukung desimal, misal `5000` lembar atau `0.005` BTC).
   - **Price When Buy / Average Buy:** Harga beli per lembar/unit dalam Rupiah.
   - **Kalkulasi Otomatis:** `Total Modal (Amount) = Jumlah Lembar/Unit × Average Buy` (tanpa pengali ×100).
   - **Keterangan / Platform (Opsional):** *Free text* (contoh: `ajaib`, `bibit`, `binance`).
   - **Tanggal Transaksi:** `Hari Ini` atau `Custom` (*date picker*).

---

### B. Tab 2: Budget & Target Bersama (Fase 2 & Fase 3)
Memiliki 2 sub-tampilan:
1. **Budget Bulanan:**
   - **Safe-to-Spend Hero:** Menghitung batas pengeluaran harian aman (`Sisa Budget / Sisa Hari di Bulan Berjalan`) + **30-Day Tactile Pacing Strip** untuk membandingkan posisi tanggal vs kecepatan belanja.
   - **Amplop Budget per Kategori:** Tap kategori untuk menyesuaikan limit (`±250rb`) atau tambah limit kategori baru (tersimpan di sheet `Budget` dengan fallback `localStorage`).
   - **Estimasi Tagihan CC Bulan Ini** + **Ringkasan 7 Hari Terakhir** (perbandingan otomatis vs 7 hari sebelumnya).
2. **Target Bersama (Shared Goals):**
   - Kartu target dengan *circular SVG progress ring*, quick top-up (`+500rb` / `+1jt`), hapus target, serta tombol **Isi Otomatis Dana Darurat (6× rata-rata pengeluaran)** (tersimpan di sheet `Goals` dengan fallback `localStorage`).

---

### C. Tab 3: Laporan & Aset (Paginasi 3 Halaman Terpisah)
Dashboard dipisah menjadi **3 halaman terpisah** yang dapat diakses lewat *pill tabs* di bagian atas maupun tombol navigasi bawah (**‹ Sebelumnya | Halaman X / 3 | Berikutnya ›**):

1. **Halaman 1 — Bulanan & Kesehatan Finansial**
   - Filter periode bulan (`Semua Bulan` atau per bulan).
   - Kartu KPI: **Cashflow Bersih**, **Pemasukan**, **Pengeluaran**, serta strip **Kesehatan Finansial** (*Estimasi Net Worth*, *Saving Rate %*, *Rasio Investasi %*, *Target Dana Darurat 6×*, dan bar aktivitas pasangan Kevin vs Vivie).
   - Grafik batang perbandingan bulanan (`Chart.js`) + daftar rincian per bulan.

2. **Halaman 2 — Report Berdasarkan Kategori**
   - Filter periode bulan + toggle tipe (**Keluar** / **Masuk**).
   - Grafik *Doughnut* (`Chart.js`) + daftar rincian per kategori lengkap dengan jumlah transaksi, nominal total, dan persentase bar.

3. **Halaman 3 — Value Investment Today**
   - Ringkasan portofolio: **Nilai Hari Ini**, **Total Modal Beli**, dan **Total Return Portofolio**.
   - Kartu aset per instrumen (**`BBCA/IDR`** dan **`BTC/IDR`**) menampilkan:
     - **Total Lembar Dimiliki** (untuk `BBCA/IDR`) / **Total Unit Dimiliki** (untuk `BTC/IDR`)
     - **Average Price** (*weighted average*: `Total Modal / Total Lembar atau Unit`)
     - **Price Today** (diambil dari Apps Script Yahoo Finance / CoinGecko + fallback market API + opsi **Edit** manual jika pasar tutup)
     - **Return:** `(Price Today × Total Lembar/Unit) - (Average Price × Total Lembar/Unit)`
       - Jika **minus (< 0)** → warna **merah** (`#EF4444`)
       - Jika **plus (> 0)** → warna **hijau** (`#10B981`)

---

### D. Tab 4: Riwayat Data
- Sub-tab pemisah antara **Transaksi (`Planner`)** dan **Investasi (`Invest`)**.
- Pencarian teks (*search*), filter bulan, filter kategori/saham, filter user (`Semua`, `Kevin`, `Vivie`), serta tautan langsung ke Google Spreadsheet.

---

## 4. Struktur Database Google Sheets

Spreadsheet ID: `18hYx94mb6zrObubgV4nZ8D-u83mYPNXXNBBfaPyAbxI`

### Sheet 1: `Planner` (fallback `Sheet1`, `gid=0`) — Transaksi Pengeluaran & Pemasukan (7 Kolom `A:G`)
| Kolom | Header | Tipe | Keterangan |
| :--- | :--- | :--- | :--- |
| **A** | `Date` | String (`YYYY-MM-DD`) | Tanggal transaksi |
| **B** | `Type` | String | `Pengeluaran` atau `Pemasukan` |
| **C** | `Amount` | Number | Nominal transaksi (angka murni) |
| **D** | `Keterangan` | String | Deskripsi transaksi |
| **E** | `Kategori` | String | Nama kategori (UPPERCASE) |
| **F** | `user` | String | `Kevin` atau `Vivie` |
| **G** | `Timestamp` | String | Waktu input (`YYYY-MM-DD HH:mm:ss` WIB) |

### Sheet 2: `Invest` (`gid=2010394321`) — Transaksi Investasi (10 Kolom `A:J`)
| Kolom | Header | Tipe | Keterangan |
| :--- | :--- | :--- | :--- |
| **A** | `Date` | String (`YYYY-MM-DD`) | Tanggal transaksi investasi |
| **B** | `Type` | String | Selalu `'Invest'` |
| **C** | `Amount` | Number | Total modal beli (`Lot lembar × Average Buy`) |
| **D** | `Lot lembar` | Number | Jumlah lembar saham / unit kripto dibeli |
| **E** | `Average Buy` | Number | Harga beli rata-rata per lembar/unit |
| **F** | `Saham` | String | `BBCA/IDR` atau `BTC/IDR` |
| **G** | `Keterangan` | String | Catatan / platform investasi |
| **H** | `Kategori` | String | Default `'INVEST'` |
| **I** | `user` | String | `Kevin` atau `Vivie` |
| **J** | `Timestamp` | String | Waktu input (`YYYY-MM-DD HH:mm:ss` WIB) |

### Sheet 3: `Users` — Akun & Autentikasi Pengguna (4 Kolom `A:D`)
| Kolom | Header | Tipe | Keterangan |
| :--- | :--- | :--- | :--- |
| **A** | `Username` | String | Nama akun (unik, validasi *case-insensitive*) |
| **B** | `Password` | String (`@`) | Password teks biasa (validasi *case-sensitive*) |
| **C** | `BadgeColor` | String (Hex) | Warna avatar/badge (misal `#6366F1`, `#EC4899`) |
| **D** | `UpdatedAt` | String | Waktu terakhir pembuatan/ubah password WIB |

### Sheet 4: `Budget` — Limit Bulanan per Kategori (3 Kolom `A:C`, Auto-create)
| Kolom | Header | Tipe | Keterangan |
| :--- | :--- | :--- | :--- |
| **A** | `Kategori` | String | Nama kategori pengeluaran (UPPERCASE) |
| **B** | `LimitBulanan` | Number | Batas pengeluaran bulanan (Rp) |
| **C** | `UpdatedAt` | String | Waktu terakhir diubah WIB |

### Sheet 5: `Goals` — Target Bersama Rumah Tangga (6 Kolom `A:F`, Auto-create)
| Kolom | Header | Tipe | Keterangan |
| :--- | :--- | :--- | :--- |
| **A** | `GoalID` | String | ID unik target (`GOAL-...`) |
| **B** | `Nama` | String | Nama target (misal `Dana Darurat`) |
| **C** | `TargetRp` | Number | Nominal target akhir (Rp) |
| **D** | `TerkumpulRp` | Number | Dana yang sudah terkumpul (Rp) |
| **E** | `TargetDate` | String (`YYYY-MM-DD`) | Target tanggal opsional |
| **F** | `UpdatedAt` | String | Waktu terakhir diperbarui WIB |

---

## 5. Kontrak API & Deployment
- **Backend Source:** `apps-script/Code.gs`
- **Respons `GET`:** `{ status: 'success', data: [...], investments: [...], budgets: [...], goals: [...], prices: { 'BBCA/IDR', 'BTC/IDR', updatedAt } }` (mendukung `?refresh=1` untuk bypass cache harga 6 jam; tidak pernah mengembalikan sheet `Users`).
- **Request `POST`:** `Content-Type: text/plain;charset=utf-8` agar bebas CORS preflight:
  - Login: `{ action: 'login', username, password }` → `{ status: 'success', user: { username, badgeColor } }`
  - Ganti Password: `{ action: 'changePassword', username, currentPassword, newPassword }` → `{ status: 'success', message, updatedAt }`
  - Simpan Budget: `{ action: 'saveBudget', kategori, limit }` (limit `0` menghapus baris kategori) → `{ status: 'success', saved: [...] }`
  - Simpan/Update Target: `{ action: 'saveGoal', id, nama, target, terkumpul, targetDate }` → `{ status: 'success', goal: {...} }`
  - Hapus Target: `{ action: 'deleteGoal', id }` → `{ status: 'success', id }`
  - Edit / Hapus Transaksi: `{ action: 'updateTransaction', match, tanggal, type, nominal, keterangan, kategori, user }` / `{ action: 'deleteTransaction', match }` → `{ status: 'success', ... }`
  - Edit / Hapus Investasi: `{ action: 'updateInvestment', match, tanggal, saham, lot, avgBuy, amount, keterangan, user }` / `{ action: 'deleteInvestment', match }` → `{ status: 'success', ... }`
  - Simpan Transaksi / Investasi: mengirim key kanonik (`tanggal`, `nominal`, `avgBuy`) beserta alias kompatibilitas (`date`, `amount`, `avgPrice`).
- **Deploy Apps Script:** Setiap mengubah `Code.gs`, klik **Deploy > Manage deployments > Edit (pensil) > Version: New version > Deploy** (akses: *Anyone*).
- **Deploy Vercel:** Push ke repository GitHub → import di Vercel (Framework Preset: *Other*, tanpa build command).
