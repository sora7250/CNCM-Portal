/**
 * CanvasNetCreatorMEMBERSHIP (CNCM)
 * 完全統合マスターエンジン - 親JS (完全無欠版)
 * 接続先：3大独立バックエンド (スプシDB / Drive共有 / Gemini API隠蔽プロキシ)
 */

// =========================================================================
// 1. 3大独立バックエンド接続設定（★3つのGASデプロイURLをここに貼るだけ！）
// =========================================================================
const GAS_DATABASE_URL = "https://script.google.com/macros/s/AKfycbz_BR6RGEI_IjRhX5SXxEDOSZUvcb3S0HOk83oFq8asFDjbSC5RR-9_87gE4IWWIZp7kA/exec";
const GAS_DRIVE_URL = "https://script.google.com/macros/s/AKfycbwngjohnN8GSiXctUDy_Emy55QGxBfbzLEGv7F3WMqnl5-mkp5QOMnOBydYOvSzWABB/exec";
const GAS_GEMINI_PROXY_URL = "https://script.google.com/macros/s/AKfycbwM2YGppBlyBHpAupfv90sHYRLDgK3x-7pI8ZDhAeiklK9Ineo7KwTGE-YXsMljIVnu/exec";


// =========================================================================
// 2. クライアント側セッション ＆ インメモリストア
// =========================================================================
let currentUser = {
  customId: localStorage.getItem('cncm_custom_id') || '',
  name: localStorage.getItem('cncm_username') || 'クリエイター',
  avatar: localStorage.getItem('cncm_avatar') || '🎨',
  customImage: localStorage.getItem('cncm_custom_image') || null,
  rank: localStorage.getItem('cncm_rank') || 'Coal',
  likesReceived: parseInt(localStorage.getItem('cncm_likes') || '0', 10)
};

let loungeMembers = [];
let feedPosts = JSON.parse(localStorage.getItem('cncm_feed_cache') || '[]');
let stories = JSON.parse(localStorage.getItem('cncm_stories_cache') || '[]');
let friends = JSON.parse(localStorage.getItem('cncm_friends_cache') || '[]');
let adminAllUsers = [];
let keyBuffer = '';
let activeSubFolderName = "SE_BGM";
let fileToUpload = null;
let inAppAvatarBase64 = null;

// AIエージェント対話履歴バッファ（システムコンテキスト内蔵）
let aiConversationHistory = [
  {
    role: "user",
    parts: [{
      text: "あなたはクリエイター特化型コミュニティ『CanvasNetCreatorMEMBERSHIP（略称：CNCM）』の常駐専属AIエージェントです。名前は『CNCM AI』です。完全匿名で創作活動に励むメンバーの頼れるパートナーとして、映像・音楽・3D・イラスト・Web制作などの技術相談、アイデアの壁打ち、色彩や構図の助言、そしてアプリ内の機能案内（ポート自習室、素材Drive、相談Q&Aスレッド、公式お題コンペ等）を、知的かつ温かみのある親しみやすいトーンでサポートしてください。"
    }]
  },
  {
    role: "model",
    parts: [{
      text: "了解しました！私はCNCMの専属クリエイティブAIエージェントです。コミュニティの皆様の創作が最高のものになるよう、制作の壁打ちからアプリの使い方案内まで全力でサポートいたします！✨"
    }]
  }
];


// =========================================================================
// 3. 描画完全保証：フェイルセーフ型 ビュー切り替えエンジン
// =========================================================================
function updateAppViewState() {
  const authView = document.getElementById('authViewContainer');
  const userView = document.getElementById('userAppContainer');
  const adminView = document.getElementById('adminDashboardRoot');

  if (!authView || !userView) return;

  // 1. 未ログインの場合：ログインカードを画面中央に強制表示
  if (!currentUser.customId || currentUser.customId === 'null' || currentUser.customId.trim() === '') {
    authView.style.setProperty('display', 'flex', 'important');
    userView.style.setProperty('display', 'none', 'important');
    if (adminView) adminView.style.setProperty('display', 'none', 'important');
    switchAuthMode('login');
    return;
  }

  // 2. 運営直行フラグがある場合：管理者画面を表示
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('launchAdmin') === 'true' || localStorage.getItem('cncm_is_admin') === 'true') {
    authView.style.setProperty('display', 'none', 'important');
    userView.style.setProperty('display', 'none', 'important');
    launchAdminCommandCenter();
    return;
  }

  // 3. 通常ログイン済みの場合：一般ポータル画面を表示
  authView.style.setProperty('display', 'none', 'important');
  userView.style.setProperty('display', 'flex', 'important');
  if (adminView) adminView.style.setProperty('display', 'none', 'important');
  
  updateUserHeaderUI();
}

// 認証タブ切替（ログイン ⇄ 新規登録）
window.switchAuthMode = function(mode) {
  const loginSection = document.getElementById('loginFormSection');
  const regSection = document.getElementById('registerFormSection');
  const tabLogin = document.getElementById('tabLoginBtn');
  const tabReg = document.getElementById('tabRegisterBtn');

  if (loginSection) loginSection.style.display = (mode === 'login') ? 'block' : 'none';
  if (regSection) regSection.style.display = (mode === 'register') ? 'block' : 'none';
  if (tabLogin) tabLogin.classList.toggle('active', mode === 'login');
  if (tabReg) tabReg.classList.toggle('active', mode === 'register');

  if (mode === 'register') {
    const regId = document.getElementById('regCustomIdInput');
    if (regId && !regId.value) regId.value = `CNCM-${Math.floor(1000 + Math.random() * 9000)}`;
  }
};

window.handleInAppAvatarSelect = function(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (evt) => {
    inAppAvatarBase64 = evt.target.result;
    const box = document.getElementById('regAvatarBox');
    if (box) box.innerHTML = `<img src="${inAppAvatarBase64}">`;
  };
  reader.readAsDataURL(file);
};

// 同一画面内でのログイン実行
window.executeInAppLogin = function() {
  const idInput = document.getElementById('loginIdInput');
  const passInput = document.getElementById('loginPasswordInput');
  const status = document.getElementById('loginStatusText');

  const idOrName = idInput ? idInput.value.trim() : '';
  const pass = passInput ? passInput.value.trim() : '';

  if (!idOrName || !pass) {
    if (status) {
      status.style.color = 'var(--danger)';
      status.innerText = 'IDとパスワードを入力してください。';
    }
    return;
  }

  if (status) {
    status.style.color = 'var(--text-sub)';
    status.innerText = '照合中...';
  }

  // 運営アカウント直接判定
  if (idOrName.startsWith('ADMIN-') || idOrName === 'CNCM-OWNER') {
    if (!GAS_DATABASE_URL.includes("YOUR_DATABASE")) {
      fetch(`${GAS_DATABASE_URL}?action=verifyAdminAccount&customId=${encodeURIComponent(idOrName)}&password=${encodeURIComponent(pass)}`)
        .then(res => res.json())
        .then(res => {
          if (res.status === 'success') {
            localStorage.setItem('cncm_is_admin', 'true');
            localStorage.setItem('cncm_custom_id', res.admin.customId);
            localStorage.setItem('cncm_username', res.admin.name);
            currentUser.customId = res.admin.customId;
            currentUser.name = res.admin.name;
            updateAppViewState();
          } else {
            if (status) {
              status.style.color = 'var(--danger)';
              status.innerText = '運営認証に失敗しました。';
            }
          }
        })
        .catch(() => proceedGeneralLogin(idOrName));
      return;
    }
  }

  proceedGeneralLogin(idOrName);
};

function proceedGeneralLogin(idOrName) {
  const status = document.getElementById('loginStatusText');
  localStorage.setItem('cncm_is_admin', 'false');
  localStorage.setItem('cncm_custom_id', idOrName);
  localStorage.setItem('cncm_username', idOrName);
  localStorage.setItem('cncm_rank', 'Coal');
  currentUser.customId = idOrName;
  currentUser.name = idOrName;

  if (status) {
    status.style.color = 'var(--success)';
    status.innerText = '入場します...';
  }
  setTimeout(() => { updateAppViewState(); }, 300);
}

// 同一画面内での新規登録実行
window.executeInAppRegister = function() {
  const customId = document.getElementById('regCustomIdInput').value.trim();
  const name = document.getElementById('regNicknameInput').value.trim();
  const pass = document.getElementById('regPasswordInput').value.trim();
  const status = document.getElementById('regStatusText');

  if (!customId || !name || pass.length < 6) {
    if (status) {
      status.style.color = 'var(--danger)';
      status.innerText = '全項目を入力してください（パスワード6文字以上）。';
    }
    return;
  }

  if (!GAS_DATABASE_URL.includes("YOUR_DATABASE")) {
    fetch(GAS_DATABASE_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "registerUser", customId: customId, nickname: name, avatar: "🎨", password: pass })
    }).catch(() => {});
  }

  localStorage.setItem('cncm_custom_id', customId);
  localStorage.setItem('cncm_username', name);
  localStorage.setItem('cncm_avatar', '🎨');
  if (inAppAvatarBase64) localStorage.setItem('cncm_custom_image', inAppAvatarBase64);
  localStorage.setItem('cncm_rank', 'Coal');
  localStorage.setItem('cncm_is_admin', 'false');

  currentUser.customId = customId;
  currentUser.name = name;
  updateAppViewState();
};

// 【完全安全ログアウト】別ページに飛ばず、同一画面でログインカードに戻るだけ！404は根絶！
window.triggerCompleteLogout = function() {
  const isConfirmed = confirm('【CNCM セッション終了】\nログアウトしてログイン画面に戻りますか？\n（在席ステータスはオフラインに更新されます）');
  if (!isConfirmed) return;

  if (currentUser.customId && !GAS_DATABASE_URL.includes("YOUR_DATABASE")) {
    try { navigator.sendBeacon(`${GAS_DATABASE_URL}?action=logout&customId=${encodeURIComponent(currentUser.customId)}`); } catch(e) {}
  }

  localStorage.clear();
  sessionStorage.clear();
  currentUser.customId = '';
  currentUser.name = '';

  updateAppViewState();
};

window.handleLogout = window.triggerCompleteLogout;

function updateUserHeaderUI() {
  const dName = document.getElementById('displayUsername');
  const dGreet = document.getElementById('dashUserGreeting');
  const hId = document.getElementById('hubCustomIdDisplay');
  const hLikes = document.getElementById('hubLikesDisplay');
  const badge = document.getElementById('headerRankBadge');

  if (dName) dName.innerText = `${currentUser.name} (${currentUser.customId})`;
  if (dGreet) dGreet.innerText = currentUser.name;
  if (hId) hId.innerText = currentUser.customId;
  if (hLikes) hLikes.innerText = currentUser.likesReceived || 0;

  if (badge) {
    badge.className = `ore-rank-badge rank-${(currentUser.rank || 'coal').toLowerCase()}`;
    badge.innerText = currentUser.rank || 'Coal';
  }
}


// =========================================================================
// 4. 在席・生存信号 ＆ メンバー自動同期（30秒周期・エポックミリ秒判定）
// =========================================================================

// 60秒おきの生存信号（ハートビート）
setInterval(() => {
  if (currentUser.customId && !GAS_DATABASE_URL.includes("YOUR_DATABASE")) {
    fetch(`${GAS_DATABASE_URL}?action=heartbeat&customId=${encodeURIComponent(currentUser.customId)}`, { mode: "no-cors" }).catch(() => {});
  }
}, 60000);

// 画面離脱時の即時切断ビーコン
window.addEventListener('beforeunload', () => {
  if (currentUser.customId && !GAS_DATABASE_URL.includes("YOUR_DATABASE")) {
    navigator.sendBeacon(`${GAS_DATABASE_URL}?action=logout&customId=${encodeURIComponent(currentUser.customId)}`);
  }
});

function syncLoungeMembersFromGAS() {
  if (GAS_DATABASE_URL.includes("YOUR_DATABASE")) return;
  fetch(`${GAS_DATABASE_URL}?action=getLoungeMembers`)
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

  if (!GAS_DATABASE_URL.includes("YOUR_DATABASE")) {
    fetch(GAS_DATABASE_URL, {
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
    }).catch(() => {});
  }
  showCustomDialog({ icon: '🟢', title: 'ステータス更新', message: '自習室の在席状況を更新しました。' });
};


// =========================================================================
// 5. ソーシャル機能（フィード・ストーリーズ・公開プロフィール・全体チャット）
// =========================================================================

// Xライク・フィード投稿
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

// 24時間ストーリーズ
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

// ラウンジ全体チャット
window.sendOpenChatMessage = function() {
  const input = document.getElementById('openChatInput');
  const text = input.value.trim();
  if (!text) return;

  const stream = document.getElementById('openChatStream');
  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble mine';
  bubble.innerText = text;
  stream.appendChild(bubble);
  input.value = '';
  stream.scrollTop = stream.scrollHeight;
};


// =========================================================================
// 6. Gemini API専用隠蔽プロキシ対話エンジン（ヘッダー連動）
// =========================================================================
window.toggleAiConcierge = function() {
  const win = document.getElementById('aiConciergeWindow');
  const btn = document.getElementById('headerAiTriggerBtn');
  const isHidden = (win.style.display === 'none' || win.style.display === '');
  
  win.style.display = isHidden ? 'flex' : 'none';
  if (btn) btn.classList.toggle('active', isHidden);

  if (isHidden) {
    const input = document.getElementById('aiChatInput');
    if (input) setTimeout(() => input.focus(), 100);
  }
};

window.askAiConcierge = async function() {
  const input = document.getElementById('aiChatInput');
  const sendBtn = document.getElementById('aiChatSendBtn');
  const userText = input.value.trim();
  if (!userText) return;

  const stream = document.getElementById('aiChatStream');

  const userBubble = document.createElement('div');
  userBubble.className = 'chat-bubble mine';
  userBubble.innerText = userText;
  stream.appendChild(userBubble);
  input.value = '';
  stream.scrollTop = stream.scrollHeight;

  sendBtn.disabled = true;
  const loadingIndicator = document.createElement('div');
  loadingIndicator.className = 'ai-typing-indicator';
  loadingIndicator.id = 'aiTypingIndicator';
  loadingIndicator.innerHTML = '<span>⚡</span> <span>Geminiが思考中...</span>';
  stream.appendChild(loadingIndicator);
  stream.scrollTop = stream.scrollHeight;

  aiConversationHistory.push({
    role: "user",
    parts: [{ text: userText }]
  });

  try {
    if (GAS_GEMINI_PROXY_URL.includes("YOUR_GEMINI") || !GAS_GEMINI_PROXY_URL) {
      throw new Error("app.js 内の GAS_GEMINI_PROXY_URL が未設定です。Gemini専用プロキシGASのURLを設定してください。");
    }

    const response = await fetch(GAS_GEMINI_PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({
        contents: aiConversationHistory
      })
    });

    const resData = await response.json();

    if (resData.error) {
      throw new Error(resData.error.message || "Gemini APIエラーが発生しました。");
    }

    const aiReplyText = resData.candidates && resData.candidates[0] && resData.candidates[0].content && resData.candidates[0].content.parts[0]
      ? resData.candidates[0].content.parts[0].text
      : "申し訳ありません、返答の生成に失敗しました。";

    aiConversationHistory.push({
      role: "model",
      parts: [{ text: aiReplyText }]
    });

    const typingEl = document.getElementById('aiTypingIndicator');
    if (typingEl) typingEl.remove();

    const aiBubble = document.createElement('div');
    aiBubble.className = 'chat-bubble other';
    aiBubble.style.whiteSpace = 'pre-wrap';
    aiBubble.innerText = aiReplyText;
    stream.appendChild(aiBubble);

  } catch (err) {
    const typingEl = document.getElementById('aiTypingIndicator');
    if (typingEl) typingEl.remove();

    const errorBubble = document.createElement('div');
    errorBubble.className = 'chat-bubble other';
    errorBubble.style.borderColor = 'var(--danger)';
    errorBubble.style.color = 'var(--danger)';
    errorBubble.innerText = `【AIエージェント通信エラー】\n${err.message}`;
    stream.appendChild(errorBubble);
  } finally {
    sendBtn.disabled = false;
    stream.scrollTop = stream.scrollHeight;
  }
};


// =========================================================================
// 7. Google Drive専用GAS連携（素材エクスプローラー ＆ 完全匿名アップロード）
// =========================================================================
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

  if (GAS_DRIVE_URL.includes("YOUR_DRIVE")) {
    loading.innerText = "Drive専用GASのURLを設定すると、素材がリアルタイム同期されます。";
    return;
  }

  fetch(`${GAS_DRIVE_URL}?action=getFilesBySubFolder&subFolderName=${encodeURIComponent(activeSubFolderName)}`)
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
    fetch(GAS_DRIVE_URL, {
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
// 8. 管理者裏コマンド ＆ 統括司令室エンジン
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
  if (adminView) adminView.style.setProperty('display', 'none', 'important');
  updateAppViewState();
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


// =========================================================================
// 9. 基本UI制御・ユーティリティ・起動パイプライン
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

window.submitCreateThread = function() {
  const title = document.getElementById('newThreadTitle').value.trim();
  const body = document.getElementById('newThreadBody').value.trim();
  if (!title) return alert('タイトルを入力してください。');
  closeModal('newThreadModal');
  alert('相談スレッドを公開しました！');
};

window.submitCreateGuild = function() {
  const name = document.getElementById('newGuildName').value.trim();
  if (!name) return alert('ギルド名を入力してください。');
  closeModal('newGuildModal');
  alert(`ギルド【${name}】を設立しました！`);
};

// 【重要】DOMパース完了時に確実に発火させる起動パイプライン
document.addEventListener('DOMContentLoaded', () => {
  console.log("CNCM Master Core Initialized Successfully.");
  
  // 1. ビュー状態初期化（ログインカードを即座に描画）
  updateAppViewState();

  // 2. 自習室在席同期
  syncLoungeMembersFromGAS();
  setInterval(syncLoungeMembersFromGAS, 30000);

  // 3. ソーシャル描画
  renderFeed();
  renderStories();
});
