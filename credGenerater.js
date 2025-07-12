const fs = require('fs');
const path = require('path');

/**
 * Generates and sends creds.json to the user
 * @param {string} tempPath - Path to temp creds.json (e.g., ./temp/abcd123/creds.json)
 * @param {object} sock - Baileys socket
 */
async function generateCredsAndSend(tempPath, sock) {
  try {
    const userId = sock.user.id;
    const userNumber = userId.split(':')[0];
    const finalDir = path.join(__dirname, 'creds');
    const finalPath = path.join(finalDir, `${userNumber}_creds.json`);

    // ✅ Make sure /creds folder exists
    if (!fs.existsSync(finalDir)) fs.mkdirSync(finalDir);

    // ✅ Copy creds.json to /creds/
    fs.copyFileSync(tempPath, finalPath);
    console.log(`✅ creds.json saved to /creds/${userNumber}_creds.json`);

    // ✅ Send file to user's WhatsApp inbox
    await sock.sendMessage(userId, {
      document: fs.readFileSync(finalPath),
      fileName: `${userNumber}_creds.json`,
      mimetype: 'application/json',
      caption: '📂 *Here is your creds.json*\nUse it to deploy your bot.\n\n⚠️ Don’t share this with anyone!'
    });

    console.log("✅ creds.json sent to user inbox");

  } catch (err) {
    console.log("❌ Error in generateCredsAndSend:", err);
  }
}

module.exports = generateCredsAndSend;
