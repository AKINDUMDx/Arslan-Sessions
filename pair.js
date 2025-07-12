const { makeid } = require('./gen-id');
const express = require('express');
const fs = require('fs');
const path = require('path');
let router = express.Router();
const pino = require("pino");
const { default: makeWASocket, useMultiFileAuthState, delay, Browsers, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
const { upload } = require('./mega');

function removeFile(FilePath) {
  if (!fs.existsSync(FilePath)) return false;
  fs.rmSync(FilePath, { recursive: true, force: true });
}

router.get('/', async (req, res) => {
  const id = makeid();
  let num = req.query.number;

  async function startPairing() {
    const { state, saveCreds } = await useMultiFileAuthState('./temp/' + id);

    try {
      let sock = makeWASocket({
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
        },
        printQRInTerminal: false,
        generateHighQualityLinkPreview: true,
        logger: pino({ level: "fatal" }).child({ level: "fatal" }),
        syncFullHistory: false,
        browser: Browsers.macOS("Safari")
      });

      if (!sock.authState.creds.registered) {
        await delay(1500);
        num = num.replace(/[^0-9]/g, '');
        const code = await sock.requestPairingCode(num);
        if (!res.headersSent) {
          return res.send({ code });
        }
      }

      sock.ev.on('creds.update', saveCreds);

      sock.ev.on("connection.update", async ({ connection, lastDisconnect }) => {
        if (connection === "open") {
          await delay(5000);

          const credsPath = path.join(__dirname, `temp/${id}/creds.json`);
          const userNumber = sock.user?.id?.split(':')[0];

          try {
            if (!fs.existsSync(credsPath)) {
              console.log("❌ creds.json not found");
              return;
            }

            const mega_url = await upload(fs.createReadStream(credsPath), `${sock.user.id}.json`);
            const session_id = "ARSL~" + mega_url.replace('https://mega.nz/file/', '');

            // ✅ Send Session ID
            let code = await sock.sendMessage(sock.user.id, {
              text: `✅ *Your Session ID:*\n\n${session_id}`
            });

            // ✅ Send creds.json to user's inbox
            await sock.sendMessage(sock.user.id, {
              document: fs.readFileSync(credsPath),
              fileName: `${userNumber}_creds.json`,
              mimetype: 'application/json',
              caption: '📂 *Here is your creds.json*\nUse it to deploy your bot.\n\n⚠️ Don’t share this with anyone!'
            });

            console.log("✅ Session ID and creds.json sent.");

          } catch (err) {
            console.log("❌ Error sending data:", err);
          }

          await delay(1000);
          await sock.ws.close();
          await removeFile('./temp/' + id);
          console.log(`👤 ${sock.user.id} Connected. Clean exit.`);
          await delay(1000);
          process.exit();

        } else if (
          connection === "close" &&
          lastDisconnect?.error?.output?.statusCode !== 401
        ) {
          await delay(10);
          startPairing();
        }
      });
    } catch (err) {
      console.log("❌ Service Error:", err);
      removeFile('./temp/' + id);
      if (!res.headersSent) {
        return res.send({ code: "❗ Service Unavailable" });
      }
    }
  }

  await startPairing();
});

module.exports = router;
