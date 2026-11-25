# Tugas 9 - Autentikasi & Otorisasi

## Identitas

- Nama: **Muhammad Rifqy Habibi**
- NIM: **F1D02410080**
- Kasus ETS: **Bouquet Products REST API**, pengelolaan produk buket dan pesanan.
- Mata kuliah: Pemrograman Web Lanjut, Teknik Informatika Universitas Mataram.

Proyek ini merupakan salinan proyek ETS tanpa `.git` dan `node_modules` asal. Kode sumber proyek ETS asal tidak diubah. Database lokal ETS boleh dipakai bersama sesuai instruksi tugas: migrasi lama, tabel `products`, dan tabel `orders` tidak diubah; hanya tabel `users` ditambahkan. Pengujian transaksi dapat menambah pesanan demo dan mengurangi stok di database bersama.

Teknologi: Node.js 20+, Express 5, MySQL, Prisma 6.19, Joi, bcrypt, jsonwebtoken, dan dotenv. **Satu jenis pengguna, tanpa role.** Sesuai ketentuan tugas, GET produk dan relasi order tetap publik, berbeda dengan contoh pembagian role pada materi.

## Cara Menjalankan

### 1. Persiapan dan instalasi

Siapkan Node.js 20+, MySQL aktif (misalnya melalui Laragon), serta VS Code dengan ekstensi **REST Client** (`humao.rest-client`). Buka terminal di folder proyek.

> Di Windows, gunakan lokasi sederhana seperti `C:\Projects\T9-AUTENTIKASI`. Hindari karakter `&` pada path: beberapa launcher npm/Prisma dan install script native bcrypt gagal membaca path tersebut.

```powershell
npm install
Copy-Item .env.example .env
node -p "require('node:crypto').randomBytes(32).toString('hex')"
```

Isi `.env` lewat editor, bukan menempelkan secret ke akhir baris dengan `echo`. Contoh konfigurasi (ganti placeholder dengan konfigurasi lokal):

```dotenv
DATABASE_URL="mysql://USER:PASSWORD@localhost:3306/ets_pwl_rifqy"
PORT=3000
NODE_ENV=development
JWT_SECRET=HASIL_GENERATE_RANDOM_32_BYTE
```

Secret dibuat secara acak dan hanya disimpan di `.env`. File ini diabaikan oleh Git, sedangkan `.env.example` hanya berisi placeholder. Jangan memakai password akun pribadi untuk akun uji.

### 2. Database dan tabel users

Jika database belum ada, jalankan SQL berikut melalui phpMyAdmin menggunakan akun yang berhak membuat database:

```sql
CREATE DATABASE IF NOT EXISTS ets_pwl_rifqy
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Pastikan user pada `DATABASE_URL` mempunyai hak akses ke database tersebut. Lalu jalankan:

```powershell
npm run db:deploy
npm run prisma:generate
```

`migrate deploy` menerapkan migrasi yang belum diterapkan. Di database ETS lama, hanya `20261125140000_tambah_user` yang baru diterapkan; di database kosong, migrasi awal produk/pesanan diterapkan terlebih dahulu. Tidak ada reset database atau perubahan migrasi lama.

Tabel `users` mempunyai `id` (primary key auto increment), `email` (VARCHAR 100, unik), `passwordHash` (VARCHAR 100), dan `createdAt` (waktu pembuatan otomatis). Definisi SQL-nya tersedia di [migration.sql](prisma/migrations/20261125140000_tambah_user/migration.sql).

### 3. Jalankan API

```powershell
# Opsional: hanya mengisi produk demo ETS yang belum ada, bukan akun pengguna.
npm run db:seed
npm start
```

API berjalan di `http://localhost:3000`. Alternatif saat mengedit kode: `npm run dev` untuk memulai ulang otomatis. Server membutuhkan `DATABASE_URL` dan `JWT_SECRET` sebelum bisa berjalan.

**Tidak ada seeder akun pengguna.** Buat akun melalui `POST /auth/register` pada `requests.http`. Seed produk ETS bersifat opsional; request tambah produk tetap bisa diuji pada database tanpa seed.

### 4. Pengujian REST Client

1. Buka `requests.http`, lalu klik **Send Request** pada register. Hasil pertama `201`; jika akun sudah ada, hasilnya `409 EMAIL_DUPLIKAT`.
2. Kirim login. Variabel `@token` otomatis membaca `data.token` dari named request `login`; token tidak perlu disimpan permanen di file.
3. Kirim GET daftar produk tanpa header Authorization: `200`.
4. Kirim POST produk tanpa token: `401 TOKEN_DIPERLUKAN`.
5. Kirim POST produk dengan `Authorization: Bearer {{token}}`: `201`.

Untuk mengulang request 5, gunakan SKU baru atau hapus produk demo sebelumnya. Ubah `@id` ke ID produk hasil request 5 sebelum mencoba PUT/DELETE, **jangan memakai ID produk lama secara sembarang**. POST pesanan membutuhkan ID produk nyata dengan stok cukup dan akan mengurangi stok.

Respons sukses memakai pembungkus `data`, konsisten dengan proyek ETS dan Materi 9. Register mengirim `{ data: { id, email } }`, login mengirim `{ data: { token } }`, dan `/auth/saya` mengirim `{ data: { id, iat, exp } }` dari token yang telah diverifikasi.

## Akun Uji

| Email | Password demo | Cara dibuat |
|---|---|---|
| `rifqy.f1d02410080@unram.ac.id` | `Tugas9Rahasia!` | `POST /auth/register`, bukan seeder |

Alamat ini adalah identitas demo; API tidak mengirim email. Password di atas dibuat khusus tugas, bukan password email atau layanan lain. Database menyimpan hash bcrypt dengan cost 10, bukan teks password tersebut. `passwordHash` tidak pernah dipilih untuk respons register dan tidak dimasukkan ke JWT.

## Struktur Proyek

Keterangan: **[baru]** ditambahkan pada Tugas 9; **[ubah]** disesuaikan dari ETS; file lain diwarisi.

```text
src/
  app.js                       [ubah] memasang router /auth
  server.js                    [ubah] memeriksa konfigurasi JWT_SECRET
  controllers/
    auth.controller.js         [baru] mengirim respons register, login, dan saya
    product.controller.js             handler HTTP produk
    order.controller.js               handler HTTP pesanan
  data/
    user.data.js               [baru] query users; select register tanpa hash
    product.data.js                    query products
    order.data.js                      query orders dan operasi transaksi
  services/
    auth.service.js            [baru] hash, compare, konflik email, dan JWT 2 jam
    product.service.js                 aturan produk, filter, dan paginasi
    order.service.js                   transaksi pembuatan order dan pengurangan stok
  routes/
    auth.routes.js             [baru] register/login publik dan saya wajib login
    product.routes.js          [ubah] GET publik, POST/PUT/DELETE wajib login
    order.routes.js            [ubah] GET include publik, POST transaksi wajib login
  middleware/
    auth.js                    [baru] butuhLogin memverifikasi Bearer JWT
    validate.js                [ubah] mendukung 422 untuk input autentikasi
    errorHandler.js                    menyeragamkan error { error: { kode, pesan } }
    logger.js                          mencatat method, URL, dan status
  validators/
    auth.validator.js          [baru] Joi email/password dan batas byte bcrypt
    product.validator.js               aturan input produk, ID, dan query
    order.validator.js                 aturan input pesanan
  lib/prisma.js                        instance Prisma Client
  utils/AppError.js                    error dengan status, pesan, dan kode
prisma/
  schema.prisma                [ubah] menambah model User tanpa mengubah model ETS
  migrations/
    20261118000000_init/              migrasi ETS asli
    20261125140000_tambah_user/ [baru] migrasi tabel users
  seed.js                            seed produk ETS opsional, bukan users
test/
  api.integration.test.js      [ubah] autentikasi, CRUD, include, dan transaksi
  api.validation.test.js       [ubah] validasi, hash, JWT, dan penolakan akses
requests.http                  [ubah] request utama dan dua percobaan wajib
.env.example                   [ubah] contoh konfigurasi tanpa secret asli
package.json / package-lock.json [ubah] dependensi bcrypt dan jsonwebtoken
screenshot/                    [baru 13–18] bukti Tugas 9
docs/README-ETS.md                    arsip README sebelum autentikasi
```

Dokumen rekaman, koleksi Postman berlabel ETS, skrip lama, dan screenshot 01–12 adalah **arsip ETS**, bukan petunjuk autentikasi terbaru. Gunakan `requests.http`, README ini, dan screenshot 13–18 untuk Tugas 9.

## Endpoint

| Method | URL | Akses | Status utama |
|---|---|---|---|
| POST | `/auth/register` | Publik | 201; 409 `EMAIL_DUPLIKAT`; 422 `VALIDATION_ERROR` |
| POST | `/auth/login` | Publik | 200; 401 `LOGIN_GAGAL`; 422 `VALIDATION_ERROR` |
| GET | `/auth/saya` | Wajib login | 200; 401 |
| GET | `/products` | Publik | 200; query tidak valid 400 |
| GET | `/products/:id` | Publik | 200; 404; ID tidak valid 400 |
| POST | `/products` | Wajib login | 201; 400; 401; SKU duplikat 409 |
| PUT | `/products/:id` | Wajib login | 200; 400; 401; 404; 409 |
| DELETE | `/products/:id` | Wajib login | 204; 400; 401; 404; produk memiliki order 409 |
| GET | `/orders` | Publik | 200, beserta objek `product` melalui include |
| POST | `/orders` | Wajib login | 201; 400; 401; produk tidak ada 404; stok kurang 409 |

Validasi endpoint produk/pesanan tetap memakai `400` seperti ETS; khusus register/login memakai `422`. Joi mewajibkan email valid maksimal 100 karakter dan password string 8–72 karakter. Tambahan pemeriksaan UTF-8 menolak password yang panjangnya melebihi **72 byte**, karena batas bcrypt sebenarnya berupa byte; field tambahan seperti `role` juga ditolak.

Urutan route penulisan: **butuhLogin → validasi → controller → service → data**. Pengguna tanpa token ditolak sebelum validasi data, termasuk pada endpoint transaksi dua tabel. Middleware tidak dipasang pada GET publik.

Contoh error tanpa Authorization atau dengan skema bukan Bearer:

```json
{"error":{"kode":"TOKEN_DIPERLUKAN","pesan":"Token diperlukan"}}
```

Token rusak, signature salah, atau expired menghasilkan `401 TOKEN_TIDAK_VALID`. Login dengan email tidak terdaftar dan password salah sama-sama menghasilkan `401 LOGIN_GAGAL` dengan pesan persis **"Email atau password salah"**. Semua error dikirim melalui `AppError` dan error handler terpusat.

## Pengujian

Screenshot diambil dari phpMyAdmin dan REST Client pada API/MySQL lokal yang berjalan. NIM terlihat pada email, produk demo, atau nama request. Pada gambar perbandingan, **kiri = POST tanpa token (401)** dan **kanan = GET publik tanpa token (200)**.

### Hash password dalam database

![Tabel users di phpMyAdmin](screenshot/13-phpmyadmin-users.png)

Kolom `passwordHash` berisi hash berawalan `$2b$10$`, bukan password demo; email akun uji memuat NIM.

### Request 3 dan 4 berdampingan

![GET publik dan POST wajib login tanpa token](screenshot/14-rest-client-publik-vs-wajib-login.png)

GET daftar produk berhasil tanpa token, sedangkan POST produk ditolak `401 TOKEN_DIPERLUKAN`.

### Request 5 dengan token valid

![POST produk dengan token valid](screenshot/15-rest-client-tambah-dengan-token.png)

POST dengan token hasil login berhasil `201`, menghasilkan produk demo ber-NIM dengan ID 34 pada pengujian ini; ID pada instalasi lain dapat berbeda.

### requests.http di VS Code

![requests.http di VS Code](screenshot/18-requests-http-vscode.png)

File memuat variabel akun demo, pengambilan token dari respons login, request publik/terproteksi, dan request dua percobaan.

### Tes otomatis

Dengan MySQL aktif, migrasi sudah diterapkan, dan `.env` terisi:

```powershell
npm test
```

Hasil pengujian lokal: **15 tes lulus, 0 gagal, 0 dilewati** pada 25 November 2026.

Tes memeriksa register/duplikat, format validasi, batas password Unicode, hash cost 10, kesamaan pesan login gagal, klaim JWT dan masa berlaku 7.200 detik, signature palsu/expired, urutan autentikasi, CRUD, relasi include, dan transaksi stok bersamaan. Data sementara tes diberi identitas unik dan dibersihkan pada akhir tes; akun demo pada tabel di atas tidak dihapus. Pengujian memerlukan database lokal, bukan database produksi.

## Dua Percobaan

### Percobaan 1 — Token dipalsukan

1. Login untuk memperoleh token asli, lalu pecah token menjadi `header.payload.signature`.
2. Decode payload sebagai Base64URL, ubah `id` menjadi `999`, dan encode kembali tanpa mengetahui secret; header dan signature asli tidak diubah.
3. Isi `@tokenPalsu` pada `requests.http`, lalu kirim request **Percobaan 1** ke `/auth/saya`.

**Hasil:** `401 TOKEN_TIDAK_VALID`.

![Token dengan payload dipalsukan ditolak](screenshot/16-percobaan-token-dipalsukan.png)

Payload JWT hanya di-encode dengan Base64URL, bukan dienkripsi, sehingga siapa saja bisa membaca dan mengganti isinya. Namun signature dibuat dari header dan payload menggunakan secret server; ketika `id` diganti, signature lama tidak cocok lagi. `jwt.verify` menolak token itu, sedangkan `jwt.decode` saja tidak mampu membuktikan keasliannya.

### Percobaan 2 — Token expired

1. Ubah sementara `expiresIn: '2h'` menjadi `expiresIn: '5s'` pada `src/services/auth.service.js`, kemudian restart server.
2. Login lagi, simpan token baru ke `@tokenExpired`, tunggu **6 detik**, lalu kirim request **Percobaan 2** ke `/auth/saya`.
3. Kembalikan kode ke **`expiresIn: '2h'`** dan restart kembali sebelum commit.

**Hasil:** login `200`, setelah menunggu 6 detik request ditolak `401 TOKEN_TIDAK_VALID`. Screenshot berikut adalah pengiriman ulang token 5 detik yang sama melalui REST Client setelah kode dikembalikan ke `2h`; mengembalikan kode tidak memperpanjang umur token yang sudah diterbitkan.

![Token expired ditolak](screenshot/17-percobaan-token-expired.png)

Saat login, server memasukkan waktu kedaluwarsa ke klaim `exp`, dan nilai itu dilindungi signature bersama payload lainnya. `jwt.verify` membandingkan `exp` dengan waktu server sekarang sehingga token yang sudah lewat waktunya ditolak. Server tidak perlu menyimpan daftar token atau catatan sesi untuk melakukan pemeriksaan tersebut.

Nilai variabel token percobaan pada file final berupa placeholder. Buat token percobaan sendiri sesuai langkah di atas; token dari komputer lain tidak dapat dipakai untuk membuktikan expiry jika secret-nya berbeda.

## Deklarasi Penggunaan AI

Saya menggunakan OpenCode (GPT-6.1 Sol) sebagai alat bantu dalam memahami materi, menyusun kerangka kode, dan melakukan pengujian awal Tugas 9. Proyek dasar ETS juga menggunakan bantuan AI, seperti yang tercatat pada [README ETS](docs/README-ETS.md).

| Bagian | Alat AI | Dipakai untuk apa | Cara pemeriksaan hasil |
|---|---|---|---|
| Persiapan proyek | OpenCode | Membantu penyesuaian konfigurasi proyek | Menjalankan API dengan database lokal |
| Tabel `users` | OpenCode | Membantu penyusunan model Prisma dan migrasi | Memeriksa struktur tabel melalui MySQL dan phpMyAdmin |
| Register, login, dan `/auth/saya` | OpenCode | Membantu penyusunan kerangka kode autentikasi | Memeriksa kode dan menguji endpoint melalui REST Client |
| Middleware dan akses endpoint | OpenCode | Membantu penyusunan kerangka middleware `butuhLogin` | Menguji akses endpoint dengan dan tanpa token |
| Pengujian | OpenCode | Membantu penyusunan skenario dan pengujian awal program | Memeriksa respons API dan melakukan pengujian ulang |
| Percobaan JWT | OpenCode | Membantu memahami skenario pengujian token palsu dan expired | Memeriksa respons API dengan status 401 |

Contoh prompt yang digunakan:

> "bantu aku memahami tugas ini, berikut link tugasnya: https://pahrulirfan.github.io/pwl/tugas-09-autentikasi-otorisasi.html ini adalah materinya: https://pahrulirfan.github.io/pwl/materi-09-autentikasi-otorisasi.html"

**Pernyataan:** AI digunakan sebagai alat bantu dalam memahami materi, menyusun kerangka kode, dan melakukan pengujian awal program. Pemeriksaan kode, pengujian ulang, serta penyusunan dokumentasi akhir dilakukan secara mandiri untuk memastikan kesesuaian program dengan materi dan ketentuan tugas.

## Kesimpulan & Kendala

1. **Mengapa password di-hash, bukan dienkripsi?** Server hanya perlu memeriksa kecocokan password, bukan membacanya kembali. Hash bcrypt bersifat satu arah, memakai salt acak, dan sengaja lambat; enkripsi dapat dibalik jika kuncinya diketahui. Hash tetap dapat diserang dengan tebakan, tetapi salt dan cost factor membuat upayanya lebih mahal.
2. **Mengapa pesan login gagal dibuat sama?** Pesan yang berbeda dapat dipakai untuk menebak apakah sebuah email terdaftar. Pesan umum "Email atau password salah" mengurangi informasi yang bocor dari respons. Kesamaan pesan bukan jaminan waktu respons identik; pembatasan percobaan login masih diperlukan untuk penggunaan produksi.
3. **Apa beda endpoint publik dan wajib login, serta bagaimana token dinyatakan sah?** GET produk/detail dan GET order dengan include dapat dipakai tanpa identitas; POST/PUT/DELETE produk, POST transaksi order, dan GET saya membutuhkan Bearer token. Server memakai `jwt.verify` dengan secret untuk memeriksa signature serta `exp`, tanpa menyimpan token. Token valid merupakan syarat akses di proyek ini; tidak ada pembagian role atau kepemilikan per pengguna.
4. **Mengapa butuhLogin sebelum validasi?** Request tanpa hak akses harus ditolak lebih dulu. Body atau ID yang salah pada route penulisan tidak boleh membuat pengguna tanpa token melewati pemeriksaan autentikasi.

Kendala yang muncul dan penyelesaiannya:

- **MySQL belum aktif:** jalankan MySQL Laragon terlebih dahulu sebelum migrasi dan server API.
- **`migrate dev` gagal membuat shadow database:** user database dibatasi ke database ETS. Solusinya menambah file migrasi SQL lalu memakai `migrate deploy`, tanpa memperluas hak akses atau me-reset database.
- **Launcher npm/Prisma gagal pada path berkarakter `&`:** gunakan nama folder sederhana. Pada folder lama, Prisma dapat dipanggil langsung: `node node_modules/prisma/build/index.js migrate deploy` dan `node node_modules/prisma/build/index.js generate`.
- **Field `description` ditolak pada body produk:** validator ETS tidak menerima field tersebut, sehingga request Tugas 9 disesuaikan ke field yang didukung tanpa mengubah tabel/model produk lama.
- **bcrypt memotong password di atas 72 byte:** selain batas karakter Joi, ditambah pemeriksaan panjang UTF-8.

Bonus refresh token **tidak diterapkan**; versi ini memakai satu JWT berumur 2 jam sesuai tugas wajib. Token tidak dicabut seketika dan tetap berlaku sampai expired. Proyek ini untuk latihan lokal, bukan layanan produksi. Pemeriksaan `npm audit` pada 25 November 2026 mencatat **4 temuan high** pada rantai dependensi Prisma (`prisma`, `@prisma/config`, `deepmerge-ts`, dan `effect`); masalah ini belum diperbaiki dan perlu ditinjau sebelum deployment publik. Tidak dilakukan `npm audit fix --force` karena dapat mengganti versi mayor Prisma yang dipakai proyek ETS.

## Pengumpulan

Publikasikan folder ini sebagai repository GitHub **T9-AUTENTIKASI** berstatus **Public** dan kumpulkan **tautan repository** di Berajah. Jangan unggah `.env`, `node_modules`, atau secret. Pastikan kode final memakai `expiresIn: '2h'` dan repository tetap public sampai akhir semester.

Pembuatan/publikasi repository GitHub dan pengumpulan ke Berajah merupakan langkah terpisah dari pengujian lokal; README ini tidak menyatakan keduanya sudah dilakukan.

Referensi: [Tugas 9](https://pahrulirfan.github.io/pwl/tugas-09-autentikasi-otorisasi.html) dan [Materi 9](https://pahrulirfan.github.io/pwl/materi-09-autentikasi-otorisasi.html).
