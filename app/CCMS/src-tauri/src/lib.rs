// ============================================================
// CCMS — Tauri v2 外壳 (Rust)
// 职责：加载 CRA 构建产物，注入 WebView 美化脚本，代理 API 请求
// ============================================================

use tauri::Manager;
use std::time::Duration;

// ===== 后端地址配置 =====
// 如果你把前端部署到了和生产 API 同源的服务器，并且 Tauri 只做壳，
// 这里就填那台服务器的地址。
// 注意：末尾不要带斜杠！
#[cfg(target_os = "android")]
const BACKEND_URL: &str = "http://ccms.reconiconi.de";

#[cfg(not(target_os = "android"))]
const BACKEND_URL: &str = "http://localhost:3001";

// ===== 注入脚本 =====
// 在页面加载稳定后（setup → 延迟 2s → eval），向 WebView 注入：
// 1. Safe-area / 禁用长按 / 双击缩放 / 文本选中 的 CSS
// 2. Fetch + XHR 拦截，将 /api/* 转发到 BACKEND_URL
const INJECT_SCRIPT: &str = r##"
(function(){
  console.log('[CCMS] inject script running, BACKEND = __BACKEND_PLACEHOLDER__');
  document.title = 'CCMS [✓] ' + document.title;

  var BACKEND = '__BACKEND_PLACEHOLDER__';

  /* ---------- CSS ---------- */
  var s = document.createElement('style');
  s.textContent = [
    /* 禁用长按菜单（不干扰滚动 — 只设 body，不设 html） */
    'body{-webkit-user-select:none!important;-webkit-touch-callout:none!important;touch-action:pan-x pan-y;}',
    /* 安全区适配 */
    'body{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);padding-left:env(safe-area-inset-left,0px);padding-right:env(safe-area-inset-right,0px);}',
    /* 输入框允许选中文本 */
    'input,textarea,[contenteditable]{-webkit-user-select:text!important;user-select:text!important;}',
    /* 去蓝光高亮 */
    '*{-webkit-tap-highlight-color:transparent;}',
    /* 滚动条 */
    '::-webkit-scrollbar{width:4px;height:4px;}',
    /* 侧边栏固定为图标模式（无文字） */
    '.sidebar{width:var(--sidebar-collapsed)!important;}',
    '.sidebar .sidebar-brand-name,.sidebar .sidebar-section-label,.sidebar .sidebar-user-info,.sidebar .nav-item-label{opacity:0!important;width:0!important;overflow:hidden!important;}',
    '.sidebar .nav-item{justify-content:center!important;padding:7px 0!important;}',
    '.main-content{margin-left:var(--sidebar-collapsed)!important;}',
    '.sidebar .sidebar-brand{justify-content:center!important;padding:0!important;}',
    /* 退出按钮改到边栏最底部（正下方） */
    '.sidebar-footer > div:last-child{flex-direction:column!important;align-items:stretch!important;gap:2px!important;}',
    '.sidebar-logout{justify-content:center!important;width:100%!important;margin-top:auto!important;}',
    /* ===== 移动端屏幕自适应 ===== */
    '@media(max-width:480px){',
    /* 内容保留侧边栏60px空间，减小内边距 */
    '.main-content{margin-left:var(--sidebar-collapsed)!important;}',
    /* 内容缩减内边距 */
    '.content-body{padding:12px!important;}',
    '.page-header{flex-direction:column!important;gap:12px!important;}',
    '.page-header h2{font-size:20px!important;}',
    /* grid → 单列 */
    '.stats-grid,.detail-grid,#clubs>div>div:last-child{grid-template-columns:1fr!important;}',
    '.quick-links{grid-template-columns:1fr!important;}',
    /* 表格横向滚动 */
    '.table-wrap{overflow-x:auto!important;}',
    '.table th,.table td{white-space:nowrap!important;}',
    /* filter 工具栏纵向排列 */
    '.filter-toolbar{flex-direction:column!important;align-items:stretch!important;}',
    '.filter-toolbar input,.filter-toolbar select{width:100%!important;}',
    /* 卡片内边距缩小 */
    '.card{padding:14px!important;}',
    '.auth-card{padding:24px 16px!important;}',
    '.welcome-hero{padding:20px!important;}',
    /* Hero 区域移动端适配 */
    'section:first-of-type{padding:60px 16px 80px!important;}',
    '}',
    /* 平板过渡 */
    '@media(max-width:768px){',
    '.stats-grid{grid-template-columns:repeat(2,1fr)!important;}',
    '}',
  ].join('');
  document.documentElement.appendChild(s);

  /* ---------- fetch 代理 ---------- */
  var origFetch = window.fetch;
  window.fetch = function(input, init){
    var url = (typeof input==='string' ? input : (input&&input.url)) || '';
    if(url.indexOf('/api/')===0){
      var newUrl = BACKEND + url;
      console.log('[CCMS] proxy fetch:', url, '->', newUrl);
      return (typeof input==='string' ? origFetch(newUrl, init) : origFetch(new Request(newUrl, input), init))
        .then(function(r){
          if(!r.ok) console.warn('[CCMS] proxy response not OK:', r.status, r.statusText);
          return r;
        })
        .catch(function(e){
          console.error('[CCMS] proxy fetch failed:', e);
          throw e;
        });
    }
    return origFetch(input, init);
  };

  /* ---------- XHR 代理 ---------- */
  (function(){
    var OrigXHR = window.XMLHttpRequest;
    window.XMLHttpRequest = function(){
      var xhr = new OrigXHR();
      var origOpen = xhr.open.bind(xhr);
      xhr.open = function(method, url){
        if(typeof url==='string' && url.indexOf('/api/')===0){
          arguments[1] = BACKEND + url;
          console.log('[CCMS] proxy XHR:', method, url, '->', arguments[1]);
        }
        return origOpen.apply(this, arguments);
      };
      return xhr;
    };
    window.XMLHttpRequest.prototype = OrigXHR.prototype;
  })();

  /* ---------- 首页页面管理器 ---------- */
  (function(){
    var heroEl = null, clubsEl = null, ctaEl = null, footerEl = null;
    var currentPage = 'hero';

    function scan(){
      clubsEl = document.getElementById('clubs');
      if(!clubsEl) return false;
      var root = clubsEl.parentNode;
      var ch = root.children;
      heroEl = null; ctaEl = null; footerEl = null;
      for(var i=0;i<ch.length;i++){
        var el = ch[i];
        if(el.tagName==='SECTION' && !el.id && !heroEl) heroEl = el;
        if(el.tagName==='FOOTER') footerEl = el;
      }
      ctaEl = clubsEl.nextElementSibling;
      if(ctaEl && ctaEl.tagName!=='SECTION') ctaEl = null;
      return true;
    }

    function show(page){
      currentPage = page;
      if(heroEl) heroEl.style.display = (page==='hero' ? '' : 'none');
      if(clubsEl) clubsEl.style.display = (page==='clubs' ? '' : 'none');
      if(ctaEl) ctaEl.style.display = 'none';
      if(footerEl) footerEl.style.display = 'none';
      window.scrollTo(0,0);
    }

    // 首次扫描 + 观察 DOM 重建（SPA 路由切换后自动重扫）
    if(!scan()) return;
    show('hero');

    var mo = new MutationObserver(function(){
      if(document.getElementById('clubs') && !document.getElementById('ccms-back')){
        scan();
        show(currentPage);
        // 重新插入返回按钮
        var btn = document.createElement('div');
        btn.style.cssText = 'padding:16px 32px 0;text-align:left;';
        btn.innerHTML = '<a href="#" id="ccms-back" style="display:inline-flex;align-items:center;gap:4px;color:var(--blue);font-size:14px;font-weight:500;text-decoration:none;"><span style="font-size:18px;">←</span> 返回首页</a>';
        clubsEl.insertBefore(btn, clubsEl.firstChild);
      }
    });
    mo.observe(document.body, {childList:true, subtree:true});

    // 首次插入返回按钮（放进 #clubs 内部，随 clubs 一起隐藏/显示）
    var initBtn = document.createElement('div');
    initBtn.style.cssText = 'padding:16px 32px 0;text-align:left;';
    initBtn.innerHTML = '<a href="#" id="ccms-back" style="display:inline-flex;align-items:center;gap:4px;color:var(--blue);font-size:14px;font-weight:500;text-decoration:none;"><span style="font-size:18px;">←</span> 返回首页</a>';
    clubsEl.insertBefore(initBtn, clubsEl.firstChild);

    // 事件委托：拦截"浏览社团"和"返回首页"
    document.addEventListener('click', function(e){
      var t = e.target;
      if(t.closest && t.closest('a[href="#clubs"]')){ e.preventDefault(); show('clubs'); }
      if(t.closest && t.closest('#ccms-back')){ e.preventDefault(); show('hero'); }
    });
  })();
})();
"##;

fn get_inject_script() -> String {
    let url = BACKEND_URL.trim_end_matches('/');
    INJECT_SCRIPT.replace("__BACKEND_PLACEHOLDER__", url)
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let script = get_inject_script();
                // 延迟 2 秒后注入脚本，确保页面和 React 已完全加载
                std::thread::spawn(move || {
                    std::thread::sleep(Duration::from_secs(2));
                    let _ = window.eval(&script);
                });
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
