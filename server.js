import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const port = 3000;

// 在 ES Module (type: "module") 模式下，預設沒有 __dirname，需要手動建立
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 設定靜態檔案資料夾 (將當前目錄設為網站根目錄)
// 這樣瀏覽器就能讀取到您的 .html 檔案
app.use(express.static(__dirname));

// 啟動伺服器
app.listen(port, () => {
  console.log(`\n🚀 伺服器已啟動！`);
  console.log(`📂 正在服務的資料夾: ${__dirname}`); // 新增這行：顯示目前服務的路徑，方便您確認是否為 speed-radar
  console.log(`---------------------------------------------`);
  console.log(`👉 請用瀏覽器打開此網址進行測試：`);
  console.log(`   http://localhost:${port}/speed_camera_firebase.html`);
  console.log(`---------------------------------------------\n`);
});