// 推上 main 之前跑：node tools/check-units.mjs
// 換版本號：node tools/check-units.mjs --bump 20261115a
//
// 以前新增戶型後「選戶型畫面看不到新戶型」的原因，這支腳本都會擋下來：
//   1. 有檔案的 ?v= 版本號沒一起換 → 瀏覽器混用新舊快取（舊的 plan.js 沒有新戶型）
//   2. 新的 plan-*.js 沒有在 plan.js import、或沒加進 UNITS
//   3. 平面資料缺欄位，選戶型或切換戶型時丟錯，整個畫面空白
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const files = ['index.html', 'phone.html', ...readdirSync(join(ROOT, 'js')).filter((f) => f.endsWith('.js')).map((f) => 'js/' + f)];
const read = (f) => readFileSync(join(ROOT, f), 'utf8');
const errs = [];
const ownRef = /(['"])(\.{1,2}\/(?:js\/)?[\w-]+\.js)(\?v=([\w-]+))?\1/g;   // 自家 JS 模組（不含 vendor/）

// --bump：把所有自家模組的版本號換成同一個新值
const bi = process.argv.indexOf('--bump');
if (bi > 0) {
  const v = process.argv[bi + 1];
  if (!/^[\w-]+$/.test(v || '')) { console.error('用法：--bump 20261115a'); process.exit(1); }
  for (const f of files) {
    const s = read(f), t = s.replace(ownRef, (m, q, p) => p.includes('vendor/') ? m : `${q}${p}?v=${v}${q}`);
    if (t !== s) writeFileSync(join(ROOT, f), t);
  }
  console.log('版本號已換成', v);
}

// 1. 版本號：每個自家模組網址都要有 ?v=，而且全部一樣
const versions = new Map();
for (const f of files) {
  for (const m of read(f).matchAll(ownRef)) {
    if (m[2].includes('vendor/')) continue;
    if (!m[4]) errs.push(`${f}：${m[2]} 沒有 ?v= 版本號`);
    else (versions.get(m[4]) || versions.set(m[4], []).get(m[4])).push(`${f} → ${m[2]}`);
  }
}
if (versions.size > 1) errs.push('版本號不一致：\n' + [...versions].map(([v, l]) => `  v=${v}：\n    ` + l.join('\n    ')).join('\n'));

// 2. 每個 plan-*.js 都要被 plan.js import
const planSrc = read('js/plan.js');
for (const f of readdirSync(join(ROOT, 'js')).filter((f) => /^plan-.+\.js$/.test(f)))
  if (!planSrc.includes(`'./${f}?v=`)) errs.push(`js/${f} 沒有在 plan.js import`);

// 3. 實際載入 UNITS，檢查每一戶的資料
let UNITS;
try { ({ UNITS } = await import(pathToFileURL(join(ROOT, 'js/plan.js')).href)); }
catch (e) { console.error('✗ plan.js 載入失敗（選戶型畫面會整個空白）：' + e.message); process.exit(1); }
const { getItem } = await import(pathToFileURL(join(ROOT, 'js/catalog.js')).href);
const ids = new Set();
const isRect = (r, n = 4) => Array.isArray(r) && r.length >= n && r.slice(0, n).every((v) => Number.isFinite(v));
for (const u of UNITS) {
  const tag = `戶型 ${u.id}（${u.name}）`, p = u.plan;
  if (ids.has(u.id)) errs.push(`${tag}：id 重複`); ids.add(u.id);
  for (const k of ['name', 'spec', 'note']) if (!u[k]) errs.push(`${tag}：缺 ${k}`);
  if (!p) { errs.push(`${tag}：plan 是 undefined（import 名稱打錯？）`); continue; }
  for (const k of ['H', 'W', 'D']) if (!(p[k] > 0)) errs.push(`${tag}：${k} 不對`);
  for (const k of ['walls', 'wins', 'floors', 'slab', 'rooms', 'doors', 'defaults']) if (!Array.isArray(p[k])) errs.push(`${tag}：缺 ${k}`);
  if (!Array.isArray(p.walls)) continue;
  if (p.walls.some((w) => !isRect(w, 6))) errs.push(`${tag}：walls 格式不對（要 [x1,y1,x2,y2,z1,z2]）`);
  if (p.wins.some((w) => !isRect(w, 6))) errs.push(`${tag}：wins 格式不對`);
  const kinds = ['main', 'bath', 'kit', 'foyer', 'balc'];
  if (p.floors.some((f) => !isRect(f) || !kinds.includes(f[4]))) errs.push(`${tag}：floors 格式或材質種類不對（只能 ${kinds.join('/')}）`);
  if (p.doors.some((d) => d.length !== 5 || d.some((v) => !Number.isFinite(v)))) errs.push(`${tag}：doors 要 [x,y,寬,關門角,開門角]`);
  if (!isRect(p.door)) errs.push(`${tag}：缺大門 door`);
  if (!isRect(p.start, 2)) errs.push(`${tag}：缺起點 start`);
  if (p.cuts && p.cuts.some((c) => c.some((i) => !p.walls[i]))) errs.push(`${tag}：cuts 指到不存在的牆`);
  const rid = new Set();
  for (const q of p.rooms) {
    if (!q.id || !q.n || !isRect(q.r) || !Array.isArray(q.rs) || !q.rs.length || q.rs.some((r) => !isRect(r))) errs.push(`${tag}：房間 ${q.id} 欄位不完整`);
    if (rid.has(q.id)) errs.push(`${tag}：房間 id ${q.id} 重複`); rid.add(q.id);
  }
  if (!p.rooms.some((q) => q.n.includes('客'))) errs.push(`${tag}：沒有名稱含「客」的房間（設計圖要拍客廳）`);
  if (!p.rooms.some((q) => q.n.includes('臥'))) errs.push(`${tag}：沒有臥室`);
  const onFloor = (x, y) => p.floors.some(([a, b, c, d]) => x >= a && x <= c && y >= b && y <= d);
  if (isRect(p.start, 2) && !onFloor(...p.start)) errs.push(`${tag}：導覽起點不在地板上`);
  const did = new Set();
  for (const d of p.defaults) {
    if (did.has(d.id)) errs.push(`${tag}：家具 id ${d.id} 重複`); did.add(d.id);
    if (!getItem(d.key)) errs.push(`${tag}：家具 ${d.key} 型錄裡沒有`);
    if (!onFloor(d.x, d.y)) errs.push(`${tag}：家具 ${d.key} 不在地板上`);
  }
}

if (errs.length) { console.error('✗ 檢查沒過：\n- ' + errs.join('\n- ')); process.exit(1); }
console.log(`✓ ${UNITS.length} 個戶型都正常：${UNITS.map((u) => u.name).join('、')}；版本號 v=${[...versions.keys()][0]}`);
