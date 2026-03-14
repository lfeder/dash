// Google Apps Script — paste into Extensions > Apps Script in your Google Sheet
//
// Setup:
// 1. Open your Google Sheet
// 2. Extensions > Apps Script
// 3. Replace the default code with this file's contents
// 4. Click Deploy > New deployment
// 5. Type: Web app
// 6. Execute as: Me
// 7. Who has access: Anyone
// 8. Click Deploy, authorize when prompted
// 9. Copy the web app URL and paste it into APPS_SCRIPT_URL in index.html

function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheets()
    .filter(function(s) { return s.getSheetId() == 1615707612; })[0];

  if (!sheet) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Sheet not found' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  data.edits.forEach(function(edit) {
    // Column 10 = Variety2 (J)
    sheet.getRange(edit.row, 10).setValue(edit.value);
  });

  return ContentService.createTextOutput(JSON.stringify({ status: 'ok' }))
    .setMimeType(ContentService.MimeType.JSON);
}
