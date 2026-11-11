// 手機端：風格、平面圖編輯器、家具型錄、3D 導覽搖桿
import { PLAN } from './plan.js';
import { CATS, GROUPS, getItem, planColor, STYLES } from './catalog.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const S = { tab: 'style', net: 'wait', netText: '正在連線…', st: null, sel: null, drag: null, resetArm: false, group: GROUPS[0], cat: null };
const room = (new URLSearchParams(location.search).get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
let peer = null, conn = null, lastKey = '';
function send(m) { try { if (conn && conn.open) conn.send(m); } catch (e) { /* 連線已關閉 */ } }

// ================= 連線 =================
function setNet(s, text) { S.net = s; S.netText = text; $('status').dataset.s = s; $('statusText').textContent = text; update(); }
function connect() {
  if (!room) return setNet('bad', '網址缺少房間代碼，請重新掃描 QR code');
  if (typeof Peer === 'undefined') return setNet('bad', '無法載入連線元件，請檢查網路');
  peer = new Peer();
  peer.on('open', () => {
    setNet('wait', '正在連到大螢幕…');
    conn = peer.connect('myhome-a1-' + room.toLowerCase(), { reliable: true });
    conn.on('open', () => { setNet('ok', '已連上大螢幕 ' + room); send({ t: 'hello' }); });
    conn.on('data', onData);
    conn.on('close', () => setNet('bad', '連線中斷，請重新整理'));
    conn.on('error', () => setNet('bad', '連線出錯，請重新整理'));
  });
  peer.on('error', (err) => {
    if (err.type === 'peer-unavailable') setNet('bad', '找不到房間 ' + room + '，請確認大螢幕還開著');
    else if (S.net !== 'ok') setNet('bad', '連線失敗（' + err.type + '），試試換個網路');
  });
  setTimeout(() => { if (S.net === 'wait') setNet('bad', '連線逾時，試試切換 Wi-Fi／行動網路'); }, 20000);
  setInterval(() => send({ t: 'ping' }), 2000);
}
function onData(m) {
  if (!m || m.t !== 'state') return;
  const keep = S.drag && S.st ? S.st.items.find((i) => i.id === S.drag.id) : null;
  S.st = m;
  if (keep) { const i = m.items.findIndex((q) => q.id === keep.id); if (i >= 0) m.items[i] = keep; }
  if (S.sel && !m.items.some((i) => i.id === S.sel)) S.sel = null;
  update();
}

// ================= 畫面 =================
const curRoom = () => S.st && PLAN.rooms.find((r) => r.id === S.st.room);
function update() {
  const st = S.st, key = [S.tab, S.net, st && st.ready, st && st.mode, st && st.room, st && st.style, S.resetArm].join('|');
  document.querySelectorAll('#nav button').forEach((b) => b.classList.toggle('on', b.dataset.tab === S.tab));
  if (key !== lastKey) { lastKey = key; renderMain(); }
  if (S.tab === 'edit' && curRoom() && !S.drag) { drawPlan(); updateSel(); }
}
function renderMain() {
  const el = $('main'), st = S.st;
  if (S.net !== 'ok' || !st) { el.innerHTML = `<h2>連線中</h2><div class="muted">${esc(S.netText)}</div>`; return; }
  if (!st.ready) { el.innerHTML = '<h2>已連上大螢幕</h2><div class="muted">請先在大螢幕上按「開始遊戲」，再選擇戶型「新板東京 A1」。</div>'; return; }
  if (S.tab === 'style') {
    el.innerHTML = '<div><h2>選擇風格</h2><div class="muted">點一下，大螢幕立刻換裝（地板、牆面與預設家具）</div></div><div class="grid2">' +
      Object.entries(STYLES).map(([k, s]) => `<button class="card ${k === st.style ? 'on' : ''}" data-act="style" data-k="${k}"><div class="sw">${s.sw.map((c) => `<i style="background:${c}"></i>`).join('')}</div><b>${s.n}</b><span class="muted">${s.d}</span></button>`).join('') + '</div>';
  } else if (S.tab === 'edit') {
    const r = curRoom();
    if (!r) {
      el.innerHTML = '<div><h2>選擇要佈置的區域</h2><div class="muted">大螢幕會放大到那一區，手機出現平面圖</div></div><div class="grid2">' +
        PLAN.rooms.map((q) => `<button class="card" data-act="zoom" data-room="${q.id}"><b>${q.n}</b><span class="muted">約 ${((q.r[2] - q.r[0]) / 100).toFixed(1)} × ${((q.r[3] - q.r[1]) / 100).toFixed(1)} m</span></button>`).join('') +
        `</div><button class="second" data-act="reset">${S.resetArm ? '再按一次，確定還原' : '全部還原成預設家具'}</button>`;
    } else {
      el.innerHTML = `<div class="rowb" style="align-items:center"><button class="second" data-act="zoom" data-room="" style="flex:0 0 96px">← 全戶</button><div><h2>${r.n}</h2><div class="muted">約 ${((r.r[2] - r.r[0]) / 100).toFixed(1)} × ${((r.r[3] - r.r[1]) / 100).toFixed(1)} m · 一格 50 cm</div></div></div>
        <div id="planWrap"><svg id="plan" xmlns="http://www.w3.org/2000/svg"></svg></div>
        <div id="sel"></div>
        <div class="rowb"><button class="second" id="rotBtn" data-act="rot">旋轉 90°</button><button class="second" id="delBtn" data-act="del">刪除</button></div>
        <button class="primary" data-act="open">＋ 新增家具</button>`;
      bindPlan();
    }
  } else {
    if (st.mode !== 'tour') el.innerHTML = '<div><h2>3D 導覽</h2><div class="muted">佈置好了嗎？用第一人稱走進你的新家，大螢幕會變成你的視角。</div></div><button class="primary" data-act="tour" data-on="1">開始 3D 導覽</button>';
    else {
      el.innerHTML = '<div><h2>3D 導覽中</h2><div class="muted">左邊走路，右邊轉頭。看大螢幕。</div></div><div id="pads"><div class="padbox"><div class="pad" data-pad="move"><i></i></div>前後左右</div><div class="padbox"><div class="pad look" data-pad="look"><i></i></div>轉頭</div></div><button class="second" data-act="tour" data-on="">結束導覽</button>';
      bindPads();
    }
  }
}

$('nav').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { S.tab = b.dataset.tab; S.resetArm = false; update(); } });
$('main').addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]'); if (!b || !S.st) return;
  const a = b.dataset.act;
  if (a === 'style') { S.st.style = b.dataset.k; send({ t: 'style', k: b.dataset.k }); }
  else if (a === 'zoom') { S.st.room = b.dataset.room || null; S.sel = null; send({ t: 'zoom', room: S.st.room }); }
  else if (a === 'reset') { if (S.resetArm) { send({ t: 'reset' }); S.resetArm = false; } else S.resetArm = true; }
  else if (a === 'tour') { S.st.mode = b.dataset.on ? 'tour' : 'overview'; send({ t: 'tour', on: !!b.dataset.on }); }
  else if (a === 'open') openSheet();
  else if (a === 'rot' || a === 'del') {
    const it = S.st.items.find((i) => i.id === S.sel); if (!it) return;
    if (a === 'rot') { it.r = (it.r + 90) % 360; send({ t: 'rot', id: it.id, r: it.r }); }
    else { S.st.items = S.st.items.filter((i) => i.id !== it.id); send({ t: 'del', id: it.id }); S.sel = null; }
  }
  update();
});

// ================= 平面圖編輯器 =================
const PAD = 22;
function drawPlan() {
  const svg = $('plan'), r = curRoom(); if (!svg || !r) return;
  const [x1, y1, x2, y2] = r.r, vb = [x1 - PAD, y1 - PAD, x2 - x1 + 2 * PAD, y2 - y1 + 2 * PAD];
  svg.setAttribute('viewBox', vb.join(' '));
  let h = `<rect x="${vb[0]}" y="${vb[1]}" width="${vb[2]}" height="${vb[3]}" fill="#ECE9E4"/>`;
  for (const [a, b, c, d] of PLAN.floors) h += `<rect x="${a}" y="${b}" width="${c - a}" height="${d - b}" fill="#FBFAF7"/>`;
  for (let gx = Math.ceil(vb[0] / 50) * 50; gx < vb[0] + vb[2]; gx += 50) h += `<line x1="${gx}" y1="${vb[1]}" x2="${gx}" y2="${vb[1] + vb[3]}" stroke="#E7E3DC" stroke-width="1"/>`;
  for (let gy = Math.ceil(vb[1] / 50) * 50; gy < vb[1] + vb[3]; gy += 50) h += `<line x1="${vb[0]}" y1="${gy}" x2="${vb[0] + vb[2]}" y2="${gy}" stroke="#E7E3DC" stroke-width="1"/>`;
  for (const [a, b, c, d, z1, z2] of PLAN.walls) { if (z1 > 0) continue; h += `<rect x="${a}" y="${b}" width="${c - a}" height="${d - b}" fill="${z2 >= 200 ? '#3B3F46' : z2 === 110 ? '#A9AEB5' : '#8FC0DA'}"/>`; }
  const D = PLAN.door; h += `<rect x="${D[0]}" y="${D[1]}" width="${D[2] - D[0]}" height="${D[3] - D[1]}" fill="#8A6A4F"/>`;
  const order = (s) => (s.t === 'rug' ? 0 : s.elev > 0 ? 2 : 1);
  const list = S.st.items.map((it) => ({ it, s: getItem(it.key) })).filter((q) => q.s && q.it.x > vb[0] - 60 && q.it.x < vb[0] + vb[2] + 60 && q.it.y > vb[1] - 60 && q.it.y < vb[1] + vb[3] + 60)
    .sort((p, q) => order(p.s) - order(q.s) || (p.it.id === S.sel) - (q.it.id === S.sel));
  for (const { it, s } of list) {
    const mine = it.x >= x1 && it.x <= x2 && it.y >= y1 && it.y <= y2, sel = it.id === S.sel, round = s.v === 'round' || s.t === 'plant' || s.t === 'lamp';
    const shape = round ? `<ellipse rx="${s.w / 2}" ry="${s.d / 2}"` : `<rect x="${-s.w / 2}" y="${-s.d / 2}" width="${s.w}" height="${s.d}" rx="3"`;
    const fs = Math.max(7, Math.min(13, Math.min(s.w, s.d) * 0.3));
    h += `<g ${mine ? `data-id="${esc(it.id)}"` : 'pointer-events="none" opacity="0.35"'} transform="translate(${it.x} ${it.y}) rotate(${it.r})">` +
      `${shape} fill="${planColor(s)}" fill-opacity="${s.elev > 0 ? 0.55 : s.t === 'rug' ? 0.6 : 1}" stroke="${sel ? '#A0673A' : '#3B3F46'}" stroke-width="${sel ? 4 : 1.2}" ${s.elev > 0 ? 'stroke-dasharray="5 4"' : ''}/>` +
      (round || s.t === 'rug' ? '' : `<line x1="${-s.w / 2 + 4}" y1="${s.d / 2 - 3}" x2="${s.w / 2 - 4}" y2="${s.d / 2 - 3}" stroke="rgba(0,0,0,.35)" stroke-width="2"/>`) +
      (Math.min(s.w, s.d) >= 30 && Math.max(s.w, s.d) >= 55 ? `<text transform="rotate(${-it.r})" text-anchor="middle" dominant-baseline="central" font-size="${fs}" font-weight="700" fill="#fff" stroke="rgba(0,0,0,.55)" stroke-width="2.4" paint-order="stroke" pointer-events="none">${esc(s.catName)}</text>` : '') + '</g>';
  }
  svg.innerHTML = h;
}
function updateSel() {
  const el = $('sel'); if (!el) return;
  const it = S.st.items.find((i) => i.id === S.sel), s = it && getItem(it.key);
  el.innerHTML = s ? `<b>${esc(s.name)}</b><br>寬 ${s.w} × 深 ${s.d} × 高 ${s.h} cm${s.elev ? '（壁掛）' : ''}` : '<span class="muted">點家具可以選取，按住拖曳就能移動。大螢幕會即時跟著變。</span>';
  $('rotBtn').disabled = $('delBtn').disabled = !s;
}
function bindPlan() {
  const svg = $('plan');
  const pt = (e) => { const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; return p.matrixTransform(svg.getScreenCTM().inverse()); };
  let lastSend = 0;
  svg.addEventListener('pointerdown', (e) => {
    const g = e.target.closest('[data-id]');
    if (!g) { S.sel = null; drawPlan(); updateSel(); return; }
    const it = S.st.items.find((i) => i.id === g.dataset.id); if (!it) return;
    e.preventDefault(); const p = pt(e);
    S.sel = it.id; drawPlan(); updateSel();
    S.drag = { id: it.id, ox: p.x - it.x, oy: p.y - it.y, pid: e.pointerId };
    svg.setPointerCapture(e.pointerId);
  });
  svg.addEventListener('pointermove', (e) => {
    const d = S.drag; if (!d || e.pointerId !== d.pid) return;
    const it = S.st.items.find((i) => i.id === d.id), r = curRoom(); if (!it || !r) return;
    const p = pt(e), snap = (v) => Math.round(v / 5) * 5;
    it.x = Math.max(r.r[0], Math.min(r.r[2], snap(p.x - d.ox))); it.y = Math.max(r.r[1], Math.min(r.r[3], snap(p.y - d.oy)));
    const g = svg.querySelector(`[data-id="${CSS.escape(it.id)}"]`); if (g) g.setAttribute('transform', `translate(${it.x} ${it.y}) rotate(${it.r})`);
    const now = performance.now(); if (now - lastSend > 40) { lastSend = now; send({ t: 'move', id: it.id, x: it.x, y: it.y }); }
  });
  const end = (e) => {
    const d = S.drag; if (!d || e.pointerId !== d.pid) return;
    const it = S.st.items.find((i) => i.id === d.id); if (it) send({ t: 'move', id: it.id, x: it.x, y: it.y });
    S.drag = null; drawPlan(); updateSel();
  };
  svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end);
}

// ================= 家具型錄 =================
function openSheet() { $('sheet').classList.remove('hidden'); renderSheet(); }
function renderSheet() {
  const cats = CATS.filter((c) => c.g === S.group);
  if (!cats.some((c) => c.id === S.cat)) S.cat = cats[0].id;
  $('groups').innerHTML = GROUPS.map((g) => `<button class="${g === S.group ? 'on' : ''}" data-g="${g}">${g}</button>`).join('');
  $('cats').innerHTML = cats.map((c) => `<button class="${c.id === S.cat ? 'on' : ''}" data-c="${c.id}">${c.n}</button>`).join('');
  const cat = CATS.find((c) => c.id === S.cat), specs = cat.items.map((_, i) => getItem(cat.id + ':' + i));
  const mx = Math.max(...specs.map((s) => Math.max(s.w, s.d)));
  $('list').innerHTML = specs.map((s) => {
    const k = 52 / mx, w = Math.max(4, s.w * k), d = Math.max(4, s.d * k), round = s.v === 'round' || s.t === 'plant' || s.t === 'lamp';
    return `<button class="it" data-key="${s.key}"><div class="pv"><svg width="56" height="56" viewBox="-28 -28 56 56">${round ? `<ellipse rx="${w / 2}" ry="${d / 2}"` : `<rect x="${-w / 2}" y="${-d / 2}" width="${w}" height="${d}" rx="2"`} fill="${planColor(s)}" stroke="#3B3F46" stroke-width="1"/></svg></div>` +
      `<div><div class="nm">${esc(s.name)}</div><div class="dm">寬 ${s.w} × 深 ${s.d} × 高 ${s.h} cm</div></div><div class="add">加入</div></button>`;
  }).join('');
}
$('sheetClose').addEventListener('click', () => $('sheet').classList.add('hidden'));
$('groups').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { S.group = b.dataset.g; S.cat = null; renderSheet(); } });
$('cats').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { S.cat = b.dataset.c; renderSheet(); } });
$('list').addEventListener('click', (e) => {
  const b = e.target.closest('[data-key]'), r = curRoom(); if (!b || !r || !S.st) return;
  const it = { id: 'u' + Math.random().toString(36).slice(2, 10), key: b.dataset.key, x: Math.round((r.r[0] + r.r[2]) / 10) * 5, y: Math.round((r.r[1] + r.r[3]) / 10) * 5, r: 0 };
  S.st.items.push(it); S.sel = it.id; send({ t: 'add', id: it.id, key: it.key, x: it.x, y: it.y });
  $('sheet').classList.add('hidden'); update();
});

// ================= 導覽搖桿 =================
const J = { f: 0, s: 0, tn: 0, p: 0 }; let jDirty = false;
function bindPads() {
  document.querySelectorAll('.pad').forEach((pad) => {
    const knob = pad.firstElementChild, kind = pad.dataset.pad; let pid = null;
    const set = (x, y) => { knob.style.transform = `translate(${x * 60}%, ${y * 60}%)`; if (kind === 'move') { J.f = -y; J.s = x; } else { J.tn = x; J.p = -y * 0.6; } jDirty = true; };
    const move = (e) => { const b = pad.getBoundingClientRect(); let x = (e.clientX - b.left - b.width / 2) / (b.width / 2), y = (e.clientY - b.top - b.height / 2) / (b.height / 2); const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; } set(x, y); };
    pad.addEventListener('pointerdown', (e) => { e.preventDefault(); pid = e.pointerId; pad.setPointerCapture(pid); move(e); });
    pad.addEventListener('pointermove', (e) => { if (e.pointerId === pid) move(e); });
    const up = (e) => { if (e.pointerId === pid) { pid = null; set(0, 0); } };
    pad.addEventListener('pointerup', up); pad.addEventListener('pointercancel', up);
  });
}
setInterval(() => { if (S.st && S.st.mode === 'tour' && (jDirty || J.f || J.s || J.tn || J.p)) { jDirty = false; send({ t: 'joy', f: J.f, s: J.s, tn: J.tn, p: J.p }); } }, 60);
// 在電腦上測試：WASD 走路、Q／E 或 ←／→ 轉頭
const KEYS = {};
const keyUpd = () => { J.f = (KEYS.KeyW || KEYS.ArrowUp ? 1 : 0) - (KEYS.KeyS || KEYS.ArrowDown ? 1 : 0); J.s = (KEYS.KeyD ? 1 : 0) - (KEYS.KeyA ? 1 : 0); J.tn = (KEYS.KeyE || KEYS.ArrowRight ? 1 : 0) - (KEYS.KeyQ || KEYS.ArrowLeft ? 1 : 0); jDirty = true; };
addEventListener('keydown', (e) => { if (S.st && S.st.mode === 'tour') { KEYS[e.code] = true; keyUpd(); } });
addEventListener('keyup', (e) => { if (KEYS[e.code]) { KEYS[e.code] = false; keyUpd(); } });

update(); connect();
