/**
 * CNCM Lounge & Port Engine - lounge.js
 * 役割: エポックミリ秒による厳密3分在席判定, 自習室更新, ラウンジ全体チャット
 */

let loungeMembers = [];

// 60秒おきの生存信号（ハートビート）
setInterval(() => {
  if (currentUser.customId && !GAS_DATABASE_URL.includes("YOUR_DATABASE")) {
    fetch(`${GAS_DATABASE_URL}?action=heartbeat&customId=${encodeURIComponent(currentUser.customId)}`, { mode: "no-cors" }).catch(() => {});
  }
}, 60000);

// タブ閉じ・画面離脱時の即時切断
window.addEventListener('beforeunload', () => {
  if (currentUser.customId && !GAS_DATABASE_URL.includes("YOUR_DATABASE")) {
    navigator.sendBeacon(`${GAS_DATABASE_URL}?action=logout&customId=${encodeURIComponent(currentUser.customId)}`);
  }
});

// 在席同期
window.syncLoungeMembersFromGAS = async function() {
  if (GAS_DATABASE_URL.includes("YOUR_DATABASE")) return;
  try {
    const res = await fetch(`${GAS_DATABASE_URL}?action=getLoungeMembers`);
    const data = await res.json();
    if (Array.isArray(data)) {
      loungeMembers = data;
      renderLoungeMembers();

      const onlineCount = data.filter(m => m.isOnline).length;
      const dashOnlineEl = document.getElementById('dashOnlineCount');
      if (dashOnlineEl) dashOnlineEl.innerText = onlineCount;
      const counterEl = document.getElementById('loungeOnlineCounter');
      if (counterEl) counterEl.innerText = `● ${onlineCount}名在席中`;
    }
  } catch (e) {
    console.warn("Lounge sync error:", e);
  }
};

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
    row.className = 'member-row glass-interactive';
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

  // オプティミスティック即時反映
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
  showToast('自習室の在席ステータスを更新しました！', 'success');
};

// ラウンジ全体チャット
window.sendOpenChatMessage = function() {
  const input = document.getElementById('openChatInput');
  const text = input ? input.value.trim() : '';
  if (!text) return;

  const stream = document.getElementById('openChatStream');
  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble mine';
  bubble.innerText = text;
  stream.appendChild(bubble);
  input.value = '';
  stream.scrollTop = stream.scrollHeight;
};

document.addEventListener('DOMContentLoaded', () => {
  syncLoungeMembersFromGAS();
  setInterval(syncLoungeMembersFromGAS, 30000);
});
