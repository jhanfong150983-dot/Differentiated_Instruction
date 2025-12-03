/* ==========================================
   統一管理頁面工具函數 - management-utils.js
   ==========================================
   
   提供共用功能：
   - Toast 通知
   - Modal 控制
   - 表單驗證
   - 載入動畫
*/

// ==========================================
// Toast 通知系統
// ==========================================

/**
 * 顯示 Toast 通知
 * @param {string} message - 訊息內容
 * @param {string} type - 類型 (success/error/info/warning)
 * @param {number} duration - 顯示時間（毫秒）
 */
function showToast(message, type = 'info', duration = 3000) {
    // 移除舊的 toast
    const oldToast = document.querySelector('.toast');
    if (oldToast) {
        oldToast.remove();
    }
    
    // 建立新的 toast
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    // 設定圖示
    const icons = {
        success: '✅',
        error: '❌',
        info: 'ℹ️',
        warning: '⚠️'
    };
    
    toast.innerHTML = `
        <div class="toast-icon">${icons[type] || 'ℹ️'}</div>
        <div class="toast-message">${escapeHtml(message)}</div>
    `;
    
    document.body.appendChild(toast);
    
    // 自動移除
    setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// 為了向後相容，保留 showSuccessToast 等別名
function showSuccessToast(message) {
    showToast(message, 'success');
}

function showErrorToast(message) {
    showToast(message, 'error');
}

function showInfoToast(message) {
    showToast(message, 'info');
}

function showWarningToast(message) {
    showToast(message, 'warning');
}

// ==========================================
// Modal 控制
// ==========================================

/**
 * 開啟 Modal
 * @param {string} modalId - Modal 的 ID
 */
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        // 聚焦到第一個輸入框
        const firstInput = modal.querySelector('input, textarea');
        if (firstInput) {
            setTimeout(() => firstInput.focus(), 100);
        }
    }
}

/**
 * 關閉 Modal
 * @param {string} modalId - Modal 的 ID
 */
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

/**
 * 點擊背景關閉 Modal
 */
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.remove('active');
        document.body.style.overflow = '';
    }
});

// ESC 鍵關閉 Modal
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        const activeModal = document.querySelector('.modal-overlay.active');
        if (activeModal) {
            activeModal.classList.remove('active');
            document.body.style.overflow = '';
        }
    }
});

// ==========================================
// 載入動畫控制
// ==========================================

/**
 * 顯示載入動畫
 * @param {string} loadingId - 載入元素的 ID
 */
function showLoading(loadingId) {
    const loading = document.getElementById(loadingId);
    if (loading) {
        loading.classList.add('active');
    }
}

/**
 * 隱藏載入動畫
 * @param {string} loadingId - 載入元素的 ID
 */
function hideLoading(loadingId) {
    const loading = document.getElementById(loadingId);
    if (loading) {
        loading.classList.remove('active');
    }
}

// ==========================================
// 表單驗證
// ==========================================

/**
 * 驗證必填欄位
 * @param {HTMLElement} form - 表單元素
 * @returns {boolean} 是否通過驗證
 */
function validateRequiredFields(form) {
    const requiredFields = form.querySelectorAll('[required]');
    let isValid = true;
    
    requiredFields.forEach(field => {
        // 移除舊的錯誤訊息
        const oldError = field.parentElement.querySelector('.form-error');
        if (oldError) {
            oldError.remove();
        }
        
        // 檢查欄位值
        if (!field.value.trim()) {
            isValid = false;
            
            // 加上錯誤樣式
            field.style.borderColor = '#EF4444';
            
            // 顯示錯誤訊息
            const error = document.createElement('div');
            error.className = 'form-error';
            error.textContent = '此欄位為必填';
            field.parentElement.appendChild(error);
            
            // 移除錯誤樣式（當使用者輸入時）
            field.addEventListener('input', function() {
                this.style.borderColor = '';
                const errorMsg = this.parentElement.querySelector('.form-error');
                if (errorMsg) {
                    errorMsg.remove();
                }
            }, { once: true });
        }
    });
    
    return isValid;
}

/**
 * 驗證 Email 格式
 * @param {string} email - Email 字串
 * @returns {boolean} 是否為有效 Email
 */
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

/**
 * 驗證 URL 格式
 * @param {string} url - URL 字串
 * @returns {boolean} 是否為有效 URL
 */
function validateURL(url) {
    try {
        new URL(url);
        return true;
    } catch (e) {
        return false;
    }
}

// ==========================================
// HTML 轉義（防止 XSS）
// ==========================================

/**
 * HTML 轉義
 * @param {string} text - 要轉義的文字
 * @returns {string} 轉義後的文字
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

// ==========================================
// 日期格式化
// ==========================================

/**
 * 格式化日期
 * @param {string|Date} date - 日期
 * @param {string} format - 格式 (date/datetime/time)
 * @returns {string} 格式化後的日期
 */
function formatDate(date, format = 'date') {
    if (!date) return '';
    
    try {
        const d = new Date(date);
        
        if (format === 'date') {
            return d.toLocaleDateString('zh-TW', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });
        } else if (format === 'datetime') {
            return d.toLocaleDateString('zh-TW', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        } else if (format === 'time') {
            return d.toLocaleTimeString('zh-TW', {
                hour: '2-digit',
                minute: '2-digit'
            });
        }
        
        return d.toLocaleDateString('zh-TW');
    } catch (e) {
        return String(date);
    }
}

/**
 * 相對時間（例如：2 小時前）
 * @param {string|Date} date - 日期
 * @returns {string} 相對時間描述
 */
function timeAgo(date) {
    if (!date) return '';
    
    try {
        const now = new Date();
        const past = new Date(date);
        const diff = now - past;
        
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 7) {
            return formatDate(date);
        } else if (days > 0) {
            return `${days} 天前`;
        } else if (hours > 0) {
            return `${hours} 小時前`;
        } else if (minutes > 0) {
            return `${minutes} 分鐘前`;
        } else {
            return '剛剛';
        }
    } catch (e) {
        return String(date);
    }
}

// ==========================================
// 確認對話框
// ==========================================

/**
 * 顯示確認對話框
 * @param {string} message - 訊息
 * @param {Function} onConfirm - 確認時的回調函數
 * @param {Function} onCancel - 取消時的回調函數
 */
function showConfirm(message, onConfirm, onCancel) {
    if (confirm(message)) {
        if (onConfirm) onConfirm();
    } else {
        if (onCancel) onCancel();
    }
}

// ==========================================
// 防抖動（Debounce）
// ==========================================

/**
 * 防抖動函數
 * @param {Function} func - 要執行的函數
 * @param {number} wait - 等待時間（毫秒）
 * @returns {Function} 防抖動後的函數
 */
function debounce(func, wait = 300) {
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

// ==========================================
// 複製到剪貼簿
// ==========================================

/**
 * 複製文字到剪貼簿
 * @param {string} text - 要複製的文字
 * @returns {Promise} Promise
 */
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showToast('已複製到剪貼簿', 'success');
        return true;
    } catch (err) {
        // 備用方案
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        
        try {
            document.execCommand('copy');
            showToast('已複製到剪貼簿', 'success');
            return true;
        } catch (e) {
            showToast('複製失敗', 'error');
            return false;
        } finally {
            document.body.removeChild(textarea);
        }
    }
}

// ==========================================
// 滾動到頂部
// ==========================================

/**
 * 平滑滾動到頂部
 */
function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

/**
 * 滾動到指定元素
 * @param {string} elementId - 元素 ID
 */
function scrollToElement(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    }
}

// ==========================================
// 初始化提示
// ==========================================

console.log('%c✨ 管理頁面工具已載入', 'color: #2C5F7C; font-size: 14px; font-weight: bold;');
console.log('%c可用函數：showToast, openModal, closeModal, showLoading, hideLoading 等', 'color: #95A5A6; font-size: 12px;');