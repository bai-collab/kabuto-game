/**
 * Google Apps Script — 養獨角仙 飼養紀錄
 * 
 * 部署方式：
 * 1. 開啟 Google Sheets，工具 → Apps Script
 * 2. 貼上此程式碼
 * 3. 部署 → 新增部署 → 網頁應用程式
 *    - 執行身分：自己
 *    - 存取權：所有人
 * 4. 複製部署網址，貼到遊戲的設定中
 * 
 * Sheet 欄位：
 * A:Timestamp | B:PlayerName | C:Day | D:Stage | E:Size | F:Power | 
 * G:Score | H:Rank | I:EndType | J:Photos | K:Interactions | L:DetailJSON
 */

const SHEET_NAME = 'RaisingRecords';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action || 'SAVE_RECORD';

    if (action === 'SAVE_RECORD') {
      return handleSaveRecord(data);
    } else if (action === 'GET_RECORDS') {
      return handleGetRecords(data);
    }

    return makeResponse({ status: 'error', message: 'Unknown action' });
  } catch (error) {
    return makeResponse({ status: 'error', message: error.toString() });
  }
}

function doGet(e) {
  try {
    return handleGetRecords(e.parameter || {});
  } catch (error) {
    return makeResponse({ status: 'error', message: error.toString() });
  }
}

function handleSaveRecord(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow([
      'Timestamp', 'PlayerName', 'Day', 'Stage', 'Size', 'Power',
      'Score', 'Rank', 'EndType', 'Photos', 'Interactions', 'DetailJSON'
    ]);
    // 格式化標題列
    sheet.getRange(1, 1, 1, 12).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  const record = data.record || {};
  const row = [
    new Date().toISOString(),
    record.playerName || '匿名飼育員',
    record.day || 0,
    record.stage || '',
    record.size || 0,
    record.power || 0,
    record.score || 0,
    record.rank || '',
    record.endType || '',
    record.photos || 0,
    record.interactions || 0,
    JSON.stringify(record.detail || {})
  ];

  sheet.appendRow(row);

  return makeResponse({
    status: 'ok',
    message: '飼養紀錄已儲存！',
    rowNumber: sheet.getLastRow()
  });
}

function handleGetRecords(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet || sheet.getLastRow() <= 1) {
    return makeResponse({ status: 'ok', records: [] });
  }

  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 12).getValues();
  const records = rows.map(r => ({
    timestamp: r[0],
    playerName: r[1],
    day: r[2],
    stage: r[3],
    size: r[4],
    power: r[5],
    score: r[6],
    rank: r[7],
    endType: r[8],
    photos: r[9],
    interactions: r[10],
  }));

  // 最新 20 筆
  const recent = records.slice(-20).reverse();

  return makeResponse({ status: 'ok', records: recent });
}

function makeResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
