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
    APP_CONFIG.log('📚 課程管理模組初始化');
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

    APP_CONFIG.log('📤 載入課程列表...');

    fetch(`${APP_CONFIG.API_URL}?${params.toString()}`)
        .then(response => response.json())
        .then(function(response) {
            APP_CONFIG.log('📥 課程列表回應:', response);

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
    
    APP_CONFIG.log('📤 建立課程...');

    fetch(`${APP_CONFIG.API_URL}?${params.toString()}`)
        .then(response => response.json())
        .then(function(response) {
            btn.disabled = false;
            btn.textContent = '建立課程';

            APP_CONFIG.log('📥 建立課程回應:', response);
            
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
    
    APP_CONFIG.log('📤 載入課程任務...');

    fetch(`${APP_CONFIG.API_URL}?${params.toString()}`)
        .then(response => response.json())
        .then(function(response) {
            hideLoading('taskLoading');

            APP_CONFIG.log('📥 課程任務回應:', response);

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
       item.dataset.taskId = task.taskId; // ✓ 新增：儲存 taskId

       // ✅ 新增：顯示任務包含哪些層級
       const hasTutorial = task.tutorialDesc || task.tutorialLink;
       const hasAdventure = task.adventureDesc || task.adventureLink;
       const hasHardcore = task.hardcoreDesc || task.hardcoreLink;

       let tierBadges = '';
       if (hasTutorial) tierBadges += '<span style="background:#10B981;color:white;padding:2px 8px;border-radius:4px;font-size:12px;margin-right:4px;">📘 基礎</span>';
       if (hasAdventure) tierBadges += '<span style="background:#F59E0B;color:white;padding:2px 8px;border-radius:4px;font-size:12px;margin-right:4px;">📙 進階</span>';
       if (hasHardcore) tierBadges += '<span style="background:#EF4444;color:white;padding:2px 8px;border-radius:4px;font-size:12px;">📕 精通</span>';

       item.innerHTML = `
           <div class="task-sequence">${index + 1}</div>
           <div class="task-info">
               <div class="task-name">${escapeHtml(task.taskName || task.name || '(無名稱)')}</div>
               <div class="task-meta">
                   ${tierBadges}
                   <br>
                   💰 獎勵: ${task.tokenReward || 100} 代幣
                   ${task.timeLimit ? ` | ⏱️ 時限: ${task.timeLimit} 分鐘` : ' | ⏱️ 無時限'}
               </div>
           </div>
           <div class="task-actions">
               <button class="btn-icon" onclick="openTaskEditor('${task.taskId}')">📚</button>
               <button class="btn-icon" onclick="editTask('${task.taskId}')">✏️</button>
               <button class="btn-icon" onclick="deleteTask('${task.taskId}', '${escapeHtml(task.taskName || task.name || '')}')">🗑️</button>
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
    document.getElementById('newTaskSequence').value = ''; // ✓ 新增：重置排序
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
    
    APP_CONFIG.log('📤 新增任務...');
    
    fetch(`${APP_CONFIG.API_URL}?${params.toString()}`)
        .then(response => response.json())
        .then(function(response) {
            btn.disabled = false;
            btn.textContent = '新增任務';
            
            APP_CONFIG.log('📥 新增任務回應:', response);
            
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
    document.getElementById('newTaskName').value = task.taskName || task.name || '';
    document.getElementById('newTaskSequence').value = task.sequence || ''; // ✓ 新增：填入排序
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
    const sequence = parseInt(document.getElementById('newTaskSequence').value); // ✓ 新增：讀取排序
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

    // ✓ 新增：如果有輸入排序，則加入 taskData
    if (!isNaN(sequence) && sequence > 0) {
        taskData.sequence = sequence;
    }

    const btn = event.target;
    btn.disabled = true;
    btn.textContent = '更新中...';

    const params = new URLSearchParams({
        action: 'updateTask',
        taskId: taskId,
        taskData: JSON.stringify(taskData)
    });

    APP_CONFIG.log('📤 更新任務...');

    fetch(`${APP_CONFIG.API_URL}?${params.toString()}`)
        .then(response => response.json())
        .then(function(response) {
            btn.disabled = false;
            btn.textContent = '更新任務';

            APP_CONFIG.log('📥 更新任務回應:', response);

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

    APP_CONFIG.log('📤 刪除任務...');

    fetch(`${APP_CONFIG.API_URL}?${params.toString()}`)
        .then(response => response.json())
        .then(function(response) {
            APP_CONFIG.log('📥 刪除任務回應:', response);

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

// ==========================================
// 任務 Editor：前端介面與 API 呼叫
// ==========================================

let currentEditorTaskId = null;

function openTaskEditor(taskId) {
    currentEditorTaskId = taskId;
    showLoading('taskLoading');

    const params = new URLSearchParams({
        action: 'getTaskDetailsForEditor',
        taskId: taskId
    });

    fetch(`${APP_CONFIG.API_URL}?${params.toString()}`)
        .then(r => r.json())
        .then(function(resp) {
            hideLoading('taskLoading');
            if (!resp.success) {
                showToast(resp.message || '載入任務資料失敗', 'error');
                return;
            }

            // 參考答案
                    document.getElementById('editorReferenceAnswer').value = resp.referenceAnswer ? (resp.referenceAnswer.answerText || '') : '';
                    // 載入圖片欄位，若後端回傳陣列則換行顯示
                    const images = resp.referenceAnswer && resp.referenceAnswer.answerImages ? resp.referenceAnswer.answerImages : [];
                    document.getElementById('editorReferenceImages').value = Array.isArray(images) ? images.join('\n') : (images || '');

            // 檢核項目
            renderChecklist(resp.checklists || []);

            // 題庫
            renderQuestions(resp.questions || []);

            // 顯示 Modal
            openModal('taskEditorModal');
        })
        .catch(function(error) {
            hideLoading('taskLoading');
            console.error('載入任務資料失敗:', error);
            showToast('載入任務資料失敗：' + error.message, 'error');
        });
}

function switchTaskEditorTab(tab, el) {
    document.querySelectorAll('#taskEditorModal .tab').forEach(t => t.classList.remove('active'));
    el.classList.add('active');

    document.getElementById('referenceTab').style.display = tab === 'reference' ? 'block' : 'none';
    document.getElementById('checklistTab').style.display = tab === 'checklist' ? 'block' : 'none';
    document.getElementById('questionsTab').style.display = tab === 'questions' ? 'block' : 'none';
}

function renderChecklist(items) {
    const container = document.getElementById('editorChecklistContainer');
    container.innerHTML = '';
    items.forEach(item => {
        const idx = items.indexOf(item);
        const div = document.createElement('div');
        div.className = 'form-group checklist-item';
        div.dataset.checklistId = item.checklistId || '';
        div.innerHTML = `
            <input type="text" class="form-input checklist-desc" value="${escapeHtml(item.itemDescription || '')}" placeholder="檢核項目描述">
            <div style="margin-top:6px; display:flex; gap:8px;">
                <input type="number" class="form-input" value="${item.itemOrder || idx+1}" style="width:100px;" />
                <button class="btn btn-danger" onclick="removeChecklistItem(this)">刪除</button>
            </div>
        `;
        container.appendChild(div);
    });
}

function addChecklistItem() {
    const container = document.getElementById('editorChecklistContainer');
    const div = document.createElement('div');
    div.className = 'form-group checklist-item';
    div.innerHTML = `
        <input type="text" class="form-input checklist-desc" value="" placeholder="檢核項目描述">
        <div style="margin-top:6px; display:flex; gap:8px;">
            <input type="number" class="form-input" value="1" style="width:100px;" />
            <button class="btn btn-danger" onclick="removeChecklistItem(this)">刪除</button>
        </div>
    `;
    container.appendChild(div);
}

function removeChecklistItem(btn) {
    const row = btn.closest('.checklist-item');
    if (row) row.remove();
}

function renderQuestions(questions) {
    const container = document.getElementById('editorQuestionsContainer');
    container.innerHTML = '';
    questions.forEach(q => {
        const div = document.createElement('div');
        div.className = 'question-card';
        div.dataset.questionId = q.questionId || '';
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <strong>${escapeHtml(q.questionText || '(無題目)')}</strong>
                <div>
                    <button class="btn btn-secondary" onclick="editQuestion(this)">編輯</button>
                    <button class="btn btn-danger" onclick="deleteQuestion('${q.questionId || ''}')">刪除</button>
                </div>
            </div>
            <div style="margin-top:6px; color:#666;">選項：${escapeHtml((q.optionA||'') + ' | ' + (q.optionB||'') + ' | ' + (q.optionC||'') + ' | ' + (q.optionD||''))}</div>
        `;
        container.appendChild(div);
    });
}

function openQuestionEditor(existing) {
    // 簡易 prompt 介面（可後續改成完整 modal）
    const questionText = prompt('題目：', existing ? existing.questionText : '');
    if (questionText === null) return;
    const optionA = prompt('選項 A：', existing ? existing.optionA : '');
    if (optionA === null) return;
    const optionB = prompt('選項 B：', existing ? existing.optionB : '');
    if (optionB === null) return;
    const optionC = prompt('選項 C：', existing ? existing.optionC : '');
    if (optionC === null) return;
    const optionD = prompt('選項 D：', existing ? existing.optionD : '');
    if (optionD === null) return;
    const correct = prompt('正確答案（A/B/C/D）：', existing ? (existing.correctAnswer || 'A') : 'A');
    if (correct === null) return;

    const questionObj = {
        questionId: existing ? existing.questionId : null,
        questionText: questionText,
        optionA: optionA,
        optionB: optionB,
        optionC: optionC,
        optionD: optionD,
        correctAnswer: correct.toUpperCase()
    };

    // 立刻儲存單題（可改成批次）
    saveQuestion(questionObj);
}

function editQuestion(btn) {
    const card = btn.closest('.question-card');
    const qid = card.dataset.questionId;
    // 取得題目資料：以最簡方式呼叫後端取得該題目（或從目前畫面資料快取）
    const params = new URLSearchParams({ action: 'getTaskDetailsForEditor', taskId: currentEditorTaskId });
    fetch(`${APP_CONFIG.API_URL}?${params.toString()}`).then(r=>r.json()).then(resp=>{
        const q = (resp.questions||[]).find(x=>x.questionId===qid);
        if (q) openQuestionEditor(q);
    });
}

function saveQuestion(questionObj) {
    showLoading('taskLoading');
    const params = new URLSearchParams({
        action: 'addOrUpdateTaskQuestion',
        taskId: currentEditorTaskId,
        question: JSON.stringify(questionObj)
    });

    fetch(`${APP_CONFIG.API_URL}?${params.toString()}`)
        .then(r=>r.json())
        .then(resp=>{
            hideLoading('taskLoading');
            if (resp.success) {
                showToast('題目已儲存', 'success');
                // 重新載入題庫
                openTaskEditor(currentEditorTaskId);
            } else {
                showToast(resp.message || '儲存失敗', 'error');
            }
        }).catch(err=>{
            hideLoading('taskLoading');
            console.error(err);
            showToast('儲存失敗：' + err.message, 'error');
        });
}

function deleteQuestion(questionId) {
    if (!confirm('確定要刪除這題嗎？')) return;
    showLoading('taskLoading');
    const params = new URLSearchParams({ action: 'deleteTaskQuestion', questionId: questionId });
    fetch(`${APP_CONFIG.API_URL}?${params.toString()}`).then(r=>r.json()).then(resp=>{
        hideLoading('taskLoading');
        if (resp.success) {
            showToast('題目已刪除', 'success');
            openTaskEditor(currentEditorTaskId);
        } else {
            showToast(resp.message || '刪除失敗', 'error');
        }
    }).catch(err=>{ hideLoading('taskLoading'); showToast('刪除失敗：'+err.message,'error'); });
}

function saveChecklistToBackend() {
    const container = document.getElementById('editorChecklistContainer');
    const items = Array.from(container.querySelectorAll('.checklist-item')).map((el, idx) => ({
        checklistId: el.dataset.checklistId || null,
        itemDescription: el.querySelector('.checklist-desc').value.trim(),
        itemOrder: parseInt(el.querySelector('input[type="number"]').value) || (idx+1)
    }));

    showLoading('taskLoading');
    const params = new URLSearchParams({ action: 'saveTaskChecklist', taskId: currentEditorTaskId, checklists: JSON.stringify(items) });
    return fetch(`${APP_CONFIG.API_URL}?${params.toString()}`).then(r=>r.json()).then(resp=>{
        hideLoading('taskLoading');
        return resp;
    });
}

function saveReferenceToBackend() {
    const answerText = document.getElementById('editorReferenceAnswer').value.trim();
    // 收集圖片欄位（每行一個 URL），支援以逗號/分號或換行分隔
    const imagesRaw = document.getElementById('editorReferenceImages').value.trim();
    const imagesArray = imagesRaw ? imagesRaw.split(/\r?\n|,|;/).map(s=>s.trim()).filter(Boolean) : [];
    const imagesString = imagesArray.join('|');

    showLoading('taskLoading');
    const params = new URLSearchParams({ action: 'saveTaskReferenceAnswer', taskId: currentEditorTaskId, answerText: answerText, answerImages: imagesString });
    return fetch(`${APP_CONFIG.API_URL}?${params.toString()}`).then(r=>r.json()).then(resp=>{ hideLoading('taskLoading'); return resp; });
}

/**
 * 使用 POST 將圖片（base64）上傳到後端，後端會儲存到 Google Drive 並回傳可嵌入的連結
 */
function handleUploadReferenceImages() {
    const input = document.getElementById('editorImageFiles');
    if (!input || !input.files || input.files.length === 0) {
        showToast('請先選擇要上傳的圖片', 'warning');
        return;
    }

    const files = Array.from(input.files);
    // 逐一上傳
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const dataUrl = e.target.result; // data:<mime>;base64,xxxx
            const matches = dataUrl.match(/^data:(.+);base64,(.+)$/);
            if (!matches) {
                showToast('檔案讀取失敗：格式不正確', 'error');
                return;
            }
            const mime = matches[1];
            const b64 = matches[2];

            showLoading('taskLoading');
            fetch(APP_CONFIG.API_URL, {
                method: 'POST',
                body: JSON.stringify({ action: 'uploadReferenceImage', fileName: file.name, fileData: b64, fileMime: mime })
            }).then(r=>r.json()).then(resp=>{
                hideLoading('taskLoading');
                if (resp && resp.success && resp.url) {
                    // 把回傳連結加入到 textarea
                    const ta = document.getElementById('editorReferenceImages');
                    if (ta.value && ta.value.trim() !== '') ta.value = ta.value.trim() + '\n' + resp.url;
                    else ta.value = resp.url;

                    // 顯示預覽
                    addImagePreview(resp.url);
                    showToast('圖片上傳成功', 'success');
                } else {
                    console.error('uploadReferenceImage 回應：', resp);
                    showToast(resp.message || '上傳失敗', 'error');
                }
            }).catch(err=>{
                hideLoading('taskLoading');
                console.error(err);
                showToast('上傳失敗：' + err.message, 'error');
            });
        };
        reader.readAsDataURL(file);
    });
}

function addImagePreview(url) {
    const preview = document.getElementById('editorImagePreview');
    if (!preview) return;
    const img = document.createElement('img');
    img.src = url;
    img.style.width = '120px';
    img.style.height = '80px';
    img.style.objectFit = 'cover';
    img.style.border = '1px solid #ddd';
    img.style.borderRadius = '6px';
    preview.appendChild(img);
}

function saveAllTaskEditorChanges() {
    Promise.all([saveReferenceToBackend(), saveChecklistToBackend()]).then(results=>{
        const [refRes, checklistRes] = results;
        if ((refRes && refRes.success) && (checklistRes && checklistRes.success)) {
            showToast('所有變更已儲存', 'success');
            closeModal('taskEditorModal');
            // refresh tasks
            loadCourseTasks(currentCourseId);
        } else {
            showToast('部分儲存失敗，請重試', 'error');
        }
    }).catch(err=>{ console.error(err); showToast('儲存失敗：'+err.message,'error'); });
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

    APP_CONFIG.log('📤 更新課程...');

    fetch(`${APP_CONFIG.API_URL}?${params.toString()}`)
        .then(response => response.json())
        .then(function(response) {
            btn.disabled = false;
            btn.textContent = '更新課程';

            APP_CONFIG.log('📥 更新課程回應:', response);

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

    APP_CONFIG.log('📤 刪除課程...');

    fetch(`${APP_CONFIG.API_URL}?${params.toString()}`)
        .then(response => response.json())
        .then(function(response) {
            APP_CONFIG.log('📥 刪除課程回應:', response);

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

// ==========================================
// 拖放排序功能
// ==========================================

let isReorderMode = false;
let draggedElement = null;

/**
 * 切換重新排序模式
 */
function toggleReorderMode() {
    isReorderMode = !isReorderMode;
    const btn = document.getElementById('reorderModeBtn');
    const container = document.getElementById('taskListContainer');

    if (isReorderMode) {
        btn.textContent = '💾 儲存排序';
        btn.classList.remove('btn-secondary');
        btn.classList.add('btn-primary');

        // 啟用拖放
        enableDragAndDrop(container);
        showToast('拖放任務來調整順序，完成後點擊「儲存排序」', 'info');
    } else {
        btn.textContent = '📋 重新排序';
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-secondary');

        // 停用拖放
        disableDragAndDrop(container);

        // 儲存新順序
        saveTaskOrder();
    }
}

/**
 * 啟用拖放功能
 */
function enableDragAndDrop(container) {
    const taskItems = container.querySelectorAll('.task-item');

    taskItems.forEach((item) => {
        item.draggable = true;
        item.classList.add('draggable');

        // 拖放事件
        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragover', handleDragOver);
        item.addEventListener('drop', handleDrop);
        item.addEventListener('dragend', handleDragEnd);
        item.addEventListener('dragenter', handleDragEnter);
        item.addEventListener('dragleave', handleDragLeave);
    });
}

/**
 * 停用拖放功能
 */
function disableDragAndDrop(container) {
    const taskItems = container.querySelectorAll('.task-item');

    taskItems.forEach((item) => {
        item.draggable = false;
        item.classList.remove('draggable');

        // 移除事件監聽
        item.removeEventListener('dragstart', handleDragStart);
        item.removeEventListener('dragover', handleDragOver);
        item.removeEventListener('drop', handleDrop);
        item.removeEventListener('dragend', handleDragEnd);
        item.removeEventListener('dragenter', handleDragEnter);
        item.removeEventListener('dragleave', handleDragLeave);
    });
}

/**
 * 拖放事件處理
 */
function handleDragStart(e) {
    draggedElement = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleDragEnter(e) {
    if (this !== draggedElement) {
        this.classList.add('drag-over');
    }
}

function handleDragLeave(e) {
    this.classList.remove('drag-over');
}

function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }

    this.classList.remove('drag-over');

    if (draggedElement !== this) {
        // 交換位置
        const container = document.getElementById('taskListContainer');
        const allItems = [...container.children];
        const draggedIndex = allItems.indexOf(draggedElement);
        const targetIndex = allItems.indexOf(this);

        if (draggedIndex < targetIndex) {
            this.parentNode.insertBefore(draggedElement, this.nextSibling);
        } else {
            this.parentNode.insertBefore(draggedElement, this);
        }

        // 更新序號顯示
        updateTaskSequenceNumbers();
    }

    return false;
}

function handleDragEnd(e) {
    this.classList.remove('dragging');

    // 移除所有 drag-over 類
    const container = document.getElementById('taskListContainer');
    const taskItems = container.querySelectorAll('.task-item');
    taskItems.forEach((item) => {
        item.classList.remove('drag-over');
    });
}

/**
 * 更新任務序號顯示
 */
function updateTaskSequenceNumbers() {
    const container = document.getElementById('taskListContainer');
    const taskItems = container.querySelectorAll('.task-item');

    taskItems.forEach((item, index) => {
        const sequenceEl = item.querySelector('.task-sequence');
        if (sequenceEl) {
            sequenceEl.textContent = index + 1;
        }
    });
}

/**
 * 儲存任務順序
 */
function saveTaskOrder() {
    const container = document.getElementById('taskListContainer');
    const taskItems = container.querySelectorAll('.task-item');

    // 收集新的任務順序（task IDs）
    const taskOrder = [];
    taskItems.forEach((item) => {
        const taskId = item.dataset.taskId;
        if (taskId) {
            taskOrder.push(taskId);
        }
    });

    if (taskOrder.length === 0) {
        showToast('沒有任務需要排序', 'warning');
        return;
    }

    // 呼叫後端 API
    const params = new URLSearchParams({
        action: 'reorderTasks',
        courseId: currentCourseId,
        taskOrder: JSON.stringify(taskOrder)
    });

    showToast('儲存中...', 'info');

    fetch(`${APP_CONFIG.API_URL}?${params.toString()}`)
        .then(response => response.json())
        .then(function(response) {
            APP_CONFIG.log('📥 排序回應:', response);

            if (response.success) {
                showToast('任務排序已儲存！', 'success');

                // 重新載入任務列表
                setTimeout(() => {
                    loadCourseTasks(currentCourseId);
                }, 500);
            } else {
                showToast('儲存失敗：' + (response.message || '未知錯誤'), 'error');
            }
        })
        .catch(function(error) {
            console.error('儲存排序失敗:', error);
            showToast('儲存失敗：' + error.message, 'error');
        });
}


APP_CONFIG.log('✅ course.js 載入完成');
