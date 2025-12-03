/**
 * ==========================================
 * 導航列系統 - 加強除錯版
 * ==========================================
 */

/**
 * 渲染導航列（加強版 - 含除錯）
 */
function renderNavbar() {
    console.log('🔧 [Navbar] 開始渲染');
    
    // 1. 檢查容器
    const container = document.getElementById('navbarContainer');
    if (!container) {
        console.error('❌ [Navbar] 找不到 navbarContainer');
        console.error('❌ [Navbar] 請確認 HTML 有 <div id="navbarContainer"></div>');
        return;
    }
    console.log('✅ [Navbar] 找到容器');
    
    // 2. 讀取 localStorage
    const userStr = localStorage.getItem('user');
    const role = localStorage.getItem('role');
    const jwt = localStorage.getItem('jwt');
    
    console.log('📦 [Navbar] localStorage 資料:');
    console.log('  - user:', userStr);
    console.log('  - role:', role);
    console.log('  - jwt:', jwt ? '存在' : '不存在');
    
    // 3. 判斷是否登入
    if (!userStr || !role) {
        console.log('⚠️ [Navbar] 未登入，顯示登入按鈕');
        container.innerHTML = `
            <nav class="navbar">
                <div class="nav-left">
                    <div class="logo">📚</div>
                    <h1 class="site-title">分層教學平台</h1>
                </div>
                <div class="nav-right">
                    <a href="login.html" class="btn-login">登入 / 註冊</a>
                </div>
            </nav>
        `;
        return;
    }
    
    // 4. 解析使用者資料
    let user;
    try {
        user = JSON.parse(userStr);
        console.log('✅ [Navbar] User 解析成功:', user);
    } catch (e) {
        console.error('❌ [Navbar] User 解析失敗:', e);
        console.error('❌ [Navbar] 錯誤的 userStr:', userStr);
        // 清除錯誤資料
        alert('登入資料格式錯誤，請重新登入');
        localStorage.clear();
        window.location.href = 'login.html';
        return;
    }
    
    // 5. 確定角色顯示
    let roleText = '';
    let roleIcon = '';
    
    if (role === 'teacher' || role === 'admin') {
        roleText = '教師';
        roleIcon = '👨‍🏫';
    } else if (role === 'student') {
        roleText = '學生';
        roleIcon = '👨‍🎓';
    } else {
        roleText = role;
        roleIcon = '👤';
    }
    
    console.log('🎭 [Navbar] 角色:', roleText, roleIcon);
    
    // 6. 生成 HTML
    let navHTML = `
        <nav class="navbar">
            <div class="nav-left">
                <div class="logo">📚</div>
                <h1 class="site-title">分層教學平台</h1>
            </div>
            <div class="nav-right">
    `;
    
    // 學生顯示代幣
    if (role === 'student') {
        navHTML += `
                <div class="token-display">
                    💰 <span id="tokenAmount">0</span>
                </div>
        `;
    }
    
    // 使用者選單
    navHTML += `
                <div class="user-menu">
                    <div class="user-display">
                        <span class="user-icon">${roleIcon}</span>
                        <div class="user-info">
                            <span class="user-name">${escapeHtml(user.name)}</span>
                            <span class="user-role">${roleText}</span>
                        </div>
                        <span class="dropdown-arrow">▼</span>
                    </div>
                    <div class="dropdown-menu">
    `;
    
    // 根據角色顯示選單
    if (role === 'student') {
        navHTML += `
                        <a href="dashboard.html" class="dropdown-item">
                            <span class="dropdown-icon">📊</span>
                            <span>學習分析</span>
                        </a>
                        <a href="achievements.html" class="dropdown-item">
                            <span class="dropdown-icon">🏆</span>
                            <span>成就系統</span>
                        </a>
                        <div class="dropdown-divider"></div>
        `;
    }
    
    if (role === 'teacher' || role === 'admin') {
        navHTML += `
                        <a href="teacher.html" class="dropdown-item">
                            <span class="dropdown-icon">👥</span>
                            <span>班級管理</span>
                        </a>
                        <a href="teacher.html#courses" class="dropdown-item">
                            <span class="dropdown-icon">📚</span>
                            <span>課程管理</span>
                        </a>
                        <a href="teacher.html#tokens" class="dropdown-item">
                            <span class="dropdown-icon">�</span>
                            <span>代幣管理</span>
                        </a>
                        <div class="dropdown-divider"></div>
        `;
    }
    
    navHTML += `
                        <div class="dropdown-item logout" onclick="handleLogout()">
                            <span class="dropdown-icon">🚪</span>
                            <span>登出</span>
                        </div>
                    </div>
                </div>
            </div>
        </nav>
    `;
    
    container.innerHTML = navHTML;
    console.log('✅ [Navbar] 渲染完成');
    console.log('✅ [Navbar] 使用者:', user.name, '(', roleText, ')');
    
    // 學生載入代幣
    if (role === 'student') {
        setTimeout(() => {
            refreshUserTokens();
        }, 100);
    }
}


/**
 * 載入使用者代幣
 */
async function refreshUserTokens() {
    try {
        const userStr = localStorage.getItem('user');
        if (!userStr) return;
        
        let user;
        try {
            user = JSON.parse(userStr);
        } catch (e) {
            console.error('❌ [Token] 解析使用者資料失敗:', e);
            return;
        }
        
        if (!user.email) {
            console.log('ℹ️ [Token] 使用者資料中沒有 email');
            return;
        }

        console.log('📊 [Token] 正在載入代幣資訊...');

        // 使用 fetch 調用 API
        const params = new URLSearchParams({
            action: 'getUserTokens',
            userEmail: user.email
        });

        const response = await fetch(`${APP_CONFIG.API_URL}?${params.toString()}`);
        const result = await response.json();

        if (result && result.success && typeof result.tokens === 'number') {
            console.log('✅ [Token] 代幣載入成功:', result.tokens);
            updateTokenDisplay(result.tokens);
            localStorage.setItem('totalTokens', result.tokens);
        } else {
            console.warn('⚠️ [Token] 無法載入代幣:', result.message || '未知錯誤');
            updateTokenDisplay(0);
        }
        
    } catch (error) {
        console.warn('⚠️ [Token] 載入失敗:', error.message || error);
        updateTokenDisplay(0);
    }
}


/**
 * 更新代幣顯示
 */
function updateTokenDisplay(newTokens) {
    const amountElement = document.getElementById('tokenAmount');
    
    if (!amountElement) {
        return;
    }
    
    const tokens = typeof newTokens === 'number' ? newTokens : 0;
    amountElement.textContent = tokens;
}


/**
 * 登出
 */
function handleLogout() {
    console.log('🚪 [Navbar] 執行登出');
    if (confirm('確定要登出嗎？')) {
        console.log('✅ [Navbar] 清除 localStorage');
        localStorage.clear();
        console.log('✅ [Navbar] 導向首頁');
        window.location.href = 'index.html';
    } else {
        console.log('❌ [Navbar] 取消登出');
    }
}


/**
 * HTML 跳脫
 */
function escapeHtml(text) {
    if (!text && text !== 0 && text !== false) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}


/**
 * 頁面載入時初始化
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 [Navbar] DOMContentLoaded 觸發');
    renderNavbar();
});

// 備用：如果 DOMContentLoaded 已經過了
if (document.readyState === 'loading') {
    console.log('📄 [Navbar] 等待 DOM 載入');
} else {
    console.log('📄 [Navbar] DOM 已載入，立即執行');
    renderNavbar();
}

console.log('✅ [Navbar] navbar.js 載入完成');