# race.test

## 新增戶型的步驟（照做，新戶型才一定會出現在選戶型畫面）

1. 平面資料放一個新檔 `js/plan-xxx.js`，`export const PLAN_XXX = {...}`（欄位格式照現有的 plan-*.js）。
2. 在 `js/plan.js` 上方 `import { PLAN_XXX } from './plan-xxx.js?v=…'`，並在 `UNITS` 加一列（id 不可重複）。
3. 換掉所有自家 JS 的版本號（一定要全部一起換，否則瀏覽器會混用新舊快取，選戶型畫面看不到新戶型或整個空白）：
   `node tools/check-units.mjs --bump 20261115a`
4. 推上去之前跑檢查，要看到「✓」才推：
   `node tools/check-units.mjs`
   會檢查：版本號是否一致、每個 plan-*.js 是否都有 import、每一戶的資料欄位、起點與家具是否在地板上、家具型號是否存在。
5. 網站是從 **main** 分支發布的。改在其他分支（PR）時，要合併進 main 網站才會更新；GitHub Pages 更新約需幾分鐘，看的人要重新整理。

## 擬真導覽（光線追蹤全景）

- 目前只開在「萬象の丘 A2」（`js/plan.js` 該戶的 `pano: true`）；其他戶型網址加 `?pano=1` 可以試。
- 手機「3D 導覽」分頁按「開始擬真導覽」，或導覽中按「✨ 擬真畫面」。大螢幕會在每個房間的站點各算一張 360° 全景（先算目前這一站，其餘在背景算），之後轉頭、跳站都只是在看算好的全景照。
- 程式：`js/pano.js`（算圖與播放）、`js/host.js` 的「擬真導覽」區塊（站點、燈光、窗簾、操作）。
- 套件放在 `vendor/three-gpu-pathtracer`（v0.0.23，配合 three r170）與 `vendor/three-mesh-bvh`（v0.8.3），由 index.html 的 importmap 載入；改過的地方記在各自的 `VERSION`。
- 調整用的網址參數：`panolight`（室內燈亮度，預設 9）、`panosky`（天空亮度）、`panoexp`（曝光）、`panosize`／`panospp`（固定全景寬度與取樣數，測試用）。
- 需要獨立顯示卡的電腦；手機、平板不會出現這個功能。
