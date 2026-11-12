// 以程式產生的 3D 家具模型。每件家具都依型錄的實際尺寸（cm）建模，再整體縮成公尺。
import * as THREE from 'three';
import { RoundedBoxGeometry } from '../vendor/RoundedBoxGeometry.js';
import { WOODS } from './catalog.js?v=20261112n';
import * as MT from './mats.js?v=20261112n';

function rnd(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
function shade(hex, f) { const c = new THREE.Color(hex); c.multiplyScalar(f); return '#' + c.getHexString(); }
// ---------- 材質（實作在 mats.js） ----------
const PAINTED = new Set(['#F1EEE8', '#2E2F31', '#8D8D8A']);
export function M(kind, color = '#FFFFFF') {
  switch (kind) {
    case 'wood': return PAINTED.has(color.toUpperCase()) ? MT.flat(color, 0.42) : MT.wood(color);   // 白、黑、灰是烤漆，不顯示木紋
    case 'fabric': return MT.fabric(color, 4);
    case 'leather': return MT.leather(color);
    case 'marble': return MT.marble(color);
    case 'metal': return MT.metal(color, 0.32);
    case 'mirror': return MT.mirror();
    case 'ceramic': return MT.ceramic(color);
    case 'gloss': return MT.gloss(color);
    case 'glass': return MT.glass(color);
    case 'emit': return MT.emit(color);
    case 'leaf': return MT.flat(color, 0.6);
    default: return MT.flat(color, 0.62);
  }
}
const finish = (f) => (f === 'marble' ? M('marble', '#EFEBE5') : f && f[0] === '#' ? M('paint', f) : M('wood', WOODS[f] || WOODS.oak));
const CHROME = () => M('metal', '#D5D8DC'), STEEL = () => M('metal', '#AEB3B8'), DARK = () => M('paint', '#2B2C2E'), BRASS = () => M('metal', '#B8955A');

// ---------- 幾何小工具（單位 cm；x 寬、y 高、z 深，正面朝 +z） ----------
function box(g, w, h, d, m, x = 0, y = 0, z = 0, r = 0) {
  const geo = r > 0 ? new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2 - 0.01, h / 2 - 0.01, d / 2 - 0.01)) : new THREE.BoxGeometry(w, h, d);
  const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); me.castShadow = me.receiveShadow = true; g.add(me); return me;
}
function cyl(g, rt, rb, h, m, x = 0, y = 0, z = 0, seg = 24) {
  const me = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m); me.position.set(x, y, z); me.castShadow = me.receiveShadow = true; g.add(me); return me;
}
function legs4(g, w, d, h, m, inset = 4, t = 4, round = false) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * (w / 2 - inset - t / 2), z = sz * (d / 2 - inset - t / 2);
    if (round) cyl(g, t / 2, t / 2.6, h, m, x, h / 2, z, 12); else box(g, t, h, t, m, x, h / 2, z);
  }
}

// ---------- 各類家具 ----------
const B = {};

B.sofa = (g, it, P) => {
  const { w, d, h, v } = it;
  const fab = v === 'leather' ? M('leather', P.fabric) : M('fabric', P.fabric);
  const leg = M('wood', WOODS[P.wood]);
  if (v === 'stool') { legs4(g, w, d, 12, leg, 5, 4, true); box(g, w, h - 12, d, fab, 0, 12 + (h - 12) / 2, 0, 6); return; }
  const isL = v === 'L' || v === 'Lr', dm = isL ? 95 : d, zo = -(d - dm) / 2;
  const arm = Math.max(12, Math.min(20, w * 0.09)), backD = 20;
  const s = new THREE.Group(); s.position.z = zo; g.add(s);
  legs4(s, w, dm, 9, leg, 5, 4.5, true);
  box(s, w, 22, dm, fab, 0, 9 + 11, 0, 3);
  box(s, w, h - 34, 14, fab, 0, 31 + (h - 34) / 2 - 3, -dm / 2 + 7, 4);
  for (const sx of [-1, 1]) box(s, arm, 50, dm, fab, sx * (w / 2 - arm / 2), 9 + 25, 0, 5);
  const inner = w - 2 * arm, n = Math.max(1, Math.round(inner / 72)), cw = inner / n;
  for (let i = 0; i < n; i++) {
    const x = -inner / 2 + cw * (i + 0.5);
    box(s, cw - 1, 15, dm - backD - 1, fab, x, 31 + 7, backD / 2, 5);
    const bc = box(s, cw - 2, h - 44, 16, fab, x, 44 + (h - 44) / 2 - 2, -dm / 2 + 14 + 9, 6); bc.rotation.x = -0.14;
  }
  const acc = M('fabric', P.accent);
  if (w > 140) { const c1 = box(s, 42, 42, 12, acc, -inner / 2 + 26, 62, -dm / 2 + 34, 5); c1.rotation.x = -0.3; c1.rotation.z = 0.08; }
  if (isL) {
    const cwid = 92, sx = v === 'L' ? 1 : -1, x = sx * (w / 2 - arm - cwid / 2), z = -d / 2 + dm + (d - dm) / 2;
    box(g, cwid, 22, d - dm, fab, x, 20, z, 3); box(g, cwid - 1, 15, d - dm - 1, fab, x, 38, z, 5);
  }
};

B.table = (g, it, P) => {
  const { w, d, v } = it, h = v === 'mirror' ? 75 : it.h;   // 含鏡梳妝台：桌面 75cm，其餘是鏡子
  const f = it.styled ? P.wood : it.color, top = finish(f);
  const leg = f === 'marble' ? BRASS() : f === 'black' ? DARK() : top;
  if (v === 'stoolseat') { legs4(g, w, d, h - 10, leg, 3, 3.5, true); box(g, w, 10, d, M('fabric', it.color || '#C8C2B6'), 0, h - 5, 0, 4); return; }
  if (v === 'fmirror') { box(g, w, h, 3, DARK(), 0, h / 2, 0).rotation.x = -0.12; box(g, w - 5, h - 5, 0.6, M('mirror'), 0, h / 2, 1.8).rotation.x = -0.12; return; }
  if (v === 'round') {
    const t = cyl(g, w / 2, w / 2, 4, top, 0, h - 2, 0, 48); t.scale.z = d / w;
    if (h > 62) { cyl(g, 5, 7, h - 6, leg, 0, (h - 6) / 2 + 2, 0); const b = cyl(g, w * 0.28, w * 0.3, 3, leg, 0, 1.5, 0, 36); b.scale.z = d / w; }
    else for (let i = 0; i < 3; i++) { const a = i * 2.094 + 0.5; cyl(g, 1.8, 1.4, h - 4, leg, Math.cos(a) * w * 0.32, (h - 4) / 2, Math.sin(a) * d * 0.32, 10); }
    return;
  }
  box(g, w, 4, d, top, 0, h - 2, 0, 0.6);
  legs4(g, w, d, h - 4, leg, 3, h > 60 ? 5 : 4);
  if (h < 50 && w > 60) box(g, w - 14, 2, d - 14, top, 0, 13, 0);
  if (it.cat === 'desk') { box(g, w * 0.32, 12, d - 12, top, w / 2 - w * 0.16 - 6, h - 10, 0); box(g, 10, 1, 1.5, STEEL(), w / 2 - w * 0.16 - 6, h - 10, d / 2 - 5.2); }
  if (it.cat === 'dresser' && w >= 70) { box(g, w * 0.3, 10, d - 8, top, -w * 0.3, h - 9, 0); box(g, w * 0.3, 10, d - 8, top, w * 0.3, h - 9, 0); }
  if (v === 'mirror') { const mh = it.h - h; box(g, w * 0.62, mh, 2.5, top, 0, h + mh / 2, -d / 2 + 2); box(g, w * 0.62 - 5, mh - 5, 0.6, M('mirror'), 0, h + mh / 2, -d / 2 + 3.5); }
};

B.cab = (g, it, P) => {
  const { w, d, h, v } = it;
  const f = it.styled ? (it.cat === 'ward' || it.cat === 'shoe' ? 'white' : P.wood) : it.color, fc = it.fin && it.color[0] === '#' ? it.color : null;
  const m = !fc ? finish(f) : it.fin === 'matte' ? MT.flat(fc, 0.5) : it.fin === 'stone' ? MT.marble(fc) : MT.wood(fc, it.fin === 'veneer' ? { rings: 16, gloss: 0.1, warp: 0.35, vert: true } : { rings: 10, warp: 0.8, vert: true });
  const tall = h >= 120, float = v === 'float';
  const lh = float ? 0 : tall ? 6 : (it.cat === 'shoe' || h > 70) ? 8 : 12;
  if (!float) { if (tall || lh <= 8) box(g, w - 6, lh, d - 8, DARK(), 0, lh / 2, -1); else legs4(g, w, d, lh, f === 'black' ? DARK() : m, 3, 3.5, true); }
  const bh = h - lh;
  box(g, w, bh, d - 2, m, 0, lh + bh / 2, -1);
  if (!tall) box(g, w + 1, 2, d + 0.5, m, 0, h - 1, 0);
  const hm = f === 'black' || fc === '#2E2F31' ? BRASS() : it.fin === 'veneer' || it.fin === 'stone' ? DARK() : STEEL();
  if (v === 'drawer') {
    const rows = Math.max(2, Math.round(bh / 24)), rh = (bh - 3) / rows;
    for (let i = 0; i < rows; i++) { const y = lh + 1 + rh * (i + 0.5); box(g, w - 1.6, rh - 1, 2, m, 0, y, d / 2 - 1); box(g, Math.min(16, w * 0.3), 1.2, 1.6, hm, 0, y + rh * 0.2, d / 2 + 0.7); }
    return;
  }
  const n = v === 'slide' ? Math.max(2, Math.round(w / 90)) : Math.max(1, Math.round(w / (tall ? 48 : 55))), dw = (w - 1) / n, ph = bh - (tall ? 1.5 : 3.5);
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + 0.5 + dw * (i + 0.5);
    const out = v === 'slide' && i % 2 ? 1.6 : 0; box(g, dw - 0.8, ph, 2 + out, m, x, lh + 0.8 + ph / 2, d / 2 - 1 + out / 2);
    if (it.fin === 'frame') { const y0 = lh + 0.8, fw = Math.min(8, dw * 0.16), zf = d / 2 + out + 0.2; for (const sx of [-1, 1]) box(g, fw, ph, 1, m, x + sx * (dw / 2 - 0.4 - fw / 2), y0 + ph / 2, zf); for (const yy of tall ? [fw / 2, ph * 0.42, ph - fw / 2] : [fw / 2, ph - fw / 2]) box(g, dw - 0.8, fw, 1, m, x, y0 + yy, zf); }
    const hx = n === 1 ? x + dw * 0.32 : x + (i % 2 ? -1 : 1) * (dw / 2 - 4);
    if (tall) box(g, 1.2, 22, 2, hm, hx, lh + bh * 0.48, d / 2 + 0.9 + out);
    else box(g, 1.2, 8, 1.6, hm, hx, lh + bh * 0.62, d / 2 + 0.7);
  }
};

B.shelf = (g, it, P) => {
  const { w, d, h } = it, m = finish(it.styled ? P.wood : it.color), t = 2.2;
  box(g, w, h, 1, m, 0, h / 2, -d / 2 + 0.5);
  for (const sx of [-1, 1]) box(g, t, h, d, m, sx * (w / 2 - t / 2), h / 2, 0);
  const n = Math.max(2, Math.round(h / 36)), gap = (h - t) / n, R = rnd(w * 31 + h);
  const cols = ['#B5654A', '#2F3E5C', '#E3DED4', '#7C8471', '#C8A464', '#5E6B7A', '#8E3B3B', '#F1EEE8', '#3C4047'];
  for (let i = 0; i <= n; i++) box(g, w - 2 * t, t, d - 1, m, 0, t / 2 + i * gap, 0.5);
  for (let i = 0; i < n; i++) {
    let x = -w / 2 + t + 2; const y0 = t + i * gap, lim = w / 2 - t - 3, fill = 0.45 + R() * 0.5;
    while (x < -w / 2 + (w - 2 * t) * fill && x < lim) {
      const bw = 2.5 + R() * 3.5, bh = Math.min(gap - t - 3, 18 + R() * 9);
      box(g, bw, bh, d * 0.62, M('paint', cols[Math.floor(R() * cols.length)]), x + bw / 2, y0 + bh / 2, -d * 0.08); x += bw + 0.3;
    }
  }
};

B.tv = (g, it) => {
  const { w, h } = it;
  box(g, w, h, 2.5, M('gloss', '#111214'), 0, h / 2, 0, 0.5);
  box(g, w - 2, h - 2, 0.3, M('gloss', '#07090C'), 0, h / 2, 1.35);
};

B.chair = (g, it, P) => {
  const { w, d, h, v } = it;
  const wood = finish(it.color && it.color[0] === '#' ? P.wood : it.color);
  const pad = M('fabric', it.styled ? P.fabric : (it.color && it.color[0] === '#' ? it.color : '#C8C2B6'));
  if (v === 'bench') { box(g, w, 4, d, wood, 0, h - 2, 0, 0.6); legs4(g, w, d, h - 4, wood, 6, 5); return; }
  const sh = v === 'bar' ? 72 : 45;
  legs4(g, w, d, sh - 2, wood, 1.5, 3.4, true);
  box(g, w, 4, d - 4, wood, 0, sh, 1, 1.2);
  if (v === 'bar') { box(g, w - 8, 1.5, 1.5, STEEL(), 0, 28, d / 2 - 4); }
  if (v === 'pad' || it.styled) box(g, w - 3, 4, d - 8, pad, 0, sh + 3.5, 1.5, 1.8);
  for (const sx of [-1, 1]) { const p = box(g, 3, h - sh, 3, wood, sx * (w / 2 - 3), sh + (h - sh) / 2, -d / 2 + 3.5); p.rotation.x = -0.08; }
  const br = box(g, w - 4, (h - sh) * 0.48, 2.4, v === 'pad' ? pad : wood, 0, h - (h - sh) * 0.27, -d / 2 + 2.4, 1); br.rotation.x = -0.08;
};

B.ochair = (g, it) => {
  const { w, h } = it, fab = M('fabric', it.color || '#2E2F31'), dk = DARK(), st = STEEL();
  for (let i = 0; i < 5; i++) { const a = i * 1.2566, s = box(g, w * 0.48, 2.5, 4, dk, Math.cos(a) * w * 0.24, 6, Math.sin(a) * w * 0.24); s.rotation.y = -a; cyl(g, 2.6, 2.6, 4, dk, Math.cos(a) * w * 0.47, 2.6, Math.sin(a) * w * 0.47, 10).rotation.z = Math.PI / 2; }
  const sy = Math.min(46, h * 0.5);   // 椅座中心高度：矮的兒童椅跟著降低
  cyl(g, 2.4, 2.4, sy - 10, st, 0, 7 + (sy - 10) / 2, 0, 12);
  box(g, w * 0.82, 8, w * 0.8, fab, 0, sy, 2, 3.5);
  const bh = h - sy - 9, sz = 2 - w * 0.4 + 2.5;   // sz = 椅座後緣內側
  const b = box(g, w * 0.74, bh, 6, fab, 0, sy + 9 + bh / 2, sz - 1.5, 3); b.rotation.x = -0.1;
  box(g, 5, 16, 5, dk, 0, sy + 5, sz);
  if (w >= 56) for (const sx of [-1, 1]) { box(g, 3, 20, 3, dk, sx * (w * 0.41 - 2.5), sy + 10, 0); box(g, 5, 2.5, 26, dk, sx * (w * 0.41 - 2.5), sy + 21, 2, 1); }
};

B.bed = (g, it, P) => {
  const { w, d, h, v } = it;
  const fw = finish(P.wood), soft = v === 'soft';
  const linen = M('fabric', '#F2EFE9'), duvet = M('fabric', it.styled ? '#E9E5DD' : it.color || '#E3DED4'), thr = M('fabric', it.styled ? P.accent : shade(it.color || '#B9B4AA', 0.7));
  const deck = (y0) => {
    box(g, w, 10, d, soft ? M('fabric', it.color) : fw, 0, y0 + 5, 0, 1);
    const mw = w - 8, md = d - 12;
    box(g, mw, 22, md, linen, 0, y0 + 10 + 11, 3, 5);
    box(g, mw + 2, 7, md * 0.66, duvet, 0, y0 + 30, 3 + md * 0.17 + 1, 3);
    box(g, mw + 3, 2.5, 46, thr, 0, y0 + 33.2, 3 + md / 2 - 30, 1);
    const np = w >= 140 ? 2 : 1;
    for (let i = 0; i < np; i++) { const p = box(g, np === 2 ? mw / 2 - 8 : mw - 22, 13, 40, linen, np === 2 ? (i ? 1 : -1) * mw / 4 : 0, y0 + 37, -md / 2 + 26, 5.5); p.rotation.x = 0.22; }
  };
  if (v === 'bunk') {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, 6, h, 6, fw, sx * (w / 2 - 3), h / 2, sz * (d / 2 - 3));
    deck(18); deck(108);
    for (const y of [150, 162]) { box(g, 3, 3, d - 12, fw, w / 2 - 2, y, 0); box(g, 3, 3, d - 12, fw, -w / 2 + 2, y, 0); }
    for (let i = 0; i < 4; i++) box(g, 36, 3, 3, fw, w / 2 - 22, 30 + i * 26, d / 2 - 2);
    return;
  }
  legs4(g, w, d, 18, DARK(), 6, 5);
  deck(18);
  box(g, w + 2, h, soft ? 12 : 6, soft ? M('fabric', it.color) : fw, 0, h / 2, -d / 2 + (soft ? 6 : 3), soft ? 5 : 0.6);
};

B.rug = (g, it) => {
  const { w, d, v } = it, m = M('fabric', it.color || '#D8D2C6'), m2 = M('fabric', shade(it.color || '#D8D2C6', 0.86));
  if (v === 'round') { cyl(g, w / 2, w / 2, 1, m, 0, 0.5, 0, 48).castShadow = false; cyl(g, w / 2 - 8, w / 2 - 8, 1.1, m2, 0, 0.56, 0, 48).castShadow = false; return; }
  box(g, w, 1, d, m, 0, 0.5, 0).castShadow = false;
  for (let i = 1; i < 6; i++) box(g, w - 16, 1.08, 1.6, m2, 0, 0.55, -d / 2 + (d * i) / 6).castShadow = false;
  box(g, 1.6, 1.08, d - 16, m2, -w / 2 + 12, 0.55, 0).castShadow = false; box(g, 1.6, 1.08, d - 16, m2, w / 2 - 12, 0.55, 0).castShadow = false;
};

B.lamp = (g, it) => {
  const { w, h, v } = it, shd = M('emit', it.color || '#F4EBDD'), mt = v === 'tripod' ? M('wood', WOODS.oak) : DARK();
  const sr = w / 2, sh = v === 'small' ? h * 0.42 : 28;
  if (v === 'tripod') for (let i = 0; i < 3; i++) { const a = i * 2.094, top = new THREE.Vector3(0, h - sh + 2, 0), dv = new THREE.Vector3(Math.cos(a) * w * 0.42, 0, Math.sin(a) * w * 0.42).sub(top), p = cyl(g, 1.3, 1.3, dv.length(), mt, 0, 0, 0, 8); p.position.copy(top).addScaledVector(dv, 0.5); p.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dv.normalize()); }
  else { cyl(g, sr * 0.75, sr * 0.8, 2, mt, 0, 1, 0); cyl(g, 1.1, 1.1, h - sh, mt, 0, (h - sh) / 2 + 1, 0, 10); }
  cyl(g, 1.1, 1.1, sh + 8, mt, 0, h - 1 - (sh + 8) / 2, 0, 10); cyl(g, sr * 0.72, sr * 0.72, 0.8, shd, 0, h - 0.6, 0, 28).castShadow = false; cyl(g, sr * 0.9, sr * 0.9, 0.6, shd, 0, h - sh * 0.75, 0, 28).castShadow = false;
  const s = new THREE.Mesh(new THREE.CylinderGeometry(sr * 0.72, sr, sh, 28, 1, true), shd); s.material.side = THREE.DoubleSide; s.position.y = h - sh / 2; g.add(s);
};

B.plant = (g, it) => {
  const { w, h } = it, R = rnd(w * 13 + h * 7);
  const ph = Math.min(40, h * 0.3), pr = Math.min(w * 0.32, 18);
  cyl(g, pr, pr * 0.72, ph, M('ceramic', ['#E7E2DA', '#C9B8A0', '#3C4047', '#F4F4F2'][Math.floor(R() * 4)]), 0, ph / 2, 0, 20);
  cyl(g, pr * 0.92, pr * 0.92, 1, M('paint', '#3A2E24'), 0, ph - 0.4, 0, 20);
  const tall = h > 120;
  if (tall) cyl(g, 1.6, 2.2, h * 0.5, M('paint', '#5A4632'), 0, ph + h * 0.25, 0, 8);
  const greens = ['#3F6B3B', '#4A7741', '#356034', '#588A4C'], n = tall ? 26 : 18, base = tall ? ph + h * 0.42 : ph;
  for (let i = 0; i < n; i++) {
    const r = w * (0.11 + R() * 0.1), a = R() * 6.28, rr = R() * (w / 2 - r) * 0.95;
    const me = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), M('leaf', greens[Math.floor(R() * 4)]));
    me.position.set(Math.cos(a) * rr, base + r * 0.7 + R() * Math.max(4, h - base - r * 1.7), Math.sin(a) * rr); me.scale.set(1, 0.45 + R() * 0.3, 0.7 + R() * 0.3); me.rotation.set(R() * 1.2 - 0.6, R() * 6.28, R() * 1.2 - 0.6);
    me.castShadow = me.receiveShadow = true; g.add(me);
    const a0 = new THREE.Vector3(0, tall ? ph + h * 0.5 - 2 : ph - 1, 0), dv = me.position.clone().sub(a0), st = cyl(g, 0.45, 0.8, dv.length(), M('paint', tall ? '#5A4632' : '#4E6B3A'), 0, 0, 0, 5);
    st.position.copy(a0).addScaledVector(dv, 0.5); st.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dv.normalize()); st.castShadow = false;
  }
};

// ---- 廚具 ----
function baseCab(g, w, d, h, f, counter = true) {
  const m = finish(f), ct = M('marble', '#EDEBE7'), ch = counter ? 4 : 0, ph = 10, bh = h - ph - ch;
  box(g, w - 2, ph, d - 10, DARK(), 0, ph / 2, -3);
  box(g, w, bh, d - 4, m, 0, ph + bh / 2, -2);
  const n = Math.max(1, Math.round(w / 45)), dw = (w - 0.6) / n;
  for (let i = 0; i < n; i++) { const x = -w / 2 + 0.3 + dw * (i + 0.5); box(g, dw - 0.7, bh - 1.4, 2, m, x, ph + bh / 2, d / 2 - 3); box(g, Math.min(dw - 8, 20), 1.1, 1.6, STEEL(), x, ph + bh - 5, d / 2 - 1.4); }
  if (counter) box(g, w, ch, d, ct, 0, h - ch / 2, 0, 0.5);
}
B.kcab = (g, it, P) => baseCab(g, it.w, it.d, it.h, it.styled ? 'white' : it.color);
B.cook = (g, it, P) => {
  const { w, d, h, v } = it; baseCab(g, w, d, h, it.styled ? 'white' : it.color);
  const gw = Math.min(w - 8, 78), ih = typeof v === 'string';
  box(g, gw, 0.8, d - 16, M('gloss', '#0E0F11'), 0, h + 0.4, 0, 0.3);
  const n = ih ? +v.slice(2) : v || 2, pos = n === 1 ? [[0, 0]] : n === 2 ? [[-gw / 4, 0], [gw / 4, 0]] : n === 3 ? [[-gw / 3.4, 4], [gw / 3.4, 4], [0, -9]] : [[-gw / 4, 9], [gw / 4, 9], [-gw / 4, -11], [gw / 4, -11]];
  for (const [x, z] of pos) {
    if (ih) { const r = new THREE.Mesh(new THREE.RingGeometry(8, 8.6, 32), M('paint', '#8A8F95')); r.rotation.x = -Math.PI / 2; r.position.set(x, h + 0.86, z); g.add(r); }
    else { cyl(g, 5.5, 6.5, 1.6, M('paint', '#1C1D1F'), x, h + 1.4, z, 20); const t = new THREE.Mesh(new THREE.TorusGeometry(8.5, 0.7, 6, 20), M('paint', '#1C1D1F')); t.rotation.x = Math.PI / 2; t.position.set(x, h + 2.6, z); g.add(t); }
  }
  if (!ih) for (let i = 0; i < Math.min(n, 3); i++) cyl(g, 1.8, 1.8, 2, STEEL(), (i - (Math.min(n, 3) - 1) / 2) * 9, h + 1.6, d / 2 - 12, 12);
};
B.sink = (g, it) => {
  const { w, d, h, v } = it; baseCab(g, w, d, h, it.styled ? 'white' : it.color);
  const basins = v === 'double' ? [[-w / 4, w / 2 - 12], [w / 4, w / 2 - 12]] : [[0, Math.min(w - 16, 70)]];
  for (const [x, bw] of basins) { box(g, bw, 0.5, d - 22, STEEL(), x, h + 0.2, 2, 0.2); box(g, bw - 5, 0.5, d - 27, M('metal', '#7E848A'), x, h + 0.3, 2, 0.2); }
  cyl(g, 1.3, 1.5, 26, CHROME(), 0, h + 13, -d / 2 + 7, 12);
  const sp = cyl(g, 1.1, 1.1, 16, CHROME(), 0, h + 25, -d / 2 + 14, 10); sp.rotation.x = Math.PI / 2;
};
B.fridge = (g, it) => {
  const { w, d, h, v } = it, c = it.color || '#D9DBDD', m = new THREE.MeshStandardMaterial({ color: c, metalness: 0.55, roughness: 0.38 }), gap = M('paint', '#1A1B1D'), hd = STEEL();
  box(g, w, h, d - 3, m, 0, h / 2, -1.5, 1);
  const split = h > 150 ? h * 0.38 : h > 100 ? h * 0.7 : 0;
  const door = (x, y, ww, hh) => box(g, ww - 0.6, hh - 0.6, 3, m, x, y, d / 2 - 1.5, 0.8);
  if (v === 'side') { door(-w / 4, split + (h - split) / 2, w / 2, h - split); door(w / 4, split + (h - split) / 2, w / 2, h - split); door(0, split / 2, w, split); for (const sx of [-1, 1]) box(g, 1.4, (h - split) * 0.6, 2, hd, sx * 3, split + (h - split) / 2, d / 2 + 1); box(g, w * 0.5, 1.4, 2, hd, 0, split - 6, d / 2 + 1); }
  else if (split) { door(0, split + (h - split) / 2, w, h - split); door(0, split / 2, w, split); box(g, 1.4, (h - split) * 0.5, 2, hd, -w / 2 + 5, split + (h - split) / 2, d / 2 + 1); box(g, 1.4, split * 0.4, 2, hd, -w / 2 + 5, split * 0.62, d / 2 + 1); }
  else { door(0, h / 2, w, h); box(g, 1.4, h * 0.3, 2, hd, -w / 2 + 5, h * 0.6, d / 2 + 1); }
  box(g, w, 0.4, d - 3, gap, 0, 0.2, -1.5);
};
B.hood = (g, it) => {
  const { w, d, h, v } = it, st = STEEL();
  if (v === 'T') { box(g, w, 6, d, st, 0, 3, 0, 0.6); box(g, 30, h - 6, 28, st, 0, 6 + (h - 6) / 2, -d / 2 + 15); }
  else { box(g, w, h * 0.45, d, st, 0, h * 0.225, 0, 0.6); box(g, w, h * 0.55, d * 0.6, M('paint', '#F1EEE8'), 0, h * 0.45 + h * 0.275, -d * 0.2); }
  box(g, w - 10, 0.5, d - 10, M('paint', '#3A3C40'), 0, -0.2, 0);
};
B.tower = (g, it) => {
  const { w, d, h, v } = it;
  if (v === 'dw') { baseCab(g, w, d, h, it.color); box(g, w - 1.5, h - 18, 1, STEEL(), 0, 10 + (h - 14) / 2, d / 2 - 1.6); return; }
  const m = finish(it.color);
  box(g, w - 4, 8, d - 8, DARK(), 0, 4, -2); box(g, w, h - 8, d - 3, m, 0, 8 + (h - 8) / 2, -1.5);
  const ov = (y, hh) => { box(g, w - 6, hh, 2.5, M('gloss', '#101113'), 0, y, d / 2 - 1.75, 0.5); box(g, w - 16, 1.4, 2, STEEL(), 0, y + hh / 2 - 5, d / 2 + 0.4); };
  if (w <= 90 && h >= 150) { ov(105, 56); if (v === 2) ov(152, 34); box(g, w - 1, 68, 2, m, 0, 8 + 35, d / 2 - 2); box(g, w - 1, h - (v === 2 ? 174 : 138), 2, m, 0, h - (h - (v === 2 ? 172 : 136)) / 2, d / 2 - 2); }
  else { const n = Math.max(2, Math.round(w / 50)), dw = (w - 0.6) / n; for (let i = 0; i < n; i++) box(g, dw - 0.8, h - 10, 2, m, -w / 2 + 0.3 + dw * (i + 0.5), 8 + (h - 8) / 2, d / 2 - 2); }
};

// ---- 裝修櫃與牆上置物架（背面在 z = -d/2，貼牆；寬度可伸縮，門片數跟著變） ----
const BCOL = ['#C96F4A', '#3F5A54', '#E8E2D4', '#2F3E5C', '#D8B35A', '#8C8F94', '#B5673A', '#EFEAE0'];
function builtKit(g, it) {
  const D = it.d, c = it.color && it.color[0] === '#' ? it.color : '#D9C2A3', GL = it.fin === 'glass' || it.fin === 'frost', woodC = { '#D9C2A3': 1, '#C08A52': 1, '#7A5236': 1 }[c];
  const main = it.fin === 'matte' || (GL && !woodC) ? MT.flat(c, 0.5) : MT.wood(c, { rings: 16, warp: 0.35, vert: true, gloss: 0.1 }), pane = it.fin === 'frost' ? MT.frost() : MT.glass('#CFE3E6'); const inner = MT.flat('#8A8278', 0.9);
  const dark = c === '#2E2F31' || c === '#5A5E64', hm = dark ? BRASS() : DARK(), white = MT.flat('#F3F0EA', 0.5);
  // b：x 置中、y0 為底、z0 從背牆算起
  const b = (w, h, d, mat, x, y0, z0) => box(g, w, h, d, mat, x, y0 + h / 2, -D / 2 + z0 + d / 2);
  const door = (w, h, mat, x, y0, z0, hs = 0) => {
    if (GL) {   // 玻璃門：細框（門片原本的顏色）＋玻璃，玻璃後面是比較暗的櫃內
      const f = Math.min(4, w * 0.12), iw = w - 0.8 - 2 * f, ih = h - 0.8 - 2 * f; for (const s of [-1, 1]) b(f, h - 0.8, 2, mat, x + s * (w / 2 - 0.4 - f / 2), y0 + 0.4, z0); for (const yy of [y0 + 0.4, y0 + h - 0.4 - f]) b(w - 0.8, f, 2, mat, x, yy, z0);
      b(iw, ih, 0.3, inner, x, y0 + 0.4 + f, z0 + 0.1); b(iw, ih, 0.6, pane, x, y0 + 0.4 + f, z0 + 0.7).castShadow = false;
    } else b(w - 0.8, h - 0.8, 2, mat, x, y0 + 0.4, z0);
    if (hs) b(1.2, Math.min(60, h * 0.3), 1.6, hm, x + hs * (w / 2 - 5), y0 + h / 2 - Math.min(30, h * 0.15), z0 + 2); };
  const drawer = (w, h, mat, x, y0, z0) => { b(w - 0.8, h - 0.8, 2, mat, x, y0 + 0.4, z0); b(Math.min(20, w * 0.35), 1.2, 1.6, hm, x, y0 + h - 7, z0 + 2); };
  const books = (x, y0, z0, w, n = 8, s = 1) => { let p = x - w / 2 + 2; for (let i = 0; i < n && p < x + w / 2 - 4; i++) { const t = 2.5 + ((i * 7 + s * 3) % 4), h = 18 + ((i * 5 + s) % 9); b(t, h, 14, MT.flat(BCOL[(i + s) % 8], 0.7), p + t / 2, y0, z0 + 3); p += t + 0.4; } };
  const pot = (x, y0, z0) => { cyl(g, 5, 4, 9, MT.ceramic('#EEEAE2'), x, y0 + 4.5, -D / 2 + z0, 14); const l = new THREE.Mesh(new THREE.SphereGeometry(8, 12, 10), MT.flat('#4F7A45', 0.8)); l.position.set(x, y0 + 15, -D / 2 + z0); l.scale.y = 1.2; l.castShadow = true; g.add(l); };
  return { D, main, white, hm, b, door, drawer, books, pot };
}
B.built = (g, it, P, o) => {
  const { w: W, h: H, v } = it, K = builtKit(g, it), { D, main, white, b, door, drawer, books, pot } = K, dec = o.decor !== false, fabric = MT.fabric('#B8AC98', 4);
  if (v === 'ward') { const n = Math.max(2, Math.round(W / 60)), dw = W / n; b(W, H, D - 2, main, 0, 0, 0); b(W - 4, 8, D - 6, DARK(), 0, 0, 0); for (let i = 0; i < n; i++) { const x = -W / 2 + dw * (i + 0.5); door(dw, H - 58, main, x, 8, D - 2, i % 2 ? -1 : 1); door(dw, 50, main, x, H - 50, D - 2); } return; }
  if (v === 'tvwall') { const R = W - 60, cx = 30, n = Math.max(2, Math.round(R / 80)), dw = R / n;
    b(R - 4, 210, 3, main, cx, 30, 0); b(60, H, D, white, -W / 2 + 30, 0, 0); door(60, H - 8, white, -W / 2 + 30, 8, D, 1);
    b(R, 34, D, white, cx, 26, 0); for (let i = 0; i < n; i++) door(dw, 34, white, cx - R / 2 + dw * (i + 0.5), 26, D); b(R, 4, 26, white, cx, 196, 0);
    b(Math.min(138, R - 30), 80, 4, MT.gloss('#05070A'), cx, 92, 3); if (dec) { books(cx - R * 0.28, 200, 0, 60, 7); pot(cx + R * 0.33, 200, 13); } return; }
  if (v === 'entry') { const bw = Math.min(80, W * 0.4), cw = W - bw, cx = -W / 2 + cw / 2, bx = W / 2 - bw / 2, n = Math.max(1, Math.round(cw / 60)), dw = cw / n;
    b(cw, 78, D - 2, white, cx, 20, 0); b(cw, 40, D - 4, main, cx, 98, 0); b(cw - 4, 34, D - 6, MT.flat('#8A6B4A', 0.8), cx, 101, 3); b(cw, H - 138, D - 2, white, cx, 138, 0);
    for (let i = 0; i < n; i++) { const x = cx - cw / 2 + dw * (i + 0.5), hs = n === 1 ? 1 : i % 2 ? -1 : 1; door(dw, 78, white, x, 20, D - 2, hs); door(dw, H - 138, white, x, 138, D - 2, hs); }
    b(bw, 40, D - 2, main, bx, 0, 0); b(bw - 4, 6, D - 4, fabric, bx, 40, 1); b(bw, 150, 3, main, bx, 46, 0); for (let i = 0; i < 3; i++) b(3, 3, 8, DARK(), bx - bw * 0.28 + i * bw * 0.28, 160, 3);
    b(bw, H - 196, D - 2, white, bx, 196, 0); door(bw, H - 196, white, bx, 196, D - 2, -1); if (dec) pot(cx - cw * 0.25, 101, D - 12); return; }
  if (v === 'books') { const n = Math.max(2, Math.round(W / 60)), cw = (W - 2.5) / n, rows = 5, rh = (H - 78.5 - 2.5) / rows;
    b(W, H, 2, main, 0, 0, 0); for (let i = 0; i <= n; i++) b(2.5, H, D, main, -W / 2 + 1.25 + cw * i, 0, 0); b(W, 2.5, D, main, 0, 6, 0); for (let j = 0; j <= rows; j++) b(W, 2.5, D, main, 0, 76 + j * rh, 0); b(W - 4, 6, D - 3, DARK(), 0, 0, 0);
    for (let i = 0; i < n; i++) { const x = -W / 2 + 1.25 + cw * (i + 0.5); door(cw, 67.5, main, x, 8.5, D, i % 2 ? -1 : 1); if (dec) for (let j = 0; j < rows; j++) { const y = 78.5 + j * rh, k = (i * 3 + j * 5) % 7; if (k < 4) books(x - (k % 2 ? 6 : 0), y, 8, cw - 14, 9, i + j); else if (k === 4) pot(x, y, 18); else if (k === 5) b(Math.min(30, cw - 14), 16, 22, MT.flat('#B9B4A8', 0.6), x, y, 6); } } return; }
  if (v === 'pantry') { const n = Math.max(2, Math.round(W / 60)), dw = W / n, top = MT.marble('#EFEDE8');
    b(W, 86, D - 2, main, 0, 0, 0); b(W - 4, 8, D - 6, DARK(), 0, 0, 0); for (let i = 0; i < n; i++) { const x = -W / 2 + dw * (i + 0.5); drawer(dw, 26, main, x, 58.4, D - 2); drawer(dw, 48, main, x, 8.4, D - 2); }
    b(W + 2, 4, D, top, 0, 86, 0); b(W, 60, 3, MT.wood('#D9C2A3', { rings: 16, warp: 0.35, vert: true }), 0, 90, 0); for (const s of [-1, 1]) b(3, 60, D - 2, main, s * (W / 2 - 1.5), 90, 0);
    b(W, H - 150, 40, main, 0, 150, 0); for (let i = 0; i < n; i++) door(dw, H - 150, main, -W / 2 + dw * (i + 0.5), 150, 40, i % 2 ? -1 : 1);
    if (dec) { b(46, 30, 36, DARK(), -W * 0.27, 90, 12); b(22, 26, 22, MT.flat('#C9C9C7', 0.3), 0, 90, 18); pot(W * 0.3, 90, 30); } return; }
  if (v === 'bedwall') { const mid = W - 100, n = Math.max(2, Math.round(mid / 50)), dw = mid / n;
    for (const s of [-1, 1]) { b(50, H, D, main, s * (W / 2 - 25), 0, 0); door(50, H - 8, main, s * (W / 2 - 25), 8, D, -s); }
    b(mid, 44, D, main, 0, H - 44, 0); for (let i = 0; i < n; i++) door(dw, 44, main, -mid / 2 + dw * (i + 0.5), H - 44, D);
    b(mid, 120, 6, fabric, 0, 30, 0); for (let i = 1; i < n; i++) b(0.8, 120, 0.6, MT.flat('#9C927E', 0.8), -mid / 2 + dw * i, 30, 6); b(mid, 4, 18, main, 0, 150, 0); if (dec) { books(-mid * 0.28, 154, 0, 50, 6); pot(mid * 0.3, 154, 9); } return; }
  if (v === 'desk') { const n = Math.max(2, Math.round(W / 53)), dw = W / n;
    b(W, 4, D, main, 0, 72, 0); b(40, 72, D - 4, white, W / 2 - 20, 0, 0); for (let i = 0; i < 3; i++) drawer(40, 23.6, white, W / 2 - 20, 0.6 + i * 23.8, D - 4); b(3, 72, D - 4, main, -W / 2 + 1.5, 0, 0);
    b(W, 60, 35, white, 0, H - 60, 0); for (let i = 0; i < n; i++) door(dw, 60, white, -W / 2 + dw * (i + 0.5), H - 60, 35); b(W, 3, 24, main, 0, H - 100, 0); b(W, H - 136, 2, MT.flat('#DAD4C8', 0.8), 0, 76, 0);
    if (dec) { books(-W * 0.25, H - 97, 0, 60, 8, 2); pot(W * 0.3, H - 97, 12); } return; }
  // bench：臥榻＋側邊書櫃
  { const sw = 40, bw = W - sw, cx = -W / 2 + bw / 2, n = Math.max(1, Math.round(bw / 60)), dw = bw / n, sx = W / 2 - sw / 2, rows = 7, rh = (H - 2.5) / rows;
    b(bw, 40, D, main, cx, 0, 0); b(bw - 4, 8, 2, DARK(), cx, 0, D - 4); for (let i = 0; i < n; i++) drawer(dw, 30, main, cx - bw / 2 + dw * (i + 0.5), 8, D); b(bw - 4, 7, D - 2, fabric, cx, 40, 1);
    if (dec) for (const [x, col] of [[cx - bw / 2 + 22, '#3F5A54'], [cx - bw / 2 + 58, '#DDD3C2']]) { const p = b(34, 34, 10, MT.fabric(col, 3), x, 47, 2); p.rotation.x = -0.2; }
    b(sw, H, 2, main, sx, 0, 0); for (const s of [-1, 1]) b(2.5, H, 35, main, sx + s * (sw / 2 - 1.25), 0, 0); for (let j = 0; j <= rows; j++) b(sw, 2.5, 35, main, sx, j * rh, 0);
    if (dec) for (let j = 1; j < rows; j++) (j % 3 === 0 ? pot(sx, j * rh + 2.5, 18) : books(sx, j * rh + 2.5, 8, sw - 8, 6, j)); }
};
B.wshelf = (g, it, P, o) => {
  const { w: W, h: H, v } = it, K = builtKit(g, it), { D, main, b, books, pot } = K, dec = o.decor !== false;
  if (v === 'planks') { [0, 40, 80].forEach((y, j) => { b(W, 4, D, main, 0, y, 0); if (!dec) return; if (j === 0) { books(-W * 0.25, y + 4, 0, W * 0.4, 8, 1); pot(W * 0.33, y + 4, 11); } if (j === 1) { b(Math.min(30, W * 0.25), 16, 16, MT.flat('#B9B4A8', 0.6), -W * 0.3, y + 4, 3); books(W * 0.2, y + 4, 0, W * 0.4, 7, 4); } if (j === 2 && H > 90) { pot(-W * 0.33, y + 4, 11); } }); return; }
  if (v === 'cubes') { const cube = (x, y) => { b(30, 2, D, main, x, y, 0); b(30, 2, D, main, x, y + 28, 0); b(2, 30, D, main, x - 14, y, 0); b(2, 30, D, main, x + 14, y, 0); };
    [[100, -1, 1], [50, 1, 2], [0, -1, 3]].forEach(([y, s, k]) => { const cx = s * (W / 2 - 15), px = -s * 15; cube(cx, s < 0 ? y : y + 12); b(W - 30, 3, D, main, px, y + 12, 0); if (dec) { books(px - s * W * 0.12, y + 15, 0, W * 0.3, 7, k); pot(px + s * W * 0.1, y + 15, 10); } }); return; }
  if (v === 'peg') { const dot = MT.flat('#9C927E', 0.9), wd = MT.wood('#D9C2A3', { rings: 16, warp: 0.35 }); b(W, H, 2, main, 0, 0, 0);
    const nx = Math.max(3, Math.round((W - 20) / 10)), ny = 11; for (let i = 0; i <= nx; i++) for (let j = 0; j < ny; j += 1) b(1.4, 1.4, 0.4, dot, -W / 2 + 10 + (W - 20) * i / nx, 6 + j * 10.5, 2);
    b(W * 0.5, 2, 14, wd, -W * 0.2, 80, 2); b(W * 0.34, 2, 14, wd, W * 0.28, 50, 2); b(W * 0.6, 2, 14, wd, W * 0.1, 8, 2); for (let i = 0; i < 4; i++) b(1.5, 1.5, 7, DARK(), i * 10, 22, 2);
    if (dec) { books(-W * 0.2, 82, 0, W * 0.4, 5, 3); pot(W * 0.28, 52, 9); b(Math.min(30, W * 0.3), 16, 12, MT.flat('#B9B4A8', 0.6), W * 0.1, 10, 2); } return; }
  // glassc：玻璃門展示櫃
  { const n = Math.max(1, Math.round(W / 80)), bw = (W - 3) / n, gl = MT.glass('#CFE3E6');
    b(W, H, 2, main, 0, 0, 0); b(W, 3, D, main, 0, 0, 0); b(W, 3, D, main, 0, H - 3, 0); for (let i = 0; i <= n; i++) b(3, H, D, main, -W / 2 + 1.5 + bw * i, 0, 0); for (const y of [H * 0.34, H * 0.66]) b(W - 4, 2, D - 4, main, 0, y, 2);
    for (let i = 0; i < n; i++) { const x = -W / 2 + 1.5 + bw * (i + 0.5); b(bw - 4, H - 6, 1, gl, x, 3, D - 1).castShadow = false; b(1.2, 26, 1.6, K.hm, x + (i % 2 ? -1 : 1) * (bw / 2 - 6), H / 2 - 13, D); if (dec) [3, H * 0.34 + 2, H * 0.66 + 2].forEach((y, j) => ((i + j) % 2 ? pot(x, y, D * 0.5) : books(x, y, 4, bw - 16, 6, i + j + 2))); } }
};
// ---- 牆面與拉門（寬＝長度，沿 x；厚度沿 z） ----
const WOODC = { '#D9C2A3': 1, '#C08A52': 1, '#7A5236': 1 };
const frameMat = (c) => (WOODC[c] ? MT.wood(c, { rings: 14, warp: 0.5, vert: true, gloss: 0.1 }) : MT.flat(c, 0.45));
const paneMat = (fin) => (fin === 'frost' ? MT.frost() : MT.glass('#CFE3E6'));
const WHITE_WALL = '#F1EEE8';
// 一片有外框的玻璃：x 置中、y0 為底
function glazed(g, w, h, y0, fm, pm, t = 4, d = 6, z = 0) {
  box(g, w, t, d, fm, 0, y0 + t / 2, z); box(g, w, t, d, fm, 0, y0 + h - t / 2, z);
  const n = Math.max(1, Math.round(w / 85)); for (let i = 0; i <= n; i++) box(g, i === 0 || i === n ? t : 3, h, d, fm, -w / 2 + t / 2 + (w - t) * i / n, y0 + h / 2, z);
  box(g, w - t, h - 2 * t, 1, pm, 0, y0 + h / 2, z).castShadow = false;
}
B.wall = (g, it) => {
  const { w, d, h, v } = it, fin = it.fin || 'solid', c = it.color || WHITE_WALL, sol = fin === 'solid', fm = frameMat(c), wm = sol ? (WOODC[c] ? fm : MT.wallPaint(c)) : MT.wallPaint(WHITE_WALL), base = MT.flat('#E4E1DB', 0.5);
  if (v === 'full') { if (sol) { box(g, w, h, d, wm, 0, h / 2, 0); box(g, w, 8, d + 1, base, 0, 4, 0); } else glazed(g, w, h, 0, fm, paneMat(fin)); return; }
  if (v === 'open') {   // 中間 90cm 門洞，門洞兩側深咖啡色
    const dw = Math.min(90, w - 30), sw = (w - dw) / 2, dm = MT.flat('#4A3324', 0.6);
    for (const s of [-1, 1]) { const x = s * (dw / 2 + sw / 2); if (sol) { box(g, sw, h, d, wm, x, h / 2, 0); box(g, sw, 8, d + 1, base, x, 4, 0); } else { const q = new THREE.Group(); q.position.x = x; g.add(q); glazed(q, sw, h, 0, fm, paneMat(fin)); } box(g, 3, 210, d + 0.6, dm, s * (dw / 2 - 1.5), 105, 0); }
    if (sol) box(g, dw, h - 210, d, wm, 0, 210 + (h - 210) / 2, 0); else { const q = new THREE.Group(); g.add(q); glazed(q, dw, h - 210, 210, fm, paneMat(fin)); }
    box(g, dw, 3, d + 0.6, dm, 0, 208.5, 0); return;
  }
  if (v === 'hslat' || v === 'hglass') {   // 下方 110cm 實牆
    const lw = MT.wallPaint(WHITE_WALL); box(g, w, 110, d, lw, 0, 55, 0); box(g, w, 8, d + 1, base, 0, 4, 0);
    if (v === 'hglass') { glazed(g, w, h - 110, 110, fm, paneMat(fin)); return; }
    box(g, w, 4, d, fm, 0, 112, 0); box(g, w, 5, d - 2, fm, 0, h - 2.5, 0); for (const s of [-1, 1]) box(g, 5, h - 119, d - 2, fm, s * (w / 2 - 2.5), 114 + (h - 119) / 2, 0);
    const n = Math.max(2, Math.round((w - 5) / 12.5)); for (let i = 1; i < n; i++) box(g, 2.6, h - 119, 5, fm, -w / 2 + 2.5 + (w - 5) * i / n, 114 + (h - 119) / 2, 0);
    return;
  }
  const pm = paneMat(fin), top = MT.wallPaint(WHITE_WALL);
  // 門扇放在自己的群組裡，userData.leaf = { x0: 關著的位置, dx: 打開要移動的距離 }，3D 導覽時由大螢幕推動
  const leaf = (x, dx) => { const q = new THREE.Group(); q.position.x = x; q.userData.leaf = { x0: x, dx }; g.add(q); return q; };
  const still = (q) => { q.traverse((n) => { if (n.isMesh) n.castShadow = false; }); return q; };
  if (v === 'slide2') {   // 雙扇：左扇固定、右扇關著；走近時右扇滑到左扇後面
    box(g, w, h - 230, d - 2, top, 0, 230 + (h - 230) / 2, 0); box(g, w, 6, d, fm, 0, 227, 0); for (const s of [-1, 1]) box(g, 6, 224, d, fm, s * (w / 2 - 3), 112, 0);
    const lw = (w - 12) / 2 + 3, xa = -w / 2 + 6 + lw / 2, xb = w / 2 - 6 - lw / 2;
    const panel = (q, z) => { for (const s of [-1, 1]) box(q, 5, 222, 3.5, fm, s * (lw / 2 - 2.5), 113, z); box(q, lw, 5, 3.5, fm, 0, 4.5, z); box(q, lw, 5, 3.5, fm, 0, 221.5, z); box(q, lw - 10, 212, 1, pm, 0, 113, z).castShadow = false; box(q, 1.6, 24, 2, STEEL(), -(lw / 2 - 8), 105, z + 2.6 * Math.sign(z)); };
    const a = new THREE.Group(); a.position.x = xa; g.add(a); panel(a, -2.2);
    const qb = leaf(xb, xa - xb); panel(qb, 2.2); still(qb);
    return;
  }
  // slide1：單扇懸吊式。左半邊是固定的白牆，門扇關著時擋住右半邊，走近時滑到白牆前面
  box(g, w, h - 238, d, top, 0, 238 + (h - 238) / 2, 0); box(g, w, 6, d - 2, fm, 0, 235, 0); for (const s of [-1, 1]) box(g, 8, 232, d, top, s * (w / 2 - 4), 116, 0);
  const iw = w - 16, lw = iw / 2 + 4, xc = w / 2 - 8 - lw / 2, xo = -w / 2 + 8 + lw / 2, z = d / 2 + 1.5;
  box(g, iw / 2, 232, d, top, -w / 2 + 8 + iw / 4, 116, 0); box(g, iw / 2, 8, d + 1, MT.flat('#E4E1DB', 0.5), -w / 2 + 8 + iw / 4, 4, 0);
  const q = still(leaf(xc, xo - xc));
  for (const s of [-1, 1]) box(q, 2.5, 230, 3, fm, s * (lw / 2 - 1.25), 117, z); for (const y of [3.2, 117, 230.8]) box(q, lw, 2.5, 3, fm, 0, y, z); box(q, lw - 5, 226, 1, pm, 0, 117, z).castShadow = false; box(q, 1.6, 26, 2, STEEL(), -(lw / 2 - 7), 105, z + 2.4);
  still(q);
};
// ---- 衛浴 ----
B.toilet = (g, it) => {
  const { w, d, h, v } = it, c = M('ceramic', '#F6F6F4');
  if (v === 'wall' && h > 50) { box(g, w, h, d, c, 0, 40 + h / 2 - 20, 0, 6); return; }
  const y0 = v === 'wall' ? 16 : 0, bh = (v === 'wall' ? h : Math.min(40, h)) - (v === 'wall' ? 0 : 0);
  const tankD = v === 'wall' ? 0 : v === 'smart' ? 20 : 19, bd = d - tankD;
  const bowl = cyl(g, w / 2, w * 0.34, bh - y0 - 2, c, 0, y0 + (bh - y0 - 2) / 2, tankD / 2 + (v === 'wall' ? 0 : 0), 28); bowl.scale.z = bd / w;
  const seat = cyl(g, w / 2 + 0.6, w / 2 + 0.6, 3, c, 0, bh - 0.5, tankD / 2, 28); seat.scale.z = bd / w;
  const lid = cyl(g, w / 2 - 1, w / 2 - 1, 1.2, M('ceramic', '#FFFFFF'), 0, bh + 1.4, tankD / 2, 28); lid.scale.z = (bd - 2) / w;
  if (v === 'wall') return;
  if (v === 'smart') box(g, w, h, tankD, c, 0, h / 2, -d / 2 + tankD / 2, 5);
  else { box(g, w - 1, h - bh + 6, tankD - 1, c, 0, bh - 6 + (h - bh + 6) / 2, -d / 2 + tankD / 2, 3); box(g, w, 2.5, tankD, c, 0, h - 1, -d / 2 + tankD / 2, 1); cyl(g, 1.6, 1.6, 1.2, CHROME(), 0, h + 0.6, -d / 2 + tankD / 2, 12); box(g, w * 0.6, bh - 6, tankD, c, 0, (bh - 6) / 2, -d / 2 + tankD / 2, 2); }
};
B.vanity = (g, it) => {
  const { w, d, h, v } = it, c = M('ceramic', '#F6F6F4');
  if (v === 'ped') cyl(g, 9, 11, h - 6, c, 0, (h - 6) / 2, -2, 20);
  else { const m = finish(it.styled ? 'white' : it.color); box(g, w - 2, 50, d - 4, m, 0, h - 32, -2); if (h > 60) box(g, w - 8, h - 56, d - 12, m, 0, (h - 56) / 2, -3); const n = w > 75 ? 2 : 1; for (let i = 0; i < n; i++) { const dw = (w - 2.6) / n; box(g, dw - 0.7, 48, 1.8, m, -(w - 2.6) / 2 + dw * (i + 0.5), h - 32, d / 2 - 3.1); box(g, 1.1, 12, 1.5, STEEL(), -(w - 2.6) / 2 + dw * (i + 0.5) + (i ? -1 : 1) * (n === 1 ? dw * 0.3 : dw / 2 - 4), h - 25, d / 2 - 1.5); } }
  box(g, w, 7, d, c, 0, h - 3.5, 0, 2.2);
  const xs = v === 'double' ? [-w / 4, w / 4] : [0];
  for (const x of xs) {
    const r = Math.min(w / xs.length, d) * 0.36, b = cyl(g, r, r * 0.9, 0.6, M('ceramic', '#DDE3E6'), x, h + 0.05, 2, 28); b.scale.z = Math.min(1, (d * 0.34) / r);
    cyl(g, 1.2, 1.4, 14, CHROME(), x, h + 7, -d / 2 + 5, 12); const sp = cyl(g, 1, 1, 11, CHROME(), x, h + 13, -d / 2 + 10, 10); sp.rotation.x = Math.PI / 2;
  }
};
B.tub = (g, it) => {
  const { w, d, h, v } = it, c = M('ceramic', '#F6F6F4'), wat = M('ceramic', '#D3E6EE');
  if (v === 'free') { const o = cyl(g, d / 2, d * 0.42, h, c, 0, h / 2, 0, 36); o.scale.x = w / d; const i = cyl(g, d / 2 - 5, d / 2 - 5, 0.6, wat, 0, h - 0.1, 0, 36); i.scale.x = (w - 10) / (d - 10); }
  else { box(g, w, h, d, c, 0, h / 2, 0, 3); box(g, w - 14, 0.6, d - 14, wat, 0, h + 0.05, 0, 0.3); }
  cyl(g, 1.3, 1.3, 12, CHROME(), w / 2 - 8, h + 6, 0, 12); const sp = cyl(g, 1.1, 1.1, 12, CHROME(), w / 2 - 13, h + 11, 0, 10); sp.rotation.z = Math.PI / 2;
};
B.shower = (g, it) => {
  const { w, d, h, v } = it, gl = M('glass', '#CFE6F0'), ch = CHROME();
  if (v === 'panel') { box(g, w, h, 1, gl, 0, h / 2, 0).castShadow = false; box(g, w, 2.5, 3, ch, 0, h - 1.2, 0); box(g, w, 2.5, 3, ch, 0, 1.2, 0); return; }
  box(g, w, 5, d, M('ceramic', '#F1F1EF'), 0, 2.5, 0, 1);
  box(g, w, h - 5, 1, gl, 0, 5 + (h - 5) / 2, d / 2 - 0.5).castShadow = false; box(g, 1, h - 5, d, gl, w / 2 - 0.5, 5 + (h - 5) / 2, 0).castShadow = false;
  box(g, w, 2.5, 2.5, ch, 0, h - 1.2, d / 2 - 1.2); box(g, 2.5, 2.5, d, ch, w / 2 - 1.2, h - 1.2, 0); box(g, 2.5, h - 5, 2.5, ch, w / 2 - 1.2, 5 + (h - 5) / 2, d / 2 - 1.2);
  cyl(g, 1.2, 1.2, h - 17, ch, -w / 2 + 10, (h - 17) / 2 + 5, -d / 2 + 6, 10); cyl(g, 11, 11, 1.2, ch, -w / 2 + 10, h - 14, -d / 2 + 20, 20); const a = cyl(g, 1, 1, 16, ch, -w / 2 + 10, h - 13, -d / 2 + 13, 8); a.rotation.x = Math.PI / 2;
};
B.mirror = (g, it) => {
  const { w, d, h, v } = it;
  if (v === 'round') { const m = cyl(g, w / 2, w / 2, 2, DARK(), 0, h / 2, 0, 40); m.rotation.x = Math.PI / 2; const f = cyl(g, w / 2 - 1.5, w / 2 - 1.5, 0.5, M('mirror'), 0, h / 2, 1.2, 40); f.rotation.x = Math.PI / 2; return; }
  box(g, w, h, d, M('paint', '#F1EEE8'), 0, h / 2, 0); box(g, w - 1.5, h - 1.5, 0.5, M('mirror'), 0, h / 2, d / 2 + 0.2);
};
B.washer = (g, it) => {
  const { w, d, h, v } = it, wh = M('gloss', '#F3F3F1'), dk = M('gloss', '#1B1C1F');
  const bh = v === 'top' ? h - 9 : h;
  box(g, w, bh, d, wh, 0, bh / 2, 0, 1.5);
  const port = (y) => { const r = cyl(g, w * 0.3, w * 0.3, 2, STEEL(), 0, y, d / 2 + 0.6, 32); r.rotation.x = Math.PI / 2; const q = cyl(g, w * 0.24, w * 0.24, 2.4, dk, 0, y, d / 2 + 0.7, 32); q.rotation.x = Math.PI / 2; };
  if (v === 'top') { box(g, w - 8, 1.2, d - 18, dk, 0, bh + 0.3, 5, 0.4); box(g, w - 4, 9, 9, wh, 0, bh + 4.5, -d / 2 + 5, 1.5); }
  else if (v === 'stack') { port(h * 0.25); port(h * 0.75); box(g, w - 6, 5, 0.6, dk, 0, h * 0.5, d / 2 + 0.2); }
  else { port(h * 0.48); box(g, w - 6, 7, 0.6, dk, 0, h - 7, d / 2 + 0.2); }
};


// =====================================================================================
// 精緻版：鼓起的墊子、滾邊、抱枕、有皺褶的棉被與毯子、收細外斜的椅腳、格柵門片
// =====================================================================================
const mesh = (p, geo, m, x = 0, y = 0, z = 0) => { const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); me.castShadow = me.receiveShadow = true; p.add(me); return me; };
const rbox = (p, w, h, d, m, x, y, z, r = 1.5, s = 4) => mesh(p, new RoundedBoxGeometry(w, h, d, s, Math.max(0.05, Math.min(r, w / 2 - 0.01, h / 2 - 0.01, d / 2 - 0.01))), m, x, y, z);
function smooth(geo) {     // 位置相同的頂點共用法線，變形後表面仍然平滑
  const g = geo.index ? geo.toNonIndexed() : geo; g.computeVertexNormals();
  const p = g.attributes.position, n = g.attributes.normal, acc = new Map(), key = (i) => Math.round(p.getX(i) * 40) + '_' + Math.round(p.getY(i) * 40) + '_' + Math.round(p.getZ(i) * 40);
  for (let i = 0; i < p.count; i++) { const k = key(i), a = acc.get(k) || [0, 0, 0]; a[0] += n.getX(i); a[1] += n.getY(i); a[2] += n.getZ(i); acc.set(k, a); }
  for (let i = 0; i < p.count; i++) { const a = acc.get(key(i)), l = Math.hypot(a[0], a[1], a[2]) || 1; n.setXYZ(i, a[0] / l, a[1] / l, a[2] / l); }
  return g;
}
const loop = (p, pts, rad, m) => mesh(p, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true, 'centripetal'), pts.length * 2, rad, 5, true), m);
function rrPts(w, d, r, y) { const pts = []; r = Math.min(r, w / 2 - 0.1, d / 2 - 0.1); for (const [sx, sz, a0] of [[1, 1, 0], [-1, 1, 1], [-1, -1, 2], [1, -1, 3]]) for (let k = 0; k <= 5; k++) { const a = (a0 + k / 5) * Math.PI / 2; pts.push(new THREE.Vector3(sx * (w / 2 - r) + Math.cos(a) * r, y, sz * (d / 2 - r) + Math.sin(a) * r)); } return pts; }
function cushion(p, w, h, d, m, x, y, z, { r = 5, bulge = 0.2, pipe = true, sd = 1 } = {}) {
  const g = new THREE.Group(); g.position.set(x, y, z); p.add(g); r = Math.min(r, h / 2 - 0.01, w / 2 - 0.01, d / 2 - 0.01);
  const geo = new RoundedBoxGeometry(w, h, d, 8, r), pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) { const X = pos.getX(i), Y = pos.getY(i), Z = pos.getZ(i), u = X / (w / 2), v = Z / (d / 2), dome = (1 - u * u) * (1 - v * v), wr = (MT.fbm(X * 0.09 + sd, Z * 0.09 + sd * 2, 3) - 0.5) * 0.9;
    pos.setXYZ(i, X, Y + (Y > 0 ? bulge * h * dome + wr * dome : 0), Z); }
  mesh(g, smooth(geo), m);
  if (pipe) loop(g, rrPts(w - r * 0.5, d - r * 0.5, r * 0.8, h / 2 - r * 0.32), 0.42, m);
  return g;
}
function pillow(p, w, h, t, m, x, y, z, { seam = true, sd = 1 } = {}) {
  const g = new THREE.Group(); g.position.set(x, y, z); p.add(g);
  const geo = new THREE.SphereGeometry(1, 30, 20), pos = geo.attributes.position, sg = (v) => Math.sign(v) * Math.abs(v) ** 0.4;
  for (let i = 0; i < pos.count; i++) { const sx = sg(pos.getX(i)), sy = sg(pos.getY(i)), Z = pos.getZ(i), edge = Math.max(Math.abs(sx), Math.abs(sy)), cr = (MT.fbm(sx * 2.2 + sd, sy * 2.2 + sd * 3, 3) - 0.5) * 0.22;
    pos.setXYZ(i, sx * w / 2 * (1 - 0.05 * (1 - Math.abs(sy))), sy * h / 2 * (1 - 0.05 * (1 - Math.abs(sx))), Z * t / 2 * (0.5 + 0.5 * (1 - edge ** 3) + cr * (1 - edge))); }
  geo.computeVertexNormals(); mesh(g, geo, m);
  if (seam) { const pts = []; for (let k = 0; k < 48; k++) { const a = k / 48 * Math.PI * 2, cx = sg(Math.cos(a)), cy = sg(Math.sin(a)); pts.push(new THREE.Vector3(cx * w / 2 * (1 - 0.05 * (1 - Math.abs(cy))), cy * h / 2 * (1 - 0.05 * (1 - Math.abs(cx))), 0)); } loop(g, pts, 0.38, m); }
  return g;
}
const sideCache = new Map(), twoSided = (m) => { if (!sideCache.has(m)) { const c = m.clone(); c.side = THREE.DoubleSide; sideCache.set(m, c); } return sideCache.get(m); };
function cloth(p, w, d, m, x, y, z, { amp = 1.4, droop = 6, edge = 14, sd = 3, ends = true, seg = 52 } = {}) {
  const geo = new THREE.PlaneGeometry(w, d, seg, seg); geo.rotateX(-Math.PI / 2); const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) { const X = pos.getX(i), Z = pos.getZ(i), ex = Math.max(0, Math.abs(X) - (w / 2 - edge)) / edge, ez = ends ? Math.max(0, Math.abs(Z) - (d / 2 - edge)) / edge : Math.max(0, Z - (d / 2 - edge)) / edge;
    const wr = (MT.fbm(X * 0.035 + sd, Z * 0.022 + sd, 4) - 0.5) * 2.4 + (MT.fbm(X * 0.11 - sd, Z * 0.09, 3) - 0.5) * 0.9 + 0.5 * Math.sin(X * 0.09 + MT.fbm(X * 0.02, Z * 0.03, 2) * 6);
    const fall = Math.min(1.15, Math.max(ex * ex, ez * ez) + 0.35 * Math.min(ex * ex, ez * ez));
    pos.setXYZ(i, X + (ex > 0 ? -Math.sign(X) * ex * ex * edge * 0.75 : 0), amp * wr * (1 - 0.5 * Math.min(1, fall)) - droop * fall, Z + (ends && ez > 0 ? -Math.sign(Z) * ez * ez * edge * 0.75 : 0)); }
  geo.computeVertexNormals(); return mesh(p, geo, twoSided(m), x, y, z);
}
function tleg(p, len, rt, rb, m, x, z, splay = 0.12, cap = null) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.z = -Math.sign(x) * splay; g.rotation.x = Math.sign(z) * splay; p.add(g);
  mesh(g, new THREE.CylinderGeometry(rt, rb, len, 16), m, 0, len / 2, 0);
  if (cap) mesh(g, new THREE.CylinderGeometry(rb * 1.06, rb * 0.95, len * 0.16, 16), cap, 0, len * 0.08, 0);
  return g;
}
const lathe = (p, prof, m, x, y, z, seg = 32) => mesh(p, new THREE.LatheGeometry(prof.map(([r, yy]) => new THREE.Vector2(r, yy)), seg), m, x, y, z);
const woodOf = (f) => (f === 'marble' ? MT.marble('#EFEBE5') : M('wood', WOODS[f] || WOODS.oak));
const BRASSY = () => MT.metal('#B8955A', 0.3);
const OLD = { table: B.table, chair: B.chair, bed: B.bed, cab: B.cab };

B.sofa = (g, it, P, o) => {
  const { w, d, h, v } = it, fin = it.fin || (v === 'leather' ? 'leather' : 'linen'), lea = fin === 'leather', kind = fin === 'flannel' ? 'flannel' : fin === 'weave' ? 'herring' : 'linen', f = lea ? MT.leather(P.fabric) : MT.fabric(P.fabric, 5, kind), fc = lea ? f : MT.fabric(P.fabric, 3, kind), wm = woodOf(P.wood);
  if (v === 'stool') { for (const sx of [-1, 1]) for (const sz of [-1, 1]) tleg(g, 12, 2.4, 1.4, wm, sx * (w / 2 - 7), sz * (d / 2 - 7), 0.1, BRASSY()); cushion(g, w, h - 11, d, fc, 0, 11 + (h - 11) / 2, 0, { r: 6, bulge: 0.12 }); return; }
  const isL = v === 'L' || v === 'Lr', dm = isL ? 95 : d, arm = Math.max(12, Math.min(20, w * 0.09)), s = new THREE.Group(); s.position.z = -(d - dm) / 2; g.add(s);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) tleg(s, 14, 2.8, 1.5, wm, sx * (w / 2 - 11), sz * (dm / 2 - 10), 0.12, BRASSY());
  rbox(s, w - 3, 14, dm - 3, f, 0, 20.5, 0, 3.5, 5);
  rbox(s, w - 2, h - 32, 16, f, 0, 14 + (h - 32) / 2 + 4, -dm / 2 + 9, 7.5, 6);
  for (const sx of [-1, 1]) rbox(s, arm, h - 38, dm - 1, f, sx * (w / 2 - arm / 2), 14 + (h - 38) / 2 + 3.5, 0, Math.min(9, arm / 2 - 0.5), 6);
  const inner = w - 2 * arm, n = Math.max(1, Math.round(inner / 72)), cw = inner / n;
  for (let i = 0; i < n; i++) {
    const x = -inner / 2 + cw * (i + 0.5);
    cushion(s, cw - 0.6, 15, dm - 23, fc, x, 35, 10.5, { r: 5.5, sd: i * 5 + 1 });
    const b = cushion(s, cw - 2.5, 18, h - 47, fc, x, 40.5 + (h - 47) / 2, -dm / 2 + 26, { r: 7.5, bulge: 0.3, sd: i * 3 + 9 }); b.rotation.x = Math.PI / 2 - 0.22;
  }
  if (isL) { const cwid = 92, sx = v === 'L' ? 1 : -1, x = sx * (w / 2 - arm - cwid / 2), z = dm / 2 + (d - dm) / 2; rbox(s, cwid, 14, d - dm + 2, f, x, 20.5, z, 3.5, 5); cushion(s, cwid - 1, 15, d - dm, fc, x, 35, z + 0.5, { r: 5.5, sd: 21 }); for (const zz of [-1, 1]) tleg(s, 14, 2.8, 1.5, wm, x + sx * (cwid / 2 - 10), z + zz * ((d - dm) / 2 - 9) + 0.01, 0.1, BRASSY()); }
  if (o.decor && w >= 140) {
    pillow(s, 46, 46, 17, MT.fabric(P.accent, 5), -inner / 2 + 25, 64, -dm / 2 + 41, { sd: 2 }).rotation.set(-0.3, 0.28, 0.1);
    pillow(s, 42, 42, 15, MT.fabric('#EAE3D5', 2, 'boucle'), -inner / 2 + 54, 61, -dm / 2 + 45, { sd: 5 }).rotation.set(-0.34, -0.12, -0.13);
    if (w >= 190) pillow(s, 54, 30, 14, MT.fabric(shade(P.fabric, 0.62), 5), inner / 2 - 32, 58, -dm / 2 + 43, { sd: 8 }).rotation.set(-0.32, -0.22, 0.05);
    if (w >= 190 && !isL) cloth(s, arm + 22, 76, MT.fabric('#E9E2D4', 5, 'knit'), w / 2 - arm / 2 - 1, 14 + h - 38 + 5.2, 4, { amp: 0.35, droop: 22, edge: 12, sd: 11, seg: 36 });
  }
};

B.bed = (g, it, P, o) => {
  const { w, d, h, v } = it; if (v === 'bunk') return OLD.bed(g, it, P);
  const soft = v === 'soft', wm = woodOf(P.wood), linen = MT.fabric('#F4F1EA', 5), duv = MT.fabric(soft ? '#EBE6DB' : shade(it.color || '#E3DED4', 1.08), 5), hb = MT.fabric(it.color || '#B9B2A4', 2), accent = MT.fabric(P.accent, 6, 'knit');
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) tleg(g, 13, 3.2, 2.2, wm, sx * (w / 2 - 8), sz * (d / 2 - 9), 0.05, BRASSY());
  rbox(g, w, 15, d, soft ? hb : wm, 0, 20.5, 0, 3, 5);
  if (soft) { rbox(g, w, h - 8, 5, hb, 0, 8 + (h - 8) / 2, -d / 2 + 2.5, 2.2); const n = Math.max(3, Math.round(w / 23)), pw = (w - 2) / n; for (let i = 0; i < n; i++) cushion(g, pw - 0.3, 8, h - 38, hb, -(w - 2) / 2 + pw * (i + 0.5), 36 + (h - 38) / 2, -d / 2 + 8, { r: 3.8, bulge: 0.28, pipe: false, sd: i * 2 }).rotation.x = Math.PI / 2; }
  else rbox(g, w, h - 6, 6, wm, 0, 6 + (h - 6) / 2, -d / 2 + 3, 2.4);
  const hd = soft ? 13 : 7, md = d - hd - 3, mz = -d / 2 + hd + md / 2 + 1, mw = w - 6;
  rbox(g, mw, 25, md, linen, 0, 40.5, mz, 9, 6); loop(g, rrPts(mw - 3, md - 3, 8, 49.5).map((p) => p.setZ(p.z + mz)), 0.4, linen);
  cloth(g, mw + 5, md * 0.7, duv, 0, 55.2, mz + md * 0.15, { amp: 1.5, droop: 20, edge: 13, sd: 4, ends: false });
  cloth(g, mw + 3, 32, linen, 0, 56.6, mz - md * 0.2, { amp: 0.8, droop: 18, edge: 11, sd: 7, seg: 36 });
  cloth(g, mw + 6, 50, accent, 0, 57.6, mz + md / 2 - 34, { amp: 1.2, droop: 21, edge: 14, sd: 5 });
  const np = w >= 140 ? 2 : 1, top = mz - md / 2;
  for (let i = 0; i < np; i++) {
    const sx = np === 2 ? (i ? 1 : -1) : 0, px = sx * (mw / 4 - 0.5), pw = np === 2 ? mw / 2 - 12 : mw - 20;
    pillow(g, pw, 44, 18, linen, px, 60, top + 27, { seam: false, sd: i + 3 }).rotation.x = -Math.PI / 2 + 0.36;
    if (o.decor && w >= 110) pillow(g, 46, 46, 16, MT.fabric(i ? '#D8CCB8' : P.accent, i ? 2 : 5, i ? 'boucle' : 'linen'), np === 2 ? sx * (mw / 4 - 7) : -8, 69, top + 48, { sd: i * 4 + 6 }).rotation.set(-0.52, sx * 0.14, sx * 0.07);
  }
  if (o.decor && w >= 140) pillow(g, 58, 27, 14, MT.fabric(shade(it.color || '#8E9AA6', 0.7), 5), 3, 62.5, top + 67, { sd: 13 }).rotation.x = -0.62;
};

function vase(g, x, y, z, s = 1, color = '#D9D2C4', stems = 0) {
  lathe(g, [[0.1, 0], [5.4 * s, 0], [7.6 * s, 5.5 * s], [7 * s, 13 * s], [3 * s, 20 * s], [2.4 * s, 25 * s], [3.4 * s, 27.5 * s]], MT.ceramic(color), x, y, z);
  for (let i = 0; i < stems; i++) { const a = i * 0.72 + 0.3, t = 0.18 + (i % 3) * 0.08, L = (34 + (i % 4) * 5) * s, st = mesh(g, new THREE.CylinderGeometry(0.18, 0.28, L, 5), MT.flat('#6B5A3E'), x + Math.cos(a) * L * t * 0.5, y + 26 * s + L * 0.48, z + Math.sin(a) * L * t * 0.5); st.rotation.set(Math.sin(a) * t, 0, -Math.cos(a) * t);
    for (let j = 0; j < 5; j++) { const yy = 0.35 + j * 0.14, lf = mesh(g, new THREE.SphereGeometry(2.4 * s, 8, 6), MT.flat(['#55803F', '#456E38', '#6C9655'][(i + j) % 3], 0.55), x + Math.cos(a) * L * t * yy * 1.05 + Math.cos(a + j * 2.4) * 2.6, y + 26 * s + L * yy, z + Math.sin(a) * L * t * yy * 1.05 + Math.sin(a + j * 2.4) * 2.6); lf.scale.set(1, 0.18, 0.5); lf.rotation.set(0.4 * Math.sin(j), a + j * 2.4, 0.5); } }
}
function books(g, x, y, z, n = 3, ry = 0) { for (let i = 0; i < n; i++) rbox(g, 26 - i * 2, 2.6, 19 - i, MT.flat(['#E9E2D6', '#5E6B7A', '#C9B8A0', '#7C8471'][i % 4], 0.85), x, y + 1.3 + i * 2.6, z, 0.5).rotation.y = ry + i * 0.13; }

B.table = (g, it, P, o) => {
  const { w, d, v } = it; if (v === 'stoolseat' || v === 'fmirror') return OLD.table(g, it, P);
  const h = v === 'mirror' ? 75 : it.h, f = it.color, marble = f === 'marble', painted = f === 'white' || f === 'black' || f === 'gray', top = marble ? MT.marble('#EFEBE5') : painted ? MT.gloss(WOODS[f]) : MT.wood(WOODS[f] || WOODS.oak, { rings: 6, gloss: 0.45 }), lg = marble ? BRASSY() : f === 'black' ? MT.metal('#1E1E20', 0.45) : woodOf(f), low = h < 62;
  if (v === 'round') {
    mesh(g, new THREE.CylinderGeometry(w / 2, w / 2 - 1.2, 3, 56), top, 0, h - 1.5, 0).scale.z = d / w;
    if (!low) { lathe(g, [[0.1, 0], [w * 0.27, 0], [w * 0.25, 2.5], [5, 6], [4, h * 0.5], [6.5, h - 5], [w * 0.16, h - 3]], lg, 0, 0, 0).scale.z = d / w; }
    else for (let i = 0; i < 3; i++) { const a = i * 2.094 + 0.5, L = tleg(g, h - 3, 2, 1.2, lg, Math.cos(a) * w * 0.3, Math.sin(a) * d * 0.3, 0, null); L.rotation.set(Math.sin(a) * 0.14, 0, -Math.cos(a) * 0.14); }
  } else {
    rbox(g, w, 2.8, d, top, 0, h - 1.4, 0, 1.2, 3);
    if (!low) rbox(g, w - 30, 6, d - 30, lg, 0, h - 5.8, 0, 1);
    const ix = low ? 8 : 15, iz = low ? 8 : 14, rt = low ? 2.2 : 3.3, rb = low ? 1.3 : 1.7;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) tleg(g, h - 2.8, rt, rb, lg, sx * Math.max(4, w / 2 - ix), sz * Math.max(4, d / 2 - iz), w > 60 ? 0.1 : 0.05, null);
    if (low && w > 60) rbox(g, w - 15, 1.8, d - 15, top, 0, 13, 0, 0.8);
    if (it.cat === 'desk') { rbox(g, w * 0.3, 11, d - 14, lg, w / 2 - w * 0.15 - 12, h - 8.3, 0, 0.8); rbox(g, 10, 1, 1.6, BRASSY(), w / 2 - w * 0.15 - 12, h - 8.3, d / 2 - 6.4, 0.3); }
    if (it.cat === 'dresser' && w >= 70) for (const sx of [-1, 1]) { rbox(g, w * 0.28, 9, d - 10, lg, sx * w * 0.27, h - 7.3, 0, 0.8); rbox(g, 8, 1, 1.6, BRASSY(), sx * w * 0.27, h - 7.3, d / 2 - 4.4, 0.3); }
    if (v === 'mirror') { const mh = it.h - h, mm = mesh(g, new THREE.CylinderGeometry(w * 0.3, w * 0.3, 2.2, 48), BRASSY(), 0, h + mh / 2, -d / 2 + 1.6); mm.rotation.x = Math.PI / 2; mm.scale.z = 1; mm.scale.y = 1; mm.scale.x = 1; mm.scale.set(1, 1, mh / (w * 0.6)); const mf = mesh(g, new THREE.CylinderGeometry(w * 0.3 - 1.4, w * 0.3 - 1.4, 0.5, 48), MT.mirror(), 0, h + mh / 2, -d / 2 + 2.9); mf.rotation.x = Math.PI / 2; mf.scale.set(1, 1, (mh - 2.8) / (w * 0.6 - 2.8)); }
  }
  if (!o.decor) return;
  if (it.cat === 'dtable') {
    if (v !== 'round') mesh(g, new THREE.BoxGeometry(Math.min(38, w * 0.3), 0.25, d - 4), MT.fabric('#A9A294', 1), 0, h + 0.13, 0);
    vase(g, 0, h + 0.25, 0, 1, '#D9D2C4', 8);
    if (w >= 110) for (const [x, z] of [[-w / 4, -d / 4 - 3], [w / 4, d / 4 + 3]]) { lathe(g, [[0, 0.5], [7.5, 0.5], [12.5, 2.2], [13, 2.6], [7.5, 1.1], [0, 1.1]], MT.ceramic('#EEEAE2'), x, h - 0.5, z); lathe(g, [[0, 0.5], [4.5, 0.5], [7, 3.6], [7.3, 3.8], [4.5, 1], [0, 1]], MT.ceramic('#3F5A54'), x, h + 0.1, z); }
  } else if (it.cat === 'coffee' && w >= 80) { books(g, -w * 0.16, h, d * 0.05, 2, 0.3); vase(g, w * 0.2, h, -d * 0.1, 0.5, '#3F5A54'); }
  else if (it.cat === 'side' || it.cat === 'nstand') vase(g, 0, h, 0, 0.42, '#EEEAE2');
};

B.chair = (g, it, P, o) => {
  const { w, d, h, v } = it; if (v === 'bench') return OLD.chair(g, it, P);
  const hexc = it.color && it.color[0] === '#', wm = hexc ? woodOf(P.wood) : woodOf(it.color), f = MT.fabric(hexc ? it.color : '#D9D3C6', 2, 'boucle'), sh = v === 'bar' ? 71 : 44.5;
  for (const sx of [-1, 1]) { tleg(g, sh, 2, 1.15, wm, sx * (w / 2 - 4.5), d / 2 - 5.5, 0.07, null); const b = mesh(g, new THREE.CylinderGeometry(1.35, 1.15, h + 2, 14), wm, sx * (w / 2 - 4.5), h / 2 - 0.5, -d / 2 + 6); b.rotation.x = -0.1; b.rotation.z = -sx * 0.03; }
  rbox(g, w - 5, 3.2, d - 8, wm, 0, sh - 0.5, 0, 1.4); rbox(g, w - 12, 2.4, 2.4, wm, 0, sh * 0.62, d / 2 - 6.5, 1); for (const sx of [-1, 1]) rbox(g, 2.2, 2.4, d - 14, wm, sx * (w / 2 - 5), sh * 0.55, 0, 1);
  if (v === 'bar') rbox(g, w - 10, 1.6, 1.6, MT.metal('#AEB3B8'), 0, 26, d / 2 - 5.6, 0.6);
  if (v !== 'bar' || true) cushion(g, w - 4, v === 'pad' ? 6 : 3.2, d - 8, v === 'pad' || v === 'bar' ? f : wm, 0, sh + (v === 'pad' ? 3.9 : 2.4), 0.6, { r: v === 'pad' ? 2.7 : 1.4, bulge: v === 'pad' ? 0.35 : 0.1, pipe: v === 'pad' });
  const bh = Math.min(22, (h - sh) * 0.5), bend = (geo) => { const pos = geo.attributes.position; for (let i = 0; i < pos.count; i++) { const x = pos.getX(i); pos.setZ(i, pos.getZ(i) + 0.013 * x * x); } return smooth(geo); };
  // 椅背柱往後斜，椅背板兩端往前彎：算出柱子在椅背高度的位置，讓板子兩端剛好嵌進柱子
  const by = h - bh / 2 - 1, postZ = -d / 2 + 6 - Math.tan(0.1) * (by - (h / 2 - 0.5)), e = 0.013 * ((w - 5) / 2 - 2) ** 2, bz = postZ - e;
  mesh(g, bend(new RoundedBoxGeometry(w - 5, bh, 2.8, 4, 1.2)), wm, 0, by, bz).rotation.x = -0.1;
  if (v === 'pad') mesh(g, bend(new RoundedBoxGeometry(w - 9, bh - 5, 3.4, 4, 1.6)), f, 0, by, bz + 1.7).rotation.x = -0.1;
};

B.rug = (g, it) => {
  const { w, d, v } = it, m = MT.rugPile(it.color || '#D8D2C6');
  if (v === 'round') { const r = mesh(g, new THREE.CylinderGeometry(w / 2, w / 2, 1.2, 64), m, 0, 0.6, 0); r.castShadow = false; return; }
  rbox(g, w, 1.2, d, m, 0, 0.6, 0, 0.5, 2).castShadow = false;
};

B.tv = (g, it) => { const { w, h } = it; rbox(g, w, h, 2.2, MT.flat('#0C0D0F', 0.3), 0, h / 2, 0, 0.7); mesh(g, new THREE.PlaneGeometry(w - 3.6, h - 3.6), MT.gloss('#05070A'), 0, h / 2, 1.15).userData.screen = true; };   // 四周留 1.8cm 黑框；screen 標記給導覽播影片用

B.cab = (g, it, P, o) => {
  if (it.cat !== 'tvcab' || it.v === 'float') { OLD.cab(g, it, P); if (o.decor && it.cat === 'chest' && it.h < 110) { vase(g, -it.w * 0.22, it.h, 0, 0.55, '#3F5A54'); books(g, it.w * 0.2, it.h, 0, 2, -0.1); } return; }
  const { w, d, h } = it, f = it.color, wm = woodOf(f === 'marble' ? 'walnut' : f), top = f === 'marble' ? MT.marble('#EFEBE5') : f === 'white' || f === 'black' || f === 'gray' ? MT.gloss(WOODS[f]) : MT.wood(WOODS[f] || WOODS.oak, { rings: 5, gloss: 0.5 }), dk = MT.metal('#1E1E20', 0.45), L = 13, T = 2;
  for (const sx of [-1, 1]) { rbox(g, 2.4, L, 2.4, dk, sx * (w / 2 - 14), L / 2, d / 2 - 6, 0.5); rbox(g, 2.4, L, 2.4, dk, sx * (w / 2 - 14), L / 2, -d / 2 + 6, 0.5); rbox(g, 2.4, 2, d - 10, dk, sx * (w / 2 - 14), 1, 0, 0.5); }
  const bh = h - L - 2.5, by = L + bh / 2, open = Math.min(52, w * 0.3), dw = w - open - 3, x0 = -w / 2 + 1.5, nx = w / 2 - open / 2 - 1.2;
  rbox(g, w, T, d - 1, wm, 0, L + T / 2, -0.5, 0.5); rbox(g, w, bh, T, wm, 0, by, -d / 2 + T / 2, 0.5); for (const x of [-w / 2 + T / 2, w / 2 - T / 2, w / 2 - open - 1.5]) rbox(g, T, bh, d - 1, wm, x, by, -0.5, 0.5);
  rbox(g, w + 1.6, 2.5, d + 1, top, 0, h - 1.25, 0, 1.1);
  rbox(g, dw, bh - 4, 1, MT.flat(shade(WOODS[f] || WOODS.oak, 0.4), 0.7), x0 + dw / 2, by, d / 2 - 1.6, 0.3);
  for (let x = 0.95; x < dw; x += 2.3) { if (Math.abs(x - dw / 2) < 1) continue; mesh(g, new THREE.CylinderGeometry(0.9, 0.9, bh - 4, 8), wm, x0 + x, by, d / 2 - 0.75); }
  for (const s of [-1, 1]) rbox(g, 0.9, 9, 1.6, BRASSY(), x0 + dw / 2 + s * 2.6, by + 4, d / 2 + 0.6, 0.3);
  rbox(g, open - 1.2, 1.4, d - 5, wm, w / 2 - open / 2 - 1.25, by + 0.5, 0, 0.4);
  if (!o.decor) return;
  let bx = nx - open / 2 + 3; for (const [bw, hh, c] of [[3.2, 13, '#B5654A'], [2.6, 14, '#EDE6D8'], [4, 12.5, '#2F3E5C'], [3, 14, '#7C8471'], [2.4, 12, '#C8A464']]) { if (bx + bw > nx + open / 2 - 12 || hh > bh / 2 - 3) continue; rbox(g, bw, hh, 18, MT.flat(c, 0.8), bx + bw / 2, by + 1.2 + hh / 2, d / 2 - 12, 0.4); bx += bw + 0.25; }
  vase(g, -w / 2 + 22, h, 2, 1.05, '#3F5A54'); vase(g, -w / 2 + 40, h, -4, 0.58, '#EEEAE2'); books(g, w / 2 - 30, h, 1, 3, -0.1);
};

// 建立一件家具。style = STYLES[風格]；opts.decor = 是否附上抱枕、毯子、花瓶等擺飾
export function buildItem(it, style, opts = {}) {
  const g = new THREE.Group(), o = Object.assign({ decor: true }, opts);
  const hex = it.color && it.color[0] === '#';
  const P = { wood: style.woods[0] === 'marble' ? 'walnut' : style.woods[0], fabric: hex ? it.color : style.fabrics[0], accent: style.accent };
  const spec = Object.assign({}, it, { styled: false });
  (B[it.t] || ((gg) => box(gg, it.w, it.h, it.d, M('paint', '#CCCCCC'), 0, it.h / 2, 0)))(g, spec, P, o);
  g.scale.setScalar(0.01);
  return g;
}

const mm = new Map(), memoMat = (k, f) => (mm.has(k) ? mm.get(k) : (mm.set(k, f()), mm.get(k)));
// ---------- 模擬人偶：穿衣服、有五官（簡約可愛臉），會站、坐、躺 ----------
const HT = {
  m: { head: 0.130, sh: 0.128, hip: 0.090, waist: 0.080, chest: 0.105, crotch: 0.47, shY: 0.815, limb: 1.0, c: ['#DDB493', '#4F6D8F', '#3A3F4A', '#2A2B2D', '#2E2622'] },
  f: { head: 0.132, sh: 0.112, hip: 0.098, waist: 0.068, chest: 0.095, crotch: 0.47, shY: 0.812, limb: 0.88, c: ['#E6C2A6', '#C98274', '#E9E2D6', '#8A6A4F', '#4A3328'] },
  c: { head: 0.185, sh: 0.115, hip: 0.095, waist: 0.088, chest: 0.100, crotch: 0.42, shY: 0.765, limb: 1.05, c: ['#E8C5A8', '#E3B23C', '#5E7FA3', '#F2F2F0', '#3A2A20'] },
};
// 把人偶校正成剛好等於標示身高（含頭髮與鞋底），腳底貼地
const PK = {};
export function buildPerson(spec, pose) {
  if (!PK[spec.v]) { const b = new THREE.Box3().setFromObject(rawPerson(spec, { mode: 'stand' })); PK[spec.v] = { k: spec.h * 0.01 / (b.max.y - b.min.y), y0: b.min.y * 100 }; }
  const g = rawPerson(spec, pose), { k, y0 } = PK[spec.v];
  g.scale.multiplyScalar(k); if (pose.mode === 'stand') g.children[0].position.y -= y0;
  return g;
}
function rawPerson(spec, pose) {
  const type = spec.v, T = HT[type], H = spec.h, g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const skin = MT.flat(T.c[0], 0.6), topM = MT.fabric(T.c[1], 3), bot = MT.fabric(T.c[2], 3), shoe = MT.flat(T.c[3], 0.7), hair = MT.flat(T.c[4], 0.8);
  const add = (p, geo, m, x = 0, y = 0, z = 0) => mesh(p, geo, m, x, y, z), sph = (p, r, m, x, y, z) => add(p, new THREE.SphereGeometry(r, 18, 12), m, x, y, z);
  const seg = (p, r1, r2, len, m) => add(p, new THREE.CylinderGeometry(r1, r2, len, 16), m, 0, -len / 2, 0);
  const L = T.limb, crotch = T.crotch * H, torsoH = T.shY * H - crotch, sit = pose.mode === 'sit', base = sit ? pose.seat + 0.045 * H : crotch;
  const prof = (pts) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r * H, y * torsoH)), 24);
  add(body, prof([[0.001, -0.10], [T.hip * 0.75, -0.07], [T.hip, 0.02], [T.hip * 0.98, 0.14], [T.waist * 1.05, 0.30]]), bot, 0, base, 0).scale.z = 0.66;
  add(body, prof([[T.waist * 1.05, 0.30], [T.waist, 0.42], [T.chest, 0.70], [T.sh * 0.92, 0.90], [T.sh * 0.80, 0.985], [0.034, 1.04], [0.03, 1.06]]), topM, 0, base, 0).scale.z = type === 'f' ? 0.66 : 0.62;
  const hh = T.head * H, headY = H - hh / 2 + (sit ? base - crotch : 0);
  add(body, new THREE.CylinderGeometry(0.027 * H, 0.031 * H, 0.06 * H, 14), skin, 0, base + torsoH * 1.06, 0);
  const hg = new THREE.Group(); hg.position.set(0, headY, 0.004 * H); body.add(hg);
  const r = hh / 2, ea = 0.78 * r, ec = 0.9 * r, kid = type === 'c', surf = (x, y) => ec * Math.sqrt(Math.max(0, 1 - (x / ea) ** 2 - (y / r) ** 2));
  const part = (geo, m, x, y, z, sx = 1, sy = 1, sz = 1) => { const me = add(hg, geo, m, x, y, z); me.scale.set(sx, sy, sz); me.castShadow = false; return me; }, S = (rad) => new THREE.SphereGeometry(rad, 16, 10);
  part(new THREE.SphereGeometry(r, 24, 18), skin, 0, 0, 0, 0.78, 1, 0.9).castShadow = true;
  const dark = MT.flat('#2A211D', 0.25), lip = MT.flat(type === 'm' ? '#B8766A' : '#C96A66', 0.5), blush = memoMat('blush', () => new THREE.MeshStandardMaterial({ color: '#F0A79B', roughness: 0.8, transparent: true, opacity: 0.55 }));
  const ey = kid ? -0.10 * r : -0.02 * r, ex = 0.38 * ea, es = kid ? 1.25 : 1, ny = ey - 0.22 * r, my = ny - 0.26 * r;
  for (const sx of [-1, 1]) {
    part(S(0.13 * r), skin, sx * ea * 0.97, ey - 0.05 * r, -0.06 * r, 0.4, 1, 0.7);
    part(S(0.085 * r * es), dark, sx * ex, ey, surf(ex, ey) - 0.01 * r, 1, 1.25, 0.5);
    const b = part(new THREE.BoxGeometry(0.24 * r, 0.035 * r, 0.035 * r), hair, sx * ex, ey + 0.23 * r * es, surf(ex, ey + 0.2 * r) - 0.005 * r); b.rotation.z = -sx * 0.1; b.rotation.y = sx * 0.3;
    part(S(0.09 * r), blush, sx * 0.55 * ea, ny - 0.02 * r, surf(0.55 * ea, ny) - 0.06 * r, 1.2, 0.8, 0.3);
  }
  part(S(0.06 * r), skin, 0, ny, surf(0, ny) + 0.02 * r);
  const arc = Math.PI * 0.62; part(new THREE.TorusGeometry(0.15 * r, 0.02 * r, 6, 14, arc), lip, 0, my + 0.13 * r, surf(0, my) - 0.01 * r).rotation.z = -Math.PI / 2 - arc / 2;
  const cap = (th, rx, sc = 1.07) => { const h = part(new THREE.SphereGeometry(r * sc, 24, 14, 0, Math.PI * 2, 0, th), hair, 0, 0.03 * r, -0.03 * r, 0.8, 1, 0.93); h.rotation.x = rx; h.castShadow = true; };
  if (type === 'm') { cap(Math.PI * 0.5, -0.42); part(S(0.3 * r), hair, 0.12 * r, 0.82 * r, 0.52 * r, 1.9, 0.5, 0.9).rotation.z = -0.15; }
  else if (type === 'f') { cap(Math.PI * 0.52, -0.5, 1.09); part(S(r), hair, 0, -0.35 * r, -0.5 * r, 0.82, 1.2, 0.5); for (const sx of [-1, 1]) part(S(0.3 * r), hair, sx * 0.66 * r, -0.2 * r, 0.02 * r, 0.4, 2.2, 0.75); part(S(0.4 * r), hair, -0.2 * r, 0.72 * r, 0.5 * r, 1.5, 0.5, 0.8).rotation.z = 0.35; }
  else { cap(Math.PI * 0.5, -0.36, 1.08); part(S(0.42 * r), hair, 0, 0.62 * r, 0.56 * r, 1.55, 0.55, 0.7); }
  for (const sx of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(sx * T.sh * H * 0.84, base + torsoH * 0.93, 0); sh.rotation.z = sx * 0.09; sh.rotation.x = sit ? -0.35 : 0.04; body.add(sh);
    sph(sh, 0.036 * H * L, topM, 0, 0, 0); const ua = 0.165 * H, fa = 0.145 * H;
    seg(sh, 0.033 * H * L, 0.027 * H * L, ua, skin); add(sh, new THREE.CylinderGeometry(0.036 * H * L, 0.034 * H * L, ua * (type === 'm' ? 0.62 : 0.4), 16), topM, 0, -ua * (type === 'm' ? 0.31 : 0.2), 0);
    const el = new THREE.Group(); el.position.y = -ua; el.rotation.x = sit ? -1.0 : -0.12; sh.add(el);
    sph(el, 0.027 * H * L, skin, 0, 0, 0); seg(el, 0.026 * H * L, 0.019 * H * L, fa, skin); sph(el, 0.03 * H, skin, 0, -fa - 0.025 * H, 0).scale.set(0.45, 1, 0.8);
    const th = crotch * 0.50, shn = crotch * 0.50 - 0.035 * H, hip = new THREE.Group(); hip.position.set(sx * T.hip * H * 0.55, base, 0); hip.rotation.x = sit ? -Math.PI / 2 : 0; body.add(hip);
    seg(hip, 0.052 * H * L, 0.038 * H * L, th, bot);
    const knee = new THREE.Group(); knee.position.y = -th; knee.rotation.x = sit ? Math.PI / 2 : 0; hip.add(knee);
    sph(knee, 0.038 * H * L, bot, 0, 0, 0); seg(knee, 0.037 * H * L, 0.024 * H * L, shn, type === 'f' ? skin : bot);
    sph(knee, 0.04 * H, shoe, 0, -shn - 0.012 * H, 0.03 * H).scale.set(0.62, 0.5, 1.55);
  }
  if (pose.mode === 'lie') { body.rotation.x = -Math.PI / 2; body.position.set(0, 0.075 * H, H / 2); }
  g.scale.setScalar(0.01);
  return g;
}
