    window.handleCompleteTask = function() {
        if (!selectedTask) return;

        const taskToSubmit = selectedTask;

        if (!confirm('確定要完成「' + (taskToSubmit.taskName || taskToSubmit.name) + '」嗎？\n完成後將獲得 ' + (taskToSubmit.tokenReward || 0) + ' 個金幣！')) {
            return;
        }

        const btn = document.getElementById('completeTaskBtn');
        btn.disabled = true;
        btn.textContent = '提交中...';

        const params = new URLSearchParams({
            action: 'submitTask',
            userEmail: currentStudent.email,
            taskId: taskToSubmit.taskId
        });

        APP_CONFIG.log('📤 提交任務...', { taskId: taskToSubmit.taskId });

        fetchWithRetry(`${APP_CONFIG.API_URL}?${params.toString()}`, 3)
            .then(response => response.json())
            .then(function(response) {
                btn.disabled = false;
                btn.textContent = '完成';

                APP_CONFIG.log('📥 提交回應:', response);

                if (response.success) {
                    stopTaskTimeLimitCheck();
                    closeTaskModal();
                    showSelfCheckPanel(response.taskProgressId, taskToSubmit.taskId);
                } else {
                    showToast(response.message || '提交失敗', 'error');
                }
            })
            .catch(function(error) {
                btn.disabled = false;
                btn.textContent = '完成';

                APP_CONFIG.error('提交任務失敗', error);
                showToast('提交失敗：' + error.message, 'error');
            });
    };