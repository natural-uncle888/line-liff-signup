/**
 * LINE LIFF 群組活動報名系統 - Google Apps Script (Web App API)
 *
 * ✅ 使用 Google Sheets 當資料庫：Events / Segments / Registrations
 * ✅ 支援：建立活動、取得活動（含分段+我的報名）、列出報名、結單
 *
 * 你需要設定：
 * - SPREADSHEET_ID：你的 Google Sheet ID
 * - ADMIN_TOKEN：管理密碼（用於 createEvent / closeEvent）
 */

// ====== 請設定 ======
var SPREADSHEET_ID = '1_hklG4_dEr42TDDZSWOCTSsCD-66OCnpwXcwftNh0Uo';
var ADMIN_TOKEN = '12345';
// ===================

var SHEETS = {
  EVENTS: 'Events',
  SEGMENTS: 'Segments',
  REGS: 'Registrations'
};

function doGet(e) {
  try {
    var params = e && e.parameter ? e.parameter : {};
    var action = params.action || '';
    if (!action) return jsonOut({ ok:false, error:'Missing action' });

    if (action === 'listEvents') {
      var status = params.status || 'OPEN';
      return jsonOut({ ok:true, events: listEvents_(status) });
    }

    if (action === 'getEvent') {
      var eventId = params.eventId;
      if (!eventId) return jsonOut({ ok:false, error:'Missing eventId' });

      // optional: if userId provided, return their registration
      var userId = params.userId || '';
      var event = getEvent_(eventId);
      if (!event) return jsonOut({ ok:false, error:'Event not found' });

      var segments = listSegments_(eventId);
      var reg = userId ? getRegistration_(eventId, userId) : null;
      return jsonOut({ ok:true, event:event, segments:segments, registration:reg });
    }

    if (action === 'listRegistrations') {
      var eventId2 = params.eventId;
      if (!eventId2) return jsonOut({ ok:false, error:'Missing eventId' });
      return jsonOut({ ok:true, registrations: listRegistrations_(eventId2) });
    }

    return jsonOut({ ok:false, error:'Unknown action' });

  } catch (err) {
    return jsonOut({ ok:false, error:String(err) });
  }
}


function parsePost_(e){
  // Supports both JSON and application/x-www-form-urlencoded
  var body = {};
  try{
    if (e && e.postData && e.postData.contents){
      var ct = (e.postData.type || '').toLowerCase();
      if (ct.indexOf('application/json') >= 0){
        body = JSON.parse(e.postData.contents);
      }else{
        // GAS automatically parses form fields into e.parameter
        body = e.parameter || {};
      }
    }else{
      body = (e && e.parameter) ? e.parameter : {};
    }
  }catch(err){
    // fallback to e.parameter
    body = (e && e.parameter) ? e.parameter : {};
  }
  // normalize number-like fields if present
  return body || {};
}


function safeJson_(v){
  if (v == null) return null;
  if (typeof v === 'object') return v;
  if (typeof v === 'string'){
    try { return JSON.parse(v); } catch(e) { return null; }
  }
  return null;
}

// Normalize segments payload from POST body:
// - If array already -> return array
// - If JSON string -> parse
// - If comma-separated string -> split by ','
function normalizeSegments_(v){
  if (Array.isArray(v)) return v;
  var parsed = safeJson_(v);
  if (Array.isArray(parsed)) return parsed;
  if (typeof v === 'string'){
    var s = v.trim();
    if (!s) return [];
    // allow legacy "SEG-0001,SEG-0002"
    return s.split(',').map(function(x){ return x.trim(); }).filter(String);
  }
  return [];
}


function doPost(e) {
  try {
    var body = parsePost_(e);
    var action = body.action || '';
    if (!action) return jsonOut({ ok:false, error:'Missing action' });

    if (action === 'createEvent') {
      requireAdmin_(body.adminToken);
      var title = (body.title || '').trim();
      var description = (body.description || '').trim();
      var segments = normalizeSegments_(body.segments);
      if (!title) return jsonOut({ ok:false, error:'Missing title' });
      if (!segments.length) return jsonOut({ ok:false, error:'At least 1 segment required' });

      var eventId = createEvent_(title, description, segments);
      return jsonOut({ ok:true, eventId:eventId });
    }

    if (action === 'closeEvent') {
      requireAdmin_(body.adminToken);
      var eventId2 = (body.eventId || '').trim();
      if (!eventId2) return jsonOut({ ok:false, error:'Missing eventId' });
      closeEvent_(eventId2);
      return jsonOut({ ok:true });
    }

    if (action === 'register') {
      var eventId3 = (body.eventId || '').trim();
      var userId = (body.userId || '').trim();
      var displayName = (body.displayName || '').trim();
      var segments2 = normalizeSegments_(body.segments);
      if (!eventId3 || !userId) return jsonOut({ ok:false, error:'Missing eventId/userId' });

      var ev = getEvent_(eventId3);
      if (!ev) return jsonOut({ ok:false, error:'Event not found' });
      if (ev.status !== 'OPEN') return jsonOut({ ok:false, error:'Event is CLOSED' });

      var adults = parseInt(body.adults || '0', 10); if (isNaN(adults)) adults = 0;
      var kids = parseInt(body.kids || '0', 10); if (isNaN(kids)) kids = 0;
      var childName = (body.childName || '').toString().trim();
      upsertRegistration_(eventId3, userId, displayName, adults, kids, childName, segments2);
      return jsonOut({ ok:true });
    }


    if (action === 'cancelRegistration') {
      var eventId4 = (body.eventId || '').trim();
      var userId2 = (body.userId || '').trim();
      if (!eventId4 || !userId2) return jsonOut({ ok:false, error:'Missing eventId/userId' });
      // Optional: prevent cancel when event closed? Usually allow cancel even after close if you want.
      deleteRegistration_(eventId4, userId2);
      return jsonOut({ ok:true });
    }

    if (action === 'deleteRegistration') {
      requireAdmin_(body.adminToken);
      var eventId5 = (body.eventId || '').trim();
      var targetUserId = (body.userId || '').trim();
      if (!eventId5 || !targetUserId) return jsonOut({ ok:false, error:'Missing eventId/userId' });
      deleteRegistration_(eventId5, targetUserId);
      return jsonOut({ ok:true });
    }

    return jsonOut({ ok:false, error:'Unknown action' });

  } catch (err) {
    return jsonOut({ ok:false, error:String(err) });
  }
}

// ===== Helpers =====

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function requireAdmin_(token) {
  if (!token || String(token) !== String(ADMIN_TOKEN)) {
    throw new Error('Admin token invalid');
  }
}

function ss_() {
  if (!SPREADSHEET_ID || SPREADSHEET_ID.indexOf('REPLACE_WITH') === 0) {
    throw new Error('Please set SPREADSHEET_ID');
  }
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  ensureSheet_(ss, SHEETS.EVENTS, ['eventId','title','description','status','createdAt','closedAt']);
  ensureSheet_(ss, SHEETS.SEGMENTS, ['eventId','segmentId','date','startTime','endTime','location','highlights','order']);
  ensureSheet_(ss, SHEETS.REGS, ['eventId','userId','displayName','adults','kids','childName','segments','updatedAt']);
  return ss;
}

function ensureSheet_(ss, name, headers) {
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);

  var lastCol = Math.max(1, sh.getLastColumn());
  var firstRow = sh.getRange(1, 1, 1, lastCol).getValues()[0];

  // If empty, set headers
  if (!firstRow[0]) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
    return;
  }

  // If not empty, append any missing headers to the end (non-destructive migration)
  var existing = firstRow.map(function(v){ return String(v || '').trim(); }).filter(function(v){ return v; });
  var missing = [];
  for (var i = 0; i < headers.length; i++) {
    if (existing.indexOf(headers[i]) === -1) missing.push(headers[i]);
  }
  if (missing.length) {
    sh.getRange(1, existing.length + 1, 1, missing.length).setValues([missing]);
    sh.setFrozenRows(1);
  }
}


function nowIso_() {
  return new Date().toISOString();
}

function rand_(n) {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var out = '';
  for (var i=0; i<n; i++){
    out += chars.charAt(Math.floor(Math.random()*chars.length));
  }
  return out;
}

function createEvent_(title, description, segments) {
  var ss = ss_();
  var shE = ss.getSheetByName(SHEETS.EVENTS);
  var shS = ss.getSheetByName(SHEETS.SEGMENTS);

  var eventId = 'EVT-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd') + '-' + rand_(4);
  var createdAt = nowIso_();
  shE.appendRow([eventId, title, description, 'OPEN', createdAt, '']);

  // segments: normalize
  for (var i=0; i<segments.length; i++){
    var s = segments[i] || {};
    var segmentId = 'SEG-' + ('000' + (i+1)).slice(-4);
    shS.appendRow([
      eventId,
      segmentId,
      s.date || '',
      s.startTime || '',
      s.endTime || '',
      s.location || '',
      s.highlights || '',
      s.order || (i+1)
    ]);
  }

  return eventId;
}

function closeEvent_(eventId) {
  var ss = ss_();
  var shE = ss.getSheetByName(SHEETS.EVENTS);
  var range = shE.getDataRange();
  var values = range.getValues();
  var headers = values[0];
  var idxEventId = headers.indexOf('eventId');
  var idxStatus = headers.indexOf('status');
  var idxClosedAt = headers.indexOf('closedAt');

  for (var r=1; r<values.length; r++){
    if (values[r][idxEventId] === eventId){
      shE.getRange(r+1, idxStatus+1).setValue('CLOSED');
      shE.getRange(r+1, idxClosedAt+1).setValue(nowIso_());
      return;
    }
  }
  throw new Error('Event not found');
}

function listEvents_(status) {
  var ss = ss_();
  var sh = ss.getSheetByName(SHEETS.EVENTS);
  var values = sh.getDataRange().getValues();
  var headers = values[0];
  var idxEventId = headers.indexOf('eventId');
  var idxTitle = headers.indexOf('title');
  var idxDesc = headers.indexOf('description');
  var idxStatus = headers.indexOf('status');
  var idxCreatedAt = headers.indexOf('createdAt');

  var out = [];
  for (var r=1; r<values.length; r++){
    var st = values[r][idxStatus];
    if (status && st !== status) continue;
    out.push({
      eventId: values[r][idxEventId],
      title: values[r][idxTitle],
      description: values[r][idxDesc],
      status: st,
      createdAt: values[r][idxCreatedAt]
    });
  }
  // newest first
  out.sort(function(a,b){ return (b.createdAt||'').localeCompare(a.createdAt||''); });
  return out;
}

function getEvent_(eventId) {
  var ss = ss_();
  var sh = ss.getSheetByName(SHEETS.EVENTS);
  var values = sh.getDataRange().getValues();
  var headers = values[0];
  var idxEventId = headers.indexOf('eventId');

  for (var r=1; r<values.length; r++){
    if (values[r][idxEventId] === eventId){
      return rowToObj_(headers, values[r]);
    }
  }
  return null;
}

function listSegments_(eventId) {
  var ss = ss_();
  var sh = ss.getSheetByName(SHEETS.SEGMENTS);
  var values = sh.getDataRange().getValues();
  var headers = values[0];

  var idxEventId = headers.indexOf('eventId');
  var out = [];
  for (var r=1; r<values.length; r++){
    if (values[r][idxEventId] === eventId){
      out.push(rowToObj_(headers, values[r]));
    }
  }
  out.sort(function(a,b){ return (Number(a.order)||0) - (Number(b.order)||0); });
  return out;
}

function listRegistrations_(eventId) {
  var ss = ss_();
  var sh = ss.getSheetByName(SHEETS.REGS);
  var values = sh.getDataRange().getValues();
  var headers = values[0];
  var idxEventId = headers.indexOf('eventId');
  var idxSegments = headers.indexOf('segments');

  var out = [];
  for (var r=1; r<values.length; r++){
    if (values[r][idxEventId] === eventId){
      var obj = rowToObj_(headers, values[r]);
      obj.segments = parseSegments_(obj.segments);
      out.push(obj);
    }
  }
  // sort by updatedAt desc
  out.sort(function(a,b){ return (b.updatedAt||'').localeCompare(a.updatedAt||''); });
  return out;
}

function getRegistration_(eventId, userId) {
  var ss = ss_();
  var sh = ss.getSheetByName(SHEETS.REGS);
  var values = sh.getDataRange().getValues();
  var headers = values[0];
  var idxEventId = headers.indexOf('eventId');
  var idxUserId = headers.indexOf('userId');
  var idxSegments = headers.indexOf('segments');

  for (var r=1; r<values.length; r++){
    if (values[r][idxEventId] === eventId && values[r][idxUserId] === userId){
      var obj = rowToObj_(headers, values[r]);
      obj.segments = parseSegments_(obj.segments);
      return obj;
    }
  }
  return null;
}

function upsertRegistration_(eventId, userId, displayName, adults, kids, childName, segmentsArr) {
  var ss = ss_();
  var sh = ss.getSheetByName(SHEETS.REGS);
  var values = sh.getDataRange().getValues();
  var headers = values[0];

  // Build header -> column index map (1-based)
  var col = {};
  for (var i = 0; i < headers.length; i++) {
    col[String(headers[i]).trim()] = i + 1;
  }

  var segStr = normalizeSegments_(segmentsArr).join(',');
  var updatedAt = nowIso_();

  // helper to set a cell if header exists
  function setIf_(rowIndex1, headerName, value){
    var c = col[headerName];
    if (c) sh.getRange(rowIndex1, c).setValue(value);
  }

  // update existing row
  var idxEventId = col['eventId'] ? (col['eventId'] - 1) : -1;
  var idxUserId  = col['userId'] ? (col['userId'] - 1) : -1;

  for (var r = 1; r < values.length; r++) {
    if (idxEventId >= 0 && idxUserId >= 0 && values[r][idxEventId] === eventId && values[r][idxUserId] === userId) {
      var row1 = r + 1;
      setIf_(row1, 'displayName', displayName);
      setIf_(row1, 'adults', adults);
      setIf_(row1, 'kids', kids);
      setIf_(row1, 'childName', childName);
      setIf_(row1, 'segments', segStr);
      setIf_(row1, 'updatedAt', updatedAt);
      return;
    }
  }

  // append new row with correct column alignment
  var row = new Array(headers.length).fill('');
  if (col['eventId']) row[col['eventId'] - 1] = eventId;
  if (col['userId']) row[col['userId'] - 1] = userId;
  if (col['displayName']) row[col['displayName'] - 1] = displayName;
  if (col['adults']) row[col['adults'] - 1] = adults;
  if (col['kids']) row[col['kids'] - 1] = kids;
  if (col['childName']) row[col['childName'] - 1] = childName;
  if (col['segments']) row[col['segments'] - 1] = segStr;
  if (col['updatedAt']) row[col['updatedAt'] - 1] = updatedAt;

  sh.appendRow(row);
}


function deleteRegistration_(eventId, userId){
  var ss = ss_();
  var sh = ss.getSheetByName(SHEETS.REGS);
  var values = sh.getDataRange().getValues();
  var headers = values[0];
  var idxEventId = headers.indexOf('eventId');
  var idxUserId = headers.indexOf('userId');
  // delete all matching rows (usually 1)
  for (var r=values.length-1; r>=1; r--){
    if (values[r][idxEventId] === eventId && values[r][idxUserId] === userId){
      sh.deleteRow(r+1);
    }
  }
}


function parseSegments_(segStr) {
  if (!segStr) return [];
  return String(segStr).split(',').map(function(s){ return s.trim(); }).filter(Boolean);
}

function rowToObj_(headers, row) {
  var obj = {};
  for (var i=0; i<headers.length; i++){
    obj[headers[i]] = row[i];
  }
  return obj;
}
