/* ==========================================
   課程管理 - course.js
   ========================================== */

// 全域變數
let currentCourseId = null;
let currentCourseName = null;
let currentCourse = null;
let currentTasks = [];
let editorTaskId = null;
let editorChecklistItems = [];
let editorQuestions = [];

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
                    ＋ 建立新課程
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
        card.className = 'card course-card';

        const courseId = course.courseId || course.course_id;
        const courseName = course.courseName || course.name || '未命名課程';
        const description = course.description || course.courseDesc || '(無說明)';
        const createdAt = course.createDate || course.createdAt || course.create_date || new Date().toISOString();
        
        card.innerHTML = `
            <div class="card-header">
                <div>
                    <div class="card-title">${escapeHtml(courseName)}</div>
                    <div style="font-size: 14px; color: #95A5A6; margin-top: 4px;">
                        ${escapeHtml(description)}
                    </div>
                </div>
                <div class="card-badge">課程</div>
            </div>
            <div class="card-meta">
                <div class="card-meta-item">
                    <span class="card-meta-icon">📅</span>
                    <span>${formatDate(createdAt)}</span>
                </div>
            </div>
            <div class="card-actions">
                <button class="btn btn-primary" onclick="viewCourseTasks('${courseId}', '${escapeHtml(courseName)}')">查看任務</button>
                <button class="btn btn-secondary" onclick="editCourse('${courseId}')">編輯</button>
                <button class="btn btn-danger" onclick="deleteCourse('${courseId}', '${escapeHtml(courseName)}')">刪除</button>
            </div>
        `;
        
        grid.appendChild(card);
    });
}

// ==========================================
// 建立課程

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
    if (!courseId) {
        showToast('課程 ID 遺失，無法載入課程詳情', 'error');
        return;
    }

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
    if (!courseId) {
        hideLoading('taskLoading');
        showToast('課程 ID 遺失，無法載入課程詳情', 'error');
        return;
    }

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
                <div class="empty-state-icon">[空]</div>
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
        item.dataset.taskId = task.taskId;

        const hasTutorial = task.tutorialDesc || task.tutorialLink;
        const hasAdventure = task.adventureDesc || task.adventureLink;
        const hasHardcore = task.hardcoreDesc || task.hardcoreLink;

        let tierBadges = '';
        if (hasTutorial) tierBadges += '<span style="background:#10B981;color:white;padding:2px 8px;border-radius:4px;font-size:12px;margin-right:4px;">基礎</span>';
        if (hasAdventure) tierBadges += '<span style="background:#F59E0B;color:white;padding:2px 8px;border-radius:4px;font-size:12px;margin-right:4px;">進階</span>';
        if (hasHardcore) tierBadges += '<span style="background:#EF4444;color:white;padding:2px 8px;border-radius:4px;font-size:12px;">困難</span>';

        item.innerHTML = `
            <div class="task-sequence">${index + 1}</div>
            <div class="task-info">
                <div class="task-name">${escapeHtml(task.taskName || task.name || '(無名稱)')}</div>
                <div class="task-meta">
                    ${tierBadges}
                    <br>
                    獎勵: ${task.tokenReward || 100} 代幣
                    ${task.timeLimit ? ` | 時限: ${task.timeLimit} 秒` : ' | 無時限'}
                </div>
            </div>
            <div class="task-actions">
                <button class="btn-icon" title="編輯" onclick="editTask('${task.taskId}')">✎</button>
                <button class="btn-icon" title="內容" onclick="openTaskContentEditor('${task.taskId}', '${escapeHtml(task.taskName || task.name || '')}')">📄</button>
                <button class="btn-icon" title="刪除" onclick="deleteTask('${task.taskId}', '${escapeHtml(task.taskName || task.name || '')}')">🗑️</button>
            </div>
        `;

        container.appendChild(item);
    });
}

// 開啟任務內容編輯（參考答案 / 檢核 / 題庫）
let currentTaskContentId = null;
function openTaskContentEditor(taskId, taskName) {
    currentTaskContentId = taskId;
    editorTaskId = taskId;
    const modal = document.getElementById('taskEditorModal');
    if (!modal) {
        showToast('內容編輯介面尚未載入', 'warning');
        return;
    }

    const titleEl = modal.querySelector('.modal-title');
    if (titleEl) {
        titleEl.textContent = taskName ? `任務編輯 - ${taskName}` : '任務編輯';
    }

    // 預設切回第一個 Tab
    const tabs = modal.querySelectorAll('#taskEditorModal .tab');
    const contents = modal.querySelectorAll('#taskEditorModal .tab-content');
    tabs.forEach((btn, idx) => btn.classList.toggle('active', idx === 0));
    contents.forEach((c, idx) => {
        c.classList.toggle('active', idx === 0);
        c.style.display = idx === 0 ? 'block' : 'none';
    });

    // 載入既有資料
    loadTaskContentEditorData(taskId);

    openModal('taskEditorModal');
}

/**
 * 切換任務內容編輯的內部標籤（參考答案 / 檢核項 / 題庫）
 * 只作用於 taskEditorModal，以免影響其他使用 .tab 的區塊
 */
function switchTaskEditorTab(tabName, clickedButton) {
    const modal = document.getElementById('taskEditorModal');
    if (!modal) {
        console.warn('taskEditorModal not found when switching tabs');
        return;
    }

    // 切換按鈕的 active 樣式
    modal.querySelectorAll('.tab').forEach(btn => btn.classList.remove('active'));
    if (clickedButton) {
        clickedButton.classList.add('active');
    }

    // 切換對應內容顯示
    ['reference', 'checklist', 'questions'].forEach(name => {
        const content = document.getElementById(`${name}Tab`);
        if (!content) return;
        const isActive = name === tabName;
        content.classList.toggle('active', isActive);
        content.style.display = isActive ? 'block' : 'none';
    });
}

/**
 * 取得並渲染任務的參考答案 / 檢核項目 / 題庫
 */
async function loadTaskContentEditorData(taskId) {
    if (!taskId) {
        showToast('任務 ID 遺失，無法載入內容', 'error');
        return;
    }

    try {
        const params = new URLSearchParams({
            action: 'getTaskDetailsForEditor',
            taskId: taskId
        });
        const res = await fetch(`${APP_CONFIG.API_URL}?${params.toString()}`);
        const data = await res.json();
        if (!data.success) {
            showToast(data.message || '載入任務內容失敗', 'error');
            return;
        }

        // 參考答案
        document.getElementById('editorReferenceAnswer').value = data.referenceAnswer ? data.referenceAnswer.answerText || '' : '';
        const imgs = data.referenceAnswer && data.referenceAnswer.answerImages ? data.referenceAnswer.answerImages : [];
        document.getElementById('editorReferenceImages').value = Array.isArray(imgs) ? imgs.join('\n') : (imgs || '');

        // 檢核項目
        editorChecklistItems = Array.isArray(data.checklists) ? data.checklists.map((c, idx) => ({
            checklistId: c.checklistId || c.checklist_id || `tmp_${Date.now()}_${idx}`,
            itemOrder: c.itemOrder || c.item_order || idx + 1,
            itemTitle: c.itemTitle || c.item_title || '',
            itemDescription: c.itemDescription || c.item_description || ''
        })) : [];
        renderChecklistEditor();

        // 題庫
        editorQuestions = Array.isArray(data.questions) ? data.questions.map((q, idx) => ({
            questionId: q.questionId || q.question_id || `tmp_q_${Date.now()}_${idx}`,
            questionText: q.questionText || q.question_text || '',
            optionA: q.optionA || q.option_a || '',
            optionB: q.optionB || q.option_b || '',
            optionC: q.optionC || q.option_c || '',
            optionD: q.optionD || q.option_d || '',
            correctAnswer: q.correctAnswer || q.correct_answer || 'A'
        })) : [];
        renderQuestionsEditor();
    } catch (err) {
        console.error(err);
        showToast('載入任務內容失敗：' + err.message, 'error');
    }
}

// ==============================
// 檢核項目編輯
// ==============================
function renderChecklistEditor() {
    const container = document.getElementById('editorChecklistContainer');
    if (!container) return;
    container.innerHTML = '';

    if (!editorChecklistItems.length) {
        container.innerHTML = '<div style="color:#94a3b8;">目前沒有檢核項目，點擊下方「新增檢核項目」</div>';
        return;
    }

    editorChecklistItems
        .sort((a, b) => (a.itemOrder || 0) - (b.itemOrder || 0))
        .forEach((item, idx) => {
            const card = document.createElement('div');
            card.className = 'list-item';
            card.style.padding = '12px';
            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <div style="font-weight:600; color:#334155;">檢核項目 ${idx + 1}</div>
                    <button class="btn btn-secondary" style="padding:6px 10px;" onclick="removeChecklistItem('${item.checklistId}')">刪除</button>
                </div>
                <div class="form-group" style="margin-bottom:8px;">
                    <label class="form-label">標題</label>
                    <input type="text" class="form-input" value="${item.itemTitle || ''}" data-id="${item.checklistId}" data-field="itemTitle">
                </div>
                <div class="form-group" style="margin-bottom:0;">
                    <label class="form-label">說明</label>
                    <textarea class="form-textarea" rows="2" data-id="${item.checklistId}" data-field="itemDescription">${item.itemDescription || ''}</textarea>
                </div>
            `;
            container.appendChild(card);
        });

    // 綁定變更事件
    container.querySelectorAll('input[data-id], textarea[data-id]').forEach(el => {
        el.addEventListener('input', (e) => {
            const id = e.target.getAttribute('data-id');
            const field = e.target.getAttribute('data-field');
            const target = editorChecklistItems.find(c => c.checklistId === id);
            if (target) {
                target[field] = e.target.value;
            }
        });
    });
}

function addChecklistItem() {
    editorChecklistItems.push({
        checklistId: `tmp_${Date.now()}`,
        itemOrder: editorChecklistItems.length + 1,
        itemTitle: '',
        itemDescription: ''
    });
    renderChecklistEditor();
}

function removeChecklistItem(id) {
    editorChecklistItems = editorChecklistItems.filter(c => c.checklistId !== id);
    renderChecklistEditor();
}

// ==============================
// 題庫編輯
// ==============================
function renderQuestionsEditor() {
    const container = document.getElementById('editorQuestionsContainer');
    if (!container) return;
    container.innerHTML = '';

    if (!editorQuestions.length) {
        container.innerHTML = '<div style="color:#94a3b8;">目前沒有題目，點擊下方「新增題目」</div>';
        return;
    }

    editorQuestions.forEach((q, idx) => {
        const card = document.createElement('div');
        card.className = 'list-item';
        card.style.padding = '12px';
        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <div style="font-weight:600; color:#334155;">題目 ${idx + 1}</div>
                <button class="btn btn-secondary" style="padding:6px 10px;" onclick="removeQuestionCard('${q.questionId}')">刪除</button>
            </div>
            <div class="form-group">
                <label class="form-label">題目</label>
                <textarea class="form-textarea" rows="2" data-id="${q.questionId}" data-field="questionText">${q.questionText || ''}</textarea>
            </div>
            <div class="form-group">
                <label class="form-label">選項 A</label>
                <input type="text" class="form-input" data-id="${q.questionId}" data-field="optionA" value="${q.optionA || ''}">
            </div>
            <div class="form-group">
                <label class="form-label">選項 B</label>
                <input type="text" class="form-input" data-id="${q.questionId}" data-field="optionB" value="${q.optionB || ''}">
            </div>
            <div class="form-group">
                <label class="form-label">選項 C</label>
                <input type="text" class="form-input" data-id="${q.questionId}" data-field="optionC" value="${q.optionC || ''}">
            </div>
            <div class="form-group">
                <label class="form-label">選項 D</label>
                <input type="text" class="form-input" data-id="${q.questionId}" data-field="optionD" value="${q.optionD || ''}">
            </div>
            <div class="form-group" style="margin-bottom:0;">
                <label class="form-label">正確答案 (A/B/C/D)</label>
                <input type="text" class="form-input" data-id="${q.questionId}" data-field="correctAnswer" value="${q.correctAnswer || 'A'}" maxlength="1">
            </div>
        `;
        container.appendChild(card);
    });

    container.querySelectorAll('input[data-id], textarea[data-id]').forEach(el => {
        el.addEventListener('input', (e) => {
            const id = e.target.getAttribute('data-id');
            const field = e.target.getAttribute('data-field');
            const target = editorQuestions.find(q => q.questionId === id);
            if (target) {
                target[field] = e.target.value;
            }
        });
    });
}

function addNewQuestionCard() {
    editorQuestions.push({
        questionId: `tmp_q_${Date.now()}`,
        questionText: '',
        optionA: '',
        optionB: '',
        optionC: '',
        optionD: '',
        correctAnswer: 'A'
    });
    renderQuestionsEditor();
}

function removeQuestionCard(id) {
    editorQuestions = editorQuestions.filter(q => q.questionId !== id);
    renderQuestionsEditor();
}

/**
 * 儲存任務內容（參考答案 / 檢核 / 題庫）
 */
async function saveAllTaskEditorChanges() {
    if (!editorTaskId) {
        showToast('任務 ID 遺失，請重新開啟編輯視窗', 'error');
        return;
    }

    try {
        showToast('儲存中...', 'info');

        // 參考答案
        const refAnswer = document.getElementById('editorReferenceAnswer').value.trim();
        const refImagesRaw = document.getElementById('editorReferenceImages').value.trim();
        const refImages = refImagesRaw ? refImagesRaw.split(/\\r?\\n/).filter(Boolean) : [];

        await fetch(APP_CONFIG.API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'saveTaskReferenceAnswer',
                taskId: editorTaskId,
                answerText: refAnswer,
                answerImages: refImages
            })
        });

        // 檢核項目
        const checklistPayload = editorChecklistItems.map((c, idx) => ({
            checklistId: c.checklistId,
            itemOrder: idx + 1,
            itemTitle: c.itemTitle || '',
            itemDescription: c.itemDescription || ''
        }));

        await fetch(APP_CONFIG.API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'saveTaskChecklist',
                taskId: editorTaskId,
                checklists: checklistPayload
            })
        });

        // 題庫
        const questionsPayload = editorQuestions.map((q) => ({
            questionId: q.questionId,
            questionText: q.questionText || '',
            optionA: q.optionA || '',
            optionB: q.optionB || '',
            optionC: q.optionC || '',
            optionD: q.optionD || '',
            correctAnswer: (q.correctAnswer || 'A').toUpperCase()
        }));

        await fetch(APP_CONFIG.API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'saveTaskQuestions',
                taskId: editorTaskId,
                questions: questionsPayload
            })
        });

        showToast('已儲存任務內容', 'success');
        closeModal('taskEditorModal');
        // 重新載入任務列表以反映可能的更新
        if (currentCourseId) {
            loadCourseTasks(currentCourseId);
        }
    } catch (err) {
        console.error(err);
        showToast('儲存失敗：' + err.message, 'error');
    }
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
    document.getElementById('newTaskTimeLimit').value = '';
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
    const timeLimitRaw = document.getElementById('newTaskTimeLimit').value;
    const timeLimit = parseInt(timeLimitRaw, 10);
    const tokenReward = parseInt(document.getElementById('newTaskTokenReward').value) || 100;
    
    if (!name) {
        showToast('請輸入任務名稱', 'warning');
        return;
    }

    if (Number.isNaN(timeLimit) || timeLimit <= 0) {
        showToast('請輸入大於 0 的時間限制（秒）', 'warning');
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
    const timeLimitRaw = document.getElementById('newTaskTimeLimit').value;
    const timeLimit = parseInt(timeLimitRaw, 10);
    const tokenReward = parseInt(document.getElementById('newTaskTokenReward').value) || 100;

    if (!name) {
        showToast('請輸入任務名稱', 'warning');
        return;
    }

    if (Number.isNaN(timeLimit) || timeLimit <= 0) {
        showToast('請輸入大於 0 的時間限制（秒）', 'warning');
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


