const express = require('express');
const app = express();
const port = process.env.PORT || 3000;
const { getQRCode, connectWhatsapp } = require('./index');

app.get('/', (req, res) => {
  res.send('WhatsApp Bot is running!');
});

const qrcode = require('qrcode');

app.get('/qr-image', async (req, res) => {
  let attempts = 0;
  const maxAttempts = 10;

  const tryGetQR = async () => {
    const qr = getQRCode();
    if (qr) {
      const qrImage = await qrcode.toDataURL(qr);
      res.send(`<img src="${qrImage}" alt="QR Code">`);
    } else if (attempts < maxAttempts) {
      attempts++;
      setTimeout(tryGetQR, 1000); // Tunggu 1 detik sebelum mencoba lagi
    } else {
      res.send('QR Code belum tersedia atau sudah terhubung ke WhatsApp');
    }
  };

  tryGetQR();
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

// Jalankan bot WhatsApp
connectWhatsapp();