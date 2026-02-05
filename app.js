/* global liff, APP_CONFIG */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function toast(msg, kind="info"){
  const el = $("#toast");
  el.className = "alert alert-" + (kind === "error" ? "danger" : kind);
  el.textContent = msg;
  el.style.display = "block";
  setTimeout(()=>{ el.style.display = "none"; }, 3500);
}

async function apiGet(params){
  const url = new URL(APP_CONFIG.API_BASE);
  Object.entries(params).forEach(([k,v])=>{
    if (v === undefined || v === null) return;
    url.searchParams.set(k, typeof v === "object" ? JSON.stringify(v) : String(v));
  });
  const res = await fetch(url.toString(), { method:"GET" });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "API error");
  return data;
}

async function apiPost(payload){
  // Use x-www-form-urlencoded to avoid CORS preflight (OPTIONS) against Google Apps Script.
  const form = new URLSearchParams();
  Object.entries(payload).forEach(([k,v])=>{
    if (v === undefined || v === null) return;
    form.set(k, typeof v === "object" ? JSON.stringify(v) : String(v));
  });

  const res = await fetch(APP_CONFIG.API_BASE, {
    method:"POST",
    headers: { "Content-Type":"application/x-www-form-urlencoded;charset=UTF-8" },
    body: form.toString()
  });

  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "API error");
  return data;
}

function isConfigured(){
  return APP_CONFIG && APP_CONFIG.API_BASE && !APP_CONFIG.API_BASE.includes("REPLACE_WITH");
}

// --- Date/Time formatting (handles ISO + Sheets time 1899-12-30...) ---
function pickDateYYYYMMDD(value){
  if (!value) return "";
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0,10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), dd=String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${dd}`;
  }
  return s.slice(0,10);
}

function pickHHMM(value){
  if (!value) return "";
  const s = String(value);
  const m1 = s.match(/T(\d{2}):(\d{2})/);
  if (m1) return `${m1[1]}:${m1[2]}`;
  const m2 = s.match(/^(\d{1,2}):(\d{2})/);
  if (m2) return `${m2[1].padStart(2,'0')}:${m2[2]}`;
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const hh=String(d.getHours()).padStart(2,'0');
    const mm=String(d.getMinutes()).padStart(2,'0');
    return `${hh}:${mm}`;
  }
  return "";
}

function formatSegmentTime(seg){
  const d1 = pickDateYYYYMMDD(seg.date);
  const d2 = pickDateYYYYMMDD(seg.endDate);
  const datePart = (d1 && d2 && d2 !== d1) ? `${d1}~${d2}` : d1;
  const st = pickHHMM(seg.startTime);
  const et = pickHHMM(seg.endTime);
  const t = [st, et].filter(Boolean).join("–");
  if (datePart && t) return `${datePart} ${t}`;
  if (datePart) return datePart;
  if (t) return t;
  return "";
}

async function initLiffIfAvailable(){
  const info = { isInClient:false, userId:null, displayName:null, pictureUrl:null, liffReady:false };
  if (!window.APP_CONFIG || !window.APP_CONFIG.LIFF_ID || window.APP_CONFIG.LIFF_ID.includes("REPLACE_WITH")){
    return info;
  }
  try{
    await liff.init({ liffId: window.APP_CONFIG.LIFF_ID });
    info.liffReady = true;
    info.isInClient = liff.isInClient();
    if (!liff.isLoggedIn()){
      liff.login({ redirectUri: window.location.href });
      return info;
    }
    const profile = await liff.getProfile();
    info.userId = profile.userId;
    info.displayName = profile.displayName;
    info.pictureUrl = profile.pictureUrl;
    return info;
  }catch(e){
    console.warn("LIFF init failed:", e);
    return info;
  }
}

function setUserPill(user){
  const el = $("#userPill");
  if (!el) return;
  if (user && user.displayName){
    el.innerHTML = `<span class="pill"><span>👤</span><span>${escapeHtml(user.displayName)}</span></span>`;
  }else{
    el.innerHTML = `<span class="pill"><span>👤</span><span>訪客模式</span></span>`;
  }
}

function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, (m)=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));
}

function clampInt(v, min=0, max=99){
  const n = Number(v);
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, Math.floor(n)));
}


// ---- Loading overlay helpers ----
let __loadingCount = 0;
function setLoading(on, text){
  const el = document.getElementById("loadingOverlay");
  const txt = document.getElementById("loadingText");
  if (!el) return;

  // auto-close safety timer: prevent overlay from getting stuck
  if (typeof window.__loadingTimer === "undefined") window.__loadingTimer = null;

  if (on){
    __loadingCount += 1;
    if (text && txt) txt.textContent = text;
    el.style.display = "block";

    // (re)start safety timer
    if (window.__loadingTimer) clearTimeout(window.__loadingTimer);
    window.__loadingTimer = setTimeout(()=>{
      __loadingCount = 0;
      el.style.display = "none";
      if (window.__loadingTimer) { clearTimeout(window.__loadingTimer); window.__loadingTimer = null; }
      // optional: soft hint
      const t = document.getElementById("toast");
      if (t){
        t.className = "alert alert-warning";
        t.style.display = "block";
        t.textContent = "載入時間較長，已自動關閉提示（可再試一次或稍後重整）";
        setTimeout(()=>{ t.style.display="none"; }, 3500);
      }
    }, 10000);

  } else {
    __loadingCount = Math.max(0, __loadingCount - 1);
    if (__loadingCount === 0){
      el.style.display = "none";
      if (window.__loadingTimer) { clearTimeout(window.__loadingTimer); window.__loadingTimer = null; }
    }
  }
}


// Yield to browser so loading overlay can paint immediately
function nextFrame(){
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}


function isLoading(){
  return typeof __loadingCount !== "undefined" && __loadingCount > 0;
}
window.isLoading = isLoading;
