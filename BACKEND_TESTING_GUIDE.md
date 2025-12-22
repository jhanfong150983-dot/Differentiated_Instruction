# 後端功能測試指南

## 📋 測試前準備

### 1. 部署 Google Apps Script

1. **開啟 Apps Script 編輯器**
   - 前往您的 Google Sheets: `14SuT1RwetyXMNBU1SeEUA0wZxZXCt7tVM5I0RcVL1As`
   - 點擊「擴充功能」→「Apps Script」

2. **複製更新後的 code.gs**
   - 將更新後的 `code.gs` 內容完整複製貼上
   - 儲存檔案（Ctrl+S）

3. **部署為 Web 應用程式**
   - 點擊右上角「部署」→「新增部署作業」
   - 選擇類型：「網頁應用程式」
   - 說明：填入「測試後端 API v1」
   - 執行身分：「我」
   - 具有存取權的使用者：「所有人」
   - 點擊「部署」
   - **複製 Web 應用程式 URL**（格式：https://script.google.com/macros/s/.../exec）

4. **記錄測試資訊**
   ```
   API_URL = [您的 Web 應用程式 URL]
   測試教師 Email = [您的 Gmail]
   測試學生 Email = [任意學生 Email]
   ```

---

## 🧪 測試流程（按順序執行）

### 測試 1：檢查 SHEET_CONFIG 更新

**目的**：確認 TASK_SUBMISSIONS 已加入配置

**測試方法**：
1. 在 Apps Script 編輯器中
2. 執行測試函數（新增臨時函數）：

```javascript
function testSheetConfig() {
  Logger.log('TASK_SUBMISSIONS: ' + SHEET_CONFIG.SHEETS.TASK_SUBMISSIONS);
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.TASK_SUBMISSIONS);
  Logger.log('表格是否存在: ' + (sheet !== null));
  Logger.log('表格欄位數: ' + (sheet ? sheet.getLastColumn() : 0));
}
```

3. 點擊「執行」→ 選擇 `testSheetConfig`
4. 查看「執行日誌」（Ctrl+Enter）

**預期結果**：
```
TASK_SUBMISSIONS: 作業提交記錄表
表格是否存在: true
表格欄位數: 24
```

✅ **通過標準**：表格存在且有 24 個欄位

---

### 測試 2：測試檔案上傳功能（uploadTaskWork）

**目的**：驗證完整的 24 欄記錄

**準備測試資料**：
1. 先確保您有一個有效的 `task_progress_id`（從 TASK_PROGRESS 表中查詢）
2. 準備一個小型測試檔案（例如：文字檔案 "test.txt"）

**測試方法 A：使用 Apps Script 測試函數**

```javascript
function testUploadTaskWork() {
  // 準備測試資料
  const testFileContent = "這是測試上傳的檔案內容";
  const base64Content = Utilities.base64Encode(testFileContent);

  // 🔴 請替換為真實的 task_progress_id 和 email
  const testParams = {
    taskProgressId: 'PROG_1734249600000_xxx', // ← 替換成真實的
    fileName: 'test_upload.txt',
    fileData: base64Content,
    fileMime: 'text/plain',
    userEmail: 'your-student-email@gmail.com' // ← 替換成真實的
  };

  const result = uploadTaskWork(testParams);

  Logger.log('=== 上傳結果 ===');
  Logger.log(JSON.stringify(result, null, 2));

  // 檢查記錄
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.TASK_SUBMISSIONS);
  const lastRow = sheet.getLastRow();
  const recordData = sheet.getRange(lastRow, 1, 1, 24).getValues()[0];

  Logger.log('=== 最新記錄（24欄） ===');
  Logger.log('A (submission_id): ' + recordData[0]);
  Logger.log('B (task_progress_id): ' + recordData[1]);
  Logger.log('C (user_email): ' + recordData[2]);
  Logger.log('D (user_id): ' + recordData[3]);
  Logger.log('E (user_name): ' + recordData[4]);
  Logger.log('F (class_id): ' + recordData[5]);
  Logger.log('G (class_name): ' + recordData[6]);
  Logger.log('H (task_id): ' + recordData[7]);
  Logger.log('I (task_name): ' + recordData[8]);
  Logger.log('J (file_url): ' + recordData[9]);
  Logger.log('K (file_name): ' + recordData[10]);
  Logger.log('L (file_type): ' + recordData[11]);
  Logger.log('M (file_size): ' + recordData[12]);
  Logger.log('N (upload_time): ' + recordData[13]);
  Logger.log('O (version): ' + recordData[14]);
  Logger.log('P (is_latest): ' + recordData[15]);
  Logger.log('Q (submission_status): ' + recordData[16]);
  Logger.log('R (review_status): ' + recordData[17]);
}
```

**測試方法 B：使用 Postman / curl**

```bash
# 使用 curl 測試（Windows PowerShell）
$body = @{
    action = "uploadTaskWork"
    taskProgressId = "PROG_xxx"  # 替換真實值
    fileName = "test.txt"
    fileData = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes("test content"))
    fileMime = "text/plain"
    userEmail = "student@gmail.com"  # 替換真實值
} | ConvertTo-Json

Invoke-RestMethod -Uri "YOUR_WEB_APP_URL" -Method POST -Body $body -ContentType "application/json"
```

**預期結果**：
```json
{
  "success": true,
  "fileUrl": "https://drive.google.com/...",
  "submissionId": "SUB_1734249600000_xxx",
  "version": 1,
  "message": "檔案上傳成功！（第 1 版）"
}
```

**驗證重點**：
- ✅ 回傳 `success: true`
- ✅ 有 `version` 欄位
- ✅ Google Sheets 中新增一筆 24 欄完整記錄
- ✅ `is_latest` = TRUE
- ✅ `submission_status` = "待批改"
- ✅ `review_status` = "未批改"

---

### 測試 3：測試版本管理

**目的**：確認重複上傳時版本號遞增，舊版本 is_latest 變 FALSE

**測試方法**：
使用相同的 `task_progress_id` 再次執行測試 2

**預期結果**：
```json
{
  "success": true,
  "version": 2,  // ← 版本號遞增
  "message": "檔案上傳成功！（第 2 版）"
}
```

**驗證重點**：
- ✅ 新記錄的 `version` = 2
- ✅ 新記錄的 `is_latest` = TRUE
- ✅ 舊記錄（version 1）的 `is_latest` = FALSE

**Google Sheets 檢查**：
1. 開啟「作業提交記錄表」
2. 篩選相同的 `task_progress_id`
3. 應該看到兩筆記錄：
   - 第一筆：version=1, is_latest=FALSE
   - 第二筆：version=2, is_latest=TRUE

---

### 測試 4：測試批改功能 - 取得待批改列表

**目的**：教師可以取得待批改的作業

**測試方法**：

```javascript
function testGetPendingReviews() {
  const result = getTeacherPendingReviews({
    teacherEmail: 'your-teacher-email@gmail.com',  // ← 替換
    classId: '',  // 空白 = 所有班級
    status: ''    // 空白 = 所有狀態
  });

  Logger.log('=== 待批改列表 ===');
  Logger.log(JSON.stringify(result, null, 2));
  Logger.log('總數: ' + result.total);

  if (result.reviews && result.reviews.length > 0) {
    Logger.log('第一筆資料:');
    Logger.log('  學生: ' + result.reviews[0].user_name);
    Logger.log('  任務: ' + result.reviews[0].task_name);
    Logger.log('  班級: ' + result.reviews[0].class_name);
    Logger.log('  檔案: ' + result.reviews[0].file_url);
    Logger.log('  狀態: ' + result.reviews[0].review_status);
  }
}
```

**預期結果**：
```json
{
  "success": true,
  "reviews": [
    {
      "submission_id": "SUB_xxx",
      "user_name": "王小明",
      "class_name": "資訊一甲",
      "task_name": "Python基礎",
      "file_url": "https://drive.google.com/...",
      "review_status": "未批改",
      ...
    }
  ],
  "total": 2
}
```

**驗證重點**：
- ✅ 只顯示教師有權限的班級
- ✅ 只顯示 `is_latest = TRUE` 的記錄
- ✅ 包含完整的學生、班級、任務資訊

---

### 測試 5：測試批改功能 - 提交批改

**目的**：教師可以對作業進行評分和評語

**測試方法**：

```javascript
function testSubmitReview() {
  // 🔴 先從測試 4 取得一個 submission_id
  const result = submitTaskReview({
    submissionId: 'SUB_xxx',  // ← 從測試 4 的結果取得
    teacherEmail: 'teacher@gmail.com',
    reviewScore: 85,
    reviewComment: '做得很好！繼續加油！',
    reviewStatus: '已批改',
    submissionStatus: '已批改'
  });

  Logger.log('=== 批改結果 ===');
  Logger.log(JSON.stringify(result, null, 2));

  // 驗證記錄已更新
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.TASK_SUBMISSIONS);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === 'SUB_xxx') {  // ← 替換成真實的 submission_id
      Logger.log('=== 批改記錄（已更新） ===');
      Logger.log('Q (submission_status): ' + data[i][16]);
      Logger.log('R (review_status): ' + data[i][17]);
      Logger.log('S (reviewer_email): ' + data[i][18]);
      Logger.log('T (reviewer_name): ' + data[i][19]);
      Logger.log('U (review_time): ' + data[i][20]);
      Logger.log('V (review_score): ' + data[i][21]);
      Logger.log('W (review_comment): ' + data[i][22]);
      break;
    }
  }
}
```

**預期結果**：
```json
{
  "success": true,
  "message": "批改記錄已儲存",
  "reviewTime": "2024-12-15 10:30:00"
}
```

**驗證重點**：
- ✅ `review_status` 更新為 "已批改"
- ✅ `reviewer_email` 和 `reviewer_name` 已填入
- ✅ `review_score` = 85
- ✅ `review_comment` 已儲存
- ✅ `review_time` 有時間戳

---

### 測試 6：測試 Analytics - 任務完成度統計

**目的**：取得全班任務完成率

**測試方法**：

```javascript
function testTaskCompletionStats() {
  const result = getClassTaskCompletionStats({
    classId: 'CLASS_xxx',  // ← 替換真實的班級 ID
    courseId: ''  // 空白 = 所有課程
  });

  Logger.log('=== 任務完成度統計 ===');
  Logger.log(JSON.stringify(result, null, 2));

  if (result.statistics && result.statistics.length > 0) {
    result.statistics.forEach(stat => {
      Logger.log(`${stat.task_name}: ${stat.completed_count}/${stat.total_students} (${stat.completion_rate}%)`);
    });
  }
}
```

**預期結果**：
```json
{
  "success": true,
  "statistics": [
    {
      "task_id": "TASK_xxx",
      "task_name": "Python基礎",
      "total_students": 30,
      "completed_count": 25,
      "completion_rate": "83.3"
    }
  ]
}
```

**驗證重點**：
- ✅ 正確計算班級總人數
- ✅ 正確計算每個任務的完成人數
- ✅ 完成率百分比計算正確

---

### 測試 7：測試 Analytics - 評量答對率統計

**目的**：取得特定任務每題的答對率

**測試方法**：

```javascript
function testAssessmentAccuracyStats() {
  const result = getClassAssessmentAccuracyStats({
    classId: 'CLASS_xxx',
    taskId: 'TASK_xxx'  // ← 替換有評量題目的任務 ID
  });

  Logger.log('=== 評量答對率統計 ===');
  Logger.log(JSON.stringify(result, null, 2));

  if (result.statistics && result.statistics.length > 0) {
    result.statistics.forEach((stat, idx) => {
      Logger.log(`題目 ${idx + 1}: ${stat.correct_count}/${stat.total_students} 答對 (${stat.accuracy_rate}%)`);
    });
  }
}
```

**預期結果**：
```json
{
  "success": true,
  "statistics": [
    {
      "question_id": "Q_xxx",
      "question_text": "Python 的基本資料型態有哪些？",
      "total_students": 28,
      "correct_count": 25,
      "accuracy_rate": "89.3"
    }
  ]
}
```

---

### 測試 8：測試 Analytics - 作業分數統計

**測試方法**：

```javascript
function testAssignmentScoreStats() {
  const result = getClassAssignmentScoreStats({
    classId: 'CLASS_xxx',
    courseId: ''
  });

  Logger.log('=== 作業分數統計 ===');
  Logger.log(JSON.stringify(result, null, 2));

  if (result.statistics && result.statistics.length > 0) {
    result.statistics.forEach(stat => {
      Logger.log(`${stat.task_name}: 平均分數 ${stat.average_score}分 (${stat.scored_count}/${stat.total_submissions} 已批改)`);
    });
  }
}
```

**預期結果**：
```json
{
  "success": true,
  "statistics": [
    {
      "task_name": "Python基礎",
      "total_submissions": 25,
      "scored_count": 20,
      "average_score": "82.5"
    }
  ]
}
```

---

### 測試 9：測試 Analytics - 學生異常偵測

**測試方法**：

```javascript
function testPerformanceAnomalies() {
  const result = getStudentPerformanceAnomalies({
    classId: 'CLASS_xxx',
    taskId: 'TASK_xxx'
  });

  Logger.log('=== 學生表現異常 ===');
  Logger.log(JSON.stringify(result, null, 2));

  Logger.log('\n評量異常 (' + result.assessment_anomalies.length + ' 人):');
  result.assessment_anomalies.forEach(a => {
    Logger.log(`  ${a.user_name}: ${a.accuracy_rate}% [${a.anomaly_type}] (平均: ${a.class_average}%)`);
  });

  Logger.log('\n作業分數異常 (' + result.score_anomalies.length + ' 人):');
  result.score_anomalies.forEach(a => {
    Logger.log(`  ${a.user_name}: ${a.score}分 [${a.anomaly_type}] (平均: ${a.class_average}分)`);
  });
}
```

**預期結果**：
```json
{
  "success": true,
  "assessment_anomalies": [
    {
      "user_name": "王小明",
      "accuracy_rate": "0.0",
      "anomaly_type": "零分",
      "class_average": "75.5"
    }
  ],
  "score_anomalies": [...]
}
```

---

### 測試 10：測試 Analytics - 完成時間統計與異常

**測試方法**：

```javascript
function testTaskTimeStats() {
  const result = getClassTaskTimeStats({
    classId: 'CLASS_xxx',
    courseId: ''
  });

  Logger.log('=== 完成時間統計 ===');
  Logger.log(JSON.stringify(result, null, 2));

  if (result.statistics && result.statistics.length > 0) {
    result.statistics.forEach(stat => {
      Logger.log(`\n${stat.task_name}:`);
      Logger.log(`  平均時間: ${stat.average_time_formatted}`);
      Logger.log(`  標準差: ${stat.std_deviation_formatted}`);
      Logger.log(`  異常人數: ${stat.anomalies.length}`);

      if (stat.anomalies.length > 0) {
        stat.anomalies.forEach(a => {
          Logger.log(`    ${a.user_name}: ${a.time_spent_formatted} [${a.anomaly_type}]`);
        });
      }
    });
  }
}
```

**預期結果**：
```json
{
  "success": true,
  "statistics": [
    {
      "task_name": "Python基礎",
      "average_time": 1200,
      "average_time_formatted": "20分0秒",
      "std_deviation_formatted": "5分30秒",
      "anomalies": [
        {
          "user_name": "李小華",
          "time_spent": 10,
          "time_spent_formatted": "10秒",
          "anomaly_type": "極短時間（≤10秒）"
        }
      ]
    }
  ]
}
```

**驗證重點**：
- ✅ 平均時間計算正確
- ✅ 標準差計算正確
- ✅ 偵測到極短時間（≤10秒）
- ✅ 偵測到低於 2σ 的異常值

---

## 🐛 常見問題排除

### 問題 1：找不到 task_progress_id
**解決方案**：
```javascript
function getTaskProgressIds() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.TASK_PROGRESS);
  const data = sheet.getDataRange().getValues();

  Logger.log('=== 可用的 Task Progress IDs ===');
  for (let i = 1; i < Math.min(data.length, 10); i++) {
    Logger.log(`progress_id: ${data[i][0]}, record_id: ${data[i][1]}, task_id: ${data[i][2]}`);
  }
}
```

### 問題 2：uploadTaskWork 回傳 "找不到任務資訊"
**原因**：task_progress_id 不存在或格式錯誤
**解決**：使用上面的函數查詢有效的 ID

### 問題 3：Analytics API 回傳空陣列
**原因**：測試班級沒有資料
**解決**：確保該班級有學生且有任務進度記錄

### 問題 4：批改功能權限錯誤
**原因**：教師沒有該班級權限
**解決**：檢查 CLASSES 表中該班級的 main_teacher 或 co_teachers 欄位

---

## ✅ 測試檢查清單

完成以下所有測試後，勾選確認：

- [ ] 測試 1：SHEET_CONFIG 更新成功
- [ ] 測試 2：檔案上傳成功（24 欄記錄）
- [ ] 測試 3：版本管理正常運作
- [ ] 測試 4：取得待批改列表成功
- [ ] 測試 5：提交批改成功
- [ ] 測試 6：任務完成度統計正確
- [ ] 測試 7：評量答對率統計正確
- [ ] 測試 8：作業分數統計正確
- [ ] 測試 9：學生異常偵測正常
- [ ] 測試 10：完成時間統計與異常偵測正常

---

## 📊 測試結果記錄

| 測試項目 | 狀態 | 備註 |
|---------|------|------|
| 1. SHEET_CONFIG | ⬜ 通過 / ⬜ 失敗 |  |
| 2. 檔案上傳 | ⬜ 通過 / ⬜ 失敗 |  |
| 3. 版本管理 | ⬜ 通過 / ⬜ 失敗 |  |
| 4. 取得批改列表 | ⬜ 通過 / ⬜ 失敗 |  |
| 5. 提交批改 | ⬜ 通過 / ⬜ 失敗 |  |
| 6. 完成度統計 | ⬜ 通過 / ⬜ 失敗 |  |
| 7. 答對率統計 | ⬜ 通過 / ⬜ 失敗 |  |
| 8. 分數統計 | ⬜ 通過 / ⬜ 失敗 |  |
| 9. 異常偵測 | ⬜ 通過 / ⬜ 失敗 |  |
| 10. 時間統計 | ⬜ 通過 / ⬜ 失敗 |  |

測試完成後，請回報測試結果，我們再進行前端整合！
