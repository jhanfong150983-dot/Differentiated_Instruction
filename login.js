/* ==========================================
   登入頁面 JavaScript 檔案（已修正錯誤）
   ==========================================*/

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
    
    // ✅ 修正：只有在測試模式下才初始化測試登入
    if (APP_CONFIG.TEST_MODE) {
        initializeTestLogin();
    }
});

// ==========================================
// 等待 Google API 載入（帶重試機制）
// ==========================================
function waitForGoogleAPI(retryCount = 0) {
    const maxRetries = 10;
    const retryDelay = 500;
    
    console.log(`🔍 檢查 Google API... (嘗試 ${retryCount + 1}/${maxRetries})`);
    
    if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
        console.log('✅ Google API 載入成功！');
        initializeGoogleLogin();
    } else if (retryCount < maxRetries) {
        console.log(`⏳ Google API 尚未載入，${retryDelay}ms 後重試...`);
        setTimeout(() => {
            waitForGoogleAPI(retryCount + 1);
        }, retryDelay);
    } else {
        console.error('❌ Google API 載入失敗（超過重試次數）');
        showMessage('Google 登入服務載入失敗，請重新整理頁面', 'error');
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
function initializeGoogleLogin() {
    
    if (APP_CONFIG.GOOGLE_CLIENT_ID === 'YOUR_CLIENT_ID_HERE.apps.googleusercontent.com') {
        console.warn('⚠️ 尚未設定 Google Client ID');
        showMessage('尚未設定 Google 登入，請先完成設定', 'warning');
        return;
    }
    
    try {
        console.log('🔧 初始化 Google 登入按鈕...');
        
        google.accounts.id.initialize({
            client_id: APP_CONFIG.GOOGLE_CLIENT_ID,
            callback: handleGoogleLoginSuccess,
            auto_select: false,
            cancel_on_tap_outside: true
        });
        
        google.accounts.id.renderButton(
            document.getElementById('googleLoginButton'),
            {
                theme: 'outline',
                size: 'large',
                text: 'signin_with',
                shape: 'rectangular',
                logo_alignment: 'left',
                width: 350
            }
        );
        
        console.log('✅ Google 登入按鈕已成功初始化並渲染');
        
    } catch (error) {
        console.error('❌ Google 登入初始化失敗：', error);
        showMessage('Google 登入初始化失敗：' + error.message, 'error');
        showReloadButton();
    }
}

function handleGoogleLoginSuccess(response) {
    console.log('🔐 Google 登入成功！');
    
    try {
        // 鎖定 Google 按鈕，避免重複點擊
        const googleBtn = document.getElementById('googleLoginButton');
        if (googleBtn) {
            googleBtn.style.pointerEvents = 'none';
            googleBtn.style.opacity = '0.6';
        }

        const userData = parseJWT(response.credential);
        console.log('👤 使用者資料：', userData);
        
        const userInfo = {
            google_id: userData.sub,
            email: userData.email,
            name: userData.name,
            picture: userData.picture,
            email_verified: userData.email_verified
        };
        
        showMessage('正在處理登入資料...', 'info');
        saveUserToBackend(userInfo);
        
    } catch (error) {
        console.error('❌ 處理登入資料時發生錯誤：', error);
        showMessage('登入處理失敗，請重試', 'error');
    }
}

function parseJWT(token) {
    try {
        const parts = token.split('.');
        
        if (parts.length !== 3) {
            throw new Error('Invalid JWT format');
        }
        
        let payload = parts[1];
        payload = payload.replace(/-/g, '+').replace(/_/g, '/');
        
        while (payload.length % 4) {
            payload += '=';
        }
        
        const decodedPayload = decodeURIComponent(
            atob(payload)
                .split('')
                .map(function(c) {
                    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                })
                .join('')
        );
        
        const userData = JSON.parse(decodedPayload);
        console.log('✅ JWT 解析成功:', userData);
        
        return userData;
        
    } catch (error) {
        console.error('❌ JWT 解析失敗：', error);
        throw new Error('無法解析登入資料');
    }
}

// ==========================================
// 後端資料處理
// ==========================================
async function saveUserToBackend(userInfo) {
    
    // 檢查 API URL 是否為預設值（表示未設置）
    const isDefaultURL = APP_CONFIG.API_URL.includes('AKfycbwDj5XLneAz6fRYAae_KyAtsyHjFRsONgJFXewymJiksCEwBk0HVQaARzo7pgB0etGhFQ') ||
                         APP_CONFIG.API_URL === 'YOUR_API_URL_HERE' ||
                         !APP_CONFIG.API_URL.includes('macros');
    
    if (isDefaultURL) {
        console.warn('⚠️ 尚未設定後端 API 網址');
        console.log('📋 目前 API_URL:', APP_CONFIG.API_URL);
        
        if (APP_CONFIG.TEST_MODE) {
            console.log('🧪 測試模式：模擬登入成功');
            handleLoginSuccess(userInfo);
            return;
        }
        
        showMessage('⚠️ 後端 API 尚未正確設定，請檢查 config.js', 'error');
        return;
    }
    
    try {
        console.log('📤 正在送出使用者資料到後端...');
        
        const response = await makeJSONPRequest({
            action: 'login',
            email: userInfo.email,
            name: userInfo.name,
            google_id: userInfo.google_id,
            picture: userInfo.picture,
            timestamp: new Date().toISOString()
        });
        
        console.log('✅ 後端回應：', response);
        
        if (response.success) {
            checkAndBindStudent(response.user_id, userInfo.email, response.role, {
                ...userInfo,
                user_id: response.user_id,
                role: response.role,
                current_tier: response.current_tier,
                jwt: response.jwt
            });
        } else {
            throw new Error(response.message || '登入失敗');
        }
        
    } catch (error) {
        console.error('❌ 連接後端失敗：', error);
        console.error('📋 錯誤詳情：', {
            message: error.message,
            api_url: APP_CONFIG.API_URL,
            timestamp: new Date().toISOString()
        });
        
        // 提供更詳細的錯誤信息
        if (error.message.includes('超時')) {
            showMessage('❌ 伺服器無回應（超時）\n\n請檢查：\n1. 網路連線\n2. config.js 的 API_URL 是否正確\n3. Google Apps Script 是否已部署', 'error');
        } else if (error.message.includes('failed')) {
            showMessage('❌ 無法連接到伺服器\n\n請檢查：\n1. 網路連線\n2. config.js 的 API_URL 是否正確', 'error');
        } else {
            showMessage(`❌ 登入失敗：${error.message}\n\n請稍後再試或聯繫管理員`, 'error');
        }
    }
}

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
        const finalUrl = `${APP_CONFIG.API_URL}?${params.toString()}`;
        script.src = finalUrl;
        
        console.log('🔗 發送請求到:', finalUrl.substring(0, 100) + '...');
        
        script.onerror = (error) => {
            console.error('❌ JSONP 載入失敗:', error);
            console.error('📝 API URL:', APP_CONFIG.API_URL);
            delete window[callbackName];
            if (script && script.parentNode) {
                script.parentNode.removeChild(script);
            }
            reject(new Error('JSONP 載入失敗 - 請檢查 API URL 是否正確'));
        };
        
        document.body.appendChild(script);
        
        const timeoutId = setTimeout(() => {
            if (window[callbackName]) {
                console.error('⏱️ JSONP 請求超時（15秒）');
                console.error('📝 API URL:', APP_CONFIG.API_URL);
                delete window[callbackName];
                if (script && script.parentNode) {
                    script.parentNode.removeChild(script);
                }
                reject(new Error('伺服器無回應，請檢查 API_URL 是否正確部署'));
            }
        }, 15000);
    });
}

async function checkAndBindStudent(user_id, email, currentRole, userData) {
    try {
        console.log('🔍 正在檢查使用者角色和權限...', { user_id, email, currentRole });
        
        if (currentRole === 'teacher' || currentRole === 'admin') {
            console.log('✅ 老師登入成功！', { role: currentRole });
            showMessage(`歡迎，${userData.name}！`, 'success');
            
            setTimeout(() => {
                handleLoginSuccess(userData);
            }, 1000);
            
        } else if (currentRole === 'student') {
            console.log('🔍 正在檢查學生綁定狀態...');
            
            const response = await makeJSONPRequest({
                action: 'checkAndBindStudent',
                user_id: user_id,
                email: email
            });
            
            console.log('📋 綁定檢查結果：', response);
            
            if (response.success) {
                console.log('✅ 學生綁定成功！', response);
                
                userData.bound_classes = response.class_ids || [];
                userData.permission = 'student';
                
                showMessage(`歡迎，${userData.name}！已綁定 ${response.found_classes} 個班級`, 'success');
                
                localStorage.setItem('bind_info', JSON.stringify({
                    bound_classes: response.class_ids,
                    bind_time: new Date().toISOString()
                }));
                
                setTimeout(() => {
                    userData.role = 'student';
                    handleLoginSuccess(userData);
                }, 2000);
                
            } else if (response.permission === 'none') {
                console.warn('⚠️ 學生未被任何班級錄取', response);
                showPermissionDeniedMessage(userData.name, email);
                
            } else {
                console.warn('⚠️ 綁定檢查失敗，但進行基本登入', response);
                handleLoginSuccess(userData);
            }
            
        } else {
            console.warn('⚠️ 未知的使用者角色：', currentRole);
            showMessage(`無法識別您的身份（角色：${currentRole}），請聯絡管理員`, 'error');
        }
        
    } catch (error) {
        console.error('❌ 綁定檢查失敗：', error);
        
        if (currentRole === 'teacher' || currentRole === 'admin') {
            console.warn('⚠️ 無法進行綁定檢查，但老師仍可登入');
            handleLoginSuccess(userData);
        } else {
            console.warn('⚠️ 無法進行綁定檢查，進行基本登入');
            handleLoginSuccess(userData);
        }
    }
}

function showPermissionDeniedMessage(userName, email) {
    const loginContainer = document.querySelector('.login-container');
    if (loginContainer) {
        loginContainer.style.display = 'none';
    }
    
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
    
    const body = document.body;
    const container = document.createElement('div');
    container.innerHTML = deniedHTML;
    body.appendChild(container);
    
    addPermissionDeniedStyles();
}

function goBackToLogin() {
    location.reload();
}

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

function handleLoginSuccess(userData) {
    console.log('🎉 登入成功！使用者資料：', userData);
    
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('role', userData.role);
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('loginTime', new Date().toISOString());
    
    if (userData.jwt) {
        localStorage.setItem('jwt', userData.jwt);
    }
    
    console.log('✅ localStorage 已儲存：');
    console.log('  - user:', userData);
    console.log('  - role:', userData.role);
    console.log('  - jwt:', userData.jwt ? '已儲存' : '未提供');
    
    showMessage(`歡迎，${userData.name}！正在跳轉...`, 'success');
    
    setTimeout(() => {
        if (userData.role === 'admin') {
            window.location.href = 'admin.html';
        } else if (userData.role === 'teacher') {
            window.location.href = 'teacher.html';
        } else if (userData.role === 'student') {
            window.location.href = 'student.html';
        } else {
            window.location.href = 'index.html';
        }
    }, 2000);
}

function showMessage(message, type = 'info') {
    let messageBox = document.getElementById('messageBox');
    
    if (!messageBox) {
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
    
    const colors = {
        success: { bg: '#10B981', text: '#FFFFFF' },
        error: { bg: '#EF4444', text: '#FFFFFF' },
        warning: { bg: '#F59E0B', text: '#FFFFFF' },
        info: { bg: '#3B82F6', text: '#FFFFFF' }
    };
    
    const color = colors[type] || colors.info;
    
    messageBox.style.background = color.bg;
    messageBox.style.color = color.text;
    messageBox.textContent = message;
    messageBox.style.display = 'block';
    
    setTimeout(() => {
        messageBox.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => {
            messageBox.style.display = 'none';
        }, 300);
    }, 3000);
    
    const icon = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    console.log(`${icon[type]} ${message}`);
}

// ==========================================
// ✅ 新增：測試登入功能（測試模式用）
// ==========================================
function initializeTestLogin() {
    console.log('🧪 測試模式：初始化測試登入功能');
    
    // 可以在這裡加入測試用的登入按鈕或邏輯
    // 例如：自動建立一個測試帳號登入按鈕
}

// ==========================================
// 檢查登入狀態
// ==========================================
function checkLoginStatus() {
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    const userData = localStorage.getItem('user');
    
    if (isLoggedIn === 'true' && userData) {
        console.log('ℹ️ 使用者已登入');
    }
}

checkLoginStatus();

// ==========================================
// CSS 動畫
// ==========================================
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
window.addEventListener('error', function(e) {
    console.error('❌ 發生錯誤：', e.message);
    showMessage('系統發生錯誤，請重新整理頁面', 'error');
});

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
}


