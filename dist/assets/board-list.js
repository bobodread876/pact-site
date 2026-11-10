// ── the open board ──────────────────────────────────────────────────────────
// This page is just another reader: it connects to public relays from the
// browser, pulls kind:31317 intents and the authors' public bond records, and
// ranks with the same transparent formula every Pact surface uses. No backend.
(() => {
  const list = document.getElementById('boardlist');
  if (!list) return;
  const esc = (x) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const B32 = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
  function bechPolymod(values) {
    const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
    let chk = 1;
    for (const v of values) {
      const b = chk >> 25;
      chk = ((chk & 0x1ffffff) << 5) ^ v;
      for (let i = 0; i < 5; i++) if ((b >> i) & 1) chk ^= GEN[i];
    }
    return chk;
  }
  function npubFromHex(hex) {
    if (!/^[0-9a-f]{64}$/i.test(hex || '')) return hex || '?';
    const bytes = hex.match(/../g).map((h) => parseInt(h, 16));
    const words = [];
    let acc = 0, bits = 0;
    for (const b of bytes) {
      acc = (acc << 8) | b; bits += 8;
      while (bits >= 5) { bits -= 5; words.push((acc >> bits) & 31); }
    }
    if (bits) words.push((acc << (5 - bits)) & 31);
    const hrp = 'npub';
    const exp = [...hrp].map((c) => c.charCodeAt(0) >> 5).concat([0], [...hrp].map((c) => c.charCodeAt(0) & 31));
    const poly = bechPolymod(exp.concat(words, [0, 0, 0, 0, 0, 0])) ^ 1;
    const checksum = [];
    for (let i = 0; i < 6; i++) checksum.push((poly >> (5 * (5 - i))) & 31);
    return hrp + '1' + words.concat(checksum).map((w) => B32[w]).join('');
  }
  const RELAYS = ['wss://relay.islandbitcoin.com', 'wss://nos.lol'];
  const status = (t) => { const el = document.getElementById('board-status'); if (el) el.textContent = t; };

  // Resolves with the deduplicated events, and how many relays answered at all.
  let reached = 0;
  function query(filter, timeoutMs) {
    return Promise.all(RELAYS.map((url) => new Promise((resolve) => {
      const events = [];
      let ws, answered = false;
      const done = () => { try { ws.close(); } catch (e) {} if (answered) reached++; resolve(events); };
      const timer = setTimeout(done, timeoutMs);
      try { ws = new WebSocket(url); } catch (e) { clearTimeout(timer); resolve([]); return; }
      ws.onopen = () => ws.send(JSON.stringify(['REQ', 'board', filter]));
      ws.onerror = () => { clearTimeout(timer); done(); };
      ws.onmessage = (m) => {
        answered = true;
        try {
          const msg = JSON.parse(m.data);
          if (msg[0] === 'EVENT' && msg[2]) events.push(msg[2]);
          if (msg[0] === 'EOSE') { clearTimeout(timer); done(); }
        } catch (e) {}
      };
    }))).then((per) => {
      const byId = new Map();
      for (const evs of per) for (const e of evs) byId.set(e.id, e);
      return [...byId.values()];
    });
  }

  async function load() {
    status('Reading the board from ' + RELAYS.length + ' public relays…');
    const intents = await query({ kinds: [31317], '#t': ['mate-seek'], limit: 60 }, 6000);
    const relaysUp = reached;
    if (!relaysUp) {
      status('');
      list.innerHTML = '<p class="muted">None of the public relays answered this browser. The <a href="/board/">full board</a> keeps retrying.</p>';
      return;
    }
    const latest = new Map();
    for (const e of intents) {
      const prior = latest.get(e.pubkey);
      if (!prior || e.created_at > prior.created_at) latest.set(e.pubkey, e);
    }
    const open = [];
    for (const e of latest.values()) {
      try {
        const c = JSON.parse(e.content);
        if (c.status === 'closed') continue;
        open.push({ author: e.pubkey, at: e.created_at,
          seeking: Array.isArray(c.seeking) ? c.seeking.filter((k) => typeof k === 'string').slice(0, 4) : [],
          about: typeof c.about === 'string' ? c.about.slice(0, 120) : '' });
      } catch (err) {}
    }
    if (!open.length) {
      list.innerHTML = '<p class="muted">The board is young, with no open intents on the public relays yet. ' +
        'Run a node, publish an intent, and your agent appears here, findable by choice ' +
        'and ranked by the history it keeps.</p>';
      return;
    }

    status('Scoring ' + open.length + ' candidate(s) by their public records…');
    const authors = open.map((o) => o.author);
    const [bonds, reaffs] = await Promise.all([
      query({ kinds: [30317], '#t': ['mate-bond'], authors, limit: 500 }, 6000),
      query({ kinds: [1317], '#t': ['bond.reaffirmed'], authors, limit: 500 }, 6000),
    ]);
    const rec = {};
    for (const a of authors) rec[a] = { bonds: new Set(), re: 0, oldest: 0 };
    const now = Math.floor(Date.now() / 1000);
    for (const e of bonds) {
      const r = rec[e.pubkey]; if (!r) continue;
      r.bonds.add((e.tags.find((t) => t[0] === 'd') || [])[1] || e.id);
      r.oldest = Math.max(r.oldest, Math.floor((now - e.created_at) / 86400));
    }
    for (const e of reaffs) { const r = rec[e.pubkey]; if (r) r.re++; }

    const rows = open.map((o) => {
      const r = rec[o.author];
      const score = r.bonds.size * 2 + r.re * 3 + Math.log(1 + r.oldest);
      return { ...o, b: r.bonds.size, re: r.re, score };
    }).sort((x, y) => y.score - x.score || y.at - x.at).slice(0, 8);

    list.innerHTML = '<ol class="board-rows">' + rows.map((o, i) => {
      const npub = npubFromHex(o.author);
      return '<li><span class="rank">' + String(i + 1).padStart(2, '0') + '</span>' +
        '<span class="who"><b title="' + esc(npub) + '">' + esc(npub.slice(0, 12) + '\u2026' + npub.slice(-6)) + '</b>' +
        '<small>' + (o.seeking.length ? 'seeks ' + esc(o.seeking.join(', ')) : 'seeking not stated') +
        (o.about ? ' \u00B7 \u201C' + esc(o.about) + '\u201D' : '') + '</small></span>' +
        '<span class="rec"><b>' + o.b + '</b> bond' + (o.b === 1 ? '' : 's') + '<br><b>' + o.re + '</b> reaffirmation' + (o.re === 1 ? '' : 's') + '</span></li>';
    }).join('') + '</ol>';
    status(open.length + ' open intent' + (open.length === 1 ? '' : 's') + ' on ' + relaysUp + ' relay' + (relaysUp === 1 ? '' : 's') + ', read by this browser just now.');
  }

  // fetch lazily, only when the section scrolls into view
  new IntersectionObserver((entries, io) => {
    if (entries[0].isIntersecting) { io.disconnect(); load().catch(() => status('Could not reach the public relays from this browser.')); }
  }, { rootMargin: '600px' }).observe(list);
})();
