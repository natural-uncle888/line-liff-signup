# LINE 群組活動報名系統（LIFF + Google Sheets + Netlify）

這是一套「取代 LINE 接龍 +1」的輕量報名小工具：

- ✅ 建立活動（含行程分段：可新增多段）
- ✅ 報名可選段落（例如只參加早上、只參加第一站）
- ✅ 一鍵「全程參加」/「取消全程」
- ✅ 即時顯示：每段參加人數、參加名單（可提升想參加的意願）
- ✅ 支援 LIFF 取得使用者 displayName / userId（不需另外註冊）

> 部署架構：前端靜態網頁（GitHub / Netlify）+ 後端 Google Apps Script（寫入 Google Sheets）

---

## 1) 建立 Google Sheet（資料庫）

建立一個新的 Google Sheet，並建立 3 個工作表（sheet tab）：

1. **Events**
2. **Segments**
3. **Registrations**

請在每個工作表第一列建立欄位（欄位名稱務必一致）：

### Events（活動主檔）
| 欄位 | 說明 |
|---|---|
| eventId | 系統產生（例如 EVT-20260205-AB12） |
| title | 活動名稱 |
| description | 活動簡述（可留空） |
| status | OPEN / CLOSED |
| createdAt | 建立時間（ISO） |
| closedAt | 結單時間（ISO，可空） |

### Segments（行程分段）
| 欄位 | 說明 |
|---|---|
| eventId | 對應 Events.eventId |
| segmentId | 系統產生（例如 SEG-0001） |
| date | 日期（YYYY-MM-DD） |
| startTime | 開始（HH:mm，可空） |
| endTime | 結束（HH:mm，可空） |
| location | 地點 |
| highlights | 重點（可用換行） |
| order | 排序（1,2,3...） |

### Registrations（報名）
| 欄位 | 說明 |
|---|---|
| eventId | 活動 ID |
| userId | LINE userId（LIFF 取得） |
| displayName | LINE 顯示名稱 |
| segments | 參加段落（以逗號分隔 segmentId，例如 `SEG-0001,SEG-0003`） |
| updatedAt | 更新時間（ISO） |

---

## 2) 部署 Google Apps Script（後端 API）

1. 打開 https://script.google.com/ → 新建專案
2. 將 `apps-script/Code.gs` 內容完整貼到專案（覆蓋原本 Code.gs）
3. 在 Code.gs 最上方設定：
   - `SPREADSHEET_ID`：你的 Google Sheet ID
   - `ADMIN_TOKEN`：管理密碼（自行設定一串亂碼）

4. **部署** → **新增部署** → 類型選「網頁應用程式」
   - 執行身分：我
   - 存取權限：任何人（或「任何有連結的人」）
5. 部署完成會得到 **Web App URL**（長得像 `https://script.google.com/macros/s/...../exec`）
6. 把這個 URL 填到前端檔案：
   - `site/config.js` 裡的 `API_BASE`

---

## 3) 建立 LIFF App（讓 LINE 內開啟 + 取得使用者）

1. 到 LINE Developers 建立 Provider / Channel（Messaging API 或 LINE Login 都可，常用 LINE Login）
2. 建立 LIFF App
   - LIFF URL：填你 Netlify 部署後的 `https://xxx.netlify.app/`
   - Scope 建議：`profile`（即可取得 displayName、userId）
3. 拿到 **LIFF ID**
4. 把 LIFF ID 填到：
   - `site/config.js` 裡的 `LIFF_ID`

> 測試時也可以先不設定 LIFF，直接用瀏覽器打開，系統會以「訪客模式」讓你操作（不寫入 userId，只能看畫面）。  
> 正式上線建議都走 LIFF，才會有姓名清單與去重。

---

## 4) 前端部署到 GitHub / Netlify

- 將 `site/` 內檔案放到 GitHub repo 根目錄，或指定 Netlify 的 publish directory。
- Netlify 設定：Build command 可留空（純靜態），Publish directory 指向 `site`

---

## 5) 使用方式（你在班級群組要怎麼用）

- 管理員先開 `.../admin.html` 建立活動（輸入管理密碼）
- 建立後，回到首頁 `.../index.html` 就會看到活動列表
- 點進活動 → 勾選想參加段落 → 送出
- 群組同學打開同一個 LIFF 連結，就會看到目前名單與人數（有「跟風效應」）

---

## 常見問題

### Q1. 會不會被重複報名？
不會，系統以 `eventId + userId` 為唯一鍵，送出會「覆蓋更新」同一人的段落選擇。

### Q2. 要怎麼結單？
到 `admin.html`，選擇活動按「結單（CLOSE）」；結單後前台仍可看名單，但不能再更新報名。

### Q3. 想要匿名/不顯示姓名？
可以，把前端 `renderParticipants()` 裡顯示 displayName 的區塊改成只顯示人數即可。

---

祝使用順利！
