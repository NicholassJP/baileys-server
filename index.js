import express from "express";
import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import QRCode from "qrcode";

const app = express();
app.use(express.json());

const API_KEY = process.env.API_KEY || "qurban2026";
const PORT = process.env.PORT || 3001;

let sock = null;
let qrCode = null;
let isConnected = false;

// Middleware auth
function authMiddleware(req, res, next) {
  const key = req.headers["x-api-key"];
  if (key !== API_KEY) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}

async function connectWA() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info");
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: "silent" }),
    printQRInTerminal: true,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      qrCode = await QRCode.toDataURL(qr);
      isConnected = false;
      console.log("QR Code tersedia di GET /qr");
    }

    if (connection === "close") {
      isConnected = false;
      const shouldReconnect =
        new Boom(lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log("Koneksi terputus, reconnect:", shouldReconnect);
      if (shouldReconnect) {
        setTimeout(connectWA, 3000);
      }
    }

    if (connection === "open") {
      isConnected = true;
      qrCode = null;
      console.log("WhatsApp terhubung!");
    }
  });
}

// Routes

// Cek status
app.get("/status", (req, res) => {
  res.json({ connected: isConnected, hasQR: !!qrCode });
});

// Tampilkan QR code sebagai gambar
app.get("/qr", (req, res) => {
  if (isConnected) {
    return res.json({ message: "Sudah terhubung, tidak perlu scan QR." });
  }
  if (!qrCode) {
    return res.json({ message: "QR belum tersedia, tunggu beberapa detik." });
  }
  // Return HTML dengan gambar QR
  res.send(`
    <html>
      <body style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;background:#f0fdf4">
        <h2>Scan QR WhatsApp</h2>
        <img src="${qrCode}" style="width:300px;height:300px" />
        <p style="color:gray">Refresh halaman ini jika QR expired</p>
      </body>
    </html>
  `);
});

// Kirim pesan
app.post("/send", authMiddleware, async (req, res) => {
  const { number, message } = req.body;

  if (!number || !message) {
    return res.status(400).json({ message: "number dan message wajib diisi." });
  }
  if (!isConnected) {
    return res.status(503).json({ message: "WhatsApp belum terhubung. Scan QR dulu di /qr" });
  }

  try {
    const jid = number.replace(/[^0-9]/g, "") + "@s.whatsapp.net";
    await sock.sendMessage(jid, { text: message });
    console.log("Pesan terkirim ke:", jid);
    res.json({ success: true });
  } catch (err) {
    console.error("Gagal kirim:", err);
    res.status(500).json({ message: "Gagal mengirim pesan.", error: err.message });
  }
});

// Kirim gambar dari URL
app.post("/send-image", authMiddleware, async (req, res) => {
  const { number, imageUrl, caption } = req.body;

  if (!number || !imageUrl) {
    return res.status(400).json({ message: "number dan imageUrl wajib diisi." });
  }
  if (!isConnected) {
    return res.status(503).json({ message: "WhatsApp belum terhubung." });
  }

  try {
    const jid = number.replace(/[^0-9]/g, "") + "@s.whatsapp.net";
    await sock.sendMessage(jid, {
      image: { url: imageUrl },
      caption: caption || "",
    });
    console.log("Gambar terkirim ke:", jid);
    res.json({ success: true });
  } catch (err) {
    console.error("Gagal kirim gambar:", err);
    res.status(500).json({ message: "Gagal mengirim gambar.", error: err.message });
  }
});

// Logout — hapus sesi, scan QR ulang dengan nomor baru
app.post("/logout", authMiddleware, async (req, res) => {
  try {
    if (sock) {
      await sock.logout();
      sock = null;
    }
    isConnected = false;
    qrCode = null;
    // Hapus folder auth agar bisa scan ulang
    const { rmSync } = await import("fs");
    try { rmSync("auth_info", { recursive: true, force: true }); } catch {}
    // Reconnect untuk generate QR baru
    setTimeout(connectWA, 1000);
    res.json({ success: true, message: "Logout berhasil. Buka /qr untuk scan nomor baru." });
  } catch (err) {
    res.status(500).json({ message: "Gagal logout.", error: err.message });
  }
});

// Stop server
app.post("/stop", authMiddleware, (req, res) => {
  res.json({ success: true, message: "Server berhenti." });
  setTimeout(() => process.exit(0), 500);
});

app.listen(PORT, () => {
  console.log(`Baileys server jalan di port ${PORT}`);
  connectWA();
});
