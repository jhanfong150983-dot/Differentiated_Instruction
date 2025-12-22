/* ==========================================
   首頁 JavaScript 檔案
   ==========================================
   這個檔案處理首頁的互動功能
   目前功能較簡單，未來可以擴充更多互動效果
*/

// ==========================================
// 等待整個網頁載入完成後才執行程式
// ==========================================
document.addEventListener('DOMContentLoaded', function() {
    
    console.log('✅ 首頁載入完成！');
    
    // ------------------------------------------
    // 功能 1：平滑滾動效果
    // ------------------------------------------
    // 當點擊「了解更多」按鈕時，平滑滾動到特色區塊
    
    // 找到所有帶有 # 開頭的連結（錨點連結）
    const anchorLinks = document.querySelectorAll('a[href^="#"]');
    
    // 為每個錨點連結加上點擊事件
    anchorLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            // 取得連結的 href 屬性（例如：#features）
            const targetId = this.getAttribute('href');
            
            // 如果只是 # 就不處理
            if (targetId === '#') return;
            
            // 找到目標元素（例如：id="features" 的區塊）
            const targetSection = document.querySelector(targetId);
            
            // 如果找到目標元素
            if (targetSection) {
                e.preventDefault();  // 阻止預設的跳轉行為
                
                // 平滑滾動到目標位置
                targetSection.scrollIntoView({
                    behavior: 'smooth',  // 平滑滾動
                    block: 'start'       // 對齊到頂部
                });
                
                console.log(`📍 滾動到：${targetId}`);
            }
        });
    });
    
    
    // ------------------------------------------
    // 功能 2：卡片進入視窗時的動畫效果
    // ------------------------------------------
    // 使用 Intersection Observer API 來偵測元素是否進入視窗
    
    // 建立觀察器的選項設定
    const observerOptions = {
        threshold: 0.1,          // 當 10% 的元素進入視窗時觸發
        rootMargin: '0px 0px -50px 0px'  // 提早一點觸發
    };
    
    // 建立觀察器
    const observer = new IntersectionObserver(function(entries) {
        // entries 是所有被觀察的元素
        entries.forEach(entry => {
            // 如果元素進入視窗
            if (entry.isIntersecting) {
                // 加上 'visible' class（可以用 CSS 定義動畫效果）
                entry.target.classList.add('visible');
                
                // 停止觀察這個元素（因為動畫只需要播放一次）
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);
    
    // 找到所有特色卡片
    const featureCards = document.querySelectorAll('.feature-card');
    
    // 開始觀察每個卡片
    featureCards.forEach(card => {
        observer.observe(card);
    });
    
    // 找到所有層級卡片
    const tierCards = document.querySelectorAll('.tier-card');
    
    // 開始觀察每個層級卡片
    tierCards.forEach(card => {
        observer.observe(card);
    });
    
    
    // ------------------------------------------
    // 功能 3：顯示當前時間（示範用）
    // ------------------------------------------
    // 這個功能可以在控制台顯示使用者進入網站的時間
    
    const currentTime = new Date();
    const formattedTime = currentTime.toLocaleString('zh-TW', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    console.log(`⏰ 進入時間：${formattedTime}`);
    
    
    // ------------------------------------------
    // 功能 4：效能監測（開發用）
    // ------------------------------------------
    // 顯示網頁載入所花費的時間
    
    // 使用 Performance API 取得載入時間
    window.addEventListener('load', function() {
        // 等待所有資源（圖片、CSS、JS）都載入完成
        setTimeout(function() {
            // 取得效能資訊
            const perfData = window.performance.timing;
            
            // 計算載入時間（毫秒）
            const loadTime = perfData.loadEventEnd - perfData.navigationStart;
            
            // 轉換成秒（保留兩位小數）
            const loadTimeSeconds = (loadTime / 1000).toFixed(2);
            
            console.log(`⚡ 頁面載入時間：${loadTimeSeconds} 秒`);
        }, 0);
    });
    
    
    // ------------------------------------------
    // 未來可以新增的功能（註解說明）
    // ------------------------------------------
    
    /*
        功能建議 1：深色模式切換
        - 加上深色/淺色主題切換按鈕
        - 記住使用者的選擇（使用 localStorage）
        
        功能建議 2：語言切換
        - 繁體中文 / English 切換
        - 使用 i18n 多語系套件
        
        功能建議 3：使用者回饋表單
        - 在頁尾加上意見回饋表單
        - 使用 Google Forms 或自建表單
        
        功能建議 4：學習進度預覽
        - 顯示不同層級的課程數量
        - 連接到後端 API 取得即時資料
    */
    
});


// ==========================================
// 工具函數區
// ==========================================

/**
 * 防抖函數（Debounce）
 * 用途：當使用者快速觸發事件時，只執行最後一次
 * 例如：視窗縮放時不要一直執行函數，等停止縮放後才執行
 * 
 * @param {Function} func - 要執行的函數
 * @param {number} wait - 等待時間（毫秒）
 * @returns {Function} - 防抖後的函數
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * 節流函數（Throttle）
 * 用途：限制函數執行的頻率
 * 例如：滾動事件每 100 毫秒只能執行一次
 * 
 * @param {Function} func - 要執行的函數
 * @param {number} limit - 時間間隔（毫秒）
 * @returns {Function} - 節流後的函數
 */
function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}


// ==========================================
// 視窗縮放時的處理（範例）
// ==========================================

// 使用防抖函數處理視窗縮放事件
const handleResize = debounce(function() {
    const windowWidth = window.innerWidth;
    console.log(`📱 視窗寬度：${windowWidth}px`);
    
    // 可以根據視窗寬度做不同的處理
    if (windowWidth < 768) {
        console.log('📱 手機版模式');
    } else if (windowWidth < 1024) {
        console.log('💻 平板模式');
    } else {
        console.log('🖥️ 桌面版模式');
    }
}, 250);  // 250 毫秒後才執行

// 監聽視窗縮放事件
window.addEventListener('resize', handleResize);


// ==========================================
// 錯誤處理
// ==========================================

// 全域錯誤處理器（捕捉所有未處理的錯誤）
window.addEventListener('error', function(e) {
    console.error('❌ 發生錯誤：', e.message);
    console.error('錯誤位置：', e.filename, '第', e.lineno, '行');
});

// Promise 錯誤處理器
window.addEventListener('unhandledrejection', function(e) {
    console.error('❌ Promise 錯誤：', e.reason);
});


// ==========================================
// 開發者工具
// ==========================================

// 在開發模式下顯示更多資訊
const isDevelopment = window.location.hostname === 'localhost' || 
                     window.location.hostname === '127.0.0.1';

if (isDevelopment) {
    console.log('🔧 開發模式');
    console.log('💡 提示：打開 Network 標籤可以看到網路請求');
    console.log('💡 提示：打開 Console 標籤可以看到所有訊息');
}