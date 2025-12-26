/* ==========================================
   任務審核儀表板 - review.js（階段 2 - 課堂控制）
   ========================================== */

// 使用立即執行函數避免全域變數污染
(function() {
    'use strict';

    // 模組內部變數
    let reviewUser = null;
    let reviewClasses = [];
    let allTasks = [];
    let filteredTasks = [];
    let currentQuickFilter = 'all';
    // ✅ Removed: autoRefreshInterval (merged into countdownInterval)
    let countdownInterval = null;
    let refreshCountdown = 30;

    // 階段 2：課堂控制相關變數
    let currentSession = null;
    let selectedClassId = null;
    let timeUpdateInterval = null;
    let taskTimeUpdateInterval = null; // 任務時間更新 interval

    // ==========================================
    // 初始化
    // ==========================================

    document.addEventListener('DOMContentLoaded', function() {
        APP_CONFIG.log('📊 任務審核模組載入完成');
    });

    /**
     * 載入任務審核頁面（由 switchTab 調用）
     */
    window.loadReview = function() {
        APP_CONFIG.log('📊 載入任務審核頁面...');

        // 檢查登入狀態
        const userJson = localStorage.getItem('user');
        if (!userJson) {
            showToast('請先登入', 'warning');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 1000);
            return;
        }

        try {
            reviewUser = JSON.parse(userJson);

            // 檢查權限
            if (reviewUser.role !== 'teacher' && reviewUser.role !== 'admin') {
                showToast('您沒有權限訪問此頁面', 'error');
                return;
            }

            // 初始化頁面
            initializeReviewPage();

        } catch (error) {
            console.error('解析使用者資料失敗:', error);
            showToast('登入資料有誤，請重新登入', 'error');
        }
    };

    // ==========================================
    // 初始化頁面
    // ==========================================

    function initializeReviewPage() {
        // 階段 2：初始載入只取得班級列表，不載入任務
        // 使用者必須自己選擇班級
        loadClassList();

        // 階段 2：不在初始化時啟動自動刷新
        // 只在開始上課後才啟動自動刷新
    }

    /**
     * 載入班級列表（階段 2：初始化專用）
     */
    function loadClassList() {
        // 初始化班級選擇器狀態（禁用 + 顯示提示文字）
        const select = document.getElementById('reviewClassSelect');
        if (select) {
            select.innerHTML = '<option value="" disabled selected>請選擇班級...</option>';
            select.disabled = true; // 禁用直到 API 完成
        }

        showLoading('reviewLoading');

        const params = new URLSearchParams({
            action: 'getTeacherTaskMonitor',
            teacherEmail: reviewUser.email
        });

        APP_CONFIG.log('📤 載入班級列表...', {
            teacherEmail: reviewUser.email
        });

        fetch(`${APP_CONFIG.API_URL}?${params.toString()}`)
            .then(response => response.json())
            .then(function(response) {
                hideLoading('reviewLoading');

                APP_CONFIG.log('📥 班級列表回應:', response);

                if (response.success) {
                    reviewClasses = response.classes || [];
                    allTasks = []; // 初始化時不載入任務
                    filteredTasks = [];

                    // 填充班級選擇器
                    populateClassSelector();

                    // 啟用班級選擇器
                    if (select) {
                        select.disabled = false;
                    }

                    // 更新計數為 0
                    updateCounts();

                    // 顯示初始提示
                    showInitialState();

                } else {
                    showToast(response.message || '載入失敗', 'error');
                    showEmptyState();
                    // 載入失敗時也要解除禁用
                    if (select) {
                        select.disabled = false;
                    }
                }
            })
            .catch(function(error) {
                hideLoading('reviewLoading');
                APP_CONFIG.error('載入班級列表失敗', error);
                showToast('載入失敗：' + error.message, 'error');
                showEmptyState();
            });
    }

    /**
     * 顯示初始提示（階段 2：請選擇班級）
     */
    function showInitialState() {
        const emptyState = document.getElementById('reviewEmptyState');
        if (emptyState) {
            emptyState.innerHTML = `
                <div class="empty-state-icon">👆</div>
                <h3>請選擇班級開始監控</h3>
                <p>請從上方選擇器選擇一個班級<br>系統將顯示該班級的任務狀態</p>
            `;
        }
        document.getElementById('reviewTableContainer').style.display = 'none';
        document.getElementById('reviewEmptyState').style.display = 'block';
    }

    // ==========================================
    // 載入任務資料
    // ==========================================

    /**
     * 載入任務監控資料（階段 2：優化自動刷新體驗）
     */
    window.loadReviewTasks = function(isAutoRefresh) {
        // 只在非自動刷新時顯示 loading 和隱藏表格
        if (!isAutoRefresh) {
            showLoading('reviewLoading');
            document.getElementById('reviewTableContainer').style.display = 'none';
            document.getElementById('reviewEmptyState').style.display = 'none';
        }

        // 鎖定班級選擇器
        const classSelect = document.getElementById('reviewClassSelect');
        if (classSelect) {
            classSelect.disabled = true;
        }

        const selectedClassId = document.getElementById('reviewClassSelect').value;

        const params = new URLSearchParams({
            action: 'getTeacherTaskMonitor',
            teacherEmail: reviewUser.email
        });

        if (selectedClassId) {
            params.append('classId', selectedClassId);
        }

        APP_CONFIG.log('📤 載入任務監控資料...', {
            teacherEmail: reviewUser.email,
            classId: selectedClassId || '未選擇',
            isAutoRefresh: isAutoRefresh || false
        });

        fetch(`${APP_CONFIG.API_URL}?${params.toString()}`)
            .then(response => response.json())
            .then(function(response) {
                hideLoading('reviewLoading');

                // 解鎖班級選擇器
                if (classSelect) {
                    classSelect.disabled = false;
                }

                APP_CONFIG.log('📥 任務監控資料回應:', response);

                if (response.success) {
                    allTasks = response.tasks || [];
                    reviewClasses = response.classes || [];

                    // 每次載入都更新班級與層級選單，避免切換班級後層級選單為空
                    populateClassSelector();
                    populateAdvancedFilters();

                    // 應用篩選並顯示
                    applyFilters();

                    // 重置刷新倒數
                    refreshCountdown = 30;

                } else {
                    showToast(response.message || '載入失敗', 'error');
                    if (!isAutoRefresh) {
                        showEmptyState();
                    }
                }
            })
            .catch(function(error) {
                hideLoading('reviewLoading');

                // 解鎖班級選擇器
                if (classSelect) {
                    classSelect.disabled = false;
                }

                APP_CONFIG.error('載入任務監控資料失敗', error);
                if (!isAutoRefresh) {
                    showToast('載入失敗：' + error.message, 'error');
                    showEmptyState();
                }
            });
    };

    /**
     * 填充班級選擇器
     */
    function populateClassSelector() {
        const select = document.getElementById('reviewClassSelect');
        if (!select) return;

        const currentValue = select.value;

        // 階段 2：移除全部班級選項，不自動選擇
        select.innerHTML = '<option value="" disabled selected>請選擇班級...</option>';

        reviewClasses.forEach(function(classData) {
            const option = document.createElement('option');
            option.value = classData.classId;
            option.textContent = classData.className;
            // 暫時設為預設樣式，等待課堂狀態檢查完成後更新
            option.setAttribute('data-class-id', classData.classId);
            select.appendChild(option);
        });

        // 只在有當前選擇時恢復選擇
        if (currentValue) {
            select.value = currentValue;
        }

        // 同步填充層級篩選選單
        populateTierFilter();

        // 檢查所有班級的課堂狀態
        checkAllClassSessions();
    }

    /**
     * 批量檢查所有班級的課堂狀態
     */
    function checkAllClassSessions() {
        if (!reviewClasses || reviewClasses.length === 0) return;

        APP_CONFIG.log('🔍 開始檢查所有班級的課堂狀態...');

        // 為每個班級發送請求檢查課堂狀態
        reviewClasses.forEach(function(classData) {
            checkSingleClassSession(classData.classId);
        });
    }

    /**
     * 檢查單一班級的課堂狀態
     */
    function checkSingleClassSession(classId) {
        const params = new URLSearchParams({
            action: 'getCurrentSession',
            classId: classId
        });

        fetch(`${APP_CONFIG.API_URL}?${params.toString()}`)
            .then(response => response.json())
            .then(function(response) {
                if (response.success && response.session) {
                    const sessionStatus = (response.session.status)
                        ? String(response.session.status).toLowerCase()
                        : '';
                    const isActive = response.isActive ||
                        (sessionStatus === 'active' || sessionStatus === 'paused');

                    if (isActive) {
                        // 有進行中的課堂，更新選單樣式
                        updateClassOptionStyle(classId, true, sessionStatus === 'paused');
                    }
                }
            })
            .catch(function(error) {
                APP_CONFIG.log('檢查班級課堂狀態失敗:', { classId, error: error.message });
            });
    }

    /**
     * 更新班級選項的樣式
     */
    function updateClassOptionStyle(classId, hasActiveSession, isPaused) {
        const select = document.getElementById('reviewClassSelect');
        if (!select) return;

        // 找到對應的 option
        const options = select.querySelectorAll('option');
        options.forEach(function(option) {
            if (option.getAttribute('data-class-id') === classId) {
                if (hasActiveSession) {
                    const statusIcon = isPaused ? '⏸️' : '🟢';
                    const statusText = isPaused ? ' (暫停中)' : ' (進行中)';
                    const originalText = option.textContent.replace(/ \(.*?\)$/, ''); // 移除舊的狀態文字
                    option.textContent = statusIcon + ' ' + originalText + statusText;
                    option.style.color = isPaused ? '#f59e0b' : '#10b981';
                    option.style.fontWeight = 'bold';
                    option.setAttribute('data-has-session', 'true');
                }
            }
        });
    }

    /**
     * 填充層級篩選選單（基礎/進階/困難 + 全部）
     */
    function populateTierFilter() {
        const tierSelect = document.getElementById('reviewTierFilter');
        if (!tierSelect) return;

        const currentValue = tierSelect.value;
        tierSelect.innerHTML = '<option value=\"\" selected>全部層級</option>';

        const options = [
            { value: 'tutorial', text: '基礎層' },
            { value: 'adventure', text: '進階層' },
            { value: 'hardcore', text: '困難層' }
        ];
        options.forEach(opt => {
            const optionEl = document.createElement('option');
            optionEl.value = opt.value;
            optionEl.textContent = opt.text;
            tierSelect.appendChild(optionEl);
        });

        if (currentValue) tierSelect.value = currentValue;
    }

    /**
     * 填充進階篩選選項
     */
    function populateAdvancedFilters() {
        // 取得所有獨特的層級（優先使用學生的層級）
        const tiers = [...new Set(allTasks.map(task => task.studentTier || task.tier).filter(Boolean))];
        const tierSelect = document.getElementById('filterTier');
        if (tierSelect) {
            const currentValue = tierSelect.value;
            tierSelect.innerHTML = '<option value="">全部層級</option>';
            tiers.forEach(function(tier) {
                const option = document.createElement('option');
                option.value = tier;
                let tierDisplay = tier;
                if (tier === 'tutorial') tierDisplay = '基礎層';
                else if (tier === 'adventure') tierDisplay = '進階層';
                else if (tier === 'hardcore') tierDisplay = '困難層';
                option.textContent = tierDisplay;
                tierSelect.appendChild(option);
            });
            if (currentValue) tierSelect.value = currentValue;
        }

        // 取得所有獨特的任務
        const tasks = [...new Set(allTasks.map(task => task.taskName).filter(Boolean))];
        const taskSelect = document.getElementById('filterTask');
        if (taskSelect) {
            const currentValue = taskSelect.value;
            taskSelect.innerHTML = '<option value="">全部任務</option>';
            tasks.forEach(function(taskName) {
                const option = document.createElement('option');
                option.value = taskName;
                option.textContent = taskName;
                taskSelect.appendChild(option);
            });
            if (currentValue) taskSelect.value = currentValue;
        }
        populateTierFilter();
    }

    // ==========================================
    // 課堂控制系統（階段 2）
    // ==========================================

    /**
     * 處理班級選擇變更（階段 2：檢查 session 狀態）
     */
    window.handleClassChange = function() {
        const select = document.getElementById('reviewClassSelect');
        selectedClassId = select.value;

        APP_CONFIG.log('📚 選擇班級:', selectedClassId);

        // 階段 2：必須選擇班級
        if (!selectedClassId) {
            return;
        }

        // 性能優化：顯示 loading 避免用戶誤以為當機
        showLoading('reviewLoading');

        // 檢查班級的 session 狀態
        checkSessionStatus(selectedClassId);

        // 載入任務（會在完成後隱藏 loading）
        loadReviewTasks();

        // 重置層級篩選
        const tierSelect = document.getElementById('reviewTierFilter');
        if (tierSelect) {
            tierSelect.value = '';
        }

        // ✅ 修復：無論是否上課，都啟動自動刷新（60秒）
        // 這樣老師可以即時看到學生的進度變化
        startAutoRefresh();
        APP_CONFIG.log('✅ 已啟動自動刷新（選擇班級後）');
    };

    /**
     * 檢查班級的課堂狀態
     */
    function checkSessionStatus(classId) {
        const params = new URLSearchParams({
            action: 'getCurrentSession',
            classId: classId
        });

        APP_CONFIG.log('📤 檢查課堂狀態...', { classId });

        fetch(`${APP_CONFIG.API_URL}?${params.toString()}`)
            .then(response => response.json())
            .then(function(response) {
                APP_CONFIG.log('📥 課堂狀態回應:', response);

                if (response.success) {
                    // 調試：紀錄後端回傳的欄位來源（class_id=B,index1；teacher_email=C,index2；status=F,index5）
                    if (response.session) {
                        APP_CONFIG.log('🧭 Session來源欄位檢查', {
                            rawSession: response.session,
                            classIdFromBackend: response.session.classId,
                            teacherEmailFromBackend: response.session.teacherEmail,
                            statusFromBackend: response.session.status
                        });
                    }

                    // 後端已回傳 isActive；另外保險：若 session.status 是 active/paused 也視為進行中
                    const sessionStatus = (response.session && response.session.status)
                        ? String(response.session.status).toLowerCase()
                        : '';
                    const derivedIsActive = response.isActive ||
                        (sessionStatus === 'active' || sessionStatus === 'paused');

                    if (derivedIsActive && response.session) {
                        // 有進行中的課堂
                        currentSession = response.session;
                        const isPaused = response.session.isPaused ||
                            sessionStatus === 'paused' || false;
                        updateSessionDisplay(true, isPaused);
                        startTimeUpdate();
                    } else {
                        // 沒有進行中的課堂
                        currentSession = null;
                        updateSessionDisplay(false, false);
                        stopTimeUpdate();
                    }
                } else {
                    APP_CONFIG.error('檢查課堂狀態失敗', response.message);
                    currentSession = null;
                    updateSessionDisplay(false, false);
                }
            })
            .catch(function(error) {
                APP_CONFIG.error('檢查課堂狀態失敗', error);
                currentSession = null;
                updateSessionDisplay(false, false);
            });
    }

    /**
     * 更新課堂狀態顯示（階段 2：控制自動刷新和任務時間更新）
     */
    function updateSessionDisplay(isActive, isPaused) {
        const statusDiv = document.getElementById('sessionStatus');
        const controlsDiv = document.getElementById('sessionControls');
        const indicator = document.getElementById('sessionIndicator');
        const timeElement = document.getElementById('sessionTime');
        const startBtn = document.getElementById('btnStartClass');
        const pauseBtn = document.getElementById('btnPauseClass');
        const resumeBtn = document.getElementById('btnResumeClass');
        const endBtn = document.getElementById('btnEndClass');

        if (isActive && currentSession) {
            // 上課中：顯示時間和控制按鈕
            statusDiv.style.display = 'flex';
            controlsDiv.style.display = 'flex';

            if (isPaused) {
                // 暫停狀態：顯示暫停圖示
                if (indicator) {
                    indicator.style.display = 'inline';
                    indicator.textContent = '⏸️ 課程暫停中';
                    indicator.style.color = '#f59e0b';
                }

                // 顯示時間元素
                if (timeElement) {
                    timeElement.style.display = 'inline';
                }

                startBtn.style.display = 'none';
                pauseBtn.style.display = 'none';
                resumeBtn.style.display = 'inline-block';
                endBtn.style.display = 'inline-block';

                // 停止自動刷新
                stopAutoRefresh();
                APP_CONFIG.log('⏸️ 課程暫停，停止自動刷新');

            } else {
                // 上課中（未暫停）：只顯示時間
                if (indicator) {
                    indicator.style.display = 'none';
                }

                // 顯示時間元素（直接顯示，不需要分隔線）
                if (timeElement) {
                    timeElement.style.display = 'inline';
                    timeElement.style.borderLeft = 'none';
                    timeElement.style.paddingLeft = '0';
                    timeElement.style.marginLeft = '0';
                }

                startBtn.style.display = 'none';
                pauseBtn.style.display = 'inline-block';
                resumeBtn.style.display = 'none';
                endBtn.style.display = 'inline-block';

                // 啟動自動刷新（階段 2）
                startAutoRefresh();
                APP_CONFIG.log('✅ 上課中，啟動自動刷新');
            }

            // 更新時間顯示
            updateSessionTime();

        } else {
            // 未上課：隱藏整個狀態區域
            statusDiv.style.display = 'none';
            controlsDiv.style.display = 'flex';

            startBtn.style.display = 'inline-block';
            pauseBtn.style.display = 'none';
            resumeBtn.style.display = 'none';
            endBtn.style.display = 'none';

            // 停止自動刷新（階段 2）
            stopAutoRefresh();

            // 停止任務時間更新（階段 2）
            stopTaskTimeUpdate();

            APP_CONFIG.log('⏸️ 未上課，停止自動刷新和任務時間更新');
        }
    }

    /**
     * 更新課堂時間顯示
     */
    function updateSessionTime() {
        if (!currentSession || !currentSession.startTime) return;

        const now = new Date();
        const start = new Date(currentSession.startTime);
        const elapsed = Math.floor((now.getTime() - start.getTime()) / 1000); // 秒數

        const hours = Math.floor(elapsed / 3600);
        const minutes = Math.floor((elapsed % 3600) / 60);
        const seconds = elapsed % 60;

        let timeStr = '';
        if (hours > 0) {
            timeStr = `⏱️ ${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        } else {
            timeStr = `⏱️ ${minutes}:${seconds.toString().padStart(2, '0')}`;
        }

        document.getElementById('sessionTime').textContent = timeStr;
    }

    /**
     * 啟動即時時間更新（每秒）
     */
    function startTimeUpdate() {
        stopTimeUpdate(); // 清除舊的

        timeUpdateInterval = setInterval(function() {
            updateSessionTime();
        }, 1000);

        APP_CONFIG.log('⏱️ 啟動即時時間更新');
    }

    /**
     * 停止即時時間更新
     */
    function stopTimeUpdate() {
        if (timeUpdateInterval) {
            clearInterval(timeUpdateInterval);
            timeUpdateInterval = null;
            APP_CONFIG.log('⏸️ 停止即時時間更新');
        }
    }

    /**
     * 處理開始上課
     */
    window.handleStartClass = function() {
        if (!selectedClassId) {
            showToast('請先選擇班級', 'warning');
            return;
        }

        if (!confirm('確定要開始上課嗎？\n學生將可以開始執行任務。')) {
            return;
        }

        const params = new URLSearchParams({
            action: 'startClassSession',
            teacherEmail: reviewUser.email,
            classId: selectedClassId
        });

        APP_CONFIG.log('📤 開始上課...', { classId: selectedClassId });

        fetch(`${APP_CONFIG.API_URL}?${params.toString()}`)
            .then(response => response.json())
            .then(function(response) {
                APP_CONFIG.log('📥 開始上課回應:', response);

                if (response.success) {
                    showToast('✅ ' + response.message, 'success');
                    currentSession = response.session;
                    updateSessionDisplay(true, false);
                    startTimeUpdate();

                    // 重新載入任務（會顯示執行中的任務）
                    setTimeout(() => loadReviewTasks(), 500);
                } else {
                    showToast(response.message || '開始上課失敗', 'error');
                }
            })
            .catch(function(error) {
                APP_CONFIG.error('開始上課失敗', error);
                showToast('開始上課失敗：' + error.message, 'error');
            });
    };

    /**
     * 處理暫停課程
     */
    window.handlePauseClass = function() {
        if (!currentSession) {
            showToast('目前沒有進行中的課堂', 'warning');
            return;
        }

        if (!confirm('確定要暫停課程嗎？\n學生的任務計時將暫停，適合用於課間休息。')) {
            return;
        }

        const params = new URLSearchParams({
            action: 'pauseClassSession',
            teacherEmail: reviewUser.email,
            sessionId: currentSession.sessionId
        });

        APP_CONFIG.log('📤 暫停課程...', { sessionId: currentSession.sessionId });

        fetch(`${APP_CONFIG.API_URL}?${params.toString()}`)
            .then(response => response.json())
            .then(function(response) {
                APP_CONFIG.log('📥 暫停課程回應:', response);

                if (response.success) {
                    showToast('⏸️ ' + response.message, 'success');
                    if (currentSession) {
                        currentSession.isPaused = true;
                    }
                    updateSessionDisplay(true, true); // 傳入 isPaused = true

                    // 重新載入任務
                    setTimeout(() => loadReviewTasks(), 500);
                } else {
                    showToast(response.message || '暫停課程失敗', 'error');
                }
            })
            .catch(function(error) {
                APP_CONFIG.error('暫停課程失敗', error);
                showToast('暫停課程失敗：' + error.message, 'error');
            });
    };

    /**
     * 處理繼續上課
     */
    window.handleResumeClass = function() {
        if (!currentSession) {
            showToast('目前沒有進行中的課堂', 'warning');
            return;
        }

        if (!confirm('確定要繼續上課嗎？\n學生的任務計時將恢復。')) {
            return;
        }

        const params = new URLSearchParams({
            action: 'resumeClassSession',
            teacherEmail: reviewUser.email,
            sessionId: currentSession.sessionId
        });

        APP_CONFIG.log('📤 繼續上課...', { sessionId: currentSession.sessionId });

        fetch(`${APP_CONFIG.API_URL}?${params.toString()}`)
            .then(response => response.json())
            .then(function(response) {
                APP_CONFIG.log('📥 繼續上課回應:', response);

                if (response.success) {
                    showToast('▶️ ' + response.message, 'success');
                    if (currentSession) {
                        currentSession.isPaused = false;
                    }
                    updateSessionDisplay(true, false); // 傳入 isPaused = false

                    // 重新載入任務
                    setTimeout(() => loadReviewTasks(), 500);
                } else {
                    showToast(response.message || '繼續上課失敗', 'error');
                }
            })
            .catch(function(error) {
                APP_CONFIG.error('繼續上課失敗', error);
                showToast('繼續上課失敗：' + error.message, 'error');
            });
    };

    /**
     * 處理結束上課
     */
    window.handleEndClass = function() {
        if (!currentSession) {
            showToast('目前沒有進行中的課堂', 'warning');
            return;
        }

        if (!confirm('確定要結束上課嗎？\n所有執行中的任務計時將凍結。')) {
            return;
        }

        const params = new URLSearchParams({
            action: 'endClassSession',
            teacherEmail: reviewUser.email,
            sessionId: currentSession.sessionId
        });

        APP_CONFIG.log('📤 結束上課...', { sessionId: currentSession.sessionId });

        fetch(`${APP_CONFIG.API_URL}?${params.toString()}`)
            .then(response => response.json())
            .then(function(response) {
                APP_CONFIG.log('📥 結束上課回應:', response);

                if (response.success) {
                    showToast('✅ ' + response.message, 'success');
                    currentSession = null;
                    updateSessionDisplay(false, false);
                    stopTimeUpdate();

                    // 重新載入任務
                    setTimeout(() => loadReviewTasks(), 500);
                } else {
                    showToast(response.message || '結束上課失敗', 'error');
                }
            })
            .catch(function(error) {
                APP_CONFIG.error('結束上課失敗', error);
                showToast('結束上課失敗：' + error.message, 'error');
            });
    };

    // ==========================================
    // 任務時間即時更新（階段 2）
    // ==========================================

    /**
     * 啟動任務時間即時更新（每秒更新 in_progress 和 pending_review 任務時間）
     */
    function startTaskTimeUpdate() {
        stopTaskTimeUpdate(); // 清除舊的

        taskTimeUpdateInterval = setInterval(function() {
            updateAllTaskTimes();
            updateAllWaitingTimes(); // 同時更新等待時間
        }, 1000);

        APP_CONFIG.log('⏱️ 啟動任務時間即時更新（含等待時間）');
    }

    /**
     * 只啟動等待時間更新（未上課時使用）
     */
    function startWaitingTimeUpdateOnly() {
        stopTaskTimeUpdate(); // 清除舊的

        taskTimeUpdateInterval = setInterval(function() {
            updateAllWaitingTimes(); // 只更新等待時間
        }, 1000);

        APP_CONFIG.log('⏱️ 啟動等待時間更新');
    }

    /**
     * 停止任務時間即時更新
     */
    function stopTaskTimeUpdate() {
        if (taskTimeUpdateInterval) {
            clearInterval(taskTimeUpdateInterval);
            taskTimeUpdateInterval = null;
            APP_CONFIG.log('⏸️ 停止任務時間即時更新');
        }
    }

    /**
     * 更新所有 in_progress 任務的時間顯示（階段 2：同步更新數據）
     */
    function updateAllTaskTimes() {
        const tbody = document.getElementById('reviewTableBody');
        if (!tbody) return;

        const now = new Date().getTime();
        let hasOvertimeChange = false; // 追蹤是否有超時狀態變化

        // 找到所有有 data-start-time 的行（in_progress 任務）
        const rows = tbody.querySelectorAll('tr[data-start-time]');

        rows.forEach(function(row) {
            const taskProgressId = row.getAttribute('data-task-id');
            const startTime = row.getAttribute('data-start-time');
            const timeLimit = parseInt(row.getAttribute('data-time-limit')) || 0;
            const accumulatedTime = parseInt(row.getAttribute('data-accumulated-time')) || 0;  // 累積時間（秒）

            if (!startTime) return;

            // 計算經過時間（秒）：累積時間 + (現在 - 開始時間)
            const start = new Date(startTime).getTime();
            const currentSessionElapsed = Math.floor((now - start) / 1000);
            const totalElapsed = accumulatedTime + currentSessionElapsed;

            // 格式化時間（HH:MM:SS 或 MM:SS）
            let timeStr = '';
            const hours = Math.floor(totalElapsed / 3600);
            const minutes = Math.floor((totalElapsed % 3600) / 60);
            const seconds = totalElapsed % 60;

            if (hours > 0) {
                timeStr = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            } else {
                timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            }

            // 檢查是否超時
            const isOvertime = timeLimit > 0 && totalElapsed > timeLimit;

            // 同步更新 allTasks 數組中的數據
            const taskInArray = allTasks.find(t => t.taskProgressId === taskProgressId);
            if (taskInArray) {
                const wasOvertime = taskInArray.isOvertime;
                taskInArray.executionTime = totalElapsed;
                taskInArray.isOvertime = isOvertime;

                // 檢測超時狀態變化
                if (wasOvertime !== isOvertime) {
                    hasOvertimeChange = true;
                }
            }

            // 更新時間顯示
            const timeCell = row.querySelector('[data-time-cell]');
            if (timeCell) {
                timeCell.textContent = timeStr;

                // 更新 overtime 樣式
                if (isOvertime) {
                    timeCell.classList.add('overtime');
                    row.classList.add('overtime');
                } else {
                    timeCell.classList.remove('overtime');
                    row.classList.remove('overtime');
                }
            }

            // 更新燈號（綠燈 → 紅燈）
            const lightElement = row.querySelector('.status-light');
            if (lightElement) {
                if (isOvertime) {
                    lightElement.classList.remove('green');
                    lightElement.classList.add('red');
                } else {
                    lightElement.classList.remove('red');
                    lightElement.classList.add('green');
                }
            }
        });

        // 如果有超時狀態變化，更新計數
        if (hasOvertimeChange) {
            updateCounts();
        }
    }

    /**
     * 更新所有待審核任務的等待時間顯示
     */
    function updateAllWaitingTimes() {
        const tbody = document.getElementById('reviewTableBody');
        if (!tbody) return;

        const now = new Date().getTime();

        // 找到所有 pending_review 任務（通過 data-status）
        const rows = tbody.querySelectorAll('tr[data-status="pending_review"]');

        rows.forEach(function(row) {
            const taskProgressId = row.getAttribute('data-task-id');
            const submitTime = row.getAttribute('data-submit-time');

            if (!submitTime) return;

            // 計算等待時間（秒）
            const submit = new Date(submitTime).getTime();
            const waitingSeconds = Math.floor((now - submit) / 1000);

            // 格式化等待時間
            const waitingMinutes = Math.floor(waitingSeconds / 60);
            const waitingSecs = waitingSeconds % 60;
            const formattedWaitingTime = waitingMinutes > 0
                ? `${waitingMinutes}分${waitingSecs}秒`
                : `${waitingSecs}秒`;

            // 判斷是否超過 5 分鐘（高優先級）
            const isLongWait = waitingSeconds > 300;

            // 更新 allTasks 數組中的數據
            const taskInArray = allTasks.find(t => t.taskProgressId === taskProgressId);
            if (taskInArray && taskInArray.waitingTime) {
                taskInArray.waitingTime.seconds = waitingSeconds;
                taskInArray.waitingTime.formatted = formattedWaitingTime;
                taskInArray.waitingTime.priority = isLongWait ? 'high' : 'normal';
            }

            // 更新時間顯示（找到狀態標籤內的時間顯示）
            const statusBadge = row.querySelector('td:nth-child(7)'); // 第7列是狀態列
            if (statusBadge) {
                // 找到或創建等待時間 span
                let waitingSpan = statusBadge.querySelector('.waiting-time-display');

                if (!waitingSpan) {
                    // 如果不存在，創建一個
                    waitingSpan = document.createElement('span');
                    waitingSpan.className = 'waiting-time-display';
                    waitingSpan.style.marginLeft = '8px';
                    waitingSpan.style.fontWeight = '700';
                    statusBadge.appendChild(waitingSpan);
                }

                // 更新內容和顏色
                waitingSpan.textContent = `⏰ ${formattedWaitingTime}`;
                waitingSpan.style.color = isLongWait ? '#ef4444' : '#f59e0b';

                // 更新燈號（超過 5 分鐘變紅燈）
                const lightElement = row.querySelector('.status-light');
                if (lightElement) {
                    if (isLongWait) {
                        lightElement.classList.remove('yellow');
                        lightElement.classList.add('red');
                    } else {
                        lightElement.classList.remove('red');
                        lightElement.classList.add('yellow');
                    }
                }
            }
        });
    }

    // ==========================================
    // 篩選功能
    // ==========================================

    /**
     * 應用快速篩選
     */
    window.applyQuickFilter = function(filterType) {
        currentQuickFilter = filterType;

        // 更新按鈕狀態
        document.querySelectorAll('.filter-tag').forEach(function(tag) {
            tag.classList.remove('active');
            if (tag.getAttribute('data-filter') === filterType) {
                tag.classList.add('active');
            }
        });

        applyFilters();
    };

    /**
     * 應用所有篩選條件（課堂監控模式）
     */
    window.applyFilters = function() {
        let tasks = [...allTasks];

        const overtimeStatuses = ['in_progress', 'self_checking', 'uploading', 'assessment'];
        // 1. 快速篩選
        if (currentQuickFilter === 'in_progress') {
            tasks = tasks.filter(task => overtimeStatuses.includes(task.status));
        } else if (currentQuickFilter === 'completed') {
            tasks = tasks.filter(task => task.status === 'completed');
        } else if (currentQuickFilter === 'overtime') {
            // 紅燈：執行/檢核/上傳/評量且超時
            tasks = tasks.filter(task => overtimeStatuses.includes(task.status) && task.isOvertime);
        }
        // 'all' 不過濾

        // 2. 層級篩選（優先用頂部 reviewTierFilter，若沒選則用進階篩選 filterTier）
        // 修復：篩選學生的層級而非任務的層級
        const reviewTierSelect = document.getElementById('reviewTierFilter');
        const topTierValue = reviewTierSelect ? reviewTierSelect.value : '';
        let tierFilterValue = topTierValue;
        if (!tierFilterValue) {
            const filterTier = document.getElementById('filterTier');
            tierFilterValue = filterTier ? filterTier.value : '';
        }
        if (tierFilterValue) {
            tasks = tasks.filter(task => {
                // 優先使用學生的層級，若無則使用任務層級
                const studentTier = task.studentTier || task.tier;
                return studentTier === tierFilterValue;
            });
        }

        // 3. 任務篩選
        const filterTask = document.getElementById('filterTask').value;
        if (filterTask) {
            tasks = tasks.filter(task => task.taskName === filterTask);
        }

        // 4. 搜尋篩選
        const filterSearch = document.getElementById('filterSearch').value.trim().toLowerCase();
        if (filterSearch) {
            tasks = tasks.filter(task =>
                task.studentName.toLowerCase().includes(filterSearch) ||
                (task.studentNumber && task.studentNumber.toString().includes(filterSearch))
            );
        }

        // 5. 排序
        const filterSort = document.getElementById('filterSort').value;
        if (filterSort === 'time-desc') {
            tasks.sort((a, b) => b.executionTime - a.executionTime);
        } else if (filterSort === 'time-asc') {
            tasks.sort((a, b) => a.executionTime - b.executionTime);
        } else if (filterSort === 'seat') {
            tasks.sort((a, b) => {
                const seatA = parseInt(a.studentNumber) || 0;
                const seatB = parseInt(b.studentNumber) || 0;
                return seatA - seatB;
            });
        }

        filteredTasks = tasks;

        // 更新計數
        updateCounts();

        // 顯示結果
        displayTaskTable();
    };

    /**
     * 更新計數（課堂監控模式）
     */
    function updateCounts() {
        const countAll = allTasks.length;
        const overtimeStatuses = ['in_progress', 'self_checking', 'uploading', 'assessment'];
        const countInProgress = allTasks.filter(task => overtimeStatuses.includes(task.status)).length;
        const countCompleted = allTasks.filter(task => task.status === 'completed').length;
        // 紅燈：執行/檢核/上傳/評量且超時
        const countOvertime = allTasks.filter(task => overtimeStatuses.includes(task.status) && task.isOvertime).length;

        document.getElementById('countAll').textContent = countAll;
        document.getElementById('countInProgress').textContent = countInProgress;
        document.getElementById('countCompleted').textContent = countCompleted;
        document.getElementById('countOvertime').textContent = countOvertime;
    }

    // ==========================================
    // 顯示任務表格
    // ==========================================

    /**
     * 顯示任務表格
     */
    function displayTaskTable() {
        const tbody = document.getElementById('reviewTableBody');
        const tableContainer = document.getElementById('reviewTableContainer');
        const emptyState = document.getElementById('reviewEmptyState');

        if (!tbody) return;

        if (filteredTasks.length === 0) {
            tableContainer.style.display = 'none';
            emptyState.style.display = 'block';
            stopTaskTimeUpdate(); // 沒有任務時停止更新
            return;
        }

        tableContainer.style.display = 'block';
        emptyState.style.display = 'none';

        tbody.innerHTML = '';

        filteredTasks.forEach(function(task) {
            const row = createTaskRow(task);
            tbody.appendChild(row);
        });

        // 啟動任務時間即時更新
        // - 執行中任務（包含所有活躍階段）：只在上課時更新
        // - 待審核任務：一直更新等待時間
        const hasPendingReview = filteredTasks.some(t => t.status === 'pending_review');
        const hasActiveTasks = filteredTasks.some(t =>
            t.status === 'in_progress' ||
            t.status === 'self_checking' ||
            t.status === 'uploading' ||
            t.status === 'assessment'
        );

        if (currentSession && (hasPendingReview || hasActiveTasks)) {
            // 上課中：更新所有任務時間
            startTaskTimeUpdate();
            APP_CONFIG.log('✅ 上課中，啟動任務時間更新（活躍任務+待審核）');
        } else if (!currentSession && hasPendingReview) {
            // 未上課但有待審核：只更新等待時間
            startWaitingTimeUpdateOnly();
            APP_CONFIG.log('✅ 未上課，僅啟動等待時間更新');
        } else {
            stopTaskTimeUpdate();
            APP_CONFIG.log('⏸️ 無需更新時間');
        }
    }

    /**
     * 建立任務行（階段 2：支援執行中 + 待審核）
     */
    function createTaskRow(task) {
        const tr = document.createElement('tr');

        // 🔍 調試：檢查任務數據
        if (task.status === 'pending_review') {
            APP_CONFIG.log('🔍 創建待審核任務行:', {
                taskId: task.taskProgressId,
                submitTime: task.submitTime,
                waitingTime: task.waitingTime
            });
        }

        // 如果超時，添加 overtime 類別（會有閃爍動畫）
        if (task.isOvertime) {
            tr.classList.add('overtime');
        }

        // 燈號邏輯（課堂監控模式）
        let lightColor = 'gray'; // 默認灰燈（尚未開始）
        let statusBadge = '';
        let showActions = false; // 是否顯示重置按鈕

        if (task.status === 'not_started') {
            // 尚未開始：灰燈
            lightColor = 'gray';
            statusBadge = '<span style="display: inline-block; padding: 4px 12px; background: rgba(156, 163, 175, 0.1); color: #6b7280; border-radius: 12px; font-size: 12px; font-weight: 600; margin-left: 8px;">⏸️ 尚未開始</span>';
            showActions = false;
        } else if (task.status === 'in_progress') {
            // 執行中：根據時間使用率決定燈號
            const timeUsedPercent = task.timeLimit > 0 ? (task.executionTime / task.timeLimit) : 0;

            if (task.isOvertime) {
                // 紅燈：已超時
                lightColor = 'red';
                statusBadge = '<span style="display: inline-block; padding: 4px 12px; background: rgba(239, 68, 68, 0.1); color: #ef4444; border-radius: 12px; font-size: 12px; font-weight: 600; margin-left: 8px;">🚨 已超時</span>';
            } else if (timeUsedPercent >= 0.8) {
                // 黃燈：接近超時（80%以上）
                lightColor = 'yellow';
                statusBadge = '<span style="display: inline-block; padding: 4px 12px; background: rgba(245, 158, 11, 0.1); color: #f59e0b; border-radius: 12px; font-size: 12px; font-weight: 600; margin-left: 8px;">⚡ 執行中（接近超時）</span>';
            } else {
                // 綠燈：正常執行中
                lightColor = 'green';
                statusBadge = '<span style="display: inline-block; padding: 4px 12px; background: rgba(16, 185, 129, 0.1); color: #10b981; border-radius: 12px; font-size: 12px; font-weight: 600; margin-left: 8px;">⚡ 執行中</span>';
            }
            showActions = true; // 執行中也可以重置任務
        } else if (task.status === 'self_checking') {
            // 檢核階段：綠燈
            lightColor = 'green';
            statusBadge = '<span style="display: inline-block; padding: 4px 12px; background: rgba(16, 185, 129, 0.1); color: #10b981; border-radius: 12px; font-size: 12px; font-weight: 600; margin-left: 8px;">📝 檢核中</span>';
            showActions = true;
        } else if (task.status === 'uploading') {
            // 上傳階段：綠燈
            lightColor = 'green';
            statusBadge = '<span style="display: inline-block; padding: 4px 12px; background: rgba(16, 185, 129, 0.1); color: #10b981; border-radius: 12px; font-size: 12px; font-weight: 600; margin-left: 8px;">📤 上傳中</span>';
            showActions = true;
        } else if (task.status === 'assessment') {
            // 評量階段：黃燈
            lightColor = 'yellow';
            statusBadge = '<span style="display: inline-block; padding: 4px 12px; background: rgba(245, 158, 11, 0.1); color: #f59e0b; border-radius: 12px; font-size: 12px; font-weight: 600; margin-left: 8px;">📝 評量中</span>';
            showActions = true;
        } else if (task.status === 'pending_review') {
            // 待審核：黃燈
            lightColor = 'yellow';
            statusBadge = '<span style="display: inline-block; padding: 4px 12px; background: rgba(245, 158, 11, 0.1); color: #f59e0b; border-radius: 12px; font-size: 12px; font-weight: 600; margin-left: 8px;">⏳ 待審核</span>';
            showActions = false;
        } else if (task.status === 'completed') {
            // 已完成：藍燈
            lightColor = 'blue';
            statusBadge = '<span style="display: inline-block; padding: 4px 12px; background: rgba(59, 130, 246, 0.1); color: #3b82f6; border-radius: 12px; font-size: 12px; font-weight: 600; margin-left: 8px;">✅ 已完成</span>';
            showActions = false; // 已完成不需要重置
        }

        // 時間格式化（HH:MM:SS 或 MM:SS）
        let timeStr = '';
        const hours = Math.floor(task.executionTime / 3600);
        const minutes = Math.floor((task.executionTime % 3600) / 60);
        const seconds = task.executionTime % 60;

        if (hours > 0) {
            timeStr = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        } else {
            timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }

        const timeClass = task.isOvertime ? 'overtime' : '';

        // 審核按鈕（根據狀態決定是否顯示）
        let actionsHtml = '';
        if (showActions) {
            actionsHtml = `
                <button class="btn-reset" onclick="handleResetTask('${task.taskProgressId}')" title="重置任務，清除所有進度">
                    🔄 重置任務
                </button>
            `;
        } else {
            actionsHtml = '<span style="color: var(--text-muted); font-size: 14px;">進行中...</span>';
        }

        // 為執行中的任務添加 data 屬性，用於前端即時更新時間
        // 包含所有活躍階段：in_progress, self_checking, uploading, assessment
        if ((task.status === 'in_progress' ||
             task.status === 'self_checking' ||
             task.status === 'uploading' ||
             task.status === 'assessment') && task.startTime) {
            tr.setAttribute('data-task-id', task.taskProgressId);
            tr.setAttribute('data-start-time', task.startTime);
            tr.setAttribute('data-time-limit', task.timeLimit || 0);
            tr.setAttribute('data-accumulated-time', task.timeSpent || 0);  // 累積時間
        }

        // 為 pending_review 任務添加 data 屬性，用於前端即時更新等待時間
        if (task.status === 'pending_review' && task.submitTime) {
            tr.setAttribute('data-task-id', task.taskProgressId);
            tr.setAttribute('data-submit-time', task.submitTime);
            tr.setAttribute('data-status', 'pending_review');
        }

        // 層級顏色標籤（優先使用學生的層級，若無則使用任務層級）
        const tierName = task.studentTierDisplay || task.tierDisplay || '-';
        const tierColorMap = {
            '基礎層': { bg: 'rgba(16, 185, 129, 0.15)', fg: '#0f9f6e' },
            '進階層': { bg: 'rgba(245, 158, 11, 0.15)', fg: '#f59e0b' },
            '困難層': { bg: 'rgba(239, 68, 68, 0.15)', fg: '#ef4444' },
            '未選擇': { bg: 'rgba(156, 163, 175, 0.1)', fg: '#6b7280' }
        };
        const tierStyle = tierColorMap[tierName] || { bg: 'rgba(59, 130, 246, 0.1)', fg: '#3498db' };
        const tierBadge = `<span style="display:inline-block; padding:4px 10px; border-radius:10px; font-size:12px; font-weight:700; background:${tierStyle.bg}; color:${tierStyle.fg};">${escapeHtml(tierName)}</span>`;

        tr.innerHTML = `
            <td style="text-align: center;">
                <span class="status-light ${lightColor}"></span>
            </td>
            <td style="text-align: center; font-weight: 700;">
                ${escapeHtml(task.studentNumber)}
            </td>
            <td style="font-weight: 600;">
                ${escapeHtml(task.studentName)}
            </td>
            <td style="color: var(--text-medium);">
                ${escapeHtml(task.className)}
            </td>
            <td style="text-align: center;">
                ${tierBadge}
            </td>
            <td>
                <span class="task-time ${timeClass}" data-time-cell="true">${timeStr}</span>
                ${statusBadge}
            </td>
            <td>
                <div class="review-actions">
                    ${actionsHtml}
                </div>
            </td>
        `;

        return tr;
    }

    /**
     * 顯示空狀態（階段 2：恢復預設訊息）
     */
    function showEmptyState() {
        const emptyState = document.getElementById('reviewEmptyState');
        if (emptyState) {
            emptyState.innerHTML = `
                <div class="empty-state-icon">📊</div>
                <h3>暫無任務</h3>
                <p>當學生開始執行或提交任務後，將會顯示在此處<br>您可以即時監控執行中的任務，並審核待審核的任務</p>
            `;
        }
        document.getElementById('reviewTableContainer').style.display = 'none';
        document.getElementById('reviewEmptyState').style.display = 'block';
    }

    // ==========================================
    // 審核操作
    // ==========================================

    /**
     * 重置任務（原審核通過功能已棄用）
     */
    window.handleResetTask = function(taskProgressId) {
        if (!confirm('⚠️ 確定要重置此任務嗎？\n\n這將會：\n• 清除所有任務進度\n• 刪除自主檢核記錄\n• 刪除評量記錄\n• 學生需要重新開始\n\n此操作無法復原！')) {
            return;
        }

        const params = new URLSearchParams({
            action: 'resetTask',
            teacherEmail: reviewUser.email,
            taskProgressId: taskProgressId,
            reason: '教師手動重置'
        });

        APP_CONFIG.log('📤 重置任務...', { taskProgressId });

        fetch(`${APP_CONFIG.API_URL}?${params.toString()}`)
            .then(response => response.json())
            .then(function(response) {
                APP_CONFIG.log('📥 重置任務回應:', response);

                if (response.success) {
                    showToast('✅ 任務已重置，學生需要重新開始', 'success');

                    // 樂觀更新：立即從 UI 移除該任務（不重新載入）
                    removeTaskFromUI(taskProgressId);
                } else {
                    showToast(response.message || '重置失敗', 'error');
                }
            })
            .catch(function(error) {
                APP_CONFIG.error('重置任務失敗', error);
                showToast('重置失敗：' + error.message, 'error');
            });
    };

    /**
     * 從 UI 移除任務（樂觀更新）
     */
    function removeTaskFromUI(taskProgressId) {
        // 從陣列中移除
        const taskIndex = allTasks.findIndex(t => t.taskProgressId === taskProgressId);
        if (taskIndex !== -1) {
            allTasks.splice(taskIndex, 1);
        }

        const filteredIndex = filteredTasks.findIndex(t => t.taskProgressId === taskProgressId);
        if (filteredIndex !== -1) {
            filteredTasks.splice(filteredIndex, 1);
        }

        // 從 DOM 移除
        const tbody = document.getElementById('reviewTableBody');
        if (tbody) {
            const rows = tbody.getElementsByTagName('tr');
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                // 檢查該行是否包含此 taskProgressId
                const approveBtn = row.querySelector(`button[onclick*="${taskProgressId}"]`);
                if (approveBtn) {
                    // 添加淡出動畫
                    row.style.transition = 'opacity 0.3s ease-out';
                    row.style.opacity = '0';
                    setTimeout(() => {
                        row.remove();

                        // 更新計數
                        updateCounts();

                        // 如果沒有任務了，顯示空狀態
                        if (filteredTasks.length === 0) {
                            showEmptyState();
                        }
                    }, 300);
                    break;
                }
            }
        }

        APP_CONFIG.log('✅ 已從 UI 移除任務:', taskProgressId);
    }

    /**
     * 舊函數保留作為別名（向後兼容）
     * @deprecated 請使用 handleResetTask
     */
    window.handleApproveTask = function(taskProgressId) {
        console.warn('⚠️ handleApproveTask 已棄用，系統已改為自動完成模式');
        showToast('⚠️ 系統已改為自動完成模式，學生完成任務後會自動獲得代幣', 'warning');
    };

    /**
     * 舊函數保留作為別名（向後兼容）
     * @deprecated 請使用 handleResetTask
     */
    window.handleRejectTask = function(taskProgressId) {
        console.warn('⚠️ handleRejectTask 已改為 handleResetTask');
        handleResetTask(taskProgressId);
    };

    // ==========================================
    // 自動刷新
    // ==========================================

    /**
     * 啟動自動刷新（階段 2：只在上課時啟動）
     */
    function startAutoRefresh() {
        // ✅ Fixed: 清除舊的計時器（只需要 countdownInterval）
        if (countdownInterval) {
            clearInterval(countdownInterval);
        }

        // 性能優化：改為 60 秒自動刷新（原本 30 秒太頻繁）
        // 原因：前端已經有即時更新執行中任務的時間（每 1 秒）
        // 自動刷新主要用於檢測新提交的任務或退回的任務
        // ✅ 修復：使用單一計時器確保倒數和刷新同步
        refreshCountdown = 60;

        countdownInterval = setInterval(function() {
            refreshCountdown--;

            // 更新倒數顯示
            const countdownElement = document.getElementById('refreshCountdown');
            if (countdownElement) {
                countdownElement.textContent = refreshCountdown;
            }

            // 當倒數到 0 時執行刷新
            if (refreshCountdown <= 0) {
                APP_CONFIG.log('🔄 自動刷新任務資料...（倒數到 0）');
                loadReviewTasks(true); // 傳入 true 表示是自動刷新
                refreshCountdown = 60; // 重置倒數
            }
        }, 1000); // 每秒檢查一次

        APP_CONFIG.log('✅ 自動刷新已啟動（每 60 秒）');
    }

    /**
     * 停止自動刷新
     */
    function stopAutoRefresh() {
        // ✅ Fixed: 只需清除 countdownInterval（已包含刷新功能）
        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }
        APP_CONFIG.log('⏸️ 自動刷新已停止');
    }

    // 當離開頁面時停止所有計時器
    window.addEventListener('beforeunload', function() {
        stopAutoRefresh();
        stopTimeUpdate(); // 停止 session 時間更新
        stopTaskTimeUpdate(); // 停止任務時間更新（階段 2）
    });

    // ==========================================
    // 工具函數
    // ==========================================

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

})(); // IIFE 結尾
