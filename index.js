const { MongoClient } = require('mongodb');
const { makeWASocket, useMultiFileAuthState, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
const pino = require('pino');

let qrCode = null;
let socket = null;

const { MongoClient } = require('mongodb');

const mongoUri = process.env.MONGODB_URI;

const client = new MongoClient(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  tls: true,
  tlsInsecure: true, // Hanya untuk debugging
});

async function connectToMongo() {
  try {
    await client.connect();
    console.log('Connected successfully to MongoDB');
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
  }
}

connectToMongo();

async function saveAuthInfo(authInfo) {
  const collection = await connectToMongo();
  await collection.updateOne({}, { $set: authInfo }, { upsert: true });
}

async function loadAuthInfo() {
  const collection = await connectToMongo();
  const doc = await collection.findOne({});
  return doc || { state: { creds: {}, keys: {} } };
}

async function connectWhatsapp() {
  const authInfo = await loadAuthInfo();
  
  const auth = {
    state: {
      creds: authInfo.state.creds,
      keys: makeCacheableSignalKeyStore(authInfo.state.keys, pino({ level: 'silent' })),
    },
    saveCreds: async () => {
      const updatedAuthInfo = {
        state: {
          creds: auth.state.creds,
          keys: auth.state.keys.toJSON(),
        }
      };
      await saveAuthInfo(updatedAuthInfo);
    }
  };

  socket = makeWASocket({
    printQRInTerminal: true,
    browser: ["DAPABOT", "", ""],
    auth: auth.state,
    logger: pino({ level: process.env.LOG_LEVEL || "warn" }),
    connectTimeoutMs: 60000,
    qrTimeout: 0,
  });

  socket.ev.on("creds.update", auth.saveCreds);
  socket.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;
    
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('Connection closed due to ', lastDisconnect?.error, ', reconnecting ', shouldReconnect);
      if (shouldReconnect) {
        setTimeout(connectWhatsapp, 5000);
      }
    } else if (connection === 'open') {
      console.log('WhatsApp connected!');
      qrCode = null;
    }

    if (qr) {
      qrCode = qr;
      console.log('New QR Code:', qr);
    }
  });

  socket.ev.on("messages.upsert", async ({ messages }) => {
    // ... (kode Anda yang sudah ada)
    const pesan = messages[0].message.conversation;
    const phone = messages[0].key.remoteJid;
    console.log(messages[0]);
    if (!messages[0].key.fromMe) {
        query({ "question": pesan }).then(async (response) => {
            console.log(response);
            const { text } = response;
            await socket.sendMessage(phone, { text: text });
        });
    }
    return;
  });
}

async function query(data) {
    const response = await fetch(
        "https://geghnreb.cloud.sealos.io/api/v1/prediction/28a6b79e-bd21-436c-ae21-317eee710cb0",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        }
    );
    const result = await response.json();
    return result;
}

connectWhatsapp();
// ... (fungsi lainnya tetap sama)

module.exports = { connectWhatsapp, getQRCode: () => qrCode };

// Jalankan koneksi
connectWhatsapp().catch(console.error);