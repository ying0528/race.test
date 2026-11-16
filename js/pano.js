// 擬真導覽：用光線追蹤把每個站點算成一張 360° 全景照，算好後用全景照導覽（轉頭、跳站點都很順）
// 做法：three-gpu-pathtracer 在背景一小塊一小塊地算，算好的全景存成一般貼圖；顯示時只是貼在一顆球上
import * as THREE from 'three';
import { FullScreenQuad } from '../vendor/jsm/postprocessing/Pass.js';

let LIB = null;
export function loadLib() { return LIB || (LIB = import('../vendor/three-gpu-pathtracer/src/index.js')); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const nextFrame = () => new Promise((r) => requestAnimationFrame(r));

// 把累積中的浮點數畫面 → 降噪 → 曝光＋ACES 色調 → 存成 8 位元 sRGB 全景貼圖
const BLIT_FS = /* glsl */`
  uniform sampler2D map; uniform float sigma, threshold, exposure; varying vec2 vUv;
  vec3 fit(vec3 v) { vec3 a = v * (v + 0.0245786) - 0.000090537, b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
  vec3 aces(vec3 c) {
    const mat3 I = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
    const mat3 O = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
    return clamp(O * fit(I * (c * exposure / 0.6)), 0.0, 1.0);
  }
  vec3 tm(vec3 c) { return aces(min(c, vec3(40.0))); }
  vec3 enc(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }   // 直接存成螢幕用的 sRGB 數值
  float lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
  void main() {
    // 降噪在「色調對應後」的顏色上比較（暗處、亮處的雜訊量才一致），邊緣差太多的鄰居不參與平均
    vec2 px = 1.0 / vec2(textureSize(map, 0));
    vec3 c0 = tm(texture2D(map, vUv).rgb);
    if (sigma < 0.01) { gl_FragColor = vec4(enc(c0), 1.0); return; }
    // 先處理孤立的亮點／暗點：跟周圍 8 格的平均差太多，就先用周圍的平均當基準
    vec3 nb = vec3(0.0); for (float y = -1.0; y <= 1.0; y++) for (float x = -1.0; x <= 1.0; x++) if (x != 0.0 || y != 0.0) nb += tm(texture2D(map, vUv + vec2(x, y) * px).rgb);
    nb /= 8.0; float l0 = lum(c0), ln = lum(nb); if (l0 > ln * 1.5 + 0.06 || l0 < ln * 0.55 - 0.03) c0 = nb;
    vec3 acc = vec3(0.0); float wsum = 0.0, r = floor(sigma * 1.5 + 0.5), inv = 0.5 / (sigma * sigma), it = 0.5 / (threshold * threshold);
    for (float y = -r; y <= r; y++) for (float x = -r; x <= r; x++) {
      vec3 c = tm(texture2D(map, vUv + vec2(x, y) * px).rgb), d = c - c0;
      float w = exp(-(x * x + y * y) * inv) * exp(-dot(d, d) * it);
      acc += c * w; wsum += w;
    }
    gl_FragColor = vec4(enc(wsum > 1e-4 ? acc / wsum : c0), 1.0);
  }`;
const VS = /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

// 顯示：一顆包住鏡頭的球，依視線方向取全景照；跳站時兩張照片交叉淡入
const VIEW_VS = /* glsl */`varying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const VIEW_FS = /* glsl */`
  uniform sampler2D mapA, mapB; uniform float mixT; varying vec3 vDir;
  vec2 eq(vec3 d) { return vec2(atan(d.z, d.x) * 0.15915494309189535 + 0.5, asin(clamp(d.y, -1.0, 1.0)) * 0.3183098861837907 + 0.5); }
  void main() {
    vec2 uv = eq(normalize(vDir));
    vec4 a = textureLod(mapA, uv, 0.0), b = textureLod(mapB, uv, 0.0);
    gl_FragColor = vec4(mix(a.rgb, b.rgb, mixT), 1.0);   // 全景已經是螢幕用的 sRGB 數值，直接輸出
  }`;

function labelSprite(text) {
  const c = document.createElement('canvas'), g = c.getContext('2d'), fs = 44; g.font = `700 ${fs}px "Noto Sans TC","Microsoft JhengHei",sans-serif`;
  const w = Math.ceil(g.measureText(text).width) + 44, h = fs + 30; c.width = w; c.height = h;
  g.font = `700 ${fs}px "Noto Sans TC","Microsoft JhengHei",sans-serif`; g.fillStyle = 'rgba(40,36,32,.62)'; g.beginPath(); g.roundRect(2, 2, w - 4, h - 4, 14); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 3; g.stroke(); g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true, toneMapped: false })); s.scale.set(w / h * 0.2, 0.2, 1); s.renderOrder = 12; return s;
}

export class Pano {
  constructor(renderer) {
    this.renderer = renderer; this.gl = renderer.getContext(); this.pt = null; this.stations = []; this.cur = 0; this.alive = false; this.gen = 0;
    this.batch = 1; this.viewing = false; this.onUpdate = () => {}; this.exposure = 1; this.info = '';
    this.blit = new FullScreenQuad(new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: BLIT_FS, depthTest: false, depthWrite: false, toneMapped: false,
      uniforms: { map: { value: null }, sigma: { value: 2 }, threshold: { value: 0.1 }, exposure: { value: 1 } } }));
    // 顯示用
    this.black = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); this.black.needsUpdate = true;
    this.viewMat = new THREE.ShaderMaterial({ vertexShader: VIEW_VS, fragmentShader: VIEW_FS, side: THREE.BackSide, depthTest: false, depthWrite: false, toneMapped: false,
      uniforms: { mapA: { value: this.black }, mapB: { value: this.black }, mixT: { value: 0 } } });
    this.view = new THREE.Scene(); this.sphere = new THREE.Mesh(new THREE.SphereGeometry(30, 48, 24), this.viewMat); this.sphere.frustumCulled = false; this.sphere.renderOrder = 0;
    this.spots = new THREE.Group(); this.view.add(this.sphere, this.spots);
    this.fade = null;   // { from, to, t }
  }
  // 先在背景把光線追蹤的著色器編譯好（第一次要好幾秒），真正按下時才不用等
  async warm() {
    if (this.pt || this._warming) return; this._warming = true;
    try {
      const L = await loadLib(); const pt = this._make(L);
      const s = new THREE.Scene(); s.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: '#888' })));
      const al = new THREE.RectAreaLight('#fff', 5, 1, 1); al.position.set(0, 3, 0); al.rotation.x = -Math.PI / 2; s.add(al);
      const env = new L.GradientEquirectTexture(16); env.update(); s.environment = s.background = env;
      const cam = new L.EquirectCamera(); cam.position.set(0, 0, 3);
      pt.setScene(s, cam); pt._pathTracer.setSize(32, 16); pt._pathTracer.tiles.set(1, 1);
      for (let i = 0; i < 400 && pt.samples < 1; i++) { pt.renderSample(); await sleep(30); }
      env.dispose();
    } catch (e) { console.warn('擬真導覽：預先準備失敗', e); }
    this._warming = false;
  }
  _make(L) {
    if (this.pt) return this.pt;
    const pt = new L.WebGLPathTracer(this.renderer);
    pt.synchronizeRenderSize = false; pt.renderToCanvas = false; pt.renderDelay = 0; pt.minSamples = 0; pt.fadeDuration = 0; pt.rasterizeScene = false; pt.dynamicLowRes = false;
    pt.bounces = 5; pt.transmissiveBounces = 4; pt.filterGlossyFactor = 0.6; pt.multipleImportanceSampling = true; pt.textureSize.set(512, 512);
    this.pt = pt; this.L = L; return pt;
  }
  _gpuDone() {   // 等顯示卡把剛剛送出的工作做完（用來量速度、控制每次送多少）
    const gl = this.gl; if (!gl.fenceSync) return sleep(4);
    return new Promise((res) => { const s = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0); gl.flush();
      const chk = () => { const r = gl.clientWaitSync(s, 0, 0); if (r === gl.TIMEOUT_EXPIRED) setTimeout(chk, 1); else { gl.deleteSync(s); res(); } }; setTimeout(chk, 0); });
  }
  // scene：整理過、給光線追蹤用的場景；stations：[{ x, z, y, label }]（公尺）
  async start(scene, stations, opts = {}) {
    const gen = ++this.gen; this.alive = true; this.lights = opts.lights || null; this.viewing = false; this.cur = opts.cur || 0; this.fade = null;
    for (const s of this.stations) if (s.rt) s.rt.dispose();
    this.stations = stations.map((s) => ({ ...s, rt: null, has: false, done: false, spp: 0, pv: false }));
    this.viewMat.uniforms.mapA.value = this.viewMat.uniforms.mapB.value = this.black; this.viewMat.uniforms.mixT.value = 0; this._buildSpots();
    this.info = '準備場景'; this.onUpdate();
    const L = await loadLib(); if (gen !== this.gen) return;
    const pt = this._make(L); this.cam = this.cam || new L.EquirectCamera();
    const st0 = this.stations[this.cur]; this.cam.position.set(st0.x, st0.y, st0.z); this.cam.updateMatrixWorld();
    await sleep(30); if (gen !== this.gen) return;   // 讓「製作中」的畫面先出現
    const t0 = performance.now();
    if (this.lights) this.lights(this.cur);
    pt.setScene(scene, this.cam);   // 建立加速結構（幾十萬個三角形約 1～2 秒）
    this.t = { bvh: performance.now() - t0 };
    // 量這台電腦的速度：先用小尺寸算 1 次取樣
    const CW = opts.size ? Math.min(1024, opts.size) : 1024;   // 測試時指定小尺寸，量速度也用小的
    const P = pt._pathTracer; P.setSize(CW, CW / 2); P.tiles.set(1, 1); pt.reset();
    let guard = 0; while (pt.samples < 1 && guard++ < 3000) { pt.renderSample(); await this._gpuDone(); if (gen !== this.gen) return; if (pt.isCompiling) await sleep(30); }
    const c0 = performance.now(); pt.renderSample(); pt.renderSample(); await this._gpuDone(); if (gen !== this.gen) return;
    const ms = Math.max(0.5, (performance.now() - c0) / 2) * (1024 / CW) ** 2;   // 換算成 1024×512 算一次取樣的毫秒數
    // 依速度決定全景大小與取樣數：目標是第一站約 8 秒內完成
    const BUDGET = opts.budget || 8000, plan = (w) => ({ w, h: w / 2, per: ms * (w / 1024) ** 2 });
    let pick = null;
    for (const w of [4096, 3072, 2048]) { const p = plan(w); if (p.per * 40 <= BUDGET) { pick = p; break; } }
    if (!pick) pick = plan(2048);
    if (opts.size) pick = plan(opts.size);
    const maxTex = this.renderer.capabilities.maxTextureSize; if (pick.w > maxTex) pick = plan(2048);
    this.size = pick; this.spp = opts.spp || Math.max(12, Math.min(96, Math.floor(BUDGET / pick.per)));
    this.sppFine = opts.spp ? opts.spp * 2 : Math.max(this.spp * 3, 160);
    this.t.ms = ms; this.t.start = performance.now();
    console.log(`擬真導覽：1024×512 每次取樣 ${ms.toFixed(1)} ms → 全景 ${pick.w}×${pick.h}、第一輪 ${this.spp} 次取樣、第二輪 ${this.sppFine} 次`);
    const tx = Math.max(1, Math.round(pick.w / 512)), ty = Math.max(1, Math.round(pick.h / 512)); P.setSize(pick.w, pick.h); P.tiles.set(tx, ty); this.tilesN = tx * ty; this.batch = 1;
    this.job = null; this._pump(gen);
  }
  _next() {   // 下一個要算的站：目前所在的站優先，再來是離得近的；全部算過一輪後，再用更多取樣重算一輪（更乾淨）
    const S = this.stations, c = S[this.cur], d = (s) => Math.hypot(s.x - c.x, s.z - c.z);
    if (this.job && !this.job.s.done2 && this.job.s !== c && this.job.spp > this.job.target * 0.6) return this.job;   // 快算完的先算完
    if (!c.done) return { s: c, target: this.spp, pass: 1 };
    const todo = S.filter((s) => !s.done).sort((a, b) => d(a) - d(b)); if (todo.length) return { s: todo[0], target: this.spp, pass: 1 };
    if (!c.done2) return { s: c, target: this.sppFine, pass: 2 };
    const fine = S.filter((s) => !s.done2).sort((a, b) => d(a) - d(b)); if (fine.length) return { s: fine[0], target: this.sppFine, pass: 2 };
    return null;
  }
  async _pump(gen) {
    const pt = this.pt;
    while (this.alive && gen === this.gen) {
      const want = this._next();
      if (!want) { this.info = ''; this.onUpdate(); await sleep(300); continue; }
      if (!this.job || this.job.s !== want.s || this.job.pass !== want.pass) {
        this.job = { ...want, spp: 0 }; this.cam.position.set(want.s.x, want.s.y, want.s.z);
        if (this.lights) { this.lights(this.stations.indexOf(want.s)); pt.updateLights(); }
        pt.setCamera(this.cam);
      }
      const job = this.job, k = this.batch, t0 = performance.now();
      for (let i = 0; i < k; i++) pt.renderSample();
      await this._gpuDone(); if (gen !== this.gen) return;
      const dt = performance.now() - t0, target = this.viewing ? 7 : 50;   // 正在看全景時，每一格只借顯示卡約 7 毫秒，畫面才不會頓
      this.batch = Math.max(1, Math.min(this.tilesN * 4, Math.round(k * target / Math.max(dt, 0.5))));
      job.spp = pt.samples;
      const whole = Math.abs(job.spp - Math.round(job.spp)) < 1e-3;   // 剛好算完整張的時候才能存圖
      if (whole) {
        const n = Math.round(job.spp);
        if (job.pass === 1 && !job.s.pv && n >= Math.min(4, job.target) && n < job.target) { this._save(job.s, 3.2, 0.16); job.s.pv = true; }
        else if (job.pass === 1 && job.s.pv && n < job.target && n % 12 === 0 && job.s === this.stations[this.cur]) this._save(job.s, 2.6, 0.13);
        if (n >= job.target) {
          this._save(job.s, job.pass === 1 ? 2.2 : 1.4, job.pass === 1 ? 0.11 : 0.07);
          if (job.pass === 1) { if (this.debug) job.s.stats = this.stats(); job.s.done = true; if (!this.t.first) { this.t.first = performance.now() - this.t.start; console.log(`擬真導覽：第一站 ${(this.t.first / 1000).toFixed(1)} 秒完成`); } } else job.s.done2 = true;
          this.job = null;
        }
      }
      job.s.spp = job.spp; this.onUpdate();
      if (this.viewing) await nextFrame(); else if (pt.isCompiling) await sleep(30);
    }
  }
  _save(s, sigma, threshold) {
    const r = this.renderer, { w, h } = this.size;
    if (!s.rt) { s.rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.UnsignedByteType, depthBuffer: false, generateMipmaps: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, wrapS: THREE.RepeatWrapping }); }
    const u = this.blit.material.uniforms; u.map.value = this.pt.target.texture; u.sigma.value = sigma; u.threshold.value = threshold; u.exposure.value = this.exposure;
    const prev = r.getRenderTarget(), ac = r.autoClear; r.autoClear = false; r.setRenderTarget(s.rt); this.blit.render(r); r.setRenderTarget(prev); r.autoClear = ac;
    const first = !s.has; s.has = true;
    if (s === this.stations[this.cur] && first && !this.fade) { this.viewMat.uniforms.mapA.value = s.rt.texture; this.viewing = true; }
  }
  _buildSpots() {
    for (const o of [...this.spots.children]) { this.spots.remove(o); }
    const ringG = new THREE.RingGeometry(0.17, 0.26, 40).rotateX(-Math.PI / 2), dotG = new THREE.CircleGeometry(0.1, 32).rotateX(-Math.PI / 2);
    this.stations.forEach((s, i) => {
      const g = new THREE.Group(), mk = (geo, op) => { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#fff', transparent: true, opacity: op, depthTest: false, toneMapped: false })); m.renderOrder = 10; return m; };
      g.add(mk(ringG, 0.9), mk(dotG, 0.45)); const lb = labelSprite(s.label); lb.position.y = 0.32; g.add(lb);
      g.position.set(s.x, 0.03, s.z); g.userData.i = i; this.spots.add(g);
    });
  }
  has(i = this.cur) { const s = this.stations[i]; return !!(s && s.has); }
  progress() { const S = this.stations, n = S.length || 1, c = S[this.cur]; return { first: c ? (c.has ? 1 : Math.min(0.97, (c.spp || 0) / Math.min(4, this.spp || 4))) : 0, done: S.filter((s) => s.done).length, fine: S.filter((s) => s.done2).length, total: n, info: this.info }; }
  // 跳到另一站（還沒有畫面的話先排到最前面算，等有畫面再切）
  jump(i) {
    if (i === this.cur || !this.stations[i]) return false;
    const from = this.cur; this.cur = i; this.pending = null;
    if (this.stations[i].has) this.fade = { from, to: i, t: 0 }; else { this.pending = { from, to: i }; this.cur = i; }
    this.onUpdate(); return true;
  }
  // visible(i)：從目前這一站看不看得到第 i 站（給地上的圓圈用）
  render(camera, dt, visible) {
    const U = this.viewMat.uniforms, S = this.stations;
    if (this.pending && S[this.pending.to].has) { this.fade = { from: this.pending.from, to: this.pending.to, t: 0 }; this.pending = null; }
    if (this.fade) {
      const f = this.fade; f.t = Math.min(1, f.t + dt / 0.45);
      U.mapA.value = S[f.from].has ? S[f.from].rt.texture : this.black; U.mapB.value = S[f.to].rt.texture; U.mixT.value = f.t * f.t * (3 - 2 * f.t);
      if (f.t >= 1) { U.mapA.value = S[f.to].rt.texture; U.mixT.value = 0; this.fade = null; }
    } else if (S[this.cur] && S[this.cur].has && !this.pending) { U.mapA.value = S[this.cur].rt.texture; U.mixT.value = 0; }
    this.sphere.position.copy(camera.position);
    const c = S[this.cur], busy = this.fade || this.pending;
    for (const g of this.spots.children) { const i = g.userData.i, s = S[i]; g.visible = !busy && i !== this.cur && visible(i);
      if (g.visible) { const d = Math.hypot(s.x - c.x, s.z - c.z), k = Math.max(0.75, Math.min(2.2, d / 2.6)); g.scale.setScalar(k); } }
    const r = this.renderer; r.setRenderTarget(null); r.render(this.view, camera);
  }
  stats() {   // 測試用：目前累積畫面的亮度分布（線性值）
    const t = this.pt.target, w = t.width, h = t.height, buf = new Float32Array(w * h * 4); this.renderer.readRenderTargetPixels(t, 0, 0, w, h, buf);
    const L = []; let nan = 0; for (let i = 0; i < w * h; i++) { const v = 0.2126 * buf[i * 4] + 0.7152 * buf[i * 4 + 1] + 0.0722 * buf[i * 4 + 2]; if (v !== v) nan++; else L.push(v); }
    L.sort((a, b) => a - b); const q = (p) => +L[Math.floor(p * (L.length - 1))].toFixed(3);
    return { spp: this.pt.samples, nan, p05: q(0.05), p25: q(0.25), p50: q(0.5), p75: q(0.75), p95: q(0.95), p99: q(0.99), max: q(1), mean: +(L.reduce((a, b) => a + b, 0) / L.length).toFixed(3) };
  }
  // 存成圖片（測試或下載用）：回傳某一站全景的 canvas
  snapshot(i = this.cur) {
    const s = this.stations[i]; if (!s || !s.rt) return null; const { w, h } = this.size, buf = new Uint8Array(w * h * 4);
    this.renderer.readRenderTargetPixels(s.rt, 0, 0, w, h, buf);
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'), im = g.createImageData(w, h);
    for (let y = 0; y < h; y++) im.data.set(buf.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
    g.putImageData(im, 0, 0); return c;
  }
  stop() {
    this.alive = false; this.gen++; this.viewing = false; this.job = null; this.fade = this.pending = null;
    for (const s of this.stations) if (s.rt) { s.rt.dispose(); s.rt = null; }
    this.stations = []; this.viewMat.uniforms.mapA.value = this.viewMat.uniforms.mapB.value = this.black; this._buildSpots();
  }
}
