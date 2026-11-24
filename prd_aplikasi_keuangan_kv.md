# Product Requirements Document (PRD)
## Aplikasi Pencatatan Keuangan Rumah Tangga — KV Finance (Kevin & Vivie)

**Versi Dokumen:** 1.0  
**Tanggal:** 20 November 2026  
**Target Deployment:** GitHub Repository $\rightarrow$ Vercel (Static Web Hosting)  
**Database / Penyimpanan:** Google Sheets (`18hYx94mb6zrObubgV4nZ8D-u83mYPNXXNBBfaPyAbxI`) via Google Apps Script Web App  

---

## 1. Ringkasan Produk (Product Overview)
**KV Finance** adalah aplikasi web berbasis *mobile-first* (tampilan khusus layar ponsel) yang dirancang khusus untuk **Kevin** dan **Vivie** dalam mencatat arus kas harian (Pengeluaran dan Pemasukan) secara cepat, praktis, dan terpusat. Setiap transaksi yang disimpan akan langsung ditambahkan ke baris paling bawah pada Google Spreadsheet bersama, serta ditampilkan secara visual dalam bentuk laporan bulanan dan laporan per kategori.

### Tujuan Utama
1. Mempermudah pencatatan transaksi harian dari ponsel kapan saja tanpa harus membuka aplikasi spreadsheet secara manual.
2. Menyimpan seluruh riwayat transaksi secara otomatis ke baris paling bawah di Google Sheet target.
3. Menyediakan laporan visual (*Dashboard*) untuk memantau perbandingan **Pengeluaran vs Pemasukan per bulan** serta **distribusi berdasarkan kategori**.

---

## 2. Target Pengguna & Autentikasi (User & Login)
Aplikasi menggunakan sistem autentikasi sederhana khusus untuk dua akun pengguna:

| Username | Password | Role / Identitas Pencatat |
| :--- | :--- | :--- |
| `Kevin` | `Kevin` | Suami (Tercatat otomatis pada kolom `User`) |
| `Vivie` | `Vivie` | Istri (Tercatat otomatis pada kolom `User`) |

### Aturan Autentikasi
- Halaman awal menampilkan layar **Login** dengan input `Username` dan `Password`.
- Sesi login disimpan di browser (`localStorage`) agar pengguna tidak perlu login berulang kali setiap membuka aplikasi dari *Home Screen* ponsel.
- Tersedia tombol **Keluar (Logout)** di bagian header untuk berganti akun.

---

## 3. Spesifikasi Fitur Utama (Functional Requirements)

### 3.1. Tab Input Transaksi
Halaman utama setelah login yang dioptimalkan untuk pengisian cepat dengan satu tangan (*thumb-friendly*):

1. **Type (Jenis Transaksi)**
   - Komponen: **Radio Button** visual (Segmented Control).
   - Pilihan: `Pengeluaran` dan `Pemasukan`.
   - Default: **`Pengeluaran`** terpilih secara otomatis.
2. **Nominal (Jumlah Uang)**
   - Komponen: Input angka dengan pemisah ribuan otomatis format Rupiah (contoh: `150.000`) serta tombol cepat (`+50rb`, `+100rb`, `+500rb`).
3. **Tanggal Transaksi**
   - Komponen: Date Picker (`YYYY-MM-DD`), default otomatis ke tanggal hari ini.
4. **Keterangan**
   - Komponen: *Free text input* untuk detail transaksi (contoh: `Makan siang`, `Belanja bulanan`, `Gaji bulanan`).
5. **Kategori**
   - Komponen: Pilihan dari daftar kategori yang sudah ada (diambil dari riwayat Google Sheet + daftar kategori bawaan) **DAN** opsi **"+ Tambah Kategori Baru"**.
   - Jika pengguna menambahkan kategori baru, kategori tersebut langsung tersimpan ke daftar pilihan dan ikut tercatat ke Google Sheet saat transaksi disimpan.
6. **Penyimpanan ke Google Sheet**
   - Saat tombol **Simpan Transaksi** ditekan, data dikirim ke Google Apps Script dan ditambahkan ke **baris paling bawah** pada Google Sheet target.

### 3.2. Tab Dashboard (Laporan & Analitik)
Halaman pelaporan visual interaktif yang membaca data dari Google Sheet:

1. **Kartu Ringkasan (Summary Cards)**
   - Menampilkan **Total Pemasukan**, **Total Pengeluaran**, dan **Selisih (Cashflow Bersih)** berdasarkan filter periode yang dipilih (`Semua Waktu` atau per `Bulan`).
2. **Report 1: Bulanan Pengeluaran vs Pemasukan**
   - Visualisasi grafik batang berdampingan (*Grouped Bar Chart*) yang membandingkan total **Pemasukan** (hijau) dan **Pengeluaran** (merah/rose) setiap bulan.
   - Dilengkapi rincian angka bulanan (Pemasukan, Pengeluaran, dan Selisih) di bawah grafik.
3. **Report 2: Laporan Berdasarkan Kategori**
   - Dapat difilter berdasarkan jenis transaksi (**Pengeluaran** atau **Pemasukan**).
   - Visualisasi grafik donat (*Doughnut Chart*) beserta daftar peringkat kategori lengkap dengan nominal, jumlah transaksi, dan persentase terhadap total.

### 3.3. Tab Riwayat & Pengaturan Sinkronisasi
- Menampilkan daftar transaksi terbaru lengkap dengan informasi pencatat (`Kevin` atau `Vivie`), tanggal, kategori, keterangan, dan nominal.
- Tersedia menu pengaturan URL **Google Apps Script Web App** untuk menghubungkan aplikasi ke Google Sheet secara *real-time*.

---

## 4. Arsitektur & Struktur Data Google Sheet

### Target Google Spreadsheet
- **URL Sheet:** `https://docs.google.com/spreadsheets/d/18hYx94mb6zrObubgV4nZ8D-u83mYPNXXNBBfaPyAbxI/edit?gid=0#gid=0`
- **Spreadsheet ID:** `18hYx94mb6zrObubgV4nZ8D-u83mYPNXXNBBfaPyAbxI`

### Struktur Kolom pada Tab Pertama (`gid=0`)
Baris ke-1 digunakan sebagai *Header* kolom secara otomatis oleh script:

| Kolom | Nama Header | Tipe Data | Keterangan |
| :--- | :--- | :--- | :--- |
| **A** | `Tanggal` | Date (`YYYY-MM-DD`) | Tanggal transaksi |
| **B** | `Type` | String | `Pengeluaran` atau `Pemasukan` |
| **C** | `Nominal` | Number | Nilai angka murni tanpa titik/koma |
| **D** | `Keterangan` | String | Deskripsi transaksi (*free text*) |
| **E** | `Kategori` | String | Nama kategori (existing atau baru) |
| **F** | `User` | String | `Kevin` atau `Vivie` |
| **G** | `Timestamp` | DateTime | Waktu input tercatat oleh sistem |

---

## 5. Spesifikasi Teknis & Deployment

### Tech Stack
- **Frontend:** Single-file HTML5 (`index.html`), Tailwind CSS (CDN), Chart.js (CDN), Vanilla JavaScript (ES6+).
- **Design Constraint:** Mobile-first container (`max-width: 430px`, centered viewport), responsif untuk iOS Safari dan Android Chrome.
- **Backend Bridge:** Google Apps Script (`doGet` & `doPost`) yang di-deploy sebagai *Web App*.
- **Hosting:** GitHub Repository terhubung ke **Vercel** (otomatis deploy setiap kali `git push`).

### Kode Google Apps Script (`Code.gs`)
Tempelkan kode berikut pada menu **Extensions > Apps Script** di Google Sheet Anda:

```javascript
const SHEET_ID = '18hYx94mb6zrObubgV4nZ8D-u83mYPNXXNBBfaPyAbxI';

function getTargetSheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheets()[0]; // Mengambil sheet pertama (gid=0)
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Tanggal', 'Type', 'Nominal', 'Keterangan', 'Kategori', 'User', 'Timestamp']);
  }
  return sheet;
}

function doGet(e) {
  try {
    const sheet = getTargetSheet();
    const data = sheet.getDataRange().getValues();
    const rows = [];

    for (let i = 1; i < data.length; i++) {
      if (!data[i][0] && !data[i][2]) continue;
      let dateVal = data[i][0];
      if (dateVal instanceof Date) {
        dateVal = Utilities.formatDate(dateVal, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      }
      rows.push({
        tanggal: String(dateVal),
        type: String(data[i][1] || 'Pengeluaran'),
        nominal: Number(data[i][2]) || 0,
        keterangan: String(data[i][3] || ''),
        kategori: String(data[i][4] || 'OTHER'),
        user: String(data[i][5] || ''),
        timestamp: String(data[i][6] || '')
      });
    }

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'success', data: rows }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    const sheet = getTargetSheet();
    const payload = JSON.parse(e.postData.contents);

    const tanggal = payload.tanggal || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    const type = payload.type || 'Pengeluaran';
    const nominal = Number(payload.nominal) || 0;
    const keterangan = payload.keterangan || '';
    const kategori = payload.kategori || 'OTHER';
    const user = payload.user || 'Kevin';
    const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');

    // Menambahkan data ke baris paling bawah
    sheet.appendRow([tanggal, type, nominal, keterangan, kategori, user, timestamp]);

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'success', message: 'Data berhasil ditambahkan' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

### Langkah Deployment
1. **Setup Google Apps Script:**
   - Buka Google Sheet target $\rightarrow$ klik **Extensions** $\rightarrow$ **Apps Script**.
   - Hapus kode default, tempel kode `Code.gs` di atas, lalu klik **Save**.
   - Klik **Deploy** $\rightarrow$ **New deployment** $\rightarrow$ pilih jenis **Web app**.
   - Isi *Execute as*: **Me**, *Who has access*: **Anyone** $\rightarrow$ klik **Deploy** dan salin **Web App URL**.
2. **Konfigurasi & Push ke GitHub:**
   - Masukkan **Web App URL** ke variabel `DEFAULT_SCRIPT_URL` di dalam file `index.html` (atau tempel langsung di menu Pengaturan dalam aplikasi).
   - Buat repository baru di GitHub dan unggah file `index.html` (serta `PRD.md`).
3. **Deploy ke Vercel:**
   - Login ke [vercel.com](https://vercel.com) $\rightarrow$ **Add New Project** $\rightarrow$ pilih repository GitHub tersebut $\rightarrow$ klik **Deploy**.