/* ==========================================
   學生端 - student.js (遊戲化版本)
   ========================================== */

// 使用立即執行函數避免全域變數污染
(function() {
    'use strict';

    // ==========================================
    // 模組內部變數
    // ==========================================

    let currentStudent = null;
    let allClasses = [];
    let selectedClass = null;
    let selectedCourse = null;
    let courseTiers = [];
    let selectedTier = null;
    let currentTasks = [];
    let currentTasksProgress = {};
    let previousTasksProgress = {}; // 紀錄前一次進度，用於偵測狀態變化
    let learningRecord = null;
    let selectedTask = null;
    let autoResumeTaskProgress = null; // 緩存自動接續任務的進度，避免重複查詢
    let sessionCheckInterval = null; // 階段 2：session 檢查計時器
    let consecutiveInactiveSessionCount = 0; // 連續偵測不到課堂的次數，避免瞬斷就被判定結束
    let taskStatusCheckInterval = null; // 任務狀態檢查計時器（檢查是否被退回）
    let taskTimeLimitCheckInterval = null; // 任務時間限制檢查計時器（檢查是否超時）
    let currentTaskStartTime = null; // 当前任务开始时间
    let hasShownSlowSuggestion = false; // 是否已显示过太慢建议
    let taskExecutionWindow = null; // ✅ 修復問題6：追蹤任務執行視窗，防止重複開啟

    // 性能優化：緩存數據避免重複 API 調用
    let cachedSessionStatus = null; // 緩存課堂狀態
    let cachedProgressData = null; // 緩存任務進度數據
    let sessionCheckTime = null; // 最後檢查課堂狀態的時間

    // ==========================================
    // 初始化
    // ==========================================

    document.addEventListener('DOMContentLoaded', function() {
        APP_CONFIG.log('🎮 遊戲化學生端載入完成');
        checkLoginStatus();
    });

    /**
     * 檢查登入狀態
     */
    function checkLoginStatus() {
        const userJson = localStorage.getItem('user');

        if (!userJson) {
            showToast('請先登入', 'warning');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 1000);
            return;
        }

        try {
            currentStudent = JSON.parse(userJson);

            // 學生端只允許 student 角色
            if (currentStudent.role !== 'student') {
                showToast('此頁面僅限學生使用', 'warning');
                setTimeout(() => {
                    window.location.href = currentStudent.role === 'teacher' ? 'teacher.html' : 'index.html';
                }, 1500);
                return;
            }

            // 載入班級列表
            loadStudentClasses();

        } catch (error) {
            console.error('解析使用者資料失敗:', error);
            localStorage.removeItem('user');
            showToast('登入資料有誤，請重新登入', 'error');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 1500);
        }
    }

    // ==========================================
    // 階段 1: 載入班級列表
    // ==========================================

    /**
     * 載入學生所屬的所有班級
     */
    function loadStudentClasses() {
        showLoading('mainLoading');

        const params = new URLSearchParams({
            action: 'getStudentClasses',
            userEmail: currentStudent.email
        });

        APP_CONFIG.log('📤 載入班級列表...', { userEmail: currentStudent.email });

        fetch(`${APP_CONFIG.API_URL}?${params.toString()}`)
            .then(response => response.json())
            .then(function(response) {
                APP_CONFIG.log('📥 班級列表回應:', response);

                hideLoading('mainLoading');

                if (response.success) {
                    allClasses = response.classes || [];

                    if (allClasses.length === 0) {
                        // 沒有班級
                        showClassSelection();
                        document.getElementById('noClassState').style.display = 'block';
                        document.getElementById('classGrid').style.display = 'none';
                    } else if (allClasses.length === 1) {
                        // 只有一個班級，直接選擇
                        selectClass(allClasses[0]);
                    } else {
                        // 多個班級，顯示選擇畫面
                        displayClassSelection();
                    }
                } else {
                    showToast(response.message || '載入班級失敗', 'error');
                    showClassSelection();
                    document.getElementById('noClassState').style.display = 'block';
                }
            })
            .catch(function(error) {
                hideLoading('mainLoading');
                APP_CONFIG.error('載入班級失敗', error);
                showToast('載入失敗：' + error.message, 'error');
            });
    }

    /**
     * 顯示班級選擇畫面
     */
    function showClassSelection() {
        document.getElementById('classSelection').classList.add('active');
        document.getElementById('tierSelection').classList.remove('active');
        document.getElementById('questBoard').classList.remove('active');
    }

    /**
     * 顯示班級選擇卡片
     */
    function displayClassSelection() {
        showClassSelection();

        const container = document.getElementById('classGrid');
        if (!container) return;

        container.style.display = 'grid';
        container.innerHTML = '';

        allClasses.forEach(function(classData) {
            const card = createClassCard(classData);
            container.appendChild(card);
        });
    }

    /**
     * 建立班級卡片
     */
    function createClassCard(classData) {
        const card = document.createElement('div');
        card.className = 'class-card';

        const hasCourse = classData.course && classData.course.courseId;

        card.innerHTML = `
            <span class="class-icon">🏰</span>
            <div class="class-name">${escapeHtml(classData.className)}</div>
            <div class="class-info">
                ${classData.grade ? '年級：' + escapeHtml(classData.grade) : ''}
                ${classData.description ? '<br>' + escapeHtml(classData.description) : ''}
            </div>
            <div class="class-course ${hasCourse ? '' : 'no-course'}">
                <div class="class-course-label">當前課程</div>
                <div class="class-course-name">
                    ${hasCourse ? escapeHtml(classData.course.courseName) : '尚未安排課程'}
                </div>
            </div>
        `;

        if (hasCourse) {
            card.onclick = () => selectClass(classData);
        } else {
            card.style.cursor = 'not-allowed';
            card.style.opacity = '0.6';
        }

        return card;
    }

    /**
     * 選擇班級
     */
    function selectClass(classData) {
        if (!classData.course || !classData.course.courseId) {
            showToast('此班級尚未安排課程', 'warning');
            return;
        }

        APP_CONFIG.log('✅ 選擇班級:', classData);

        selectedClass = classData;
        selectedCourse = classData.course;

        // 進入層級選擇階段
        loadCourseTiersAndRecord();
    }

    /**
     * 返回班級選擇（階段 2：停止 session 檢查）
     */
    window.backToClassSelection = function() {
        selectedClass = null;
        selectedCourse = null;
        selectedTier = null;
        courseTiers = [];

        // 停止 session 檢查
        stopSessionCheck();

        if (allClasses.length === 1) {
            // 只有一個班級，重新載入
            loadStudentClasses();
        } else {
            displayClassSelection();
        }
    };

    // ==========================================
    // 階段 2: 層級選擇
    // ==========================================

    /**
     * 載入課程層級和學習記錄 (修復自動跳轉問題)
     */
    function loadCourseTiersAndRecord() {
        showLoading('mainLoading');

        if (!selectedClass || !selectedClass.classId || !selectedCourse || !selectedCourse.courseId) {
            hideLoading('mainLoading');
            showToast('無法取得班級或課程資訊', 'error');
            return;
        }

        // UI 設定檔
        const UI_DEFINITIONS = [
            { id: 'tutorial',  name: '基礎層', icon: '📘', color: '#10B981', description: '適合初學者...' },
            { id: 'adventure', name: '進階層', icon: '📙', color: '#F59E0B', description: '適合具備基礎能力者...' },
            { id: 'hardcore',  name: '精通層', icon: '📕', color: '#EF4444', description: '適合進階學習者...' }
        ];

        const params = new URLSearchParams({
            action: 'getStudentClassEntryData',
            userEmail: currentStudent.email,
            classId: selectedClass.classId,
            courseId: selectedCourse.courseId
        });

        APP_CONFIG.log('🚀 載入課程資料...', { classId: selectedClass.classId });

        fetchWithRetry(`${APP_CONFIG.API_URL}?${params.toString()}`, 3)
            .then(response => response.json())
            .then(function(data) {
                
                if (!data.success) throw new Error(data.message || '載入失敗');

                cachedSessionStatus = data.isActive;
                sessionCheckTime = Date.now();

                if (!data.isActive) {
                    hideLoading('mainLoading');
                    displayCourseWaitingScreen();
                    return Promise.reject('waiting_for_class');
                }

                // 1. 建構 UI 層級資料
                let backendData = (data.tiers && data.tiers.length > 0) ? data.tiers[0] : {};
                courseTiers = UI_DEFINITIONS.map(def => {
                    const prefix = def.id; 
                    let descText = backendData[prefix + 'Desc'] || backendData[prefix + '_desc'] || def.description;
                    return {
                        ...backendData,
                        tierId: def.id,
                        name: def.name,
                        tier: def.name, // 強制中文名稱
                        icon: def.icon,
                        color: def.color,
                        description: descText
                    };
                });

                // 2. 儲存學習記錄
                learningRecord = data.learningRecord;
                cachedProgressData = data.progress;

                // ============================================================
                // 🔥 自動跳轉核心除錯區 🔥
                // ============================================================
                console.log('🔍 [Debug] 學習記錄:', learningRecord);
                const defaultTierId = 'tutorial';
                const defaultTierName = (courseTiers.find(t => t.tierId === defaultTierId)?.name) || '基礎層';
                let needAutoInitial = false;

                if (learningRecord) {
                    console.log('?? [Debug] 完整學習記錄物件:', learningRecord);

                    const savedTierRaw = learningRecord.current_tier || learningRecord.currentTier;
                    console.log('?? [Debug] 後端記錄的難度:', savedTierRaw);
                    console.log('?? [Debug] 可用的層級:', courseTiers.map(t => `${t.tierId} (${t.name})`));

                    if (savedTierRaw && savedTierRaw !== 'initial' && savedTierRaw !== '') {
                        const matchedTier = courseTiers.find(t =>
                            t.tierId === savedTierRaw || t.name === savedTierRaw
                        );

                        if (matchedTier) {
                            selectedTier = matchedTier.name; // ? 設定全域變數 (關鍵!)
                            console.log('? [Success] 成功匹配難度，準備跳轉:', selectedTier);
                            console.log('? [Success] 匹配的層級資訊:', matchedTier);
                        } else {
                            console.warn('?? [Warning] 有記錄但找不到對應層級:', savedTierRaw);
                            console.warn('?? [Warning] 可能的原因：層級ID不匹配或層級名稱不匹配');
                            selectedTier = defaultTierName; // 重置為預設
                            needAutoInitial = true;
                        }
                    } else {
                        console.log('?? [Info] 無有效難度記錄 (initial、空字串或null)，預設基礎層');
                        console.log('?? [Info] savedTierRaw 值:', savedTierRaw);
                        selectedTier = defaultTierName;
                        needAutoInitial = true;
                    }
                } else {
                    console.log('? [Error] 沒有學習記錄，使用預設基礎層');
                    selectedTier = defaultTierName;
                    needAutoInitial = true;
                }

                if (needAutoInitial) {
                    if (learningRecord) {
                        learningRecord.current_tier = defaultTierId;
                        learningRecord.currentTier = defaultTierId;
                    }
                    recordTierChange('initial', defaultTierId, 'auto_initial', '', 0);
                }// ============================================================

                return checkAndResumeTier();
            })
            .then(function(resumed) {
                // resumed 必須是 checkAndResumeTier 回傳的 true
                if (resumed === true) {
                    console.log('🚀 [Jump] 跳轉成功，隱藏 Loading');
                    // 跳轉成功，這裡不需要做什麼，因為 loadTierTasks 已經在渲染畫面了
                } else {
                    console.log('🛑 [Stop] 無法跳轉，顯示難度選擇畫面');
                    hideLoading('mainLoading');
                    if (typeof displayTierSelection === 'function') {
                        displayTierSelection();
                    }
                }
            })
            .catch(function(error) {
                if (error === 'waiting_for_class') return;
                hideLoading('mainLoading');
                APP_CONFIG.error('載入失敗', error);
                showToast('載入失敗：' + error.message, 'error');
            });
    }

    /**
     * 檢查並恢復上次的層級狀態
     * @returns {Promise<boolean>} true=已跳轉, false=未跳轉
     */
    function checkAndResumeTier() {
        console.log('🔍 [Check] 檢查是否需要跳轉, selectedTier:', selectedTier);

        // 如果全域變數 selectedTier 有值 (已經從後端恢復了)
        if (selectedTier) {
            // 呼叫載入任務列表 (loadTierTasks 必須回傳 Promise)
            // 參數1: true (使用緩存), 參數2: true (不顯示 loading，因為我們已經在 loading 中)
            return loadTierTasks(true, true) 
                .then(() => {
                    console.log('✅ [Check] 任務載入完成，回傳 true');
                    return true; // 告訴上層：我已經處理好畫面了
                })
                .catch(err => {
                    console.error('❌ [Check] 自動跳轉載入失敗:', err);
                    selectedTier = null; 
                    return false; // 失敗了，回傳 false 讓上層顯示選單
                });
        }
        
        // 如果沒有 selectedTier，直接回傳 false
        return Promise.resolve(false);
    }
    
    /**
     * 檢查並顯示「接續任務」Modal（課堂開始時）
     * 目的：自動檢測是否有 in_progress 的任務，有則直接跳出 Modal
     */
    function checkAndShowResumeModal() {
        if (!learningRecord || !learningRecord.recordId) {
            return Promise.resolve(false);
        }

        const params = new URLSearchParams({
            action: 'getTaskProgress',
            recordId: learningRecord.recordId
        });

        APP_CONFIG.log('📤 檢查是否有未完成的任務（課堂開始時）...', { recordId: learningRecord.recordId });

        return fetch(`${APP_CONFIG.API_URL}?${params.toString()}`)
            .then(response => response.json())
            .then(function(response) {
                APP_CONFIG.log('📥 任務進度回應:', response);

                if (!response.success || !response.progress) {
                    return false;
                }

                // 找到第一個 in_progress 的任務
                const progressEntries = Object.entries(response.progress);
                for (let i = 0; i < progressEntries.length; i++) {
                    const [taskId, progress] = progressEntries[i];
                    
                    if (progress.status === 'in_progress' && progress.startTime) {
                        // 找到未完成的任務！自動顯示接續 Modal
                        APP_CONFIG.log('✅ 發現未完成的任務，自動顯示接續 Modal:', { taskId, status: progress.status });
                        
                        // 從 courseDetails 中找到對應的任務資訊
                        const courseDetailsParams = new URLSearchParams({
                            action: 'getCourseDetails',
                            courseId: selectedCourse.courseId
                        });

                        return fetch(`${APP_CONFIG.API_URL}?${courseDetailsParams.toString()}`)
                            .then(courseResponse => courseResponse.json())
                            .then(function(courseData) {
                                if (courseData.success && courseData.tasks) {
                                    // 找到對應的任務
                                    const task = courseData.tasks.find(t => t.taskId === taskId);
                                    if (task) {
                                        // 自動顯示接續 Modal，並設定全域變數
                                        selectedTask = task;
                                        showAutoResumeTaskModal(task, progress);
                                        return true;
                                    }
                                }
                                return false;
                            });
                    }
                }

                return false;
            })
            .catch(function(error) {
                APP_CONFIG.error('檢查未完成任務失敗', error);
                return false;
            });
    }

    /**
     * 自動顯示「接續任務」Modal（課堂開始時自動觸發，無需使用者點擊）
     */
    function showAutoResumeTaskModal(task, progress) {
        // 隱藏等待屏幕
        const waitingContainer = document.getElementById('courseWaitingContainer');
        if (waitingContainer) {
            waitingContainer.style.display = 'none';
        }

        // 緩存進度，讓後續 openTaskModal 能正確顯示「繼續」按鈕
        const normalizedProgress = progress ? { ...progress, status: progress.status || 'in_progress' } : null;
        autoResumeTaskProgress = normalizedProgress;
        if (task && normalizedProgress) {
            currentTasksProgress[task.taskId] = normalizedProgress;
        }

        // 創建或取得接續任務 Modal
        let resumeModal = document.getElementById('resumeTaskModal');
        if (!resumeModal) {
            resumeModal = document.createElement('div');
            resumeModal.id = 'resumeTaskModal';
            resumeModal.className = 'modal';
            resumeModal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.7);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1000;
            `;
            document.body.appendChild(resumeModal);
        }

        // 計算累積時間
        const accumulatedTime = (progress && progress.timeSpent) || 0; // 單位：秒
        const hours = Math.floor(accumulatedTime / 3600);
        const minutes = Math.floor((accumulatedTime % 3600) / 60);
        const seconds = accumulatedTime % 60;
        
        let timeStr = '';
        if (hours > 0) {
            timeStr = `${hours}小時 ${minutes}分 ${seconds}秒`;
        } else if (minutes > 0) {
            timeStr = `${minutes}分 ${seconds}秒`;
        } else {
            timeStr = `${seconds}秒`;
        }

        resumeModal.innerHTML = `
            <div style="background: white; border-radius: 16px; padding: 40px; max-width: 500px; text-align: center; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);">
                <div style="font-size: 60px; margin-bottom: 20px;">⚠️</div>
                <h2 style="color: var(--primary-color); font-size: 24px; font-weight: 700; margin-bottom: 16px;">上一次任務未完成</h2>
                <p style="color: var(--text-medium); font-size: 16px; margin-bottom: 24px; line-height: 1.8;">
                    <strong>${task.name}</strong><br>
                    已累積耗時: <span style="color: var(--game-accent); font-weight: 700; font-size: 18px;">${timeStr}</span><br>
                    請接續完成你的任務
                </p>
                <div style="display: flex; gap: 12px; justify-content: center;">
                    <button onclick="closeAutoResumeTaskModal()" style="padding: 12px 24px; background: var(--text-light); color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer;">
                        稍候
                    </button>
                    <button onclick="autoCompleteResumeTask()" style="padding: 12px 24px; background: var(--game-primary); color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer;">
                        繼續任務
                    </button>
                </div>
            </div>
        `;

        resumeModal.style.display = 'flex';
        APP_CONFIG.log('✅ 已自動顯示接續任務 Modal');
    }

    /**
     * 關閉自動「接續任務」Modal（課堂開始自動觸發時）
     */
    window.closeAutoResumeTaskModal = function() {
        const resumeModal = document.getElementById('resumeTaskModal');
        if (resumeModal) {
            resumeModal.style.display = 'none';
        }
        // 顯示層級選擇
        displayTierSelection();
    };

    /**
     * 自動繼續任務（課堂開始自動顯示的 Modal 中的確認按鈕）
     * 與 continueTask() 的差異：
     * - continueTask()：用於使用者點擊任務卡片後的 Modal
     * - autoCompleteResumeTask()：用於課堂開始自動顯示的 Modal，進入任務詳情而非直接打開連結
     */
    window.autoCompleteResumeTask = function() {
        if (!selectedTask) return;

        // 修復：檢查並確保有 classId
        if (!selectedClass || !selectedClass.classId) {
            showToast('無法取得班級資訊，請重新登入', 'error');
            APP_CONFIG.error('繼續任務失敗：缺少 selectedClass');
            return;
        }

        const params = new URLSearchParams({
            action: 'startTask',
            userEmail: currentStudent.email,
            taskId: selectedTask.taskId,
            classId: selectedClass.classId  // 修復：加入 classId
        });

        APP_CONFIG.log('📤 自動繼續任務...', { taskId: selectedTask.taskId, classId: selectedClass.classId });

        fetch(`${APP_CONFIG.API_URL}?${params.toString()}`)
            .then(response => response.json())
            .then(function(response) {
                APP_CONFIG.log('📥 自動繼續任務回應:', response);

                if (response.success) {
                    // 關閉接續 Modal
                    const resumeModal = document.getElementById('resumeTaskModal');
                    if (resumeModal) {
                        resumeModal.style.display = 'none';
                    }
                    
                    // 合併最新進度，確保 openTaskModal 能顯示「繼續完成任務」按鈕
                    const resumeProgress = {
                        status: 'in_progress',
                        ...(currentTasksProgress[selectedTask.taskId] || {}),
                        ...(autoResumeTaskProgress || {})
                    };

                    // 後端若回傳新的 taskProgressId，覆寫保存
                    if (response.taskProgressId) {
                        resumeProgress.taskProgressId = response.taskProgressId;
                    }

                    currentTasksProgress[selectedTask.taskId] = resumeProgress;
                    autoResumeTaskProgress = resumeProgress;
                    
                    // 直接進入任務詳情 Modal（沿用 openTaskModal 的按鈕邏輯）
                    openAutoResumeTaskDetail(selectedTask, resumeProgress);
                } else {
                    showToast(response.message || '繼續失敗', 'error');
                }
            })
            .catch(function(error) {
                APP_CONFIG.error('自動繼續任務失敗', error);
                showToast('繼續失敗：' + error.message, 'error');
            });
    };

    /**
     * 進入自動恢復的任務詳情 Modal（課堂開始自動觸發時）
     * 顯示完整的任務詳情，包括「完成任務」按鈕
     */
    function openAutoResumeTaskDetail(task, progressOverride) {
        if (!task) return;

        const progress = progressOverride ||
                         autoResumeTaskProgress ||
                         (currentTasksProgress && currentTasksProgress[task.taskId]) ||
                         { status: 'in_progress' };

        // 同步緩存，確保其他流程也能拿到最新進度
        autoResumeTaskProgress = progress;
        if (currentTasksProgress && task) {
            currentTasksProgress[task.taskId] = progress;
        }

        // 直接復用 openTaskModal，避免與主流程 DOM 結構脫節
        openTaskModal(task, progress);
        APP_CONFIG.log('? 已進入自動恢復的任務詳情 Modal');
    }

    /**
     * 載入課程層級 (修正：強制同步中文名稱與 UI 樣式)
     */
    function loadCourseTiers() {
        // ============================================================
        // 🎨 UI 設定檔：這跟 loadCourseTiersAndRecord 是一模一樣的
        // 確保兩種流程看到的畫面完全一致
        // ============================================================
        const UI_DEFINITIONS = [
            {
                id: 'tutorial',
                name: '基礎層',     // ✅ 強制顯示中文
                icon: '📘',         // 藍色書本 Emoji
                color: '#10B981',   // 綠色
                description: '適合初學者，循序漸進地學習基礎知識'
            },
            {
                id: 'adventure',
                name: '進階層',     // ✅ 強制顯示中文
                icon: '📙',         // 橘色書本 Emoji
                color: '#F59E0B',   // 橘色
                description: '適合具備基礎能力者，挑戰更深入的內容'
            },
            {
                id: 'hardcore',
                name: '精通層',     // ✅ 強制顯示中文
                icon: '📕',         // 紅色書本 Emoji
                color: '#EF4444',   // 紅色
                description: '適合進階學習者，挑戰高難度任務'
            }
        ];
        // ============================================================

        const params = new URLSearchParams({
            action: 'getCourseTiers',
            courseId: selectedCourse.courseId
        });

        APP_CONFIG.log('📤 載入課程層級...', { courseId: selectedCourse.courseId });

        return fetch(`${APP_CONFIG.API_URL}?${params.toString()}`)
            .then(response => response.json())
            .then(function(response) {
                APP_CONFIG.log('📥 課程層級回應:', response);

                if (response.success) {
                    let rawTiers = response.tiers || [];

                    // 🛠️ 強制建構：使用 UI_DEFINITIONS 來覆寫後端的英文資料
                    courseTiers = UI_DEFINITIONS.map(def => {
                        
                        // 嘗試從後端資料中找到對應的那一筆 (透過 id 或 tier 名稱比對)
                        // 後端傳來的可能是 tier: 'tutorial'
                        const backendTier = rawTiers.find(t => 
                            (t.tier || '').toLowerCase() === def.id || 
                            (t.id || '').toLowerCase() === def.id
                        ) || {};

                        // 智慧抓取描述文字 (優先用後端的，沒有就用前端設定的)
                        let descText = 
                            backendTier.description || 
                            backendTier.desc || 
                            def.description;

                        return {
                            ...backendTier,   // 保留後端可能有的其他資訊
                            
                            tierId: def.id,   
                            
                            // 🔥 關鍵修正：強制把 'tier' 欄位改成中文名稱
                            tier: def.name,   // 這會讓卡片顯示「基礎層」
                            name: def.name,   
                            
                            icon: def.icon,   // 確保圖示一致
                            color: def.color, // 確保顏色一致
                            description: descText 
                        };
                    });

                    console.log('✅ 課程層級載入完成 (已轉中文):', courseTiers);

                } else {
                    showToast('載入層級失敗：' + (response.message || ''), 'error');
                    courseTiers = [];
                }
            });
    }

    /**
     * 載入或創建學習記錄
     */
    function loadOrCreateLearningRecord() {
        // ✓ 修正：傳入 classId 參數，確保取得正確班級的學習記錄
        const params = new URLSearchParams({
            action: 'getStudentDashboard',
            userEmail: currentStudent.email,
            classId: selectedClass.classId  // ✓ 新增：指定班級 ID
        });

        APP_CONFIG.log('📤 載入學習記錄...', {
            userEmail: currentStudent.email,
            classId: selectedClass.classId
        });

        return fetch(`${APP_CONFIG.API_URL}?${params.toString()}`)
            .then(response => response.json())
            .then(function(response) {
                APP_CONFIG.log('📥 學習記錄回應:', response);

                if (response.success && response.learningRecord) {
                    learningRecord = response.learningRecord;
                } else {
                    // 創建新的學習記錄
                    return startLearning();
                }
            });
    }

    /**
     * 開始學習課程（創建學習記錄）
     */
    function startLearning() {
        const params = new URLSearchParams({
            action: 'startLearning',
            userEmail: currentStudent.email,
            classId: selectedClass.classId,
            courseId: selectedCourse.courseId
        });

        APP_CONFIG.log('📤 開始學習課程...', { classId: selectedClass.classId, courseId: selectedCourse.courseId });

        return fetch(`${APP_CONFIG.API_URL}?${params.toString()}`)
            .then(response => response.json())
            .then(function(response) {
                APP_CONFIG.log('📥 開始學習回應:', response);

                if (response.success && response.learningRecord) {
                    learningRecord = response.learningRecord;
                } else {
                    throw new Error(response.message || '開始學習失敗');
                }
            });
    }

    /**
     * 顯示課程等待畫面（階段 2：在層級選擇階段等待）
     */
    function displayCourseWaitingScreen() {
        // 清除舊的檢查（但不停止整個檢查，只清除定時器）
        if (sessionCheckInterval) {
            clearInterval(sessionCheckInterval);
            sessionCheckInterval = null;
        }

        // 隱藏所有內容區塊
        document.getElementById('classSelection').classList.remove('active');
        document.getElementById('tierSelection').classList.remove('active');
        document.getElementById('questBoard').classList.remove('active');
        
        // 隱藏所有內容
        const classSelection = document.getElementById('classSelection');
        const tierSelection = document.getElementById('tierSelection');
        const questBoard = document.getElementById('questBoard');
        
        if (classSelection) classSelection.style.display = 'none';
        if (tierSelection) tierSelection.style.display = 'none';
        if (questBoard) questBoard.style.display = 'none';

        // 創建獨立的等待屏幕容器
        let waitingContainer = document.getElementById('courseWaitingContainer');
        if (!waitingContainer) {
            waitingContainer = document.createElement('div');
            waitingContainer.id = 'courseWaitingContainer';
            waitingContainer.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                background: var(--bg-primary);
                z-index: 1000;
            `;
            document.body.appendChild(waitingContainer);
        }

        // 顯示等待訊息
        waitingContainer.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; max-width: 500px;">
                <div style="font-size: 120px; margin-bottom: 30px; animation: bounce 2s infinite;">⏰</div>
                <h1 style="color: var(--primary-color); margin-bottom: 20px; font-size: 32px; font-weight: 700;">
                    等待課堂開始
                </h1>
                <p style="color: var(--text-medium); font-size: 18px; margin-bottom: 30px; line-height: 1.8;">
                    老師還沒有開始本次課堂<br>
                    <span style="font-weight: 600;">請稍候，系統正在自動檢查...</span>
                </p>
                <div style="display: inline-block; padding: 16px 32px; background: rgba(52, 152, 219, 0.1); border-radius: 12px; color: var(--primary-color); font-weight: 600; font-size: 16px;">
                    <span style="display: inline-block; width: 10px; height: 10px; background: var(--primary-color); border-radius: 50%; margin-right: 10px; animation: pulse 2s infinite;"></span>
                    自動檢查中...（每 5 秒）
                </div>
                <p style="color: var(--text-light); font-size: 14px; margin-top: 30px;">
                    課堂開始後，您將自動進入選擇難度界面
                </p>
            </div>
        `;
        
        waitingContainer.style.display = 'flex';

        APP_CONFIG.log('💾 保存班級資訊用於持續檢查:', { selectedClass });
        
        // 啟動定期檢查 session 狀態（每 5 秒）
        startCourseSessionCheck();
    }

    /**
     * 啟動課程階段的 session 檢查（階段 2）
     */
    function startCourseSessionCheck() {
        // 清除舊的計時器
        if (sessionCheckInterval) {
            clearInterval(sessionCheckInterval);
        }

        sessionCheckInterval = setInterval(function() {
            // 檢查 selectedClass 是否存在
            if (!selectedClass || !selectedClass.classId) {
                APP_CONFIG.log('⚠️ 警告：selectedClass 缺失，但繼續檢查...', { selectedClass });
                // 不停止檢查，而是繼續嘗試
                return;
            }

            const checkParams = new URLSearchParams({
                action: 'getCurrentSession',
                classId: selectedClass.classId,
                userEmail: currentStudent.email
            });

            APP_CONFIG.log('🔄 自動檢查課堂狀態（課程階段）...');

            fetch(`${APP_CONFIG.API_URL}?${checkParams.toString()}`)
                .then(response => response.json())
                .then(function(sessionResponse) {
                    APP_CONFIG.log('📥 課堂狀態回應:', sessionResponse);

                    if (sessionResponse.success && sessionResponse.isActive) {
                        // 老師開始上課了！
                        APP_CONFIG.log('✅ 老師已開始上課，載入層級選擇');

                        // ❌ 立即停止計時器，防止重複執行
                        stopSessionCheck();

                        showToast('✅ 老師已開始上課！', 'success');

                        // 隱藏等待屏幕
                        const waitingContainer = document.getElementById('courseWaitingContainer');
                        if (waitingContainer) {
                            waitingContainer.style.display = 'none';
                        }

                        // 性能優化：顯示 loading 避免用戶誤以為當機（載入課程資料需要時間）
                        showLoading('mainLoading');

                        // 🚀 並發優化：添加隨機延遲（0-3秒），避免所有學生同時調用 API
                        // 30 個學生分散在 3 秒內，平均每秒 10 個請求，降低後端壓力
                        const randomDelay = Math.floor(Math.random() * 3000); // 0-3000ms
                        APP_CONFIG.log(`⏱️ 隨機延遲 ${randomDelay}ms 後載入資料（錯峰調用）`);

                        setTimeout(function() {
                            // 載入課程資料並顯示層級選擇
                            Promise.all([
                                loadCourseTiers(),
                                loadOrCreateLearningRecord()
                            ])
                            .then(function() {
                                // 檢查是否有 in_progress 的任務，如果有自動跳出接續 Modal
                                return checkAndShowResumeModal();
                            })
                            .then(function(showedModal) {
                                // 如果已顯示接續 Modal，則不顯示層級選擇
                                if (!showedModal) {
                                    // 檢查並恢復未完成的任務
                                    return checkAndResumeTier();
                                }
                                return Promise.resolve(false);
                            })
                            .then(function(resumed) {
                                // 隱藏 loading（無論是恢復任務還是顯示層級選擇）
                                hideLoading('mainLoading');

                                // 如果沒有恢復任務，顯示層級選擇
                                if (!resumed) {
                                    displayTierSelection();
                                }
                            })
                            .catch(function(error) {
                                // 錯誤時也要隱藏 loading
                                hideLoading('mainLoading');
                                APP_CONFIG.error('載入課程資訊失敗', error);
                                showToast('載入失敗：' + error.message, 'error');
                            });
                        }, randomDelay); // 結束 setTimeout
                    } else {
                        APP_CONFIG.log('ℹ️ 課堂尚未開始，繼續等待...');
                    }
                })
                .catch(function(error) {
                    APP_CONFIG.error('檢查課堂狀態失敗', error);
                });
        }, 5000); // 每 5 秒檢查一次

        APP_CONFIG.log('⏱️ 啟動課程階段 session 狀態檢查（每 5 秒）');
    }

    /**
     * 顯示層級選擇畫面
     */
    function displayTierSelection() {
        // 停止等待課堂開始的檢查（如果正在檢查）
        stopSessionCheck();

        // 重要：啟動課堂結束檢測（階段 2：防止停留在層級選擇時無法檢測課堂結束）
        startActiveSessionCheck();

        // 隱藏等待屏幕
        const waitingContainer = document.getElementById('courseWaitingContainer');
        if (waitingContainer) {
            waitingContainer.style.display = 'none';
        }

        document.getElementById('classSelection').classList.remove('active');
        document.getElementById('tierSelection').classList.add('active');
        document.getElementById('questBoard').classList.remove('active');

        // 確保顯示內容
        const tierSelection = document.getElementById('tierSelection');
        if (tierSelection) tierSelection.style.display = 'block';

        // 更新課程資訊
        document.getElementById('courseName').textContent = selectedCourse.courseName || '課程名稱';
        document.getElementById('courseDescription').textContent = selectedCourse.description || '暫無說明';

        // 更新進度
        updateProgress('progressBarFill', 'progressText');

        // 顯示層級卡片
        const container = document.getElementById('tierGrid');
        if (!container) return;

        container.innerHTML = '';

        if (courseTiers.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">⚔️</div>
                    <h3>暫無層級</h3>
                    <p>此課程尚未設定層级</p>
                </div>
            `;
            return;
        }

        courseTiers.forEach(function(tierInfo) {
            const card = createTierCard(tierInfo);
            container.appendChild(card);
        });
    }

    /**
     * 建立層級卡片
     */
    function createTierCard(tierInfo) {
        const card = document.createElement('div');
        card.className = 'tier-card';
        card.style.borderColor = tierInfo.color;
        card.style.color = tierInfo.color;

        card.innerHTML = `
            <span class="tier-icon">${tierInfo.icon}</span>
            <div class="tier-name">${escapeHtml(tierInfo.tier)}</div>
            <div class="tier-description">${escapeHtml(tierInfo.description)}</div>
        `;

        card.onclick = () => selectTier(tierInfo);

        return card;
    }

    /**
     * 選擇難度層級
     */
    function selectTier(tierInfo) {
        if (!tierInfo) return;

        const tierName = tierInfo.name || tierInfo.tier; // 例如 "基礎層"
        const tierId = tierInfo.tierId || tierInfo.id;   // 例如 "tutorial"

        console.log('🎯 [選擇難度] 層級資訊:', { tierName, tierId, fullInfo: tierInfo });

        // 呼叫後端記錄 (Record Change)
        // 注意：這裡我們傳 tierId 給後端存 (例如 tutorial)，但前端顯示用 tierName
        recordTierChange(
            null, // fromTier 設為 null，交給後端去查
            tierId, // toTier: 存入資料庫的值 (建議存 ID: tutorial)
            'manual',
            null,
            0
        );

        // 更新前端狀態
        selectedTier = tierName;
        console.log('✅ [選擇難度] 已設定 selectedTier:', selectedTier);

        // 進入任務列表
        loadTierTasks();
    }

    /**
     * 返回層級選擇（階段 2：停止 session 檢查）
     */
    window.backToTierSelection = function() {
        selectedTier = null;
        currentTasks = [];
        currentTasksProgress = {};

        // 停止檢查
        stopSessionCheck();
        stopTaskStatusCheck();
        stopTimeTracking && stopTimeTracking();

        displayTierSelection();
    };

    // ==========================================
    // 階段 3: 任務列表
    // ==========================================

    /**
 * 載入選定層級的任務（階段 2：檢查 session 狀態）
 * @param {boolean} useCache - 是否使用緩存數據
 * @param {boolean} skipShowLoading - 是否跳過 showLoading
 * @returns {Promise} - 回傳 Promise 以便 checkAndResumeTier 等待完成
 */
    function loadTierTasks(useCache = false, skipShowLoading = false) {
        
        if (!skipShowLoading) {
            showLoading('mainLoading');
        }

        // 檢查基本資料
        if (!selectedClass || !selectedClass.classId) {
            hideLoading('mainLoading');
            showToast('無法取得班級資訊', 'error');
            return Promise.reject('no_class_info');
        }

        // --- 1. 檢查緩存 (Cache Check) ---
        const now = Date.now();
        const cacheValid = useCache &&
                        cachedSessionStatus !== null &&
                        sessionCheckTime &&
                        (now - sessionCheckTime) < 5000;

        if (cacheValid) {
            APP_CONFIG.log('⚡ 使用緩存的課堂狀態');

            if (!cachedSessionStatus) {
                hideLoading('mainLoading');
                // 請確認你的等待畫面函式名稱是 displayCourseWaitingScreen 還是 displayWaitingScreen
                if (typeof displayCourseWaitingScreen === 'function') {
                    displayCourseWaitingScreen();
                } else {
                    console.error('找不到等待畫面函式');
                }
                return Promise.reject('waiting_for_class');
            }

            // ✅ 重點修正：這裡必須加上 return
            return loadTasksData()
                .catch(function(error) {
                    hideLoading('mainLoading');
                    APP_CONFIG.error('載入任務失敗', error);
                    showToast('載入任務失敗：' + error.message, 'error');
                    throw error; // 繼續拋出錯誤，讓上層知道失敗了
                });
        }

        // --- 2. 無緩存，呼叫 API 檢查 ---
        const checkParams = new URLSearchParams({
            action: 'getCurrentSession',
            classId: selectedClass.classId,
            userEmail: currentStudent.email
        });

        APP_CONFIG.log('📤 檢查課堂狀態...', { classId: selectedClass.classId });

        // ✅ 重點修正：這裡必須加上 return
        return fetch(`${APP_CONFIG.API_URL}?${checkParams.toString()}`)
            .then(response => response.json())
            .then(function(sessionResponse) {
                APP_CONFIG.log('📥 課堂狀態回應:', sessionResponse);

                if (!sessionResponse.success) {
                    throw new Error('無法檢查課堂狀態');
                }

                // 更新緩存
                cachedSessionStatus = sessionResponse.isActive;
                sessionCheckTime = Date.now();

                // 檢查是否有進行中的課堂
                if (!sessionResponse.isActive) {
                    hideLoading('mainLoading');
                    if (typeof displayCourseWaitingScreen === 'function') {
                        displayCourseWaitingScreen();
                    }
                    return Promise.reject('waiting_for_class');
                }

                // 有進行中的課堂，繼續載入任務
                return loadTasksData();
            })
            .catch(function(error) {
                // 如果是等待課堂的狀態，不顯示錯誤訊息
                if (error === 'waiting_for_class') {
                    APP_CONFIG.log('⏳ 等待課堂開始...');
                    // 這裡我們把錯誤 "吃掉" (不 throw)，回傳一個空的 Promise
                    // 這樣 checkAndResumeTier 那邊會收到 undefined/false，就不會報錯
                    return Promise.resolve(false); 
                }
                
                hideLoading('mainLoading');
                APP_CONFIG.error('檢查課堂狀態失敗', error);
                showToast('檢查課堂狀態失敗：' + error.message, 'error');
                throw error;
            });
    }

    /**
     * 載入並篩選任務列表
     */
    function loadTasksData() {
        const params = new URLSearchParams({
            action: 'getCourseDetails',
            courseId: selectedCourse.courseId
        });

        APP_CONFIG.log('📤 載入任務列表...', { courseId: selectedCourse.courseId });

        // ✅ 這裡有 return，這是正確的
        return fetch(`${APP_CONFIG.API_URL}?${params.toString()}`)
            .then(response => response.json())
            .then(function(response) {
                APP_CONFIG.log('📥 任務列表回應:', response);

                if (response.success) {
                    const allTasks = response.tasks || [];

                    // ============================================================
                    // 🔥 強化篩選邏輯：建立中英文對照，防止篩選失敗
                    // ============================================================
                    const TIER_MAP = {
                        '基礎層': 'tutorial',
                        '進階層': 'adventure',
                        '精通層': 'hardcore',
                        '困難層': 'hardcore',
                        // 反向對照也加進去，防呆
                        'tutorial': '基礎層',
                        'adventure': '進階層',
                        'hardcore': '困難層'
                    };

                    // 取得對應的英文 ID (例如 selectedTier='基礎層' -> targetId='tutorial')
                    const targetId = TIER_MAP[selectedTier] || selectedTier; 
                    // ============================================================

                    currentTasks = allTasks.filter(task => {
                        // 1. 基本防呆
                        if (!task || typeof task !== 'object' || !task.taskId) {
                            return false;
                        }

                        // 2. 新結構篩選 (支援中英文比對)
                        if (task.tier && task.tier !== 'mixed') {
                            // 比對：任務的 tier 等於「選定名稱」或「對應 ID」
                            return task.tier === selectedTier || task.tier === targetId;
                        }

                        // 3. 舊結構篩選 (Mixed 模式)
                        // 這裡維持原本邏輯，因為它已經寫好中文判斷了
                        if (selectedTier === 'tutorial' || selectedTier === '基礎層') {
                            return !!(task.tutorialDesc || task.tutorialLink);
                        } else if (selectedTier === 'adventure' || selectedTier === '進階層') {
                            return !!(task.adventureDesc || task.adventureLink);
                        } else if (selectedTier === 'hardcore' || selectedTier === '精通層') {
                            return !!(task.hardcoreDesc || task.hardcoreLink);
                        }

                        return false;
                    });

                    // 按順序排序
                    currentTasks.sort((a, b) => a.sequence - b.sequence);

                    // 再次過濾無效任務
                    currentTasks = currentTasks.filter(t => t && t.taskId);

                    APP_CONFIG.log('✅ 篩選後的任務:', { count: currentTasks.length, selectedTier });

                    // 載入任務進度
                    return loadTaskProgress(learningRecord.recordId);
                } else {
                    throw new Error(response.message || '載入任務失敗');
                }
            })
            .then(function(progressResult) {
                hideLoading('mainLoading');

                // 確保畫面顯示
                try {
                    displayQuestBoard();
                } catch (error) {
                    APP_CONFIG.error('顯示任務畫面時出錯:', error);
                    showToast('顯示任務畫面失敗：' + error.message, 'error');
                }
            })
            .catch(function(error) {
                hideLoading('mainLoading');
                APP_CONFIG.error('載入任務失敗', error);
                showToast('載入任務失敗：' + error.message, 'error');
                // 這裡不需要 throw，因為這裡是最後一步了
            });
    }

    /**
     * 載入任務進度
     */
    function loadTaskProgress(recordId, forceRefresh = false) {
        // 性能優化：如果有緩存的進度數據且不是強制刷新，直接使用
        if (cachedProgressData && !forceRefresh) {
            APP_CONFIG.log('⚡ 使用緩存的任務進度數據，跳過重複調用');

            currentTasksProgress = cachedProgressData;
            previousTasksProgress = { ...currentTasksProgress };

            // 為每個任務添加預設狀態
            currentTasks.forEach(task => {
                if (!currentTasksProgress[task.taskId]) {
                    currentTasksProgress[task.taskId] = {
                        status: 'not_started',
                        startTime: null,
                        completeTime: null
                    };
                }
            });

            // 清空緩存（已使用）
            cachedProgressData = null;

            return Promise.resolve(true);
        }

        // ✅ 修復問題7：如果是強制刷新，清除緩存
        if (forceRefresh) {
            cachedProgressData = null;
            APP_CONFIG.log('🔄 強制刷新任務進度，清除緩存');
        }

        // 沒有緩存或強制刷新，正常調用 API
        const params = new URLSearchParams({
            action: 'getTaskProgress',
            recordId: recordId
        });

        APP_CONFIG.log('📤 載入任務進度...', { recordId });

        return fetch(`${APP_CONFIG.API_URL}?${params.toString()}`)
            .then(response => response.json())
            .then(function(response) {
                APP_CONFIG.log('📥 任務進度回應:', response);

                if (response.success) {
                    previousTasksProgress = { ...currentTasksProgress };
                    currentTasksProgress = response.progress || {};

                    // 為每個任務添加預設狀態
                    currentTasks.forEach(task => {
                        if (!currentTasksProgress[task.taskId]) {
                            currentTasksProgress[task.taskId] = {
                                status: 'not_started',
                                startTime: null,
                                completeTime: null
                            };
                        }
                    });
                } else {
                    // 使用預設狀態
                    currentTasksProgress = {};
                    currentTasks.forEach(task => {
                        currentTasksProgress[task.taskId] = { status: 'not_started' };
                    });
                }

                // 任務完成後觸發自動難度調整（只在狀態變為 completed 時觸發一次）
                currentTasks.forEach(task => {
                    const newProgress = currentTasksProgress[task.taskId];
                    const prevStatus = previousTasksProgress && previousTasksProgress[task.taskId]
                        ? previousTasksProgress[task.taskId].status
                        : null;
                    if (newProgress && newProgress.status === 'completed' && prevStatus !== 'completed') {
                        autoAdjustDifficulty(task, newProgress);
                    }
                });

                // 返回以繼續 Promise 鏈
                return true;
            })
            .catch(function(error) {
                APP_CONFIG.error('載入任務進度失敗', error);
                // 使用預設狀態並繼續
                currentTasksProgress = {};
                currentTasks.forEach(task => {
                    currentTasksProgress[task.taskId] = { status: 'not_started' };
                });
                return true;
            });
    }

    /**
     * 顯示等待畫面（階段 2：等待老師開始上課）
     */
    function displayWaitingScreen() {
        // 隱藏所有區塊
        document.getElementById('classSelection').classList.remove('active');
        document.getElementById('tierSelection').classList.remove('active');
        document.getElementById('questBoard').classList.remove('active');

        // 顯示等待訊息
        const questBoard = document.getElementById('questBoard');
        questBoard.classList.add('active');

        const questList = document.getElementById('questList');
        const emptyState = document.getElementById('noQuestState');

        if (questList) questList.style.display = 'none';
        if (emptyState) {
            emptyState.style.display = 'block';
            emptyState.innerHTML = `
                <div style="text-align: center; padding: 60px 20px;">
                    <div style="font-size: 80px; margin-bottom: 20px;">⏰</div>
                    <h2 style="color: var(--primary-color); margin-bottom: 16px;">老師尚未開始上課</h2>
                    <p style="color: var(--text-medium); font-size: 16px; margin-bottom: 24px;">
                        請稍候，系統正在等待老師開始課堂...
                    </p>
                    <div style="display: inline-block; padding: 12px 24px; background: rgba(52, 152, 219, 0.1); border-radius: 8px; color: var(--primary-color); font-weight: 600;">
                        自動檢查中...
                    </div>
                </div>
            `;
        }

        // 更新課程資訊
        document.getElementById('courseNameQuest').textContent = selectedCourse.courseName || '課程名稱';
        document.getElementById('courseDescriptionQuest').textContent = selectedCourse.description || '暫無說明';

        // 更新標題
        const tierInfo = courseTiers.find(t => t.tier === selectedTier);
        if (tierInfo) {
            document.getElementById('tierTitle').textContent = `${tierInfo.icon} ${selectedTier} 任務`;
        }

        // 啟動定期檢查 session 狀態（每 5 秒）
        startSessionCheck();
    }

    /**
     * 啟動 session 狀態檢查（階段 2）
     */
    function startSessionCheck() {
        // 清除舊的計時器
        if (sessionCheckInterval) {
            clearInterval(sessionCheckInterval);
        }

        // 重置偵測不到課堂的計數，避免短暫斷線就觸發結束流程
        consecutiveInactiveSessionCount = 0;

        sessionCheckInterval = setInterval(function() {
            if (!selectedClass || !selectedClass.classId) {
                stopSessionCheck();
                return;
            }

            const checkParams = new URLSearchParams({
                action: 'getCurrentSession',
                classId: selectedClass.classId,
                userEmail: currentStudent.email
            });

            APP_CONFIG.log('🔄 自動檢查課堂狀態...');

            fetch(`${APP_CONFIG.API_URL}?${checkParams.toString()}`)
                .then(response => response.json())
                .then(function(sessionResponse) {
                    if (sessionResponse.success && sessionResponse.isActive) {
                        // 老師開始上課了！
                        APP_CONFIG.log('✅ 老師已開始上課，載入任務');
                        stopSessionCheck();
                        showToast('✅ 老師已開始上課！', 'success');

                        // 性能優化：顯示 loading 避免用戶誤以為當機（載入任務資料需要時間）
                        showLoading('mainLoading');

                        loadTasksData();
                    }
                })
                .catch(function(error) {
                    APP_CONFIG.error('檢查課堂狀態失敗', error);
                });
        }, 5000); // 每 5 秒檢查一次

        APP_CONFIG.log('⏱️ 啟動 session 狀態檢查（每 5 秒）');
    }

    /**
     * 停止 session 狀態檢查（階段 2）
     */
    function stopSessionCheck() {
        if (sessionCheckInterval) {
            clearInterval(sessionCheckInterval);
            sessionCheckInterval = null;
            APP_CONFIG.log('⏸️ 停止 session 狀態檢查');
        }
    }

    /**
     * 啟動任務狀態檢查（檢查待審核任務是否被退回）
     */
    function startTaskStatusCheck() {
        // 清除舊的計時器
        if (taskStatusCheckInterval) {
            clearInterval(taskStatusCheckInterval);
        }

        // 找出所有待審核的任務
        const pendingTasks = Object.entries(currentTasksProgress).filter(
            ([taskId, progress]) => progress.status === 'pending_review'
        );

        if (pendingTasks.length === 0) {
            return; // 沒有待審核任務，不需要檢查
        }

        APP_CONFIG.log('⏱️ 啟動任務狀態檢查（每 15 秒）');

        taskStatusCheckInterval = setInterval(function() {
            if (!learningRecord || !learningRecord.recordId) {
                stopTaskStatusCheck();
                return;
            }

            const params = new URLSearchParams({
                action: 'getTaskProgress',
                recordId: learningRecord.recordId
            });

            fetch(`${APP_CONFIG.API_URL}?${params.toString()}`)
                .then(response => response.json())
                .then(function(response) {
                    if (response.success && response.progress) {
                        let hasRejected = false;
                        let hasApproved = false;

                        // 檢查是否有任務被退回或通過
                        Object.entries(response.progress).forEach(([taskId, progress]) => {
                            const oldStatus = currentTasksProgress[taskId]?.status;

                            // 退回：pending_review → in_progress
                            if (oldStatus === 'pending_review' && progress.status === 'in_progress') {
                                hasRejected = true;
                                APP_CONFIG.log('❌ 任務被退回:', taskId);
                            }

                            // 通過：pending_review → completed
                            if (oldStatus === 'pending_review' && progress.status === 'completed') {
                                hasApproved = true;
                                APP_CONFIG.log('✅ 任務已通過:', taskId);
                            }
                        });

                        if (hasRejected || hasApproved) {
                            // 停止檢查
                            stopTaskStatusCheck();

                            // 顯示通知
                            if (hasApproved) {
                                showToast('🎉 任務已通過審核！', 'success');
                            } else if (hasRejected) {
                                showToast('📝 教師已退回任務，請重新完成', 'warning');
                            }

                            // 重新載入任務列表
                            setTimeout(() => {
                                loadTierTasks();
                            }, 1500);
                        }
                    }
                })
                .catch(function(error) {
                    APP_CONFIG.error('檢查任務狀態失敗', error);
                });
        }, 15000); // 每 15 秒檢查一次
    }

    /**
     * 停止任務狀態檢查
     */
    function stopTaskStatusCheck() {
        if (taskStatusCheckInterval) {
            clearInterval(taskStatusCheckInterval);
            taskStatusCheckInterval = null;
            APP_CONFIG.log('⏸️ 停止任務狀態檢查');
        }
    }

    /**
     * 檢查是否所有任務都已完成
     */
    let hasShownCompletionModal = false; // 防止重複顯示

    function checkAllTasksCompleted() {
        // 如果已經顯示過，不再重複顯示
        if (hasShownCompletionModal) return;

        // 檢查是否有任務
        if (currentTasks.length === 0) return;

        // 檢查是否所有任務都已完成
        const allCompleted = currentTasks.every(task => {
            const progress = currentTasksProgress[task.taskId] || { status: 'not_started' };
            return progress.status === 'completed';
        });

        if (allCompleted) {
            hasShownCompletionModal = true;
            showCompletionModal();
        }
    }

    /**
     * 顯示完成祝賀 Modal
     */
    function showCompletionModal() {
        const tierName = selectedTier === 'tutorial' ? '基礎層' :
                        selectedTier === 'adventure' ? '挑戰層' :
                        selectedTier === 'hardcore' ? '困難層' : selectedTier;

        const modalHtml = `
            <div id="completionModal" style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.7);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
            ">
                <div style="
                    background: white;
                    padding: 40px;
                    border-radius: 20px;
                    box-shadow: 0 10px 50px rgba(0, 0, 0, 0.3);
                    max-width: 500px;
                    text-align: center;
                ">
                    <div style="font-size: 72px; margin-bottom: 20px;">🎉</div>
                    <h2 style="font-size: 28px; color: #10b981; margin-bottom: 16px; font-weight: 700;">
                        恭喜完成所有任務！
                    </h2>
                    <p style="font-size: 18px; color: #64748b; margin-bottom: 32px;">
                        您已完成 <strong style="color: #3498db;">${tierName}</strong> 的所有任務
                    </p>
                    <div style="display: flex; gap: 16px; justify-content: center;">
                        <button onclick="closeCompletionModal()" style="
                            padding: 14px 28px;
                            background: #3498db;
                            color: white;
                            border: none;
                            border-radius: 8px;
                            font-size: 16px;
                            font-weight: 600;
                            cursor: pointer;
                            transition: all 0.2s;
                        " onmouseover="this.style.background='#2980b9'" onmouseout="this.style.background='#3498db'">
                            📚 查看教材
                        </button>
                        <button onclick="handleLogout()" style="
                            padding: 14px 28px;
                            background: #64748b;
                            color: white;
                            border: none;
                            border-radius: 8px;
                            font-size: 16px;
                            font-weight: 600;
                            cursor: pointer;
                            transition: all 0.2s;
                        " onmouseover="this.style.background='#475569'" onmouseout="this.style.background='#64748b'">
                            🚪 登出
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    /**
     * 關閉完成 Modal
     */
    window.closeCompletionModal = function() {
        const modal = document.getElementById('completionModal');
        if (modal) {
            modal.remove();
        }
    };

    /**
     * 登出功能
     */
    window.handleLogout = function() {
        if (confirm('確定要登出嗎？')) {
            // 清除所有狀態
            currentStudent = null;
            selectedClass = null;
            selectedCourse = null;
            selectedTier = null;
            learningRecord = null;
            currentTasks = [];
            currentTasksProgress = {};
            hasShownCompletionModal = false;

            // 停止所有計時器
            stopSessionCheck();
            stopTaskStatusCheck();
            stopTaskTimeLimitCheck();

            // 清除本地存儲（如果有使用）
            if (typeof localStorage !== 'undefined') {
                localStorage.removeItem('currentStudent');
            }

            // 關閉 Modal
            closeCompletionModal();

            // 顯示登入畫面
            showToast('已登出', 'success');
            setTimeout(() => {
                location.reload(); // 重新載入頁面，回到登入狀態
            }, 500);
        }
    };

    /**
     * 啟動課堂進行中檢測（階段 2：檢測課堂結束）
     */
    function startActiveSessionCheck() {
        // 清除舊的計時器
        if (sessionCheckInterval) {
            clearInterval(sessionCheckInterval);
        }

        sessionCheckInterval = setInterval(function() {
            if (!selectedClass || !selectedClass.classId) {
                stopSessionCheck();
                return;
            }

            const checkParams = new URLSearchParams({
                action: 'getCurrentSession',
                classId: selectedClass.classId,
                userEmail: currentStudent.email
            });

            APP_CONFIG.log('🔄 檢查課堂狀態（進行中）...');

            fetch(`${APP_CONFIG.API_URL}?${checkParams.toString()}`)
                .then(response => response.json())
                .then(function(sessionResponse) {
                    if (sessionResponse.success && sessionResponse.isActive) {
                        // 課堂正常，重置計數
                        consecutiveInactiveSessionCount = 0;
                        return;
                    }

                    // 成功但課堂不在進行中：連續計數 +1（避免瞬斷誤判）
                    consecutiveInactiveSessionCount += 1;
                    APP_CONFIG.log('⚠️ 未偵測到課堂，連續次數:', consecutiveInactiveSessionCount, sessionResponse);

                    // 連續 3 次（約 30 秒）都偵測不到，才進入結束/等待流程
                    if (consecutiveInactiveSessionCount >= 3) {
                        stopSessionCheck();
                        const msg = sessionResponse.notMember
                            ? '系統偵測您不在此班級，請重新選班或聯繫老師'
                            : '暫時偵測不到課堂，請稍後重試或請老師重新開始課堂';
                        showToast(msg, 'warning');

                        // 回到等待畫面繼續自動檢查，不直接登出
                        displayCourseWaitingScreen();
                    }
                })
                .catch(function(error) {
                    APP_CONFIG.error('檢查課堂狀態失敗', error);
                });
        }, 10000); // 每 10 秒檢查一次

        APP_CONFIG.log('⏱️ 啟動課堂進行中檢測（每 10 秒）');
    }

    /**
     * 顯示課堂結束畫面（階段 2：自動登出並返回首頁）
     */
    function displayClassEndedScreen() {
        const questList = document.getElementById('questList');
        const emptyState = document.getElementById('noQuestState');

        if (questList) questList.style.display = 'none';
        if (emptyState) {
            emptyState.style.display = 'block';
            emptyState.innerHTML = `
                <div style="text-align: center; padding: 60px 20px;">
                    <div style="font-size: 80px; margin-bottom: 20px; animation: bounce 1s;">🏁</div>
                    <h2 style="color: var(--game-success); margin-bottom: 16px; font-size: 32px; font-weight: 700;">課堂已結束</h2>
                    <p style="color: var(--text-medium); font-size: 16px; margin-bottom: 32px; line-height: 1.6;">
                        感謝您參與本次課堂<br>
                        系統將在 5 秒後自動登出並返回首頁
                    </p>
                    <div style="display: inline-block; padding: 12px 24px; background: rgba(16, 185, 129, 0.1); border-radius: 8px; color: var(--game-success); font-weight: 600; font-size: 14px; margin-bottom: 24px;">
                        <span style="display: inline-block; width: 8px; height: 8px; background: var(--game-success); border-radius: 50%; margin-right: 8px; animation: pulse 2s infinite;"></span>
                        正在準備登出...
                    </div>
                    <p style="color: var(--text-light); font-size: 14px;">
                        <button onclick="logoutAndReturn()" style="padding: 8px 16px; background: var(--game-primary); color: white; border: none; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer;">
                            立即返回
                        </button>
                    </p>
                </div>
            `;
        }

        // 5 秒後自動登出並返回首頁
        setTimeout(function() {
            logoutAndReturn();
        }, 5000);
    }

    /**
     * 登出學生並返回首頁
     */
    window.logoutAndReturn = function() {
        APP_CONFIG.log('📤 正在登出...');
        
        // 清除 localStorage 中的用戶資料
        localStorage.removeItem('user');
        localStorage.removeItem('jwt');
        
        // 停止所有檢查計時器
        stopSessionCheck();
        stopTaskStatusCheck();
        stopTaskTimeLimitCheck();
        
        // 重定向回首頁
        window.location.href = 'index.html';
    };

    /**
     * 顯示任務面板（階段 2：啟動課堂結束檢測）
     */
    function displayQuestBoard() {
        // 停止舊的 session 檢查
        stopSessionCheck();

        document.getElementById('classSelection').classList.remove('active');
        document.getElementById('tierSelection').classList.remove('active');
        document.getElementById('questBoard').classList.add('active');

        // 更新課程資訊
        document.getElementById('courseNameQuest').textContent = selectedCourse.courseName || '課程名稱';
        document.getElementById('courseDescriptionQuest').textContent = selectedCourse.description || '暫無說明';

        // 更新進度
        updateProgress('progressBarFillQuest', 'progressTextQuest');

        // 更新標題
        const tierInfo = courseTiers.find(t => t.tier === selectedTier);
        if (tierInfo) {
            document.getElementById('tierTitle').textContent = `${tierInfo.icon} ${selectedTier} 任務`;
        }

        // 顯示任務列表
        displayQuestList();

        // 啟動課堂結束檢測（階段 2）
        startActiveSessionCheck();
    }

    /**
     * 顯示任務列表（帶逐個解鎖邏輯）
     */
    function displayQuestList() {
        const container = document.getElementById('questList');
        const emptyState = document.getElementById('noQuestState');

        if (!container) return;

        if (currentTasks.length === 0) {
            container.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }

        container.style.display = 'flex';
        emptyState.style.display = 'none';
        container.innerHTML = '';

        // 找出最後一個完成的任務索引（pending_review 視為未完成）
        let lastCompletedIndex = -1;
        for (let i = 0; i < currentTasks.length; i++) {
            const task = currentTasks[i];
            // ✅ 防禦性檢查：跳過 null 或 undefined 的任務
            if (!task || !task.taskId) {
                APP_CONFIG.error('發現無效任務', { index: i, task });
                continue;
            }
            const progress = currentTasksProgress[task.taskId] || { status: 'not_started' };
            if (progress.status === 'completed') {
                lastCompletedIndex = i;
            }
        }

        // 渲染任務卡片
        currentTasks.forEach((task, index) => {
            // ✅ 防禦性檢查：跳過 null 或 undefined 的任務
            if (!task || !task.taskId) {
                APP_CONFIG.error('發現無效任務（渲染時）', { index, task });
                return;
            }

            const progress = currentTasksProgress[task.taskId] || { status: 'not_started' };

            // 逐個解鎖邏輯：只有當前一個任務完成後，才能開始下一個任務
            const isLocked = index > 0 && lastCompletedIndex < index - 1;

            const card = createQuestCard(task, progress, index + 1, isLocked);
            container.appendChild(card);
        });

        // 檢查是否所有任務都已完成
        checkAllTasksCompleted();

        // 啟動任務狀態檢查（檢查是否有任務被退回）
        startTaskStatusCheck();
    }

    /**
     * 建立任務卡片
     */
    function createQuestCard(task, progress, sequence, isLocked) {
        const card = document.createElement('div');
        card.className = 'quest-item';

        if (isLocked) {
            card.classList.add('locked');
        } else if (progress.status === 'completed') {
            card.classList.add('completed');
        }

        // 任務圖示和類型
        let taskIcon = '📝';
        let taskTypeName = '教學';
        let taskTypeBadge = 'badge-tutorial';

        if (task.type === 'practice') {
            taskIcon = '✏️';
            taskTypeName = '練習';
            taskTypeBadge = 'badge-practice';
        } else if (task.type === 'assessment') {
            taskIcon = '📊';
            taskTypeName = '評量';
            taskTypeBadge = 'badge-assessment';
        }

        // 狀態顯示
        let statusBadge = '';
        let statusClass = '';

        if (isLocked) {
            statusBadge = '🔒 鎖定';
            statusClass = 'status-locked';
        } else if (progress.status === 'completed') {
            statusBadge = '✅ 已完成';
            statusClass = 'status-completed';
        } else if (progress.status === 'self_checking') {
            statusBadge = '⏱️ 檢核中';
            statusClass = 'self-checking';
        } else if (progress.status === 'uploading') {
            statusBadge = '📤 上傳中';
            statusClass = 'uploading';
        } else if (progress.status === 'assessment') {
            statusBadge = '📝 評量中';
            statusClass = 'assessment';
        } else if (progress.status === 'in_progress') {
            statusBadge = '⏳ 進行中';
            statusClass = 'status-in-progress';
        } else {
            statusBadge = '⭕ 未開始';
            statusClass = 'status-not-started';
        }

        card.innerHTML = `
            <div class="quest-number">${sequence}</div>
            <div class="quest-icon">${taskIcon}</div>
            <div class="quest-content">
                <div class="quest-header-row">
                    <div class="quest-name">${escapeHtml(task.name)}</div>
                    <span class="quest-type-badge ${taskTypeBadge}">${taskTypeName}</span>
                </div>
            </div>
            <div class="quest-status">
                <span class="status-badge ${statusClass}">${statusBadge}</span>
                <div class="token-reward">💰 ${task.tokenReward || 0}</div>
            </div>
        `;

        if (!isLocked) {
            card.onclick = () => openTaskModal(task, progress);
        }

        return card;
    }

    /**
     * 更新進度顯示
     */
    function updateProgress(barId, textId) {
        if (!learningRecord) return;

        const completedTasks = learningRecord.completedTasks || 0;
        const totalTasks = learningRecord.totalTasks || 0;
        const progress = totalTasks > 0 ? (completedTasks / totalTasks * 100) : 0;

        const barElement = document.getElementById(barId);
        const textElement = document.getElementById(textId);

        if (barElement) {
            barElement.style.width = progress + '%';
        }

        if (textElement) {
            textElement.textContent = `${completedTasks} / ${totalTasks}`;
        }
    }

    // ==========================================
    // 難度相關工具與自動調整
    // ==========================================
    function normalizeTierId(tier) {
        const map = {
            '基礎層': 'tutorial',
            '進階層': 'adventure',
            '精通層': 'hardcore',
            '困難層': 'hardcore',
            '挑戰層': 'adventure',
            '困難層': 'hardcore'
        };
        return map[tier] || tier || 'tutorial';
    }

    function displayTierName(tierId) {
        const map = {
            tutorial: '基礎層',
            adventure: '進階層',
            hardcore: '困難層'
        };
        return map[tierId] || tierId;
    }

    /**
     * 自動難度調整（任務完成後觸發一次）
     * - 升級：executionTime < timeLimit * 0.5
     * - 降級：executionTime > timeLimit * 1.5
     * - 無 timeLimit：跳過
     */
    function autoAdjustDifficulty(task, progress) {
        if (!task || !progress) return;

        const recordTierValue = learningRecord ? (learningRecord.currentTier || learningRecord.current_tier) : null;
        const currentTierId = normalizeTierId(selectedTier || recordTierValue || 'tutorial');
        const timeLimit = Number(task.timeLimit) || 0;
        if (timeLimit <= 0) {
            APP_CONFIG.log('⏭️ 跳過自動調整（timeLimit 不可用）', { taskId: task.taskId });
            return;
        }

        let executionTime = 0;
        if (progress.executionTime !== undefined && progress.executionTime !== null && !isNaN(Number(progress.executionTime))) {
            executionTime = Number(progress.executionTime);
        } else if (progress.timeSpent !== undefined && progress.timeSpent !== null && !isNaN(Number(progress.timeSpent))) {
            executionTime = Number(progress.timeSpent);
        } else if (progress.startTime && progress.completeTime) {
            const start = new Date(progress.startTime).getTime();
            const end = new Date(progress.completeTime).getTime();
            if (!isNaN(start) && !isNaN(end) && end > start) {
                executionTime = Math.floor((end - start) / 1000);
            }
        }

        if (executionTime <= 0) {
            APP_CONFIG.log('⏭️ 跳過自動調整（executionTime 不可用）', { taskId: task.taskId });
            return;
        }

        const isFast = executionTime < timeLimit * 0.5;
        const isSlow = executionTime > timeLimit * 1.5;
        if (!isFast && !isSlow) return;

        let newTierId = currentTierId;
        if (isFast) {
            if (currentTierId === 'tutorial') newTierId = 'adventure';
            else if (currentTierId === 'adventure') newTierId = 'hardcore';
        } else if (isSlow) {
            if (currentTierId === 'hardcore') newTierId = 'adventure';
            else if (currentTierId === 'adventure') newTierId = 'tutorial';
        }

        if (newTierId === currentTierId) return;

        const oldTierName = displayTierName(currentTierId);
        const newTierName = displayTierName(newTierId);

        // 更新前端狀態
        selectedTier = newTierName;
        if (learningRecord) {
            learningRecord.current_tier = newTierId;
            learningRecord.currentTier = newTierId;
        }

        recordTierChange(currentTierId, newTierId, isFast ? 'auto_fast' : 'auto_slow', task.taskId, executionTime);
        showToast(`已自動切換難度：${oldTierName} → ${newTierName}`, 'info');
        APP_CONFIG.log('🎯 自動難度調整', { taskId: task.taskId, executionTime, timeLimit, from: currentTierId, to: newTierId });

        // 重新載入該難度的任務列表（不顯示 loading，使用緩存）
        loadTierTasks(true, true);
    }

    // ==========================================
    // 任務 Modal
    // ==========================================

/**
 * 開啟任務詳情 Modal (修正版：支援 Assessment 斷點續傳)
 */
window.openTaskModal = function(task, progress) {
   // 🔥 Debug: 印出傳入的 progress 物件
    console.log('🔍 [OpenModal] Task:', task.taskId, 'Progress:', progress);
   
    selectedTask = task; 
    const modal = document.getElementById('taskModal');
    if (!modal) return;

    // --- UI 渲染 (保持不變) ---
    const setText = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    };

    setText('modalTaskName', task.name || task.taskName);

    let taskTypeName = '教學';
    if (task.type === 'practice') taskTypeName = '練習';
    else if (task.type === 'assessment') taskTypeName = '評量';

    let displayTier = task.tier;
    if (task.tier === 'mixed') {
        displayTier = selectedTier || '混合';
    }

    setText('modalTaskType', taskTypeName);
    setText('modalTaskTier', displayTier);
    setText('modalTaskReward', `💰 ${task.tokenReward || 0} 代幣`);

    // ✅ 修復問題8：顯示 accuracy（如果任務已完成且有 accuracy 資料）
    const accuracySection = document.getElementById('modalAccuracySection');
    const accuracyText = document.getElementById('modalTaskAccuracy');
    if (progress && progress.status === 'completed' && progress.accuracy !== null && progress.accuracy !== undefined) {
        // 將小數轉換為百分比顯示
        const accuracyPercent = (progress.accuracy * 100).toFixed(0);
        setText('modalTaskAccuracy', `${accuracyPercent}%`);
        if (accuracySection) accuracySection.style.display = 'block';
    } else {
        if (accuracySection) accuracySection.style.display = 'none';
    }

    // 內容說明
    let taskContent = '';
    let taskLink = '';
    if (task.tier === 'mixed') {
        if (selectedTier === '基礎層' || selectedTier === 'tutorial') {
            taskContent = task.tutorialDesc;
            taskLink = task.tutorialLink;
        } else if (selectedTier === '進階層' || selectedTier === 'adventure') {
            taskContent = task.adventureDesc;
            taskLink = task.adventureLink;
        } else if (selectedTier === '精通層' || selectedTier === 'hardcore') {
            taskContent = task.hardcoreDesc;
            taskLink = task.hardcoreLink;
        }
    } else {
        taskContent = task.content;
        taskLink = task.link;
    }

    const contentSection = document.getElementById('modalContentSection');
    const contentText = document.getElementById('modalTaskContent');
    if (contentSection && contentText) {
        contentSection.style.display = 'block';
        contentText.textContent = taskContent || '暫無詳細說明';
    }

    // --- 按鈕狀態控制 ---
    const startBtn = document.getElementById('startTaskBtn');
    const completeBtn = document.getElementById('completeTaskBtn');
    const reopenBtn = document.getElementById('reopenMaterialBtn');
    
    if(startBtn) startBtn.style.display = 'none';
    if(completeBtn) completeBtn.style.display = 'none';
    if(reopenBtn) reopenBtn.style.display = 'none';

    const hasMaterialLink = taskLink && taskLink.trim() !== '';
    const currentStatus = progress ? progress.status : 'not_started';

    // ==========================================
    // 🔥 按鈕邏輯核心 🔥
    // ==========================================

    if (currentStatus === 'completed') {
        // [狀態 4: 已完成] - 不顯示任何操作按鈕
        if (hasMaterialLink) reopenBtn.style.display = 'inline-block';
        // ✅ 修復：已完成的任務不顯示任何提交按鈕
        // completeBtn 保持隱藏 (已在上方設為 none)

    } else if (currentStatus === 'assessment') {
        // [狀態 3: 評量中] - 重新開啟 task-execution.html（會自動恢復到評量階段）
        if (hasMaterialLink) reopenBtn.style.display = 'inline-block';

        if (completeBtn) {
            completeBtn.style.display = 'inline-block';
            completeBtn.textContent = '✍️ 繼續評量';
            completeBtn.className = 'btn btn-warning';
            completeBtn.disabled = false;
            completeBtn.onclick = function() {
                // ✅ 檢查 taskProgressId 是否存在
                if (!progress.taskProgressId) {
                    showToast('❌ 無法取得任務進度 ID，請重新整理頁面', 'error');
                    console.error('缺少 taskProgressId:', progress);
                    return;
                }

                closeTaskModal();

                const taskProgressId = progress.taskProgressId;
                console.log('✍️ 重新開啟任務執行視窗（評量階段）');
                openTaskExecutionWindow(taskProgressId, task.taskId, currentStudent.email);

                showToast('✅ 已重新開啟任務視窗，請繼續評量', 'success');
            };
        }

    } else if (currentStatus === 'self_checking') {
        // [狀態 2: 檢核中] - 重新開啟 task-execution.html（會自動恢復到檢核階段）
        if (hasMaterialLink) reopenBtn.style.display = 'inline-block';

        if (completeBtn) {
            completeBtn.style.display = 'inline-block';
            completeBtn.textContent = '📋 繼續自主檢查';
            completeBtn.className = 'btn btn-warning';
            completeBtn.disabled = false;
            completeBtn.onclick = function() {
                // ✅ 檢查 taskProgressId 是否存在
                if (!progress.taskProgressId) {
                    showToast('❌ 無法取得任務進度 ID，請重新整理頁面', 'error');
                    console.error('缺少 taskProgressId:', progress);
                    return;
                }

                closeTaskModal();

                const taskProgressId = progress.taskProgressId;
                console.log('📋 重新開啟任務執行視窗（檢核階段）');
                openTaskExecutionWindow(taskProgressId, task.taskId, currentStudent.email);

                showToast('✅ 已重新開啟任務視窗，請繼續檢核', 'success');
            };
        }

    } else if (currentStatus === 'uploading') {
        // [狀態 2.5: 上傳中] - 重新開啟 task-execution.html（會自動恢復到上傳階段）
        if (hasMaterialLink) reopenBtn.style.display = 'inline-block';

        if (completeBtn) {
            completeBtn.style.display = 'inline-block';
            completeBtn.textContent = '📤 繼續上傳作業';
            completeBtn.className = 'btn btn-warning';
            completeBtn.disabled = false;
            completeBtn.onclick = function() {
                // ✅ 檢查 taskProgressId 是否存在
                if (!progress.taskProgressId) {
                    showToast('❌ 無法取得任務進度 ID，請重新整理頁面', 'error');
                    console.error('缺少 taskProgressId:', progress);
                    return;
                }

                closeTaskModal();

                const taskProgressId = progress.taskProgressId;
                console.log('📤 重新開啟任務執行視窗（上傳階段）');
                openTaskExecutionWindow(taskProgressId, task.taskId, currentStudent.email);

                showToast('✅ 已重新開啟任務視窗，請繼續上傳', 'success');
            };
        }

    } else if (false) {
        // 以下程式碼已廢棄，保留以防需要參考
        if (completeBtn) {
            completeBtn.style.display = 'inline-block';
            completeBtn.textContent = '✍️ 繼續評量';
            completeBtn.className = 'btn btn-warning'; // 黃色
            completeBtn.disabled = false;

            // 🔥 修正：點擊後，先去後端抓題目，再開視窗
            completeBtn.onclick = function() {
                completeBtn.disabled = true;
                completeBtn.textContent = '載入題目中...';

                // 準備參數
                const params = new URLSearchParams({
                    action: 'getTaskQuestion', // 呼叫剛寫好的 API
                    taskId: task.taskId,
                    userEmail: currentStudent.email
                });

                fetch(`${APP_CONFIG.API_URL}?${params.toString()}`)
                    .then(r => r.json())
                    .then(data => {
                        completeBtn.disabled = false;
                        completeBtn.textContent = '✍️ 繼續評量';

                        if (data.success && data.question) {
                            // 初始化 currentCheckData (因為重新整理後可能空了)
                            if (!window.currentCheckData) window.currentCheckData = {};
                            
                            // 填入重要資訊
                            currentCheckData.progressId = progress.taskProgressId;
                            currentCheckData.taskId = task.taskId;
                            currentCheckData.question = data.question;
                            currentCheckData.scenario = data.scenarioType || 'A';

                            // 修復：移除舊的評量 Modal 邏輯，評量現在在 task-execution.html 中進行
                            // 關閉詳情，打開評量
                            closeTaskModal();

                            showToast('✅ 請在任務執行視窗中完成評量', 'info');

                            // 手動顯示 Modal (因為 loadAssessment 依賴它)（已移除）
                            // const selfCheckModal = document.getElementById('selfCheckModal');
                            // if(selfCheckModal) {
                            //     selfCheckModal.style.display = 'flex';
                            //     selfCheckModal.classList.add('active'); // 確保有 active class
                            // }

                            // 載入題目（已移除：使用 task-execution.html）
                            // loadAssessment(data.scenarioType, data.question);
                        } else {
                            showToast('無法載入題目，請稍後重試', 'error');
                        }
                    })
                    .catch(err => {
                        console.error(err);
                        completeBtn.disabled = false;
                        completeBtn.textContent = '✍️ 繼續評量';
                        showToast('連線錯誤', 'error');
                    });
            };
        }

    } else if (false && currentStatus === 'self_checking') {
        // ❌ 已廢棄：此邏輯已移至上方統一處理
        // [狀態 2: 自主檢查中]
        if (hasMaterialLink) reopenBtn.style.display = 'inline-block';
        if (completeBtn) {
            completeBtn.style.display = 'inline-block';
            completeBtn.textContent = '📋 繼續自主檢查';
            completeBtn.className = 'btn btn-warning';
            completeBtn.disabled = false;
            completeBtn.onclick = function() {
                closeTaskModal();
                const pid = (progress && progress.taskProgressId) ? progress.taskProgressId : task.taskId;

                // 修復：移除舊的檢核面板調用，因為現在所有檢核和評量都在 task-execution.html 中進行
                // 初始化 currentCheckData
                // if (!window.currentCheckData) window.currentCheckData = {};
                // currentCheckData.progressId = pid;
                // currentCheckData.taskId = task.taskId;

                // showSelfCheckPanel(pid, task.taskId);  // 已移除：使用 task-execution.html 代替

                showToast('✅ 任務已提交！請在任務執行視窗中繼續', 'success');
            };
        }

    } else if (currentStatus === 'in_progress') {
        // [狀態 1: 進行中] - 顯示「繼續完成任務」按鈕，重新開啟 task-execution.html
        if (hasMaterialLink) reopenBtn.style.display = 'inline-block';
        if (completeBtn) {
            completeBtn.style.display = 'inline-block';
            completeBtn.textContent = '🔄 繼續完成任務';
            completeBtn.className = 'btn btn-warning'; // 使用警告色（橘色）強調這是繼續操作
            completeBtn.disabled = false;
            completeBtn.onclick = function() {
                // ✅ 檢查 taskProgressId 是否存在
                if (!progress.taskProgressId) {
                    showToast('❌ 無法取得任務進度 ID，請重新整理頁面', 'error');
                    console.error('缺少 taskProgressId:', progress);
                    return;
                }

                // 重新開啟任務執行視窗（會自動從 LocalStorage 恢復進度）
                closeTaskModal();

                const taskProgressId = progress.taskProgressId;
                console.log('🔄 重新開啟任務執行視窗');
                openTaskExecutionWindow(taskProgressId, task.taskId, currentStudent.email);

                showToast('✅ 已重新開啟任務視窗，請繼續完成', 'success');
            };
        }

    } else {
        // [狀態 0: 未開始]
        if (startBtn) {
            startBtn.style.display = 'inline-block';
            startBtn.disabled = false;
            startBtn.textContent = '開始任務';
            startBtn.onclick = handleStartTask;
        }
    }

    modal.classList.add('active');
};

    /**
     * 顯示「接續任務」Modal
     */
    function showResumeTaskModal(task, progress) {
        // 創建或取得接續任務 Modal
        let resumeModal = document.getElementById('resumeTaskModal');
        if (!resumeModal) {
            resumeModal = document.createElement('div');
            resumeModal.id = 'resumeTaskModal';
            resumeModal.className = 'modal';
            resumeModal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.7);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1000;
            `;
            document.body.appendChild(resumeModal);
        }

        // 計算累積時間
        const accumulatedTime = progress.timeSpent || 0; // 單位：秒
        const hours = Math.floor(accumulatedTime / 3600);
        const minutes = Math.floor((accumulatedTime % 3600) / 60);
        const seconds = accumulatedTime % 60;
        
        let timeStr = '';
        if (hours > 0) {
            timeStr = `${hours}小時 ${minutes}分 ${seconds}秒`;
        } else if (minutes > 0) {
            timeStr = `${minutes}分 ${seconds}秒`;
        } else {
            timeStr = `${seconds}秒`;
        }

        resumeModal.innerHTML = `
            <div style="background: white; border-radius: 16px; padding: 40px; max-width: 500px; text-align: center; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);">
                <div style="font-size: 60px; margin-bottom: 20px;">⚠️</div>
                <h2 style="color: var(--primary-color); font-size: 24px; font-weight: 700; margin-bottom: 16px;">上一次任務未完成</h2>
                <p style="color: var(--text-medium); font-size: 16px; margin-bottom: 24px; line-height: 1.8;">
                    <strong>${task.name}</strong><br>
                    已累積耗時: <span style="color: var(--game-accent); font-weight: 700; font-size: 18px;">${timeStr}</span><br>
                    請接續完成你的任務
                </p>
                <div style="display: flex; gap: 12px; justify-content: center;">
                    <button onclick="closeResumeTaskModal()" style="padding: 12px 24px; background: var(--text-light); color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer;">
                        取消
                    </button>
                    <button onclick="continueTask()" style="padding: 12px 24px; background: var(--game-primary); color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer;">
                        繼續任務
                    </button>
                </div>
            </div>
        `;

        resumeModal.style.display = 'flex';
    }

    /**
     * 關閉「接續任務」Modal
     */
    window.closeResumeTaskModal = function() {
        const resumeModal = document.getElementById('resumeTaskModal');
        if (resumeModal) {
            resumeModal.style.display = 'none';
        }
    };

    /**
     * 繼續任務（接續任務 Modal 中的確認按鈕）
     */
    window.continueTask = function() {
        if (!selectedTask) return;

        // 修復：檢查並確保有 classId
        if (!selectedClass || !selectedClass.classId) {
            showToast('無法取得班級資訊，請重新登入', 'error');
            APP_CONFIG.error('繼續任務失敗：缺少 selectedClass');
            return;
        }

        const params = new URLSearchParams({
            action: 'startTask',
            userEmail: currentStudent.email,
            taskId: selectedTask.taskId,
            classId: selectedClass.classId  // 修復：加入 classId
        });

        APP_CONFIG.log('📤 繼續任務...', { taskId: selectedTask.taskId, classId: selectedClass.classId });

        fetch(`${APP_CONFIG.API_URL}?${params.toString()}`)
            .then(response => response.json())
            .then(function(response) {
                APP_CONFIG.log('📥 繼續任務回應:', response);

                if (response.success) {
                    closeResumeTaskModal();
                    
                    // 直接進入任務（無需再點擊「開始任務」）
                    // 這裡可以打開任務連結或導向任務頁面
                    if (selectedTask.link && selectedTask.link.trim() !== '') {
                        window.open(selectedTask.link, '_blank');
                    }

                    // 重新載入進度
                    loadCourseTiersAndRecord();
                } else {
                    showToast(response.message || '繼續失敗', 'error');
                }
            })
            .catch(function(error) {
                APP_CONFIG.error('繼續任務失敗', error);
                showToast('繼續任務失敗：' + error.message, 'error');
            });
    };

    /**
     * 關閉任務 Modal
     */
    window.closeTaskModal = function() {
        const modal = document.getElementById('taskModal');
        if (modal) {
            modal.classList.remove('active');
        }

        // 停止时间限制检查
        stopTaskTimeLimitCheck();

        selectedTask = null;
    };

    /**
     * ✅ 修復問題7：暴露 loadTaskProgress 到全局作用域
     * 讓子視窗可以調用此函數刷新任務進度
     */
    window.loadTaskProgress = loadTaskProgress;

    /**
     * ✅ 修復問題7：暴露 displayQuestList 到全局作用域
     * 讓子視窗可以調用此函數更新任務列表顯示
     */
    window.displayQuestList = displayQuestList;

    /**
     * ✅ 修復問題7：暴露 selectedClass 到全局作用域
     * 讓子視窗可以獲取 recordId 來刷新任務進度
     * 注意：這是一個 getter，會返回當前的 selectedClass 值
     */
    Object.defineProperty(window, 'selectedClass', {
        get: function() {
            return selectedClass;
        },
        configurable: true
    });

    /**
     * ✅ 修復問題7：暴露 learningRecord 到全局作用域
     * 讓子視窗可以獲取 recordId 來刷新任務進度
     * 注意：這是一個 getter，會返回當前的 learningRecord 值
     */
    Object.defineProperty(window, 'learningRecord', {
        get: function() {
            return learningRecord;
        },
        configurable: true
    });

    /**
     * ✅ 修復問題6：開啟任務執行視窗（防止重複開啟）
     * @param {string} taskProgressId - 任務進度 ID
     * @param {string} taskId - 任務 ID
     * @param {string} userEmail - 用戶 email
     */
    function openTaskExecutionWindow(taskProgressId, taskId, userEmail) {
        // 檢查是否已經有開啟的視窗
        if (taskExecutionWindow && !taskExecutionWindow.closed) {
            // 視窗已存在，將焦點切換到該視窗
            taskExecutionWindow.focus();
            showToast('✅ 任務視窗已開啟，已切換至該視窗', 'info');
            return taskExecutionWindow;
        }

        // 建立視窗 URL
        const taskExecutionUrl = new URL('task-execution.html', window.location.href);
        taskExecutionUrl.searchParams.set('taskProgressId', taskProgressId);
        taskExecutionUrl.searchParams.set('taskId', taskId);
        taskExecutionUrl.searchParams.set('userEmail', userEmail);
        taskExecutionUrl.searchParams.set('apiUrl', APP_CONFIG.API_URL);

        // 開啟新視窗
        console.log('🔄 開啟任務執行視窗:', taskExecutionUrl.toString());
        taskExecutionWindow = window.open(taskExecutionUrl.toString(), '_blank', 'width=1400,height=900');

        // 監聽視窗關閉事件，清除引用
        if (taskExecutionWindow) {
            const checkClosed = setInterval(function() {
                if (taskExecutionWindow.closed) {
                    clearInterval(checkClosed);
                    taskExecutionWindow = null;
                    console.log('📪 任務視窗已關閉');
                }
            }, 1000);
        }

        return taskExecutionWindow;
    }

    /**
     * 重新打開任務教材
     */
    window.reopenTaskMaterial = function() {
        if (!selectedTask) {
            showToast('未選擇任務', 'warning');
            return;
        }

        // ✓ 修正：根據任務結構取得正確的連結
        let taskLink = '';

        if (selectedTask.tier === 'mixed') {
            // 舊結構：根據 selectedTier 選擇對應的連結
            if (selectedTier === 'tutorial' || selectedTier === '基礎層') {
                taskLink = selectedTask.tutorialLink || '';
            } else if (selectedTier === 'adventure' || selectedTier === '進階層') {
                taskLink = selectedTask.adventureLink || '';
            } else if (selectedTier === 'hardcore' || selectedTier === '精通層') {
                taskLink = selectedTask.hardcoreLink || '';
            }
        } else {
            // 新結構：直接使用 link
            taskLink = selectedTask.link || '';
        }

        if (!taskLink || taskLink.trim() === '') {
            showToast('此任務沒有教材連結', 'warning');
            return;
        }

        // 在新分頁打開教材
        window.open(taskLink, '_blank');
        showToast('已在新分頁打開教材', 'success');
    };

    /**
     * 記錄難度變更到後端
     */
    function recordTierChange(fromTier, toTier, reason, taskId, execTime) {
        console.log('📝 [記錄難度變更] 開始記錄:', { fromTier, toTier, reason, taskId, execTime });
        console.log('📝 [記錄難度變更] learningRecord:', learningRecord);
        console.log('📝 [記錄難度變更] selectedCourse:', selectedCourse);

        if (!learningRecord || !selectedCourse) {
            APP_CONFIG.log('⚠️ 無法記錄難度變更：缺少必要資訊');
            return;
        }

        const params = new URLSearchParams({
            action: 'recordDifficultyChange',
            userEmail: currentStudent.email,
            recordId: learningRecord.recordId,
            courseId: selectedCourse.courseId,
            fromTier: fromTier || '',
            toTier: toTier,
            changeReason: reason,  // manual/too_fast/too_slow/system_suggest
            triggeredByTask: taskId || '',
            executionTime: execTime || 0
        });

        APP_CONFIG.log('📤 記錄難度變更:', { fromTier, toTier, reason });
        console.log('📤 [API呼叫] URL:', `${APP_CONFIG.API_URL}?${params.toString()}`);

        fetch(`${APP_CONFIG.API_URL}?${params.toString()}`)
            .then(response => response.json())
            .then(function(response) {
                if (response.success) {
                    APP_CONFIG.log('✅ 難度變更已記錄:', response);
                    console.log('✅ [API回應] 成功:', response);
                } else {
                    APP_CONFIG.error('❌ 記錄難度變更失敗:', response.message);
                    console.error('❌ [API回應] 失敗:', response);
                }
            })
            .catch(function(error) {
                APP_CONFIG.error('記錄難度變更失敗', error);
            });
    }

    /**
     * 檢查並建議調整難度
     * @param {Object} task - 任务    /**
     * 檢查並建議調整難度（現改為自動執行，不彈窗）
     * @param {Object} task - 任務物件
     * @param {string} mode - fast/slow（保留參數）
     */
    function checkAndSuggestDifficultyChange(task, mode) {
        if (!learningRecord || !learningRecord.recordId) return;
        const progress = currentTasksProgress ? currentTasksProgress[task.taskId] : null;
        autoAdjustDifficulty(task, progress || {});
    }
function startTaskTimeLimitCheck(task) {
        // 清除旧的计时器
        stopTaskTimeLimitCheck();

        const timeLimit = task.timeLimit || 0;
        if (timeLimit <= 0 || selectedTier === 'tutorial') {
            return; // 没有时间限制或已经是最低难度，不检查
        }

        currentTaskStartTime = Date.now();
        hasShownSlowSuggestion = false;

        // 每5秒检查一次
        taskTimeLimitCheckInterval = setInterval(function() {
            const elapsed = Math.floor((Date.now() - currentTaskStartTime) / 1000);

            // 超过 150% 限时时间，建议降低难度
            if (elapsed > timeLimit * 1.5 && !hasShownSlowSuggestion) {
                hasShownSlowSuggestion = true;
                stopTaskTimeLimitCheck();

                let suggestion = null;
                let newTier = null;

                if (selectedTier === 'hardcore') {
                    suggestion = '⏰ 您花費的時間較長，是否要降低難度？\n這樣可以讓學習更輕鬆。';
                    newTier = 'adventure';
                } else if (selectedTier === 'adventure') {
                    suggestion = '⏰ 您花費的時間較長，是否要降低難度？\n這樣可以讓學習更輕鬆。';
                    newTier = 'tutorial';
                }

                if (suggestion && newTier) {
                    if (confirm(suggestion)) {
                        const tierMap = {
                            'tutorial': '基礎層',
                            'adventure': '挑戰層',
                            'hardcore': '困難層'
                        };
                        showToast(`已切換到 ${tierMap[newTier]}`, 'success');

                        // 記錄難度變更（太慢）
                        const oldTier = selectedTier;
                        selectedTier = newTier;
                        recordTierChange(oldTier, newTier, 'too_slow', task.taskId, elapsed);

                        // 关闭当前 modal
                        closeTaskModal();

                        // 重新加载任务列表
                        loadTierTasks();
                    }
                }
            }
        }, 5000); // 每5秒检查一次

        APP_CONFIG.log('⏱️ 啟動任務時間限制檢查');
    }

    /**
     * 停止任务时间限制检查
     */
    function stopTaskTimeLimitCheck() {
        if (taskTimeLimitCheckInterval) {
            clearInterval(taskTimeLimitCheckInterval);
            taskTimeLimitCheckInterval = null;
            currentTaskStartTime = null;
            hasShownSlowSuggestion = false;
            APP_CONFIG.log('⏸️ 停止任務時間限制檢查');
        }
    }

    // ==========================================
    // 處理任務操作
    // ==========================================
      /**
       * 開始任務（已優化：移除多餘的課堂狀態檢查）
       * 理由：背景每5秒自動檢查課堂狀態，且後端 startTask 會再次驗證
       */
      window.handleStartTask = function() {
          if (!selectedTask) return;

          const startBtn = document.getElementById('startTaskBtn');
          const reopenBtn = document.getElementById('reopenMaterialBtn');
          const completeBtn = document.getElementById('completeTaskBtn');

          // UI 鎖定
          if (startBtn) {
              startBtn.disabled = true;
              startBtn.textContent = '開始中...';
          }

          // 檢查班級資訊
          if (!selectedClass || !selectedClass.classId) {
              if (startBtn) {
                  startBtn.disabled = false;
                  startBtn.textContent = '開始任務';
              }
              showToast('無法取得班級資訊', 'error');
              return;
          }

          // 直接開始任務（已移除重複的課堂狀態檢查）
          const params = new URLSearchParams({
              action: 'startTask',
              userEmail: currentStudent.email,
              taskId: selectedTask.taskId,
              classId: selectedClass.classId
          });

          APP_CONFIG.log('📤 開始任務...', { taskId: selectedTask.taskId, classId: selectedClass.classId });

          fetch(`${APP_CONFIG.API_URL}?${params.toString()}`)
              .then(response => response.json())
              .then(function(response) {
                  APP_CONFIG.log('📥 開始任務回應:', response);

                  if (response.success) {
                      showToast('✅ 任務已開始！', 'success');

                      // 更新前端狀態
                      const taskProgressId = response.taskProgressId;
                      if (currentTasksProgress) {
                          currentTasksProgress[selectedTask.taskId] = {
                              status: 'in_progress',
                              taskProgressId: taskProgressId  // ✅ 保存 taskProgressId
                          };
                      }

                      // UI 按鈕切換
                      if (startBtn) startBtn.style.display = 'none';
                      if (reopenBtn) reopenBtn.style.display = 'inline-block';

                      // ✅ 修復：將 completeBtn 改為「繼續完成任務」
                      if (completeBtn) {
                          completeBtn.style.display = 'inline-block';
                          completeBtn.textContent = '🔄 繼續完成任務';
                          completeBtn.className = 'btn btn-warning';
                          completeBtn.onclick = function() {
                              // ✅ 修復問題5：在 closeTaskModal 之前先取得 taskId（避免 selectedTask 被設為 null）
                              const capturedTaskId = selectedTask.taskId;
                              const capturedUserEmail = currentStudent.email;

                              closeTaskModal();

                              console.log('🔄 重新開啟任務執行視窗');
                              openTaskExecutionWindow(taskProgressId, capturedTaskId, capturedUserEmail);

                              showToast('✅ 已重新開啟任務視窗，請繼續完成', 'success');
                          };
                      }

                      // 打開任務執行視窗
                      openTaskExecutionWindow(taskProgressId, selectedTask.taskId, currentStudent.email);

                      if (typeof displayQuestList === 'function') {
                          displayQuestList();
                      }

                  } else {
                      if (startBtn) {
                          startBtn.disabled = false;
                          startBtn.textContent = '開始任務';
                      }
                      showToast(response.message || '開始失敗', 'error');
                  }
              })
              .catch(function(error) {
                  if (startBtn) {
                      startBtn.disabled = false;
                      startBtn.textContent = '開始任務';
                  }
                  console.error(error);
                  showToast('操作失敗：' + error.message, 'error');
              });
      };

    /**
    * 提交任務：智慧判斷下一步 + 同步前端狀態
    */
   window.handleCompleteTask = function() {
       if (!selectedTask) return;
   
       const taskToSubmit = selectedTask;
   
       if (!confirm('確定要提交此任務嗎？')) {
           return;
       }
   
       const completeBtn = document.getElementById('completeTaskBtn');
       
       if (completeBtn) {
           completeBtn.disabled = true;
           completeBtn.textContent = '處理中...';
       }
   
       // [已過時] submitTask 已被 submitTaskExecution 取代
       // 新的任務執行流程在 task-execution.html 中完成
       /*
       const params = new URLSearchParams({
           action: 'submitTask',
           userEmail: currentStudent.email,
           taskId: taskToSubmit.taskId,
           classId: selectedClass.classId
       });
       */

       // 如果此按鈕被觸發，顯示提示訊息
       showToast('此功能已過時，請使用任務執行視窗完成任務', 'warning');
       if (completeBtn) {
           completeBtn.disabled = false;
           completeBtn.textContent = '提交完成';
       }
       return;
   
       APP_CONFIG.log('📤 提交任務...', { taskId: taskToSubmit.taskId });
   
       fetchWithRetry(`${APP_CONFIG.API_URL}?${params.toString()}`, 3)
           .then(response => response.json())
           .then(function(response) {

              console.log('📥 [Response]', response);

               // 🔥🔥🔥 顯示後端傳回來的診斷報告 🔥🔥🔥
               if (response.debugLogs && response.debugLogs.length > 0) {
                   console.group("🕵️‍♂️ 後端資料庫診斷報告 (Backend Logs)");
                   console.log("%c 這是後端在比對資料庫時看到的實際內容：", "color: #ff00de; font-weight: bold;");
                   
                   response.debugLogs.forEach(log => {
                       if (log.includes('Row')) {
                           console.log(`%c ${log}`, "color: #2b95ff;"); // 藍色顯示比對細節
                       } else if (log.includes('✅')) {
                           console.log(`%c ${log}`, "color: green; font-weight: bold;");
                       } else if (log.includes('❌')) {
                           console.log(`%c ${log}`, "color: red; font-weight: bold;");
                       } else {
                           console.log(log);
                       }
                   });
                   console.groupEnd();
               }
               
               if (completeBtn) {
                   completeBtn.disabled = false;
                   completeBtn.textContent = '提交完成';
               }
   
               APP_CONFIG.log('📥 提交回應:', response);
   
               if (response.success) {
                   // 停止時間限制檢查
                   if (typeof stopTaskTimeLimitCheck === 'function') stopTaskTimeLimitCheck();
                   
                   // 關閉任務詳情 Modal
                   closeTaskModal();
   
                   // 更新 CheckData 的基礎資訊
                   if (response.taskProgressId) {
                       // 初始化物件
                       if (!window.currentCheckData) window.currentCheckData = {};
                       currentCheckData.progressId = response.taskProgressId;
                       currentCheckData.taskId = taskToSubmit.taskId;
                   }
   
                   // ==========================================
                   // 🔥🔥🔥 關鍵修正：立刻同步前端狀態 🔥🔥🔥
                   // ==========================================
                   if (!window.currentTasksProgress) window.currentTasksProgress = {};
                   if (!window.currentTasksProgress[taskToSubmit.taskId]) {
                       window.currentTasksProgress[taskToSubmit.taskId] = {};
                   }
   
                   // 根據後端回傳的 nextStep，直接修改本地變數
                   const targetTaskProgress = window.currentTasksProgress[taskToSubmit.taskId];
                   
                   // 順便存入 ProgressID，這非常重要
                   if (response.taskProgressId) {
                       targetTaskProgress.taskProgressId = response.taskProgressId;
                   }
   
                   if (response.nextStep === 'checklist') {
                       targetTaskProgress.status = 'self_checking';
                   } else if (response.nextStep === 'assessment') {
                       targetTaskProgress.status = 'assessment';
                   } else if (response.nextStep === 'completed') {
                       targetTaskProgress.status = 'completed';
                   }
                   // ==========================================
   
                   // 修復：移除舊的檢核/評量 Modal 邏輯，因為現在都在 task-execution.html 中進行
                   // 核心路由邏輯
                   switch (response.nextStep) {
                       case 'checklist':
                           showToast('✅ 任務已提交！檢核和評量請在任務執行視窗中完成', 'success');
                           // showSelfCheckPanel(response.taskProgressId, taskToSubmit.taskId);  // 已移除
                           break;

                       case 'assessment':
                           showToast('✅ 任務已提交！評量請在任務執行視窗中完成', 'success');

                           // 手動顯示 Modal（已移除：使用 task-execution.html）
                           // const modal = document.getElementById('selfCheckModal');
                           // if(modal) {
                           //     modal.style.display = 'flex';
                           //     modal.classList.add('active');
                           // }

                           // 直接載入題目（已移除：使用 task-execution.html）
                           // if (window.loadAssessment) {
                           //      loadAssessment(response.scenarioType, response.question);
                           // }
                           break;
   
                       case 'completed':
                           const rewardMsg = response.tokenReward ? `獲得 ${response.tokenReward} 代幣` : '';
                           showToast(`🎉 任務完成！${rewardMsg}`, 'success');
                           
                           // 強制刷新列表 (雙重保險)
                           setTimeout(() => {
                               if (typeof loadTierTasks === 'function') loadTierTasks(true);
                               if (typeof displayQuestList === 'function') displayQuestList();
                           }, 500);
                           break;
                   }
   
                   // 嘗試刷新列表顯示 (讓卡片狀態變色)
                   if (typeof displayQuestList === 'function') displayQuestList();
   
               } else {
                   showToast(response.message || '提交失敗', 'error');
               }
           })
           .catch(function(error) {
               if (completeBtn) {
                   completeBtn.disabled = false;
                   completeBtn.textContent = '提交完成';
               }
               APP_CONFIG.error('提交任務失敗', error);
               showToast('提交失敗，請重試：' + error.message, 'error');
           });
   };

    // ==========================================
    // 工具函數
    // ==========================================

    /**
     * 帶重試機制的 fetch（解決 CORS 間歇性錯誤）
     */
    function fetchWithRetry(url, maxRetries = 3, delay = 1000) {
        return new Promise((resolve, reject) => {
            const attemptFetch = (retriesLeft) => {
                fetch(url)
                    .then(response => {
                        if (response.ok) {
                            resolve(response);
                        } else {
                            throw new Error(`HTTP ${response.status}`);
                        }
                    })
                    .catch(error => {
                        if (retriesLeft > 0) {
                            APP_CONFIG.log(`⚠️ 請求失敗，${delay}ms 後重試... (剩餘 ${retriesLeft} 次)`);
                            setTimeout(() => {
                                attemptFetch(retriesLeft - 1);
                            }, delay);
                        } else {
                            reject(error);
                        }
                    });
            };
            attemptFetch(maxRetries);
        });
    }

    /**
     * 顯示載入動畫（遮罩式）
     */
    function showLoading(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.classList.add('active');
        }
    }

    /**
     * 隱藏載入動畫（遮罩式）
     */
    function hideLoading(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.classList.remove('active');
        }
    }

    /**
     * HTML 轉義（防止 XSS）
     */
    function escapeHtml(text) {
        if (!text && text !== 0 && text !== false) return '';
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return String(text).replace(/[&<>"']/g, m => map[m]);
    }

    // 當離開頁面時停止所有計時器（階段 2）
    window.addEventListener('beforeunload', function() {
        stopSessionCheck();
    });

    /* ==============================================
    自主檢查與評量模組 (Redesigned)
    ============================================== */

    // 全域變數，暫存當前任務狀態
    let currentCheckData = {
        taskId: null,
        progressId: null,
        checklists: [],
        hasErrors: false, // 記錄是否有錯誤項目 (決定獎勵邏輯)
        question: null
    };

   /**
     * 顯示自主檢查面板
     */
    window.showSelfCheckPanel = function(taskProgressId, taskId) {
        APP_CONFIG.log('🎯 打開自主檢查面板', { taskProgressId, taskId });
        
        const modal = document.getElementById('selfCheckModal');
        if (!modal) return;

        // 重置介面狀態
        document.getElementById('checkStageContainer').style.display = 'block';
        document.getElementById('assessmentStageContainer').style.display = 'none';
        document.getElementById('finishCheckBtn').style.display = 'inline-block';
        document.getElementById('submitAssessmentBtn').style.display = 'none';
        document.getElementById('selfCheckTitle').textContent = '📋 自主檢查';

        // 儲存 ID
        currentCheckData.taskId = taskId;
        currentCheckData.progressId = taskProgressId;
        currentCheckData.hasErrors = false;

        // 呼叫後端取得資料
        const params = new URLSearchParams({
            action: 'getTaskChecklistsAndAnswer',
            taskId: taskId
        });

        fetch(`${APP_CONFIG.API_URL}?${params.toString()}`)
            .then(r => r.json())
            .then(data => {
                if (data.success) {
                    renderCheckStage(data);
                    modal.style.display = 'flex';
                } else {
                    showToast('無法獲取資料', 'error');
                }
            })
            .catch(err => {
                console.error(err);
                showToast('連線錯誤', 'error');
            });
    };


   /**
    * 渲染第一階段：參考資料與檢核列表 (修正版：預設不勾選)
    */
   function renderCheckStage(data) {
       // 1. 渲染參考文字
       const refDiv = document.getElementById('referenceDisplay');
       const textContent = escapeHtml(data.referenceAnswer || data.answerText || '無文字說明');
       
       let refHtml = `<div style="margin-bottom:20px;">${textContent}</div>`;
       
       // 2. 圖片處理
       let rawImages = data.referenceImages || data.answerImages;
       let imageList = [];
   
       if (Array.isArray(rawImages)) {
           imageList = rawImages;
       } else if (typeof rawImages === 'string' && rawImages.trim() !== '') {
           if (rawImages.includes('|')) imageList = rawImages.split('|');
           else imageList = [rawImages];
       }
   
       if (imageList.length > 0) {
           refHtml += `<div class="ref-images-wrapper">`;
           imageList.forEach(imgUrl => {
               let cleanUrl = imgUrl.trim();
               if (cleanUrl) {
                   refHtml += `
                       <div class="ref-image-container" onclick="openLightbox('${cleanUrl}')">
                           <img src="${cleanUrl}" class="ref-thumbnail" alt="點擊放大" 
                                onerror="this.parentElement.style.display='none'" />
                           <div style="text-align:center; color:#aaa; font-size:12px; padding:5px; background:#222;">
                               🔍 點擊圖片放大
                           </div>
                       </div>`;
               }
           });
           refHtml += `</div>`;
       }
   
       refDiv.innerHTML = refHtml;
   
       // 3. 渲染檢核列表 (🔥 重點修改區)
       const listDiv = document.getElementById('checklistDynamicContainer');
       listDiv.innerHTML = ''; 
       currentCheckData.checklists = data.checklists || [];
   
       // 初始化結果容器 (如果還沒有的話)
       if (!currentCheckData.results) {
           currentCheckData.results = {};
       }
   
       if (currentCheckData.checklists.length === 0) {
           listDiv.innerHTML = '<div style="padding:20px; text-align:center; color:#888;">無需檢核，請直接下一步</div>';
           return;
       }
   
       currentCheckData.checklists.forEach((item, index) => {
           // 🔥 檢查目前的狀態 (pass, fail, 或 undefined)
           const currentStatus = currentCheckData.results[index];
           
           // 動態決定誰要有顏色 (預設兩個都是空的)
           const passClass = currentStatus === 'pass' ? 'active' : '';
           const failClass = currentStatus === 'fail' ? 'active' : '';
           
           // 只有在 fail 時才顯示輸入框
           const showImprovement = currentStatus === 'fail' ? 'block' : 'none';
   
           const itemHtml = `
               <div class="check-item-card" id="checkItem_${index}">
                   <div class="check-item-header">
                       <div class="check-desc">
                           <span style="color:var(--game-accent); font-weight:bold; margin-right:5px;">${index + 1}.</span>
                           ${escapeHtml(item.itemTitle || item.description)}
                       </div>
                       <div class="status-toggle">
                           <button class="status-btn pass ${passClass}" onclick="toggleCheckStatus(${index}, 'pass')">✅ 符合</button>
                           <button class="status-btn fail ${failClass}" onclick="toggleCheckStatus(${index}, 'fail')">⚠️ 未符合</button>
                       </div>
                   </div>
                   <div class="improvement-box" id="improvementBox_${index}" style="display: ${showImprovement};">
                       <label style="font-size:12px; color:#ef4444; margin-bottom:4px; display:block;">錯誤原因 / 修正說明：</label>
                       <textarea class="improvement-input" id="improveInput_${index}" 
                           placeholder="請記錄哪裡與參考答案不符，以及您做了什麼修正..." rows="2"></textarea>
                   </div>
               </div>
           `;
           listDiv.insertAdjacentHTML('beforeend', itemHtml);
       });
   }
   
   // --- 圖片放大功能 ---
   
   window.openLightbox = function(url) {
       const lightbox = document.getElementById('imageLightbox');
       const img = document.getElementById('lightboxImage');
       if (lightbox && img) {
           img.src = url;
           lightbox.classList.add('active'); // 顯示燈箱
       }
   };
   
   window.closeLightbox = function() {
       const lightbox = document.getElementById('imageLightbox');
       if (lightbox) {
           lightbox.classList.remove('active'); // 隱藏燈箱
           setTimeout(() => {
               const img = document.getElementById('lightboxImage');
               if(img) img.src = ''; 
           }, 300);
       }
   };

    /** 切換檢核項目狀態 (包含資料更新與文字框顯示/隱藏)
    * @param {number} index - 項目索引
    * @param {string} status - 'pass' 或 'fail'
    */
   window.toggleCheckStatus = function(index, status) {
       const itemCard = document.getElementById(`checkItem_${index}`);
       const passBtn = itemCard.querySelector('.status-btn.pass');
       const failBtn = itemCard.querySelector('.status-btn.fail');
       const improvementBox = document.getElementById(`improvementBox_${index}`);
   
       if (!itemCard || !passBtn || !failBtn || !improvementBox) {
           console.error('Checklist element not found for index:', index);
           return;
       }
   
       // 1. 更新 UI 樣式
       if (status === 'pass') {
           passBtn.classList.add('active');
           failBtn.classList.remove('active');
           
           // 隱藏文字框 (選符合時，不需要填寫修正說明)
           improvementBox.style.display = 'none';
           
       } else if (status === 'fail') {
           failBtn.classList.add('active');
           passBtn.classList.remove('active');
           
           // 顯示文字框 (選未符合時，需要填寫修正說明)
           improvementBox.style.display = 'block';
       }
   
       // 2. 更新資料結構 (🔥 這是提交時用來驗證的關鍵！)
       if (!currentCheckData.results) {
           currentCheckData.results = {};
       }
       currentCheckData.results[index] = status;
   };

    /**
    * 提交自主檢查：驗證 + 路由 + 同步前端狀態
    */
   window.submitSelfCheck = function() {
       // 安全檢查
       if (!currentCheckData || !currentCheckData.checklists) {
           console.error('無檢查資料');
           return;
       }
   
       const total = currentCheckData.checklists.length;
       const submitBtn = document.getElementById('finishCheckBtn');
       
       // 準備資料
       const checklistData = [];
       let hasFail = false;
       let errorExplanation = "";
   
       // 驗證迴圈
       for (let i = 0; i < total; i++) {
           const status = currentCheckData.results ? currentCheckData.results[i] : null;
           
           if (!status) {
               showToast(`⚠️ 第 ${i + 1} 項尚未確認！請選擇符合或未符合。`, 'warning');
               const el = document.getElementById(`checkItem_${i}`);
               if (el) {
                   el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                   el.style.border = '2px solid #F59E0B';
                   setTimeout(() => el.style.border = '1px solid var(--game-border)', 1000);
               }
               return;
           }
   
           const isChecked = (status === 'pass');
           const item = currentCheckData.checklists[i];
           let reason = "";
   
           if (!isChecked) {
               hasFail = true;
               const input = document.getElementById(`improveInput_${i}`);
               reason = input ? input.value.trim() : "";
               
               if (!reason) {
                   showToast(`第 ${i + 1} 項標記為「未符合」，請填寫修正說明`, 'warning');
                   if(input) input.focus();
                   return;
               }
               if (errorExplanation) errorExplanation += " | ";
               errorExplanation += `[${item.itemTitle}]: ${reason}`;
           }
   
           checklistData.push({
               checklistId: item.checklistId,
               isChecked: isChecked
           });
       }
   
       if (submitBtn) {
           submitBtn.disabled = true;
           submitBtn.textContent = '處理中...';
       }
   
       const scenarioType = hasFail ? 'B' : 'A';
       
       const params = new URLSearchParams({
           action: 'submitSelfCheck', 
           taskProgressId: currentCheckData.progressId,
           userEmail: currentStudent.email,
           checklistData: JSON.stringify(checklistData),
           scenarioType: scenarioType,
           errorExplanation: errorExplanation
       });
   
       console.log('🚀 [Frontend] 提交自主檢查:', Object.fromEntries(params));
   
       fetch(`${APP_CONFIG.API_URL}?${params.toString()}`)
           .then(response => response.json())
           .then(data => {
               console.log('📥 [Frontend] 檢查回傳:', data);
   
               if (data.success) {
                   currentCheckData.scenario = data.scenarioType;
   
                   // ==========================================
                   // 🔥🔥🔥 關鍵修正：立刻同步前端狀態 🔥🔥🔥
                   // ==========================================
                   const taskId = currentCheckData.taskId;
                   if (taskId && window.currentTasksProgress && window.currentTasksProgress[taskId]) {
                       if (data.nextStep === 'assessment') {
                           window.currentTasksProgress[taskId].status = 'assessment';
                       } else if (data.nextStep === 'completed') {
                           window.currentTasksProgress[taskId].status = 'completed';
                       }
                   }
                   // ==========================================
   
                   // 路由判斷
                   if (data.nextStep === 'assessment') {
                       console.log('➡️ 進入評量階段');
                       
                       if (!data.question) {
                           showToast('系統錯誤：找不到題目資料', 'error');
                           return;
                       }
                       
                       currentCheckData.question = data.question; 
                       if (window.loadAssessment) {
                           loadAssessment(data.scenarioType, data.question);
                       }
   
                   } else if (data.nextStep === 'completed') {
                       console.log('🎉 任務完成');
                       
                       showToast(data.message || '🎉 檢查完成，任務結束！', 'success');
                       closeSelfCheckModal();
                       
                       // 強制刷新列表
                       setTimeout(() => {
                           if (typeof loadTierTasks === 'function') loadTierTasks(true);
                           if (typeof displayQuestList === 'function') displayQuestList();
                       }, 500);
                   }
   
               } else {
                   showToast(data.message || '提交失敗', 'error');
                   if (submitBtn) {
                       submitBtn.disabled = false;
                       submitBtn.textContent = '完成檢查，進入評量 →';
                   }
               }
           })
           .catch(error => {
               console.error('❌ [Frontend] 連線錯誤:', error);
               showToast('連線錯誤，請重試', 'error');
               if (submitBtn) {
                   submitBtn.disabled = false;
                   submitBtn.textContent = '完成檢查，進入評量 →';
               }
           });
   };
   
/**
 * 載入並顯示評量題目 (UI 強力切換修復版)
 */
window.loadAssessment = function(scenario, questionData) {
    console.log('🔄 [Frontend] 準備切換至評量畫面...', { scenario, questionData });

    // 1. 確保資料已儲存
    if (!window.currentCheckData) window.currentCheckData = {};
    currentCheckData.scenario = scenario;
    currentCheckData.question = questionData;

    // 2. 抓取 DOM 元素 (並檢查是否存在)
    const checkStage = document.getElementById('checkStageContainer');
    const assessmentStage = document.getElementById('assessmentStageContainer');
    const finishBtn = document.getElementById('finishCheckBtn');
    const submitBtn = document.getElementById('submitAssessmentBtn');
    const titleEl = document.getElementById('selfCheckTitle');
    const hintText = document.getElementById('assessmentHintText');
    const qTextEl = document.getElementById('assessmentQuestionText');
    const optionsEl = document.getElementById('assessmentOptionsContainer');

    // Debug: 檢查元素是否抓到了
    if (!checkStage) console.error('❌ 找不到 #checkStageContainer');
    if (!assessmentStage) console.error('❌ 找不到 #assessmentStageContainer');

    // ==========================================
    // 🔥 3. 暴力切換顯示狀態 (使用 setAttribute 強制覆蓋)
    // ==========================================
    
    // 強制隱藏檢查表
    if (checkStage) {
        checkStage.style.display = 'none'; // 先試一般方法
        checkStage.setAttribute('style', 'display: none !important'); // 再試暴力方法
    }
    
    if (finishBtn) finishBtn.style.display = 'none';

    // 強制顯示評量表
    if (assessmentStage) {
        assessmentStage.style.display = 'block';
        assessmentStage.setAttribute('style', 'display: block !important');
    }
    
    if (submitBtn) {
        submitBtn.style.display = 'inline-block';
        submitBtn.disabled = false;
        submitBtn.textContent = '提交答案';
    }

    // 更新標題
    if (titleEl) titleEl.textContent = '🧠 隨堂評量';

    // 4. 設定提示文字
    if (hintText) {
        if (scenario === 'B') {
            hintText.innerHTML = `<div class="alert alert-warning" style="margin-bottom:15px;">💪 剛才雖然有小錯誤，但修正後就是學習！請回答下列問題。</div>`;
        } else {
            hintText.innerHTML = `<div class="alert alert-success" style="margin-bottom:15px;">🎉 任務執行完美！請回答最後一個問題來領取獎勵。</div>`;
        }
    }

    // 5. 渲染題目與選項
    if (questionData) {
        if (qTextEl) qTextEl.textContent = questionData.questionText;
        
        if (optionsEl) {
            optionsEl.innerHTML = ''; // 清空舊選項
            const options = questionData.options || [];
            
            options.forEach((opt, idx) => {
                const btn = document.createElement('div');
                // 為了避免 CSS class 遺失，直接寫入 inline style 確保樣式
                btn.className = 'assessment-option-btn';
                btn.textContent = opt;
                btn.style.cssText = "padding: 12px; margin: 8px 0; border: 1px solid #ccc; border-radius: 8px; cursor: pointer; background: #fff; color: #333; transition: all 0.2s;";
                
                btn.onclick = function() {
                    // 清除其他選取
                    Array.from(optionsEl.children).forEach(b => {
                        b.style.background = '#fff';
                        b.style.borderColor = '#ccc';
                        b.style.color = '#333';
                    });
                    
                    // 選取當前
                    this.style.background = 'rgba(245, 158, 11, 0.1)';
                    this.style.borderColor = '#F59E0B';
                    this.style.color = '#F59E0B';
                    this.style.fontWeight = 'bold';
                    
                    // 記錄答案
                    currentCheckData.selectedOptionIndex = idx;
                };
                optionsEl.appendChild(btn);
            });
        }
    } else {
        console.error('❌ 收到空的題目資料');
        if (qTextEl) qTextEl.textContent = '題目載入失敗 (無資料)';
    }
    
    // 重置選擇
    currentCheckData.selectedOptionIndex = null;
}

/**
 * 顯示正確答案（答錯時調用）- student.js 版本
 */
function displayCorrectAnswerInStudentJS(correctAnswer, attemptNumber) {
    if (!correctAnswer) return;

    const correctAnswerUpper = correctAnswer.toUpperCase();
    const answerMap = ['A', 'B', 'C', 'D'];
    const correctIndex = answerMap.indexOf(correctAnswerUpper);

    const optionsEl = document.getElementById('assessmentOptionsContainer');
    if (!optionsEl) return;

    // 標記所有選項
    Array.from(optionsEl.children).forEach((optionDiv, idx) => {
        if (idx === correctIndex) {
            // 正確答案：綠色高亮
            optionDiv.style.background = 'rgba(16, 185, 129, 0.15)';
            optionDiv.style.borderColor = '#10B981';
            optionDiv.style.borderWidth = '3px';
            optionDiv.style.color = '#10B981';
            optionDiv.style.fontWeight = 'bold';

            // 添加正確答案標籤
            if (!optionDiv.querySelector('.correct-answer-badge')) {
                const badge = document.createElement('span');
                badge.className = 'correct-answer-badge';
                badge.innerHTML = ' ✓ 正確答案';
                badge.style.cssText = `
                    display: inline-block; margin-left: 12px; padding: 4px 12px;
                    background: #10B981; color: white; border-radius: 12px;
                    font-size: 12px; font-weight: bold;
                `;
                optionDiv.appendChild(badge);
            }
        } else if (idx === currentCheckData.selectedOptionIndex) {
            // 錯誤答案：紅色標記
            optionDiv.style.background = 'rgba(239, 68, 68, 0.1)';
            optionDiv.style.borderColor = '#EF4444';
            optionDiv.style.borderWidth = '2px';
            optionDiv.style.color = '#EF4444';
            optionDiv.style.fontWeight = 'bold';

            // 添加錯誤答案標籤
            if (!optionDiv.querySelector('.wrong-answer-badge')) {
                const badge = document.createElement('span');
                badge.className = 'wrong-answer-badge';
                badge.innerHTML = ' ✗ 你的答案';
                badge.style.cssText = `
                    display: inline-block; margin-left: 12px; padding: 4px 12px;
                    background: #EF4444; color: white; border-radius: 12px;
                    font-size: 12px; font-weight: bold;
                `;
                optionDiv.appendChild(badge);
            }
        }

        // 禁用所有選項
        optionDiv.style.cursor = 'not-allowed';
        optionDiv.style.opacity = '0.9';
        optionDiv.onclick = null;
    });

    // 在題目下方顯示正確答案提示
    const qTextEl = document.getElementById('assessmentQuestionText');
    if (qTextEl && !document.getElementById('correctAnswerHint')) {
        const hint = document.createElement('div');
        hint.id = 'correctAnswerHint';
        hint.style.cssText = `
            margin-top: 16px; padding: 12px;
            background: rgba(16, 185, 129, 0.1);
            border-left: 4px solid #10B981;
            border-radius: 4px; font-size: 16px;
            color: var(--game-text-light);
        `;
        hint.innerHTML = `<strong>正確答案是：${correctAnswerUpper}</strong>`;
        qTextEl.appendChild(hint);
    }
}

/**
 * 提交評量答案 (修正版：補上遺漏的 userEmail)
 */
window.submitAssessmentAnswer = function() {
       // 1. 檢查是否已選答案
       if (currentCheckData.selectedOptionIndex === null || currentCheckData.selectedOptionIndex === undefined) {
           showToast('請選擇一個答案', 'warning');
           return;
       }
   
       // 2. 獲取答案內容
       const answerMap = ['A', 'B', 'C', 'D'];
       const myAnswer = answerMap[currentCheckData.selectedOptionIndex];
       
       // 獲取題目 ID
       const quizQuestionId = currentCheckData.question ? currentCheckData.question.questionId : null;
       
       if (!quizQuestionId) {
           showToast('系統錯誤：找不到題目 ID', 'error');
           return;
       }
   
       // 3. 鎖定按鈕
       const submitBtn = document.getElementById('submitAssessmentBtn');
       if (submitBtn) {
           submitBtn.disabled = true;
           submitBtn.textContent = '提交中...';
       }
   
       // 4. 準備參數 (🔥 這裡補上了 userEmail)
       const params = new URLSearchParams({
           action: 'submitAssessment',
           taskProgressId: currentCheckData.progressId,
           taskId: currentCheckData.taskId,
           questionId: quizQuestionId,
           studentAnswer: myAnswer,
           scenario: currentCheckData.scenario,
           
           // 👇👇👇 關鍵修正：補上這一行！ 👇👇👇
           userEmail: currentStudent.email 
       });
   
       // 補上 classId (保險起見)
       if (selectedClass && selectedClass.classId) {
           params.append('classId', selectedClass.classId);
       }
   
       console.log('📤 [Frontend] 提交評量答案:', Object.fromEntries(params));
   
       // 5. 發送請求
       fetch(`${APP_CONFIG.API_URL}?${params.toString()}`)
           .then(r => r.json())
           .then(data => {
               console.log('📥 [Frontend] 評量結果:', data);
               
               if (data.success) {
                   if (data.isCorrect) {
                       const tokenMsg = data.tokenReward ? `獲得 ${data.tokenReward} 代幣` : '';
                       if (currentCheckData.scenario === 'B') {
                           showToast(`🎉 答對了！獲得補救獎勵 ${tokenMsg}`, 'success');
                       } else {
                           showToast(`🎉 任務完成！${tokenMsg}`, 'success');
                       }

                       // 即時更新代幣顯示
                       if (typeof refreshUserTokens === 'function') {
                           refreshUserTokens();
                       }

                       closeSelfCheckModal();

                       // 重新整理列表
                       setTimeout(() => {
                           if (typeof loadTierTasks === 'function') loadTierTasks(true);
                           if (typeof displayQuestList === 'function') displayQuestList();
                       }, 1000);
                   } else {
                       // 答錯：顯示正確答案，不關閉 Modal
                       displayCorrectAnswerInStudentJS(data.correctAnswer, data.attemptNumber);

                       // 顯示錯誤提示訊息
                       showToast(`❌ 答錯了！這是第 ${data.attemptNumber} 次嘗試`, 'warning', 5000);

                       // 隱藏提交按鈕
                       if (submitBtn) submitBtn.style.display = 'none';

                       // 修改關閉按鈕行為
                       const closeBtn = document.getElementById('closeSelfCheckBtn');
                       if (closeBtn) {
                           closeBtn.textContent = '知道了，重新開始';
                           closeBtn.onclick = function() {
                               closeSelfCheckModal();
                               setTimeout(() => {
                                   if (typeof loadTierTasks === 'function') loadTierTasks(true);
                                   if (typeof displayQuestList === 'function') displayQuestList();
                               }, 500);
                           };
                       }
                   }
   
               } else {
                   showToast(data.message || '提交失敗', 'error');
                   if (submitBtn) {
                       submitBtn.disabled = false;
                       submitBtn.textContent = '提交答案';
                   }
               }
           })
           .catch(err => {
               console.error(err);
               showToast('系統錯誤，請檢查網路', 'error');
               if (submitBtn) {
                   submitBtn.disabled = false;
                   submitBtn.textContent = '提交答案';
               }
           });
   };

      /**
    * 關閉自主檢查面板
    */
   window.closeSelfCheckModal = function() {
       const modal = document.getElementById('selfCheckModal');
       if (modal) {
           // 隱藏 Modal
           modal.style.display = 'none';
           modal.classList.remove('active'); // 若有使用 CSS class 控制顯示也一併移除
       }
       
       // 選用：重置相關變數 (視需求而定)
       currentCheckData = { taskId: null, progressId: null, checklists: [], hasErrors: false, question: null };
   };
})(); // IIFE

