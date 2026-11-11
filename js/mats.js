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
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const r = fn(x, y, S), t = r[1], warm = r[2] || 0, i = (y * S + x) * 4; H[y * S + x] = r[0]; d[i] = 255 * Math.min(1, b[0] * t * (1 + warm)); d[i + 1] = 255 * Math.min(1, b[1] * t); d[i + 2] = 255 * Math.min(1, b[2] * t * (1 - warm)); d[i + 3] = 255; }
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
  boucle: (x, y) => { const h = fbm(x * 0.18, y * 0.18, 3) * 0.6 + 0.4 * vnoise(x * 0.5, y * 0.5); return [h, 0.8 + 0.28 * h]; },
};
const woodFn = (rings, seed) => (x, y, S) => { const k = 1024 / S, X = x * k, Y = y * k, v = Y / 1024 * rings + fbm(X * 0.0022 + seed, Y * 0.011 + seed, 4) * 2.4, late = Math.pow(v - Math.floor(v), 4);
  const fiber = vnoise(X * 0.012 + seed, Y * 0.75), pore = vnoise(X * 0.05, Y * 1.9 + seed) > 0.78 ? 1 : 0; return [0.6 - 0.35 * late - 0.4 * pore * (0.4 + late), 1 - 0.2 * late + (fiber - 0.5) * 0.1 - 0.07 * pore, 0.03 * late]; };
const floorFn = (x, y, S) => { const pw = S / 8, pl = S / 2, row = Math.floor(y / pw), off = hash(row, 9) * pl, col = Math.floor((x + off) / pl), sd = hash(row, col) * 40, w = woodFn(2.4, sd)(x + sd * 31, (y % pw) * 3.2 + sd * 17, S);
  const xx = (x + off) % pl, ex = Math.min(xx, pl - xx), ey = Math.min(y % pw, pw - (y % pw)), groove = Math.min(1, Math.min(ex, ey) / (S / 460)); return [w[0] * 0.45 + 0.55 * groove, w[1] * (0.9 + 0.2 * hash(col, row)) * (0.72 + 0.28 * groove), w[2]]; };
const veins = (x, y, S) => { const k = 1024 / S, X = x * k, Y = y * k, n = fbm(X * 0.004, Y * 0.004, 4), v = Math.abs(Math.sin((X * 0.7 + Y) * 0.011 + n * 7)), v2 = Math.abs(Math.sin((X - Y * 0.6) * 0.02 + n * 11)); return 1 - 0.2 * Math.pow(1 - v, 14) - 0.1 * Math.pow(1 - v2, 22) + (n - 0.5) * 0.06; };
const marbleFn = (x, y, S) => [0.5, veins(x, y, S)];
const tilesFn = (nx, soft) => (x, y, S) => { const t = S / nx, ex = Math.min(x % t, t - (x % t)), ey = Math.min(y % t, t - (y % t)), g = Math.min(1, Math.min(ex, ey) / (S / 300)), id = hash(Math.floor(x / t), Math.floor(y / t)); return [g, (soft ? veins(x + id * 900, y + id * 500, S) : 0.97 + 0.05 * id + (fbm(x * 0.05, y * 0.05, 2) - 0.5) * 0.04) * (0.74 + 0.26 * g)]; };
const plaster = (x, y) => { const h = fbm(x * 0.04, y * 0.04, 4); return [h, 0.97 + 0.05 * h]; };
const pile = (x, y, S) => { const h = vnoise(x * 0.9, y * 0.9) * 0.6 + fbm(x * 0.06, y * 0.06, 3) * 0.4, e = Math.min(x, S - x, y, S - y) / S, bx = e < 0.045 && e > 0.03; return [h, (0.84 + 0.24 * h) * (bx ? 0.8 : 1)]; };
const grainy = (x, y) => { const h = fbm(x * 0.35, y * 0.35, 3); return [h, 0.95 + 0.1 * h]; };

const V2 = (a) => new THREE.Vector2(a, a), white = new THREE.Color('#ffffff');
export const fabric = (color, rep = 4, kind = 'linen') => memo('f' + kind + color + rep, () => new THREE.MeshPhysicalMaterial(Object.assign(maps(kind, color, FAB[kind], kind === 'linen' ? 4.4 : 6, rep), { roughness: 0.92, sheen: 0.7, sheenRoughness: 0.55, sheenColor: new THREE.Color(color).lerp(white, 0.55), normalScale: V2(0.9) })));
export const leather = (color) => memo('l' + color, () => new THREE.MeshPhysicalMaterial(Object.assign(maps('leather', color, grainy, 3, 4), { roughness: 0.42, clearcoat: 0.3, clearcoatRoughness: 0.5, normalScale: V2(0.35) })));
export const wood = (color, { rings = 9, gloss = 0.25 } = {}) => memo('w' + color + rings + gloss, () => new THREE.MeshPhysicalMaterial(Object.assign(maps('wood' + rings, color, woodFn(rings, new THREE.Color(color).r * 50), 2.2), { roughness: 0.48, clearcoat: gloss, clearcoatRoughness: 0.4, normalScale: V2(0.5) })));
export const marble = (color) => memo('mb' + color, () => new THREE.MeshPhysicalMaterial(Object.assign({ map: maps('marble', color, marbleFn, 0).map }, { roughness: 0.2, clearcoat: 0.7, clearcoatRoughness: 0.1 })));
export const floorWood = (color) => memo('fw' + color, () => new THREE.MeshPhysicalMaterial(Object.assign(maps('floor', color, floorFn, 2.5, 1, Math.max(SIZE, 1024)), { roughness: 0.42, clearcoat: 0.25, clearcoatRoughness: 0.35 })));
export const tiles = (color, nx = 2, soft = false, rough = 0.3) => memo('tl' + color + nx + soft, () => new THREE.MeshPhysicalMaterial(Object.assign(maps('tile' + nx + soft, color, tilesFn(nx, soft), 2.2), { roughness: rough, clearcoat: soft ? 0.7 : 0.3, clearcoatRoughness: 0.15 })));
export const wallPaint = (color) => memo('wl' + color, () => new THREE.MeshStandardMaterial(Object.assign(maps('plaster', color, plaster, 0.7, 3), { roughness: 0.95 })));
export const rugPile = (color) => memo('rg' + color, () => new THREE.MeshPhysicalMaterial(Object.assign(maps('pile', color, pile, 5), { roughness: 1, sheen: 0.4, sheenRoughness: 0.8, sheenColor: white })));
export const ceramic = (color) => memo('c' + color, () => new THREE.MeshPhysicalMaterial({ color, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.08 }));
export const metal = (color = '#2B2B2D', rough = 0.35) => memo('m' + color + rough, () => new THREE.MeshStandardMaterial({ color, metalness: 1, roughness: rough }));
export const flat = (color, rough = 0.62) => memo('p' + color + rough, () => new THREE.MeshStandardMaterial({ color, roughness: rough }));
export const gloss = (color) => memo('g' + color, () => new THREE.MeshPhysicalMaterial({ color, roughness: 0.2, clearcoat: 0.8, clearcoatRoughness: 0.1 }));
export const glass = (color) => memo('gl' + color, () => new THREE.MeshPhysicalMaterial({ color, roughness: 0.04, transparent: true, opacity: 0.22, depthWrite: false }));
export const emit = (color) => memo('e' + color, () => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9, roughness: 0.8 }));
export const mirror = () => memo('mirror', () => new THREE.MeshStandardMaterial({ color: '#E8EEF2', metalness: 1, roughness: 0.03 }));
