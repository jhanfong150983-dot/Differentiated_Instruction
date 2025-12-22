// ==========================================
// 自主檢查與評量系統模組
// ==========================================

// 注意：此模組應在 IIFE 內部的 student.js 末尾添加

let currentSelfCheckData = {
    taskProgressId: null,
    taskId: null,
    checklists: [],
    checkedItems: [],
    scenarioType: null,
    question: null,
    selectedAnswer: null
};

/**
 * 顯示自主檢查面板
 */
window.showSelfCheckPanel = function(taskProgressId, taskId) {
    currentSelfCheckData.taskProgressId = taskProgressId;
    currentSelfCheckData.taskId = taskId;

    showLoading('mainLoading');

    const params = new URLSearchParams({
        action: 'getTaskChecklistsAndAnswer',
        taskId: taskId,
        userEmail: currentStudent.email
    });

    fetch(`${APP_CONFIG.API_URL}?${params.toString()}`)
        .then(response => response.json())
        .then(function(data) {
            hideLoading('mainLoading');

            if (data.success) {
                currentSelfCheckData.checklists = data.checklists || [];
                displayReferenceAnswer(data.answer);
                document.getElementById('selfCheckModal').style.display = 'flex';
            } else {
                showToast(data.message || '取得檢核表失敗', 'error');
            }
        })
        .catch(function(error) {
            hideLoading('mainLoading');
            APP_CONFIG.error('取得檢核表失敗', error);
            showToast('取得檢核表失敗：' + error.message, 'error');
        });
};

/**
 * 顯示正確答案示範
 */
function displayReferenceAnswer(answer) {
    const container = document.getElementById('referenceAnswerContent');
    let html = '';

    if (answer && answer.answerText) {
        html += `<p>${answer.answerText}</p>`;

        if (answer.answerImages && answer.answerImages.length > 0) {
            html += '<div style="margin-top: 12px;">';
            for (let img of answer.answerImages) {
                if (img && img.trim()) {
                    html += `<img src="${img}" style="max-width: 100%; max-height: 300px; margin: 8px 0; border-radius: 4px;">`;
                }
            }
            html += '</div>';
        }
    } else {
        html = '<p style="color: var(--game-text-dark);">無示範內容</p>';
    }

    container.innerHTML = html;
}

/**
 * 移動到下一步（檢核表）
 */
window.handleNextStep = function() {
    document.getElementById('step1Container').style.display = 'none';
    document.getElementById('step2Container').style.display = 'block';
    document.getElementById('step2Indicator').classList.add('active');
    document.getElementById('nextStepBtn').style.display = 'none';
    document.getElementById('closeSelfCheckBtn').textContent = '返回';

    displayChecklist();
};

/**
 * 顯示檢核表
 */
function displayChecklist() {
    const container = document.getElementById('checklistContainer');
    currentSelfCheckData.checkedItems = {};

    let html = '';
    for (let item of currentSelfCheckData.checklists) {
        const checkId = `check_${item.checklistId}`;
        currentSelfCheckData.checkedItems[item.checklistId] = false;

        html += `
            <div style="display: flex; align-items: center; margin-bottom: 12px; padding: 8px; border-radius: 4px; background: var(--game-bg-dark);">
                <input type="checkbox" id="${checkId}" onchange="handleChecklistToggle('${item.checklistId}');" style="width: 20px; height: 20px; cursor: pointer; margin-right: 12px;">
                <div>
                    <label for="${checkId}" style="cursor: pointer; font-weight: 500;">${item.itemTitle || ''}</label>
                    ${item.itemDescription ? `<div style="font-size: 12px; color: var(--game-text-medium); margin-top: 4px;">${item.itemDescription}</div>` : ''}
                </div>
            </div>
        `;
    }

    container.innerHTML = html;
}

/**
 * 處理檢核項勾選
 */
window.handleChecklistToggle = function(checklistId) {
    const checkbox = document.getElementById(`check_${checklistId}`);
    currentSelfCheckData.checkedItems[checklistId] = checkbox.checked;

    // 判斷是否全部勾選
    const allChecked = Object.values(currentSelfCheckData.checkedItems).every(v => v === true);
    const hasUnchecked = Object.values(currentSelfCheckData.checkedItems).some(v => v === false);

    if (hasUnchecked) {
        // B情境：有未勾選的
        document.getElementById('errorExplanationSection').style.display = 'block';
        currentSelfCheckData.scenarioType = 'B';
    } else {
        // A情境：全部勾選
        document.getElementById('errorExplanationSection').style.display = 'none';
        currentSelfCheckData.scenarioType = 'A';
    }
};

/**
 * 提交自主檢查，進行評量
 */
window.submitSelfCheck = function() {
    // 檢查是否需要填寫錯誤說明（B情境）
    const hasUnchecked = Object.values(currentSelfCheckData.checkedItems).some(v => v === false);
    
    if (hasUnchecked) {
        const errorReason = document.getElementById('errorReasonInput').value.trim();
        const improvement = document.getElementById('improvementInput').value.trim();

        if (!errorReason || !improvement) {
            showToast('請填寫錯誤原因和改善方式', 'warning');
            return;
        }
    }

    // 準備檢核數據
    const checklistData = currentSelfCheckData.checklists.map(item => ({
        checklistId: item.checklistId,
        isChecked: currentSelfCheckData.checkedItems[item.checklistId] || false
    }));

    showLoading('mainLoading');

    const params = new URLSearchParams({
        action: 'submitSelfCheck',
        taskProgressId: currentSelfCheckData.taskProgressId,
        checklistData: JSON.stringify(checklistData),
        scenarioType: currentSelfCheckData.scenarioType,
        errorExplanation: document.getElementById('errorReasonInput').value.trim() || '',
        userEmail: currentStudent.email
    });

    fetch(`${APP_CONFIG.API_URL}?${params.toString()}`)
        .then(response => response.json())
        .then(function(data) {
            hideLoading('mainLoading');

            if (data.success) {
                // 檢查是否需要進入評量環節
                if (data.nextStep === 'assessment' && data.question) {
                    currentSelfCheckData.question = data.question;
                    displayQuestion(data.question);

                    document.getElementById('step2Container').style.display = 'none';
                    document.getElementById('step3Container').style.display = 'block';
                    document.getElementById('step3Indicator').classList.add('active');
                    document.getElementById('nextStepBtn').style.display = 'none';
                    document.getElementById('closeSelfCheckBtn').style.display = 'none';
                    document.getElementById('submitAnswerBtn').style.display = 'block';

                    showToast('進入評量環節', 'info');
                } else if (data.nextStep === 'completed') {
                    // 沒有評量題目，直接完成
                    showToast('🎉 任務完成！', 'success');

                    // 即時更新導覽列的代幣顯示
                    if (typeof refreshUserTokens === 'function') {
                        refreshUserTokens();
                    }

                    closeSelfCheckModal();

                    // 延遲後重新加載任務列表
                    setTimeout(function() {
                        if (selectedTier) {
                            loadTierTasks(true);
                        }
                    }, 1500);
                } else {
                    showToast(data.message || '未知的流程狀態', 'warning');
                }
            } else {
                showToast(data.message || '提交檢查失敗', 'error');
            }
        })
        .catch(function(error) {
            hideLoading('mainLoading');
            APP_CONFIG.error('提交檢查失敗', error);
            showToast('提交檢查失敗：' + error.message, 'error');
        });
};

/**
 * 顯示評量題目
 */
function displayQuestion(question) {
    if (!question) {
        showToast('無評量題目', 'error');
        return;
    }

    document.getElementById('questionText').textContent = question.questionText || '題目加載失敗';

    const optionsContainer = document.getElementById('optionsContainer');
    optionsContainer.innerHTML = '';

    const options = [
        { letter: 'a', text: question.optionA },
        { letter: 'b', text: question.optionB },
        { letter: 'c', text: question.optionC },
        { letter: 'd', text: question.optionD }
    ];

    for (let opt of options) {
        const optionDiv = document.createElement('div');
        optionDiv.style.cssText = 'display: flex; align-items: center; gap: 12px; padding: 12px; background: var(--game-bg-dark); border-radius: 4px; cursor: pointer; border: 2px solid transparent; transition: all 0.2s;';
        optionDiv.innerHTML = `
            <input type="radio" name="answer" value="${opt.letter}" id="option_${opt.letter}" style="width: 18px; height: 18px; cursor: pointer;">
            <label for="option_${opt.letter}" style="cursor: pointer; flex: 1; font-size: 14px;">${opt.letter.toUpperCase()}. ${opt.text}</label>
        `;

        optionDiv.addEventListener('click', function() {
            document.querySelectorAll('input[name="answer"]').forEach(r => r.checked = false);
            document.getElementById(`option_${opt.letter}`).checked = true;
            currentSelfCheckData.selectedAnswer = opt.letter;

            // 視覺反饋
            optionsContainer.querySelectorAll('div').forEach(d => d.style.borderColor = 'transparent');
            optionDiv.style.borderColor = 'var(--game-primary)';
        });

        optionsContainer.appendChild(optionDiv);
    }
}

/**
 * 顯示正確答案（答錯時調用）
 */
function displayCorrectAnswer(correctAnswer, attemptNumber) {
    if (!correctAnswer) return;

    const correctAnswerUpper = correctAnswer.toUpperCase();
    const optionsContainer = document.getElementById('optionsContainer');
    if (!optionsContainer) return;

    // 標記所有選項
    optionsContainer.querySelectorAll('div').forEach(optionDiv => {
        const radio = optionDiv.querySelector('input[type="radio"]');
        if (!radio) return;

        const optionValue = radio.value.toUpperCase();

        if (optionValue === correctAnswerUpper) {
            // 正確答案：綠色高亮
            optionDiv.style.borderColor = '#10B981';
            optionDiv.style.background = 'rgba(16, 185, 129, 0.15)';
            optionDiv.style.borderWidth = '3px';

            const label = optionDiv.querySelector('label');
            if (label && !label.querySelector('.correct-answer-badge')) {
                const badge = document.createElement('span');
                badge.className = 'correct-answer-badge';
                badge.innerHTML = '✓ 正確答案';
                badge.style.cssText = `
                    display: inline-block; margin-left: 12px; padding: 4px 12px;
                    background: #10B981; color: white; border-radius: 12px;
                    font-size: 12px; font-weight: bold;
                `;
                label.appendChild(badge);
            }
        } else if (radio.checked) {
            // 錯誤答案：紅色標記
            optionDiv.style.borderColor = '#EF4444';
            optionDiv.style.background = 'rgba(239, 68, 68, 0.1)';
            optionDiv.style.borderWidth = '2px';

            const label = optionDiv.querySelector('label');
            if (label && !label.querySelector('.wrong-answer-badge')) {
                const badge = document.createElement('span');
                badge.className = 'wrong-answer-badge';
                badge.innerHTML = '✗ 你的答案';
                badge.style.cssText = `
                    display: inline-block; margin-left: 12px; padding: 4px 12px;
                    background: #EF4444; color: white; border-radius: 12px;
                    font-size: 12px; font-weight: bold;
                `;
                label.appendChild(badge);
            }
        }

        // 禁用選項
        if (radio) radio.disabled = true;
        optionDiv.style.cursor = 'not-allowed';
        optionDiv.style.opacity = '0.9';
    });

    // 在題目下方顯示正確答案提示
    const questionText = document.getElementById('questionText');
    if (questionText && !document.getElementById('correctAnswerHint')) {
        const hint = document.createElement('div');
        hint.id = 'correctAnswerHint';
        hint.style.cssText = `
            margin-top: 16px; padding: 12px;
            background: rgba(16, 185, 129, 0.1);
            border-left: 4px solid #10B981;
            border-radius: 4px; font-size: 16px;
            color: var(--game-text-light);
        `;
        hint.innerHTML = `<strong>正確答案是：${correctAnswerUpper}</strong>`;
        questionText.appendChild(hint);
    }
}

/**
 * 提交評量答案
 */
window.submitAssessmentAnswer = function() {
    if (!currentSelfCheckData.selectedAnswer) {
        showToast('請選擇答案', 'warning');
        return;
    }

    showLoading('mainLoading');

    const params = new URLSearchParams({
        action: 'submitAssessment',
        taskProgressId: currentSelfCheckData.taskProgressId,
        questionId: currentSelfCheckData.question.questionId,
        studentAnswer: currentSelfCheckData.selectedAnswer,
        userEmail: currentStudent.email
    });

    fetch(`${APP_CONFIG.API_URL}?${params.toString()}`)
        .then(response => response.json())
        .then(function(data) {
            hideLoading('mainLoading');

            if (data.isCorrect) {
                showToast(`🎉 恭喜！答對了！獲得 ${data.tokenReward} 個金幣`, 'success');

                // 即時更新導覽列的代幣顯示
                if (typeof refreshUserTokens === 'function') {
                    refreshUserTokens();
                }

                closeSelfCheckModal();

                // 延遲後重新加載任務列表
                setTimeout(function() {
                    if (selectedTier) {
                        loadTierTasks(true);
                    }
                }, 1500);
            } else {
                // 答錯：顯示正確答案，不關閉 Modal
                displayCorrectAnswer(data.correctAnswer, data.attemptNumber);

                // 顯示錯誤提示訊息
                showToast(`❌ 答錯了！這是第 ${data.attemptNumber} 次嘗試`, 'warning', 5000);

                // 修改按鈕行為
                const submitBtn = document.getElementById('submitAnswerBtn');
                if (submitBtn) submitBtn.style.display = 'none';

                const closeBtn = document.getElementById('closeSelfCheckBtn');
                if (closeBtn) {
                    closeBtn.textContent = '知道了，重新開始';
                    closeBtn.onclick = function() {
                        closeSelfCheckModal();
                        setTimeout(() => {
                            if (selectedTier) loadTierTasks(true);
                        }, 500);
                    };
                }
            }
        })
        .catch(function(error) {
            hideLoading('mainLoading');
            APP_CONFIG.error('提交評量失敗', error);
            showToast('提交評量失敗：' + error.message, 'error');
        });
};

/**
 * 關閉自主檢查面板
 */
window.closeSelfCheckModal = function() {
    document.getElementById('selfCheckModal').style.display = 'none';

    // 重置狀態
    currentSelfCheckData = {
        taskProgressId: null,
        taskId: null,
        checklists: [],
        checkedItems: [],
        scenarioType: null,
        question: null,
        selectedAnswer: null
    };

    // 重置 UI
    document.getElementById('step1Container').style.display = 'block';
    document.getElementById('step2Container').style.display = 'none';
    document.getElementById('step3Container').style.display = 'none';
    document.getElementById('step2Indicator').classList.remove('active');
    document.getElementById('step3Indicator').classList.remove('active');
    document.getElementById('closeSelfCheckBtn').textContent = '關閉';
    document.getElementById('closeSelfCheckBtn').style.display = 'block';
    document.getElementById('nextStepBtn').style.display = 'block';
    document.getElementById('submitAnswerBtn').style.display = 'none';
    document.getElementById('errorExplanationSection').style.display = 'none';
    document.getElementById('errorReasonInput').value = '';
    document.getElementById('improvementInput').value = '';
};
