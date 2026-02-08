/* global liff, APP_CONFIG */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));


function triggerConfetti(){
  const box = document.getElementById("confetti");
  if (!box) return;
  // clear old
  box.innerHTML = "";
  const colors = ["#ff4f98","#ff74ad","#ffc9de","#ffe7a6","#bff7dd","#cfe9ff","#e7d6ff"];
  const count = 42;
  for (let i=0;i<count;i++){
    const p = document.createElement("div");
    p.className = "confetti-piece";
    const left = Math.random()*100;
    const drift = (Math.random()*2-1) * 120; // px
    const dur = 1200 + Math.random()*900;
    const delay = Math.random()*120;
    p.style.left = left + "vw";
    p.style.setProperty("--drift", drift.toFixed(0) + "px");
    p.style.setProperty("--dur", dur.toFixed(0) + "ms");
    p.style.setProperty("--delay", delay.toFixed(0) + "ms");
    p.style.background = colors[Math.floor(Math.random()*colors.length)];
    p.style.transform = "rotate(" + (Math.random()*180) + "deg)";
    box.appendChild(p);
  }
  // auto cleanup
  setTimeout(()=>{ if (box) box.innerHTML = ""; }, 2200);
}

function toast(msg, kind="info"){
  const el = $("#toast");
  el.className = "alert alert-" + (kind === "error" ? "danger" : kind);
  el.textContent = msg;
  el.style.display = "block";
  setTimeout(()=>{ el.style.display = "none"; }, 3500);
  if (kind === "success") triggerConfetti();
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
      const cleanRedirect = window.location.origin + window.location.pathname;
      liff.login({ redirectUri: cleanRedirect });
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
        t.textContent = "自動關閉提示（如資料未出現可再試一次或稍後重整）";
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

// ---- Pretty confirm modal (Bootstrap 5) ----
// Usage: const ok = await confirmDialog({ title, message, confirmText, cancelText, variant:"danger"|"primary" });
function confirmDialog(opts){
  const options = Object.assign({
    title: "確認",
    message: "確定要繼續嗎？",
    confirmText: "確定",
    cancelText: "返回",
    variant: "primary",   // bootstrap variant
    icon: "question",     // question | trash | warning
    busyText: null,       // e.g. "處理中…"
    onConfirm: null,      // optional async function
    // Optional: show success state then auto-close
    successTitle: null,
    successMessage: null,
    successIcon: "success",
    autoCloseMs: 900
  }, opts || {});

  const el = document.getElementById("confirmModal");
  if (!el || !window.bootstrap){
    // Fallback to system confirm if modal not available
    if (typeof options.onConfirm === "function"){
      const ok = window.confirm(options.message);
      if (!ok) return Promise.resolve(false);
      return Promise.resolve().then(()=>options.onConfirm()).then(()=>true).catch(()=>false);
    }
    return Promise.resolve(window.confirm(options.message));
  }

  const bodyEl = document.getElementById("confirmModalBody");
  const okBtn = document.getElementById("confirmModalOk");
  const cancelBtn = document.getElementById("confirmModalCancel");
  const errWrap = document.getElementById("confirmModalErrorWrap");
  const errEl = document.getElementById("confirmModalError");

  const iconMap = {
    question: { emoji: "❓", label: "確認" },
    warning:  { emoji: "⚠️", label: "注意" },
    trash:    { emoji: "🗑️", label: "刪除" },
    success:  { emoji: "✅", label: "完成" }
  };
  const ic = iconMap[options.icon] || iconMap.question;

  if (bodyEl){
    // Preserve newlines in message
    const msgHtml = escapeHtml(String(options.message || "")).replace(/\n/g, "<br>");
    bodyEl.innerHTML = `
      <div class="confirm-layout">
        <div class="confirm-icon confirm-icon-${escapeHtml(options.variant)}" aria-hidden="true">${ic.emoji}</div>
        <div class="confirm-copy">
          <div class="confirm-title">${escapeHtml(options.title || ic.label)}</div>
          <div class="confirm-message">${msgHtml}</div>
        </div>
      </div>
    `;
  }

  if (okBtn){
    okBtn.className = "btn btn-" + (options.variant || "primary");
    const t = okBtn.querySelector(".btn-text");
    if (t) t.textContent = options.confirmText;
    else okBtn.textContent = options.confirmText;
  }
  if (cancelBtn) cancelBtn.textContent = options.cancelText;

  const setError = (msg)=>{
    if (!errWrap || !errEl) return;
    if (!msg){
      errWrap.classList.add("d-none");
      errEl.textContent = "";
      return;
    }
    errEl.textContent = msg;
    errWrap.classList.remove("d-none");
  };

  const setBusy = (busy)=>{
    if (!okBtn || !cancelBtn) return;
    const spinner = okBtn.querySelector(".spinner-border");
    const text = okBtn.querySelector(".btn-text");
    if (busy){
      okBtn.disabled = true;
      cancelBtn.disabled = true;
      if (spinner) spinner.classList.remove("d-none");
      if (text && options.busyText) text.textContent = options.busyText;
    }else{
      okBtn.disabled = false;
      cancelBtn.disabled = false;
      if (spinner) spinner.classList.add("d-none");
      if (text) text.textContent = options.confirmText;
    }
  };

  const modal = bootstrap.Modal.getOrCreateInstance(el, { backdrop: "static", keyboard: true });

  return new Promise(resolve=>{
    let resolved = false;
    let successClosing = false;

    const finish = (val)=>{
      if (resolved) return;
      resolved = true;
      resolve(val);
    };

    const onOk = async ()=>{
      setError(null);

      if (typeof options.onConfirm === "function"){
        try{
          setBusy(true);
          await options.onConfirm();

// If configured, show a success state before auto-closing
if (options.successTitle || options.successMessage){
  successClosing = true;
  const sic = iconMap[options.successIcon] || iconMap.success;
  if (bodyEl){
    const sTitle = escapeHtml(String(options.successTitle || sic.label));
    const sMsgHtml = escapeHtml(String(options.successMessage || "")).replace(/\n/g, "<br>");
    bodyEl.innerHTML = `
      <div class="confirm-layout">
        <div class="confirm-icon confirm-icon-success" aria-hidden="true">${sic.emoji}</div>
        <div class="confirm-copy">
          <div class="confirm-title">${sTitle}</div>
          <div class="confirm-message">${sMsgHtml}</div>
        </div>
      </div>
    `;
  }
  // lock buttons, hide cancel, and stop spinner
  setBusy(true);
  if (cancelBtn) cancelBtn.classList.add("d-none");
  if (okBtn){
    const spinner = okBtn.querySelector(".spinner-border");
    if (spinner) spinner.classList.add("d-none");
    const t = okBtn.querySelector(".btn-text");
    if (t) t.textContent = "完成";
    okBtn.disabled = true;
    okBtn.className = "btn btn-success";
  }
  setTimeout(()=>{
    modal.hide();
    finish(true);
  }, Number(options.autoCloseMs || 900));
}else{
  modal.hide();
  finish(true);
}
        }catch(e){
          // keep modal open; show inline error; allow retry
          setBusy(false);
          setError((e && e.message) ? e.message : "操作失敗，請再試一次。");
        }
        return;
      }

      modal.hide();
      finish(true);
    };

    const onCancel = ()=>{
      modal.hide();
      finish(false);
    };

    const onHidden = ()=>{
      // user closed via X or programmatic hide
      if (successClosing) return;
      finish(false);
    };

    if (okBtn) okBtn.onclick = onOk;
    if (cancelBtn) cancelBtn.onclick = onCancel;
    el.addEventListener("hidden.bs.modal", onHidden, { once:true });

    // reset state every time
    setBusy(false);
    setError(null);

    modal.show();
  });
}
window.confirmDialog = confirmDialog;

