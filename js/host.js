// 大螢幕（電腦）端：3D 場景、遊戲流程、手機連線
import * as THREE from 'three';
import { RoomEnvironment } from '../vendor/RoomEnvironment.js';
import { PLAN, roomAt } from './plan.js';
import { getItem, STYLES, resolvePeople } from './catalog.js';
import { buildItem, buildPerson, M } from './models.js';
import * as MT from './mats.js';
import { EffectComposer } from '../vendor/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from '../vendor/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from '../vendor/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from '../vendor/jsm/postprocessing/OutputPass.js';
MT.setTexSize(512);

const $ = (id) => document.getElementById(id);
const cm = 0.01;

// ================= 狀態 =================
const state = { style: 'nordic', mode: 'overview', tourBy: null, items: PLAN.defaults.map((d) => ({ ...d })) };
let screen = 'start';

// ================= 3D 基本設定 =================
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const BG_OVER = new THREE.Color('#DFE3E8'), BG_TOUR = new THREE.Color('#CFE3F2');
scene.background = BG_OVER.clone();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;

const camera = new THREE.PerspectiveCamera(34, 1, 0.05, 200);
const hemi = new THREE.HemisphereLight(0xffffff, 0xcfc8bc, 0.7); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1dc, 2.6);
sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096);
Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 60 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 3;
scene.add(sun); scene.add(sun.target);
const CX = PLAN.W * cm / 2, CZ = PLAN.D * cm / 2;
sun.target.position.set(CX, 0, CZ);

// 室內燈（只在 3D 導覽時開）
const bulbs = new THREE.Group(); scene.add(bulbs);
for (const r of PLAN.rooms) {
  const [x1, y1, x2, y2] = r.r, big = (x2 - x1) * (y2 - y1) > 60000;
  const pts = big ? [[0.3, 0.3], [0.7, 0.7]] : [[0.5, 0.5]];
  for (const [u, v] of pts) { const p = new THREE.PointLight(0xffe2c2, 2.6, 7, 1.8); p.position.set((x1 + (x2 - x1) * u) * cm, 2.55, (y1 + (y2 - y1) * v) * cm); bulbs.add(p); }
}
bulbs.visible = false;

// ================= 房子外殼 =================
const shell = new THREE.Group(); scene.add(shell);
let wallsCut, wallsFull, ceiling, wallMat, floorMats = {};
const CUT = 165;

function wbox(parent, x1, y1, x2, y2, z1, z2, mat, cast = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry((x2 - x1) * cm, (z2 - z1) * cm, (y2 - y1) * cm), mat);
  m.position.set((x1 + x2) / 2 * cm, (z1 + z2) / 2 * cm, (y1 + y2) / 2 * cm);
  m.castShadow = cast; m.receiveShadow = true; parent.add(m); return m;
}
function floorMesh(x1, y1, x2, y2, mat, scale) {
  const geo = new THREE.PlaneGeometry((x2 - x1) * cm, (y2 - y1) * cm); geo.rotateX(-Math.PI / 2);
  const uv = geo.attributes.uv, pos = geo.attributes.position, ox = (x1 + x2) / 2 * cm, oz = (y1 + y2) / 2 * cm;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + ox) / scale, (pos.getZ(i) + oz) / scale);
  const m = new THREE.Mesh(geo, mat); m.position.set(ox, 0, oz); m.receiveShadow = true; return m;
}
function buildShell() {
  shell.clear();
  const st = STYLES[state.style];
  wallMat = MT.wallPaint(st.wall);
  const capMat = new THREE.MeshStandardMaterial({ color: '#3B3F46', roughness: 0.8 });
  const baseMat = new THREE.MeshStandardMaterial({ color: '#E3DED6', roughness: 0.6 });
  const slabMat = new THREE.MeshStandardMaterial({ color: '#C4C8CD', roughness: 0.9 });
  floorMats = {   // [材質, 一張貼圖鋪多少公尺]
    main: st.floor === 'marble' ? [MT.tiles(st.floorC, 2, true), 1.6] : [MT.floorWood(st.floorC), 1.6],
    bath: [MT.tiles('#D9D7D2', 2, false), 0.6], kit: [MT.tiles('#D2CEC7', 2, true), 1.2],
    foyer: [MT.tiles('#E9E5DE', 2, true), 1.6], balc: [MT.tiles('#B4B1AB', 2, false, 0.7), 0.6],
  };
  for (const [x1, y1, x2, y2, k] of PLAN.floors) shell.add(floorMesh(x1, y1, x2, y2, floorMats[k][0], floorMats[k][1]));
  for (const [x1, y1, x2, y2] of PLAN.slab) wbox(shell, x1, y1, x2, y2, -30, -0.5, slabMat, false);
  wallsCut = new THREE.Group(); wallsFull = new THREE.Group(); shell.add(wallsCut, wallsFull);
  for (const [x1, y1, x2, y2, z1, z2] of PLAN.walls) {
    wbox(wallsFull, x1, y1, x2, y2, z1, z2, wallMat);
    if (z1 === 0 && z2 >= 200) wbox(wallsFull, x1 - 1, y1 - 1, x2 + 1, y2 + 1, 0, 8, baseMat, false);
    if (z1 < CUT) { const top = Math.min(z2, CUT); wbox(wallsCut, x1, y1, x2, y2, z1, top, wallMat); if (z2 > CUT) wbox(wallsCut, x1, y1, x2, y2, top, top + 0.6, capMat, false); }
  }
  // 窗：玻璃 + 鋁框
  const glass = M('glass', '#BFDDEE'), frame = M('paint', '#4A4E55');
  for (const [x1, y1, x2, y2, sill, top] of PLAN.wins) {
    const horiz = x2 - x1 > y2 - y1;
    for (const [grp, t] of [[wallsCut, Math.min(top, CUT)], [wallsFull, top]]) {
      if (t <= sill) continue;
      if (horiz) {
        const my = (y1 + y2) / 2; wbox(grp, x1, my - 0.6, x2, my + 0.6, sill, t, glass, false);
        wbox(grp, x1, y1, x2, y2, sill, sill + 4, frame); if (t === top) wbox(grp, x1, y1, x2, y2, top - 4, top, frame);
        const n = Math.max(2, Math.round((x2 - x1) / 90)); for (let i = 0; i <= n; i++) { const xx = x1 + (x2 - x1) * i / n; wbox(grp, xx - 2.5, my - 3, xx + 2.5, my + 3, sill, t, frame); }
        if (t === top && top - sill > 120) wbox(grp, x1, my - 3, x2, my + 3, sill + 62, sill + 66, frame);
      } else {
        const mx = (x1 + x2) / 2; wbox(grp, mx - 0.6, y1, mx + 0.6, y2, sill, t, glass, false);
        wbox(grp, x1, y1, x2, y2, sill, sill + 4, frame); if (t === top) wbox(grp, x1, y1, x2, y2, top - 4, top, frame);
        const n = Math.max(1, Math.round((y2 - y1) / 90)); for (let i = 0; i <= n; i++) { const yy = y1 + (y2 - y1) * i / n; wbox(grp, mx - 3, yy - 2.5, mx + 3, yy + 2.5, sill, t, frame); }
      }
    }
  }
  // 大門
  const [dx1, dy1, dx2, dy2] = PLAN.door;
  wbox(wallsFull, dx1, dy1, dx2, dy2, 0, 210, M('wood', '#6A4F3B')); wbox(wallsCut, dx1, dy1, dx2, dy2, 0, CUT, M('wood', '#6A4F3B'));
  // 天花板 + 嵌燈
  ceiling = new THREE.Group(); shell.add(ceiling);
  const ceilMat = new THREE.MeshStandardMaterial({ color: '#F7F5F1', roughness: 0.95 });
  for (const [x1, y1, x2, y2] of PLAN.slab) wbox(ceiling, x1, y1, x2, y2, PLAN.H, PLAN.H + 12, ceilMat);
  const dl = M('emit', '#FFF4E0');
  bulbs.children.forEach((p) => { const d = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.01, 20), dl); d.position.set(p.position.x, PLAN.H * cm - 0.004, p.position.z); ceiling.add(d); });
  applyMode();
}

// ================= 家具 =================
const furn = new THREE.Group(); scene.add(furn);
const objs = new Map();
function freeObj(o) { furn.remove(o); o.traverse((n) => { if (n.geometry) n.geometry.dispose(); }); }
function syncItems() {
  const seen = new Set(), people = resolvePeople(state.items), used = new Set([...people.values()].map((p) => p.on).filter(Boolean));
  for (const it of state.items) {
    const sk = it.st || state.style, spec = getItem(it.key, sk); if (!spec) continue;
    seen.add(it.id);
    const pose = spec.t === 'person' ? people.get(it.id) : null;
    const decor = !used.has(it.id), sig = pose ? it.key + '|' + pose.mode + '|' + (pose.seat || 0) : it.key + '@' + sk + (decor ? '' : '-');
    let e = objs.get(it.id);
    if (!e || e.sig !== sig) {
      if (e) freeObj(e.o);
      e = { sig, o: pose ? buildPerson(spec, pose) : buildItem(spec, STYLES[sk], { decor }) }; furn.add(e.o); objs.set(it.id, e);
    }
    if (pose) { e.o.position.set(pose.x * cm, pose.elev * cm, pose.y * cm); e.o.rotation.y = -pose.r * Math.PI / 180; }
    else { e.o.position.set(it.x * cm, spec.elev * cm, it.y * cm); e.o.rotation.y = -it.r * Math.PI / 180; }
  }
  for (const [id, e] of objs) if (!seen.has(id)) { freeObj(e.o); objs.delete(id); }
}

// ================= 鏡頭 =================
const view = { tx: CX, tz: CZ, dist: 22, az: 0.14, el: 1.05 };      // 目前值
const goal = { tx: CX, tz: CZ, dist: 22, az: 0.14, el: 1.05 };      // 目標值
const tour = { x: PLAN.start[0] * cm, z: PLAN.start[1] * cm, yaw: -Math.PI / 2, pitch: -0.06 };
const joy = new Map();   // 每支手機的搖桿

const PANEL = 216;   // 右側面板寬度（px）：鳥瞰時把畫面往左移，面板才不會擋到玄關
function applyOffset() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (state.mode === 'tour' || screen !== 'play') camera.clearViewOffset(); else camera.setViewOffset(w, h, PANEL / 2, 0, w, h);
  camera.updateProjectionMatrix();
}
function fitDist(wm, dm) { // 讓 wm × dm（公尺）的區域塞進畫面
  const a = camera.aspect * (screen === 'play' ? Math.max(0.5, 1 - PANEL / Math.max(600, canvas.clientWidth)) : 1), v = THREE.MathUtils.degToRad(camera.fov) / 2, h = Math.atan(Math.tan(v) * a);
  const dv = (dm * Math.sin(goal.el) + 1.9 * Math.cos(goal.el)) / 2 / Math.tan(v);
  const dh = wm / 2 / Math.tan(h);
  return Math.max(dv, dh) * 1.12 + 1.5;
}
function setGoal() {
  if (screen !== 'play') { goal.tx = CX; goal.tz = CZ; goal.dist = fitDist(PLAN.W * cm, PLAN.D * cm) * 0.92; goal.el = 0.95; return; }
  goal.el = 1.05; goal.tx = CX; goal.tz = CZ; goal.dist = fitDist(PLAN.W * cm, PLAN.D * cm); goal.az = 0.14;   // 佈置時固定全戶鳥瞰
}
function applyMode() {
  const t = state.mode === 'tour';
  if (wallsFull) { wallsFull.visible = t; wallsCut.visible = !t; ceiling.visible = t; }
  bulbs.visible = t;
  scene.background.copy(t ? BG_TOUR : BG_OVER);
  hemi.intensity = t ? 0.22 : 0.38; sun.intensity = t ? 5 : 2.5; scene.environmentIntensity = t ? 0.22 : 0.4;
  if (t) sun.position.set(CX - 1.5, 7, CZ - 13); else sun.position.set(CX - 5, 14, CZ + 6);
  camera.fov = t ? 72 : 34; applyOffset();
  setGoal(); updateHud();
}

// 導覽時的碰撞（牆 + 較高的家具）
let colliders = [];
function buildColliders() {
  colliders = PLAN.walls.filter((w) => w[4] < 140 && w[5] > 25).map((w) => [w[0] * cm, w[1] * cm, w[2] * cm, w[3] * cm]);
  const d = PLAN.door; colliders.push([d[0] * cm, d[1] * cm, d[2] * cm, d[3] * cm]);
  for (const it of state.items) {
    const s = getItem(it.key); if (!s || s.h < 35 || s.elev > 0 || s.t === 'rug' || s.t === 'lamp' || s.t === 'person') continue;
    const rot = it.r % 180 !== 0, hw = (rot ? s.d : s.w) / 2 - 8, hd = (rot ? s.w : s.d) / 2 - 8;
    if (hw > 2 && hd > 2) colliders.push([(it.x - hw) * cm, (it.y - hd) * cm, (it.x + hw) * cm, (it.y + hd) * cm]);
  }
}
function collide(p) {
  const R = 0.2;
  for (let k = 0; k < 2; k++) for (const [x1, z1, x2, z2] of colliders) {
    const nx = Math.max(x1, Math.min(p.x, x2)), nz = Math.max(z1, Math.min(p.z, z2));
    let dx = p.x - nx, dz = p.z - nz; const d2 = dx * dx + dz * dz;
    if (d2 >= R * R) continue;
    if (d2 > 1e-9) { const d = Math.sqrt(d2); p.x = nx + dx / d * R; p.z = nz + dz / d * R; }
    else { // 在盒子裡：往最近的邊推出去
      const l = p.x - x1, r = x2 - p.x, t = p.z - z1, b = z2 - p.z, m = Math.min(l, r, t, b);
      if (m === l) p.x = x1 - R; else if (m === r) p.x = x2 + R; else if (m === t) p.z = z1 - R; else p.z = z2 + R;
    }
  }
}

// ================= 主迴圈 =================
function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== Math.floor(w * renderer.getPixelRatio()) || canvas.height !== Math.floor(h * renderer.getPixelRatio())) {
    renderer.setSize(w, h, false); if (composer) composer.setSize(canvas.width, canvas.height); camera.aspect = w / h; applyOffset(); setGoal();
  }
}
// 後製：接觸陰影（AO）。電腦跑不動時會自動關閉，再不行就降低解析度
const Q0 = new URLSearchParams(location.search).get('q');   // 網址加 ?q=0／1／2 可以手動指定畫質
let composer = null, aoPass = null, quality = Q0 === null ? 2 : Math.max(0, Math.min(2, +Q0 || 0)), slow = 0, fast = 0;
function setupComposer() {
  const w = canvas.width, h = canvas.height;
  composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 4 }));
  composer.addPass(new RenderPass(scene, camera));
  aoPass = new GTAOPass(scene, camera, w, h); aoPass.updateGtaoMaterial({ radius: 0.3, distanceExponent: 1.2, thickness: 1.2, scale: 1.2, samples: 12 }); aoPass.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
  composer.addPass(aoPass); composer.addPass(new OutputPass());
}
function tuneQuality(dt) {
  if (dt > 0.045) slow++; else if (dt < 0.03) fast++;
  if (Q0 !== null || slow + fast < 90) return;
  if (slow > 55 && quality > 0) { quality--; if (quality === 0) { renderer.setPixelRatio(1); sun.shadow.mapSize.set(2048, 2048); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } } console.info('畫質自動調整為', ['低', '中', '高'][quality]); }
  slow = fast = 0;
}
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  resize();
  if (state.mode === 'tour' && screen === 'play') {
    let f = 0, s = 0, t = 0, p = 0;
    for (const j of joy.values()) { f += j.f; s += j.s; t += j.t; p += j.p; }
    const cl = (v) => Math.max(-1, Math.min(1, v)); f = cl(f); s = cl(s); t = cl(t); p = cl(p);
    tour.yaw += t * 1.7 * dt; tour.pitch = Math.max(-0.5, Math.min(0.4, tour.pitch + p * 0.9 * dt));
    const dx = Math.cos(tour.yaw), dz = Math.sin(tour.yaw), sp = 1.5 * dt;
    const np = { x: tour.x + (dx * f - dz * s) * sp, z: tour.z + (dz * f + dx * s) * sp };
    collide(np); tour.x = np.x; tour.z = np.z;
    camera.position.set(tour.x, 1.5, tour.z);
    camera.lookAt(tour.x + dx * Math.cos(tour.pitch), 1.5 + Math.sin(tour.pitch), tour.z + dz * Math.cos(tour.pitch));
  } else {
    if (screen !== 'play') goal.az = Math.sin(now / 9000) * 0.45;
    const k = 1 - Math.exp(-dt * 3.2);
    for (const key of ['tx', 'tz', 'dist', 'az', 'el']) view[key] += (goal[key] - view[key]) * k;
    const ce = Math.cos(view.el);
    camera.position.set(view.tx + Math.sin(view.az) * ce * view.dist, Math.sin(view.el) * view.dist, view.tz + Math.cos(view.az) * ce * view.dist);
    camera.lookAt(view.tx, 0.4, view.tz);
  }
  if (screen === 'play') tuneQuality(dt);
  if (quality === 2) { if (!composer) setupComposer(); composer.render(); } else renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// ================= 畫面流程 =================
function show(name) {
  screen = name;
  $('start').classList.toggle('hidden', name !== 'start');
  $('select').classList.toggle('hidden', name !== 'select');
  $('hud').classList.toggle('hidden', name !== 'play');
  document.body.dataset.screen = name;
  applyOffset(); setGoal(); updateHud();
}
$('startBtn').addEventListener('click', () => show('select'));
$('unitA1').addEventListener('click', () => { show('play'); broadcast(); });
$('backBtn').addEventListener('click', () => show('start'));

function updateHud() {
  const st = STYLES[state.style];
  $('modeChip').textContent = state.mode === 'tour' ? '3D 導覽中' : '全戶鳥瞰';
  $('styleName').textContent = st.n;
  $('swatches').innerHTML = st.sw.map((c) => `<i style="background:${c}"></i>`).join('');
  $('count').textContent = conns.size;
  document.body.dataset.mode = state.mode;
}

// ================= 手機連線（PeerJS） =================
const conns = new Set();
let peer = null, roomCode = '';
function setNet(text, ok) { const e = $('net'); e.textContent = text; e.dataset.ok = ok === true ? '1' : ok === false ? '0' : ''; }
function makeCode() { const s = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let c = ''; for (let i = 0; i < 4; i++) c += s[Math.floor(Math.random() * s.length)]; return c; }
function send(conn, msg) { try { if (conn.open) conn.send(msg); } catch (e) { /* 連線已關閉 */ } }
let nextConn = 1;
function snapshot(e) { return { t: 'state', style: state.style, mode: state.mode, tourBy: state.tourBy, you: e.id, items: state.items, ready: screen === 'play', players: conns.size }; }
let bTimer = null;
function broadcast() { if (bTimer) return; bTimer = setTimeout(() => { bTimer = null; for (const e of conns) send(e.conn, snapshot(e)); updateHud(); }, 60); }

function startPeer() {
  if (typeof Peer === 'undefined') { setNet('無法載入連線元件，請檢查網路後重新整理', false); return; }
  roomCode = makeCode();
  setNet('正在連線配對伺服器…');
  peer = new Peer('myhome-a1-' + roomCode.toLowerCase());
  peer.on('open', () => { setNet('已就緒，可以掃碼加入', true); showQR(); });
  peer.on('connection', (conn) => {
    const entry = { conn, seen: Date.now(), id: nextConn++ }; conns.add(entry);
    conn.on('open', () => { send(conn, snapshot(entry)); broadcast(); });
    conn.on('data', (m) => { entry.seen = Date.now(); onMsg(entry, m); });
    conn.on('close', () => drop(entry)); conn.on('error', () => drop(entry));
  });
  peer.on('disconnected', () => { setNet('與配對伺服器斷線，重新連線中…'); setTimeout(() => { try { if (peer && !peer.destroyed) peer.reconnect(); } catch (e) { /* 忽略 */ } }, 1500); });
  peer.on('error', (err) => {
    if (err.type === 'unavailable-id') { peer.destroy(); startPeer(); return; }
    if (['network', 'server-error', 'socket-error', 'socket-closed', 'browser-incompatible'].includes(err.type)) setNet('連不上配對伺服器（' + err.type + '），可能被網路擋住', false);
  });
}
function endTour() { state.mode = 'overview'; state.tourBy = null; joy.clear(); applyMode(); }
function drop(entry) { if (!conns.delete(entry)) return; joy.delete(entry); try { entry.conn.close(); } catch (e) { /* 忽略 */ } if (state.tourBy === entry.id) endTour(); broadcast(); }
setInterval(() => { const now = Date.now(); for (const e of [...conns]) if (now - e.seen > 15000) drop(e); }, 1000);

const num = (v, lo, hi) => Math.max(lo, Math.min(hi, Number(v) || 0));
function onMsg(entry, m) {
  if (!m || typeof m !== 'object') return;
  if (m.t === 'hello') return send(entry.conn, snapshot(entry));
  if (m.t === 'ping' || screen !== 'play') return;
  const find = (id) => state.items.find((i) => i.id === id);
  if (m.t === 'joy') { if (state.mode === 'tour' && state.tourBy === entry.id) joy.set(entry, { f: num(m.f, -1, 1), s: num(m.s, -1, 1), t: num(m.tn, -1, 1), p: num(m.p, -1, 1) }); return; }
  if (m.t === 'tour') {
    if (m.on && state.mode !== 'tour') {
      state.mode = 'tour'; state.tourBy = entry.id;
      Object.assign(tour, { x: PLAN.start[0] * cm, z: PLAN.start[1] * cm, yaw: -Math.PI / 2, pitch: -0.06 }); buildColliders(); joy.clear(); applyMode();
    } else if (!m.on && state.tourBy === entry.id) endTour();
    return broadcast();
  }
  if (state.mode === 'tour') return send(entry.conn, snapshot(entry));   // 有人在導覽時，暫停所有編輯
  switch (m.t) {
    case 'style': if (STYLES[m.k] && m.k !== state.style) { state.style = m.k; buildShell(); syncItems(); } break;
    case 'move': { const it = find(m.id); if (it) { it.x = num(m.x, 0, PLAN.W); it.y = num(m.y, 0, PLAN.D); syncItems(); } break; }
    case 'rot': { const it = find(m.id); if (it) { it.r = ((Math.round(num(m.r, 0, 360) / 90) * 90) % 360); syncItems(); } break; }
    case 'del': state.items = state.items.filter((i) => i.id !== m.id); syncItems(); break;
    case 'add': {
      const spec = getItem(m.key); if (!spec || state.items.length >= 150 || typeof m.id !== 'string' || find(m.id)) break;
      const x = num(m.x, 0, PLAN.W), y = num(m.y, 0, PLAN.D);
      if (spec.t === 'person') { const rm = roomAt(x, y); if (rm && state.items.filter((i) => i.key.startsWith('person:') && roomAt(i.x, i.y) === rm).length >= 3) break; }
      const it = { id: m.id.slice(0, 16), key: m.key, x, y, r: 0 };
      if (spec.t !== 'person') it.st = STYLES[m.st] ? m.st : state.style;
      state.items.push(it); syncItems(); break;
    }
    case 'reset': state.items = PLAN.defaults.map((d) => ({ ...d })); syncItems(); break;
    default: return;
  }
  broadcast();
}

function showQR() {
  const el = $('qr');
  if (location.protocol === 'file:') { el.textContent = '請從網站網址開啟'; return; }
  const url = new URL('phone.html', location.href); url.search = '?room=' + roomCode; url.hash = '';
  if (typeof qrcode === 'function') { const q = qrcode(0, 'M'); q.addData(url.href); q.make(); el.innerHTML = q.createSvgTag(4, 0); }
  else el.textContent = url.href;
}

// ================= 啟動 =================
buildShell(); syncItems(); show('start'); startPeer();
requestAnimationFrame(frame);
window.__app = { state, tour, joy, onMsg, show, view, goal };   // 給測試用
