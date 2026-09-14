/**
 * CanvasNetCreatorMEMBERSHIP (CNCM)
 * 完全統合マスターエンジン - 親JS (初期高度成長機動 Version)
 */

// =========================================================================
// 1. 接続設定（★デプロイした各GASのURLを貼り付けてください）
// =========================================================================
const GAS_API_URL = "https://script.google.com/macros/s/AKfycbxbgUZ7JXsvGA2nkBnQ7uhEAs-ldiz-79mNGyXjetnzExhPCjAc07E3hvZ4k6-kjbRz4Q/exec";
const DRIVE_GAS_API_URL = "https://script.google.com/macros/s/AKfycbxNm7u7ifdqoS7BQH9YJ6C-4njg1v4oWnUQDvY5nnZTPuX2NnT8tMVHDKa_q9EsEZbhxA/exec";

// ユーザーセッション状態
let currentUser = {
  customId: localStorage.getItem('cncm_custom_id') || '',
  name: localStorage.getItem('cncm_username') || 'クリエイター',
  avatar: localStorage.getItem('cncm_avatar') || '🎨',
  customImage: localStorage.getItem('cncm_custom_image') || null,
  rank: localStorage.getItem('cncm_rank') || 'Coal',
  likesReceived: parseInt(localStorage.getItem('cncm_likes') || '0', 10)
};

// インメモリストア
let loungeMembers = [];
let openChatMessages = [];
let feedPosts = JSON.parse(localStorage.getItem('cncm_feed_cache') || '[]');
let stories = JSON.parse(localStorage.getItem('cncm_stories_cache') || '[]');
let friends = JSON.parse(localStorage.getItem('cncm_friends_cache') || '[]');
let adminAllUsers = [];
let keyBuffer = '';

// =========================================================================
// 2. 在席・生存信号（ハートビート）＆ 切断・ログアウト（完全統合）
// =========================================================================

// 60秒おきの生存信号
setInterval(() => {
  if (currentUser.customId && !GAS_API_URL.includes("YOUR_DATABASE")) {
    fetch(`${GAS_API_URL}?action=heartbeat&customId=${encodeURIComponent(currentUser.customId)}`, { mode: "no-cors" }).catch(() => {});
  }
}, 60000);

// タブ閉じ・画面離脱時の即時切断
window.addEventListener('beforeunload', () => {
  if (currentUser.customId && !GAS_API_URL.includes("YOUR_DATABASE")) {
    navigator.sendBeacon(`${GAS_API_URL}?action=logout&customId=${encodeURIComponent(currentUser.customId)}`);
  }
});

// 完全ログアウト処理
window.triggerCompleteLogout = function() {
  if (!confirm('【CNCM セッション終了】\nログアウトしてログイン画面に戻りますか？')) return;

  if (currentUser.customId && !GAS_API_URL.includes("YOUR_DATABASE")) {
    try {
      navigator.sendBeacon(`${GAS_API_URL}?action=logout&customId=${encodeURIComponent(currentUser.customId)}`);
    } catch(e) {}
  }

  // セッション完全消去
  localStorage.clear();
  sessionStorage.clear();
  window.location.replace('login.html');
};

// =========================================================================
// 3. 在席メンバー自動同期（30秒周期・エポックミリ秒治療済み）
// =========================================================================
function syncLoungeMembersFromGAS() {
  if (GAS_API_URL.includes("YOUR_DATABASE")) return;
  fetch(`${GAS_API_URL}?action=getLoungeMembers`)
    .then(res => res.json())
    .then(data => {
      if (Array.isArray(data)) {
        loungeMembers = data;
        renderLoungeMembers();
        
        const onlineCount = data.filter(m => m.isOnline).length;
        const dashOnlineEl = document.getElementById('dashOnlineCount');
        if (dashOnlineEl) dashOnlineEl.innerText = onlineCount;
        const counterEl = document.getElementById('loungeOnlineCounter');
        if (counterEl) counterEl.innerText = `● ${onlineCount}名在席中`;
      }
    })
    .catch(() => {});
}

function renderLoungeMembers() {
  const list = document.getElementById('loungeMemberList');
  if (!list) return;
  list.innerHTML = '';

  const onlineList = loungeMembers.filter(m => m.isOnline);
  if (onlineList.length === 0) {
    list.innerHTML = '<div class="empty-state-notice">現在在席中のメンバーはいません</div>';
    return;
  }

  onlineList.forEach(m => {
    const row = document.createElement('div');
    row.className = 'member-row';
    row.onclick = () => window.openUserProfile(m.customId);
    row.innerHTML = `
      <div class="header-avatar">${m.avatar || '🎨'}</div>
      <span class="status-dot dot-${m.status || 'ok'}"></span>
      <div style="flex:1; min-width:0;">
        <div style="display:flex; justify-content:space-between;">
          <strong>${m.name}</strong>
          <span class="sub-text" style="color:var(--status-${m.status || 'ok'});">${m.status==='busy'?'全集中':m.status==='ok'?'話しかけOK':'作業中'}</span>
        </div>
        <div class="sub-text" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${m.task || '集中制作中'}</div>
      </div>
    `;
    list.appendChild(row);
  });
}

window.updateLoungeStatus = function() {
  const mode = document.getElementById('myStatusMode').value;
  const task = document.getElementById('myTaskInput').value.trim() || '集中制作中';

  loungeMembers = loungeMembers.filter(m => m.customId !== currentUser.customId);
  loungeMembers.unshift({
    customId: currentUser.customId,
    name: currentUser.name,
    avatar: currentUser.avatar,
    status: mode,
    task: task,
    isOnline: true
  });
  renderLoungeMembers();

  if (!GAS_API_URL.includes("YOUR_DATABASE")) {
    fetch(GAS_API_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "updateStatus",
        customId: currentUser.customId,
        nickname: currentUser.name,
        status: mode,
        task: task
      })
    });
  }
  showCustomDialog({ icon: '🟢', title: 'ステータス更新', message: '自習室の在席状況を更新しました。' });
};

// =========================================================================
// 4. ソーシャル機能統合（フィード・ストーリーズ・AI・公開プロフィール）
// =========================================================================

// Xライク・フィード
window.publishFeedPost = function() {
  const input = document.getElementById('feedPostInput');
  const text = input.value.trim();
  if (!text) return;

  const newPost = {
    id: 'post_' + Date.now(),
    author: currentUser.name,
    customId: currentUser.customId,
    avatar: currentUser.avatar,
    rank: currentUser.rank,
    text: text,
    likes: 0,
    time: '今'
  };

  feedPosts.unshift(newPost);
  localStorage.setItem('cncm_feed_cache', JSON.stringify(feedPosts));
  input.value = '';
  renderFeed();
};

function renderFeed() {
  const stream = document.getElementById('feedStreamArea');
  if (!stream) return;
  stream.innerHTML = '';

  const dashCount = document.getElementById('dashFeedCount');
  if (dashCount) dashCount.innerText = feedPosts.length;

  if (feedPosts.length === 0) {
    stream.innerHTML = '<div class="empty-state-notice">投稿はまだありません。最初の進捗をつぶやいてみましょう！</div>';
    return;
  }

  feedPosts.forEach(post => {
    const card = document.createElement('div');
    card.className = 'feed-card';
    card.innerHTML = `
      <div class="feed-header">
        <div class="header-avatar" style="width:28px; height:28px;">${post.avatar}</div>
        <strong>${post.author}</strong>
        <span class="ore-rank-badge rank-${post.rank.toLowerCase()}">${post.rank}</span>
        <span class="sub-text">${post.time}</span>
      </div>
      <div style="font-size:0.85rem; line-height:1.4; margin:0.4rem 0;">${post.text}</div>
      <div class="feed-actions">
        <span style="cursor:pointer;" onclick="likeFeedPost('${post.id}')">❤️ ${post.likes}</span>
        <span style="cursor:pointer;" onclick="openUserProfile('${post.customId}')">👤 プロフィール</span>
      </div>
    `;
    stream.appendChild(card);
  });
}

window.likeFeedPost = function(id) {
  const p = feedPosts.find(x => x.id === id);
  if (p) {
    p.likes++;
    localStorage.setItem('cncm_feed_cache', JSON.stringify(feedPosts));
    renderFeed();
  }
};

// ストーリーズ
window.openNewStoryDialog = function() {
  const txt = prompt('24時間で消滅する進捗・ひとことストーリーズを投稿:');
  if (!txt) return;
  stories.unshift({ author: currentUser.name, avatar: currentUser.avatar, content: txt });
  localStorage.setItem('cncm_stories_cache', JSON.stringify(stories));
  renderStories();
};

function renderStories() {
  const tray = document.getElementById('storiesTray');
  if (!tray) return;
  const addBtn = tray.querySelector('.add-story');
  tray.innerHTML = '';
  if (addBtn) tray.appendChild(addBtn);

  stories.forEach(s => {
    const c = document.createElement('div');
    c.className = 'story-circle';
    c.onclick = () => showCustomDialog({ title: `${s.author}のストーリー`, message: s.content });
    c.innerHTML = `<div class="story-avatar-wrap">${s.avatar}</div><span>${s.author}</span>`;
    tray.appendChild(c);
  });
}

// AIコンシェルジュ
window.toggleAiConcierge = function() {
  const win = document.getElementById('aiConciergeWindow');
  win.style.display = (win.style.display === 'none') ? 'flex' : 'none';
};

window.askAiConcierge = function() {
  const input = document.getElementById('aiChatInput');
  const txt = input.value.trim();
  if (!txt) return;

  const stream = document.getElementById('aiChatStream');
  stream.innerHTML += `<div class="chat-bubble mine">${txt}</div>`;
  input.value = '';

  setTimeout(() => {
    stream.innerHTML += `<div class="chat-bubble other">【AI】「${txt}」ですね！制作アイデアの壁打ちならフォーラムのQ&Aスレッドもぜひご活用ください！</div>`;
    stream.scrollTop = stream.scrollHeight;
  }, 400);
};

// 公開プロフィール
window.openUserProfile = function(cid) {
  const modal = document.getElementById('publicProfileModal');
  const content = document.getElementById('publicProfileContent');
  content.innerHTML = `
    <div style="text-align:center; padding:1rem 0;">
      <div class="header-avatar" style="width:56px; height:56px; font-size:2rem; margin:0 auto 0.6rem;">🎨</div>
      <h3>クリエイター (${cid})</h3>
      <span class="ore-rank-badge rank-coal">Coal</span>
      <div style="display:flex; gap:0.5rem; justify-content:center; margin-top:1.2rem;">
        <button class="btn btn-primary btn-small" onclick="requestFriend('${cid}')">🤝 フレンド申請</button>
      </div>
    </div>
  `;
  modal.style.display = 'flex';
};

window.requestFriend = function(cid) {
  if (!friends.includes(cid)) {
    friends.push(cid);
    localStorage.setItem('cncm_friends_cache', JSON.stringify(friends));
  }
  showCustomDialog({ icon: '🤝', title: 'フレンド申請', message: `${cid} にフレンド申請を送りました！` });
};

// =========================================================================
// 5. Google Driveエクスプローラー ＆ 完全匿名アップロード
// =========================================================================
let activeSubFolderName = "SE_BGM";

window.openDriveExplorer = function(subName) {
  activeSubFolderName = subName || "SE_BGM";
  openModal('driveExplorerModal');
  const title = document.getElementById('explorerFolderTitle');
  const count = document.getElementById('explorerItemCount');
  const container = document.getElementById('explorerGridContainer');
  const loading = document.getElementById('explorerLoadingNotice');

  title.innerText = `📁 ${activeSubFolderName}`;
  count.innerText = "読込中...";
  container.innerHTML = "";
  loading.style.display = "block";

  if (DRIVE_GAS_API_URL.includes("YOUR_DRIVE")) {
    loading.innerText = "Drive専用GASのURLを設定すると、素材がリアルタイム同期されます。";
    return;
  }

  fetch(`${DRIVE_GAS_API_URL}?action=getFilesBySubFolder&subFolderName=${encodeURIComponent(activeSubFolderName)}`)
    .then(res => res.json())
    .then(response => {
      loading.style.display = "none";
      if (response.status !== "success" || !response.files || response.files.length === 0) {
        count.innerText = "0件";
        container.innerHTML = `<div class="empty-state-notice" style="grid-column:1/-1;">素材がありません。「ファイルを追加」から匿名アップロードできます！</div>`;
        return;
      }
      count.innerText = `${response.files.length}件`;
      response.files.forEach(f => {
        const card = document.createElement('div');
        card.className = "card no-margin-bottom";
        card.innerHTML = `
          <strong>${f.name}</strong>
          <div class="sub-text">${f.size}</div>
          <div style="display:flex; gap:0.4rem; margin-top:0.6rem;">
            <a href="${f.previewUrl}" target="_blank" class="btn btn-outline btn-small" style="flex:1; text-align:center; text-decoration:none;">別窓</a>
            <a href="${f.downloadUrl}" class="btn btn-primary btn-small" style="flex:1; text-align:center; text-decoration:none;" download>保存</a>
          </div>
        `;
        container.appendChild(card);
      });
    })
    .catch(() => {
      loading.innerText = "Drive通信エラーが発生しました。";
    });
};

let fileToUpload = null;
window.openDriveUploadModal = function(inputId, subName) {
  activeSubFolderName = subName || activeSubFolderName;
  fileToUpload = null;
  document.getElementById('selectedFileNameDisplay').innerText = '選択されていません (上限: 約40MB)';
  document.getElementById('startUploadBtn').disabled = true;
  document.getElementById('uploadProgressArea').style.display = 'none';
  openModal('driveUploadAddonModal');
};

window.handleFileSelected = function(e) {
  const f = e.target.files[0];
  if (!f) return;
  if (f.size > 40 * 1024 * 1024) {
    alert('40MBを超える大容量ファイルはギガファイル便等をご利用ください。');
    return;
  }
  fileToUpload = f;
  document.getElementById('selectedFileNameDisplay').innerText = `選択中: ${f.name} (${(f.size/1024/1024).toFixed(1)} MB)`;
  document.getElementById('startUploadBtn').disabled = false;
};

window.executeDriveUpload = function() {
  if (!fileToUpload) return;
  const btn = document.getElementById('startUploadBtn');
  const pArea = document.getElementById('uploadProgressArea');
  const pBar = document.getElementById('uploadProgressBar');
  btn.disabled = true;
  pArea.style.display = 'block';
  pBar.style.width = '40%';

  const reader = new FileReader();
  reader.onload = function(e) {
    pBar.style.width = '70%';
    const base64 = e.target.result.split(',')[1];
    fetch(DRIVE_GAS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: JSON.stringify({
        action: 'uploadFile',
        subFolderName: activeSubFolderName,
        fileName: fileToUpload.name,
        mimeType: fileToUpload.type,
        base64: base64
      })
    })
    .then(res => res.json())
    .then(res => {
      if (res.status === 'success') {
        pBar.style.width = '100%';
        setTimeout(() => {
          closeModal('driveUploadAddonModal');
          alert('団体Driveへの完全匿名アップロードが完了しました！🎉');
          openDriveExplorer(activeSubFolderName);
        }, 500);
      } else {
        throw new Error(res.message);
      }
    })
    .catch(err => {
      alert('アップロード失敗: ' + err.message);
      btn.disabled = false;
      pArea.style.display = 'none';
    });
  };
  reader.readAsDataURL(fileToUpload);
};

// =========================================================================
// 6. 管理者裏コマンド ＆ 統括司令室エンジン
// =========================================================================
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
    launchAdminCommandCenter();
  } else {
    alert('セキュリティコードが違います。');
  }
};

window.launchAdminCommandCenter = function() {
  document.getElementById('userAppContainer').style.display = 'none';
  document.getElementById('adminDashboardRoot').style.display = 'flex';
  fetchAdminUsers();
};

window.exitAdminCenter = function() {
  document.getElementById('adminDashboardRoot').style.display = 'none';
  document.getElementById('userAppContainer').style.display = 'flex';
};

function fetchAdminUsers() {
  if (GAS_API_URL.includes("YOUR_DATABASE")) return;
  fetch(`${GAS_API_URL}?action=adminGetAllUsers`)
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
    c.className = 'admin-user-card';
    c.innerHTML = `
      <div style="display:flex; justify-content:space-between;">
        <strong>${u.nickname}</strong>
        <span class="ore-rank-badge rank-${u.rank.toLowerCase()}">${u.rank}</span>
      </div>
      <div class="sub-text">ID: ${u.customId}</div>
      <div style="display:flex; gap:0.3rem; margin-top:0.4rem;">
        <select class="form-control" style="padding:0.2rem; font-size:0.75rem;" onchange="adminChangeRank('${u.customId}', this.value)">
          <option value="">ランク変更▼</option>
          <option value="Coal">Coal</option><option value="Iron">Iron</option><option value="Gold">Gold</option><option value="Diamond">Diamond</option>
        </select>
        <button class="btn btn-danger btn-small" onclick="adminBanUser('${u.customId}')">BAN</button>
      </div>
    `;
    grid.appendChild(c);
  });
}

window.adminChangeRank = function(cid, r) {
  if (!r) return;
  postAdminAction({ action: "adminUpdateUser", customId: cid, rank: r });
};

window.adminBanUser = function(cid) {
  postAdminAction({ action: "adminUpdateUser", customId: cid, isBanned: true, banReason: "規約違反" });
  alert(`${cid} をBANしました。`);
};

window.submitRegisterAdminAccount = function() {
  const id = document.getElementById('newAdminIdInput').value.trim();
  const name = document.getElementById('newAdminNameInput').value.trim();
  const role = document.getElementById('newAdminRoleSelect').value;
  const pass = document.getElementById('newAdminPasswordInput').value.trim();
  if (!id || !name || pass.length < 6) return alert('全項目を入力してください（パスワード6文字以上）。');
  postAdminAction({ action: "registerAdminAccount", adminId: id, adminName: name, adminRole: role, password: pass });
  alert(`運営アカウント【${name}】を発行しました！`);
};

window.adminPublishOfficialTopic = function() {
  const title = document.getElementById('adminNewTopicTitle').value.trim();
  const desc = document.getElementById('adminNewTopicDesc').value.trim();
  if (!title) return;
  postAdminAction({ action: "createOfficialTopic", title: title, desc: desc });
  alert('公式コンペお題を配信しました！');
};

window.triggerSnapshotBackup = function() {
  postAdminAction({ action: "createBackupSnapshot" });
  alert('スプレッドシートの完全スナップショット複製を作成しました。');
};

window.triggerPanicLockdown = function() {
  alert('🚨 パニックモード発動：全セッションを切断し、入場ゲートを完全封鎖しました。');
};

function postAdminAction(payload) {
  if (GAS_API_URL.includes("YOUR_DATABASE")) return;
  fetch(GAS_API_URL, {
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

// =========================================================================
// 7. 基本UI制御・ユーティリティ・起動処理
// =========================================================================
window.switchMainTab = function(panelId, btn) {
  document.querySelectorAll('.main-tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.app-panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  const target = document.getElementById(panelId);
  if (target) target.classList.add('active');
};

window.switchSubTab = function(parentPanelId, subPanelId, btn) {
  const parent = document.getElementById(parentPanelId);
  if (!parent) return;
  parent.querySelectorAll('.sub-tab-btn').forEach(b => b.classList.remove('active'));
  parent.querySelectorAll('.sub-panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  const target = document.getElementById(subPanelId);
  if (target) target.classList.add('active');
};

window.openModal = function(id) { const el = document.getElementById(id); if (el) el.style.display = 'flex'; };
window.closeModal = function(id) { const el = document.getElementById(id); if (el) el.style.display = 'none'; };

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

// 初期起動パイプライン
window.onload = () => {
  // ユーザーヘッダー描画
  document.getElementById('displayUsername').innerText = `${currentUser.name} (${currentUser.customId})`;
  document.getElementById('dashUserGreeting').innerText = currentUser.name;
  document.getElementById('hubCustomIdDisplay').innerText = currentUser.customId;
  document.getElementById('hubLikesDisplay').innerText = currentUser.likesReceived;

  const badge = document.getElementById('headerRankBadge');
  badge.className = `ore-rank-badge rank-${currentUser.rank.toLowerCase()}`;
  badge.innerText = currentUser.rank;

  // 在席自動同期開始
  syncLoungeMembersFromGAS();
  setInterval(syncLoungeMembersFromGAS, 30000);

  // ソーシャル描画
  renderFeed();
  renderStories();

  // 運営自動直行判定
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('launchAdmin') === 'true' || localStorage.getItem('cncm_is_admin') === 'true') {
    launchAdminCommandCenter();
  }
};
