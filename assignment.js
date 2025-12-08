/* ==========================================
   授課安排 - assignment.js
   ========================================== */

// 使用立即執行函數避免全域變數污染
(function() {
    'use strict';

    // 模組內部變數
    let assignmentUser = null;
    let assignmentClasses = [];
    let assignmentCourses = [];

    // ==========================================
    // 初始化
    // ==========================================

    document.addEventListener('DOMContentLoaded', function() {
        APP_CONFIG.log('📋 授課安排模組載入完成');
    });

    /**
     * 載入授課安排頁面（由 switchTab 調用）
     */
    window.loadAssignments = function() {
        APP_CONFIG.log('📋 載入授課安排頁面...');

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
            assignmentUser = JSON.parse(userJson);

            // 檢查權限
            if (assignmentUser.role !== 'teacher' && assignmentUser.role !== 'admin') {
                showToast('您沒有權限訪問此頁面', 'error');
                return;
            }

            // 載入資料
            loadClassAssignments();

        } catch (error) {
            console.error('解析使用者資料失敗:', error);
            showToast('登入資料有誤，請重新登入', 'error');
        }
    };

    // ==========================================
    // 載入班級授課安排
    // ==========================================

    /**
     * 載入教師的所有班級及其授課狀態
     */
    function loadClassAssignments() {
        // 顯示載入動畫
        showLoading('assignmentLoading');
        document.getElementById('assignmentsList').style.display = 'none';
        document.getElementById('assignmentsEmptyState').style.display = 'none';

        const params = new URLSearchParams({
            action: 'getClassAssignments',
            teacherEmail: assignmentUser.email
        });

        APP_CONFIG.log('📤 載入班級授課安排...', { teacherEmail: assignmentUser.email });

        fetch(`${APP_CONFIG.API_URL}?${params.toString()}`)
            .then(response => response.json())
            .then(function(response) {
                APP_CONFIG.log('📥 班級授課安排回應:', response);

                if (response.success) {
                    assignmentClasses = response.assignments || [];

                    if (assignmentClasses.length === 0) {
                        // 顯示空狀態
                        document.getElementById('assignmentsEmptyState').style.display = 'block';
                        // 空狀態也要隱藏 loading
                        hideLoading('assignmentLoading');
                    } else {
                        // 同時載入課程列表（loading 會在課程載入完成後隱藏）
                        loadTeacherCourses();
                    }
                } else {
                    showToast(response.message || '載入失敗', 'error');
                    document.getElementById('assignmentsEmptyState').style.display = 'block';
                    hideLoading('assignmentLoading');
                }
            })
            .catch(function(error) {
                APP_CONFIG.error('載入班級授課安排失敗', error);
                showToast('載入失敗：' + error.message, 'error');
                document.getElementById('assignmentsEmptyState').style.display = 'block';
                hideLoading('assignmentLoading');
            });
    }

    /**
     * 載入教師的所有課程
     */
    function loadTeacherCourses() {
        const params = new URLSearchParams({
            action: 'getTeacherCourses',
            teacherEmail: assignmentUser.email
        });

        APP_CONFIG.log('📤 載入課程列表...', { teacherEmail: assignmentUser.email });

        fetch(`${APP_CONFIG.API_URL}?${params.toString()}`)
            .then(response => response.json())
            .then(function(response) {
                APP_CONFIG.log('📥 課程列表回應:', response);

                if (response.success) {
                    assignmentCourses = response.courses || [];

                    // 顯示班級授課列表
                    displayAssignmentsList();
                } else {
                    showToast('載入課程列表失敗：' + (response.message || ''), 'error');
                }

                // 性能優化：在顯示數據後才隱藏 loading，避免空白間隙
                hideLoading('assignmentLoading');
            })
            .catch(function(error) {
                APP_CONFIG.error('載入課程列表失敗', error);
                showToast('載入課程列表失敗：' + error.message, 'error');

                // 錯誤時也要隱藏 loading
                hideLoading('assignmentLoading');
            });
    }

    // ==========================================
    // 顯示班級授課列表
    // ==========================================

    /**
     * 顯示班級授課卡片列表
     */
    function displayAssignmentsList() {
        const container = document.getElementById('assignmentsList');
        if (!container) return;

        container.innerHTML = '';
        container.style.display = 'grid';
        container.style.gridTemplateColumns = 'repeat(auto-fill, minmax(400px, 1fr))';
        container.style.gap = 'var(--spacing-md)';

        assignmentClasses.forEach(function(classData) {
            const card = createAssignmentCard(classData);
            container.appendChild(card);
        });
    }

    /**
     * 建立單個班級授課卡片
     */
    function createAssignmentCard(classData) {
        const card = document.createElement('div');
        card.className = 'assignment-card';
        card.style.cssText = `
            background: white;
            border-radius: var(--radius-md);
            padding: var(--spacing-md);
            box-shadow: var(--shadow-md);
            transition: all 0.3s ease;
        `;

        // 判斷是否有授課
        const hasAssignment = classData.courseId && classData.courseName;
        const statusColor = hasAssignment ? '#10B981' : '#6B7280';
        const statusText = hasAssignment ? '✅ 已安排課程' : '⚠️ 尚未安排';

        // 學生統計
        const startedCount = classData.studentsStarted || 0;
        const notStartedCount = classData.studentsNotStarted || 0;
        const totalStudents = startedCount + notStartedCount;

        card.innerHTML = `
            <div class="card-header" style="display: flex; justify-content: space-between; align-items: start; margin-bottom: var(--spacing-md); border-bottom: 2px solid var(--border-color); padding-bottom: var(--spacing-sm);">
                <div>
                    <h3 style="font-size: 20px; font-weight: 700; color: var(--text-dark); margin-bottom: 4px;">
                        ${escapeHtml(classData.className)}
                    </h3>
                    <div style="display: flex; align-items: center; gap: 8px; font-size: 14px;">
                        <span style="color: ${statusColor}; font-weight: 600;">${statusText}</span>
                        <span style="color: var(--text-medium);">|</span>
                        <span style="color: var(--text-medium);">👥 ${totalStudents} 位學生</span>
                    </div>
                </div>
            </div>

            <div class="card-body">
                <!-- 當前課程顯示 -->
                <div class="current-course" style="margin-bottom: var(--spacing-md); padding: var(--spacing-sm); background: ${hasAssignment ? '#F0FDF4' : '#F9FAFB'}; border-radius: var(--radius-sm);">
                    <div style="font-size: 13px; font-weight: 600; color: var(--text-medium); margin-bottom: 4px;">
                        📚 當前課程
                    </div>
                    <div style="font-size: 16px; font-weight: 600; color: var(--text-dark);" id="currentCourse_${classData.classId}">
                        ${hasAssignment ? escapeHtml(classData.courseName) : '未安排課程'}
                    </div>
                </div>

                <!-- 學習進度統計 -->
                ${hasAssignment ? `
                <div class="progress-stats" style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-sm); margin-bottom: var(--spacing-md);">
                    <div style="padding: var(--spacing-sm); background: #ECFDF5; border-radius: var(--radius-sm);">
                        <div style="font-size: 12px; color: #059669; margin-bottom: 2px;">已開始學習</div>
                        <div style="font-size: 20px; font-weight: 700; color: #059669;">${startedCount}</div>
                    </div>
                    <div style="padding: var(--spacing-sm); background: #FEF3C7; border-radius: var(--radius-sm);">
                        <div style="font-size: 12px; color: #D97706; margin-bottom: 2px;">尚未開始</div>
                        <div style="font-size: 20px; font-weight: 700; color: #D97706;">${notStartedCount}</div>
                    </div>
                </div>
                ` : ''}

                <!-- 課程選擇 -->
                <div class="course-selector" style="margin-bottom: var(--spacing-md);">
                    <label style="display: block; font-size: 14px; font-weight: 600; color: var(--text-dark); margin-bottom: 8px;">
                        選擇課程
                    </label>
                    <select
                        id="courseSelect_${classData.classId}"
                        class="form-control"
                        style="width: 100%; padding: 10px; border: 2px solid var(--border-color); border-radius: var(--radius-sm); font-size: 14px;"
                        onchange="handleCourseChange('${classData.classId}', this.value)"
                    >
                        <option value="">-- 請選擇課程 --</option>
                        ${assignmentCourses.map(course => {
                            let displayName = escapeHtml(course.courseName);
                            if (!course.isOwner && course.sharedBy) {
                                displayName += ` (由 ${course.sharedBy} 創建)`;
                            }
                            return `
                                <option value="${course.courseId}" ${course.courseId === classData.courseId ? 'selected' : ''}>
                                    ${displayName}
                                </option>
                            `;
                        }).join('')}
                    </select>
                </div>

                <!-- 操作按鈕 -->
                <div class="action-buttons" id="actionButtons_${classData.classId}" style="display: none; gap: 8px;">
                    <button
                        class="btn btn-success"
                        style="flex: 1; padding: 10px;"
                        onclick="saveAssignment('${classData.classId}')"
                    >
                        💾 儲存安排
                    </button>
                    <button
                        class="btn btn-secondary"
                        style="flex: 1; padding: 10px;"
                        onclick="cancelAssignment('${classData.classId}', '${classData.courseId || ''}')"
                    >
                        ✖️ 取消
                    </button>
                </div>

                <!-- 取消授課按鈕 -->
                ${hasAssignment ? `
                <div style="margin-top: var(--spacing-sm);">
                    <button
                        class="btn btn-danger"
                        style="width: 100%; padding: 10px; font-size: 14px;"
                        onclick="removeAssignment('${classData.classId}')"
                    >
                        🗑️ 取消此班級的授課安排
                    </button>
                </div>
                ` : ''}
            </div>
        `;

        return card;
    }

    // ==========================================
    // 處理課程變更
    // ==========================================

    /**
     * 處理課程選擇變更
     */
    window.handleCourseChange = function(classId, courseId) {
        APP_CONFIG.log('課程選擇變更', { classId, courseId });

        // 找到當前班級資料
        const classData = assignmentClasses.find(c => c.classId === classId);
        if (!classData) return;

        // 判斷是否有變更
        const originalCourseId = classData.courseId || '';
        const hasChanged = courseId !== originalCourseId;

        // 顯示或隱藏操作按鈕
        const actionButtons = document.getElementById(`actionButtons_${classId}`);
        if (actionButtons) {
            actionButtons.style.display = hasChanged ? 'flex' : 'none';
        }
    };

    // ==========================================
    // 儲存授課安排
    // ==========================================

    /**
     * 儲存授課安排
     */
    window.saveAssignment = function(classId) {
        const select = document.getElementById(`courseSelect_${classId}`);
        if (!select) return;

        const courseId = select.value;

        if (!courseId) {
            showToast('請選擇一個課程', 'warning');
            return;
        }

        // 找到課程名稱
        const course = assignmentCourses.find(c => c.courseId === courseId);
        if (!course) {
            showToast('找不到課程資訊', 'error');
            return;
        }

        // 找到班級名稱
        const classData = assignmentClasses.find(c => c.classId === classId);
        if (!classData) {
            showToast('找不到班級資訊', 'error');
            return;
        }

        // 確認對話框
        if (!confirm(`確定要將課程「${course.courseName}」安排給班級「${classData.className}」嗎？\n\n此操作會取代該班級原有的授課安排（如果有的話）。`)) {
            return;
        }

        // 顯示載入提示
        showToast('儲存中...', 'info');

        const params = new URLSearchParams({
            action: 'assignCourseToClass',
            classId: classId,
            courseId: courseId,
            teacherEmail: assignmentUser.email
        });

        APP_CONFIG.log('📤 儲存授課安排...', { classId, courseId });

        fetch(`${APP_CONFIG.API_URL}?${params.toString()}`)
            .then(response => response.json())
            .then(function(response) {
                APP_CONFIG.log('📥 儲存授課安排回應:', response);

                if (response.success) {
                    showToast(`✅ 成功安排課程「${course.courseName}」給班級「${classData.className}」`, 'success');

                    // 重新載入授課安排
                    loadClassAssignments();
                } else {
                    showToast('儲存失敗：' + (response.message || ''), 'error');
                }
            })
            .catch(function(error) {
                APP_CONFIG.error('儲存授課安排失敗', error);
                showToast('儲存失敗：' + error.message, 'error');
            });
    };

    /**
     * 取消變更（恢復原選項）
     */
    window.cancelAssignment = function(classId, originalCourseId) {
        const select = document.getElementById(`courseSelect_${classId}`);
        if (select) {
            select.value = originalCourseId;
        }

        // 隱藏操作按鈕
        const actionButtons = document.getElementById(`actionButtons_${classId}`);
        if (actionButtons) {
            actionButtons.style.display = 'none';
        }
    };

    /**
     * 取消授課安排
     */
    window.removeAssignment = function(classId) {
        // 找到班級名稱
        const classData = assignmentClasses.find(c => c.classId === classId);
        if (!classData) {
            showToast('找不到班級資訊', 'error');
            return;
        }

        // 確認對話框
        if (!confirm(`確定要取消班級「${classData.className}」的授課安排嗎？\n\n學生將無法看到任何課程內容。`)) {
            return;
        }

        // 顯示載入提示
        showToast('取消中...', 'info');

        const params = new URLSearchParams({
            action: 'removeAssignment',
            classId: classId,
            teacherEmail: assignmentUser.email
        });

        APP_CONFIG.log('📤 取消授課安排...', { classId });

        fetch(`${APP_CONFIG.API_URL}?${params.toString()}`)
            .then(response => response.json())
            .then(function(response) {
                APP_CONFIG.log('📥 取消授課安排回應:', response);

                if (response.success) {
                    showToast(`✅ 已取消班級「${classData.className}」的授課安排`, 'success');

                    // 重新載入授課安排
                    loadClassAssignments();
                } else {
                    showToast('取消失敗：' + (response.message || ''), 'error');
                }
            })
            .catch(function(error) {
                APP_CONFIG.error('取消授課安排失敗', error);
                showToast('取消失敗：' + error.message, 'error');
            });
    };

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
