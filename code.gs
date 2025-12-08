// ==========================================
// 設定區
// ==========================================

const SHEET_CONFIG = {
  // ⚠️ 重要：將這裡改成你的 Google Sheets ID
  SPREADSHEET_ID: '14SuT1RwetyXMNBU1SeEUA0wZxZXCt7tVM5I0RcVL1As',
  
  // 定義各個工作表的名稱
  SHEETS: {
    USERS: '使用者資料',
    LOGIN_HISTORY: '登入紀錄表',
    CLASSES: '班級資料',
    CLASS_MEMBERS: '學員資料',
    COURSES: '課程資料',
    TASKS: '任務資料',
    ASSIGNMENTS: '授課安排表',
    LEARNING_RECORDS: '學習資料表',
    TASK_PROGRESS: '任務進度表',
    DIFFICULTY_CHANGES: '難度變更記錄表',
    CLASS_SESSIONS: '課堂紀錄',
    TASK_CHECKLISTS: '檢核項目表',
    TASK_REFERENCE_ANSWERS: '正確答案示範表',
    TASK_QUESTIONS: '題庫表',
    SELF_CHECK_RECORDS: '自主檢查記錄表',
    TASK_ASSESSMENT_RECORDS: '評量記錄表',
  }

};

/**
 * 檢查教師是否有班級權限（主要教師或代課教師）
 */
function hasClassPermission(classRow, teacherEmail) {
  // 1. 基本防呆：如果沒傳入 email，直接回傳 false
  if (!teacherEmail) return false;

  // 2. 取得原始資料 (這裡定義了變數，解決 is not defined 問題)
  const mainTeacherRaw = classRow[2];
  const coTeachersRaw = classRow[6]; // 👈 關鍵！這裡必須先定義，下面才能 Log

  // 3. Debug 紀錄 (現在這樣寫就不會報錯了)
  // Logger.log('🔍 檢查權限: ' + teacherEmail);
  // Logger.log('   主授: ' + mainTeacherRaw);
  // Logger.log('   協同(原始): ' + coTeachersRaw);

  // 4. 資料標準化 (全部轉小寫 + 去除空白，解決比對不到的問題)
  const searchEmail = String(teacherEmail).trim().toLowerCase();
  const mainTeacher = String(mainTeacherRaw).trim().toLowerCase();
  
  // 5. 處理協同老師名單
  // 邏輯：有資料 -> 轉字串 -> 把逗號換成直線 -> 用直線切割 -> 每一項都轉小寫去空白
  const coTeachersList = coTeachersRaw 
    ? String(coTeachersRaw).replace(/,/g, '|').split('|').map(function(e) { return e.trim().toLowerCase(); }) 
    : [];

  // 6. 進行比對
  const isMain = mainTeacher === searchEmail;
  const isCo = coTeachersList.includes(searchEmail);

  return isMain || isCo;
}


// ==========================================
// 工具函數
// ==========================================

/**
 * 生成 JSON 回應物件
 */
function jsonResponse(success, message, data = null) {
  const response = {
    success: success,
    message: message
  };
  
  if (data) {
    Object.assign(response, data);
  }
  
  return response;
}

// ==========================================
// 主要入口點：處理 HTTP 請求
// ==========================================

/**
 * doGet - 處理 GET 請求
 * 用途：
 * 1. 顯示教師管理介面 (無參數時)
 * 2. 處理 JSONP 請求 (有參數時)
 */
function doGet(e) {
  try {
    const params = e.parameter;
    
    Logger.log('📥 收到 GET 請求：' + JSON.stringify(params));
    
    if (!params.action) {
      const testResponse = {
        status: 'ok',
        message: '分層教學平台 API 運作中',
        timestamp: new Date().toISOString()
      };
      
      if (params.callback) {
        return ContentService
          .createTextOutput(params.callback + '(' + JSON.stringify(testResponse) + ')')
          .setMimeType(ContentService.MimeType.JAVASCRIPT);
      }
      
      return ContentService
        .createTextOutput(JSON.stringify(testResponse))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    let response;

    switch(params.action) {
      
      case 'login':
        const userData = {
          google_id: params.google_id,
          email: params.email,
          name: params.name,
          picture: params.picture
        };
        response = handleLogin(userData, params.timestamp);
        break;

      case 'getTaskStateDetails':
        response = getTaskStateDetails(e.parameter);
        break;
      
      case 'getTaskQuestion':
        const questionData = getTaskQuestion(e.parameter); // 呼叫函式
        response = questionData;
        break;

      case 'getUserData':
        response = getUserData(params.user_id);
        break;

      case 'checkPermission':
        response = checkPermission(params.user_id, params.permission);
        break;
      
      case 'checkAndBindStudent':
        response = checkAndBindStudent(params.email, params.user_id);
        break;
      
      case 'createClass':
        response = createClass(params.className, params.teacherEmail);
        break;
      
      case 'getTeacherClasses':
        response = getTeacherClasses(params.teacherEmail);
        break;

      case 'getAllClassesInfo':
        response = getAllClassesInfo();
        break;
      
      case 'importStudents':
        const studentList = JSON.parse(params.studentList);
        response = importStudents(params.classId, studentList, params.teacherEmail);
        break;
      
      case 'getClassMembers':
        response = getClassMembers(params.classId, params.teacherEmail);
        break;

      case 'updateStudent':
        response = updateStudent(params.uuid, params.seat, params.name, params.email);
        break;

      case 'deleteStudent':
        response = deleteStudent(params.uuid, params.classId);
        break;

      case 'deleteClass':
        response = deleteClass(params.classId, params.teacherEmail);
        break;

      case 'createCourse':
        response = createCourse(params.name, params.description, params.teacherEmail);
        break;
        
      case 'getTeacherCourses':
        response = getTeacherCourses(params.teacherEmail);
        break;

      case 'updateCourse':
        response = updateCourse(params.courseId, params.name, params.description);
        break;

      case 'deleteCourse':
        response = deleteCourse(params.courseId);
        break;

      case 'getCourseDetails':
        response = getCourseDetails(params.courseId);
        break;
        
      case 'addTaskToCourse':
        const taskData = JSON.parse(params.taskData);
        response = addTaskToCourse(params.courseId, taskData);
        break;
        
      case 'updateTask':
        const updatedTaskData = JSON.parse(params.taskData);
        response = updateTask(params.taskId, updatedTaskData);
        break;
        
      case 'deleteTask':
        response = deleteTask(params.taskId, params.courseId);
        break;
        
      case 'reorderTasks':
        const taskOrder = JSON.parse(params.taskOrder);
        response = reorderTasks(params.courseId, taskOrder);
        break;
      
      case 'getClassTokens':
        response = getClassTokens({
          classId: params.classId,
          teacherEmail: params.teacherEmail
        });
        break;

      case 'adjustStudentTokens':
        response = adjustStudentTokens({
          teacherEmail: params.teacherEmail,
          studentId: params.studentId,
          amount: params.amount,
          reason: params.reason
        });
        break;

      case 'getClassAssignments':
        response = getClassAssignments(params.teacherEmail);
        break;

      case 'getTaskDetailsForEditor':
        response = getTaskDetailsForEditor({ taskId: params.taskId });
        break;

      case 'addOrUpdateTaskQuestion':
        response = addOrUpdateTaskQuestion({ taskId: params.taskId, question: params.question ? JSON.parse(params.question) : null });
        break;

      case 'deleteTaskQuestion':
        response = deleteTaskQuestion({ questionId: params.questionId });
        break;

      case 'assignCourseToClass':
        response = assignCourseToClass({
          classId: params.classId,
          courseId: params.courseId,
          teacherEmail: params.teacherEmail
        });
        break;

      case 'removeAssignment':
        response = removeAssignment({
          classId: params.classId,
          teacherEmail: params.teacherEmail
        });
        break;

      case 'getUserTokens':
        response = getUserTokens(params.userEmail);
        break;

      case 'getStudentDashboard':
        response = getStudentDashboard(params.userEmail, params.classId || null);
        break;

      case 'startLearning':
        response = startLearning({
          userEmail: params.userEmail,
          classId: params.classId,
          courseId: params.courseId
        });
        break;

      case 'getTaskProgress':
        response = getTaskProgress(params.recordId);
        break;

      case 'getStudentClassEntryData':
        response = getStudentClassEntryData({
          userEmail: params.userEmail,
          classId: params.classId,
          courseId: params.courseId
        });
        break;

      case 'startTask':
        response = startTask({
          userEmail: params.userEmail,
          taskId: params.taskId,
          classId: e.parameter.classId
        });
        break;

      case 'submitTask':
        response = submitTask({
          userEmail: params.userEmail,
          taskId: params.taskId,
          classId: e.parameter.classId
        });
        break;

      case 'approveTask':
        response = approveTask({
          teacherEmail: params.teacherEmail,
          taskProgressId: params.taskProgressId
        });
        break;

      case 'rejectTask':
        response = rejectTask({
          teacherEmail: params.teacherEmail,
          taskProgressId: params.taskProgressId,
          reason: params.reason
        });
        break;

      case 'getTeacherPendingTasks':
        response = getTeacherPendingTasks(params.teacherEmail);
        break;

      case 'getTeacherTaskMonitor':
        response = getTeacherTaskMonitor({
          teacherEmail: params.teacherEmail,
          classId: params.classId || null
        });
        break;

      case 'getStudentClasses':
        response = getStudentClasses(params.userEmail);
        break;

      case 'getCourseTiers':
        response = getCourseTiers(params.courseId);
        break;

      case 'startClassSession':
        response = startClassSession({
          teacherEmail: params.teacherEmail,
          classId: params.classId
        });
        break;

      case 'endClassSession':
        response = endClassSession({
          teacherEmail: params.teacherEmail,
          sessionId: params.sessionId
        });
        break;

      case 'getCurrentSession':
        response = getCurrentSession({
          classId: params.classId,
          userEmail: params.userEmail
        });
        break;

      case 'recordDifficultyChange':
        response = recordDifficultyChange({
          userEmail: params.userEmail,
          recordId: params.recordId,
          courseId: params.courseId,
          fromTier: params.fromTier,
          toTier: params.toTier,
          changeReason: params.changeReason,
          triggeredByTask: params.triggeredByTask,
          executionTime: params.executionTime
        });
        break;

      case 'getDifficultyChangeHistory':
        response = getDifficultyChangeHistory({
          recordId: params.recordId
        });
        break;

      case 'getTaskChecklistsAndAnswer':
        response = getTaskChecklistsAndAnswer({
          taskId: params.taskId,
          userEmail: params.userEmail
        });
        break;

      case 'submitSelfCheck':
        response = submitSelfCheck({
          taskProgressId: params.taskProgressId,
          checklistData: JSON.parse(params.checklistData || '[]'),
          scenarioType: params.scenarioType,
          errorExplanation: params.errorExplanation,
          userEmail: params.userEmail
        });
        break;

      case 'getTaskQuestion':
        response = getTaskQuestion({
          taskId: params.taskId
        });
        break;

      case 'submitAssessment':
        response = submitAssessment({
          taskProgressId: params.taskProgressId,
          questionId: params.questionId,
          studentAnswer: params.studentAnswer,
          userEmail: params.userEmail
        });
        break;

      case 'updateCoTeachers':
        response = updateCoTeachers(params.classId, params.coTeachers, params.teacherEmail);
        break;

      default:
        response = {
          success: false,
          message: '未知的操作類型: ' + params.action
        };
    }
    
    if (params.callback) {
      return ContentService
        .createTextOutput(params.callback + '(' + JSON.stringify(response) + ')')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    
    return ContentService
      .createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log('❌ 錯誤：'  + error.toString());
    
    const errorResponse = {
      success: false,
      message: '伺服器錯誤：' + error.toString()
    };
    
    if (e.parameter && e.parameter.callback) {
      return ContentService
        .createTextOutput(e.parameter.callback + '(' + JSON.stringify(errorResponse) + ')')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    
    return ContentService
      .createTextOutput(JSON.stringify(errorResponse))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * doPost - 處理 POST 請求
 * 用途: 處理登入系統、圖片上傳等請求
 */
function doPost(e) {
  // 1. 加上互斥鎖 (防止同時上傳導致衝突)
  const lock = LockService.getScriptLock();
  // 等待最多 30 秒，如果拿不到鎖就報錯
  if (!lock.tryLock(30000)) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: '系統忙碌中，請稍後再試'
    })).setMimeType(ContentService.MimeType.JSON);
  }

  try {
    // 2. 檢查資料是否存在
    if (!e || !e.postData) {
      return ContentService.createTextOutput(JSON.stringify({ 
        success: false, 
        message: 'No postData received' 
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 3. 解析資料
    const requestData = JSON.parse(e.postData.contents);
    Logger.log('📥 收到 POST 請求:' + requestData.action);
    
    let response = {};
    
    // 4. 路由處理
    switch(requestData.action) {
      case 'login':
        response = handleLogin(requestData.user_data, requestData.timestamp);
        break;
        
      case 'getUserData':
        response = getUserData(requestData.user_id);
        break;
        
      case 'checkPermission':
        response = checkPermission(requestData.user_id, requestData.permission);
        break;

      case 'uploadReferenceImage':
        // ✅ 修正：直接傳遞參數物件
        response = uploadImageToDrive({
          fileName: requestData.fileName,
          fileData: requestData.fileData,
          fileMime: requestData.fileMime
        });
        break;

      case 'saveTaskChecklist':
        response = saveTaskChecklist(requestData);
        break;

      case 'saveTaskReferenceAnswer':
        response = saveTaskReferenceAnswer(requestData);
        break;

      case 'saveTaskQuestions':
        response = saveTaskQuestions(requestData);
        break;
        
      default:
        response = {
          success: false,
          message: '未知的操作類型: ' + requestData.action
        };
    }
    
    // 5. 回傳結果
    return ContentService
      .createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log('❌ 錯誤:' + error.toString());
    
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        message: 'Server Error: ' + error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } finally {
    // 6. 釋放鎖定
    lock.releaseLock();
  }
}

// ==========================================
// Helper Functions - 通用輔助函數
// ==========================================
/**
 * 取得成員座號
 */
function getMemberSeat(classId, userId) {
  const ss = SpreadsheetApp.openById(SHEET_CONFIG.SPREADSHEET_ID);
  const membersSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.CLASS_MEMBERS);
  const data = membersSheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === classId && data[i][5] === userId) {  // user_id ?函洵6甈?
      return data[i][2];
    }
  }
  return '';
}

/**
 * 取得使用者角色
 */
function getUserRole(email) {
  const ss = SpreadsheetApp.openById(SHEET_CONFIG.SPREADSHEET_ID);
  const usersSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.USERS);
  const data = usersSheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][2] === email) {
      return data[i][4];
    }
  }
  return null;
}


/**
 * 取得 Spreadsheet 物件
 */
function getSpreadsheet() {
  try {
    return SpreadsheetApp.openById(SHEET_CONFIG.SPREADSHEET_ID);
  } catch (e) {
    throw new Error('無法開啟 Spreadsheet：' + e.message);
  }
}

/**
 * 生成唯一 UUID
 */
function generateUUID() {
  return Utilities.getUuid();
}

/**
 * 取得當前使用者 Email
 * 優先使用參數傳入的 email，如果沒有才用 Session
 * 
 * @param {string} emailParam - 從前端傳入的 email（選用）
 * @returns {string} 使用者 Email
 */
function getCurrentUserEmail(emailParam) {
  // 優先使用參數傳入的 email
  if (emailParam && emailParam.trim() !== '') {
    Logger.log('✅ 使用參數傳入的 Email:', emailParam);
    return emailParam.trim();
  }
  
  // 如果沒有參數，嘗試從 Session 取得（Apps Script Web App 環境）
  try {
    const email = Session.getActiveUser().getEmail();
    if (email && email.trim() !== '') {
      Logger.log('✅ 使用 Session Email:', email);
      return email;
    }
  } catch (e) {
    Logger.log('⚠️ 無法從 Session 取得 Email:', e.toString());
  }
  
  // 都失敗就拋出錯誤
  throw new Error('無法取得使用者 Email，請確認已登入');
}

/**
 * 格式化時間戳記
 */
function formatTimestamp(isoTimestamp) {
  if (!isoTimestamp) return '';
  
  try {
    const date = new Date(isoTimestamp);
    const taipeiTime = new Date(date.getTime() + (8 * 60 * 60 * 1000));
    
    const year = taipeiTime.getUTCFullYear();
    const month = String(taipeiTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(taipeiTime.getUTCDate()).padStart(2, '0');
    const hours = String(taipeiTime.getUTCHours()).padStart(2, '0');
    const minutes = String(taipeiTime.getUTCMinutes()).padStart(2, '0');
    const seconds = String(taipeiTime.getUTCSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    
  } catch (error) {
    Logger.log('❌ 時間格式化失敗:', error);
    return isoTimestamp;
  }
}

// ==========================================
// A. 登入系統功能
// ==========================================

/**
 * 處理使用者登入
 */
function handleLogin(userData, timestamp) {
  // 🔒 加入鎖機制，防止並發時產生重複的 user_id
  const lock = LockService.getScriptLock();

  try {
    // 等待鎖（最多等待 30 秒）
    lock.waitLock(30000);

    const ss = getSpreadsheet();
    const usersSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.USERS);

    if (!usersSheet) {
      throw new Error('找不到使用者資料表');
    }

    const usersData = usersSheet.getDataRange().getValues();
    const headers = usersData[0];
    
    // 找出欄位索引
    const googleIdCol = headers.indexOf('google_id');
    const userIdCol = headers.indexOf('user_id');
    const emailCol = headers.indexOf('email');
    const nameCol = headers.indexOf('name');
    const roleCol = headers.indexOf('role');
    const lastLoginCol = headers.indexOf('last_login');
    
    // 檢查使用者是否已存在
    let existingUserRow = -1;
    let existingUserId = null;
    
    for (let i = 1; i < usersData.length; i++) {
      if (usersData[i][googleIdCol] === userData.google_id) {
        existingUserRow = i + 1;
        existingUserId = usersData[i][userIdCol];
        break;
      }
    }
    
    let userId;
    let role;
    
    if (existingUserRow > 0) {
      // 使用者已存在 - 更新登入時間
      Logger.log('✅ 使用者已存在，更新登入時間');
      
      userId = existingUserId;
      role = usersData[existingUserRow - 1][roleCol];
      
      usersSheet.getRange(existingUserRow, lastLoginCol + 1).setValue(formatTimestamp(timestamp));
      usersSheet.getRange(existingUserRow, emailCol + 1).setValue(userData.email);
      usersSheet.getRange(existingUserRow, nameCol + 1).setValue(userData.name);
      
    } else {
      // 新使用者 - 建立帳號
      Logger.log('🆕 新使用者，建立帳號');

      // 使用改良的 generateUserId，防止並發時 ID 重複
      userId = generateUserId(usersSheet);
      role = 'student';

      usersSheet.appendRow([
        userId,
        userData.google_id,
        userData.email,
        userData.name,
        role,
        formatTimestamp(timestamp),
        formatTimestamp(timestamp),
        'active'
      ]);
    }
    
    // 記錄登入歷史
    recordLoginHistory(userId, timestamp);
    
    return {
      success: true,
      message: '登入成功',
      user_id: userId,
      role: role,
      email: userData.email,
      name: userData.name
    };

  } catch (error) {
    Logger.log('❌ 登入處理失敗：' + error.toString());
    return {
      success: false,
      message: '登入處理失敗：' + error.toString()
    };
  } finally {
    // 🔓 釋放鎖
    lock.releaseLock();
  }
}

/**
 * 取得使用者資料
 */
function getUserData(userId) {
  try {
    const ss = getSpreadsheet();
    const usersSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.USERS);
    const usersData = usersSheet.getDataRange().getValues();
    const headers = usersData[0];
    
    for (let i = 1; i < usersData.length; i++) {
      if (usersData[i][0] === userId) {
        const userData = {};
        headers.forEach((header, index) => {
          userData[header] = usersData[i][index];
        });
        
        return {
          success: true,
          data: userData
        };
      }
    }
    
    return {
      success: false,
      message: '找不到使用者'
    };
    
  } catch (error) {
    return {
      success: false,
      message: '取得使用者資料失敗：' + error.toString()
    };
  }
}

/**
 * 檢查使用者權限
 */
function checkPermission(userId, permissionName) {
  try {
    const ss = getSpreadsheet();
    const usersSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.USERS);
    const usersData = usersSheet.getDataRange().getValues();
    
    let userRole = null;
    for (let i = 1; i < usersData.length; i++) {
      if (usersData[i][0] === userId) {
        userRole = usersData[i][4];
        break;
      }
    }
    
    if (!userRole) {
      return {
        success: false,
        message: '找不到使用者'
      };
    }
    
    const rolesSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.ROLES);
    const rolesData = rolesSheet.getDataRange().getValues();
    const roleHeaders = rolesData[0];
    
    const roleCol = roleHeaders.indexOf('role');
    const permissionCol = roleHeaders.indexOf('permission_name');
    const canViewCol = roleHeaders.indexOf('can_view');
    const canEditCol = roleHeaders.indexOf('can_edit');
    const canDeleteCol = roleHeaders.indexOf('can_delete');
    const canCreateCol = roleHeaders.indexOf('can_create');
    
    for (let i = 1; i < rolesData.length; i++) {
      if (rolesData[i][roleCol] === userRole && 
          rolesData[i][permissionCol] === permissionName) {
        
        return {
          success: true,
          permissions: {
            can_view: rolesData[i][canViewCol],
            can_edit: rolesData[i][canEditCol],
            can_delete: rolesData[i][canDeleteCol],
            can_create: rolesData[i][canCreateCol]
          }
        };
      }
    }
    
    return {
      success: false,
      message: '找不到權限設定'
    };
    
  } catch (error) {
    return {
      success: false,
      message: '權限檢查失敗：' + error.toString()
    };
  }
}

/**
 * 產生使用者 ID
 */
function generateUserId(usersSheet) {
  const usersData = usersSheet.getDataRange().getValues();
  let maxNumber = 0;

  // 掃描所有現有的 user_id，找出最大編號
  for (let i = 1; i < usersData.length; i++) {
    const userId = usersData[i][0]; // user_id 在第1欄
    if (userId && typeof userId === 'string' && userId.startsWith('USER')) {
      const numberPart = userId.substring(4); // 取得 'USER' 後面的數字部分
      const number = parseInt(numberPart, 10);
      if (!isNaN(number) && number > maxNumber) {
        maxNumber = number;
      }
    }
  }

  // 生成新的 ID（最大編號 + 1）
  const newNumber = maxNumber + 1;
  const paddedNumber = String(newNumber).padStart(3, '0');
  const newUserId = 'USER' + paddedNumber;

  // 再次檢查是否重複（雙重保險）
  for (let i = 1; i < usersData.length; i++) {
    if (usersData[i][0] === newUserId) {
      // 如果仍然重複，改用 UUID
      Logger.log('⚠️ 檢測到 ID 衝突，改用 UUID');
      return 'USER_' + Utilities.getUuid();
    }
  }

  return newUserId;
}

/**
 * 記錄登入歷史
 */
function recordLoginHistory(userId, timestamp) {
  try {
    const ss = getSpreadsheet();
    const loginSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.LOGIN_HISTORY);
    
    const loginData = loginSheet.getDataRange().getValues();
    const logId = 'L' + String(loginData.length).padStart(3, '0');
    
    loginSheet.appendRow([
      logId,
      userId,
      formatTimestamp(timestamp),
      'web',
      'success'
    ]);
    
    Logger.log('✅ 已記錄登入歷史');
    
  } catch (error) {
    Logger.log('❌ 記錄登入歷史失敗：' + error.toString());
  }
}

/**
 * 檢查並自動綁定學生
 * 用途：學生首次登入時，自動檢查是否在任何班級的學員資料中
 * @param {string} email - 學生 Email
 * @param {string} user_id - 使用者 ID
 * @returns {Object} 綁定結果
 */
function checkAndBindStudent(email, user_id) {
  try {
    if (!email || !user_id) {
      return {
        success: false,
        message: '缺少必要參數',
        permission: 'none'
      };
    }
    
    const ss = getSpreadsheet();
    const membersSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.CLASS_MEMBERS);
    
    if (!membersSheet) {
      return {
        success: false,
        message: '找不到學員資料表',
        permission: 'none'
      };
    }
    
    const membersData = membersSheet.getDataRange().getValues();
    const headers = membersData[0];
    
    // 找出欄位索引
    const emailCol = headers.indexOf('student_email');
    const userIdCol = headers.indexOf('user_id');
    const classIdCol = headers.indexOf('class_id');
    
    Logger.log('📧 正在檢查學生 Email: ' + email);
    Logger.log('列名：' + JSON.stringify(headers));
    
    // 搜尋學生記錄
    let foundRecords = [];
    
    for (let i = 1; i < membersData.length; i++) {
      const rowEmail = membersData[i][emailCol];
      const rowUserId = membersData[i][userIdCol];
      const rowClassId = membersData[i][classIdCol];
      
      // 比較 Email（不區分大小寫）
      if (rowEmail && rowEmail.toLowerCase() === email.toLowerCase()) {
        foundRecords.push({
          row: i + 1,
          classId: rowClassId,
          currentUserId: rowUserId
        });
      }
    }
    
    Logger.log('找到的記錄數：' + foundRecords.length);
    
    if (foundRecords.length === 0) {
      // 未找到任何班級記錄
      return {
        success: false,
        message: '您未被任何班級錄取，請聯絡教師',
        permission: 'none',
        found_classes: 0
      };
    }
    
    // 找到學生記錄，自動綁定
    Logger.log('✅ 找到 ' + foundRecords.length + ' 個班級記錄，開始綁定...');
    
    // 更新所有找到的記錄，將 user_id 寫入
    let bindCount = 0;
    let classIds = [];
    
    for (let record of foundRecords) {
      // 只有在 user_id 未被填入時才更新
      if (!record.currentUserId || record.currentUserId === '') {
        membersSheet.getRange(record.row, userIdCol + 1).setValue(user_id);
        bindCount++;
        classIds.push(record.classId);
        Logger.log('✅ 已綁定班級 ' + record.classId);
      } else {
        // 已經有 user_id，不需要更新
        classIds.push(record.classId);
        Logger.log('⚠️ 班級 ' + record.classId + ' 已有 user_id: ' + record.currentUserId);
      }
    }
    
    return {
      success: true,
      message: '成功綁定 ' + bindCount + ' 個班級',
      permission: 'student',
      found_classes: foundRecords.length,
      bound_classes: bindCount,
      class_ids: classIds
    };
    
  } catch (error) {
    Logger.log('❌ 綁定失敗：' + error.toString());
    return {
      success: false,
      message: '綁定失敗：' + error.toString(),
      permission: 'none'
    };
  }
}

// ==========================================
// B. 班級管理系統功能
// ==========================================

/**
 * 建立新班級
 * @param {string} className - 班級名稱
 * @param {string} teacherEmail - 教師 Email（從前端傳入）
 */
function createClass(className, teacherEmail) {
  try {
    if (!className || className.trim() === '') {
      throw new Error('班級名稱不可為空');
    }

    // ✅ 使用參數傳入的 teacherEmail
    const email = getCurrentUserEmail(teacherEmail);

    const ss = getSpreadsheet();
    const classesSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.CLASSES);

    if (!classesSheet) {
      throw new Error('找不到 Classes 分頁');
    }

    // ✅ 檢查該教師是否已有同名班級
    const classData = classesSheet.getDataRange().getValues();
    const trimmedName = className.trim();

    for (let i = 1; i < classData.length; i++) {
      if (classData[i][2] === email && classData[i][1] === trimmedName) {
        throw new Error(`班級名稱「${trimmedName}」已存在，請使用不同的名稱`);
      }
    }

    const classId = generateUUID();
    const createDate = new Date();
    const newRow = [
      classId,
      trimmedName,
      email,  // 使用取得的 email
      createDate
    ];

    classesSheet.appendRow(newRow);
    
    Logger.log('✅ 班級建立成功:', { classId, className, teacherEmail: email });
    
    return {
      success: true,
      message: '班級建立成功！',
      classId: classId,
      className: className
    };
    
  } catch (e) {
    Logger.log('❌ 建立班級失敗:', e.toString());
    return {
      success: false,
      message: '建立班級失敗：' + e.message
    };
  }
}

/**
 * 批次匯入學生
 * @param {string} classId - 班級 ID
 * @param {Array} studentList - 學生列表
 * @param {string} teacherEmail - 教師 Email（從前端傳入）
 */
function importStudents(classId, studentList, teacherEmail) {
  const lock = LockService.getScriptLock();
  
  try {
    lock.waitLock(30000);
    
    if (!classId) {
      throw new Error('班級 ID 不可為空');
    }
    
    if (!Array.isArray(studentList) || studentList.length === 0) {
      throw new Error('學生名單格式錯誤或為空');
    }
    
    // ✅ 使用參數傳入的 teacherEmail
    const email = getCurrentUserEmail(teacherEmail);
    
    // 驗證班級權限
    const ss = getSpreadsheet();
    const classesSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.CLASSES);
    const classData = classesSheet.getDataRange().getValues();
    
    let classExists = false;
    for (let i = 1; i < classData.length; i++) {
      if (classData[i][0] === classId && classData[i][2] === email) {
        classExists = true;
        break;
      }
    }
    
    if (!classExists) {
      throw new Error('班級不存在或您沒有權限');
    }
    
    const membersSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.CLASS_MEMBERS);
    
    if (!membersSheet) {
      throw new Error('找不到 Class_Members 分頁');
    }
    
    const rowsToAdd = [];
    
    for (let i = 0; i < studentList.length; i++) {
      const student = studentList[i];
      
      if (!student.seat || !student.name) {
        throw new Error(`第 ${i + 1} 筆資料格式錯誤：缺少座號或姓名`);
      }
      
      const uuid = generateUUID();
      const newRow = [
        uuid,
        classId,
        student.seat,
        student.name.trim(),
        student.email || '',
        ''
      ];
      
      rowsToAdd.push(newRow);
    }
    
    if (rowsToAdd.length > 0) {
      const startRow = membersSheet.getLastRow() + 1;
      membersSheet.getRange(startRow, 1, rowsToAdd.length, rowsToAdd[0].length)
        .setValues(rowsToAdd);
    }
    
    Logger.log('✅ 匯入學生成功:', rowsToAdd.length);
    
    return {
      success: true,
      message: `成功匯入 ${rowsToAdd.length} 位學生！`,
      count: rowsToAdd.length
    };
    
  } catch (e) {
    Logger.log('❌ 匯入學生失敗:', e.toString());
    return {
      success: false,
      message: '匯入學生失敗：' + e.message
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * 取得教師的所有班級
 * @param {string} teacherEmail - 教師 Email（從前端傳入）
 */
function getTeacherClasses(teacherEmail) {
  try {
    // ✅ 使用參數傳入的 teacherEmail
    const email = getCurrentUserEmail(teacherEmail);
    
    const ss = getSpreadsheet();
    const classesSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.CLASSES);
    
    if (!classesSheet) {
      return {
        success: true,
        classes: [],
        message: '尚未建立任何班級'
      };
    }
    
    const data = classesSheet.getDataRange().getValues();
    const classes = [];
    
    if (data.length <= 1) {
      return {
        success: true,
        classes: [],
        message: '尚未建立任何班級'
      };
    }
    
    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        
        if (hasClassPermission(row, email)) {
            const isMainTeacher = row[2] === email;
            const coTeachers = row[6] ? String(row[6]).split('|') : [];
            
            classes.push({
                classId: row[0],
                className: row[1],
                teacherEmail: row[2],
                createDate: row[3],
                isCoTeacher: !isMainTeacher,  // 👈 新增標記
                coTeachers: coTeachers.join(', ')  // 👈 顯示所有代課教師
            });
        }
    }
    
    classes.sort((a, b) => new Date(b.createDate) - new Date(a.createDate));
    
    Logger.log('✅ 找到班級數量:', classes.length);
    
    return {
      success: true,
      classes: classes,
      message: classes.length === 0 ? '尚未建立任何班級' : `找到 ${classes.length} 個班級`
    };
    
  } catch (e) {
    Logger.log('❌ 取得班級列表失敗：' + e.toString());
    
    return {
      success: false,
      message: '取得班級列表失敗：' + e.message,
      classes: []
    };
  }
}

/**
 * 取得班級成員
 * @param {string} classId - 班級 ID
 * @param {string} teacherEmail - 教師 Email（從前端傳入）
 */
function getClassMembers(classId, teacherEmail) {
  try {
    if (!classId) {
      throw new Error('班級 ID 不可為空');
    }
    
    // ✅ 使用參數傳入的 teacherEmail
    const email = getCurrentUserEmail(teacherEmail);
    
    const ss = getSpreadsheet();
    const classesSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.CLASSES);
    const classData = classesSheet.getDataRange().getValues();
    
    let hasPermission = false;
    for (let i = 1; i < classData.length; i++) {
      if (classData[i][0] === classId && hasClassPermission(classData[i], email)) {
        hasPermission = true;
        break;
      }
    }
    
    if (!hasPermission) {
      throw new Error('您沒有權限查看此班級');
    }
    
    const membersSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.CLASS_MEMBERS);
    
    if (!membersSheet) {
      throw new Error('找不到 Class_Members 分頁');
    }
    
    const data = membersSheet.getDataRange().getValues();
    const members = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      
      if (row[1] === classId) {
        members.push({
          uuid: row[0],
          classId: row[1],
          seat: row[2],
          name: row[3],
          email: row[4],
          userId: row[5]
        });
      }
    }
    
    members.sort((a, b) => parseInt(a.seat) - parseInt(b.seat));
    
    Logger.log('✅ 找到成員數量:', members.length);
    
    return {
      success: true,
      members: members,
      count: members.length
    };
    
  } catch (e) {
    Logger.log('❌ 取得班級成員失敗:', e.toString());
    return {
      success: false,
      message: '取得班級成員失敗：' + e.message,
      members: []
    };
  }
}

/**
 * 更新學生資料
 */
function updateStudent(uuid, seat, name, email) {
  try {
    const ss = getSpreadsheet();
    const membersSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.CLASS_MEMBERS);
    
    if (!membersSheet) {
      throw new Error('找不到 Class_Members 分頁');
    }
    
    const data = membersSheet.getDataRange().getValues();
    
    // 找到學生
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === uuid) {
        // 更新資料
        membersSheet.getRange(i + 1, 3).setValue(seat);  // 座號
        membersSheet.getRange(i + 1, 4).setValue(name);  // 姓名
        membersSheet.getRange(i + 1, 5).setValue(email); // Email
        
        Logger.log('✅ 更新學生成功:', { uuid, name });
        
        return {
          success: true,
          message: '更新成功'
        };
      }
    }
    
    throw new Error('找不到該學生');
    
  } catch (e) {
    Logger.log('❌ 更新學生失敗:', e.toString());
    return {
      success: false,
      message: '更新失敗：' + e.message
    };
  }
}

/**
 * 刪除學生
 */
function deleteStudent(uuid, classId) {
  try {
    const ss = getSpreadsheet();
    const membersSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.CLASS_MEMBERS);
    
    if (!membersSheet) {
      throw new Error('找不到 Class_Members 分頁');
    }
    
    const data = membersSheet.getDataRange().getValues();
    
    // 找到學生並刪除
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === uuid) {
        membersSheet.deleteRow(i + 1);
        
        Logger.log('✅ 刪除學生成功:', { uuid });
        
        return {
          success: true,
          message: '刪除成功'
        };
      }
    }
    
    throw new Error('找不到該學生');
    
  } catch (e) {
    Logger.log('❌ 刪除學生失敗:', e.toString());
    return {
      success: false,
      message: '刪除失敗：' + e.message
    };
  }
}

/**
 * 刪除班級（含保護檢查）
 * @param {string} classId - 班級 ID
 * @param {string} teacherEmail - 教師 Email
 */
function deleteClass(classId, teacherEmail) {
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(30000);

    if (!classId) {
      throw new Error('班級 ID 不可為空');
    }

    // ✅ 使用參數傳入的 teacherEmail
    const email = getCurrentUserEmail(teacherEmail);

    const ss = getSpreadsheet();
    const classesSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.CLASSES);
    const membersSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.CLASS_MEMBERS);
    const assignmentsSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.ASSIGNMENTS);
    const learningSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.LEARNING_RECORDS);

    if (!classesSheet) {
      throw new Error('找不到 Classes 分頁');
    }

    // 驗證班級權限
    const classData = classesSheet.getDataRange().getValues();
    let classExists = false;
    let className = '';
    let classRow = -1;

    for (let i = 1; i < classData.length; i++) {
      if (classData[i][0] === classId) {
        if (!hasClassPermission(classData[i], email)) {
          throw new Error('您沒有權限刪除此班級');
        }
        classExists = true;
        className = classData[i][1];
        classRow = i + 1;
        break;
      }
    }

    if (!classExists) {
      throw new Error('找不到該班級');
    }

    // ✅ 檢查1: 是否有 active 的授課安排
    if (assignmentsSheet) {
      const assignData = assignmentsSheet.getDataRange().getValues();
      const coursesSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.COURSES);
      const activeCourses = [];

      for (let i = 1; i < assignData.length; i++) {
        if (assignData[i][1] === classId && assignData[i][5] === 'active') {
          // 找出課程名稱
          if (coursesSheet) {
            const courseData = coursesSheet.getDataRange().getValues();
            for (let j = 1; j < courseData.length; j++) {
              if (courseData[j][0] === assignData[i][2]) {
                activeCourses.push(courseData[j][1]);
                break;
              }
            }
          }
        }
      }

      if (activeCourses.length > 0) {
        throw new Error(`班級「${className}」正在學習 ${activeCourses.length} 個課程（${activeCourses.join('、')}），請先取消授課安排後再刪除`);
      }
    }

    // ✅ 檢查2: 是否有學習記錄
    if (learningSheet) {
      const learningData = learningSheet.getDataRange().getValues();
      let recordCount = 0;

      for (let i = 1; i < learningData.length; i++) {
        if (learningData[i][2] === classId) {
          recordCount++;
        }
      }

      if (recordCount > 0) {
        throw new Error(`班級「${className}」已有 ${recordCount} 筆學習記錄，無法刪除（為保護學習資料）`);
      }
    }

    // ✅ 檢查3: 是否還有學生
    if (membersSheet) {
      const memberData = membersSheet.getDataRange().getValues();
      let studentCount = 0;

      for (let i = 1; i < memberData.length; i++) {
        if (memberData[i][1] === classId) {
          studentCount++;
        }
      }

      if (studentCount > 0) {
        throw new Error(`班級「${className}」還有 ${studentCount} 位學生，請先移除所有學生後再刪除班級`);
      }
    }

    // 所有檢查通過，執行刪除
    // 1. 刪除班級本身
    classesSheet.deleteRow(classRow);

    // 2. 將所有相關授課安排設為 inactive（雖然上面已檢查沒有 active，但可能有 inactive 記錄）
    if (assignmentsSheet) {
      const assignData = assignmentsSheet.getDataRange().getValues();
      for (let i = 1; i < assignData.length; i++) {
        if (assignData[i][1] === classId && assignData[i][5] === 'active') {
          assignmentsSheet.getRange(i + 1, 6).setValue('inactive');
        }
      }
    }

    Logger.log(`✅ 刪除班級成功: ${className} (${classId})`);

    return {
      success: true,
      message: `班級「${className}」刪除成功`
    };

  } catch (e) {
    Logger.log('❌ 刪除班級失敗:', e.toString());
    return {
      success: false,
      message: '刪除班級失敗：' + e.message
    };
  } finally {
    lock.releaseLock();
  }
}

// ==========================================
// 課程管理函數
// ==========================================

/**
 * 建立新課程
 * @param {string} name - 課程名稱
 * @param {string} description - 課程說明
 * @param {string} teacherEmail - 教師 Email
 */
function createCourse(name, description, teacherEmail) {
  try {
    if (!name || name.trim() === '') {
      throw new Error('課程名稱不可為空');
    }
    
    const email = getCurrentUserEmail(teacherEmail);
    const courseId = generateUUID();
    
    const ss = getSpreadsheet();
    const coursesSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.COURSES);
    
    if (!coursesSheet) {
      throw new Error('找不到 Courses 分頁');
    }
    
    const createDate = new Date();
    const newRow = [
      courseId,
      name.trim(),
      email,
      description || '',
      createDate
    ];
    
    coursesSheet.appendRow(newRow);
    
    Logger.log('✅ 課程建立成功:', { courseId, name, teacherEmail: email });
    
    return {
      success: true,
      message: '課程建立成功！',
      courseId: courseId,
      courseName: name
    };
    
  } catch (e) {
    Logger.log('❌ 建立課程失敗:', e.toString());
    return {
      success: false,
      message: '建立課程失敗：' + e.message
    };
  }
}


/**
 * 取得教師的所有課程
 * @param {string} teacherEmail - 教師 Email
 */
function getTeacherCourses(teacherEmail) {
  try {
    const email = getCurrentUserEmail(teacherEmail);
    
    const ss = getSpreadsheet();
    const coursesSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.COURSES);
    
    if (!coursesSheet) {
      return {
        success: true,
        courses: [],
        message: '尚未建立任何課程'
      };
    }
    
    const data = coursesSheet.getDataRange().getValues();
    const courses = [];
    const courseIdSet = new Set(); // 防止重複

    if (data.length <= 1) {
      return {
        success: true,
        courses: [],
        message: '尚未建立任何課程'
      };
    }

    // 第一步：收集自己創建的課程（原有邏輯）
    for (let i = 1; i < data.length; i++) {
      const row = data[i];

      if (row[2] && row[2] === email) {
        const courseId = row[0];
        courseIdSet.add(courseId);
        courses.push({
          courseId: courseId,
          courseName: row[1],
          teacherEmail: row[2],
          description: row[3],
          createDate: row[4],
          isOwner: true  // 新增標記：自己的課程
        });
      }
    }

    // 第二步：收集可訪問班級的已指派課程（新增邏輯）
    const classesSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.CLASSES);
    const assignmentsSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.ASSIGNMENTS);

    if (classesSheet && assignmentsSheet) {
      const classData = classesSheet.getDataRange().getValues();
      const assignData = assignmentsSheet.getDataRange().getValues();

      // 找出所有有權限訪問的班級
      const accessibleClassIds = [];
      for (let i = 1; i < classData.length; i++) {
        if (hasClassPermission(classData[i], email)) {
          accessibleClassIds.push(classData[i][0]);
        }
      }

      // 找出這些班級的 active 授課安排
      const assignedCourseIds = new Set();
      for (let i = 1; i < assignData.length; i++) {
        const classId = assignData[i][1];
        const courseId = assignData[i][2];
        const status = assignData[i][5];

        if (accessibleClassIds.includes(classId) &&
            status === 'active' &&
            !courseIdSet.has(courseId)) {  // 避免重複
          assignedCourseIds.add(courseId);
        }
      }

      // 將這些課程加入列表
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const courseId = row[0];

        if (assignedCourseIds.has(courseId)) {
          courses.push({
            courseId: courseId,
            courseName: row[1],
            teacherEmail: row[2],
            description: row[3],
            createDate: row[4],
            isOwner: false,  // 新增標記：共享的課程
            sharedBy: row[2]  // 新增：原始創建者
          });
        }
      }
    }

    // 按建立日期排序（最新的在前）
    courses.sort((a, b) => new Date(b.createDate) - new Date(a.createDate));

    Logger.log('✅ 找到課程數量:', courses.length,
               '(自己的:', courses.filter(function(c) { return c.isOwner; }).length,
               ', 共享的:', courses.filter(function(c) { return !c.isOwner; }).length + ')');
    
    return {
      success: true,
      courses: courses,
      message: courses.length === 0 ? '尚未建立任何課程' : `找到 ${courses.length} 個課程`
    };
    
  } catch (e) {
    Logger.log('❌ 取得課程列表失敗：' + e.toString());

    return {
      success: false,
      message: '取得課程列表失敗：' + e.message,
      courses: []
    };
  }
}

/**
 * 更新課程
 * @param {string} courseId - 課程 ID
 * @param {string} name - 課程名稱
 * @param {string} description - 課程說明
 */
function updateCourse(courseId, name, description) {
  try {
    if (!courseId) {
      throw new Error('課程 ID 不可為空');
    }

    if (!name || name.trim() === '') {
      throw new Error('課程名稱不可為空');
    }

    const ss = getSpreadsheet();
    const coursesSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.COURSES);

    if (!coursesSheet) {
      throw new Error('找不到 Courses 分頁');
    }

    const data = coursesSheet.getDataRange().getValues();

    // 找到課程
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === courseId) {
        // 更新資料
        coursesSheet.getRange(i + 1, 2).setValue(name.trim());
        coursesSheet.getRange(i + 1, 4).setValue(description || '');

        Logger.log('✅ 更新課程成功:', { courseId, name });

        return {
          success: true,
          message: '課程更新成功'
        };
      }
    }

    throw new Error('找不到該課程');

  } catch (e) {
    Logger.log('❌ 更新課程失敗:', e.toString());
    return {
      success: false,
      message: '更新課程失敗：' + e.message
    };
  }
}

/**
 * 刪除課程（同時刪除所有相關任務）
 * @param {string} courseId - 課程 ID
 */
function deleteCourse(courseId) {
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(30000);

    if (!courseId) {
      throw new Error('課程 ID 不可為空');
    }

    const ss = getSpreadsheet();
    const coursesSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.COURSES);
    const tasksSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.TASKS);
    const assignmentsSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.ASSIGNMENTS);
    const learningSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.LEARNING_RECORDS);

    if (!coursesSheet) {
      throw new Error('找不到 Courses 分頁');
    }

    // ✅ 檢查1: 是否有 active 的授課安排
    if (assignmentsSheet) {
      const assignData = assignmentsSheet.getDataRange().getValues();
      const activeClasses = [];

      for (let i = 1; i < assignData.length; i++) {
        if (assignData[i][2] === courseId && assignData[i][5] === 'active') {
          // 找出班級名稱
          const classesSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.CLASSES);
          const classData = classesSheet.getDataRange().getValues();
          for (let j = 1; j < classData.length; j++) {
            if (classData[j][0] === assignData[i][1]) {
              activeClasses.push(classData[j][1]);
              break;
            }
          }
        }
      }

      if (activeClasses.length > 0) {
        throw new Error(`此課程正被 ${activeClasses.length} 個班級使用（${activeClasses.join('、')}），請先取消授課安排後再刪除`);
      }
    }

    // ✅ 檢查2: 是否有學習記錄
    if (learningSheet) {
      const learningData = learningSheet.getDataRange().getValues();
      let hasRecords = false;

      for (let i = 1; i < learningData.length; i++) {
        if (learningData[i][3] === courseId) {
          hasRecords = true;
          break;
        }
      }

      if (hasRecords) {
        throw new Error('此課程已有學生的學習記錄，無法刪除（為保護學習資料）');
      }
    }

    // 1. 刪除課程
    const courseData = coursesSheet.getDataRange().getValues();
    let deletedRow = -1;

    for (let i = 1; i < courseData.length; i++) {
      if (courseData[i][0] === courseId) {
        deletedRow = i + 1;
        coursesSheet.deleteRow(deletedRow);
        break;
      }
    }

    if (deletedRow === -1) {
      throw new Error('找不到該課程');
    }

    // 2. 刪除所有相關任務
    if (tasksSheet) {
      const taskData = tasksSheet.getDataRange().getValues();
      const rowsToDelete = [];

      for (let i = 1; i < taskData.length; i++) {
        if (taskData[i][1] === courseId) {
          rowsToDelete.push(i + 1);
        }
      }

      // 從後往前刪除，避免索引問題
      for (let i = rowsToDelete.length - 1; i >= 0; i--) {
        tasksSheet.deleteRow(rowsToDelete[i]);
      }

      Logger.log(`✅ 刪除課程成功，同時刪除 ${rowsToDelete.length} 個任務`);
    }

    return {
      success: true,
      message: '課程刪除成功'
    };

  } catch (e) {
    Logger.log('❌ 刪除課程失敗:', e.toString());
    return {
      success: false,
      message: '刪除課程失敗：' + e.message
    };
  } finally {
    lock.releaseLock();
  }
}


/**
 * 取得課程詳細資訊（包含所有任務）
 * 這是一個 Join 查詢的概念
 *
 * @param {string} courseId - 課程 ID
 */
function getCourseDetails(courseId) {
  try {
    if (!courseId) {
      throw new Error('課程 ID 不可為空');
    }
    
    const ss = getSpreadsheet();
    
    // 1. 讀取課程資訊
    const coursesSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.COURSES);
    if (!coursesSheet) {
      throw new Error('找不到 Courses 分頁');
    }
    
    const courseData = coursesSheet.getDataRange().getValues();
    let courseInfo = null;
    
    for (let i = 1; i < courseData.length; i++) {
      if (courseData[i][0] === courseId) {
        courseInfo = {
          courseId: courseData[i][0],
          courseName: courseData[i][1],
          teacherEmail: courseData[i][2],
          description: courseData[i][3],
          createDate: courseData[i][4]
        };
        break;
      }
    }
    
    if (!courseInfo) {
      throw new Error('找不到該課程');
    }
    
    // 2. 讀取該課程的所有任務
    const tasksSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.TASKS);
    const tasks = [];
    
    if (tasksSheet) {
      const taskData = tasksSheet.getDataRange().getValues();

      // 🔍 智能判斷表結構（新 vs 舊）
      const isNewStructure = taskData.length > 0 &&
                             taskData[0][4] &&
                             (taskData[0][4].toString().toLowerCase().includes('tier') ||
                              taskData[0][4].toString().toLowerCase().includes('層'));

      Logger.log('📋 Tasks 表結構:', isNewStructure ? '新結構 (tier/type)' : '舊結構 (tutorial/adventure/hardcore)');

      for (let i = 1; i < taskData.length; i++) {
        const row = taskData[i];

        // 篩選出屬於這個課程的任務
        if (row[1] === courseId) {
          if (isNewStructure) {
            // 新結構：task_id, course_id, name, sequence, tier, type, token_reward, content, link, created_at
            tasks.push({
              taskId: row[0],
              courseId: row[1],
              name: row[2],
              sequence: row[3] || 0,
              tier: row[4] || '基礎層',
              type: row[5] || 'tutorial',
              tokenReward: row[6] || 10,
              content: row[7] || '',
              link: row[8] || '',
              createDate: row[9]
            });
          } else {
            // 舊結構：不要拆分成三個任務，保持為一個任務
            tasks.push({
              taskId: row[0],
              courseId: row[1],
              taskName: row[3],          // 任務名稱
              name: row[3],              // 同時提供（兼容性）
              sequence: row[2] || 0,
              tier: 'mixed',
              type: 'mixed',
              tokenReward: row[11] || 10,
              timeLimit: row[4] || 0,
              // 保留所有層級的資料
              tutorialDesc: row[5] || '',
              tutorialLink: row[6] || '',
              adventureDesc: row[7] || '',
              adventureLink: row[8] || '',
              hardcoreDesc: row[9] || '',
              hardcoreLink: row[10] || '',
              createDate: row[12]
            });
          }
        }
      }

      // 按 sequence 排序
      tasks.sort((a, b) => a.sequence - b.sequence);
    }
    
    Logger.log('✅ 取得課程詳情:', { courseId, taskCount: tasks.length });
    
    return {
      success: true,
      courseInfo: courseInfo,
      tasks: tasks,
      taskCount: tasks.length
    };
    
  } catch (e) {
    Logger.log('❌ 取得課程詳情失敗:', e.toString());
    return {
      success: false,
      message: '取得課程詳情失敗：' + e.message
    };
  }
}


/**
 * 新增任務到課程
 * 自動計算 sequence（目前任務數 + 1）
 *
 * @param {string} courseId - 課程 ID
 * @param {Object} taskData - 任務資料
 */
function addTaskToCourse(courseId, taskData) {
  try {
    if (!courseId || !taskData) {
      return {
        success: false,
        message: '缺少必要參數'
      };
    }

    // 驗證必填欄位
    if (!taskData.taskName) {
      return {
        success: false,
        message: '請輸入任務名稱'
      };
    }

    const ss = SpreadsheetApp.openById(SHEET_CONFIG.SPREADSHEET_ID);
    const tasksSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.TASKS);

    // 生成任務 ID
    const taskId = 'task_' + Utilities.getUuid();

    // 取得該課程的任務數量（用於排序）
    const tasksData = tasksSheet.getDataRange().getValues();
    let sequence = 1;
    for (let i = 1; i < tasksData.length; i++) {
      if (tasksData[i][1] === courseId) {
        sequence++;
      }
    }

    // 準備新任務資料（包含代幣獎勵）
    const newTask = [
      taskId,                                    // taskId (索引0)
      courseId,                                  // courseId (索引1)
      sequence,                                  // sequence (索引2) ✓ 修正
      taskData.taskName,                         // taskName (索引3) ✓ 修正
      taskData.timeLimit || 0,                   // timeLimit (索引4)
      taskData.tutorialDesc || '',               // tutorialDesc (索引5)
      taskData.tutorialLink || '',               // tutorialLink (索引6)
      taskData.adventureDesc || '',              // adventureDesc (索引7)
      taskData.adventureLink || '',              // adventureLink (索引8)
      taskData.hardcoreDesc || '',               // hardcoreDesc (索引9)
      taskData.hardcoreLink || '',               // hardcoreLink (索引10)
      taskData.tokenReward || 100,               // tokenReward (索引11)
      new Date()                                 // createDate (索引12)
    ];

    // 寫入工作表
    tasksSheet.appendRow(newTask);

    Logger.log('✅ 任務已建立：' + taskId + '，代幣獎勵：' + (taskData.tokenReward || 100));

    return {
      success: true,
      message: '任務新增成功！',
      taskId: taskId
    };

  } catch (error) {
    Logger.log('❌ 新增任務失敗：' + error);
    return {
      success: false,
      message: '新增任務失敗：' + error.message
    };
  }
}

/**
 * 完成任務（發放代幣獎勵）
 */
function completeTask(e) {
  try {
    const progressId = e.parameter.progressId;
    const userId = e.parameter.userId;
    
    if (!progressId || !userId) {
      return jsonResponse(false, '缺少必要參數');
    }
    
    const ss = SpreadsheetApp.openById(SHEET_CONFIG.SPREADSHEET_ID);
    const progressSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.PROGRESS);
    const usersSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.USERS);
    const tasksSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.TASKS);
    
    // 1. 找到該進度記錄
    const progressData = progressSheet.getDataRange().getValues();
    let progressRow = -1;
    let taskId = null;
    
    for (let i = 1; i < progressData.length; i++) {
      if (progressData[i][0] === progressId) {
        progressRow = i + 1;
        taskId = progressData[i][2]; // taskId 在第3欄
        break;
      }
    }
    
    if (progressRow === -1) {
      return jsonResponse(false, '找不到該進度記錄');
    }
    
    // 2. 更新進度狀態為完成
    const endTime = new Date();
    const startTime = new Date(progressData[progressRow - 1][5]); // startTime
    const timeSpent = Math.round((endTime - startTime) / 1000); // 秒
    
    progressSheet.getRange(progressRow, 5).setValue('completed'); // status
    progressSheet.getRange(progressRow, 7).setValue(endTime);      // endTime
    progressSheet.getRange(progressRow, 8).setValue(timeSpent);   // timeSpent
    
    // 3. 🪙 取得任務的代幣獎勵
    const tasksData = tasksSheet.getDataRange().getValues();
    let tokenReward = 0;
    
    for (let i = 1; i < tasksData.length; i++) {
      if (tasksData[i][0] === taskId) {
        tokenReward = tasksData[i][11] || 0; // tokenReward 在第12欄
        break;
      }
    }
    
    // 4. 🪙 更新使用者的總代幣
    const usersData = usersSheet.getDataRange().getValues();
    let userRow = -1;
    let currentTokens = 0;
    
    for (let i = 1; i < usersData.length; i++) {
      if (usersData[i][0] === userId) {
        userRow = i + 1;
        currentTokens = usersData[i][8] || 0; // total_tokens 在第9欄
        break;
      }
    }

    if (userRow === -1) {
      return jsonResponse(false, '找不到使用者資料');
    }

    const newTotalTokens = currentTokens + tokenReward;
    usersSheet.getRange(userRow, 9).setValue(newTotalTokens); // total_tokens 在第9欄
    
    Logger.log(`✅ 任務完成！使用者 ${userId} 獲得 ${tokenReward} 代幣，總計：${newTotalTokens}`);
    
    // 5. 回傳結果（包含代幣資訊）
    return jsonResponse(true, '任務完成！', {
      timeSpent: timeSpent,
      tokensEarned: tokenReward,      // 🪙 本次獲得的代幣
      totalTokens: newTotalTokens     // 🪙 目前總代幣
    });
    
  } catch (error) {
    Logger.log('❌ 完成任務失敗：' + error);
    return jsonResponse(false, '完成任務失敗：' + error.message);
  }
}

/**
 * 取得學生當前學習階段資訊（包含代幣）
 */
function getStudentActiveSession(e) {
  try {
    const email = e.parameter.email;
    
    if (!email) {
      return jsonResponse(false, '缺少 email 參數');
    }
    
    const ss = SpreadsheetApp.openById(SHEET_CONFIG.SPREADSHEET_ID);
    const usersSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.USERS);
    const progressSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.PROGRESS);
    const tasksSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.TASKS);
    const tiersSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.TIERS);
    
    // 1. 🪙 取得使用者資料（包含代幣）
    const usersData = usersSheet.getDataRange().getValues();
    let userId = null;
    let userName = null;
    let totalTokens = 0;
    
    for (let i = 1; i < usersData.length; i++) {
      if (usersData[i][2] === email) {  // email 在第3欄
        userId = usersData[i][0];
        userName = usersData[i][3];     // name 在第4欄
        totalTokens = usersData[i][8] || 0; // total_tokens 在第9欄
        break;
      }
    }
    
    if (!userId) {
      return jsonResponse(false, '找不到使用者');
    }
    
    // 2. 取得進行中的任務
    const progressData = progressSheet.getDataRange().getValues();
    let activeProgress = null;
    
    for (let i = 1; i < progressData.length; i++) {
      if (progressData[i][1] === userId && progressData[i][4] === 'in_progress') {
        activeProgress = {
          progressId: progressData[i][0],
          taskId: progressData[i][2],
          tier: progressData[i][3],
          startTime: progressData[i][5]
        };
        break;
      }
    }
    
    if (!activeProgress) {
      return jsonResponse(false, '沒有進行中的任務', {
        userId: userId,
        userName: userName,
        totalTokens: totalTokens  // 🪙 即使沒有活動任務也回傳代幣
      });
    }
    
    // 3. 🪙 取得任務資訊（包含代幣獎勵）
    const tasksData = tasksSheet.getDataRange().getValues();
    let taskInfo = null;
    
    for (let i = 1; i < tasksData.length; i++) {
      if (tasksData[i][0] === activeProgress.taskId) {
        taskInfo = {
          taskId: tasksData[i][0],
          taskName: tasksData[i][3],
          timeLimit: tasksData[i][4],
          tutorialDesc: tasksData[i][5],
          tutorialLink: tasksData[i][6],
          adventureDesc: tasksData[i][7],
          adventureLink: tasksData[i][8],
          hardcoreDesc: tasksData[i][9],
          hardcoreLink: tasksData[i][10],
          tokenReward: tasksData[i][11] || 0  // 🪙 代幣獎勵
        };
        break;
      }
    }
    
    // 4. 取得分層資訊
    const tiersData = tiersSheet.getDataRange().getValues();
    let tierInfo = null;
    
    for (let i = 1; i < tiersData.length; i++) {
      if (tiersData[i][0] === activeProgress.tier) {
        tierInfo = {
          tierId: tiersData[i][0],
          tierName: tiersData[i][1],
          description: tiersData[i][2]
        };
        break;
      }
    }
    
    // 5. 回傳完整資訊
    return jsonResponse(true, '取得成功', {
      userId: userId,
      userName: userName,
      totalTokens: totalTokens,        // 🪙 總代幣
      activeProgress: activeProgress,
      taskInfo: taskInfo,              // 🪙 包含 tokenReward
      tierInfo: tierInfo
    });
    
  } catch (error) {
    Logger.log('❌ 取得學生資訊失敗：' + error);
    return jsonResponse(false, '取得失敗：' + error.message);
  }
}

/**
 * 手動調整學生代幣（教師專用）
 */
function adjustStudentTokens(params) {
  try {
    const teacherEmail = params.teacherEmail;
    const studentId = params.studentId;
    const amount = parseInt(params.amount); // 正數=增加，負數=減少
    const reason = params.reason || '教師手動調整';

    if (!teacherEmail || !studentId || !amount) {
      return {
        success: false,
        message: '缺少必要參數'
      };
    }

    // 驗證教師權限
    const teacherRole = getUserRole(teacherEmail);
    if (teacherRole !== 'teacher' && teacherRole !== 'admin') {
      return {
        success: false,
        message: '您沒有權限執行此操作'
      };
    }

    const ss = SpreadsheetApp.openById(SHEET_CONFIG.SPREADSHEET_ID);
    const usersSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.USERS);

    // 找到學生
    const usersData = usersSheet.getDataRange().getValues();
    let userRow = -1;
    let currentTokens = 0;
    let studentName = '';

    for (let i = 1; i < usersData.length; i++) {
      if (usersData[i][0] === studentId) {
        userRow = i + 1;
        studentName = usersData[i][3];
        currentTokens = usersData[i][8] || 0;  // total_tokens 在第9欄
        break;
      }
    }

    if (userRow === -1) {
      return {
        success: false,
        message: '找不到該學生'
      };
    }

    // 更新代幣（確保不會是負數）
    const newTotalTokens = Math.max(0, currentTokens + amount);
    usersSheet.getRange(userRow, 9).setValue(newTotalTokens);  // total_tokens 在第9欄

    Logger.log(`✅ 教師 ${teacherEmail} 調整學生 ${studentName} 的代幣：${amount}，新總額：${newTotalTokens}`);

    // 記錄到代幣歷史（可選）
    // logTokenTransaction(studentId, amount, reason, teacherEmail);

    return {
      success: true,
      message: '代幣調整成功',
      studentId: studentId,
      studentName: studentName,
      adjustment: amount,
      previousTokens: currentTokens,
      newTotalTokens: newTotalTokens
    };

  } catch (error) {
    Logger.log('❌ 調整代幣失敗：' + error);
    return {
      success: false,
      message: '調整代幣失敗：' + error.message
    };
  }
}

/**
 * 取得班級所有學生的代幣資訊
 */
function getClassTokens(params) {
  try {
    const classId = params.classId;
    const teacherEmail = params.teacherEmail;

    if (!classId || !teacherEmail) {
      return {
        success: false,
        message: '缺少必要參數'
      };
    }

    // 驗證教師權限
    const teacherRole = getUserRole(teacherEmail);
    if (teacherRole !== 'teacher' && teacherRole !== 'admin') {
      return {
        success: false,
        message: '您沒有權限查看此資訊'
      };
    }

    const ss = SpreadsheetApp.openById(SHEET_CONFIG.SPREADSHEET_ID);
    const membersSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.CLASS_MEMBERS);
    const usersSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.USERS);

    // 1. 取得班級成員
    const membersData = membersSheet.getDataRange().getValues();
    const studentIds = [];

    for (let i = 1; i < membersData.length; i++) {
      if (membersData[i][1] === classId) {
        studentIds.push(membersData[i][5]); // userId 在第6欄
      }
    }

    if (studentIds.length === 0) {
      return {
        success: true,
        message: '此班級尚無學生',
        students: [],
        totalStudents: 0,
        totalTokens: 0
      };
    }

    // 2. 取得學生代幣資訊
    const usersData = usersSheet.getDataRange().getValues();
    const students = [];

    for (let i = 1; i < usersData.length; i++) {
      const userId = usersData[i][0];

      if (studentIds.includes(userId)) {
        students.push({
          userId: userId,
          name: usersData[i][3],
          email: usersData[i][2],
          totalTokens: usersData[i][8] || 0,  // total_tokens 在第9欄
          seat: getMemberSeat(classId, userId) // 從 Class_Members 取得座號
        });
      }
    }

    // 3. 依代幣數量排序（高到低）
    students.sort((a, b) => b.totalTokens - a.totalTokens);

    return {
      success: true,
      message: '取得成功',
      classId: classId,
      students: students,
      totalStudents: students.length,
      totalTokens: students.reduce((sum, s) => sum + s.totalTokens, 0)
    };

  } catch (error) {
    Logger.log('❌ 取得班級代幣失敗：' + error);
    return {
      success: false,
      message: '取得失敗：' + error.message
    };
  }
}

// ==========================================
// 授課安排管理函數
// ==========================================

/**
 * 取得教師所有班級的授課安排狀態
 * @param {string} teacherEmail - 教師 Email
 * @returns {Object} 班級授課安排列表
 */
function getClassAssignments(teacherEmail) {
  try {
    const email = getCurrentUserEmail(teacherEmail);

    const ss = getSpreadsheet();
    const classesSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.CLASSES);
    const assignmentsSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.ASSIGNMENTS);
    const membersSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.CLASS_MEMBERS);
    const coursesSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.COURSES);
    const learningSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.LEARNING_RECORDS);

    if (!classesSheet) {
      throw new Error('找不到班級資料表');
    }

    // 1. 取得教師的所有班級
    const classData = classesSheet.getDataRange().getValues();
    const classes = [];

    for (let i = 1; i < classData.length; i++) {
      if (hasClassPermission(classData[i], email)) {
        classes.push({
          classId: classData[i][0],
          className: classData[i][1],
          teacherEmail: classData[i][2]
        });
      }
    }

    // 2. 對每個班級查詢授課安排和統計資料
    const assignments = [];

    for (let cls of classes) {
      // 計算班級學生數
      const membersData = membersSheet ? membersSheet.getDataRange().getValues() : [];
      let studentCount = 0;
      for (let i = 1; i < membersData.length; i++) {
        if (membersData[i][1] === cls.classId) {
          studentCount++;
        }
      }

      // 查詢授課安排
      let assignedCourse = null;
      if (assignmentsSheet) {
        const assignData = assignmentsSheet.getDataRange().getValues();
        Logger.log(`🔍 班級 ${cls.className} (${cls.classId}): 檢查授課安排表，共 ${assignData.length - 1} 筆記錄`);
        
        for (let i = 1; i < assignData.length; i++) {
          Logger.log(`  行 ${i}: classId=${assignData[i][1]}, courseId=${assignData[i][2]}, status=${assignData[i][5]}`);
          
          if (assignData[i][1] === cls.classId && assignData[i][5] === 'active') {
            const courseId = assignData[i][2];
            Logger.log(`  ✅ 找到符合的授課安排！courseId=${courseId}`);

            // 取得課程名稱
            if (coursesSheet) {
              const courseData = coursesSheet.getDataRange().getValues();
              Logger.log(`  🔍 查詢課程表，共 ${courseData.length - 1} 筆課程`);
              
              for (let j = 1; j < courseData.length; j++) {
                Logger.log(`    課程行 ${j}: courseId=${courseData[j][0]}, courseName=${courseData[j][1]}`);
                
                if (courseData[j][0] === courseId) {
                  assignedCourse = {
                    courseId: courseId,
                    courseName: courseData[j][1],
                    assignedDate: assignData[i][4]
                  };
                  Logger.log(`  ✅ 找到課程！courseName=${courseData[j][1]}`);
                  break;
                }
              }
            }
            break;
          }
        }
        
        if (!assignedCourse) {
          Logger.log(`  ❌ 班級 ${cls.className}: 無有效的授課安排`);
        }
      } else {
        Logger.log(`  ❌ 找不到授課安排表`);
      }

      // 統計學習進度
      let startedCount = 0;
      let notStartedCount = studentCount;

      if (assignedCourse && learningSheet) {
        const learningData = learningSheet.getDataRange().getValues();
        for (let i = 1; i < learningData.length; i++) {
          if (learningData[i][2] === cls.classId &&
              learningData[i][3] === assignedCourse.courseId &&
              learningData[i][7] !== 'not_started') {
            startedCount++;
          }
        }
        notStartedCount = studentCount - startedCount;
      }

      assignments.push({
        classId: cls.classId,
        className: cls.className,
        studentCount: studentCount,
        courseId: assignedCourse ? assignedCourse.courseId : null,
        courseName: assignedCourse ? assignedCourse.courseName : null,
        assignedDate: assignedCourse ? assignedCourse.assignedDate : null,
        studentsStarted: startedCount,
        studentsNotStarted: notStartedCount
      });
    }

    Logger.log('✅ 取得授課安排成功:', assignments.length);

    return {
      success: true,
      assignments: assignments,
      message: assignments.length === 0 ? '尚未建立任何班級' : `找到 ${assignments.length} 個班級`
    };

  } catch (error) {
    Logger.log('❌ 取得授課安排失敗：' + error);
    return {
      success: false,
      message: '取得失敗：' + error.message,
      assignments: []
    };
  }
}

/**
 * 指派課程給班級
 * @param {Object} params - 參數物件
 * @returns {Object} 操作結果
 */
function assignCourseToClass(params) {
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(30000);

    const { classId, courseId, teacherEmail } = params;

    if (!classId || !courseId || !teacherEmail) {
      throw new Error('缺少必要參數');
    }

    const email = getCurrentUserEmail(teacherEmail);

    const ss = getSpreadsheet();
    const classesSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.CLASSES);
    const coursesSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.COURSES);
    const assignmentsSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.ASSIGNMENTS);

    // 驗證班級權限（使用 hasClassPermission）
    const classData = classesSheet.getDataRange().getValues();
    let classExists = false;
    let classRow = null;
    for (let i = 1; i < classData.length; i++) {
      if (classData[i][0] === classId) {
        if (hasClassPermission(classData[i], email)) {
          classExists = true;
          classRow = classData[i];
          break;
        } else {
          throw new Error('您沒有此班級的權限');
        }
      }
    }

    if (!classExists) {
      throw new Error('班級不存在或您沒有權限');
    }

    const courseData = coursesSheet.getDataRange().getValues();
    let courseExists = false;
    let courseCreator = null;
    for (let i = 1; i < courseData.length; i++) {
      if (courseData[i][0] === courseId) {
        courseExists = true;
        courseCreator = courseData[i][2];  // 記錄課程創建者
        break;
      }
    }

    if (!courseExists) {
      throw new Error('課程不存在');
    }

    // 檢查是否已有 active 的指派，如果有則改為 inactive
    const assignData = assignmentsSheet.getDataRange().getValues();
    for (let i = 1; i < assignData.length; i++) {
      if (assignData[i][1] === classId && assignData[i][5] === 'active') {
        assignmentsSheet.getRange(i + 1, 6).setValue('inactive');
        Logger.log('✅ 將舊的授課安排設為 inactive');
      }
    }

    // 新增授課安排
    const assignmentId = generateUUID();
    const assignedDate = new Date();

    assignmentsSheet.appendRow([
      assignmentId,
      classId,
      courseId,
      email,
      assignedDate,
      'active'
    ]);

    Logger.log('✅ 授課安排成功:', { classId: classId, courseId: courseId, operator: email, courseCreator: courseCreator });

    return {
      success: true,
      message: '課程指派成功！'
    };

  } catch (error) {
    Logger.log('❌ 指派課程失敗：' + error);
    return {
      success: false,
      message: '指派失敗：' + error.message
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * 取消班級的授課安排
 * @param {Object} params - 參數物件
 * @returns {Object} 操作結果
 */
function removeAssignment(params) {
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(30000);

    const { classId, teacherEmail } = params;

    if (!classId || !teacherEmail) {
      throw new Error('缺少必要參數');
    }

    const email = getCurrentUserEmail(teacherEmail);

    const ss = getSpreadsheet();
    const classesSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.CLASSES);
    const assignmentsSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.ASSIGNMENTS);

    // 驗證班級權限（使用 hasClassPermission）
    const classData = classesSheet.getDataRange().getValues();
    let classExists = false;
    for (let i = 1; i < classData.length; i++) {
      if (classData[i][0] === classId) {
        if (hasClassPermission(classData[i], email)) {
          classExists = true;
          break;
        } else {
          throw new Error('您沒有此班級的權限');
        }
      }
    }

    if (!classExists) {
      throw new Error('班級不存在或您沒有權限');
    }

    // 將 active 的指派改為 inactive
    const assignData = assignmentsSheet.getDataRange().getValues();
    let found = false;
    for (let i = 1; i < assignData.length; i++) {
      if (assignData[i][1] === classId && assignData[i][5] === 'active') {
        assignmentsSheet.getRange(i + 1, 6).setValue('inactive');
        found = true;
        Logger.log('✅ 取消授課安排');
        break;
      }
    }

    if (!found) {
      throw new Error('此班級尚未指派課程');
    }

    return {
      success: true,
      message: '已取消課程指派'
    };

  } catch (error) {
    Logger.log('❌ 取消指派失敗：' + error);
    return {
      success: false,
      message: '取消失敗：' + error.message
    };
  } finally {
    lock.releaseLock();
  }
}


/**
 * 更新任務資料
 * @param {string} taskId - 任務 ID
 * @param {Object} taskData - 更新的任務資料
 */
function updateTask(taskId, taskData) {
  try {
    const ss = getSpreadsheet();
    const tasksSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.TASKS);
    
    if (!tasksSheet) {
      throw new Error('找不到 Tasks 分頁');
    }
    
    const data = tasksSheet.getDataRange().getValues();
    
    // 找到任務
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === taskId) {
        // 更新資料（保留 task_id, course_id）
        // 如果提供 sequence，則更新（索引2，第3欄）
        if (taskData.sequence !== undefined) {
          tasksSheet.getRange(i + 1, 3).setValue(taskData.sequence);
        }
        // taskName（索引3，第4欄）✓ 修正
        tasksSheet.getRange(i + 1, 4).setValue(taskData.taskName || data[i][3]);
        // timeLimit（索引4，第5欄）
        tasksSheet.getRange(i + 1, 5).setValue(taskData.timeLimit || data[i][4]);
        // tutorialDesc（索引5，第6欄）
        tasksSheet.getRange(i + 1, 6).setValue(taskData.tutorialDesc || '');
        // tutorialLink（索引6，第7欄）
        tasksSheet.getRange(i + 1, 7).setValue(taskData.tutorialLink || '');
        // adventureDesc（索引7，第8欄）
        tasksSheet.getRange(i + 1, 8).setValue(taskData.adventureDesc || '');
        // adventureLink（索引8，第9欄）
        tasksSheet.getRange(i + 1, 9).setValue(taskData.adventureLink || '');
        // hardcoreDesc（索引9，第10欄）
        tasksSheet.getRange(i + 1, 10).setValue(taskData.hardcoreDesc || '');
        // hardcoreLink（索引10，第11欄）
        tasksSheet.getRange(i + 1, 11).setValue(taskData.hardcoreLink || '');
        // tokenReward（索引11，第12欄）✓ 新增
        if (taskData.tokenReward !== undefined) {
          tasksSheet.getRange(i + 1, 12).setValue(taskData.tokenReward);
        }

        Logger.log('✅ 更新任務成功:', { taskId });

        return {
          success: true,
          message: '更新成功'
        };
      }
    }
    
    throw new Error('找不到該任務');
    
  } catch (e) {
    Logger.log('❌ 更新任務失敗:', e.toString());
    return {
      success: false,
      message: '更新失敗：' + e.message
    };
  }
}


/**
 * 刪除任務
 * 同時重新調整後續任務的 sequence
 * 
 * @param {string} taskId - 任務 ID
 * @param {string} courseId - 課程 ID
 */
function deleteTask(taskId, courseId) {
  const lock = LockService.getScriptLock();
  
  try {
    lock.waitLock(30000);
    
    const ss = getSpreadsheet();
    const tasksSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.TASKS);
    
    if (!tasksSheet) {
      throw new Error('找不到 Tasks 分頁');
    }
    
    const data = tasksSheet.getDataRange().getValues();
    let deletedSequence = -1;
    let deletedRow = -1;
    
    // 找到並刪除任務
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === taskId) {
        deletedSequence = data[i][2]; // ✓ 修正：sequence 在索引2
        deletedRow = i + 1;
        tasksSheet.deleteRow(deletedRow);
        break;
      }
    }
    
    if (deletedRow === -1) {
      throw new Error('找不到該任務');
    }
    
    // 重新讀取資料（因為已經刪除一列）
    const updatedData = tasksSheet.getDataRange().getValues();
    
    // 調整後續任務的 sequence（往前移一個）
    for (let i = 1; i < updatedData.length; i++) {
      if (updatedData[i][1] === courseId && updatedData[i][2] > deletedSequence) {
        tasksSheet.getRange(i + 1, 3).setValue(updatedData[i][2] - 1); // ✓ 修正：sequence 在索引2，第3欄
      }
    }
    
    Logger.log('✅ 刪除任務成功:', { taskId });
    
    return {
      success: true,
      message: '刪除成功'
    };
    
  } catch (e) {
    Logger.log('❌ 刪除任務失敗:', e.toString());
    return {
      success: false,
      message: '刪除失敗：' + e.message
    };
  } finally {
    lock.releaseLock();
  }
}


/**
 * 重新排序任務
 * @param {string} courseId - 課程 ID
 * @param {Array} taskOrder - 任務 ID 陣列（按新順序排列）
 */
function reorderTasks(courseId, taskOrder) {
  const lock = LockService.getScriptLock();
  
  try {
    lock.waitLock(30000);
    
    const ss = getSpreadsheet();
    const tasksSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.TASKS);
    
    if (!tasksSheet) {
      throw new Error('找不到 Tasks 分頁');
    }
    
    const data = tasksSheet.getDataRange().getValues();
    
    // 更新每個任務的 sequence
    for (let newSeq = 0; newSeq < taskOrder.length; newSeq++) {
      const taskId = taskOrder[newSeq];
      
      // 找到任務並更新 sequence
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === taskId && data[i][1] === courseId) {
          tasksSheet.getRange(i + 1, 4).setValue(newSeq + 1);
          break;
        }
      }
    }
    
    Logger.log('✅ 任務重新排序成功');
    
    return {
      success: true,
      message: '排序成功'
    };
    
  } catch (e) {
    Logger.log('❌ 重新排序失敗:', e.toString());
    return {
      success: false,
      message: '排序失敗：' + e.message
    };
  } finally {
    lock.releaseLock();
  }
}

// ==========================================
// 學生端 API
// ==========================================

/**
 * 取得使用者代幣數
 * @param {string} userEmail - 使用者 Email
 * @returns {Object} 代幣數量
 */
function getUserTokens(userEmail) {
  try {
    const email = getCurrentUserEmail(userEmail);

    const ss = getSpreadsheet();
    const usersSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.USERS);

    const usersData = usersSheet.getDataRange().getValues();

    for (let i = 1; i < usersData.length; i++) {
      if (usersData[i][2] === email) {
        const tokens = usersData[i][8] || 0;

        Logger.log('✅ 取得代幣成功:', { email, tokens });

        return {
          success: true,
          tokens: tokens
        };
      }
    }

    throw new Error('找不到使用者資訊');

  } catch (error) {
    Logger.log('❌ 取得代幣失敗：' + error);
    return {
      success: false,
      message: '取得失敗：' + error.message,
      tokens: 0
    };
  }
}

/**
 * 取得學生儀表板資訊
 * @param {string} userEmail - 學生 Email
 * @returns {Object} 學生資訊、班級、課程、學習進度
 */
function getStudentDashboard(userEmail, targetClassId = null) {
  try {
    const email = getCurrentUserEmail(userEmail);

    const ss = getSpreadsheet();
    const usersSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.USERS);
    const membersSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.CLASS_MEMBERS);
    const classesSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.CLASSES);
    const assignmentsSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.ASSIGNMENTS);
    const coursesSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.COURSES);
    const learningSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.LEARNING_RECORDS);

    // 1. 取得學生基本資訊
    const usersData = usersSheet.getDataRange().getValues();
    let studentInfo = null;
    let userId = null;

    for (let i = 1; i < usersData.length; i++) {
      if (usersData[i][2] === email) {
        userId = usersData[i][0];
        studentInfo = {
          userId: userId,
          name: usersData[i][1],
          email: usersData[i][2],
          totalTokens: usersData[i][8] || 0,
          role: usersData[i][4]
        };
        break;
      }
    }

    if (!studentInfo) {
      throw new Error('找不到學生資訊');
    }

    // 2. 取得學生所屬的班級
    // 注意：Class_Members 表的 user_id 是匯入時生成的 UUID，與 Users 表的 user_id 不同
    // 所以我們用 email 來匹配，如果沒有 email 則用姓名匹配
    const membersData = membersSheet ? membersSheet.getDataRange().getValues() : [];
    let classId = null;
    let className = null;

    // ✓ 修正：如果有指定 targetClassId，就只查找該班級
    if (targetClassId) {
      // 驗證學生是否在該班級中
      let isInClass = false;
      for (let i = 1; i < membersData.length; i++) {
        const memberEmail = membersData[i][4];
        const memberName = membersData[i][3];
        const memberClassId = membersData[i][1];

        if (memberClassId === targetClassId &&
            ((memberEmail && memberEmail === email) ||
             (memberName && memberName === studentInfo.name))) {
          isInClass = true;
          classId = targetClassId;
          break;
        }
      }

      if (!isInClass) {
        throw new Error('學生不在指定的班級中');
      }

      // 取得班級名稱
      if (classesSheet) {
        const classData = classesSheet.getDataRange().getValues();
        for (let j = 1; j < classData.length; j++) {
          if (classData[j][0] === classId) {
            className = classData[j][1];
            break;
          }
        }
      }

      Logger.log('✅ 找到指定班級:', { classId, className });
    } else {
      // 沒有指定班級，使用第一個找到的班級（向後兼容）
      for (let i = 1; i < membersData.length; i++) {
        const memberEmail = membersData[i][4];
        const memberName = membersData[i][3];

        if ((memberEmail && memberEmail === email) ||
            (memberName && memberName === studentInfo.name)) {
          classId = membersData[i][1];

          // 取得班級名稱
          if (classesSheet) {
            const classData = classesSheet.getDataRange().getValues();
            for (let j = 1; j < classData.length; j++) {
              if (classData[j][0] === classId) {
                className = classData[j][1];
                break;
              }
            }
          }

          Logger.log('✅ 找到班級:', { className, matchBy: memberEmail ? 'email' : 'name' });
          break;
        }
      }
    }

    if (!classId) {
      return {
        success: true,
        student: studentInfo,
        message: '您尚未加入任何班級'
      };
    }

    // 3. 取得班級的授課安排（當前課程）
    let currentCourse = null;
    if (assignmentsSheet && coursesSheet) {
      const assignData = assignmentsSheet.getDataRange().getValues();

      for (let i = 1; i < assignData.length; i++) {
        if (assignData[i][1] === classId && assignData[i][5] === 'active') {
          const courseId = assignData[i][2];

          // 取得課程詳情
          const courseData = coursesSheet.getDataRange().getValues();
          for (let j = 1; j < courseData.length; j++) {
            if (courseData[j][0] === courseId) {
              currentCourse = {
                courseId: courseId,
                courseName: courseData[j][1],
                description: courseData[j][3]
              };
              break;
            }
          }
          break;
        }
      }
    }

    if (!currentCourse) {
      return {
        success: true,
        student: studentInfo,
        classId: classId,
        className: className,
        message: '目前班級尚未安排課程'
      };
    }

    // 4. 取得學生的學習記錄
    let learningRecord = null;
    if (learningSheet) {
      const learningData = learningSheet.getDataRange().getValues();

      for (let i = 1; i < learningData.length; i++) {
        if (learningData[i][1] === userId &&
            learningData[i][2] === classId &&
            learningData[i][3] === currentCourse.courseId) {
          const recordId = learningData[i][0];

          // ✓ 新增：同步 total_tasks，確保是最新的
          syncTotalTasks(recordId);

          // 重新讀取更新後的資料
          const updatedLearningData = learningSheet.getDataRange().getValues();
          const updatedRow = updatedLearningData[i];

          learningRecord = {
            recordId: recordId,
            startDate: updatedRow[4],
            lastAccessDate: updatedRow[5],
            status: updatedRow[7],
            completedTasks: updatedRow[8] || 0,
            totalTasks: updatedRow[9] || 0,  // ✓ 使用更新後的 total_tasks
            currentTier: updatedRow[10] || ''
          };
          break;
        }
      }
    }

    Logger.log('✅ 取得學生儀表板成功');

    return {
      success: true,
      student: studentInfo,
      classId: classId,
      className: className,
      course: currentCourse,
      learningRecord: learningRecord
    };

  } catch (error) {
    Logger.log('❌ 取得學生儀表板失敗：' + error);
    return {
      success: false,
      message: '取得失敗：' + error.message
    };
  }
}

/**
 * 學生進入課堂整合API（修正版：補上 taskProgressId）
 * 一次性返回所有進入課堂需要的數據
 */
function getStudentClassEntryData(params) {
  try {
    const { userEmail, classId, courseId } = params;

    if (!userEmail || !classId || !courseId) {
      throw new Error('缺少必要參數');
    }

    const email = getCurrentUserEmail(userEmail);
    const ss = getSpreadsheet();

    Logger.log('📊 開始載入學生進入數據...', { email, classId, courseId });

    // ===== 1. 檢查使用者與 Session =====
    const usersSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.USERS);
    const classMembersSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.CLASS_MEMBERS);
    const sessionsSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.CLASS_SESSIONS);

    // 1-1. 取得 userId
    const usersData = usersSheet ? usersSheet.getDataRange().getValues() : [];
    let userId = null;
    for (let i = 1; i < usersData.length; i++) {
      if (usersData[i][2] === email) {
        userId = usersData[i][0];
        break;
      }
    }
    if (!userId) throw new Error('找不到使用者資訊');

    // 1-2. 檢查是否為班級成員
    const membersData = classMembersSheet ? classMembersSheet.getDataRange().getValues() : [];
    let isMember = false;
    for (let i = 1; i < membersData.length; i++) {
      if (membersData[i][1] === classId && membersData[i][5] === userId) {
        isMember = true;
        break;
      }
    }
    if (!isMember) return { success: true, isActive: false, message: '您不屬於此班級' };

    // 1-3. 檢查 Active Session
    const sessionsData = sessionsSheet ? sessionsSheet.getDataRange().getValues() : [];
    let sessionInfo = null;
    let teacherEmail = ''; 

    for (let i = 1; i < sessionsData.length; i++) {
      if (sessionsData[i][1] === classId && sessionsData[i][5] === 'active') {
        sessionInfo = {
          sessionId: sessionsData[i][0],
          classId: classId,
          startTime: sessionsData[i][3],
          status: 'active',
          courseId: sessionsData[i][6]
        };
        teacherEmail = sessionsData[i][2];
        break;
      }
    }

    if (!sessionInfo) {
      return { success: true, isActive: false, message: '目前沒有進行中的課堂' };
    }

    // ===== 2. 載入課程層級 (Tiers) =====
    const tiersArray = [
      { tier: 'tutorial', id: 'tutorial', name: '基礎層' },
      { tier: 'adventure', id: 'adventure', name: '進階層' },
      { tier: 'hardcore', id: 'hardcore', name: '精通層' }
    ];

    // ===== 3. 載入或創建學習記錄 (Learning Record) =====
    const learningSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.LEARNING_RECORDS);
    const learningData = learningSheet ? learningSheet.getDataRange().getValues() : [];
    let learningRecord = null;
    let recordId = null;

    // 尋找現有記錄
    for (let i = 1; i < learningData.length; i++) {
      if (learningData[i][1] === userId &&
          learningData[i][2] === classId &&
          learningData[i][3] === courseId) {
        
        recordId = learningData[i][0];
        const currentTierVal = learningData[i][10] || 'tutorial';

        learningRecord = {
          recordId: recordId,
          userId: userId,
          classId: classId,
          courseId: courseId,
          current_tier: currentTierVal, 
          currentTier: currentTierVal,
          completedTasks: learningData[i][8] || 0,
          totalTasks: learningData[i][9] || 0
        };
        break;
      }
    }

    // 如果沒有記錄，創建新的
    if (!learningRecord) {
      recordId = 'record_' + Utilities.getUuid();
      const now = new Date();
      
      const tasksSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.TASKS);
      const tasksData = tasksSheet ? tasksSheet.getDataRange().getValues() : [];
      let totalTasks = 0;
      for(let i=1; i<tasksData.length; i++) {
        if(tasksData[i][1] === courseId) totalTasks++;
      }

      learningSheet.appendRow([
        recordId,
        userId,
        classId,
        courseId,
        teacherEmail,
        now,           // start_date
        now,           // last_access_date
        'in_progress', // status
        0,             // completed_tasks
        totalTasks,    // total_tasks
        'tutorial'     // current_tier
      ]);

      learningRecord = {
        recordId: recordId,
        userId: userId,
        classId: classId,
        courseId: courseId,
        current_tier: 'tutorial',
        currentTier: 'tutorial',
        completedTasks: 0,
        totalTasks: totalTasks
      };
      Logger.log('✅ 創建新的學習記錄:', recordId);
    }

    // ===== 4. 載入任務進度 (Progress) - 關鍵修正處 =====
    const progressSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.TASK_PROGRESS);
    const progressData = progressSheet ? progressSheet.getDataRange().getValues() : [];
    const progress = {};

    for (let i = 1; i < progressData.length; i++) {
      // 比對 RecordID (確保只載入這個學生的進度)
      if (String(progressData[i][1]) === String(recordId)) {
        const taskId = progressData[i][2];
        
        // 🔥 關鍵修正：必須回傳 taskProgressId (Index 0)
        progress[taskId] = {
          taskProgressId: progressData[i][0], // A欄
          status: progressData[i][3],         // D欄 (確保是 assessment)
          startTime: progressData[i][4],
          completeTime: progressData[i][5],
          timeSpent: progressData[i][6] || 0
        };
      }
    }

    // ===== 回傳整合數據 =====
    Logger.log('✅ 學生進入數據載入完成', { currentTier: learningRecord.current_tier });

    return {
      success: true,
      isActive: true,
      session: sessionInfo,
      tiers: tiersArray,
      learningRecord: learningRecord,
      progress: progress
    };

  } catch (error) {
    Logger.log('❌ 載入學生進入數據失敗：' + error);
    return {
      success: false,
      message: '載入失敗：' + error.message,
      isActive: false
    };
  }
}

/**
 * 開始學習一個課程（創建學習記錄）
 * @param {Object} params - 參數物件
 * @returns {Object} 操作結果
 */
function startLearning(params) {
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(30000);

    const { userEmail, classId, courseId } = params;

    if (!userEmail || !classId || !courseId) {
      throw new Error('缺少必要參數');
    }

    const email = getCurrentUserEmail(userEmail);

    const ss = getSpreadsheet();
    const usersSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.USERS);
    const learningSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.LEARNING_RECORDS);
    const tasksSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.TASKS);
    const classesSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.CLASSES);

    // 取得 userId
    const usersData = usersSheet.getDataRange().getValues();
    let userId = null;
    let teacherEmail = null;

    for (let i = 1; i < usersData.length; i++) {
      if (usersData[i][2] === email) {
        userId = usersData[i][0];
        break;
      }
    }

    if (!userId) {
      throw new Error('找不到使用者資訊');
    }

    // 取得 teacherEmail
    if (classesSheet) {
      const classData = classesSheet.getDataRange().getValues();
      for (let i = 1; i < classData.length; i++) {
        if (classData[i][0] === classId) {
          teacherEmail = classData[i][2];
          break;
        }
      }
    }

    // 檢查是否已有學習記錄
    const learningData = learningSheet.getDataRange().getValues();
    for (let i = 1; i < learningData.length; i++) {
      if (learningData[i][1] === userId &&
          learningData[i][2] === classId &&
          learningData[i][3] === courseId) {
        return {
          success: true,
          message: '學習記錄已存在',
          learningRecord: {
            recordId: learningData[i][0],
            startDate: learningData[i][4],
            lastAccessDate: learningData[i][5],
            status: learningData[i][7],
            completedTasks: learningData[i][8] || 0,
            totalTasks: learningData[i][9] || 0,
            currentTier: learningData[i][10] || ''
          }
        };
      }
    }

    // 計算課程總任務數
    const tasksData = tasksSheet.getDataRange().getValues();
    let totalTasks = 0;
    for (let i = 1; i < tasksData.length; i++) {
      if (tasksData[i][1] === courseId) {
        totalTasks++;
      }
    }

    // 創建學習記錄
    const recordId = generateUUID();
    const now = new Date();

    learningSheet.appendRow([
      recordId,
      userId,
      classId,
      courseId,
      teacherEmail,  // teacher_email
      now,           // start_date
      now,           // last_access_date
      'in_progress', // status
      0,             // completed_tasks
      totalTasks,    // total_tasks
      ''             // current_tier (初始為空，學生首次選擇難度時會更新)
    ]);

    Logger.log('✅ 開始學習成功:', { userId, courseId });

    return {
      success: true,
      message: '開始學習！',
      learningRecord: {
        recordId: recordId,
        startDate: now,
        lastAccessDate: now,
        status: 'in_progress',
        completedTasks: 0,
        totalTasks: totalTasks,
        currentTier: ''
      }
    };

  } catch (error) {
    Logger.log('❌ 開始學習失敗：' + error);
    return {
      success: false,
      message: '開始失敗：' + error.message
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * 同步學習記錄的 total_tasks（當老師新增任務後更新）
 * @param {string} recordId - 學習記錄 ID
 * @returns {Object} 操作結果
 */
function syncTotalTasks(recordId) {
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(30000);

    if (!recordId) {
      throw new Error('缺少學習記錄 ID');
    }

    const ss = getSpreadsheet();
    const learningSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.LEARNING_RECORDS);
    const tasksSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.TASKS);

    if (!learningSheet || !tasksSheet) {
      throw new Error('找不到必要的工作表');
    }

    // 1. 找到學習記錄
    const learningData = learningSheet.getDataRange().getValues();
    let learningRow = -1;
    let courseId = null;
    let currentTotalTasks = 0;

    for (let i = 1; i < learningData.length; i++) {
      if (learningData[i][0] === recordId) {
        learningRow = i + 1;
        courseId = learningData[i][3];        // course_id (索引3)
        currentTotalTasks = learningData[i][9] || 0; // total_tasks (索引9)
        break;
      }
    }

    if (learningRow === -1) {
      throw new Error('找不到學習記錄');
    }

    // 2. 重新計算課程的實際任務數
    const tasksData = tasksSheet.getDataRange().getValues();
    let actualTotalTasks = 0;

    for (let i = 1; i < tasksData.length; i++) {
      if (tasksData[i][1] === courseId) {  // course_id 在索引1
        actualTotalTasks++;
      }
    }

    // 3. 如果任務數不一致，更新 total_tasks
    if (actualTotalTasks !== currentTotalTasks) {
      learningSheet.getRange(learningRow, 10).setValue(actualTotalTasks); // total_tasks 在第10欄

      Logger.log('✅ 同步 total_tasks 成功:', {
        recordId,
        oldTotal: currentTotalTasks,
        newTotal: actualTotalTasks
      });

      return {
        success: true,
        message: '任務數已同步',
        updated: true,
        oldTotal: currentTotalTasks,
        newTotal: actualTotalTasks
      };
    } else {
      Logger.log('✅ total_tasks 已是最新:', { recordId, totalTasks: actualTotalTasks });

      return {
        success: true,
        message: '任務數已是最新',
        updated: false,
        totalTasks: actualTotalTasks
      };
    }

  } catch (error) {
    Logger.log('❌ 同步 total_tasks 失敗：' + error);
    return {
      success: false,
      message: '同步失敗：' + error.message
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * 取得學習記錄的任務進度
 * @param {string} recordId - 學習記錄 ID
 * @returns {Object} 任務進度資料
 */
function getTaskProgress(recordId) {
  try {
    if (!recordId) {
      throw new Error('缺少學習記錄 ID');
    }

    // ✓ 新增：在載入任務進度前，先同步 total_tasks
    syncTotalTasks(recordId);

    const ss = getSpreadsheet();
    const progressSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.TASK_PROGRESS);

    if (!progressSheet) {
      // 如果沒有進度表，返回空進度
      return {
        success: true,
        progress: {}
      };
    }

    const progressData = progressSheet.getDataRange().getValues();
    const progress = {};

    for (let i = 1; i < progressData.length; i++) {
      if (progressData[i][1] === recordId) {
        const taskId = progressData[i][2];
        progress[taskId] = {
          status: progressData[i][3],
          startTime: progressData[i][4],
          completeTime: progressData[i][5],
          timeSpent: progressData[i][6]
        };
      }
    }

    Logger.log('✅ 取得任務進度成功:', Object.keys(progress).length);

    return {
      success: true,
      progress: progress
    };

  } catch (error) {
    Logger.log('❌ 取得任務進度失敗：' + error);
    return {
      success: false,
      message: '取得失敗：' + error.message,
      progress: {}
    };
  }
}

/**
 * 開始任務：建立 Task_Progress (嚴格比對版 - 修正抓錯 Record ID 問題)
 */
function startTask(params) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    
    const { userEmail, taskId, classId } = params;
    
    // 強制檢查必要參數
    if (!userEmail || !taskId || !classId) {
      throw new Error(`缺少必要參數: Email=${userEmail}, Task=${taskId}, Class=${classId}`);
    }

    const email = getCurrentUserEmail(userEmail);
    const ss = getSpreadsheet();
    
    Logger.log(`🔍 [StartTask] 開始尋找紀錄: UserEmail=${email}, Task=${taskId}, Class=${classId}`);

    // ============================================================
    // 1. 取得使用者 ID
    // ============================================================
    const usersSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.USERS);
    const usersData = usersSheet.getDataRange().getValues();
    let userId = null;
    for (let i = 1; i < usersData.length; i++) {
      if (String(usersData[i][2]).trim() === String(email).trim()) {
        userId = usersData[i][0];
        break;
      }
    }
    if (!userId) throw new Error('找不到使用者資訊');

    // ============================================================
    // 2. 取得任務所屬的 Course ID (反查)
    // ============================================================
    const tasksSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.TASKS);
    const tasksData = tasksSheet.getDataRange().getValues();
    let courseId = null;
    for (let i = 1; i < tasksData.length; i++) {
      if (String(tasksData[i][0]).trim() === String(taskId).trim()) {
        courseId = tasksData[i][1];
        break;
      }
    }
    if (!courseId) throw new Error('找不到任務所屬的課程 ID');

    // ============================================================
    // 3. 取得或「補建」學習記錄 (🔥 嚴格比對核心)
    // ============================================================
    const learningSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.LEARNING_RECORDS);
    const learningData = learningSheet.getDataRange().getValues();
    
    let recordId = null;

    // 準備要搜尋的目標字串 (轉字串 + 去空白)
    const targetUserId = String(userId).trim();
    const targetClassId = String(classId).trim();
    const targetCourseId = String(courseId).trim();

    Logger.log(`🎯 [Matching] 目標: User[${targetUserId}] + Class[${targetClassId}] + Course[${targetCourseId}]`);

    // A. 嘗試尋找現有的 Learning Record
    // 欄位順序假設: [0]record_id, [1]user_id, [2]class_id, [3]course_id
    for (let i = 1; i < learningData.length; i++) {
        const rowUserId = String(learningData[i][1]).trim();
        const rowClassId = String(learningData[i][2]).trim();
        const rowCourseId = String(learningData[i][3]).trim();

        // 🔥 嚴格比對：三個欄位必須完全一致
        if (rowUserId === targetUserId && 
            rowClassId === targetClassId && 
            rowCourseId === targetCourseId) {
            
            recordId = learningData[i][0];
            Logger.log(`✅ [Matched] 找到匹配紀錄 (Row ${i+1}): RecordID=${recordId}`);
            break;
        }
    }

    // B. 自我修復：如果找不到 Record，自動補建
    if (!recordId) {
        Logger.log('⚠️ 找不到完全匹配的學習記錄，正在建立新紀錄...');
        
        recordId = 'record_' + Utilities.getUuid();
        const now = new Date();

        learningSheet.appendRow([
            recordId,
            userId,
            targetClassId,      // ✅ 確保寫入的是當前的 ClassID
            targetCourseId,     // ✅ 確保寫入的是當前的 CourseID
            '',                 // teacher_email
            now,                // start_date
            now,                // last_access
            'in_progress',      // status
            0,                  // completed
            0,                  // total
            'tutorial'          // current_tier
        ]);
        
        Logger.log('✅ 新紀錄建立完成:', recordId);
    }

    // ============================================================
    // 4. 寫入 Task_Progress (進度表)
    // ============================================================
    const progressSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.TASK_PROGRESS);
    if (!progressSheet) throw new Error('找不到 Task_Progress 表');

    const progressData = progressSheet.getDataRange().getValues();
    
    // 檢查重複 (同樣使用嚴格比對)
    for (let i = 1; i < progressData.length; i++) {
      if (String(progressData[i][1]).trim() === String(recordId).trim() && 
          String(progressData[i][2]).trim() === String(taskId).trim()) {
        
        // 已經存在 -> 更新狀態
        progressSheet.getRange(i + 1, 4).setValue('in_progress');
        progressSheet.getRange(i + 1, 5).setValue(new Date()); 
        
        return { success: true, message: '任務已重新開始', taskProgressId: progressData[i][0] };
      }
    }

    // 不存在 -> 建立新紀錄
    const newProgressId = 'prog_' + Utilities.getUuid();
    const now = new Date();
    
    progressSheet.appendRow([
      newProgressId,
      recordId,
      taskId,
      'in_progress',
      now,
      '', // end_time
      0   // time_spent
    ]);

    return { success: true, message: '任務開始', taskProgressId: newProgressId };

  } catch (e) {
    Logger.log('❌ startTask Error: ' + e);
    return { success: false, message: '開始任務失敗：' + e.message };
  } finally {
    lock.releaseLock();
  }
}


/**
 * 提交任務 (最終版：包含除錯 Log 回傳 + 強力欄位檢查 + 正確狀態流轉)
 */
function submitTask(params) {
  const lock = LockService.getScriptLock();
  
  // 1. 初始化除錯 Log 容器
  const debugLogs = [];
  const log = (msg) => {
      Logger.log(msg);
      debugLogs.push(msg);
  };

  try {
    lock.waitLock(30000);

    const { userEmail, taskId, classId } = params;
    
    // 強制轉字串並去空白
    const targetTaskId = String(taskId).trim();
    const targetEmail = String(userEmail).trim().toLowerCase();

    log(`🔍 [SubmitTask] 開始處理...`);
    log(`   - 目標 TaskID: [${targetTaskId}]`);
    log(`   - 使用者 Email: [${targetEmail}]`);

    if (!userEmail || !taskId) throw new Error('缺少必要參數');

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const progressSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.TASK_PROGRESS);
    const checklistSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.TASK_CHECKLISTS);
    const questionsSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.TASK_QUESTIONS);
    const tasksSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.TASKS);
    const membersSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.CLASS_MEMBERS);
    const usersSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.USERS);
    const learningSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.LEARNING_RECORDS);

    // ==========================================
    // 2. 身分驗證 (Email -> UserID -> RecordID)
    // ==========================================
    const usersData = usersSheet.getDataRange().getValues();
    let userId = null;
    for (let i = 1; i < usersData.length; i++) {
      if (String(usersData[i][2]).trim().toLowerCase() === targetEmail) {
        userId = usersData[i][0];
        break;
      }
    }
    if (!userId) throw new Error('找不到使用者資訊 (Users表)');

    const learningData = learningSheet.getDataRange().getValues();
    const userRecordIds = [];
    for (let i = 1; i < learningData.length; i++) {
        // 假設 Learning_Records B欄 (Index 1) 是 user_id
        if (String(learningData[i][1]) === String(userId)) {
            userRecordIds.push(String(learningData[i][0])); 
        }
    }
    if (userRecordIds.length === 0) throw new Error('找不到該學生的選課紀錄 (LearningRecords)');
    
    log(`👤 身分驗證通過，找到 ${userRecordIds.length} 筆 RecordID`);

    // ==========================================
    // 3. 檢查是否有檢核項目 (Checklist) - 🔥 強力掃描 🔥
    // ==========================================
    let hasChecklist = false;
    
    if (checklistSheet) {
      const cData = checklistSheet.getDataRange().getValues();
      log(`📋 [檢查 Checklist] 表格共有 ${cData.length} 列`);
      
      for (let i = 1; i < cData.length; i++) {
        const colA = String(cData[i][0]).trim(); // Index 0 (A欄)
        const colB = String(cData[i][1]).trim(); // Index 1 (B欄)
        
        // 除錯：只印出前 3 筆，或者疑似匹配的
        if (i <= 3 || colA.includes(targetTaskId) || colB.includes(targetTaskId)) {
           log(`   - Row ${i+1}: A=[${colA}], B=[${colB}]`);
        }

        // 寬鬆比對：只要 A 欄或 B 欄其中一個等於 TaskID，就算有！
        if (colA === targetTaskId || colB === targetTaskId) {
          hasChecklist = true;
          log(`✅ 找到檢核項目！在第 ${i+1} 列`);
          break;
        }
      }
    } else {
      log('❌ 嚴重錯誤：找不到 CHECKLISTS 工作表');
    }

    // ==========================================
    // 4. 檢查是否有評量題目 (Question)
    // ==========================================
    let hasQuestion = false;
    if (questionsSheet) {
      const qData = questionsSheet.getDataRange().getValues();
      for (let i = 1; i < qData.length; i++) {
        // 同樣掃描 A 和 B 欄
        const colA = String(qData[i][0]).trim();
        const colB = String(qData[i][1]).trim();
        if (colA === targetTaskId || colB === targetTaskId) {
          hasQuestion = true;
          break;
        }
      }
    }

    log(`📊 最終判定: HasChecklist=${hasChecklist}, HasQuestion=${hasQuestion}`);

    // ==========================================
    // 5. 尋找並更新進度 (Task_Progress)
    // ==========================================
    let taskProgressId = null;
    let progressRow = -1;
    const pData = progressSheet.getDataRange().getValues();
    
    for (let i = 1; i < pData.length; i++) {
        const rowRecordId = String(pData[i][1]);
        const rowTaskId = String(pData[i][2]).trim();
        const rowStatus = String(pData[i][3]);

        // 比對：TaskID吻合 + 是本人的紀錄 + 狀態未完成
        if (rowTaskId === targetTaskId && userRecordIds.includes(rowRecordId) && rowStatus !== 'completed') {
            taskProgressId = pData[i][0];
            progressRow = i + 1;
            break; 
        }
    }

    if (!taskProgressId) {
        log('❌ 找不到對應的進度列');
        throw new Error('找不到進行中的任務進度，請確認是否已開始任務');
    }

    log(`📍 鎖定進度列: Row ${progressRow}, ProgressID: ${taskProgressId}`);

    // ==========================================
    // 🔥 6. 狀態路由與更新 🔥
    // ==========================================

    // 情況 A: 有檢核表 -> 狀態改為 'self_checking'
    if (hasChecklist) {
        progressSheet.getRange(progressRow, 4).setValue('self_checking');
        log(`➡️ 更新狀態為: self_checking`);
        
        return {
            success: true,
            nextStep: 'checklist',
            taskProgressId: taskProgressId,
            debugLogs: debugLogs // 🔥 回傳 Log
        };
    }

    // 情況 B: 無檢核表，有題目 -> 狀態改為 'assessment'
    if (hasQuestion) {
        progressSheet.getRange(progressRow, 4).setValue('assessment');
        log(`➡️ 更新狀態為: assessment (跳過檢查)`);
        
        const questionResult = getRandomQuestionForTask(ss, taskId);
        
        return {
            success: true,
            nextStep: 'assessment',
            taskProgressId: taskProgressId,
            question: questionResult,
            scenarioType: 'A',
            debugLogs: debugLogs // 🔥 回傳 Log
        };
    }

    // 情況 C: 兩者皆無 -> 直接完成
    const now = new Date();
    progressSheet.getRange(progressRow, 4).setValue('completed'); // Status
    progressSheet.getRange(progressRow, 6).setValue(now);         // Complete Time
    progressSheet.getRange(progressRow, 8).setValue(now);         // Submit Time
    progressSheet.getRange(progressRow, 9).setValue('A');         // Scenario
    progressSheet.getRange(progressRow, 10).setValue(true);       // Passed
    
    log(`➡️ 更新狀態為: completed (直接完成)`);

    // --- 發放獎勵 ---
    let tokenReward = 0;
    const tData = tasksSheet.getDataRange().getValues();
    for(let i=1; i<tData.length; i++){
        if(String(tData[i][0]) === targetTaskId){
            tokenReward = Number(tData[i][11]) || 0;
            break;
        }
    }

    const mData = membersSheet.getDataRange().getValues();
    for(let i=1; i<mData.length; i++){
        if(String(mData[i][4]) === targetEmail){
            const current = Number(mData[i][5]) || 0;
            membersSheet.getRange(i+1, 6).setValue(current + tokenReward);
            log(`💰 發放代幣: ${tokenReward}`);
            break;
        }
    }

    return {
        success: true,
        nextStep: 'completed',
        message: '任務完成！',
        tokenReward: tokenReward,
        debugLogs: debugLogs // 🔥 回傳 Log
    };

  } catch (error) {
    log('❌ 發生錯誤: ' + error.message);
    Logger.log(error); // 確保後台也有紀錄
    return { success: false, message: '提交失敗: ' + error.message, debugLogs: debugLogs };
  } finally {
    lock.releaseLock();
  }
}


/**
 * 取得學生所屬的所有班級及其課程資訊
 */
function getStudentClasses(userEmail) {
  try {
    if (!userEmail) {
      throw new Error('缺少使用者 Email');
    }

    const email = getCurrentUserEmail(userEmail);

    const ss = getSpreadsheet();
    const usersSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.USERS);
    const membersSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.CLASS_MEMBERS);
    const classesSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.CLASSES);
    const assignmentsSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.ASSIGNMENTS);
    const coursesSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.COURSES);

    if (!usersSheet || !membersSheet || !classesSheet) {
      throw new Error('找不到必要的工作表');
    }

    // 1. 取得學生資訊
    const usersData = usersSheet.getDataRange().getValues();
    let studentInfo = null;

    for (let i = 1; i < usersData.length; i++) {
      if (usersData[i][2] === email) {
        studentInfo = {
          userId: usersData[i][0],
          name: usersData[i][1],
          email: usersData[i][2],
          role: usersData[i][3]
        };
        break;
      }
    }

    if (!studentInfo) {
      throw new Error('找不到學生資訊');
    }

    // 2. 取得學生所屬的所有班級
    const membersData = membersSheet ? membersSheet.getDataRange().getValues() : [];
    const classIds = [];

    for (let i = 1; i < membersData.length; i++) {
      const memberEmail = membersData[i][4];
      const memberName = membersData[i][3];

      // 優先用 email 匹配，備用方案：用姓名匹配
      if ((memberEmail && memberEmail === email) ||
          (memberName && memberName === studentInfo.name)) {
        classIds.push(membersData[i][1]);
      }
    }

    if (classIds.length === 0) {
      return {
        success: true,
        student: studentInfo,
        classes: [],
        message: '您尚未加入任何班級'
      };
    }

    // 3. 取得班級詳情及其課程安排
    const classesData = classesSheet.getDataRange().getValues();
    const assignmentsData = assignmentsSheet ? assignmentsSheet.getDataRange().getValues() : [];
    const coursesData = coursesSheet ? coursesSheet.getDataRange().getValues() : [];

    const classes = [];

    for (let i = 1; i < classesData.length; i++) {
      const classId = classesData[i][0];

      if (classIds.includes(classId)) {
        const classInfo = {
          classId: classId,
          className: classesData[i][1],
          grade: classesData[i][2],
          description: classesData[i][3]
        };

        // 查找此班級的授課安排
        let courseInfo = null;
        for (let j = 1; j < assignmentsData.length; j++) {
          if (assignmentsData[j][1] === classId) {
            const courseId = assignmentsData[j][2];

            // 查找課程詳情
            for (let k = 1; k < coursesData.length; k++) {
              if (coursesData[k][0] === courseId) {
                courseInfo = {
                  courseId: courseId,
                  courseName: coursesData[k][1],
                  description: coursesData[k][2],
                  gradeLevel: coursesData[k][3],
                  category: coursesData[k][4]
                };
                break;
              }
            }
            break;
          }
        }

        classInfo.course = courseInfo;
        classes.push(classInfo);
      }
    }

    Logger.log('✅ 取得學生班級成功:', { email, classCount: classes.length });

    return {
      success: true,
      student: studentInfo,
      classes: classes
    };

  } catch (error) {
    Logger.log('❌ 取得學生班級失敗：' + error);
    return {
      success: false,
      message: '取得失敗：' + error.message,
      classes: []
    };
  }
}


/**
 * 取得課程的所有層級資訊
 */
function getCourseTiers(courseId) {
  try {
    if (!courseId) {
      throw new Error('缺少課程 ID');
    }

    const ss = getSpreadsheet();
    const tasksSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.TASKS);

    if (!tasksSheet) {
      throw new Error('找不到 Tasks 工作表');
    }

    const tasksData = tasksSheet.getDataRange().getValues();

    // 🔍 除錯：記錄表頭和第一筆資料
    if (tasksData.length > 0) {
      Logger.log('📋 Tasks 表頭:', tasksData[0]);
    }
    if (tasksData.length > 1) {
      Logger.log('📋 Tasks 第一筆資料:', tasksData[1]);
    }

    // 收集此課程的所有唯一層級
    const tiersSet = new Set();
    const tiersInfo = {};

    for (let i = 1; i < tasksData.length; i++) {
      if (tasksData[i][1] === courseId) {
        // 嘗試多個可能的欄位位置
        let tier = null;

        // 新結構：row[4] 可能是 tier
        // 舊結構：沒有 tier 欄位，需要根據描述欄位推斷

        // 先檢查 row[4] 是否為層級（應該是文字，不是數字）
        if (tasksData[i][4] && typeof tasksData[i][4] === 'string' && isNaN(tasksData[i][4])) {
          // 新結構：直接從 tier 欄位讀取
          tier = tasksData[i][4];
          Logger.log(`📌 找到層級: ${tier} (來自任務 ${tasksData[i][0]})`);
          tiersSet.add(tier);
        }
        // 如果 row[4] 是數字或空，則這可能是舊結構，從其他欄位推斷層級
        else {
          // 舊結構：如果有 tutorialDesc (row[5])、adventureDesc (row[7])、hardcoreDesc (row[9])
          // 一個任務可能同時有多個層級，所以不用 else if
          if (tasksData[i][5]) {
            Logger.log(`📌 找到層級: tutorial (來自任務 ${tasksData[i][0]})`);
            tiersSet.add('tutorial');
          }
          if (tasksData[i][7]) {
            Logger.log(`📌 找到層級: adventure (來自任務 ${tasksData[i][0]})`);
            tiersSet.add('adventure');
          }
          if (tasksData[i][9]) {
            Logger.log(`📌 找到層級: hardcore (來自任務 ${tasksData[i][0]})`);
            tiersSet.add('hardcore');
          }
        }
      }
    }

    // 將 Set 轉換為陣列並排序（基礎層 -> 進階層 -> 精通層）
    const tierOrder = ['基礎層', '進階層', '精通層', 'tutorial', 'adventure', 'hardcore'];
    const tiers = Array.from(tiersSet).sort((a, b) => {
      const aIndex = tierOrder.indexOf(a);
      const bIndex = tierOrder.indexOf(b);
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return a.localeCompare(b);
    });

    // 為每個層級添加說明和圖示
    const tiersWithInfo = tiers.map(tier => {
      let icon = '📘';
      let description = '';
      let color = '#10B981';

      if (tier === '基礎層' || tier === 'tutorial') {
        icon = '📘';
        description = '適合初學者，循序漸進地學習基礎知識';
        color = '#10B981';
      } else if (tier === '進階層' || tier === 'adventure') {
        icon = '📙';
        description = '適合具備基礎能力者，挑戰更深入的內容';
        color = '#F59E0B';
      } else if (tier === '精通層' || tier === 'hardcore') {
        icon = '📕';
        description = '適合進階學習者，挑戰高難度任務';
        color = '#EF4444';
      } else {
        icon = '📗';
        description = tier;
        color = '#6B7280';
      }

      return {
        tier: tier,
        icon: icon,
        description: description,
        color: color
      };
    });

    Logger.log('✅ 取得課程層級成功:', { courseId, tierCount: tiers.length });

    return {
      success: true,
      tiers: tiersWithInfo
    };

  } catch (error) {
    Logger.log('❌ 取得課程層級失敗：' + error);
    return {
      success: false,
      message: '取得失敗：' + error.message,
      tiers: []
    };
  }
}

// ==========================================
// 教師任務審核系統
// ==========================================

/**
 * 取得教師待審核的任務列表
 */
function getTeacherPendingTasks(teacherEmail) {
  try {
    if (!teacherEmail) {
      throw new Error('缺少教師 Email');
    }

    const email = getCurrentUserEmail(teacherEmail);

    const ss = getSpreadsheet();
    const classesSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.CLASSES);
    const assignmentsSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.ASSIGNMENTS);
    const coursesSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.COURSES);
    const tasksSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.TASKS);
    const learningSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.LEARNING_RECORDS);
    const progressSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.TASK_PROGRESS);
    const usersSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.USERS);

    // 1. 找出教師的所有班級（使用 hasClassPermission 包含代課老師）
    const classesData = classesSheet ? classesSheet.getDataRange().getValues() : [];
    const teacherClassIds = [];

    for (let i = 1; i < classesData.length; i++) {
      if (hasClassPermission(classesData[i], email)) {  // 使用 hasClassPermission 檢查權限
        teacherClassIds.push(classesData[i][0]);  // class_id
      }
    }

    if (teacherClassIds.length === 0) {
      return {
        success: true,
        pendingTasks: [],
        message: '您沒有負責的班級'
      };
    }

    // 2. 找出這些班級的課程
    const assignmentsData = assignmentsSheet ? assignmentsSheet.getDataRange().getValues() : [];
    const classCourseMap = {};  // classId -> courseId

    for (let i = 1; i < assignmentsData.length; i++) {
      const classId = assignmentsData[i][1];
      const courseId = assignmentsData[i][2];
      if (teacherClassIds.includes(classId)) {
        classCourseMap[classId] = courseId;
      }
    }

    // 3. 找出所有待審核的任務進度
    const progressData = progressSheet ? progressSheet.getDataRange().getValues() : [];
    const learningData = learningSheet ? learningSheet.getDataRange().getValues() : [];
    const usersData = usersSheet ? usersSheet.getDataRange().getValues() : [];
    const coursesData = coursesSheet ? coursesSheet.getDataRange().getValues() : [];
    const tasksData = tasksSheet ? tasksSheet.getDataRange().getValues() : [];

    const pendingTasks = [];

    for (let i = 1; i < progressData.length; i++) {
      if (progressData[i][3] === 'pending_review') {  // status
        const taskProgressId = progressData[i][0];
        const recordId = progressData[i][1];
        const taskId = progressData[i][2];
        const submitTime = progressData[i][5];

        // 找到學習記錄
        let learningRecord = null;
        for (let j = 1; j < learningData.length; j++) {
          if (learningData[j][0] === recordId) {
            learningRecord = {
              userId: learningData[j][1],
              classId: learningData[j][2],
              courseId: learningData[j][3]
            };
            break;
          }
        }

        if (!learningRecord) continue;

        // 檢查是否是教師負責的班級
        if (!teacherClassIds.includes(learningRecord.classId)) continue;

        // 取得學生資訊
        let studentInfo = null;
        for (let j = 1; j < usersData.length; j++) {
          if (usersData[j][0] === learningRecord.userId) {
            studentInfo = {
              userId: usersData[j][0],
              name: usersData[j][1],
              email: usersData[j][2]
            };
            break;
          }
        }

        // 取得課程資訊
        let courseInfo = null;
        for (let j = 1; j < coursesData.length; j++) {
          if (coursesData[j][0] === learningRecord.courseId) {
            courseInfo = {
              courseId: coursesData[j][0],
              courseName: coursesData[j][1]
            };
            break;
          }
        }

        // 取得任務資訊（處理舊結構的後綴）
        let actualTaskId = taskId;
        let taskTier = '';
        if (taskId.includes('_tutorial')) {
          actualTaskId = taskId.replace('_tutorial', '');
          taskTier = 'tutorial';
        } else if (taskId.includes('_adventure')) {
          actualTaskId = taskId.replace('_adventure', '');
          taskTier = 'adventure';
        } else if (taskId.includes('_hardcore')) {
          actualTaskId = taskId.replace('_hardcore', '');
          taskTier = 'hardcore';
        }

        let taskInfo = null;
        const isNewStructure = tasksData.length > 0 &&
                               tasksData[0][4] &&
                               (tasksData[0][4].toString().toLowerCase().includes('tier') ||
                                tasksData[0][4].toString().toLowerCase().includes('層'));

        for (let j = 1; j < tasksData.length; j++) {
          if (tasksData[j][0] === actualTaskId) {
            taskInfo = {
              taskId: taskId,
              taskName: isNewStructure ? tasksData[j][2] : tasksData[j][3],
              tier: taskTier || (isNewStructure ? tasksData[j][4] : ''),
              tokenReward: isNewStructure ? (tasksData[j][6] || 0) : (tasksData[j][11] || 10)
            };
            break;
          }
        }

        if (studentInfo && courseInfo && taskInfo) {
          // 計算等待審核時間
          const now = new Date();
          const submit = submitTime ? new Date(submitTime) : now;
          const waitingSeconds = Math.floor((now.getTime() - submit.getTime()) / 1000);

          // 格式化等待時間
          const waitingMinutes = Math.floor(waitingSeconds / 60);
          const waitingSecs = waitingSeconds % 60;
          const formattedWaitingTime = waitingMinutes > 0
            ? `${waitingMinutes}分${waitingSecs}秒`
            : `${waitingSecs}秒`;

          // 判斷優先級（超過5分鐘標記為高優先級）
          const priority = waitingSeconds > 300 ? 'high' : 'normal';

          pendingTasks.push({
            taskProgressId: taskProgressId,
            student: studentInfo,
            course: courseInfo,
            task: taskInfo,
            submitTime: submitTime,
            waitingTime: {
              seconds: waitingSeconds,
              formatted: formattedWaitingTime,
              priority: priority
            }
          });
        }
      }
    }

    // 按等待時間排序（等待最久的在前）
    pendingTasks.sort((a, b) => {
      const timeA = a.waitingTime ? a.waitingTime.seconds : 0;
      const timeB = b.waitingTime ? b.waitingTime.seconds : 0;
      return timeB - timeA;
    });

    Logger.log('✅ 取得待審核任務成功:', { teacherEmail: email, count: pendingTasks.length });

    return {
      success: true,
      pendingTasks: pendingTasks
    };

  } catch (error) {
    Logger.log('❌ 取得待審核任務失敗：' + error);
    return {
      success: false,
      message: '取得失敗：' + error.message,
      pendingTasks: []
    };
  }
}


/**
 * 取得教師任務監控儀表板資料（審核儀表板專用）
 * 階段 1：只顯示待審核（pending_review）狀態的任務
 */
function getTeacherTaskMonitor(params) {
  try {
    const { teacherEmail, classId } = params;

    if (!teacherEmail) {
      throw new Error('缺少教師 Email');
    }

    const email = getCurrentUserEmail(teacherEmail);

    const ss = getSpreadsheet();
    const classesSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.CLASSES);
    const classMembersSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.CLASS_MEMBERS);
    const tasksSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.TASKS);
    const learningSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.LEARNING_RECORDS);
    const progressSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.TASK_PROGRESS);
    const usersSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.USERS);

    // 1. 找出教師的所有班級（使用 hasClassPermission 包含代課老師）
    const classesData = classesSheet ? classesSheet.getDataRange().getValues() : [];
    const teacherClasses = [];

    for (let i = 1; i < classesData.length; i++) {
      // class_id, class_name, teacher_email, create_date
      if (hasClassPermission(classesData[i], email)) {  // 使用 hasClassPermission 檢查權限
        teacherClasses.push({
          classId: classesData[i][0],
          className: classesData[i][1]
        });
      }
    }

    if (teacherClasses.length === 0) {
      return {
        success: true,
        tasks: [],
        message: '您沒有負責的班級'
      };
    }

    const teacherClassIds = teacherClasses.map(c => c.classId);

    // 2. 如果指定了 classId，只篩選該班級
    let filteredClassIds = teacherClassIds;
    if (classId) {
      if (teacherClassIds.includes(classId)) {
        filteredClassIds = [classId];
      } else {
        return {
          success: false,
          message: '您沒有權限訪問此班級'
        };
      }
    }

    // 3. 讀取所有資料表
    const classMembersData = classMembersSheet ? classMembersSheet.getDataRange().getValues() : [];
    const learningData = learningSheet ? learningSheet.getDataRange().getValues() : [];
    const progressData = progressSheet ? progressSheet.getDataRange().getValues() : [];
    const usersData = usersSheet ? usersSheet.getDataRange().getValues() : [];
    const tasksData = tasksSheet ? tasksSheet.getDataRange().getValues() : [];

    // 檢測任務表結構（舊結構 vs 新結構）
    const isNewStructure = tasksData.length > 1 &&
                          tasksData[0][4] &&
                          typeof tasksData[0][4] === 'string' &&
                          (tasksData[0][4].toLowerCase().includes('tier') ||
                           tasksData[0][4].toLowerCase().includes('層'));

    Logger.log('📊 任務表結構：' + (isNewStructure ? '新結構' : '舊結構'));

    const monitorTasks = [];

    // 4. 遍歷所有執行中和待審核的任務進度（階段 2：加入執行中任務）
    for (let i = 1; i < progressData.length; i++) {
      // progress_id, record_id, task_id, status, start_time, complete_time, time_spent
      const progressId = progressData[i][0];
      const recordId = progressData[i][1];
      const taskId = progressData[i][2];
      const status = progressData[i][3];
      const startTime = progressData[i][4];
      const completeTime = progressData[i][5];
      const timeSpent = progressData[i][6];

      // 階段 2：處理執行中和待審核狀態
      if (status !== 'in_progress' && status !== 'pending_review') continue;

      // 5. 找到學習記錄
      let learningRecord = null;
      for (let j = 1; j < learningData.length; j++) {
        // record_id, user_id, class_id, course_id, teacher_email, ...
        if (learningData[j][0] === recordId) {
          learningRecord = {
            userId: learningData[j][1],
            classId: learningData[j][2],
            courseId: learningData[j][3]
          };
          break;
        }
      }

      if (!learningRecord) continue;

      // 檢查是否是教師負責的班級
      if (!filteredClassIds.includes(learningRecord.classId)) continue;

      // 6. 取得學生資訊（從 Users 表）
      let studentInfo = null;
      for (let j = 1; j < usersData.length; j++) {
        // user_id, google_id, email, name, role, ...
        if (usersData[j][0] === learningRecord.userId) {
          studentInfo = {
            userId: usersData[j][0],
            name: usersData[j][3],
            email: usersData[j][2]
          };
          break;
        }
      }

      if (!studentInfo) continue;

      // 7. 取得學生座號（從學員資料表）
      let seatNumber = null;
      for (let j = 1; j < classMembersData.length; j++) {
        // uuid, class_id, seat_number, student_name, student_email, user_id
        if (classMembersData[j][1] === learningRecord.classId &&
            classMembersData[j][4] === studentInfo.email) {
          seatNumber = classMembersData[j][2];
          break;
        }
      }

      // 8. 取得班級名稱
      let className = '';
      for (let j = 0; j < teacherClasses.length; j++) {
        if (teacherClasses[j].classId === learningRecord.classId) {
          className = teacherClasses[j].className;
          break;
        }
      }

      // 9. 取得任務資訊（處理舊結構的後綴）
      let actualTaskId = taskId;
      let taskTier = '';
      let taskType = '';

      if (taskId.includes('_tutorial')) {
        actualTaskId = taskId.replace('_tutorial', '');
        taskTier = 'tutorial';
        taskType = 'tutorial';
      } else if (taskId.includes('_adventure')) {
        actualTaskId = taskId.replace('_adventure', '');
        taskTier = 'adventure';
        taskType = 'practice';
      } else if (taskId.includes('_hardcore')) {
        actualTaskId = taskId.replace('_hardcore', '');
        taskTier = 'hardcore';
        taskType = 'assessment';
      }

      let taskInfo = null;
      for (let j = 1; j < tasksData.length; j++) {
        if (tasksData[j][0] === actualTaskId) {
          // 舊結構：task_id, course_id, sequence, task_name, time_limit, tutorial_desc, ...
          const taskName = isNewStructure ? tasksData[j][3] : tasksData[j][3];
          const timeLimit = isNewStructure ? tasksData[j][5] : tasksData[j][4];
          const tokenReward = isNewStructure ? (tasksData[j][12] || 10) : (tasksData[j][11] || 10);

          // 層級顯示名稱
          let tierDisplay = '';
          if (taskTier === 'tutorial') tierDisplay = '基礎層';
          else if (taskTier === 'adventure') tierDisplay = '挑戰層';
          else if (taskTier === 'hardcore') tierDisplay = '困難層';
          else tierDisplay = taskTier;

          // 類型顯示名稱
          let typeDisplay = '';
          if (taskType === 'tutorial') typeDisplay = '教學';
          else if (taskType === 'practice') typeDisplay = '練習';
          else if (taskType === 'assessment') typeDisplay = '評量';
          else typeDisplay = taskType;

          taskInfo = {
            taskId: taskId,
            taskName: taskName,
            tier: taskTier,
            tierDisplay: tierDisplay,
            type: taskType,
            typeDisplay: typeDisplay,
            timeLimit: timeLimit || 600,  // 預設 10 分鐘
            tokenReward: tokenReward
          };
          break;
        }
      }

      if (!taskInfo) continue;

      // 10. 計算執行時間（考慮課堂暫停的累積時間）
      let executionTime = 0;
      const savedTimeSpent = (timeSpent && typeof timeSpent === 'number') ? timeSpent : 0;

      if (status === 'in_progress') {
        // 執行中：即時計算（現在時間 - 開始時間）+ 已累積時間
        if (startTime) {
          // 有 start_time：表示正在執行中
          const start = new Date(startTime).getTime();
          const now = new Date().getTime();
          const currentElapsed = Math.floor((now - start) / 1000);
          executionTime = savedTimeSpent + currentElapsed;  // 累加已保存的時間
        } else {
          // 無 start_time：表示課堂已結束，任務已凍結
          executionTime = savedTimeSpent;  // 直接使用已保存的時間
        }
      } else if (status === 'pending_review') {
        // 待審核：固定時間（提交時間 - 開始時間）
        if (savedTimeSpent > 0) {
          executionTime = savedTimeSpent;
        } else if (startTime && completeTime) {
          const start = new Date(startTime).getTime();
          const end = new Date(completeTime).getTime();
          executionTime = Math.floor((end - start) / 1000);  // 秒數
        }
      }

      // 11. 判斷是否超時（只有設置了時間限制才判斷）
      const isOvertime = taskInfo.timeLimit > 0 && executionTime > taskInfo.timeLimit;

      // 12. 計算等待審核時間（只針對 pending_review 狀態）
      let waitingTime = null;
      if (status === 'pending_review' && completeTime) {
        const now = new Date();
        const submit = new Date(completeTime);
        const waitingSeconds = Math.floor((now.getTime() - submit.getTime()) / 1000);

        // 格式化等待時間
        const waitingMinutes = Math.floor(waitingSeconds / 60);
        const waitingSecs = waitingSeconds % 60;
        const formattedWaitingTime = waitingMinutes > 0
          ? `${waitingMinutes}分${waitingSecs}秒`
          : `${waitingSecs}秒`;

        // 判斷優先級（超過5分鐘標記為高優先級）
        const priority = waitingSeconds > 300 ? 'high' : 'normal';

        waitingTime = {
          seconds: waitingSeconds,
          formatted: formattedWaitingTime,
          priority: priority
        };

        Logger.log(`⏰ 計算等待時間: taskProgressId=${progressId}, 等待=${waitingSeconds}秒 (${formattedWaitingTime})`);
      } else if (status === 'pending_review') {
        Logger.log(`⚠️ 待審核任務沒有 completeTime: taskProgressId=${progressId}, completeTime=${completeTime}`);
      }

      // 13. 組裝監控資料
      monitorTasks.push({
        taskProgressId: progressId,
        studentName: studentInfo.name,
        studentEmail: studentInfo.email,
        studentNumber: seatNumber || '-',
        className: className,
        classId: learningRecord.classId,
        taskName: taskInfo.taskName,
        taskId: taskInfo.taskId,
        tier: taskInfo.tier,
        tierDisplay: taskInfo.tierDisplay,
        type: taskInfo.type,
        typeDisplay: taskInfo.typeDisplay,
        status: status,
        startTime: startTime || '',
        submitTime: completeTime || '',
        executionTime: executionTime,
        timeSpent: savedTimeSpent,  // 添加累積時間字段（前端需要用於即時更新）
        timeLimit: taskInfo.timeLimit,
        isOvertime: isOvertime,
        tokenReward: taskInfo.tokenReward,
        waitingTime: waitingTime  // 等待審核時間（只有 pending_review 時才有值）
      });
    }

    // 按等待時間排序（待審核任務的等待時間最久的在前，執行中任務排在後面）
    monitorTasks.sort((a, b) => {
      // 優先顯示待審核任務
      if (a.status === 'pending_review' && b.status !== 'pending_review') return -1;
      if (a.status !== 'pending_review' && b.status === 'pending_review') return 1;

      // 如果都是待審核，按等待時間排序（最久的在前）
      if (a.status === 'pending_review' && b.status === 'pending_review') {
        const timeA = a.waitingTime ? a.waitingTime.seconds : 0;
        const timeB = b.waitingTime ? b.waitingTime.seconds : 0;
        return timeB - timeA;
      }

      // 如果都是執行中，按開始時間排序（最早開始的在前）
      const timeA = a.startTime ? new Date(a.startTime).getTime() : 0;
      const timeB = b.startTime ? new Date(b.startTime).getTime() : 0;
      return timeA - timeB;
    });

    Logger.log('✅ 取得任務監控資料成功:', {
      teacherEmail: email,
      classId: classId || '全部',
      count: monitorTasks.length
    });

    return {
      success: true,
      tasks: monitorTasks,
      classes: teacherClasses  // 回傳教師的所有班級（用於班級選擇器）
    };

  } catch (error) {
    Logger.log('❌ 取得任務監控資料失敗：' + error);
    return {
      success: false,
      message: '取得失敗：' + error.message,
      tasks: [],
      classes: []
    };
  }
}


/**
 * 教師審核通過任務
 */
function approveTask(params) {
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(30000);

    const { teacherEmail, taskProgressId } = params;

    if (!teacherEmail || !taskProgressId) {
      throw new Error('缺少必要參數');
    }

    const email = getCurrentUserEmail(teacherEmail);

    const ss = getSpreadsheet();
    const progressSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.TASK_PROGRESS);
    const learningSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.LEARNING_RECORDS);
    const tasksSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.TASKS);
    const usersSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.USERS);

    // 1. 找到任務進度記錄
    const progressData = progressSheet.getDataRange().getValues();
    let progressRow = -1;
    let recordId = null;
    let taskId = null;

    for (let i = 1; i < progressData.length; i++) {
      if (progressData[i][0] === taskProgressId) {
        if (progressData[i][3] !== 'pending_review') {
          throw new Error('此任務不是待審核狀態');
        }
        progressRow = i + 1;
        recordId = progressData[i][1];
        taskId = progressData[i][2];
        break;
      }
    }

    if (progressRow === -1) {
      throw new Error('找不到任務進度記錄');
    }

    // 2. 取得學習記錄
    const learningData = learningSheet.getDataRange().getValues();
    let learningRow = -1;
    let userId = null;
    let completedTasks = 0;
    let totalTasks = 0;

    for (let i = 1; i < learningData.length; i++) {
      if (learningData[i][0] === recordId) {
        learningRow = i + 1;
        userId = learningData[i][1];
        completedTasks = learningData[i][8] || 0;
        totalTasks = learningData[i][9] || 0;
        break;
      }
    }

    if (learningRow === -1) {
      throw new Error('找不到學習記錄');
    }

    // 3. 取得任務的代幣獎勵
    const tasksData = tasksSheet.getDataRange().getValues();
    let tokenReward = 0;
    let actualTaskId = taskId;

    if (taskId.includes('_tutorial')) {
      actualTaskId = taskId.replace('_tutorial', '');
    } else if (taskId.includes('_adventure')) {
      actualTaskId = taskId.replace('_adventure', '');
    } else if (taskId.includes('_hardcore')) {
      actualTaskId = taskId.replace('_hardcore', '');
    }

    const isNewStructure = tasksData.length > 0 &&
                           tasksData[0][4] &&
                           (tasksData[0][4].toString().toLowerCase().includes('tier') ||
                            tasksData[0][4].toString().toLowerCase().includes('層'));

    for (let i = 1; i < tasksData.length; i++) {
      if (tasksData[i][0] === actualTaskId) {
        tokenReward = isNewStructure ? (tasksData[i][6] || 0) : (tasksData[i][11] || 10);
        break;
      }
    }

    // 4. 更新任務進度狀態為完成
    progressSheet.getRange(progressRow, 4).setValue('completed');

    // 5. 更新學習記錄的完成任務數
    completedTasks++;
    learningSheet.getRange(learningRow, 9).setValue(completedTasks);
    learningSheet.getRange(learningRow, 6).setValue(new Date());

    // 如果完成所有任務，更新狀態為 completed
    if (completedTasks >= totalTasks) {
      learningSheet.getRange(learningRow, 8).setValue('completed');
    }

    // 6. 發放代幣獎勵
    const usersData = usersSheet.getDataRange().getValues();
    for (let i = 1; i < usersData.length; i++) {
      if (usersData[i][0] === userId) {
        const currentTokens = usersData[i][8] || 0;
        const newTokens = currentTokens + tokenReward;
        usersSheet.getRange(i + 1, 9).setValue(newTokens);

        Logger.log('✅ 審核通過任務成功:', { taskProgressId, userId, tokenReward, newTokens });

        return {
          success: true,
          message: `審核通過！學生獲得 ${tokenReward} 個代幣`,
          tokensAwarded: tokenReward
        };
      }
    }

    throw new Error('找不到學生資訊');

  } catch (error) {
    Logger.log('❌ 審核任務失敗：' + error);
    return {
      success: false,
      message: '審核失敗：' + error.message
    };
  } finally {
    lock.releaseLock();
  }
}


/**
 * 教師退回任務
 */
function rejectTask(params) {
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(30000);

    const { teacherEmail, taskProgressId, reason } = params;

    if (!teacherEmail || !taskProgressId) {
      throw new Error('缺少必要參數');
    }

    const email = getCurrentUserEmail(teacherEmail);

    const ss = getSpreadsheet();
    const progressSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.TASK_PROGRESS);

    // 找到任務進度記錄
    const progressData = progressSheet.getDataRange().getValues();
    let progressRow = -1;

    for (let i = 1; i < progressData.length; i++) {
      if (progressData[i][0] === taskProgressId) {
        if (progressData[i][3] !== 'pending_review') {
          throw new Error('此任務不是待審核狀態');
        }
        progressRow = i + 1;
        break;
      }
    }

    if (progressRow === -1) {
      throw new Error('找不到任務進度記錄');
    }

    // 更新狀態為 in_progress（讓學生可以重新提交）
    progressSheet.getRange(progressRow, 4).setValue('in_progress');

    // 設置新的 start_time（教師端可以立即看到重新計時）
    // 保留 time_spent（已花費的時間會保留）
    progressSheet.getRange(progressRow, 5).setValue(new Date());  // 設置新的 start_time

    // TODO: 如果需要記錄退回原因，可以在這裡添加新的欄位
    // 目前暫時只記錄在 Logger 中
    Logger.log('✅ 退回任務成功:', { taskProgressId, reason: reason || '無' });

    return {
      success: true,
      message: '任務已退回，學生可以重新提交',
      reason: reason || '請重新完成任務'
    };

  } catch (error) {
    Logger.log('❌ 退回任務失敗：' + error);
    return {
      success: false,
      message: '退回失敗：' + error.message
    };
  } finally {
    lock.releaseLock();
  }
}


// ==========================================
// 課堂控制系統（階段 2）
// ==========================================

/**
 * 開始上課（創建課堂 Session）
 */
function startClassSession(params) {
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(30000);

    const { teacherEmail, classId } = params;

    if (!teacherEmail || !classId) {
      throw new Error('缺少必要參數');
    }

    const email = getCurrentUserEmail(teacherEmail);

    const ss = getSpreadsheet();
    const sessionsSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.CLASS_SESSIONS);
    const classesSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.CLASSES);

    // 1. 驗證班級是否存在且屬於該教師
    const classesData = classesSheet ? classesSheet.getDataRange().getValues() : [];
    let classExists = false;
    let className = '';

    for (let i = 1; i < classesData.length; i++) {
      if (classesData[i][0] === classId && hasClassPermission(classesData[i], email)) {
        classExists = true;
        className = classesData[i][1];
        break;
      }
    }

    if (!classExists) {
      throw new Error('找不到班級或您沒有權限');
    }

    // 2. 檢查該班級是否已有進行中的 session（同一班級同時只能有一個 active session）
    const sessionsData = sessionsSheet ? sessionsSheet.getDataRange().getValues() : [];

    for (let i = 1; i < sessionsData.length; i++) {
      if (sessionsData[i][1] === classId && sessionsData[i][5] === 'active') {
        // 找到進行中的 session，先結束它
        const oldSessionRow = i + 1;
        sessionsSheet.getRange(oldSessionRow, 5).setValue(new Date()); // end_time
        sessionsSheet.getRange(oldSessionRow, 6).setValue('ended'); // status
        Logger.log('⚠️ 自動結束舊的 session:', sessionsData[i][0]);
      }
    }

    // 3. 生成新的 session_id（格式：SESSION_班級ID_時間戳記）
    const timestamp = new Date().getTime();
    const dateStr = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyyMMddHHmmss');
    const sessionId = `SESSION_${classId}_${dateStr}`;

    // 4. 取得課程 ID（從授課安排表）
    const assignmentsSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.ASSIGNMENTS);
    const assignmentsData = assignmentsSheet ? assignmentsSheet.getDataRange().getValues() : [];
    let courseId = null;

    for (let i = 1; i < assignmentsData.length; i++) {
      if (assignmentsData[i][1] === classId) {
        courseId = assignmentsData[i][2];
        break;
      }
    }

    // 5. 插入新的 session 記錄
    const now = new Date();
    const newRow = [
      sessionId,       // session_id
      classId,         // class_id
      email,           // teacher_email
      now,             // start_time
      null,            // end_time (NULL = 進行中)
      'active',        // status
      courseId || '',  // course_id
      now              // create_date
    ];

    sessionsSheet.appendRow(newRow);

    // 6. 重新恢復該班級所有 in_progress 的任務時間累計（設置 start_time）
    // 目的：確保課堂暫停重啟時，時間能繼續從累積時間開始計算
    const learningSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.LEARNING_RECORDS);
    const progressSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.TASK_PROGRESS);

    if (learningSheet && progressSheet) {
      const learningData = learningSheet.getDataRange().getValues();
      const progressData = progressSheet.getDataRange().getValues();

      // 找出這個班級的所有學習記錄
      const classRecordIds = [];
      for (let i = 1; i < learningData.length; i++) {
        if (learningData[i][2] === classId) {  // class_id 匹配
          classRecordIds.push(learningData[i][0]);  // record_id
        }
      }

      // 恢復這些記錄下所有執行中的任務時間軌道
      let recoveredTaskCount = 0;
      for (let i = 1; i < progressData.length; i++) {
        const recordId = progressData[i][1];
        const status = progressData[i][3];
        const startTime = progressData[i][4];

        // 只處理這個班級的執行中任務且沒有開始時間的
        if (classRecordIds.includes(recordId) && status === 'in_progress' && !startTime) {
          // 設置新的開始時間，使時間繼續累計
          progressSheet.getRange(i + 1, 5).setValue(now);  // 設置 start_time = 課堂開始時間
          recoveredTaskCount++;

          Logger.log(`⏱️ 恢復任務時間軌道: recordId=${recordId}, 累積時間=${progressData[i][6]}秒`);
        }
      }

      if (recoveredTaskCount > 0) {
        Logger.log(`✅ 已恢復 ${recoveredTaskCount} 個執行中任務的時間軌道`);
      }
    }

    Logger.log('✅ 開始上課成功:', {
      sessionId: sessionId,
      classId: classId,
      className: className,
      teacherEmail: email
    });

    return {
      success: true,
      message: `已開始上課：${className}`,
      session: {
        sessionId: sessionId,
        classId: classId,
        className: className,
        startTime: now.toISOString(),
        status: 'active'
      }
    };

  } catch (error) {
    Logger.log('❌ 開始上課失敗：' + error);
    return {
      success: false,
      message: '開始上課失敗：' + error.message
    };
  } finally {
    lock.releaseLock();
  }
}


/**
 * 結束上課（結束課堂 Session）
 */
function endClassSession(params) {
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(30000);

    const { teacherEmail, sessionId } = params;

    if (!teacherEmail || !sessionId) {
      throw new Error('缺少必要參數');
    }

    const email = getCurrentUserEmail(teacherEmail);

    const ss = getSpreadsheet();
    const sessionsSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.CLASS_SESSIONS);

    // 1. 找到 session 記錄
    const sessionsData = sessionsSheet ? sessionsSheet.getDataRange().getValues() : [];
    let sessionRow = -1;
    let sessionData = null;

    for (let i = 1; i < sessionsData.length; i++) {
      if (sessionsData[i][0] === sessionId && sessionsData[i][2] === email) {
        if (sessionsData[i][5] !== 'active') {
          throw new Error('此課堂已結束');
        }
        sessionRow = i + 1;
        sessionData = sessionsData[i];
        break;
      }
    }

    if (sessionRow === -1) {
      throw new Error('找不到課堂記錄或您沒有權限');
    }

    const classId = sessionData[1];

    // 2. 保存所有執行中任務的時間（重要！防止課間休息時間被計入）
    const learningSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.LEARNING_RECORDS);
    const progressSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.TASK_PROGRESS);

    if (learningSheet && progressSheet) {
      const learningData = learningSheet.getDataRange().getValues();
      const progressData = progressSheet.getDataRange().getValues();

      const now = new Date();
      let frozenTaskCount = 0;

      // 找出這個班級的所有學習記錄
      const classRecordIds = [];
      for (let i = 1; i < learningData.length; i++) {
        if (learningData[i][2] === classId) {  // class_id 匹配
          classRecordIds.push(learningData[i][0]);  // record_id
        }
      }

      // 凍結這些記錄下所有執行中的任務時間
      for (let i = 1; i < progressData.length; i++) {
        const recordId = progressData[i][1];
        const status = progressData[i][3];
        const startTime = progressData[i][4];
        const currentTimeSpent = progressData[i][6] || 0;

        // 只處理這個班級的執行中任務
        if (classRecordIds.includes(recordId) && status === 'in_progress' && startTime) {
          // 計算當前執行時間：(現在 - 開始時間) + 已累積時間
          const start = new Date(startTime).getTime();
          const elapsed = Math.floor((now.getTime() - start) / 1000);
          const totalTimeSpent = currentTimeSpent + elapsed;

          // 保存時間並清空 start_time（避免累計課間休息時間）
          progressSheet.getRange(i + 1, 5).setValue('');  // 清空 start_time
          progressSheet.getRange(i + 1, 7).setValue(totalTimeSpent);  // 更新 time_spent

          frozenTaskCount++;

          Logger.log(`⏸️ 凍結任務時間: recordId=${recordId}, 累積時間=${totalTimeSpent}秒`);
        }
      }

      if (frozenTaskCount > 0) {
        Logger.log(`✅ 已凍結 ${frozenTaskCount} 個執行中任務的時間`);
      }
    }

    // 3. 更新 session 狀態
    const now = new Date();
    sessionsSheet.getRange(sessionRow, 5).setValue(now); // end_time
    sessionsSheet.getRange(sessionRow, 6).setValue('ended'); // status

    // 4. 計算上課時長
    const startTime = new Date(sessionData[3]);
    const duration = Math.floor((now.getTime() - startTime.getTime()) / 1000); // 秒數

    Logger.log('✅ 結束上課成功:', {
      sessionId: sessionId,
      classId: classId,
      duration: `${Math.floor(duration / 60)} 分 ${duration % 60} 秒`
    });

    return {
      success: true,
      message: '已結束上課',
      session: {
        sessionId: sessionId,
        classId: classId,
        startTime: startTime,
        endTime: now,
        duration: duration,
        status: 'ended'
      }
    };

  } catch (error) {
    Logger.log('❌ 結束上課失敗：' + error);
    return {
      success: false,
      message: '結束上課失敗：' + error.message
    };
  } finally {
    lock.releaseLock();
  }
}


/**
 * 取得當前課堂狀態（檢查是否上課中）
 */
function getCurrentSession(params) {
  try {
    const { classId, userEmail } = params;

    if (!classId) {
      throw new Error('缺少班級 ID');
    }

    const ss = getSpreadsheet();
    const sessionsSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.CLASS_SESSIONS);
    const classesSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.CLASSES);
    const classMembersSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.CLASS_MEMBERS);
    const usersSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.USERS);

    // 1. 驗證學生是否屬於該班級（防止選錯班級誤觸發）
    if (userEmail) {
      const email = getCurrentUserEmail(userEmail);

      // 取得 userId
      const usersData = usersSheet ? usersSheet.getDataRange().getValues() : [];
      let userId = null;

      for (let i = 1; i < usersData.length; i++) {
        if (usersData[i][2] === email) {
          userId = usersData[i][0];
          break;
        }
      }

      if (userId) {
        // 檢查該學生是否屬於這個班級
        const membersData = classMembersSheet ? classMembersSheet.getDataRange().getValues() : [];
        let isMemberOfClass = false;

        for (let i = 1; i < membersData.length; i++) {
          if (membersData[i][1] === classId && membersData[i][5] === userId) {
            isMemberOfClass = true;
            break;
          }
        }

        if (!isMemberOfClass) {
          Logger.log('⚠️ 學生不屬於該班級:', { userEmail: email, classId });
          return {
            success: true,
            isActive: false,
            message: '您不屬於此班級',
            notMember: true
          };
        }
      }
    }

    // 2. 找到班級名稱
    const classesData = classesSheet ? classesSheet.getDataRange().getValues() : [];
    let className = '';

    for (let i = 1; i < classesData.length; i++) {
      if (classesData[i][0] === classId) {
        className = classesData[i][1];
        break;
      }
    }

    // 3. 檢查是否有進行中的 session
    const sessionsData = sessionsSheet ? sessionsSheet.getDataRange().getValues() : [];

    for (let i = 1; i < sessionsData.length; i++) {
      if (sessionsData[i][1] === classId && sessionsData[i][5] === 'active') {
        // 找到進行中的 session
        const sessionId = sessionsData[i][0];
        const teacherEmail = sessionsData[i][2];
        const startTime = sessionsData[i][3];
        const courseId = sessionsData[i][6];

        // 計算已進行時長
        const now = new Date();
        const start = new Date(startTime);
        const elapsed = Math.floor((now.getTime() - start.getTime()) / 1000); // 秒數

        Logger.log('✅ 找到進行中的課堂:', { sessionId, classId });

        return {
          success: true,
          isActive: true,
          session: {
            sessionId: sessionId,
            classId: classId,
            className: className,
            teacherEmail: teacherEmail,
            startTime: startTime,
            elapsed: elapsed,
            status: 'active',
            courseId: courseId
          }
        };
      }
    }

    // 4. 沒有進行中的 session
    Logger.log('ℹ️ 班級目前未上課:', { classId });

    return {
      success: true,
      isActive: false,
      message: '目前沒有進行中的課堂',
      className: className
    };

  } catch (error) {
    Logger.log('❌ 檢查課堂狀態失敗：' + error);
    return {
      success: false,
      message: '檢查失敗：' + error.message,
      isActive: false
    };
  }
}


// ==========================================
// 難度變更記錄系統
// ==========================================

/**
 * 記錄難度變更 (修正版：自動查找 from_tier，確保歷程完整)
 */
function recordDifficultyChange(params) {
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(30000);

    const { userEmail, recordId, courseId, toTier, changeReason, triggeredByTask, executionTime } = params;

    // 驗證必填參數 (注意：我們不再強制要求前端傳 fromTier，因為我們要自己查)
    if (!userEmail || !recordId || !courseId || !toTier) {
      throw new Error('缺少必要參數');
    }

    const email = getCurrentUserEmail(userEmail);
    const ss = getSpreadsheet();
    const changesSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.DIFFICULTY_CHANGES); // 確保 Sheet 名稱正確: 'Difficulty_Changes'
    const learningSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.LEARNING_RECORDS);
    const usersSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.USERS);

    if (!changesSheet) throw new Error('找不到難度變更記錄表 (Difficulty_Changes)');

    // 1. 取得 userId
    const usersData = usersSheet.getDataRange().getValues();
    let userId = null;
    for (let i = 1; i < usersData.length; i++) {
      if (usersData[i][2] === email) {
        userId = usersData[i][0];
        break;
      }
    }
    if (!userId) throw new Error('找不到使用者資訊');

    // 2. 查找學習記錄，並獲取「原本的難度 (from_tier)」
    const learningData = learningSheet.getDataRange().getValues();
    const headers = learningData[0];
    
    // 動態尋找欄位索引
    const idCol = 0; // record_id 預設在第1欄
    let currentTierCol = headers.indexOf('current_tier');
    
    if (currentTierCol === -1) {
      // 如果找不到 current_tier 欄位，嘗試找最後一欄或報錯
      // 建議你在 Sheet 裡明確加上 current_tier 標題
      currentTierCol = learningSheet.getLastColumn() - 1; 
    }

    let learningRowIndex = -1;
    let dbFromTier = ''; // 這就是我們要找的「原本難度」

    for (let i = 1; i < learningData.length; i++) {
      if (String(learningData[i][idCol]) === String(recordId)) {
        learningRowIndex = i + 1; // 實際列號 (從1開始)
        dbFromTier = learningData[i][currentTierCol]; // 抓取原本存在 DB 的難度
        break;
      }
    }

    if (learningRowIndex === -1) throw new Error('找不到對應的 recordId');

    // 3. 執行更新與記錄
    // 更新學習記錄表為「新的難度」
    learningSheet.getRange(learningRowIndex, currentTierCol + 1).setValue(toTier);
    Logger.log(`✅ 更新 Current Tier: ${dbFromTier} -> ${toTier}`);

    // 寫入變更歷程
    const changeId = 'change_' + Utilities.getUuid();
    const now = new Date();

    const newChange = [
      changeId,
      recordId,
      userId,
      courseId,
      dbFromTier || 'initial', // 如果原本沒值，標記為 initial (初始選擇)
      toTier,
      changeReason || 'manual',
      now,
      triggeredByTask || '',
      executionTime || 0
    ];

    changesSheet.appendRow(newChange);

    return {
      success: true,
      message: '難度變更已記錄',
      changeId: changeId,
      fromTier: dbFromTier,
      toTier: toTier
    };

  } catch (error) {
    Logger.log('❌ 記錄難度變更失敗：' + error);
    return { success: false, message: '記錄失敗：' + error.message };
  } finally {
    lock.releaseLock();
  }
}

/**
 * 取得難度變更歷史
 */
function getDifficultyChangeHistory(params) {
  try {
    const { recordId } = params;

    if (!recordId) {
      throw new Error('缺少學習記錄 ID');
    }

    const ss = getSpreadsheet();
    const changesSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.DIFFICULTY_CHANGES);

    if (!changesSheet) {
      return {
        success: true,
        changes: [],
        message: '難度變更記錄表不存在'
      };
    }

    const changesData = changesSheet.getDataRange().getValues();
    const changes = [];

    // 找出該學習記錄的所有變更
    for (let i = 1; i < changesData.length; i++) {
      if (changesData[i][1] === recordId) {  // record_id 在第2欄
        changes.push({
          changeId: changesData[i][0],
          recordId: changesData[i][1],
          userId: changesData[i][2],
          courseId: changesData[i][3],
          fromTier: changesData[i][4],
          toTier: changesData[i][5],
          changeReason: changesData[i][6],
          changeTime: changesData[i][7],
          triggeredByTask: changesData[i][8],
          executionTime: changesData[i][9]
        });
      }
    }

    // 按時間倒序排列（最新的在前）
    changes.sort((a, b) => {
      const timeA = new Date(a.changeTime).getTime();
      const timeB = new Date(b.changeTime).getTime();
      return timeB - timeA;
    });

    Logger.log('✅ 取得難度變更歷史:', { recordId, count: changes.length });

    return {
      success: true,
      changes: changes,
      count: changes.length
    };

  } catch (error) {
    Logger.log('❌ 取得難度變更歷史失敗：' + error);
    return {
      success: false,
      message: '取得失敗：' + error.message,
      changes: []
    };
  }
}



// ==========================================
// 自檢清單與答案處理模組
// ==========================================

/**
 * 獲取任務的檢查清單與參考答案
 */
function getTaskChecklistsAndAnswer(params) {
  try {
    const { taskId, userEmail } = params;

    if (!taskId) {
      throw new Error('缺少任務 ID');
    }

    const ss = getSpreadsheet();
    const checklistSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.TASK_CHECKLISTS);
    const answerSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.TASK_REFERENCE_ANSWERS);

    if (!checklistSheet || !answerSheet) {
      throw new Error('找不到檢查清單或答案工作表');
    }

    // 1. 獲取檢查清單資料
    const checklistData = checklistSheet.getDataRange().getValues();
    const checklists = [];

    for (let i = 1; i < checklistData.length; i++) {
      if (String(checklistData[i][1]) === String(taskId)) { // 強制轉字串比較，防呆
        checklists.push({
          checklistId: checklistData[i][0],
          taskId: checklistData[i][1],
          itemOrder: checklistData[i][2],
          itemTitle: checklistData[i][3],
          description: checklistData[i][4] // 確保前端讀取 description
        });
      }
    }

    // 排序檢查清單
    checklists.sort((a, b) => a.itemOrder - b.itemOrder);

    // 2. 獲取參考答案資料
    const answerData = answerSheet.getDataRange().getValues();
    
    // 預設值
    let answerText = '無參考答案';
    let answerImages = []; // 保持為陣列

    for (let i = 1; i < answerData.length; i++) {
      if (String(answerData[i][1]) === String(taskId)) { // 強制轉字串比較
        // 抓取文字 (C欄)
        answerText = answerData[i][2]; 
        
        // 抓取圖片 (D欄)
        const rawImg = answerData[i][3];
        if (rawImg && String(rawImg).trim() !== '') {
             if (String(rawImg).includes('|')) answerImages = String(rawImg).split('|');
             else answerImages = [String(rawImg)];
        }
        break; 
      }
    }

    Logger.log(`已獲取: taskId=${taskId}, 清單數=${checklists.length}, 圖片數=${answerImages.length}`);

    // 🔥 關鍵修正：將資料「扁平化」回傳，符合前端 renderCheckStage 的預期
    return {
      success: true,
      checklists: checklists,
      // 直接回傳這兩個欄位，不要包在 answer 物件裡
      referenceAnswer: answerText,  
      referenceImages: answerImages 
    };

  } catch (error) {
    Logger.log('獲取檢查清單時發生錯誤: ' + error);
    return {
      success: false,
      message: '獲取失敗: ' + error.message
    };
  }
}

/**
 * 提交自主檢查 (最終修正版：先用 ProgressID 反查 TaskID)
 */
function submitSelfCheck(params) {
  const lock = LockService.getScriptLock();
  
  // 初始化 Log
  const debugLogs = [];
  const log = (msg) => {
      Logger.log(msg);
      debugLogs.push(msg);
  };

  try {
    lock.waitLock(30000);

    const { taskProgressId, checklistData, scenarioType, errorExplanation, userEmail } = params;

    if (!taskProgressId || !checklistData) throw new Error('缺少必要參數');

    // 這是前端傳來的 ID (根據 Log，它是 prog_...)
    const incomingId = String(taskProgressId).trim();
    const targetEmail = String(userEmail).trim().toLowerCase();

    log(`🔍 [SubmitSelfCheck] 收到請求，ID: [${incomingId}]`);

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const progressSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.TASK_PROGRESS);
    const usersSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.USERS);
    const learningSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.LEARNING_RECORDS);
    const checkRecordSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.SELF_CHECK_RECORDS);
    const questionsSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.TASK_QUESTIONS);
    const tasksSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.TASKS);
    const membersSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.CLASS_MEMBERS);

    // ============================================================
    // 1. 核心修正：利用 ProgressID 反查真正的 TaskID 和 Row
    // ============================================================
    let realTaskId = null;
    let progressRow = -1;
    let userId = null; // 稍後用來寫入檢查紀錄
    
    // 先讀取 Progress 表
    const pData = progressSheet.getDataRange().getValues();
    
    // 掃描 Progress 表尋找這一筆 prog_id
    for (let i = 1; i < pData.length; i++) {
        // A欄是 prog_id
        if (String(pData[i][0]).trim() === incomingId) {
            progressRow = i + 1;
            realTaskId = String(pData[i][2]).trim(); // C欄是真正的 task_id
            log(`✅ 找到進度列 (Row ${progressRow}) -> 反查出 TaskID: [${realTaskId}]`);
            break;
        }
    }

    // 如果找不到 prog_id，嘗試把它當作 task_id 找找看 (容錯)
    if (!realTaskId) {
        log(`⚠️ 用 ProgressID 找不到，嘗試直接將 [${incomingId}] 視為 TaskID...`);
        // 這時我們還不知道 Row 是多少，後面再透過 User+TaskID 去找
        realTaskId = incomingId;
    }

    // ============================================================
    // 2. 身分驗證 (為了寫入 CheckRecord)
    // ============================================================
    const usersData = usersSheet.getDataRange().getValues();
    for (let i = 1; i < usersData.length; i++) {
      if (String(usersData[i][2]).trim().toLowerCase() === targetEmail) {
        userId = usersData[i][0];
        break;
      }
    }
    if (!userId) throw new Error('找不到使用者資訊');

    // ============================================================
    // 3. 寫入自主檢查紀錄 (使用 realTaskId)
    // ============================================================
    let items = checklistData;
    if (typeof items === 'string') { try { items = JSON.parse(items); } catch (e) { items = []; } }
    const now = new Date();

    if (checkRecordSheet) {
      const recordsToAdd = items.map(item => [
        'check_' + Utilities.getUuid().slice(0, 8), 
        realTaskId, // 🔥 這裡存真正的 TaskID
        userEmail || 'unknown', 
        userId,
        item.checklistId, 
        item.isChecked ? 'Pass' : 'Fail', 
        item.isChecked ? '' : errorExplanation, 
        now
      ]);
      if (recordsToAdd.length > 0) {
        const lastRow = Math.max(checkRecordSheet.getLastRow(), 1);
        checkRecordSheet.getRange(lastRow + 1, 1, recordsToAdd.length, recordsToAdd[0].length).setValues(recordsToAdd);
        log(`📝 檢查紀錄已寫入 (${items.length} 筆)`);
      }
    }

    // ============================================================
    // 4. 檢查是否有評量題目 (使用 realTaskId)
    // ============================================================
    let hasQuestion = false;
    
    if (questionsSheet) {
      const qData = questionsSheet.getDataRange().getValues();
      for (let i = 1; i < qData.length; i++) {
        // 掃描 A 欄和 B 欄
        const colA = String(qData[i][0]).trim();
        const colB = String(qData[i][1]).trim();
        
        if (colA === realTaskId || colB === realTaskId) {
          hasQuestion = true;
          log(`✅ 找到評量題目 (TaskID匹配)`);
          break;
        }
      }
    }

    log(`📊 判定結果: HasQuestion=${hasQuestion}`);

    // ============================================================
    // 5. 再次確認進度列 (如果是用容錯邏輯進來的，progressRow可能還是-1)
    // ============================================================
    if (progressRow === -1) {
        // 如果前面沒用 prog_id 找到，現在用 TaskID + User 再找一次
        const learningData = learningSheet.getDataRange().getValues();
        const userRecordIds = [];
        for (let i = 1; i < learningData.length; i++) {
            if (String(learningData[i][1]) === String(userId)) userRecordIds.push(String(learningData[i][0])); 
        }

        for (let i = 1; i < pData.length; i++) {
            const rowRecordId = String(pData[i][1]);
            const rowTaskId = String(pData[i][2]).trim();
            const rowStatus = String(pData[i][3]);

            if (rowTaskId === realTaskId && userRecordIds.includes(rowRecordId) && rowStatus !== 'completed') {
                progressRow = i + 1;
                log(`📍 透過 TaskID+User 重新鎖定進度列: Row ${progressRow}`);
                break; 
            }
        }
    }

    if (progressRow === -1) {
        log(`❌ 嚴重錯誤：找不到可更新的進度列！`);
        // 雖然找不到列無法更新，但為了不讓前端卡死，我們還是回傳 nextStep
    }

    // ============================================================
    // 6. 狀態路由與更新
    // ============================================================
    let nextStep = '';
    let questionResult = null;

    if (hasQuestion) {
        // 分岔 A：有題目 -> 改為 assessment
        if (progressRow > 0) {
            progressSheet.getRange(progressRow, 4).setValue('assessment');
            progressSheet.getRange(progressRow, 9).setValue(scenarioType);
        }
        nextStep = 'assessment';
        questionResult = getRandomQuestionForTask(ss, realTaskId); // 用 realTaskId 抽題
        log(`➡️ 更新狀態為 assessment`);
    
    } else {
        // 分岔 B：沒題目 -> 直接完成
        if (progressRow > 0) {
            progressSheet.getRange(progressRow, 4).setValue('completed');
            progressSheet.getRange(progressRow, 6).setValue(now);
            progressSheet.getRange(progressRow, 9).setValue(scenarioType);
            progressSheet.getRange(progressRow, 10).setValue(true);
            log(`➡️ 更新狀態為 completed`);

            // 發放獎勵
            let tokenReward = 0;
            if (tasksSheet) {
                const tData = tasksSheet.getDataRange().getValues();
                for(let k=1; k<tData.length; k++){
                    if(String(tData[k][0]) === realTaskId){
                        tokenReward = Number(tData[k][11]) || 0;
                        break;
                    }
                }
            }
            if (membersSheet) {
                const mData = membersSheet.getDataRange().getValues();
                for(let m=1; m<mData.length; m++){
                    if(String(mData[m][4]) === targetEmail){
                        const current = Number(mData[m][5]) || 0;
                        membersSheet.getRange(m+1, 6).setValue(current + tokenReward);
                        break;
                    }
                }
            }
        }
        nextStep = 'completed';
    }

    return {
        success: true,
        nextStep: nextStep,
        scenarioType: scenarioType,
        question: questionResult,
        debugLogs: debugLogs
    };

  } catch (error) {
    log('❌ 發生錯誤: ' + error.message);
    return { success: false, message: '系統錯誤: ' + error.message, debugLogs: debugLogs };
  } finally {
    lock.releaseLock();
  }
}

/**
 * 提交評量結果 (嚴謹版：答錯強制退回 in_progress)
 */
function submitAssessment(params) {
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(30000);

    const { taskProgressId, questionId, studentAnswer, userEmail } = params;

    if (!taskProgressId || !questionId || !studentAnswer) {
      throw new Error('缺少必要參數');
    }

    const email = getCurrentUserEmail(userEmail);

    const ss = getSpreadsheet();
    const progressSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.TASK_PROGRESS);
    const questionSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.TASK_QUESTIONS);
    const assessmentSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.TASK_ASSESSMENT_RECORDS);
    const usersSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.USERS);
    const tasksSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.TASKS);
    const membersSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.CLASS_MEMBERS);
    const learningSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.LEARNING_RECORDS);

    if (!progressSheet || !questionSheet || !assessmentSheet) {
      throw new Error('找不到必要工作表');
    }

    // 獲取 user_id
    const usersData = usersSheet.getDataRange().getValues();
    let userId = null;

    for (let i = 1; i < usersData.length; i++) {
      if (usersData[i][2] === email) {
        userId = usersData[i][0];
        break;
      }
    }

    if (!userId) {
      throw new Error('找不到使用者資訊');
    }

    // 查找題目並比對正確答案
    const questionData = questionSheet.getDataRange().getValues();
    let correctAnswer = null;

    for (let i = 1; i < questionData.length; i++) {
      if (questionData[i][0] === questionId) {
        correctAnswer = questionData[i][7];
        break;
      }
    }

    if (!correctAnswer) {
      throw new Error('找不到答案');
    }

    // 判斷答案是否正確
    const isCorrect = studentAnswer.toLowerCase() === correctAnswer.toLowerCase();

    // 計算測驗次數
    const assessmentData = assessmentSheet.getDataRange().getValues();
    let attemptNumber = 1;

    for (let i = 1; i < assessmentData.length; i++) {
      if (assessmentData[i][1] === taskProgressId) {
        attemptNumber = Math.max(attemptNumber, assessmentData[i][6] + 1);
      }
    }

    // 記錄測驗結果
    const assessmentId = generateUUID();
    assessmentSheet.appendRow([
      assessmentId,            // assessment_id
      taskProgressId,         // task_progress_id
      email,                   // student_email
      userId,                  // user_id
      questionId,              // question_id
      studentAnswer,           // student_answer
      isCorrect,               // is_correct
      attemptNumber,           // attempt_number
      new Date()               // attempt_time
    ]);

    Logger.log(`測驗記錄已儲存: taskProgressId=${taskProgressId}, isCorrect=${isCorrect}, attempt=${attemptNumber}`);

    // 如果答對
    if (isCorrect) {
      // 更新 TASK_PROGRESS
      const progressData = progressSheet.getDataRange().getValues();
      let progressRow = -1;
      let recordId = null;
      let taskId = null;

      for (let i = 1; i < progressData.length; i++) {
        if (progressData[i][0] === taskProgressId) {
          progressRow = i + 1;
          recordId = progressData[i][1];
          taskId = progressData[i][2];
          break;
        }
      }

      if (progressRow > 0) {
        progressSheet.getRange(progressRow, 4).setValue('completed');  // status = completed
        progressSheet.getRange(progressRow, 7).setValue(new Date());   // complete_time

        // 獲取自檢情境
        const selfCheckStatus = progressData[progressRow - 1][8];  // 第9欄

        // 計算獎勵
        let tokenReward = 0;
        const tasksData = tasksSheet.getDataRange().getValues();

        for (let i = 1; i < tasksData.length; i++) {
          if (tasksData[i][0] === taskId) {
            tokenReward = tasksData[i][11] || 100;  // token_reward

            // B情境加 10 TOKEN
            if (selfCheckStatus === 'B') {
              tokenReward += 10;
            }
            break;
          }
        }

        // 🪙 更新使用者資料表的 TOTAL_TOKENS（修正：原本錯誤地更新學員資料表）
        let userRow = -1;
        let currentTokens = 0;

        for (let i = 1; i < usersData.length; i++) {
          if (usersData[i][0] === userId) {  // 根據 user_id 找到使用者
            userRow = i + 1;
            currentTokens = usersData[i][8] || 0;  // total_tokens 在第9欄
            break;
          }
        }

        if (userRow > 0) {
          const newTotalTokens = currentTokens + tokenReward;
          usersSheet.getRange(userRow, 9).setValue(newTotalTokens);  // 更新 total_tokens
          Logger.log(`✅ 使用者 ${userId} 獲得 ${tokenReward} 代幣，總計：${newTotalTokens}`);
        } else {
          Logger.log(`⚠️ 找不到使用者 ${userId}，無法更新代幣`);
        }

        Logger.log(`任務完成: taskProgressId=${taskProgressId}, tokens=${tokenReward}, scenario=${selfCheckStatus}`);
      }

      return {
        success: true,
        isCorrect: true,
        message: '太棒了！答對了，任務完成！',
        tokenReward: tokenReward
      };

    } else {
      // 答錯：狀態改為 in_progress，不更新時間
      const progressData = progressSheet.getDataRange().getValues();

      for (let i = 1; i < progressData.length; i++) {
        if (progressData[i][0] === taskProgressId) {
          progressSheet.getRange(i + 1, 4).setValue('in_progress');  // status = in_progress
          break;
        }
      }

      Logger.log(`哎呀！測驗答錯: taskProgressId=${taskProgressId}, attempt=${attemptNumber}`);

      return {
        success: true,
        isCorrect: false,
        message: `答錯了，這是第 ${attemptNumber} 次測驗。請重新複習任務內容。`,
        attemptNumber: attemptNumber
      };
    }

  } catch (error) {
    Logger.log('提交測驗時發生錯誤: ' + error);
    return {
      success: false,
      message: '提交失敗: ' + error.message
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * 取得任務編輯器所需的資料：參考答案、檢核項目、題庫
 */
function getTaskDetailsForEditor(params) {
  try {
    const { taskId } = params;
    if (!taskId) throw new Error('缺少 taskId');

    const ss = getSpreadsheet();
    const checklistSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.TASK_CHECKLISTS);
    const answerSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.TASK_REFERENCE_ANSWERS);
    const questionSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.TASK_QUESTIONS);

    const result = {
      success: true,
      referenceAnswer: null,
      checklists: [],
      questions: []
    };

    if (answerSheet) {
      const ansData = answerSheet.getDataRange().getValues();
      for (let i = 1; i < ansData.length; i++) {
        if (ansData[i][1] === taskId) {
          result.referenceAnswer = {
            answerId: ansData[i][0],
            taskId: ansData[i][1],
            answerText: ansData[i][2],
            answerImages: ansData[i][3] ? ansData[i][3].split('|') : []
          };
          break;
        }
      }
    }

    if (checklistSheet) {
      const clData = checklistSheet.getDataRange().getValues();
      for (let i = 1; i < clData.length; i++) {
        if (clData[i][1] === taskId) {
          result.checklists.push({
            checklistId: clData[i][0],
            taskId: clData[i][1],
            itemOrder: clData[i][2],
            itemTitle: clData[i][3],
            itemDescription: clData[i][4]
          });
        }
      }
      result.checklists.sort((a,b)=>a.itemOrder - b.itemOrder);
    }

    if (questionSheet) {
      const qData = questionSheet.getDataRange().getValues();
      for (let i = 1; i < qData.length; i++) {
        if (qData[i][1] === taskId) {
          result.questions.push({
            questionId: qData[i][0],
            taskId: qData[i][1],
            questionText: qData[i][2],
            optionA: qData[i][3],
            optionB: qData[i][4],
            optionC: qData[i][5],
            optionD: qData[i][6],
            correctAnswer: qData[i][7]
          });
        }
      }
    }

    return result;
  } catch (error) {
    Logger.log('getTaskDetailsForEditor error: ' + error);
    return { success: false, message: '取得資料失敗：' + error.message };
  }
}

/**
 * 儲存檢核項目 (強制修正欄位數問題)
 */
function saveTaskChecklist(params) {
  try {
    const taskId = params.taskId;
    let checklists = params.checklists;

    if (!taskId) throw new Error('缺少 taskId');
    if (typeof checklists === 'string') {
      try { checklists = JSON.parse(checklists); } catch (e) {}
    }
    if (!Array.isArray(checklists)) throw new Error('checklists 格式錯誤');

    const ss = getSpreadsheet();
    const sheetName = SHEET_CONFIG.SHEETS.TASK_CHECKLISTS;
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) throw new Error('找不到檢核項目表: ' + sheetName);

    const all = sheet.getDataRange().getValues();
    
    // ✅ 強制定義 5 個標準標題
    const standardHeader = ['checklist_id', 'task_id', 'item_order', 'item_title', 'item_description'];
    const keep = [standardHeader];

    // 處理舊資料：只保留「非此 Task」的資料，且強制修剪為 5 欄
    // 從 i=1 開始跳過舊標題
    if (all.length > 1) {
      for (let i = 1; i < all.length; i++) {
        // 假設 task_id 在 index 1
        if (String(all[i][1]) !== String(taskId)) {
          let row = all[i].slice(0, 5); // ✂️ 強制切成 5 欄
          while (row.length < 5) row.push(""); // 不足補空
          keep.push(row);
        }
      }
    }

    // 加入新資料 (確保也是 5 欄)
    for (let item of checklists) {
      keep.push([
        item.checklistId || Utilities.getUuid(),
        taskId,
        item.itemOrder || 0,
        item.itemTitle || '',
        item.itemDescription || ''
      ]);
    }

    // 寫回
    sheet.clearContents();
    if (keep.length > 0) {
      // ✅ 明確指定寫入 5 欄寬度
      sheet.getRange(1, 1, keep.length, 5).setValues(keep);
    }

    return { success: true, message: '檢核項已儲存' };
  } catch (error) {
    Logger.log('saveTaskChecklist error: ' + error);
    return { success: false, message: '儲存失敗：' + error.message };
  }
}

/**
 * 儲存評量題庫
 */
function saveTaskQuestions(params) {
  try {
    const taskId = params.taskId;
    let questions = params.questions;

    if (!taskId) throw new Error('缺少 taskId');

    // 解析 JSON
    if (typeof questions === 'string') {
      try { questions = JSON.parse(questions); } catch (e) {}
    }
    if (!Array.isArray(questions)) throw new Error('questions 格式錯誤');

    const ss = getSpreadsheet();
    const sheetName = SHEET_CONFIG.SHEETS.TASK_QUESTIONS;
    let sheet = ss.getSheetByName(sheetName);
    
    // 如果沒有題庫表，自動建立
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      // 8 個欄位
      sheet.appendRow(['question_id', 'task_id', 'question_text', 'option_a', 'option_b', 'option_c', 'option_d', 'correct_answer']);
    }

    const all = sheet.getDataRange().getValues();
    const standardHeader = ['question_id', 'task_id', 'question_text', 'option_a', 'option_b', 'option_c', 'option_d', 'correct_answer'];
    const keep = [standardHeader];

    // 保留舊資料 (非此 Task 的題目)
    if (all.length > 1) {
      for (let i = 1; i < all.length; i++) {
        // 假設 task_id 在 index 1
        if (String(all[i][1]) !== String(taskId)) {
          let row = all[i].slice(0, 8); // 強制 8 欄
          while (row.length < 8) row.push("");
          keep.push(row);
        }
      }
    }

    // 加入新題目
    for (let q of questions) {
      keep.push([
        q.questionId || Utilities.getUuid(),
        taskId,
        q.questionText || '',
        q.optionA || '',
        q.optionB || '',
        q.optionC || '',
        q.optionD || '',
        q.correctAnswer || 'A'
      ]);
    }

    // 寫回
    sheet.clearContents();
    if (keep.length > 0) {
      sheet.getRange(1, 1, keep.length, 8).setValues(keep);
    }

    return { success: true, message: '題庫已儲存' };

  } catch (error) {
    Logger.log('saveTaskQuestions error: ' + error);
    return { success: false, message: '題庫儲存失敗：' + error.message };
  }
}

function saveTaskReferenceAnswer(params) {
  try {
    const { taskId, answerText, answerImages } = params;
    if (!taskId) throw new Error('缺少 taskId');

    const ss = getSpreadsheet();
    const sheetName = SHEET_CONFIG.SHEETS.TASK_REFERENCE_ANSWERS;
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) throw new Error('找不到參考答案表: ' + sheetName);

    // 處理圖片：如果是陣列轉字串，如果是字串則 trim
    let imagesString = '';
    if (Array.isArray(answerImages)) {
      imagesString = answerImages.join('|');
    } else if (typeof answerImages === 'string') {
      imagesString = answerImages;
    }

    const data = sheet.getDataRange().getValues();
    let found = false;
    
    // 假設 task_id 在 index 1
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][1]) === String(taskId)) {
        // 更新文字 (假設在 index 2) 與 圖片 (假設在 index 3)
        // 注意：請確認你的 Excel 欄位順序！
        sheet.getRange(i + 1, 3).setValue(answerText || '');
        sheet.getRange(i + 1, 4).setValue(imagesString || '');
        found = true;
        break;
      }
    }

    if (!found) {
      sheet.appendRow([Utilities.getUuid(), taskId, answerText || '', imagesString || '']);
    }

    return { success: true, message: '參考答案已儲存' };
  } catch (error) {
    return { success: false, message: '儲存失敗：' + error.message };
  }
}

/**
 * 新增或更新題目
 */
function addOrUpdateTaskQuestion(params) {
  try {
    const { taskId, question } = params;
    if (!taskId || !question) throw new Error('缺少參數');

    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.TASK_QUESTIONS);
    if (!sheet) throw new Error('找不到題庫表');

    const data = sheet.getDataRange().getValues();
    // 若提供 questionId 則更新
    if (question.questionId) {
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === question.questionId) {
          sheet.getRange(i+1,3).setValue(question.questionText || '');
          sheet.getRange(i+1,4).setValue(question.optionA || '');
          sheet.getRange(i+1,5).setValue(question.optionB || '');
          sheet.getRange(i+1,6).setValue(question.optionC || '');
          sheet.getRange(i+1,7).setValue(question.optionD || '');
          sheet.getRange(i+1,8).setValue(question.correctAnswer || '');
          return { success: true, message: '題目已更新' };
        }
      }
      // 若找不到，則當作新增
    }

    // 新增
    const qid = generateUUID();
    sheet.appendRow([qid, taskId, question.questionText || '', question.optionA || '', question.optionB || '', question.optionC || '', question.optionD || '', question.correctAnswer || '']);
    return { success: true, message: '題目已新增', questionId: qid };
  } catch (error) {
    Logger.log('addOrUpdateTaskQuestion error: ' + error);
    return { success: false, message: '儲存題目失敗：' + error.message };
  }
}

/**
 * 刪除題目
 */
function deleteTaskQuestion(params) {
  try {
    const { questionId } = params;
    if (!questionId) throw new Error('缺少 questionId');

    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.TASK_QUESTIONS);
    if (!sheet) throw new Error('找不到題庫表');

    const all = sheet.getDataRange().getValues();
    const header = all[0] || [];
    const keep = [header];
    for (let i = 1; i < all.length; i++) {
      if (all[i][0] !== questionId) keep.push(all[i]);
    }

    sheet.clearContents();
    if (keep.length > 0) sheet.getRange(1,1,keep.length, keep[0].length).setValues(keep);

    return { success: true, message: '題目已刪除' };
  } catch (error) {
    Logger.log('deleteTaskQuestion error: ' + error);
    return { success: false, message: '刪除題目失敗：' + error.message };
  }
}

/**
 * 輔助函式：從題庫中隨機撈一題
 * (這段程式碼必須存在，submitSelfCheck 和 submitTask 才能運作)
 */
function getRandomQuestionForTask(ss, taskId) {
  Logger.log(`🔍 [GetQuestion] 開始搜尋題目，目標 TaskID: ${taskId}`);

  if (!taskId) {
    Logger.log('❌ [GetQuestion] 失敗：TaskID 為空');
    return null;
  }

  const qSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.TASK_QUESTIONS);
  if (!qSheet) {
    Logger.log('❌ [GetQuestion] 失敗：找不到 TASK_QUESTIONS 表格');
    return null;
  }

  // 讀取所有題目資料
  const data = qSheet.getDataRange().getValues();
  const candidates = [];
  
  // 從第 2 列開始 (跳過標題)
  // 假設欄位結構: [0]q_id, [1]task_id, [2]text, [3]optA, [4]optB, [5]optC, [6]optD, [7]answer
  for (let i = 1; i < data.length; i++) {
    const rowTaskId = String(data[i][1]).trim(); // B欄 (Index 1) 為 TaskID
    const targetTaskId = String(taskId).trim();

    if (rowTaskId === targetTaskId) {
      candidates.push({
        questionId: data[i][0], // A欄
        questionText: data[i][2], // C欄
        // 組合選項陣列 [A, B, C, D]
        options: [data[i][3], data[i][4], data[i][5], data[i][6]].filter(opt => opt !== ''), 
        // 注意：絕對不要回傳正確答案 (Column H) 給前端
      });
    }
  }

  Logger.log(`✅ [GetQuestion] 篩選結束，符合的題目數量: ${candidates.length}`);

  if (candidates.length === 0) {
    Logger.log(`⚠️ [GetQuestion] 警告：任務 [${taskId}] 沒有對應的題目。`);
    return null;
  }

  // 隨機抽選一題
  const randomIndex = Math.floor(Math.random() * candidates.length);
  const selected = candidates[randomIndex];
  
  Logger.log(`🎉 [GetQuestion] 成功抽選題目 ID: ${selected.questionId}`);
  return selected;
}

/**
 * API: 獲取特定任務的評量題目 (用於恢復進度)
 */
function getTaskQuestion(params) {
  const { taskId, userEmail } = params;
  
  if (!taskId) {
    return { success: false, message: '缺少 TaskID' };
  }

  // 這裡可以加入權限驗證 (確認該學生狀態是否為 assessment)，
  // 但為了效能與容錯，我們直接回傳題目即可，前端會自己控制顯示時機。
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 使用現有的輔助函式抽題
  const questionResult = getRandomQuestionForTask(ss, taskId);

  if (questionResult) {
    return {
      success: true,
      question: questionResult,
      // 預設恢復為 A 情境 (除非去查 Progress 表，但影響不大)
      scenarioType: 'A' 
    };
  } else {
    return { success: false, message: '找不到此任務的題目' };
  }
}

/**
 * API: 獲取任務當前狀態與所需資料 (單一入口)
 * 前端點擊任務卡片時，呼叫這個就好
 */
function getTaskStateDetails(params) {
  const { taskId, userEmail } = params;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. 找 User
  const usersSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.USERS);
  let userId = null;
  const uData = usersSheet.getDataRange().getValues();
  for(let i=1; i<uData.length; i++) {
    if(String(uData[i][2]).trim().toLowerCase() === String(userEmail).trim().toLowerCase()) {
      userId = uData[i][0];
      break;
    }
  }
  
  // 2. 找 RecordIDs
  const learningSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.LEARNING_RECORDS);
  const userRecordIds = [];
  const lData = learningSheet.getDataRange().getValues();
  for(let i=1; i<lData.length; i++) {
    if(String(lData[i][1]) === String(userId)) userRecordIds.push(String(lData[i][0]));
  }

  // 3. 找任務進度狀態
  const progressSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.TASK_PROGRESS);
  const pData = progressSheet.getDataRange().getValues();
  let status = 'not_started';
  let taskProgressId = null;

  for(let i=1; i<pData.length; i++) {
    if(String(pData[i][2]) === String(taskId) && userRecordIds.includes(String(pData[i][1]))) {
      // 找到最近的一筆非 completed 的，或是已完成的
      status = pData[i][3]; // D欄 Status
      taskProgressId = pData[i][0];
      // 如果是進行中或檢查中，以此為主
      if (status !== 'completed') break; 
    }
  }

  // 4. 根據狀態打包資料
  let responseData = {
    success: true,
    status: status,
    taskProgressId: taskProgressId,
    taskId: taskId
  };

  // Case A: 狀態是自主檢查 (self_checking) -> 回傳檢查表
  if (status === 'self_checking') {
    const checklistSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.TASK_CHECKLISTS); // 請確認名稱
    if (checklistSheet) {
      const cData = checklistSheet.getDataRange().getValues();
      const checklists = [];
      for(let i=1; i<cData.length; i++) {
        const colA = String(cData[i][0]).trim();
        const colB = String(cData[i][1]).trim();
        if(colA === taskId || colB === taskId) {
          checklists.push({ checklistId: cData[i][0], itemTitle: cData[i][2] });
        }
      }
      responseData.checklists = checklists;
    }
  }

  // Case B: 狀態是評量 (assessment) -> 回傳題目
  if (status === 'assessment') {
    // 使用之前的輔助函式抽題
    const question = getRandomQuestionForTask(ss, taskId);
    responseData.question = question;
  }

  return responseData;
}

/**
 * 上傳圖片到 Google Drive
 */
function uploadImageToDrive(params) {
  try {
    const { fileName, fileData, fileMime } = params;

    if (!fileName || !fileData || !fileMime) {
      throw new Error('缺少必要參數');
    }

    // Decode Base64
    const blob = Utilities.newBlob(Utilities.base64Decode(fileData), fileMime, fileName);

    // 取得或建立上傳資料夾
    const folderName = 'Task_Reference_Images';
    let folder;
    const folders = DriveApp.getFoldersByName(folderName);

    if (folders.hasNext()) {
      folder = folders.next();
    } else {
      folder = DriveApp.createFolder(folderName);
      folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    }

    // 上傳檔案
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    // 取得分享連結
    const url = `https://drive.google.com/uc?export=view&id=${file.getId()}`;

    Logger.log('✅ 圖片上傳成功: ' + url);

    return {
      success: true,
      url: url,
      fileId: file.getId(),
      message: '圖片上傳成功'
    };

  } catch (error) {
    Logger.log('❌ 圖片上傳失敗: ' + error);
    return {
      success: false,
      message: '上傳失敗：' + error.message
    };
  }
}

/**
 * 更新代課教師名單
 */
function updateCoTeachers(classId, coTeachers, teacherEmail) {
  try {
    const email = getCurrentUserEmail(teacherEmail);
    const ss = getSpreadsheet();
    const classesSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.CLASSES);
    const classData = classesSheet.getDataRange().getValues();

    for (let i = 1; i < classData.length; i++) {
      if (classData[i][0] === classId && classData[i][2] === email) {
        // 更新第7欄（co_teachers）
        classesSheet.getRange(i + 1, 7).setValue(coTeachers);

        return {
          success: true,
          message: '代課教師更新成功'
        };
      }
    }

    throw new Error('找不到班級或您不是主要教師');
  } catch (error) {
    return {
      success: false,
      message: '更新失敗：' + error.message
    };
  }
}

/**
 * 取得所有班級資訊（診斷用）
 */
function getAllClassesInfo() {
  try {
    const ss = getSpreadsheet();
    const classesSheet = ss.getSheetByName(SHEET_CONFIG.SHEETS.CLASSES);

    if (!classesSheet) {
      return {
        success: false,
        message: '找不到班級資料表'
      };
    }

    const data = classesSheet.getDataRange().getValues();
    const classes = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      classes.push({
        classId: row[0],
        className: row[1],
        teacherEmail: row[2],
        createDate: row[3],
        coTeachers: row[6] || ''
      });
    }

    Logger.log('✅ 取得所有班級資訊:', classes.length);

    return {
      success: true,
      classes: classes
    };

  } catch (error) {
    Logger.log('❌ 取得班級資訊失敗：' + error);
    return {
      success: false,
      message: '取得失敗：' + error.message,
      classes: []
    };
  }
}
