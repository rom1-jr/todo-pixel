/* To do list (PWA) — organisation du croquis : une carte par tâche (case de statut, titre, objet, + pour la description,
   niveau d'urgence et barre de statut), bouton + pour ajouter, archives en bas. Couleurs de la charte graphique.
   Synchro via Firebase quand config.js est rempli, via la base de la page quand elle tourne dans Claude,
   sinon mode local (tâches gardées dans le navigateur). */
(() => {
  'use strict';

  const CFG = window.TODO_CONFIG || {};
  const FBC = CFG.firebase || {};
  const filled = v => typeof v === 'string' && v.length > 0 && !/REMPLACE/i.test(v);
  const FIREBASE_READY = filled(FBC.apiKey) && filled(FBC.projectId) && filled(FBC.appId) && !!window.FB && /^https?:$/.test(location.protocol);
  const IN_CLAUDE = !FIREBASE_READY && !!(window.claude && typeof window.claude.use === 'function');
  const VAPID_KEY = filled(CFG.vapidPublicKey) ? CFG.vapidPublicKey.trim() : '';
  // Fuseau horaire : celui de l'appareil, sauf s'il est masqué (UTC), auquel cas on prend Paris.
  const TZ = (() => {
    const tz = (Intl.DateTimeFormat().resolvedOptions() || {}).timeZone;
    return !tz || /^(UTC|Etc\/UTC|Etc\/GMT)$/i.test(tz) ? 'Europe/Paris' : tz;
  })();

  /* ================= icônes (traits fins) ================= */
  const SVG = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
    popout: '<path d="M14 4h6v6M20 4l-8.5 8.5M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    cross: '<path d="M7 7l10 10M17 7L7 17"/>',
    ring: '<circle cx="12" cy="12" r="6.5"/>',
    bell: '<path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 2h-14z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
    cal: '<rect x="4" y="5.5" width="16" height="14.5" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
    trash: '<path d="M5 7h14M10 7V4.5h4V7M7 7l1 12.5h8L17 7"/>',
    pencil: '<path d="M5 19l.8-3.6L15.6 5.6a1.5 1.5 0 0 1 2.1 0l.7.7a1.5 1.5 0 0 1 0 2.1L8.6 18.2z"/>',
    undo: '<path d="M9 14.5L4.5 10 9 5.5"/><path d="M4.5 10H14a5 5 0 0 1 0 10h-3"/>',
    clock: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4.5l3 2"/>'
  };
  const svgIco = (name, size, sw) => '<svg class="si" viewBox="0 0 24 24" width="' + (size || 16) + '" height="' + (size || 16) + '" fill="none" stroke="currentColor" stroke-width="' + (sw || 1.75) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + SVG[name] + '</svg>';
  // Niveau d'urgence : pastille verte (basse), jaune (moyenne) ou rouge (haute).
  const dot = n => '<span class="dot" data-urg="' + n + '" aria-hidden="true"></span>';
  // En cours : huit points en rond qui tournent comme un chargement de jeu (la tête du cercle avance dans le sens des aiguilles d'une montre ;
  // figés en traînée si l'appareil demande moins d'animations).
  const spinner = size => {
    let dots = '';
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      dots += '<circle cx="' + (12 + 7.5 * Math.sin(a)).toFixed(2) + '" cy="' + (12 - 7.5 * Math.cos(a)).toFixed(2) + '" r="2.05" style="opacity:' + (0.22 + i * 0.11).toFixed(2) + ';animation-delay:' + ((i - 8) * 0.15).toFixed(2) + 's"/>';
    }
    return '<svg class="si spin" viewBox="0 0 24 24" width="' + size + '" height="' + size + '" fill="currentColor" aria-hidden="true" focusable="false">' + dots + '</svg>';
  };
  // Case de statut : pas commencée (×), en cours (points qui tournent), validée (✓) ; un rappel à retenir a une cloche.
  const STATUS_ICO = { todo: () => svgIco('cross', 20, 2), doing: () => spinner(24), done: () => svgIco('check', 22, 2.6), bell: () => svgIco('bell', 20, 1.9) };

  /* ================= textes + outils ================= */
  const STATUS = {
    todo: { label: 'Pas commencée', icon: 'todo' },
    doing: { label: 'En cours', icon: 'doing' },
    done: { label: 'Validée', icon: 'done' }
  };
  const RSTATUS = { todo: { label: 'À retenir', icon: 'bell' }, done: { label: 'C\'est fait', icon: 'done' } };
  const URG = { 1: 'Basse', 2: 'Moyenne', 3: 'Haute' };
  const CAT = { pro: { label: 'Pro' }, perso: { label: 'Perso' } };
  const $ = (sel, el) => (el || document).querySelector(sel);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const plural = (n, word) => n + ' ' + word + (n > 1 ? 's' : '');
  const dayFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ });
  const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', timeZone: TZ });
  const timeFmt = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
  const when = ms => ms ? 'le ' + dateFmt.format(new Date(ms)) + ' à ' + timeFmt.format(new Date(ms)) : '';
  const newId = () => 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  function lsGet(key, fallback) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; } }
  function lsSet(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* stockage bloqué */ } }
  // Anciennes clés de stockage (premières versions de l'appli) : reprises une fois, puis effacées.
  (() => {
    [['pixel-todo-prefs', 'todo-prefs'], ['pixel-todo-local-tasks', 'todo-local-tasks'], ['pixel-todo-notified', 'todo-notified']].forEach(([from, to]) => {
      try {
        const v = localStorage.getItem(from);
        if (v != null && localStorage.getItem(to) == null) localStorage.setItem(to, v);
        if (v != null) localStorage.removeItem(from);
      } catch (e) { /* stockage bloqué */ }
    });
  })();
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const finePointer = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ================= dates (jour civil 'AAAA-MM-JJ', heure 'HH:MM') et lecture de l'ajout rapide ================= */
  const isISO = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + 'T00:00:00Z'));
  const isHM = s => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
  const isoParts = s => s.split('-').map(Number);
  const utcOf = iso => { const p = isoParts(iso); return Date.UTC(p[0], p[1] - 1, p[2]); };
  const isoOfUTC = ms => new Date(ms).toISOString().slice(0, 10);
  const addDays = (iso, n) => { const p = isoParts(iso); return isoOfUTC(Date.UTC(p[0], p[1] - 1, p[2] + n)); };
  const weekdayOf = iso => new Date(utcOf(iso)).getUTCDay(); // 0 = dimanche
  const daysBetween = (a, b) => Math.round((utcOf(b) - utcOf(a)) / 864e5);
  const nextWeekday = (today, wd) => { let n = (wd - weekdayOf(today) + 7) % 7; if (n === 0) n = 7; return addDays(today, n); };
  const WD = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const MO = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  // « Aujourd'hui », « Demain », « Hier », « Jeudi » (dans la semaine), sinon « Lun. 19 oct. » (+ année si besoin).
  function dayLabel(iso, today) {
    const n = daysBetween(today, iso);
    if (n === 0) return 'Aujourd\'hui';
    if (n === 1) return 'Demain';
    if (n === -1) return 'Hier';
    if (n > 1 && n < 7) return cap(WD[weekdayOf(iso)]);
    const p = isoParts(iso);
    return cap(WD[weekdayOf(iso)].slice(0, 3)) + '. ' + p[2] + ' ' + MO[p[1] - 1] + (p[0] !== Number(today.slice(0, 4)) ? ' ' + p[0] : '');
  }
  const MONTHS = { janvier: 1, janv: 1, fevrier: 2, fevr: 2, fev: 2, mars: 3, avril: 4, avr: 4, mai: 5, juin: 6, juillet: 7, juil: 7, aout: 8,
    septembre: 9, sept: 9, sep: 9, octobre: 10, oct: 10, novembre: 11, nov: 11, decembre: 12, dec: 12 };
  const fold = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’`]/g, '\'');
  // Date valide la plus proche à partir d'un jour et d'un mois (cette année, sinon l'an prochain).
  function upcoming(today, m, d, y) {
    const ty = Number(today.slice(0, 4));
    const mk = yy => { const ms = Date.UTC(yy, m - 1, d); const iso = isoOfUTC(ms); return Number(iso.slice(5, 7)) === m ? iso : null; };
    if (y) { const yy = y < 100 ? 2000 + y : y; return mk(yy); }
    const a = mk(ty);
    if (a && a >= today) return a;
    return mk(ty + 1);
  }
  // Lit le texte tapé dans l'ajout rapide : « Appeler Martin demain 14h », « Rapport pour lundi ! », « Toner 15/10 ».
  // Rend le titre nettoyé, la date, l'heure (une heure = un rappel) et la priorité haute si « ! » est écrit seul.
  function parseQuick(text, today, hm) {
    const words = String(text || '').trim().split(/\s+/).filter(Boolean);
    const low = words.map(fold);
    const used = new Array(words.length).fill(false);
    let due = null, time = null, urg = null;
    const DATE_PREFIX = ['pour', 'avant', 'd\'ici', 'des', 'le', 'ce', 'cette', 'a', 'au', 'du', 'jusqu\'a'];
    const markPrefix = i => { if (i > 0 && !used[i - 1] && DATE_PREFIX.includes(low[i - 1])) used[i - 1] = true; };
    const clean = w => w.replace(/[,;.!?]+$/, '');
    // 1. priorité : « ! » (ou « !! ») tout seul
    low.forEach((w, i) => { if (/^!{1,3}$/.test(w)) { urg = 3; used[i] = true; } });
    // 2. dates
    for (let i = 0; i < words.length && !due; i++) {
      if (used[i]) continue;
      const w = clean(low[i]), next = i + 1 < words.length ? clean(low[i + 1]) : '';
      let n = 0, d = null;
      if (w === 'aujourd\'hui' || w === 'auj') { d = today; n = 1; }
      else if (w === 'ce' && (next === 'soir' || next === 'matin')) { d = today; n = 2; }
      else if (w === 'apres-demain' || (w === 'apres' && next === 'demain')) { d = addDays(today, 2); n = w === 'apres' ? 2 : 1; }
      else if (w === 'demain') { d = addDays(today, 1); n = 1; }
      else if (WD.indexOf(w) >= 0) { d = nextWeekday(today, WD.indexOf(w)); n = next === 'prochain' ? 2 : 1; }
      else if (w === 'semaine' && next === 'prochaine' && i > 0 && low[i - 1] === 'la') { d = nextWeekday(today, 1); n = 2; used[i - 1] = true; }
      else if (/^\d{1,2}\/\d{1,2}(\/\d{2}|\/\d{4})?$/.test(w)) {
        const p = w.split('/').map(Number);
        d = upcoming(today, p[1], p[0], p[2]); n = d ? 1 : 0;
      } else if (/^\d{1,2}(er)?$/.test(w) && MONTHS[next.replace(/\.$/, '')]) {
        d = upcoming(today, MONTHS[next.replace(/\.$/, '')], parseInt(w, 10)); n = d ? 2 : 0;
      } else if (w === 'le' && /^[1-9]\d?(er)?$/.test(next)) {
        const day = parseInt(next, 10), after = i + 2 < words.length ? clean(low[i + 2]).replace(/\.$/, '') : '';
        if (/^\d+$/.test(after)) { /* un numéro de téléphone, pas une date */ }
        else if (MONTHS[after]) { d = upcoming(today, MONTHS[after], day); n = d ? 3 : 0; }
        else {
          const p = isoParts(today);
          let cand = isoOfUTC(Date.UTC(p[0], p[1] - 1, day));
          if (Number(cand.slice(8, 10)) !== day || cand < today) cand = isoOfUTC(Date.UTC(p[0], p[1], day));
          d = Number(cand.slice(8, 10)) === day ? cand : null; n = d ? 2 : 0;
        }
      }
      if (d && n) { due = d; markPrefix(i); for (let k = 0; k < n; k++) used[i + k] = true; }
    }
    // 3. heure : « 14h », « 14h30 », « 9:15 », acceptée après « à / vers / dès », à côté d'une date, ou en fin de texte
    const TIME = /^([01]?\d|2[0-3])(?:h([0-5]\d)?|:([0-5]\d))$/;
    for (let i = 0; i < words.length && !time; i++) {
      if (used[i]) continue;
      const m = TIME.exec(clean(low[i]));
      if (!m) continue;
      const prev = i > 0 ? low[i - 1] : '';
      const restFree = words.slice(i + 1).every((w, k) => used[i + 1 + k] || /^[,;.!?]+$/.test(w));
      const byDate = (i > 0 && used[i - 1] && !/^!+$/.test(low[i - 1])) || (i + 1 < words.length && used[i + 1] && !/^!+$/.test(low[i + 1]));
      const prefixed = ['a', 'vers', 'des'].includes(prev);
      if (!(prefixed || byDate || restFree)) continue;
      time = String(m[1]).padStart(2, '0') + ':' + (m[2] || m[3] || '00');
      used[i] = true;
      if (prefixed) used[i - 1] = true;
    }
    if (time && !due) due = time > hm ? today : addDays(today, 1);
    let title = words.filter((w, i) => !used[i]).join(' ').replace(/\s+([,;.!?])/g, '$1').replace(/^[\s,;:–-]+|[\s,;:–-]+$/g, '').trim();
    if (!title) title = String(text || '').trim();
    return { title: title, due: due, time: time, kind: time ? 'reminder' : 'task', urg: urg };
  }
  // Jour et heure de l'appareil (fuseau TZ) : « 2026-10-13 » et « 14:05 ».
  const isoFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
  const hmFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const todayISO = () => { const p = Object.fromEntries(isoFmt.formatToParts(new Date()).map(x => [x.type, x.value])); return p.year + '-' + p.month + '-' + p.day; };
  const nowHM = () => hmFmt.format(new Date()).replace(/^24/, '00');
  const minutesOf = hm => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5));
  // Ajoute des minutes à un jour + heure, arrondi aux 5 minutes suivantes (pour « Reporter d'1 h »).
  function plusMinutes(iso, hm, mins) {
    let total = Math.ceil((minutesOf(hm) + mins) / 5) * 5;
    const shift = Math.floor(total / 1440);
    total -= shift * 1440;
    return { due: addDays(iso, shift), time: String(Math.floor(total / 60)).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0') };
  }

  /* ================= état ================= */
  // Réglages propres à cet appareil : tâches affichées (pro / perso / all), alertes, valeurs par défaut.
  const prefs = Object.assign({ cat: 'pro', urg: 2, kind: 'task', hour: 7, filter: 'all', alerts: false }, lsGet('todo-prefs', {}));
  delete prefs.style;
  const savePrefs = () => lsSet('todo-prefs', prefs);
  const S = {
    tasks: new Map(), view: 'tasks', expanded: new Set(), leaving: new Set(), fresh: new Set(),
    loaded: false, mode: FIREBASE_READY ? 'firebase' : (IN_CLAUDE ? 'claude' : 'local'), user: null, authChecked: !FIREBASE_READY,
    filter: ['pro', 'perso', 'all'].includes(prefs.filter) ? prefs.filter : 'all',
    vt: false, pop: null, toggled: null
  };

  function normalize(id, d) {
    d = d || {};
    const kind = d.kind === 'reminder' ? 'reminder' : 'task';
    let status = ['todo', 'doing', 'done'].includes(d.status) ? d.status : 'todo';
    const archived = d.archived === true || status === 'done';
    if (archived) status = 'done';
    if (kind === 'reminder' && status === 'doing') status = 'todo';
    // Échéance (jour 'AAAA-MM-JJ') pour tous ; heure ('HH:MM') seulement pour un rappel daté.
    const due = isISO(d.due) ? d.due : null;
    const time = kind === 'reminder' && due && isHM(d.time) ? d.time : null;
    return {
      id: id, kind: kind,
      title: typeof d.title === 'string' && d.title.trim() ? d.title : 'Sans titre',
      subject: typeof d.subject === 'string' ? d.subject : '',
      desc: typeof d.desc === 'string' ? d.desc : '',
      cat: d.cat === 'perso' ? 'perso' : 'pro',
      urg: [1, 2, 3].includes(Number(d.urg)) ? Number(d.urg) : 2,
      due: due, time: time,
      status: status, archived: archived,
      createdAt: Number(d.createdAt) || 0, updatedAt: Number(d.updatedAt) || 0, archivedAt: Number(d.archivedAt) || 0
    };
  }
  const toDoc = t => ({
    kind: t.kind, title: t.title, subject: t.subject, desc: t.desc, cat: t.cat, urg: t.urg, due: t.due || null, time: t.time || null,
    status: t.status, archived: t.archived, createdAt: t.createdAt, updatedAt: t.updatedAt, archivedAt: t.archivedAt || null
  });

  /* ================= storage ================= */
  const LOCAL_KEY = 'todo-local-tasks';
  let fb = null; // { app, auth, db }
  let unsubTasks = null;

  function fsError(e) {
    const code = (e && e.code) || '';
    if (code.includes('permission-denied')) return 'Accès refusé par Firebase : vérifie les règles Firestore (étape 3.4 du guide).';
    if (code.includes('unauthenticated')) return 'Ta session a expiré : reconnecte-toi.';
    if (code.includes('resource-exhausted')) return 'Quota gratuit Firebase atteint pour aujourd\'hui. Réessaie demain.';
    if (code.includes('unavailable')) return 'Pas de connexion : tes changements seront envoyés dès le retour du réseau.';
    return 'Enregistrement impossible pour l\'instant (' + (code || 'erreur inconnue') + ').';
  }
  // Base de la page quand elle tourne dans Claude : une écriture à la fois par document.
  let claudeCol = null;
  const claudeChains = new Map();
  function claudeError(e) {
    const code = e && e.code;
    if (code === 'quota_exceeded') return 'La liste est pleine. Supprime quelques archives pour faire de la place.';
    if (code === 'invalid_argument' || code === 'transform_error') return 'Modification refusée : cette liste est peut-être en lecture seule pour toi.';
    if (code === 'revoked' || code === 'not_granted' || code === 'capability_disabled' || code === 'capability_removed') return 'La synchronisation n\'est plus disponible. Recharge la page.';
    if (code === 'resource_exhausted') return 'Trop de modifications d\'un coup. Attends quelques secondes.';
    return 'Enregistrement impossible pour l\'instant. Réessaie dans un moment.';
  }
  function claudeRun(id, op) {
    const prev = claudeChains.get(id) || Promise.resolve();
    const next = prev.catch(() => {}).then(async () => {
      try { await op(claudeCol.doc(id)); }
      catch (e) {
        if (e && e.code === 'unavailable') {
          await new Promise(r => setTimeout(r, 400 + Math.random() * 700));
          try { await op(claudeCol.doc(id)); return; } catch (e2) { toast(claudeError(e2)); return; }
        }
        toast(claudeError(e));
      }
    });
    claudeChains.set(id, next);
  }
  const Store = {
    put(t) {
      if (S.mode === 'claude') return claudeRun(t.id, ref => ref.set(toDoc(t)));
      if (S.mode !== 'firebase') return persistLocal();
      FB.setDoc(FB.doc(fb.db, 'users', S.user.uid, 'tasks', t.id), toDoc(t)).catch(e => toast(fsError(e)));
    },
    patch(id, fields) {
      if (S.mode === 'claude') return claudeRun(id, ref => ref.update(fields));
      if (S.mode !== 'firebase') return persistLocal();
      FB.updateDoc(FB.doc(fb.db, 'users', S.user.uid, 'tasks', id), fields).catch(e => toast(fsError(e)));
    },
    remove(id) {
      if (S.mode === 'claude') return claudeRun(id, ref => ref.delete());
      if (S.mode !== 'firebase') return persistLocal();
      FB.deleteDoc(FB.doc(fb.db, 'users', S.user.uid, 'tasks', id)).catch(e => toast(fsError(e)));
    }
  };
  async function startClaude() {
    let db = null;
    try { db = await window.claude.use('db'); } catch (e) { db = null; }
    if (!db) { S.mode = 'local'; startLocal(); return; }
    claudeCol = db.collection('tasks');
    const subscribe = retried => claudeCol.onSnapshot(snap => {
      const next = new Map();
      snap.docs.forEach(d => { if (d.exists) next.set(d.id, normalize(d.id, d.data())); });
      S.tasks = next;
      S.loaded = true;
      render();
    }, err => {
      if (err && err.code === 'unavailable' && !retried) { setTimeout(() => subscribe(true), 1500); return; }
      S.loaded = true;
      render();
      toast(claudeError(err));
    });
    subscribe(false);
  }
  function persistLocal() { lsSet(LOCAL_KEY, Array.from(S.tasks.values())); }
  function startLocal() {
    const saved = lsGet(LOCAL_KEY, []);
    S.tasks = new Map((Array.isArray(saved) ? saved : []).map(t => [t.id, normalize(t.id, t)]));
    S.loaded = true;
    render();
  }
  function startFirebase() {
    try {
      const app = FB.initializeApp(FBC);
      const auth = FB.initializeAuth(app, { persistence: [FB.indexedDBLocalPersistence, FB.browserLocalPersistence] });
      let db;
      try { db = FB.initializeFirestore(app, { localCache: FB.persistentLocalCache({ tabManager: FB.persistentMultipleTabManager() }) }); }
      catch (e) { db = FB.initializeFirestore(app, {}); }
      fb = { app: app, auth: auth, db: db };
    } catch (e) {
      S.mode = 'local';
      S.authChecked = true;
      startLocal();
      toast('Firebase n\'a pas démarré : vérifie config.js. Mode local en attendant.');
      return;
    }
    FB.onAuthStateChanged(fb.auth, user => {
      if (unsubTasks) { unsubTasks(); unsubTasks = null; }
      S.user = user;
      S.authChecked = true;
      S.tasks = new Map();
      S.expanded.clear();
      if (!user) { S.loaded = true; S.view = 'tasks'; render(); return; }
      S.loaded = false;
      render();
      unsubTasks = FB.onSnapshot(FB.collection(fb.db, 'users', user.uid, 'tasks'), snap => {
        const next = new Map();
        snap.forEach(d => next.set(d.id, normalize(d.id, d.data())));
        S.tasks = next;
        S.loaded = true;
        render();
      }, err => {
        S.loaded = true;
        render();
        toast(fsError(err));
      });
    });
  }

  /* ================= actions ================= */
  function commit(t) { t.updatedAt = Date.now(); S.tasks.set(t.id, t); }
  const lowFirst = s => s.charAt(0).toLowerCase() + s.slice(1);
  // « demain à 14:00 », « lundi », « lun. 19 oct. »
  const whenWords = t => t.due ? lowFirst(dayLabel(t.due, todayISO())) + (t.time ? ' à ' + t.time : '') : '';
  function addTask(fields) {
    const now = Date.now();
    const t = normalize(newId(), Object.assign({}, fields, { status: 'todo', archived: false, createdAt: now, updatedAt: now }));
    S.tasks.set(t.id, t);
    S.fresh.add(t.id);
    renderAnimated();
    Store.put(t);
    toast((t.kind === 'reminder' ? 'Rappel ajouté' : 'Tâche ajoutée') + (t.due ? ' pour ' + whenWords(t) : '') + '.');
  }
  function editTask(id, fields) {
    const t = S.tasks.get(id);
    if (!t) return;
    const next = normalize(id, Object.assign({}, t, fields));
    commit(next);
    S.fresh.add(id);
    renderAnimated();
    Store.patch(id, { kind: next.kind, title: next.title, subject: next.subject, desc: next.desc, cat: next.cat, urg: next.urg, due: next.due, time: next.time, status: next.status, updatedAt: next.updatedAt });
    toast(next.kind === 'reminder' ? 'Rappel modifié.' : 'Tâche modifiée.');
  }
  function setStatus(id, status) {
    const t = S.tasks.get(id);
    if (!t || t.status === status) return;
    if (status === 'done') { validate(id); return; }
    const next = Object.assign({}, t, { status: status });
    commit(next);
    S.pop = id;
    renderAnimated();
    Store.patch(id, { status: status, updatedAt: next.updatedAt });
  }
  function setUrg(id, urg) {
    const t = S.tasks.get(id);
    if (!t || t.urg === urg) return;
    const next = Object.assign({}, t, { urg: urg });
    commit(next);
    S.pop = id;
    renderAnimated();
    Store.patch(id, { urg: urg, updatedAt: next.updatedAt });
  }
  // Nouvelle date et heure d'un rappel (« Reporter »).
  function setWhen(id, due, time) {
    const t = S.tasks.get(id);
    if (!t) return;
    const next = normalize(id, Object.assign({}, t, { due: due, time: time }));
    commit(next);
    S.fresh.add(id);
    renderAnimated();
    Store.patch(id, { due: next.due, time: next.time, updatedAt: next.updatedAt });
    toast(next.due ? 'Rappel reporté à ' + whenWords(next) + '.' : 'Rappel sans date.');
  }
  function snooze(id, mode) {
    const today = todayISO();
    const w = mode === 'tomorrow' ? { due: addDays(today, 1), time: '09:00' } : plusMinutes(today, nowHM(), 60);
    setWhen(id, w.due, w.time);
  }
  // Copie de la carte posée au même endroit, pour l'animer pendant que la vraie disparaît de la liste.
  function overlayClone(card) {
    const r = card.getBoundingClientRect();
    const c = card.cloneNode(true);
    c.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
    c.classList.remove('is-new', 'pop', 'just-toggled');
    c.classList.add('fx-clone');
    c.setAttribute('aria-hidden', 'true');
    c.style.left = r.left + 'px';
    c.style.top = r.top + 'px';
    c.style.width = r.width + 'px';
    c.style.height = r.height + 'px';
    c.style.viewTransitionName = 'none';
    return { c: c, r: r };
  }
  // Tâche validée : la carte gonfle, s'irise et éclate doucement comme une bulle de savon (anneau, gouttelettes).
  function popBubble(card) {
    return new Promise(done => {
      const o = overlayClone(card);
      o.c.classList.add('fx-bubble');
      const fx = document.createElement('div');
      fx.className = 'fx-pop';
      fx.style.left = (o.r.left + o.r.width / 2) + 'px';
      fx.style.top = (o.r.top + o.r.height / 2) + 'px';
      fx.style.setProperty('--w', o.r.width + 'px');
      fx.style.setProperty('--h', o.r.height + 'px');
      let html = '<span class="ring"></span>';
      for (let i = 0; i < 12; i++) {
        const a = i / 12 * Math.PI * 2 + .2;
        html += '<span class="drop" style="--dx:' + Math.round(Math.cos(a) * (o.r.width / 2 + 16)) + 'px;--dy:' + Math.round(Math.sin(a) * (o.r.height / 2 + 16)) + 'px;--d:' + (i % 3) * 35 + 'ms"></span>';
      }
      fx.innerHTML = html;
      document.body.append(o.c, fx);
      card.classList.add('is-gone');
      setTimeout(() => { o.c.remove(); fx.remove(); done(); }, 620);
    });
  }
  // Rappel classé : le post-it se décolle, se déchire en deux et les morceaux tombent.
  function tearNote(card) {
    return new Promise(done => {
      const a = overlayClone(card), b = overlayClone(card);
      a.c.classList.add('fx-tear', 'fx-tear-l');
      b.c.classList.add('fx-tear', 'fx-tear-r');
      document.body.append(a.c, b.c);
      card.classList.add('is-gone');
      setTimeout(() => { a.c.remove(); b.c.remove(); done(); }, 820);
    });
  }
  function validate(id) {
    const t = S.tasks.get(id);
    if (!t || S.leaving.has(id)) return;
    const card = cardEl(id);
    const finish = () => {
      S.leaving.delete(id);
      const cur = S.tasks.get(id);
      if (!cur) { render(); return; }
      const next = Object.assign({}, cur, { status: 'done', archived: true, archivedAt: Date.now() });
      commit(next);
      renderAnimated(focusAfterRemoval);
      Store.patch(id, { status: 'done', archived: true, archivedAt: next.archivedAt, updatedAt: next.updatedAt });
    };
    if (!card || reduced()) { finish(); return; }
    S.leaving.add(id);
    (t.kind === 'reminder' ? tearNote(card) : popBubble(card)).then(finish);
  }
  function restore(id, status, isUndo) {
    const t = S.tasks.get(id);
    if (!t) return;
    const back = status || 'todo';
    const next = Object.assign({}, t, { status: back, archived: false, archivedAt: null });
    commit(next);
    S.fresh.add(id);
    renderAnimated();
    Store.patch(id, { status: back, archived: false, archivedAt: null, updatedAt: next.updatedAt });
    toast('« ' + next.title + ' » est de retour dans la liste.');
  }
  function removeTask(id) {
    const t = S.tasks.get(id);
    if (!t) return;
    S.tasks.delete(id);
    S.expanded.delete(id);
    renderAnimated(focusAfterRemoval);
    Store.remove(id);
    toast(t.kind === 'reminder' ? 'Rappel supprimé.' : 'Tâche supprimée.');
  }

  /* ================= rendu animé : la liste glisse quand une carte arrive, part ou change de place ================= */
  const VT = typeof document.startViewTransition === 'function';
  // after : à faire juste après le nouveau rendu (remettre le focus, par exemple).
  function renderAnimated(after) {
    const run = () => { render(); if (after) after(); };
    if (!VT || reduced()) { run(); return; }
    S.vt = true;
    try {
      const tr = document.startViewTransition(run);
      tr.finished.then(() => { S.vt = false; }, () => { S.vt = false; });
    } catch (e) { S.vt = false; run(); }
  }

  /* ================= affichage ================= */
  const els = {
    title: $('#view-title'), sub: $('#sub'),
    authView: $('#view-auth'), tasksView: $('#view-tasks'), archiveView: $('#view-archive'),
    list: $('#task-list'), archive: $('#archive-list'), addRow: $('#add-row'), addBtn: $('#add-btn'),
    modeNote: $('#mode-note'), modeNoteText: $('#mode-note-text'), bottomBar: $('#bottom-bar'),
    toArchive: $('#to-archive'), toTasks: $('#to-tasks'), archiveCount: $('#archive-count')
  };
  els.addBtn.innerHTML = svgIco('plus', 24, 2.2);
  $('#settings-btn').innerHTML = svgIco('sliders', 20);
  $('#popout').innerHTML = svgIco('popout', 19);
  // Dans Claude : une fenêtre à part en plus (les réglages n'y montrent que ce qui marche dans la page).
  if (IN_CLAUDE) $('#popout').hidden = false;

  const cardEl = id => document.querySelector('.card[data-id="' + id + '"]');
  const byArchived = (a, b) => (b.archivedAt - a.archivedAt);
  const inFilter = t => S.filter === 'all' || t.cat === S.filter;
  // En retard : échéance passée, ou rappel d'aujourd'hui dont l'heure est passée.
  const isLate = (t, today, hm) => !!t.due && (t.due < today || (t.kind === 'reminder' && t.due === today && !!t.time && t.time <= hm));
  // Ordre de la liste : d'abord ce qui est en retard, puis l'urgence (haute en premier),
  // puis l'échéance la plus proche (les tâches datées avant les autres), l'heure, l'ancienneté.
  function sortTasks(list, today, hm) {
    const key = t => (t.due || '9999-99-99') + ' ' + (t.time || '99:99');
    return list.slice().sort((a, b) => (isLate(b, today, hm) - isLate(a, today, hm)) || (b.urg - a.urg) ||
      (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0) || (a.createdAt - b.createdAt));
  }

  // Une carte par tâche, comme sur le croquis.
  function cardHTML(t, archived, today, hm) {
    const open = S.expanded.has(t.id);
    const isR = t.kind === 'reminder';
    const st = archived ? 'done' : t.status;
    const stInfo = isR ? (RSTATUS[st] || RSTATUS.todo) : STATUS[st];
    const late = !archived && isLate(t, today, hm);
    const what = (isR ? 'le rappel' : 'la tâche') + ' « ' + t.title + ' »';
    const cls = 'card' + (open ? ' is-open' : '') + (archived ? ' is-archived' : '') + (S.leaving.has(t.id) ? ' is-gone' : '') +
      (S.fresh.has(t.id) && !reduced() && !S.vt ? ' is-new' : '') + (S.pop === t.id ? ' pop' : '') + (S.toggled === t.id ? ' just-toggled' : '');
    // Flottement : phase calée sur l'horloge (cycle de 7 s, décalé par carte) ; nom unique pour que la liste glisse.
    let h = 0;
    for (let i = 0; i < t.id.length; i++) h = (h * 31 + t.id.charCodeAt(i)) % 7000;
    const style = '--fd:-' + (((Date.now() + h) % 7000) / 1000).toFixed(2) + 's' + (VT ? ';view-transition-name:c-' + t.id.replace(/[^A-Za-z0-9_-]/g, '_') : '');
    const status = archived
      ? '<span class="status-box" data-st="done" role="img" aria-label="' + (isR ? 'Fait' : 'Validée') + '">' + STATUS_ICO.done() + '</span>'
      : '<button type="button" class="status-box" data-st="' + stInfo.icon + '" data-act="status" aria-haspopup="menu" aria-expanded="false" aria-label="' + esc('Statut de ' + what + ' : ' + stInfo.label + '. Changer le statut') + '">' + STATUS_ICO[stInfo.icon]() + '</button>';
    const urgLabel = 'Urgence ' + URG[t.urg].toLowerCase();
    const urg = archived
      ? '<span class="urg" data-urg="' + t.urg + '">' + dot(t.urg) + '<span>' + URG[t.urg] + '</span></span>'
      : '<button type="button" class="urg" data-urg="' + t.urg + '" data-act="urg" aria-haspopup="menu" aria-expanded="false" aria-label="' + esc(urgLabel + ' pour ' + what + '. Changer l\'urgence') + '">' + dot(t.urg) + '<span aria-hidden="true">' + URG[t.urg] + '</span></button>';
    let tail = '';
    if (archived) tail += '<span class="when">' + (isR ? 'Classé ' : 'Validée ') + when(t.archivedAt) + '</span>';
    else if (t.due) tail += '<span class="due' + (late ? ' late' : '') + '">' + svgIco(isR ? 'bell' : 'cal', 14) + '<span>' + esc(dayLabel(t.due, today)) + '</span>' + (t.time ? '<span class="tm">' + t.time + '</span>' : '') + '</span>';
    if (S.filter === 'all' && t.cat === 'perso') tail += '<span class="chip">Perso</span>';
    const actions = archived
      ? '<button type="button" class="btn btn-act" data-act="restore">' + svgIco('undo', 15) + '<span>Remettre dans la liste</span></button>' +
        '<button type="button" class="btn btn-act btn-danger" data-act="delete">' + svgIco('trash', 15) + '<span>Supprimer</span></button>'
      : (isR && t.due ? '<button type="button" class="btn btn-act" data-act="snooze">' + svgIco('clock', 15) + '<span>Reporter d\'1 h</span></button>' +
          '<button type="button" class="btn btn-act" data-act="tomorrow">' + svgIco('cal', 15) + '<span>Demain 9 h</span></button>' : '') +
        '<button type="button" class="btn btn-act" data-act="edit">' + svgIco('pencil', 15) + '<span>Modifier</span></button>' +
        '<button type="button" class="btn btn-act btn-danger" data-act="delete">' + svgIco('trash', 15) + '<span>Supprimer</span></button>';
    return '<article class="' + cls + '" style="' + style + '" data-id="' + esc(t.id) + '" data-kind="' + t.kind + '" data-status="' + st + '" data-urg="' + t.urg + '" data-cat="' + t.cat + '">' +
      '<div class="card-top">' + status +
        '<div class="card-text"><h3 class="card-title">' + esc(t.title) + '</h3></div>' +
        '<button type="button" class="more" data-act="toggle" aria-expanded="' + open + '" aria-controls="d-' + esc(t.id) + '" aria-label="' + (open ? 'Masquer' : 'Afficher') + ' la description">' + svgIco('plus', 18, 2) + '</button>' +
      '</div>' +
      '<div class="desc-wrap" id="d-' + esc(t.id) + '"' + (open ? '' : ' inert') + '><div class="desc-clip"><div class="desc">' +
        (t.desc ? '<p class="desc-text">' + esc(t.desc) + '</p>' : '<p class="desc-text is-empty">Pas de description.</p>') +
        '<p class="meta">' + (isR ? 'Créé ' : 'Créée ') + when(t.createdAt) + '</p>' +
        '<div class="desc-actions">' + actions + '</div>' +
      '</div></div></div>' +
      '<div class="card-foot">' + urg + '<span class="foot-subject">' + (t.subject ? '<span class="subject">' + esc(t.subject) + '</span>' : '') + '</span>' + tail + '</div>' +
    '</article>';
  }
  function emptyHTML(kind, hidden) {
    if (kind === 'archive') return '<div class="empty"><p class="empty-title">Archives vides</p><p>Les tâches validées et les rappels classés arrivent ici, avec la date.</p></div>';
    if (hidden) return '<div class="empty"><p class="empty-title">Rien en ' + CAT[S.filter].label + ' pour l\'instant</p><p>' + plural(hidden, 'élément') + ' ' + (S.filter === 'pro' ? 'perso' : 'pro') + (hidden > 1 ? ' sont masqués' : ' est masqué') + ' (réglages, Affichage sur cet appareil).</p></div>';
    return '<div class="empty"><p class="empty-title">Rien à faire pour l\'instant</p><p>Ajoute une tâche ou un rappel avec le bouton +.</p></div>';
  }
  const bootHTML = () => '<div class="boot" role="status"><span>Chargement de ta liste…</span><span class="boot-bar"></span></div>';

  function setSub(parts, lateText) {
    const all = parts.concat(lateText ? [lateText] : []);
    els.sub.innerHTML = (S.filter !== 'all' ? '<span class="flt">' + CAT[S.filter].label + '</span> ' : '') +
      all.map((x, i) => '<span class="part' + (lateText && i === all.length - 1 ? ' late' : '') + '">' + esc(x) + '</span>').join(' · ');
  }
  let lastSig = '';
  function render() {
    const focus = captureFocus();
    const signedOut = S.mode === 'firebase' && S.authChecked && !S.user;
    const isArchive = S.view === 'archive' && !signedOut;
    const ready = S.loaded && S.authChecked;
    els.authView.hidden = !signedOut;
    els.tasksView.hidden = signedOut || isArchive;
    els.archiveView.hidden = !isArchive;
    els.bottomBar.hidden = signedOut || !ready;
    els.toArchive.hidden = isArchive;
    els.toTasks.hidden = !isArchive;
    els.title.textContent = isArchive ? 'Archives' : 'To do list';
    $('#toast').classList.toggle('low', els.bottomBar.hidden);
    if (signedOut) { setSub(['Connecte-toi pour retrouver ta liste']); return; }
    const today = todayISO(), hm = nowHM();
    const everything = Array.from(S.tasks.values());
    const all = everything.filter(inFilter);
    const current = all.filter(t => !t.archived);
    const archived = all.filter(t => t.archived).sort(byArchived);
    els.archiveCount.textContent = String(archived.length);
    if (!ready) {
      setSub(['Chargement…']);
      els.list.innerHTML = bootHTML();
      els.addRow.hidden = true;
      els.modeNote.hidden = true;
      return;
    }
    if (isArchive) {
      setSub([archived.length ? plural(archived.length, 'entrée') + ' archivée' + (archived.length > 1 ? 's' : '') : 'Rien dans les archives pour l\'instant']);
      els.archive.innerHTML = archived.length ? archived.map(t => cardHTML(t, true, today, hm)).join('') : emptyHTML('archive');
    } else {
      const tasks = current.filter(t => t.kind === 'task').length;
      const rem = current.length - tasks;
      const late = current.filter(t => isLate(t, today, hm)).length;
      const day = cap(dayFmt.format(new Date()));
      const parts = [day, tasks ? plural(tasks, 'tâche') : (rem ? 'aucune tâche' : 'rien de prévu')];
      if (rem) parts.push(plural(rem, 'rappel'));
      setSub(parts, late ? late + ' en retard' : '');
      const hidden = everything.filter(t => !t.archived && !inFilter(t)).length;
      els.list.innerHTML = current.length ? sortTasks(current, today, hm).map(t => cardHTML(t, false, today, hm)).join('') : emptyHTML('tasks', hidden);
      els.addRow.hidden = false;
      if (S.mode === 'local') {
        els.modeNote.hidden = false;
        els.modeNoteText.textContent = IN_CLAUDE
          ? 'Synchro indisponible pour l\'instant : tes tâches restent dans ce navigateur.'
          : location.protocol === 'file:'
          ? 'Mode local : tes tâches restent dans ce navigateur. Pour la synchro PC ↔ iPhone, mets l\'appli en ligne (voir le guide d\'installation).'
          : 'Mode local : config.js n\'est pas encore rempli, tes tâches restent sur cet appareil (voir le guide d\'installation).';
      } else {
        els.modeNote.hidden = true;
      }
    }
    lastSig = signature();
    S.fresh.clear();
    S.pop = S.toggled = null;
    restoreFocus(focus);
    syncMenuAnchor();
    updateBadge();
    checkAlerts();
  }
  function captureFocus() {
    const a = document.activeElement;
    if (!a || !a.dataset || !a.dataset.act) return null;
    const card = a.closest('.card');
    return card ? { id: card.dataset.id, act: a.dataset.act } : null;
  }
  function restoreFocus(f) {
    if (!f) return;
    const card = cardEl(f.id);
    const el = card && card.querySelector('[data-act="' + f.act + '"]');
    if (el && el !== document.activeElement) el.focus({ preventScroll: true });
  }
  function focusAfterRemoval() {
    if (document.activeElement && document.activeElement !== document.body && document.contains(document.activeElement)) return;
    const first = (S.view === 'archive' ? els.archive : els.list).querySelector('[data-act="status"], [data-act="restore"]');
    (first || (S.view === 'archive' ? els.toTasks : els.addBtn)).focus({ preventScroll: true });
  }

  /* ================= menus statut / urgence ================= */
  const menu = $('#menu');
  let menuState = null;
  function openMenu(anchor, kind, id) {
    closeMenu();
    const t = S.tasks.get(id);
    if (!t) return;
    let items;
    if (kind === 'status') {
      const map = t.kind === 'reminder' ? RSTATUS : STATUS;
      items = Object.keys(map).map(v => ({ value: v, icon: '<span class="status-box" data-st="' + map[v].icon + '" style="width:26px;height:26px">' + STATUS_ICO[map[v].icon]().replace(/width="\d+" height="\d+"/, 'width="16" height="16"') + '</span>', label: map[v].label, checked: t.status === v }));
    } else {
      items = [3, 2, 1].map(v => ({ value: String(v), icon: dot(v), label: URG[v], checked: t.urg === v }));
    }
    // Petit menu compact, juste à côté de la case touchée.
    menu.className = 'menu';
    menu.innerHTML = items.map(it =>
      '<button type="button" class="menu-item" role="menuitemradio" aria-checked="' + it.checked + '" data-value="' + it.value + '">' +
        '<span class="mi-ico">' + it.icon + '</span><span>' + it.label + '</span>' + (it.checked ? '<span class="mi-ok">' + svgIco('check', 15) + '</span>' : '') + '</button>').join('');
    menu.setAttribute('aria-label', kind === 'status' ? 'Statut' : 'Urgence');
    menu.hidden = false;
    menuState = { kind: kind, id: id };
    anchor.setAttribute('aria-expanded', 'true');
    const above = placeMenu(anchor);
    if (!reduced()) {
      menu.style.setProperty('--origin', above ? 'left bottom' : 'left top');
      void menu.offsetWidth;
      menu.classList.add('is-opening');
    }
    (menu.querySelector('[aria-checked="true"]') || menu.querySelector('.menu-item')).focus({ preventScroll: true });
  }
  menu.addEventListener('animationend', e => { if (e.target === menu) menu.classList.remove('is-opening'); });
  function placeMenu(anchor) {
    const r = anchor.getBoundingClientRect();
    const m = menu.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const gap = 6;
    const left = Math.min(Math.max(10, r.left - 2), vw - m.width - 10);
    let top = r.bottom + gap;
    let above = false;
    if (top + m.height > vh - 10) { top = Math.max(10, r.top - m.height - gap); above = true; }
    menu.style.left = Math.round(left) + 'px';
    menu.style.top = Math.round(top) + 'px';
    return above;
  }
  function anchorFor(state) {
    const card = state && cardEl(state.id);
    return card && card.querySelector('[data-act="' + state.kind + '"]');
  }
  function syncMenuAnchor() {
    if (!menuState) return;
    const a = anchorFor(menuState);
    if (!a) { closeMenu(); return; }
    a.setAttribute('aria-expanded', 'true');
    placeMenu(a);
  }
  function closeMenu(returnFocus) {
    if (!menuState) return;
    const a = anchorFor(menuState);
    if (a) a.setAttribute('aria-expanded', 'false');
    menu.hidden = true;
    menu.innerHTML = '';
    const was = menuState;
    menuState = null;
    if (returnFocus) { const back = anchorFor(was); if (back) back.focus({ preventScroll: true }); }
  }
  menu.addEventListener('click', e => {
    const item = e.target.closest('.menu-item');
    if (!item || !menuState) return;
    const st = menuState;
    const value = item.dataset.value;
    closeMenu(value !== 'done');
    if (st.kind === 'status') setStatus(st.id, value); else setUrg(st.id, Number(value));
  });
  menu.addEventListener('keydown', e => {
    const items = Array.from(menu.querySelectorAll('.menu-item'));
    const i = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
    else if (e.key === 'Home') { e.preventDefault(); items[0].focus(); }
    else if (e.key === 'End') { e.preventDefault(); items[items.length - 1].focus(); }
    else if (e.key === 'Escape') { e.preventDefault(); closeMenu(true); }
    else if (e.key === 'Tab') { closeMenu(true); }
  });
  document.addEventListener('pointerdown', e => {
    if (!menuState || menu.contains(e.target)) return;
    const a = anchorFor(menuState);
    if (a && a.contains(e.target)) return;
    closeMenu(false);
  }, true);
  window.addEventListener('resize', () => closeMenu(false));
  window.addEventListener('scroll', () => { if (menuState) syncMenuAnchor(); }, { passive: true });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && menuState) closeMenu(true); });

  /* ================= clics dans la liste ================= */
  function askDelete(id) {
    const t = S.tasks.get(id);
    if (!t) return;
    const isR = t.kind === 'reminder';
    confirmBox('Supprimer ?', (isR ? 'Le rappel « ' : 'La tâche « ') + t.title + ' » sera supprimé' + (isR ? '' : 'e') + ' pour de bon.', 'Supprimer', () => removeTask(id));
  }
  function toggleCard(card, id) {
    const open = !S.expanded.has(id);
    if (open) S.expanded.add(id); else S.expanded.delete(id);
    const wrap = card.querySelector('.desc-wrap');
    const btn = card.querySelector('[data-act="toggle"]');
    if (!open && wrap && wrap.contains(document.activeElement) && btn) btn.focus({ preventScroll: true });
    card.classList.toggle('is-open', open);
    if (wrap) { if (open) wrap.removeAttribute('inert'); else wrap.setAttribute('inert', ''); }
    if (btn) {
      btn.setAttribute('aria-expanded', String(open));
      btn.setAttribute('aria-label', (open ? 'Masquer' : 'Afficher') + ' la description');
    }
    // Carte ouverte près du bas de l'écran : on la fait remonter doucement pour voir ce qui vient de s'ouvrir.
    if (open) setTimeout(() => {
      if (!card.isConnected) return;
      const r = card.getBoundingClientRect(), limit = window.innerHeight - 96;
      if (r.bottom > limit) window.scrollBy({ top: Math.min(r.bottom - limit, r.top - 90), behavior: reduced() ? 'auto' : 'smooth' });
    }, 420);
  }
  function onListClick(e) {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const card = btn.closest('.card');
    if (!card) return;
    const id = card.dataset.id;
    const act = btn.dataset.act;
    if (act === 'status' || act === 'urg') {
      if (menuState && menuState.id === id && menuState.kind === act) { closeMenu(true); return; }
      openMenu(btn, act, id);
    } else if (act === 'toggle') {
      toggleCard(card, id);
    } else if (act === 'edit') {
      openTaskDialog(id);
    } else if (act === 'delete') {
      askDelete(id);
    } else if (act === 'restore') {
      restore(id);
    } else if (act === 'snooze') {
      snooze(id, '1h');
    } else if (act === 'tomorrow') {
      snooze(id, 'tomorrow');
    }
  }
  els.list.addEventListener('click', onListClick);
  els.archive.addEventListener('click', onListClick);
  function switchView(view) {
    closeMenu(false);
    S.view = view;
    render();
    window.scrollTo(0, 0);
    (view === 'archive' ? els.toTasks : els.toArchive).focus({ preventScroll: true });
  }
  els.toArchive.addEventListener('click', () => switchView('archive'));
  els.toTasks.addEventListener('click', () => switchView('tasks'));

  /* ================= fenêtres ================= */
  const openDlg = d => { if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', ''); };
  // Ferme avec une petite animation (la feuille redescend sur téléphone) ; renvoie une promesse quand c'est fini.
  function closeDlg(d) {
    return new Promise(res => {
      if (!d.open) { res(); return; }
      if (typeof d.close !== 'function') { d.removeAttribute('open'); res(); return; }
      if (reduced()) { d.close(); res(); return; }
      let ended = false;
      const end = () => { if (ended) return; ended = true; d.classList.remove('is-closing'); d.close(); res(); };
      d.classList.add('is-closing');
      d.addEventListener('animationend', e => { if (e.target === d) end(); });
      setTimeout(end, 280);
    });
  }
  document.querySelectorAll('dialog').forEach(d => d.addEventListener('cancel', e => { e.preventDefault(); closeDlg(d); }));

  const dlg = $('#task-dlg');
  const form = $('#task-form');
  const fTitle = $('#f-title'), fSubject = $('#f-subject'), fDesc = $('#f-desc'), fErr = $('#f-title-err'), fParse = $('#f-parse');
  const fDue = $('#f-due'), fTime = $('#f-time'), fWhenLegend = $('#f-when-legend'), fQuickDates = $('#f-quick-dates');
  let editingId = null;
  const formKind = () => ($('#f-kind-reminder').checked ? 'reminder' : 'task');
  function syncDialogTitle() {
    const k = formKind();
    $('#dlg-title').textContent = editingId ? (k === 'reminder' ? 'Modifier le rappel' : 'Modifier la tâche') : (k === 'reminder' ? 'Nouveau rappel' : 'Nouvelle tâche');
    // Un rappel a une date et une heure ; une tâche, une échéance (jour seulement).
    fTime.hidden = k !== 'reminder';
    fWhenLegend.innerHTML = (k === 'reminder' ? 'Date et heure' : 'Échéance') + ' <span class="field-hint">(facultatif)</span>';
    syncQuickDates();
    syncParse();
  }
  const quickDates = () => { const today = todayISO(); return { today: today, tomorrow: addDays(today, 1), monday: nextWeekday(today, 1), none: '' }; };
  function syncQuickDates() {
    const q = quickDates();
    fQuickDates.querySelectorAll('.qd').forEach(b => b.setAttribute('aria-pressed', String((fDue.value || '') === q[b.dataset.d])));
  }
  fQuickDates.addEventListener('click', e => {
    const b = e.target.closest('.qd');
    if (!b) return;
    fDue.value = quickDates()[b.dataset.d];
    if (!fDue.value) fTime.value = '';
    syncQuickDates();
    syncParse();
  });
  fDue.addEventListener('input', () => { syncQuickDates(); syncParse(); });
  fDue.addEventListener('change', () => { syncQuickDates(); syncParse(); });
  // Une heure sans date : aujourd'hui si l'heure est encore à venir, sinon demain.
  fTime.addEventListener('change', () => {
    if (fTime.value && !fDue.value) { const today = todayISO(); fDue.value = fTime.value > nowHM() ? today : addDays(today, 1); syncQuickDates(); }
    syncParse();
  });
  // Date ou heure écrite dans le titre (« Appeler Martin demain 14h ») : lue seulement si la date n'est pas remplie.
  function titleParse() {
    const v = fTitle.value.trim();
    if (!v || fDue.value) return null;
    const q = parseQuick(v, todayISO(), nowHM());
    return q.due || q.urg ? q : null;
  }
  function syncParse() {
    const q = titleParse();
    if (!q) { fParse.hidden = true; fParse.textContent = ''; return; }
    const bits = [];
    if (q.due) bits.push((q.kind === 'reminder' ? 'rappel ' : 'échéance ') + lowFirst(dayLabel(q.due, todayISO())) + (q.time ? ' à ' + q.time : ''));
    if (q.urg === 3) bits.push('urgence haute');
    fParse.innerHTML = 'Compris : <b>' + esc(bits.join(', ')) + '</b>, titre « ' + esc(q.title) + ' »';
    fParse.hidden = false;
  }
  fTitle.addEventListener('input', syncParse);
  function openTaskDialog(id) {
    closeMenu(false);
    const t = id ? S.tasks.get(id) : null;
    editingId = t ? t.id : null;
    $('#dlg-ok').textContent = t ? 'Enregistrer' : 'Ajouter';
    fTitle.value = t ? t.title : '';
    fSubject.value = t ? t.subject : '';
    fDesc.value = t ? t.desc : '';
    const kind = t ? t.kind : prefs.kind;
    const cat = t ? t.cat : (S.filter !== 'all' ? S.filter : prefs.cat);
    const urg = t ? t.urg : prefs.urg;
    fDue.value = t ? (t.due || '') : '';
    fTime.value = t ? (t.time || '') : '';
    $('#f-kind-' + (kind === 'reminder' ? 'reminder' : 'task')).checked = true;
    $('#f-cat-' + (cat === 'perso' ? 'perso' : 'pro')).checked = true;
    $('#f-urg-' + ([1, 2, 3].includes(urg) ? urg : 2)).checked = true;
    syncDialogTitle();
    fErr.hidden = true;
    fTitle.removeAttribute('aria-invalid');
    openDlg(dlg);
    fTitle.focus();
  }
  $('#f-kind-task').addEventListener('change', syncDialogTitle);
  $('#f-kind-reminder').addEventListener('change', syncDialogTitle);
  els.addBtn.addEventListener('click', () => openTaskDialog(null));
  $('#dlg-cancel').addEventListener('click', () => closeDlg(dlg));
  dlg.addEventListener('click', e => { if (e.target === dlg) closeDlg(dlg); });
  form.addEventListener('submit', e => {
    e.preventDefault();
    let title = fTitle.value.trim();
    if (!title) {
      fErr.hidden = false;
      fTitle.setAttribute('aria-invalid', 'true');
      fTitle.setAttribute('aria-describedby', 'f-title-err f-parse');
      fTitle.focus();
      return;
    }
    const chosenKind = formKind();
    let kind = chosenKind;
    const cat = (form.querySelector('input[name="cat"]:checked') || {}).value === 'perso' ? 'perso' : 'pro';
    let urg = Number((form.querySelector('input[name="urg"]:checked') || {}).value) || 2;
    let due = isISO(fDue.value) ? fDue.value : null;
    let time = due && isHM(fTime.value) ? fTime.value : null;
    const q = titleParse();
    if (q) {
      title = q.title;
      if (q.due) { due = q.due; time = q.time; }
      if (q.time) kind = 'reminder';
      if (q.urg) urg = q.urg;
    }
    if (kind !== 'reminder') time = null;
    const fields = { kind: kind, title: title.slice(0, 80), subject: fSubject.value.trim(), desc: fDesc.value.trim(), cat: cat, urg: urg, due: due, time: time };
    const wasEditing = editingId;
    editingId = null;
    closeDlg(dlg).then(() => {
      if (wasEditing) editTask(wasEditing, fields);
      else { prefs.cat = cat; prefs.kind = chosenKind; savePrefs(); addTask(fields); }
    });
  });
  fTitle.addEventListener('input', () => { if (fTitle.value.trim()) { fErr.hidden = true; fTitle.removeAttribute('aria-invalid'); } });

  const cdlg = $('#confirm-dlg');
  let confirmAction = null;
  function confirmBox(title, text, okLabel, action) {
    closeMenu(false);
    $('#confirm-title').textContent = title;
    $('#confirm-text').textContent = text;
    $('#confirm-yes').textContent = okLabel;
    confirmAction = action;
    openDlg(cdlg);
    $('#confirm-no').focus();
  }
  $('#confirm-no').addEventListener('click', () => { confirmAction = null; closeDlg(cdlg); });
  $('#confirm-yes').addEventListener('click', () => { const a = confirmAction; confirmAction = null; closeDlg(cdlg).then(() => { if (a) a(); }); });
  cdlg.addEventListener('click', e => { if (e.target === cdlg) { confirmAction = null; closeDlg(cdlg); } });

  // Sur PC : N (ou +) pour une nouvelle tâche.
  document.addEventListener('keydown', e => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
    const el = e.target;
    if (el && (el.isContentEditable || /^(input|textarea|select)$/i.test(el.tagName))) return;
    if (menuState || document.querySelector('dialog[open]') || els.addRow.hidden || els.tasksView.hidden) return;
    if (e.key === 'n' || e.key === 'N' || e.key === '+') { e.preventDefault(); openTaskDialog(null); }
  });

  /* ================= rappels à l'heure (appli ouverte) + pastille ================= */
  const NOTIF_KEY = 'todo-notified';
  const notified = new Set(lsGet(NOTIF_KEY, []));
  function checkAlerts() {
    if (!S.loaded || !S.authChecked) return;
    const today = todayISO(), hm = nowHM();
    let changed = false;
    S.tasks.forEach(t => {
      if (t.archived || t.kind !== 'reminder' || !t.due || !t.time) return;
      if (t.due > today || (t.due === today && t.time > hm)) return;
      const key = t.id + '|' + t.due + '|' + t.time;
      if (notified.has(key)) return;
      notified.add(key);
      changed = true;
      // Passé depuis plus de 2 h (appli fermée à ce moment-là) : juste affiché « en retard », sans alerte.
      const late = daysBetween(t.due, today) * 1440 + minutesOf(hm) - minutesOf(t.time);
      if (late <= 120) fireAlert(t);
    });
    if (changed) lsSet(NOTIF_KEY, Array.from(notified).slice(-300));
  }
  function fireAlert(t) {
    toast('Rappel ' + t.time + ' : « ' + t.title + ' »', 'Reporter d\'1 h', () => snooze(t.id, '1h'));
    if (!prefs.alerts || S.mode === 'claude' || !('Notification' in window) || Notification.permission !== 'granted') return;
    const title = 'Rappel · ' + t.time;
    const opts = { body: t.title + (t.subject ? '\n' + t.subject : ''), icon: 'icons/icon-192.png', badge: 'icons/badge-72.png', tag: 'rappel-' + t.id, requireInteraction: true, data: { url: './' } };
    const direct = () => { try { new Notification(title, opts); } catch (e) { /* notification impossible ici */ } };
    if ('serviceWorker' in navigator) navigator.serviceWorker.getRegistration().then(reg => (reg ? reg.showNotification(title, opts) : direct())).catch(direct);
    else direct();
  }
  // Pastille sur l'icône de l'appli installée (barre des tâches) : nombre d'éléments en retard.
  function updateBadge() {
    if (S.mode === 'claude' || !('setAppBadge' in navigator) || !S.loaded) return;
    const today = todayISO(), hm = nowHM();
    let n = 0;
    S.tasks.forEach(t => { if (!t.archived && inFilter(t) && isLate(t, today, hm)) n++; });
    const p = n ? navigator.setAppBadge(n) : navigator.clearAppBadge();
    if (p && p.catch) p.catch(() => { /* pastille non gérée */ });
  }
  // Redessine quand un rappel passe l'heure ou quand le jour change.
  function signature() {
    const today = todayISO(), hm = nowHM();
    let late = '';
    S.tasks.forEach(t => { if (!t.archived && isLate(t, today, hm)) late += t.id + ','; });
    return today + '|' + late;
  }
  function tick() {
    checkAlerts();
    if (S.loaded && !menuState && signature() !== lastSig) render();
  }
  setInterval(tick, 20000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });

  /* ================= sign-in ================= */
  const aEmail = $('#a-email'), aPass = $('#a-pass'), aErr = $('#a-err');
  function authError(e) {
    const code = (e && e.code) || '';
    const map = {
      'auth/invalid-email': 'Adresse e-mail invalide.',
      'auth/missing-email': 'Entre ton adresse e-mail.',
      'auth/missing-password': 'Entre ton mot de passe.',
      'auth/invalid-credential': 'E-mail ou mot de passe incorrect.',
      'auth/wrong-password': 'E-mail ou mot de passe incorrect.',
      'auth/user-not-found': 'Aucun compte avec cet e-mail : crée ton compte.',
      'auth/email-already-in-use': 'Un compte existe déjà avec cet e-mail : connecte-toi.',
      'auth/weak-password': 'Mot de passe trop court : 6 caractères minimum.',
      'auth/too-many-requests': 'Trop d\'essais. Réessaie dans quelques minutes.',
      'auth/network-request-failed': 'Pas de connexion internet.',
      'auth/operation-not-allowed': 'La connexion par e-mail n\'est pas activée dans Firebase (étape 3.2 du guide).',
      'auth/configuration-not-found': 'La connexion par e-mail n\'est pas activée dans Firebase (étape 3.2 du guide).'
    };
    return map[code] || ('Connexion impossible (' + (code || 'erreur inconnue') + ').');
  }
  function showAuthError(msg) { aErr.textContent = msg; aErr.hidden = !msg; }
  function authBusy(on) { ['#a-login', '#a-signup', '#a-reset'].forEach(s => { $(s).disabled = on; }); }
  $('#auth-form').addEventListener('submit', e => {
    e.preventDefault();
    showAuthError('');
    authBusy(true);
    FB.signInWithEmailAndPassword(fb.auth, aEmail.value.trim(), aPass.value)
      .catch(err => showAuthError(authError(err)))
      .finally(() => authBusy(false));
  });
  $('#a-signup').addEventListener('click', () => {
    showAuthError('');
    if (aPass.value.length < 6) { showAuthError('Choisis un mot de passe de 6 caractères minimum.'); aPass.focus(); return; }
    authBusy(true);
    FB.createUserWithEmailAndPassword(fb.auth, aEmail.value.trim(), aPass.value)
      .then(() => toast('Compte créé. Bienvenue !'))
      .catch(err => showAuthError(authError(err)))
      .finally(() => authBusy(false));
  });
  $('#a-reset').addEventListener('click', () => {
    showAuthError('');
    const email = aEmail.value.trim();
    if (!email) { showAuthError('Entre ton e-mail, puis touche à nouveau « Mot de passe oublié ? ».'); aEmail.focus(); return; }
    FB.sendPasswordResetEmail(fb.auth, email)
      .then(() => toast('E-mail envoyé : suis le lien pour choisir un nouveau mot de passe.'))
      .catch(err => showAuthError(authError(err)));
  });

  /* ================= réglages : affichage, alertes, récap du matin, compte ================= */
  const sdlg = $('#settings-dlg');
  const recapStatus = $('#recap-status'), recapOn = $('#recap-on'), recapOff = $('#recap-off'), recapTest = $('#recap-test');
  let recapSub = null;
  const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  function b64ToBytes(b64) {
    const pad = '='.repeat((4 - b64.length % 4) % 4);
    const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(raw, c => c.charCodeAt(0));
  }
  async function subId(endpoint) {
    const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(endpoint));
    return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
  }
  const deviceName = () => isIOS ? 'iPhone' : (/Android/i.test(navigator.userAgent) ? 'Android' : 'PC');
  function setHourChoice(h) { const el = $('#h-' + h); if (el) el.checked = true; }
  async function refreshRecap() {
    recapOff.hidden = true;
    recapOn.hidden = false;
    recapOn.disabled = false;
    recapTest.disabled = false;
    setHourChoice(prefs.hour);
    if (S.mode === 'claude') {
      recapStatus.textContent = 'Le récap du matin marche dans l\'appli installée (voir le guide d\'installation).';
      recapOn.disabled = true;
      recapTest.disabled = true;
      return;
    }
    if (S.mode !== 'firebase') {
      recapStatus.textContent = 'Disponible une fois l\'appli en ligne avec Firebase (voir le guide d\'installation).';
      recapOn.disabled = true;
      return;
    }
    if (!VAPID_KEY) {
      recapStatus.textContent = 'Il manque la clé de notification dans config.js (étape 7.2 du guide).';
      recapOn.disabled = true;
      return;
    }
    if (!pushSupported()) {
      recapStatus.textContent = isIOS && !isStandalone()
        ? 'Sur iPhone, ajoute d\'abord l\'appli à l\'écran d\'accueil (Partager → Sur l\'écran d\'accueil), puis ouvre-la depuis l\'icône.'
        : 'Ce navigateur ne gère pas les notifications de l\'appli.';
      recapOn.disabled = true;
      recapTest.disabled = true;
      return;
    }
    if (Notification.permission === 'denied') {
      recapStatus.textContent = 'Les notifications sont bloquées pour l\'appli. Autorise-les dans les réglages de l\'appareil.';
      recapOn.disabled = true;
      return;
    }
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const id = await subId(sub.endpoint);
        const snap = await FB.getDoc(FB.doc(fb.db, 'users', S.user.uid, 'push', id));
        if (snap.exists() && snap.data().enabled !== false) {
          recapSub = { sub: sub, id: id };
          const h = Number(snap.data().hour) || prefs.hour;
          setHourChoice(h);
          recapStatus.textContent = 'Activé sur cet appareil : récap chaque matin vers ' + h + ' h.';
          recapOn.hidden = true;
          recapOff.hidden = false;
          return;
        }
      }
      recapSub = null;
      recapStatus.textContent = 'Pas encore activé sur cet appareil.';
    } catch (e) {
      recapStatus.textContent = 'Impossible de lire l\'état des notifications (' + ((e && e.code) || (e && e.name) || 'erreur') + ').';
    }
  }
  async function enableRecap() {
    recapOn.disabled = true;
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { await refreshRecap(); toast('Notifications refusées : le récap ne pourra pas s\'afficher.'); return; }
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(VAPID_KEY) });
      const id = await subId(sub.endpoint);
      await FB.setDoc(FB.doc(fb.db, 'users', S.user.uid, 'push', id), {
        subscription: JSON.parse(JSON.stringify(sub)),
        hour: prefs.hour,
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Paris',
        enabled: true,
        device: deviceName(),
        updatedAt: Date.now()
      }, { merge: true });
      toast('Récap du matin activé vers ' + prefs.hour + ' h.');
    } catch (e) {
      toast('Activation impossible : ' + ((e && e.message) || 'erreur inconnue'));
    }
    await refreshRecap();
  }
  async function disableRecap() {
    if (!recapSub) return refreshRecap();
    try {
      await FB.deleteDoc(FB.doc(fb.db, 'users', S.user.uid, 'push', recapSub.id));
      await recapSub.sub.unsubscribe();
      toast('Récap du matin désactivé sur cet appareil.');
    } catch (e) {
      toast('Désactivation impossible : ' + ((e && e.message) || 'erreur inconnue'));
    }
    recapSub = null;
    await refreshRecap();
  }
  $('#hour-row').addEventListener('change', async e => {
    const h = Number(e.target.value);
    if (!h) return;
    prefs.hour = h;
    savePrefs();
    if (recapSub && S.mode === 'firebase') {
      try {
        await FB.updateDoc(FB.doc(fb.db, 'users', S.user.uid, 'push', recapSub.id), { hour: h, updatedAt: Date.now() });
        recapStatus.textContent = 'Activé sur cet appareil : récap chaque matin vers ' + h + ' h.';
      } catch (err) { toast(fsError(err)); }
    }
  });
  recapOn.addEventListener('click', enableRecap);
  recapOff.addEventListener('click', disableRecap);
  recapTest.addEventListener('click', async () => {
    try {
      if (!('Notification' in window)) { toast('Ce navigateur ne gère pas les notifications.'); return; }
      const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
      if (perm !== 'granted') { toast('Notifications refusées.'); return; }
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification('Récap du matin', { body: 'Test réussi : les notifs de l\'appli s\'affichent bien.', icon: 'icons/icon-192.png', badge: 'icons/badge-72.png', tag: 'test' });
    } catch (e) {
      toast('Test impossible : ' + ((e && e.message) || 'erreur inconnue'));
    }
  });

  const alertsStatus = $('#alerts-status'), alertsOn = $('#alerts-on');
  function refreshAlerts() {
    if (!('Notification' in window)) {
      alertsStatus.textContent = 'Ce navigateur ne gère pas les notifications : les rappels s\'affichent en bas de l\'appli.';
      alertsOn.hidden = true;
      return;
    }
    if (Notification.permission === 'denied') {
      alertsStatus.textContent = 'Notifications bloquées pour l\'appli : autorise-les dans les réglages du navigateur ou de l\'appareil.';
      alertsOn.hidden = true;
      return;
    }
    const on = prefs.alerts && Notification.permission === 'granted';
    alertsStatus.textContent = on ? 'Activées sur cet appareil.' : 'Pas encore activées ici : pour l\'instant, les rappels s\'affichent seulement en bas de l\'appli.';
    alertsOn.hidden = on;
  }
  alertsOn.addEventListener('click', async () => {
    try {
      const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
      prefs.alerts = perm === 'granted';
      savePrefs();
      toast(prefs.alerts ? 'Alertes des rappels activées sur cet appareil.' : 'Notifications refusées : les rappels s\'afficheront seulement dans l\'appli.');
    } catch (e) {
      toast('Activation impossible : ' + ((e && e.message) || 'erreur inconnue'));
    }
    refreshAlerts();
  });

  $('#filter-row').addEventListener('change', e => {
    if (e.target.name !== 'filter' || e.target.value === S.filter) return;
    S.filter = e.target.value;
    prefs.filter = S.filter;
    savePrefs();
    render();
  });
  function openSettings() {
    closeMenu(false);
    $('#fl-' + S.filter).checked = true;
    $('#set-account').textContent = S.mode === 'firebase' && S.user
      ? 'Connecté avec ' + S.user.email + '. Tes tâches sont synchronisées sur tous tes appareils.'
      : S.mode === 'claude'
        ? 'Ta liste est enregistrée dans ton compte Claude et synchronisée entre tes appareils.'
        : 'Mode local : pas de compte, tes tâches restent sur cet appareil.';
    $('#set-logout').hidden = !(S.mode === 'firebase' && S.user);
    // Dans la page Claude : ni récap, ni démarrage du PC, ni notifications (réservés à l'appli installée).
    $('#set-pc').hidden = S.mode === 'claude';
    $('#set-recap').hidden = S.mode === 'claude';
    $('#set-alerts').hidden = S.mode === 'claude';
    $('#set-keys').hidden = !finePointer();
    openDlg(sdlg);
    refreshAlerts();
    if (S.mode !== 'claude') refreshRecap();
  }
  $('#settings-btn').addEventListener('click', openSettings);
  $('#settings-close').addEventListener('click', () => closeDlg(sdlg));
  sdlg.addEventListener('click', e => { if (e.target === sdlg) closeDlg(sdlg); });
  $('#set-logout').addEventListener('click', () => {
    closeDlg(sdlg);
    FB.signOut(fb.auth).then(() => toast('Déconnecté.')).catch(err => toast(authError(err)));
  });

  /* ================= separate window (page Claude) ================= */
  const SELF_URL = 'https://claude.ai/artifact/Rsqd2GMgE7tqe4g5FP6GEm';
  const pdlg = $('#popout-dlg');
  $('#popout-url').textContent = SELF_URL;
  $('#popout-link').href = SELF_URL;
  function openPopout() {
    closeMenu(false);
    let w = null;
    try { w = window.open(SELF_URL, 'todo-list', 'popup=yes,width=440,height=860'); } catch (e) { w = null; }
    if (w) { toast('Fenêtre ouverte : place-la où tu veux.'); return; }
    openDlg(pdlg);
    $('#popout-link').focus();
  }
  $('#popout').addEventListener('click', openPopout);
  $('#popout-close').addEventListener('click', () => closeDlg(pdlg));
  pdlg.addEventListener('click', e => { if (e.target === pdlg) closeDlg(pdlg); });
  $('#popout-copy').addEventListener('click', () => {
    const done = () => toast('Lien copié.');
    const fallback = () => {
      const r = document.createRange();
      r.selectNodeContents($('#popout-url'));
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(r);
      toast('Lien sélectionné : fais Ctrl+C pour le copier.');
    };
    try { navigator.clipboard.writeText(SELF_URL).then(done, fallback); } catch (e) { fallback(); }
  });

  /* ================= message en bas ================= */
  const toastEl = $('#toast'), toastText = $('#toast-text'), toastAct = $('#toast-act'), toastSr = $('#toast-sr');
  let toastTimer = 0, toastAction = null;
  function toast(msg, actionLabel, action) {
    clearTimeout(toastTimer);
    toastAction = action || null;
    toastAct.hidden = !actionLabel;
    toastAct.textContent = actionLabel || '';
    toastText.textContent = msg;
    toastSr.textContent = msg;
    toastEl.hidden = false;
    toastTimer = setTimeout(hideToast, actionLabel ? 6000 : 3600);
  }
  function hideToast() { clearTimeout(toastTimer); toastEl.hidden = true; toastAction = null; }
  toastAct.addEventListener('click', () => { const a = toastAction; hideToast(); if (a) a(); });

  /* ================= démarrage ================= */
  // Seulement pour l'appli installable (la page Claude n'a pas de manifeste ni de sw.js).
  if (S.mode !== 'claude' && document.querySelector('link[rel="manifest"]') && 'serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* hors ligne indisponible, l'appli marche quand même */ });
  }
  render();
  if (S.mode === 'firebase') startFirebase();
  else if (S.mode === 'claude') startClaude();
  else startLocal();
})();
