# 教師後台頁面整合說明

## 概述
已將兩個獨立的 standalone HTML 頁面整合到 `teacher.html` 主頁面中：
- **數據分析頁面** (原 teacher-analytics-standalone.html)
- **作業批改頁面** (原 teacher-review-standalone.html)

整合後共享導航列和統一的用戶界面。

---

## 新增的功能標籤

### 1. **📈 數據分析** (Analytics Tab)
**位置**: 主導航列 - 第 6 個標籤  
**功能**: 
- 分班級、課程、任務載入統計數據
- **完成度** - 顯示任務完成率圖表和表格
- **評量答對率** - 顯示每題答對率，可點擊查看詳細資訊
- **作業分數** - 顯示作業評分分布
- **完成時間** - 顯示學生完成任務耗時
- **異常警示** - 偵測並列出異常情況

**點擊題目查看詳情**:
- 題目文本和正確答案
- 每個選項的選擇人數
- 選擇該選項的學生列表（以 user_id_user_name 格式顯示）
- 答對率和答對人數統計

---

### 2. **✏️ 作業批改** (Grading Tab)
**位置**: 主導航列 - 第 7 個標籤  
**功能**:
- 分班級、任務、狀態篩選待批改作業
- 卡片式顯示學生作業列表
- 點擊卡片開啟批改 Modal
- 在 Modal 中：
  - 檢視作業上傳資訊和檔案
  - 輸入分數 (0-100)
  - 撰寫批改意見
  - 儲存批改結果

**統計資訊**:
- 總作業筆數
- 待批改數量（未批改）
- 已批改數量

---

## 技術整合細節

### HTML 結構
```
teacher.html
├─ 導航列 (navbar)
├─ Tab 導航 (7 個 Tab)
│  ├─ 班級管理 (classes)
│  ├─ 課程管理 (courses)
│  ├─ 授課安排 (assignments)
│  ├─ 代幣管理 (tokens)
│  ├─ 課堂監控 (review)
│  ├─ 數據分析 (analytics) ✨ NEW
│  └─ 作業批改 (grading) ✨ NEW
├─ Management Sections
│  ├─ analyticsSection
│  │  ├─ 篩選控制 (班級、課程、任務)
│  │  ├─ 五個分析 Tab
│  │  ├─ Canvas 圖表容器
│  │  └─ 資料表格
│  └─ gradingSection
│     ├─ 篩選控制
│     ├─ 統計資訊欄
│     └─ 作業卡片網格
└─ Modals
   ├─ questionModal (題目詳情)
   └─ reviewModal (批改表單)
```

### JavaScript 全局變數和函數

#### 數據分析相關
```javascript
analyticsCharts = {}              // 存儲 Chart.js 圖表實例
ANALYTICS_API_URL                 // API 基址

函數:
- loadAnalyticsClassList()       // 載入班級列表
- loadAnalyticsCourseList()      // 載入課程列表
- loadAnalyticsTaskList()        // 載入任務列表
- loadAnalyticsAssessmentStats() // 載入評量統計
- displayAnalyticsAssessmentChart() // 渲染評量圖表
- showAnalyticsQuestionDetail()  // 顯示題目詳情
- switchAnalyticsTab()           // 切換分析 Tab
```

#### 作業批改相關
```javascript
allGradingSubmissions = []        // 所有作業提交記錄
currentGradingSubmission = null  // 當前批改作業
GRADING_API_URL                   // API 基址

函數:
- loadGradingClassList()         // 載入班級列表
- loadGradingAllTasks()          // 載入任務列表
- loadGradingSubmissions()       // 載入作業提交
- displayGradingSubmissions()    // 顯示作業卡片
- openGradingReviewModal()       // 開啟批改 Modal
- submitGradingReview()          // 提交批改結果
```

---

## 使用流程

### 數據分析
1. 點擊導航列「📈 數據分析」標籤
2. 選擇班級（必要）
3. 選擇課程（可選）
4. 選擇任務（可選，用於評量分析）
5. 點擊不同分析 Tab 查看數據
6. 點擊題目可查看學生選項分佈

### 作業批改
1. 點擊導航列「✏️ 作業批改」標籤
2. 選擇班級、任務、狀態進行篩選
3. 點擊學生作業卡片
4. 在 Modal 中輸入分數和意見
5. 點擊「提交批改」儲存

---

## API 端點（共享）

兩個功能都使用相同的 Google Apps Script 後端：
```
基址: https://script.google.com/macros/s/AKfycbx_uW9qkUcPZ45bMfz7xWp3Z6JT-Tb8e_RhzJVTXpExQiJGLwec-N54MeZKlZOy9Rr-/exec

主要端點:
- getTeacherClasses              // 獲取教師班級
- getTeacherCourses             // 獲取教師課程
- getCourseDetails              // 獲取課程詳情
- getClassAssessmentAccuracyStats // 獲取評量答對率
- getTeacherPendingReviews      // 獲取待批改作業
- submitTaskReview              // 提交批改
```

---

## 樣式說明

### 新增 CSS 類別
- `.analytics-tab-item` - 分析 Tab 項目
- `.analytics-tab-content` - 分析 Tab 內容區域
- `.analytics-filter-tag` - 異常警示篩選按鈕

### 重用的樣式
- `management-section` - 主內容區塊
- `page-header` - 頁面標題
- `form-input` - 表單輸入框
- `form-label` - 表單標籤
- `modal-overlay` - Modal 遮罩

---

## 舊頁面說明

原始的獨立頁面仍然保留在項目中供參考：
- `teacher-analytics-standalone.html` - 可獨立運行的分析頁面
- `teacher-review-standalone.html` - 可獨立運行的批改頁面

但**建議使用 teacher.html** 以獲得完整的管理系統體驗。

---

## 常見問題

### Q: 為什麼圖表沒有顯示？
A: 確認已選擇班級且資料已載入。檢查瀏覽器控制台是否有錯誤。

### Q: 如何篩選特定班級的作業？
A: 在「作業批改」頁面選擇班級下拉選單，系統會自動載入該班級的作業。

### Q: 題目詳情中的學生名單格式是什麼？
A: 格式為 `user_id_user_name`，例如 `01_王小明`

### Q: 能否批量提交批改？
A: 目前需逐一開啟 Modal 批改。未來可擴展此功能。

---

## 後續改進方向

- [ ] 數據分析支援多任務同時對比
- [ ] 作業批改支援批量匯出評分結果
- [ ] 新增異常警示的自動通知功能
- [ ] 新增作業批改的範本管理
- [ ] 優化圖表渲染效能（目前使用 Chart.js）

---

## 聯絡方式

若有整合相關的問題或建議，請檢查：
1. 後端 API 是否正確配置
2. localStorage 中是否有 userEmail
3. 瀏覽器控制台的錯誤日誌

最後更新: 2025-12-16
