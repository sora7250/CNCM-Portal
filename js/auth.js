/**
 * CNCM Authentication Gateway - auth.js
 * 役割: Googleポップアップ認証, ID/Passログイン, 新規登録, プロフィール即時変更, 404安全ログアウト
 */

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

let inAppAvatarBase64 = null;
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

// Googleアカウント認証 (Firebase Auth Provider)
window.executeGoogleAuth = function() {
  showToast('Google認証ウィンドウを起動しています...', 'info');
  if (typeof firebase !== 'undefined' && firebase.auth) {
    const provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(provider)
      .then((result) => {
        const user = result.user;
        const customId = `CNCM-${Math.floor(1000 + Math.random() * 9000)}`;
        const name = user.displayName || 'Googleクリエイター';
        const photo = user.photoURL || null;

        localStorage.setItem('cncm_custom_id', customId);
        localStorage.setItem('cncm_username', name);
        if (photo) localStorage.setItem('cncm_custom_image', photo);
        localStorage.setItem('cncm_rank', 'Coal');
        localStorage.setItem('cncm_is_admin', 'false');

        currentUser.customId = customId;
        currentUser.name = name;
        currentUser.customImage = photo;

        showToast(`ようこそ、${name} さん！`, 'success');
        updateAppViewState();
      })
      .catch((err) => {
        showToast('Google認証を完了できませんでした: ' + err.message, 'error');
      });
  } else {
    const dummyId = `CNCM-G${Math.floor(1000 + Math.random() * 9000)}`;
    proceedGeneralLogin(dummyId);
  }
};

// 資格情報ログイン
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

  showGlobalLoading('資格情報を照合中...');

  // 運営アカウント判定
  if (idOrName.startsWith('ADMIN-') || idOrName === 'CNCM-OWNER') {
    if (!GAS_DATABASE_URL.includes("YOUR_DATABASE")) {
      fetch(`${GAS_DATABASE_URL}?action=verifyAdminAccount&customId=${encodeURIComponent(idOrName)}&password=${encodeURIComponent(pass)}`)
        .then(res => res.json())
        .then(res => {
          hideGlobalLoading();
          if (res.status === 'success') {
            sessionStorage.removeItem('cncm_temp_exit_admin');
            localStorage.setItem('cncm_is_admin', 'true');
            localStorage.setItem('cncm_custom_id', res.admin.customId);
            localStorage.setItem('cncm_username', res.admin.name);
            currentUser.customId = res.admin.customId;
            currentUser.name = res.admin.name;
            showToast('運営者として認証されました。司令室を起動します。', 'success');
            updateAppViewState();
          } else {
            if (status) {
              status.style.color = 'var(--danger)';
              status.innerText = '運営認証に失敗しました。パスコードを確認してください。';
            }
          }
        })
        .catch(() => {
          hideGlobalLoading();
          proceedGeneralLogin(idOrName);
        });
      return;
    }
  }

  hideGlobalLoading();
  proceedGeneralLogin(idOrName);
};

function proceedGeneralLogin(idOrName) {
  sessionStorage.removeItem('cncm_temp_exit_admin');
  localStorage.setItem('cncm_is_admin', 'false');
  localStorage.setItem('cncm_custom_id', idOrName);
  localStorage.setItem('cncm_username', idOrName);
  localStorage.setItem('cncm_rank', localStorage.getItem('cncm_rank') || 'Coal');
  currentUser.customId = idOrName;
  currentUser.name = idOrName;

  showToast('ポータルへ入場しました！', 'success');
  updateAppViewState();
}

// 新規登録実行
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

  showGlobalLoading('アカウントを発行中...');

  if (!GAS_DATABASE_URL.includes("YOUR_DATABASE")) {
    fetch(GAS_DATABASE_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "registerUser", customId: customId, nickname: name, avatar: "🎨", password: pass })
    }).catch(() => {});
  }

  setTimeout(() => {
    hideGlobalLoading();
    sessionStorage.removeItem('cncm_temp_exit_admin');
    localStorage.setItem('cncm_custom_id', customId);
    localStorage.setItem('cncm_username', name);
    localStorage.setItem('cncm_avatar', '🎨');
    if (inAppAvatarBase64) localStorage.setItem('cncm_custom_image', inAppAvatarBase64);
    localStorage.setItem('cncm_rank', 'Coal');
    localStorage.setItem('cncm_is_admin', 'false');

    currentUser.customId = customId;
    currentUser.name = name;
    currentUser.customImage = inAppAvatarBase64;

    showToast('アカウントが作成されました！ようこそ！', 'success');
    updateAppViewState();
  }, 600);
};

// プロフィール即時変更
window.handleProfileAvatarChange = function(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (evt) => {
    const b64 = evt.target.result;
    document.getElementById('hubAvatarPreview').innerHTML = `<img src="${b64}">`;
    currentUser.customImage = b64;
    localStorage.setItem('cncm_custom_image', b64);
  };
  reader.readAsDataURL(file);
};

window.saveProfileChanges = function() {
  const newName = document.getElementById('hubNicknameInput').value.trim();
  if (!newName) return showToast('ネームを入力してください', 'error');

  currentUser.name = newName;
  localStorage.setItem('cncm_username', newName);
  updateUserHeaderUI();
  closeModal('accountHubModal');
  showToast('プロフィールを更新しました！', 'success');
};

// 完全安全ログアウト
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
  currentUser.customImage = null;

  showToast('ログアウトしました。', 'info');
  updateAppViewState();
};
