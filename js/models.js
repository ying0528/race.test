// 以程式產生的 3D 家具模型。每件家具都依型錄的實際尺寸（cm）建模，再整體縮成公尺。
import * as THREE from 'three';
import { RoundedBoxGeometry } from '../vendor/RoundedBoxGeometry.js';
import { WOODS } from './catalog.js';

// ---------- 程序化貼圖 ----------
const texCache = new Map();
function rnd(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
function shade(hex, f) {
  const c = new THREE.Color(hex); c.multiplyScalar(f); return '#' + c.getHexString();
}
export function makeTex(kind, color, rep = 1) {
  const key = kind + color;
  if (texCache.has(key)) return texCache.get(key);
  const S = kind === 'floorwood' ? 1024 : 512;
  const cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d'); const R = rnd(kind.length * 977 + parseInt(color.slice(1), 16) % 9973 + 7);
  g.fillStyle = color; g.fillRect(0, 0, S, S);
  if (kind === 'wood') {
    for (let i = 0; i < 260; i++) {
      const y = R() * S, a = 0.03 + R() * 0.07;
      g.strokeStyle = R() < 0.6 ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a})`;
      g.lineWidth = 0.5 + R() * 2; g.beginPath(); g.moveTo(0, y);
      for (let x = 0; x <= S; x += 64) g.lineTo(x, y + Math.sin(x / 90 + i) * 2.5);
      g.stroke();
    }
  } else if (kind === 'floorwood') {
    const pw = S / 16, pl = S / 2;            // 一張貼圖 = 2.4m：木板 15cm × 120cm
    for (let r = 0; r < 16; r++) {
      const off = R() * pl;
      for (let k = -1; k < 3; k++) {
        const x = k * pl + off, f = 0.9 + R() * 0.2;
        g.fillStyle = shade(color, f); g.fillRect(x, r * pw, pl, pw);
        for (let i = 0; i < 9; i++) {
          g.strokeStyle = `rgba(0,0,0,${0.02 + R() * 0.05})`; g.lineWidth = 0.6 + R();
          const yy = r * pw + R() * pw; g.beginPath(); g.moveTo(x, yy); g.lineTo(x + pl, yy + (R() - 0.5) * 3); g.stroke();
        }
        g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(x, r * pw, 1.2, pw);
      }
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, r * pw, S, 1.2);
    }
  } else if (kind === 'fabric') {
    const im = g.getImageData(0, 0, S, S), d = im.data;
    for (let i = 0; i < d.length; i += 4) { const n = (R() - 0.5) * 22; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    g.putImageData(im, 0, 0);
    g.strokeStyle = 'rgba(255,255,255,0.035)'; g.lineWidth = 1;
    for (let i = 0; i < S; i += 4) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, S); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(S, i); g.stroke(); }
  } else if (kind === 'marble' || kind === 'floormarble') {
    for (let i = 0; i < 14; i++) {
      g.strokeStyle = `rgba(90,90,100,${0.05 + R() * 0.12})`; g.lineWidth = 0.6 + R() * 2.2;
      let x = R() * S, y = R() * S; g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 7; k++) { x += (R() - 0.3) * 150; y += (R() - 0.5) * 130; g.lineTo(x, y); }
      g.stroke();
    }
    if (kind === 'floormarble') { g.strokeStyle = 'rgba(0,0,0,0.16)'; g.lineWidth = 2; g.strokeRect(0, 0, S / 2, S / 2); g.strokeRect(S / 2, 0, S / 2, S / 2); g.strokeRect(0, S / 2, S / 2, S / 2); g.strokeRect(S / 2, S / 2, S / 2, S / 2); }
  } else if (kind === 'tile') {
    g.strokeStyle = 'rgba(0,0,0,0.22)'; g.lineWidth = 6; g.strokeRect(0, 0, S, S);
    const im = g.getImageData(0, 0, S, S), d = im.data;
    for (let i = 0; i < d.length; i += 4) { const n = (R() - 0.5) * 8; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    g.putImageData(im, 0, 0);
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.repeat.set(rep, rep);
  texCache.set(key, t); return t;
}

// ---------- 材質 ----------
const matCache = new Map();
export function M(kind, color = '#FFFFFF') {
  const key = kind + color;
  if (matCache.has(key)) return matCache.get(key);
  let m;
  const S = (o) => new THREE.MeshStandardMaterial(o);
  switch (kind) {
    case 'wood': m = S({ map: makeTex('wood', color), roughness: 0.55 }); break;
    case 'fabric': m = S({ map: makeTex('fabric', color), roughness: 0.96 }); break;
    case 'leather': m = S({ color, roughness: 0.42 }); break;
    case 'marble': m = S({ map: makeTex('marble', color), roughness: 0.18 }); break;
    case 'metal': m = S({ color, metalness: 1, roughness: 0.32 }); break;
    case 'mirror': m = S({ color: '#E8EEF2', metalness: 1, roughness: 0.03 }); break;
    case 'ceramic': m = S({ color, roughness: 0.12 }); break;
    case 'gloss': m = S({ color, roughness: 0.18 }); break;
    case 'glass': m = new THREE.MeshPhysicalMaterial({ color, roughness: 0.04, transparent: true, opacity: 0.22, depthWrite: false }); break;
    case 'emit': m = S({ color, emissive: color, emissiveIntensity: 0.9, roughness: 0.8 }); break;
    case 'leaf': m = S({ color, roughness: 0.6 }); break;
    default: m = S({ color, roughness: 0.62 });
  }
  matCache.set(key, m); return m;
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
  const { w, d, h, v } = it;
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
  if (v === 'mirror') { box(g, w * 0.62, 62, 2.5, top, 0, h + 31, -d / 2 + 2); box(g, w * 0.62 - 5, 57, 0.6, M('mirror'), 0, h + 31, -d / 2 + 3.5); }
};

B.cab = (g, it, P) => {
  const { w, d, h, v } = it;
  const f = it.styled ? (it.cat === 'ward' || it.cat === 'shoe' ? 'white' : P.wood) : it.color, m = finish(f);
  const tall = h >= 120, float = v === 'float';
  const lh = float ? 0 : tall ? 6 : (it.cat === 'shoe' || h > 70) ? 8 : 12;
  if (!float) { if (tall || lh <= 8) box(g, w - 6, lh, d - 8, DARK(), 0, lh / 2, -1); else legs4(g, w, d, lh, f === 'black' ? DARK() : m, 3, 3.5, true); }
  const bh = h - lh;
  box(g, w, bh, d - 2, m, 0, lh + bh / 2, -1);
  if (!tall) box(g, w + 1, 2, d + 0.5, m, 0, h - 1, 0);
  const hm = f === 'black' ? BRASS() : STEEL();
  if (v === 'drawer') {
    const rows = Math.max(2, Math.round(bh / 24)), rh = (bh - 3) / rows;
    for (let i = 0; i < rows; i++) { const y = lh + 1 + rh * (i + 0.5); box(g, w - 1.6, rh - 1, 2, m, 0, y, d / 2 - 0.2); box(g, Math.min(16, w * 0.3), 1.2, 1.6, hm, 0, y + rh * 0.2, d / 2 + 1.4); }
    return;
  }
  const n = v === 'slide' ? Math.max(2, Math.round(w / 90)) : Math.max(1, Math.round(w / (tall ? 48 : 55))), dw = (w - 1) / n, ph = bh - (tall ? 1.5 : 3.5);
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + 0.5 + dw * (i + 0.5);
    box(g, dw - 0.8, ph, 2, m, x, lh + 0.8 + ph / 2, d / 2 - 0.2 + (v === 'slide' && i % 2 ? 1.6 : 0));
    const hx = n === 1 ? x + dw * 0.32 : x + (i % 2 ? -1 : 1) * (dw / 2 - 4);
    if (tall) box(g, 1.2, 22, 2, hm, hx, lh + bh * 0.48, d / 2 + 1.6 + (v === 'slide' && i % 2 ? 1.6 : 0));
    else box(g, 1.2, 8, 1.6, hm, hx, lh + bh * 0.62, d / 2 + 1.4);
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
  const wood = finish(it.styled ? P.wood : (it.color && it.color[0] === '#' ? 'oak' : it.color));
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
  for (let i = 0; i < 5; i++) { const a = i * 1.2566, s = box(g, w * 0.46, 2.5, 4, dk, Math.cos(a) * w * 0.23, 6, Math.sin(a) * w * 0.23); s.rotation.y = -a; cyl(g, 2.6, 2.6, 4, dk, Math.cos(a) * w * 0.44, 2.6, Math.sin(a) * w * 0.44, 10).rotation.z = Math.PI / 2; }
  cyl(g, 2.4, 2.4, 34, st, 0, 24, 0, 12);
  box(g, 48, 8, 48, fab, 0, 46, 2, 3.5);
  const bh = h - 56; const b = box(g, 44, bh, 6, fab, 0, 56 + bh / 2, -21, 3); b.rotation.x = -0.1;
  box(g, 5, 14, 5, dk, 0, 52, -21);
  for (const sx of [-1, 1]) { box(g, 3, 18, 3, dk, sx * 25, 57, 0); box(g, 5, 2.5, 26, dk, sx * 25, 67, 2, 1); }
};

B.bed = (g, it, P) => {
  const { w, d, h, v } = it;
  const fw = finish(it.styled ? P.wood : 'oak'), soft = v === 'soft';
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
  if (v === 'tripod') for (let i = 0; i < 3; i++) { const a = i * 2.094; const p = cyl(g, 1.3, 1.3, h - sh + 4, mt, Math.cos(a) * w * 0.2, (h - sh) / 2, Math.sin(a) * w * 0.2, 8); p.rotation.z = -Math.cos(a) * 0.2; p.rotation.x = Math.sin(a) * 0.2; }
  else { cyl(g, sr * 0.75, sr * 0.8, 2, mt, 0, 1, 0); cyl(g, 1.1, 1.1, h - sh, mt, 0, (h - sh) / 2 + 1, 0, 10); }
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
  const ov = (y, hh) => { box(g, w - 6, hh, 2.5, M('gloss', '#101113'), 0, y, d / 2 - 1.2, 0.5); box(g, w - 16, 1.4, 2, STEEL(), 0, y + hh / 2 - 5, d / 2 + 1); };
  if (w <= 90 && h >= 150) { ov(105, 56); if (v === 2) ov(152, 34); box(g, w - 1, 68, 2, m, 0, 8 + 35, d / 2 - 1.4); box(g, w - 1, h - (v === 2 ? 174 : 138), 2, m, 0, h - (h - (v === 2 ? 172 : 136)) / 2, d / 2 - 1.4); }
  else { const n = Math.max(2, Math.round(w / 50)), dw = (w - 0.6) / n; for (let i = 0; i < n; i++) box(g, dw - 0.8, h - 10, 2, m, -w / 2 + 0.3 + dw * (i + 0.5), 8 + (h - 8) / 2, d / 2 - 1.4); }
};

// ---- 衛浴 ----
B.toilet = (g, it) => {
  const { w, d, h, v } = it, c = M('ceramic', '#F6F6F4');
  if (v === 'wall' && h > 50) { box(g, w, h, d * 0.55, c, 0, 40 + h / 2 - 20, -d * 0.2, 6); return; }
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
  if (v === 'ped') cyl(g, 9, 11, h - 14, c, 0, (h - 14) / 2, -2, 20);
  else { const m = finish(it.styled ? 'white' : it.color); box(g, w - 2, 50, d - 4, m, 0, 28 + 25, -2); const n = w > 75 ? 2 : 1; for (let i = 0; i < n; i++) { const dw = (w - 2.6) / n; box(g, dw - 0.7, 48, 1.8, m, -(w - 2.6) / 2 + dw * (i + 0.5), 53, d / 2 - 3.2); box(g, 1.1, 12, 1.5, STEEL(), -(w - 2.6) / 2 + dw * (i + 0.5) + (i ? -1 : 1) * (n === 1 ? dw * 0.3 : dw / 2 - 4), 60, d / 2 - 1.6); } }
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
  cyl(g, 1.2, 1.2, h - 20, ch, -w / 2 + 10, (h - 20) / 2 + 5, -d / 2 + 6, 10); cyl(g, 11, 11, 1.2, ch, -w / 2 + 10, h - 14, -d / 2 + 20, 20); const a = cyl(g, 1, 1, 16, ch, -w / 2 + 10, h - 13, -d / 2 + 13, 8); a.rotation.x = Math.PI / 2;
};
B.mirror = (g, it) => {
  const { w, d, h, v } = it;
  if (v === 'round') { const m = cyl(g, w / 2, w / 2, 2, DARK(), 0, h / 2, 0, 40); m.rotation.x = Math.PI / 2; const f = cyl(g, w / 2 - 1.5, w / 2 - 1.5, 0.5, M('mirror'), 0, h / 2, 1.2, 40); f.rotation.x = Math.PI / 2; return; }
  box(g, w, h, d, M('paint', '#F1EEE8'), 0, h / 2, 0); box(g, w - 1.5, h - 1.5, 0.5, M('mirror'), 0, h / 2, d / 2 + 0.2);
};
B.washer = (g, it) => {
  const { w, d, h, v } = it, wh = M('gloss', '#F3F3F1'), dk = M('gloss', '#1B1C1F');
  box(g, w, h, d, wh, 0, h / 2, 0, 1.5);
  const port = (y) => { const r = cyl(g, w * 0.3, w * 0.3, 2, STEEL(), 0, y, d / 2 + 0.6, 32); r.rotation.x = Math.PI / 2; const q = cyl(g, w * 0.24, w * 0.24, 2.4, dk, 0, y, d / 2 + 0.7, 32); q.rotation.x = Math.PI / 2; };
  if (v === 'top') { box(g, w - 8, 1.2, d - 18, dk, 0, h + 0.3, 5, 0.4); box(g, w - 4, 9, 9, wh, 0, h + 4, -d / 2 + 5, 1.5); }
  else if (v === 'stack') { port(h * 0.25); port(h * 0.75); box(g, w - 6, 5, 0.6, dk, 0, h * 0.5, d / 2 + 0.2); }
  else { port(h * 0.48); box(g, w - 6, 7, 0.6, dk, 0, h - 7, d / 2 + 0.2); }
};

// 建立一件家具。P = { wood, fabric, accent }（風格配色，只有預設家具會套用）
export function buildItem(it, style, styled) {
  const g = new THREE.Group();
  const P = styled ? { wood: style.wood, fabric: style.fabric, accent: style.accent }
    : { wood: 'oak', fabric: it.color && it.color[0] === '#' ? it.color : '#B9B4AA', accent: '#C9B8A0' };
  const spec = Object.assign({}, it, { styled });
  (B[it.t] || ((gg) => box(gg, it.w, it.h, it.d, M('paint', '#CCCCCC'), 0, it.h / 2, 0)))(g, spec, P);
  g.scale.setScalar(0.01);
  return g;
}
