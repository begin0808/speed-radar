import admin from 'firebase-admin';
import axios from 'axios';
import csv from 'csv-parser';
import proj4 from 'proj4';
import iconv from 'iconv-lite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// --- 環境設定 (ES Module 相容) ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 設定檔案路徑
const keyPath = path.join(__dirname, 'serviceAccountKey.json');

// ★ 設定本地 CSV 檔案路徑 (已修正為 local_data.csv)
const localCsvPath = path.join(__dirname, 'local_data.csv'); 

let db = null;

// 1. 嘗試初始化 Firebase (如果在本地端有金鑰才執行)
if (fs.existsSync(keyPath)) {
    try {
        const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        db = admin.firestore();
        console.log("✅ 偵測到金鑰，已連線 Firebase (支援資料庫寫入)");
    } catch (e) {
        console.warn("⚠️ 金鑰讀取失敗，跳過 Firebase 連線", e.message);
    }
} else {
    console.log("ℹ️ 未偵測到 serviceAccountKey.json，將僅執行靜態 JSON 產出 (GitHub Mode)");
}

proj4.defs("EPSG:3826", "+proj=tmerc +lat_0=0 +lon_0=121 +k=0.9999 +x_0=250000 +y_0=0 +ellps=GRS80 +units=m +no_defs");

const CSV_URL = 'https://opdadm.moi.gov.tw/api/v1/no-auth/resource/api/dataset/EA5E6FCD-B82D-43B7-A5CF-E9893253187E/resource/F35B13BF-565F-4679-BB5A-675B97801557/download';

function parseRoadName(addr) {
    if (!addr) return "";
    const highwayRegex = /(國道\S+號|台\d+線|快速道路)/;
    const highwayMatch = addr.match(highwayRegex);
    if (highwayMatch) return highwayMatch[1];

    const roadRegex = /(?:[縣市])?(?:.+?[區鄉鎮市])?(.+?[路街大道](?:[一二三四五六七八九十\d]+段)?)/;
    const roadMatch = addr.match(roadRegex);
    return roadMatch ? roadMatch[1] : "";
}

function guessDirection(address) {
    if (!address) return undefined;
    if (address.match(/往東|向東|西向東|東向/)) return 90;
    if (address.match(/往西|向西|東向西|西向/)) return 270;
    if (address.match(/往南|向南|北向南|南下|南向/)) return 180;
    if (address.match(/往北|向北|南向北|北上|北向/)) return 0;
    return undefined; 
}

function parseDirection(rawDirect, address) {
    if (rawDirect) {
        if (rawDirect.includes("雙向")) return undefined;
        if (rawDirect.includes("北")) return 0;
        if (rawDirect.includes("東北")) return 45;
        if (rawDirect.includes("東") && !rawDirect.includes("東北") && !rawDirect.includes("東南")) return 90;
        if (rawDirect.includes("東南")) return 135;
        if (rawDirect.includes("南") && !rawDirect.includes("東南") && !rawDirect.includes("西南")) return 180;
        if (rawDirect.includes("西南")) return 225;
        if (rawDirect.includes("西") && !rawDirect.includes("西南") && !rawDirect.includes("西北")) return 270;
        if (rawDirect.includes("西北")) return 315;
    }
    return guessDirection(address);
}

async function main() {
  console.log('🚀 [Step 1] 開始執行資料更新任務...');

  try {
    let stream;
    
    // 優先檢查本地是否有 CSV 檔案 (local_data.csv)
    if (fs.existsSync(localCsvPath)) {
        console.log(`📂 發現本地資料檔: ${localCsvPath}，將優先使用。`);
        stream = fs.createReadStream(localCsvPath).pipe(csv());
    } else {
        // 如果沒有本地檔案，才去網路下載
        console.log(`🌐 本地無資料 (${localCsvPath})，正在從政府開放平台下載...`);
        const response = await axios({
            method: 'get',
            url: CSV_URL,
            responseType: 'stream',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        stream = response.data.pipe(iconv.decodeStream('utf-8')).pipe(csv());
    }

    const cameras = [];
    console.log('📥 [Step 2] 正在解析 CSV...');

    for await (const row of stream) {
      const rawDirect = row['direct'] || row['拍攝方向'] || row['Direct'] || '';
      
      let lat = 0;
      let lng = 0;
      let limit = parseInt(row['速限'] || row['limit'] || 50);
      let address = row['設置地點'] || row['地點'] || row['address'] || row['Address'] || row['Location'] || row['location'] || '未知地點';
      let region = row['管轄警察局'] || row['CityName'] || '';

      if (row['Latitude'] && row['Longitude']) {
         lat = parseFloat(row['Latitude']);
         lng = parseFloat(row['Longitude']);
      } 
      else if ((row['X'] && row['Y']) || (row['DirectX'] && row['DirectY'])) {
         const x = parseFloat(row['X'] || row['DirectX']);
         const y = parseFloat(row['Y'] || row['DirectY']);
         const wgs84 = proj4("EPSG:3826", "EPSG:4326", [x, y]);
         lng = wgs84[0];
         lat = wgs84[1];
      }

      if (!lat || !lng || isNaN(lat) || isNaN(lng)) continue;

      const roadName = parseRoadName(address);
      const direction = parseDirection(rawDirect, address);

      cameras.push({
        id: `cam_${cameras.length}`,
        address: address,
        road_name: roadName,
        direct: rawDirect,
        direction: direction,
        limit: limit,
        lat: lat,
        lng: lng,
        region: region
      });
    }

    console.log(`✅ 解析完成，共取得 ${cameras.length} 筆有效資料`);

    if (cameras.length > 0) {
        // 輸出到專案根目錄
        const outputPath = path.join(__dirname, '../cameras.json');
        console.log(`💾 [Step 3] 正在產生靜態檔案: ${outputPath}`);
        fs.writeFileSync(outputPath, JSON.stringify(cameras, null, 2));
        console.log('✅ cameras.json 產生成功！');

        if (db) {
             // await uploadToFirestore(cameras); 
        }
    } else {
        console.warn('⚠️ 警告：沒有解析到任何資料');
        process.exit(1);
    }

  } catch (error) {
    console.error('❌ 發生錯誤:', error.message);
    process.exit(1);
  }
}

main();