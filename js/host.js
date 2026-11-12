// 大螢幕（電腦）端：3D 場景、遊戲流程、手機連線
import * as THREE from 'three';
import { RoomEnvironment } from '../vendor/RoomEnvironment.js';
import { PLAN, UNIT, UNITS, setUnit, roomAt } from './plan.js?v=20261112i';
import { getItem, STYLES, FLOORS, FINISH, finishOf, resolvePeople, keepOffBeds } from './catalog.js?v=20261112i';
import { buildItem, buildPerson, M } from './models.js?v=20261112i';
import * as MT from './mats.js?v=20261112i';
import { EffectComposer } from '../vendor/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from '../vendor/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from '../vendor/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from '../vendor/jsm/postprocessing/OutputPass.js';
MT.setTexSize(512);

const $ = (id) => document.getElementById(id);
const cm = 0.01;

// ================= 狀態 =================
const state = { style: 'nordic', floor: null, mode: 'overview', tourBy: null, items: PLAN.defaults.map((d) => ({ ...d })) };
let screen = 'start';

// ================= 3D 基本設定 =================
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
const BASE_PR = Math.min(window.devicePixelRatio || 1, 1.5);
renderer.setPixelRatio(BASE_PR);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;   // 陰影只在場景有變動時重算
// 鳥瞰畫面只在有變動時重畫，省下的效能留給手機操作與 3D 導覽
let dirty = 4, lowRes = false;
function invalidate(n = 3, shadows = true) { dirty = Math.max(dirty, n); if (shadows) renderer.shadowMap.needsUpdate = true; }
setInterval(() => invalidate(1, false), 2000);

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
let CX = PLAN.W * cm / 2, CZ = PLAN.D * cm / 2;
sun.target.position.set(CX, 0, CZ);

// 室內燈（只在 3D 導覽時開）
const bulbs = new THREE.Group(); scene.add(bulbs);
const BULB = 3.4, MAX_BULBS = 6;
// 燈的數量固定（燈池）：燈的數量一變，所有材質都要重新編譯，換戶型就會卡很久。
// 燈一直存在、只調亮度，切換導覽時也不必重新編譯著色器。
// 只放 6 盞：每多一盞燈，每個像素都要多算一次，24 盞會讓 3D 導覽明顯變卡；其餘靠環境光補。
for (let i = 0; i < MAX_BULBS; i++) { const p = new THREE.PointLight(0xffe2c2, 0, 8, 1.6); p.userData.on = false; p.position.set(0, -50, 0); bulbs.add(p); }
function buildBulbs() {   // 面積最大的 6 個房間各一盞；換戶型時只搬位置
  const pos = [...PLAN.rooms].sort((a, b) => (b.r[2] - b.r[0]) * (b.r[3] - b.r[1]) - (a.r[2] - a.r[0]) * (a.r[3] - a.r[1])).slice(0, MAX_BULBS)
    .map((r) => { const big = r.rs.reduce((m, q) => ((q[2] - q[0]) * (q[3] - q[1]) > (m[2] - m[0]) * (m[3] - m[1]) ? q : m)); return [(big[0] + big[2]) / 2 * cm, (big[1] + big[3]) / 2 * cm]; });
  bulbs.children.forEach((p, i) => { const q = pos[i]; p.userData.on = !!q; p.intensity = 0; if (q) p.position.set(q[0], 2.55, q[1]); else p.position.set(0, -50, 0); });
}

// ================= 房子外殼 =================
const shell = new THREE.Group(); scene.add(shell);
let wallsCut, wallsFull, ceiling, wallMat, floorMats = {};
const CUT = 165, CLIP = new THREE.Plane(new THREE.Vector3(0, -1, 0), CUT * cm + 0.012);   // 鳥瞰時，高過牆面剖切線的家具也一起切平

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
const wallMeshes = [], mainFloors = [];
function mainFloorMat() {   // 手機指定了地板就用指定的，否則跟著風格
  const f = FLOORS[state.floor], st = STYLES[state.style];
  if (!f) return st.floor === 'marble' ? MT.tiles(st.floorC, 2, true) : MT.floorWood(st.floorC);
  return f.k === 'terrazzo' ? MT.terrazzo(f.c) : f.k === 'tile' ? MT.tiles(f.c, 2, false, 0.35) : f.k === 'stone' ? MT.stoneTile(f.c, 4) : f.k === 'carpet' ? MT.carpet(f.c) : MT.floorWood(f.c);
}
function applyStyle() {   // 換風格只換牆面和主地板的材質，不重建房子
  invalidate(6);
  const st = STYLES[state.style], wm = MT.wallPaint(st.wall), fm = mainFloorMat();
  for (const m of wallMeshes) m.material = wm; for (const m of mainFloors) m.material = fm;
}
function buildShell() {
  shell.clear(); wallMeshes.length = 0; mainFloors.length = 0; buildBulbs();
  const st = STYLES[state.style];
  wallMat = MT.wallPaint(st.wall);
  const capMat = new THREE.MeshStandardMaterial({ color: '#3B3F46', roughness: 0.8 });
  const baseMat = new THREE.MeshStandardMaterial({ color: '#E3DED6', roughness: 0.6 });
  const slabMat = new THREE.MeshStandardMaterial({ color: '#C4C8CD', roughness: 0.9 });
  floorMats = {   // [材質, 一張貼圖鋪多少公尺]
    main: [mainFloorMat(), 1.6],
    bath: [MT.tiles('#D9D7D2', 2, false), 0.6], kit: [MT.tiles('#D2CEC7', 2, true), 1.2],
    foyer: [MT.tiles('#E9E5DE', 2, true), 1.6], balc: [MT.tiles('#B4B1AB', 2, false, 0.7), 0.6],
  };
  for (const [x1, y1, x2, y2, k] of PLAN.floors) { const f = floorMesh(x1, y1, x2, y2, floorMats[k][0], floorMats[k][1]); if (k === 'main') mainFloors.push(f); shell.add(f); }
  for (const [x1, y1, x2, y2] of PLAN.slab) wbox(shell, x1, y1, x2, y2, -30, -0.5, slabMat, false);
  wallsCut = new THREE.Group(); wallsFull = new THREE.Group(); shell.add(wallsCut, wallsFull);
  for (const [x1, y1, x2, y2, z1, z2] of PLAN.walls) {
    wallMeshes.push(wbox(wallsFull, x1, y1, x2, y2, z1, z2, wallMat));
    if (z1 === 0 && z2 >= 200) wbox(wallsFull, x1 - 1, y1 - 1, x2 + 1, y2 + 1, 0, 8, baseMat, false);
    if (z1 < CUT) { const top = Math.min(z2, CUT); wallMeshes.push(wbox(wallsCut, x1, y1, x2, y2, z1, top, wallMat)); if (z2 > CUT) wbox(wallsCut, x1, y1, x2, y2, top, top + 0.6, capMat, false); }
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
  bulbs.children.forEach((p) => { if (!p.userData.on) return; const d = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.01, 20), dl); d.position.set(p.position.x, PLAN.H * cm - 0.004, p.position.z); ceiling.add(d); });
  applyMode();
}

// ================= 家具 =================
const furn = new THREE.Group(); scene.add(furn);
const caps = new THREE.Group(); scene.add(caps);
const CAP_T = new Set(['cab', 'shelf', 'fridge', 'tower', 'washer']), capGeo = new THREE.BoxGeometry(1, 0.004, 1);
const capMat = new THREE.MeshStandardMaterial({ color: '#E6E2DA', roughness: 0.9 });
function capFor(spec) {   // 高過剖切線的櫃類，在剖切高度蓋一片板子
  if (!CAP_T.has(spec.t) || spec.elev + spec.h <= CUT) return null;
  const m = new THREE.Mesh(capGeo, capMat); m.scale.set(spec.w * cm, 1, spec.d * cm); m.position.y = CUT * cm + 0.008; m.receiveShadow = true;
  const g = new THREE.Group(); g.add(m); return g;
}
const objs = new Map();
// 電視影片：只在 3D 導覽時播放（靜音循環），鳥瞰時電視是黑的
const tvVideo = Object.assign(document.createElement('video'), { muted: true, loop: true, playsInline: true, preload: 'none' }); tvVideo.setAttribute('playsinline', ''); tvVideo.src = './media/tv.mp4?v=2';
const tvTex = new THREE.VideoTexture(tvVideo); tvTex.colorSpace = THREE.SRGBColorSpace;
const tvMat = new THREE.MeshBasicMaterial({ map: tvTex, toneMapped: false });
function setScreens(on) {
  furn.traverse((n) => { if (n.isMesh && n.userData.screen) { if (!n.userData.off) n.userData.off = n.material; n.material = on ? tvMat : n.userData.off; } });
  if (on) tvVideo.play().catch(() => { tvVideo.muted = true; tvVideo.play().catch(() => {}); }); else tvVideo.pause();   // 瀏覽器不准出聲時退回靜音播放
}
// 每一款家具只建一次模型，之後都用複製的（共用幾何與材質），換風格、搬動時就不會卡
const protos = new Map(), dblCache = new Map();
const dbl = (m) => { if (!dblCache.has(m)) { const c = m.clone(); c.side = THREE.DoubleSide; c.clippingPlanes = [CLIP]; dblCache.set(m, c); } return dblCache.get(m); };
function proto(sig, make, tall) {
  if (!protos.has(sig)) { const o = make(); if (tall) o.traverse((n) => { if (n.isMesh && n.material.side !== THREE.DoubleSide) n.material = dbl(n.material); }); protos.set(sig, o); }
  return protos.get(sig).clone();
}
function sigOf(it, people, used) {
  const sk = it.st || state.style, spec = getItem(it.key, sk, it); if (!spec) return null;
  const pose = spec.t === 'person' ? people.get(it.id) : null, decor = !used.has(it.id);
  return { spec, sk, pose, decor, sig: pose ? it.key + '|' + pose.mode + '|' + (pose.seat || 0) : it.key + '@' + sk + (decor ? '' : '-') + (spec.fin ? '~' + spec.fin + spec.color : '') };
}
const makeObj = (q) => proto(q.sig, () => (q.pose ? buildPerson(q.spec, q.pose) : buildItem(q.spec, STYLES[q.sk], { decor: q.decor })), !q.pose && q.spec.elev + q.spec.h > CUT);
function syncItems() {
  invalidate();
  for (const it of state.items) if (it.key.startsWith('person:')) keepOffBeds(it, state.items);   // 人偶不能和床重疊
  const seen = new Set(), people = resolvePeople(state.items), used = new Set([...people.values()].map((p) => p.on).filter(Boolean));
  for (const it of state.items) {
    const q = sigOf(it, people, used); if (!q) continue;
    seen.add(it.id);
    let e = objs.get(it.id);
    if (!e || e.sig !== q.sig) { if (e) { furn.remove(e.o); if (e.cap) caps.remove(e.cap); } e = { sig: q.sig, o: makeObj(q), cap: q.pose ? null : capFor(q.spec) }; furn.add(e.o); if (e.cap) caps.add(e.cap); objs.set(it.id, e); }
    if (q.pose) { e.o.position.set(q.pose.x * cm, q.pose.elev * cm, q.pose.y * cm); e.o.rotation.y = -q.pose.r * Math.PI / 180; }
    else { e.o.position.set(it.x * cm, q.spec.elev * cm, it.y * cm); e.o.rotation.y = -it.r * Math.PI / 180; if (e.cap) { e.cap.position.set(it.x * cm, 0, it.y * cm); e.cap.rotation.y = e.o.rotation.y; } }
  }
  for (const [id, e] of objs) if (!seen.has(id)) { furn.remove(e.o); if (e.cap) caps.remove(e.cap); objs.delete(id); }
}
// 閒置時先把其他風格的材質與預設家具準備好，之後切換風格就不用現算
const warm = []; let warming = false, camMoving = false;
const stage = new THREE.Scene();
function warmProto(key, sk) {   // 先把家具模型建好，並在背景編譯著色器（不擋住畫面）
  const spec = getItem(key, sk), sig = key + '@' + sk; if (!spec || protos.has(sig)) return;
  const o = proto(sig, () => buildItem(spec, STYLES[sk], { decor: true }), spec.elev + spec.h > CUT);
  if (renderer.compileAsync) { stage.add(o); renderer.compileAsync(stage, camera, scene).catch(() => {}).finally(() => stage.remove(o)); }
}
let lastInput = 0;
for (const ev of ['pointerdown', 'pointermove', 'keydown', 'wheel']) addEventListener(ev, () => { lastInput = performance.now(); }, { passive: true });
function queueWarm() {
  for (const u of UNITS) if (u.plan !== PLAN) for (const d of u.plan.defaults) warm.push(() => warmProto(d.key, state.style));
  for (const sk of Object.keys(STYLES)) {
    if (sk === state.style) continue;
    const st = STYLES[sk];
    warm.push(() => MT.wallPaint(st.wall), () => (st.floor === 'marble' ? MT.tiles(st.floorC, 2, true) : MT.floorWood(st.floorC)));
    for (const d of PLAN.defaults) warm.push(() => warmProto(d.key, sk));
  }
  if (warming) return; warming = true;
  const busy = () => state.mode === 'tour' || camMoving || performance.now() - lastInput < 1200;
  const step = () => { if (busy()) return setTimeout(step, 400); const f = warm.shift(); if (!f) { warming = false; return; } try { f(); } catch (e) { /* 忽略 */ } setTimeout(step, 60); };
  setTimeout(step, 800);
}

// ================= 鏡頭 =================
const view = { tx: CX, tz: CZ, dist: 22, az: 0, el: 1.05 };      // 目前值
const goal = { tx: CX, tz: CZ, dist: 22, az: 0, el: 1.05 };      // 目標值
const tour = { x: PLAN.start[0] * cm, z: PLAN.start[1] * cm, yaw: PLAN.yaw ?? Math.PI, pitch: -0.04 };
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
  if (screen !== 'play') { goal.tx = CX; goal.tz = CZ; goal.dist = fitDist(PLAN.W * cm, PLAN.D * cm) * 0.92; goal.el = 0.95; goal.az = 0; return; }
  goal.el = 1.05; goal.tx = CX; goal.tz = CZ; goal.dist = fitDist(PLAN.W * cm, PLAN.D * cm); goal.az = 0;   // 佈置時固定全戶鳥瞰；az = 0：房子的底邊和螢幕平行
}
function applyMode() {
  invalidate(6);
  const t = state.mode === 'tour';
  if (wallsFull) { wallsFull.visible = t; wallsCut.visible = !t; ceiling.visible = t; }
  bulbs.children.forEach((p) => { p.intensity = t && p.userData.on ? BULB : 0; });
  caps.visible = !t;
  renderer.localClippingEnabled = !t; setScreens(t);
  scene.background.copy(t ? BG_TOUR : BG_OVER);
  hemi.intensity = t ? 0.5 : 0.38; sun.intensity = t ? 5 : 2.5; scene.environmentIntensity = t ? 0.38 : 0.4;
  if (t) sun.position.set(CX - 1.5, 7, CZ - 13); else sun.position.set(CX - 5, 14, CZ + 6);
  camera.fov = t ? 72 : 34; applyOffset();
  const pr = t || lowRes ? 1 : BASE_PR; if (renderer.getPixelRatio() !== pr) { renderer.setPixelRatio(pr); resize(); }   // 導覽時用 1 倍解析度換流暢
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
    renderer.setSize(w, h, false); if (composer) composer.setSize(canvas.width, canvas.height); camera.aspect = w / h; applyOffset(); setGoal(); invalidate(4);
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
let ovSlow = 0, ovN = 0;
function tuneOverview(dt) {   // 鳥瞰移動時如果明顯跑不動，就關掉接觸陰影（只降一次）
  if (Q0 !== null) return;
  ovN++; if (dt > 0.06) ovSlow++;
  if (ovN >= 30) { if (ovSlow > 20) quality = 1; ovN = ovSlow = 0; }
}
function tuneQuality(dt) {   // 導覽時如果跑不順，就降低解析度與陰影精細度（只降一次）
  if (lowRes) return;
  if (dt > 0.04) slow++; else fast++;
  if (slow + fast < 80) return;
  if (slow > 45) { lowRes = true; sun.shadow.mapSize.set(2048, 2048); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } renderer.shadowMap.needsUpdate = true; resize(); }
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
    if (Q0 === null) tuneQuality(dt);
    renderer.render(scene, camera);
  } else {
    const k = 1 - Math.exp(-dt * 3.2); let moving = false;
    for (const key of ['tx', 'tz', 'dist', 'az', 'el']) { const d = goal[key] - view[key]; if (Math.abs(d) > 1e-3) { view[key] += d * k; moving = true; } else view[key] = goal[key]; }
    camMoving = moving; if (moving) invalidate(2, false);
    if (dirty > 0) {
      dirty--;
      const ce = Math.cos(view.el);
      camera.position.set(view.tx + Math.sin(view.az) * ce * view.dist, Math.sin(view.el) * view.dist, view.tz + Math.cos(view.az) * ce * view.dist);
      camera.lookAt(view.tx, 0.4, view.tz);
      if (quality === 2 && screen === 'play') { if (!composer) setupComposer(); composer.render(); if (moving) tuneOverview(dt); } else renderer.render(scene, camera);
    }
  }
  requestAnimationFrame(frame);
}

// ================= 畫面流程 =================
function show(name) {
  screen = name;
  $('start').classList.toggle('hidden', name !== 'start');
  $('select').classList.toggle('hidden', name !== 'select');
  $('hud').classList.toggle('hidden', name !== 'play');
  document.body.dataset.screen = name; invalidate(6);
  applyOffset(); setGoal(); updateHud();
  if (name === 'play') Object.assign(view, goal);   // 進鳥瞰時直接定位、不滑動鏡頭：鏡頭移動中接觸陰影會抖動，看起來像物件在閃
}
$('startBtn').addEventListener('click', () => { tvVideo.muted = false; tvVideo.play().then(() => { if (state.mode !== 'tour') tvVideo.pause(); }).catch(() => {}); show('select'); });   // 這一下點擊讓瀏覽器允許影片出聲
// 選戶型：卡片依 UNITS 產生；換戶型時重建房子、家具與燈
$('units').innerHTML = UNITS.map((u) => `<button class="unit" data-unit="${u.id}"><b>${u.name}</b><span>${u.spec}</span><span>${u.note}</span><em>進入佈置</em></button>`).join('');
function useUnit(id) {
  if (id === UNIT.id || !setUnit(id)) return;
  CX = PLAN.W * cm / 2; CZ = PLAN.D * cm / 2; sun.target.position.set(CX, 0, CZ);
  Object.assign(view, { tx: CX, tz: CZ }); Object.assign(tour, { x: PLAN.start[0] * cm, z: PLAN.start[1] * cm, yaw: PLAN.yaw ?? Math.PI, pitch: -0.04 });
  for (const e of objs.values()) { furn.remove(e.o); if (e.cap) caps.remove(e.cap); } objs.clear();
  state.items = PLAN.defaults.map((d) => ({ ...d }));
  buildShell(); syncItems(); warm.length = 0; queueWarm();
  try { renderer.compile(scene, camera); } catch (e) { /* 忽略 */ }
}
$('units').addEventListener('click', (e) => {
  const b = e.target.closest('[data-unit]'); if (!b || b.disabled) return;
  useUnit(b.dataset.unit); show('play'); broadcast();
});
$('backBtn').addEventListener('click', () => show('start'));
$('reselectBtn').addEventListener('click', () => { if (state.mode === 'tour') endTour(); show('select'); broadcast(); });

function updateHud() {
  const st = STYLES[state.style];
  $('unitName').textContent = UNIT.name; $('unitSpec').textContent = UNIT.spec; document.title = '打造我的家｜' + UNIT.name;
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
function snapshot(e) { return { t: 'state', unit: UNIT.id, unitName: UNIT.name, style: state.style, floor: state.floor, mode: state.mode, tourBy: state.tourBy, you: e.id, items: state.items, ready: screen === 'play', players: conns.size }; }
let bTimer = null;
function broadcast() { if (bTimer) return; bTimer = setTimeout(() => { bTimer = null; for (const e of conns) send(e.conn, snapshot(e)); updateHud(); }, 60); }

function startPeer() {
  if (typeof Peer === 'undefined') { setNet('無法載入連線元件，請檢查網路後重新整理', false); return; }
  roomCode = makeCode();
  setNet('正在連線配對伺服器…');
  peer = new Peer('myhome-a1-' + roomCode.toLowerCase());
  peer.on('open', () => { setNet('已就緒，可以掃碼加入', true); showQR(); });
  peer.on('connection', (conn) => {
    if (conn.label === 'fast') {   // 第二條不排隊的通道：只傳搖桿與轉頭，封包晚到就丟，不會越積越慢
      conn.on('data', (m) => { const e = [...conns].find((q) => q.conn.peer === conn.peer); if (e && m && (m.t === 'joy' || m.t === 'look')) { e.seen = Date.now(); onMsg(e, m); } });
      return;
    }
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
setInterval(() => { const now = Date.now(); for (const e of [...conns]) if (now - e.seen > 30000) drop(e); }, 1000);

const num = (v, lo, hi) => Math.max(lo, Math.min(hi, Number(v) || 0));
function onMsg(entry, m) {
  if (!m || typeof m !== 'object') return;
  if (m.t === 'hello') return send(entry.conn, snapshot(entry));
  if (m.t === 'ping' || screen !== 'play') return;
  const find = (id) => state.items.find((i) => i.id === id);
  if (m.t === 'joy') { if (m.n !== undefined) { if (m.n < (entry.jn || 0)) return; entry.jn = m.n; } if (state.mode === 'tour' && state.tourBy === entry.id) joy.set(entry, { f: num(m.f, -1, 1), s: num(m.s, -1, 1), t: num(m.tn, -1, 1), p: num(m.p, -1, 1) }); return; }
  if (m.t === 'look') { if (state.mode === 'tour' && state.tourBy === entry.id) { tour.yaw += num(m.dx, -2, 2); tour.pitch = Math.max(-0.6, Math.min(0.5, tour.pitch + num(m.dy, -1, 1))); } return; }
  if (m.t === 'tour') {
    if (m.on && state.mode !== 'tour') {
      state.mode = 'tour'; state.tourBy = entry.id;
      Object.assign(tour, { x: PLAN.start[0] * cm, z: PLAN.start[1] * cm, yaw: PLAN.yaw ?? Math.PI, pitch: -0.04 }); buildColliders(); joy.clear(); applyMode();
    } else if (!m.on && state.tourBy === entry.id) endTour();
    return broadcast();
  }
  if (state.mode === 'tour') return send(entry.conn, snapshot(entry));   // 有人在導覽時，暫停所有編輯
  switch (m.t) {
    case 'floor': { const k = FLOORS[m.k] ? m.k : null; if (k !== state.floor) { state.floor = k; applyStyle(); } break; }
    case 'fin': { const it = find(m.id), f = it && FINISH[finishOf(getItem(it.key))];
      if (f && f.mats.some((x) => x[0] === m.m) && f.colors.some((x) => x[0] === m.c)) { it.m = m.m; it.c = m.c; syncItems(); } break; }
    case 'style': if (STYLES[m.k] && m.k !== state.style) { state.style = m.k; applyStyle(); syncItems(); } break;
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
wallsFull.visible = ceiling.visible = true; try { renderer.compile(scene, camera); } catch (e) { /* 忽略 */ } applyMode();
if (quality === 2) setTimeout(() => { try { resize(); if (!composer) setupComposer(); composer.render(); invalidate(2); } catch (e) { /* 忽略 */ } }, 300);
queueWarm();
requestAnimationFrame(frame);
window.__app = { state, tour, joy, onMsg, show, view, goal, warm, useUnit, tvVideo };   // 給測試用
