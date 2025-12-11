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
let taskProgressId = null; // 任務進度ID
let lastCheckTime = null; // 上次勾選時間（用於檢測快速勾選）

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

    // 嘗試從 LocalStorage 恢復進度
    const savedProgress = loadProgress();
    if (savedProgress) {
        if (confirm('偵測到未完成的任務，是否繼續？')) {
            restoreProgress(savedProgress);
            return;
        } else {
            // 清除舊進度
            clearProgress();
        }
    }

    // 載入任務資料
    loadTaskData(taskId);

    // 監聽檔案選擇
    document.getElementById('fileInput').addEventListener('change', handleFileSelect);

    // 監聽 beforeunload（提醒使用者）
    window.addEventListener('beforeunload', function(e) {
        if (currentStage < 4 || !isAllAssessmentAnswered()) {
            e.preventDefault();
            e.returnValue = '';
            saveProgress(); // 儲存進度
        }
    });
});

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
                materialFrame.src = taskData.link;
                console.log('✅ 教材連結已載入：', taskData.link);

                // 監聽 iframe 載入錯誤
                materialFrame.onerror = function() {
                    console.error('❌ iframe 載入失敗');
                };
                materialFrame.onload = function() {
                    console.log('✅ iframe 載入成功');
                };
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

            // 初始化第一階段
            updateStageDisplay();
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

// ========== 階段切換 ==========
function nextStage() {
    // 驗證當前階段是否完成
    if (!validateCurrentStage()) {
        return;
    }

    // 儲存進度
    saveProgress();

    // 切換到下一階段
    if (currentStage < 4) {
        currentStage++;
        switchStage(currentStage);
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

    // 標題（修復：使用 description 而非 text）
    const title = document.createElement('h3');
    title.textContent = `${index + 1}. ${item.description || item.text || '檢核項目'}`;
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
    showLoading(true);

    try {
        // 轉為 Base64
        const base64Data = await fileToBase64(file);

        const params = new URLSearchParams({
            action: 'uploadTaskWork',
            taskProgressId: taskProgressId,
            fileName: file.name,
            fileData: base64Data,
            fileMime: file.type,
            userEmail: studentEmail
        });

        const response = await fetch(`${API_URL}?${params.toString()}`);
        const data = await response.json();

        showLoading(false);

        if (data.success) {
            uploadedFileUrl = data.fileUrl;
            showWarning('✅ 作業上傳成功！', 'success');
        } else {
            showWarning('上傳失敗：' + data.message);
        }
    } catch (error) {
        showLoading(false);
        console.error('上傳失敗：', error);
        showWarning('上傳失敗，請稍後再試');
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
async function startWebcam() {
    try {
        webcamStream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480 }
        });

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

    document.getElementById('uploadArea').style.display = 'block';
    document.getElementById('webcamContainer').classList.remove('active');
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

            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = `question-${index}`;
            radio.value = option;
            radio.id = `q${index}-opt${optIndex}`;
            radio.addEventListener('change', function() {
                assessmentAnswers[question.questionId] = option;
            });

            const label = document.createElement('label');
            label.htmlFor = `q${index}-opt${optIndex}`;
            label.textContent = option;

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

    showLoading(true);

    try {
        // 計算答對率
        const accuracy = calculateAccuracy();
        const tokenReward = Math.floor((taskData.tokenReward || 100) * accuracy);

        const params = new URLSearchParams({
            action: 'submitTaskExecution',
            taskProgressId: taskProgressId,
            userEmail: studentEmail,
            checklistAnswers: JSON.stringify(checklistAnswers),
            uploadedFileUrl: uploadedFileUrl,
            assessmentAnswers: JSON.stringify(assessmentAnswers),
            accuracy: accuracy,
            tokenReward: tokenReward
        });

        const response = await fetch(`${API_URL}?${params.toString()}`);
        const data = await response.json();

        showLoading(false);

        if (data.success) {
            // 清除進度
            clearProgress();

            // 顯示完成訊息
            alert(`🎉 任務完成！\n答對率：${(accuracy * 100).toFixed(0)}%\n獲得代幣：${tokenReward}`);

            // 關閉視窗
            window.close();
        } else {
            showWarning('提交失敗：' + data.message);
        }
    } catch (error) {
        showLoading(false);
        console.error('提交失敗：', error);
        showWarning('提交失敗，請稍後再試');
    }
}

// ========== LocalStorage 進度管理 ==========
function saveProgress() {
    const progress = {
        currentStage,
        currentChecklistIndex,
        checklistAnswers,
        assessmentAnswers,
        uploadedFileUrl,
        lastCheckTime,
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
