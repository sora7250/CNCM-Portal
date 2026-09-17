/**
 * CNCM Drive Integration Module - drive.js
 * 役割: 7大サブフォルダ自動スキャン, 素材プレビュー＆ダウンロード, 完全匿名プロキシアップロード
 */

let activeSubFolderName = "SE_BGM";
let fileToUpload = null;

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
        card.className = "glass-card";
        card.style.padding = "1rem";
        card.innerHTML = `
          <strong>${f.name}</strong>
          <div class="sub-text" style="margin: 0.3rem 0;">${f.size} ｜ ${f.updated}</div>
          <div style="display:flex; gap:0.4rem; margin-top:0.6rem;">
            <a href="${f.previewUrl}" target="_blank" class="btn btn-outline btn-small glass-interactive" style="flex:1; text-align:center; text-decoration:none;">別窓</a>
            <a href="${f.downloadUrl}" class="btn btn-primary btn-small glass-interactive" style="flex:1; text-align:center; text-decoration:none;" download>保存</a>
          </div>
        `;
        container.appendChild(card);
      });
    })
    .catch(() => {
      loading.innerText = "Drive通信エラーが発生しました。URLと権限をご確認ください。";
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
    return showToast('40MBを超える大容量ファイルはギガファイル便等をご利用ください。', 'error');
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
          showToast('団体Driveへの完全匿名アップロードが完了しました！🎉', 'success');
          openDriveExplorer(activeSubFolderName);
        }, 500);
      } else {
        throw new Error(res.message);
      }
    })
    .catch(err => {
      showToast('アップロード失敗: ' + err.message, 'error');
      btn.disabled = false;
      pArea.style.display = 'none';
    });
  };
  reader.readAsDataURL(fileToUpload);
};
