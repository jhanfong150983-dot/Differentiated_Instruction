/* ==========================================
   全域設定檔 - config.js
   ==========================================
   
   ⚠️ 重要：所有設定都在這個檔案統一管理
   只需要修改這一個檔案，所有頁面都會自動更新！
   
   使用方式：
   在任何 HTML 檔案中，先引入這個檔案：
   <script src="config.js"></script>
   
   然後就可以使用 APP_CONFIG 物件
*/

const APP_CONFIG = {
  
  // ==========================================
  // 後端 API 設定
  // ==========================================
  
  /**
   * Google Apps Script 部署網址
   * ⚠️ 這是唯一需要修改的地方！
   * 
   * 取得方式：
   * 1. 開啟 Google Sheets
   * 2. 擴充功能 → Apps Script
   * 3. 部署 → 管理部署作業
   * 4. 複製網址貼到這裡
   */
  API_URL: 'https://script.google.com/macros/s/AKfycbzxe02FAaMgLhKmU8i9WcUbiK_yFLduIJR-dTT2ShZHdxAU-zzK57G0ijq_N9_BZQ7XOQ/exec',
  
  
  // ==========================================
  // Google OAuth 設定
  // ==========================================
  
  /**
   * Google OAuth Client ID
   * 
   * 取得方式：
   * 1. Google Cloud Console
   * 2. API 和服務 → 憑證
   * 3. OAuth 2.0 用戶端 ID
   * 4. 複製 Client ID 貼到這裡
   */
  GOOGLE_CLIENT_ID: '217213057326-blui949ga463mltkv66m7d5fgbi03fll.apps.googleusercontent.com',
  
  
  // ==========================================
  // 應用程式設定
  // ==========================================
  
  /**
   * 網站名稱
   */
  SITE_NAME: '分層教學管理系統',
  
  /**
   * 網站標語
   */
  SITE_TAGLINE: '個人化學習旅程',
  
  /**
   * 測試模式
   * true: 開發階段，顯示詳細除錯資訊
   * false: 正式環境，隱藏除錯資訊
   */
  TEST_MODE: true,
  
  /**
   * API 請求超時時間（毫秒）
   */
  API_TIMEOUT: 15000,
  
  
  // ==========================================
  // 頁面路由設定
  // ==========================================
  
  PAGES: {
    HOME: 'index.html',
    LOGIN: 'login.html',
    DASHBOARD: 'dashboard.html',
    TEACHER: 'teacher.html',
    ADMIN: 'admin.html'
  },
  
  
  // ==========================================
  // 角色權限設定
  // ==========================================
  
  ROLES: {
    STUDENT: 'student',
    TEACHER: 'teacher',
    ADMIN: 'admin'
  },
  
  
  // ==========================================
  // localStorage 鍵值
  // ==========================================
  
  STORAGE_KEYS: {
    USER: 'user',
    IS_LOGGED_IN: 'isLoggedIn',
    LOGIN_TIME: 'loginTime'
  },
  
  
  // ==========================================
  // 工具函數
  // ==========================================
  
  /**
   * 取得完整的 API 網址（帶參數）
   * @param {Object} params - URL 參數
   * @returns {string} 完整的 API 網址
   */
  getApiUrl: function(params) {
    const urlParams = new URLSearchParams(params);
    return `${this.API_URL}?${urlParams.toString()}`;
  },
  
  /**
   * 檢查是否為開發模式
   * @returns {boolean}
   */
  isDevelopment: function() {
    return this.TEST_MODE || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  },
  
  /**
   * 記錄除錯訊息（只在開發模式顯示）
   * @param {string} message - 訊息
   * @param {any} data - 資料
   */
  log: function(message, data) {
    if (this.isDevelopment()) {
      if (data !== undefined) {
        console.log(`[${this.SITE_NAME}] ${message}`, data);
      } else {
        console.log(`[${this.SITE_NAME}] ${message}`);
      }
    }
  },
  
  /**
   * 記錄錯誤訊息
   * @param {string} message - 訊息
   * @param {Error} error - 錯誤物件
   */
  error: function(message, error) {
    console.error(`[${this.SITE_NAME}] ❌ ${message}`, error);
  }
};


// ==========================================
// 開發模式提示
// ==========================================

if (APP_CONFIG.isDevelopment()) {
  console.log('');
  console.log('='.repeat(60));
  console.log(`🔧 ${APP_CONFIG.SITE_NAME} - 開發模式`);
  console.log('='.repeat(60));
  console.log('');
  console.log('📋 設定資訊：');
  console.log('API 網址:', APP_CONFIG.API_URL);
  console.log('Client ID:', APP_CONFIG.GOOGLE_CLIENT_ID);
  console.log('測試模式:', APP_CONFIG.TEST_MODE);
  console.log('');
  console.log('💡 提示：');
  console.log('- 所有設定都在 config.js 中統一管理');
  console.log('- 修改 API_URL 後所有頁面會自動更新');
  console.log('- 打開 Console 可以看到詳細的運作流程');
  console.log('');
  console.log('='.repeat(60));
}


// ==========================================
// 凍結設定物件（防止意外修改）
// ==========================================

// 在正式環境中凍結設定，防止被修改
if (!APP_CONFIG.isDevelopment()) {
  Object.freeze(APP_CONFIG);

}


















