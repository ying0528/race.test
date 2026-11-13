// 擬真材質：用程式產生顏色貼圖與法線貼圖（布料織紋、木紋毛孔、地板溝縫、石紋、磁磚、地毯絨毛）
import * as THREE from 'three';
let SIZE = 512;
export function setTexSize(n) { SIZE = n; }
const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
function vnoise(x, y) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
export function fbm(x, y, o = 4) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { s += a * vnoise(x * f, y * f); a *= 0.5; f *= 2.03; } return s; }
const gcache = new Map(), mc = new Map(), memo = (k, f) => (mc.has(k) ? mc.get(k) : (mc.set(k, f()), mc.get(k)));
// fn(x, y, S) -> [高度 0..1, 明暗倍率, 暖色偏移]
function maps(key, base, fn, nStrength, rep = 1, size = SIZE) {
  const k = key + base;
  if (!gcache.has(k)) {
    const S = size, H = new Float32Array(S * S), cv = document.createElement('canvas'), nv = document.createElement('canvas'); cv.width = cv.height = nv.width = nv.height = S;
    const g = cv.getContext('2d'), im = g.createImageData(S, S), d = im.data, c = new THREE.Color(base), b = [c.r, c.g, c.b].map((v) => Math.pow(v, 1 / 2.2));
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const r = fn(x, y, S), t = r[1], warm = r[2] || 0, i = (y * S + x) * 4; H[y * S + x] = r[0]; if (r[3] !== undefined) { d[i] = d[i + 1] = d[i + 2] = 255 * r[3]; d[i + 3] = 255; continue; } d[i] = 255 * Math.min(1, b[0] * t * (1 + warm)); d[i + 1] = 255 * Math.min(1, b[1] * t); d[i + 2] = 255 * Math.min(1, b[2] * t * (1 - warm)); d[i + 3] = 255; }
    g.putImageData(im, 0, 0);
    const ng = nv.getContext('2d'), nm = ng.createImageData(S, S), n = nm.data, at = (x, y) => H[((y + S) % S) * S + ((x + S) % S)], ns = nStrength * S / 1024;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const dx = (at(x + 1, y) - at(x - 1, y)) * ns, dy = (at(x, y + 1) - at(x, y - 1)) * ns, l = Math.hypot(dx, dy, 1), i = (y * S + x) * 4; n[i] = 255 * (0.5 - dx / l / 2); n[i + 1] = 255 * (0.5 + dy / l / 2); n[i + 2] = 255 * (0.5 + 1 / l / 2); n[i + 3] = 255; }
    ng.putImageData(nm, 0, 0); gcache.set(k, [cv, nv]);
  }
  const [cv, nv] = gcache.get(k), mk = (c, srgb) => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
  return { map: mk(cv, true), normalMap: mk(nv, false) };
}
const P = 8;
const FAB = {
  linen: (x, y) => { const cx = Math.floor(x / P), cy = Math.floor(y / P), u = (x % P) / P, v = (y % P) / P, over = (cx + cy) % 2, thick = 0.75 + 0.5 * vnoise(over ? x * 0.024 : cx * 3.1, over ? cy * 3.1 : y * 0.024);
    const h = (over ? Math.sin(Math.PI * v) * (0.75 + 0.25 * Math.sin(Math.PI * u)) : Math.sin(Math.PI * u) * (0.75 + 0.25 * Math.sin(Math.PI * v))) * thick; return [h, 0.86 + 0.16 * h + (fbm(x * 0.012, y * 0.012, 3) - 0.5) * 0.08]; },
  knit: (x, y) => { const u = (x % 16) / 16, row = Math.floor(x / 16), v = ((y + (row % 2) * 8) % 16) / 16, h = Math.sin(Math.PI * u) * (0.55 + 0.45 * Math.abs(Math.sin(Math.PI * (v + u * 0.5)))); return [h, 0.82 + 0.2 * h]; },
  flannel: (x, y) => { const h = fbm(x * 0.5, y * 0.5, 3); return [h, 0.93 + 0.12 * h + (fbm(x * 0.03, y * 0.03, 2) - 0.5) * 0.06]; },
  herring: (x, y) => { const c = 16, col = Math.floor(x / c), u = (((col % 2 ? y + x : y - x) % 8) + 8) % 8 / 8, e = Math.min(x % c, c - (x % c)) / 2, h = Math.sin(Math.PI * u) * Math.min(1, e); return [h, 0.8 + 0.26 * h]; },
  boucle: (x, y) => { const h = fbm(x * 0.18, y * 0.18, 3) * 0.6 + 0.4 * vnoise(x * 0.5, y * 0.5); return [h, 0.8 + 0.28 * h]; },
};
const woodFn = (rings, seed, warp = 2.4) => (x, y, S) => { const k = 1024 / S, X = x * k, Y = y * k, v = Y / 1024 * rings + fbm(X * 0.0022 + seed, Y * 0.011 + seed, 4) * warp, late = Math.pow(v - Math.floor(v), 4);
  const fiber = vnoise(X * 0.012 + seed, Y * 0.75), pore = vnoise(X * 0.05, Y * 1.9 + seed) > 0.78 ? 1 : 0; return [0.6 - 0.35 * late - 0.4 * pore * (0.4 + late), 1 - 0.2 * late + (fiber - 0.5) * 0.1 - 0.07 * pore, 0.03 * late]; };
const floorFn = (x, y, S) => { const pw = S / 8, pl = S / 2, row = Math.floor(y / pw), off = hash(row, 9) * pl, col = Math.floor((x + off) / pl), sd = hash(row, col) * 40, w = woodFn(2.4, sd)(x + sd * 31, (y % pw) * 3.2 + sd * 17, S);
  const xx = (x + off) % pl, ex = Math.min(xx, pl - xx), ey = Math.min(y % pw, pw - (y % pw)), groove = Math.min(1, Math.min(ex, ey) / (S / 460)); return [w[0] * 0.45 + 0.55 * groove, w[1] * (0.9 + 0.2 * hash(col, row)) * (0.72 + 0.28 * groove), w[2]]; };
const veins = (x, y, S) => { const k = 1024 / S, X = x * k, Y = y * k, n = fbm(X * 0.004, Y * 0.004, 4), v = Math.abs(Math.sin((X * 0.7 + Y) * 0.011 + n * 7)), v2 = Math.abs(Math.sin((X - Y * 0.6) * 0.02 + n * 11)); return 1 - 0.2 * Math.pow(1 - v, 14) - 0.1 * Math.pow(1 - v2, 22) + (n - 0.5) * 0.06; };
const marbleFn = (x, y, S) => [0.5, veins(x, y, S)];
const tilesFn = (nx, soft) => (x, y, S) => { const t = S / nx, ex = Math.min(x % t, t - (x % t)), ey = Math.min(y % t, t - (y % t)), g = Math.min(1, Math.min(ex, ey) / (S / 300)), id = hash(Math.floor(x / t), Math.floor(y / t)); return [g, (soft ? veins(x + id * 900, y + id * 500, S) : 0.97 + 0.05 * id + (fbm(x * 0.05, y * 0.05, 2) - 0.5) * 0.04) * (0.74 + 0.26 * g)]; };
// 彩色石紋：底色上散佈深、淺、暖色碎石（格點用 mod 包起來，貼圖可無縫重複）
const terrazzoFn = (x, y, S) => { const N = 44, g = S / N, cx = Math.floor(x / g), cy = Math.floor(y / g); let t = 1 + (fbm(x * 0.02, y * 0.02, 2) - 0.5) * 0.05, warm = 0, h = 0.5;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const ax = ((cx + i) % N + N) % N, ay = ((cy + j) % N + N) % N, k = hash(ax + 3, ay + 7); if (k < 0.45) continue;
    const px = (cx + i + 0.15 + 0.7 * hash(ax, ay)) * g, py = (cy + j + 0.15 + 0.7 * hash(ay + 11, ax)) * g, dx = x - px, dy = y - py, an = hash(ax + 5, ay) * 3.14, u = dx * Math.cos(an) + dy * Math.sin(an), v = -dx * Math.sin(an) + dy * Math.cos(an), r = g * (0.14 + 0.3 * hash(ax, ay + 9));
    if (u * u + v * v * 2.6 < r * r) { const q = hash(ax + 1, ay + 2); if (q < 0.4) t = 0.74; else if (q < 0.7) t = 1.1; else { t = 0.9; warm = 0.1; } h = 0.56; } }
  return [h, t, warm]; };
const stoneFn = (nx) => (x, y, S) => { const t = S / nx, ex = Math.min(x % t, t - (x % t)), ey = Math.min(y % t, t - (y % t)), g = Math.min(1, Math.min(ex, ey) / (S / 300)), id = hash(Math.floor(x / t), Math.floor(y / t)), n = fbm(x * 0.012 + id * 40, y * 0.012 + id * 70, 4), f = fbm(x * 0.09, y * 0.09, 3);
  return [g * (0.55 + 0.45 * f), (0.88 + 0.26 * n + (f - 0.5) * 0.08) * (0.7 + 0.3 * g)]; };
const loopFn = (x, y, S) => { const p = S / 96, u = (x % p) / p, row = Math.floor(x / p), v = ((y + (row % 2) * p / 2) % p) / p, h = Math.sin(Math.PI * u) * (0.5 + 0.5 * Math.abs(Math.sin(Math.PI * (v + u * 0.5)))); return [h, 0.72 + 0.4 * h + (hash(row, Math.floor(y / p)) - 0.5) * 0.08]; };
const plaster = (x, y) => { const h = fbm(x * 0.04, y * 0.04, 4); return [h, 0.97 + 0.05 * h]; };
const pile = (x, y, S) => { const h = vnoise(x * 0.9, y * 0.9) * 0.6 + fbm(x * 0.06, y * 0.06, 3) * 0.4, e = Math.min(x, S - x, y, S - y) / S, bx = e < 0.045 && e > 0.03; return [h, (0.84 + 0.24 * h) * (bx ? 0.8 : 1)]; };
const grainy = (x, y) => { const h = fbm(x * 0.35, y * 0.35, 3); return [h, 0.95 + 0.1 * h]; };

// ---- 牆面材質與長條磚（可無縫重複；有磚縫的材質，接縫剛好落在磚縫上） ----
const cl = (v) => Math.max(0, Math.min(1, v));
function pnoise(x, y, Px, Py) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), m = (a, P) => ((a % P) + P) % P;
  const a = hash(m(xi, Px), m(yi, Py)), b = hash(m(xi + 1, Px), m(yi, Py)), c = hash(m(xi, Px), m(yi + 1, Py)), d = hash(m(xi + 1, Px), m(yi + 1, Py)); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
// 週期性 fbm：u、v 是 0~1 的貼圖座標，P 是格數，結果左右上下可以無縫接起來
function pfbm(u, v, o, Px, Py = Px) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { s += a * pnoise(u * Px * f, v * Py * f, Px * f, Py * f); a *= 0.5; f *= 2; } return s; }
const grout = (x, y, tw, th, S, w = 1.4) => { const ex = Math.min(x % tw, tw - (x % tw)), ey = Math.min(y % th, th - (y % th)); return Math.min(1, Math.min(ex, ey) / (S / 1024 * w)); };
const WALL = {
  // 潘朵拉白大板磚：貼圖＝240×240 cm，磚 120×60；白底、黑色裂紋、深色團塊
  pandora: (x, y, S) => { const u = x / S, v = y / S, g = grout(x, y, S / 2, S / 4, S), id = hash(Math.floor(x / (S / 2)), Math.floor(y / (S / 4)));
    const w1 = pfbm(u, v, 5, 2), w2 = pfbm(u + 0.37, v + 0.21, 5, 3), line = (f, p) => Math.pow(1 - Math.abs(Math.sin(f * Math.PI)), p);   // 線條：沿固定方向、被雜訊扭曲的裂紋
    const c1 = line(u * 2 + v * 3 + w1 * 2.6, 70), c2 = line(u * 4 - v * 2 + w2 * 3.2, 90), c3 = line(-u * 3 + v * 6 + w1 * 4, 160), grain = pfbm(u, v, 3, 64);
    const blob = cl((pfbm(u + 0.5, v + 0.13, 5, 2) - 0.57) * 6) * (0.75 + 0.5 * pfbm(u, v + 0.3, 4, 12)), mid = cl((pfbm(u + 0.2, v + 0.7, 4, 3) - 0.5) * 3);
    const t = (1 - 0.06 * grain - 0.12 * mid - 0.78 * c1 - 0.6 * c2 - 0.35 * c3) * (1 - 0.8 * cl(blob));
    return g < 1 ? [0.2, 0, 0, 0.62] : [0.55 - 0.2 * (c1 + c2), cl(t), 0.18 * c1 * id]; },
  gold: (x, y, S) => { const u = x / S, v = y / S, j = Math.min(x % (S / 2), S / 2 - (x % (S / 2))) < S / 1024 * 0.8, cloud = pfbm(u, v, 5, 3), w = pfbm(u + 0.2, v, 4, 2), line = (f, p) => Math.pow(1 - Math.abs(Math.sin(f * Math.PI)), p);
    const band = Math.abs(((v - 0.55 + u * 0.42 + (w - 0.5) * 0.25) % 1 + 1) % 1 - 0.5) * 2, bw = 0.045 + 0.06 * pfbm(u, v + 0.4, 3, 4), core = cl((1 - band / bw) * 2.5), halo = cl(1 - band / (bw * 2.4)) - core;
    const fine = line(u * 1 + v * 2 + w * 2.2, 90), fine2 = line(u * 3 - v * 1 + w * 3, 140), mott = pfbm(u, v, 3, 32);
    const t = 1.02 - 0.06 * cloud - 0.32 * fine - 0.22 * fine2 - core * (0.42 + 0.18 * mott) - 0.1 * halo;
    return j ? [0.3, 0.86] : [0.5, cl(t), core * (0.5 + 0.2 * mott) + halo * 0.12 + fine * 0.05]; },
  // 礦物塗料（仿清水模／威尼斯灰泥）：雲狀深淺＋鏝刀刷痕
  stucco: (x, y, S) => { const u = x / S, v = y / S, cloud = pfbm(u, v, 5, 4), mask = cl((pfbm(u + 0.3, v, 3, 3) - 0.45) * 5);
    const sh = pnoise(u * 12, v * 90, 12, 90) * 0.6 + pnoise(u * 24, v * 180, 24, 180) * 0.4, sv = pnoise(u * 90, v * 12, 90, 12) * 0.6 + pnoise(u * 180, v * 24, 180, 24) * 0.4, sp = pnoise(u * 300, v * 300, 300, 300);
    const t = 0.9 + 0.2 * (cloud - 0.5) + 0.07 * ((sh - 0.5) * mask + (sv - 0.5) * (1 - mask)) + (sp > 0.82 ? 0.05 : 0); return [0.5 + 0.2 * (cloud - 0.5) + 0.1 * (sh * mask + sv * (1 - mask)), t]; },
  // 直紋木皮平板：貼圖＝120×120 cm，每片 60 寬，V 溝
  veneer: (x, y, S) => { const pw = S / 2, col = Math.floor(x / pw), sd = 7 + col * 13, xx = x % pw, ex = Math.min(xx, pw - xx), g = Math.min(1, ex / (S / 1024 * 1.6)), w = woodFn(16, sd, 0.3)(y, xx * 0.6 + sd * 40, S); return [w[0] * 0.5 + 0.5 * g, w[1] * (0.96 + 0.06 * hash(col, 3)) * (0.55 + 0.45 * g), w[2]]; },
  // 木格柵：貼圖＝120×120 cm，4.5 cm 寬的木條、間隔 2 cm 黑縫
  slat: (x, y, S) => { const pw = S / 18.46, col = Math.floor(x / pw), xx = x % pw, inGap = xx > pw * 0.69, sd = 3 + col * 7, w = woodFn(3, sd, 0.4)(y, xx * 1.4 + sd * 50, S), e = Math.min(xx, pw * 0.69 - xx) / (pw * 0.69), sh = Math.min(1, e * 6);
    return inGap ? [0, 0.18] : [0.35 + 0.65 * sh, w[1] * (0.93 + 0.1 * hash(col, 1)) * (0.75 + 0.25 * sh), w[2]]; },
  // 洞石：貼圖＝240×240 cm，磚 120×60；水平層理＋細長孔洞
  travertine: (x, y, S) => { const u = x / S, v = y / S, g = grout(x, y, S / 2, S / 4, S, 1.2), id = hash(Math.floor(x / (S / 2)), Math.floor(y / (S / 4))), w = pfbm(u, v, 4, 2);
    const band = Math.sin((v * 34 + w * 3 + id * 5) * Math.PI) * 0.5 + 0.5, pore = pnoise(u * 160, v * 900, 160, 900) > 0.88, n = pfbm(u, v, 3, 48);
    return g < 1 ? [0.2, 0, 0, 0.7] : [pore ? 0.2 : 0.55, cl((0.93 + 0.06 * band + 0.05 * (n - 0.5)) * (pore ? 0.72 : 1) * (0.96 + 0.06 * id)), 0.04 * band]; },
  // 清水模板：貼圖＝240×240 cm，板 120×60，淡淡板縫、每片兩個螺桿孔、水漬
  concrete: (x, y, S) => { const u = x / S, v = y / S, tw = S / 2, th = S / 4, ex = Math.min(x % tw, tw - (x % tw)), ey = Math.min(y % th, th - (y % th)), seam = Math.min(ex, ey) < S / 1024 * 0.9;
    const lx = (x % tw) / tw, ly = (y % th) / th, hole = Math.min(Math.hypot((lx - 0.25) * 2, (ly - 0.5)), Math.hypot((lx - 0.75) * 2, (ly - 0.5))) * th, hr = S / 1024 * 6;
    const cloud = pfbm(u, v, 5, 4), stain = cl((pfbm(u + 0.1, v * 0.5, 4, 3, 2) - 0.55) * 4), pin = pnoise(u * 400, v * 400, 400, 400) > 0.9;
    let t = 0.95 + 0.14 * (cloud - 0.5) - 0.08 * stain - (pin ? 0.08 : 0); if (seam) t *= 0.88; if (hole < hr) t *= 0.45; else if (hole < hr * 1.6) t *= 1.06;
    return [hole < hr ? 0.1 : seam ? 0.35 : 0.5 + 0.1 * (cloud - 0.5), cl(t)]; },
};
const WALL_REP = { pandora: 240, gold: 320, stucco: 300, veneer: 120, slat: 120, travertine: 240, concrete: 240 };   // 一張貼圖代表幾公分
const WALL_ROUGH = { pandora: 0.16, gold: 0.12, stucco: 0.8, veneer: 0.55, slat: 0.6, travertine: 0.24, concrete: 0.85 };
// kind：上面七種；color：底色；matte：石材改霧面
export const wallFinish = (kind, color, matte = false) => memo('wf' + kind + color + matte, () => {
  const m = new THREE.MeshStandardMaterial(Object.assign(maps('wf-' + kind, color, WALL[kind], kind === 'slat' ? 6 : kind === 'veneer' ? 2.4 : 1.6, 1, Math.max(SIZE, 1024)), { roughness: matte && WALL_ROUGH[kind] < 0.5 ? 0.6 : WALL_ROUGH[kind] }));
  m.userData.repCm = WALL_REP[kind]; return m; });
// 長條磚地板：貼圖＝120×120 cm，60×7.5 cm 長條、直排；每塊深淺不一、白色磚縫
const stripFn = (x, y, S) => { const tw = S / 2, th = S / 16, col = Math.floor(x / tw), off = col % 2 ? th * 0.18 : 0, row = Math.floor((y + off) / th), g = grout(x, y + off, tw, th, S, 1.6), id = hash(col * 31 + row, row);
  const u = x / S, v = y / S, n = pfbm(u, v, 4, 6), m = pfbm(u + id, v, 3, 24); return g < 1 ? [0.15, 0, 0, 0.8] : [0.55 + 0.1 * (m - 0.5), cl((0.78 + 0.4 * id) * (0.94 + 0.12 * (n - 0.5)) * (0.97 + 0.06 * m)), (id - 0.5) * 0.12]; };
export const stripTile = (color) => memo('sb' + color, () => { const m = new THREE.MeshStandardMaterial(Object.assign(maps('strip', color, stripFn, 1.8, 160 / 120, Math.max(SIZE, 1024)), { roughness: 0.7 })); m.userData.repCm = 160; return m; });

const V2 = (a) => new THREE.Vector2(a, a);
export const fabric = (color, rep = 4, kind = 'linen') => memo('f' + kind + color + rep, () => new THREE.MeshStandardMaterial(Object.assign(maps(kind, color, FAB[kind], kind === 'linen' ? 4.4 : 6, rep), { roughness: 0.9, normalScale: V2(0.9) })));
export const leather = (color) => memo('l' + color, () => new THREE.MeshStandardMaterial(Object.assign(maps('leather', color, grainy, 3, 4), { roughness: 0.38, normalScale: V2(0.35) })));
const vertical = (v, m) => { if (v) for (const t of [m.map, m.normalMap]) { t.center.set(0.5, 0.5); t.rotation = Math.PI / 2; } return m; };
export const wood = (color, { rings = 9, gloss = 0.25, warp = 2.4, vert = false } = {}) => memo('w' + color + rings + gloss + warp + vert, () => vertical(vert, new THREE.MeshStandardMaterial(Object.assign(maps('wood' + rings + warp, color, woodFn(rings, new THREE.Color(color).r * 50, warp), 2.2), { roughness: 0.5 - gloss * 0.35, normalScale: V2(0.5) }))));
export const marble = (color) => memo('mb' + color, () => new THREE.MeshStandardMaterial({ map: maps('marble', color, marbleFn, 0).map, roughness: 0.14 }));
export const floorWood = (color) => memo('fw' + color, () => new THREE.MeshStandardMaterial(Object.assign(maps('floor', color, floorFn, 2.5, 1, Math.max(SIZE, 1024)), { roughness: 0.36 })));
export const tiles = (color, nx = 2, soft = false, rough = 0.3) => memo('tl' + color + nx + soft, () => new THREE.MeshStandardMaterial(Object.assign(maps('tile' + nx + soft, color, tilesFn(nx, soft), 2.2), { roughness: soft ? Math.min(rough, 0.16) : rough * 0.8 })));
export const terrazzo = (color) => memo('tz' + color, () => new THREE.MeshStandardMaterial(Object.assign(maps('terrazzo', color, terrazzoFn, 0.6, 1, Math.max(SIZE, 1024)), { roughness: 0.3 })));
export const stoneTile = (color, nx = 2) => memo('st' + color + nx, () => new THREE.MeshStandardMaterial(Object.assign(maps('stone' + nx, color, stoneFn(nx), 2.4, 1, Math.max(SIZE, 1024)), { roughness: 0.62 })));
export const carpet = (color) => memo('cp' + color, () => new THREE.MeshStandardMaterial(Object.assign(maps('loop', color, loopFn, 5, 1, Math.max(SIZE, 1024)), { roughness: 1 })));
export const wallPaint = (color) => memo('wl' + color, () => new THREE.MeshStandardMaterial(Object.assign(maps('plaster', color, plaster, 0.7, 3), { roughness: 0.95 })));
export const rugPile = (color) => memo('rg' + color, () => new THREE.MeshStandardMaterial(Object.assign(maps('pile', color, pile, 5), { roughness: 1 })));
export const ceramic = (color) => memo('c' + color, () => new THREE.MeshStandardMaterial({ color, roughness: 0.12 }));
export const metal = (color = '#2B2B2D', rough = 0.35) => memo('m' + color + rough, () => new THREE.MeshStandardMaterial({ color, metalness: 1, roughness: rough }));
export const flat = (color, rough = 0.62) => memo('p' + color + rough, () => new THREE.MeshStandardMaterial({ color, roughness: rough }));
export const gloss = (color) => memo('g' + color, () => new THREE.MeshStandardMaterial({ color, roughness: 0.14 }));
export const frost = () => memo('frost', () => new THREE.MeshStandardMaterial({ color: '#EEF3F2', roughness: 0.85, transparent: true, opacity: 0.8 }));
export const glass = (color) => memo('gl' + color, () => new THREE.MeshStandardMaterial({ color, roughness: 0.04, transparent: true, opacity: 0.22, depthWrite: false }));
export const emit = (color) => memo('e' + color, () => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9, roughness: 0.8 }));
export const mirror = () => memo('mirror', () => new THREE.MeshStandardMaterial({ color: '#E8EEF2', metalness: 1, roughness: 0.03 }));
