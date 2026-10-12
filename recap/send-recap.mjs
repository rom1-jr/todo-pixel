// Récap du matin : lancé chaque heure tôt le matin par GitHub Actions (voir .github/workflows/recap.yml).
// Pour chaque appareil abonné, envoie la notif une seule fois par jour, à partir de l'heure choisie dans l'appli.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import webpush from 'web-push';

const FORCE = process.env.FORCE === 'true';

export function localNow(tz, date = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23'
  }).formatToParts(date).map(p => [p.type, p.value]));
  return { hour: Number(parts.hour), day: `${parts.year}-${parts.month}-${parts.day}` };
}

const plural = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`;

export function buildRecap(items) {
  const open = items.filter(t => t && t.archived !== true && t.status !== 'done');
  if (!open.length) return { title: 'Récap du matin', body: 'Rien de prévu dans ta liste. Belle journée !' };
  const tasks = open.filter(t => t.kind !== 'reminder');
  const reminders = open.filter(t => t.kind === 'reminder');
  const urgent = open.filter(t => Number(t.urg) === 3).length;
  const counts = [];
  if (tasks.length) counts.push(plural(tasks.length, 'tâche'));
  if (reminders.length) counts.push(plural(reminders.length, 'rappel'));
  let head = counts.join(' et ') + ' pour aujourd\'hui';
  if (urgent) head += `, dont ${plural(urgent, 'urgente')}`;
  const top = open
    .slice()
    .sort((a, b) => (Number(b.urg) - Number(a.urg)) || ((a.createdAt || 0) - (b.createdAt || 0)))
    .slice(0, 3)
    .map(t => `${Number(t.urg) === 3 ? '!! ' : '• '}${String(t.title || 'Sans titre').slice(0, 60)}`);
  const more = open.length > 3 ? `\n+ ${open.length - 3} autre${open.length - 3 > 1 ? 's' : ''}` : '';
  return { title: 'Récap du matin', body: `${head}.\n${top.join('\n')}${more}` };
}

function vapidPublicKey() {
  if (process.env.VAPID_PUBLIC_KEY) return process.env.VAPID_PUBLIC_KEY.trim();
  const config = readFileSync(fileURLToPath(new URL('../config.js', import.meta.url)), 'utf8');
  const m = config.match(/vapidPublicKey\s*:\s*["']([^"']+)["']/);
  return m && !/REMPLACE/i.test(m[1]) ? m[1].trim() : '';
}

// Message affiché directement sur la page du lancement dans GitHub (encadré « Annotations »).
function annotate(level, msg) {
  if (!process.env.GITHUB_ACTIONS) return;
  const text = String(msg).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
  console.log(`::${level} title=Récap du matin::${text}`);
}
const WHERE = 'dans le dépôt : Settings → Secrets and variables → Actions → onglet « Secrets » → « Repository secrets » (pas dans « Variables », ni dans un « Environment »)';

function readAccount() {
  const raw = (process.env.FIREBASE_SERVICE_ACCOUNT || '').trim();
  if (!raw) throw new Error(`Le secret FIREBASE_SERVICE_ACCOUNT n'arrive pas jusqu'au récap (il est vide pour GitHub Actions). Il doit être enregistré ${WHERE}. Étape 7.4 du guide.`);
  let account = null;
  try { account = JSON.parse(raw); } catch (e) { account = null; }
  if (!account || !account.project_id || !account.private_key || !account.client_email) {
    throw new Error('Le secret FIREBASE_SERVICE_ACCOUNT est bien là, mais mal collé : recolle tout le contenu du fichier .json, de la première { à la dernière }. Étape 7.4 du guide.');
  }
  return account;
}

// Traduit les erreurs techniques les plus courantes en étape du guide à revoir.
function explain(err) {
  const msg = String((err && err.message) || err);
  if (/NOT_FOUND|does not exist/i.test(msg)) return `La base Firestore est introuvable : vérifie l'étape 3.3 (base « (default) ») et que la clé de l'étape 7.4 vient du même projet Firebase. Détail : ${msg}`;
  if (/PERMISSION_DENIED|invalid_grant|invalid jwt|UNAUTHENTICATED/i.test(msg)) return `Firebase refuse la clé d'accès : génère une nouvelle clé privée et remplace le secret FIREBASE_SERVICE_ACCOUNT (étape 7.4). Détail : ${msg}`;
  if (/vapid (private|public) key/i.test(msg)) return `Les clés de notification sont mal collées ou ne vont pas ensemble : refais les étapes 7.1 à 7.3, puis réactive le récap sur l'iPhone (7.6). Détail : ${msg}`;
  return msg;
}

async function main() {
  const account = readAccount();
  const pub = vapidPublicKey();
  const priv = (process.env.VAPID_PRIVATE_KEY || '').trim();
  if (!pub) throw new Error('Clé publique de notification absente de config.js (étape 7.2 du guide).');
  if (!priv) throw new Error(`Le secret VAPID_PRIVATE_KEY n'arrive pas jusqu'au récap (il est vide pour GitHub Actions). Il doit être enregistré ${WHERE}. Étape 7.3 du guide.`);

  initializeApp({ credential: cert(account) });
  const db = getFirestore();
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:todo-pixel@users.noreply.github.com', pub, priv);

  let sent = 0, skipped = 0, removed = 0;
  const users = await db.collection('users').listDocuments();
  for (const userRef of users) {
    const subs = await userRef.collection('push').get();
    if (subs.empty) continue;
    let items = null;
    for (const subDoc of subs.docs) {
      const p = subDoc.data();
      if (p.enabled === false || !p.subscription || !p.subscription.endpoint) { skipped++; continue; }
      const tz = p.tz || 'Europe/Paris';
      const hour = Number.isInteger(p.hour) ? p.hour : 7;
      const now = localNow(tz);
      if (!FORCE && (now.hour < hour || now.hour > hour + 2 || p.lastSent === now.day)) { skipped++; continue; }
      if (!items) items = (await userRef.collection('tasks').where('archived', '==', false).get()).docs.map(d => d.data());
      const recap = buildRecap(items);
      const payload = JSON.stringify({ ...recap, url: './', tag: `recap-${now.day}` });
      try {
        await webpush.sendNotification(p.subscription, payload, { TTL: 6 * 3600 });
        await subDoc.ref.update({ lastSent: now.day, lastError: null });
        sent++;
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await subDoc.ref.delete();
          removed++;
        } else {
          await subDoc.ref.update({ lastError: String(err.statusCode || err.message) });
          const line = `Échec d'envoi vers ${p.device || 'un appareil'} : ${err.statusCode || ''} ${err.body || err.message}`;
          console.error(line);
          annotate('warning', line);
        }
      }
    }
  }
  const summary = `Récaps envoyés : ${sent} · ignorés (pas l'heure ou déjà envoyé) : ${skipped} · abonnements expirés retirés : ${removed}`;
  console.log(summary);
  annotate('notice', sent || skipped || removed ? summary : `${summary}. Aucun appareil abonné : active le récap sur l'iPhone (étape 7.6).`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(err => { const m = explain(err); console.error(m); annotate('error', m); process.exit(1); });
}
