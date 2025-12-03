/* ==========================================
   登入頁面 JavaScript 檔案
   ==========================================
   這個檔案處理：
   1. Google OAuth 登入
   2. 測試登入功能（開發用）
   3. 使用者資料處理
   4. 與 Google Sheets 後端的整合
*/

// ==========================================
// 等待網頁載入完成
// ==========================================
document.addEventListener('DOMContentLoaded', function() {
    
    console.log('✅ 登入頁面載入完成！');
    
    // 使用 APP_CONFIG（從 config.js 載入）
    console.log('📋 API 網址:', APP_CONFIG.API_URL);
    console.log('🔑 Client ID:', APP_CONFIG.GOOGLE_CLIENT_ID);
    
    // 等待 Google API 載入
    waitForGoogleAPI();
    
    // 初始化測試登入表單
    initializeTestLogin();
});

// ==========================================
// 等待 Google API 載入（帶重試機制）
// ==========================================
function waitForGoogleAPI(retryCount = 0) {
    const maxRetries = 10;  // 最多重試 10 次
    const retryDelay = 500; // 每次等待 500ms
    
    console.log(`🔍 檢查 Google API... (嘗試 ${retryCount + 1}/${maxRetries})`);
    
    if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
        // ✅ Google API 已載入
        console.log('✅ Google API 載入成功！');
        initializeGoogleLogin();
    } else if (retryCount < maxRetries) {
        // ⏳ 還沒載入，繼續等待
        console.log(`⏳ Google API 尚未載入，${retryDelay}ms 後重試...`);
        setTimeout(() => {
            waitForGoogleAPI(retryCount + 1);
        }, retryDelay);
    } else {
        // ❌ 超過重試次數
        console.error('❌ Google API 載入失敗（超過重試次數）');
        showMessage('Google 登入服務載入失敗，請重新整理頁面', 'error');
        
        // 顯示重新整理按鈕
        showReloadButton();
    }
}

// ==========================================
// 顯示重新整理按鈕
// ==========================================
function showReloadButton() {
    const buttonWrapper = document.getElementById('googleLoginButton');
    if (buttonWrapper) {
        buttonWrapper.innerHTML = `
            <button onclick="location.reload()" style="
                padding: 12px 24px;
                background: #667eea;
                color: white;
                border: none;
                border-radius: 8px;
                font-size: 16px;
                cursor: pointer;
                font-weight: 600;
                transition: all 0.3s;
            " onmouseover="this.style.background='#764ba2'" 
               onmouseout="this.style.background='#667eea'">
                🔄 重新載入頁面
            </button>
        `;
    }
}


// ==========================================
// Google 登入功能
// ==========================================

/**
 * 初始化 Google 登入按鈕
 * 使用 Google Identity Services (GIS) 新版 API
 */
function initializeGoogleLogin() {
    
    // 檢查是否已設定 Client ID
    if (APP_CONFIG.GOOGLE_CLIENT_ID === 'YOUR_CLIENT_ID_HERE.apps.googleusercontent.com') {
        console.warn('⚠️ 尚未設定 Google Client ID，請先到 Google Cloud Console 取得');
        showMessage('尚未設定 Google 登入，請先完成設定', 'warning');
        return;
    }
    
    try {
        console.log('🔧 初始化 Google 登入按鈕...');
        
        // 初始化 Google Identity Services
        google.accounts.id.initialize({
            // 你的 Google OAuth Client ID
            client_id: APP_CONFIG.GOOGLE_CLIENT_ID,
            
            // 登入成功後的回調函數
            callback: handleGoogleLoginSuccess,
            
            // 自動選擇帳號（如果只有一個 Google 帳號）
            auto_select: false,
            
            // 取消 One Tap 提示（避免干擾）
            cancel_on_tap_outside: true
        });
        
        // 渲染 Google 登入按鈕
        google.accounts.id.renderButton(
            // 按鈕要插入的容器
            document.getElementById('googleLoginButton'),
            
            // 按鈕的樣式設定
            {
                theme: 'outline',        // 按鈕主題：outline（外框）/ filled_blue（藍色填滿）
                size: 'large',           // 按鈕大小：small / medium / large
                text: 'signin_with',     // 按鈕文字：signin_with（使用 Google 登入）
                shape: 'rectangular',    // 按鈕形狀：rectangular（方形）/ pill（藥丸形）
                logo_alignment: 'left',  // Logo 位置：left / center
                width: 350               // 按鈕寬度（像素）
            }
        );
        
        console.log('✅ Google 登入按鈕已成功初始化並渲染');
        
    } catch (error) {
        console.error('❌ Google 登入初始化失敗：', error);
        showMessage('Google 登入初始化失敗：' + error.message, 'error');
        showReloadButton();
    }
}


/**
 * 處理 Google 登入成功
 * @param {Object} response - Google 回傳的認證資料
 */
function handleGoogleLoginSuccess(response) {
    
    console.log('🔐 Google 登入成功！');
    
    try {
        // 解析 JWT Token（Google 回傳的是 JWT 格式）
        const userData = parseJWT(response.credential);
        
        console.log('👤 使用者資料：', userData);
        
        // 從 JWT 中提取使用者資訊
        const userInfo = {
            google_id: userData.sub,           // Google 唯一 ID
            email: userData.email,             // Email
            name: userData.name,               // 姓名
            picture: userData.picture,         // 頭像網址
            email_verified: userData.email_verified  // Email 是否已驗證
        };
        
        // 顯示載入中訊息
        showMessage('正在處理登入資料...', 'info');
        
        // 將使用者資料儲存到後端（Google Sheets）
        saveUserToBackend(userInfo);
        
    } catch (error) {
        console.error('❌ 處理登入資料時發生錯誤：', error);
        showMessage('登入處理失敗，請重試', 'error');
    }
}


/**
 * 解析 JWT Token
 * JWT 格式：header.payload.signature
 * 我們只需要 payload 部分（使用者資料）
 * 
 * @param {string} token - JWT Token
 * @returns {Object} - 解析後的使用者資料
 */
function parseJWT(token) {
    try {
        // JWT 由三個部分組成，用 . 分隔
        const parts = token.split('.');
        
        if (parts.length !== 3) {
            throw new Error('Invalid JWT format');
        }
        
        // 取得 payload（第二部分）
        let payload = parts[1];
        
        // 處理 Base64URL 編碼（需要替換特殊字元）
        // Base64URL 使用 - 和 _ 而不是 + 和 /
        payload = payload.replace(/-/g, '+').replace(/_/g, '/');
        
        // 補齊 padding（Base64 需要長度是 4 的倍數）
        while (payload.length % 4) {
            payload += '=';
        }
        
        // Base64 解碼（支援 UTF-8 中文）
        const decodedPayload = decodeURIComponent(
            atob(payload)
                .split('')
                .map(function(c) {
                    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                })
                .join('')
        );
        
        // 轉換成 JSON 物件
        const userData = JSON.parse(decodedPayload);
        
        console.log('✅ JWT 解析成功:', userData);
        
        return userData;
        
    } catch (error) {
        console.error('❌ JWT 解析失敗：', error);
        console.error('Token:', token);
        throw new Error('無法解析登入資料');
    }
}


// ==========================================
// 後端資料處理
// ==========================================

/**
 * 將使用者資料儲存到 Google Sheets（使用 JSONP 避免 CORS）
 * @param {Object} userInfo - 使用者資訊
 */
async function saveUserToBackend(userInfo) {
    
    // 檢查是否已設定後端 API
    if (APP_CONFIG.API_URL === 'https://script.google.com/macros/s/AKfycbwDj5XLneAz6fRYAae_KyAtsyHjFRsONgJFXewymJiksCEwBk0HVQaARzo7pgB0etGhFQ/exec') {
        console.warn('⚠️ 尚未設定後端 API 網址');
        
        // 測試模式下，直接模擬登入成功
        if (CONFIG.TEST_MODE) {
            console.log('🧪 測試模式：模擬登入成功');
            handleLoginSuccess(userInfo);
            return;
        }
        
        showMessage('後端 API 尚未設定', 'error');
        return;
    }
    
    try {
        console.log('📤 正在送出使用者資料到後端...');
        
        // 使用 JSONP 方式呼叫 API（避免 CORS 問題）
        const response = await makeJSONPRequest({
            action: 'login',
            email: userInfo.email,
            name: userInfo.name,
            google_id: userInfo.google_id,
            picture: userInfo.picture,
            timestamp: new Date().toISOString()
        });
        
        console.log('✅ 後端回應：', response);
        
        // 檢查後端處理結果
        if (response.success) {
            // 登入成功，現在檢查並自動綁定學生身份
            checkAndBindStudent(response.user_id, userInfo.email, response.role, {
                ...userInfo,
                user_id: response.user_id,
                role: response.role,
                current_tier: response.current_tier,
                jwt: response.jwt
            });
        } else {
            // 登入失敗
            throw new Error(response.message || '登入失敗');
        }
        
    } catch (error) {
        console.error('❌ 連接後端失敗：', error);
        showMessage('無法連接伺服器，請稍後再試', 'error');
    }
}


/**
 * JSONP 請求函數（避免 CORS 問題）
 * @param {Object} data - 要送出的資料
 * @returns {Promise} - 回應的 Promise
 */
function makeJSONPRequest(data) {
    return new Promise((resolve, reject) => {
        // 產生唯一的回調函數名稱
        const callbackName = 'jsonp_callback_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
        
        // 建立全域回調函數
        window[callbackName] = function(response) {
            console.log('📥 JSONP 回應:', response);
            
            // 清理
            delete window[callbackName];
            if (script && script.parentNode) {
                script.parentNode.removeChild(script);
            }
            
            resolve(response);
        };
        
        // 準備 URL 參數
        const params = new URLSearchParams({
            callback: callbackName,
            ...data
        });
        
        // 建立 script 標籤
        const script = document.createElement('script');
        script.src = `${APP_CONFIG.API_URL}?${params.toString()}`;
        
        // 錯誤處理
        script.onerror = (error) => {
            console.error('❌ JSONP 載入失敗:', error);
            delete window[callbackName];
            if (script && script.parentNode) {
                script.parentNode.removeChild(script);
            }
            reject(new Error('請求失敗'));
        };
        
        // 加入到頁面
        document.body.appendChild(script);
        
        // 超時處理（15 秒）
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
 * 檢查並自動綁定學生身份
 * @param {string} user_id - 使用者 ID
 * @param {string} email - 使用者 Email
 * @param {string} currentRole - 目前角色（通常是 'student'）
 * @param {Object} userData - 完整使用者資料
 */
async function checkAndBindStudent(user_id, email, currentRole, userData) {
    try {
        console.log('🔍 正在檢查使用者角色和權限...', { user_id, email, currentRole });
        
        // 如果是老師角色，直接進入教師頁面
        if (currentRole === 'teacher' || currentRole === 'admin') {
            console.log('✅ 老師登入成功！', { role: currentRole });
            
            showMessage(`歡迎，${userData.name}！`, 'success');
            
            // 延遲 1 秒後進入教師頁面
            setTimeout(() => {
                handleLoginSuccess(userData);
            }, 1000);
            
        } else if (currentRole === 'student') {
            // 如果是學生，檢查是否被綁定到班級
            console.log('🔍 正在檢查學生綁定狀態...');
            
            const response = await makeJSONPRequest({
                action: 'checkAndBindStudent',
                user_id: user_id,
                email: email
            });
            
            console.log('📋 綁定檢查結果：', response);
            
            if (response.success) {
                // ✅ 學生被找到並綁定到班級
                console.log('✅ 學生綁定成功！', response);
                
                // 保存綁定資訊
                userData.bound_classes = response.class_ids || [];
                userData.permission = 'student';
                
                showMessage(`歡迎，${userData.name}！已綁定 ${response.found_classes} 個班級`, 'success');
                
                // 記錄綁定信息
                localStorage.setItem('bind_info', JSON.stringify({
                    bound_classes: response.class_ids,
                    bind_time: new Date().toISOString()
                }));
                
                // 延遲 2 秒後進入學生頁面
                setTimeout(() => {
                    userData.role = 'student';
                    handleLoginSuccess(userData);
                }, 2000);
                
            } else if (response.permission === 'none') {
                // ❌ 學生沒有被任何班級錄取
                console.warn('⚠️ 學生未被任何班級錄取', response);
                
                showPermissionDeniedMessage(userData.name, email);
                
            } else {
                // ⚠️ 綁定過程出錯，但仍允許登入
                console.warn('⚠️ 綁定檢查失敗，但進行基本登入', response);
                
                handleLoginSuccess(userData);
            }
            
        } else {
            // 未知角色，拒絕登入
            console.warn('⚠️ 未知的使用者角色：', currentRole);
            
            showMessage(`無法識別您的身份（角色：${currentRole}），請聯絡管理員`, 'error');
        }
        
    } catch (error) {
        console.error('❌ 綁定檢查失敗：', error);
        
        // 如果是老師，綁定檢查失敗仍允許登入
        if (currentRole === 'teacher' || currentRole === 'admin') {
            console.warn('⚠️ 無法進行綁定檢查，但老師仍可登入');
            handleLoginSuccess(userData);
        } else {
            // 學生綁定檢查失敗，仍允許登入（但顯示警告）
            console.warn('⚠️ 無法進行綁定檢查，進行基本登入');
            handleLoginSuccess(userData);
        }
    }
}


/**
 * 顯示權限被拒絕的訊息
 * @param {string} userName - 使用者名稱
 * @param {string} email - 使用者 Email
 */
function showPermissionDeniedMessage(userName, email) {
    // 隱藏主要內容
    const loginContainer = document.querySelector('.login-container');
    if (loginContainer) {
        loginContainer.style.display = 'none';
    }
    
    // 建立權限被拒絕的提示頁面
    const deniedHTML = `
        <div class="permission-denied-container">
            <div class="denied-card">
                <div class="denied-icon">🔒</div>
                <h1>未被錄取</h1>
                <p class="denied-email">登入帳號：<strong>${escapeHtml(email)}</strong></p>
                <div class="denied-message">
                    <p>您好，${escapeHtml(userName)}！</p>
                    <p>您的帳號尚未被任何班級錄取。</p>
                    <p>請聯絡您的教師以進行班級登記。</p>
                </div>
                <div class="denied-info-box">
                    <h3>如何進行班級登記？</h3>
                    <ol>
                        <li>告知教師您的 Email：<code>${escapeHtml(email)}</code></li>
                        <li>教師將在班級管理系統中新增您的資訊</li>
                        <li>重新登入時系統將自動綁定您的身份</li>
                    </ol>
                </div>
                <button class="denied-btn" onclick="goBackToLogin()">返回登入</button>
            </div>
        </div>
    `;
    
    // 插入到頁面
    const body = document.body;
    const container = document.createElement('div');
    container.innerHTML = deniedHTML;
    body.appendChild(container);
    
    // 添加 CSS 樣式
    addPermissionDeniedStyles();
}


/**
 * 返回登入頁面
 */
function goBackToLogin() {
    location.reload();
}


/**
 * 添加權限被拒絕頁面的 CSS 樣式
 */
function addPermissionDeniedStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .permission-denied-container {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 9999;
        }
        
        .denied-card {
            background: white;
            border-radius: 16px;
            padding: 48px 40px;
            max-width: 500px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            text-align: center;
        }
        
        .denied-icon {
            font-size: 64px;
            margin-bottom: 24px;
        }
        
        .denied-card h1 {
            font-size: 28px;
            color: #2c3e50;
            margin-bottom: 16px;
            font-weight: 700;
        }
        
        .denied-email {
            color: #7f8c8d;
            margin-bottom: 24px;
            font-size: 14px;
        }
        
        .denied-message {
            background: #f8f9fa;
            border-left: 4px solid #e74c3c;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 24px;
            text-align: left;
            color: #2c3e50;
        }
        
        .denied-message p {
            margin: 8px 0;
            line-height: 1.6;
        }
        
        .denied-info-box {
            background: #f0f7ff;
            border: 1px solid #3498db;
            border-radius: 8px;
            padding: 24px;
            margin-bottom: 24px;
            text-align: left;
        }
        
        .denied-info-box h3 {
            color: #2980b9;
            margin-bottom: 16px;
            font-size: 16px;
        }
        
        .denied-info-box ol {
            margin: 0;
            padding-left: 24px;
        }
        
        .denied-info-box li {
            margin: 12px 0;
            color: #2c3e50;
            line-height: 1.6;
        }
        
        .denied-info-box code {
            background: white;
            border: 1px solid #bdc3c7;
            padding: 4px 8px;
            border-radius: 4px;
            font-family: monospace;
            font-size: 13px;
            color: #c0392b;
        }
        
        .denied-btn {
            background: #3498db;
            color: white;
            border: none;
            padding: 12px 32px;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            width: 100%;
        }
        
        .denied-btn:hover {
            background: #2980b9;
            transform: translateY(-2px);
            box-shadow: 0 8px 16px rgba(52, 152, 219, 0.3);
        }
        
        .denied-btn:active {
            transform: translateY(0);
        }
    `;
    document.head.appendChild(style);
}


/**
 * 簡單的 HTML 轉義函數
 */
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}


/**
 * 處理登入成功後的動作
 * @param {Object} userData - 完整的使用者資料
 */
function handleLoginSuccess(userData) {
    
    console.log('🎉 登入成功！使用者資料：', userData);
    
    // ✅ 關鍵修正：儲存所有必要的資料到 localStorage
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('role', userData.role);  // ← 加這行：單獨儲存 role
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('loginTime', new Date().toISOString());
    
    // 如果後端有回傳 JWT，也要儲存
    if (userData.jwt) {
        localStorage.setItem('jwt', userData.jwt);
    }
    
    console.log('✅ localStorage 已儲存：');
    console.log('  - user:', userData);
    console.log('  - role:', userData.role);
    console.log('  - jwt:', userData.jwt ? '已儲存' : '未提供');
    
    // 顯示成功訊息
    showMessage(`歡迎，${userData.name}！正在跳轉...`, 'success');
    
    // 2 秒後跳轉到首頁或學習頁面
    setTimeout(() => {
        // 根據使用者角色跳轉到不同頁面
        if (userData.role === 'admin') {
            window.location.href = 'admin.html';       // 管理員頁面
        } else if (userData.role === 'teacher') {
            window.location.href = 'teacher.html';     // 教師頁面
        } else if (userData.role === 'student') {
            window.location.href = 'student.html';     // 學生頁面
        } else {
            window.location.href = 'index.html';       // 預設首頁
        }
    }, 2000);
}


/**
 * 顯示訊息提示
 * @param {string} message - 要顯示的訊息
 * @param {string} type - 訊息類型：success / error / warning / info
 */
function showMessage(message, type = 'info') {
    
    // 檢查是否已經有訊息框
    let messageBox = document.getElementById('messageBox');
    
    if (!messageBox) {
        // 建立訊息框元素
        messageBox = document.createElement('div');
        messageBox.id = 'messageBox';
        messageBox.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            max-width: 350px;
            padding: 16px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            font-size: 14px;
            font-weight: 500;
            z-index: 9999;
            animation: slideInRight 0.3s ease;
        `;
        document.body.appendChild(messageBox);
    }
    
    // 根據類型設定顏色
    const colors = {
        success: { bg: '#10B981', text: '#FFFFFF' },  // 綠色
        error: { bg: '#EF4444', text: '#FFFFFF' },    // 紅色
        warning: { bg: '#F59E0B', text: '#FFFFFF' },  // 橘色
        info: { bg: '#3B82F6', text: '#FFFFFF' }      // 藍色
    };
    
    const color = colors[type] || colors.info;
    
    // 設定訊息框樣式和內容
    messageBox.style.background = color.bg;
    messageBox.style.color = color.text;
    messageBox.textContent = message;
    
    // 顯示訊息框
    messageBox.style.display = 'block';
    
    // 3 秒後自動隱藏
    setTimeout(() => {
        messageBox.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => {
            messageBox.style.display = 'none';
        }, 300);
    }, 3000);
    
    // 在控制台也印出訊息（方便除錯）
    const icon = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    console.log(`${icon[type]} ${message}`);
}


// ==========================================
// 檢查登入狀態
// ==========================================

/**
 * 檢查使用者是否已經登入
 * 如果已登入，可以直接跳轉到相應頁面
 */
function checkLoginStatus() {
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    const userData = localStorage.getItem('user');
    
    if (isLoggedIn === 'true' && userData) {
        console.log('ℹ️ 使用者已登入');
        const user = JSON.parse(userData);
        
        // 可以選擇自動跳轉
        // showMessage(`已登入為 ${user.name}`, 'info');
    }
}

// 頁面載入時檢查登入狀態
checkLoginStatus();


// ==========================================
// CSS 動畫（用於訊息框）
// ==========================================

// 動態插入 CSS 動畫
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);


// ==========================================
// 錯誤處理
// ==========================================

// 捕捉所有未處理的錯誤
window.addEventListener('error', function(e) {
    console.error('❌ 發生錯誤：', e.message);
    showMessage('系統發生錯誤，請重新整理頁面', 'error');
});

// 捕捉 Promise 錯誤
window.addEventListener('unhandledrejection', function(e) {
    console.error('❌ Promise 錯誤：', e.reason);
    showMessage('操作失敗，請重試', 'error');
});


// ==========================================
// 開發者提示
// ==========================================

if (APP_CONFIG.TEST_MODE) {
    console.log('');
    console.log('='.repeat(50));
    console.log('🔧 測試模式已啟用');
    console.log('='.repeat(50));
    console.log('');
    console.log('📋 待辦事項：');
    console.log('1. 到 Google Cloud Console 取得 Client ID');
    console.log('2. 建立 Google Apps Script 作為後端 API');
    console.log('3. 更新 CONFIG 中的設定');
    console.log('');
    console.log('💡 測試提示：');
    console.log('- 可以使用「測試登入」功能來測試系統');
    console.log('- 打開 Console 查看詳細的運作流程');
    console.log('- 打開 Network 標籤查看 API 請求');
    console.log('');
    console.log('='.repeat(50));
}