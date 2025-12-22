/**
 * 初始化 TASK_SUBMISSIONS 表格結構
 * 只需執行一次
 */
function initializeTaskSubmissionsSheet() {
  const ss = getSpreadsheet();

  // 檢查是否已存在
  let sheet = ss.getSheetByName('作業提交記錄表');

  if (sheet) {
    Logger.log('⚠️ 表格已存在，是否要清空重建？');
    Logger.log('如果要重建，請先手動刪除舊表格，再執行此函數');
    return;
  }

  // 建立新表格
  sheet = ss.insertSheet('作業提交記錄表');
  Logger.log('✅ 建立新表格：作業提交記錄表');

  // 設定標題列（24 欄）
  const headers = [
    'submission_id',
    'task_progress_id',
    'user_email',
    'user_id',
    'user_name',
    'class_id',
    'class_name',
    'task_id',
    'task_name',
    'file_url',
    'file_name',
    'file_type',
    'file_size',
    'upload_time',
    'version',
    'is_latest',
    'submission_status',
    'review_status',
    'reviewer_email',
    'reviewer_name',
    'review_time',
    'review_score',
    'review_comment',
    'review_feedback_file'
  ];

  // 寫入標題列
  sheet.appendRow(headers);

  // 格式化標題列
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#4285f4');
  headerRange.setFontColor('#ffffff');
  headerRange.setHorizontalAlignment('center');

  // 凍結標題列
  sheet.setFrozenRows(1);

  // 設定欄位寬度
  sheet.setColumnWidth(1, 200);   // submission_id
  sheet.setColumnWidth(2, 200);   // task_progress_id
  sheet.setColumnWidth(3, 180);   // user_email
  sheet.setColumnWidth(4, 150);   // user_id
  sheet.setColumnWidth(5, 100);   // user_name
  sheet.setColumnWidth(6, 150);   // class_id
  sheet.setColumnWidth(7, 120);   // class_name
  sheet.setColumnWidth(8, 200);   // task_id
  sheet.setColumnWidth(9, 150);   // task_name
  sheet.setColumnWidth(10, 300);  // file_url
  sheet.setColumnWidth(11, 150);  // file_name
  sheet.setColumnWidth(12, 120);  // file_type
  sheet.setColumnWidth(13, 100);  // file_size
  sheet.setColumnWidth(14, 150);  // upload_time
  sheet.setColumnWidth(15, 80);   // version
  sheet.setColumnWidth(16, 80);   // is_latest
  sheet.setColumnWidth(17, 120);  // submission_status
  sheet.setColumnWidth(18, 120);  // review_status
  sheet.setColumnWidth(19, 180);  // reviewer_email
  sheet.setColumnWidth(20, 100);  // reviewer_name
  sheet.setColumnWidth(21, 150);  // review_time
  sheet.setColumnWidth(22, 80);   // review_score
  sheet.setColumnWidth(23, 300);  // review_comment
  sheet.setColumnWidth(24, 300);  // review_feedback_file

  Logger.log('✅ 欄位格式設定完成');
  Logger.log('✅ TASK_SUBMISSIONS 表格初始化完成！');
  Logger.log('表格名稱：作業提交記錄表');
  Logger.log('欄位數：' + headers.length);
}
