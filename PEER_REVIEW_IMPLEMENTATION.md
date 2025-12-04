# 互評系統實作完成報告

## 🎉 已完成項目

### 1. 後端實作 (code.gs)

#### ✅ 工作表結構
- 已在 `SHEET_CONFIG.SHEETS` 添加 `PEER_REVIEW_RECORDS: 'Peer_Review_Records'`
- 工作表欄位包含：
  - review_id, task_progress_id, reviewee_email, reviewer_email
  - task_id, assigned_time, accepted_time, completed_time
  - status, result, reject_reason, reviewer_reward, reviewee_reward

#### ✅ API路由 (doGet函數)
已添加以下API端點：
- `acceptPeerReview` - 接受互評請求
- `completePeerReview` - 完成互評（通過/退回）
- `getPendingReview` - 取得待審核記錄
- `getReviewStatus` - 查詢互評狀態
- `checkReviewTimeouts` - 檢查並處理超時

#### ✅ 核心函數

1. **assignPeerReview()** (code.gs:5490)
   - 從已完成同一任務的學生中隨機選擇審核者
   - 創建互評記錄（status=assigned）
   - 如果沒有合適的審核者，返回教師審核模式

2. **acceptPeerReview()** (code.gs:5642)
   - 審核者接受互評請求
   - 檢查30秒超時
   - 更新狀態為 accepted

3. **submitPeerReview()** (code.gs:5760)
   - 審核者提交審核結果（pass/reject）
   - 檢查3分鐘超時
   - 更新任務進度狀態
   - 發放獎勵（雙方各50金幣）

4. **checkPeerReviewStatus()** (code.gs:5931)
   - 查詢互評狀態
   - 計算剩餘時間

5. **completePeerReview()** (code.gs:6035)
   - Wrapper函數，調用 submitPeerReview()

6. **getPendingReview()** (code.gs:6052)
   - 取得使用者的待審核記錄
   - 支援 assigned 和 accepted 兩種狀態

7. **checkReviewTimeouts()** (code.gs:6147)
   - 檢查所有超時記錄
   - 自動處理超時並改為教師審核

#### ✅ submitTask整合
修改了 `submitTask()` 函數 (code.gs:3844-3878)：
- 提交任務時先設為 `pending_peer_review`
- 調用 `assignPeerReview()` 嘗試分配審核者
- 成功分配：狀態改為 `waiting_peer_review`
- 無法分配：狀態改為 `pending_review`（教師審核）

### 2. 前端實作 (student.html)

#### ✅ UI元素
已添加3個Modal：

1. **互評通知 Modal** (#peerReviewNotificationModal)
   - 顯示審核請求
   - 30秒倒數計時
   - 接受/拒絕按鈕

2. **審核界面 Modal** (#peerReviewModal)
   - 顯示被審核者資訊
   - 3分鐘倒數計時
   - 通過/退回功能
   - 退回理由輸入框

3. **等待審核 Modal** (#waitingReviewModal)
   - 顯示等待狀態
   - 載入動畫

## 📋 需要的前端JavaScript實作

由於 student.js 檔案過大，您需要在 student.js 中添加以下函數：

### 必需實作的函數

```javascript
// ==========================================
// 互評系統變數
// ==========================================
let currentReviewData = null;
let peerReviewCheckInterval = null;
let reviewNotificationTimer = null;
let reviewTimer = null;

// ==========================================
// 互評通知相關
// ==========================================

/**
 * 開始輪詢檢查是否有待審核的任務
 */
function startPeerReviewPolling() {
    // 每5秒檢查一次
    if (peerReviewCheckInterval) {
        clearInterval(peerReviewCheckInterval);
    }

    peerReviewCheckInterval = setInterval(checkPendingPeerReview, 5000);
    checkPendingPeerReview(); // 立即檢查一次
}

/**
 * 停止輪詢檢查
 */
function stopPeerReviewPolling() {
    if (peerReviewCheckInterval) {
        clearInterval(peerReviewCheckInterval);
        peerReviewCheckInterval = null;
    }
}

/**
 * 檢查是否有待審核的任務
 */
function checkPendingPeerReview() {
    if (!currentStudent || !currentStudent.email) return;

    const params = new URLSearchParams({
        action: 'getPendingReview',
        userEmail: currentStudent.email
    });

    fetch(`${APP_CONFIG.API_URL}?${params.toString()}`)
        .then(response => response.json())
        .then(data => {
            if (data.success && data.hasPendingReview) {
                const review = data.review;

                if (review.status === 'assigned') {
                    // 顯示通知Modal
                    showPeerReviewNotification(review);
                } else if (review.status === 'accepted') {
                    // 已接受，顯示審核界面
                    showPeerReviewInterface(review);
                }
            }
        })
        .catch(error => {
            APP_CONFIG.error('檢查待審核任務失敗', error);
        });
}

/**
 * 顯示互評通知
 */
function showPeerReviewNotification(review) {
    currentReviewData = review;

    const modal = document.getElementById('peerReviewNotificationModal');
    const nameElement = document.getElementById('peerRevieweeNameNotif');
    const timerElement = document.getElementById('peerReviewTimer');

    nameElement.textContent = review.revieweeName;
    modal.style.display = 'flex';

    // 開始倒數計時
    let remaining = review.timeRemaining || 30;
    timerElement.textContent = remaining;

    if (reviewNotificationTimer) {
        clearInterval(reviewNotificationTimer);
    }

    reviewNotificationTimer = setInterval(() => {
        remaining--;
        timerElement.textContent = remaining;

        if (remaining <= 0) {
            clearInterval(reviewNotificationTimer);
            modal.style.display = 'none';
            currentReviewData = null;
            showToast('審核請求已超時', 'warning');
        }
    }, 1000);
}

/**
 * 接受審核通知
 */
function acceptPeerReviewNotification() {
    if (!currentReviewData) return;

    if (reviewNotificationTimer) {
        clearInterval(reviewNotificationTimer);
    }

    const params = new URLSearchParams({
        action: 'acceptPeerReview',
        reviewId: currentReviewData.reviewId,
        reviewerEmail: currentStudent.email
    });

    showLoading('mainLoading');

    fetch(`${APP_CONFIG.API_URL}?${params.toString()}`)
        .then(response => response.json())
        .then(data => {
            hideLoading('mainLoading');

            if (data.success) {
                document.getElementById('peerReviewNotificationModal').style.display = 'none';
                showPeerReviewInterface(data);
                showToast('已接受審核請求', 'success');
            } else if (data.timeout) {
                document.getElementById('peerReviewNotificationModal').style.display = 'none';
                showToast(data.message, 'warning');
                currentReviewData = null;
            } else {
                showToast(data.message || '接受失敗', 'error');
            }
        })
        .catch(error => {
            hideLoading('mainLoading');
            APP_CONFIG.error('接受審核失敗', error);
            showToast('接受失敗：' + error.message, 'error');
        });
}

/**
 * 拒絕審核
 */
function declinePeerReview() {
    if (reviewNotificationTimer) {
        clearInterval(reviewNotificationTimer);
    }

    document.getElementById('peerReviewNotificationModal').style.display = 'none';
    currentReviewData = null;
    showToast('已拒絕審核請求', 'info');
}

// ==========================================
// 審核界面相關
// ==========================================

/**
 * 顯示審核界面
 */
function showPeerReviewInterface(reviewData) {
    currentReviewData = reviewData;

    const modal = document.getElementById('peerReviewModal');
    document.getElementById('revieweeName').textContent = reviewData.revieweeName;
    document.getElementById('revieweeEmail').textContent = reviewData.revieweeEmail;
    document.getElementById('reviewTaskName').textContent = reviewData.taskId;

    modal.style.display = 'flex';

    // 開始審核倒數計時（3分鐘）
    let remaining = reviewData.timeRemaining || 180;

    if (reviewTimer) {
        clearInterval(reviewTimer);
    }

    reviewTimer = setInterval(() => {
        remaining--;
        const minutes = Math.floor(remaining / 60);
        const seconds = remaining % 60;
        document.getElementById('reviewTimeRemaining').textContent =
            `${minutes}:${seconds.toString().padStart(2, '0')}`;

        if (remaining <= 0) {
            clearInterval(reviewTimer);
            modal.style.display = 'none';
            currentReviewData = null;
            showToast('審核時間已到，已改為教師審核', 'warning');
        }
    }, 1000);
}

/**
 * 顯示退回理由輸入框
 */
function showRejectReason() {
    document.getElementById('rejectReasonSection').style.display = 'block';
    document.getElementById('showRejectBtn').style.display = 'none';
    document.getElementById('passReviewBtn').style.display = 'none';
    document.getElementById('cancelRejectBtn').style.display = 'inline-block';
    document.getElementById('confirmRejectBtn').style.display = 'inline-block';
}

/**
 * 隱藏退回理由輸入框
 */
function hideRejectReason() {
    document.getElementById('rejectReasonSection').style.display = 'none';
    document.getElementById('rejectReasonInput').value = '';
    document.getElementById('showRejectBtn').style.display = 'inline-block';
    document.getElementById('passReviewBtn').style.display = 'inline-block';
    document.getElementById('cancelRejectBtn').style.display = 'none';
    document.getElementById('confirmRejectBtn').style.display = 'none';
}

/**
 * 提交審核結果
 */
function submitPeerReview(result) {
    if (!currentReviewData) return;

    let rejectReason = '';
    if (result === 'reject') {
        rejectReason = document.getElementById('rejectReasonInput').value.trim();
        if (!rejectReason) {
            showToast('請填寫退回理由', 'warning');
            return;
        }
    }

    if (reviewTimer) {
        clearInterval(reviewTimer);
    }

    const params = new URLSearchParams({
        action: 'completePeerReview',
        reviewId: currentReviewData.reviewId,
        reviewerEmail: currentStudent.email,
        result: result,
        rejectReason: rejectReason
    });

    showLoading('mainLoading');

    fetch(`${APP_CONFIG.API_URL}?${params.toString()}`)
        .then(response => response.json())
        .then(data => {
            hideLoading('mainLoading');

            if (data.success) {
                document.getElementById('peerReviewModal').style.display = 'none';
                currentReviewData = null;
                hideRejectReason();

                const message = result === 'pass' ?
                    '✅ 已通過審核！你獲得了 50 金幣' :
                    '✅ 已退回任務';
                showToast(message, 'success');

                // 重新載入任務列表
                if (selectedTier) {
                    loadTierTasks(true);
                }
            } else if (data.timeout) {
                document.getElementById('peerReviewModal').style.display = 'none';
                currentReviewData = null;
                showToast(data.message, 'warning');
            } else {
                showToast(data.message || '提交失敗', 'error');
            }
        })
        .catch(error => {
            hideLoading('mainLoading');
            APP_CONFIG.error('提交審核失敗', error);
            showToast('提交失敗：' + error.message, 'error');
        });
}

// ==========================================
// 被審核者相關
// ==========================================

/**
 * 檢查自己提交的任務的審核狀態
 */
function checkMyTaskReviewStatus(taskProgressId) {
    const params = new URLSearchParams({
        action: 'getReviewStatus',
        taskProgressId: taskProgressId
    });

    fetch(`${APP_CONFIG.API_URL}?${params.toString()}`)
        .then(response => response.json())
        .then(data => {
            if (data.success && data.reviews && data.reviews.length > 0) {
                const review = data.reviews[0];
                updateWaitingReviewUI(review);
            }
        })
        .catch(error => {
            APP_CONFIG.error('檢查審核狀態失敗', error);
        });
}

/**
 * 更新等待審核的UI
 */
function updateWaitingReviewUI(review) {
    const messageElement = document.getElementById('waitingReviewMessage');

    if (review.status === 'assigned') {
        messageElement.textContent = `正在等待 ${review.reviewerName} 接受審核...`;
    } else if (review.status === 'accepted') {
        messageElement.textContent = `${review.reviewerName} 即將前來審核，請稍候...`;
    } else if (review.status === 'completed') {
        document.getElementById('waitingReviewModal').style.display = 'none';
        if (review.result === 'pass') {
            showToast('✅ 任務審核通過！', 'success');
        } else {
            showToast(`任務被退回：${review.rejectReason}`, 'warning');
        }
        // 重新載入任務列表
        if (selectedTier) {
            loadTierTasks(true);
        }
    }
}
```

### 修改現有函數

需要修改 student.js 中的 `handleCompleteTask()` 函數，在提交成功後檢查是否進入互評流程：

```javascript
// 在 handleCompleteTask() 函數的 submitTask 成功回調中添加：
if (response.peerReviewMode) {
    // 進入互評模式
    document.getElementById('waitingReviewModal').style.display = 'flex';
    document.getElementById('waitingReviewMessage').textContent =
        `正在尋找同學協助審核...`;

    // 開始輪詢檢查審核狀態
    const checkInterval = setInterval(() => {
        checkMyTaskReviewStatus(response.taskProgressId);
    }, 3000);

    // 30秒後停止輪詢（改為教師審核）
    setTimeout(() => {
        clearInterval(checkInterval);
    }, 30000);
} else {
    // 教師審核模式
    showToast(response.message, 'success');
}
```

### 在頁面載入時啟動輪詢

在 `loadTierTasks()` 函數成功載入後添加：

```javascript
// 啟動互評輪詢檢查
startPeerReviewPolling();
```

在 `backToTierSelection()` 和 `backToClassSelection()` 中添加：

```javascript
// 停止互評輪詢
stopPeerReviewPolling();
```

## 🔄 完整流程

### 流程 1: 學生提交任務 → 進入互評
1. ✅ 學生點擊「提交任務」
2. ✅ 後端調用 `submitTask()` → `assignPeerReview()`
3. ✅ 從已完成同一任務的學生中隨機抽取審核者
4. ✅ 創建 Peer_Review_Records 記錄（status=assigned）
5. ⚠️ 前端顯示「等待審核中」Modal
6. ⚠️ 審核者收到彈窗通知（30秒倒數）

### 流程 2: 審核者接受審核
7. ⚠️ 審核者點擊「接受審核」
8. ✅ 後端更新 status=accepted
9. ⚠️ 被審核者看到「XXX 即將前來審核」
10. ⚠️ 審核者看到審核界面（3分鐘倒數）

### 流程 3: 審核完成
11. ⚠️ 審核者選擇「通過」或「退回」
12. ✅ 後端更新記錄、任務進度、發放金幣
13. ⚠️ 雙方都收到通知

### 超時處理
- ✅ 30秒內未接受：後端檢查超時並改為教師審核
- ✅ 3分鐘內未完成：後端檢查超時並改為教師審核
- ⚠️ 前端需要實作定時調用 `checkReviewTimeouts` API

## 📝 注意事項

1. **前端JavaScript整合**
   - 將上述代碼添加到 student.js 中（建議在檔案末尾）
   - 確保在適當的地方調用 `startPeerReviewPolling()` 和 `stopPeerReviewPolling()`

2. **測試建議**
   - 創建測試資料：至少2個學生帳號
   - 學生A完成一個任務
   - 學生B提交同一任務 → 應分配學生A審核
   - 測試超時情況

3. **Google Sheets設置**
   - 確保 Google Sheets 中有 `Peer_Review_Records` 工作表
   - 欄位順序必須與 code.gs 中的一致

## ✅ 完成檢查清單

- [x] 後端工作表結構
- [x] 後端API路由
- [x] 後端核心函數
- [x] submitTask整合
- [x] 前端HTML UI
- [ ] 前端JavaScript實作（需要您添加到 student.js）
- [ ] 測試完整流程

## 🚀 下一步

請將上述JavaScript代碼添加到 student.js 檔案中，然後進行測試。如果遇到任何問題，請告訴我！
