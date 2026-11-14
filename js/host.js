// 大螢幕（電腦）端：3D 場景、遊戲流程、手機連線
import * as THREE from 'three';
import { RoomEnvironment } from '../vendor/RoomEnvironment.js';
import { PLAN, UNIT, UNITS, setUnit, roomAt, setCuts, cutRects } from './plan.js?v=20261114w';
import { getItem, STYLES, FLOORS, WALL_GROUPS, parseWall, FINISH, finishOf, lenRange, elevRange, wallSegs, doorGap, resolvePeople, keepOffBeds } from './catalog.js?v=20261114w';
import { buildItem, buildPerson, M } from './models.js?v=20261114w';
import * as MT from './mats.js?v=20261114w';
import { EffectComposer } from '../vendor/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from '../vendor/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from '../vendor/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from '../vendor/jsm/postprocessing/OutputPass.js';
MT.setTexSize(512);

const $ = (id) => document.getElementById(id);
const cm = 0.01;

// ================= 狀態 =================
const state = { vrot: 0, style: 'nordic', floor: null, floors: {}, wall: null, walls: {}, cut: [], mode: 'overview', tourBy: null, items: PLAN.defaults.map((d) => ({ ...d })) };
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
  return floorMatOf(state.floor);
}
const roomFloors = new THREE.Group();
function applyRoomFloors() {   // 個別區域的地板：疊一層薄薄的在原地板上方 2mm
  for (const m of roomFloors.children) m.geometry.dispose(); roomFloors.clear();
  for (const q of PLAN.rooms) { const k = state.floors[q.id]; if (FLOORS[k]) for (const [a, b, c, d] of q.rs) { const m = floorMesh(a, b, c, d, floorMatOf(k), 1.6); m.position.y = 0.002; roomFloors.add(m); } }
  if (roomFloors.parent !== scene) scene.add(roomFloors);
}
function floorMatOf(key) {
  const f = FLOORS[key], st = STYLES[state.style];
  if (!f) return st.floor === 'marble' ? MT.tiles(st.floorC, 2, true) : MT.floorWood(st.floorC);
  if (f.k === 'strip') return MT.stripTile(f.c);
  return f.k === 'terrazzo' ? MT.terrazzo(f.c) : f.k === 'tile' ? MT.tiles(f.c, 2, false, 0.35) : f.k === 'stone' ? MT.stoneTile(f.c, 4) : f.k === 'carpet' ? MT.carpet(f.c) : MT.floorWood(f.c);
}
// ---- 牆面材質：跟地板一樣，可以「全戶」或每個區域分開選。做法是在牆面朝向該區域的那一面，貼一層薄薄的面材 ----
// 全戶的設定不套到浴室和陽台；區域單獨設定的話，浴室陽台也可以換
const UP = new THREE.Vector3(0, 1, 0), linings = [];
function wallKeyAt(x, y) {
  const q = roomAt(x, y, 4);
  if (q && state.walls[q.id]) return state.walls[q.id];
  if (!state.wall) return null;
  if (q) return q.id.startsWith('bath') || q.id.startsWith('balc') ? null : state.wall;
  const f = PLAN.floors.find(([a, b, c, d]) => x >= a && x <= c && y >= b && y <= d);   // 不屬於任何區域、但在室內（走道）
  return f && f[4] !== 'bath' && f[4] !== 'balc' ? state.wall : null;
}
function applyWallFinishes() {
  for (const m of linings) { m.removeFromParent(); m.geometry.dispose(); } linings.length = 0;
  if (!wallsFull || (!state.wall && !Object.keys(state.walls).length)) return;
  const quads = new Map();   // 材質鍵 → { full: [], cut: [] }
  const add = (key, N, P0, s0, s1, z0, z1) => { const e = quads.get(key) || { full: [], cut: [] }; quads.set(key, e); e.full.push([N, P0, s0, s1, z0, z1]); if (z0 < CUT) e.cut.push([N, P0, s0, s1, z0, Math.min(z1, CUT)]); };
  for (const [x1, y1, x2, y2, z1, z2] of PLAN.walls) {
    // 四個面：法線方向、面上的固定座標、沿著面的範圍
    for (const [nx, ny, fx, fy, a0, a1, alongX] of [[0, -1, 0, y1, x1, x2, true], [0, 1, 0, y2, x1, x2, true], [-1, 0, x1, 0, y1, y2, false], [1, 0, x2, 0, y1, y2, false]]) {
      if (a1 - a0 < 25) continue;   // 牆的端面（門洞兩側）不貼
      let cur = null, start = a0;
      const flush = (end) => { if (cur) add(cur, [nx, ny], alongX ? fy : fx, start, end, z1, z2); };
      const steps = Math.ceil((a1 - a0) / 5);
      for (let i = 0; i <= steps; i++) { const t = Math.min(a0 + i * 5, a1), px = alongX ? t : fx + nx * 6, py = alongX ? fy + ny * 6 : t, k = t >= a1 ? null : wallKeyAt(px, py);
        if (k !== cur || t >= a1) { flush(t); cur = k; start = t; } }
    }
  }
  for (const [key, e] of quads) {
    const w = parseWall(key); if (!w) continue; const mat = MT.wallFinish(w.kind, w.color, w.matte), rep = mat.userData.repCm || 100;
    for (const [grp, list] of [[wallsFull, e.full], [wallsCut, e.cut]]) {
      if (!list.length) continue; const P = [], Nn = [], U = [];
      for (const [[nx, ny], f, s0, s1, z0, z1] of list) {   // 面在 x=f（或 y=f）往外 0.25 cm；T＝上 × 法線，讓三角形面向房間
        const N = new THREE.Vector3(nx, 0, ny), T = new THREE.Vector3().crossVectors(UP, N), off = f + (nx || ny) * 0.25;
        const pt = (a, z) => { const X = nx ? off : a, Y = nx ? a : off; return [X * cm, z * cm, Y * cm]; };
        const sgn = T.x + T.z, u = (a) => (a * sgn) / rep, v = (z) => z / rep;
        const A = sgn > 0 ? s0 : s1, B = sgn > 0 ? s1 : s0;   // 沿 T 方向由小到大
        const q = [[A, z0], [B, z0], [B, z1], [A, z0], [B, z1], [A, z1]];
        for (const [a, z] of q) { P.push(...pt(a, z)); Nn.push(nx, 0, ny); U.push(u(a), v(z)); }
      }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(Nn, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
      const mesh = new THREE.Mesh(geo, mat); mesh.receiveShadow = true; grp.add(mesh); linings.push(mesh);
    }
  }
  renderer.shadowMap.needsUpdate = true; invalidate(4);
}
function applyFloors() {   // 只換地板，不重做牆面
  invalidate(6); const fm = mainFloorMat(); for (const m of mainFloors) m.material = fm; applyRoomFloors();
}
// 手機連續點好幾個材質時，只套用最後一次（避免大螢幕連續重做而卡住）
const pendFx = new Set(); let pendT = 0;
function later(fn) { pendFx.add(fn); if (!pendT) pendT = setTimeout(() => { pendT = 0; const a = [...pendFx]; pendFx.clear(); for (const f of a) f(); }, 40); }
function applyStyle() {   // 換風格只換牆面和主地板的材質，不重建房子
  invalidate(6);
  const st = STYLES[state.style], wm = MT.wallPaint(st.wall), fm = mainFloorMat();
  for (const m of wallMeshes) m.material = wm; for (const m of mainFloors) m.material = fm; applyRoomFloors(); applyWallFinishes();
}
function buildShell() {
  setCuts(state.cut);   // 被拆掉的牆不蓋
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
  for (const i of state.cut) for (const [x1, y1, x2, y2] of cutRects(i)) { const f = floorMesh(x1, y1, x2, y2, floorMats.main[0], 1.6); f.position.y = -0.001; mainFloors.push(f); shell.add(f); }   // 拆掉的牆底下補地板
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
  // 門洞兩側的牆面（門框位置）上深咖啡色：門洞 = 上方有門楣、下方沒有牆的開口
  { const dm = new THREE.MeshStandardMaterial({ color: '#4A3324', roughness: 0.6 }), T = 3, E = 0.4;
    for (const [x1, y1, x2, y2, z1] of PLAN.walls) {
      if (z1 < 200 || PLAN.walls.some((w) => w[4] === 0 && w[0] < x2 - 1 && w[2] > x1 + 1 && w[1] < y2 - 1 && w[3] > y1 + 1)) continue;   // 窗戶下方有矮牆，不算門
      const horiz = x2 - x1 > y2 - y1;
      for (const s of [0, 1]) { const bx = horiz ? (s ? [x2 - T, y1 - E, x2, y2 + E] : [x1, y1 - E, x1 + T, y2 + E]) : (s ? [x1 - E, y2 - T, x2 + E, y2] : [x1 - E, y1, x2 + E, y1 + T]);
        wbox(wallsFull, ...bx, 0, z1, dm, false); wbox(wallsCut, ...bx, 0, CUT + 0.5, dm, false); }
    } }
  // 天花板 + 嵌燈
  ceiling = new THREE.Group(); shell.add(ceiling);
  const ceilMat = new THREE.MeshStandardMaterial({ color: '#F7F5F1', roughness: 0.95 });
  for (const [x1, y1, x2, y2] of PLAN.slab) wbox(ceiling, x1, y1, x2, y2, PLAN.H, PLAN.H + 12, ceilMat);
  const dl = M('emit', '#FFF4E0');
  bulbs.children.forEach((p) => { if (!p.userData.on) return; const d = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.01, 20), dl); d.position.set(p.position.x, PLAN.H * cm - 0.004, p.position.z); ceiling.add(d); });
  applyRoomFloors(); applyWallFinishes(); applyMode();
}

// ================= 家具 =================
const furn = new THREE.Group(); scene.add(furn);
const caps = new THREE.Group(); scene.add(caps);
const CAP_T = new Set(['cab', 'shelf', 'fridge', 'tower', 'washer', 'built']), capGeo = new THREE.BoxGeometry(1, 0.004, 1);
const capMat = new THREE.MeshStandardMaterial({ color: '#E6E2DA', roughness: 0.9 });
function capFor(spec) {   // 高過剖切線的櫃類，在剖切高度蓋一片板子
  if (spec.t === 'wall') {   // 新增的牆：只在實心區段蓋上剖切面，門洞與拉門開口留空
    const g = new THREE.Group();
    for (const [a, b] of wallSegs(spec)) { const m = new THREE.Mesh(capGeo, capMat); m.scale.set((b - a) * cm, 1, spec.d * cm); m.position.set((a + b) / 2 * cm, CUT * cm + 0.008, 0); m.receiveShadow = true; g.add(m); }
    return g;
  }
  if (!CAP_T.has(spec.t) || spec.elev + spec.h <= CUT) return null;
  const m = new THREE.Mesh(capGeo, capMat); m.scale.set(spec.w * cm, 1, spec.d * cm); m.position.y = CUT * cm + 0.008;
  if (spec.v === 'dress') { m.scale.z = 6 * cm; m.position.z = (-spec.d / 2 + 3) * cm; }   // 化妝台與更衣區是開放的，只在背板蓋剖切面 m.receiveShadow = true;
  const g = new THREE.Group(); g.add(m); return g;
}
const objs = new Map();
// 電視影片：只在 3D 導覽時播放（靜音循環），鳥瞰時電視是黑的
const tvVideo = Object.assign(document.createElement('video'), { muted: true, loop: true, playsInline: true, preload: 'none' }); tvVideo.setAttribute('playsinline', ''); tvVideo.src = './media/tv.mp4?v=2';
const tvTex = new THREE.VideoTexture(tvVideo); tvTex.colorSpace = THREE.SRGBColorSpace;
const tvMat = new THREE.MeshBasicMaterial({ map: tvTex, toneMapped: false });
let screenPos = [];   // 屋裡每台電視螢幕的位置：沒有電視就不播；聲音大小看離最近的電視多遠
function setScreens(on) {
  screenPos = []; furn.updateMatrixWorld(true);
  furn.traverse((n) => { if (n.isMesh && n.userData.screen) { if (!n.userData.off) n.userData.off = n.material; n.material = on ? tvMat : n.userData.off; screenPos.push(n.getWorldPosition(new THREE.Vector3())); } });
  if (!screenPos.length) on = false;
  if (on) tvVideo.play().catch(() => { tvVideo.muted = true; tvVideo.play().catch(() => {}); }); else tvVideo.pause();   // 瀏覽器不准出聲時退回靜音播放
}
// 每一款家具只建一次模型，之後都用複製的（共用幾何與材質），換風格、搬動時就不會卡
const protos = new Map(), dblCache = new Map();
const dbl = (m) => { if (!dblCache.has(m)) { const c = m.clone(); c.side = THREE.DoubleSide; c.clippingPlanes = [CLIP]; c.clipShadows = true; dblCache.set(m, c); } return dblCache.get(m); };   // 影子也跟著切
function proto(sig, make, tall) {
  if (!protos.has(sig)) { const o = make(); if (tall) o.traverse((n) => { if (n.isMesh) n.material = Array.isArray(n.material) ? n.material.map(dbl) : dbl(n.material); }); protos.set(sig, o); }   // 玻璃、格柵這類本來就雙面的材質也要切
  return protos.get(sig).clone();
}
function sigOf(it, people, used) {
  const sk = it.st || state.style, spec = getItem(it.key, sk, it); if (!spec) return null;
  const pose = spec.t === 'person' ? people.get(it.id) : null, decor = !used.has(it.id);
  return { spec, sk, pose, decor, sig: pose ? it.key + '|' + pose.mode + '|' + (pose.seat || 0) : it.key + '@' + sk + (decor ? '' : '-') + (spec.fin ? '~' + spec.fin + spec.color : '') + (lenRange(spec) ? '~L' + spec.w : '') };
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
  if (state.mode === 'tour') setScreens(true);   // 導覽中新增／刪除電視：重新決定要不要播
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
function texJobs() {   // 所有地板、牆面材質的貼圖，閒置時分小段先畫好；手機點選時就能立刻換上
  const makers = [...Object.keys(FLOORS).map((k) => () => floorMatOf(k)), ...WALL_GROUPS.flatMap((g) => [g.k, ...(g.alt ? [g.alt[0]] : [])].flatMap((kind) => g.colors.map(([c]) => () => MT.wallFinish(kind, c, false))))];
  return makers.map((make) => () => { const job = MT.prepJob(make); if (!job) return null; return (function* () { yield* job; const m = make(); for (const t of [m.map, m.normalMap]) if (t) renderer.initTexture(t); })(); });
}
function queueWarm() {
  warm.unshift(...texJobs());
  for (const u of UNITS) if (u.plan !== PLAN) for (const d of u.plan.defaults) warm.push(() => warmProto(d.key, state.style));
  for (const sk of Object.keys(STYLES)) {
    if (sk === state.style) continue;
    const st = STYLES[sk];
    warm.push(() => MT.wallPaint(st.wall), () => (st.floor === 'marble' ? MT.tiles(st.floorC, 2, true) : MT.floorWood(st.floorC)));
    for (const d of PLAN.defaults) warm.push(() => warmProto(d.key, sk));
  }
  if (warming) return; warming = true;
  const busy = () => state.mode === 'tour' || camMoving || performance.now() - lastInput < 1200;
  let gen = null;
  const step = () => {
    if (gen) {   // 分段畫貼圖：每次最多 12 ms，手機傳來的操作不用等
      if (state.mode === 'tour' || camMoving) return setTimeout(step, 300);
      const t0 = performance.now(); try { while (performance.now() - t0 < 12) if (gen.next().done) { gen = null; break; } } catch (e) { gen = null; }
      return setTimeout(step, 16);
    }
    if (busy()) return setTimeout(step, 400); const f = warm.shift(); if (!f) { warming = false; return; }
    try { const r = f(); if (r && typeof r.next === 'function') gen = r; } catch (e) { /* 忽略 */ } setTimeout(step, gen ? 0 : 60);
  };
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
  if (screen !== 'play') { goal.tx = CX; goal.tz = CZ; goal.dist = fitDist(PLAN.W * cm, PLAN.D * cm) * 0.92; goal.el = 0.95; goal.az = 0; view.az += 2 * Math.PI * Math.round(-view.az / (2 * Math.PI)); return; }
  // 佈置時固定全戶鳥瞰；vrot：手機上平面圖順時針轉了幾個 90 度，鳥瞰跟著轉（0 = 房子的底邊和螢幕平行）
  const odd = state.vrot % 2 === 1; goal.el = 1.05; goal.tx = CX; goal.tz = CZ; goal.dist = odd ? fitDist(PLAN.D * cm, PLAN.W * cm) : fitDist(PLAN.W * cm, PLAN.D * cm); goal.az = state.vrot * Math.PI / 2;
  view.az += 2 * Math.PI * Math.round((goal.az - view.az) / (2 * Math.PI));   // 走最短的方向轉，不會繞一大圈
}
function applyMode() {
  invalidate(6);
  const t = state.mode === 'tour';
  if (wallsFull) { wallsFull.visible = t; wallsCut.visible = !t; ceiling.visible = t; }
  bulbs.children.forEach((p) => { p.intensity = t && p.userData.on ? BULB : 0; });
  caps.visible = !t;
  renderer.localClippingEnabled = !t; setScreens(t); if (!t) updateDoors(0, false);
  scene.background.copy(t ? BG_TOUR : BG_OVER);
  hemi.intensity = t ? 0.5 : 0.38; sun.intensity = t ? 5 : 2.5; scene.environmentIntensity = t ? 0.38 : 0.4;
  if (t) sun.position.set(CX - 1.5, 7, CZ - 13); else sun.position.set(CX - 5, 14, CZ + 6);
  camera.fov = t ? tourFov() : 34; applyOffset();
  const pr = t || lowRes ? 1 : BASE_PR; if (renderer.getPixelRatio() !== pr) { renderer.setPixelRatio(pr); resize(); }   // 導覽時用 1 倍解析度換流暢
  setGoal(); updateHud();
}

// 導覽時的碰撞（牆 + 較高的家具）
let colliders = [];
function buildColliders() {
  colliders = PLAN.walls.filter((w) => w[4] < 140 && w[5] > 25).map((w) => [w[0] * cm, w[1] * cm, w[2] * cm, w[3] * cm]);
  const d = PLAN.door; colliders.push([d[0] * cm, d[1] * cm, d[2] * cm, d[3] * cm]);
  for (const it of state.items) {
    const s = getItem(it.key, null, it); if (!s || s.h < 35 || s.elev > 0 || s.t === 'rug' || s.t === 'lamp' || s.t === 'person') continue;
    if (s.t !== 'wall' && s.h < 120) continue;   // 矮家具（沙發、床、桌椅、檯面）不擋路，鏡頭從上方經過；高櫃、牆、隔間才會擋
    if (s.t === 'wall') {   // 牆：每個實心區段一個碰撞盒，門洞與拉門開口可以走過去
      const k = it.r % 360, ax = k === 0 ? [1, 0] : k === 90 ? [0, 1] : k === 180 ? [-1, 0] : [0, -1], t = s.d / 2;
      const g = doorGap(s), seg = (a, b, ref) => { const p1 = [it.x + ax[0] * a, it.y + ax[1] * a], p2 = [it.x + ax[0] * b, it.y + ax[1] * b];
        colliders.push([(Math.min(p1[0], p2[0]) - (ax[0] ? 0 : t)) * cm, (Math.min(p1[1], p2[1]) - (ax[1] ? 0 : t)) * cm, (Math.max(p1[0], p2[0]) + (ax[0] ? 0 : t)) * cm, (Math.max(p1[1], p2[1]) + (ax[1] ? 0 : t)) * cm, ref]); };
      for (const [a, b] of wallSegs(s)) seg(a, b);
      if (g) seg(g[0], g[1], doorOf(it.id));   // 拉門開口：門開到八成以上才能走過去
      continue;
    }
    const rot = it.r % 180 !== 0, hw = (rot ? s.d : s.w) / 2 - 8, hd = (rot ? s.w : s.d) / 2 - 8;
    if (hw > 2 && hd > 2) colliders.push([(it.x - hw) * cm, (it.y - hd) * cm, (it.x + hw) * cm, (it.y + hd) * cm]);
  }
}
// ---- 拉門：3D 導覽時走到 1 公尺內，門扇用 1 秒滑開；走遠就關上。鳥瞰時一律關著 ----
const doorState = new Map(), DOOR_NEAR = 1.0, DOOR_SECS = 1.0;
function doorOf(id) { let d = doorState.get(id); if (!d) doorState.set(id, (d = { t: 0 })); return d; }
function leavesOf(e) { if (e.leafOf !== e.o) { e.leafOf = e.o; e.leaves = []; e.o.traverse((n) => { if (n.userData.leaf) e.leaves.push(n); }); } return e.leaves; }
function updateDoors(dt, on) {
  for (const it of state.items) {
    const e = objs.get(it.id); if (!e || !leavesOf(e).length) continue;
    const s = getItem(it.key, null, it), g = s && doorGap(s), d = doorOf(it.id); if (!g) continue;
    let want = 0;
    if (on) { const k = it.r % 360, ax = k === 0 ? [1, 0] : k === 90 ? [0, 1] : k === 180 ? [-1, 0] : [0, -1];
      const ax1 = (it.x + ax[0] * g[0]) * cm, az1 = (it.y + ax[1] * g[0]) * cm, ax2 = (it.x + ax[0] * g[1]) * cm, az2 = (it.y + ax[1] * g[1]) * cm;
      const vx = ax2 - ax1, vz = az2 - az1, u = Math.max(0, Math.min(1, ((tour.x - ax1) * vx + (tour.z - az1) * vz) / (vx * vx + vz * vz || 1)));
      want = Math.hypot(tour.x - (ax1 + vx * u), tour.z - (az1 + vz * u)) < DOOR_NEAR ? 1 : 0; }
    const nt = on ? (want ? Math.min(1, d.t + dt / DOOR_SECS) : Math.max(0, d.t - dt / DOOR_SECS)) : 0;
    if (nt === d.t && e.leafT === nt) continue; d.t = e.leafT = nt;
    const k2 = nt * nt * (3 - 2 * nt); for (const l of e.leaves) l.position.x = l.userData.leaf.x0 + l.userData.leaf.dx * k2;
  }
}
function collide(p) {
  const R = 0.14;   // 身體半徑：小一點，比較窄的空隙也過得去
  for (let k = 0; k < 2; k++) for (const [x1, z1, x2, z2, door] of colliders) {
    if (door && door.t > 0.8) continue;
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
// 3D 導覽固定左右視角 105°，上下視角依螢幕比例換算（16:9 約 72°）
const TOUR_HFOV = 105, tourFov = () => 2 * Math.atan(Math.tan(TOUR_HFOV * Math.PI / 360) / Math.max(0.5, camera.aspect)) * 180 / Math.PI;
function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== Math.floor(w * renderer.getPixelRatio()) || canvas.height !== Math.floor(h * renderer.getPixelRatio())) {
    renderer.setSize(w, h, false); if (composer) composer.setSize(canvas.width, canvas.height); camera.aspect = w / h; if (state.mode === 'tour') camera.fov = tourFov(); applyOffset(); setGoal(); invalidate(4);
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
  aoPass.normalMaterial.clippingPlanes = [CLIP];   // 接觸陰影也照切過的高度算，不然切掉的高牆還會留下一圈暗影
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
// ---- 點平面圖快速走過去：在 10 cm 的格子上找一條繞過牆和高家具的路，用 3 倍速走過去；手機搖桿一動就取消 ----
const GRID = 10, AUTO_SPEED = 3.75; let auto = null, lastTurn = 0, posT = 0, lastPos = '';
function walkGrid() {   // 每格能不能站（在室內、離牆和高家具 16 cm 以上）
  const W = Math.ceil(PLAN.W / GRID), H = Math.ceil(PLAN.D / GRID), ok = new Uint8Array(W * H), R = 0.16;
  const floors = [...PLAN.floors.map((f) => f.slice(0, 4)), ...state.cut.flatMap((i) => cutRects(i))];
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const xc = (i + 0.5) * GRID, yc = (j + 0.5) * GRID; if (!floors.some(([a, b, c, d]) => xc >= a && xc <= c && yc >= b && yc <= d)) continue;
    const x = xc * cm, z = yc * cm; let free = true;
    for (const [x1, z1, x2, z2, door] of colliders) { if (door) continue; const nx = Math.max(x1, Math.min(x, x2)), nz = Math.max(z1, Math.min(z, z2)); if ((x - nx) ** 2 + (z - nz) ** 2 < R * R) { free = false; break; } }
    ok[j * W + i] = free ? 1 : 0;
  }
  return { W, H, ok };
}
function nearestFree(G, i0) {   // 從某一格往外找最近可以站的格子
  if (G.ok[i0]) return i0; const seen = new Uint8Array(G.W * G.H), q = [i0]; seen[i0] = 1;
  for (let k = 0; k < q.length; k++) { const i = q[k], x = i % G.W, y = (i / G.W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= G.W || ny >= G.H) continue; const n = ny * G.W + nx; if (seen[n]) continue; if (G.ok[n]) return n; seen[n] = 1; q.push(n); } }
  return -1;
}
function findPath(sx, sz, tx, tz) {   // A*（八方向、不切牆角），再把看得到的點拉直
  const G = walkGrid(), cellOf = (x, z) => Math.min(G.H - 1, Math.max(0, Math.floor(z / cm / GRID))) * G.W + Math.min(G.W - 1, Math.max(0, Math.floor(x / cm / GRID)));
  const s = nearestFree(G, cellOf(sx, sz)), t = nearestFree(G, cellOf(tx, tz)); if (s < 0 || t < 0) return null;
  const N = G.W * G.H, gs = new Float32Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), done = new Uint8Array(N), heap = [];
  const hx = (i) => { const dx = Math.abs(i % G.W - t % G.W), dy = Math.abs(((i / G.W) | 0) - ((t / G.W) | 0)); return Math.max(dx, dy) + 0.414 * Math.min(dx, dy); };
  const push = (i, f) => { heap.push([f, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
  const pop = () => { const top = heap[0], end = heap.pop(); if (heap.length) { heap[0] = end; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
  gs[s] = 0; push(s, hx(s));
  while (heap.length) { const [, i] = pop(); if (done[i]) continue; done[i] = 1; if (i === t) break; const x = i % G.W, y = (i / G.W) | 0;
    for (const [dx, dy, c] of [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]]) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= G.W || ny >= G.H) continue; const n = ny * G.W + nx; if (!G.ok[n] || done[n]) continue;
      if (dx && dy && (!G.ok[y * G.W + nx] || !G.ok[ny * G.W + x])) continue;
      const g2 = gs[i] + c; if (g2 < gs[n]) { gs[n] = g2; from[n] = i; push(n, g2 + hx(n)); } } }
  if (!done[t]) return null;
  const cells = []; for (let i = t; i >= 0; i = from[i]) cells.push(i); cells.reverse();
  const P = cells.map((i) => [((i % G.W) + 0.5) * GRID * cm, (((i / G.W) | 0) + 0.5) * GRID * cm]); P[0] = [sx, sz];
  const see = (a, b) => { const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.ceil(L / 0.05); for (let k = 1; k < n; k++) { const x = a[0] + (b[0] - a[0]) * k / n, z = a[1] + (b[1] - a[1]) * k / n; if (!G.ok[cellOf(x, z)]) return false; } return true; };
  const out = [P[0]]; let k = 0; while (k < P.length - 1) { let j = P.length - 1; while (j > k + 1 && !see(P[k], P[j])) j--; out.push(P[j]); k = j; }
  return out;
}
function startAuto(x, y) {
  const pts = findPath(tour.x, tour.z, x * cm, y * cm); if (!pts || pts.length < 2) { auto = null; return; }
  auto = { pts, i: 1, tgt: [Math.round(pts[pts.length - 1][0] / cm), Math.round(pts[pts.length - 1][1] / cm)], best: Infinity, stuck: 0 }; posT = 0;
}
function stepAuto(dt, now) {   // 回傳這一格要走到的位置
  const wp = auto.pts[auto.i], dx = wp[0] - tour.x, dz = wp[1] - tour.z, d = Math.hypot(dx, dz);
  if (d < 0.06) { auto.i++; if (auto.i >= auto.pts.length) { auto = null; posT = 0; } return { x: tour.x, z: tour.z }; }
  const step = Math.min(d, AUTO_SPEED * dt);
  if (now - lastTurn > 700) { const want = Math.atan2(dz, dx); let dy = ((want - tour.yaw + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; tour.yaw += Math.max(-7 * dt, Math.min(7 * dt, dy)); }
  const rest = d + auto.pts.slice(auto.i + 1).reduce((s, p, k, a) => s + Math.hypot(p[0] - (k ? a[k - 1][0] : wp[0]), p[1] - (k ? a[k - 1][1] : wp[1])), 0);
  if (rest < auto.best - 0.01) { auto.best = rest; auto.stuck = 0; } else if ((auto.stuck += dt) > 1.5) auto = null;   // 卡住超過 1.5 秒就停
  return { x: tour.x + dx / d * step, z: tour.z + dz / d * step };
}
function sendPos(now) {   // 告訴導覽中的手機：目前位置、面向、是否正在自動走
  if (now - posT < 120) return; posT = now;
  const e = [...conns].find((q) => q.id === state.tourBy); if (!e) return;
  const m = { t: 'pos', x: Math.round(tour.x / cm), y: Math.round(tour.z / cm), yaw: Math.round(tour.yaw * 100) / 100, go: auto ? auto.tgt : 0 }, k = JSON.stringify(m);
  if (k !== lastPos || now - (sendPos.full || 0) > 1000) { lastPos = k; sendPos.full = now; send(e.conn, m); }
}
// ================= 下載我的設計：大螢幕拍兩張橫式圖（全戶鳥瞰／客廳・客餐廳・主臥），傳給手機 =================
const QR_IMG = new Image(); QR_IMG.src = './media/qr.png?v=1';
const FONT = '"Noto Sans TC","Microsoft JhengHei","PingFang TC","Heiti TC",sans-serif', DARKC = '#2F2B27', GOLDC = '#D8C3A5';
const DISC = '3D 畫面為示意，家具與裝潢非交屋附贈，實際以合約為準。', SHOT_HFOV = 108, EYE = 1.5;
// --- 自動挑拍攝位置：鏡頭水平、站在房間一端往深處拍、主要家具在畫面中間、看得到窗戶、靠近鏡頭的東西不要落在畫面邊緣 ---
function rayRect(x, z, dx, dz, r) {   // 射線打到矩形的距離（公尺），打不到回傳 Infinity
  let t0 = 0, t1 = Infinity;
  for (const [o, d, lo, hi] of [[x, dx, r[0], r[2]], [z, dz, r[1], r[3]]]) {
    if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) return Infinity; continue; }
    let a = (lo - o) / d, b = (hi - o) / d; if (a > b) [a, b] = [b, a]; t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) return Infinity;
  }
  return t0;
}
const rayHit = (x, z, ang, list, max = 12) => { const dx = Math.cos(ang), dz = Math.sin(ang); let best = max; for (const r of list) { const t = rayRect(x, z, dx, dz, r); if (t < best) best = t; } return best; };
const angDiff = (a, b) => ((a - b + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
function itemRects(minH) {   // 家具的平面範圍（公尺）
  const out = [];
  for (const it of state.items) {
    const s = getItem(it.key, null, it); if (!s || s.t === 'rug' || s.t === 'person' || s.h + s.elev < minH) continue;
    if (s.t === 'wall') { if (s.h < 150) { /* 矮隔間 */ } }
    const rot = it.r % 180 !== 0, hw = (rot ? s.d : s.w) / 2, hd = (rot ? s.w : s.d) / 2;
    out.push({ r: [(it.x - hw) * cm, (it.y - hd) * cm, (it.x + hw) * cm, (it.y + hd) * cm], s, it });
  }
  return out;
}
function pickShots() {
  const area = (q) => q.rs.reduce((s, [a, b, c, d]) => s + (c - a) * (d - b), 0), inRoom = (q, x, y) => q.rs.some(([a, b, c, d]) => x >= a && x <= c && y >= b && y <= d);
  const live = PLAN.rooms.find((q) => q.n.includes('客')) || [...PLAN.rooms].sort((a, b) => area(b) - area(a))[0];
  const beds = PLAN.rooms.filter((q) => q.n.includes('主臥') && !q.n.includes('衛')), master = [...(beds.length ? beds : PLAN.rooms.filter((q) => q.n.includes('臥') && !q.n.includes('衛')))].sort((a, b) => area(b) - area(a))[0];
  const block = [...PLAN.walls.filter((w) => w[4] <= EYE * 100 && w[5] >= EYE * 100).map((w) => [w[0] * cm, w[1] * cm, w[2] * cm, w[3] * cm]), ...itemRects(EYE * 100 + 5).map((o) => o.r)];   // 擋住視線的：牆、比眼睛高的家具
  const glass = PLAN.wins.map((w) => [Math.min(w[0], w[2]) * cm - 0.06, Math.min(w[1], w[3]) * cm - 0.06, Math.max(w[0], w[2]) * cm + 0.06, Math.max(w[1], w[3]) * cm + 0.06]);
  const sight = [...block, ...glass];   // 看出窗外不算「有深度」
  const near = [...sight, ...itemRects(40).map((o) => o.r)];   // 會在畫面邊緣被拉長的：上面那些＋矮家具
  const tall = itemRects(40);
  const find = (q, kinds) => { const c = tall.filter((o) => kinds.includes(o.s.t) || kinds.includes(o.s.cat)).filter((o) => inRoom(q, o.it.x, o.it.y)); return c.sort((a, b) => b.s.w * b.s.d - a.s.w * a.s.d)[0]; };
  function best(q, subj, avoid, hfov = SHOT_HFOV, back = null) {
    const half = hfov / 2 * Math.PI / 180;
    let top = null;
    const sx = subj ? subj.it.x * cm : null, sz = subj ? subj.it.y * cm : null;
    const wins = PLAN.wins.map((w) => [(w[0] + w[2]) / 2 * cm, (w[1] + w[3]) / 2 * cm]).filter(([wx, wz]) => q.rs.some(([a, b, c, d]) => wx >= a * cm - 1.2 && wx <= c * cm + 1.2 && wz >= b * cm - 1.2 && wz <= d * cm + 1.2));
    for (const [a, b, c, d] of q.rs) for (let x = a + 40; x <= c - 40; x += 25) for (let y = b + 40; y <= d - 40; y += 25) {
      const X = x * cm, Z = y * cm; if (near.some((r) => X > r[0] - 0.15 && X < r[2] + 0.15 && Z > r[1] - 0.15 && Z < r[3] + 0.15)) continue;   // 不站在家具裡
      for (let k = 0; k < 36; k++) {
        const yaw = k * Math.PI / 18; let depth = 0, edge = 0, n = 0, close = 0;
        for (let i = -9; i <= 9; i++) { const ang = yaw + i * half / 9;
          if (Math.abs(i) <= 6) { depth += Math.min(9, rayHit(X, Z, ang, sight)); n++; }
          const dn = rayHit(X, Z, ang, near, 3); if (Math.abs(i) >= 7) edge += Math.max(0, 1.4 - dn); if (dn < 0.6) close += 0.6 - dn; }
        let s = depth / n * 0.6 - edge * 3 - close * 4;
        if (subj) { const ds = Math.hypot(sx - X, sz - Z), off = Math.abs(angDiff(Math.atan2(sz - Z, sx - X), yaw)), vis = rayHit(X, Z, Math.atan2(sz - Z, sx - X), block) >= ds - 0.4;
          s += vis ? Math.max(0, 1 - off / 0.6) * 4 : -2; s += ds >= 2 && ds <= 6 ? 1 : -Math.min(2, Math.abs(ds - 4) / 2); }
        for (const [wx, wz] of wins) { const dw = Math.hypot(wx - X, wz - Z), aw = Math.atan2(wz - Z, wx - X); if (Math.abs(angDiff(aw, yaw)) < half * 0.85 && rayHit(X, Z, aw, block) >= dw - 0.25) { s += 1.5; break; } }
        if (avoid && Math.abs(angDiff(yaw, avoid.yaw)) < 0.7 && Math.hypot(X - avoid.x, Z - avoid.z) < 1.8) s -= 3;   // 第二張不要和第一張太像
        if (back) {   // 對角線反拍：站得離第一張遠、朝第一張的方向看，把第一張背後沒拍到的那半邊拍進來
          const db = Math.hypot(back.x - X, back.z - Z), ob = Math.abs(angDiff(Math.atan2(back.z - Z, back.x - X), yaw));
          s += Math.max(0, 1 - ob / 0.7) * 4 + Math.min(4, db) * 1.5 - Math.max(0, 2.5 - db) * 4;   // 至少離第一張 2.5 公尺 if (Math.abs(angDiff(yaw, back.yaw)) < Math.PI / 2) s -= 5;
        }
        if (!top || s > top.s) top = { s, x: X, z: Z, yaw };
      }
    }
    return top || { x: q.r ? (q.r[0] + q.r[2]) / 2 * cm : CX, z: q.r ? (q.r[1] + q.r[3]) / 2 * cm : CZ, yaw: 0 };
  }
  const a = best(live, find(live, ['sofa'])), b = best(live, null, null, SHOT_HFOV, a), c = best(master, find(master, ['bed']), null, SHOT_HFOV + 3);
  return [{ ...a, label: '客廳' }, { ...b, label: '客餐廳' }, { ...c, label: master.n.includes('主臥') ? '主臥' : master.n, hfov: SHOT_HFOV + 3 }];
}
// --- 2D 畫圖小工具 ---
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function photo(g, src, x, y, w, h, r, sx = 0, sy = 0, sw = src.width, sh = src.height) {
  const k = Math.max(w / sw, h / sh), cw = w / k, ch = h / k; g.save(); rr(g, x, y, w, h, r); g.clip(); g.drawImage(src, sx + (sw - cw) / 2, sy + (sh - ch) / 2, cw, ch, x, y, w, h); g.restore();
}
function tag(g, x, y, t, s = 26) { g.font = `700 ${s}px ${FONT}`; const w = g.measureText(t).width + 36; g.fillStyle = '#fff'; rr(g, x, y, w, s + 22, 17); g.fill(); g.fillStyle = DARKC; g.textBaseline = 'middle'; g.fillText(t, x + 18, y + 11 + s / 2 + 1); }
function txt(g, t, x, y, size, color, weight = 700, align = 'left') { g.font = `${weight} ${size}px ${FONT}`; g.fillStyle = color; g.textAlign = align; g.textBaseline = 'top'; g.fillText(t, x, y); g.textAlign = 'left'; }
const today = () => { const d = new Date(); return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`; };
function composeBird(src) {   // 第 1 張：鳥瞰放大，左上角是標題＋QR 的合併區塊
  const W = 1920, H = 1080, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const d = src.getContext('2d').getImageData(0, 0, src.width, src.height).data, bg = [d[8], d[9], d[10]]; let x0 = src.width, y0 = src.height, x1 = 0, y1 = 0;
  for (let y = 0; y < src.height; y += 2) for (let x = 0; x < src.width; x += 2) { const i = (y * src.width + x) * 4; if (Math.abs(d[i] - bg[0]) + Math.abs(d[i + 1] - bg[1]) + Math.abs(d[i + 2] - bg[2]) > 30) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
  const p = 20; x0 = Math.max(0, x0 - p); y0 = Math.max(0, y0 - p); x1 = Math.min(src.width, x1 + p); y1 = Math.min(src.height, y1 + p);
  g.fillStyle = `rgb(${bg})`; g.fillRect(0, 0, W, H);
  const BX = 540, k = Math.min((W - BX - 40) / (x1 - x0), (H - 60) / (y1 - y0)), bw = (x1 - x0) * k, bh = (y1 - y0) * k;
  g.drawImage(src, x0, y0, x1 - x0, y1 - y0, BX + (W - BX - 40 - bw) / 2, (H - bh) / 2, bw, bh);
  g.fillStyle = DARKC; rr(g, 40, 40, 460, 470, 26); g.fill();
  txt(g, UNIT.name + ' 戶', 72, 70, 26, GOLDC); txt(g, '我的家・設計成果', 72, 108, 46, '#fff'); txt(g, '全戶鳥瞰・' + today(), 72, 172, 22, '#BFB3A3', 400);
  g.fillStyle = '#fff'; rr(g, 72, 232, 190, 190, 14); g.fill(); if (QR_IMG.complete && QR_IMG.naturalWidth) g.drawImage(QR_IMG, 79, 239, 176, 176);
  txt(g, '掃描加入', 284, 262, 28, '#fff'); txt(g, 'LINE 預約賞屋', 284, 302, 28, '#fff'); txt(g, '專人為你介紹', 284, 352, 20, GOLDC, 400);
  txt(g, '3D 畫面為示意，家具與裝潢非交屋附贈，', 72, 444, 15, '#9E958A', 400); txt(g, '實際以合約為準。', 72, 466, 15, '#9E958A', 400);
  return c.toDataURL('image/jpeg', 0.9);
}
function composeRooms(ph, shots) {   // 第 2 張：客廳大圖＋客餐廳、主臥，下方一長條標題＋QR
  const W = 1920, H = 1080, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  g.fillStyle = '#F5F2ED'; g.fillRect(0, 0, W, H);
  photo(g, ph[0], 40, 40, 1220, 686, 24); tag(g, 60, 60, shots[0].label);
  photo(g, ph[1], 1280, 40, 600, 333, 22); tag(g, 1298, 58, shots[1].label, 24);
  photo(g, ph[2], 1280, 393, 600, 333, 22); tag(g, 1298, 411, shots[2].label, 24);
  const y = 746; g.fillStyle = DARKC; rr(g, 40, y, 1840, 294, 26); g.fill();
  txt(g, UNIT.name + ' 戶', 80, y + 52, 28, GOLDC); txt(g, '我的家・設計成果', 80, y + 94, 56, '#fff'); txt(g, shots.map((s) => s.label).join('・') + '・' + today(), 80, y + 172, 24, '#BFB3A3', 400);
  txt(g, DISC, 80, y + 236, 18, '#9E958A', 400);
  g.fillStyle = '#fff'; rr(g, 1610, y + 24, 246, 246, 16); g.fill(); if (QR_IMG.complete && QR_IMG.naturalWidth) g.drawImage(QR_IMG, 1618, y + 32, 230, 230);
  txt(g, '掃描加入', 1580, y + 84, 34, '#fff', 700, 'right'); txt(g, 'LINE 預約賞屋', 1580, y + 132, 34, '#fff', 700, 'right'); txt(g, '專人為你介紹', 1580, y + 188, 22, GOLDC, 400, 'right');
  return c.toDataURL('image/jpeg', 0.9);
}
let shooting = false, lastShots = null;   // 最近一次拍好的圖，手機重新連線後可以再來拿
function makeShots(entry, tok) {   // 拍照時暫時把畫布改成固定大小，一次拍完再還原（整個過程在同一個步驟內，大螢幕不會看到切換）
  if (shooting) return; shooting = true;
  const keep = { mode: state.mode, pos: camera.position.clone(), quat: camera.quaternion.clone(), fov: camera.fov, aspect: camera.aspect, pr: renderer.getPixelRatio() };
  const t0 = performance.now();
  try {
    const shots = pickShots();
    const grab = (w, h, setup, useComposer) => {
      renderer.setPixelRatio(1); renderer.setSize(w, h, false); camera.aspect = w / h; camera.clearViewOffset(); setup(); camera.updateProjectionMatrix(); renderer.shadowMap.needsUpdate = true;
      if (useComposer && quality === 2) { if (!composer) setupComposer(); composer.setSize(w, h); composer.render(); } else renderer.render(scene, camera);
      const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(renderer.domElement, 0, 0); return c;
    };
    state.mode = 'tour'; applyMode();
    const ph = shots.map((s) => grab(1600, 900, () => { camera.fov = 2 * Math.atan(Math.tan((s.hfov || SHOT_HFOV) * Math.PI / 360) / camera.aspect) * 180 / Math.PI; camera.position.set(s.x, EYE, s.z); camera.lookAt(s.x + Math.cos(s.yaw), EYE, s.z + Math.sin(s.yaw)); }));
    state.mode = 'overview'; applyMode();
    const bird = grab(2400, 1350, () => {
      camera.fov = 34; const el = 1.22, v = camera.fov * Math.PI / 360, hh = Math.atan(Math.tan(v) * camera.aspect), Wm = PLAN.W * cm, Dm = PLAN.D * cm;
      const dist = Math.max((Dm * Math.sin(el) + 1.9 * Math.cos(el)) / 2 / Math.tan(v), Wm / 2 / Math.tan(hh)) * 1.08 + 1.5;
      camera.position.set(CX, Math.sin(el) * dist, CZ + Math.cos(el) * dist); camera.lookAt(CX, 0.4, CZ);
    }, true);
    const imgs = [composeBird(bird), composeRooms(ph, shots)];
    const now = Date.now(); for (const q of conns) q.seen = now;   // 拍照時畫面停住，不要因此把手機當成斷線
    lastShots = { tok, imgs }; for (const q of conns) imgs.forEach((img, i) => send(q.conn, { t: 'shot', tok, i, n: imgs.length, img }));   // 手機拍照期間可能重新連線，所以每支手機都送，手機只收自己要的那一份
    console.info('design shots', Math.round(performance.now() - t0), 'ms', imgs.map((u) => Math.round(u.length / 1024) + 'KB').join(' '));
  } catch (e) { console.error(e); for (const q of conns) send(q.conn, { t: 'shot', tok, err: String(e && e.message || e) }); }
  finally {
    state.mode = keep.mode; renderer.setPixelRatio(keep.pr); renderer.setSize(canvas.clientWidth, canvas.clientHeight, false); if (composer) composer.setSize(canvas.width, canvas.height);
    camera.aspect = keep.aspect; camera.fov = keep.fov; camera.position.copy(keep.pos); camera.quaternion.copy(keep.quat); applyMode(); renderer.shadowMap.needsUpdate = true; invalidate(6); shooting = false;
  }
}
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  resize();
  if (state.mode === 'tour' && screen === 'play') {
    let f = 0, s = 0, t = 0, p = 0;
    for (const j of joy.values()) { f += j.f; s += j.s; t += j.t; p += j.p; }
    const cl = (v) => Math.max(-1, Math.min(1, v)); f = cl(f); s = cl(s); t = cl(t); p = cl(p);
    if (Math.abs(t) > 0.05) lastTurn = now;
    if (auto && Math.abs(f) + Math.abs(s) > 0.15) { auto = null; posT = 0; }   // 自己動搖桿就取消自動走
    tour.yaw += t * 1.25 * dt; tour.pitch = Math.max(-0.5, Math.min(0.4, tour.pitch + p * 0.75 * dt));   // 轉頭、抬頭低頭、走路都比之前慢約 15%
    let dx = Math.cos(tour.yaw), dz = Math.sin(tour.yaw), sp = 1.25 * dt;
    const np = auto ? stepAuto(dt, now) : { x: tour.x + (dx * f - dz * s) * sp, z: tour.z + (dz * f + dx * s) * sp };
    dx = Math.cos(tour.yaw); dz = Math.sin(tour.yaw);
    updateDoors(dt, true); collide(np); tour.x = np.x; tour.z = np.z; sendPos(now);
    camera.position.set(tour.x, 1.5, tour.z);
    if (screenPos.length && !tvVideo.muted) { let d = 99; for (const p of screenPos) d = Math.min(d, Math.hypot(p.x - tour.x, p.z - tour.z)); tvVideo.volume = Math.max(0, Math.min(1, 1 - (d - 2) / 6)); }   // 離電視 2 公尺內最大聲，8 公尺外聽不到
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
  CX = PLAN.W * cm / 2; CZ = PLAN.D * cm / 2; sun.target.position.set(CX, 0, CZ); state.vrot = 0;
  Object.assign(view, { tx: CX, tz: CZ }); Object.assign(tour, { x: PLAN.start[0] * cm, z: PLAN.start[1] * cm, yaw: PLAN.yaw ?? Math.PI, pitch: -0.04 });
  for (const e of objs.values()) { furn.remove(e.o); if (e.cap) caps.remove(e.cap); } objs.clear();
  state.items = PLAN.defaults.map((d) => ({ ...d })); state.floors = {}; state.walls = {}; state.cut = [];
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
function snapshot(e) { return { t: 'state', unit: UNIT.id, unitName: UNIT.name, style: state.style, floor: state.floor, floors: state.floors, wall: state.wall, walls: state.walls, cut: state.cut, mode: state.mode, tourBy: state.tourBy, you: e.id, items: state.items, ready: screen === 'play', players: conns.size, vrot: state.vrot }; }
let bTimer = null;
function broadcast() { if (bTimer) return; bTimer = setTimeout(() => { bTimer = null; for (const e of conns) send(e.conn, snapshot(e)); updateHud(); }, 60); }

let peerReady = false;
function startPeer(code) {
  if (typeof Peer === 'undefined') { setNet('無法載入連線元件，請檢查網路後重新整理', false); return; }
  roomCode = code || makeCode();
  setNet('正在連線配對伺服器…');
  peer = new Peer('myhome-a1-' + roomCode.toLowerCase());
  peer.on('open', () => { peerReady = true; setNet('已就緒，可以掃碼加入', true); showQR(); });
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
    if (err.type === 'unavailable-id') { const keep = peerReady; peer.destroy(); setTimeout(() => startPeer(keep ? roomCode : null), keep ? 3000 : 0); return; }   // 重新登入時代碼還被占著：等一下用同一個代碼再試，手機才不會找不到房間
    if (['network', 'server-error', 'socket-error', 'socket-closed', 'browser-incompatible'].includes(err.type)) setNet('連不上配對伺服器（' + err.type + '），可能被網路擋住', false);
  });
}
function endTour() { auto = null; state.mode = 'overview'; state.tourBy = null; joy.clear(); applyMode(); }
// 同一支手機（cid 相同）重新連線：接手舊連線，導覽主控權也一起轉過來
const lostTour = { cid: null, id: null };
function claim(entry, cid) {
  if (!cid) return; entry.cid = String(cid).slice(0, 20);
  for (const o of [...conns]) if (o !== entry && o.cid === entry.cid) { if (state.tourBy === o.id) state.tourBy = entry.id; joy.delete(o); conns.delete(o); try { o.conn.close(); } catch (e) { /* 忽略 */ } }
  if (lostTour.cid === entry.cid && state.tourBy === lostTour.id) state.tourBy = entry.id;
  lostTour.cid = null;
}
function drop(entry) {
  if (!conns.delete(entry)) return; joy.delete(entry); try { entry.conn.close(); } catch (e) { /* 忽略 */ }
  if (state.tourBy === entry.id) {   // 導覽中的手機斷線：等 15 秒，它重新連上就繼續導覽，不然才結束
    if (entry.cid) { lostTour.cid = entry.cid; lostTour.id = entry.id; setTimeout(() => { if (state.tourBy === entry.id) endTour(); broadcast(); }, 15000); } else endTour();
  }
  broadcast();
}
setInterval(() => { const now = Date.now(); for (const e of [...conns]) if (now - e.seen > 15000) drop(e); }, 1000);   // 手機每 2 秒會送心跳，15 秒沒聲音就是斷了

const num = (v, lo, hi) => Math.max(lo, Math.min(hi, Number(v) || 0));
function onMsg(entry, m) {
  if (!m || typeof m !== 'object') return;
  if (m.t === 'hello') { claim(entry, m.cid); send(entry.conn, snapshot(entry)); broadcast(); return; }
  if (m.t === 'ping') { if (m.cid && !entry.cid) { claim(entry, m.cid); broadcast(); } send(entry.conn, { t: 'pong' }); return; }
  if (screen !== 'play') return;
  if (m.t !== 'joy' && m.t !== 'look') lastInput = performance.now();   // 有人在操作時，背景的模型準備先暫停
  const find = (id) => state.items.find((i) => i.id === id);
  if (m.t === 'joy') { if (m.n !== undefined) { if (m.n < (entry.jn || 0)) return; entry.jn = m.n; } if (state.mode === 'tour' && state.tourBy === entry.id) joy.set(entry, { f: num(m.f, -1, 1), s: num(m.s, -1, 1), t: num(m.tn, -1, 1), p: num(m.p, -1, 1) }); return; }
  if (m.t === 'vrot') { state.vrot = ((Math.round(+m.r || 0) % 4) + 4) % 4; setGoal(); invalidate(4); broadcast(); return; }   // 手機旋轉平面圖／回到預設視角
  if (m.t === 'shotget') { if (lastShots && lastShots.tok === m.tok) lastShots.imgs.forEach((img, i) => send(entry.conn, { t: 'shot', tok: m.tok, i, n: lastShots.imgs.length, img })); return; }
  if (m.t === 'shot') { const tok = String(m.tok || '').slice(0, 20); if (screen === 'play') setTimeout(() => makeShots(entry, tok), 30); else send(entry.conn, { t: 'shot', tok, err: 'not-ready' }); return; }
  if (m.t === 'goto') { if (state.mode === 'tour' && state.tourBy === entry.id) startAuto(num(m.x, 0, PLAN.W), num(m.y, 0, PLAN.D)); return; }
  if (m.t === 'look') { if (state.mode === 'tour' && state.tourBy === entry.id) { lastTurn = performance.now(); tour.yaw += num(m.dx, -2, 2); tour.pitch = Math.max(-0.6, Math.min(0.5, tour.pitch + num(m.dy, -1, 1))); } return; }
  if (m.t === 'tour') {
    if (m.on && state.mode !== 'tour') {
      state.mode = 'tour'; state.tourBy = entry.id;
      Object.assign(tour, { x: PLAN.start[0] * cm, z: PLAN.start[1] * cm, yaw: PLAN.yaw ?? Math.PI, pitch: -0.04 }); buildColliders(); joy.clear(); applyMode();
    } else if (!m.on && state.tourBy === entry.id) endTour();
    return broadcast();
  }
  if (state.mode === 'tour') return send(entry.conn, snapshot(entry));   // 有人在導覽時，暫停所有編輯
  switch (m.t) {
    case 'wallf': { const k = parseWall(m.k) ? m.k : null;   // 牆面材質（全戶或單一區域）
      if (m.room) { if (!PLAN.rooms.some((q) => q.id === m.room)) break; if (k) state.walls[m.room] = k; else delete state.walls[m.room]; }
      else { state.wall = k; state.walls = {}; }
      later(applyWallFinishes); break; }
    case 'floor': { const k = FLOORS[m.k] ? m.k : null;
      if (m.room) { if (!PLAN.rooms.some((q) => q.id === m.room)) break; if (k) state.floors[m.room] = k; else delete state.floors[m.room]; }
      else { state.floor = k; state.floors = {}; }   // 選「全戶」會蓋掉各區域的設定
      later(applyFloors); break; }
    case 'fin': { const it = find(m.id), f = it && FINISH[finishOf(getItem(it.key))];
      if (f && f.mats.some((x) => x[0] === m.m) && f.colors.some((x) => x[0] === m.c)) { it.m = m.m; it.c = m.c; syncItems(); } break; }
    case 'style': if (STYLES[m.k] && m.k !== state.style) { state.style = m.k; applyStyle(); syncItems(); } break;
    case 'move': { const it = find(m.id); if (it) { it.x = num(m.x, 0, PLAN.W); it.y = num(m.y, 0, PLAN.D); syncItems(); } break; }
    case 'cut': { const i = m.i | 0; if (!(PLAN.cuts || [])[i]) break;   // 拆牆／復原牆
      state.cut = state.cut.filter((k) => k !== i); if (m.on) state.cut.push(i); buildShell(); invalidate(); break; }
    case 'len': { const it = find(m.id), R = it && lenRange(getItem(it.key)); if (R) { it.len = Math.round(num(m.len, R.min, R.max) / R.step) * R.step; syncItems(); } break; }
    case 'elev': { const it = find(m.id), s = it && getItem(it.key, null, it), R = elevRange(s); if (R) { it.el = Math.round(num(m.el, R.min, R.max) / R.step) * R.step; syncItems(); } break; }
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
    case 'reset': state.items = PLAN.defaults.map((d) => ({ ...d })); if (state.cut.length) { state.cut = []; buildShell(); } syncItems(); break;
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
window.__app = { state, tour, joy, onMsg, show, view, goal, warm, useUnit, tvVideo, doorState, cols: () => colliders, pickShots, screens: () => screenPos.length };   // 給測試用
