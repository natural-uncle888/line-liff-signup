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

function safeJsonParse(s, fallback=null){
  try { return JSON.parse(s); } catch(e){ return fallback; }
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
  const form = new URLSearchParams();
  Object.entries(payload).forEach(([k,v])=>{
    if (v === undefined || v === null) return;
    // 物件/陣列用 JSON 字串傳
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

function formatSegmentTime(seg){
  const date = seg.date || "";
  const st = seg.startTime ? seg.startTime : "";
  const et = seg.endTime ? seg.endTime : "";
  if (!date && !st && !et) return "";
  const t = [st, et].filter(Boolean).join("–");
  return t ? `${date} ${t}`.trim() : date;
}

function uniq(arr){
  return Array.from(new Set(arr));
}

function isConfigured(){
  return APP_CONFIG && APP_CONFIG.API_BASE && !APP_CONFIG.API_BASE.includes("REPLACE_WITH");
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
      // 在外部瀏覽器時可導向登入
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
    el.innerHTML = `<span class="badge text-bg-light border"><span class="me-2">👤</span>${escapeHtml(user.displayName)}</span>`;
  }else{
    el.innerHTML = `<span class="badge text-bg-light border"><span class="me-2">👤</span>訪客模式</span>`;
  }
}

function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, (m)=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));
}
