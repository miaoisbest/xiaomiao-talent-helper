/*
 * 小妙版人才资源分配助手｜官网匿名访问统计
 * - 不记录 IP
 * - 不记录姓名 / 账号
 * - 不保存原始 User-Agent
 * - visitor_id 仅为当前浏览器本地随机 UUID，用于近似 UV
 */
(() => {
  'use strict';

  const SUPABASE_URL = 'https://caxbsrudzfjqxpwjatlj.supabase.co';
  // 这是你现有小助手项目正在使用的 anon public key；它本来就允许放在前端。
  // 数据表没有给 anon 直接读写权限，官网只能调用受限的统计 RPC。
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNheGJzcnVkemZqcXhwd2phdGxqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyMDY3MDAsImV4cCI6MjA5ODc4MjcwMH0.kRwsbDvKmkwjrgceWkOX98xoa2KejhQM1peUzK8eD0s';
  const RPC_URL = `${SUPABASE_URL}/rest/v1/rpc/xm_site_track_event`;

  const VISITOR_KEY = 'xm_site_visitor_id_v1';
  const SESSION_KEY = 'xm_site_session_id_v1';

  function randomId() {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
      return globalThis.crypto.randomUUID();
    }
    // 旧浏览器兜底：生成符合 UUID v4 外形的随机值。
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  function getStoredId(storage, key) {
    try {
      let value = storage.getItem(key);
      if (!value) {
        value = randomId();
        storage.setItem(key, value);
      }
      return value;
    } catch (_) {
      return randomId();
    }
  }

  const visitorId = getStoredId(localStorage, VISITOR_KEY);
  const sessionId = getStoredId(sessionStorage, SESSION_KEY);

  function referrerHost() {
    if (!document.referrer) return '';
    try { return new URL(document.referrer).hostname.toLowerCase(); }
    catch (_) { return ''; }
  }

  function sourceClass() {
    const params = new URLSearchParams(location.search);
    const explicit = (params.get('utm_source') || params.get('src') || '').toLowerCase();
    if (explicit) {
      if (explicit.includes('xiaohongshu') || explicit === 'xhs' || explicit.includes('rednote')) return 'xiaohongshu';
      if (explicit.includes('github')) return 'github';
      if (explicit === 'direct') return 'direct';
      return 'other';
    }
    const host = referrerHost();
    if (!host) return 'direct';
    if (host.includes('xiaohongshu') || host.includes('xhslink')) return 'xiaohongshu';
    if (host.includes('github')) return 'github';
    return 'other';
  }

  function deviceClass() {
    const ua = navigator.userAgent || '';
    const isIPad = /iPad/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (isIPad || /Tablet|PlayBook|Silk/i.test(ua)) return 'tablet';
    if (/Mobi|Android|iPhone|iPod/i.test(ua)) return 'mobile';
    return 'desktop';
  }

  function osClass() {
    const ua = navigator.userAgent || '';
    const platform = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '';
    if (/Windows/i.test(ua) || /Win/i.test(platform)) return 'windows';
    if (/Android/i.test(ua)) return 'android';
    if (/iPhone|iPad|iPod/i.test(ua) || (platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
    if (/Mac/i.test(ua) || /Mac/i.test(platform)) return 'macos';
    if (/Linux/i.test(ua) || /Linux/i.test(platform)) return 'linux';
    return 'other';
  }

  function releaseVersion() {
    const text = document.getElementById('versionMeta')?.textContent || '';
    const m = text.match(/v?\d+(?:\.\d+){1,3}/i);
    return m ? m[0] : null;
  }

  function track(eventType, metadata = {}) {
    const payload = {
      p_visitor_id: visitorId,
      p_session_id: sessionId,
      p_event_type: eventType,
      p_page_path: location.pathname || '/',
      p_source: sourceClass(),
      p_referrer_host: referrerHost() || null,
      p_device_class: deviceClass(),
      p_os_class: osClass(),
      p_release_version: releaseVersion(),
      p_metadata: metadata && typeof metadata === 'object' ? metadata : {}
    };

    // 统计失败绝不影响官网正常下载/跳转。
    fetch(RPC_URL, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      keepalive: true,
      mode: 'cors',
      credentials: 'omit'
    }).catch(() => {});
  }

  function bindEvents() {
    // 页面访问：一次加载记一次 PV；同一浏览器 visitor_id 用于近似 UV。
    track('page_view');

    // Windows 下载按钮（当前官网上下各一个）。
    ['downloadBtn', 'downloadBtnBottom'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', () => track('download_windows', { button: id }), { capture: true });
    });

    // 教程入口。
    document.querySelectorAll('a[href="#guide"]').forEach(el => {
      el.addEventListener('click', () => track('click_tutorial'), { capture: true });
    });

    // 小红书 / GitHub Releases。
    document.querySelectorAll('a[href]').forEach(el => {
      const href = el.getAttribute('href') || '';
      if (/xhslink\.cn|xiaohongshu\.com/i.test(href)) {
        el.addEventListener('click', () => track('click_xiaohongshu'), { capture: true });
      } else if (/github\.com\/miaoisbest\/xiaomiao-talent-helper\/releases/i.test(href)) {
        el.addEventListener('click', () => track('click_github_release'), { capture: true });
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindEvents, { once: true });
  } else {
    bindEvents();
  }
})();
