/**
 * CNCM Command Center Module - admin.js
 * 役割: キーボード裏コマンド「admin」検知, 統括司令室の安全離脱, ユーザー管理, 運営アカウント発行
 */

let keyBuffer = '';
let adminAllUsers = [];

window.addEventListener('keydown', (e) => {
  const tag = document.activeElement ? document.activeElement.tagName : '';
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
  keyBuffer += e.key.toLowerCase();
  if (keyBuffer.length > 5) keyBuffer = keyBuffer.slice(-5);
  if (keyBuffer === 'admin') {
    keyBuffer = '';
    openModal('adminSecretAuthModal');
  }
});

window.verifyAdminSecretPass = function() {
  const pass = document.getElementById('adminSecretInputBox').value.trim();
  if (pass === 'canvas2026') {
    closeModal('adminSecretAuthModal');
    sessionStorage.removeItem('cncm_temp_exit_admin');
    launchAdminCommandCenter();
  } else {
    showToast('セキュリティコードが違います。', 'error');
  }
};

window.launchAdminCommandCenter = function() {
  const authView = document.getElementById('authViewContainer');
  const userView = document.getElementById('userAppContainer');
  const adminView = document.getElementById('adminDashboardRoot');

  if (authView) authView.style.setProperty('display', 'none', 'important');
  if (userView) userView.style.setProperty('display', 'none', 'important');
  if (adminView) adminView.style.setProperty('display', 'flex', 'important');
  
  fetchAdminUsers();
};

window.exitAdminCenter = function() {
  const adminView = document.getElementById('adminDashboardRoot');
  const userView = document.getElementById('userAppContainer');
  const authView = document.getElementById('authViewContainer');

  if (window.location.search.includes('launchAdmin')) {
    const cleanUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);
  }

  sessionStorage.setItem('cncm_temp_exit_admin', 'true');

  if (adminView) adminView.style.setProperty('display', 'none', 'important');
  if (authView) authView.style.setProperty('display', 'none', 'important');
  if (userView) userView.style.setProperty('display', 'flex', 'important');

  updateUserHeaderUI();
  showToast('一般クリエイター画面に復帰しました。', 'info');
};

function fetchAdminUsers() {
  if (GAS_DATABASE_URL.includes("YOUR_DATABASE")) return;
  fetch(`${GAS_DATABASE_URL}?action=adminGetAllUsers`)
    .then(res => res.json())
    .then(users => {
      if (Array.isArray(users)) {
        adminAllUsers = users;
        renderAdminUserCards();
      }
    });
}

function renderAdminUserCards() {
  const grid = document.getElementById('adminUserCardsGrid');
  if (!grid) return;
  grid.innerHTML = '';
  adminAllUsers.forEach(u => {
    const c = document.createElement('div');
    c.className = 'glass-card admin-user-card';
    c.innerHTML = `
      <div style="display:flex; justify-content:space-between;">
        <strong>${u.nickname}</strong>
        <span class="ore-rank-badge rank-${(u.rank || 'coal').toLowerCase()}">${u.rank || 'Coal'}</span>
      </div>
      <div class="sub-text">ID: ${u.customId}</div>
      <div style="display:flex; gap:0.4rem; margin-top:0.4rem;">
        <select class="form-control" style="padding:0.3rem; font-size:0.75rem;" onchange="adminChangeRank('${u.customId}', this.value)">
          <option value="">ランク変更▼</option>
          <option value="Coal">Coal</option><option value="Iron">Iron</option><option value="Gold">Gold</option><option value="Diamond">Diamond</option>
        </select>
        <button class="btn btn-danger btn-small glass-interactive" onclick="adminBanUser('${u.customId}')">BAN</button>
      </div>
    `;
    grid.appendChild(c);
  });
}

window.adminChangeRank = function(cid, r) {
  if (!r) return;
  postAdminAction({ action: "adminUpdateUser", customId: cid, rank: r });
  showToast(`ランクを ${r} に更新しました`, 'success');
};

window.adminBanUser = function(cid) {
  postAdminAction({ action: "adminUpdateUser", customId: cid, isBanned: true, banReason: "規約違反" });
  showToast(`${cid} をBANしました`, 'error');
};

window.submitRegisterAdminAccount = function() {
  const id = document.getElementById('newAdminIdInput').value.trim();
  const name = document.getElementById('newAdminNameInput').value.trim();
  const role = document.getElementById('newAdminRoleSelect').value;
  const pass = document.getElementById('newAdminPasswordInput').value.trim();
  if (!id || !name || pass.length < 6) return showToast('全項目を入力してください（パスワード6文字以上）。', 'error');
  postAdminAction({ action: "registerAdminAccount", adminId: id, adminName: name, adminRole: role, password: pass });
  showToast(`運営アカウント【${name}】を発行しました！`, 'success');
};

window.adminPublishOfficialTopic = function() {
  const title = document.getElementById('adminNewTopicTitle').value.trim();
  const desc = document.getElementById('adminNewTopicDesc').value.trim();
  if (!title) return showToast('タイトルを入力してください', 'error');
  postAdminAction({ action: "createOfficialTopic", title: title, desc: desc });
  showToast('公式コンペお題を配信しました！', 'success');
};

window.triggerSnapshotBackup = function() {
  postAdminAction({ action: "createBackupSnapshot" });
  showToast('スプレッドシートの完全スナップショット複製を作成しました。', 'success');
};

window.triggerPanicLockdown = function() {
  showToast('🚨 パニックモード発動：全セッションを切断しました。', 'error');
};

function postAdminAction(payload) {
  if (GAS_DATABASE_URL.includes("YOUR_DATABASE")) return;
  fetch(GAS_DATABASE_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

window.switchAdminSubView = function(id, btn) {
  document.querySelectorAll('.admin-menu-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.admin-sub-view').forEach(v => v.style.display = 'none');
  btn.classList.add('active');
  const t = document.getElementById(id);
  if (t) t.style.display = 'block';
};
