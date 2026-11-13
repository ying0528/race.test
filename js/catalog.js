// 家具型錄：32 類，每類至少 10 款。尺寸為市面常見的標準規格（寬 w × 深 d × 高 h，單位 cm）。
// 每列：[名稱, w, d, h, 色/材質, 變化款]
// 之後要換成合作品牌的實際商品，只要改這個檔案的名稱與尺寸即可。
export const WOODS = { oak: '#C9A77C', walnut: '#7A5236', white: '#F1EEE8', black: '#2E2F31', ash: '#DCCBB0', gray: '#8D8D8A', teak: '#A9763F' };

export const GROUPS = ['客廳', '餐廳', '臥室', '書房', '收納', '裝飾', '廚具', '衛浴', '隔間', '裝修櫃'];

export const CATS = [
  { id: 'sofa', n: '沙發', g: '客廳', t: 'sofa', items: [
    ['單人沙發', 90, 88, 80, '#B9B4AA'], ['雙人沙發', 150, 88, 80, '#8E9AA6'], ['雙人沙發', 165, 90, 82, '#C9B8A0'],
    ['三人沙發', 200, 90, 82, '#A7ABAF'], ['三人沙發', 220, 92, 82, '#5E6B7A'], ['三人沙發', 233, 91, 82, '#C8C2B6'],
    ['四人沙發', 260, 95, 82, '#7C8471'], ['L 型沙發（右貴妃）', 260, 160, 82, '#B5B0A6', 'L'],
    ['L 型沙發（左貴妃）', 280, 170, 82, '#6F6A64', 'Lr'], ['三人皮沙發', 210, 90, 80, '#7A4E32', 'leather'],
    ['迷你單人沙發', 70, 70, 75, '#B9B4AA'], ['小雙人沙發', 120, 78, 78, '#8E9AA6']] },
  { id: 'arm', n: '單椅', g: '客廳', t: 'sofa', items: [
    ['扶手單椅', 75, 78, 80, '#C9B8A0'], ['扶手單椅', 80, 80, 82, '#7C8471'], ['休閒椅', 70, 75, 85, '#5E6B7A'],
    ['皮革單椅', 78, 80, 80, '#7A4E32', 'leather'], ['皮革單椅', 82, 85, 85, '#2E2F31', 'leather'], ['絨布單椅', 72, 74, 78, '#2F3E5C'],
    ['絨布單椅', 72, 74, 78, '#B5654A'], ['寬版單椅', 95, 88, 80, '#B9B4AA'], ['腳凳', 60, 60, 42, '#C8C2B6', 'stool'], ['腳凳', 80, 50, 42, '#8E9AA6', 'stool']] },
  { id: 'coffee', n: '茶几', g: '客廳', t: 'table', items: [
    ['圓形茶几', 80, 80, 40, 'oak', 'round'], ['圓形茶几', 90, 90, 38, 'walnut', 'round'], ['圓形茶几', 100, 100, 40, 'marble', 'round'],
    ['方形茶几', 80, 80, 40, 'oak'], ['長方茶几', 100, 50, 42, 'oak'], ['長方茶几', 110, 60, 42, 'walnut'], ['長方茶几', 120, 60, 45, 'white'],
    ['長方茶几', 130, 70, 42, 'black'], ['長方茶几', 120, 60, 40, 'marble'], ['橢圓茶几', 120, 70, 40, 'walnut', 'round'],
    ['小圓几', 50, 50, 40, 'oak', 'round'], ['小茶几', 60, 40, 40, 'walnut']] },
  { id: 'side', n: '邊桌', g: '客廳', t: 'table', items: [
    ['圓形邊桌', 40, 40, 50, 'oak', 'round'], ['圓形邊桌', 45, 45, 55, 'walnut', 'round'], ['圓形邊桌', 50, 50, 55, 'black', 'round'],
    ['圓形邊桌', 45, 45, 50, 'marble', 'round'], ['方形邊桌', 40, 40, 50, 'oak'], ['方形邊桌', 45, 45, 55, 'white'], ['方形邊桌', 50, 50, 50, 'walnut'],
    ['沙發邊几', 50, 30, 60, 'black'], ['沙發邊几', 55, 35, 62, 'oak'], ['角几', 60, 60, 45, 'ash']] },
  { id: 'tvcab', n: '電視櫃', g: '客廳', t: 'cab', items: [
    ['電視櫃', 120, 40, 45, 'oak'], ['電視櫃', 150, 40, 45, 'walnut'], ['電視櫃', 160, 40, 50, 'white'], ['電視櫃', 180, 40, 45, 'oak'],
    ['電視櫃', 180, 45, 50, 'walnut'], ['電視櫃', 200, 40, 45, 'ash'], ['電視櫃', 210, 40, 50, 'black'], ['電視櫃', 240, 40, 45, 'oak'],
    ['懸吊電視櫃', 180, 35, 30, 'white', 'float'], ['電視高櫃', 150, 40, 60, 'gray'],
    ['小電視櫃', 90, 35, 45, 'oak']] },
  { id: 'tv', n: '電視', g: '客廳', t: 'tv', items: [
    ['32 吋電視', 73, 6, 43], ['43 吋電視', 97, 6, 56], ['48 吋電視', 107, 6, 62], ['50 吋電視', 112, 6, 65], ['55 吋電視', 123, 6, 71],
    ['58 吋電視', 130, 6, 75], ['65 吋電視', 145, 6, 83], ['75 吋電視', 167, 6, 96], ['77 吋電視', 172, 6, 99], ['85 吋電視', 190, 6, 108]] },
  { id: 'dtable', n: '餐桌', g: '餐廳', t: 'table', items: [
    ['2 人餐桌', 80, 80, 75, 'oak'], ['4 人餐桌', 120, 75, 75, 'oak'], ['4 人餐桌', 130, 80, 75, 'walnut'], ['4–6 人餐桌', 140, 80, 75, 'ash'],
    ['6 人餐桌', 150, 90, 75, 'oak'], ['6 人餐桌', 160, 90, 75, 'walnut'], ['6–8 人餐桌', 180, 90, 75, 'marble'], ['8 人餐桌', 200, 100, 75, 'walnut'],
    ['4 人圓桌', 110, 110, 75, 'oak', 'round'], ['6 人圓桌', 130, 130, 75, 'marble', 'round'],
    ['2 人小方桌', 60, 60, 75, 'oak'], ['2 人小圓桌', 70, 70, 75, 'white', 'round']] },
  { id: 'chair', n: '餐椅', g: '餐廳', t: 'chair', items: [
    ['實木餐椅', 45, 50, 82, 'oak'], ['實木餐椅', 45, 50, 82, 'walnut'], ['實木餐椅', 46, 52, 80, 'black'], ['實木餐椅', 46, 52, 80, 'white'],
    ['布面餐椅', 48, 55, 84, '#B9B4AA', 'pad'], ['布面餐椅', 48, 55, 84, '#5E6B7A', 'pad'], ['布面餐椅', 48, 55, 84, '#7C8471', 'pad'],
    ['皮面餐椅', 47, 54, 83, '#7A4E32', 'pad'], ['吧台椅', 42, 45, 100, 'black', 'bar'], ['長凳', 120, 38, 45, 'oak', 'bench']] },
  { id: 'bed', n: '床', g: '臥室', t: 'bed', items: [
    ['單人床 3 尺', 99, 200, 95, '#D9D4CA'], ['單人加大 3.5 尺', 114, 200, 100, '#C9D6DF'], ['單人加大 3.5 尺（軟床頭）', 114, 202, 110, '#B9B4AA', 'soft'],
    ['雙人床 5 尺', 160, 200, 100, '#E3DED4'], ['雙人床 5 尺（軟床頭）', 160, 202, 115, '#8E9AA6', 'soft'], ['雙人加大 6 尺', 190, 200, 100, '#D9D4CA'],
    ['雙人加大 6 尺（軟床頭）', 190, 202, 115, '#5E6B7A', 'soft'], ['特大雙人 6×7 尺', 190, 224, 110, '#C8C2B6', 'soft'],
    ['兒童床', 88, 170, 70, '#E6C9B8'], ['上下舖 3.5 尺', 114, 204, 165, '#C9D6DF', 'bunk'],
    ['單人床 3 尺（短版）', 99, 190, 90, '#D9D4CA']] },
  { id: 'nstand', n: '床頭櫃', g: '臥室', t: 'cab', items: [
    ['床頭櫃', 40, 40, 50, 'oak'], ['床頭櫃', 45, 40, 50, 'oak'], ['床頭櫃', 50, 40, 50, 'walnut'], ['床頭櫃', 50, 45, 55, 'white'], ['床頭櫃', 55, 40, 45, 'ash'],
    ['床頭櫃', 60, 40, 50, 'walnut'], ['床頭櫃', 45, 35, 60, 'black'], ['床頭櫃', 40, 35, 45, 'white'], ['床頭櫃', 48, 40, 52, 'gray'], ['床頭櫃', 42, 42, 55, 'teak'],
    ['迷你床頭櫃', 30, 30, 45, 'oak']] },
  { id: 'ward', n: '衣櫃', g: '臥室', t: 'cab', items: [
    ['衣櫃（2 門）', 80, 60, 200, 'white'], ['衣櫃（2 門）', 100, 60, 200, 'oak'], ['衣櫃（3 門）', 120, 60, 210, 'white'], ['衣櫃（3 門）', 150, 60, 210, 'ash'],
    ['衣櫃（4 門）', 160, 60, 220, 'walnut'], ['衣櫃（4 門）', 200, 60, 220, 'white'], ['衣櫃（5 門）', 240, 60, 230, 'white'], ['衣櫃（6 門）', 270, 60, 240, 'gray'],
    ['滑門衣櫃', 180, 65, 220, 'oak', 'slide'], ['滑門衣櫃', 210, 65, 230, 'black', 'slide'],
    ['單門衣櫃', 50, 55, 180, 'white'], ['窄衣櫃（2 門）', 60, 55, 190, 'oak']] },
  { id: 'dresser', n: '梳妝台', g: '臥室', t: 'table', items: [
    ['梳妝台（含鏡）', 80, 40, 135, 'white', 'mirror'], ['梳妝台（含鏡）', 90, 45, 135, 'oak', 'mirror'], ['梳妝台（含鏡）', 100, 45, 135, 'walnut', 'mirror'], ['梳妝台（含鏡）', 120, 45, 135, 'white', 'mirror'],
    ['梳妝台（含鏡）', 100, 40, 135, 'ash', 'mirror'], ['梳妝台（含鏡）', 80, 45, 135, 'black', 'mirror'], ['化妝桌（無鏡）', 80, 40, 75, 'oak'], ['化妝桌（無鏡）', 100, 45, 75, 'white'],
    ['化妝椅', 45, 35, 45, '#C8C2B6', 'stoolseat'], ['全身鏡', 50, 22, 160, 'black', 'fmirror']] },
  { id: 'desk', n: '書桌', g: '書房', t: 'table', items: [
    ['書桌', 80, 50, 75, 'oak'], ['書桌', 100, 60, 75, 'oak'], ['書桌', 120, 60, 75, 'oak'], ['書桌', 120, 70, 75, 'white'], ['書桌', 140, 60, 75, 'walnut'],
    ['書桌', 140, 70, 75, 'ash'], ['書桌', 160, 70, 75, 'walnut'], ['書桌', 160, 80, 75, 'black'], ['升降桌', 120, 68, 75, 'white'], ['升降桌', 150, 75, 75, 'oak'],
    ['迷你書桌', 60, 40, 75, 'oak'], ['小書桌', 70, 45, 75, 'white'], ['兒童書桌', 80, 50, 60, 'ash'], ['窄版書桌', 90, 45, 75, 'walnut']] },
  { id: 'dchair', n: '書桌椅', g: '書房', t: 'ochair', items: [
    ['辦公椅', 60, 60, 95, '#2E2F31'], ['辦公椅', 60, 60, 95, '#8D8D8A'], ['辦公椅', 62, 62, 100, '#5E6B7A'], ['高背辦公椅', 66, 66, 120, '#2E2F31'],
    ['高背辦公椅', 66, 66, 120, '#7A4E32'], ['人體工學椅', 68, 66, 125, '#3C4047'], ['人體工學椅', 68, 66, 125, '#DADADA'], ['兒童成長椅', 55, 55, 90, '#6FA8C9'],
    ['兒童成長椅', 55, 55, 90, '#E6A5A5'], ['電競椅', 70, 70, 130, '#B03A3A'],
    ['小型書桌椅', 45, 45, 80, '#8D8D8A'], ['無扶手書桌椅', 50, 50, 85, '#5E6B7A'], ['兒童椅', 38, 38, 62, '#E3B23C']] },
  { id: 'shelf', n: '書櫃', g: '書房', t: 'shelf', items: [
    ['書櫃', 60, 30, 180, 'oak'], ['書櫃', 80, 30, 180, 'oak'], ['書櫃', 80, 30, 200, 'white'], ['書櫃', 100, 30, 200, 'walnut'], ['書櫃', 120, 30, 200, 'white'],
    ['窄書櫃', 40, 30, 180, 'ash'], ['矮書櫃', 80, 35, 120, 'oak'], ['矮書櫃', 120, 35, 90, 'white'], ['大書牆', 160, 35, 200, 'walnut'], ['矮書櫃', 60, 30, 90, 'black'],
    ['迷你書櫃', 40, 25, 90, 'oak'], ['窄高書櫃', 30, 30, 160, 'white']] },
  { id: 'shoe', n: '鞋櫃', g: '收納', t: 'cab', items: [
    ['鞋櫃', 60, 35, 100, 'white'], ['鞋櫃', 80, 35, 100, 'oak'], ['鞋櫃', 100, 35, 105, 'white'], ['鞋櫃', 120, 35, 105, 'ash'], ['鞋櫃', 160, 35, 105, 'white'],
    ['高鞋櫃', 80, 35, 180, 'oak'], ['高鞋櫃', 100, 40, 200, 'white'], ['高鞋櫃', 120, 40, 200, 'walnut'], ['穿鞋椅', 90, 35, 45, 'oak'], ['薄型鞋櫃', 80, 20, 120, 'white'],
    ['小鞋櫃', 50, 30, 90, 'white']] },
  { id: 'chest', n: '斗櫃', g: '收納', t: 'cab', items: [
    ['三斗櫃', 60, 45, 80, 'oak', 'drawer'], ['三斗櫃', 80, 45, 80, 'white', 'drawer'], ['四斗櫃', 80, 45, 100, 'walnut', 'drawer'], ['四斗櫃', 100, 45, 85, 'oak', 'drawer'],
    ['寬斗櫃', 120, 45, 80, 'white', 'drawer'], ['五斗櫃', 60, 45, 120, 'ash', 'drawer'], ['五斗櫃', 80, 45, 120, 'oak', 'drawer'], ['六斗櫃', 120, 45, 90, 'walnut', 'drawer'],
    ['餐邊櫃', 140, 45, 80, 'oak'], ['餐邊櫃', 160, 45, 85, 'white'],
    ['迷你斗櫃', 45, 40, 70, 'oak', 'drawer']] },
  { id: 'rug', n: '地毯', g: '裝飾', t: 'rug', items: [
    ['地毯', 170, 120, 1, '#D8D2C6'], ['地毯', 200, 140, 1, '#B9B4AA'], ['地毯', 230, 160, 1, '#DDD6C8'], ['地毯', 290, 200, 1, '#A7ABAF'], ['地毯', 340, 240, 1, '#C9B8A0'],
    ['圓形地毯', 120, 120, 1, '#D8D2C6', 'round'], ['圓形地毯', 150, 150, 1, '#8E9AA6', 'round'], ['圓形地毯', 200, 200, 1, '#C9B8A0', 'round'],
    ['玄關地墊', 90, 60, 1, '#6F6A64'], ['走道地毯', 200, 80, 1, '#7C8471'],
    ['小地毯', 120, 80, 1, '#D8D2C6']] },
  { id: 'lamp', n: '立燈', g: '裝飾', t: 'lamp', items: [
    ['立燈', 35, 35, 150, '#F4EBDD'], ['立燈', 40, 40, 160, '#F4EBDD'], ['立燈', 45, 45, 165, '#EFE2CC'], ['立燈', 35, 35, 140, '#FFFFFF'], ['三腳立燈', 55, 55, 150, '#F4EBDD', 'tripod'],
    ['三腳立燈', 60, 60, 160, '#E8DCC8', 'tripod'], ['桌燈', 25, 25, 45, '#F4EBDD', 'small'], ['桌燈', 30, 30, 55, '#EFE2CC', 'small'], ['釣魚燈', 40, 40, 190, '#F4EBDD'], ['立燈', 30, 30, 170, '#DADADA']] },
  { id: 'plant', n: '植栽', g: '裝飾', t: 'plant', items: [
    ['小盆栽', 30, 30, 45], ['中型盆栽', 40, 40, 90], ['中型盆栽', 45, 45, 110], ['大型盆栽', 55, 55, 130], ['大型盆栽', 60, 60, 150],
    ['琴葉榕', 60, 60, 170], ['龜背芋', 70, 70, 120], ['虎尾蘭', 35, 35, 80], ['天堂鳥', 80, 80, 180], ['桌上盆栽', 22, 22, 30]] },
  // ---------------- 廚具 ----------------
  { id: 'cook', n: '瓦斯爐', g: '廚具', t: 'cook', items: [
    ['雙口瓦斯爐（含下櫃）', 75, 60, 88, 'white', 2], ['雙口瓦斯爐（含下櫃）', 80, 60, 88, 'oak', 2], ['三口瓦斯爐（含下櫃）', 90, 60, 88, 'white', 3],
    ['三口瓦斯爐（含下櫃）', 86, 60, 88, 'gray', 3], ['IH 雙口爐（含下櫃）', 75, 60, 88, 'white', 'ih2'], ['IH 三口爐（含下櫃）', 80, 60, 88, 'black', 'ih3'],
    ['單口爐（含下櫃）', 45, 60, 88, 'white', 1], ['雙口瓦斯爐（含下櫃）', 70, 55, 85, 'ash', 2], ['三口瓦斯爐（含下櫃）', 90, 60, 88, 'walnut', 3], ['四口瓦斯爐（含下櫃）', 90, 60, 88, 'black', 4]] },
  { id: 'sink', n: '水槽', g: '廚具', t: 'sink', items: [
    ['單槽水槽櫃', 60, 60, 88, 'white'], ['單槽水槽櫃', 70, 60, 88, 'white'], ['單槽水槽櫃', 80, 60, 88, 'white'], ['大單槽水槽櫃', 90, 60, 88, 'oak'], ['大單槽水槽櫃', 100, 60, 88, 'gray'],
    ['雙槽水槽櫃', 120, 60, 88, 'white', 'double'], ['雙槽水槽櫃', 110, 60, 88, 'ash', 'double'], ['單槽水槽櫃', 80, 60, 88, 'black'], ['單槽水槽櫃', 75, 55, 85, 'walnut'], ['吧台小水槽', 50, 50, 88, 'white']] },
  { id: 'fridge', n: '冰箱', g: '廚具', t: 'fridge', items: [
    ['雙門冰箱', 60, 65, 170, '#D9DBDD'], ['雙門冰箱', 65, 70, 178, '#3C4047'], ['三門冰箱', 68, 70, 180, '#D9DBDD'], ['四門冰箱', 75, 72, 183, '#C9B8A0'],
    ['對開冰箱', 91, 73, 178, '#3C4047', 'side'], ['法式四門冰箱', 83, 74, 178, '#D9DBDD', 'side'], ['單門小冰箱', 50, 55, 125, '#F1EEE8'], ['迷你冰箱', 48, 50, 85, '#F1EEE8'],
    ['五門冰箱', 68, 73, 183, '#8D8D8A'], ['六門冰箱', 75, 73, 183, '#2E2F31', 'side']] },
  { id: 'kcab', n: '櫥櫃', g: '廚具', t: 'kcab', items: [
    ['流理台下櫃', 40, 60, 88, 'white'], ['流理台下櫃', 45, 60, 88, 'white'], ['流理台下櫃', 60, 60, 88, 'white'], ['流理台下櫃', 80, 60, 88, 'white'], ['流理台下櫃', 90, 60, 88, 'oak'],
    ['流理台下櫃', 100, 60, 88, 'gray'], ['流理台下櫃', 120, 60, 88, 'white'], ['中島', 150, 80, 90, 'white'], ['中島', 180, 90, 90, 'walnut'], ['吧台', 120, 45, 105, 'oak']] },
  { id: 'hood', n: '排油煙機', g: '廚具', t: 'hood', items: [
    ['排油煙機', 70, 50, 40], ['排油煙機', 75, 50, 40], ['排油煙機', 80, 50, 40], ['排油煙機', 90, 50, 40], ['隱藏式排油煙機', 70, 35, 30],
    ['隱藏式排油煙機', 80, 35, 30], ['倒 T 型排油煙機', 90, 50, 60, null, 'T'], ['倒 T 型排油煙機', 80, 50, 60, null, 'T'], ['斜背式排油煙機', 90, 42, 50], ['中島型排油煙機', 90, 60, 60, null, 'T']] },
  { id: 'tower', n: '電器櫃', g: '廚具', t: 'tower', items: [
    ['電器櫃（烤箱）', 60, 60, 200, 'white'], ['電器櫃（烤箱）', 60, 60, 220, 'oak'], ['電器櫃（烤箱＋微波）', 60, 60, 220, 'gray', 2], ['電器櫃', 80, 60, 200, 'white'],
    ['電器櫃', 90, 60, 220, 'walnut', 2], ['洗碗機（下嵌）', 60, 60, 88, 'white', 'dw'], ['洗碗機（下嵌）', 45, 60, 88, 'white', 'dw'], ['餐櫃', 120, 45, 200, 'white'],
    ['餐櫃', 100, 45, 190, 'oak'], ['淨水器櫃', 45, 60, 88, 'gray', 'dw']] },
  // ---------------- 衛浴 ----------------
  { id: 'toilet', n: '馬桶', g: '衛浴', t: 'toilet', items: [
    ['單體馬桶', 38, 70, 72], ['單體馬桶', 40, 70, 74], ['分離式馬桶', 37, 73, 78, null, 'two'], ['分離式馬桶', 38, 75, 80, null, 'two'], ['免治一體馬桶', 40, 70, 55, null, 'smart'],
    ['免治一體馬桶', 41, 72, 58, null, 'smart'], ['壁掛馬桶', 36, 54, 40, null, 'wall'], ['壁掛馬桶', 37, 56, 42, null, 'wall'], ['省空間馬桶', 36, 64, 72], ['小便斗', 35, 33, 60, null, 'wall']] },
  { id: 'vanity', n: '洗手台', g: '衛浴', t: 'vanity', items: [
    ['浴櫃洗手台', 50, 45, 85, 'white'], ['浴櫃洗手台', 60, 48, 85, 'oak'], ['浴櫃洗手台', 70, 48, 85, 'white'], ['浴櫃洗手台', 80, 50, 85, 'walnut'], ['浴櫃洗手台', 90, 50, 85, 'gray'],
    ['浴櫃洗手台', 100, 52, 85, 'white'], ['雙盆浴櫃', 120, 52, 85, 'oak', 'double'], ['立柱洗手台', 50, 42, 85, 'white', 'ped'], ['小型洗手台', 45, 35, 85, 'white'], ['角落洗手台', 40, 40, 85, 'white', 'ped'],
    ['迷你洗手台', 40, 30, 85, 'white']] },
  { id: 'tub', n: '浴缸', g: '衛浴', t: 'tub', items: [
    ['浴缸', 120, 70, 55], ['浴缸', 130, 70, 55], ['浴缸', 140, 70, 55], ['浴缸', 150, 70, 55], ['浴缸', 150, 75, 58],
    ['浴缸', 160, 75, 58], ['浴缸', 170, 75, 58], ['浴缸', 170, 80, 60], ['獨立浴缸', 150, 72, 58, null, 'free'], ['獨立浴缸', 170, 80, 60, null, 'free']] },
  { id: 'shower', n: '淋浴間', g: '衛浴', t: 'shower', items: [
    ['淋浴間', 80, 80, 195], ['淋浴間', 90, 90, 195], ['淋浴間', 100, 80, 195], ['淋浴間', 100, 100, 195], ['淋浴間', 120, 80, 195],
    ['淋浴間', 120, 90, 195], ['淋浴間', 140, 90, 195], ['淋浴間', 150, 90, 195], ['一字淋浴拉門', 120, 8, 195, null, 'panel'], ['一字淋浴拉門', 90, 8, 195, null, 'panel']] },
  { id: 'mirror', n: '鏡櫃', g: '衛浴', t: 'mirror', items: [
    ['鏡櫃', 50, 15, 70], ['鏡櫃', 60, 15, 70], ['鏡櫃', 70, 15, 70], ['鏡櫃', 80, 15, 70], ['鏡櫃', 90, 15, 70],
    ['鏡櫃', 100, 15, 70], ['鏡櫃', 120, 15, 70], ['圓鏡', 60, 4, 60, null, 'round'], ['圓鏡', 80, 4, 80, null, 'round'], ['除霧方鏡', 75, 4, 100]] },
  { id: 'washer', n: '洗衣機', g: '衛浴', t: 'washer', items: [
    ['滾筒洗衣機', 60, 60, 85], ['滾筒洗衣機', 60, 65, 85], ['洗脫烘滾筒', 60, 66, 85], ['直立洗衣機', 55, 58, 95, null, 'top'], ['直立洗衣機', 60, 62, 100, null, 'top'],
    ['直立洗衣機', 64, 67, 105, null, 'top'], ['乾衣機', 60, 60, 85], ['洗乾堆疊', 60, 65, 175, null, 'stack'], ['洗衣櫃（含洗衣機）', 80, 62, 90], ['小型洗衣機', 50, 50, 85, null, 'top']] },
  // 裝修櫃（落地、靠牆）：寬度可伸縮，門片數量會跟著變
  { id: 'built', n: '裝修櫃', g: '裝修櫃', t: 'built', items: [
    ['頂天系統衣櫃', 240, 60, 280, '#D9C2A3', 'ward', 'veneer'], ['電視牆收納櫃', 300, 40, 280, '#D9C2A3', 'tvwall', 'veneer'],
    ['玄關鞋櫃＋穿鞋椅', 200, 40, 280, '#D9C2A3', 'entry', 'veneer'], ['整面開放書牆', 240, 35, 280, '#D9C2A3', 'books', 'veneer'],
    ['餐邊電器高櫃', 180, 60, 280, '#F1EEE8', 'pantry', 'matte'], ['床頭背牆＋吊櫃', 300, 40, 280, '#D9C2A3', 'bedwall', 'veneer'],
    ['書桌＋上吊櫃', 160, 60, 250, '#D9C2A3', 'desk', 'veneer'], ['臥榻收納櫃', 220, 60, 280, '#D9C2A3', 'bench', 'veneer'],
    ['化妝台＋開放更衣牆', 300, 50, 280, '#EFEBE3', 'dress', 'leather']] },
  // 牆上置物架：第 8 欄是預設離地高度
  { id: 'wshelf', n: '牆上置物架', g: '裝修櫃', t: 'wshelf', items: [
    ['一字層板（三層）', 120, 22, 84, '#D9C2A3', 'planks', 'veneer', 110], ['方格＋層板組合', 160, 20, 130, '#F1EEE8', 'cubes', 'matte', 88],
    ['洞洞板置物牆', 100, 16, 120, '#CFC2B2', 'peg', 'matte', 90], ['懸吊玻璃展示櫃', 160, 35, 100, '#D9C2A3', 'glassc', 'veneer', 120]] },
  // 牆面與拉門：寬＝長度（可在手機上伸縮）、深＝厚度、高＝到天花板。第 6 欄是形式，第 7 欄是預設材質
  { id: 'wall', n: '牆面／拉門', g: '隔間', t: 'wall', items: [
    ['實牆', 200, 10, 280, '#F1EEE8', 'full', 'solid'], ['實牆＋門洞', 240, 10, 280, '#F1EEE8', 'open', 'solid'],
    ['清玻璃隔間', 200, 8, 280, '#1E1F22', 'full', 'glass'], ['霧面玻璃隔間', 200, 8, 280, '#1E1F22', 'full', 'frost'],
    ['半牆＋木格柵', 200, 10, 280, '#D9C2A3', 'hslat', 'slat'], ['半牆＋玻璃', 200, 10, 280, '#1E1F22', 'hglass', 'glass'],
    ['黑框玻璃拉門', 200, 12, 280, '#1E1F22', 'slide2', 'glass'], ['白框懸吊玻璃拉門', 200, 10, 280, '#F1EEE8', 'slide1', 'glass'],
    ['花格磚牆', 240, 14, 280, '#A3A897', 'lattice', 'solid'], ['雙面展示櫃隔間', 200, 45, 170, '#C9C8BC', 'showcase', 'd1']] },
];

const BY = Object.fromEntries(CATS.map(c => [c.id, c]));
export const WOOD_NAMES = { oak: '橡木', walnut: '胡桃木', white: '白色', black: '黑色', ash: '梣木', gray: '灰色', teak: '柚木', marble: '大理石' };
const FABRIC_T = { sofa: 1, chair: 1, ochair: 1, bed: 1, rug: 1 };

// 四種風格：各有自己的木色與布料色，型錄會依風格換成對應款式
export const STYLES = {
  nordic: { n: '北歐', d: '淺木地板、灰色布沙發', floor: 'wood', floorC: '#D6B98F', wall: '#F2EFEA', accent: '#8FA58A', sw: ['#D6B98F', '#F2EFEA', '#B8BCBF', '#8FA58A'],
    woods: ['oak', 'ash', 'white'], fabrics: ['#B8BCBF', '#C9D6DF', '#D9D4CA', '#8FA58A', '#E3DED4'] },
  modern: { n: '現代', d: '深色木紋、黑灰家具', floor: 'wood', floorC: '#9A8C7D', wall: '#ECEAE6', accent: '#C9A86A', sw: ['#9A8C7D', '#ECEAE6', '#5A5E64', '#C9A86A'],
    woods: ['black', 'gray', 'walnut'], fabrics: ['#5A5E64', '#3C4047', '#8D8D8A', '#B59A6A', '#2E2F31'] },
  japandi: { n: '日式', d: '原木色、亞麻質感', floor: 'wood', floorC: '#C4A074', wall: '#F1EBE0', accent: '#7D8B6F', sw: ['#C4A074', '#F1EBE0', '#D8CCB8', '#7D8B6F'],
    woods: ['teak', 'oak', 'ash'], fabrics: ['#D8CCB8', '#C8B9A0', '#A7906E', '#7D8B6F', '#E6DDCD'] },
  luxe: { n: '輕奢', d: '石紋地坪、深藍與黃銅', floor: 'marble', floorC: '#E9E5DE', wall: '#EFEBE5', accent: '#C8A464', sw: ['#E9E5DE', '#EFEBE5', '#2F3E5C', '#C8A464'],
    woods: ['walnut', 'white', 'marble'], fabrics: ['#2F3E5C', '#E7E1D7', '#6B5B73', '#3F5A54', '#8C7A5B'] },
};

// 可選的地板材質（顏色取自業主提供的材質圖）。k：wood 木地板／terrazzo 彩色石紋／tile 磁磚／stone 石紋磚／carpet 地毯
export const FLOOR_GROUPS = [
  { n: '淺色木地板', items: [['w15', '洗白橡木', '#E7DAC8'], ['w04', '淺楓木', '#DEA164'], ['w19', '淺橡木', '#C99A69'], ['w11', '淺橡木・米', '#C3A581'], ['w08', '自然橡木', '#B68B55'], ['w01', '灰橡木', '#9C8368'], ['w14', '煙燻橡木', '#95784F'], ['w16', '暖橡木', '#96784F']] },
  { n: '中色木地板', items: [['w07', '櫻桃木', '#AB6B42'], ['w09', '柚木', '#99673A'], ['w03', '拼色胡桃', '#866247'], ['w18', '復古橡木', '#7B623C'], ['w12', '灰木紋', '#978879'], ['w20', '灰褐木', '#68584A']] },
  { n: '深色木地板', items: [['w10', '深橡木', '#694D29'], ['w17', '深胡桃', '#5D3822'], ['w02', '咖啡胡桃', '#573B28'], ['w21', '深胡桃・霧', '#4E3B2D'], ['w06', '紅木', '#722813'], ['w05', '黑胡桃', '#2D1E18'], ['w13', '碳黑木', '#313132']] },
  { n: '彩色石紋', items: [['t0131', '0131 白', '#F4EFE4', 'terrazzo'], ['t0136', '0136 米白', '#DDCDBD', 'terrazzo'], ['t0138', '0138 粉米', '#D7BBA4', 'terrazzo'], ['t0139', '0139 米黃', '#C9A881', 'terrazzo'], ['t0133', '0133 灰藍', '#B3B6BF', 'terrazzo'], ['t0134', '0134 藍紫', '#8D8C9C', 'terrazzo']] },
  { n: '長條磚', items: [['s1', '磚紅', '#7C4B47', 'strip'], ['s2', '深咖啡', '#5E4A45', 'strip'], ['s3', '石板灰', '#8E8A84', 'strip'], ['s4', '米黃', '#C9B49A', 'strip'], ['s5', '灰綠', '#6E7A6A', 'strip']] },
  { n: '磁磚・地毯', items: [['c1', '米白磁磚', '#DBCFC0', 'tile'], ['c2', '米色磁磚', '#BCA382', 'tile'], ['c3', '米色粗面磚', '#B59B7D', 'stone'], ['c4', '鏽色磚', '#916C45', 'stone'], ['c5', '灰色石紋磚', '#646560', 'stone'], ['c6', '棕色地毯', '#5F4C3A', 'carpet']] },
];
// 牆面材質：每種有幾個顏色；sheen＝石材可選亮面／霧面；alt＝木紋可換成木格柵。
// 選擇存成字串 "種類|顏色|m"（m＝霧面），例如 "pandora|#EFEEEA|"、"slat|#C08A52|"
export const WALL_GROUPS = [
  { k: 'pandora', n: '潘朵拉白', sheen: true, colors: [['#EFEEEA', '白'], ['#D9D4CB', '米灰'], ['#B5B4B1', '灰'], ['#7E7D7B', '深灰']] },
  { k: 'gold', n: '金脈大理石', sheen: true, colors: [['#F3F0EA', '白底金脈'], ['#EAE3D6', '米白金脈'], ['#E6E6E4', '灰白'], ['#3A3836', '黑金']] },
  { k: 'stucco', n: '礦物塗料', colors: [['#A9A79F', '水泥灰'], ['#CFC6B8', '米灰'], ['#E7E1D6', '暖白'], ['#9FA593', '灰綠'], ['#B9866A', '赤陶']] },
  { k: 'veneer', n: '木紋牆板', alt: ['slat', '木格柵'], colors: [['#D9C2A3', '淺橡'], ['#C08A52', '原木'], ['#7A5236', '胡桃'], ['#5A4A3E', '煙燻']] },
  { k: 'travertine', n: '洞石', sheen: true, matte: true, colors: [['#E2D6C1', '米白'], ['#D6C19C', '米黃'], ['#BDB6AB', '灰']] },
  { k: 'concrete', n: '清水模', colors: [['#B9B7B1', '淺灰'], ['#8F8D88', '深灰'], ['#BDB3A6', '暖灰']] },
];
export function parseWall(key) {   // 不合法就回傳 null
  if (typeof key !== 'string') return null; const [k, c, m] = key.split('|'), g = WALL_GROUPS.find((x) => x.k === k || (x.alt && x.alt[0] === k));
  if (!g || !g.colors.some((x) => x[0] === c)) return null; return { kind: k, color: c, matte: m === 'm', group: g };
}
export const FLOORS = {}; for (const g of FLOOR_GROUPS) for (const [id, n, c, k = 'wood'] of g.items) FLOORS[id] = { id, n, c, k };

// 模擬人偶（等比例）
export const PEOPLE = {
  m: { n: '成人男性', h: 175, w: 50, d: 28, color: '#8FA3B8' },
  f: { n: '成人女性', h: 160, w: 44, d: 25, color: '#D9A49A' },
  c: { n: '小孩', h: 100, w: 32, d: 20, color: '#E3C06A' },
};

// 'sofa:5' -> 規格。styleKey 決定這一款在該風格下的木色／布料色
const WCOL = [['#F1EEE8', '白'], ['#E4DCCD', '米白'], ['#C9C9C7', '淺灰'], ['#5A5E64', '深灰'], ['#1E1F22', '黑'], ['#4A3324', '深咖啡'], ['#D9C2A3', '淺橡'], ['#C08A52', '原木'], ['#7A5236', '胡桃']];
// 可以換材質、換顏色的家具：沙發（含單椅）、衣櫃、牆面與拉門
export const FINISH = {
  sofa: { mats: [['flannel', '絨布'], ['weave', '編織布'], ['leather', '皮革'], ['linen', '亞麻布']],
    colors: [['#C9C9C7', '淺灰'], ['#B8AC98', '米灰'], ['#DDD3C2', '奶油'], ['#B5673A', '焦糖'], ['#7A4E32', '咖啡'], ['#5A5E64', '深灰'], ['#3F5A54', '墨綠'], ['#2F3E5C', '深藍'], ['#2E2F31', '黑']] },
  wall: { mats: [['solid', '實牆'], ['glass', '清玻璃'], ['frost', '霧面玻璃']], colors: WCOL, label: '牆面／外框顏色' },
  built: { mats: [['veneer', '木紋'], ['matte', '霧面烤漆'], ['glass', '清玻璃門'], ['frost', '霧面玻璃門']], colors: [['#D9C2A3', '淺橡'], ['#C08A52', '原木'], ['#7A5236', '胡桃'], ['#F1EEE8', '白'], ['#CFC2B2', '奶茶'], ['#C9C9C7', '淺灰'], ['#5A5E64', '深灰'], ['#2E2F31', '黑']], label: '櫃體顏色' },
  shelf: { mats: [['veneer', '木紋'], ['matte', '霧面烤漆']], colors: [['#D9C2A3', '淺橡'], ['#C08A52', '原木'], ['#7A5236', '胡桃'], ['#F1EEE8', '白'], ['#CFC2B2', '奶茶'], ['#C9C9C7', '淺灰'], ['#5A5E64', '深灰'], ['#2E2F31', '黑']], label: '層板顏色' },
  slat: { mats: [['slat', '木格柵']], colors: WCOL, label: '格柵顏色' },
  gdoor: { mats: [['glass', '清玻璃'], ['frost', '霧面玻璃']], colors: WCOL, label: '外框顏色' },
  lattice: { mats: [['solid', '花格磚']], colors: [['#A3A897', '灰綠'], ['#EFEDE8', '白'], ['#9C9890', '水泥灰'], ['#B9866A', '赤陶'], ['#C9A57A', '木色']], label: '顏色' },
  // mats 是抽屜／檯面的選項：mcol 給手機上的色塊，mlabel 是標題
  showcase: { mats: [['d1', '焦糖'], ['d2', '咖啡'], ['d3', '墨綠'], ['d4', '奶茶']], mcol: { d1: '#8A4B33', d2: '#5D3A2A', d3: '#3F5A54', d4: '#C9B49A' }, mlabel: '抽屜',
    colors: [['#C9C8BC', '灰綠'], ['#EFEDE8', '白'], ['#D9C2A3', '淺橡'], ['#5A5E64', '深灰']], label: '櫃體' },
  dress: { mats: [['leather', '咖啡皮革'], ['walnut', '胡桃木'], ['white', '白色']], mcol: { leather: '#6E4630', walnut: '#6B4A33', white: '#F1EEE8' }, mlabel: '檯面',
    colors: [['#EFEBE3', '白'], ['#D9C2A3', '淺橡'], ['#CFC2B2', '奶茶'], ['#9FA593', '灰綠']], label: '櫃體' },
  ward: { mats: [['frame', '實木框門'], ['matte', '霧面烤漆'], ['stone', '石紋面板'], ['veneer', '木紋平板']],
    colors: [['#D9C2A3', '淺橡'], ['#C08A52', '原木'], ['#7A5236', '胡桃'], ['#EFE9DD', '米白'], ['#CFC2B2', '奶茶'], ['#C9C9C7', '淺灰'], ['#5A5E64', '深灰'], ['#2E2F31', '黑']] },
};
export const finishOf = (s) => (!s ? null : s.t === 'sofa' ? 'sofa' : s.cat === 'ward' ? 'ward' : s.t === 'wall' ? (s.v === 'lattice' ? 'lattice' : s.v === 'showcase' ? 'showcase' : s.v === 'hslat' ? 'slat' : s.v === 'full' || s.v === 'open' ? 'wall' : 'gdoor') : s.t === 'built' ? (s.v === 'dress' ? 'dress' : 'built') : s.t === 'wshelf' ? 'shelf' : null);
// 牆面沿長度方向哪幾段是擋住的（其餘是門洞／拉門開口）。回傳 [[x1, x2], ...]，x 以牆中心為 0
// 拉門的開口（門關著時這段被門扇擋住，3D 導覽走近才會滑開）。回傳 [x1, x2] 或 null
export function doorGap(s) {
  const w = s.w;
  if (s.v === 'slide2') { const lw = (w - 12) / 2 + 3; return [-w / 2 + 6 + lw, w / 2 - 6]; }   // 雙扇：右扇滑到左扇後面
  if (s.v === 'slide1') return [-w / 2 + 8 + (w - 16) / 2, w / 2 - 8];   // 單扇：門扇滑到左半邊的固定牆前面
  return null;
}
export function wallSegs(s) {
  const w = s.w;
  if (s.v === 'open') { const dw = Math.min(90, w - 30); return [[-w / 2, -dw / 2], [dw / 2, w / 2]]; }
  const g = doorGap(s); if (g) return [[-w / 2, g[0]], [g[1], w / 2]];
  return [[-w / 2, w / 2]];
}
// 可以伸縮寬度的種類與範圍（cm）；牆上置物架另外可以調離地高度
export const lenRange = (s) => (!s ? null : s.v === 'showcase' ? { min: 120, max: 300, step: 10 } : s.v === 'dress' ? { min: 200, max: 400, step: 10 } : s.t === 'wall' ? { min: 40, max: 600, step: 10 } : s.t === 'built' ? { min: 100, max: 400, step: 10 } : s.t === 'wshelf' ? { min: 60, max: 300, step: 10 } : null);
export const elevRange = (s) => (s && s.t === 'wshelf' ? { min: 40, max: Math.max(40, 265 - s.h), step: 10 } : null);
export function getItem(key, styleKey, it) {
  const [cid, i] = String(key).split(':');
  if (cid === 'person') { const p = PEOPLE[i]; return p ? { key, cat: 'person', catName: '人偶', t: 'person', name: `${p.n}（${p.h} cm）`, w: p.w, d: p.d, h: p.h, color: p.color, v: i, elev: 0 } : null; }
  const cat = BY[cid]; if (!cat) return null;
  const r = cat.items[+i]; if (!r) return null;
  const st = STYLES[styleKey] || STYLES.nordic;
  let color = r[4] || null, name = r[0];
  if (color && (WOODS[color] || color === 'marble')) { color = st.woods[+i % st.woods.length]; name += '・' + WOOD_NAMES[color]; }
  else if (color && color[0] === '#' && FABRIC_T[cat.t]) color = st.fabrics[+i % st.fabrics.length];
  let elev = 0;
  if (cat.t === 'tv') elev = Math.max(60, 115 - r[3] / 2);       // 壁掛，中心離地約 115cm
  if (cat.t === 'hood') elev = 160;
  if (cat.t === 'mirror') elev = 105;
  if (r[5] === 'float') elev = 25;
  const s = { key, cat: cat.id, catName: cat.n, t: cat.t, name, w: r[1], d: r[2], h: r[3], color, v: r[5] || null, elev };
  if (cat.t === 'wall' || cat.t === 'built' || cat.t === 'wshelf') s.fin = r[6];
  if (cat.t === 'wshelf') s.elev = r[7];
  const lr = lenRange(s); if (it && it.len && lr) s.w = Math.max(lr.min, Math.min(lr.max, it.len));   // 伸縮後的寬度
  const er = elevRange(s); if (it && it.el != null && er) s.elev = Math.max(er.min, Math.min(er.max, it.el));   // 置物架離地高度
  if (it && it.m && it.c && finishOf(s)) { s.fin = it.m; s.color = it.c; }   // 個別指定的材質與顏色
  return s;
}

// 平面圖上的顏色
export function planColor(it) {
  if (!it) return '#999';
  if (it.color && it.color[0] === '#') return it.color;
  if (it.color === 'marble') return '#E3DFD8';
  if (it.color && WOODS[it.color]) return WOODS[it.color];
  return { tv: '#2A2B2D', plant: '#6E9A5B', hood: '#B8BCC1', toilet: '#F4F4F2', tub: '#F4F4F2', shower: '#CFE2EA', mirror: '#CFE0E8', washer: '#ECECEA' }[it.t] || '#CCCCCC';
}

// ---------- 人偶姿勢：在椅子上坐，其餘站著；人偶不能和床重疊 ----------
function seatOf(s) {
  if (s.t === 'ochair') return { h: Math.min(46, s.h * 0.5) + 4, single: true, back: 2 - s.w * 0.4 + 4 };
  if (s.t === 'chair') {
    if (s.v === 'bench') return { h: s.h, single: false, xr: s.w / 2 - 22, center: true };
    return { h: s.v === 'bar' ? 76 : s.v === 'pad' ? 51 : 47, single: true, back: -s.d / 2 + 4 };
  }
  if (s.t === 'sofa') {
    if (s.v === 'stool') return { h: s.h, single: true, center: true };
    const dm = s.v === 'L' || s.v === 'Lr' ? 95 : s.d, zo = -(s.d - dm) / 2, arm = Math.max(12, Math.min(20, s.w * 0.09));
    return { h: 46, single: s.w < 140, xr: Math.max(0, s.w / 2 - arm - 26), back: zo - dm / 2 + 22, front: zo + dm / 2 };
  }
  if (s.v === 'stoolseat') return { h: s.h, single: true, center: true };
  return null;
}
// 回傳 Map(id -> { mode: 'stand'|'sit'|'lie', x, y, r, elev, seat?, len? })
export function resolvePeople(items) {
  const out = new Map(), furn = [], ppl = [];
  for (const it of items) { const s = getItem(it.key); if (s) (s.t === 'person' ? ppl : furn).push({ it, s }); }
  const cs = (f) => { const a = f.it.r * Math.PI / 180; return [Math.cos(a), Math.sin(a)]; };
  const local = (f, p) => { const [c, s] = cs(f), dx = p.it.x - f.it.x, dy = p.it.y - f.it.y; return [dx * c + dy * s, -dx * s + dy * c]; };
  const world = (f, lx, ly) => { const [c, s] = cs(f); return [f.it.x + lx * c - ly * s, f.it.y + lx * s + ly * c]; };
  const inside = (f, p) => { const [lx, ly] = local(f, p); return Math.abs(lx) <= f.s.w / 2 && Math.abs(ly) <= f.s.d / 2 ? lx : null; };
  const taken = new Set();
  for (const p of ppl) {
    if (out.get(p.it.id)) continue;
    let res = null;
    for (const f of furn) {
      const si = seatOf(f.s); if (!si || (si.single && taken.has(f.it.id))) continue;
      const lx = inside(f, p); if (lx === null) continue;
      taken.add(f.it.id);
      const sx = si.single ? 0 : Math.max(-si.xr, Math.min(si.xr, lx)), lz = si.center ? -0.125 * p.s.h : Math.max(si.back + 0.1 * p.s.h, si.front === undefined ? -1e9 : si.front - 0.235 * p.s.h + 4);   // 膝蓋要超出坐墊前緣
      const [x, y] = world(f, sx, lz);
      res = { mode: 'sit', x, y, r: f.it.r, elev: 0, seat: si.h, on: f.it.id }; break;
    }
    out.set(p.it.id, res || { mode: 'stand', x: p.it.x, y: p.it.y, r: p.it.r, elev: 0 });
  }
  return out;
}

// 人偶不能和床重疊：落在床的範圍內就推到最近的床邊外側。有移動就回傳 true
export function keepOffBeds(person, items) {
  const ps = getItem(person.key); if (!ps || ps.t !== 'person') return false;
  let moved = false; const m = ps.w / 2 + 2;
  for (let pass = 0; pass < 3; pass++) for (const b of items) {
    const s = getItem(b.key); if (!s || s.t !== 'bed') continue;
    const a = b.r * Math.PI / 180, co = Math.cos(a), si = Math.sin(a), dx = person.x - b.x, dy = person.y - b.y, lx = dx * co + dy * si, ly = -dx * si + dy * co, hx = s.w / 2 + m, hy = s.d / 2 + m;
    if (Math.abs(lx) >= hx || Math.abs(ly) >= hy) continue;
    const opts = [[hx - lx, hx, ly], [lx + hx, -hx, ly], [hy - ly, lx, hy], [ly + hy, lx, -hy]].sort((p, q) => p[0] - q[0])[0];
    person.x = Math.round(b.x + opts[1] * co - opts[2] * si); person.y = Math.round(b.y + opts[1] * si + opts[2] * co); moved = true;
  }
  return moved;
}
