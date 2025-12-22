/* ==========================================
   分層教學管理系統 - 前端 JavaScript
   ==========================================
   這個檔案處理所有前端互動邏輯
*/

// ========== 全域變數 ==========
// ⚠️ 使用條件宣告以支持在 teacher.html 中與 tokens.js 共存
if (typeof currentClassId === 'undefined') {
  var currentClassId = null;  // 當前選中的班級 ID
}
let parsedStudents = [];    // 解析後的學生資料
if (typeof currentUser === 'undefined') {
  var currentUser = null;     // 當前登入使用者
}
let currentTokenStudents = [];  // 代幣管理頁面的學生列表
let selectedTokenStudent = null;  // 代幣管理中選中的學生

/* --------------------------------------------------
   頁面載入時執行
   -------------------------------------------------- */
window.onload = function() {
  // 檢查登入狀態
  checkLoginStatus();
  
  // 顯示使用者資訊
  displayUserInfo();
  
  // 載入班級列表
  loadClasses();
  
  // 預先載入代幣管理班級（在背景載入，不會阻塞）
  setTimeout(function() {
    if (document.getElementById('tokenClassSelect')) {
      loadTokenClasses();
    }
  }, 500);
  

};

/**
 * 取得使用者 Email（安全版本）
 */
function getUserEmail() {
    try {
        const userStr = localStorage.getItem('user');
        if (!userStr) {
            console.warn('⚠️ localStorage 中沒有 user 資料');
            return null;
        }
        
        const user = JSON.parse(userStr);
        
        if (!user || !user.email) {
            console.warn('⚠️ user 物件中沒有 email');
            return null;
        }
        
        return user.email;
    } catch (error) {
        console.error('❌ getUserEmail 錯誤:', error);
        return null;
    }
}


/**
 * 取得使用者名稱（安全版本）
 */
function getUserName() {
    try {
        const userStr = localStorage.getItem('user');
        if (!userStr) return null;
        
        const user = JSON.parse(userStr);
        return user ? user.name : null;
    } catch (error) {
        console.error('❌ getUserName 錯誤:', error);
        return null;
    }
}


/**
 * 取得使用者角色（安全版本）
 */
function getUserRole() {
    try {
        return localStorage.getItem('role') || null;
    } catch (error) {
        console.error('❌ getUserRole 錯誤:', error);
        return null;
    }
}

/* --------------------------------------------------
   檢查登入狀態
   -------------------------------------------------- */
function checkLoginStatus() {
  const userJson = localStorage.getItem('user');
  
  if (!userJson) {
    // 未登入，跳轉到登入頁面
    showToast('請先登入', 'warning');
    setTimeout(() => {
      window.location.href = 'login.html';
    }, 1000);
    return;
  }
  
  try {
    currentUser = JSON.parse(userJson);
    
    // 檢查角色權限（只有 teacher 和 admin 可以訪問）
    if (currentUser.role !== 'teacher' && currentUser.role !== 'admin') {
      showToast('您沒有權限訪問教師後台', 'error');
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

/* --------------------------------------------------
   顯示使用者資訊
   -------------------------------------------------- */
function displayUserInfo() {
  if (currentUser) {
    const userInfoElement = document.getElementById('userInfo');
    if (userInfoElement) {
      userInfoElement.textContent = 
        `👤 ${currentUser.name} (${currentUser.role === 'teacher' ? '教師' : '管理員'})`;
    }
  }
}

/* ==========================================
   功能 1: 建立班級
   ========================================== */
function handleCreateClass() {
  const input = document.getElementById('newClassName');
  const className = input.value.trim();
  
  if (!className) {
    showToast('請輸入班級名稱', 'warning');
    input.focus();
    return;
  }
  
  const btn = event.target;
  btn.disabled = true;
  btn.textContent = '建立中...';
  
  const params = new URLSearchParams({
    action: 'createClass',
    className: className,
    teacherEmail: currentUser.email
  });
  
  APP_CONFIG.log('📤 建立班級...', { className });
  
  fetch(`${APP_CONFIG.API_URL}?${params.toString()}`)
    .then(response => response.json())
    .then(function(response) {
      btn.disabled = false;
      btn.textContent = '建立班級';
      
      APP_CONFIG.log('📥 建立班級回應:', response);
      
      if (response.success) {
        // 成功提示
        showToast(`班級「${className}」建立成功！`, 'success');
        
        input.value = '';  // 清空輸入框
        
        // 關閉 Modal
        closeModal('createClassModal');
        
        // 延遲 500ms 後重新載入班級列表（讓使用者看到成功訊息）
        setTimeout(() => {
          loadClasses();
        }, 500);
        
      } else {
        showToast(response.message || '建立失敗', 'error');
      }
    })
    .catch(function(error) {
      btn.disabled = false;
      btn.textContent = '建立班級';
      
      APP_CONFIG.error('建立班級失敗', error);
      const errorMsg = error && error.message ? error.message : '未知錯誤';
      showToast('系統錯誤：' + errorMsg, 'error');
    });
}

/* ==========================================
   功能 2: 載入班級列表
   ========================================== */
async function loadClasses() {
    const email = getUserEmail();
    
    if (!email) {
        console.error('無法取得 email');
        showToast('請重新登入', 'error');
        return;
    }

  // 顯示載入動畫（使用統一函數）
  showLoading('classLoading');
  
  // 準備參數
  const params = new URLSearchParams({
    action: 'getTeacherClasses',
    teacherEmail: currentUser.email
  });
  
  APP_CONFIG.log('📤 載入班級列表...', { email: currentUser.email });
  
  // 呼叫後端
  fetch(`${APP_CONFIG.API_URL}?${params.toString()}`)
    .then(response => response.json())
    .then(function(response) {
      APP_CONFIG.log('📥 後端回應:', response);

      if (response.success) {
        // 成功取得資料（包含空陣列）
        displayClasses(response.classes);

        // 如果有訊息且不是空陣列，顯示提示
        if (response.message && response.classes.length === 0) {
          APP_CONFIG.log('ℹ️ ' + response.message);
        }
      } else {
        // 真正的錯誤
        showToast(response.message || '載入失敗', 'error');

        // 即使錯誤，也顯示空狀態
        displayClasses([]);
      }

      // 性能優化：在顯示數據後才隱藏 loading，避免空白間隙
      hideLoading('classLoading');
    })
    .catch(function(error) {
      APP_CONFIG.error('載入班級失敗', error);

      // 顯示友善的錯誤訊息
      showToast('無法連接到伺服器，請檢查網路連線或稍後再試', 'error');

      // 顯示空狀態
      displayClasses([]);

      // 最後隱藏 loading
      hideLoading('classLoading');
    });
}

/**
 * 顯示班級卡片
 */
function displayClasses(classes) {
    const grid = document.getElementById('classesGrid');
    
    if (!grid) {
        APP_CONFIG.error('找不到 classesGrid 元素');
        return;
    }
    
    // 空狀態
    if (!classes || classes.length === 0) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <div class="empty-state-icon">👥</div>
                <h3>尚未建立任何班級</h3>
                <p>點擊上方「建立新班級」按鈕開始建立您的第一個班級</p>
                <button class="btn btn-primary" onclick="openCreateClassModal()">
                    ➕ 建立新班級
                </button>
            </div>
        `;
        
        APP_CONFIG.log('📋 顯示空狀態（沒有班級）');
        return;
    }
    
    // 清空
    grid.innerHTML = '';
    
    APP_CONFIG.log(`📋 顯示 ${classes.length} 個班級`);
    
    // 生成班級卡片（使用統一樣式）
    classes.forEach(function(classData) {
        const card = document.createElement('div');
        card.className = 'card';
        
        // 標準化欄位名（後端可能返回 class_id 或 classId）
        const classId = classData.classId || classData.class_id;
        const className = classData.className || classData.class_name;
        const createDate = classData.createDate || classData.create_date;
        const isCoTeacher = classData.isCoTeacher || classData.is_co_teacher;
        
        // 確保有效數據
        if (!classId || !className) {
            console.warn('⚠️ 班級數據不完整:', classData);
            return; // 跳過此班級
        }
        
        // 格式化日期（使用統一函數）
        const dateStr = formatDate(createDate);
        
        card.innerHTML = `
            <div class="card-header">
                <div>
                    <div class="card-title">${escapeHtml(className)}</div>
                </div>
                <div class="card-badge class">班級</div>
            </div>
            <div class="card-meta">
                <div class="card-meta-item">
                    <span class="card-meta-icon">📅</span>
                    <span>${dateStr}</span>
                </div>
                <div class="card-meta-item">
                    <span class="card-meta-icon">🔑</span>
                    <span>${classId.substring(0, 8)}...</span>
                </div>
                ${isCoTeacher ? `
                <div class="card-meta-item" style="color: #F59E0B;">
                    <span class="card-meta-icon">👥</span>
                    <span>代課教師</span>
                </div>
                ` : ''}
            </div>
            <div class="card-actions">
                <button class="btn btn-primary" onclick="event.stopPropagation(); openImportSection('${classId}', '${escapeHtml(className)}')">匯入學生</button>
                <button class="btn btn-secondary" onclick="event.stopPropagation(); viewClassMembers('${classId}', '${escapeHtml(className)}')">查看名單</button>
                <button class="btn btn-secondary" onclick="event.stopPropagation(); openCoTeacherModal('${classId}', '${escapeHtml(className)}')">代課教師</button>
            </div>
        `;
        
        grid.appendChild(card);
    });
}

/* ==========================================
   功能 3: 開啟匯入學生區塊
   ========================================== */
function openImportSection(classId, className) {
  currentClassId = classId;
  
  // 更新匯入區塊的標題
  const title = document.getElementById('importSectionTitle');
  if (title) {
    title.textContent = `📥 匯入學生到「${className}」`;
  }
  
  // 顯示匯入區塊
  const importSection = document.getElementById('importSection');
  if (importSection) {
    importSection.classList.add('active');
    importSection.scrollIntoView({ behavior: 'smooth' });
  }
  
  // 清空之前的資料
  const pasteArea = document.getElementById('pasteArea');
  if (pasteArea) {
    pasteArea.value = '';
  }
  
  const previewContainer = document.getElementById('previewContainer');
  if (previewContainer) {
    previewContainer.style.display = 'none';
  }
  
  parsedStudents = [];
}

/* --------------------------------------------------
   關閉匯入學生區塊
   -------------------------------------------------- */
function closeImportSection() {
  const importSection = document.getElementById('importSection');
  if (importSection) {
    importSection.classList.remove('active');
  }
  
  currentClassId = null;
  
  // 移除所有班級卡片的 active 狀態
  document.querySelectorAll('.class-card').forEach(function(card) {
    card.classList.remove('active');
  });
}

/* ==========================================
   功能 4: 解析貼上的資料
   ========================================== */
function handleParseData() {
  // 1. 取得貼上的文字
  const pasteArea = document.getElementById('pasteArea');
  const pasteText = pasteArea ? pasteArea.value.trim() : '';
  
  if (!pasteText) {
    showToast('請先貼上資料', 'warning');
    return;
  }
  
  // 2. 使用 PapaParse 解析 CSV/TSV 格式
  Papa.parse(pasteText, {
    delimiter: '',  // 自動偵測分隔符號（Tab 或逗號）
    skipEmptyLines: true,
    complete: function(results) {
      const data = results.data;
      
      if (!data || data.length === 0) {
        showToast('無法解析資料，請確認格式是否正確', 'error');
        return;
      }
      
      // 3. 判斷是否包含標題列
      let startRow = 0;
      const firstRow = data[0];
      
      // 如果第一列包含「座號」、「姓名」等關鍵字，視為標題列
      if (firstRow.some(cell => 
        cell && (cell.includes('座號') || cell.includes('姓名') || cell.includes('名'))
      )) {
        startRow = 1;
      }
      
      // 4. 解析學生資料
      parsedStudents = [];
      
      for (let i = startRow; i < data.length; i++) {
        const row = data[i];
        
        // 確保至少有 2 欄（座號、姓名）
        if (row.length < 2) continue;
        
        const student = {
          seat: row[0] ? String(row[0]).trim() : '',
          name: row[1] ? String(row[1]).trim() : '',
          email: row[2] ? String(row[2]).trim() : ''
        };
        
        // 驗證必填欄位
        if (student.seat && student.name) {
          parsedStudents.push(student);
        }
      }
      
      // 5. 顯示預覽
      if (parsedStudents.length > 0) {
        displayPreview();
        showToast(`成功解析 ${parsedStudents.length} 位學生`, 'success');
      } else {
        showToast('沒有找到有效的學生資料\n\n請確認格式：\n座號 [Tab] 姓名 [Tab] Email', 'error');
      }
    },
    error: function(error) {
      const errorMsg = error && error.message ? error.message : '未知錯誤';
      showToast('解析錯誤：' + errorMsg, 'error');
    }
  });
}

/* --------------------------------------------------
   顯示預覽表格
   -------------------------------------------------- */
function displayPreview() {
  const tbody = document.getElementById('previewTableBody');
  if (!tbody) return;
  
  tbody.innerHTML = '';
  
  // 為每位學生建立一列
  parsedStudents.forEach(function(student) {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${escapeHtml(student.seat)}</td>
      <td>${escapeHtml(student.name)}</td>
      <td>${escapeHtml(student.email || '(未提供)')}</td>
    `;
    tbody.appendChild(row);
  });
  
  // 更新學生人數
  const studentCount = document.getElementById('studentCount');
  if (studentCount) {
    studentCount.textContent = parsedStudents.length;
  }
  
  // 顯示預覽容器
  const previewContainer = document.getElementById('previewContainer');
  if (previewContainer) {
    previewContainer.style.display = 'block';
  }
}

/* ==========================================
   功能 5: 確認匯入學生
   ========================================== */
function handleConfirmImport() {
  // 1. 驗證資料
  if (!currentClassId) {
    showToast('請先選擇班級', 'warning');
    return;
  }
  
  if (!parsedStudents || parsedStudents.length === 0) {
    showToast('請先解析學生資料', 'warning');
    return;
  }
  
  // 2. 確認對話框（使用統一的 showConfirm）
  showConfirm(
    `確定要匯入 ${parsedStudents.length} 位學生嗎？\n\n` +
    `班級 ID: ${currentClassId.substring(0, 8)}...\n` +
    `學生人數: ${parsedStudents.length} 位`,
    function() {
      // 確認後執行
      executeImport();
    }
  );
}

/**
 * 執行匯入
 */
function executeImport() {
  // 停用按鈕
  const btn = document.querySelector('#importSection button[onclick*="handleConfirmImport"]');
  if (btn) {
    btn.disabled = true;
    btn.textContent = '匯入中...';
  }
  
  // 使用 JSONP 方式傳送資料（因為 POST 可能有 CORS 問題）
  makeJSONPRequest({
    action: 'importStudents',
    classId: currentClassId,
    studentList: JSON.stringify(parsedStudents),
    teacherEmail: currentUser.email
  })
  .then(function(response) {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '✓ 確認匯入';
    }
    
    if (response.success) {
      showToast(response.message || '匯入成功', 'success');
      
      // 清空表單
      const pasteArea = document.getElementById('pasteArea');
      if (pasteArea) {
        pasteArea.value = '';
      }
      
      const previewContainer = document.getElementById('previewContainer');
      if (previewContainer) {
        previewContainer.style.display = 'none';
      }
      
      parsedStudents = [];
      
      // 關閉匯入區塊
      closeImportSection();
    } else {
      showToast(response.message || '匯入失敗', 'error');
    }
  })
  .catch(function(error) {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '✓ 確認匯入';
    }
    const errorMsg = error && error.message ? error.message : '未知錯誤';
    showToast('匯入失敗：' + errorMsg, 'error');
    console.error('Error:', error);
  });
}

/* ==========================================
   功能 6: 查看班級成員（使用 Modal）
   ========================================== */
function viewClassMembers(classId, className) {
  // 顯示載入提示
  showToast('正在載入學生名單...', 'info');
  
  APP_CONFIG.log('📤 載入班級成員...', { classId, className });
  
  // 準備參數
  const params = new URLSearchParams({
    action: 'getClassMembers',
    classId: classId,
    teacherEmail: currentUser.email
  });
  
  // 呼叫後端
  fetch(`${APP_CONFIG.API_URL}?${params.toString()}`)
    .then(response => response.json())
    .then(function(response) {
      APP_CONFIG.log('📥 後端回應:', response);
      
      if (response.success) {
        // 開啟 Modal（傳入班級名稱）
        openStudentModal(classId, className, response.members);
      } else {
        showToast(response.message || '取得名單失敗', 'error');
      }
    })
    .catch(function(error) {
      APP_CONFIG.error('取得名單失敗', error);
      const errorMsg = error && error.message ? error.message : '未知錯誤';
      showToast('取得名單失敗：' + errorMsg, 'error');
    });
}

/* ==========================================
   功能 7: 開啟建立班級 Modal
   ========================================== */
function openCreateClassModal() {
    openModal('createClassModal');  // 使用統一的 openModal 函數
    document.getElementById('newClassName').value = '';
}

/* ==========================================
   工具函式
   ========================================== */

/**
 * JSONP 請求函數（避免 CORS 問題）
 */
function makeJSONPRequest(data) {
  return new Promise((resolve, reject) => {
    const callbackName = 'jsonp_callback_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
    
    window[callbackName] = function(response) {
      console.log('📥 JSONP 回應:', response);
      delete window[callbackName];
      if (script && script.parentNode) {
        script.parentNode.removeChild(script);
      }
      resolve(response);
    };
    
    const params = new URLSearchParams({
      callback: callbackName,
      ...data
    });
    
    const script = document.createElement('script');
    script.src = `${APP_CONFIG.API_URL}?${params.toString()}`;
    
    script.onerror = (error) => {
      console.error('❌ JSONP 載入失敗:', error);
      delete window[callbackName];
      if (script && script.parentNode) {
        script.parentNode.removeChild(script);
      }
      reject(new Error('請求失敗'));
    };
    
    document.body.appendChild(script);
    
    setTimeout(() => {
      if (window[callbackName]) {
        console.error('⏱️ JSONP 請求超時');
        delete window[callbackName];
        if (script && script.parentNode) {
          script.parentNode.removeChild(script);
        }
        reject(new Error('請求超時，請稍後再試'));
      }
    }, 15000);
  });
}
/**
 * 切換 Tab（支援班級、課程、代幣管理）
 */
function switchTab(tabName) {
    console.log('🔄 [switchTab] 切換標籤:', tabName);
    
    // 更新 Tab 樣式
    const tabs = document.querySelectorAll('.tab-item');
    tabs.forEach(tab => {
        tab.classList.remove('active');
    });
    
    // 找到被點擊的 Tab 並加上 active
    event.target.closest('.tab-item').classList.add('active');
    
    // 隱藏所有區塊
    document.querySelectorAll('.management-section').forEach(section => {
        section.style.display = 'none';
        section.classList.remove('active');
    });
    
    // 顯示目標區塊
    const targetSection = document.getElementById(`${tabName}Section`);
    if (targetSection) {
        targetSection.style.display = 'block';
        targetSection.classList.add('active');
    }
    
    // 載入對應資料
    if (tabName === 'classes') {
        loadClasses();
    } else if (tabName === 'tokens') {
        // 載入班級選項到代幣管理的下拉選單
        loadTokenClasses();
    } else if (tabName === 'assignments') {
        // 載入授課安排
        if (typeof loadAssignments === 'function') {
            loadAssignments();
        }
    } else if (tabName === 'review') {
        // 載入任務審核儀表板
        if (typeof loadReview === 'function') {
            loadReview();
        }
    } else if (tabName === 'analytics') {
        // 載入數據分析 - 簡單優化：只預加載班級列表到下拉菜單
        console.log('📊 [switchTab] 切換到分析標籤');
        loadAnalyticsClassList();
    } else if (tabName === 'grading') {
        // 載入作業批改
        if (typeof loadGradingClassList === 'function') {
            loadGradingClassList();
        }
    }
}

/**
 * 載入班級選項到代幣管理下拉選單
 */
function loadTokenClasses() {
    const email = getUserEmail();

    if (!email) {
        console.error('無法取得 email');
        return;
    }

    const select = document.getElementById('tokenClassSelect');

    // 顯示載入中狀態
    if (select) {
        select.innerHTML = '<option value="">載入班級中...</option>';
        select.disabled = true;
    }

    const params = new URLSearchParams({
        action: 'getTeacherClasses',
        teacherEmail: email
    });

    fetch(`${APP_CONFIG.API_URL}?${params.toString()}`)
        .then(response => response.json())
        .then(function(response) {
            // 啟用選單
            if (select) {
                select.disabled = false;
            }

            if (response.success && response.classes && response.classes.length > 0) {
                if (select) {
                    // 清空舊選項
                    select.innerHTML = '<option value="">請選擇班級</option>';

                    // 加入班級選項
                    response.classes.forEach(function(classData) {
                        const option = document.createElement('option');
                        // 標準化欄位名（後端可能返回 class_id 或 classId）
                        option.value = classData.classId || classData.class_id;
                        option.textContent = classData.className || classData.class_name;
                        select.appendChild(option);
                    });
                }
            } else {
                // 沒有班級
                if (select) {
                    select.innerHTML = '<option value="">尚未建立班級</option>';
                }
                showToast('您尚未建立任何班級', 'info');
            }
        })
        .catch(function(error) {
            console.error('載入班級選項失敗:', error);

            // 啟用選單並顯示錯誤
            if (select) {
                select.disabled = false;
                select.innerHTML = '<option value="">載入失敗，請重新整理</option>';
            }

            showToast('載入班級失敗：' + error.message, 'error');
        });
}

/**
 * 載入班級代幣資訊（當選擇班級時）
 */
function loadClassTokens(classId) {
    if (!classId) {
        // 隱藏統計和表格，顯示空狀態
        const tableContainer = document.getElementById('tokenTableContainer');
        const statsContainer = document.getElementById('tokenStats');
        const emptyState = document.getElementById('tokenEmptyState');
        
        if (tableContainer) tableContainer.innerHTML = '';
        if (statsContainer) statsContainer.style.display = 'none';
        if (emptyState) emptyState.style.display = 'block';
        return;
    }
    
    const email = getUserEmail();
    
    // 隱藏表格和統計卡片，顯示載入狀態
    const tableContainer = document.getElementById('tokenTableContainer');
    const statsContainer = document.getElementById('tokenStats');
    const emptyState = document.getElementById('tokenEmptyState');
    
    if (tableContainer) tableContainer.style.display = 'none';
    if (statsContainer) statsContainer.style.display = 'none';
    if (emptyState) emptyState.style.display = 'none';
    
    // 顯示載入動畫
    showLoading('tokenLoading');
    
    const params = new URLSearchParams({
        action: 'getClassTokens',
        classId: classId,
        teacherEmail: email
    });
    
    fetch(`${APP_CONFIG.API_URL}?${params.toString()}`)
        .then(response => response.json())
        .then(function(response) {
            hideLoading('tokenLoading');
            
            if (response.success) {
                const students = response.students || [];
                // 儲存到全域變數供 openAdjustModal 使用
                currentTokenStudents = students;
                
                if (!students || students.length === 0) {
                    // 班級內沒有學生
                    if (tableContainer) {
                        tableContainer.innerHTML = `
                            <div class="empty-state">
                                <div class="empty-state-icon">�</div>
                                <h3>此班級尚無學生</h3>
                                <p>請先在班級管理中匯入學生</p>
                            </div>
                        `;
                        tableContainer.style.display = 'block';
                    }
                } else {
                    // 顯示代幣表格
                    displayTokenTable(students);
                    if (tableContainer) tableContainer.style.display = 'block';
                }
                
                // 更新統計資訊
                document.getElementById('totalTokens').textContent = response.totalTokens || 0;
                document.getElementById('totalStudents').textContent = response.totalStudents || 0;
                
                const avgTokens = response.totalStudents > 0 
                    ? Math.round(response.totalTokens / response.totalStudents) 
                    : 0;
                document.getElementById('avgTokens').textContent = avgTokens;
                
                // 顯示統計卡片
                if (statsContainer) statsContainer.style.display = 'grid';
            } else {
                showToast(response.message || '載入失敗', 'error');
                if (emptyState) emptyState.style.display = 'block';
            }
        })
        .catch(function(error) {
            hideLoading('tokenLoading');
            console.error('載入班級代幣失敗:', error);
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
 * 開啟調整代幣 Modal
 */
function openAdjustModal(userId, currentTokens, type) {
    // 找到學生資訊
    selectedTokenStudent = currentTokenStudents.find(s => s.userId === userId);
    if (!selectedTokenStudent) {
        showToast('找不到學生資訊', 'error');
        return;
    }
    
    // 填入表單
    document.getElementById('adjustStudentName').value = selectedTokenStudent.name;
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

/* ==========================================
   功能 8: 學生名單 Modal 相關功能
   ========================================== */

// 存儲當前班級的學生資料
let currentClassStudents = [];
let currentClassIdForModal = null;

/**
 * 開啟學生名單 Modal
 */
function openStudentModal(classId, className, students) {
    currentClassIdForModal = classId;
    currentClassStudents = students || [];
    
    // 設定班級名稱
    document.getElementById('studentListClassName').textContent = className;
    
    // 顯示學生列表
    displayStudentList(students);
    
    // 打開 Modal
    openModal('studentListModal');
}

/**
 * 顯示學生列表
 */
function displayStudentList(students) {
    const tbody = document.getElementById('studentListTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (!students || students.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center; padding: 40px; color: var(--text-medium);">
                    此班級暫無學生
                </td>
            </tr>
        `;
        updateStudentStats(0, 0);
        return;
    }
    
    // 計算統計信息
    let withEmailCount = 0;
    
    students.forEach(function(student, index) {
        if (student.student_email || student.email) {
            withEmailCount++;
        }
        
        const row = document.createElement('tr');
        const email = student.student_email || student.email || '';
        
        row.innerHTML = `
            <td style="text-align: center;">${escapeHtml(student.seat_number || student.seat || '-')}</td>
            <td>${escapeHtml(student.student_name || student.name || '')}</td>
            <td>${escapeHtml(email || '(未提供)')}</td>
            <td style="text-align: center;">
                <button class="btn-edit-student" onclick="editStudent(${index})">✏️ 編輯</button>
            </td>
        `;
        
        tbody.appendChild(row);
    });
    
    // 更新統計信息
    updateStudentStats(students.length, withEmailCount);
    
    // 清空搜尋和篩選
    document.getElementById('studentSearchInput').value = '';
    document.getElementById('studentFilterSelect').value = '';
}

/**
 * 更新學生統計信息
 */
function updateStudentStats(total, withEmail) {
    const withoutEmail = total - withEmail;
    
    document.getElementById('totalStudentsCount').textContent = total;
    document.getElementById('withEmailCount').textContent = withEmail;
    document.getElementById('withoutEmailCount').textContent = withoutEmail;
}

/**
 * 篩選和搜尋學生
 */
function filterStudentList() {
    const searchInput = document.getElementById('studentSearchInput').value.toLowerCase();
    const filterSelect = document.getElementById('studentFilterSelect').value;
    const tbody = document.getElementById('studentListTableBody');
    
    if (!tbody) return;
    
    let visibleCount = 0;
    let withEmailCount = 0;
    
    const rows = tbody.querySelectorAll('tr');
    
    rows.forEach(function(row) {
        let show = true;
        
        // 搜尋篩選
        if (searchInput) {
            const cells = row.querySelectorAll('td');
            const seatText = cells[0] ? cells[0].textContent.toLowerCase() : '';
            const nameText = cells[1] ? cells[1].textContent.toLowerCase() : '';
            
            show = seatText.includes(searchInput) || nameText.includes(searchInput);
        }
        
        // Email 篩選
        if (show && filterSelect) {
            const emailCell = row.querySelectorAll('td')[2];
            const email = emailCell ? emailCell.textContent.trim() : '';
            
            if (filterSelect === 'has-email') {
                show = email !== '(未提供)';
            } else if (filterSelect === 'no-email') {
                show = email === '(未提供)';
            }
        }
        
        row.style.display = show ? '' : 'none';
        
        if (show) {
            visibleCount++;
            const emailCell = row.querySelectorAll('td')[2];
            if (emailCell && emailCell.textContent.trim() !== '(未提供)') {
                withEmailCount++;
            }
        }
    });
}

/**
 * 編輯學生資料（此時可以擴展為直接編輯功能）
 */
function editStudent(index) {
    showToast('編輯功能準備中...', 'info');
    // TODO: 實現直接編輯功能
}

/**
 * 匯出學生名單為 Excel
 */
function exportStudentListExcel() {
    if (!currentClassStudents || currentClassStudents.length === 0) {
        showToast('沒有學生資料可以匯出', 'warning');
        return;
    }
    
    // 使用簡單的 CSV 方式（瀏覽器原生支持）
    let csv = '座號,姓名,Email\n';
    
    currentClassStudents.forEach(function(student) {
        const seat = student.seat_number || student.seat || '';
        const name = student.student_name || student.name || '';
        const email = student.student_email || student.email || '';
        
        // 避免 CSV 格式錯誤
        const sanitizedSeat = `"${seat}"`;
        const sanitizedName = `"${name}"`;
        const sanitizedEmail = `"${email}"`;
        
        csv += `${sanitizedSeat},${sanitizedName},${sanitizedEmail}\n`;
    });
    
    // 建立 Blob 物件
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    
    // 建立下載連結
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `${document.getElementById('studentListClassName').textContent}_名單.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast('✅ 名單已匯出', 'success');
}

/**
 * 列印學生名單
 */
function printStudentList() {
    if (!currentClassStudents || currentClassStudents.length === 0) {
        showToast('沒有學生資料可以列印', 'warning');
        return;
    }
    
    // 建立列印內容
    let printContent = `
        <html>
            <head>
                <title>班級名單</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    h1 { text-align: center; margin-bottom: 20px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
                    th { background-color: #f2f2f2; font-weight: bold; }
                    tr:nth-child(even) { background-color: #f9f9f9; }
                    .print-time { text-align: right; margin-top: 20px; font-size: 12px; color: #666; }
                </style>
            </head>
            <body>
                <h1>${escapeHtml(document.getElementById('studentListClassName').textContent)} - 班級名單</h1>
                <table>
                    <thead>
                        <tr>
                            <th>座號</th>
                            <th>姓名</th>
                            <th>Email</th>
                        </tr>
                    </thead>
                    <tbody>
    `;
    
    currentClassStudents.forEach(function(student) {
        const seat = escapeHtml(student.seat_number || student.seat || '-');
        const name = escapeHtml(student.student_name || student.name || '');
        const email = escapeHtml(student.student_email || student.email || '');
        
        printContent += `
            <tr>
                <td>${seat}</td>
                <td>${name}</td>
                <td>${email}</td>
            </tr>
        `;
    });
    
    printContent += `
                    </tbody>
                </table>
                <div class="print-time">列印時間：${new Date().toLocaleString('zh-TW')}</div>
            </body>
        </html>
    `;
    
    // 打開列印視窗
    const printWindow = window.open('', '', 'width=800,height=600');
    printWindow.document.write(printContent);
    printWindow.document.close();
    
    // 延遲後觸發列印（確保內容完全加載）
    setTimeout(function() {
        printWindow.print();
    }, 250);
}

let currentCoTeacherClassId = null;

function openCoTeacherModal(classId, className) {
    currentCoTeacherClassId = classId;
    document.getElementById('coTeacherClassName').textContent = className;
    
    // TODO: 可選實作 - 載入現有代課教師名單
    document.getElementById('coTeachersInput').value = '';
    
    openModal('coTeacherModal');
}

function handleSaveCoTeachers() {
    const input = document.getElementById('coTeachersInput').value.trim();
    const emails = input.split(',').map(e => e.trim()).filter(e => e);
    const coTeachers = emails.join('|'); // 用 | 分隔
    
    if (!currentCoTeacherClassId) return;
    
    const btn = event.target;
    btn.disabled = true;
    btn.textContent = '儲存中...';
    
    const params = new URLSearchParams({
        action: 'updateCoTeachers',
        classId: currentCoTeacherClassId,
        coTeachers: coTeachers,
        teacherEmail: getUserEmail()
    });
    
    fetch(`${APP_CONFIG.API_URL}?${params}`)
        .then(res => res.json())
        .then(data => {
            btn.disabled = false;
            btn.textContent = '儲存';
            
            if (data.success) {
                showToast('代課教師設定成功！', 'success');
                closeModal('coTeacherModal');
            } else {
                showToast(data.message || '設定失敗', 'error');
            }
        })
        .catch(err => {
            btn.disabled = false;
            btn.textContent = '儲存';
            showToast('系統錯誤：' + err.message, 'error');
        });
}

/* ==========================================
   數據分析相關函數
   ========================================== */

/**
 * 簡單優化：只預加載班級列表到下拉菜單
 * 課程和任務仍然通過API動態加載
 */
async function loadAnalyticsClassList() {
    try {
        const email = getUserEmail();
        if (!email) {
            console.error('❌ [Analytics] 無法取得教師信箱');
            return;
        }
        
        console.log('📊 [Analytics] 預加載班級列表...');
        
        const params = new URLSearchParams({
            action: 'getTeacherClasses',
            teacherEmail: email
        });
        const response = await fetch(`${APP_CONFIG.API_URL}?${params.toString()}`);
        const data = await response.json();
        
        console.log('📊 [Analytics] 班級列表:', data);
        
        if (data.success && data.classes && data.classes.length > 0) {
            const classSelect = document.getElementById('analyticsClassFilter');
            if (classSelect) {
                classSelect.innerHTML = '<option value="">所有班級</option>';
                data.classes.forEach(cls => {
                    const option = document.createElement('option');
                    option.value = cls.class_id || cls.classId;
                    option.textContent = cls.class_name || cls.name || cls.className;
                    classSelect.appendChild(option);
                });
                console.log('📊 [Analytics] ✓ 班級列表已預加載，共', data.classes.length, '個');
            }
        }
    } catch (error) {
        console.error('❌ [Analytics] 預加載班級失敗:', error);
    }
}

/**
 * 預加載所有班級、課程、任務到內存
 * 使數據篩選操作瞬間完成
 */
let analyticsCharts = {};
let isAnalyticsLoading = false;

async function onAnalyticsClassChange() {
    // 班級改變時，調用API加載課程列表
    const classId = document.getElementById('analyticsClassFilter').value;
    console.log('📊 [Analytics] 班級選擇改變:', classId);
    
    // 清空課程和任務下拉菜單
    document.getElementById('analyticsCourseFilter').innerHTML = '<option value="">載入課程中...</option>';
    document.getElementById('analyticsTaskFilter').innerHTML = '<option value="">所有任務</option>';
    
    if (!classId) {
        document.getElementById('analyticsCourseFilter').innerHTML = '<option value="">所有課程</option>';
        return;
    }
    
    // 調用API加載課程
    try {
        const email = getUserEmail();
        const params = new URLSearchParams({
            action: 'getTeacherCourses',
            teacherEmail: email
        });
        const response = await fetch(`${APP_CONFIG.API_URL}?${params.toString()}`);
        const data = await response.json();
        
        console.log('📊 [Analytics] 課程列表:', data);
        
        const courseSelect = document.getElementById('analyticsCourseFilter');
        courseSelect.innerHTML = '<option value="">所有課程</option>';
        
        if (data.success && data.courses && data.courses.length > 0) {
            data.courses.forEach(course => {
                const option = document.createElement('option');
                option.value = course.course_id || course.courseId;
                option.textContent = course.name || course.course_name;
                courseSelect.appendChild(option);
            });
            console.log('📊 [Analytics] ✓ 課程列表已加載，共', data.courses.length, '個');
        }
    } catch (error) {
        console.error('❌ [Analytics] 加載課程失敗:', error);
        document.getElementById('analyticsCourseFilter').innerHTML = '<option value="">所有課程</option>';
    }
}

async function onAnalyticsCourseChange() {
    // 課程改變時，調用API加載任務列表
    const courseId = document.getElementById('analyticsCourseFilter').value;
    console.log('📊 [Analytics] 課程選擇改變:', courseId);

    // 更新課程相關的 UI（完成度和完成時間）
    updateAnalyticsCourseDependentUI(!!courseId);

    // 清空任務下拉菜單
    document.getElementById('analyticsTaskFilter').innerHTML = '<option value="">載入任務中...</option>';

    if (!courseId) {
        document.getElementById('analyticsTaskFilter').innerHTML = '<option value="">所有任務</option>';
        // 重置任務相關的 UI
        updateAnalyticsTaskDependentUI(false);
        return;
    }

    // 顯示 loading 動畫
    document.getElementById('analyticsLoadingDiv').style.display = 'flex';

    // 調用API加載任務
    try {
        const params = new URLSearchParams({
            action: 'getCourseDetails',
            courseId: courseId
        });
        const response = await fetch(`${APP_CONFIG.API_URL}?${params.toString()}`);
        const data = await response.json();

        console.log('📊 [Analytics] 任務列表:', data);

        const taskSelect = document.getElementById('analyticsTaskFilter');
        taskSelect.innerHTML = '<option value="">所有任務</option>';

        if (data.success && data.tasks && data.tasks.length > 0) {
            data.tasks.forEach(task => {
                const option = document.createElement('option');
                option.value = task.task_id || task.taskId || task.id;
                option.textContent = task.name || task.task_name;
                taskSelect.appendChild(option);
            });
            console.log('📊 [Analytics] ✓ 任務列表已加載，共', data.tasks.length, '個');
        }

        // 加載課程相關的統計數據（完成度和完成時間）
        const classId = document.getElementById('analyticsClassFilter').value;
        if (classId) {
            await Promise.all([
                loadAnalyticsCompletionStats(classId, courseId),
                loadAnalyticsTimeStats(classId, courseId)
            ]);
        }
    } catch (error) {
        console.error('❌ [Analytics] 加載任務失敗:', error);
        document.getElementById('analyticsTaskFilter').innerHTML = '<option value="">所有任務</option>';
    } finally {
        // 隱藏 loading 動畫
        document.getElementById('analyticsLoadingDiv').style.display = 'none';
    }
}

async function onAnalyticsTaskChange() {
    const classId = document.getElementById('analyticsClassFilter').value;
    const courseId = document.getElementById('analyticsCourseFilter').value;
    const taskId = document.getElementById('analyticsTaskFilter').value;

    if (!classId) {
        console.warn('⚠️ [Analytics] 未選擇班級');
        return;
    }

    console.log('📊 [Analytics] 任務選擇改變，開始加載統計數據');

    // 根據是否選擇任務，顯示/隱藏對應的內容
    updateAnalyticsTaskDependentUI(!!taskId);

    // 顯示 loading 動畫
    document.getElementById('analyticsLoadingDiv').style.display = 'flex';

    // 平行加載所有統計（完成度、分數、時間）
    try {
        await Promise.all([
            loadAnalyticsCompletionStats(classId, courseId),
            loadAnalyticsScoreStats(classId, courseId),
            loadAnalyticsTimeStats(classId, courseId)
        ]);
        console.log('📊 [Analytics] 基本統計加載完成');

        // 如果有選擇任務，加載評量答對率和異常分析
        if (taskId) {
            console.log('📊 [Analytics] 已選擇任務，開始加載詳細分析');
            await Promise.all([
                loadAnalyticsAssessmentStats(classId, taskId),
                loadAnalyticsAnomalies(classId, taskId)
            ]);
            console.log('📊 [Analytics] 詳細分析加載完成');
        } else {
            console.log('⚠️ [Analytics] 未選擇任務，跳過詳細分析');
        }
    } catch (error) {
        console.error('❌ [Analytics] 統計加載失敗：', error);
    } finally {
        // 隱藏 loading 動畫
        document.getElementById('analyticsLoadingDiv').style.display = 'none';
    }
}

/**
 * 更新需要選擇課程的 UI 顯示狀態
 * @param {boolean} hasCourse - 是否已選擇課程
 */
function updateAnalyticsCourseDependentUI(hasCourse) {
    // 完成度
    const completionMessage = document.getElementById('completionNoCourseMessage');
    const completionContainer = document.getElementById('completionChartContainer');
    if (completionMessage && completionContainer) {
        completionMessage.style.display = hasCourse ? 'none' : 'block';
        completionContainer.style.display = hasCourse ? 'block' : 'none';
    }

    // 完成時間
    const timeMessage = document.getElementById('timeNoCourseMessage');
    const timeContainer = document.getElementById('timeChartContainer');
    if (timeMessage && timeContainer) {
        timeMessage.style.display = hasCourse ? 'none' : 'block';
        timeContainer.style.display = hasCourse ? 'block' : 'none';
    }
}

/**
 * 更新需要選擇任務的 UI 顯示狀態
 * @param {boolean} hasTask - 是否已選擇任務
 */
function updateAnalyticsTaskDependentUI(hasTask) {
    // 評量正確率
    const assessmentMessage = document.getElementById('assessmentNoTaskMessage');
    const assessmentContainer = document.getElementById('assessmentChartContainer');
    if (assessmentMessage && assessmentContainer) {
        assessmentMessage.style.display = hasTask ? 'none' : 'block';
        assessmentContainer.style.display = hasTask ? 'block' : 'none';
    }

    // 作業分數
    const scoreMessage = document.getElementById('scoreNoTaskMessage');
    const scoreContainer = document.getElementById('scoreChartContainer');
    if (scoreMessage && scoreContainer) {
        scoreMessage.style.display = hasTask ? 'none' : 'block';
        scoreContainer.style.display = hasTask ? 'block' : 'none';
    }

    // 異常警示
    const anomalyMessage = document.getElementById('anomalyNoTaskMessage');
    const anomalyContainer = document.getElementById('anomalyContentContainer');
    if (anomalyMessage && anomalyContainer) {
        anomalyMessage.style.display = hasTask ? 'none' : 'block';
        anomalyContainer.style.display = hasTask ? 'block' : 'none';
    }
}

// ==========================================
// 完成度分析
// ==========================================
async function loadAnalyticsCompletionStats(classId, courseId) {
    try {
        console.log('📊 [完成度] 開始加載', { classId, courseId });
        const params = new URLSearchParams({
            action: 'getClassTaskCompletionStats',
            classId: classId,
            courseId: courseId || ''
        });
        const url = `${APP_CONFIG.API_URL}?${params.toString()}`;
        console.log('📊 [完成度] 請求 URL:', url);
        
        const response = await fetch(url);
        const data = await response.json();
        
        console.log('📊 [完成度] 後端回應:', data);
        
        if (data.success && data.statistics) {
            console.log('📊 [完成度] 找到', data.statistics.length, '筆資料');
            displayAnalyticsCompletionChart(data.statistics);
            displayAnalyticsCompletionTable(data.statistics);
        } else {
            console.warn('⚠️ [完成度] 無資料');
            const ctx = document.getElementById('completionChart');
            if (ctx && ctx.parentElement) {
                ctx.parentElement.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">沒有資料</p>';
            }
            document.getElementById('completionTable').innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">沒有資料</p>';
        }
    } catch (error) {
        console.error('❌ [完成度] 加載失敗：', error);
    }
}

function displayAnalyticsCompletionChart(stats) {
    try {
        const ctx = document.getElementById('completionChart');
        if (!ctx) return;
        
        if (analyticsCharts.completion) {
            analyticsCharts.completion.destroy();
        }
        
        if (stats.length === 0) {
            ctx.parentElement.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">沒有資料</p>';
            return;
        }
        
        analyticsCharts.completion = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: stats.map(s => s.task_name || s.taskName),
                datasets: [{
                    label: '完成率 (%)',
                    data: stats.map(s => parseFloat(s.completion_rate)),
                    backgroundColor: 'rgba(66, 133, 244, 0.7)',
                    borderColor: 'rgba(66, 133, 244, 1)',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('❌ [完成度圖表] 建立失敗：', error);
    }
}

function displayAnalyticsCompletionTable(stats) {
    try {
        const container = document.getElementById('completionTable');
        if (!container) return;
        
        if (stats.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">沒有資料</p>';
            return;
        }
        
        let html = '<div style="overflow-x: auto;"><table style="width: 100%; border-collapse: collapse;">';
        html += '<thead style="background: #e3f2fd;"><tr>';
        html += '<th style="border: 1px solid #ddd; padding: 12px; text-align: left;">任務名稱</th>';
        html += '<th style="border: 1px solid #ddd; padding: 12px; text-align: center;">完成人數</th>';
        html += '<th style="border: 1px solid #ddd; padding: 12px; text-align: center;">總人數</th>';
        html += '<th style="border: 1px solid #ddd; padding: 12px; text-align: center;">完成率</th>';
        html += '</tr></thead><tbody>';
        
        stats.forEach((stat, idx) => {
            const taskName = stat.task_name || stat.taskName;
            const completionRate = parseFloat(stat.completion_rate);
            html += '<tr style="' + (idx % 2 === 0 ? 'background: #f5f5f5;' : '') + '">';
            html += `<td style="border: 1px solid #ddd; padding: 12px;">${taskName}</td>`;
            html += `<td style="border: 1px solid #ddd; padding: 12px; text-align: center;">${stat.completed_count}</td>`;
            html += `<td style="border: 1px solid #ddd; padding: 12px; text-align: center;">${stat.total_students}</td>`;
            html += `<td style="border: 1px solid #ddd; padding: 12px; text-align: center;"><strong>${completionRate}%</strong></td>`;
            html += '</tr>';
        });
        
        html += '</tbody></table></div>';
        container.innerHTML = html;
    } catch (error) {
        console.error('❌ [完成度表格] 建立失敗：', error);
    }
}

// ==========================================
// 分數分析
// ==========================================
async function loadAnalyticsScoreStats(classId, courseId) {
    try {
        console.log('📊 [分數] 開始加載', { classId, courseId });
        const params = new URLSearchParams({
            action: 'getClassAssignmentScoreStats',
            classId: classId,
            courseId: courseId || ''
        });
        const url = `${APP_CONFIG.API_URL}?${params.toString()}`;
        console.log('📊 [分數] 請求 URL:', url);
        
        const response = await fetch(url);
        const data = await response.json();
        
        console.log('📊 [分數] 後端回應:', data);
        
        if (data.success && data.statistics) {
            console.log('📊 [分數] 找到', data.statistics.length, '筆資料');
            displayAnalyticsScoreChart(data.statistics);
            displayAnalyticsScoreTable(data.statistics);
        } else {
            console.warn('⚠️ [分數] 無資料');
            const ctx = document.getElementById('scoreChart');
            if (ctx && ctx.parentElement) {
                ctx.parentElement.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">沒有資料</p>';
            }
            document.getElementById('scoreTable').innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">沒有資料</p>';
        }
    } catch (error) {
        console.error('❌ [分數] 加載失敗：', error);
    }
}

function displayAnalyticsScoreChart(stats) {
    try {
        const ctx = document.getElementById('scoreChart');
        if (!ctx) return;
        
        if (analyticsCharts.score) {
            analyticsCharts.score.destroy();
        }
        
        if (stats.length === 0) {
            ctx.parentElement.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">沒有資料</p>';
            return;
        }
        
        analyticsCharts.score = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: stats.map(s => s.task_name || s.taskName),
                datasets: [{
                    label: '平均分數',
                    data: stats.map(s => parseFloat(s.average_score)),
                    backgroundColor: 'rgba(255, 99, 132, 0.7)',
                    borderColor: 'rgba(255, 99, 132, 1)',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        });
    } catch (error) {
        console.error('❌ [分數圖表] 建立失敗：', error);
    }
}

function displayAnalyticsScoreTable(stats) {
    try {
        const container = document.getElementById('scoreTable');
        if (!container) return;
        
        if (stats.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">沒有資料</p>';
            return;
        }
        
        let html = '<div style="overflow-x: auto;"><table style="width: 100%; border-collapse: collapse;">';
        html += '<thead style="background: #ffe3e3;"><tr>';
        html += '<th style="border: 1px solid #ddd; padding: 12px; text-align: left;">任務名稱</th>';
        html += '<th style="border: 1px solid #ddd; padding: 12px; text-align: center;">已批改數</th>';
        html += '<th style="border: 1px solid #ddd; padding: 12px; text-align: center;">總提交數</th>';
        html += '<th style="border: 1px solid #ddd; padding: 12px; text-align: center;">平均分數</th>';
        html += '</tr></thead><tbody>';
        
        stats.forEach((stat, idx) => {
            const taskName = stat.task_name || stat.taskName;
            const avgScore = parseFloat(stat.average_score);
            html += '<tr style="' + (idx % 2 === 0 ? 'background: #f5f5f5;' : '') + '">';
            html += `<td style="border: 1px solid #ddd; padding: 12px;">${taskName}</td>`;
            html += `<td style="border: 1px solid #ddd; padding: 12px; text-align: center;">${stat.scored_count}</td>`;
            html += `<td style="border: 1px solid #ddd; padding: 12px; text-align: center;">${stat.total_submissions}</td>`;
            html += `<td style="border: 1px solid #ddd; padding: 12px; text-align: center;"><strong>${avgScore.toFixed(1)} 分</strong></td>`;
            html += '</tr>';
        });
        
        html += '</tbody></table></div>';
        container.innerHTML = html;
    } catch (error) {
        console.error('❌ [分數表格] 建立失敗：', error);
    }
}

// ==========================================
// 時間分析
// ==========================================
async function loadAnalyticsTimeStats(classId, courseId) {
    try {
        console.log('📊 [時間] 開始加載', { classId, courseId });
        const params = new URLSearchParams({
            action: 'getClassTaskTimeStats',
            classId: classId,
            courseId: courseId || ''
        });
        const url = `${APP_CONFIG.API_URL}?${params.toString()}`;
        console.log('📊 [時間] 請求 URL:', url);
        
        const response = await fetch(url);
        const data = await response.json();
        
        console.log('📊 [時間] 後端回應:', data);
        
        if (data.success && data.statistics) {
            console.log('📊 [時間] 找到', data.statistics.length, '筆資料');
            displayAnalyticsTimeChart(data.statistics);
            displayAnalyticsTimeTable(data.statistics);
        } else {
            console.warn('⚠️ [時間] 無資料');
            const ctx = document.getElementById('timeChart');
            if (ctx && ctx.parentElement) {
                ctx.parentElement.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">沒有資料</p>';
            }
            document.getElementById('timeTable').innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">沒有資料</p>';
        }
    } catch (error) {
        console.error('❌ [時間] 加載失敗：', error);
    }
}

function displayAnalyticsTimeChart(stats) {
    try {
        const ctx = document.getElementById('timeChart');
        if (!ctx) return;
        
        if (analyticsCharts.time) {
            analyticsCharts.time.destroy();
        }
        
        if (stats.length === 0) {
            ctx.parentElement.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">沒有資料</p>';
            return;
        }
        
        analyticsCharts.time = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: stats.map(s => s.task_name || s.taskName),
                datasets: [{
                    label: '平均完成時間（分鐘）',
                    data: stats.map(s => s.average_time / 60),
                    backgroundColor: 'rgba(251, 188, 5, 0.7)',
                    borderColor: 'rgba(251, 188, 5, 1)',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    } catch (error) {
        console.error('❌ [時間圖表] 建立失敗：', error);
    }
}

function displayAnalyticsTimeTable(stats) {
    try {
        const container = document.getElementById('timeTable');
        if (!container) return;
        
        if (stats.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">沒有資料</p>';
            return;
        }
        
        let html = '<div style="overflow-x: auto;"><table style="width: 100%; border-collapse: collapse;">';
        html += '<thead style="background: #fff3e0;"><tr>';
        html += '<th style="border: 1px solid #ddd; padding: 12px; text-align: left;">任務名稱</th>';
        html += '<th style="border: 1px solid #ddd; padding: 12px; text-align: center;">完成人數</th>';
        html += '<th style="border: 1px solid #ddd; padding: 12px; text-align: center;">平均時間</th>';
        html += '<th style="border: 1px solid #ddd; padding: 12px; text-align: center;">標準差</th>';
        html += '</tr></thead><tbody>';
        
        stats.forEach((stat, idx) => {
            const taskName = stat.task_name || stat.taskName;
            const avgTime = (stat.average_time / 60).toFixed(1);
            const stdDev = stat.std_deviation ? (stat.std_deviation / 60).toFixed(1) : (stat.std_dev ? (stat.std_dev / 60).toFixed(1) : '-');
            const completionCount = stat.completion_count || stat.completed_count || 0;
            html += '<tr style="' + (idx % 2 === 0 ? 'background: #f5f5f5;' : '') + '">';
            html += `<td style="border: 1px solid #ddd; padding: 12px;">${taskName}</td>`;
            html += `<td style="border: 1px solid #ddd; padding: 12px; text-align: center;">${completionCount}</td>`;
            html += `<td style="border: 1px solid #ddd; padding: 12px; text-align: center;"><strong>${avgTime} 分鐘</strong></td>`;
            html += `<td style="border: 1px solid #ddd; padding: 12px; text-align: center;">${stdDev}</td>`;
            html += '</tr>';
        });
        
        html += '</tbody></table></div>';
        container.innerHTML = html;
    } catch (error) {
        console.error('❌ [時間表格] 建立失敗：', error);
    }
}

// ==========================================
// 異常分析
// ==========================================
async function loadAnalyticsAnomalies(classId, taskId) {
    try {
        console.log('📊 [異常] 開始加載', { classId, taskId });
        const params = new URLSearchParams({
            action: 'getStudentPerformanceAnomalies',
            classId: classId,
            taskId: taskId
        });
        const url = `${APP_CONFIG.API_URL}?${params.toString()}`;
        console.log('📊 [異常] 請求 URL:', url);
        
        const response = await fetch(url);
        const data = await response.json();
        
        console.log('📊 [異常] 後端回應:', data);
        
        if (data.success) {
            console.log('📊 [異常] 評量異常', data.assessment_anomalies.length, '筆，分數異常', data.score_anomalies.length, '筆');
            displayAnalyticsAssessmentAnomalies(data.assessment_anomalies);
            displayAnalyticsScoreAnomalies(data.score_anomalies);
        } else {
            console.warn('⚠️ [異常] 加載失敗');
        }
    } catch (error) {
        console.error('❌ [異常] 加載失敗：', error);
    }
}

function displayAnalyticsAssessmentAnomalies(anomalies) {
    const container = document.getElementById('assessmentAnomalies');
    if (!container) return;
    
    if (!anomalies || anomalies.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">✅ 無異常資料</p>';
        return;
    }
    
    let html = '';
    anomalies.slice(0, 10).forEach(a => {
        const isCritical = a.anomaly_type === '零分';
        const color = isCritical ? '#d32f2f' : '#f57c00';
        const bgColor = isCritical ? '#ffebee' : '#fff3e0';
        html += `<div style="background: ${bgColor}; border-left: 4px solid ${color}; padding: 12px; margin-bottom: 8px; border-radius: 4px;">`;
        html += `<strong style="color: ${color};">${a.user_id}_${a.user_name}</strong> - `;
        html += `答對率: <strong>${a.accuracy_rate}%</strong> `;
        html += `(${a.correct_count}/${a.total_questions}) `;
        html += `<span style="background: ${color}; color: white; padding: 2px 8px; border-radius: 3px; font-size: 12px;">${a.anomaly_type}</span>`;
        html += `</div>`;
    });
    
    container.innerHTML = html;
}

function displayAnalyticsScoreAnomalies(anomalies) {
    const container = document.getElementById('scoreAnomalies');
    if (!container) return;
    
    if (!anomalies || anomalies.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">✅ 無異常資料</p>';
        return;
    }
    
    let html = '';
    anomalies.slice(0, 10).forEach(a => {
        const isCritical = a.anomaly_type === '零分';
        const color = isCritical ? '#d32f2f' : '#f57c00';
        const bgColor = isCritical ? '#ffebee' : '#fff3e0';
        html += `<div style="background: ${bgColor}; border-left: 4px solid ${color}; padding: 12px; margin-bottom: 8px; border-radius: 4px;">`;
        html += `<strong style="color: ${color};">${a.user_id}_${a.user_name}</strong> - `;
        html += `分數: <strong>${a.score}</strong> `;
        html += `<span style="background: ${color}; color: white; padding: 2px 8px; border-radius: 3px; font-size: 12px;">${a.anomaly_type}</span>`;
        html += `</div>`;
    });
    
    container.innerHTML = html;
}

// ==========================================
// 評量答對率分析
// ==========================================
async function loadAnalyticsAssessmentStats(classId, taskId) {
    try {
        const params = new URLSearchParams({
            action: 'getClassAssessmentAccuracyStats',
            classId: classId,
            taskId: taskId
        });
        const url = `${APP_CONFIG.API_URL}?${params.toString()}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.success && data.statistics) {
            displayAnalyticsAssessmentChart(data.statistics);
            displayAnalyticsAssessmentTable(data.statistics);
        }
    } catch (error) {
        console.error('載入評量統計失敗：', error);
    }
}

function displayAnalyticsAssessmentChart(stats) {
    const ctx = document.getElementById('assessmentChart');
    if (!ctx) return;
    
    if (analyticsCharts.assessment) {
        analyticsCharts.assessment.destroy();
    }
    
    if (stats.length === 0) {
        ctx.parentElement.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">沒有資料</p>';
        return;
    }
    
    try {
        const labels = stats.map((s, idx) => `題目 ${idx + 1}`);
        const data = stats.map(s => parseFloat(s.accuracy_rate));
        
        analyticsCharts.assessment = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: '答對率 (%)',
                    data: data,
                    backgroundColor: 'rgba(52, 168, 83, 0.2)',
                    borderColor: 'rgba(52, 168, 83, 1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        });
    } catch (error) {
        console.error('建立圖表失敗：', error);
    }
}

function displayAnalyticsAssessmentTable(stats) {
    const container = document.getElementById('assessmentTable');
    
    let html = '<div style="overflow-x: auto;"><table style="width: 100%; border-collapse: collapse;">';
    html += '<thead style="background: #e8f5e9;"><tr>';
    html += '<th style="border: 1px solid #ddd; padding: 12px; text-align: left;">題目</th>';
    html += '<th style="border: 1px solid #ddd; padding: 12px; text-align: center;">答對人數</th>';
    html += '<th style="border: 1px solid #ddd; padding: 12px; text-align: center;">總人數</th>';
    html += '<th style="border: 1px solid #ddd; padding: 12px; text-align: center;">答對率</th>';
    html += '</tr></thead><tbody>';
    
    stats.forEach((stat, idx) => {
        html += '<tr>';
        html += `<td style="border: 1px solid #ddd; padding: 12px;"><a href="#" style="cursor: pointer; color: #2C5F7C;" onclick="event.preventDefault(); showAnalyticsQuestionDetail(${idx});">題目 ${idx + 1}</a></td>`;
        html += `<td style="border: 1px solid #ddd; padding: 12px; text-align: center;">${stat.correct_count}</td>`;
        html += `<td style="border: 1px solid #ddd; padding: 12px; text-align: center;">${stat.total_students}</td>`;
        html += `<td style="border: 1px solid #ddd; padding: 12px; text-align: center;"><span style="background: ${stat.accuracy_rate >= 80 ? '#4CAF50' : stat.accuracy_rate >= 60 ? '#2196F3' : stat.accuracy_rate >= 40 ? '#FF9800' : '#F44336'}; color: white; padding: 4px 8px; border-radius: 4px;">${stat.accuracy_rate}%</span></td>`;
        html += '</tr>';
    });
    
    html += '</tbody></table></div>';
    container.innerHTML = html;
    
    window._analyticsStats = stats;
}

function showAnalyticsQuestionDetail(idx) {
    const stat = window._analyticsStats[idx];
    if (!stat) return;
    
    console.log('📊 [Question Detail] 顯示題目詳情', { idx, stat });
    
    document.getElementById('modalQuestionText').textContent = stat.question_text;

    // 鎖定背景滾動
    document.body.style.overflow = 'hidden';

    const optionsContainer = document.getElementById('modalOptions');
    if (stat.options && Array.isArray(stat.options)) {
        let optionsHtml = '';
        // 從 options_map 找到正確答案的實際文本
        const correctAnswerCode = stat.correct_answer || '';
        const correctAnswerText = stat.options_map ? stat.options_map[correctAnswerCode] : '';
        
        stat.options.forEach((option, i) => {
            // 比較選項文本是否等於正確答案文本
            const currentOption = String(option || '').trim();
            const correctText = String(correctAnswerText || '').trim();
            const isCorrect = currentOption === correctText;
            
            console.log(`📊 [Question Detail] 選項 ${i}:`, { 
                option: currentOption,
                correctAnswerCode: correctAnswerCode,
                correctAnswerText: correctText,
                isCorrect: isCorrect 
            });
            
            const selectCount = stat.option_counts ? (stat.option_counts[option] || 0) : 0;
            const studentsList = stat.option_students && stat.option_students[option] ? stat.option_students[option] : [];
            
            const studentListHtml = studentsList.length > 0 
                ? `<div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #e0e0e0;">
                    ${studentsList.map(s => `<span style="display: inline-block; background: #f5f5f5; color: #666; padding: 4px 8px; border-radius: 4px; margin-right: 8px; margin-bottom: 4px; font-size: 12px;">${s}</span>`).join('')}
                   </div>`
                : '';
            
            optionsHtml += `<div style="margin-bottom: 12px; padding: 12px; border-radius: 6px; background: ${isCorrect ? '#e8f5e9' : '#f8f9fa'}; border-left: 4px solid ${isCorrect ? '#4CAF50' : '#ccc'};">
                <div style="margin-bottom: 8px;">
                    <span style="background: ${isCorrect ? '#4CAF50' : '#999'}; color: white; padding: 2px 6px; border-radius: 3px; font-size: 12px; font-weight: 600;">選項 ${String.fromCharCode(65 + i)}</span>
                    <span style="margin-left: 8px; font-weight: ${isCorrect ? '600' : '400'}; color: ${isCorrect ? '#1b5e20' : '#000'};">${currentOption}</span>
                    ${isCorrect ? '<span style="margin-left: 8px; color: #4CAF50; font-weight: 600;">✓ 正確答案</span>' : ''}
                </div>
                <div style="color: #666; font-size: 12px;"><strong>${selectCount}</strong> 人選擇</div>
                ${studentListHtml}
            </div>`;
        });
        optionsContainer.innerHTML = optionsHtml;
        console.log('📊 [Question Detail] 選項 HTML 已更新');
    } else {
        optionsContainer.innerHTML = '<p style="color: #999;">無選項資訊</p>';
    }
    
    document.getElementById('questionModal').style.display = 'block';
}

function switchAnalyticsTab(tabName) {
    // 檢查是否需要選擇任務
    const requiresTask = ['assessment', 'score', 'anomaly'];
    const taskSelect = document.getElementById('analyticsTaskFilter');
    const selectedTask = taskSelect ? taskSelect.value : '';

    if (requiresTask.includes(tabName) && !selectedTask) {
        showToast('⚠️ 請先選擇任務', 'warning');
        return;
    }

    document.querySelectorAll('.analytics-tab-item').forEach(item => {
        item.style.borderBottomColor = 'transparent';
        item.style.color = '#495057';
    });
    event.target.style.borderBottomColor = '#2C5F7C';
    event.target.style.color = '#2C5F7C';

    document.querySelectorAll('.analytics-tab-content').forEach(content => {
        content.style.display = 'none';
    });

    document.getElementById(`analytics${tabName.charAt(0).toUpperCase() + tabName.slice(1)}Tab`).style.display = 'block';
}

function applyAnalyticsAnomalyFilter(filter) {
    document.querySelectorAll('.analytics-filter-tag').forEach(tag => {
        tag.style.background = '#f0f0f0';
        tag.style.color = '#666';
    });
    event.target.style.background = '#2C5F7C';
    event.target.style.color = 'white';
    
    document.getElementById('assessmentAnomalies').style.display = filter === 'assessment' ? 'block' : 'none';
    document.getElementById('scoreAnomalies').style.display = filter === 'score' ? 'block' : 'none';
    document.getElementById('timeAnomalies').style.display = filter === 'time' ? 'block' : 'none';
}

/* ==========================================
   作業批改相關函數
   ========================================== */

let allGradingSubmissions = [];
let currentGradingSubmission = null;
let isGradingLoading = false;

async function loadGradingClassList() {
    try {
        const teacherEmail = getUserEmail();
        const params = new URLSearchParams({
            action: 'getTeacherClasses',
            teacherEmail: teacherEmail
        });
        const url = `${APP_CONFIG.API_URL}?${params.toString()}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.success && data.classes) {
            const select = document.getElementById('gradingClassFilter');
            select.innerHTML = '<option value="">所有班級</option>';
            data.classes.forEach(cls => {
                const option = document.createElement('option');
                option.value = cls.class_id;
                option.textContent = cls.class_name;
                select.appendChild(option);
            });
        }
        
        await loadGradingAllTasks();
    } catch (error) {
        console.error('載入班級列表失敗：', error);
    }
}

async function loadGradingAllTasks() {
    try {
        const teacherEmail = getUserEmail();
        const params = new URLSearchParams({
            action: 'getTeacherTasksWithSubmissions',
            teacherEmail: teacherEmail
        });
        const url = `${APP_CONFIG.API_URL}?${params.toString()}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.success && data.tasks) {
            const taskSelect = document.getElementById('gradingTaskFilter');
            taskSelect.innerHTML = '<option value="">所有任務</option>';
            data.tasks.forEach(task => {
                const option = document.createElement('option');
                option.value = task.task_id;
                option.textContent = `${task.task_name}`;
                taskSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('載入任務列表失敗：', error);
    }
}

async function loadGradingSubmissions() {
    if (isGradingLoading) return;
    
    isGradingLoading = true;
    document.getElementById('gradingLoadingDiv').style.display = 'flex';
    
    try {
        const teacherEmail = getUserEmail();
        const classId = document.getElementById('gradingClassFilter').value;
        const taskId = document.getElementById('gradingTaskFilter').value;
        const status = document.getElementById('gradingStatusFilter').value;
        
        const params = new URLSearchParams({
            action: 'getTeacherPendingReviews',
            teacherEmail: teacherEmail,
            classId: classId || '',
            taskId: taskId || '',
            status: status || ''
        });
        
        const url = `${APP_CONFIG.API_URL}?${params.toString()}`;
        const response = await fetch(url);
        const data = await response.json();
        
        document.getElementById('gradingLoadingDiv').style.display = 'none';
        
        if (data.success && data.reviews) {
            allGradingSubmissions = data.reviews;
            displayGradingSubmissions(data.reviews);
        }
    } catch (error) {
        console.error('載入作業失敗：', error);
        document.getElementById('gradingLoadingDiv').style.display = 'none';
    } finally {
        isGradingLoading = false;
    }
}

function displayGradingSubmissions(submissions) {
    const container = document.getElementById('gradingSubmissionList');
    container.innerHTML = '';
    
    if (submissions.length === 0) {
        document.getElementById('gradingEmptyState').style.display = 'block';
        document.getElementById('gradingStatsBar').style.display = 'none';
        return;
    }
    
    document.getElementById('gradingEmptyState').style.display = 'none';
    
    const pendingCount = submissions.filter(s => s.review_status === '未批改').length;
    const reviewedCount = submissions.filter(s => s.review_status === '已批改').length;
    
    document.getElementById('gradingTotalCount').textContent = submissions.length;
    document.getElementById('gradingPendingCount').textContent = pendingCount;
    document.getElementById('gradingReviewedCount').textContent = reviewedCount;
    document.getElementById('gradingStatsBar').style.display = 'flex';
    
    submissions.forEach((submission, index) => {
        const card = document.createElement('div');
        const statusClass = submission.review_status === '未批改' ? 'pending' : 'reviewed';
        const statusBg = submission.review_status === '未批改' ? '#fff8f0' : '#f0fff4';
        const statusColor = submission.review_status === '未批改' ? '#fd7e14' : '#28a745';
        
        card.innerHTML = `
            <div style="border: 2px solid ${statusColor}; border-radius: 8px; padding: 16px; background: ${statusBg}; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.boxShadow='0 4px 12px rgba(0,0,0,0.15)'; this.style.transform='translateY(-2px)'" onmouseout="this.style.boxShadow='none'; this.style.transform='none'" onclick="openGradingReviewModal('${submission.submission_id}')">
                <div style="font-size: 18px; font-weight: 600; color: #212529; margin-bottom: 8px;">${submission.user_name}</div>
                <div style="font-size: 14px; color: #6c757d; margin-bottom: 4px;">${submission.class_name}</div>
                <div style="font-size: 14px; color: #6c757d;">${submission.task_name}</div>
            </div>
        `;
        container.appendChild(card);
    });
}

function openGradingReviewModal(submissionId) {
    const submission = allGradingSubmissions.find(s => s.submission_id === submissionId);
    if (!submission) return;

    currentGradingSubmission = submission;

    // 🔍 調試：顯示檔案資訊
    console.log('📋 批改作業 - 檔案資訊:', {
        file_name: submission.file_name,
        file_type: submission.file_type,
        file_url: submission.file_url
    });

    document.getElementById('modalStudentName').textContent = submission.user_name;
    document.getElementById('modalClassName').textContent = submission.class_name;
    document.getElementById('modalTaskName').textContent = submission.task_name;
    document.getElementById('modalUploadTime').textContent = new Date(submission.upload_time).toLocaleString('zh-TW');

    // 顯示檔案預覽 - 參考 review 的做法
    const preview = document.getElementById('filePreview');
    const directUrl = convertGoogleDriveUrl(submission.file_url);

    // 判斷檔案類型（更寬鬆的判斷）
    const fileName = (submission.file_name || '').toLowerCase();
    const fileType = (submission.file_type || '').toLowerCase();
    const isImage = fileType.includes('image') ||
                    fileName.endsWith('.jpg') ||
                    fileName.endsWith('.jpeg') ||
                    fileName.endsWith('.png') ||
                    fileName.endsWith('.gif') ||
                    fileName.endsWith('.bmp') ||
                    fileName.endsWith('.webp');

    console.log('🔍 檔案類型判斷:', { fileName, fileType, isImage });

    if (isImage) {
        // 圖片預覽 - 使用多種方式嘗試顯示
        const fileId = extractGoogleDriveFileId(submission.file_url);
        const previewUrl = fileId ? `https://drive.google.com/thumbnail?id=${fileId}&sz=w800` : directUrl;

        preview.innerHTML = `
            <div style="text-align: center; background: #f8f9fa; padding: 15px; border-radius: 8px;">
                <p style="margin-bottom: 12px;"><strong>圖片預覽：</strong></p>
                <div id="imagePreviewContainer" style="margin: 15px 0;">
                    <img id="previewImage"
                         src="${previewUrl}"
                         style="max-width: 100%; max-height: 500px; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;"
                         alt="檔案預覽"
                         onclick="window.open('${submission.file_url}', '_blank')"
                         title="點擊放大查看"
                         onerror="tryAlternativeImagePreview(this, '${directUrl}', '${submission.file_url}')">
                </div>
                <div style="margin-top: 12px;">
                    <a href="${submission.file_url}" target="_blank" style="display: inline-block; padding: 8px 16px; background: #2C5F7C; color: white; text-decoration: none; border-radius: 4px;">
                        📁 在 Google Drive 中開啟
                    </a>
                </div>
            </div>
        `;
    } else if (fileType.includes('pdf') || fileName.endsWith('.pdf')) {
        // PDF 預覽
        const fileId = extractGoogleDriveFileId(submission.file_url);
        const pdfPreviewUrl = fileId ? `https://drive.google.com/file/d/${fileId}/preview` : directUrl;

        console.log('📄 PDF 預覽 URL:', pdfPreviewUrl);

        preview.innerHTML = `
            <div style="text-align: center; background: #f8f9fa; padding: 15px; border-radius: 8px;">
                <p style="margin-bottom: 12px;"><strong>PDF 預覽：</strong></p>
                <iframe src="${pdfPreviewUrl}"
                        style="width: 100%; height: 600px; border: 1px solid #ddd; border-radius: 4px;"
                        allow="autoplay">
                </iframe>
                <div style="margin-top: 12px;">
                    <a href="${submission.file_url}" target="_blank" style="display: inline-block; padding: 8px 16px; background: #2C5F7C; color: white; text-decoration: none; border-radius: 4px;">
                        📄 在新視窗開啟 PDF
                    </a>
                </div>
            </div>
        `;
    } else {
        // 其他檔案（無法預覽）
        console.log('⚠️ 其他檔案類型，無法預覽:', { fileName, fileType });

        preview.innerHTML = `
            <div style="text-align: center; background: #fff3cd; padding: 20px; border-radius: 8px; border: 1px solid #ffc107;">
                <div style="font-size: 48px; margin-bottom: 12px;">📎</div>
                <p style="margin-bottom: 8px; color: #856404;"><strong>此檔案類型無法直接預覽</strong></p>
                <p style="margin-bottom: 16px; font-size: 14px; color: #856404;">檔案名稱: ${submission.file_name}</p>
                <a href="${submission.file_url}" target="_blank" style="display: inline-block; padding: 12px 24px; background: #2C5F7C; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">
                    🔗 在 Google Drive 中開啟
                </a>
            </div>
        `;
    }
    
    document.getElementById('reviewScore').value = submission.review_score || '';
    document.getElementById('reviewComment').value = submission.review_comment || '';
    document.getElementById('submissionStatus').value = submission.submission_status || '已批改';
    
    document.getElementById('submitReviewBtn').dataset.submissionId = submissionId;

    // 鎖定背景滾動
    document.body.style.overflow = 'hidden';

    document.getElementById('reviewModal').style.display = 'block';
}

async function submitGradingReview() {
    const submissionId = document.getElementById('submitReviewBtn').dataset.submissionId;
    const score = document.getElementById('reviewScore').value;
    const comment = document.getElementById('reviewComment').value;
    const status = document.getElementById('submissionStatus').value;
    
    if (!score || score < 0 || score > 100) {
        alert('請輸入 0-100 的分數');
        return;
    }
    
    try {
        const teacherEmail = getUserEmail();
        const params = new URLSearchParams({
            action: 'submitTaskReview',
            submissionId: submissionId,
            teacherEmail: teacherEmail,
            reviewScore: score,
            reviewComment: comment,
            reviewStatus: '已批改',
            submissionStatus: status
        });
        
        const response = await fetch(`${APP_CONFIG.API_URL}?${params.toString()}`);
        const data = await response.json();
        
        if (data.success) {
            alert('✅ 批改已儲存！');
            closeModal('reviewModal');
            await loadGradingSubmissions();
        } else {
            alert('❌ 儲存失敗：' + data.message);
        }
    } catch (error) {
        console.error('提交失敗：', error);
        alert('❌ 提交失敗，請稍後再試');
    }
}

// ==========================================
// 工具函數 - Google Drive URL 轉換
// ==========================================

/**
 * 從 Google Drive URL 提取 File ID
 */
function extractGoogleDriveFileId(url) {
    if (!url) return null;

    // 匹配 /file/d/FILE_ID/ 格式
    const filePattern = /\/file\/d\/([a-zA-Z0-9_-]+)/;
    const fileMatch = url.match(filePattern);
    if (fileMatch) return fileMatch[1];

    // 匹配 ?id=FILE_ID 格式
    const idPattern = /[?&]id=([a-zA-Z0-9_-]+)/;
    const idMatch = url.match(idPattern);
    if (idMatch) return idMatch[1];

    return null;
}

/**
 * 嘗試替代的圖片預覽方式
 */
function tryAlternativeImagePreview(imgElement, fallbackUrl, originalUrl) {
    console.warn('主要圖片載入失敗，嘗試替代方案...', originalUrl);

    // 第一次失敗，嘗試使用 uc?export=view
    if (!imgElement.dataset.tried1) {
        imgElement.dataset.tried1 = 'true';
        imgElement.src = fallbackUrl;
        return;
    }

    // 第二次失敗，使用 iframe Google Viewer
    const fileId = extractGoogleDriveFileId(originalUrl);
    if (fileId && !imgElement.dataset.tried2) {
        const container = document.getElementById('imagePreviewContainer');
        if (container) {
            container.innerHTML = `
                <iframe src="https://drive.google.com/file/d/${fileId}/preview"
                        style="width: 100%; height: 500px; border: 1px solid #ddd; border-radius: 4px;"
                        allow="autoplay">
                </iframe>
            `;
        }
        return;
    }

    // 所有方式都失敗，顯示錯誤訊息
    showImageLoadError(imgElement, originalUrl);
}

function convertGoogleDriveUrl(url) {
    if (!url) return url;

    const driveViewPattern = /https:\/\/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)\/(view|open)/;
    const match = url.match(driveViewPattern);

    if (match) {
        const fileId = match[1];
        return `https://drive.google.com/uc?export=view&id=${fileId}`;
    }

    const openIdPattern = /https:\/\/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/;
    const openMatch = url.match(openIdPattern);

    if (openMatch) {
        const fileId = openMatch[1];
        return `https://drive.google.com/uc?export=view&id=${fileId}`;
    }

    if (url.includes('drive.google.com/uc?')) {
        return url;
    }

    return url;
}

// 圖片載入失敗時的錯誤處理函數
function showImageLoadError(imgElement, fileUrl) {
    const errorHtml = `
        <div style="color: #dc3545; padding: 15px; background: #f8d7da; border-radius: 4px; border: 1px solid #f5c6cb;">
            <strong>❌ 圖片載入失敗</strong>
            <p style="margin: 8px 0; font-size: 14px;">此圖片無法直接預覽，可能需要公開分享權限。</p>
            <a href="${fileUrl}" target="_blank" style="display: inline-block; padding: 8px 16px; background: #2C5F7C; color: white; text-decoration: none; border-radius: 4px; margin-top: 8px;">
                📁 在 Google Drive 中開啟
            </a>
        </div>
    `;
    imgElement.parentElement.innerHTML = errorHtml;
}

/**
 * 關閉 Modal 懸浮視窗
 * @param {string} modalId - Modal 的 ID
 */
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        // 處理使用 display 控制的 modal (questionModal, reviewModal)
        if (modal.style.display === 'block') {
            modal.style.display = 'none';
        }

        // 處理使用 active 類控制的 modal (其他 modal)
        if (modal.classList.contains('active')) {
            modal.classList.remove('active');
        }

        console.log('✅ 關閉 Modal:', modalId);

        // 延遲檢查並恢復滾動
        setTimeout(() => {
            // 檢查所有可能的 modal 類型
            const hasActiveClassModal = document.querySelector('.modal-overlay.active');
            const hasDisplayBlockModal = Array.from(document.querySelectorAll('[id$="Modal"]')).some(m => {
                return m.style.display === 'block';
            });

            if (!hasActiveClassModal && !hasDisplayBlockModal) {
                console.log('🔓 恢復頁面滾動');
                document.body.style.overflow = '';
            }
        }, 50);
    }
}

// 全域暴露 closeModal 函數
window.closeModal = closeModal;
