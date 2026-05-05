# Baileys WhatsApp Server

Server Node.js untuk kirim WhatsApp pakai Baileys.

## Setup Lokal

```bash
cd baileys-server
npm install
npm start
```

Buka `http://localhost:3001/qr` → scan QR dengan HP.

## Deploy ke Railway

1. Buat repo GitHub baru untuk folder `baileys-server` ini
2. Push ke GitHub
3. Buka [railway.app](https://railway.app) → New Project → Deploy from GitHub
4. Pilih repo → Deploy
5. Setelah deploy, buka URL Railway → tambahkan `/qr` → scan QR
6. Copy URL Railway (misal `https://xxx.railway.app`)
7. Isi di Vercel env: `BAILEYS_URL=https://xxx.railway.app`

## Environment Variables

Di Railway, set:
- `API_KEY` = `qurban2026` (atau ganti sesuai keinginan)

## API Endpoints

### GET /status
Cek koneksi WhatsApp.

### GET /qr
Tampilkan QR code untuk scan.

### POST /send
Kirim pesan WhatsApp.

Headers:
```
X-Api-Key: qurban2026
```

Body:
```json
{
  "number": "628123456789",
  "message": "Halo dari Baileys!"
}
```
