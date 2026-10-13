/* To do list (PWA) — deux styles au choix par appareil : Bureau (sobre, par défaut) et Aventure (pixel art).
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

  /* ================= sprites ================= */
  // Ton perso : en mage pour le pro, en troll-gobelin pour le perso (même visage, même barbe, mêmes boucles d'oreilles).
  const CHAR = {
    perso: ["................", "................", "................", "................", "................", "................", ".....kkkkkk.....", "....kfffeeek....", "k..kffeeeeeEk..k", "kk.keeeeeeeEk.kk", "kekkEbbeebbEkkEk", "keeeexkeekxeEEEk", ".keeeekeekeeEEk.", "..kkeeeEEeeeEkk.", ".y.kbwbbbbwbk.y.", "....kbbmmbbk....", ".....bbbbbb.....", "......bbbb......", "...kkuuuuuukk...", "..keuuuUuuuuek..", ".keeuuuUuuuUeek.", ".keEkuuUuuuUkEk.", ".kekvvvvvvvvkek.", "..k.kuuUzuuUk.k.", "....kuuUzzuUk...", "....keEk.keEk...", "....keEk.keEk...", "...kkkk..kkkk..."],
    pro: ["........kk......", ".......kiHk.....", ".......kHHIk....", "......kiHyHk....", "......kHyyyIk...", ".....kiHHyHHIk..", "....kiHHHHHHHIk.", "...kYYYYYYYYYYk.", ".kkHHHHHHHHHHHkk", "kiHHHHHHHHHHHHIk", ".kkkkkkkkkkkkkk.", "..ksbbssssbbSk..", "kSSssksssskssSSk", "kSSssksssskssSSk", ".kkbsssSSsssbkk.", ".y.kbbbbbbbbk.y.", "....kbbmmbbk....", ".....bbbbbb.....", "......bbbb......", ".kkHHHyyyyHHHkk.", "kiHHHHHyyHHHHHIk", "kiHHHHHyyHHHHIIk", "kiiHHHHyyHHHHIIk", "khsHkYYYYYYkHsSk", ".kHHHHHyyHHHHIk.", ".kiHHHHyyHHHIIk.", ".kiHHHHyyHHHIIk.", "..kkkkkkkkkkkk.."]
  };
  // Lignes gardées pour le portrait des cartes (tête + épaules).
  const BUST = { pro: [0, 18], perso: [6, 24] };
  const ICON = {
    plus: ["..kk..", "..kk..", "kkkkkk", "kkkkkk", "..kk..", "..kk.."],
    minus: ["......", "......", "kkkkkk", "kkkkkk", "......", "......"],
    chevron: ["kk...", ".kk..", "..kk.", "...kk", "..kk.", ".kk..", "kk..."],
    chest: ["..kkkkkkkk..", ".kooooooook.", "kohooooooook", "kkkkkyykkkkk", "koooyYYyoook", "kooooyyooook", "kooooooooook", "kkkkkkkkkkkk"],
    back: ["...k.....", "..kk.....", ".kkkkkk..", "kkkkkkkk.", ".kkkkkkkk", "..kk...kk", "...k...kk", ".......kk", "...kkkkk.", "...kkkk.."],
    pencil: ["......kk.", ".....kook", "....kyyk.", "...kyyk..", "..kyyk...", ".kyyk....", ".kqk.....", "kk......."],
    trash: ["...kkk...", "kkkkkkkkk", ".k.....k.", ".k.k.k.k.", ".k.k.k.k.", ".k.k.k.k.", ".k.....k.", "..kkkkk.."],
    star: ["...y...", "...y...", "..yyy..", "yyywyyy", "..yyy..", "...y...", "...y..."],
    cursor: ["k...", "kk..", "kkk.", "kkkk", "kkk.", "kk..", "k..."],
    window: ["kkkkkkkkk", "kkkkkkkkk", "k.......k", "k...kkkkk", "k....kkkk", "k...kk.kk", "k..kk...k", "kkkkkkkkk"],
    mail: ["kkkkkkk", "kk...kk", "k.k.k.k", "k..k..k", "kkkkkkk"],
    clock: [".kkkkk.", "k..k..k", "k..k..k", "k..kk.k", "k.....k", "k.....k", ".kkkkk."],
    gear: ["...kkk...", ".k.kkk.k.", "..kkkkk..", "kkkk.kkkk", "kkk...kkk", "kkkk.kkkk", "..kkkkk..", ".k.kkk.k.", "...kkk..."],
    quill: ["........k", "......kwk", ".....kwWk", "....kwWk.", "...kwWk..", "..kwWk...", ".kWk.....", ".kk......", "k........"],
    tome: [".kkkkkkkkk.", "kPPPPPPPPPk", "kPgPPPPPgPk", "kPPPPyPPPPk", "kPPPyyyPPPk", "kPPPPyPPPPk", "kPPPPPPPPPk", "kPgPPPPPgPk", "kPPPPPPPPPk", "kwwwwwwwwwk", ".kkkkkkkkk."],
    scroll: [".kkkkkkkkkkk.", "krrrrrrrrrrrk", ".kkkkkkkkkkk.", ".kpppppppppk.", ".kpbbbbbbbpk.", ".kpppppppppk.", ".kpbbbbbpppk.", ".kpppppppppk.", ".kkkkkkkkkkk.", "krrrrrrrrrrrk", ".kkkkkkkkkkk."]
  };
  // Coulée de lave qui déborde d'un coin de la pierre volcanique (copiée en miroir de l'autre côté).
  const LAVA = [
    "....kkkkk...............", "..kkRrrrRkk......kkk....", ".kRrroooorRkk...kRrRk...", "kRroYYYYoorrRkkkRroorRk.",
    "kRoYYYYYYoorrrrrroYYorRk", "kRroYYYoooorrRRRrrooorRk", ".kRrooorrRRkkk..kRrrrRk.", ".kRroorRkk.......kRorRk.",
    ".kRrorRk..........kRrk..", ".kRrorRk..........kRrk..", ".kRroRk............kk...", ".kRroRk.................",
    ".kRroRk.................", ".kRrorRk................", "..kRorRk................", "..kRYoRk................",
    "..kRooRk................", "...kRRk.................", "....kk.................."
  ];
  // La fiole de la barre : écume blanche (2 images) à l'avant du liquide, et le bouchon.
  const FOAM = [
    ["..ww..", ".wwwW.", "wwWww.", ".wwww.", "wwwW..", "wWwww.", ".wwwW.", "wwww.w", "wWww..", ".wwwW.", "wwWw..", "wwwww.", ".wwW..", "..w..."],
    [".wW...", "wwww..", ".wwwW.", "wWww.w", ".www..", "wwwWw.", "wwww..", ".wWw..", "wwwwW.", "wwWw..", ".www.w", "wwwW..", "wWw...", ".w...."]
  ];
  // Le col de la fiole et son bouchon de liège : le liège est enfoncé dans le goulot (on le voit à travers le verre),
  // la tête dépasse du rebord. Posé sur le bout de la fiole, il la ferme complètement.
  const NECK = ["............", "............", "............", ".....k......", "kkkkkLxxxxx.", "hhxddLoocccx", "ggxddLocccCx", "ggxddLccccCx", "ggxddLcccCCx", "GGxddLccCCCx", "GGxddLcCCCCx", "kkkkkLxxxxx.", ".....k......", "............", "............", "............"];
  // Icônes de statut : fiole vide (pas commencée), potion qui bouillonne (en cours), potion prête (validée), cloche (rappel).
  const STA = {
    todo: ["...kkkk...", "...kcCk...", "...kgGk...", "..kg..Gk..", ".kgh...Gk.", "kgh....GGk", "kgh....GGk", "kg....GGGk", ".kg..GGGk.", "..kkkkkk.."],
    doing: [
      ["...kkkk...", "...kcCk...", "...kgbk...", "..kgggGk..", ".kgbgggGk.", "kghglbgGGk", "klllllLLLk", "kllblllLLk", ".klllLLLk.", "..kkkkkk.."],
      ["...kkkk...", "...kcCk...", "...kggk...", "..kgbgGk..", ".kghggbGk.", "kghlggGGGk", "kllllblLLk", "klllllLLLk", ".kllbLLLk.", "..kkkkkk.."]
    ],
    done: ["......s...", "...kkkksss", "...kCCk.s.", "...kegk...", "..keeeEk..", ".keeeeeSk.", "keSeeeSEEk", "keeSeSeEEk", "keeeSeeEEk", ".kkkkkkkk."],
    bell: ["....kk....", "...kqyk...", "..kqyyYk..", "..kqyyYk..", ".kqyyyyYk.", ".kqyyyyYk.", "kqyyyyyyYk", "kkkkkkkkkk", "....kYk...", ".....k...."]
  };
  const FX = {
    twinkle: ["...O...", "...o...", "..ooo..", "OooOooO", "..ooo..", "...o...", "...O..."],
    cloudA: [".............mm...............", "..........mmmmmmmm............", ".........mmmmmmmmmm...........", ".........mmmmmmmmmmmmmmm......", ".....mmmmmmmmmmmmmmmmmmmm.....", "....mmmmmmmmmmmmmmmmmmmmmmm...", "...mmmmmmmmmmmmmmmmmmmmmmmmm..", "..mmmmmmmmmMmmmmMMmmmmmmmmmmm.", ".MmmmmmmmmMMMMMMMMMMmmMMmmmmM.", ".MmmmmmmmmM.MMMM..MMmmMMmmmmM.", "..MMMMMMMM..........MM..MMMM.."],
    cloudB: [".........mmm..........", ".......mmmmmmm........", "......mmmmmmmmmmm.....", "....mmmmmmmmmmmmmmm...", "...mmmmmmmmmmmmmmmmm..", "..mmmmmmmmmmmmmmmmmmm.", ".mmmmmmmMMMMMMmmmmmmmM", ".mmmmmmmMMMMMMmmmmmmmM", ".MMMMMMM......MMMMMMM."]
  };
  const IVY = ["..........LL...LlL................", "....LL...LlL....D.....LL....LL....", "...LlL....D.vvvvvvv..LlL...LlL....", "vv..D....vvv.LL..L.vvvD.....Dvvv..", ".LvvvvLvvL..LlL.LlL..LLvvvvvvLL...", "LlL.vLlLLlL..D..DDL.LlL..L..LlL...", "DLL.LDDLDDL..........D..LlL..D....", "LlLv.D..................DDL.......", ".D.v.L............................", "...vLlL...........................", "..v.DDL...........................", "LLv...............................", "lLv.L.............................", "D.vLlL............................", "..vDDL............................", "..v...............................", ".LLv.L............................", "LlLvLlL...........................", ".D..DDL...........................", ".................................."];
  const SEAL = [
    [".................", ".....zzzza.......", "....zaaaaaaa.....", "...zaaAAAAAaaa...", "..zzaAaaaaaAaaa..", "..zaAaaaaaaaAaaA.", ".zzAaaazaaaaaAaA.", ".zaAaaaazaaaaAaA.", ".zaAaaaaazaaaAaA.", ".aaAaaaazaaaaAaA.", ".aaAaaazaaaaaAAA.", "..aaAaaaaaaaAaA..", "..aaaAaaaaaAaAA..", "...aaaAAAAAaaA...", ".....aAAAaaAAA...", ".......AAAAA.....", "................."],
    [".................", ".....zzzza.......", "....zaaaaaaa.....", "...zaaAAAAAaaa...", "..zzaAaaaaaAaaa..", "..zaAaaaaaaaAaaA.", ".zzAazaaazaaaAaA.", ".zaAaazaaazaaAaA.", ".zaAaaazaaazaAaA.", ".aaAaazaaazaaAaA.", ".aaAazaaazaaaAAA.", "..aaAaaaaaaaAaA..", "..aaaAaaaaaAaAA..", "...aaaAAAAAaaA...", ".....aAAAaaAAA...", ".......AAAAA.....", "................."],
    [".................", ".....zzzza.......", "....zaaaaaaa.....", "...zaaAAAAAaaa...", "..zzaAaaaaaAaaa..", "..zaAaaaaaaaAaaA.", ".zzzaaazaaazaAaA.", ".zaAzaaazaaazAaA.", ".zaAazaaazaaazaA.", ".aaAzaaazaaazAaA.", ".aazaaazaaazaAAA.", "..aaAaaaaaaaAaA..", "..aaaAaaaaaAaAA..", "...aaaAAAAAaaA...", ".....aAAAaaAAA...", ".......AAAAA.....", "................."]
  ];
  // Habitants du décor, à l'échelle de la tour : petit mage, sorcière sur son balai, calèche (2 images),
  // oiseaux du matin, loup-garou de la nuit (2 images), yeux dans les arbres et éclairs.
  const WIZARD = ["..k..", ".kHk.", "kHyHk", "kkkkk", ".kfk.", "kHHHk", "kHyHk", "kHHHk", ".k.k."];
  const FLYER = ["....k.......", "...kpk......", "..kpppk.....", "...kfk......", "..kccck.....", "bbbkcckBBBBB", "bbb.kk......"];
  const CART = [["..kkkkkkkkk...........", ".kRRRRRRRRRk..........", ".kRwwkRRwwRk......kk..", ".kRwwkRRwwRk.....kNNk.", ".kRRRRRRRRRk....kNNNNk", ".kyyyyyyyyyk.kkkNNNk.k", "kkkkkkkkkkkkkNNNNNk...", ".kkk....kkk..kNNNNk...", "kokok..kokok.kN.kN....", "kkokk..kkokk.kN.kN....", ".kkk....kkk..kk.kk...."], ["..kkkkkkkkk...........", ".kRRRRRRRRRk..........", ".kRwwkRRwwRk......kk..", ".kRwwkRRwwRk.....kNNk.", ".kRRRRRRRRRk....kNNNNk", ".kyyyyyyyyyk.kkkNNNk.k", "kkkkkkkkkkkkkNNNNNk...", ".kkk....kkk..kNNNNk...", "kkokk..kkokk..kNkN....", "kokok..kokok..kNkN....", ".kkk....kkk...kkkk...."]];
  const BIRD = [["k...k", ".k.k.", "..k.."], [".....", "kk.kk", "..k.."]];
  const WOLF = [["k....k.", "kk..kk.", "kGGGGk.", "kxGxGGk", ".kGGGwk", "kGGGGk.", "kGGGGGk", ".kGkGk.", ".k..k.."], ["k....k.", "kk..kk.", "kGGGGk.", "kxGxGGk", ".kGGGwk", "kGGGGk.", "kGGGGGk", "kGk.kG.", "k....k."]];
  const EYES = ["x.x"];

  // Nuit d'orage : gros nuages sombres (et leur version éclairée) et éclairs ramifiés, à la taille du décor.
  function stormCloud(w, h, rnd) {
    const n = Math.max(4, Math.round(w / 6)), puffs = [];
    for (let i = 0; i < n; i++) {
      const f = i / (n - 1);
      const r = h * (0.3 + rnd() * 0.3) * (1 - Math.abs(f - 0.5) * 0.8);
      puffs.push([w * (0.1 + 0.8 * f) + (rnd() - 0.5) * 2, h - 3 - r * 0.8, r]);
      if (f > 0.15 && f < 0.85 && rnd() < 0.7) puffs.push([w * (0.1 + 0.8 * f) + (rnd() - 0.5) * 4, h - 3 - r * 1.55, r * (0.55 + rnd() * 0.2)]);
    }
    const inside = (x, y) => y >= 0 && y < h && x >= 0 && x < w &&
      (puffs.some(p => (x - p[0]) * (x - p[0]) + (y - p[1]) * (y - p[1]) * 1.15 <= p[2] * p[2]) ||
       (y >= h - 4 && x >= Math.round(w * 0.06) + (h - 1 - y) * 0 && x <= Math.round(w * 0.94) && !(y === h - 1 && (x < w * 0.1 || x > w * 0.9))));
    const rows = [];
    for (let y = 0; y < h; y++) {
      let row = '';
      for (let x = 0; x < w; x++) row += !inside(x, y) ? '.' : (!inside(x, y - 1) ? 'a' : (y >= h - 2 ? 'd' : (y > h * 0.62 ? 'c' : 'b')));
      rows.push(row);
    }
    return rows;
  }
  function boltRows(len, rnd) {
    const W = 15, g = Array.from({ length: len }, () => Array(W).fill('.'));
    const put = (x, y, c) => { if (x < 0 || x >= W || y < 0 || y >= len) return; if (c === 'W' || g[y][x] === '.') g[y][x] = c; };
    const path = (x, y0, n, dir, thick) => {
      const xs = [];
      for (let y = y0; y < Math.min(len, y0 + n); y++) {
        const r = rnd();
        if (dir) x += r < 0.75 ? dir : 0; else if (r < 0.3) x -= 1; else if (r < 0.6) x += 1;
        x = Math.max(1, Math.min(W - 2, x));
        put(x, y, 'W');
        if (thick && y % 3 !== 2) put(x + 1, y, 'W');
        xs.push(x);
      }
      return xs;
    };
    const main = path(7, 0, len, 0, true);
    const b1 = Math.round(len * (0.25 + rnd() * 0.15)), b2 = Math.round(len * (0.55 + rnd() * 0.15));
    path(main[b1] || 7, b1, Math.round(len * 0.3), rnd() < 0.5 ? -1 : 1, false);
    path(main[b2] || 7, b2, Math.round(len * 0.18), rnd() < 0.5 ? -1 : 1, false);
    for (let y = 0; y < len; y++) for (let x = 0; x < W; x++) if (g[y][x] === 'W') [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(d => put(x + d[0], y + d[1], 'Y'));
    return g.map(r => r.join(''));
  }

  const svgCache = new Map();
  function sprite(rows, cls, scale, cropRows) {
    const key = cls + '|' + scale + '|' + (cropRows || 0) + '|' + rows.join('/');
    const hit = svgCache.get(key);
    if (hit) return hit;
    const h = cropRows || rows.length;
    const w = rows[0].length;
    let rects = '';
    for (let y = 0; y < h; y++) {
      const r = rows[y];
      let x = 0;
      while (x < w) {
        const c = r[x];
        if (c === '.') { x++; continue; }
        let x2 = x + 1;
        while (x2 < w && r[x2] === c) x2++;
        rects += '<rect x="' + x + '" y="' + y + '" width="' + (x2 - x) + '" height="1" class="p-' + c + '"/>';
        x = x2;
      }
    }
    const svg = '<svg class="spr ' + cls + '" viewBox="0 0 ' + w + ' ' + h + '" width="' + (w * scale) + '" height="' + (h * scale) + '" shape-rendering="crispEdges" aria-hidden="true" focusable="false">' + rects + '</svg>';
    svgCache.set(key, svg);
    return svg;
  }
  const ico = (name, scale) => sprite(ICON[name], 'ico', scale || 3);
  const charFull = (cat, scale) => sprite(CHAR[cat], 'char', scale || 3);
  const charBust = cat => sprite(CHAR[cat].slice(BUST[cat][0], BUST[cat][1]), 'char', 2);
  const chevrons = (n, scale) => sprite(ICON.chevron.map(r => Array(n).fill(r).join('.')), 'ico', scale || 2);
  const seal = n => sprite(SEAL[n - 1], 'seal', 2);
  // Deux images qui alternent (potion qui bouillonne, écume de la fiole).
  const anim2 = (frames, cls, scale, extra) => '<span class="anim2' + (extra ? ' ' + extra : '') + '">' + sprite(frames[0], cls, scale) + sprite(frames[1], cls, scale) + '</span>';
  const staIcon = (name, scale) => name === 'doing' ? anim2(STA.doing, 'sta', scale) : sprite(STA[name], 'sta', scale);

  /* ================= icônes du style Bureau (traits fins) ================= */
  const SVG = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
    popout: '<path d="M14 4h6v6M20 4l-8.5 8.5M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    dots: '<circle cx="5.5" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="18.5" cy="12" r="1.5" fill="currentColor" stroke="none"/>',
    back: '<path d="M14.5 6l-6 6 6 6"/>',
    next: '<path d="M9.5 6l6 6-6 6"/>',
    bell: '<path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 2h-14z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
    cal: '<rect x="4" y="5.5" width="16" height="14.5" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
    trash: '<path d="M5 7h14M10 7V4.5h4V7M7 7l1 12.5h8L17 7"/>',
    pencil: '<path d="M5 19l.8-3.6L15.6 5.6a1.5 1.5 0 0 1 2.1 0l.7.7a1.5 1.5 0 0 1 0 2.1L8.6 18.2z"/>',
    undo: '<path d="M9 14.5L4.5 10 9 5.5"/><path d="M4.5 10H14a5 5 0 0 1 0 10h-3"/>',
    play: '<path d="M8 6.5v11l9-5.5z"/>',
    pause: '<path d="M9 6.5v11M15 6.5v11"/>',
    clock: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4.5l3 2"/>',
    none: '<path d="M6 6l12 12M18 6L6 18"/>'
  };
  const svgIco = (name, size) => '<svg class="si" viewBox="0 0 24 24" width="' + (size || 16) + '" height="' + (size || 16) + '" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + SVG[name] + '</svg>';
  // Priorité : trois barres de hauteur croissante, pleines jusqu'au niveau (comme les chevrons du style Aventure).
  const priBars = n => '<svg class="si bars" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false">' +
    [0, 1, 2].map(i => '<rect x="' + (i * 4.5) + '" y="' + (8 - i * 3.5) + '" width="3" height="' + (4 + i * 3.5) + '" rx=".6" fill="currentColor" opacity="' + (i < n ? 1 : .22) + '"/>').join('') + '</svg>';

  /* ================= rounded pixel frames (9-slice border images) ================= */
  const P2 = [2, 1, 0], P3 = [3, 1, 1, 0], P4 = [4, 2, 1, 1, 0, 0];
  const FRAMES = {
    stone: { s: 6, prof: P4, rings: ['#3c3f3a', ['#f1f1e7', '#7a7d74'], '#aaaca2', '#a2a49a', ['#8b8e85', '#e7e7dd'], '#6f726a'], fill: '#d6d6cb' },
    lava: { s: 6, prof: P4, rings: ['#0d0909', ['#6e605f', '#0c0808'], '#3d3334', '#362d2e', ['#231c1d', '#4a3f40'], '#2f2728'], fill: '#2a2324', deco: 'ember' },
    scroll: { s: 5, prof: [3, 1, 1, 0, 0], rings: ['#6b4a2b', '#b98a4c', '#dcbd7e', '#efd8a2'], fill: '#f6e4b6' },
    banner: { s: 6, prof: P4, rings: ['#14123a', ['#7480ea', '#17144c'], '#2e3392', '#f0c04a', '#2e3392', '#1b1d5e'], fill: '#23266f' },
    magic: { s: 4, prof: P3, rings: ['#14123a', ['#7480ea', '#17144c'], '#f0c04a', '#2b2f8f'], fill: '#23266f' },
    quest: { s: 5, prof: [3, 1, 1, 0, 0], rings: ['#3a2608', ['#fff4bd', '#a8781f'], '#f0c04a', '#c9952e', '#3a2608'], fill: '#1f2366' },
    dialog: { s: 6, prof: P4, rings: ['#14123a', ['#7480ea', '#17144c'], '#2e3392', '#f0c04a', '#2e3392', '#8a6a3a'], fill: '#f9eed2' },
    btnParch: { s: 4, prof: P3, rings: ['#5a3d22', ['#fff8e2', '#c4a066'], '#f3dfb0'], fill: '#f3dfb0' },
    btnGo: { s: 4, prof: P3, rings: ['#103019', ['#93f0a2', '#1d6633'], '#35a853'], fill: '#35a853' },
    btnRuby: { s: 4, prof: P3, rings: ['#3d0f12', ['#ffa196', '#8a1f22'], '#d6453d'], fill: '#d6453d' },
    btnGold: { s: 4, prof: P3, rings: ['#4a3210', ['#fff4bd', '#b5832a'], '#f0c04a'], fill: '#f0c04a' },
    btnMagic: { s: 4, prof: P3, rings: ['#14123a', ['#8a94f2', '#1d1a55'], '#3b41b5'], fill: '#3b41b5' },
    // Petits boutons Modifier / Supprimer : bien contrastés avec la matière de la carte.
    actStone: { s: 3, prof: P2, rings: ['#1d201b', ['#6d7268', '#2a2d27'], '#41453e'], fill: '#41453e' },
    actLava: { s: 3, prof: P2, rings: ['#0d0909', ['#ffffff', '#b3a596'], '#ece4da'], fill: '#ece4da' },
    actVellum: { s: 3, prof: P2, rings: ['#1f160d', ['#7a6650', '#33261a'], '#4a3a2a'], fill: '#4a3a2a' },
    actScroll: { s: 3, prof: P2, rings: ['#2a1a0c', ['#93693f', '#3d2810'], '#5e4024'], fill: '#5e4024' },
    boxStone: { s: 4, prof: P3, rings: ['#43463f', ['#fbfbf3', '#93968c'], '#e6e6dc'], fill: '#e6e6dc' },
    boxLava: { s: 4, prof: P3, rings: ['#0d0909', ['#6e605f', '#140e0f'], '#3d3435'], fill: '#3d3435' },
    boxScroll: { s: 4, prof: P3, rings: ['#6b4a2b', ['#fff8e2', '#cfae70'], '#f6e6bd'], fill: '#f6e6bd' },
    boxVellum: { s: 4, prof: P3, rings: ['#7d7466', ['#ffffff', '#cfc8b8'], '#f6f4ed'], fill: '#f6f4ed' },
    pillStone: { s: 3, prof: P2, rings: ['#6f726a', ['#b5b6ab', '#f1f1e8'], '#e4e4da'], fill: '#e4e4da' },
    pillLava: { s: 3, prof: P2, rings: ['#0d0909', ['#1c1415', '#5a4e4d'], '#3a3132'], fill: '#3a3132' },
    pillScroll: { s: 3, prof: P2, rings: ['#9b7444', ['#dcc183', '#fff4d6'], '#f0d9a2'], fill: '#f0d9a2' },
    pillVellum: { s: 3, prof: P2, rings: ['#a39a88', ['#d9d2c3', '#ffffff'], '#f4f1e9'], fill: '#f4f1e9' },
    input: { s: 3, prof: P2, rings: ['#7a5a36', ['#c9a76a', '#fffaf0'], '#fffaf0'], fill: '#fffaf0' },
    menu: { s: 4, prof: P3, rings: ['#3d2814', ['#fffdf6', '#c9b48a'], '#fbf3df'], fill: '#fbf3df' },
    rollVellum: { s: 3, prof: P2, rings: ['#7d7466', ['#ffffff', '#b9b1a0'], '#e9e5da'], fill: '#e9e5da' }
  };
  function frameGrid(f) {
    const s = f.s, N = 2 * s + 1, prof = f.prof;
    const inside = (x, y) => {
      if (x < 0 || y < 0 || x >= N || y >= N) return false;
      const cx = Math.min(x, N - 1 - x), cy = Math.min(y, N - 1 - y);
      if (cx < s && cy < s) return cx >= (prof[cy] || 0) && cy >= (prof[cx] || 0);
      return true;
    };
    const dist = Array.from({ length: N }, () => Array(N).fill(-1));
    const q = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (inside(x, y) && (!inside(x + 1, y) || !inside(x - 1, y) || !inside(x, y + 1) || !inside(x, y - 1))) { dist[y][x] = 0; q.push([x, y]); }
    }
    for (let i = 0; i < q.length; i++) {
      const [x, y] = q[i];
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
        const nx = x + dx, ny = y + dy;
        if (inside(nx, ny) && dist[ny][nx] < 0) { dist[ny][nx] = dist[y][x] + 1; q.push([nx, ny]); }
      });
    }
    const g = Array.from({ length: N }, () => Array(N).fill(null));
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (!inside(x, y)) continue;
      const d = dist[y][x];
      const r = f.rings[d];
      g[y][x] = d < f.rings.length ? (Array.isArray(r) ? (x + y < N - 1 ? r[0] : r[1]) : r) : f.fill;
    }
    const paint = (cx, cy, c) => {
      [[cx, cy], [N - 1 - cx, cy], [cx, N - 1 - cy], [N - 1 - cx, N - 1 - cy]].forEach(([x, y]) => { if (inside(x, y)) g[y][x] = c; });
    };
    if (f.deco === 'ember') {
      // petites fissures de lave dans les coins de la pierre
      [[2, 5, '#a3301a'], [3, 5, '#e0521f'], [3, 4, '#ff9a2e'], [4, 3, '#e0521f'], [5, 3, '#a3301a']].forEach(p => paint(p[0], p[1], p[2]));
    }
    return g;
  }
  function gridURI(g) {
    const N = g.length;
    let rects = '';
    for (let y = 0; y < N; y++) {
      let x = 0;
      while (x < N) {
        const c = g[y][x];
        if (!c) { x++; continue; }
        let x2 = x + 1;
        while (x2 < N && g[y][x2] === c) x2++;
        rects += '<rect x="' + x + '" y="' + y + '" width="' + (x2 - x) + '" height="1" fill="' + c + '"/>';
        x = x2;
      }
    }
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + N + '" height="' + N + '" viewBox="0 0 ' + N + ' ' + N + '" shape-rendering="crispEdges">' + rects + '</svg>';
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
  }
  const FRAME_URI = {};
  Object.keys(FRAMES).forEach(k => { FRAME_URI[k] = gridURI(frameGrid(FRAMES[k])); });
  // Les cadres pixel ne concernent que le style Aventure (classe .av sur <html>).
  const AV = sel => sel.split(',').map(s => '.av ' + s.trim()).join(',');
  function frameCSS(sel, name, scale) {
    const f = FRAMES[name], w = f.s * scale;
    return AV(sel) + '{border-style:solid;border-width:' + w + 'px;border-image:url("' + FRAME_URI[name] + '") ' + f.s + ' / ' + w + 'px stretch;background-clip:padding-box;}';
  }
  // Bords irréguliers (page de grimoire déchirée, parchemin abîmé) : un cadre en 9 parties dont les côtés,
  // déchiquetés, se répètent le long de la carte (border-image en mode « round »).
  function raggedURI(o) {
    const s = o.s, E = o.E, N = 2 * s + E, rnd = mulberry32(o.seed);
    const walk = (amp, len) => { const a = []; let v = Math.round(amp / 2); for (let i = 0; i < len; i++) { v = Math.max(0, Math.min(amp, v + Math.round((rnd() - 0.5) * 2.4))); a.push(v); } return a; };
    const top = walk(o.amp, N), bot = walk(o.amp, N), left = walk(o.amp, N), right = walk(o.ampR || o.amp, N);
    [top, bot, left, right].forEach(a => { a[s + E - 1] = a[s]; });
    (o.tears || []).forEach(t => { const a = { top: top, bot: bot, left: left, right: right }[t[0]]; for (let i = 0; i < t[2]; i++) a[t[1] + i] = Math.max(a[t[1] + i], t[3] - Math.abs(i - (t[2] - 1) / 2) | 0); });
    for (let i = 0; i < 3; i++) {
      top[i] = Math.max(top[i], 3 - i); top[N - 1 - i] = Math.max(top[N - 1 - i], 3 - i);
      bot[i] = Math.max(bot[i], 3 - i); bot[N - 1 - i] = Math.max(bot[N - 1 - i], 3 - i);
      left[i] = Math.max(left[i], 3 - i); left[N - 1 - i] = Math.max(left[N - 1 - i], 3 - i);
      right[i] = Math.max(right[i], 3 - i); right[N - 1 - i] = Math.max(right[N - 1 - i], 3 - i);
    }
    if (o.corner) for (let x = N - o.corner; x < N; x++) top[x] = Math.max(top[x], o.corner - (N - 1 - x) + (x & 1));
    const inside = (x, y) => x >= 0 && y >= 0 && x < N && y < N && y >= top[x] && y <= N - 1 - bot[x] && x >= left[y] && x <= N - 1 - right[y];
    const dist = Array.from({ length: N }, () => Array(N).fill(-1));
    const q = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (inside(x, y) && (!inside(x + 1, y) || !inside(x - 1, y) || !inside(x, y + 1) || !inside(x, y - 1))) { dist[y][x] = 0; q.push([x, y]); }
    }
    for (let i = 0; i < q.length; i++) {
      const [x, y] = q[i];
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { const nx = x + dx, ny = y + dy; if (inside(nx, ny) && dist[ny][nx] < 0) { dist[ny][nx] = dist[y][x] + 1; q.push([nx, ny]); } });
    }
    const g = Array.from({ length: N }, () => Array(N).fill(null));
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (!inside(x, y)) continue;
      const d = dist[y][x];
      let c = d === 0 ? o.outline : (d <= o.tones.length ? o.tones[d - 1] : o.fill);
      if (d >= 1 && d <= 3 && rnd() < o.stain) c = o.tones[0];
      g[y][x] = c;
    }
    (o.holes || []).forEach(h => { if (g[h[1]] && g[h[1]][h[0]]) g[h[1]][h[0]] = o.hole; });
    return gridURI(g);
  }
  const RAGGED = {
    page: { s: 6, E: 12, seed: 7, amp: 2, ampR: 3, outline: '#6b4a22', tones: ['#b88a4a', '#d2ad6c', '#e2c78c'], fill: '#ecd9a6', stain: 0.18,
      corner: 5, tears: [['right', 8, 4, 4], ['bot', 14, 3, 3]], holes: [[3, 9], [3, 15]], hole: '#4a3216' },
    vellum: { s: 5, E: 14, seed: 11, amp: 1, ampR: 2, outline: '#86744f', tones: ['#bfa982', '#d6c7a3'], fill: '#f3ecdb', stain: 0.22,
      tears: [['top', 9, 3, 3], ['left', 11, 3, 2]] }
  };
  function raggedCSS(sel, name, scale) {
    const o = RAGGED[name], w = o.s * scale;
    return AV(sel) + '{border-style:solid;border-width:' + w + 'px;border-image:url("' + raggedURI(o) + '") ' + o.s + ' / ' + w + 'px round;background-clip:padding-box;}';
  }
  // La fiole de la barre : silhouette en escalier (fond arrondi à gauche, col à droite) découpée en clip-path,
  // le verre (.tube) étant la même forme rétrécie d'un pixel. Un pixel du dessin = 2 px à l'écran.
  function stepPolygon(L, R, u) {
    const pts = [];
    R.forEach((r, y) => { const x = 'calc(100% - ' + (r * u) + 'px)'; pts.push(x + ' ' + (y * u) + 'px', x + ' ' + ((y + 1) * u) + 'px'); });
    for (let y = L.length - 1; y >= 0; y--) { const x = (L[y] * u) + 'px'; pts.push(x + ' ' + ((y + 1) * u) + 'px', x + ' ' + (y * u) + 'px'); }
    return 'polygon(' + pts.join(',') + ')';
  }
  const shrink = A => A.slice(1, -1).map((v, i) => Math.max(A[i], A[i + 1], A[i + 2]));
  function flaskCSS() {
    const L = [5, 3, 2, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 2, 3, 5];
    const R = [5, 3, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 5];
    return AV('.flask .glass') + '{clip-path:' + stepPolygon(L, R, 2) + ';}' + AV('.flask .tube') + '{clip-path:' + stepPolygon(shrink(L), shrink(R), 2) + ';}';
  }
  const frameStyle = document.createElement('style');
  frameStyle.textContent = [
    frameCSS('.banner', 'banner', 3),
    frameCSS('.subline', 'pillScroll', 2),
    frameCSS('.notice, .boot-title', 'boxScroll', 2),
    frameCSS('.card.t-stone', 'stone', 3),
    frameCSS('.card.t-lava', 'lava', 3),
    frameCSS('.empty', 'scroll', 3),
    raggedCSS('.card.t-page', 'page', 3),
    raggedCSS('.card.t-vellum', 'vellum', 3),
    frameCSS('.card.t-vellum::before, .card.t-vellum::after', 'rollVellum', 3),
    frameCSS('.t-stone .box', 'boxStone', 2),
    frameCSS('.t-lava .box', 'boxLava', 2),
    frameCSS('.t-page .box', 'boxScroll', 2),
    frameCSS('.t-vellum .box', 'boxVellum', 2),
    frameCSS('.t-stone .subject, .t-stone .desc, .t-stone .portrait', 'pillStone', 2),
    frameCSS('.t-lava .subject, .t-lava .desc, .t-lava .portrait', 'pillLava', 2),
    frameCSS('.t-vellum .subject, .t-vellum .desc, .t-vellum .portrait', 'pillVellum', 2),
    frameCSS('.t-page .subject, .t-page .desc, .t-page .portrait, .empty .stage, .choice .stage', 'pillScroll', 2),
    frameCSS('.btn', 'btnParch', 2),
    frameCSS('.btn-go', 'btnGo', 2),
    frameCSS('.btn-ruby', 'btnRuby', 2),
    frameCSS('.btn-gold', 'btnGold', 2),
    frameCSS('.btn-magic', 'btnMagic', 2),
    frameCSS('.t-stone .btn-act', 'actStone', 2),
    frameCSS('.t-lava .btn-act', 'actLava', 2),
    frameCSS('.t-vellum .btn-act', 'actVellum', 2),
    frameCSS('.t-page .btn-act', 'actScroll', 2),
    frameCSS('.toast', 'magic', 3),
    frameCSS('.toast.is-quest', 'quest', 3),
    frameCSS('.menu', 'menu', 2),
    frameCSS('.dlg, .auth-card', 'dialog', 3),
    frameCSS('.input, .url-box', 'input', 2),
    frameCSS('.choice', 'boxScroll', 2),
    AV('.opt input:checked + .choice') + '{border-image-source:url("' + FRAME_URI.btnGold + '");}',
    frameCSS('.seg button, .qd', 'boxScroll', 2),
    AV('.seg button[aria-checked="true"], .qd[aria-pressed="true"]') + '{border-image-source:url("' + FRAME_URI.btnGold + '");}',
    frameCSS('.quick', 'input', 2),
    frameCSS('.q-more', 'btnParch', 2),
    frameCSS('.q-preview, .grp-h', 'pillScroll', 2),
    flaskCSS()
  ].join('\n');
  document.head.appendChild(frameStyle);

  /* ================= the fantasy landscape, by time of day ================= */
  const canvas = document.getElementById('scene');
  const world = document.querySelector('.world');
  const worldDeco = document.getElementById('world-deco');
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const C = hex => { const n = parseInt(hex.slice(1), 16); return (0xff000000 | ((n & 255) << 16) | (n & 0xff00) | (n >> 16)) >>> 0; };
  // Lever de soleil 8 h-10 h, journée 10 h-17 h, coucher 17 h-20 h, nuit 20 h-8 h.
  const PHASES = {
    sunrise: {
      sky: ['#5b7fc4', '#7590cc', '#9db2d6', '#d2b6bb', '#e6b8b2', '#f6c49e', '#fbd39c', '#fde3b0', '#fff2d4'],
      sun: { x: 0.2, xp: 0.22, low: true, core: '#fff4cf', mid: '#ffd77e', rim: '#ffa54f', halo: '#ffe3bd', rays: '#ffc070' },
      mtn: ['#a7b4cc', '#909eb9'], snow: ['#fdeee8', '#e8d6d4'], range2: ['#8eab92', '#7f9c84'],
      hill: ['#86c45e', '#cfe691', '#acd77c', '#77b553'], meadow: ['#6cb44c', '#a2d872', '#5fa443'], path: ['#eed6a0', '#cfb27c'],
      tree: ['#459a3c', '#28702a', '#79c457', '#30782f', '#7a5230'],
      tower: ['#ddd0c2', '#b4a594', '#c3b4a4', '#4d4238'], roof: ['#df6e4c', '#b24c36', '#4a1c12'], window: '#ffe680',
      flowers: ['#ffffff', '#ffd93d', '#ff9ec4', '#a8d8ff'], grass: '#55a23e', bg: '#f2c4b0'
    },
    day: {
      sky: ['#4cb3e8', '#5dbcec', '#70c6ef', '#84cff2', '#99d8f4', '#addff6', '#c2e7f7', '#d8f0f6', '#ecf7ec'],
      sun: { x: 0.84, xp: 0.8, y: 0.15, yp: 0.1, core: '#fff3a6', mid: '#ffe066', rim: '#ffcf3a', halo: '#fff6d2', rays: '#ffd84a' },
      mtn: ['#9cc0df', '#86abd0'], snow: ['#f4faff', '#d9e9f6'], range2: ['#7fb39c', '#6fa38f'],
      hill: ['#7cc95b', '#b2e889', '#9de07a', '#6db94f'], meadow: ['#62b84a', '#8fd86a', '#58aa42'], path: ['#ead59c', '#cdb57a'],
      tree: ['#3f9a3a', '#256e27', '#6cc04f', '#2d7a2d', '#7a5230'],
      tower: ['#d4cfc4', '#aca596', '#bbb4a6', '#4a443b'], roof: ['#d9603f', '#ad442f', '#4a1a12'], window: '#ffe680',
      flowers: ['#ffffff', '#ffd93d', '#ff7eb6', '#8fd0ff'], grass: '#4f9e3a', bg: '#8fd4f4'
    },
    sunset: {
      sky: ['#2f4a8a', '#455a96', '#5d6c9a', '#b06f7c', '#cf7279', '#e8865f', '#f4a35a', '#fbc06a', '#fdda96'],
      sun: { x: 0.8, xp: 0.78, low: true, core: '#fff0b0', mid: '#ffb84d', rim: '#f0663a', halo: '#ffcf9a', rays: '#ff9b4a' },
      mtn: ['#6d7aa0', '#5b688e'], snow: ['#f7d6cc', '#dcbcb6'], range2: ['#5f7d6c', '#536f60'],
      hill: ['#6b9f4c', '#b3c56c', '#8fb45d', '#5d8e42'], meadow: ['#578f3e', '#87b45a', '#4d8137'], path: ['#dcbf8a', '#b89a68'],
      tree: ['#36803a', '#1d5524', '#5fa34a', '#24622a', '#5e3f26'],
      tower: ['#c9ad9c', '#9d8473', '#ac9482', '#3d2f27'], roof: ['#c4513a', '#963a2a', '#3a140e'], window: '#ffd65a',
      flowers: ['#ffe0c2', '#ffd06a', '#ff8fb0'], grass: '#4b8a37', bg: '#cf7279'
    },
    night: {
      sky: ['#0a0f2c', '#0d1433', '#11193b', '#151f44', '#19264d', '#1e2d57', '#233461', '#293c6a', '#2f4472'],
      moon: { x: 0.75, xp: 0.72, y: 0.16, yp: 0.11, color: '#f6f2dc', shade: '#d9d3b6', halo: '#2c3b6e', halo2: '#43548c' },
      stars: true,
      mtn: ['#2d3b68', '#25315a'], snow: ['#97a3c6', '#7c88ab'], range2: ['#1f3646', '#1a2f3d'],
      hill: ['#1f4a38', '#3b6f4f', '#2f5e45', '#1a4031'], meadow: ['#183e2d', '#2a5a40', '#143525'], path: ['#6a6656', '#4f4c42'],
      tree: ['#173f2d', '#0b2419', '#25573d', '#11321f', '#3a2a1a'],
      tower: ['#5c6274', '#474c5c', '#525868', '#1d2029'], roof: ['#6e3a36', '#52292a', '#1e0f10'], window: '#ffd65a',
      flowers: ['#c9d3ff', '#ffe9a0'], grass: '#163828', bg: '#11193b'
    }
  };
  const FORCED = { '#aube': 'sunrise', '#jour': 'day', '#couchant': 'sunset', '#nuit': 'night' };
  function currentPhase() {
    if (FORCED[location.hash]) return FORCED[location.hash];
    const h = Number(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' }).format(new Date()));
    if (h >= 8 && h < 10) return 'sunrise';
    if (h >= 10 && h < 17) return 'day';
    if (h >= 17 && h < 20) return 'sunset';
    return 'night';
  }
  let phase = currentPhase();
  const isBz = () => !document.documentElement.classList.contains('av');
  function drawScene() {
    if (isBz()) return; // le décor n'existe que dans le style Aventure
    const P = PHASES[phase];
    world.dataset.phase = phase;
    document.documentElement.style.backgroundColor = P.bg;
    document.body.style.backgroundColor = P.bg;
    const vw = document.documentElement.clientWidth || window.innerWidth;
    const vh = window.innerHeight;
    const PX = vw >= 1000 ? 4 : 3;
    const W = Math.ceil(vw / PX) + 1, H = Math.ceil(vh / PX) + 1;
    canvas.width = W; canvas.height = H;
    canvas.style.width = (W * PX) + 'px';
    canvas.style.height = (H * PX) + 'px';
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(W, H);
    const buf = new Uint32Array(img.data.buffer);
    const rnd = mulberry32(20261012);
    const set = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < W && y < H) buf[y * W + x] = c; };
    const fill = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, c); };
    const portrait = W < H * 0.9;
    const horizon = Math.round(H * (portrait ? 0.6 : 0.58));

    // sky bands with dithered seams
    const SKY = P.sky.map(C);
    const bh = Math.max(3, Math.ceil(horizon / SKY.length));
    for (let y = 0; y < horizon + 8; y++) {
      const i = Math.min(SKY.length - 1, Math.floor(y / bh));
      const nxt = SKY[Math.min(SKY.length - 1, i + 1)];
      const t = y % bh;
      for (let x = 0; x < W; x++) set(x, y, (t >= bh - 2 && ((x + y) & 1)) ? nxt : SKY[i]);
    }
    const Hm = H * (portrait ? 0.15 : 0.2);
    // stars
    if (P.stars) {
      const starCols = ['#ffffff', '#cfd8ff', '#fff4c0'].map(C);
      const count = Math.round(W * horizon / 140);
      for (let i = 0; i < count; i++) {
        const x = Math.round(rnd() * W), y = Math.round(rnd() * (horizon - Hm * 0.6));
        const c = starCols[Math.floor(rnd() * starCols.length)];
        set(x, y, c);
        if (rnd() < 0.12) { set(x - 1, y, c); set(x + 1, y, c); set(x, y - 1, c); set(x, y + 1, c); }
      }
    }
    // sun or moon
    const R = Math.max(6, Math.min(20, Math.round(Math.min(W, H) * 0.07)));
    if (P.sun) {
      const s = P.sun;
      const sx = Math.round(W * (portrait ? s.xp : s.x));
      const sy = s.low ? Math.round(horizon - Hm * 0.55) : Math.round(H * (portrait ? s.yp : s.y));
      const Rs = s.low ? Math.round(R * 1.25) : R;
      for (let y = -Rs - 7; y <= Rs + 7; y++) for (let x = -Rs - 7; x <= Rs + 7; x++) {
        const d = Math.sqrt(x * x + y * y);
        if (d <= Rs + 6 && d > Rs + 3 && ((x + y) & 1)) set(sx + x, sy + y, C(s.halo));
        else if (d <= Rs + 3 && d > Rs) set(sx + x, sy + y, C(s.halo));
        if (d <= Rs) set(sx + x, sy + y, d > Rs - 1.2 ? C(s.rim) : (d > Rs - 3 ? C(s.mid) : C(s.core)));
      }
      for (let k = 0; k < 8; k++) {
        const a = k * Math.PI / 4 + Math.PI / 8;
        const len = k % 2 ? 3 : 5;
        for (let r = Rs + 8; r < Rs + 8 + len; r++) set(sx + Math.cos(a) * r, sy + Math.sin(a) * r, C(s.rays));
      }
    }
    if (P.moon) {
      // une grosse pleine lune, avec ses cratères et un halo
      const m = P.moon;
      const mx = Math.round(W * (portrait ? m.xp : m.x)), my = Math.round(H * (portrait ? m.yp : m.y));
      const Rm = Math.max(9, Math.round(R * 1.55));
      for (let y = -Rm - 7; y <= Rm + 7; y++) for (let x = -Rm - 7; x <= Rm + 7; x++) {
        const d = Math.sqrt(x * x + y * y);
        if (d <= Rm + 6 && d > Rm + 3 && ((x + y) & 1)) set(mx + x, my + y, C(m.halo));
        else if (d <= Rm + 3 && d > Rm) set(mx + x, my + y, C(m.halo2));
        if (d <= Rm) set(mx + x, my + y, d > Rm - 1 ? C(m.shade) : C(m.color));
      }
      [[-0.35, -0.25, 0.22], [0.3, 0.12, 0.17], [-0.05, 0.45, 0.13], [0.42, -0.4, 0.1], [-0.5, 0.2, 0.08]].forEach(c => {
        const cx = mx + Math.round(c[0] * Rm), cy = my + Math.round(c[1] * Rm), cr = Math.max(1, Math.round(c[2] * Rm));
        for (let y = -cr; y <= cr; y++) for (let x = -cr; x <= cr; x++) if (x * x + y * y <= cr * cr + 0.5) set(cx + x, cy + y, C(m.shade));
      });
    }
    // far mountains with snow caps
    const snowLine = horizon - Hm * 0.66;
    const mh = x => Hm * (0.55 + 0.24 * Math.sin(x * 0.045 + 1.3) + 0.14 * Math.sin(x * 0.11 + 0.4) + 0.07 * Math.sin(x * 0.29 + 2.1));
    for (let x = 0; x < W; x++) {
      const h = mh(x), shade = mh(x + 1) < h;
      for (let y = Math.round(horizon - h); y < horizon + 10; y++) {
        let c = shade ? C(P.mtn[1]) : C(P.mtn[0]);
        if (y < snowLine - 1 || (y < snowLine + 1 && ((x + y) & 1))) c = shade ? C(P.snow[1]) : C(P.snow[0]);
        set(x, y, c);
      }
    }
    const base2 = horizon + Math.round(H * 0.035);
    for (let x = 0; x < W; x++) {
      const h = H * 0.07 * (0.6 + 0.3 * Math.sin(x * 0.07 + 2.4) + 0.15 * Math.sin(x * 0.19 + 0.7));
      for (let y = Math.round(base2 - h); y < base2 + 12; y++) set(x, y, ((x * 7 + y * 3) % 11 === 0) ? C(P.range2[1]) : C(P.range2[0]));
    }
    // rolling hills + meadow
    const hillY = x => Math.round(horizon + H * 0.08 - H * 0.045 * (0.6 + 0.4 * Math.sin(x * 0.035 + 0.5)) - H * 0.015 * Math.sin(x * 0.09 + 2));
    const meadowY = x => Math.round(horizon + H * 0.2 - H * 0.025 * Math.sin(x * 0.05 + 1.1));
    for (let x = 0; x < W; x++) {
      const hy = hillY(x);
      for (let y = hy; y < H; y++) {
        let c = C(P.hill[0]);
        if (y === hy) c = C(P.hill[1]);
        else if (y === hy + 1) c = C(P.hill[2]);
        else if (y > hy + 10 && ((x + y) % 2 === 0) && y < hy + 13) c = C(P.hill[3]);
        set(x, y, c);
      }
      const my = meadowY(x);
      for (let y = my; y < H; y++) {
        let c = C(P.meadow[0]);
        if (y === my) c = C(P.meadow[1]);
        else if ((y - my) % 9 === 4 && ((x + y) & 1)) c = C(P.meadow[2]);
        set(x, y, c);
      }
    }
    // the carriage road across the hills
    const roadY = Math.round(horizon + H * 0.13);
    for (let x = 0; x < W; x++) {
      set(x, roadY - 2, C(P.path[1]));
      for (let y = roadY - 1; y <= roadY + 1; y++) set(x, y, ((x * 5 + y * 3) % 13 === 0) ? C(P.path[1]) : C(P.path[0]));
      set(x, roadY + 2, C(P.path[1]));
    }
    // the mage tower and the winding path that leads to it
    const tx = Math.round(W * (portrait ? 0.16 : 0.14));
    const twr = Math.max(10, Math.min(18, Math.round(W * 0.06)));
    const tgy = hillY(tx) + 2;
    for (let y = H; y > tgy; y--) {
      const t = (H - y) / (H - tgy);
      const x = W * 0.55 + (tx - W * 0.55) * t + Math.sin(t * 3.4) * W * 0.06;
      const half = Math.max(1, Math.round((1 - t) * W * 0.06 + 1));
      for (let i = -half; i <= half; i++) set(x + i, y, (i === -half || i === half) ? C(P.path[1]) : C(P.path[0]));
    }
    // trees: far on the hill tops, some on the slopes, bigger ones in the meadow; drawn far to near, road kept clear
    const trees = [];
    const treeCount = Math.round(W / 5.5);
    for (let i = 0; i < treeCount; i++) {
      const x = Math.round(rnd() * W);
      const k = rnd();
      const zone = k < 0.35 ? 'far' : (k < 0.6 ? 'mid' : 'near');
      let gy, r;
      if (zone === 'far') { gy = hillY(x) + Math.round(rnd() * 3); r = 2 + Math.round(rnd()); }
      else if (zone === 'mid') { gy = Math.round(hillY(x) + 5 + rnd() * Math.max(1, roadY - 7 - hillY(x) - 5)); r = 3 + Math.round(rnd()); }
      else { gy = meadowY(x) + Math.round(rnd() * 8); r = 4 + Math.round(rnd() * 2); }
      const pine = rnd() < 0.35;
      if (zone !== 'near' && Math.abs(x - tx) < twr / 2 + r + 3) continue;
      if (gy >= roadY - 2 && gy <= roadY + 3) continue;
      trees.push({ x: x, gy: gy, r: r, pine: pine, zone: zone });
    }
    trees.sort((a, b) => a.gy - b.gy);
    trees.forEach(t => {
      const x = t.x, gyT = t.gy, r = t.r;
      if (t.pine) {
        for (let j = 0; j <= r * 2 + 1; j++) {
          const half = Math.floor(j / 2);
          for (let k = -half; k <= half; k++) set(x + k, gyT - r * 2 - 2 + j, k <= 0 ? C(P.tree[0]) : C(P.tree[3]));
        }
        set(x, gyT - 1, C(P.tree[4]));
      } else {
        fill(x, gyT - 2, 1, 2, C(P.tree[4]));
        for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++) {
          const d = Math.sqrt(xx * xx + yy * yy);
          if (d > r + 0.3) continue;
          let c = C(P.tree[0]);
          if (d > r - 0.8) c = C(P.tree[1]);
          else if (xx + yy < -r * 0.6) c = C(P.tree[2]);
          else if (xx + yy > r * 0.7) c = C(P.tree[3]);
          set(x + xx, gyT - 2 - r + yy, c);
        }
      }
    });
    const tth = Math.round(twr * 4.2);
    fill(tx - Math.round(twr * 1.6), tgy - 3, Math.round(twr * 3.2), 6, C(P.hill[0]));
    fill(tx - Math.floor(twr / 2) - 1, tgy - tth - 1, twr + 2, tth + 1, C(P.tower[3]));
    fill(tx - Math.floor(twr / 2), tgy - tth, twr, tth, C(P.tower[0]));
    fill(tx + Math.ceil(twr * 0.15), tgy - tth, Math.floor(twr / 2) - 1, tth, C(P.tower[1]));
    for (let j = 3; j < tth; j += 4) for (let i = (j % 8 === 3 ? 1 : 3); i < twr - 1; i += 4) set(tx - Math.floor(twr / 2) + i, tgy - tth + j, C(P.tower[2]));
    fill(tx - Math.floor(twr / 2) - 2, tgy - Math.round(tth * 0.72), twr + 4, 2, C(P.tower[3]));
    fill(tx - 1, tgy - Math.round(tth * 0.55), 2, 4, C(P.window));
    fill(tx - 1, tgy - Math.round(tth * 0.3), 2, 3, C(P.window));
    fill(tx - 1, tgy - 6, 3, 6, C(P.tower[3]));
    set(tx - 1, tgy - 6, C(P.tower[0])); set(tx + 1, tgy - 6, C(P.tower[0]));
    const rh = Math.round(twr * 1.9);
    for (let j = 0; j <= rh; j++) {
      const half = Math.round((twr / 2 + 2) * (j / rh));
      const lean = j < rh * 0.25 ? 1 : 0;
      for (let i = -half; i <= half; i++) set(tx + i + lean, tgy - tth - rh + j, (i === -half || i === half || j === rh) ? C(P.roof[2]) : (i < 0 ? C(P.roof[0]) : C(P.roof[1])));
    }
    const starX = tx + 1, starY = tgy - tth - rh - 2;
    [[0, 0], [0, -1], [0, 1], [-1, 0], [1, 0]].forEach(p => set(starX + p[0], starY + p[1], C('#ffe46b')));
    for (let i = 0; i < 6; i++) set(tx - Math.floor(twr / 2) + Math.round(rnd() * 2), tgy - 1 - i, C(P.tree[0]));
    // flowers and grass in the meadow
    const FLOW = P.flowers.map(C);
    const n = Math.round(W * H / 220);
    for (let i = 0; i < n; i++) {
      const x = Math.round(rnd() * W);
      const y = meadowY(x) + 2 + Math.round(rnd() * (H - meadowY(x)));
      if (rnd() < 0.55) { set(x, y, C(P.grass)); set(x, y - 1, C(P.grass)); }
      else set(x, y, FLOW[Math.floor(rnd() * FLOW.length)]);
    }
    ctx.putImageData(img, 0, 0);

    // living decorations, all at the scale of the tower
    const at = (x, y) => 'left:' + (x * PX) + 'px;top:' + (y * PX) + 'px';
    const wizX = tx + Math.ceil(twr / 2) + 2, wizY = tgy - 9;
    const sparks = [[starX - 4, starY - 6], [tx + twr + 5, tgy - tth + 2], [wizX + 4, wizY - 3], [Math.round(W * 0.3), Math.round(H * 0.08)], [Math.round(W * 0.55), Math.round(H * 0.2)]];
    if (P.stars) for (let i = 0; i < 6; i++) sparks.push([Math.round(rnd() * W), Math.round(rnd() * (horizon - Hm))]);
    let html = '';
    [[0.06, 'cloudA', 150, -10, 8], [0.18, 'cloudB', 115, -70, 58], [0.3, 'cloudA', 170, -120, 30], [0.12, 'cloudB', 140, -40, 76]].forEach(cl => {
      html += '<span class="fx cloud" style="top:' + Math.round(cl[0] * H) * PX + 'px;--t:' + cl[2] + 's;--d:' + cl[3] + 's;--x:' + cl[4] + '%">' + sprite(FX[cl[1]], 'fx', PX) + '</span>';
    });
    html += '<span class="npc flyer" style="top:' + Math.round(H * 0.24) * PX + 'px">' + sprite(FLYER, 'npc', PX) + '</span>';
    html += '<span class="npc wizard" style="' + at(wizX, wizY) + '">' + sprite(WIZARD, 'npc', PX) + '</span>';
    if (phase === 'sunrise') {
      // le matin : des vols d'oiseaux
      [[0.09, 24, -3], [0.15, 31, -16], [0.05, 27, -22]].forEach(f => {
        html += '<span class="birds" style="top:' + Math.round(f[0] * H) * PX + 'px;--t:' + f[1] + 's;--d:' + f[2] + 's">';
        [[0, 0, 0], [7, 2, -0.15], [3, 5, -0.3]].forEach(b => {
          html += '<span class="b" style="' + at(b[0], b[1]) + ';--fd:' + b[2] + 's">' + anim2(BIRD, 'bird', PX) + '</span>';
        });
        html += '</span>';
      });
    }
    if (phase === 'day') {
      // le jour : des calèches sur la route, dans les deux sens
      html += '<span class="cart ltr" style="top:' + (roadY - 10) * PX + 'px;--t:46s;--d:-8s">' + anim2(CART, 'cartp', PX) + '</span>';
      html += '<span class="cart rtl" style="top:' + (roadY - 9) * PX + 'px;--t:58s;--d:-33s">' + anim2(CART, 'cartp', PX) + '</span>';
    }
    if (phase === 'night') {
      // la nuit : un orage (nuages et éclairs, sans flash), des yeux qui brillent dans les arbres, des loups-garous
      const brnd = mulberry32(4242);
      [[0.045, 's1'], [0.93, 's2']].forEach(b => {
        const cw = Math.max(28, Math.round(W * 0.17)), ch = Math.round(cw * 0.38);
        const bx = Math.round(W * b[0]), cy = Math.round(H * 0.06);
        const top = cy + ch - 3, len = Math.max(14, Math.round(horizon - mh(bx)) + 1 - top);
        const cloud = stormCloud(cw, ch, brnd);
        html += '<span class="bolt ' + b[1] + '" style="' + at(bx - 7, top) + '">' + sprite(boltRows(len, brnd), 'boltp', PX) + '</span>';
        html += '<span class="storm" style="' + at(bx - Math.round(cw / 2), cy) + '">' + sprite(cloud, 'stormp', PX) +
          '<span class="lit ' + b[1] + '">' + sprite(cloud, 'stormlit', PX) + '</span></span>';
      });
      // de préférence sur les côtés, là où le décor reste visible autour de la liste
      const side = t => t.x < W * 0.28 || t.x > W * 0.72;
      const leafy = trees.filter(t => !t.pine && t.r >= 3 && side(t));
      [0.15, 0.5, 0.85].forEach((q, i) => {
        const t = leafy[Math.floor(q * leafy.length)];
        if (t) html += '<span class="eyes" style="' + at(t.x - 1, t.gy - 2 - t.r) + ';--t:' + (9 + i * 4) + 's;--d:-' + (i * 3.7).toFixed(1) + 's">' + sprite(EYES, 'mon', PX) + '</span>';
      });
      const hide = trees.filter(t => t.zone !== 'far' && side(t) && t.x < W - 10);
      const ht = hide[Math.floor(hide.length / 2)];
      if (ht) html += '<span class="peek" style="' + at(ht.x + ht.r + 1, ht.gy - 9) + ';--t:15s;--d:-4s">' + anim2(WOLF, 'mon', PX) + '</span>';
      html += '<span class="walker" style="top:' + (roadY - 8) * PX + 'px;--t:38s;--d:-14s">' + anim2(WOLF, 'mon', PX) + '</span>';
    }
    sparks.forEach((p, i) => {
      html += '<span class="fx twinkle" style="left:' + (p[0] * PX) + 'px;top:' + (p[1] * PX) + 'px;--d:-' + (i * 0.37).toFixed(2) + 's">' + sprite(FX.twinkle, 'fx', PX >= 4 ? 3 : 2) + '</span>';
    });
    worldDeco.innerHTML = html;
  }
  let sceneTimer = 0, lastSize = '';
  const sizeKey = () => (document.documentElement.clientWidth || window.innerWidth) + 'x' + window.innerHeight;
  window.addEventListener('resize', () => {
    clearTimeout(sceneTimer);
    sceneTimer = setTimeout(() => { const k = sizeKey(); if (k !== lastSize) { lastSize = k; drawScene(); } }, 120);
  });
  const refreshPhase = () => { const p = currentPhase(); if (p !== phase) { phase = p; drawScene(); } };
  setInterval(refreshPhase, 60000);
  window.addEventListener('hashchange', refreshPhase);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshPhase(); });
  lastSize = sizeKey();
  drawScene();

  /* ================= labels + helpers ================= */
  const STATUS = {
    todo: { label: 'Pas commencée', icon: 'todo' },
    doing: { label: 'En cours', icon: 'doing' },
    done: { label: 'Validée', icon: 'done' }
  };
  const RSTATUS = { todo: { label: 'À retenir', icon: 'bell' }, done: { label: 'C\'est fait', icon: 'done' } };
  const URG = { 1: 'Basse', 2: 'Moyenne', 3: 'Haute' };
  const CAT = { pro: { label: 'Pro', outfit: 'en mage' }, perso: { label: 'Perso', outfit: 'en troll-gobelin' } };
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
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

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

  /* ================= state ================= */
  // Réglages propres à cet appareil : style (bureau / aventure), filtre affiché (pro / perso / all), alertes, valeurs par défaut.
  const prefs = Object.assign({ cat: 'pro', urg: 2, kind: 'task', hour: 7, style: 'bureau', filter: 'all', alerts: false }, lsGet('pixel-todo-prefs', {}));
  const savePrefs = () => lsSet('pixel-todo-prefs', prefs);
  const S = {
    tasks: new Map(), view: 'tasks', expanded: new Set(), leaving: new Set(), fresh: new Set(),
    loaded: false, mode: FIREBASE_READY ? 'firebase' : (IN_CLAUDE ? 'claude' : 'local'), user: null, authChecked: !FIREBASE_READY,
    filter: ['pro', 'perso', 'all'].includes(prefs.filter) ? prefs.filter : 'all'
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
  const LOCAL_KEY = 'pixel-todo-local-tasks';
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
    render();
    Store.put(t);
    toast((t.kind === 'reminder' ? 'Rappel ajouté' : 'Tâche ajoutée') + (t.due ? ' pour ' + whenWords(t) : '') + '.');
  }
  function editTask(id, fields) {
    const t = S.tasks.get(id);
    if (!t) return;
    const next = normalize(id, Object.assign({}, t, fields));
    commit(next);
    S.fresh.add(id);
    render();
    Store.patch(id, { kind: next.kind, title: next.title, subject: next.subject, desc: next.desc, cat: next.cat, urg: next.urg, due: next.due, time: next.time, status: next.status, updatedAt: next.updatedAt });
    toast(next.kind === 'reminder' ? 'Rappel modifié.' : 'Tâche modifiée.');
  }
  // Nouvelle échéance (ou nouvelle date et heure d'un rappel), depuis le menu « … ».
  function setWhen(id, due, time) {
    const t = S.tasks.get(id);
    if (!t) return;
    const next = normalize(id, Object.assign({}, t, { due: due, time: time }));
    commit(next);
    S.fresh.add(id);
    render();
    Store.patch(id, { due: next.due, time: next.time, updatedAt: next.updatedAt });
    toast(next.kind === 'reminder'
      ? (next.due ? 'Rappel reporté à ' + whenWords(next) + '.' : 'Rappel sans date.')
      : (next.due ? 'Échéance : ' + whenWords(next) + '.' : 'Échéance retirée.'));
  }
  function snooze(id, mode) {
    const today = todayISO();
    const w = mode === 'tomorrow' ? { due: addDays(today, 1), time: '09:00' } : plusMinutes(today, nowHM(), 60);
    setWhen(id, w.due, w.time);
  }
  function setStatus(id, status) {
    const t = S.tasks.get(id);
    if (!t || t.status === status) return;
    if (status === 'done') { validate(id); return; }
    const next = Object.assign({}, t, { status: status });
    commit(next);
    render();
    Store.patch(id, { status: status, updatedAt: next.updatedAt });
  }
  function setUrg(id, urg) {
    const t = S.tasks.get(id);
    if (!t || t.urg === urg) return;
    const next = Object.assign({}, t, { urg: urg });
    commit(next);
    S.fresh.add(id);
    render();
    Store.patch(id, { urg: urg, updatedAt: next.updatedAt });
  }
  function validate(id) {
    const t = S.tasks.get(id);
    if (!t) return;
    const before = t.status;
    const card = cardEl(id);
    const finish = () => {
      S.leaving.delete(id);
      const cur = S.tasks.get(id);
      if (!cur) { render(); return; }
      const next = Object.assign({}, cur, { status: 'done', archived: true, archivedAt: Date.now() });
      commit(next);
      render();
      focusAfterRemoval();
      Store.patch(id, { status: 'done', archived: true, archivedAt: next.archivedAt, updatedAt: next.updatedAt });
      const undo = () => restore(id, before, true);
      if (isBz()) toast(next.kind === 'reminder' ? 'Rappel « ' + next.title + ' » terminé.' : 'Tâche « ' + next.title + ' » terminée.', 'Annuler', undo);
      else toast('« ' + next.title + ' » part aux archives.', 'Annuler', undo, next.kind === 'reminder' ? 'RAPPEL CLASSÉ !' : 'QUÊTE ACCOMPLIE !');
    };
    if (!card || reduced()) { finish(); return; }
    if (!isBz()) burst(card.querySelector('.status-box') || card);
    S.leaving.add(id);
    card.classList.add('is-leaving');
    setTimeout(finish, isBz() ? 210 : 520);
  }
  function restore(id, status, isUndo) {
    const t = S.tasks.get(id);
    if (!t) return;
    // Bureau : on décoche, la tâche revient « à faire ». Aventure : « Remettre en cours ».
    const back = status || (t.kind === 'reminder' || isBz() ? 'todo' : 'doing');
    const next = Object.assign({}, t, { status: back, archived: false, archivedAt: null });
    commit(next);
    S.fresh.add(id);
    render();
    Store.patch(id, { status: back, archived: false, archivedAt: null, updatedAt: next.updatedAt });
    toast(isUndo || back !== 'doing' ? '« ' + next.title + ' » est de retour dans la liste.' : '« ' + next.title + ' » est de retour dans ta liste, en cours.');
  }
  function removeTask(id) {
    const t = S.tasks.get(id);
    if (!t) return;
    S.tasks.delete(id);
    S.expanded.delete(id);
    render();
    focusAfterRemoval();
    Store.remove(id);
    toast(t.kind === 'reminder' ? 'Rappel supprimé.' : 'Tâche supprimée.');
  }

  /* ================= rendering ================= */
  const els = {
    title: $('#view-title'), subline: $('#subline'),
    authView: $('#view-auth'), tasksView: $('#view-tasks'), archiveView: $('#view-archive'),
    list: $('#task-list'), archive: $('#archive-list'), addRow: $('#add-row'),
    modeNote: $('#mode-note'), modeNoteText: $('#mode-note-text'), rampart: $('#rampart'),
    toArchive: $('#to-archive'), toTasks: $('#to-tasks'), archiveCount: $('#archive-count'),
    bzTitle: $('#bz-title'), bzSub: $('#bz-sub'), controls: $('#controls'), filter: $('#filter'),
    bzArchive: $('#bz-archive'), bzArchiveCount: $('#bz-archive-count'), bzBack: $('#bz-back'),
    quick: $('#quick-form'), qInput: $('#q-input'), qPreview: $('#q-preview')
  };
  $('#chest-ico').innerHTML = ico('chest', 2);
  $('#back-ico').innerHTML = ico('back', 2);
  $('#add-plus').innerHTML = ico('plus', 3);
  $('#settings-btn').innerHTML = ico('gear', 3);
  $('#popout').innerHTML = ico('window', 3);
  // Dans Claude : une fenêtre à part en plus (les réglages n'y montrent que ce qui marche dans la page).
  if (IN_CLAUDE) { $('#popout').hidden = false; $('#bz-popout').hidden = false; }
  $('#star-l').innerHTML = ico('star', 3);
  $('#star-r').innerHTML = ico('star', 3);
  $('#stage-pro').innerHTML = charFull('pro', 3);
  $('#stage-perso').innerHTML = charFull('perso', 3);
  $('#kind-ico-task').innerHTML = ico('tome', 3);
  $('#kind-ico-reminder').innerHTML = ico('scroll', 3);
  document.querySelectorAll('.urg-ico').forEach(el => { el.innerHTML = chevrons(Number(el.dataset.n), 2); });
  // Style Bureau : icônes à traits fins.
  $('#bz-mark').innerHTML = svgIco('check', 14);
  $('#bz-settings').innerHTML = svgIco('sliders', 20);
  $('#bz-popout').innerHTML = svgIco('popout', 19);
  $('#bz-next-ico').innerHTML = svgIco('next', 14);
  $('#bz-back-ico').innerHTML = svgIco('back', 14);
  document.querySelectorAll('.pri-ico').forEach(el => { el.innerHTML = priBars(Number(el.dataset.n)); });
  const setStyleIcons = () => { $('#q-ico').innerHTML = isBz() ? svgIco('plus', 18) : ico('plus', 2); };
  setStyleIcons();

  const cardEl = id => document.querySelector('.card[data-id="' + id + '"], .row[data-id="' + id + '"]');
  const byUrgency = (a, b) => (b.urg - a.urg) || (a.createdAt - b.createdAt);
  const byArchived = (a, b) => (b.archivedAt - a.archivedAt);
  const inFilter = t => S.filter === 'all' || t.cat === S.filter;
  // En retard : échéance passée, ou rappel d'aujourd'hui dont l'heure est passée.
  const isLate = (t, today, hm) => !!t.due && (t.due < today || (t.kind === 'reminder' && t.due === today && !!t.time && t.time <= hm));
  // Groupes de la liste, dans l'ordre : en retard, aujourd'hui, à venir, sans échéance.
  // Dans chaque groupe : le jour d'abord (« en retard », « à venir »), puis la priorité, puis l'heure, puis l'ancienneté.
  const GROUPS = [['late', 'En retard'], ['today', 'Aujourd\'hui'], ['soon', 'À venir'], ['none', 'Sans échéance']];
  const byWhen = (a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : 0) || ((a.time || '99') < (b.time || '99') ? -1 : (a.time || '99') > (b.time || '99') ? 1 : 0);
  function groupTasks(list, today) {
    const g = { late: [], today: [], soon: [], none: [] };
    list.forEach(t => { g[!t.due ? 'none' : t.due < today ? 'late' : t.due === today ? 'today' : 'soon'].push(t); });
    const byDay = (a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : 0);
    g.late.sort((a, b) => byDay(a, b) || (b.urg - a.urg) || byWhen(a, b) || (a.createdAt - b.createdAt));
    g.today.sort((a, b) => (b.urg - a.urg) || byWhen(a, b) || (a.createdAt - b.createdAt));
    g.soon.sort((a, b) => byDay(a, b) || (b.urg - a.urg) || byWhen(a, b) || (a.createdAt - b.createdAt));
    g.none.sort(byUrgency);
    return GROUPS.filter(([k]) => g[k].length).map(([k, label]) => ({ key: k, label: label, items: g[k] }));
  }
  // Rappel : page de grimoire déchirée. Tâche : pierre volcanique (haute), dalle de pierre (moyenne), parchemin abîmé (faible).
  const lookOf = t => t.kind === 'reminder' ? 't-page' : (t.urg === 3 ? 't-lava' : (t.urg === 2 ? 't-stone' : 't-vellum'));
  // La longue fiole : vide (pas commencée), liquide qui monte et descend doucement avec son écume (en cours), pleine (validée).
  // Plus la tâche est urgente, plus ça bouillonne : vert calme, bleu, puis potion de feu qui bout sur place.
  // --ph cale la marée sur l'horloge (cycle de 18 s) : quand la liste se redessine, le niveau ne saute pas.
  const BUBBLES = { 't-vellum': 2, 't-stone': 3, 't-lava': 9 };
  const flaskHTML = (st, look) => {
    let inner = '', ph = '';
    if (st === 'doing') {
      for (let i = 1; i <= (BUBBLES[look] || 3); i++) inner += '<span class="bub b' + i + '"></span>';
      inner += anim2(FOAM, 'foam', 2, 'foam-edge');
      ph = ' style="--ph:-' + (Date.now() % 18000 / 1000).toFixed(2) + 's"';
    }
    return '<div class="flask" data-state="' + st + '"' + ph + ' aria-hidden="true"><div class="glass"><div class="tube"><div class="liquid">' + inner +
      '</div></div></div><span class="neck">' + sprite(NECK, 'neckp', 2) + '</span></div>';
  };

  function decoHTML(look) {
    if (look === 't-stone') return '<span class="deco ivy">' + sprite(IVY, 'deco', 3) + '</span><span class="deco ivy ivy2">' + sprite(IVY, 'deco', 3) + '</span>';
    if (look === 't-lava') return '<span class="deco lava">' + sprite(LAVA, 'lava', 3) + '</span><span class="deco lava lava2">' + sprite(LAVA, 'lava', 3) + '</span>';
    return '';
  }

  function cardHTML(t, archived) {
    const open = S.expanded.has(t.id);
    const look = lookOf(t);
    const isR = t.kind === 'reminder';
    const st = archived ? 'done' : t.status;
    const stInfo = isR ? (RSTATUS[st] || RSTATUS.todo) : STATUS[st];
    const cls = 'card ' + look + (open ? ' is-open' : '') + (archived ? ' is-archived' : '') + (S.leaving.has(t.id) ? ' is-leaving' : '') + (S.fresh.has(t.id) && !reduced() ? ' is-new' : '');
    const status = archived
      ? '<span class="box status-box" role="img" aria-label="' + (isR ? 'Fait' : 'Validée') + '">' + staIcon('done', 3) + '</span>'
      : '<button type="button" class="box status-box" data-act="status" aria-haspopup="menu" aria-expanded="false" aria-label="Statut : ' + stInfo.label + '. Changer le statut">' + staIcon(stInfo.icon, 3) + '</button>';
    const urgLabel = 'Urgence ' + URG[t.urg].toLowerCase();
    let urg;
    if (isR) {
      urg = archived
        ? '<span class="seal-btn is-static" role="img" aria-label="' + urgLabel + '"><span class="seal" data-urg="' + t.urg + '">' + seal(t.urg) + '</span></span>'
        : '<button type="button" class="seal-btn" data-act="urg" aria-haspopup="menu" aria-expanded="false" aria-label="' + urgLabel + '. Changer l\'urgence"><span class="seal" data-urg="' + t.urg + '">' + seal(t.urg) + '</span></button>';
    } else {
      urg = archived
        ? '<span class="box urg" role="img" aria-label="' + urgLabel + '">' + chevrons(t.urg) + '</span>'
        : '<button type="button" class="box urg" data-act="urg" aria-haspopup="menu" aria-expanded="false" aria-label="' + urgLabel + '. Changer l\'urgence">' + chevrons(t.urg) + '</button>';
    }
    const middle = isR
      ? '<span class="scroll-label">' + ico('quill', 2) + '</span>'
      : flaskHTML(st, look);
    const today = todayISO();
    const subject = (t.subject ? '<p class="subject">' + ico('mail', 2) + '<span>' + esc(t.subject) + '</span></p>' : '') +
      (t.due && !archived ? '<p class="subject due-line' + (isLate(t, today, nowHM()) ? ' late' : '') + '">' + ico('clock', 2) + '<span>' +
        dayLabel(t.due, today) + (t.time ? ' à ' + t.time : '') + '</span></p>' : '');
    const actions = archived ? '' :
      '<div class="desc-actions">' +
        '<button type="button" class="btn btn-act" data-act="edit">' + ico('pencil', 2) + '<span>Modifier</span></button>' +
        '<button type="button" class="btn btn-act btn-danger" data-act="delete">' + ico('trash', 2) + '<span>Supprimer</span></button>' +
      '</div>';
    const meta = 'Créé' + (isR ? '' : 'e') + ' ' + when(t.createdAt) + (archived && t.archivedAt ? ' · classé' + (isR ? '' : 'e') + ' ' + when(t.archivedAt) : '');
    return '<article class="' + cls + '" data-id="' + esc(t.id) + '" data-kind="' + t.kind + '" data-status="' + st + '" data-urg="' + t.urg + '" data-cat="' + t.cat + '">' +
      decoHTML(look) +
      '<div class="card-top">' + status +
        '<div class="card-text"><h3 class="card-title">' + esc(t.title) + '</h3>' + subject + '</div>' +
        '<div class="side"><button type="button" class="box more" data-act="toggle" aria-expanded="' + open + '" aria-controls="d-' + esc(t.id) + '" aria-label="' + (open ? 'Masquer' : 'Afficher') + ' la description">' + ico(open ? 'minus' : 'plus', 3) + '</button></div>' +
      '</div>' +
      '<div class="desc" id="d-' + esc(t.id) + '"' + (open ? '' : ' hidden') + '>' +
        (t.desc ? '<p class="desc-text">' + esc(t.desc) + '</p>' : '<p class="desc-text is-empty">Pas de description.</p>') +
        '<p class="meta">' + meta + '</p>' + actions +
      '</div>' +
      '<div class="card-foot">' + urg + middle +
        '<span class="portrait" data-cat="' + t.cat + '" role="img" aria-label="' + CAT[t.cat].label + ', ' + CAT[t.cat].outfit + '">' + charBust(t.cat) + '</span>' +
      '</div>' +
      (archived
        ? '<div class="restore-row"><button type="button" class="btn btn-go" data-act="restore">' + ico('back', 2) + '<span>Remettre en cours</span></button>' +
          '<button type="button" class="btn btn-icon btn-danger" data-act="delete" aria-label="Supprimer définitivement">' + ico('trash', 2) + '</button></div>'
        : '') +
    '</article>';
  }
  /* ---------- Bureau : une ligne par tâche, dans une liste à filets ---------- */
  function rowHTML(t, archived, today, hm) {
    const open = S.expanded.has(t.id);
    const isR = t.kind === 'reminder';
    const st = archived ? 'done' : t.status;
    const late = !archived && isLate(t, today, hm);
    const what = (isR ? 'le rappel' : 'la tâche') + ' « ' + t.title + ' »';
    const cls = 'row' + (open ? ' is-open' : '') + (archived ? ' is-done' : '') + (S.leaving.has(t.id) ? ' is-leaving' : '') + (S.fresh.has(t.id) && !reduced() ? ' is-new' : '');
    const chk = '<button type="button" class="chk" data-act="' + (archived ? 'restore' : 'done') + '" aria-label="' +
      esc(archived ? 'Remettre ' + what + ' dans la liste' : 'Terminer ' + what) + '">' + svgIco('check', 13) + '</button>';
    const meta = ['<span class="pri" data-urg="' + t.urg + '">' + priBars(t.urg) + '<span>' + URG[t.urg] + '</span></span>'];
    if (archived) meta.push('<span class="when">' + (isR ? 'Terminé ' : 'Terminée ') + when(t.archivedAt) + '</span>');
    else if (t.due) meta.push('<span class="due' + (late ? ' late' : '') + '">' + svgIco(isR ? 'bell' : 'cal', 13) + '<span>' + esc(dayLabel(t.due, today)) + '</span>' + (t.time ? '<span class="tm">' + t.time + '</span>' : '') + '</span>');
    else if (isR) meta.push('<span class="due">' + svgIco('bell', 13) + '<span>Rappel</span></span>');
    if (!archived && st === 'doing') meta.push('<span class="chip doing">En cours</span>');
    if (S.filter === 'all' && t.cat === 'perso') meta.push('<span class="chip cat">Perso</span>');
    const details = '<div class="row-details" id="d-' + esc(t.id) + '"' + (open ? '' : ' hidden') + '>' +
      (t.desc ? '<p class="desc-text">' + esc(t.desc) + '</p>' : '<p class="desc-text is-empty">Pas de description.</p>') +
      '<p class="meta">' + (isR ? 'Créé ' : 'Créée ') + when(t.createdAt) + '</p>' +
      '<div class="desc-actions">' + (archived
        ? '<button type="button" class="btn btn-act" data-act="restore">' + svgIco('undo', 15) + '<span>Remettre dans la liste</span></button>'
        : '<button type="button" class="btn btn-act" data-act="edit">' + svgIco('pencil', 15) + '<span>Modifier</span></button>') +
        '<button type="button" class="btn btn-act btn-danger" data-act="delete">' + svgIco('trash', 15) + '<span>Supprimer</span></button></div>' +
      '</div>';
    return '<li class="' + cls + '" data-id="' + esc(t.id) + '" data-kind="' + t.kind + '" data-status="' + st + '" data-urg="' + t.urg + '" data-cat="' + t.cat + '">' + chk +
      '<button type="button" class="row-open" data-act="toggle" aria-expanded="' + open + '" aria-controls="d-' + esc(t.id) + '">' +
        '<span class="row-title">' + esc(t.title) + '</span>' +
        (t.subject ? '<span class="row-sub">' + esc(t.subject) + '</span>' : '') +
        '<span class="row-meta">' + meta.join('') + '</span>' +
      '</button>' +
      '<button type="button" class="more-btn" data-act="more" aria-haspopup="menu" aria-expanded="false" aria-label="' + esc('Actions pour ' + what) + '">' + svgIco('dots', 18) + '</button>' +
      details + '</li>';
  }
  // La liste du jour, groupée par échéance (pas d'en-tête quand tout est « sans échéance »).
  function groupsHTML(list, today, hm) {
    const groups = groupTasks(list, today);
    const solo = groups.length === 1 && groups[0].key === 'none';
    const head = g => solo ? '' : '<h2 class="grp-h" id="g-' + g.key + '">' + g.label + '<span class="n">' + g.items.length + '</span></h2>';
    return groups.map(g => '<section class="grp" data-g="' + g.key + '"' + (solo ? ' aria-label="Tâches"' : ' aria-labelledby="g-' + g.key + '"') + '>' + head(g) +
      (isBz() ? '<ul class="rows">' + g.items.map(t => rowHTML(t, false, today, hm)).join('') + '</ul>' : g.items.map(t => cardHTML(t, false)).join('')) +
      '</section>').join('');
  }
  function emptyHTML(kind, hidden) {
    if (isBz()) {
      if (kind === 'archive') return '<div class="empty"><p class="empty-title">Aucune tâche terminée</p><p>Ce que tu termines arrive ici, avec la date. Tu peux le remettre dans la liste à tout moment.</p></div>';
      if (hidden) return '<div class="empty"><p class="empty-title">Rien en ' + CAT[S.filter].label + ' pour l\'instant</p><p>' + plural(hidden, 'élément') + ' ' + (S.filter === 'pro' ? 'perso' : 'pro') + (hidden > 1 ? ' sont masqués' : ' est masqué') + ' par le filtre.</p></div>';
      return '<div class="empty"><p class="empty-title">Rien à faire pour l\'instant</p><p>Écris une tâche dans le champ ci-dessus. Une date devient l\'échéance, une heure crée un rappel.</p>' +
        '<div class="ex"><span>Rappeler le fournisseur demain 14h</span><span>Rapport mensuel pour lundi !</span><span>Changer le toner du 2e étage</span></div></div>';
    }
    if (kind === 'archive') {
      return '<div class="empty"><span class="stage" style="background-color:#c5d7ea">' + charFull('pro', 3) + '</span>' +
        '<div class="empty-text"><p class="empty-title">Coffre vide</p><p>Les tâches validées et les rappels classés arriveront ici.</p></div></div>';
    }
    return '<div class="empty"><span class="stage">' + charFull('perso', 3) + '</span>' +
      '<div class="empty-text"><p class="empty-title">Le grimoire est vide</p><p>' + (hidden ? 'Le filtre masque ' + plural(hidden, 'entrée') + '. ' : '') + 'Ajoute une tâche ou un rappel avec le champ du haut ou le bouton juste en dessous.</p></div></div>';
  }
  const bootHTML = () => isBz()
    ? '<div class="boot" role="status"><span>Chargement de ta liste…</span><span class="boot-bar"></span></div>'
    : '<div class="boot"><p class="boot-title">OUVERTURE DU GRIMOIRE</p>' + flaskHTML('doing') + '</div>';

  function syncFilter() {
    els.filter.querySelectorAll('[data-f]').forEach(b => {
      const on = b.dataset.f === S.filter;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
    });
  }
  function setSub(text, html) {
    els.subline.textContent = text;
    if (html != null) els.bzSub.innerHTML = html; else els.bzSub.textContent = text;
  }
  let lastSig = '';
  function render() {
    const focus = captureFocus();
    const bz = isBz();
    const signedOut = S.mode === 'firebase' && S.authChecked && !S.user;
    const isArchive = S.view === 'archive' && !signedOut;
    const ready = S.loaded && S.authChecked;
    els.authView.hidden = !signedOut;
    els.tasksView.hidden = signedOut || isArchive;
    els.archiveView.hidden = !isArchive;
    els.rampart.hidden = signedOut || !S.authChecked;
    els.toArchive.hidden = isArchive;
    els.toTasks.hidden = !isArchive;
    els.controls.hidden = signedOut || !ready;
    els.quick.hidden = signedOut || !ready || isArchive;
    els.bzArchive.hidden = isArchive;
    els.bzBack.hidden = !isArchive;
    els.title.innerHTML = isArchive ? ico('chest', 3) + '<span>Archives</span>' : '<span>To do list</span>';
    els.bzTitle.textContent = isArchive ? 'Terminées' : 'To do list';
    syncFilter();
    updatePreview();
    if (signedOut) {
      setSub(bz ? 'Connecte-toi pour retrouver ta liste' : 'Connecte-toi pour ouvrir ton grimoire');
      return;
    }
    const today = todayISO(), hm = nowHM();
    const everything = Array.from(S.tasks.values());
    const all = everything.filter(inFilter);
    const current = all.filter(t => !t.archived);
    const archived = all.filter(t => t.archived).sort(byArchived);
    els.archiveCount.textContent = String(archived.length);
    els.bzArchiveCount.textContent = String(archived.length);
    els.archiveCount.hidden = !S.loaded;
    if (!ready) {
      setSub(bz ? 'Chargement…' : 'Ouverture du grimoire…');
      els.list.innerHTML = bootHTML();
      els.addRow.hidden = true;
      els.modeNote.hidden = true;
      return;
    }
    if (isArchive) {
      setSub(archived.length ? (bz ? plural(archived.length, 'terminée') : plural(archived.length, 'entrée') + ' classée' + (archived.length > 1 ? 's' : '')) : (bz ? 'Rien de terminé pour l\'instant' : 'Rien dans le coffre pour l\'instant'));
      els.archive.innerHTML = archived.length
        ? (bz ? '<ul class="rows">' + archived.map(t => rowHTML(t, true, today, hm)).join('') + '</ul>' : archived.map(t => cardHTML(t, true)).join(''))
        : emptyHTML('archive');
    } else {
      const tasks = current.filter(t => t.kind === 'task').length;
      const rem = current.length - tasks;
      const late = current.filter(t => isLate(t, today, hm)).length;
      const urgent = current.filter(t => t.urg === 3).length;
      const day = cap(dayFmt.format(new Date()));
      const parts = [day, tasks ? plural(tasks, 'tâche') : (rem ? 'aucune tâche' : 'rien de prévu')];
      if (rem) parts.push(plural(rem, 'rappel'));
      if (!bz && urgent) parts.push(plural(urgent, 'urgente'));
      if (late) parts.push(late + ' en retard');
      // Bureau : chaque morceau reste entier quand la ligne passe à la ligne ; le retard en brique.
      setSub(parts.join(' · '), parts.map((x, i) => '<span class="part' + (late && i === parts.length - 1 ? ' late' : '') + '">' + esc(x) + '</span>').join(' · '));
      const hidden = everything.filter(t => !t.archived && !inFilter(t)).length;
      els.list.innerHTML = current.length ? groupsHTML(current, today, hm) : emptyHTML('tasks', hidden);
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
    restoreFocus(focus);
    syncMenuAnchor();
    updateBadge();
    checkAlerts();
  }
  function captureFocus() {
    const a = document.activeElement;
    if (!a || !a.dataset || !a.dataset.act) return null;
    const card = a.closest('.card, .row');
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
    const first = (S.view === 'archive' ? els.archive : els.list).querySelector('[data-act="status"], [data-act="done"], [data-act="restore"]');
    const fallback = S.view === 'archive' ? (isBz() ? els.bzBack : els.toTasks) : (isBz() ? els.qInput : $('#add-btn'));
    (first || fallback).focus({ preventScroll: true });
  }

  /* ================= menus ================= */
  const menu = $('#menu');
  let menuState = null;
  // Menu « … » du style Bureau : statut, priorité, échéance (ou report d'un rappel), modifier, supprimer.
  const dayShort = iso => { const p = isoParts(iso); return p[2] + ' ' + MO[p[1] - 1]; };
  function moreItems(t) {
    const today = todayISO();
    const it = (value, label, icon, extra) => Object.assign({ type: 'item', value: value, label: label, icon: icon }, extra || {});
    if (t.archived) return [it('restore', 'Remettre dans la liste', svgIco('undo', 16)), { type: 'sep' }, it('delete', 'Supprimer définitivement…', svgIco('trash', 16), { cls: 'danger' })];
    const items = [];
    if (t.kind === 'task') items.push(t.status === 'doing' ? it('st:todo', 'Mettre en pause', svgIco('pause', 16)) : it('st:doing', 'Commencer', svgIco('play', 16)));
    items.push(it('done', t.kind === 'reminder' ? 'Marquer comme fait' : 'Terminer', svgIco('check', 16)));
    items.push({ type: 'sep' }, { type: 'label', label: 'Priorité' });
    [3, 2, 1].forEach(v => items.push(it('urg:' + v, URG[v], '<span class="pri-ico" data-urg="' + v + '">' + priBars(v) + '</span>', { role: 'menuitemradio', checked: t.urg === v })));
    items.push({ type: 'sep' });
    if (t.kind === 'reminder') {
      const h = plusMinutes(today, nowHM(), 60);
      items.push({ type: 'label', label: 'Reporter' },
        it('snooze:1h', 'Dans 1 heure', svgIco('clock', 16), { hint: (h.due === today ? '' : 'demain ') + h.time }),
        it('snooze:tomorrow', 'Demain matin', svgIco('cal', 16), { hint: '09:00' }));
    } else {
      items.push({ type: 'label', label: 'Échéance' });
      const opts = [['today', 'Aujourd\'hui', today], ['tomorrow', 'Demain', addDays(today, 1)], ['monday', 'Lundi prochain', nextWeekday(today, 1)], ['none', 'Sans échéance', null]];
      opts.forEach(o => items.push(it('due:' + o[0], o[1], svgIco(o[0] === 'none' ? 'none' : 'cal', 16), { role: 'menuitemradio', checked: (t.due || null) === o[2], hint: o[0] === 'monday' ? dayShort(o[2]) : '' })));
    }
    items.push({ type: 'sep' }, it('edit', 'Modifier…', svgIco('pencil', 16)), it('delete', 'Supprimer…', svgIco('trash', 16), { cls: 'danger' }));
    return items;
  }
  function openMenu(anchor, kind, id) {
    closeMenu();
    const t = S.tasks.get(id);
    if (!t) return;
    if (kind === 'more') {
      menu.className = 'menu';
      menu.innerHTML = moreItems(t).map(it => it.type === 'sep' ? '<div class="menu-sep" role="separator"></div>'
        : it.type === 'label' ? '<p class="menu-label" role="presentation">' + it.label + '</p>'
        : '<button type="button" class="menu-item' + (it.cls ? ' ' + it.cls : '') + '" role="' + (it.role || 'menuitem') + '"' +
          (it.role === 'menuitemradio' ? ' aria-checked="' + !!it.checked + '"' : '') + ' data-value="' + it.value + '">' +
          '<span class="mi-ico">' + it.icon + '</span><span>' + it.label + '</span>' +
          (it.hint ? '<span class="hint">' + it.hint + '</span>' : '') + (it.checked ? '<span class="mi-ok">' + svgIco('check', 15) + '</span>' : '') + '</button>').join('');
      menu.setAttribute('aria-label', 'Actions pour « ' + t.title + ' »');
    } else {
      let items;
      if (kind === 'status') {
        const map = t.kind === 'reminder' ? RSTATUS : STATUS;
        items = Object.keys(map).map(v => ({ value: v, icon: staIcon(map[v].icon, 2), label: map[v].label, hint: '', checked: t.status === v }));
      } else {
        items = [3, 2, 1].map(v => ({
          value: String(v), icon: '<span class="chev" style="--urg-c:var(--u' + v + ')">' + chevrons(v, 2) + '</span>',
          label: URG[v], hint: '', checked: t.urg === v
        }));
      }
      // Petit menu compact qui apparaît en douceur, juste à côté de la case touchée.
      menu.className = 'menu';
      menu.innerHTML = items.map(it =>
        '<button type="button" class="menu-item" role="menuitemradio" aria-checked="' + it.checked + '" data-value="' + it.value + '">' +
          '<span class="cur">' + ico('cursor', 2) + '</span>' + it.icon + '<span>' + it.label + '</span>' +
          (it.hint ? '<span class="hint">' + it.hint + '</span>' : '') + '</button>').join('');
      menu.setAttribute('aria-label', kind === 'status' ? 'Statut' : 'Urgence');
    }
    menu.hidden = false;
    menuState = { kind: kind, id: id };
    anchor.setAttribute('aria-expanded', 'true');
    const above = placeMenu(anchor);
    if (!reduced()) {
      menu.style.setProperty('--from-y', above ? '6px' : '-6px');
      menu.style.transformOrigin = above ? 'left bottom' : 'left top';
      void menu.offsetWidth;
      menu.classList.add('is-opening');
    }
    ((kind !== 'more' && menu.querySelector('[aria-checked="true"]')) || menu.querySelector('.menu-item')).focus({ preventScroll: true });
  }
  menu.addEventListener('animationend', e => { if (e.target === menu) menu.classList.remove('is-opening'); });
  function placeMenu(anchor) {
    const r = anchor.getBoundingClientRect();
    const m = menu.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const gap = 6;
    // Le menu « … » s'aligne sur le bord droit du bouton, les autres sur le bord gauche.
    const wanted = menuState && menuState.kind === 'more' ? r.right - m.width : r.left - 2;
    const left = Math.min(Math.max(10, wanted), vw - m.width - 10);
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
    closeMenu(!['done', 'edit', 'delete'].includes(value));
    if (st.kind === 'more') moreAction(st.id, value);
    else if (st.kind === 'status') setStatus(st.id, value); else setUrg(st.id, Number(value));
  });
  function moreAction(id, v) {
    const today = todayISO();
    if (v === 'done') validate(id);
    else if (v === 'st:doing' || v === 'st:todo') setStatus(id, v.slice(3));
    else if (v.indexOf('urg:') === 0) setUrg(id, Number(v.slice(4)));
    else if (v === 'due:today') setWhen(id, today, null);
    else if (v === 'due:tomorrow') setWhen(id, addDays(today, 1), null);
    else if (v === 'due:monday') setWhen(id, nextWeekday(today, 1), null);
    else if (v === 'due:none') setWhen(id, null, null);
    else if (v === 'snooze:1h') snooze(id, '1h');
    else if (v === 'snooze:tomorrow') snooze(id, 'tomorrow');
    else if (v === 'edit') openTaskDialog(id);
    else if (v === 'delete') askDelete(id);
    else if (v === 'restore') restore(id);
  }
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

  /* ================= list interactions ================= */
  function askDelete(id) {
    const t = S.tasks.get(id);
    if (!t) return;
    const isR = t.kind === 'reminder';
    confirmBox('Supprimer ?', (isR ? 'Le rappel « ' : 'La tâche « ') + t.title + ' » sera supprimé' + (isR ? '' : 'e') + ' pour de bon.', 'Supprimer', () => removeTask(id));
  }
  function onListClick(e) {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const card = btn.closest('.card, .row');
    if (!card) return;
    const id = card.dataset.id;
    const act = btn.dataset.act;
    if (act === 'status' || act === 'urg' || act === 'more') {
      if (menuState && menuState.id === id && menuState.kind === act) { closeMenu(true); return; }
      openMenu(btn, act, id);
    } else if (act === 'done') {
      validate(id);
    } else if (act === 'toggle') {
      if (S.expanded.has(id)) S.expanded.delete(id); else S.expanded.add(id);
      render();
    } else if (act === 'edit') {
      openTaskDialog(id);
    } else if (act === 'delete') {
      askDelete(id);
    } else if (act === 'restore') {
      restore(id);
    }
  }
  els.list.addEventListener('click', onListClick);
  els.archive.addEventListener('click', onListClick);
  function switchView(view) {
    closeMenu(false);
    S.view = view;
    render();
    window.scrollTo(0, 0);
    const target = isBz() ? (view === 'archive' ? els.bzBack : els.bzArchive) : (view === 'archive' ? els.toTasks : els.toArchive);
    target.focus({ preventScroll: true });
  }
  els.bzArchive.addEventListener('click', () => switchView('archive'));
  els.bzBack.addEventListener('click', () => switchView('tasks'));
  els.toArchive.addEventListener('click', () => switchView('archive'));
  els.toTasks.addEventListener('click', () => switchView('tasks'));

  /* ================= dialogs ================= */
  const openDlg = d => { if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', ''); };
  const closeDlg = d => { if (typeof d.close === 'function') d.close(); else d.removeAttribute('open'); };

  const dlg = $('#task-dlg');
  const form = $('#task-form');
  const fTitle = $('#f-title'), fSubject = $('#f-subject'), fDesc = $('#f-desc'), fErr = $('#f-title-err');
  const fDue = $('#f-due'), fTime = $('#f-time'), fWhenLegend = $('#f-when-legend'), fQuickDates = $('#f-quick-dates');
  let editingId = null, dlgFromQuick = false;
  const formKind = () => ($('#f-kind-reminder').checked ? 'reminder' : 'task');
  function syncDialogTitle() {
    const k = formKind();
    $('#dlg-title').textContent = editingId ? (k === 'reminder' ? 'Modifier le rappel' : 'Modifier la tâche') : (k === 'reminder' ? 'Nouveau rappel' : 'Nouvelle tâche');
    // Un rappel a une date et une heure ; une tâche, une échéance (jour seulement).
    fTime.hidden = k !== 'reminder';
    fWhenLegend.innerHTML = (k === 'reminder' ? 'Date et heure' : 'Échéance') + ' <span class="field-hint">(facultatif)</span>';
    syncQuickDates();
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
  });
  fDue.addEventListener('input', syncQuickDates);
  fDue.addEventListener('change', syncQuickDates);
  // Une heure sans date : aujourd'hui si l'heure est encore à venir, sinon demain.
  fTime.addEventListener('change', () => {
    if (fTime.value && !fDue.value) { const today = todayISO(); fDue.value = fTime.value > nowHM() ? today : addDays(today, 1); syncQuickDates(); }
  });
  // preset : ce qui a été lu dans l'ajout rapide (titre, type, date, heure, priorité).
  function openTaskDialog(id, preset) {
    closeMenu(false);
    const t = id ? S.tasks.get(id) : null;
    const pr = preset || {};
    editingId = t ? t.id : null;
    if (t) dlgFromQuick = false;
    $('#dlg-ok').textContent = t ? 'Enregistrer' : 'Ajouter';
    fTitle.value = t ? t.title : (pr.title || '');
    fSubject.value = t ? t.subject : '';
    fDesc.value = t ? t.desc : '';
    const kind = t ? t.kind : (pr.kind || prefs.kind);
    const cat = t ? t.cat : (S.filter !== 'all' ? S.filter : prefs.cat);
    const urg = t ? t.urg : (pr.urg || prefs.urg);
    fDue.value = t ? (t.due || '') : (pr.due || '');
    fTime.value = t ? (t.time || '') : (pr.time || '');
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
  $('#add-btn').addEventListener('click', () => { dlgFromQuick = false; openTaskDialog(null); });
  $('#dlg-cancel').addEventListener('click', () => closeDlg(dlg));
  dlg.addEventListener('click', e => { if (e.target === dlg) closeDlg(dlg); });
  form.addEventListener('submit', e => {
    e.preventDefault();
    const title = fTitle.value.trim();
    if (!title) {
      fErr.hidden = false;
      fTitle.setAttribute('aria-invalid', 'true');
      fTitle.setAttribute('aria-describedby', 'f-title-err');
      fTitle.focus();
      return;
    }
    const kind = formKind();
    const cat = (form.querySelector('input[name="cat"]:checked') || {}).value === 'perso' ? 'perso' : 'pro';
    const urg = Number((form.querySelector('input[name="urg"]:checked') || {}).value) || 2;
    const due = isISO(fDue.value) ? fDue.value : null;
    const time = kind === 'reminder' && due && isHM(fTime.value) ? fTime.value : null;
    const fields = { kind: kind, title: title, subject: fSubject.value.trim(), desc: fDesc.value.trim(), cat: cat, urg: urg, due: due, time: time };
    closeDlg(dlg);
    if (editingId) editTask(editingId, fields);
    else {
      prefs.cat = cat; prefs.urg = urg; prefs.kind = kind; savePrefs();
      addTask(fields);
      if (dlgFromQuick) { els.qInput.value = ''; updatePreview(); }
    }
    editingId = null;
    dlgFromQuick = false;
  });
  fTitle.addEventListener('input', () => { if (fTitle.value.trim()) { fErr.hidden = true; fTitle.removeAttribute('aria-invalid'); } });

  /* ================= ajout rapide, filtre, raccourcis ================= */
  const quickCat = () => S.filter === 'perso' ? 'perso' : 'pro';
  const finePointer = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  // Sous le champ : ce qui sera créé (« Rappel · Demain à 14:00 · Pro · priorité moyenne »).
  function updatePreview() {
    const v = els.qInput.value.trim();
    if (!v || els.quick.hidden) { els.qPreview.hidden = true; els.qPreview.textContent = ''; return; }
    const today = todayISO();
    const q = parseQuick(v, today, nowHM());
    const parts = ['<b>' + (q.kind === 'reminder' ? 'Rappel' : 'Tâche') + '</b>'];
    parts.push(q.due ? esc(dayLabel(q.due, today)) + (q.time ? ' à <span class="tm">' + q.time + '</span>' : '') : 'sans échéance');
    parts.push(CAT[quickCat()].label, 'priorité ' + URG[q.urg || 2].toLowerCase());
    els.qPreview.innerHTML = parts.join(' · ') + (finePointer() ? ' <span class="hint">· Entrée pour ajouter</span>' : '');
    els.qPreview.hidden = false;
  }
  els.quick.addEventListener('submit', e => {
    e.preventDefault();
    const v = els.qInput.value.trim();
    if (!v) return;
    const q = parseQuick(v, todayISO(), nowHM());
    addTask({ kind: q.kind, title: q.title.slice(0, 80), subject: '', desc: '', cat: quickCat(), urg: q.urg || 2, due: q.due, time: q.time });
    els.qInput.value = '';
    updatePreview();
    els.qInput.focus();
  });
  els.qInput.addEventListener('input', updatePreview);
  els.qInput.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    if (els.qInput.value) { els.qInput.value = ''; updatePreview(); } else els.qInput.blur();
  });
  $('#q-more').addEventListener('click', () => {
    const v = els.qInput.value.trim();
    const q = v ? parseQuick(v, todayISO(), nowHM()) : null;
    dlgFromQuick = !!v;
    openTaskDialog(null, q ? { title: q.title.slice(0, 80), kind: q.kind, due: q.due, time: q.time, urg: q.urg } : null);
  });
  function setFilter(f) {
    if (f === S.filter) return;
    S.filter = f;
    prefs.filter = f;
    savePrefs();
    closeMenu(false);
    render();
  }
  els.filter.addEventListener('click', e => { const b = e.target.closest('[data-f]'); if (b) setFilter(b.dataset.f); });
  els.filter.addEventListener('keydown', e => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const order = ['pro', 'perso', 'all'];
    setFilter(order[(order.indexOf(S.filter) + step + 3) % 3]);
    els.filter.querySelector('[data-f="' + S.filter + '"]').focus();
  });
  // Sur PC : N (ou /) pour écrire une nouvelle tâche.
  document.addEventListener('keydown', e => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
    const el = e.target;
    if (el && (el.isContentEditable || /^(input|textarea|select)$/i.test(el.tagName))) return;
    if (menuState || document.querySelector('dialog[open]') || els.quick.hidden) return;
    if (e.key === 'n' || e.key === 'N' || e.key === '/') { e.preventDefault(); els.qInput.focus(); }
  });

  /* ================= style Bureau / Aventure (par appareil) ================= */
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const syncThemeColor = () => { if (themeMeta) themeMeta.content = isBz() ? '#143f4d' : '#23266f'; };
  function applyStyle(style) {
    const av = style === 'aventure';
    prefs.style = av ? 'aventure' : 'bureau';
    savePrefs();
    closeMenu(false);
    const r = document.documentElement;
    r.classList.toggle('av', av);
    r.classList.toggle('bz', !av);
    syncThemeColor();
    if (av) { lastSize = sizeKey(); drawScene(); }
    else { r.style.backgroundColor = ''; document.body.style.backgroundColor = ''; }
    setStyleIcons();
    render();
  }
  syncThemeColor();

  /* ================= rappels à l'heure (appli ouverte) + pastille ================= */
  const NOTIF_KEY = 'pixel-todo-notified';
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
  $('#confirm-yes').addEventListener('click', () => { const a = confirmAction; confirmAction = null; closeDlg(cdlg); if (a) a(); });
  cdlg.addEventListener('click', e => { if (e.target === cdlg) { confirmAction = null; closeDlg(cdlg); } });

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

  /* ================= settings: morning recap + account ================= */
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
  $('#style-row').addEventListener('change', e => { if (e.target.name === 'style') applyStyle(e.target.value); });
  function openSettings() {
    closeMenu(false);
    $('#st-' + (isBz() ? 'bureau' : 'aventure')).checked = true;
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
  $('#bz-settings').addEventListener('click', openSettings);
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
    try { w = window.open(SELF_URL, 'todo-pixel', 'popup=yes,width=440,height=860'); } catch (e) { w = null; }
    if (w) { toast('Fenêtre ouverte : place-la où tu veux.'); return; }
    openDlg(pdlg);
    $('#popout-link').focus();
  }
  $('#popout').addEventListener('click', openPopout);
  $('#bz-popout').addEventListener('click', openPopout);
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

  /* ================= toast ================= */
  const toastEl = $('#toast'), toastText = $('#toast-text'), toastAct = $('#toast-act'), toastSr = $('#toast-sr');
  const toastTitle = $('#toast-title'), toastIco = $('#toast-ico');
  let toastTimer = 0, typeTimer = 0, toastAction = null;
  // quest : titre façon jeu vidéo (« QUÊTE ACCOMPLIE ! »), avec la potion et une gerbe d'étincelles.
  function toast(msg, actionLabel, action, quest) {
    clearTimeout(toastTimer);
    clearInterval(typeTimer);
    toastAction = action || null;
    toastAct.hidden = !actionLabel;
    toastAct.textContent = actionLabel || '';
    toastEl.classList.toggle('top-free', els.rampart.hidden);
    toastEl.classList.remove('is-quest');
    toastTitle.hidden = toastIco.hidden = !quest;
    toastTitle.textContent = quest || '';
    toastIco.innerHTML = quest ? staIcon('done', 3) : '';
    toastEl.hidden = false;
    if (quest) {
      void toastEl.offsetWidth;
      toastEl.classList.add('is-quest');
      if (!reduced()) setTimeout(() => { if (!toastEl.hidden) burst(toastEl, 12); }, 120);
    }
    toastSr.textContent = (quest ? quest + ' ' : '') + msg;
    if (reduced() || isBz()) toastText.textContent = msg;
    else {
      let i = 0;
      toastText.textContent = '';
      typeTimer = setInterval(() => { i += 2; toastText.textContent = msg.slice(0, i); if (i >= msg.length) clearInterval(typeTimer); }, 18);
    }
    toastTimer = setTimeout(hideToast, actionLabel ? 6000 : 3600);
  }
  function hideToast() { clearTimeout(toastTimer); clearInterval(typeTimer); toastEl.hidden = true; toastEl.classList.remove('is-quest'); toastAction = null; }
  toastAct.addEventListener('click', () => { const a = toastAction; hideToast(); if (a) a(); });

  // Étincelles tout autour d'un élément (case de statut, bannière de quête).
  function burst(target, n) {
    const r = target.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const count = n || 6, rx = Math.max(42, r.width / 2 + 6), ry = Math.max(26, r.height / 2 + 6);
    Array.from({ length: count }, (_, i) => {
      const a = -Math.PI / 2 + i * 2 * Math.PI / count;
      return n ? [Math.round(Math.cos(a) * rx), Math.round(Math.sin(a) * ry)] : [[0, -48], [42, -26], [42, 26], [0, 48], [-42, 26], [-42, -26]][i];
    }).forEach(d => {
      // autour d'une bannière, les étincelles partent de ses bords (le texte reste lisible)
      const s = document.createElement('span');
      s.className = 'spark';
      s.style.left = (n ? cx + d[0] : cx) + 'px';
      s.style.top = (n ? cy + d[1] : cy) + 'px';
      s.style.setProperty('--dx', (n ? Math.round(d[0] * 0.18) : d[0]) + 'px');
      s.style.setProperty('--dy', (n ? Math.round(d[1] * 0.45) : d[1]) + 'px');
      s.innerHTML = ico('star', 3);
      document.body.appendChild(s);
      setTimeout(() => s.remove(), 700);
    });
  }

  /* ================= start ================= */
  // Seulement pour l'appli installable (la page Claude n'a pas de manifeste ni de sw.js).
  if (S.mode !== 'claude' && document.querySelector('link[rel="manifest"]') && 'serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* hors ligne indisponible, l'appli marche quand même */ });
  }
  render();
  if (S.mode === 'firebase') startFirebase();
  else if (S.mode === 'claude') startClaude();
  else startLocal();
})();
