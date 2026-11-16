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
