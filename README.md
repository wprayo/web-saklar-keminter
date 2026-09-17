# Keminter — Panel Saklar

Versi web dari aplikasi Flutter Keminter Switch. Halaman statis + satu serverless function,
tanpa build step dan tanpa dependency yang perlu di-install.

```
keminter-web/
├─ api/config.js              setelan broker dari environment variable
├─ public/
│  ├─ index.html              seluruh aplikasi
│  ├─ manifest.webmanifest    biar bisa di-install di ponsel
│  └─ icon.svg, icon-maskable.svg
├─ vercel.json
├─ package.json
├─ .env.example
└─ .gitignore
```

Vercel otomatis menyajikan isi `public/` sebagai situs dan menjadikan tiap file di `api/`
sebagai endpoint. Build Command dan Output Directory biarkan kosong, Framework Preset **Other**.

## Deploy

**Lewat CLI**

```bash
npm i -g vercel
cd keminter-web
vercel            # deploy preview
vercel --prod     # deploy produksi
```

**Lewat GitHub** — push folder ini ke sebuah repo, lalu di Vercel pilih *Add New → Project → Import*.

## Isi environment variable

Vercel → project → **Settings → Environment Variables**, tambahkan enam ini untuk
Production, Preview, dan Development:

| Nama | Contoh | Keterangan |
|---|---|---|
| `MQTT_HOST` | `broker.contoh.id` | tanpa `wss://` dan tanpa port |
| `MQTT_PROTOCOL` | `wss` | di Vercel harus `wss` |
| `MQTT_PORT` | `8084` | port **WebSocket**, bukan 1883 |
| `MQTT_PATH` | `/mqtt` | path WebSocket broker |
| `MQTT_USER` | `seok` | kosongkan kalau broker tanpa login |
| `MQTT_PASS` | | |

Setelah diubah, deploy ulang (`vercel --prod`, atau Redeploy dari dashboard) supaya terpakai.

Untuk mencoba di komputer sendiri: `cp .env.example .env.local`, isi nilainya, lalu `vercel dev`.
Catatan: session cookie login memakai flag `Secure` (wajib untuk produksi HTTPS), jadi login
tidak akan tersimpan kalau `vercel dev` diakses lewat `http://localhost` biasa — untuk uji coba
login, paling gampang langsung test di domain `*.vercel.app` yang sudah HTTPS.

Kalau `MQTT_HOST` dikosongkan, aplikasi tetap jalan — tiap perangkat tinggal diatur
brokernya sendiri lewat tombol Ubah perangkat.

### Soal keamanan kredensial

Environment variable menjaga password tidak ikut ke repo Git, tapi nilainya tetap dikirim
ke browser dan bisa dilihat di tab Network. MQTT dari browser memang begitu. Kalau brokernya
publik, buat user MQTT khusus dengan ACL yang hanya boleh menyentuh `saklar/keminter/#`,
jangan pakai user admin.

## Broker harus punya listener WebSocket

Ini perbedaan utama dengan versi Flutter: **browser tidak bisa MQTT lewat TCP biasa**.
Port 1883 dan 8883 tidak bisa dipakai dari halaman web.

| Broker | WS | WSS |
|---|---|---|
| EMQX / EMQX Cloud | 8083 | 8084 |
| Mosquitto | 9001 (dikonfigurasi manual) | 8081 |
| HiveMQ Cloud | — | 8884 |

Contoh `mosquitto.conf`:

```
listener 1883
protocol mqtt

listener 9001
protocol websockets

listener 8081
protocol websockets
certfile /etc/letsencrypt/live/domainmu/fullchain.pem
keyfile  /etc/letsencrypt/live/domainmu/privkey.pem
```

Karena Vercel selalu HTTPS, protokolnya wajib `wss://`. `ws://` akan diblokir browser sebagai
mixed content, dan aplikasi menampilkan peringatan kalau itu terjadi. Sertifikat TLS-nya juga
harus valid (Let's Encrypt) — self-signed ditolak browser, beda dengan `onBadCertificate => true`
di Flutter.

## Login & database (Supabase)

Login pakai username + password milik sendiri (tabel `users` sendiri) — bukan menumpang
sistem Auth bawaan Supabase. Browser tidak pernah bicara langsung ke Supabase; semua lewat
serverless function di folder `api/`, yang memegang kredensial Supabase secara rahasia di
server. Device tersimpan di database, tersinkron di semua perangkat/browser dengan login yang
sama, dan tiap akun cuma melihat device miliknya sendiri.

**1. Buat project Supabase**

Daftar gratis di [supabase.com](https://supabase.com), buat project baru, tunggu sampai
statusnya aktif (sekitar 2 menit).

**2. Jalankan skema tabel**

Buka **SQL Editor** di dashboard project, klik **New query**, tempel seluruh isi
`sql/schema.sql` dari folder ini, lalu klik **Run**. Ini membuat tabel `users` dan `devices`.

**3. Salin URL dan service_role key**

Buka **Project Settings → API**. Salin nilai **Project URL** dan **service_role secret key**
(bukan anon key — service_role perlu diklik "Reveal" dulu untuk terlihat).

> **service_role key ini setara kunci master** — bisa baca/tulis seluruh database tanpa
> terkena proteksi apa pun. Ini alasan kenapa arsitekturnya browser tidak pernah pegang key
> ini sama sekali; cuma serverless function di server yang tahu, lewat Environment Variables
> Vercel. Jangan pernah commit ke Git atau taruh di kode yang jalan di browser.

**4. Bikin JWT_SECRET**

Ini string acak untuk menandatangani session login, generate sendiri — contoh lewat terminal:

```bash
openssl rand -base64 32
```

Atau pakai string acak panjang apa saja (minimal 32 karakter), asal rahasia dan tidak dipakai
di tempat lain.

**5. Isi environment variable di Vercel**

Tambahkan tiga ini di Settings → Environment Variables (selain enam variabel MQTT yang sudah
ada):

| Nama | Isi dengan |
|---|---|
| `SUPABASE_URL` | Project URL dari langkah 3 |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role secret key dari langkah 3 |
| `JWT_SECRET` | string acak dari langkah 4 |

Redeploy setelah menyimpan — env var baru cuma berlaku di deployment berikutnya.

**6. Coba daftar**

Buka situsnya, klik **Daftar**, isi username (huruf kecil/angka/titik/underscore, 3-20
karakter) dan password (minimal 6 karakter). Tidak ada verifikasi email sama sekali — langsung
bisa masuk dan mulai menambah device. Password bisa diganti kapan saja lewat ikon kunci di
pojok kanan atas setelah login.

Siapa pun yang tahu alamat situsnya bisa mendaftar sendiri (mode publik) — kalau mau
membatasi siapa saja yang boleh pakai, itu bisa ditambahkan terpisah, tinggal bilang kalau
diperlukan.

## Sisi ESP tidak berubah

Topik dan payload sama persis dengan aplikasi Flutter:

- `saklar/keminter/<code>/set` → `{"command":"s1_ON","token":"..."}`
- `saklar/keminter/<code>/status/cek` → `{"command":"GET_STATUS","token":"..."}`
- `saklar/keminter/<code>/status` → `{"s1":true,"s2":false,...}`

## Fitur

- Login & daftar dengan username + password sendiri, tiap akun cuma melihat devicenya sendiri
- Ganti password kapan saja lewat ikon kunci di header
- Tambah, ubah, hapus perangkat; tersimpan di database Supabase, tersinkron di semua perangkat/browser
- 1–4 saklar per perangkat dengan nama bebas
- Broker bawaan atau broker sendiri (WS/WSS, port, path, login opsional)
- Lampu status: merah = broker putus, abu = broker nyambung tapi ESP diam, hijau = ESP menjawab
- Timeout balasan ESP 3,5 detik, sama seperti versi Flutter
- Refresh status manual per perangkat, plus tombol sambung ulang semua
- Bisa di-install ke home screen ponsel (Add to Home Screen)
