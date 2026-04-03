# Dashbord Hafazan al-Farabi

Dashboard ini direka untuk memaparkan pencapaian hafazan murid kelas `1AF`, `2AF` dan `3AF` dalam satu aplikasi PWA yang ringan. Carta bar memaparkan pelajar tertinggi setiap kelas manakala jadual dan kad-kad statistik memudahkan guru menilai kelas mana yang memerlukan perhatian segera.

## Jalankan dan semak

1. `npm install` – pasang keperluan `lit`, `shoelace` dan plugin PWA.
2. `npm run dev` – jalankan pelayan dev Vite pada `http://localhost:5173`.
3. `npm run build` – hasilkan binaan pengeluaran lengkap dan service worker Workbox.

## Sumber data Google Sheets

Dashboard menarik data terus dari Google Sheets menggunakan `gviz/tq?out:json`. Untuk menyediakan helaian hidup:

1. Buka Google Sheet dan pilih **File → Share → Anyone with the link**.
2. Pastikan helaian mengandungi panduan lajur berikut (sekali pun nama sebenar berbeza, anda boleh menentukannya dengan pembolehubah):
   - `Nama` atau `Nama Pelajar` – untuk nama murid.
   - `Kelas` – pastikan nilai seperti `1AF`, `2AF`, `3AF`.
   - `Peratus`, `Skor`, `Nilai`, `Ayat` atau mana-mana lajur nombor untuk diukur.
   - `Surah` / `Catatan` – boleh digunakan sebagai nota.
   - `Tarikh` / `Kemaskini` – tarikh kemaskini rekod.

3. Tambahkan fail `.env` di akar projek (tidak dimasukkan ke dalam Git) dengan pembolehubah:

```
VITE_HAFAZAN_SHEET_ID=<google-sheet-id>
VITE_HAFAZAN_SHEET_NAME=Rekod Hafazan      # optional
VITE_HAFAZAN_SHEET_RANGE=A1:F200           # optional
VITE_HAFAZAN_NAME_COLUMN=Nama
VITE_HAFAZAN_CLASS_COLUMN=Kelas
VITE_HAFAZAN_METRIC_COLUMN=Peratus
VITE_HAFAZAN_SUMMARY_COLUMN=Surah
VITE_HAFAZAN_UPDATED_COLUMN=Tarikh
VITE_HAFAZAN_SCRIPT_URL=https://script.google.com/macros/s/AKfycbx7y_x8u9moo2yp-TY-lVZpJLFufYGV-vLZy_iIu8WhyZqSKVZxYPC3dmzeI-wDj7Po/exec
```

> Jika `SHEET_ID` tidak disetel (atau anda menggunakan Google Apps Script), dashboard akan memaparkan data contoh tetapi masih boleh dibina.

### Alternatif: Google Apps Script

- Jika anda telah bina App Script (contohnya `https://script.google.com/macros/s/AKfycbx7y_x8u9moo2yp-TY-lVZpJLFufYGV-vLZy_iIu8WhyZqSKVZxYPC3dmzeI-wDj7Po/exec`) untuk membungkus helaian, hanya set `VITE_HAFAZAN_SCRIPT_URL` kepada URL tersebut.
- Skrip perlu mengembalikan JSON yang mengandungi senarai objek dengan medan nama (contoh `Nama`, `name`), `kelas`, `peratus`/`skor`, `surah`/`catatan`, dan `tarikh`/`kemaskini`. Dashboard akan cuba menyahkod nama medan menggunakan heuristik automatik.
- Semasa `VITE_HAFAZAN_SCRIPT_URL` diset, dashboard akan sentiasa memuatkan data daripada Apps Script tersebut dan mengabaikan `SHEET_ID`.

## Ciri PWA

- Service worker Workbox terpasang melalui `vite-plugin-pwa` dan `public/sw.js`.
- `manifest.json` kini menamakan aplikasi `Dashbord Hafazan al-Farabi` dengan tema warna biru laut.
- Aplikasi boleh dipasang pada peranti dan berjalan offline dengan versi terakhir yang dimuat turun.

## Untuk diterapkan

1. Sahkan data Google Sheet sudah dikongsi secara `Anyone with the link`.
2. Jalankan `npm run dev` dan buka `http://localhost:5173`.
3. Setelah selesai, gunakan `npm run build` untuk pengeluaran.

Jika anda memerlukan carta tambahan (contoh: garis masa hafazan), tambah komponen grafik ringan (SVG, custom canvas) ke `src/pages/app-home.ts`.
