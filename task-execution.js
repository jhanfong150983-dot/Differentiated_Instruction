// 任務執行視窗 JavaScript

// ========== 全域變數 ==========
let currentStage = 1; // 當前階段：1=教材, 2=檢核, 3=上傳, 4=評量
let taskData = null; // 任務資料
let checklistItems = []; // 檢核項目
let currentChecklistIndex = 0; // 當前檢核項目索引
let checklistAnswers = []; // 檢核答案
let assessmentQuestions = []; // 評量題目
let assessmentAnswers = {}; // 評量答案
let uploadedFileUrl = null; // 已上傳檔案URL
let webcamStream = null; // webcam 串流
let uploadInProgress = false; // 作業上傳中
let taskProgressId = null; // 任務進度ID
let lastCheckTime = null; // 上次勾選時間（用於檢測快速勾選）
let materialOriginalLink = ''; // 原始教材連結（供新分頁開啟）
let cameraDevices = []; // 可用攝影機列表
let selectedCameraId = null; // 目前選擇的攝影機

// ========== 時間追蹤 ==========
let totalActiveTime = 0; // 累計活動時間（秒）
let sessionStartTime = null; // 當前活動開始時間
let isWindowActive = true; // 視窗是否活躍
let activityCheckInterval = null; // 活動檢查計時器

// LocalStorage 鍵名
const STORAGE_KEY_PREFIX = 'task_execution_';

// API配置（需要從父視窗或URL參數獲取）
let API_URL = '';
let studentEmail = '';

// ========== 初始化 ==========
window.addEventListener('DOMContentLoaded', function() {
    console.log('任務執行視窗載入');

    // 從 URL 參數獲取資料
    const urlParams = new URLSearchParams(window.location.search);
    taskProgressId = urlParams.get('taskProgressId');
    const taskId = urlParams.get('taskId');
    studentEmail = urlParams.get('userEmail');
    API_URL = urlParams.get('apiUrl');

    if (!taskProgressId || !taskId || !studentEmail || !API_URL) {
        alert('缺少必要參數，無法載入任務');
        window.close();
        return;
    }

    // 監聽檔案選擇
    document.getElementById('fileInput').addEventListener('change', handleFileSelect);

    // ========== 初始化時間追蹤 ==========
    initTimeTracking();

    // ========== 載入任務資料（必須先載入） ==========
    // 嘗試從 LocalStorage 恢復進度
    const savedProgress = loadProgress();
    if (savedProgress) {
        if (confirm('偵測到未完成的任務，是否繼續？')) {
            // ✅ 修復：先載入任務資料，再恢復進度
            loadTaskData(taskId).then(() => {
                console.log('📋 任務資料載入完成，恢復進度...');
                restoreProgress(savedProgress);
            });
            return;
        } else {
            // 清除舊進度
            clearProgress();
        }
    }

    // 正常載入任務資料（新任務）
    loadTaskData(taskId).then(() => {
        console.log('📋 任務資料載入完成，初始化第一階段...');
        updateStageDisplay();
    });

    // 監聽 beforeunload（提醒使用者）
    window.addEventListener('beforeunload', function(e) {
        if (currentStage < 4 || !isAllAssessmentAnswered()) {
            e.preventDefault();
            e.returnValue = '';
            stopTimeTracking(); // 停止時間追蹤
            saveProgress(); // 儲存進度
        }
    });
});

// ========== 時間追蹤功能 ==========
function initTimeTracking() {
    // 開始追蹤時間
    sessionStartTime = Date.now();
    isWindowActive = true;

    // 監聽視窗焦點變化
    window.addEventListener('focus', function() {
        if (!isWindowActive) {
            console.log('🟢 視窗重新獲得焦點，繼續計時');
            isWindowActive = true;
            sessionStartTime = Date.now(); // 重新開始計時
        }
    });

    window.addEventListener('blur', function() {
        if (isWindowActive) {
            console.log('🔴 視窗失去焦點，暫停計時');
            isWindowActive = false;
            // 累加這段活動時間
            if (sessionStartTime) {
                const activeSeconds = Math.floor((Date.now() - sessionStartTime) / 1000);
                totalActiveTime += activeSeconds;
                console.log(`⏱️ 累加活動時間: ${activeSeconds}秒, 總計: ${totalActiveTime}秒`);
                sessionStartTime = null;
            }
        }
    });

    // 監聽頁面可見性變化（切換分頁）
    document.addEventListener('visibilitychange', function() {
        if (document.hidden) {
            console.log('🔴 頁面隱藏，暫停計時');
            isWindowActive = false;
            if (sessionStartTime) {
                const activeSeconds = Math.floor((Date.now() - sessionStartTime) / 1000);
                totalActiveTime += activeSeconds;
                console.log(`⏱️ 累加活動時間: ${activeSeconds}秒, 總計: ${totalActiveTime}秒`);
                sessionStartTime = null;
            }
        } else {
            console.log('🟢 頁面顯示，繼續計時');
            isWindowActive = true;
            sessionStartTime = Date.now();
        }
    });

    // 每30秒自動儲存時間（防止意外關閉）
    activityCheckInterval = setInterval(function() {
        if (isWindowActive && sessionStartTime) {
            const activeSeconds = Math.floor((Date.now() - sessionStartTime) / 1000);
            totalActiveTime += activeSeconds;
            sessionStartTime = Date.now(); // 重設計時起點
            console.log(`⏱️ 自動儲存活動時間, 總計: ${totalActiveTime}秒 (${Math.floor(totalActiveTime / 60)}分鐘)`);
            saveProgress(); // 自動儲存進度
        }
    }, 30000); // 30秒

    console.log('✅ 時間追蹤已啟動');
}

function stopTimeTracking() {
    // 累加最後一段時間
    if (isWindowActive && sessionStartTime) {
        const activeSeconds = Math.floor((Date.now() - sessionStartTime) / 1000);
        totalActiveTime += activeSeconds;
        console.log(`⏱️ 停止計時，最終總計: ${totalActiveTime}秒 (${Math.floor(totalActiveTime / 60)}分鐘)`);
    }

    // 清除計時器
    if (activityCheckInterval) {
        clearInterval(activityCheckInterval);
    }

    sessionStartTime = null;
    isWindowActive = false;
}

function getActiveTimeInSeconds() {
    // 計算當前總活動時間（包含進行中的時間）
    let currentTotal = totalActiveTime;
    if (isWindowActive && sessionStartTime) {
        const activeSeconds = Math.floor((Date.now() - sessionStartTime) / 1000);
        currentTotal += activeSeconds;
    }
    return currentTotal;
}

function formatActiveTime() {
    const totalSeconds = getActiveTimeInSeconds();
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}分${seconds}秒`;
}

// ========== 階段資料與狀態同步 ==========

/**
 * 保存當前階段的資料到資料庫
 */
function saveCurrentStageData() {
    console.log(`💾 保存階段${currentStage}資料...`);

    // 根據當前階段保存對應的資料
    if (currentStage === 2) {
        // 階段2：檢核階段 - 保存檢核答案
        if (checklistAnswers && checklistAnswers.length > 0) {
            const params = new URLSearchParams({
                action: 'saveStageData',
                taskProgressId: taskProgressId,
                userEmail: studentEmail,
                stage: '2',
                checklistAnswers: JSON.stringify(checklistAnswers),
                checklistItems: JSON.stringify(checklistItems)
            });

            fetch(`${API_URL}?${params.toString()}`)
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        console.log(`✅ 檢核資料已保存 (${checklistAnswers.length}項)`);
                    } else {
                        console.error('❌ 檢核資料保存失敗:', data.message);
                    }
                })
                .catch(error => {
                    console.error('❌ 檢核資料保存錯誤:', error);
                });
        }

    } else if (currentStage === 3) {
        // 階段3：上傳階段 - 保存上傳檔案URL
        if (uploadedFileUrl) {
            const params = new URLSearchParams({
                action: 'saveStageData',
                taskProgressId: taskProgressId,
                userEmail: studentEmail,
                stage: '3',
                uploadedFileUrl: uploadedFileUrl
            });

            fetch(`${API_URL}?${params.toString()}`)
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        console.log(`✅ 上傳檔案已保存: ${uploadedFileUrl}`);
                    } else {
                        console.error('❌ 上傳檔案保存失敗:', data.message);
                    }
                })
                .catch(error => {
                    console.error('❌ 上傳檔案保存錯誤:', error);
                });
        }
    }
    // 階段1（教材）和階段4（評量）不需要額外保存
    // 評量會在 submitAllData 時一次性提交
}

/**
 * 更新階段狀態到資料庫
 */
function updateStageToDatabase(stage) {
    // 非同步更新，不阻塞UI
    const params = new URLSearchParams({
        action: 'updateTaskStage',
        taskProgressId: taskProgressId,
        userEmail: studentEmail,
        stage: stage.toString()
    });

    console.log(`📤 同步階段狀態到資料庫: 階段${stage}`);

    fetch(`${API_URL}?${params.toString()}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                console.log(`✅ 階段狀態已同步: ${data.status}`);
            } else {
                console.error('❌ 階段狀態同步失敗:', data.message);
            }
        })
        .catch(error => {
            console.error('❌ 階段狀態同步錯誤:', error);
        });
}

// ========== 載入任務資料 ==========
async function loadTaskData(taskId) {
    showLoading(true);

    try {
        const params = new URLSearchParams({
            action: 'getTaskDetail',
            taskId: taskId,
            userEmail: studentEmail
        });

        const response = await fetch(`${API_URL}?${params.toString()}`);
        const data = await response.json();

        if (data.success) {
            taskData = data.task;
            materialOriginalLink = '';

            // 🔍 調試：顯示完整的任務資料
            console.log('📦 完整任務資料：', taskData);

            document.getElementById('taskTitle').textContent = taskData.name;

            // 修復：載入教材（檢查 link 是否有效）
            const materialFrame = document.getElementById('materialFrame');
            console.log('🔗 教材連結檢查：', {
                link: taskData.link,
                hasLink: !!taskData.link,
                isEmpty: taskData.link === '',
                trimmed: taskData.link ? taskData.link.trim() : 'null'
            });

            if (taskData.link && taskData.link.trim() !== '') {
                let finalLink = taskData.link.trim();
                let originalLink = finalLink; // 保留原始連結用於新分頁開啟
                materialOriginalLink = originalLink;

                // 🔧 檢測是否為 Google Drive 連結
                const isGoogleDrive = finalLink.includes('drive.google.com');
                
                if (isGoogleDrive) {
                    console.log('🔍 偵測到 Google Drive 連結', finalLink);

                    // 提取 FILE_ID
                    let fileId = null;

                    // 格式 1: https://drive.google.com/file/d/FILE_ID/view?usp=sharing
                    const match1 = finalLink.match(/\/file\/d\/([^\/\?]+)/);
                    if (match1) {
                        fileId = match1[1];
                        console.log('✅ 格式1匹配成功，FILE_ID:', fileId);
                    }

                    // 格式 2: https://drive.google.com/open?id=FILE_ID
                    if (!fileId) {
                        const match2 = finalLink.match(/[?&]id=([^&]+)/);
                        if (match2) {
                            fileId = match2[1];
                            console.log('✅ 格式2匹配成功，FILE_ID:', fileId);
                        }
                    }

                    // 格式 3: https://drive.google.com/uc?id=FILE_ID
                    if (!fileId) {
                        const match3 = finalLink.match(/\/uc\?.*id=([^&]+)/);
                        if (match3) {
                            fileId = match3[1];
                            console.log('✅ 格式3匹配成功，FILE_ID:', fileId);
                        }
                    }

                    if (fileId) {
                        // 清理 FILE_ID（移除可能的查詢參數）
                        fileId = fileId.split('?')[0].split('&')[0];
                        // 保留原始連結用於新分頁開啟
                        originalLink = `https://drive.google.com/file/d/${fileId}/view`;
                        materialOriginalLink = originalLink;
                        // 🔧 使用 /preview 端點來嵌入 Google Drive 檔案
                        finalLink = `https://drive.google.com/file/d/${fileId}/preview`;
                        console.log('✅ 已轉換為 Google Drive 預覽連結:', finalLink);
                    }

                    // 🔧 Google Drive 連結：嘗試嵌入預覽，並提供備用開啟按鈕
                    materialFrame.src = finalLink;
                    materialFrame.style.width = '100%';
                    materialFrame.style.height = '100%';
                    materialFrame.style.border = 'none';

                    // 添加載入提示和備用按鈕
                    const materialContainer = materialFrame.parentElement;
                    materialContainer.style.position = 'relative';

                    // 創建載入提示
                    const loadingDiv = document.createElement('div');
                    loadingDiv.id = 'driveLoadingIndicator';
                    loadingDiv.innerHTML = `
                        <div style="
                            position: absolute;
                            top: 50%;
                            left: 50%;
                            transform: translate(-50%, -50%);
                            text-align: center;
                            z-index: 1;
                        ">
                            <div style="font-size: 48px; margin-bottom: 10px;">📚</div>
                            <div style="font-size: 18px; color: #667eea;">正在載入 Google Drive 教材...</div>
                        </div>
                    `;
                    materialContainer.appendChild(loadingDiv);

                    // 創建備用開啟按鈕（預設隱藏）
                    const openInNewTabBtn = document.createElement('button');
                    openInNewTabBtn.id = 'driveOpenInNewTab';
                    openInNewTabBtn.innerHTML = '🔗 無法預覽？點此在新分頁開啟教材';
                    openInNewTabBtn.style.cssText = `
                        position: absolute;
                        top: 10px;
                        right: 10px;
                        z-index: 10;
                        padding: 12px 24px;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                        border: none;
                        border-radius: 8px;
                        font-size: 14px;
                        font-weight: bold;
                        cursor: pointer;
                        box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
                        transition: all 0.3s ease;
                        display: none;
                    `;
                    openInNewTabBtn.onmouseover = function() {
                        this.style.transform = 'translateY(-2px)';
                        this.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.6)';
                    };
                    openInNewTabBtn.onmouseout = function() {
                        this.style.transform = 'translateY(0)';
                        this.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4)';
                    };
                    openInNewTabBtn.onclick = function() {
                        window.open(originalLink, '_blank');
                        showWarning('已在新分頁開啟教材', 'success');
                    };
                    materialContainer.appendChild(openInNewTabBtn);

                    // iframe 載入成功時隱藏載入提示，顯示備用按鈕
                    materialFrame.onload = function() {
                        console.log('✅ Google Drive 教材載入成功');
                        const loadingIndicator = document.getElementById('driveLoadingIndicator');
                        if (loadingIndicator) loadingIndicator.remove();
                        // 顯示備用按鈕（以防有些檔案類型無法預覽）
                        const openBtn = document.getElementById('driveOpenInNewTab');
                        if (openBtn) openBtn.style.display = 'block';
                    };

                    // iframe 載入失敗時顯示錯誤提示
                    materialFrame.onerror = function() {
                        console.error('❌ Google Drive 教材載入失敗');
                        const loadingIndicator = document.getElementById('driveLoadingIndicator');
                        if (loadingIndicator) loadingIndicator.remove();

                        // 顯示錯誤訊息和開啟按鈕
                        const openBtn = document.getElementById('driveOpenInNewTab');
                        if (openBtn) {
                            openBtn.style.display = 'block';
                            openBtn.innerHTML = '❌ 預覽失敗，點此在新分頁開啟教材';
                            openBtn.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
                        }
                    };

                    console.log('✅ 已嘗試嵌入 Google Drive 預覽');

                } else {
                    // 非 Google Drive 連結：嘗試正常嵌入
                    materialFrame.src = finalLink;
                    console.log('✅ 教材連結已載入：', finalLink);

                    // 添加備用開啟按鈕（如果 iframe 無法載入）
                    const materialContainer = materialFrame.parentElement;
                    const existingBtn = materialContainer.querySelector('.open-in-new-tab-btn');
                    if (existingBtn) existingBtn.remove();

                    const openInNewTabBtn = document.createElement('button');
                    openInNewTabBtn.className = 'open-in-new-tab-btn';
                    openInNewTabBtn.textContent = '🔗 無法顯示？點此在新分頁開啟教材';
                    openInNewTabBtn.style.cssText = `
                        position: absolute;
                        top: 10px;
                        right: 10px;
                        padding: 10px 20px;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                        border: none;
                        border-radius: 8px;
                        font-size: 14px;
                        font-weight: 600;
                        cursor: pointer;
                        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
                        z-index: 1000;
                        transition: all 0.2s ease;
                        display: none;
                    `;
                    openInNewTabBtn.onmouseover = function() {
                        this.style.transform = 'translateY(-2px)';
                        this.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.4)';
                    };
                    openInNewTabBtn.onmouseout = function() {
                        this.style.transform = 'translateY(0)';
                        this.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
                    };
                    openInNewTabBtn.onclick = function() {
                        window.open(finalLink, '_blank');
                        showWarning('已在新分頁開啟教材', 'success');
                    };
                    materialContainer.style.position = 'relative';
                    materialContainer.appendChild(openInNewTabBtn);

                    // 檢測 iframe 載入狀態
                    let iframeLoadTimeout = setTimeout(function() {
                        // 如果 3 秒後仍未載入成功，顯示備用按鈕
                        console.warn('⚠️ iframe 載入時間過長，顯示備用開啟按鈕');
                        openInNewTabBtn.style.display = 'block';
                    }, 3000);

                    // 監聽 iframe 載入錯誤
                    materialFrame.onerror = function() {
                        console.error('❌ iframe 載入失敗');
                        clearTimeout(iframeLoadTimeout);
                        openInNewTabBtn.style.display = 'block';
                        openInNewTabBtn.textContent = '❌ 嵌入載入失敗，點此在新分頁開啟教材';
                        openInNewTabBtn.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
                    };

                    materialFrame.onload = function() {
                        console.log('✅ iframe 載入成功');
                        clearTimeout(iframeLoadTimeout);
                        // 如果成功載入，仍然顯示按鈕（但文字改為可選開啟）
                        setTimeout(function() {
                            openInNewTabBtn.style.display = 'block';
                            openInNewTabBtn.style.opacity = '0.7';
                        }, 500);
                    };
                }
            } else {
                // 如果沒有教材連結，顯示提示訊息
                materialFrame.srcdoc = `
                    <html>
                        <head>
                            <style>
                                body {
                                    display: flex;
                                    justify-content: center;
                                    align-items: center;
                                    height: 100vh;
                                    margin: 0;
                                    font-family: 'Microsoft JhengHei', sans-serif;
                                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                                    color: white;
                                }
                                .message {
                                    text-align: center;
                                    padding: 40px;
                                    background: rgba(255, 255, 255, 0.1);
                                    border-radius: 16px;
                                    backdrop-filter: blur(10px);
                                }
                            </style>
                        </head>
                        <body>
                            <div class="message">
                                <h2>📚 此任務沒有提供教材連結</h2>
                                <p>請直接進入下一階段</p>
                            </div>
                        </body>
                    </html>
                `;
                console.warn('⚠️ 任務沒有教材連結');
            }

            // 修復：只儲存檢核項目和評量題目，不立即渲染
            // 等到進入對應階段時才渲染
            console.log('📋 檢核項目檢查：', {
                hasSelfCheckList: !!taskData.selfCheckList,
                isArray: Array.isArray(taskData.selfCheckList),
                length: taskData.selfCheckList ? taskData.selfCheckList.length : 0,
                data: taskData.selfCheckList
            });

            if (taskData.selfCheckList && taskData.selfCheckList.length > 0) {
                checklistItems = taskData.selfCheckList;
                console.log('✅ 檢核項目已載入：', checklistItems.length, '項', checklistItems);
            } else {
                console.warn('⚠️ 此任務沒有檢核項目');
            }

            console.log('📝 評量題目檢查：', {
                hasQuestions: !!taskData.questions,
                isArray: Array.isArray(taskData.questions),
                length: taskData.questions ? taskData.questions.length : 0,
                data: taskData.questions
            });

            if (taskData.questions && taskData.questions.length > 0) {
                assessmentQuestions = taskData.questions;
                console.log('✅ 評量題目已載入：', assessmentQuestions.length, '題', assessmentQuestions);
            } else {
                console.warn('⚠️ 此任務沒有評量題目');
            }

            // ✅ 修復：不在這裡初始化階段，讓外部決定
            // 如果是新任務，外部會調用 updateStageDisplay()
            // 如果是恢復進度，外部會調用 restoreProgress()
            showLoading(false);
        } else {
            alert('載入任務失敗：' + data.message);
            window.close();
        }
    } catch (error) {
        console.error('載入任務失敗：', error);
        alert('載入任務失敗，請稍後再試');
        window.close();
    }
}

// ========== 初始化階段顯示 ==========
function updateStageDisplay() {
    // 初始化為第一階段（教材）
    currentStage = 1;

    // 確保只有第一階段顯示
    document.querySelectorAll('.stage-container').forEach(el => {
        el.classList.remove('active');
    });
    document.getElementById('stage-material').classList.add('active');

    // 更新進度條
    updateProgressBar(1);

    // 更新按鈕
    updateButtons(1);

    console.log('✅ 初始化完成，當前階段：1（教材）');
}

// 開新分頁閱讀教材
function openMaterialInNewTab() {
    if (materialOriginalLink) {
        window.open(materialOriginalLink, '_blank');
    } else {
        alert('目前沒有可開啟的教材連結');
    }
}

// ========== 階段切換 ==========
function nextStage() {
    // 驗證當前階段是否完成
    if (!validateCurrentStage()) {
        return;
    }

    // ✅ 先保存當前階段的資料到資料庫
    saveCurrentStageData();

    // 儲存進度到 LocalStorage
    saveProgress();

    // 切換到下一階段
    if (currentStage < 4) {
        currentStage++;
        switchStage(currentStage);

        // 同步新階段的狀態到資料庫
        updateStageToDatabase(currentStage);
    } else {
        // 第4階段完成，提交所有資料
        submitAllData();
    }
}

function previousStage() {
    if (currentStage > 1) {
        currentStage--;
        switchStage(currentStage);
    }
}

function switchStage(stage) {
    // 隱藏所有階段
    document.querySelectorAll('.stage-container').forEach(el => {
        el.classList.remove('active');
    });

    // 顯示目標階段
    document.getElementById(`stage-${getStageId(stage)}`).classList.add('active');

    // 修復：根據階段渲染對應內容
    if (stage === 2) {
        // 階段2：檢核 - 渲染檢核項目
        if (checklistItems && checklistItems.length > 0) {
            console.log('📋 開始渲染檢核項目...');
            renderChecklistItem(currentChecklistIndex);
        } else {
            console.log('⚠️ 沒有檢核項目，跳過檢核階段');
            // 如果沒有檢核項目，可以自動跳到下一階段
        }
    } else if (stage === 4) {
        // 階段4：評量 - 渲染評量題目
        if (assessmentQuestions && assessmentQuestions.length > 0) {
            console.log('📝 開始渲染評量題目...');
            renderAssessmentQuestions();
        } else {
            console.log('⚠️ 沒有評量題目，跳過評量階段');
            // 如果沒有評量題目，可以自動跳到下一階段
        }
    }

    // 更新進度條
    updateProgressBar(stage);

    // 更新按鈕
    updateButtons(stage);

    currentStage = stage;
}

function getStageId(stage) {
    const stages = ['material', 'checklist', 'upload', 'assessment'];
    return stages[stage - 1];
}

function updateProgressBar(stage) {
    document.querySelectorAll('.progress-step').forEach((el, index) => {
        const stepNum = index + 1;
        if (stepNum < stage) {
            el.classList.add('completed');
            el.classList.remove('active');
        } else if (stepNum === stage) {
            el.classList.add('active');
            el.classList.remove('completed');
        } else {
            el.classList.remove('active', 'completed');
        }
    });

    // 更新連接線
    document.querySelectorAll('.progress-line').forEach((el, index) => {
        if (index < stage - 1) {
            el.classList.add('completed');
        } else {
            el.classList.remove('completed');
        }
    });
}

function updateButtons(stage) {
    const btnPrev = document.getElementById('btnPrev');
    const btnNext = document.getElementById('btnNext');

    // 第1階段不顯示「上一步」
    btnPrev.style.display = stage > 1 ? 'block' : 'none';

    // 第4階段改為「提交」
    if (stage === 4) {
        btnNext.textContent = '提交評量';
    } else {
        btnNext.textContent = '下一步 →';
    }
}

// ========== 驗證當前階段 ==========
function validateCurrentStage() {
    switch (currentStage) {
        case 1:
            // 階段1：教材（無驗證，直接通過）
            return true;

        case 2:
            // 階段2：檢核（必須全部勾選完成）
            if (checklistAnswers.length < checklistItems.length) {
                showWarning('請完成所有檢核項目');
                return false;
            }
            return true;

        case 3:
            // 階段3：上傳（必須上傳檔案）
            if (!uploadedFileUrl) {
                showWarning('請上傳作業檔案');
                return false;
            }
            return true;

        case 4:
            // 階段4：評量（必須回答所有題目）
            if (!isAllAssessmentAnswered()) {
                showWarning('請回答所有評量題目');
                return false;
            }
            return true;

        default:
            return true;
    }
}

// ========== 檢核邏輯 ==========
function renderChecklistItem(index) {
    const container = document.getElementById('checklistContent');
    container.innerHTML = ''; // 清空

    if (index >= checklistItems.length) {
        // 全部完成
        container.innerHTML = '<div style="text-align: center; padding: 60px; color: #10b981; font-size: 24px;">✅ 檢核完成！</div>';
        return;
    }

    const item = checklistItems[index];

    const itemDiv = document.createElement('div');
    itemDiv.className = 'checklist-item active';

    // 標題（修復：優先使用 type 欄位，因為資料結構中 type 存的是檢核內容文字）
    const title = document.createElement('h3');
    title.textContent = `${index + 1}. ${item.type || item.description || item.text || '檢核項目'}`;
    itemDiv.appendChild(title);

    // 參考答案
    if (item.referenceAnswer || item.referenceImage) {
        const refDiv = document.createElement('div');
        refDiv.className = 'reference-answer';

        const refTitle = document.createElement('h4');
        refTitle.textContent = '📖 參考答案';
        refDiv.appendChild(refTitle);

        if (item.referenceAnswer) {
            const refText = document.createElement('p');
            refText.textContent = item.referenceAnswer;
            refDiv.appendChild(refText);
        }

        if (item.referenceImage) {
            const refImg = document.createElement('img');
            refImg.src = item.referenceImage;
            refImg.className = 'reference-image';
            refDiv.appendChild(refImg);
        }

        itemDiv.appendChild(refDiv);
    }

    // 勾選控制
    const checkControl = document.createElement('div');
    checkControl.className = 'check-control';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `check-${index}`;
    checkbox.addEventListener('change', function() {
        handleChecklistCheck(index, this.checked);
    });

    const label = document.createElement('label');
    label.htmlFor = `check-${index}`;
    label.textContent = '✅ 我已完成此項目';

    checkControl.appendChild(checkbox);
    checkControl.appendChild(label);
    itemDiv.appendChild(checkControl);

    container.appendChild(itemDiv);

    // 更新進度
    updateChecklistProgress();
}

function handleChecklistCheck(index, checked) {
    if (checked) {
        // 檢測快速勾選（3秒內）
        const now = Date.now();
        if (lastCheckTime && (now - lastCheckTime) < 3000) {
            showWarning('⚠️ 請認真檢核，不要太快勾選哦！');
        }
        lastCheckTime = now;

        // 記錄答案
        checklistAnswers[index] = true;

        // 更新進度
        updateChecklistProgress();

        // 延遲0.5秒後顯示下一題
        setTimeout(() => {
            currentChecklistIndex = index + 1;
            renderChecklistItem(currentChecklistIndex);
        }, 500);
    }
}

function updateChecklistProgress() {
    const completed = checklistAnswers.filter(a => a).length;
    const total = checklistItems.length;
    const percentage = total > 0 ? (completed / total) * 100 : 0;

    document.getElementById('checklistProgressFill').style.width = percentage + '%';
    document.getElementById('checklistProgressText').textContent = `已完成 ${completed} / ${total}`;
}

// ========== 上傳邏輯 ==========
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    // 檢查檔案類型
    if (!file.type.startsWith('image/')) {
        showWarning('只支援圖片格式（JPG、PNG）');
        return;
    }

    // 檢查檔案大小（限制10MB）
    if (file.size > 10 * 1024 * 1024) {
        showWarning('檔案大小不可超過10MB');
        return;
    }

    // 顯示預覽
    const reader = new FileReader();
    reader.onload = function(e) {
        showUploadPreview(e.target.result);
        uploadFileToServer(file);
    };
    reader.readAsDataURL(file);
}

async function uploadFileToServer(file) {
    if (uploadInProgress) {
        showWarning('目前正在上傳，請稍候');
        return;
    }

    uploadInProgress = true;
    showLoading(true);

    try {
        // 轉為 Base64
        const base64Data = await fileToBase64(file);

        // 改用 POST 請求，避免 URL 過長導致 413 錯誤
        const requestBody = {
            action: 'uploadTaskWork',
            taskProgressId: taskProgressId,
            fileName: file.name,
            fileData: base64Data,
            fileMime: file.type,
            userEmail: studentEmail
        };

        const doUpload = async () => {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8'
                },
                body: JSON.stringify(requestBody)
            });
            return response.json();
        };

        let data = null;
        let lastError = null;
        for (let attempt = 1; attempt <= 2; attempt++) {
            try {
                data = await doUpload();
                if (data && data.success && data.fileUrl) {
                    break;
                } else {
                    lastError = new Error(data ? data.message || '上傳失敗' : '上傳失敗');
                }
            } catch (err) {
                lastError = err;
            }
            await new Promise(res => setTimeout(res, 500));
        }

        showLoading(false);

        if (data && data.success && data.fileUrl) {
            uploadedFileUrl = data.fileUrl;
            showWarning('? 作業上傳成功！', 'success');
        } else {
            uploadedFileUrl = null;
            const msg = (data && data.message) ? data.message : (lastError ? lastError.message : '未知錯誤');
            console.error('上傳失敗詳細：', msg);
            showWarning('上傳失敗：' + msg);
        }
    } catch (error) {
        showLoading(false);
        console.error('上傳失敗：', error);
        showWarning('上傳失敗，請稍後再試');
    } finally {
        uploadInProgress = false;
    }
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function showUploadPreview(dataUrl) {
    const preview = document.getElementById('uploadPreview');
    preview.innerHTML = `
        <div style="text-align: center;">
            <p style="color: #10b981; font-weight: 600; margin-bottom: 15px;">✅ 已選擇檔案</p>
            <img src="${dataUrl}" alt="預覽">
        </div>
    `;
}

// ========== Webcam 邏輯 ==========
async function startWebcam(deviceId = null) {
    try {
        // 若已有串流，先關閉
        if (webcamStream) {
            webcamStream.getTracks().forEach(track => track.stop());
            webcamStream = null;
        }

        const constraints = { video: { width: 640, height: 480 } };
        if (deviceId) {
            constraints.video.deviceId = { exact: deviceId };
        } else {
            constraints.video.facingMode = 'user';
        }

        webcamStream = await navigator.mediaDevices.getUserMedia(constraints);

        // 取得相機列表（需權限後才能拿到 label）
        await refreshCameraList();

        const video = document.getElementById('webcam-video');
        video.srcObject = webcamStream;

        // 隱藏上傳區，顯示 webcam
        document.getElementById('uploadArea').style.display = 'none';
        document.getElementById('webcamContainer').classList.add('active');

    } catch (error) {
        console.error('無法啟動相機：', error);
        showWarning('無法啟動相機，請確認權限設定');
    }
}

function closeWebcam() {
    if (webcamStream) {
        webcamStream.getTracks().forEach(track => track.stop());
        webcamStream = null;
    }

    const selectRow = document.getElementById('cameraSelectRow');
    if (selectRow) {
        selectRow.style.display = 'none';
    }

    document.getElementById('uploadArea').style.display = 'block';
    document.getElementById('webcamContainer').classList.remove('active');
}

async function refreshCameraList() {
    const row = document.getElementById('cameraSelectRow');
    const select = document.getElementById('videoDeviceSelect');
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices || !row || !select) return;

    const devices = await navigator.mediaDevices.enumerateDevices();
    cameraDevices = devices.filter(d => d.kind === 'videoinput');

    if (cameraDevices.length === 0) {
        row.style.display = 'none';
        return;
    }

    const previous = selectedCameraId;
    select.innerHTML = '';
    cameraDevices.forEach((dev, idx) => {
        const option = document.createElement('option');
        option.value = dev.deviceId;
        option.textContent = dev.label || `相機 ${idx + 1}`;
        select.appendChild(option);
    });

    if (previous && cameraDevices.some(d => d.deviceId === previous)) {
        select.value = previous;
        selectedCameraId = previous;
    } else {
        selectedCameraId = select.value;
    }

    // 只有多個相機時顯示切換區
    row.style.display = cameraDevices.length > 1 ? 'flex' : 'none';
}

function switchCamera() {
    const select = document.getElementById('videoDeviceSelect');
    if (!select || select.options.length === 0) {
        showWarning('沒有可切換的相機');
        return;
    }
    selectedCameraId = select.value;
    startWebcam(selectedCameraId);
}

function capturePhoto() {
    const video = document.getElementById('webcam-video');
    const canvas = document.getElementById('webcam-canvas');
    const context = canvas.getContext('2d');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);

    // 轉為 Blob
    canvas.toBlob(async function(blob) {
        // 關閉 webcam
        closeWebcam();

        // 顯示預覽
        const dataUrl = canvas.toDataURL('image/jpeg');
        showUploadPreview(dataUrl);

        // 上傳
        const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
        await uploadFileToServer(file);
    }, 'image/jpeg', 0.9);
}

// ========== 評量邏輯 ==========
function renderAssessmentQuestions() {
    const container = document.getElementById('assessmentContent');
    container.innerHTML = '';

    assessmentQuestions.forEach((question, index) => {
        const questionDiv = document.createElement('div');
        questionDiv.className = 'assessment-question';

        const title = document.createElement('h3');
        title.textContent = `${index + 1}. ${question.question}`;
        questionDiv.appendChild(title);

        const optionsDiv = document.createElement('div');
        optionsDiv.className = 'assessment-options';

        question.options.forEach((option, optIndex) => {
            const optionDiv = document.createElement('div');
            optionDiv.className = 'assessment-option';

            // 支援兩種格式：物件 { label, text } 或純字串
            const optionLabel = option.label || String.fromCharCode(65 + optIndex); // A, B, C, D
            const optionText = option.text || option;
            const optionValue = optionLabel; // 儲存選項代號 (A, B, C, D)

            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = `question-${index}`;
            radio.value = optionValue;
            radio.id = `q${index}-opt${optIndex}`;
            radio.addEventListener('change', function() {
                assessmentAnswers[question.questionId] = optionValue;
            });

            const label = document.createElement('label');
            label.htmlFor = `q${index}-opt${optIndex}`;
            label.textContent = `${optionLabel}. ${optionText}`;

            optionDiv.appendChild(radio);
            optionDiv.appendChild(label);
            optionsDiv.appendChild(optionDiv);
        });

        questionDiv.appendChild(optionsDiv);
        container.appendChild(questionDiv);
    });
}

function isAllAssessmentAnswered() {
    return Object.keys(assessmentAnswers).length === assessmentQuestions.length;
}

function calculateAccuracy() {
    let correct = 0;
    assessmentQuestions.forEach(question => {
        const userAnswer = assessmentAnswers[question.questionId];
        if (userAnswer === question.correctAnswer) {
            correct++;
        }
    });
    return assessmentQuestions.length > 0 ? (correct / assessmentQuestions.length) : 0;
}

// ========== 提交所有資料 ==========
async function submitAllData() {
    if (!confirm('確定要提交嗎？提交後無法修改。')) {
        return;
    }

    // 🔒 禁用提交按鈕，防止重複提交
    const btnNext = document.getElementById('btnNext');
    const btnPrev = document.getElementById('btnPrev');
    if (btnNext) {
        btnNext.disabled = true;
        btnNext.textContent = '提交中...';
        btnNext.style.opacity = '0.6';
        btnNext.style.cursor = 'not-allowed';
    }
    if (btnPrev) {
        btnPrev.disabled = true;
        btnPrev.style.opacity = '0.6';
        btnPrev.style.cursor = 'not-allowed';
    }

    showLoading(true);

    try {
        // 停止時間追蹤，計算最終時間
        console.log('🔍 停止時間追蹤前的狀態：', {
            totalActiveTime,
            isWindowActive,
            sessionStartTime,
            sessionStartTimeDate: sessionStartTime ? new Date(sessionStartTime).toISOString() : null
        });

        stopTimeTracking();
        const timeSpentSeconds = getActiveTimeInSeconds();

        console.log('🔍 停止時間追蹤後：', {
            totalActiveTime,
            timeSpentSeconds
        });

        // 計算答對率
        const accuracy = calculateAccuracy();
        const tokenReward = Math.floor((taskData.tokenReward || 100) * accuracy);

        console.log(`📊 提交數據統計：活動時間=${timeSpentSeconds}秒 (${Math.floor(timeSpentSeconds / 60)}分鐘), 答對率=${(accuracy * 100).toFixed(0)}%, 代幣=${tokenReward}`);

        const params = new URLSearchParams({
            action: 'submitTaskExecution',
            taskProgressId: taskProgressId,
            userEmail: studentEmail,
            checklistAnswers: JSON.stringify(checklistAnswers),
            checklistItems: JSON.stringify(checklistItems),  // 新增：傳送檢核項目資料
            uploadedFileUrl: uploadedFileUrl,
            assessmentAnswers: JSON.stringify(assessmentAnswers),
            accuracy: accuracy,
            tokenReward: tokenReward,
            time_spent: timeSpentSeconds  // ✅ 修正：使用 time_spent（蛇形命名）匹配資料庫欄位
        });

        // 🔍 Debug: 在控制台記錄參數（不使用 alert 避免干擾）
        console.log(`🔍 Debug 資訊:`, {
            time_spent: timeSpentSeconds,
            time_spent_type: typeof timeSpentSeconds,
            accuracy: accuracy,
            tokenReward: tokenReward
        });

        const response = await fetch(`${API_URL}?${params.toString()}`);
        const data = await response.json();

        showLoading(false);

        if (data.success) {
            // 清除進度
            clearProgress();

            // ✅ 修復問題7：先通知父視窗刷新任務列表（在顯示對話框前）
            if (window.opener && !window.opener.closed) {
                console.log('📢 通知父視窗刷新任務列表...');
                console.log('🔍 調試：父視窗物件檢查', {
                    hasSelectedClass: !!window.opener.selectedClass,
                    selectedClass: window.opener.selectedClass,
                    hasLoadTaskProgress: typeof window.opener.loadTaskProgress === 'function',
                    hasDisplayQuestList: typeof window.opener.displayQuestList === 'function',
                    hasCloseTaskModal: typeof window.opener.closeTaskModal === 'function'
                });

                try {
                    // 1. 關閉父視窗的任務 modal（如果開著）
                    if (typeof window.opener.closeTaskModal === 'function') {
                        window.opener.closeTaskModal();
                        console.log('✅ 已關閉父視窗的任務 modal');
                    }

                    // 2. 先刷新進度數據，再更新顯示
                    if (typeof window.opener.loadTaskProgress === 'function' &&
                        typeof window.opener.displayQuestList === 'function') {
                        // 獲取 recordId（從父視窗的學習記錄中）
                        const recordId = window.opener.learningRecord?.recordId;
                        console.log('🔍 調試：recordId =', recordId);
                        console.log('🔍 調試：learningRecord =', window.opener.learningRecord);

                        if (recordId) {
                            // ✅ 強制刷新（forceRefresh=true），確保獲取最新資料
                            console.log('🔄 開始強制刷新任務進度...');
                            await window.opener.loadTaskProgress(recordId, true);
                            console.log('✅ 任務進度已刷新，開始更新顯示...');
                            window.opener.displayQuestList();
                            console.log('✅ 父視窗任務列表已強制刷新');
                        } else {
                            console.warn('⚠️ 沒有 recordId，直接刷新顯示');
                            // 如果沒有 recordId，直接刷新顯示（使用快取的進度）
                            window.opener.displayQuestList();
                            console.log('✅ 父視窗任務列表已刷新（使用快取）');
                        }
                    } else if (typeof window.opener.displayQuestList === 'function') {
                        // 降級方案：只刷新顯示
                        console.log('⚠️ 使用降級方案刷新');
                        window.opener.displayQuestList();
                        console.log('✅ 父視窗任務列表已刷新（降級方案）');
                    } else {
                        console.error('❌ 父視窗沒有必要的函數');
                    }

                    // 即時更新父視窗的代幣顯示
                    if (typeof window.opener.refreshUserTokens === 'function') {
                        console.log('🪙 更新父視窗代幣顯示');
                        window.opener.refreshUserTokens();
                    }
                } catch (error) {
                    console.error('❌ 無法通知父視窗:', error);
                    console.error('錯誤詳情:', error.stack);
                }
            } else {
                console.warn('⚠️ 沒有父視窗或父視窗已關閉');
            }

            // 顯示完成訊息（含詳細答題結果）
            showCompletionResults(accuracy, tokenReward);

            // 不自動關閉視窗，讓學生查看結果後自行關閉
            if (btnNext) {
                btnNext.disabled = false;
                btnNext.textContent = '關閉視窗';
                btnNext.style.opacity = '1';
                btnNext.style.cursor = 'pointer';
                btnNext.onclick = function() { window.close(); };
            }
            if (btnPrev) {
                btnPrev.disabled = true;
            }
        } else {
            showWarning('提交失敗：' + data.message);
            if (btnNext) {
                btnNext.disabled = false;
                btnNext.textContent = '提交評量';
                btnNext.style.opacity = '1';
                btnNext.style.cursor = 'pointer';
            }
            if (btnPrev) {
                btnPrev.disabled = false;
                btnPrev.style.opacity = '1';
                btnPrev.style.cursor = 'pointer';
            }
        }
    } catch (error) {
        showLoading(false);
        console.error('提交失敗：', error);
        showWarning('提交失敗，請稍後再試');
        if (btnNext) {
            btnNext.disabled = false;
            btnNext.textContent = '提交評量';
            btnNext.style.opacity = '1';
            btnNext.style.cursor = 'pointer';
        }
        if (btnPrev) {
            btnPrev.disabled = false;
            btnPrev.style.opacity = '1';
            btnPrev.style.cursor = 'pointer';
        }
    }
}

// ========== LocalStorage 進度管理 ==========
function saveProgress() {
    // 儲存前先累加當前活動時間
    if (isWindowActive && sessionStartTime) {
        const activeSeconds = Math.floor((Date.now() - sessionStartTime) / 1000);
        totalActiveTime += activeSeconds;
        sessionStartTime = Date.now(); // 重設起點
    }

    const progress = {
        currentStage,
        currentChecklistIndex,
        checklistAnswers,
        assessmentAnswers,
        uploadedFileUrl,
        lastCheckTime,
        totalActiveTime,  // ✅ 新增：儲存累計活動時間
        timestamp: Date.now()
    };

    localStorage.setItem(STORAGE_KEY_PREFIX + taskProgressId, JSON.stringify(progress));
    console.log('進度已儲存', progress);
}

function loadProgress() {
    const data = localStorage.getItem(STORAGE_KEY_PREFIX + taskProgressId);
    if (data) {
        try {
            return JSON.parse(data);
        } catch (e) {
            console.error('載入進度失敗', e);
            return null;
        }
    }
    return null;
}

function clearProgress() {
    localStorage.removeItem(STORAGE_KEY_PREFIX + taskProgressId);
    console.log('進度已清除');
}

function restoreProgress(progress) {
    currentStage = progress.currentStage || 1;
    currentChecklistIndex = progress.currentChecklistIndex || 0;
    checklistAnswers = progress.checklistAnswers || [];
    assessmentAnswers = progress.assessmentAnswers || {};
    uploadedFileUrl = progress.uploadedFileUrl || null;
    lastCheckTime = progress.lastCheckTime || null;
    totalActiveTime = progress.totalActiveTime || 0;  // ✅ 新增：恢復累計活動時間

    console.log(`⏱️ 恢復進度：累計活動時間 ${totalActiveTime}秒 (${Math.floor(totalActiveTime / 60)}分鐘)`);

    // 切換到對應階段
    switchStage(currentStage);

    // 恢復檢核進度
    if (currentStage === 2) {
        renderChecklistItem(currentChecklistIndex);
    }

    // 恢復上傳預覽
    if (uploadedFileUrl && currentStage === 3) {
        document.getElementById('uploadPreview').innerHTML = `
            <div style="text-align: center;">
                <p style="color: #10b981; font-weight: 600;">✅ 已上傳作業</p>
                <a href="${uploadedFileUrl}" target="_blank">查看檔案</a>
            </div>
        `;
    }

    // 恢復評量答案
    if (currentStage === 4) {
        Object.keys(assessmentAnswers).forEach(questionId => {
            const answer = assessmentAnswers[questionId];
            const radios = document.querySelectorAll(`input[name^="question-"]`);
            radios.forEach(radio => {
                if (radio.value === answer) {
                    radio.checked = true;
                }
            });
        });
    }

    console.log('進度已恢復', progress);
}

// ========== UI 工具函數 ==========
function showWarning(text, type = 'warning') {
    const toast = document.getElementById('warningToast');
    const textEl = document.getElementById('warningText');

    textEl.textContent = text;
    toast.classList.add('show');

    // 3秒後自動隱藏
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (show) {
        overlay.classList.add('show');
    } else {
        overlay.classList.remove('show');
    }
}

// ========== 顯示完成結果（含正確答案，直接在評量畫面標記） ==========
function showCompletionResults(accuracy, tokenReward) {
    console.log('🎉 顯示完成結果:', { accuracy, tokenReward, assessmentQuestions, assessmentAnswers });

    // 禁用所有選項按鈕，防止修改答案
    document.querySelectorAll('.assessment-option input[type="radio"]').forEach(radio => {
        radio.disabled = true;
    });

    // 遍歷每個題目，標記顏色
    assessmentQuestions.forEach((question, qIndex) => {
        const studentAnswer = assessmentAnswers[question.questionId];
        const correctAnswer = question.correctAnswer;
        const isCorrect = studentAnswer === correctAnswer;

        console.log(`題目 ${qIndex + 1}:`, {
            questionId: question.questionId,
            studentAnswer,
            correctAnswer,
            isCorrect
        });

        // 找到該題目的所有選項
        const options = document.querySelectorAll(`input[name="question-${qIndex}"]`);

        options.forEach(radio => {
            const optionDiv = radio.parentElement; // 選項的父容器
            const label = optionDiv.querySelector('label');
            const optionValue = radio.value;

            // 標記學生選擇的答案
            if (optionValue === studentAnswer) {
                if (isCorrect) {
                    // 答對：綠色背景
                    optionDiv.style.background = 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)';
                    optionDiv.style.border = '2px solid #10b981';
                    optionDiv.style.fontWeight = '600';
                    if (label) label.textContent += ' ✅';
                } else {
                    // 答錯：紅色背景
                    optionDiv.style.background = 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)';
                    optionDiv.style.border = '2px solid #ef4444';
                    optionDiv.style.fontWeight = '600';
                    if (label) label.textContent += ' ❌ (你的答案)';
                }
            }

            // 如果學生答錯，顯示正確答案
            if (optionValue === correctAnswer && !isCorrect) {
                optionDiv.style.background = 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)';
                optionDiv.style.border = '2px solid #10b981';
                optionDiv.style.fontWeight = '600';
                if (label) label.textContent += ' ✅ (正確答案)';
            }
        });
    });

    // 在評量內容最上方插入總結卡片
    const taskContent = document.getElementById('taskContent');
    if (!taskContent) {
        console.error('taskContent 容器不存在，無法顯示完成總結卡片');
        return;
    }
    const summaryDiv = document.createElement('div');
    summaryDiv.id = 'completionSummary';
    summaryDiv.style.cssText = `
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 30px;
        border-radius: 12px;
        text-align: center;
        margin-bottom: 30px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    `;

    summaryDiv.innerHTML = `
        <h2 style="margin: 0 0 20px 0; font-size: 28px;">🎉 任務完成！</h2>
        <div style="display: flex; justify-content: center; gap: 40px; margin-bottom: 20px;">
            <div>
                <div style="font-size: 16px; opacity: 0.9;">答對率</div>
                <div style="font-size: 36px; font-weight: 700;">${(accuracy * 100).toFixed(0)}%</div>
            </div>
            <div>
                <div style="font-size: 16px; opacity: 0.9;">獲得代幣</div>
                <div style="font-size: 36px; font-weight: 700;">🪙 ${tokenReward}</div>
            </div>
        </div>
        <button onclick="window.close()" style="
            background: white;
            color: #667eea;
            border: none;
            padding: 12px 32px;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
        " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
            關閉視窗
        </button>
    `;

    // 插入到任務內容最前面
    taskContent.insertBefore(summaryDiv, taskContent.firstChild);

    // 隱藏導覽按鈕
    const navigation = document.querySelector('.task-navigation');
    if (navigation) {
        navigation.style.display = 'none';
    }

    // 捲動到最上方
    window.scrollTo({ top: 0, behavior: 'smooth' });

    console.log('✅ 完成結果顯示完成');
}

// HTML 轉義函數（防止 XSS）
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}


