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
    let learningRecord = null;
    let selectedTask = null;
    let sessionCheckInterval = null; // 階段 2：session 檢查計時器
    let taskStatusCheckInterval = null; // 任務狀態檢查計時器（檢查是否被退回）
    let taskTimeLimitCheckInterval = null; // 任務時間限制檢查計時器（檢查是否超時）
    let currentTaskStartTime = null; // 当前任务开始时间
    let hasShownSlowSuggestion = false; // 是否已显示过太慢建议

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
                
                if (learningRecord) {
                    // 取得後端記錄的 current_tier (可能是 'tutorial' 或 '基礎層')
                    const savedTierRaw = learningRecord.current_tier || learningRecord.currentTier;
                    console.log('🔍 [Debug] 後端記錄的難度:', savedTierRaw);

                    if (savedTierRaw && savedTierRaw !== 'initial') {
                        // 嘗試比對：比對 ID (tutorial) 或 名稱 (基礎層)
                        const matchedTier = courseTiers.find(t => 
                            t.tierId === savedTierRaw || t.name === savedTierRaw
                        );

                        if (matchedTier) {
                            selectedTier = matchedTier.name; // ✅ 設定全域變數 (關鍵!)
                            console.log('✅ [Success] 成功匹配難度，準備跳轉:', selectedTier);
                        } else {
                            console.warn('⚠️ [Warning] 有記錄但找不到對應層級:', savedTierRaw);
                            selectedTier = null; // 重置
                        }
                    } else {
                        console.log('ℹ️ [Info] 無有效難度記錄 (initial 或空)，停留在選擇畫面');
                        selectedTier = null;
                    }
                }
                // ============================================================

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

        const params = new URLSearchParams({
            action: 'startTask',
            userEmail: currentStudent.email,
            taskId: selectedTask.taskId
        });

        APP_CONFIG.log('📤 自動繼續任務...', { taskId: selectedTask.taskId });

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
                    
                    // 直接進入任務詳情 Modal（而非直接打開連結）
                    // 這樣學生可以看到完成按鈕
                    openAutoResumeTaskDetail(selectedTask);
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
    function openAutoResumeTaskDetail(task) {
        const modal = document.getElementById('taskModal');
        if (!modal) return;

        // 填入任務資訊（與 openTaskModal 相同邏輯）
        document.getElementById('modalTaskName').textContent = task.name;

        let taskTypeName = '教學';
        if (task.type === 'practice') taskTypeName = '練習';
        else if (task.type === 'assessment') taskTypeName = '評量';

        document.getElementById('modalTaskType').textContent = taskTypeName;
        document.getElementById('modalTaskTier').textContent = task.tier;
        document.getElementById('modalTaskReward').textContent = `💰 ${task.tokenReward || 0} 代幣`;

        // 顯示內容或連結
        if (task.type === 'tutorial') {
            document.getElementById('modalContentSection').style.display = 'block';
            document.getElementById('modalLinkSection').style.display = 'none';
            document.getElementById('modalTaskContent').textContent = task.content || '暫無內容';
        } else {
            document.getElementById('modalContentSection').style.display = 'none';
            document.getElementById('modalLinkSection').style.display = 'block';
        }

        // 顯示按鈕
        const startBtn = document.getElementById('startTaskBtn');
        const completeBtn = document.getElementById('completeTaskBtn');
        const reopenBtn = document.getElementById('reopenMaterialBtn');

        if (reopenBtn) {
            if (task.link && task.link.trim() !== '') {
                reopenBtn.style.display = 'inline-block';
            } else {
                reopenBtn.style.display = 'none';
            }
        }

        // in_progress 狀態：隱藏開始按鈕，顯示完成按鈕
        startBtn.style.display = 'none';
        completeBtn.style.display = 'inline-block';

        modal.classList.add('active');
        APP_CONFIG.log('✅ 已進入自動恢復的任務詳情 Modal');
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
                        // 反向對照也加進去，防呆
                        'tutorial': '基礎層',
                        'adventure': '進階層',
                        'hardcore': '精通層'
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
    function loadTaskProgress(recordId) {
        // 性能優化：如果有緩存的進度數據，直接使用
        if (cachedProgressData) {
            APP_CONFIG.log('⚡ 使用緩存的任務進度數據，跳過重複調用');

            currentTasksProgress = cachedProgressData;

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

        // 沒有緩存，正常調用 API
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
                    if (sessionResponse.success && !sessionResponse.isActive) {
                        // 老師結束課堂了！
                        APP_CONFIG.log('⛔ 課堂已結束');
                        stopSessionCheck();
                        showToast('⛔ 老師已結束課堂', 'warning');
                        displayClassEndedScreen();
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
            statusBadge = '⏱️ 檢查中';
            statusClass = 'self-checking';
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
    // 任務 Modal
    // ==========================================

      /**
       * 開啟任務詳情 Modal (支援自主檢查狀態跳轉)
       */
      window.openTaskModal = function(task, progress) {
          selectedTask = task;
      
          const modal = document.getElementById('taskModal');
          if (!modal) return;
      
          // --- 1. 填入任務基本資訊 ---
          const setText = (id, text) => {
              const el = document.getElementById(id);
              if (el) el.textContent = text;
          };
      
          setText('modalTaskName', task.name || task.taskName);
      
          let taskTypeName = '教學';
          if (task.type === 'practice') taskTypeName = '練習';
          else if (task.type === 'assessment') taskTypeName = '評量';
      
          setText('modalTaskType', taskTypeName);
          setText('modalTaskTier', task.tier === 'mixed' ? (selectedTier || '混合') : task.tier);
          setText('modalTaskReward', `💰 ${task.tokenReward || 0} 代幣`);
      
          // --- 2. 處理任務內容 ---
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
      
          // --- 3. 按鈕狀態控制 (關鍵修改) ---
          const startBtn = document.getElementById('startTaskBtn');
          const completeBtn = document.getElementById('completeTaskBtn');
          const reopenBtn = document.getElementById('reopenMaterialBtn');
          
          // 🔥 新增：繼續檢查按鈕 (如果 HTML 裡沒有，下面會動態建立或是借用按鈕)
          // 建議直接在 HTML 裡加一個，或者我們用 completeBtn 改文字也可以
          // 這裡示範「借用 completeBtn 但改文字和行為」的做法，比較省事
          
          const setDisplay = (el, displayVal) => { if (el) el.style.display = displayVal; };
      
          // 先全部隱藏
          setDisplay(startBtn, 'none');
          setDisplay(completeBtn, 'none');
          setDisplay(reopenBtn, 'none');
      
          const hasMaterialLink = taskLink && taskLink.trim() !== '';
          const currentStatus = progress ? progress.status : 'not_started';
      
          // 依據狀態顯示按鈕
          if (currentStatus === 'completed') {
              // [已完成]
              if (hasMaterialLink) setDisplay(reopenBtn, 'inline-block');
              // 可以選擇顯示「已完成」的純文字標籤
      
          } else if (currentStatus === 'self_checking') {
              // 🔥🔥🔥 [自主檢查中] - 這是你要的狀態 🔥🔥🔥
              
              if (hasMaterialLink) setDisplay(reopenBtn, 'inline-block');
              
              if (completeBtn) {
                  completeBtn.style.display = 'inline-block';
                  completeBtn.textContent = '📋 繼續自主檢查';
                  completeBtn.className = 'btn btn-warning'; // 換個顏色 (黃色) 提示
                  
                  // 綁定點擊事件：直接打開檢查面板
                  completeBtn.onclick = function() {
                      closeTaskModal();
                      // 呼叫顯示面板函式 (需確保有 taskProgressId，通常在 progress 物件裡找得到，或重新 fetch)
                      // 這裡假設 progress 物件裡有 id，或者我們直接用 taskId 讓後端去查
                      showSelfCheckPanel(progress.taskProgressId || task.taskId, task.taskId);
                  };
              }
      
          } else if (currentStatus === 'in_progress') {
              // [進行中]
              if (hasMaterialLink) setDisplay(reopenBtn, 'inline-block');
              
              if (completeBtn) {
                  completeBtn.style.display = 'inline-block';
                  completeBtn.textContent = '提交完成';
                  completeBtn.className = 'btn btn-success'; // 綠色
                  completeBtn.onclick = handleCompleteTask; // 綁回原本的提交函式
              }
      
          } else {
              // [未開始]
              if (startBtn) {
                  setDisplay(startBtn, 'inline-block');
                  startBtn.disabled = false;
                  startBtn.textContent = '開始任務';
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

        const params = new URLSearchParams({
            action: 'startTask',
            userEmail: currentStudent.email,
            taskId: selectedTask.taskId
        });

        APP_CONFIG.log('📤 繼續任務...', { taskId: selectedTask.taskId });

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

        fetch(`${APP_CONFIG.API_URL}?${params.toString()}`)
            .then(response => response.json())
            .then(function(response) {
                if (response.success) {
                    APP_CONFIG.log('✅ 難度變更已記錄:', response);
                } else {
                    APP_CONFIG.error('❌ 記錄難度變更失敗:', response.message);
                }
            })
            .catch(function(error) {
                APP_CONFIG.error('記錄難度變更失敗', error);
            });
    }

    /**
     * 檢查並建議調整難度
     * @param {Object} task - 任务对象
     * @param {string} mode - 'fast' 或 'slow'
     */
    function checkAndSuggestDifficultyChange(task, mode) {
        if (!learningRecord || !learningRecord.recordId) return;

        // 太快模式：在提交时检查
        if (mode === 'fast') {
            const params = new URLSearchParams({
                action: 'getTaskProgress',
                recordId: learningRecord.recordId
            });

            fetch(`${APP_CONFIG.API_URL}?${params.toString()}`)
                .then(response => response.json())
                .then(function(response) {
                    if (!response.success || !response.progress) return;

                    const progress = response.progress[task.taskId];
                    if (!progress || !progress.executionTime) return;

                    const executionTime = progress.executionTime; // 秒
                    const timeLimit = task.timeLimit || 600;

                    if (timeLimit <= 0) return;

                    // 太快：< 30% 时间
                    const tooFast = executionTime < timeLimit * 0.3;

                    if (tooFast && selectedTier !== 'hardcore') {
                        let suggestion = null;
                        let newTier = null;

                        if (selectedTier === 'tutorial') {
                            suggestion = '🎉 您完成得很快！是否要嘗試更有挑戰性的難度？';
                            newTier = 'adventure';
                        } else if (selectedTier === 'adventure') {
                            suggestion = '🎉 您完成得很快！是否要挑戰最高難度？';
                            newTier = 'hardcore';
                        }

                        if (suggestion && newTier) {
                            setTimeout(() => {
                                if (confirm(suggestion)) {
                                    const tierMap = {
                                        'tutorial': '基礎層',
                                        'adventure': '挑戰層',
                                        'hardcore': '困難層'
                                    };
                                    showToast(`已切換到 ${tierMap[newTier]}`, 'success');

                                    // 記錄難度變更（太快）
                                    const oldTier = selectedTier;
                                    selectedTier = newTier;
                                    recordTierChange(oldTier, newTier, 'too_fast', task.taskId, executionTime);

                                    loadTierTasks();
                                }
                            }, 2000);
                        }
                    }
                })
                .catch(function(error) {
                    APP_CONFIG.error('檢查難度建議失敗', error);
                });
        }
    }

    /**
     * 启动任务时间限制检查（太慢的学生）
     */
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
       * 開始任務（已修正 classId 傳遞位置）
       */
      window.handleStartTask = function() {
          console.log('🔍 [Debug] selectedClass:', selectedClass); // 這裡你已經確認有值了
      
          if (!selectedTask) return;
      
          const startBtn = document.getElementById('startTaskBtn');
          const reopenBtn = document.getElementById('reopenMaterialBtn');
          const completeBtn = document.getElementById('completeTaskBtn'); 
      
          // UI 鎖定
          if (startBtn) {
              startBtn.disabled = true;
              startBtn.textContent = '檢查中...';
          }
      
          // 階段 2：先檢查班級資訊
          if (!selectedClass || !selectedClass.classId) {
              if (startBtn) {
                  startBtn.disabled = false;
                  startBtn.textContent = '開始任務';
              }
              showToast('無法取得班級資訊 (selectedClass is null)', 'error');
              return;
          }
      
          // ==========================================
          // 第一次 Fetch：檢查課堂狀態 (這裡不需要改)
          // ==========================================
          const checkParams = new URLSearchParams({
              action: 'getCurrentSession',
              classId: selectedClass.classId,
              userEmail: currentStudent.email
          });
      
          APP_CONFIG.log('📤 1. 檢查課堂狀態...', { classId: selectedClass.classId });
      
          fetch(`${APP_CONFIG.API_URL}?${checkParams.toString()}`)
              .then(response => response.json())
              .then(function(sessionResponse) {
                  
                  // ... (省略錯誤檢查邏輯，保持原樣) ...
                  if (!sessionResponse.success || !sessionResponse.isActive) {
                      if (startBtn) { startBtn.disabled = false; startBtn.textContent = '開始任務'; }
                      showToast(sessionResponse.message || '無法開始', 'warning');
                      // 這裡要 throw 或是 return 來中斷，避免執行第二次 fetch
                      throw new Error('session_invalid'); 
                  }
      
                  // 有進行中的課堂，繼續開始任務
                  if (startBtn) startBtn.textContent = '開始中...';
      
                  // ==========================================
                  // 🔥 第二次 Fetch：真正開始任務 (請看這裡！)
                  // ==========================================
                  const params = new URLSearchParams({
                      action: 'startTask',
                      userEmail: currentStudent.email,
                      taskId: selectedTask.taskId,
                      // ✅✅✅ 必須加在這裡才有用！ ✅✅✅
                      classId: selectedClass.classId 
                  });
      
                  // 🔍 Debug：印出最終傳送的字串，確認裡面有沒有 classId
                  console.log('🚀 [Critical] 準備發送 startTask 請求，參數:', params.toString());
      
                  APP_CONFIG.log('📤 2. 開始任務...', { taskId: selectedTask.taskId });
      
                  return fetch(`${APP_CONFIG.API_URL}?${params.toString()}`);
              })
              .then(function(response) {
                  if (!response) return; 
                  return response.json();
              })
              .then(function(response) {
                  if (!response) return;
      
                  APP_CONFIG.log('📥 開始任務回應:', response);
      
                  if (response.success) {
                      showToast('✅ 任務已開始！', 'success');
      
                      // 更新前端狀態
                      if (currentTasksProgress) {
                          currentTasksProgress[selectedTask.taskId] = { status: 'in_progress' };
                      }
      
                      // UI 按鈕切換
                      if (startBtn) startBtn.style.display = 'none';
                      if (reopenBtn) reopenBtn.style.display = 'inline-block'; 
                      if (completeBtn) completeBtn.style.display = 'inline-block';
      
                      // 打開教材連結
                      let taskLink = '';
                      if (selectedTask.tier === 'mixed') {
                          if (selectedTier === '基礎層' || selectedTier === 'tutorial') taskLink = selectedTask.tutorialLink;
                          else if (selectedTier === '進階層' || selectedTier === 'adventure') taskLink = selectedTask.adventureLink;
                          else if (selectedTier === '精通層' || selectedTier === 'hardcore') taskLink = selectedTask.hardcoreLink;
                      } else {
                          taskLink = selectedTask.link;
                      }
      
                      if (taskLink && taskLink.trim() !== '') {
                          window.open(taskLink, '_blank');
                      }
      
                      if (typeof displayQuestList === 'function') {
                          displayQuestList();
                      }
      
                  } else {
                      if (startBtn) { startBtn.disabled = false; startBtn.textContent = '開始任務'; }
                      showToast(response.message || '開始失敗', 'error');
                  }
              })
              .catch(function(error) {
                  if (error.message === 'session_invalid') return; // 已處理過的錯誤
                  
                  if (startBtn) { startBtn.disabled = false; startBtn.textContent = '開始任務'; }
                  console.error(error);
                  showToast('操作失敗：' + error.message, 'error');
              });
      };

        /**
 * 提交任務：進入自主檢查階段 (修復 btn is not defined 錯誤)
 */
window.handleCompleteTask = function() {
    if (!selectedTask) return;

    const taskToSubmit = selectedTask;

    if (!confirm('確定要提交此任務嗎？\n提交後將進行自主檢查，通過後才會獲得 ' + (taskToSubmit.tokenReward || 0) + ' 個代幣！')) {
        return;
    }

    // 1. 定義按鈕變數
    const completeBtn = document.getElementById('completeTaskBtn');
    
    // 2. 鎖定按鈕
    if (completeBtn) {
        completeBtn.disabled = true;
        completeBtn.textContent = '處理中...';
    }

    const params = new URLSearchParams({
        action: 'submitTask',
        userEmail: currentStudent.email,
        taskId: taskToSubmit.taskId,
        classId: selectedClass.classId // ✅ 這裡有保留 classId，很好
    });

    APP_CONFIG.log('📤 提交任務...', { 
        taskId: taskToSubmit.taskId,
        classId: selectedClass.classId
    });

    // 使用重試機制
    fetchWithRetry(`${APP_CONFIG.API_URL}?${params.toString()}`, 3)
        .then(response => response.json())
        .then(function(response) {
            // 🔥 修正點 1：將 btn 改為 completeBtn，並加上存在檢查
            if (completeBtn) {
                completeBtn.disabled = false;
                completeBtn.textContent = '提交完成';
            }

            APP_CONFIG.log('📥 提交任務回應:', response);

            if (response.success) {
                // 停止時間限制檢查
                if (typeof stopTaskTimeLimitCheck === 'function') {
                    stopTaskTimeLimitCheck();
                }

                // 關閉任務 Modal
                closeTaskModal();

                // 進入自主檢查階段
                APP_CONFIG.log('🔄 進入自主檢查階段', response);
                showToast('✅ 任務已提交，開始自主檢查...', 'success');

                // 更新進度狀態為自主檢查中
                if (currentTasksProgress) {
                    currentTasksProgress[taskToSubmit.taskId] = { status: 'self_checking' };
                }

                // 呼叫自主檢查面板 (確保有傳入 taskId)
                // 注意：後端 response.taskProgressId 必須要有回傳，否則這裡會 undefined
                showSelfCheckPanel(response.taskProgressId || taskToSubmit.taskId, taskToSubmit.taskId);

                // 重新顯示任務列表
                try {
                    if (typeof displayQuestList === 'function') {
                        displayQuestList();
                    }
                } catch (error) {
                    APP_CONFIG.error('顯示任務列表失敗', error);
                }

                // 太快的學生：在提交時建議提高難度
                try {
                    if (typeof checkAndSuggestDifficultyChange === 'function') {
                        checkAndSuggestDifficultyChange(taskToSubmit, 'fast');
                    }
                } catch (error) {
                    APP_CONFIG.error('檢查難度建議失敗', error);
                }
            } else {
                showToast(response.message || '提交失敗', 'error');
            }
        })
        .catch(function(error) {
            // 🔥 修正點 2：將 btn 改為 completeBtn
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
    * 渲染第一階段：參考資料與檢核列表 (支援比例調整與圖片放大)
    */
   function renderCheckStage(data) {
       // 1. 渲染參考文字
       const refDiv = document.getElementById('referenceDisplay');
       
       // 簡單的文字處理，這裡不需要太複雜，因為 CSS pre-wrap 會處理換行
       const textContent = escapeHtml(data.referenceAnswer || data.answerText || '無文字說明');
       
       let refHtml = `<div style="margin-bottom:20px;">${textContent}</div>`;
       
       // 2. 圖片處理 (生成縮圖與點擊事件)
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
                   // onclick="openLightbox(...)" 負責打開大圖
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
   
       // 3. 渲染檢核列表 (保持不變)
       const listDiv = document.getElementById('checklistDynamicContainer');
       listDiv.innerHTML = ''; 
       currentCheckData.checklists = data.checklists || [];
   
       if (currentCheckData.checklists.length === 0) {
           listDiv.innerHTML = '<div style="padding:20px; text-align:center; color:#888;">無需檢核，請直接下一步</div>';
           return;
       }
   
       currentCheckData.checklists.forEach((item, index) => {
           const itemHtml = `
               <div class="check-item-card" id="checkItem_${index}">
                   <div class="check-item-header">
                       <div class="check-desc">
                           <span style="color:var(--game-accent); font-weight:bold; margin-right:5px;">${index + 1}.</span>
                           ${escapeHtml(item.itemTitle || item.description)}
                       </div>
                       <div class="status-toggle">
                           <button class="status-btn pass active" onclick="toggleCheckStatus(${index}, 'pass')">✅ 符合</button>
                           <button class="status-btn fail" onclick="toggleCheckStatus(${index}, 'fail')">⚠️ 未符合</button>
                       </div>
                   </div>
                   <div class="improvement-box" id="improvementBox_${index}">
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

    /**
     * 切換單項檢核狀態
     */
    window.toggleCheckStatus = function(index, status) {
        const card = document.getElementById(`checkItem_${index}`);
        const passBtn = card.querySelector('.pass');
        const failBtn = card.querySelector('.fail');
        const improveBox = document.getElementById(`improvementBox_${index}`);

        if (status === 'pass') {
            passBtn.classList.add('active');
            failBtn.classList.remove('active');
            improveBox.classList.remove('show');
        } else {
            passBtn.classList.remove('active');
            failBtn.classList.add('active');
            improveBox.classList.add('show');
            // 自動聚焦輸入框
            setTimeout(() => document.getElementById(`improveInput_${index}`).focus(), 100);
        }
    };

    /**
     * 提交自主檢查 (用語修正版)
     */
    window.submitSelfCheck = function() {
        const total = currentCheckData.checklists.length;
        let errors = [];
        let isAllPass = true;

        // 檢查每一項
        for (let i = 0; i < total; i++) {
            const card = document.getElementById(`checkItem_${i}`);
            // 檢查是否標記為「未符合」(fail active)
            const isFail = card.querySelector('.fail').classList.contains('active');
            
            if (isFail) {
                isAllPass = false;
                const input = document.getElementById(`improveInput_${i}`);
                const reason = input.value.trim();
                
                if (!reason) {
                    // 修改點：提示語氣調整
                    showToast(`第 ${i + 1} 項標記為「未符合」，請填寫修正說明`, 'warning');
                    input.focus();
                    return; // 阻擋提交
                }
                
                // 記錄錯誤資訊
                errors.push({
                    checklistId: currentCheckData.checklists[i].checklistId,
                    itemIndex: i,
                    improvement: reason
                });
            }
        }

        // 記錄狀態供評量階段使用
        currentCheckData.hasErrors = !isAllPass;
        
        // 如果有錯誤，先將錯誤資訊送回後端記錄 (Log Error)
        if (!isAllPass) {
            APP_CONFIG.log('📝 記錄檢核修正項目', errors);
            const params = new URLSearchParams({
                action: 'logChecklistErrors', 
                taskProgressId: currentCheckData.progressId,
                errors: JSON.stringify(errors)
            });
            fetch(`${APP_CONFIG.API_URL}?${params.toString()}`); 
        }

        // 轉場到評量階段
        loadAssessment();
    };

    /**
     * 載入並顯示評量題目
     */
    function loadAssessment() {
        // UI 切換
        document.getElementById('checkStageContainer').style.display = 'none';
        document.getElementById('finishCheckBtn').style.display = 'none';
        document.getElementById('assessmentStageContainer').style.display = 'block';
        document.getElementById('selfCheckTitle').textContent = '🧠 隨堂評量';
        
        // 根據檢查結果顯示提示
        const hintText = document.getElementById('assessmentHintText');
        if (currentCheckData.hasErrors) {
            hintText.innerHTML = '雖然檢查有缺失，但只要<strong style="color:#10B981">答對此題，將獲得額外代幣獎勵！</strong> 💪';
        } else {
            hintText.innerHTML = '檢查完美通過！請完成此題以結束任務。（此模式無額外獎勵）';
        }

        // 獲取題目
        const params = new URLSearchParams({
            action: 'getTaskQuestion',
            taskId: currentCheckData.taskId
        });

        fetch(`${APP_CONFIG.API_URL}?${params.toString()}`)
            .then(r => r.json())
            .then(data => {
                if (data.success && data.question) {
                    renderAssessment(data.question);
                } else {
                    showToast('無法獲取題目', 'error');
                }
            });
    }

    /**
     * 渲染題目
     */
    function renderAssessment(question) {
        currentCheckData.question = question;
        document.getElementById('assessmentQuestionText').textContent = question.questionText || question.title;
        
        const optsDiv = document.getElementById('assessmentOptionsContainer');
        optsDiv.innerHTML = '';

        const options = [question.optionA, question.optionB, question.optionC, question.optionD].filter(o => o);

        options.forEach((opt, idx) => {
            // 將 A, B, C, D 轉為 0, 1, 2, 3
            const btn = document.createElement('div');
            btn.className = 'assessment-option-btn';
            btn.textContent = opt;
            btn.onclick = () => selectOption(btn, idx);
            optsDiv.appendChild(btn);
        });

        document.getElementById('submitAssessmentBtn').style.display = 'inline-block';
    }

    let selectedOptionIndex = null;

    function selectOption(btn, index) {
        // 移除其他選取狀態
        document.querySelectorAll('.assessment-option-btn').forEach(b => b.classList.remove('selected'));
        // 選取當前
        btn.classList.add('selected');
        selectedOptionIndex = index;
    }

    /**
     * 提交評量答案 (最終提交)
     */
    window.submitAssessmentAnswer = function() {
        if (selectedOptionIndex === null) {
            showToast('請選擇一個答案', 'warning');
            return;
        }

        // 將 0,1,2,3 轉回 A,B,C,D
        const answerMap = ['A', 'B', 'C', 'D'];
        const myAnswer = answerMap[selectedOptionIndex];
        const isCorrect = (myAnswer === currentCheckData.question.correctAnswer);

        // 準備後端參數
        const params = new URLSearchParams({
            action: 'submitAssessment',
            taskProgressId: currentCheckData.progressId,
            taskId: currentCheckData.taskId,
            isCorrect: isCorrect,
            // 關鍵邏輯：根據是否曾有錯誤 (hasErrors) 決定是否給獎勵
            // hasErrors = true -> Imperfect (Stage 1 有錯) -> Pass gets Bonus
            // hasErrors = false -> Perfect (Stage 1 無錯) -> Pass gets nothing/standard
            scenario: currentCheckData.hasErrors ? 'B' : 'A' 
        });

        fetch(`${APP_CONFIG.API_URL}?${params.toString()}`)
            .then(r => r.json())
            .then(data => {
                if (data.success) {
                    if (isCorrect) {
                        // 根據你的邏輯顯示不同訊息
                        if (currentCheckData.hasErrors) {
                            showToast(`🎉 答對了！獲得補救獎勵 ${data.tokensAwarded} 代幣`, 'success');
                        } else {
                            showToast('🎉 任務完成！(完美檢查模式)', 'success');
                        }
                    } else {
                        showToast('❌ 答案錯誤，任務結束', 'error');
                    }

                    closeSelfCheckModal();
                    
                    // 重新整理列表
                    setTimeout(() => {
                        if (typeof loadTierTasks === 'function') loadTierTasks(true);
                        if (typeof displayQuestList === 'function') displayQuestList();
                    }, 1000);

                } else {
                    showToast(data.message || '提交失敗', 'error');
                }
            })
            .catch(err => {
                console.error(err);
                showToast('系統錯誤', 'error');
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











