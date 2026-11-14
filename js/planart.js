// 手機平面圖的繪製：有材質的地板、粗黑牆、門弧線，以及每種家具的俯視圖（單位 cm，等比例）
import { PLAN } from './plan.js?v=20261115a';
import { STYLES, FLOORS, planColor, wallSegs, doorGap } from './catalog.js?v=20261115a';

const INK = '#4A4038';
function tint(hex, f) {   // f > 1 變亮，f < 1 變暗
  const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(f > 1 ? v + (255 - v) * (f - 1) : v * f))));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}
const r = (x, y, w, h, rx, fill, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" ${extra}/>`;
const el = (cx, cy, rx, ry, fill, extra = '') => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" ${extra}/>`;
const ln = (x1, y1, x2, y2, stroke = INK, sw = 0.8, extra = '') => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${sw}" ${extra}/>`;
const S = `stroke="${INK}" stroke-width="0.8"`;

// ---------- 地板、牆、門 ----------
export function defs(styleKey, floorKey, roomFloors) {
  const st = STYLES[styleKey] || STYLES.nordic;
  const tile = (id, size, base, line, vein) => `<pattern id="${id}" width="${size}" height="${size}" patternUnits="userSpaceOnUse"><rect width="${size}" height="${size}" fill="${base}"/>` +
    (vein ? `<path d="M0 ${size * 0.3} Q ${size * 0.4} ${size * 0.1} ${size * 0.7} ${size * 0.5} T ${size} ${size * 0.8}" fill="none" stroke="${vein}" stroke-width="1" opacity=".28"/><path d="M${size * 0.2} ${size} Q ${size * 0.5} ${size * 0.6} ${size * 0.9} ${size * 0.1}" fill="none" stroke="${vein}" stroke-width=".6" opacity=".22"/>` : '') +
    `<path d="M0 0H${size}M0 0V${size}" stroke="${line}" stroke-width="1.4"/></pattern>`;
  const main = (id, fl) => { const wc = fl ? fl.c : st.floorC, marble = fl ? fl.k !== 'wood' : st.floor === 'marble';
  const wood = `<pattern id="${id}" width="160" height="60" patternUnits="userSpaceOnUse"><rect width="160" height="60" fill="${wc}"/>` +
    [[0, 0, 100, 1.05], [100, 0, 60, 0.98], [0, 15, 45, 0.97], [45, 15, 115, 1.08], [0, 30, 130, 1.0], [130, 30, 30, 1.06], [0, 45, 75, 1.07], [75, 45, 85, 0.975]].map(([x, y, w, f]) => r(x, y, w, 15, 0, tint(wc, f), `stroke="${tint(wc, 0.88)}" stroke-width=".5"`)).join('') + '</pattern>';
  return marble ? tile(id, fl && fl.k === 'stone' ? 40 : 80, wc, fl && (fl.k === 'terrazzo' || fl.k === 'carpet') ? wc : tint(wc, 0.86), fl ? null : '#B9B2A6') : wood; };
  return `<defs>${main('f-main', FLOORS[floorKey])}${[...new Set(Object.values(roomFloors || {}))].filter((k) => FLOORS[k]).map((k) => main('f-x-' + k, FLOORS[k])).join('')}${tile('f-bath', 30, '#E4E2DD', '#C5C2BC')}${tile('f-kit', 60, '#EFEADF', '#D3CDBF', '#CFC6B3')}${tile('f-foyer', 80, '#EFEADF', '#D3CDBF', '#C9BFAC')}${tile('f-balc', 30, '#BEBBB5', '#A29F99', '#A9A6A0')}</defs>`;
}
export function floors(vb, roomFloors) {
  let h = `<rect x="${vb[0]}" y="${vb[1]}" width="${vb[2]}" height="${vb[3]}" fill="#F3F1ED"/>`;
  for (const [a, b, c, d, k] of PLAN.floors) h += r(a, b, c - a, d - b, 0, `url(#f-${k})`);
  for (const q of PLAN.rooms) { const k = roomFloors && roomFloors[q.id]; if (FLOORS[k]) for (const [a, b, c, d] of q.rs) h += r(a, b, c - a, d - b, 0, `url(#f-x-${k})`); }   // 個別區域指定的地板
  return h;
}
export function walls() {
  let h = '';
  for (const [x, y, w, a0, a1] of PLAN.doors) {   // 門扇與開門弧線
    const R = Math.PI / 180, cx = x + w * Math.cos(a0 * R), cy = y + w * Math.sin(a0 * R), ox = x + w * Math.cos(a1 * R), oy = y + w * Math.sin(a1 * R), sweep = ((a1 - a0 + 360) % 360) < 180 ? 1 : 0;
    h += `<path d="M${x} ${y}L${ox} ${oy}" stroke="${INK}" stroke-width="2.4" fill="none"/><path d="M${cx} ${cy}A${w} ${w} 0 0 ${sweep} ${ox} ${oy}" stroke="${INK}" stroke-width=".9" fill="none" opacity=".75"/>`;
  }
  for (const [a, b, c, d, z1, z2] of PLAN.walls) {
    if (z1 > 0) continue;
    if (z2 >= 200) h += r(a, b, c - a, d - b, 0, '#17171A');
    else if (z2 === 110) h += r(a, b, c - a, d - b, 0, '#FFFFFF', `stroke="${INK}" stroke-width="1"`);
    else { const hz = c - a > d - b; h += r(a, b, c - a, d - b, 0, '#FFFFFF', `stroke="#17171A" stroke-width="1.2"`) + (hz ? ln(a, (b + d) / 2, c, (b + d) / 2, '#17171A', 1) : ln((a + c) / 2, b, (a + c) / 2, d, '#17171A', 1)); }
  }
  const D = PLAN.door; return h + r(D[0], D[1], D[2] - D[0], D[3] - D[1], 0, '#7A5B43');
}

// ---------- 家具俯視圖（原點在中心；y 負的一側是背面，正的一側是正面） ----------
const burner = (x, y, s = 9) => `<circle cx="${x}" cy="${y}" r="${s}" fill="#2B2B2D" stroke="#77797D" stroke-width="1"/><circle cx="${x}" cy="${y}" r="${s * 0.45}" fill="none" stroke="#9A9CA0" stroke-width="1"/>` + ln(x - s, y, x + s, y, '#77797D', 0.8) + ln(x, y - s, x, y + s, '#77797D', 0.8);
const counter = (w, d) => r(-w / 2, -d / 2, w, d, 1.5, '#F3F0EA', S) + `<path d="M${-w * 0.3} ${-d * 0.2}Q0 ${-d * 0.4} ${w * 0.35} ${d * 0.1}" fill="none" stroke="#D5CFC3" stroke-width=".8"/>`;
const pillowTop = (x, y, w, h, c = '#FFFFFF', rot = 0) => `<g transform="translate(${x} ${y}) rotate(${rot})">` + r(-w / 2 + 1.5, -h / 2 + 2, w, h, 5, '#000', 'opacity=".14"') + r(-w / 2, -h / 2, w, h, 5, c, S) + `<path d="M${-w / 2 + 4} ${-h / 2 + 4}Q0 ${-h / 2 + 7} ${w / 2 - 4} ${-h / 2 + 4}" fill="none" stroke="${tint(c, 0.82)}" stroke-width="1"/></g>`;
const grain = (w, d, c) => [-0.25, 0.05, 0.3].map((k) => `<path d="M${-w / 2 + 3} ${d * k}Q0 ${d * k + 3} ${w / 2 - 3} ${d * k - 1}" fill="none" stroke="${tint(c, 0.86)}" stroke-width=".8"/>`).join('');

export function itemArt(s) {
  const { w, d, t, v } = s, c = planColor(s), x0 = -w / 2, y0 = -d / 2, dk = tint(c, 0.82), lt = tint(c, 1.25);
  const shadow = s.elev > 0 || t === 'rug' ? '' : (v === 'round' || t === 'plant' || t === 'lamp' ? el(3, 4, w / 2, d / 2, '#000', 'opacity=".16"') : r(x0 + 3, y0 + 4, w, d, 4, '#000', 'opacity=".16"'));
  let h = '';
  switch (t) {
    case 'sofa': {
      if (v === 'stool') { h = r(x0, y0, w, d, 8, c, S) + r(x0 + 4, y0 + 4, w - 8, d - 8, 6, lt, `stroke="${dk}" stroke-width=".8"`); break; }
      const isL = v === 'L' || v === 'Lr', dm = isL ? 95 : d, arm = Math.max(12, Math.min(20, w * 0.09)), inner = w - 2 * arm, n = Math.max(1, Math.round(inner / 72)), cw = inner / n;
      if (isL) { const sx = v === 'L' ? 1 : -1, cx = sx * (w / 2 - arm - 46); h += r(cx - 46, y0 + dm - 6, 92, d - dm + 6, 7, c, S) + r(cx - 42, y0 + dm, 84, d - dm - 4, 6, lt, `stroke="${dk}" stroke-width=".8"`); }
      h += r(x0, y0, w, dm, 9, c, S) + r(x0 + 2, y0 + 2, w - 4, 17, 6, dk);
      for (let i = 0; i < n; i++) h += r(x0 + arm + cw * i + 1, y0 + 20, cw - 2, dm - 23, 6, lt, `stroke="${dk}" stroke-width=".8"`) + r(x0 + arm + cw * i + 3, y0 + 9, cw - 6, 15, 6, tint(c, 1.12), `stroke="${dk}" stroke-width=".6"`);
      h += r(x0 + 1, y0 + 6, arm - 1, dm - 8, 6, tint(c, 0.92), `stroke="${dk}" stroke-width=".6"`) + r(w / 2 - arm, y0 + 6, arm - 1, dm - 8, 6, tint(c, 0.92), `stroke="${dk}" stroke-width=".6"`);
      if (w >= 140) h += pillowTop(x0 + arm + 18, y0 + 30, 30, 30, '#9DB399', -18) + pillowTop(w / 2 - arm - 18, y0 + 31, 30, 30, '#F1ECE2', 14);
      break;
    }
    case 'table': {
      if (v === 'fmirror') { h = r(x0, y0, w, d, 2, '#3A3A3C', S) + r(x0 + 3, y0 + 3, w - 6, d - 6, 1, '#CFE0E8'); break; }
      if (v === 'stoolseat') { h = r(x0, y0, w, d, 7, c, S); break; }
      const marble = s.color === 'marble', vein = marble ? `<path d="M${-w * 0.35} ${-d * 0.2}Q${-w * 0.05} ${-d * 0.45} ${w * 0.3} ${d * 0.15}M${-w * 0.2} ${d * 0.35}Q${w * 0.1} ${d * 0.05} ${w * 0.4} ${-d * 0.3}" fill="none" stroke="#B7B0A4" stroke-width=".9"/>` : grain(w, d, c);
      h = (v === 'round' ? el(0, 0, w / 2, d / 2, c, S) + el(0, 0, w / 2 - 4, d / 2 - 4, 'none', `stroke="${tint(c, 0.88)}" stroke-width=".8"`) : r(x0, y0, w, d, 3, c, S)) + vein;
      if (s.cat === 'dtable') { h += el(0, 0, 7, 7, '#E8E2D6', S) + el(0, 0, 3, 3, '#6E9A5B'); if (w >= 110) for (const [px, py] of [[-w / 4, -d / 4], [w / 4, d / 4]]) h += el(px, py, 11, 11, '#FBFAF7', S) + el(px, py, 6.5, 6.5, 'none', 'stroke="#CFC9BD" stroke-width=".8"'); }
      else if (s.cat === 'coffee' && w >= 80) h += r(-w * 0.28, -d * 0.2, 22, 16, 1, '#5E6B7A', `${S} transform="rotate(-12 ${-w * 0.17} ${-d * 0.08})"`) + el(w * 0.2, -d * 0.1, 5, 5, '#3F5A54', S);
      else if (s.cat === 'desk') h += r(-12, -d * 0.2, 24, 15, 1, '#2E2F31') + r(-10, d * 0.12, 20, 7, 1, '#D9D9D9', S);
      else if (v === 'mirror') h += r(-w * 0.3, y0, w * 0.6, 4, 1, '#CFE0E8', S);
      break;
    }
    case 'cab': {
      h = r(x0, y0, w, d, 2, c, S);
      if (s.cat === 'ward') { const n = Math.max(4, Math.round(w / 9)), sw = (w - 10) / n; h += r(x0 + 3, y0 + 3, w - 6, d - 6, 1, '#FFFFFF', S) + `<path d="M${x0 + 5} ${y0 + 6}` + Array.from({ length: n }, (_, i) => `L${x0 + 5 + sw * (i + 0.5)} ${i % 2 ? y0 + 6 : d / 2 - 6}`).join('') + `L${w / 2 - 5} ${y0 + 6}" fill="none" stroke="${INK}" stroke-width="1.1"/>` + ln(x0 + 4, 0, w / 2 - 4, 0, '#8A8A8A', 1.2); }
      else { h += grain(w, d, c) + ln(x0 + 2, d / 2 - 3, w / 2 - 2, d / 2 - 3, dk, 1.6); if (s.cat === 'nstand') h += el(0, 0, Math.min(w, d) * 0.3, Math.min(w, d) * 0.3, '#FFF6E0', S) + el(0, 0, Math.min(w, d) * 0.12, Math.min(w, d) * 0.12, '#E8C873', S); if (s.cat === 'tvcab' && w > 100) h += el(x0 + 18, 0, 6, 6, '#3F5A54', S) + r(w / 2 - 40, -8, 24, 16, 1, '#E9E2D6', S); }
      break;
    }
    case 'shelf': { h = r(x0, y0, w, d, 2, c, S); const cols = ['#B5654A', '#2F3E5C', '#E3DED4', '#7C8471', '#C8A464', '#5E6B7A']; let x = x0 + 3, i = 0; while (x < w / 2 - 6) { const bw = 3 + (i * 7 % 4); h += r(x, y0 + 3, bw, d - 8, 0.5, cols[i % 6]); x += bw + 0.6; i++; } break; }
    case 'tv': h = r(x0, y0, w, d, 1.5, '#17171A'); break;
    case 'built': { h = r(x0, y0, w, d, 1.5, c, S) + ln(x0 + 2, d / 2 - 2.5, w / 2 - 2, d / 2 - 2.5, INK, 1.4); const n = Math.max(2, Math.round(w / 60)); for (let i = 1; i < n; i++) h += ln(x0 + w * i / n, y0 + 2, x0 + w * i / n, d / 2 - 2, INK, 0.6, 'opacity=".5"'); break; }
    case 'wshelf': h = r(x0 - 4, y0 - 8, w + 8, d + 16, 0, 'transparent') + r(x0, y0, w, d, 1, c, `stroke="${INK}" stroke-width=".9" stroke-dasharray="5 3" fill-opacity=".7"`); break;
    case 'wall': {   // 新增的牆面／拉門：實心區段畫成牆，開口留空；外面包一圈透明的觸控範圍，手指比較好點
      const fin = s.fin, fill = fin === 'glass' ? '#BFDDE6' : fin === 'frost' ? '#E9F0EF' : v === 'hslat' ? '#C9A77A' : v === 'hglass' ? '#9FB4BA' : '#3B3F46';
      h = r(x0 - 6, -22, w + 12, 44, 0, 'transparent');
      for (const [a, b] of wallSegs(s)) h += r(a, y0, b - a, d, 0, fill, `stroke="${INK}" stroke-width="${fin === 'solid' && v !== 'hslat' ? 0 : 1.6}"`);
      if (v === 'hslat') h += ln(x0, 0, w / 2, 0, '#8A6B4A', 2, 'stroke-dasharray="3 5"');
      if (v === 'open') { const dw = Math.min(90, w - 30); for (const sx of [-1, 1]) h += r(sx * dw / 2 - 1.5, y0 - 0.5, 3, d + 1, 0, '#4A3324'); }
      if (v === 'slide2' || v === 'slide1') { const g = doorGap(s); h += r(g[0], -1.8, g[1] - g[0], 3.6, 0, fin === 'frost' ? '#E9F0EF' : '#BFDDE6', `stroke="${INK}" stroke-width="1.2"`); }
      break; }
    case 'chair': {
      if (v === 'bench') { h = r(x0, y0, w, d, 3, c, S) + grain(w, d, c); break; }
      const pad = v === 'pad' || v === 'bar';
      h = r(x0 + 2, y0 + 5, w - 4, d - 6, 6, pad ? lt : c, S) + r(x0, y0, w, 7, 3.5, pad ? '#B98A5E' : dk, S) + (pad ? r(x0 + 6, y0 + 10, w - 12, d - 16, 4, 'none', `stroke="${dk}" stroke-width=".7"`) : '');
      break;
    }
    case 'ochair': { for (let i = 0; i < 5; i++) { const a = i * 1.2566 + 0.3; h += ln(0, 0, Math.cos(a) * w * 0.46, Math.sin(a) * d * 0.46, '#2B2B2D', 2.4, 'stroke-linecap="round"'); } h += r(-w * 0.38, -d * 0.36, w * 0.76, d * 0.74, 9, c, S) + `<path d="M${-w * 0.36} ${-d * 0.28}Q0 ${-d * 0.56} ${w * 0.36} ${-d * 0.28}" fill="none" stroke="${tint(c, 0.7)}" stroke-width="5" stroke-linecap="round"/>`; break; }
    case 'bed': {
      const soft = v === 'soft', hd = soft ? 13 : 7, mw = w - 6, my = y0 + hd + 1, md = d - hd - 3, np = w >= 140 ? 2 : 1, duv = soft ? '#EFEAE0' : tint(c, 1.08), fold = my + md * 0.3;
      h = r(x0, y0, w, d, 4, soft ? c : '#C9A77C', S) + r(x0, y0, w, hd, 3, soft ? dk : '#B08A5A', S) + r(-mw / 2, my, mw, md, 7, '#FBFAF7', S);
      for (let i = 0; i < np; i++) { const pw = np === 2 ? mw / 2 - 10 : mw - 18, px = np === 2 ? (i ? 1 : -1) * mw / 4 : 0; h += pillowTop(px, my + 22, pw, 30); }
      h += r(-mw / 2 - 1, fold, mw + 2, my + md - fold + 1, 6, duv, S) + r(-mw / 2 - 1, fold - 9, mw + 2, 14, 4, '#FFFFFF', S)
        + `<path d="M${-mw * 0.3} ${fold + md * 0.2}Q${-mw * 0.1} ${fold + md * 0.3} ${mw * 0.05} ${fold + md * 0.16}M${mw * 0.1} ${fold + md * 0.42}Q${mw * 0.28} ${fold + md * 0.3} ${mw * 0.42} ${fold + md * 0.4}" fill="none" stroke="${tint(duv, 0.84)}" stroke-width="1"/>`
        + r(-mw / 2 - 2, my + md - 52, mw + 4, 34, 3, '#9DB399', `${S} opacity=".95"`);
      if (w >= 110) h += pillowTop(np === 2 ? -mw / 4 + 8 : -8, my + 42, 30, 28, '#9DB399', -8) + (np === 2 ? pillowTop(mw / 4 - 8, my + 43, 30, 28, '#DDD2C0', 9) : '');
      if (v === 'bunk') h += r(w / 2 - 10, y0 + d * 0.55, 10, 40, 1, '#C9A77C', S);
      break;
    }
    case 'rug': {
      const b = `stroke="${tint(c, 0.78)}" stroke-width="1.2" fill="none"`;
      h = v === 'round' ? el(0, 0, w / 2, d / 2, c, 'opacity=".92"') + el(0, 0, w / 2 - 7, d / 2 - 7, 'none', b) : r(x0, y0, w, d, 2, c, 'opacity=".92"') + r(x0 + 7, y0 + 7, w - 14, d - 14, 1, 'none', b) + Array.from({ length: Math.floor((w - 30) / 16) }, (_, i) => ln(x0 + 15 + i * 16, y0 + 12, x0 + 15 + i * 16 + 8, d / 2 - 12, tint(c, 0.9), 0.8)).join('');
      break;
    }
    case 'lamp': h = el(0, 0, w / 2, d / 2, '#FFF6E0', S) + el(0, 0, w * 0.3, d * 0.3, 'none', 'stroke="#C9A24B" stroke-width="1"') + el(0, 0, w * 0.12, d * 0.12, '#E8C873', S); break;
    case 'plant': { h = el(0, 0, w * 0.3, d * 0.3, '#E7E2DA', S); for (let i = 0; i < 9; i++) { const a = i * 0.7, rr = w * (0.16 + (i % 3) * 0.06); h += el(Math.cos(a) * rr, Math.sin(a) * rr, w * 0.2, d * 0.11, ['#5F8D4E', '#4A7741', '#79A862'][i % 3], `stroke="#3B6034" stroke-width=".6" transform="rotate(${a * 57.3} ${Math.cos(a) * rr} ${Math.sin(a) * rr})"`); } break; }
    case 'cook': { h = counter(w, d); const gw = Math.min(w - 8, 78), ih = typeof v === 'string', n = ih ? +v.slice(2) : v || 2; h += r(-gw / 2, -d / 2 + 8, gw, d - 16, 2, '#1D1D1F', S); const pos = n === 1 ? [[0, 0]] : n === 2 ? [[-gw / 4, 0], [gw / 4, 0]] : n === 3 ? [[-gw / 3.4, 4], [gw / 3.4, 4], [0, -9]] : [[-gw / 4, 9], [gw / 4, 9], [-gw / 4, -11], [gw / 4, -11]]; for (const [px, py] of pos) h += burner(px, py, n > 2 ? 7.5 : 9); break; }
    case 'sink': { h = counter(w, d); const bs = v === 'double' ? [[-w / 4, w / 2 - 12], [w / 4, w / 2 - 12]] : [[0, Math.min(w - 16, 70)]]; for (const [px, bw] of bs) h += r(px - bw / 2, -d / 2 + 13, bw, d - 22, 5, '#FFFFFF', `stroke="${INK}" stroke-width="1.1"`) + r(px - bw / 2 + 3, -d / 2 + 16, bw - 6, d - 28, 4, '#E6E9EB') + el(px, 2, 2.2, 2.2, '#77797D'); h += el(0, -d / 2 + 7, 2.6, 2.6, '#C9CCD0', S) + ln(0, -d / 2 + 7, 0, -d / 2 + 20, '#9A9CA0', 2.4, 'stroke-linecap="round"'); break; }
    case 'fridge': h = r(x0, y0, w, d, 3, '#DADCDF', S) + r(x0 + 3, y0 + 3, w - 6, d - 9, 2, '#F4F5F6') + ln(x0, d / 2 - 4, w / 2, d / 2 - 4, '#8E9196', 1.6) + (v === 'side' ? ln(0, d / 2 - 4, 0, d / 2, '#8E9196', 1) : ''); break;
    case 'kcab': h = counter(w, d); break;
    case 'hood': h = r(x0, y0, w, d, 2, '#C9CCD0', `stroke="${INK}" stroke-width=".8" stroke-dasharray="5 4" fill-opacity=".45"`); break;
    case 'tower': h = v === 'dw' ? counter(w, d) : r(x0, y0, w, d, 2, c, S) + ln(x0, y0, w / 2, d / 2, INK, 0.7) + ln(w / 2, y0, x0, d / 2, INK, 0.7); break;
    case 'toilet': { const td = v === 'wall' ? 0 : 19, bd = d - td; h = (td ? r(x0 + 1, y0, w - 2, td, 4, '#FFFFFF', S) + el(0, y0 + td / 2, 2.4, 2.4, '#C9CCD0', S) : '') + el(0, y0 + td + bd / 2 - 2, w / 2, bd / 2 + 2, '#FFFFFF', S) + el(0, y0 + td + bd / 2, w / 2 - 5, bd / 2 - 5, '#F1F3F4', 'stroke="#B9BDC2" stroke-width=".8"'); break; }
    case 'vanity': { h = r(x0, y0, w, d, 3, '#FFFFFF', S); for (const px of v === 'double' ? [-w / 4, w / 4] : [0]) { const rr = Math.min(w / (v === 'double' ? 2 : 1), d) * 0.36; h += el(px, 2, rr, Math.min(rr, d * 0.34), '#EAF0F3', `stroke="${INK}" stroke-width="1"`) + el(px, 2, 1.8, 1.8, '#77797D') + el(px, y0 + 6, 2.2, 2.2, '#C9CCD0', S) + ln(px, y0 + 6, px, y0 + 14, '#9A9CA0', 2, 'stroke-linecap="round"'); } break; }
    case 'tub': h = (v === 'free' ? el(0, 0, w / 2, d / 2, '#FFFFFF', S) + el(0, 0, w / 2 - 7, d / 2 - 7, '#EAF2F6', 'stroke="#B9BDC2" stroke-width=".8"') : r(x0, y0, w, d, 4, '#FFFFFF', S) + r(x0 + 7, y0 + 7, w - 14, d - 14, 14, '#EAF2F6', 'stroke="#B9BDC2" stroke-width=".8"')) + el(w / 2 - 20, 0, 2.2, 2.2, '#77797D') + el(w / 2 - 6, 0, 2.5, 2.5, '#C9CCD0', S); break;
    case 'shower': h = v === 'panel' ? r(x0, y0, w, d, 1, '#CFE6F0', S) : r(x0, y0, w, d, 2, '#EEF3F5', S) + ln(x0, y0, w / 2, d / 2, '#B9C6CC', 0.7) + ln(w / 2, y0, x0, d / 2, '#B9C6CC', 0.7) + el(0, 0, 3, 3, '#77797D') + r(x0, d / 2 - 2, w, 2, 0, '#8FC0DA') + r(w / 2 - 2, y0, 2, d, 0, '#8FC0DA'); break;
    case 'mirror': h = r(x0, y0, w, d, 1, '#CFE0E8', `stroke="${INK}" stroke-width=".8" stroke-dasharray="4 3"`); break;
    case 'washer': h = r(x0, y0, w, d, 4, '#FBFBFA', S) + (v === 'top' ? r(x0 + 6, y0 + 14, w - 12, d - 22, 6, '#E3E6E8', S) + r(x0 + 4, y0 + 3, w - 8, 8, 2, '#D5D8DC') : el(0, 2, w * 0.32, d * 0.32, '#E3E6E8', S) + el(0, 2, w * 0.22, d * 0.22, '#9AA0A8') + r(x0 + 5, y0 + 4, w - 10, 6, 2, '#D5D8DC')); break;
    default: h = r(x0, y0, w, d, 2, c, S);
  }
  return shadow + h;
}
