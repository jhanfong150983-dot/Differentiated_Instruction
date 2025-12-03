/* ==========================================
   分層教學管理系統 - 前端 JavaScript
   ==========================================
   這個檔案處理所有前端互動邏輯
*/

// ========== 全域變數 ==========
let currentClassId = null;  // 當前選中的班級 ID
let parsedStudents = [];    // 解析後的學生資料
let currentUser = null;     // 當前登入使用者
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
  
  // 監聽貼上區域的輸入事件
  const pasteArea = document.getElementById('pasteArea');
  if (pasteArea) {
    pasteArea.addEventListener('input', function() {
      // 當使用者貼上或輸入時，自動解析（可選）
    });
  }
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
        
        // 格式化日期（使用統一函數）
        const dateStr = formatDate(classData.createDate);
        
        card.innerHTML = `
            <div class="card-header">
                <div>
                    <div class="card-title">${escapeHtml(classData.className)}</div>
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
                    <span>${classData.classId.substring(0, 8)}...</span>
                </div>
            </div>
            <div class="card-actions">
                <button class="btn btn-primary" onclick="event.stopPropagation(); openImportSection('${classData.classId}', '${escapeHtml(classData.className)}')">
                    📥 匯入學生
                </button>
                <button class="btn btn-secondary" onclick="event.stopPropagation(); viewClassMembers('${classData.classId}', '${escapeHtml(classData.className)}')">
                    👀 查看名單
                </button>
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
                        option.value = classData.classId;
                        option.textContent = classData.className;
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
