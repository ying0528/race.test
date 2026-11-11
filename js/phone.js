// 手機端：風格、平面圖編輯器、3D 家具型錄、人偶、3D 導覽搖桿
import { PLAN, roomAt } from './plan.js';
import { CATS, GROUPS, PEOPLE, getItem, STYLES, resolvePeople, keepOffBeds } from './catalog.js';
import * as ART from './planart.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const S = { tab: 'style', net: 'wait', netText: '正在連線…', st: null, room: null, sel: null, drag: null, resetArm: false, group: GROUPS[0], cat: null, sheet: null };
const room = (new URLSearchParams(location.search).get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
let peer = null, conn = null, lastKey = '';
const pending = new Map();
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
  for (const [id, pd] of pending) {   // 剛新增、大螢幕還沒回報的家具先留著，避免閃一下消失
    if (m.items.some((q) => q.id === id) || Date.now() - pd.t > 4000) pending.delete(id); else m.items.push(pd.it);
  }
  if (S.sel && !m.items.some((i) => i.id === S.sel)) S.sel = null;
  if (m.mode === 'tour') { S.drag = null; closeSheet(); }
  update(); warmThumbs();
}

// ================= 畫面 =================
const curRoom = () => PLAN.rooms.find((r) => r.id === S.room);
const inRoom = (r, it) => roomAt(it.x, it.y) === r || r.rs.some(([a, b, c, d]) => it.x >= a - 12 && it.x <= c + 12 && it.y >= b - 12 && it.y <= d + 12);
const isPerson = (it) => it.key.startsWith('person:');
const peopleIn = (r) => S.st.items.filter((i) => isPerson(i) && inRoom(r, i)).length;
function update() {
  const st = S.st, key = [S.tab, S.net, st && st.ready, st && st.mode, st && st.tourBy, S.room, st && st.style, S.resetArm].join('|');
  document.querySelectorAll('#nav button').forEach((b) => b.classList.toggle('on', b.dataset.tab === S.tab));
  if (key !== lastKey) { lastKey = key; renderMain(); }
  if (S.tab === 'edit' && st && st.mode !== 'tour' && curRoom() && !S.drag) { drawPlan(); updateSel(); }
}
const ROOM_COLORS = ['#E6B89C', '#9CC5E6', '#B7D9A8', '#E6D49C', '#C9B3E6', '#9CE0D6', '#E6A8C4', '#C8C8C8', '#D9C2A0'];
const planBase = (vb) => ART.defs(S.st.style) + ART.floors(vb), planWalls = () => ART.walls();
function renderMain() {
  const el = $('main'), st = S.st;
  if (S.net !== 'ok' || !st) { el.innerHTML = `<h2>連線中</h2><div class="muted">${esc(S.netText)}</div>`; return; }
  if (!st.ready) { el.innerHTML = '<h2>已連上大螢幕</h2><div class="muted">請先在大螢幕上按「開始遊戲」，再選擇戶型「新板東京 A1」。</div>'; return; }
  const touring = st.mode === 'tour', mine = st.tourBy === st.you;
  if (touring && S.tab !== 'tour') {
    el.innerHTML = `<h2>編輯暫停中</h2><div class="muted">${mine ? '你正在 3D 導覽。結束導覽後就能繼續佈置。' : '另一支手機正在 3D 導覽，等他結束後就能繼續佈置。'}</div>`; return;
  }
  if (S.tab === 'style') {
    el.innerHTML = '<div><h2>選擇風格</h2><div class="muted">大螢幕立刻換裝，家具型錄也會換成這個風格的款式</div></div><div class="grid2">' +
      Object.entries(STYLES).map(([k, s]) => `<button class="card ${k === st.style ? 'on' : ''}" data-act="style" data-k="${k}"><div class="sw">${s.sw.map((c) => `<i style="background:${c}"></i>`).join('')}</div><b>${s.n}</b><span class="muted">${s.d}</span></button>`).join('') + '</div>';
  } else if (S.tab === 'edit') {
    const r = curRoom();
    if (!r) {
      const vb = [-20, -20, PLAN.W + 40, PLAN.D + 40];
      let h = planBase(vb);
      for (const it of S.st.items) { const sp = getItem(it.key, it.st || S.st.style); if (sp && sp.t !== 'person') h += `<g transform="translate(${it.x} ${it.y}) rotate(${it.r})" pointer-events="none">${ART.itemArt(sp)}</g>`; }
      PLAN.rooms.forEach((q, i) => { for (const [a, b, c, d] of q.rs) h += `<rect data-act="room" data-room="${q.id}" x="${a}" y="${b}" width="${c - a}" height="${d - b}" fill="${ROOM_COLORS[i]}" fill-opacity="0.5"/>`; });
      h += planWalls();
      PLAN.rooms.forEach((q) => { const [a, b, c, d] = q.rs.reduce((m, x) => ((x[2] - x[0]) * (x[3] - x[1]) > (m[2] - m[0]) * (m[3] - m[1]) ? x : m)); const fs = Math.min(46, (c - a - 14) / q.n.length);
        h += `<text x="${(a + c) / 2}" y="${(b + d) / 2}" text-anchor="middle" dominant-baseline="central" font-size="${fs}" font-weight="800" fill="#1D2129" stroke="#fff" stroke-width="5" paint-order="stroke" pointer-events="none">${q.n}</text>`; });
      el.innerHTML = `<div><h2>點選要佈置的區域</h2><div class="muted">直接點平面圖上的區域</div></div><div class="planBox"><svg class="plan" viewBox="${vb.join(' ')}" xmlns="http://www.w3.org/2000/svg">${h}</svg></div>` +
        `<button class="second" data-act="reset">${S.resetArm ? '再按一次，確定還原' : '全部還原成預設家具'}</button>`;
    } else {
      el.innerHTML = `<div class="rowb" style="align-items:center;flex:none"><button class="second" data-act="room" data-room="" style="flex:0 0 92px">← 區域</button><div style="min-width:0"><h2>${r.n}</h2><div class="muted">約 ${((r.r[2] - r.r[0]) / 100).toFixed(1)} × ${((r.r[3] - r.r[1]) / 100).toFixed(1)} m · 依實際比例</div></div></div>
        <div class="planBox"><svg id="plan" class="plan" xmlns="http://www.w3.org/2000/svg"></svg></div>
        <div id="sel"></div>
        <div class="rowb"><button class="second" id="rotBtn" data-act="rot">旋轉 90°</button><button class="second" id="delBtn" data-act="del">刪除</button></div>
        <div class="rowb"><button class="primary" data-act="open">＋ 家具</button><button class="primary alt" data-act="person">＋ 模擬人偶</button></div>`;
      bindPlan();
    }
  } else {
    if (!touring) el.innerHTML = '<div><h2>3D 導覽</h2><div class="muted">用第一人稱走進你的新家，大螢幕會變成你的視角。導覽期間，其他手機會暫停編輯。</div></div><button class="primary" data-act="tour" data-on="1">開始 3D 導覽</button>';
    else if (!mine) el.innerHTML = '<h2>3D 導覽中</h2><div class="muted">另一支手機正在操作導覽，請看大螢幕。</div>';
    else {
      el.innerHTML = '<div class="rowb" style="align-items:center"><h2>3D 導覽中</h2><button class="second" data-act="tour" data-on="" style="flex:0 0 104px">結束導覽</button></div>' +
        '<div class="zone look" id="lookZone"><b>轉頭</b><span>在這一區任何地方滑動</span></div>' +
        '<div class="zone move" id="moveZone"><b>走動</b><span>按住任何地方，往想走的方向拖</span><div class="stick hidden" id="stick"><i></i></div></div>';
      bindPads();
    }
  }
}

$('nav').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { S.tab = b.dataset.tab; S.resetArm = false; update(); } });
$('main').addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]'); if (!b || !S.st) return;
  const a = b.dataset.act;
  if (a === 'style') { S.st.style = b.dataset.k; send({ t: 'style', k: b.dataset.k }); }
  else if (a === 'room') { S.room = b.dataset.room || null; S.sel = null; S.view = null; }
  else if (a === 'reset') { if (S.resetArm) { send({ t: 'reset' }); S.resetArm = false; } else S.resetArm = true; }
  else if (a === 'tour') send({ t: 'tour', on: !!b.dataset.on });
  else if (a === 'open') openSheet('furn');
  else if (a === 'person') openSheet('person');
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
  svg.setAttribute('viewBox', (S.view || vb).join(' '));
  let h = planBase(vb);
  h += planWalls();
  const poses = resolvePeople(S.st.items);
  const order = (s) => (s.t === 'rug' ? 0 : s.t === 'person' ? 3 : s.elev > 0 ? 2 : 1);
  const list = S.st.items.map((it) => ({ it, s: getItem(it.key, it.st || S.st.style) })).filter((q) => q.s && q.it.x > vb[0] - 80 && q.it.x < vb[0] + vb[2] + 80 && q.it.y > vb[1] - 80 && q.it.y < vb[1] + vb[3] + 80)
    .sort((p, q) => order(p.s) - order(q.s) || (p.it.id === S.sel) - (q.it.id === S.sel));
  for (const { it, s } of list) {
    const mine = inRoom(r, it), sel = it.id === S.sel, attr = mine ? `data-id="${esc(it.id)}"` : 'pointer-events="none" opacity="0.35"';
    const stroke = sel ? '#A0673A' : '#3B3F46';
    if (s.t === 'person') {
      const p = poses.get(it.id) || { mode: 'stand', x: it.x, y: it.y, r: it.r };
      if (p.mode === 'lie') {   // 躺在床上：畫成一條與身高等長的線，圓點是頭
        h += `<g ${attr} transform="translate(${p.x} ${p.y}) rotate(${p.r})"><line x1="0" y1="${-p.len / 2}" x2="0" y2="${p.len / 2}" stroke="#fff" stroke-width="${sel ? 22 : 17}" stroke-linecap="round"/>` +
          `<line x1="0" y1="${-p.len / 2}" x2="0" y2="${p.len / 2}" stroke="${sel ? '#A0673A' : { m: '#4F6D8F', f: '#C98274', c: '#E3B23C' }[s.v]}" stroke-width="12" stroke-linecap="round"/><circle cx="0" cy="${-p.len / 2 + 6}" r="9" fill="#E6C2A6" stroke="#3B3F46" stroke-width="1.5"/></g>`;
      } else {
        h += `<g ${attr} transform="translate(${p.x} ${p.y}) rotate(${p.r})"><ellipse rx="${s.w / 2}" ry="${s.d / 2}" fill="#E6C2A6" stroke="${stroke}" stroke-width="${sel ? 4 : 1.2}"/>` +
          `<ellipse rx="${s.w * 0.36}" ry="${s.d * 0.42}" fill="${{ m: '#4F6D8F', f: '#C98274', c: '#E3B23C' }[s.v]}"/><circle r="${s.h * 0.058}" fill="${{ m: '#2E2622', f: '#4A3328', c: '#3A2A20' }[s.v]}" stroke="${stroke}" stroke-width="1"/><line x1="0" y1="${s.d / 2}" x2="0" y2="${s.d / 2 + 9}" stroke="${stroke}" stroke-width="3" stroke-linecap="round"/></g>`;
      }
      continue;
    }
    const m = sel ? 5 : 0;
    h += `<g ${attr} transform="translate(${it.x} ${it.y}) rotate(${it.r})">${ART.itemArt(s)}` + (sel ? `<rect x="${-s.w / 2 - m}" y="${-s.d / 2 - m}" width="${s.w + 2 * m}" height="${s.d + 2 * m}" rx="5" fill="rgba(160,103,58,.12)" stroke="#A0673A" stroke-width="3" stroke-dasharray="9 6"/>` : `<rect x="${-s.w / 2}" y="${-s.d / 2}" width="${s.w}" height="${s.d}" fill="transparent"/>`) + '</g>';
  }
  svg.innerHTML = h;
}
function updateSel() {
  const el = $('sel'); if (!el) return;
  const it = S.st.items.find((i) => i.id === S.sel), s = it && getItem(it.key, it.st || S.st.style);
  if (!s) el.innerHTML = '<span class="muted">點家具可以選取，按住拖曳就能移動。</span>';
  else if (s.t === 'person') { const p = resolvePeople(S.st.items).get(it.id); el.innerHTML = `<b>${esc(s.name)}</b><span>${p && p.mode === 'sit' ? '坐著' : '站著'}</span>`; }
  else el.innerHTML = `<b>${esc(s.name)}</b><span>寬 ${s.w} × 深 ${s.d} × 高 ${s.h} cm${s.elev ? '・壁掛' : ''}</span>`;
  $('rotBtn').disabled = $('delBtn').disabled = !s;
}
function bindPlan() {
  const svg = $('plan');
  const pt = (e) => { const q = svg.createSVGPoint(); q.x = e.clientX; q.y = e.clientY; return q.matrixTransform(svg.getScreenCTM().inverse()); };
  const pts = new Map(); let lastSend = 0, pinch = null;
  const baseVB = () => { const r = curRoom().r; return [r[0] - PAD, r[1] - PAD, r[2] - r[0] + 2 * PAD, r[3] - r[1] + 2 * PAD]; };
  const endDrag = () => { const d = S.drag; if (!d) return; const it = S.st.items.find((i) => i.id === d.id); if (it) send({ t: 'move', id: it.id, x: it.x, y: it.y }); S.drag = null; };
  // 兩指：縮放與平移平面圖（改 viewBox，家具比例不變）
  const two = () => { const [a, b] = [...pts.values()]; return { mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) || 1 }; };
  const startPinch = () => { const t = two(), q = svg.createSVGPoint(); q.x = t.mx; q.y = t.my; const a = q.matrixTransform(svg.getScreenCTM().inverse()); pinch = { d0: t.d, w0: (S.view || baseVB())[2], ax: a.x, ay: a.y }; };
  const doPinch = () => {
    const t = two(), B = baseVB(), rc = svg.getBoundingClientRect(), k = Math.max(B[2] / 6, Math.min(B[2], pinch.w0 * pinch.d0 / t.d)) / B[2], w = B[2] * k, h = B[3] * k;
    const sc = Math.min(rc.width / w, rc.height / h), ox = rc.left + (rc.width - w * sc) / 2, oy = rc.top + (rc.height - h * sc) / 2;
    const x = Math.max(B[0], Math.min(B[0] + B[2] - w, pinch.ax - (t.mx - ox) / sc)), y = Math.max(B[1], Math.min(B[1] + B[3] - h, pinch.ay - (t.my - oy) / sc));
    S.view = k > 0.995 ? null : [x, y, w, h]; svg.setAttribute('viewBox', (S.view || B).join(' '));
  };
  svg.addEventListener('pointerdown', (e) => {
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); try { svg.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
    if (pts.size === 2) { e.preventDefault(); endDrag(); startPinch(); return; }
    if (pts.size > 2) return;
    const g = e.target.closest('[data-id]');
    if (!g) { S.sel = null; drawPlan(); updateSel(); return; }
    const it = S.st.items.find((i) => i.id === g.dataset.id); if (!it) return;
    e.preventDefault(); const p = pt(e);
    if (isPerson(it)) { it.x = Math.round(p.x); it.y = Math.round(p.y); }     // 人偶（可能正坐著）直接跟著手指
    S.sel = it.id; drawPlan(); updateSel();
    S.drag = { id: it.id, ox: p.x - it.x, oy: p.y - it.y, pid: e.pointerId };
  });
  svg.addEventListener('pointermove', (e) => {
    if (pts.has(e.pointerId)) pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch) { if (pts.size >= 2) doPinch(); return; }
    const d = S.drag; if (!d || e.pointerId !== d.pid) return;
    const it = S.st.items.find((i) => i.id === d.id), r = curRoom(); if (!it || !r) return;
    const p = pt(e), snap = (v) => Math.round(v / 5) * 5;
    it.x = Math.max(r.r[0], Math.min(r.r[2], snap(p.x - d.ox))); it.y = Math.max(r.r[1], Math.min(r.r[3], snap(p.y - d.oy)));
    if (isPerson(it)) keepOffBeds(it, S.st.items); else if (getItem(it.key).t === 'bed') for (const q of S.st.items) if (isPerson(q)) keepOffBeds(q, S.st.items);
    if (isPerson(it) || S.st.items.some(isPerson)) drawPlan();      // 人偶姿勢會跟著改變，整張重畫
    else { const g = svg.querySelector(`[data-id="${CSS.escape(it.id)}"]`); if (g) g.setAttribute('transform', `translate(${it.x} ${it.y}) rotate(${it.r})`); }
    const now = performance.now(); if (now - lastSend > 40) { lastSend = now; send({ t: 'move', id: it.id, x: it.x, y: it.y }); }
  });
  const end = (e) => {
    pts.delete(e.pointerId);
    if (pinch) { if (pts.size === 0) { pinch = null; drawPlan(); updateSel(); } return; }
    if (!S.drag || e.pointerId !== S.drag.pid) return;
    endDrag(); drawPlan(); updateSel();
  };
  svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end);
}

// ================= 型錄（3D 縮圖） =================
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
const thumbCache = new Map(); let thumbMod = null, thumbRun = 0;
async function fillThumbs() {
  const run = ++thumbRun;
  try { thumbMod = thumbMod || await import('./thumbs.js'); } catch (e) { return; }
  for (const img of [...document.querySelectorAll('#list img[data-th]')]) {
    if (run !== thumbRun) return;
    const k = img.dataset.th;
    if (!thumbCache.has(k)) {
      const [key, sk] = k.split('@');
      try { thumbCache.set(k, thumbMod.renderThumb(getItem(key, sk), sk)); } catch (e) { thumbCache.set(k, ''); }
      await new Promise((r) => setTimeout(r, 0));
    }
    const u = thumbCache.get(k); if (u && img.isConnected) { img.src = u; img.classList.add('ok'); }
  }
}
// 連上後就在背景先算好這個風格的 3D 縮圖，打開型錄時幾乎不用等
let warmList = [], warmTimer = null, warmStyle = null;
function warmThumbs() {
  if (!S.st || !S.st.ready || warmStyle === S.st.style) return;
  warmStyle = S.st.style;
  const cats = [...CATS].sort((a, b) => (b.g === S.group) - (a.g === S.group));
  warmList = [...Object.keys(PEOPLE).map((k) => 'person:' + k), ...cats.flatMap((c) => c.items.map((_, i) => c.id + ':' + i))].map((k) => k + '@' + warmStyle);
  clearTimeout(warmTimer); warmTimer = setTimeout(warmStep, 600);
}
async function warmStep() {
  if (!warmList.length) return;
  if (S.drag || (S.st && S.st.mode === 'tour')) { warmTimer = setTimeout(warmStep, 600); return; }
  try { thumbMod = thumbMod || await import('./thumbs.js'); } catch (e) { return; }
  const k = warmList.shift();
  if (!thumbCache.has(k)) { const [key, sk] = k.split('@'); try { thumbCache.set(k, thumbMod.renderThumb(getItem(key, sk), sk)); } catch (e) { thumbCache.set(k, ''); } }
  warmTimer = setTimeout(warmStep, 30);
}
function closeSheet() { S.sheet = null; $('sheet').classList.add('hidden'); }
function openSheet(kind) { S.sheet = kind; $('sheet').classList.remove('hidden'); renderSheet(); }
function row(s, sk, extra = '') {
  const k = s.key + '@' + sk, m = Math.max(s.w, s.d) * 0.62 + 6, have = thumbCache.get(k);
  const icon = s.t === 'person' ? '' : `<svg viewBox="${-m} ${-m} ${2 * m} ${2 * m}">${ART.itemArt(s)}</svg>`;   // 3D 圖還沒好之前先顯示俯視圖
  return `<button class="it" data-key="${s.key}" ${extra}><div class="pv">${icon}<img data-th="${k}" src="${have || BLANK}" class="${have ? 'ok' : ''}" alt=""></div>` +
    `<div class="tx"><div class="nm">${esc(s.name)}</div><div class="dm">${s.t === 'person' ? `身高 ${s.h} cm` : `寬 ${s.w} × 深 ${s.d} × 高 ${s.h} cm`}</div></div><div class="add">加入</div></button>`;
}
function renderSheet() {
  const sk = S.st.style, r = curRoom();
  if (S.sheet === 'person') {
    const n = r ? peopleIn(r) : 0, full = n >= 3;
    $('sheetTitle').textContent = '新增模擬人偶';
    $('groups').innerHTML = ''; $('cats').innerHTML = `<div class="muted" style="padding:6px 0">這一區目前 ${n} / 3 人${full ? '，已達上限' : ''}。放到椅子或沙發上會坐下；人偶不能放在床上。</div>`;
    $('list').innerHTML = Object.keys(PEOPLE).map((k) => row(getItem('person:' + k), sk, full ? 'disabled' : '')).join('');
  } else {
    const cats = CATS.filter((c) => c.g === S.group);
    if (!cats.some((c) => c.id === S.cat)) S.cat = cats[0].id;
    $('sheetTitle').textContent = '新增家具・' + STYLES[sk].n + '款';
    $('groups').innerHTML = GROUPS.map((g) => `<button class="${g === S.group ? 'on' : ''}" data-g="${g}">${g}</button>`).join('');
    $('cats').innerHTML = cats.map((c) => `<button class="${c.id === S.cat ? 'on' : ''}" data-c="${c.id}">${c.n}</button>`).join('');
    const cat = CATS.find((c) => c.id === S.cat);
    $('list').innerHTML = cat.items.map((_, i) => row(getItem(cat.id + ':' + i, sk), sk)).join('');
  }
  $('list').scrollTop = 0; fillThumbs();
}
$('sheetClose').addEventListener('click', closeSheet);
$('groups').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { S.group = b.dataset.g; S.cat = null; renderSheet(); } });
$('cats').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { S.cat = b.dataset.c; renderSheet(); } });
$('list').addEventListener('click', (e) => {
  const b = e.target.closest('[data-key]'), r = curRoom(); if (!b || b.disabled || !r || !S.st) return;
  const person = b.dataset.key.startsWith('person:'); if (person && peopleIn(r) >= 3) return;
  const big = r.rs.reduce((m, x) => ((x[2] - x[0]) * (x[3] - x[1]) > (m[2] - m[0]) * (m[3] - m[1]) ? x : m));
  const it = { id: 'u' + Math.random().toString(36).slice(2, 10), key: b.dataset.key, x: Math.round((big[0] + big[2]) / 10) * 5, y: Math.round((big[1] + big[3]) / 10) * 5, r: 0 };
  if (!person) it.st = S.st.style; else keepOffBeds(it, S.st.items);
  S.st.items.push(it); S.sel = it.id; pending.set(it.id, { it, t: Date.now() }); send({ t: 'add', id: it.id, key: it.key, x: it.x, y: it.y, st: it.st });
  closeSheet(); update();
});

// ================= 導覽搖桿 =================
const J = { f: 0, s: 0, tn: 0, p: 0 }, LOOK = { dx: 0, dy: 0 }; let jDirty = false;
function bindPads() {
  // 上半部：整塊都是轉頭觸控板，手指滑多少就轉多少，不必對準按鈕
  const look = $('lookZone'); let lp = null, lx = 0, ly = 0;
  look.addEventListener('pointerdown', (e) => { e.preventDefault(); lp = e.pointerId; lx = e.clientX; ly = e.clientY; look.setPointerCapture(lp); look.classList.add('on'); });
  look.addEventListener('pointermove', (e) => { if (e.pointerId !== lp) return; const b = look.getBoundingClientRect(); LOOK.dx += (e.clientX - lx) / b.width * 3.0; LOOK.dy -= (e.clientY - ly) / b.height * 1.1; lx = e.clientX; ly = e.clientY; });
  const lup = (e) => { if (e.pointerId === lp) { lp = null; look.classList.remove('on'); } };
  look.addEventListener('pointerup', lup); look.addEventListener('pointercancel', lup);
  // 下半部：按在哪裡，搖桿就出現在哪裡
  const move = $('moveZone'), stick = $('stick'), knob = stick.firstElementChild, R = 56; let mp = null, ox = 0, oy = 0;
  const set = (x, y) => { knob.style.transform = `translate(${x * R}px, ${y * R}px)`; J.f = -y; J.s = x; jDirty = true; };
  move.addEventListener('pointerdown', (e) => { e.preventDefault(); mp = e.pointerId; move.setPointerCapture(mp); const b = move.getBoundingClientRect(); ox = e.clientX; oy = e.clientY; stick.style.left = (ox - b.left) + 'px'; stick.style.top = (oy - b.top) + 'px'; stick.classList.remove('hidden'); set(0, 0); });
  move.addEventListener('pointermove', (e) => { if (e.pointerId !== mp) return; let x = (e.clientX - ox) / R, y = (e.clientY - oy) / R; const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; } set(x, y); });
  const mup = (e) => { if (e.pointerId === mp) { mp = null; stick.classList.add('hidden'); set(0, 0); } };
  move.addEventListener('pointerup', mup); move.addEventListener('pointercancel', mup);
}
const myTour = () => S.st && S.st.mode === 'tour' && S.st.tourBy === S.st.you;
setInterval(() => {
  if (!myTour()) return;
  if (jDirty || J.f || J.s || J.tn || J.p) { jDirty = false; send({ t: 'joy', f: J.f, s: J.s, tn: J.tn, p: J.p }); }
  if (LOOK.dx || LOOK.dy) { send({ t: 'look', dx: LOOK.dx, dy: LOOK.dy }); LOOK.dx = LOOK.dy = 0; }
}, 50);
// 在電腦上測試：WASD 走路、Q／E 或 ←／→ 轉頭
const KEYS = {};
const keyUpd = () => { J.f = (KEYS.KeyW || KEYS.ArrowUp ? 1 : 0) - (KEYS.KeyS || KEYS.ArrowDown ? 1 : 0); J.s = (KEYS.KeyD ? 1 : 0) - (KEYS.KeyA ? 1 : 0); J.tn = (KEYS.KeyE || KEYS.ArrowRight ? 1 : 0) - (KEYS.KeyQ || KEYS.ArrowLeft ? 1 : 0); jDirty = true; };
addEventListener('keydown', (e) => { if (myTour()) { KEYS[e.code] = true; keyUpd(); } });
addEventListener('keyup', (e) => { if (KEYS[e.code]) { KEYS[e.code] = false; keyUpd(); } });

window.S_sel = () => S.sel;   // 給測試用
// 防止手機不小心放大畫面（雙指縮放、連點兩下）
for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
document.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
update(); connect();
