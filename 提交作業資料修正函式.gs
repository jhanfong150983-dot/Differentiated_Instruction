
// ==========================================
// 資料修復工具函數
// ==========================================

/**
 * 修復作業提交記錄表的 user_name 和 task_name
 * 
 * 使用方式：
 * 1. 在 Google Apps Script 編輯器中打開此檔案
 * 2. 選擇函數 fixSubmissionRecords
 * 3. 點擊「執行」按鈕
 * 4. 查看執行記錄確認修復結果
 */
function fixSubmissionRecords() {
  try {
    Logger.log('🔧 開始修復作業提交記錄表...');
    
    const ss = getSpreadsheet();
    const submissionsSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.TASK_SUBMISSIONS);
    const usersSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.USERS);
    const classMembersSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.CLASS_MEMBERS);
    const tasksSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.TASKS);
    
    if (!submissionsSheet) {
      Logger.log('❌ 找不到作業提交記錄表');
      return { success: false, message: '找不到作業提交記錄表' };
    }
    
    // 讀取所有資料
    const submissionsData = submissionsSheet.getDataRange().getValues();
    const usersData = usersSheet ? usersSheet.getDataRange().getValues() : [];
    const classMembersData = classMembersSheet ? classMembersSheet.getDataRange().getValues() : [];
    const tasksData = tasksSheet ? tasksSheet.getDataRange().getValues() : [];
    
    Logger.log('📊 作業提交記錄: ' + (submissionsData.length - 1) + ' 筆');
    Logger.log('📊 使用者資料: ' + (usersData.length - 1) + ' 筆');
    Logger.log('📊 學員資料: ' + (classMembersData.length - 1) + ' 筆');
    Logger.log('📊 任務資料: ' + (tasksData.length - 1) + ' 筆');
    
    let fixedUserNameCount = 0;
    let fixedTaskNameCount = 0;
    let errorCount = 0;
    
    // 從第2行開始（跳過表頭）
    for (let i = 1; i < submissionsData.length; i++) {
      const rowNumber = i + 1;
      const userId = submissionsData[i][3];
      const currentUserName = submissionsData[i][4];
      const userEmail = submissionsData[i][2];
      const taskId = submissionsData[i][7];
      const currentTaskName = submissionsData[i][8];
      
      try {
        // 1. 修復 user_name
        let newUserName = null;
        
        // 先從 CLASS_MEMBERS 查找格式化姓名
        for (let j = 1; j < classMembersData.length; j++) {
          if (classMembersData[j][4] === userEmail) {
            const seatNumber = classMembersData[j][2];
            const studentName = classMembersData[j][3];
            if (seatNumber && studentName) {
              const formattedSeat = String(seatNumber).padStart(2, '0');
              newUserName = formattedSeat + '_' + studentName;
              break;
            }
          }
        }
        
        // 如果 CLASS_MEMBERS 找不到，從 USERS 表查找
        if (!newUserName && userId) {
          for (let j = 1; j < usersData.length; j++) {
            if (usersData[j][0] === userId) {
              newUserName = usersData[j][3];
              break;
            }
          }
        }
        
        // 更新 user_name
        if (newUserName && newUserName !== currentUserName) {
          submissionsSheet.getRange(rowNumber, 5).setValue(newUserName);
          Logger.log('✅ 第' + rowNumber + '行: user_name 從 ' + currentUserName + ' 更新為 ' + newUserName);
          fixedUserNameCount++;
        }
        
        // 2. 修復 task_name
        let newTaskName = null;
        
        if (taskId) {
          for (let j = 1; j < tasksData.length; j++) {
            if (tasksData[j][0] === taskId) {
              newTaskName = tasksData[j][3];
              break;
            }
          }
        }
        
        // 更新 task_name
        if (newTaskName && newTaskName !== currentTaskName) {
          submissionsSheet.getRange(rowNumber, 9).setValue(newTaskName);
          Logger.log('✅ 第' + rowNumber + '行: task_name 從 ' + currentTaskName + ' 更新為 ' + newTaskName);
          fixedTaskNameCount++;
        }
        
      } catch (rowError) {
        Logger.log('❌ 第' + rowNumber + '行處理失敗: ' + rowError.message);
        errorCount++;
      }
      
      if (i % 50 === 0) {
        Logger.log('📈 進度: ' + i + '/' + (submissionsData.length - 1) + ' 筆');
      }
    }
    
    Logger.log('');
    Logger.log('✅ ========== 修復完成 ==========');
    Logger.log('📊 總共處理: ' + (submissionsData.length - 1) + ' 筆記錄');
    Logger.log('✅ 修復 user_name: ' + fixedUserNameCount + ' 筆');
    Logger.log('✅ 修復 task_name: ' + fixedTaskNameCount + ' 筆');
    Logger.log('❌ 處理失敗: ' + errorCount + ' 筆');
    Logger.log('================================');
    
    return {
      success: true,
      message: '修復完成: user_name ' + fixedUserNameCount + ' 筆, task_name ' + fixedTaskNameCount + ' 筆',
      statistics: {
        total: submissionsData.length - 1,
        fixedUserName: fixedUserNameCount,
        fixedTaskName: fixedTaskNameCount,
        errors: errorCount
      }
    };
    
  } catch (error) {
    Logger.log('❌ 修復失敗：' + error.message);
    Logger.log('錯誤堆疊：' + error.stack);
    return {
      success: false,
      message: '修復失敗：' + error.message
    };
  }
}

