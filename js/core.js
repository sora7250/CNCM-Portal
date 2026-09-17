/**
 * CNCM Core Architecture - core.js
 * 役割: セッション管理, 3大独立URL定数, SWR同期パイプライン, トースト, 起動アニメーション
 */

// ================= 1. 3大独立バックエンド設定 =================
const GAS_DATABASE_URL = "https://script.google.com/macros/s/AKfycbwzu6NB9hg9ZrUD8Wd9smewuU6DJHiS0bTPmBnfaKzONcpDC8pNir14eqEHFeD48rNi/exec";
const GAS_DRIVE_URL = "https://script.google.com/macros/s/AKfycbyqPnq5_pB7VBLVwkOQ6uOSCz7Dfkm2C0JuPTVPeAys3ggoLDmBf4ZlxXqwmAz9sNpCCQ/exec";
const GAS_GEMINI_PROXY_URL = "https://script.google.com/macros/s/AKfycbyFEGirq90HoNKPAGph6mwYtzz4absX4HmhEu5VJFnVbJ7nimaboAQmoa0TkBfDO_BV/exec";

// ================= 2. ユーザーセッション状態 =================
let currentUser = {
  customId: localStorage.getItem('cncm_custom_id') || '',
  name: localStorage.getItem('cncm_username') || 'クリエイター',
  avatar: localStorage.getItem('cncm_avatar') || '🎨',
  customImage: localStorage.getItem('cncm_custom_image') || null,
  rank: localStorage.getItem('cncm_rank') || 'Coal',
  likesReceived: parseInt(localStorage.getItem('cncm_likes') || '0', 10)
};

// ================= 3. トースト通知エンジン =================
window.showToast = function(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toastNotificationContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast-message toast-${type}`;
  const icon = type === 'success' ? '✅' : type === 'error' ? '🚨' : 'ℹ️';
  toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px) scale(0.95)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
};

// ================= 4. グローバルローディング表示 =================
window.showGlobalLoading = function(label = '処理中...') {
  const overlay = document.getElementById('globalLoadingOverlay');
  const lbl = document.getElementById('globalLoadingLabel');
  if (lbl) lbl.innerText = label;
  if (overlay) overlay.style.display = 'flex';
};

window.hideGlobalLoading = function() {
  const overlay = document.getElementById('globalLoadingOverlay');
  if (overlay) overlay.style.display = 'none';
};

// ================= 5. ビュー切り替えエンジン =================
window.updateAppViewState = function() {
  const authView = document.getElementById('authViewContainer');
  const userView = document.getElementById('userAppContainer');
  const adminView = document.getElementById('adminDashboardRoot');

  if (!authView || !userView) return;

  // 未ログインの場合
  if (!currentUser.customId || currentUser.customId === 'null' || currentUser.customId.trim() === '') {
    authView.style.setProperty('display', 'flex', 'important');
    userView.style.setProperty('display', 'none', 'important');
    if (adminView) adminView.style.setProperty('display', 'none', 'important');
    if (typeof switchAuthMode === 'function') switchAuthMode('login');
    return;
  }

  // 運営直行フラグがある場合
  const urlParams = new URLSearchParams(window.location.search);
  const isTempExit = sessionStorage.getItem('cncm_temp_exit_admin') === 'true';
  if (!isTempExit && (urlParams.get('launchAdmin') === 'true' || localStorage.getItem('cncm_is_admin') === 'true')) {
    authView.style.setProperty('display', 'none', 'important');
    userView.style.setProperty('display', 'none', 'important');
    if (typeof launchAdminCommandCenter === 'function') launchAdminCommandCenter();
    return;
  }

  // 通常ポータル画面
  authView.style.setProperty('display', 'none', 'important');
  userView.style.setProperty('display', 'flex', 'important');
  if (adminView) adminView.style.setProperty('display', 'none', 'important');

  updateUserHeaderUI();
};

window.updateUserHeaderUI = function() {
  const dName = document.getElementById('displayUsername');
  const dGreet = document.getElementById('dashUserGreeting');
  const hId = document.getElementById('hubCustomIdDisplay');
  const hLikes = document.getElementById('hubLikesDisplay');
  const badge = document.getElementById('headerRankBadge');
  const avatarEl = document.getElementById('headerAvatar');

  if (dName) dName.innerText = `${currentUser.name} (${currentUser.customId})`;
  if (dGreet) dGreet.innerText = currentUser.name;
  if (hId) hId.innerText = currentUser.customId;
  if (hLikes) hLikes.innerText = currentUser.likesReceived || 0;

  if (avatarEl) {
    if (currentUser.customImage) {
      avatarEl.innerHTML = `<img src="${currentUser.customImage}">`;
    } else {
      avatarEl.innerText = currentUser.avatar || '🎨';
    }
  }

  if (badge) {
    badge.className = `ore-rank-badge rank-${(currentUser.rank || 'coal').toLowerCase()}`;
    badge.innerText = currentUser.rank || 'Coal';
  }
};

// ================= 6. 手動クイック全体同期 (SWR) =================
window.triggerManualSync = async function() {
  const btn = document.getElementById('headerSyncBtn');
  if (btn) btn.classList.add('loading');
  showToast('最新データをクラウドと照会中...', 'info', 2000);

  try {
    if (typeof syncLoungeMembersFromGAS === 'function') await syncLoungeMembersFromGAS();
    if (typeof refreshFeedFromStore === 'function') refreshFeedFromStore();
    if (typeof renderGuildList === 'function') renderGuildList();
    if (typeof refreshStoriesTray === 'function') refreshStoriesTray();
    showToast('すべてのデータが同期されました！', 'success', 2500);
  } catch(e) {
    showToast('一部の同期に失敗しました: ' + e.message, 'error');
  } finally {
    if (btn) btn.classList.remove('loading');
  }
};

// ================= 7. モーダル・タブUI制御 =================
window.switchMainTab = function(panelId, btn) {
  document.querySelectorAll('.main-tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.app-panel').forEach(p => p.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const target = document.getElementById(panelId);
  if (target) target.classList.add('active');
};

window.switchSubTab = function(parentPanelId, subPanelId, btn) {
  const parent = document.getElementById(parentPanelId);
  if (!parent) return;
  parent.querySelectorAll('.sub-tab-btn').forEach(b => b.classList.remove('active'));
  parent.querySelectorAll('.sub-panel').forEach(p => p.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const target = document.getElementById(subPanelId);
  if (target) target.classList.add('active');
};

window.openModal = function(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'flex';
};

window.closeModal = function(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
};

window.showCustomDialog = function(options) {
  return new Promise((resolve) => {
    const d = document.getElementById('customDialog');
    document.getElementById('dialogIcon').innerText = options.icon || 'ℹ️';
    document.getElementById('dialogTitle').innerText = options.title || '通知';
    document.getElementById('dialogMessage').innerText = options.message || '';
    document.getElementById('dialogConfirmBtn').onclick = () => { d.style.display = 'none'; resolve(true); };
    d.style.display = 'flex';
  });
};

window.toggleFullscreen = function() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    if (document.exitFullscreen) document.exitFullscreen();
  }
};

// ================= 8. ダッシュボード・クイックインサイト展開 =================
window.openDashInsight = function(type) {
  const title = document.getElementById('dashInsightTitle');
  const body = document.getElementById('dashInsightBody');
  openModal('dashInsightModal');

  if (type === 'online') {
    title.innerText = '🟢 現在在席中のクリエイター';
    const onlineList = (typeof loungeMembers !== 'undefined') ? loungeMembers.filter(m => m.isOnline) : [];
    if (onlineList.length === 0) {
      body.innerHTML = '<div class="empty-state-notice">現在在席中のメンバーはいません</div>';
    } else {
      body.innerHTML = onlineList.map(m => `
        <div style="display:flex; align-items:center; gap:0.8rem; padding:0.6rem 0; border-bottom:1px solid var(--glass-border);">
          <div class="header-avatar">${m.avatar || '🎨'}</div>
          <div><strong>${m.name}</strong> <span class="sub-text">(${m.task || '集中制作中'})</span></div>
        </div>
      `).join('');
    }
  } else if (type === 'feed') {
    title.innerText = '📱 最新フィードハイライト';
    const posts = JSON.parse(localStorage.getItem('cncm_feed_cache') || '[]');
    body.innerHTML = posts.slice(0, 3).map(p => `
      <div style="padding:0.6rem 0; border-bottom:1px solid var(--glass-border);">
        <strong>${p.author}</strong>: ${p.text}
      </div>
    `).join('') || '<div class="empty-state-notice">投稿はまだありません</div>';
  } else if (type === 'guild') {
    title.innerText = '👥 稼働ギルド一覧';
    const guilds = JSON.parse(localStorage.getItem('cncm_guilds_cache') || '[]');
    body.innerHTML = guilds.map(g => `
      <div style="padding:0.6rem 0; border-bottom:1px solid var(--glass-border);">
        <strong>🏰 ${g.name}</strong> (${(g.members || []).length}名)
        <div class="sub-text">${g.desc}</div>
      </div>
    `).join('') || '<div class="empty-state-notice">ギルドはありません</div>';
  }
};

// ================= 9. 起動ライフサイクル同期 =================
document.addEventListener('DOMContentLoaded', () => {
  const bar = document.querySelector('.boot-loader-bar');
  const txt = document.getElementById('bootStatusText');

  setTimeout(() => { if (bar) bar.style.width = '45%'; if (txt) txt.innerText = 'Authenticating Client Session...'; }, 200);
  setTimeout(() => { if (bar) bar.style.width = '80%'; if (txt) txt.innerText = 'Synchronizing Cloud Pipelines...'; }, 500);
  setTimeout(() => {
    if (bar) bar.style.width = '100%';
    if (txt) txt.innerText = 'CNCM Ready.';
    setTimeout(() => {
      const splash = document.getElementById('bootSplashScreen');
      if (splash) {
        splash.style.opacity = '0';
        setTimeout(() => splash.style.display = 'none', 500);
      }
      updateAppViewState();
    }, 400);
  }, 900);
});
