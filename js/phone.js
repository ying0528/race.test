// 手機端：風格、平面圖編輯器、3D 家具型錄、人偶、3D 導覽搖桿
import { PLAN, UNIT, setUnit, roomAt, setCuts, cutRects } from './plan.js?v=20261113c';
import { CATS, GROUPS, PEOPLE, getItem, STYLES, FLOOR_GROUPS, WALL_GROUPS, parseWall, FINISH, finishOf, lenRange, elevRange, resolvePeople, keepOffBeds } from './catalog.js?v=20261113c';
import * as ART from './planart.js?v=20261113c';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const S = { tab: 'style', net: 'wait', netText: '正在連線…', st: null, room: null, sel: null, drag: null, resetArm: false, group: GROUPS[0], cat: null, sheet: null };
const room = (new URLSearchParams(location.search).get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
let peer = null, conn = null, fast = null, jn = 0, lastKey = '';
// 搖桿與轉頭走不排隊的通道（連不上就退回一般通道）
function sendFast(m) { try { if (fast && fast.open) return fast.send(m); } catch (e) { /* 改走一般通道 */ } send(m); }
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
    conn.on('open', () => { setNet('ok', '已連上大螢幕 ' + room); send({ t: 'hello' }); try { fast = peer.connect('myhome-a1-' + room.toLowerCase(), { reliable: false, label: 'fast' }); } catch (e) { fast = null; } });
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
  if (m && m.t === 'pos') { S.pos = m; moveMe(); return; }   // 導覽中：大螢幕回報目前位置
  if (!m || m.t !== 'state') return;
  const keep = S.drag && S.st ? S.st.items.find((i) => i.id === S.drag.id) : null;
  S.st = m;
  if (m.unit && m.unit !== UNIT.id && setUnit(m.unit)) { S.room = null; S.sel = null; S.selCut = null; S.view = null; S.drag = null; closeSheet(); }   // 大螢幕換了戶型
  $('unitName').textContent = m.ready ? UNIT.name : '';
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
  const st = S.st, key = [innerWidth > innerHeight, S.tab, S.net, UNIT.id, st && st.ready, st && st.mode, st && st.tourBy, S.room, st && st.style, st && st.floor, st && JSON.stringify(st.floors), st && st.wall, st && JSON.stringify(st.walls), S.fk, S.wg, S.wo, S.walt, S.fg, S.fr, S.resetArm].join('|');
  document.querySelectorAll('#nav button').forEach((b) => b.classList.toggle('on', b.dataset.tab === S.tab));
  if (key !== lastKey) { lastKey = key; renderMain(); }
  if (S.tab === 'edit' && st && st.mode !== 'tour' && curRoom() && !S.drag) { drawPlan(); updateSel(); }
}
const ROOM_COLORS = ['#E6B89C', '#9CC5E6', '#B7D9A8', '#E6D49C', '#C9B3E6', '#9CE0D6', '#E6A8C4', '#C8C8C8', '#D9C2A0'];
const cutPatch = () => (S.st.cut || []).flatMap((i) => cutRects(i)).map(([a, b, c, d]) => `<rect x="${a}" y="${b}" width="${c - a}" height="${d - b}" fill="url(#f-main)"/>`).join('');   // 拆掉的牆底下補地板
const planBase = (vb) => (setCuts(S.st.cut), ART.defs(S.st.style, S.st.floor, S.st.floors) + ART.floors(vb, S.st.floors) + cutPatch()), planWalls = () => ART.walls();
// 牆面材質選單：先選種類，石材再選亮面／霧面、木紋再選木皮／格柵，最後選顏色
function wallOpts(cur) {
  const pw = parseWall(cur), wg = S.wg ?? Math.max(0, WALL_GROUPS.findIndex((g) => pw && g === pw.group)), G = WALL_GROUPS[wg], same = pw && pw.group === G;
  const matte = S.wo ?? (same ? pw.matte : !!G.matte), kind = S.walt ?? (same ? pw.kind : G.k);
  return { pw, wg, G, matte: !!G.sheen && matte, kind: G.alt ? kind : G.k, same };
}
function setWall(k) {
  const fr = S.fr || ''; S.st.walls = S.st.walls || {};
  if (fr) { if (k) S.st.walls[fr] = k; else delete S.st.walls[fr]; } else { S.st.wall = k; S.st.walls = {}; }
  send({ t: 'wallf', k, room: fr || undefined });
}
const wallKey = (kind, c, matte) => `${kind}|${c}|${matte ? 'm' : ''}`;
function wallPicker(cur) {
  const { wg, G, matte, kind } = wallOpts(cur);
  let opt = '';
  if (G.sheen) opt = [['g', '亮面'], ['m', '霧面']].map(([k, n]) => `<button class="${(k === 'm') === matte ? 'on' : ''}" data-act="wo" data-k="${k}">${n}</button>`).join('');
  if (G.alt) opt = [[G.k, '木皮平板'], [G.alt[0], G.alt[1]]].map(([k, n]) => `<button class="${k === kind ? 'on' : ''}" data-act="walt" data-k="${k}">${n}</button>`).join('');
  return '<div class="chips">' + WALL_GROUPS.map((g, i) => `<button class="${i === wg ? 'on' : ''}" data-act="wg" data-i="${i}">${g.n}</button>`).join('') + '</div>' +
    (opt ? `<div class="chips sub">${opt}</div>` : '') +
    '<div class="fgrid">' + G.colors.map(([c, n]) => { const k = wallKey(kind, c, matte); return `<button class="fsw ${k === cur ? 'on' : ''}" data-act="wallf" data-k="${k}"><i class="wk-${kind}" style="--c:${c}"></i><span>${n}</span></button>`; }).join('') + '</div>';
}
function renderMain() {
  const el = $('main'), st = S.st;
  if (S.net !== 'ok' || !st) { el.innerHTML = `<h2>連線中</h2><div class="muted">${esc(S.netText)}</div>`; return; }
  if (!st.ready) { el.innerHTML = '<h2>已連上大螢幕</h2><div class="muted">請先在大螢幕上按「開始遊戲」，再選擇戶型。</div>'; return; }
  const touring = st.mode === 'tour', mine = st.tourBy === st.you;
  document.body.classList.toggle('tourL', S.tab === 'tour' && touring && mine && innerWidth > innerHeight);
  if (touring && S.tab !== 'tour') {
    el.innerHTML = `<h2>編輯暫停中</h2><div class="muted">${mine ? '你正在 3D 導覽。結束導覽後就能繼續佈置。' : '另一支手機正在 3D 導覽，等他結束後就能繼續佈置。'}</div>`; return;
  }
  if (S.tab === 'style') {
    const fr = PLAN.rooms.some((q) => q.id === S.fr) ? S.fr : '', W = S.fk === 'wall', cur = W ? (fr ? (st.walls || {})[fr] : st.wall) : fr ? (st.floors || {})[fr] : st.floor, over = (W ? st.walls : st.floors) || {};
    const fg = S.fg ?? Math.max(0, FLOOR_GROUPS.findIndex((g) => g.items.some((f) => f[0] === cur))), sw = (f) => { const [id, n, c, k = 'wood'] = f; return `<button class="fsw ${id === cur ? 'on' : ''}" data-act="floor" data-k="${id}"><i class="fk-${k}" style="--c:${c}"></i><span>${n}</span></button>`; };
    el.innerHTML = '<h2>選擇風格</h2><div class="grid2 styles">' +
      Object.entries(STYLES).map(([k, s]) => `<button class="card ${k === st.style ? 'on' : ''}" data-act="style" data-k="${k}"><div class="sw">${s.sw.map((c) => `<i style="background:${c}"></i>`).join('')}</div><b>${s.n}</b></button>`).join('') + '</div>' +
      `<div class="rowb" style="align-items:center"><div class="seg"><button class="${W ? '' : 'on'}" data-act="fk" data-k="floor">地板</button><button class="${W ? 'on' : ''}" data-act="fk" data-k="wall">牆面</button></div><button class="second ${cur ? '' : 'on'}" data-act="${W ? 'wallf' : 'floor'}" data-k="" style="flex:0 0 108px;height:36px">${fr ? '跟著全戶' : '跟著風格'}</button></div>` +
      '<div class="chips">' + [['', '全戶'], ...PLAN.rooms.map((q) => [q.id, q.n])].map(([id, n]) => `<button class="${id === fr ? 'on' : ''}" data-act="fr" data-k="${id}">${n}${id && over[id] ? ' ●' : ''}</button>`).join('') + '</div>' +
      (W ? wallPicker(cur) : '<div class="chips">' + FLOOR_GROUPS.map((g, i) => `<button class="${i === fg ? 'on' : ''}" data-act="fg" data-i="${i}">${g.n}</button>`).join('') + '</div>' +
      '<div class="fgrid">' + FLOOR_GROUPS[fg].items.map(sw).join('') + '</div>');
  } else if (S.tab === 'edit') {
    const r = curRoom();
    if (!r) {
      const vb = [-20, -20, PLAN.W + 40, PLAN.D + 40];
      let h = planBase(vb);
      for (const it of S.st.items) { const sp = getItem(it.key, it.st || S.st.style, it); if (sp && sp.t !== 'person') h += `<g transform="translate(${it.x} ${it.y}) rotate(${it.r})" pointer-events="none">${ART.itemArt(sp)}</g>`; }
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
        <div class="rowb"><button class="second" id="rotBtn" data-act="rot">旋轉 90°</button><button class="second" id="finBtn" data-act="fin">材質顏色</button><button class="second" id="delBtn" data-act="del">刪除</button></div>
        <div class="rowb"><button class="primary" data-act="open">＋ 家具</button><button class="primary alt" data-act="person">＋ 模擬人偶</button></div>`;
      bindPlan();
    }
  } else {
    if (!touring) el.innerHTML = '<div><h2>3D 導覽</h2><div class="muted">用第一人稱走進你的新家，大螢幕會變成你的視角。導覽期間，其他手機會暫停編輯。</div></div><button class="primary" data-act="tour" data-on="1">開始 3D 導覽</button>';
    else if (!mine) el.innerHTML = '<h2>3D 導覽中</h2><div class="muted">另一支手機正在操作導覽，請看大螢幕。</div>';
    else if (innerWidth <= innerHeight) {   // 導覽時要橫拿
      el.innerHTML = '<div class="rotate"><div class="rot">📱</div><h2>請把手機轉橫</h2><div class="muted">轉橫後就會出現操作畫面。<br>手機有鎖住旋轉的話，請先解除。</div><button class="second" data-act="tour" data-on="" style="flex:0 0 auto;padding:0 22px">結束導覽</button></div>';
    } else {   // 橫拿：左邊走路搖桿、中間平面圖（點一下就快速走過去）、右邊轉頭搖桿
      const vb = [-20, -20, PLAN.W + 40, PLAN.D + 40];
      let h = planBase(vb);
      for (const it of S.st.items) { const sp = getItem(it.key, it.st || S.st.style, it); if (sp && sp.t !== 'person') h += `<g transform="translate(${it.x} ${it.y}) rotate(${it.r})" pointer-events="none">${ART.itemArt(sp)}</g>`; }
      h += planWalls() + '<g id="tgt" style="display:none"><circle r="46" fill="rgba(46,125,79,.18)" stroke="#2E7D4F" stroke-width="10"/><circle r="12" fill="#2E7D4F"/></g>' +
        '<g id="me"><path d="M0 0 L190 -95 A212 212 0 0 1 190 95 Z" fill="rgba(160,103,58,.24)"/><circle r="30" fill="#A0673A" stroke="#fff" stroke-width="10"/></g>';
      el.innerHTML = '<div class="tl"><div class="tlTop"><span class="tlPill">● 3D 導覽中</span><span class="goChip" id="goChip" style="display:none"></span><button class="second" data-act="tour" data-on="">結束導覽</button></div>' +
        '<div class="tlBody"><div class="zone move" id="moveZone"><b>走路</b><div class="stick rest" id="stick"><i></i></div></div>' +
        `<div class="tlPlan"><svg id="tplan" viewBox="${vb.join(' ')}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">${h}</svg><div class="tlCap">點平面圖任一處，快速走過去</div></div>` +
        '<div class="zone look" id="lookZone"><b>轉頭</b><div class="stick rest" id="lstick"><i></i></div></div></div></div>';
      bindPads(); bindTourPlan(); moveMe();
    }
  }
}

$('nav').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { S.tab = b.dataset.tab; S.resetArm = false; update(); } });
$('main').addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]'); if (!b || !S.st) return;
  const a = b.dataset.act;
  if (a === 'floor') { const k = b.dataset.k || null, fr = S.fr || ''; S.st.floors = S.st.floors || {}; if (fr) { if (k) S.st.floors[fr] = k; else delete S.st.floors[fr]; } else { S.st.floor = k; S.st.floors = {}; } send({ t: 'floor', k, room: fr || undefined }); }
  if (a === 'fr') { S.fr = b.dataset.k; S.fg = undefined; S.wg = S.wo = S.walt = undefined; }
  if (a === 'fk') { S.fk = b.dataset.k; S.wg = S.wo = S.walt = undefined; }
  if (a === 'wg') { S.wg = +b.dataset.i; S.wo = S.walt = undefined; }
  if (a === 'wo' || a === 'walt') {   // 換亮面／霧面或木皮／格柵：目前這一區已經是這種材質的話，直接套用到同一個顏色
    const fr = S.fr || '', cur = fr ? (S.st.walls || {})[fr] : S.st.wall, o0 = wallOpts(cur);
    if (a === 'wo') S.wo = b.dataset.k === 'm'; else S.walt = b.dataset.k;
    const o = wallOpts(cur); if (o0.same) setWall(wallKey(o.kind, o0.pw.color, o.matte));
  }
  if (a === 'wallf') setWall(b.dataset.k || null);
  if (a === 'fg') S.fg = +b.dataset.i;
  if (a === 'style') { S.st.style = b.dataset.k; send({ t: 'style', k: b.dataset.k }); }
  else if (a === 'room') { S.room = b.dataset.room || null; S.sel = null; S.selCut = null; S.view = null; }
  else if (a === 'reset') { if (S.resetArm) { send({ t: 'reset' }); S.resetArm = false; } else S.resetArm = true; }
  else if (a === 'tour') send({ t: 'tour', on: !!b.dataset.on });
  else if (a === 'open') openSheet('furn');
  else if (a === 'fin') openSheet('fin');
  else if (a === 'person') openSheet('person');
  else if (a === 'del' && S.selCut != null) {   // 拆牆／復原牆
    const i = S.selCut, gone = (S.st.cut || []).includes(i); S.st.cut = (S.st.cut || []).filter((k) => k !== i); if (!gone) S.st.cut.push(i);
    send({ t: 'cut', i, on: !gone });
  }
  else if (a === 'len') {
    const it = S.st.items.find((i) => i.id === S.sel), s = it && getItem(it.key, it.st || S.st.style, it), R = lenRange(s); if (!R) return;
    it.len = Math.max(R.min, Math.min(R.max, s.w + (+b.dataset.d))); send({ t: 'len', id: it.id, len: it.len }); snapToWall(it);
  }
  else if (a === 'elev') {
    const it = S.st.items.find((i) => i.id === S.sel), s = it && getItem(it.key, it.st || S.st.style, it), R = elevRange(s); if (!R) return;
    it.el = Math.max(R.min, Math.min(R.max, s.elev + (+b.dataset.d))); send({ t: 'elev', id: it.id, el: it.el });
  }
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
  (PLAN.cuts || []).forEach((_, i) => {   // 可拆的牆：橘色虛線框；已拆的：灰色虛線。點一下選取，再按下面的按鈕
    const gone = (S.st.cut || []).includes(i), sel = S.selCut === i;
    h += `<g data-cut="${i}">` + cutRects(i).map(([a, b, c, d]) => `<rect x="${a - 7}" y="${b - 7}" width="${c - a + 14}" height="${d - b + 14}" fill="transparent"/><rect x="${a}" y="${b}" width="${c - a}" height="${d - b}" fill="${sel ? '#E8742A' : gone ? 'none' : '#E8742A'}" fill-opacity="${sel ? 0.85 : 0.28}" stroke="${gone ? '#8C8F94' : '#E8742A'}" stroke-width="${sel ? 3 : 1.6}" stroke-dasharray="${sel ? '' : '6 4'}"/>`).join('') + '</g>';
  });
  const poses = resolvePeople(S.st.items);
  const order = (s) => (s.t === 'rug' ? 0 : s.t === 'person' ? 3 : s.elev > 0 ? 2 : 1);
  const list = S.st.items.map((it) => ({ it, s: getItem(it.key, it.st || S.st.style, it) })).filter((q) => q.s && q.it.x > vb[0] - 80 && q.it.x < vb[0] + vb[2] + 80 && q.it.y > vb[1] - 80 && q.it.y < vb[1] + vb[3] + 80)
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
  if (S.selCut != null && (PLAN.cuts || [])[S.selCut]) {
    const gone = (S.st.cut || []).includes(S.selCut), len = Math.round(cutRects(S.selCut).reduce((t, [a, b, c, d]) => t + Math.max(c - a, d - b), 0));
    el.innerHTML = `<b>${gone ? '已拆除的牆' : '隔間牆'}</b><span>長約 ${len} cm・${gone ? '按「復原牆面」可以蓋回來' : '按「刪除」可以拆掉'}</span>`;
    $('rotBtn').disabled = $('finBtn').disabled = true; $('delBtn').disabled = false; $('delBtn').textContent = gone ? '復原牆面' : '刪除'; return;
  }
  $('delBtn').textContent = '刪除';
  const it = S.st.items.find((i) => i.id === S.sel), s = it && getItem(it.key, it.st || S.st.style, it);
  if (!s) el.innerHTML = '<span class="muted">點家具可以選取，按住拖曳就能移動。</span>';
  else if (s.t === 'person') { const p = resolvePeople(S.st.items).get(it.id); el.innerHTML = `<b>${esc(s.name)}</b><span>${p && p.mode === 'sit' ? '坐著' : '站著'}</span>`; }
  else if (lenRange(s)) { const R = lenRange(s), E = elevRange(s), bt = (act, d, txt, off) => `<button data-act="${act}" data-d="${d}" ${off ? 'disabled' : ''}>${txt}</button>`;
    el.innerHTML = `<b>${esc(s.name)}</b><span>${s.t === 'wall' ? '長' : '寬'} ${s.w}${E ? '・離地 ' + s.elev : ''}</span><span class="lenb">${bt('len', -R.step, '－' + R.step, s.w <= R.min)}${bt('len', R.step, '＋' + R.step, s.w >= R.max)}${E ? bt('elev', -E.step, '↓', s.elev <= E.min) + bt('elev', E.step, '↑', s.elev >= E.max) : ''}</span>`; }
  else el.innerHTML = `<b>${esc(s.name)}</b><span>寬 ${s.w} × 深 ${s.d} × 高 ${s.h} cm${s.elev ? '・壁掛' : ''}</span>`;
  $('rotBtn').disabled = $('delBtn').disabled = !s; $('finBtn').disabled = !finishOf(s);
}
// 裝修櫃與牆上置物架：離牆 70cm 內就自動貼上去、背面靠牆
function snapToWall(it) {
  const s = getItem(it.key, it.st || S.st.style, it), r = curRoom(); if (!s || !r || (s.t !== 'built' && s.t !== 'wshelf')) return;
  const q = r.rs.find(([a, b, c, d]) => it.x >= a - 5 && it.x <= c + 5 && it.y >= b - 5 && it.y <= d + 5) || r.r, [x1, y1, x2, y2] = q, hd = s.d / 2, hw = s.w / 2;
  const opts = [[it.y - y1, 0], [x2 - it.x, 90], [y2 - it.y, 180], [it.x - x1, 270]].sort((a, b) => a[0] - b[0]);
  if (opts[0][0] > 70 + hd) return;
  const k = opts[0][1], cl = (v, lo, hi) => (hi < lo ? (lo + hi) / 2 : Math.max(lo, Math.min(hi, v)));
  it.r = k;
  if (k === 0) { it.y = y1 + hd; it.x = cl(it.x, x1 + hw, x2 - hw); } else if (k === 180) { it.y = y2 - hd; it.x = cl(it.x, x1 + hw, x2 - hw); }
  else if (k === 90) { it.x = x2 - hd; it.y = cl(it.y, y1 + hw, y2 - hw); } else { it.x = x1 + hd; it.y = cl(it.y, y1 + hw, y2 - hw); }
  it.x = Math.round(it.x); it.y = Math.round(it.y);
  send({ t: 'rot', id: it.id, r: it.r }); send({ t: 'move', id: it.id, x: it.x, y: it.y });
}
function bindPlan() {
  const svg = $('plan');
  const pt = (e) => { const q = svg.createSVGPoint(); q.x = e.clientX; q.y = e.clientY; return q.matrixTransform(svg.getScreenCTM().inverse()); };
  const pts = new Map(); let lastSend = 0, pinch = null;
  const baseVB = () => { const r = curRoom().r; return [r[0] - PAD, r[1] - PAD, r[2] - r[0] + 2 * PAD, r[3] - r[1] + 2 * PAD]; };
  const endDrag = () => { const d = S.drag; if (!d) return; const it = S.st.items.find((i) => i.id === d.id); if (it) { send({ t: 'move', id: it.id, x: it.x, y: it.y }); snapToWall(it); } S.drag = null; };
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
    const g = e.target.closest('[data-id]'), cg = g ? null : e.target.closest('[data-cut]');
    S.selCut = cg ? +cg.dataset.cut : null;
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
  try { thumbMod = thumbMod || await import('./thumbs.js?v=20261113c'); } catch (e) { return; }
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
  try { thumbMod = thumbMod || await import('./thumbs.js?v=20261113c'); } catch (e) { return; }
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
  if (S.sheet === 'fin') {
    const it = S.st.items.find((i) => i.id === S.sel), s = it && getItem(it.key, it.st || sk, it), f = FINISH[finishOf(s)]; if (!f) return closeSheet();
    const cm = it.m || (s.v === 'leather' ? 'leather' : null), cc = it.c;
    $('sheetTitle').textContent = '材質與顏色・' + s.name; $('groups').innerHTML = ''; $('cats').innerHTML = '';
    const cm2 = cm || s.fin;
    $('list').innerHTML = `<h2 style="font-size:17px">${f.mlabel || '材質'}</h2><div class="grid2">` + f.mats.map(([k, n]) => `<button class="card finm ${k === cm2 ? 'on' : ''}" data-fm="${k}"><i class="fm-${k}" style="--c:${f.mcol ? f.mcol[k] : cc || s.color && s.color[0] === '#' ? cc || s.color : f.colors[0][0]}"></i><b>${n}</b></button>`).join('') + '</div>' +
      `<h2 style="font-size:17px;margin-top:6px">${f.label && f.mcol ? f.label : '顏色'}</h2><div class="fgrid" style="flex:none;overflow:visible">` + f.colors.map(([c, n]) => `<button class="fsw ${c === cc ? 'on' : ''}" data-fc="${c}"><i style="--c:${c}"></i><span>${n}</span></button>`).join('') + '</div>';
    return;
  }
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
  const fb = e.target.closest('[data-fm],[data-fc]');
  if (fb && S.st) { const it = S.st.items.find((i) => i.id === S.sel), s = it && getItem(it.key, it.st || S.st.style, it), f = FINISH[finishOf(s)]; if (!f) return;
    it.m = fb.dataset.fm || it.m || (s.v === 'leather' ? 'leather' : f.mats[0][0]); it.c = fb.dataset.fc || it.c || (f.colors.find((x) => x[0] === s.color) || f.colors[0])[0];
    send({ t: 'fin', id: it.id, m: it.m, c: it.c }); renderSheet(); update(); return; }
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
  // 左右兩塊都是「按在哪裡，搖桿就出現在哪裡」：左邊走路、右邊轉頭（推得越遠轉得越快），放開就回到中間
  const pad = (zone, stick, onSet, onStop) => {
    const knob = stick.firstElementChild, R = 56; let id = null, ox = 0, oy = 0;
    const set = (x, y) => { knob.style.transform = `translate(${x * R}px, ${y * R}px)`; onSet(x, y); jDirty = true; flushInput(); };
    zone.addEventListener('pointerdown', (e) => { e.preventDefault(); id = e.pointerId; zone.setPointerCapture(id); const b = zone.getBoundingClientRect(); ox = e.clientX; oy = e.clientY; stick.style.left = (ox - b.left) + 'px'; stick.style.top = (oy - b.top) + 'px'; stick.classList.remove('rest'); zone.classList.add('on'); });
    zone.addEventListener('pointermove', (e) => { if (e.pointerId !== id) return; let x = (e.clientX - ox) / R, y = (e.clientY - oy) / R; const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; } set(x, y); });
    const up = (e) => { if (e.pointerId !== id) return; id = null; stick.classList.add('rest'); stick.style.left = stick.style.top = ''; zone.classList.remove('on'); set(0, 0); lastJoy = 0; flushInput(); onStop(); };
    zone.addEventListener('pointerup', up); zone.addEventListener('pointercancel', up);
  };
  // 放開時再用可靠通道送一次「停」（只停自己這一邊，另一手還按著的話不受影響）
  pad($('moveZone'), $('stick'), (x, y) => { J.f = -y; J.s = x; }, () => send({ t: 'joy', n: ++jn, f: 0, s: 0, tn: J.tn, p: J.p }));
  pad($('lookZone'), $('lstick'), (x, y) => { J.tn = x; J.p = -y; }, () => send({ t: 'joy', n: ++jn, f: J.f, s: J.s, tn: 0, p: 0 }));
}
// 平面圖：點一下就請大螢幕快速走過去；大螢幕每 0.1 秒回報位置，畫成圓點＋面向的扇形
function bindTourPlan() {
  const svg = $('tplan'); if (!svg) return;
  svg.addEventListener('pointerdown', (e) => { e.preventDefault(); const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; const q = p.matrixTransform(svg.getScreenCTM().inverse());
    const x = Math.round(Math.max(0, Math.min(PLAN.W, q.x))), y = Math.round(Math.max(0, Math.min(PLAN.D, q.y))); send({ t: 'goto', x, y }); S.pos = Object.assign({}, S.pos || {}, { go: [x, y] }); moveMe(); });
}
function moveMe() {
  const me = document.getElementById('me'), tg = document.getElementById('tgt'), chip = document.getElementById('goChip'), p = S.pos; if (!me || !p) return;
  if (p.x != null) me.setAttribute('transform', `translate(${p.x} ${p.y}) rotate(${(p.yaw * 180 / Math.PI).toFixed(1)})`);
  const go = p.go && p.go.length ? p.go : null; tg.style.display = go ? '' : 'none'; chip.style.display = go ? '' : 'none';
  if (go) { tg.setAttribute('transform', `translate(${go[0]} ${go[1]})`); const r = roomAt(go[0], go[1], 0); chip.textContent = r ? `前往${r.n}中…` : '前往中…'; }
}
addEventListener('resize', () => update());
const myTour = () => S.st && S.st.mode === 'tour' && S.st.tourBy === S.st.you;
let lastJoy = 0;
function flushInput() {   // 手指一動就送（最快每 25 毫秒一次），不等固定的時鐘
  if (!myTour()) return;
  const now = performance.now(); if (now - lastJoy < 25) return; lastJoy = now;
  if (jDirty) { jDirty = false; sendFast({ t: 'joy', n: ++jn, f: J.f, s: J.s, tn: J.tn, p: J.p }); }
  if (LOOK.dx || LOOK.dy) { sendFast({ t: 'look', dx: LOOK.dx, dy: LOOK.dy }); LOOK.dx = LOOK.dy = 0; }
}
setInterval(() => { if (myTour() && (J.f || J.s || J.tn || J.p)) jDirty = true; flushInput(); }, 120);   // 按住不動時定期補送，避免封包遺失後停不下來或走不動
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
