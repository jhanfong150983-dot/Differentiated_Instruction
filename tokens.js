/* ==========================================
   代幣管理 - tokens.js
   ========================================== */

// 全域變數
// ⚠️ 使用 var 而非 let 以避免在 teacher.html 中與 teacher.js 的衝突
if (typeof currentUser === 'undefined') {
  var currentUser = null;
}
if (typeof currentClassId === 'undefined') {
  var currentClassId = null;
}
let currentStudents = [];
let selectedStudent = null;

// ==========================================
// 初始化
// ==========================================

document.addEventListener('DOMContentLoaded', function() {
    APP_CONFIG.log('💰 代幣管理頁面載入完成');
    
    // 檢查登入狀態
    checkLoginStatus();
    
    // 在 teacher.html 環境中，等待 navbar 初始化後才載入班級
    // 在獨立 token.html 中，直接載入班級列表
    setTimeout(() => {
        if (!window.isTeacherPage) {
            loadTeacherClasses();
        }
    }, 200);
    
    // 監聽調整數量輸入
    const adjustInput = document.getElementById('adjustAmount');
    if (adjustInput) {
        adjustInput.addEventListener('input', updateNewTokensPreview);
    }
});

/**
 * 載入教師的班級列表 - 別名函數，用於 teacher.html 的 switchTab
 */
function loadTokenClasses() {
    loadTeacherClasses();
}

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
        currentUser = JSON.parse(userJson);
        
        // 檢查權限（只有 teacher 和 admin 可以訪問）
        if (currentUser.role !== 'teacher' && currentUser.role !== 'admin') {
            showToast('您沒有權限訪問此頁面', 'error');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1500);
            return;
        }
        
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
// 載入班級列表
// ==========================================

/**
 * 載入教師的班級列表
 */
function loadTeacherClasses() {
    // 顯示載入中狀態
    const selector = document.getElementById('tokenClassSelect') || document.getElementById('classSelector');
    if (selector) {
        selector.innerHTML = '<option value="">載入班級中...</option>';
        selector.disabled = true;
    }

    // 如果在 teacher.html 環境中，從 localStorage 獲取用戶資訊
    if (!currentUser) {
        const userJson = localStorage.getItem('user');
        if (userJson) {
            try {
                currentUser = JSON.parse(userJson);
            } catch (e) {
                console.error('解析使用者資料失敗:', e);
                if (selector) {
                    selector.innerHTML = '<option value="">載入失敗：請重新登入</option>';
                    selector.disabled = false;
                }
                return;
            }
        } else {
            console.error('找不到使用者資訊');
            if (selector) {
                selector.innerHTML = '<option value="">載入失敗：請先登入</option>';
                selector.disabled = false;
            }
            return;
        }
    }

    const params = new URLSearchParams({
        action: 'getTeacherClasses',
        teacherEmail: currentUser.email
    });

    APP_CONFIG.log('📤 載入班級列表...');

    fetch(`${APP_CONFIG.API_URL}?${params.toString()}`)
        .then(response => response.json())
        .then(function(response) {
            APP_CONFIG.log('📥 班級列表回應:', response);

            if (selector) {
                selector.disabled = false;
            }

            if (response.success && response.classes.length > 0) {
                displayClassSelector(response.classes);
            } else {
                if (selector) {
                    selector.innerHTML = '<option value="">尚未建立班級</option>';
                }
                showToast('您尚未建立任何班級', 'info');
            }
        })
        .catch(function(error) {
            APP_CONFIG.error('載入班級失敗', error);

            if (selector) {
                selector.disabled = false;
                selector.innerHTML = '<option value="">載入失敗，請重新整理</option>';
            }

            showToast('載入班級失敗：' + error.message, 'error');
        });
}

/**
 * 顯示班級選擇器
 */
function displayClassSelector(classes) {
    // 支持兩種 ID：classSelector（舊版）和 tokenClassSelect（teacher.html）
    const selector = document.getElementById('tokenClassSelect') || document.getElementById('classSelector');
    if (!selector) return;

    // 清空但保留預設選項
    selector.innerHTML = '<option value="">請選擇班級</option>';

    // 加入班級選項
    classes.forEach(function(classData) {
        const option = document.createElement('option');
        // 相容兩種命名：classId/class_id, className/class_name
        option.value = classData.classId || classData.class_id;
        option.textContent = classData.className || classData.class_name;
        selector.appendChild(option);
    });
}

/**
 * 處理班級切換
 */
function handleClassChange() {
    const selector = document.getElementById('tokenClassSelect') || document.getElementById('classSelector');
    const classId = selector.value;

    if (!classId) {
        // 未選擇班級，顯示空狀態
        const tableContainer = document.getElementById('tokenTableContainer');
        const emptyState = document.getElementById('tokenEmptyState') || document.getElementById('emptyState');

        if (tableContainer) tableContainer.style.display = 'none';
        if (emptyState) emptyState.style.display = 'block';

        resetStats();
        return;
    }

    // 顯示載入提示
    showToast('載入班級代幣資料中...', 'info');

    currentClassId = classId;
    loadClassTokens(classId);
}

// ==========================================
// 載入班級代幣資訊
// ==========================================

/**
 * 載入班級所有學生的代幣資訊
 */
function loadClassTokens(classId) {
    if (!classId) return;

    // 隱藏表格和統計卡片
    const tableContainer = document.getElementById('tokenTableContainer');
    const statsContainer = document.getElementById('tokenStats');
    const emptyState = document.getElementById('tokenEmptyState') || document.getElementById('emptyState');

    if (tableContainer) tableContainer.style.display = 'none';
    if (statsContainer) statsContainer.style.display = 'none';
    if (emptyState) emptyState.style.display = 'none';

    // 顯示載入動畫
    showLoading('tokenLoading');

    // 如果在 teacher.html 環境中，從 localStorage 獲取用戶資訊
    if (!currentUser) {
        const userJson = localStorage.getItem('user');
        if (userJson) {
            try {
                currentUser = JSON.parse(userJson);
            } catch (e) {
                console.error('解析使用者資料失敗:', e);
                hideLoading('tokenLoading');
                showToast('載入失敗：請重新登入', 'error');
                return;
            }
        } else {
            console.error('找不到使用者資訊');
            hideLoading('tokenLoading');
            showToast('載入失敗：請先登入', 'error');
            return;
        }
    }

    const params = new URLSearchParams({
        action: 'getClassTokens',
        classId: classId,
        teacherEmail: currentUser.email
    });
    
    APP_CONFIG.log('📤 載入班級代幣...', { classId });
    
    fetch(`${APP_CONFIG.API_URL}?${params.toString()}`)
        .then(response => response.json())
        .then(function(response) {
            hideLoading('tokenLoading');
            
            APP_CONFIG.log('📥 班級代幣回應:', response);
            
            if (response.success) {
                currentStudents = response.students || [];
                displayTokenTable(currentStudents);
                updateStats(response);
                
                // 顯示表格和統計卡片
                if (tableContainer) tableContainer.style.display = 'block';
                if (statsContainer) statsContainer.style.display = 'grid';
                if (emptyState) emptyState.style.display = 'none';
            } else {
                showToast(response.message || '載入失敗', 'error');
                if (emptyState) emptyState.style.display = 'block';
            }
        })
        .catch(function(error) {
            hideLoading('tokenLoading');
            APP_CONFIG.error('載入班級代幣失敗', error);
            showToast('載入失敗：' + error.message, 'error');
            if (emptyState) emptyState.style.display = 'block';
        });
}

/**
 * 顯示代幣表格
 */
function displayTokenTable(students) {
    const container = document.getElementById('tokenTableContainer');
    if (!container) return;
    
    if (!students || students.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">💰</div>
                <h3>此班級尚無學生</h3>
                <p>請先在班級管理中匯入學生</p>
            </div>
        `;
        return;
    }
    
    // 生成完整的表格 HTML
    let html = `
        <div class="token-table-wrapper">
            <table class="token-table">
                <thead>
                    <tr>
                        <th class="rank-column">排名</th>
                        <th class="seat-column">座號</th>
                        <th class="name-column">姓名</th>
                        <th class="token-column">代幣數</th>
                        <th class="action-column">操作</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    // 生成表格列
    students.forEach(function(student, index) {
        const rank = index + 1;
        
        // 排名 Badge
        let rankBadgeClass = 'rank-other';
        let rankIcon = rank;
        
        if (rank === 1) {
            rankBadgeClass = 'rank-1';
            rankIcon = '🥇';
        } else if (rank === 2) {
            rankBadgeClass = 'rank-2';
            rankIcon = '🥈';
        } else if (rank === 3) {
            rankBadgeClass = 'rank-3';
            rankIcon = '🥉';
        }
        
        html += `
            <tr class="token-table-row" data-student-id="${student.userId}">
                <td class="rank-cell">
                    <div class="rank-badge ${rankBadgeClass}">
                        ${rankIcon}
                    </div>
                </td>
                <td class="seat-cell">${escapeHtml(student.seat || '-')}</td>
                <td class="name-cell">${escapeHtml(student.name)}</td>
                <td class="token-cell">
                    <div class="token-amount">💰 ${student.totalTokens}</div>
                </td>
                <td class="action-cell">
                    <div class="adjust-buttons">
                        <button class="btn-adjust btn-add" onclick="openAdjustModal('${student.userId}', ${student.totalTokens}, 'add')" title="增加代幣">
                            ➕ 增加
                        </button>
                        <button class="btn-adjust btn-subtract" onclick="openAdjustModal('${student.userId}', ${student.totalTokens}, 'subtract')" title="減少代幣">
                            ➖ 減少
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
        </div>
    `;
    
    container.innerHTML = html;
}

/**
 * 更新統計資訊
 */
function updateStats(data) {
    document.getElementById('totalTokens').textContent = data.totalTokens || 0;
    document.getElementById('totalStudents').textContent = data.totalStudents || 0;
    
    const avgTokens = data.totalStudents > 0 
        ? Math.round(data.totalTokens / data.totalStudents) 
        : 0;
    document.getElementById('avgTokens').textContent = avgTokens;
}

/**
 * 重置統計資訊
 */
function resetStats() {
    document.getElementById('totalTokens').textContent = '0';
    document.getElementById('totalStudents').textContent = '0';
    document.getElementById('avgTokens').textContent = '0';
}

// ==========================================
// 調整代幣
// ==========================================

/**
 * 開啟調整代幣 Modal
 */
function openAdjustModal(userId, currentTokens, type) {
    // 找到學生資訊
    selectedStudent = currentStudents.find(s => s.userId === userId);
    if (!selectedStudent) {
        showToast('找不到學生資訊', 'error');
        return;
    }
    
    // 填入表單
    document.getElementById('adjustStudentName').value = selectedStudent.name;
    document.getElementById('currentTokens').value = currentTokens;
    document.getElementById('newTokens').value = currentTokens;
    
    // 根據類型預設調整數量和原因
    const adjustAmountInput = document.getElementById('adjustAmount');
    const adjustReasonInput = document.getElementById('adjustReason');
    
    if (type === 'add') {
        adjustAmountInput.value = '10';
        adjustReasonInput.value = '課堂表現優秀';
        adjustAmountInput.focus();
    } else if (type === 'subtract') {
        adjustAmountInput.value = '-10';
        adjustReasonInput.value = '違反課堂規範';
        adjustAmountInput.focus();
    }
    
    updateNewTokensPreview();
    
    // 開啟 Modal
    openModal('adjustTokenModal');
}

/**
 * 更新調整後代幣預覽
 */
function updateNewTokensPreview() {
    const currentTokens = parseInt(document.getElementById('currentTokens').value) || 0;
    const adjustAmount = parseInt(document.getElementById('adjustAmount').value) || 0;
    const newTokens = Math.max(0, currentTokens + adjustAmount);
    
    document.getElementById('newTokens').value = newTokens;
    
    // 根據調整量顯示不同顏色
    const newTokensInput = document.getElementById('newTokens');
    if (adjustAmount > 0) {
        newTokensInput.style.color = '#10B981'; // 綠色
    } else if (adjustAmount < 0) {
        newTokensInput.style.color = '#EF4444'; // 紅色
    } else {
        newTokensInput.style.color = '#1F2937'; // 黑色
    }
}

/**
 * 執行調整代幣
 */
function handleAdjustTokens() {
    const currentTokensValue = parseInt(document.getElementById('currentTokens').value);
    const adjustAmountValue = parseInt(document.getElementById('adjustAmount').value);
    const reasonValue = document.getElementById('adjustReason').value.trim();

    // 驗證
    if (!adjustAmountValue && adjustAmountValue !== 0) {
        showToast('請輸入調整數量', 'warning');
        return;
    }

    if (adjustAmountValue === 0) {
        showToast('調整數量不能為 0', 'warning');
        return;
    }

    const newTokens = currentTokensValue + adjustAmountValue;

    // 驗證新代幣數不能為負
    if (newTokens < 0) {
        showToast('調整後代幣數不能為負數', 'error');
        return;
    }

    if (!selectedStudent) {
        showToast('找不到學生資訊', 'error');
        return;
    }

    // 如果在 teacher.html 環境中，從 localStorage 獲取用戶資訊
    if (!currentUser) {
        const userJson = localStorage.getItem('user');
        if (userJson) {
            try {
                currentUser = JSON.parse(userJson);
            } catch (e) {
                console.error('解析使用者資料失敗:', e);
                showToast('載入失敗：請重新登入', 'error');
                return;
            }
        } else {
            console.error('找不到使用者資訊');
            showToast('載入失敗：請先登入', 'error');
            return;
        }
    }

    // 設定預設原因
    const reason = reasonValue || (adjustAmountValue > 0 ? '課堂表現優秀' : '違反課堂規範');

    const btn = event.target;
    btn.disabled = true;
    btn.textContent = '調整中...';

    const params = new URLSearchParams({
        action: 'adjustStudentTokens',
        teacherEmail: currentUser.email,
        studentId: selectedStudent.userId,
        amount: adjustAmountValue,
        reason: reason
    });
    
    APP_CONFIG.log('📤 調整代幣...', { 
        student: selectedStudent.name, 
        amount: adjustAmountValue,
        newTotal: newTokens
    });
    
    fetch(`${APP_CONFIG.API_URL}?${params.toString()}`)
        .then(response => response.json())
        .then(function(response) {
            btn.disabled = false;
            btn.textContent = '確認調整';
            
            APP_CONFIG.log('📥 調整代幣回應:', response);
            
            if (response.success) {
                const action = adjustAmountValue > 0 ? '增加' : '減少';
                const absAmount = Math.abs(adjustAmountValue);
                showToast(`✅ 成功${action} ${absAmount} 個代幣！\n${selectedStudent.name} 目前擁有 ${newTokens} 個代幣`, 'success');
                
                // 關閉 Modal
                closeModal('adjustTokenModal');
                
                // 重新載入
                loadClassTokens(currentClassId);
            } else {
                showToast(response.message || '調整失敗', 'error');
            }
        })
        .catch(function(error) {
            btn.disabled = false;
            btn.textContent = '確認調整';
            
            APP_CONFIG.error('調整代幣失敗', error);
            showToast('調整失敗：' + error.message, 'error');
        });
}

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