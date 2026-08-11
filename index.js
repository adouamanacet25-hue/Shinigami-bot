const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, makeInMemoryStore } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode-terminal');
const pino = require('pino');
const { Boom } = require('@hapi/boom');
const fs = require('fs');

// === CONFIGURATION ===
const BOT_NAME = 'SHINIGAMI_BOT_TECH';
const OWNER_NUMBER = '242050530427'; // ton numéro
const PREFIX_COMMANDS = ['/', '!']; // les deux préfixes

// === STORE (optionnel) ===
const store = makeInMemoryStore({ logger: pino().child({ level: 'silent' }) });

// === AUTH ===
const authFolder = './auth_info_baileys';
if (!fs.existsSync(authFolder)) fs.mkdirSync(authFolder);

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(authFolder);

  const sock = makeWASocket({
    logger: pino({ level: 'silent' }),
    auth: state,
    printQRInTerminal: false, // on affiche nous-même
    browser: ['SHINIGAMI Bot', 'Chrome', '1.0'],
  });

  store.bind(sock.ev);

  // Génération du QR code
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      QRCode.generate(qr, { small: true });
      console.log('🔐 Scanne ce QR avec WhatsApp.');
    }
    if (connection === 'open') {
      console.log('✅ Bot connecté !');
    }
    if (connection === 'close') {
      const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
      if (reason === DisconnectReason.loggedOut) {
        console.log('❌ Déconnecté. Supprime le dossier auth et relance.');
      } else {
        console.log('🔄 Reconnexion...');
        startBot();
      }
    }
  });

  sock.ev.on('creds.update', saveCreds);

  // === GESTION DES MESSAGES ===
  sock.ev.on('messages.upsert', async (m) => {
    const msg = m.messages[0];
    if (!msg.message) return;
    if (msg.key.fromMe) return; // ignorer ses propres messages

    const from = msg.key.remoteJid;
    const body = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
    if (!body) return;

    // Détection du préfixe
    let prefix = null;
    let command = '';
    let args = [];
    for (const p of PREFIX_COMMANDS) {
      if (body.startsWith(p)) {
        prefix = p;
        const parts = body.slice(p.length).trim().split(/\s+/);
        command = parts[0].toLowerCase();
        args = parts.slice(1);
        break;
      }
    }
    if (!prefix) return; // pas une commande

    // === EXÉCUTION DES COMMANDES ===
    const sender = msg.key.participant || msg.key.remoteJid;
    const senderName = msg.pushName || 'Utilisateur';

    console.log(`📩 Commande reçue : ${prefix}${command} de ${senderName}`);

    try {
      switch (command) {
        // --- Commandes générales ---
        case 'ping':
          await sock.sendMessage(from, { text: '🏓 Pong !' });
          break;

        case 'hello':
          await sock.sendMessage(from, { text: `👋 Bonjour ${senderName} !` });
          break;

        case 'about':
          await sock.sendMessage(from, {
            text: `🤖 *${BOT_NAME}*\nVersion : v1.0\nCréateur : Kira\n👑 Commandes : /help pour la liste.`
          });
          break;

        case 'help':
          // Envoie une liste simplifiée (tu peux l'agrandir)
          const helpText = `
📜 *Commandes SHINIGAMI*

*Administration :*
/annonce, /broadcast, /create-mission, /mission, /missions, /mission-done, /mission-rank
/kick, /ban, /warn, /clean, /lock, /unlock
/promote, /demote, /setgrade, /profile, /xp, /reputation
/virtual-number, /number-list, /number-add, /number-remove

*Divertissement & utilitaires :*
!ping, !hello, !about, !time, !date, !weather, !uptime
!joke, !meme, !fact, !quote, !trivia, !riddle
!coinflip, !dice, !8ball, !pokemon, !anime, !waifu
!dog, !cat, !fox, !wiki, !google, !youtube, !translate
... et bien d'autres !

💡 Pour plus d'infos, utilise !help <commande>.
          `;
          await sock.sendMessage(from, { text: helpText });
          break;

        // --- Commandes spécifiques (exemples) ---
        case 'creator':
          await sock.sendMessage(from, { text: `👤 Contacter le créateur : wa.me/${OWNER_NUMBER}` });
          break;

        case 'channel':
          await sock.sendMessage(from, {
            text: '📢 Suis la chaîne KIRA_TECH : https://whatsapp.com/channel/0029Vb7WJzp84OmBD0fEEJ2X'
          });
          break;

        // --- Ajoute ici TOUTES tes autres commandes ---
        // Par exemple : /annonce, /kick, !sticker, etc.
        // Tu dois implémenter chaque commande selon ta logique.

        default:
          await sock.sendMessage(from, { text: `❓ Commande inconnue. Tape !help pour la liste.` });
      }
    } catch (err) {
      console.error('Erreur commande:', err);
      await sock.sendMessage(from, { text: '⚠️ Erreur lors de l\'exécution de la commande.' });
    }
  });
}

// Lancer le bot
startBot().catch(err => console.error('Erreur de démarrage:', err));