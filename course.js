/* ==========================================
   課程管理 - course.js
   ========================================== */

// 全域變數
let currentCourseId = null;
let currentCourseName = null;
let currentCourse = null;
let currentTasks = [];

// ==========================================
// 初始化
// ==========================================

// 頁面載入時執行
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeCourseModule);
} else {
    // DOM 已載入
    setTimeout(initializeCourseModule, 100);
}

function initializeCourseModule() {
    console.log('📚 課程管理模組初始化');
    // 在整合版本中，課程載入由 switchTab 觸發
}

// ==========================================
// 載入課程列表
// ==========================================

/**
 * 載入教師的課程列表
 */
function loadCourses() {
    const email = getUserEmail();
    if (!email) return;

    showLoading('courseLoading');
    
    const params = new URLSearchParams({
        action: 'getTeacherCourses',
        teacherEmail: email
    });
    
    console.log('📤 載入課程列表...');
    
    fetch(`${APP_CONFIG.API_URL}?${params.toString()}`)
        .then(response => response.json())
        .then(function(response) {
            console.log('📥 課程列表回應:', response);

            if (response.success && response.courses) {
                displayCourses(response.courses);
            } else {
                showToast(response.message || '載入課程失敗', 'error');
                displayCourses([]);
            }

            // 性能優化：在顯示數據後才隱藏 loading，避免空白間隙
            hideLoading('courseLoading');
        })
        .catch(function(error) {
            console.error('載入課程失敗:', error);
            showToast('載入課程失敗：' + error.message, 'error');
            displayCourses([]);

            // 最後隱藏 loading
            hideLoading('courseLoading');
        });
}

/**
 * 顯示課程卡片
 */
function displayCourses(courses) {
    const grid = document.getElementById('courseGrid');
    if (!grid) return;
    
    // 空狀態
    if (!courses || courses.length === 0) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <div class="empty-state-icon">📚</div>
                <h3>尚未建立任何課程</h3>
                <p>點擊「建立新課程」按鈕開始建立您的第一個課程</p>
                <button class="btn btn-primary" onclick="openCreateCourseModal()">
                    ➕ 建立新課程
                </button>
            </div>
        `;
        return;
    }
    
    // 清空
    grid.innerHTML = '';
    
    // 生成課程卡片
    courses.forEach(function(course) {
        const card = document.createElement('div');
        card.className = 'card';
        
        card.innerHTML = `
            <div class="card-header">
                <div>
                    <div class="card-title">${escapeHtml(course.courseName)}</div>
                    <div style="font-size: 14px; color: #95A5A6; margin-top: 4px;">
                        ${escapeHtml(course.description || '(無說明)')}
                    </div>
                </div>
                <div class="card-badge">課程</div>
            </div>
            <div class="card-meta">
                <div class="card-meta-item">
                    <span class="card-meta-icon">📅</span>
                    <span>${formatDate(course.createDate || new Date().toISOString())}</span>
                </div>
            </div>
            <div class="card-actions">
                <button class="btn btn-primary btn-flex" onclick="viewCourseTasks('${course.courseId}', '${escapeHtml(course.courseName)}')">
                    <span class="btn-icon">📝</span>
                    <span>查看任務</span>
                </button>
                <button class="btn btn-secondary btn-flex" onclick="editCourse('${course.courseId}')">
                    <span class="btn-icon">✏️</span>
                    <span>編輯</span>
                </button>
                <button class="btn btn-danger btn-flex" onclick="deleteCourse('${course.courseId}', '${escapeHtml(course.courseName)}')">
                    <span class="btn-icon">🗑️</span>
                    <span>刪除</span>
                </button>
            </div>
        `;
        
        grid.appendChild(card);
    });
}

// ==========================================
// 建立課程
// ==========================================

/**
 * 開啟建立課程 Modal
 */
function openCreateCourseModal() {
    // 重置表單
    document.getElementById('newCourseName').value = '';
    document.getElementById('newCourseDesc').value = '';

    // 恢復 Modal 標題和按鈕（防止之前編輯模式的狀態殘留）
    document.querySelector('#createCourseModal h2').textContent = '建立新課程';
    const submitBtn = document.querySelector('#createCourseModal button[onclick*="handleCreateCourse"]');
    if (submitBtn) {
        submitBtn.textContent = '建立課程';
        submitBtn.onclick = handleCreateCourse;
    }

    openModal('createCourseModal');
}

/**
 * 處理建立課程
 */
function handleCreateCourse() {
    const name = document.getElementById('newCourseName').value.trim();
    const desc = document.getElementById('newCourseDesc').value.trim();
    
    if (!name) {
        showToast('請輸入課程名稱', 'warning');
        return;
    }
    
    const btn = event.target;
    btn.disabled = true;
    btn.textContent = '建立中...';
    
    const email = getUserEmail();
    
    const params = new URLSearchParams({
        action: 'createCourse',
        name: name,
        description: desc,
        teacherEmail: email
    });
    
    console.log('📤 建立課程...');
    
    fetch(`${APP_CONFIG.API_URL}?${params.toString()}`)
        .then(response => response.json())
        .then(function(response) {
            btn.disabled = false;
            btn.textContent = '建立課程';
            
            console.log('📥 建立課程回應:', response);
            
            if (response.success) {
                showToast(`課程「${name}」建立成功！`, 'success');
                closeModal('createCourseModal');
                
                setTimeout(() => {
                    loadCourses();
                }, 500);
            } else {
                showToast(response.message || '建立失敗', 'error');
            }
        })
        .catch(function(error) {
            btn.disabled = false;
            btn.textContent = '建立課程';
            
            console.error('建立課程失敗:', error);
            showToast('建立課程失敗：' + error.message, 'error');
        });
}

// ==========================================
// 課程任務管理
// ==========================================

/**
 * 查看課程任務
 */
function viewCourseTasks(courseId, courseName) {
    currentCourseId = courseId;
    currentCourseName = courseName;
    
    // 隱藏課程列表，顯示任務檢視
    const courseListView = document.getElementById('courseListView');
    const taskView = document.getElementById('taskView');
    
    if (courseListView && taskView) {
        courseListView.style.display = 'none';
        taskView.style.display = 'block';
    }
    
    // 更新標題
    document.getElementById('currentCourseName').textContent = courseName;
    document.getElementById('courseInfoTitle').textContent = courseName;
    
    // 載入任務
    loadCourseTasks(courseId);
}

/**
 * 返回課程列表
 */
function showCourseList() {
    const courseListView = document.getElementById('courseListView');
    const taskView = document.getElementById('taskView');
    
    if (courseListView && taskView) {
        courseListView.style.display = 'block';
        taskView.style.display = 'none';
    }
    
    currentCourseId = null;
    currentCourseName = null;
}

/**
 * 載入課程任務列表
 */
function loadCourseTasks(courseId) {
    showLoading('taskLoading');
    
    const email = getUserEmail();
    
    const params = new URLSearchParams({
        action: 'getCourseDetails',
        courseId: courseId
    });
    
    console.log('📤 載入課程任務...');
    
    fetch(`${APP_CONFIG.API_URL}?${params.toString()}`)
        .then(response => response.json())
        .then(function(response) {
            hideLoading('taskLoading');

            console.log('📥 課程任務回應:', response);

            if (response.success) {
                currentCourse = response.courseInfo;
                currentTasks = response.tasks || [];
                displayTasks(currentTasks);
            } else {
                showToast(response.message || '載入任務失敗', 'error');
                displayTasks([]);
            }
        })
        .catch(function(error) {
            hideLoading('taskLoading');
            console.error('載入任務失敗:', error);
            showToast('載入任務失敗：' + error.message, 'error');
            displayTasks([]);
        });
}

/**
 * 顯示任務列表
 */
function displayTasks(tasks) {
    const container = document.getElementById('taskListContainer');
    if (!container) return;
    
    // 空狀態
    if (!tasks || tasks.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">�</div>
                <h3>尚未新增任務</h3>
                <p>點擊「新增任務」按鈕為此課程添加任務</p>
            </div>
        `;
        return;
    }
    
    // 清空
    container.innerHTML = '';
    
    // 生成任務列表
    tasks.forEach(function(task, index) {
        const item = document.createElement('div');
        item.className = 'task-item';
        
        item.innerHTML = `
            <div class="task-sequence">${index + 1}</div>
            <div class="task-info">
                <div class="task-name">${escapeHtml(task.taskName)}</div>
                <div class="task-meta">
                    💰 獎勵: ${task.tokenReward} 代幣
                    ${task.timeLimit ? ` | ⏱️ 時限: ${task.timeLimit} 分鐘` : ' | ⏱️ 無時限'}
                </div>
            </div>
            <div class="task-actions">
                <button class="btn-icon" onclick="editTask('${task.taskId}')">✏️</button>
                <button class="btn-icon" onclick="deleteTask('${task.taskId}', '${escapeHtml(task.taskName)}')">🗑️</button>
            </div>
        `;
        
        container.appendChild(item);
    });
}

// ==========================================
// 新增任務
// ==========================================

/**
 * 開啟新增任務 Modal
 */
function openAddTaskModal() {
    if (!currentCourseId) {
        showToast('請先選擇課程', 'warning');
        return;
    }

    // 重置表單
    document.getElementById('newTaskName').value = '';
    document.getElementById('newTaskTimeLimit').value = '0';
    document.getElementById('newTaskTokenReward').value = '100';
    document.getElementById('tutorialDesc').value = '';
    document.getElementById('tutorialLink').value = '';
    document.getElementById('adventureDesc').value = '';
    document.getElementById('adventureLink').value = '';
    document.getElementById('hardcoreDesc').value = '';
    document.getElementById('hardcoreLink').value = '';

    // 恢復 Modal 標題和按鈕（防止之前編輯模式的狀態殘留）
    document.querySelector('#addTaskModal h2').textContent = '新增任務';
    const submitBtn = document.querySelector('#addTaskModal button[onclick*="handleAddTask"]');
    if (submitBtn) {
        submitBtn.textContent = '新增任務';
        submitBtn.onclick = handleAddTask;
    }

    // 切換到 Tutorial 標籤
    const firstTab = document.querySelector('.tab');
    switchTaskTab('tutorial', firstTab);

    openModal('addTaskModal');
}

/**
 * 切換任務 Modal 標籤
 */
function switchTaskTab(tabName, clickedButton) {
    // 隱藏所有標籤內容
    const allContents = document.querySelectorAll('.tab-content');
    allContents.forEach(tab => {
        tab.classList.remove('active');
    });

    // 移除所有標籤按鈕的 active 類
    const allTabs = document.querySelectorAll('.tab');
    allTabs.forEach(tab => {
        tab.classList.remove('active');
    });

    // 顯示目標標籤內容
    const targetTab = document.getElementById(tabName + 'Tab');
    if (targetTab) {
        targetTab.classList.add('active');
    }

    // 激活對應的按鈕
    if (clickedButton) {
        clickedButton.classList.add('active');
    }
}

/**
 * 處理新增任務
 */
function handleAddTask() {
    const name = document.getElementById('newTaskName').value.trim();
    const timeLimit = parseInt(document.getElementById('newTaskTimeLimit').value) || 0;
    const tokenReward = parseInt(document.getElementById('newTaskTokenReward').value) || 100;
    
    if (!name) {
        showToast('請輸入任務名稱', 'warning');
        return;
    }
    
    if (!currentCourseId) {
        showToast('課程 ID 遺失', 'error');
        return;
    }
    
    // 收集各層級的資料
    const taskData = {
        taskName: name,
        timeLimit: timeLimit,
        tokenReward: tokenReward,
        tutorialDesc: document.getElementById('tutorialDesc').value.trim(),
        tutorialLink: document.getElementById('tutorialLink').value.trim(),
        adventureDesc: document.getElementById('adventureDesc').value.trim(),
        adventureLink: document.getElementById('adventureLink').value.trim(),
        hardcoreDesc: document.getElementById('hardcoreDesc').value.trim(),
        hardcoreLink: document.getElementById('hardcoreLink').value.trim()
    };

    const btn = event.target;
    btn.disabled = true;
    btn.textContent = '新增中...';

    const params = new URLSearchParams({
        action: 'addTaskToCourse',
        courseId: currentCourseId,
        taskData: JSON.stringify(taskData)
    });
    
    console.log('📤 新增任務...');
    
    fetch(`${APP_CONFIG.API_URL}?${params.toString()}`)
        .then(response => response.json())
        .then(function(response) {
            btn.disabled = false;
            btn.textContent = '新增任務';
            
            console.log('📥 新增任務回應:', response);
            
            if (response.success) {
                showToast(`任務「${name}」新增成功！`, 'success');
                closeModal('addTaskModal');
                
                setTimeout(() => {
                    loadCourseTasks(currentCourseId);
                }, 500);
            } else {
                showToast(response.message || '新增失敗', 'error');
            }
        })
        .catch(function(error) {
            btn.disabled = false;
            btn.textContent = '新增任務';
            
            console.error('新增任務失敗:', error);
            showToast('新增任務失敗：' + error.message, 'error');
        });
}

/**
 * 編輯任務
 */
function editTask(taskId) {
    // 顯示載入提示
    showToast('載入任務資料中...', 'info');

    const task = currentTasks.find(t => t.taskId === taskId);
    if (!task) {
        showToast('找不到任務', 'error');
        return;
    }

    // 填入表單
    document.getElementById('newTaskName').value = task.taskName || '';
    document.getElementById('newTaskTimeLimit').value = task.timeLimit || 0;
    document.getElementById('newTaskTokenReward').value = task.tokenReward || 100;
    document.getElementById('tutorialDesc').value = task.tutorialDesc || '';
    document.getElementById('tutorialLink').value = task.tutorialLink || '';
    document.getElementById('adventureDesc').value = task.adventureDesc || '';
    document.getElementById('adventureLink').value = task.adventureLink || '';
    document.getElementById('hardcoreDesc').value = task.hardcoreDesc || '';
    document.getElementById('hardcoreLink').value = task.hardcoreLink || '';

    // 切換到 Tutorial 標籤
    switchTaskTab('tutorial', document.querySelector('.tab'));

    // 修改 Modal 標題和按鈕
    document.querySelector('#addTaskModal h2').textContent = '編輯任務';
    const submitBtn = document.querySelector('#addTaskModal button[onclick*="handleAddTask"]');
    if (submitBtn) {
        submitBtn.textContent = '更新任務';
        submitBtn.onclick = function() { handleUpdateTask(taskId); };
    }

    openModal('addTaskModal');
}

/**
 * 處理更新任務
 */
function handleUpdateTask(taskId) {
    const name = document.getElementById('newTaskName').value.trim();
    const timeLimit = parseInt(document.getElementById('newTaskTimeLimit').value) || 0;
    const tokenReward = parseInt(document.getElementById('newTaskTokenReward').value) || 100;

    if (!name) {
        showToast('請輸入任務名稱', 'warning');
        return;
    }

    const taskData = {
        taskName: name,
        timeLimit: timeLimit,
        tokenReward: tokenReward,
        tutorialDesc: document.getElementById('tutorialDesc').value.trim(),
        tutorialLink: document.getElementById('tutorialLink').value.trim(),
        adventureDesc: document.getElementById('adventureDesc').value.trim(),
        adventureLink: document.getElementById('adventureLink').value.trim(),
        hardcoreDesc: document.getElementById('hardcoreDesc').value.trim(),
        hardcoreLink: document.getElementById('hardcoreLink').value.trim()
    };

    const btn = event.target;
    btn.disabled = true;
    btn.textContent = '更新中...';

    const params = new URLSearchParams({
        action: 'updateTask',
        taskId: taskId,
        taskData: JSON.stringify(taskData)
    });

    console.log('📤 更新任務...');

    fetch(`${APP_CONFIG.API_URL}?${params.toString()}`)
        .then(response => response.json())
        .then(function(response) {
            btn.disabled = false;
            btn.textContent = '更新任務';

            console.log('📥 更新任務回應:', response);

            if (response.success) {
                showToast('任務更新成功！', 'success');
                closeModal('addTaskModal');

                // 恢復 Modal 標題和按鈕
                document.querySelector('#addTaskModal h2').textContent = '新增任務';
                btn.textContent = '新增任務';
                btn.onclick = handleAddTask;

                setTimeout(() => {
                    loadCourseTasks(currentCourseId);
                }, 500);
            } else {
                showToast(response.message || '更新失敗', 'error');
            }
        })
        .catch(function(error) {
            btn.disabled = false;
            btn.textContent = '更新任務';

            console.error('更新任務失敗:', error);
            showToast('更新任務失敗：' + error.message, 'error');
        });
}

/**
 * 刪除任務
 */
function deleteTask(taskId, taskName) {
    if (!confirm(`確定要刪除任務「${taskName}」嗎？\n此操作無法復原！`)) {
        return;
    }

    const params = new URLSearchParams({
        action: 'deleteTask',
        taskId: taskId,
        courseId: currentCourseId
    });

    console.log('📤 刪除任務...');

    fetch(`${APP_CONFIG.API_URL}?${params.toString()}`)
        .then(response => response.json())
        .then(function(response) {
            console.log('📥 刪除任務回應:', response);

            if (response.success) {
                showToast('任務刪除成功！', 'success');
                setTimeout(() => {
                    loadCourseTasks(currentCourseId);
                }, 500);
            } else {
                showToast(response.message || '刪除失敗', 'error');
            }
        })
        .catch(function(error) {
            console.error('刪除任務失敗:', error);
            showToast('刪除任務失敗：' + error.message, 'error');
        });
}

/**
 * 編輯課程
 */
function editCourse(courseId) {
    // 顯示載入提示
    showToast('載入課程資料中...', 'info');

    // 找到課程資料
    const params = new URLSearchParams({
        action: 'getCourseDetails',
        courseId: courseId
    });

    fetch(`${APP_CONFIG.API_URL}?${params.toString()}`)
        .then(response => response.json())
        .then(function(response) {
            if (response.success && response.courseInfo) {
                const course = response.courseInfo;

                // 填入表單
                document.getElementById('newCourseName').value = course.courseName || '';
                document.getElementById('newCourseDesc').value = course.description || '';

                // 修改 Modal 標題和按鈕
                document.querySelector('#createCourseModal h2').textContent = '編輯課程';
                const submitBtn = document.querySelector('#createCourseModal button[onclick*="handleCreateCourse"]');
                if (submitBtn) {
                    submitBtn.textContent = '更新課程';
                    submitBtn.onclick = function() { handleUpdateCourse(courseId); };
                }

                openModal('createCourseModal');
            } else {
                showToast('載入課程資料失敗', 'error');
            }
        })
        .catch(function(error) {
            console.error('載入課程失敗:', error);
            showToast('載入課程失敗：' + error.message, 'error');
        });
}

/**
 * 處理更新課程
 */
function handleUpdateCourse(courseId) {
    const name = document.getElementById('newCourseName').value.trim();
    const desc = document.getElementById('newCourseDesc').value.trim();

    if (!name) {
        showToast('請輸入課程名稱', 'warning');
        return;
    }

    const btn = event.target;
    btn.disabled = true;
    btn.textContent = '更新中...';

    const params = new URLSearchParams({
        action: 'updateCourse',
        courseId: courseId,
        name: name,
        description: desc
    });

    console.log('📤 更新課程...');

    fetch(`${APP_CONFIG.API_URL}?${params.toString()}`)
        .then(response => response.json())
        .then(function(response) {
            btn.disabled = false;
            btn.textContent = '更新課程';

            console.log('📥 更新課程回應:', response);

            if (response.success) {
                showToast('課程更新成功！', 'success');
                closeModal('createCourseModal');

                // 恢復 Modal 標題和按鈕
                document.querySelector('#createCourseModal h2').textContent = '建立新課程';
                btn.textContent = '建立課程';
                btn.onclick = handleCreateCourse;

                setTimeout(() => {
                    loadCourses();
                }, 500);
            } else {
                showToast(response.message || '更新失敗', 'error');
            }
        })
        .catch(function(error) {
            btn.disabled = false;
            btn.textContent = '更新課程';

            console.error('更新課程失敗:', error);
            showToast('更新課程失敗：' + error.message, 'error');
        });
}

/**
 * 刪除課程
 */
function deleteCourse(courseId, courseName) {
    if (!confirm(`確定要刪除課程「${courseName}」嗎？\n此操作將同時刪除所有相關任務，且無法復原！`)) {
        return;
    }

    const params = new URLSearchParams({
        action: 'deleteCourse',
        courseId: courseId
    });

    console.log('📤 刪除課程...');

    fetch(`${APP_CONFIG.API_URL}?${params.toString()}`)
        .then(response => response.json())
        .then(function(response) {
            console.log('📥 刪除課程回應:', response);

            if (response.success) {
                showToast('課程刪除成功！', 'success');
                setTimeout(() => {
                    loadCourses();
                }, 500);
            } else {
                showToast(response.message || '刪除失敗', 'error');
            }
        })
        .catch(function(error) {
            console.error('刪除課程失敗:', error);
            showToast('刪除課程失敗：' + error.message, 'error');
        });
}

// ==========================================
// 工具函數
// ==========================================

/**
 * HTML 轉義
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

/**
 * 格式化日期
 */
function formatDate(dateStr) {
    try {
        const date = new Date(dateStr);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    } catch (e) {
        return '(日期格式錯誤)';
    }
}

console.log('✅ course.js 載入完成');