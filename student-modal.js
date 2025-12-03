/* ==========================================
   學生名單 Modal 視窗功能
   ========================================== */

// 全域變數
let currentModalData = {
    classId: null,
    className: null,
    members: [],
    filteredMembers: [],
    editingRow: null
};

/**
 * 開啟學生名單 Modal
 * @param {string} classId - 班級 ID
 * @param {string} className - 班級名稱
 * @param {Array} members - 學生列表
 */
function openStudentModal(classId, className, members) {
    // 儲存資料
    currentModalData.classId = classId;
    currentModalData.className = className;
    currentModalData.members = members;
    currentModalData.filteredMembers = [...members];
    
    // 建立 Modal HTML
    createModalHTML();
    
    // 渲染學生列表
    renderStudentTable();
    
    // 顯示 Modal
    const overlay = document.getElementById('studentModalOverlay');
    if (overlay) {
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden'; // 防止背景滾動
    }
    
    APP_CONFIG.log('開啟學生名單 Modal', { classId, className, count: members.length });
}

/**
 * 關閉學生名單 Modal
 */
function closeStudentModal() {
    const overlay = document.getElementById('studentModalOverlay');
    if (overlay) {
        overlay.classList.remove('active');
        document.body.style.overflow = ''; // 恢復滾動
        
        // 延遲移除 DOM（等動畫結束）
        setTimeout(() => {
            overlay.remove();
        }, 300);
    }
    
    // 清空資料
    currentModalData = {
        classId: null,
        className: null,
        members: [],
        filteredMembers: [],
        editingRow: null
    };
    
    APP_CONFIG.log('關閉學生名單 Modal');
}

/**
 * 建立 Modal HTML 結構
 */
function createModalHTML() {
    // 移除舊的 Modal（如果存在）
    const oldModal = document.getElementById('studentModalOverlay');
    if (oldModal) {
        oldModal.remove();
    }
    
    const modalHTML = `
        <div id="studentModalOverlay" class="modal-overlay">
            <div class="student-modal">
                <!-- 標題區 -->
                <div class="modal-header">
                    <div class="modal-title">
                        📋 ${escapeHtml(String(currentModalData.className || ''))}
                        <span class="student-count" id="studentCountDisplay">
                            共 ${currentModalData.members.length} 位學生
                        </span>
                    </div>
                    <button class="modal-close-btn" onclick="closeStudentModal()">✕</button>
                </div>
                
                <!-- 工具列 -->
                <div class="modal-toolbar">
                    <!-- 搜尋框 -->
                    <div class="search-box">
                        <span class="search-icon">🔍</span>
                        <input 
                            type="text" 
                            id="studentSearch" 
                            placeholder="搜尋座號、姓名或 Email..."
                            oninput="handleSearch()"
                        >
                    </div>
                    
                    <!-- 篩選按鈕 -->
                    <div class="filter-group">
                        <button class="filter-btn active" onclick="handleFilter('all')">
                            全部
                        </button>
                        <button class="filter-btn" onclick="handleFilter('bound')">
                            已綁定
                        </button>
                        <button class="filter-btn" onclick="handleFilter('unbound')">
                            未綁定
                        </button>
                    </div>
                    
                    <!-- 排序 -->
                    <select class="sort-select" onchange="handleSort(this.value)">
                        <option value="seat">依座號排序</option>
                        <option value="name">依姓名排序</option>
                        <option value="status">依綁定狀態</option>
                    </select>
                </div>
                
                <!-- 學生列表 -->
                <div class="modal-body">
                    <table class="students-table" id="studentsTable">
                        <thead>
                            <tr>
                                <th style="width: 80px;">座號</th>
                                <th>姓名</th>
                                <th>Email</th>
                                <th style="width: 100px;">狀態</th>
                                <th style="width: 150px;">操作</th>
                            </tr>
                        </thead>
                        <tbody id="studentsTableBody">
                            <!-- 動態生成 -->
                        </tbody>
                    </table>
                </div>
                
                <!-- 底部操作區 -->
                <div class="modal-footer">
                    <div class="footer-info">
                        顯示 <span id="displayCount">0</span> / ${currentModalData.members.length} 位學生
                    </div>
                    <div class="footer-actions">
                        <button class="footer-btn secondary" onclick="exportToExcel()">
                            📊 匯出 Excel
                        </button>
                        <button class="footer-btn secondary" onclick="printStudentList()">
                            🖨️ 列印名單
                        </button>
                        <button class="footer-btn primary" onclick="closeStudentModal()">
                            關閉
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

/**
 * 渲染學生表格
 */
function renderStudentTable() {
    const tbody = document.getElementById('studentsTableBody');
    if (!tbody) return;
    
    // 如果沒有學生
    if (currentModalData.filteredMembers.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5">
                    <div class="empty-state-modal">
                        <div class="icon">📭</div>
                        <h3>沒有符合條件的學生</h3>
                        <p>請調整搜尋或篩選條件</p>
                    </div>
                </td>
            </tr>
        `;
        updateDisplayCount(0);
        return;
    }
    
    // 生成表格列
    tbody.innerHTML = '';
    
    currentModalData.filteredMembers.forEach((member, index) => {
        const row = document.createElement('tr');
        row.id = `student-row-${member.uuid}`;
        
        // 確保數據是字符串
        const seat = String(member.seat || '');
        const name = String(member.name || '');
        const email = String(member.email || '-');
        
        row.innerHTML = `
            <td class="seat-number">${escapeHtml(seat)}</td>
            <td class="student-name">${escapeHtml(name)}</td>
            <td class="student-email">${escapeHtml(email)}</td>
            <td>
                <span class="status-badge ${member.userId ? 'bound' : 'unbound'}">
                    ${member.userId ? '✓ 已綁定' : '○ 未綁定'}
                </span>
            </td>
            <td>
                <div class="action-btns">
                    <button class="action-btn edit" onclick="editStudent('${member.uuid}')">
                        ✏️ 編輯
                    </button>
                    <button class="action-btn delete" onclick="deleteStudent('${member.uuid}', '${escapeHtml(name)}')">
                        🗑️ 刪除
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);

    });
    
    updateDisplayCount(currentModalData.filteredMembers.length);
}

/**
 * 更新顯示數量
 */
function updateDisplayCount(count) {
    const displayCount = document.getElementById('displayCount');
    if (displayCount) {
        displayCount.textContent = count;
    }
}

/**
 * 處理搜尋
 */
function handleSearch() {
    const searchInput = document.getElementById('studentSearch');
    const keyword = searchInput.value.trim().toLowerCase();
    
    if (!keyword) {
        // 如果搜尋框是空的，顯示所有資料
        currentModalData.filteredMembers = [...currentModalData.members];
    } else {
        // 搜尋座號、姓名、Email
        currentModalData.filteredMembers = currentModalData.members.filter(member => {
            return (
                member.seat.toLowerCase().includes(keyword) ||
                member.name.toLowerCase().includes(keyword) ||
                (member.email && member.email.toLowerCase().includes(keyword))
            );
        });
    }
    
    // 重新渲染
    renderStudentTable();
    
    APP_CONFIG.log('搜尋學生', { keyword, results: currentModalData.filteredMembers.length });
}

/**
 * 處理篩選
 */
function handleFilter(filter) {
    // 更新按鈕狀態
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // 篩選資料
    switch(filter) {
        case 'all':
            currentModalData.filteredMembers = [...currentModalData.members];
            break;
        case 'bound':
            currentModalData.filteredMembers = currentModalData.members.filter(m => m.userId);
            break;
        case 'unbound':
            currentModalData.filteredMembers = currentModalData.members.filter(m => !m.userId);
            break;
    }
    
    // 重新渲染
    renderStudentTable();
    
    APP_CONFIG.log('篩選學生', { filter, results: currentModalData.filteredMembers.length });
}

/**
 * 處理排序
 */
function handleSort(sortBy) {
    switch(sortBy) {
        case 'seat':
            currentModalData.filteredMembers.sort((a, b) => {
                return parseInt(a.seat) - parseInt(b.seat);
            });
            break;
        case 'name':
            currentModalData.filteredMembers.sort((a, b) => {
                return a.name.localeCompare(b.name, 'zh-TW');
            });
            break;
        case 'status':
            currentModalData.filteredMembers.sort((a, b) => {
                // 已綁定的排前面
                if (a.userId && !b.userId) return -1;
                if (!a.userId && b.userId) return 1;
                return 0;
            });
            break;
    }
    
    renderStudentTable();
    
    APP_CONFIG.log('排序學生', { sortBy });
}

/**
 * 編輯學生
 */
function editStudent(uuid) {
    const member = currentModalData.members.find(m => m.uuid === uuid);
    if (!member) return;
    
    const row = document.getElementById(`student-row-${uuid}`);
    if (!row) return;
    
    // 保存當前編輯的行
    currentModalData.editingRow = uuid;
    
    // 確保數據是字符串
    const seat = String(member.seat || '');
    const name = String(member.name || '');
    const email = String(member.email || '');
    
    // 替換成輸入框
    row.innerHTML = `
        <td>
            <input type="text" class="edit-input" id="edit-seat-${uuid}" value="${escapeHtml(seat)}" style="width: 60px;">
        </td>
        <td>
            <input type="text" class="edit-input" id="edit-name-${uuid}" value="${escapeHtml(name)}">
        </td>
        <td>
            <input type="email" class="edit-input" id="edit-email-${uuid}" value="${escapeHtml(email)}">
        </td>
        <td>
            <span class="status-badge ${member.userId ? 'bound' : 'unbound'}">
                ${member.userId ? '✓ 已綁定' : '○ 未綁定'}
            </span>
        </td>
        <td>
            <div class="save-cancel-btns">
                <button class="save" onclick="saveStudent('${uuid}')">💾 儲存</button>
                <button class="cancel" onclick="cancelEdit()">❌ 取消</button>
            </div>
        </td>
    `;
    
    // 聚焦到姓名欄位
    document.getElementById(`edit-name-${uuid}`).focus();
    
    APP_CONFIG.log('編輯學生', { uuid, name: member.name });
}

/**
 * 儲存學生編輯
 */
function saveStudent(uuid) {
    const seat = document.getElementById(`edit-seat-${uuid}`).value.trim();
    const name = document.getElementById(`edit-name-${uuid}`).value.trim();
    const email = document.getElementById(`edit-email-${uuid}`).value.trim();
    
    // 驗證
    if (!seat || !name) {
        alert('⚠️ 座號和姓名不可為空');
        return;
    }
    
    // 呼叫後端更新
    const params = new URLSearchParams({
        action: 'updateStudent',
        uuid: uuid,
        seat: seat,
        name: name,
        email: email
    });
    
    fetch(`${APP_CONFIG.API_URL}?${params.toString()}`)
        .then(response => response.json())
        .then(function(response) {
            if (response.success) {
                // 更新本地資料
                const member = currentModalData.members.find(m => m.uuid === uuid);
                if (member) {
                    member.seat = seat;
                    member.name = name;
                    member.email = email;
                }
                
                // 重新渲染
                currentModalData.editingRow = null;
                renderStudentTable();
                
                showToast('✅ 更新成功！', 'success');
                APP_CONFIG.log('更新學生成功', { uuid, name });
            } else {
                alert('❌ ' + response.message);
            }
        })
        .catch(function(error) {
            alert('❌ 更新失敗：' + error.message);
            APP_CONFIG.error('更新學生失敗', error);
        });
}

/**
 * 取消編輯
 */
function cancelEdit() {
    currentModalData.editingRow = null;
    renderStudentTable();
}

/**
 * 刪除學生
 */
function deleteStudent(uuid, name) {
    if (!confirm(`確定要刪除學生「${name}」嗎？\n\n此操作無法復原！`)) {
        return;
    }
    
    // 呼叫後端刪除
    const params = new URLSearchParams({
        action: 'deleteStudent',
        uuid: uuid,
        classId: currentModalData.classId
    });
    
    fetch(`${APP_CONFIG.API_URL}?${params.toString()}`)
        .then(response => response.json())
        .then(function(response) {
            if (response.success) {
                // 從本地資料中移除
                currentModalData.members = currentModalData.members.filter(m => m.uuid !== uuid);
                currentModalData.filteredMembers = currentModalData.filteredMembers.filter(m => m.uuid !== uuid);
                
                // 重新渲染
                renderStudentTable();
                
                // 更新總數
                const countDisplay = document.getElementById('studentCountDisplay');
                if (countDisplay) {
                    countDisplay.textContent = `共 ${currentModalData.members.length} 位學生`;
                }
                
                showToast('✅ 刪除成功！', 'success');
                APP_CONFIG.log('刪除學生成功', { uuid, name });
            } else {
                alert('❌ ' + response.message);
            }
        })
        .catch(function(error) {
            alert('❌ 刪除失敗：' + error.message);
            APP_CONFIG.error('刪除學生失敗', error);
        });
}

/**
 * 匯出到 Excel
 */
function exportToExcel() {
    // 準備 CSV 資料
    let csv = '\uFEFF'; // UTF-8 BOM，讓 Excel 正確顯示中文
    csv += '座號,姓名,Email,綁定狀態\n';
    
    currentModalData.filteredMembers.forEach(member => {
        csv += `${member.seat},${member.name},${member.email || ''},${member.userId ? '已綁定' : '未綁定'}\n`;
    });
    
    // 建立下載連結
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `${currentModalData.className}_學生名單.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast('📊 已匯出 Excel 檔案！', 'success');
    APP_CONFIG.log('匯出 Excel', { count: currentModalData.filteredMembers.length });
}

/**
 * 列印學生名單
 */
function printStudentList() {
    const printWindow = window.open('', '_blank');
    
    let html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>${currentModalData.className} - 學生名單</title>
            <style>
                body {
                    font-family: 'Microsoft JhengHei', 'Noto Sans TC', sans-serif;
                    padding: 40px;
                }
                h1 {
                    text-align: center;
                    margin-bottom: 10px;
                }
                .info {
                    text-align: center;
                    color: #666;
                    margin-bottom: 30px;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 30px;
                }
                th, td {
                    border: 1px solid #ddd;
                    padding: 12px;
                    text-align: left;
                }
                th {
                    background: #2C5F7C;
                    color: white;
                    font-weight: bold;
                }
                tr:nth-child(even) {
                    background: #f9f9f9;
                }
                .footer {
                    text-align: right;
                    color: #999;
                    font-size: 14px;
                }
                @media print {
                    body { padding: 20px; }
                }
            </style>
        </head>
        <body>
            <h1>${currentModalData.className} - 學生名單</h1>
            <div class="info">共 ${currentModalData.filteredMembers.length} 位學生</div>
            <table>
                <thead>
                    <tr>
                        <th style="width: 80px;">座號</th>
                        <th>姓名</th>
                        <th>Email</th>
                        <th style="width: 100px;">綁定狀態</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    currentModalData.filteredMembers.forEach(member => {
        // 確保數據是字符串
        const seat = String(member.seat || '');
        const name = String(member.name || '');
        const email = String(member.email || '-');
        
        html += `
            <tr>
                <td>${escapeHtml(seat)}</td>
                <td>${escapeHtml(name)}</td>
                <td>${escapeHtml(email)}</td>
                <td>${member.userId ? '✓ 已綁定' : '○ 未綁定'}</td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
            <div class="footer">列印日期：${new Date().toLocaleDateString('zh-TW')}</div>
        </body>
        </html>
    `;
    
    printWindow.document.write(html);
    printWindow.document.close();
    
    // 等待載入完成後列印
    printWindow.onload = function() {
        printWindow.print();
    };
    
    APP_CONFIG.log('列印學生名單', { count: currentModalData.filteredMembers.length });
}

/**
 * 顯示 Toast 提示訊息
 */
function showToast(message, type = 'info') {
    let toast = document.getElementById('toastMessage');
    
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toastMessage';
        toast.style.cssText = `
            position: fixed;
            bottom: 30px;
            right: 30px;
            padding: 16px 24px;
            background: #2C5F7C;
            color: white;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            font-size: 16px;
            font-weight: 500;
            z-index: 10000;
            animation: slideInRight 0.3s ease;
        `;
        document.body.appendChild(toast);
    }
    
    // 設定顏色
    if (type === 'success') {
        toast.style.background = '#10B981';
    } else if (type === 'error') {
        toast.style.background = '#EF4444';
    } else {
        toast.style.background = '#2C5F7C';
    }
    
    toast.textContent = message;
    toast.style.display = 'block';
    
    // 3 秒後自動隱藏
    setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => {
            toast.style.display = 'none';
        }, 300);
    }, 3000);
}