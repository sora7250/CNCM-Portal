/**
 * CNCM 24h Stories Module - stories.js
 * 役割: 24時間エポック判定による自動消滅, メディア付きストーリーズ共有, フルスクリーン閲覧
 */

let stories = JSON.parse(localStorage.getItem('cncm_stories_cache') || '[]');

window.openNewStoryModal = function() {
  openModal('newStoryModal');
};

window.submitNewStory = function() {
  const textInput = document.getElementById('newStoryTextInput');
  const fileInput = document.getElementById('newStoryFileInput');
  const text = textInput ? textInput.value.trim() : '';
  const file = fileInput && fileInput.files ? fileInput.files[0] : null;

  if (!text && !file) {
    return showToast('テキストまたはメディアを選択してください', 'error');
  }

  showGlobalLoading('ストーリーズを共有中...');

  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      saveStoryToStore(text, e.target.result, file.type.startsWith('video') ? 'video' : 'image');
    };
    reader.readAsDataURL(file);
  } else {
    saveStoryToStore(text, null, 'text');
  }
};

function saveStoryToStore(text, mediaData, mediaType) {
  const now = Date.now();
  const storyItem = {
    id: 'story_' + now,
    author: currentUser.name,
    avatar: currentUser.avatar,
    customImage: currentUser.customImage,
    content: text,
    media: mediaData,
    mediaType: mediaType,
    createdAt: now,
    expiresAt: now + (24 * 60 * 60 * 1000) // 24時間後
  };

  stories.unshift(storyItem);
  localStorage.setItem('cncm_stories_cache', JSON.stringify(stories));

  const textInput = document.getElementById('newStoryTextInput');
  const fileInput = document.getElementById('newStoryFileInput');
  if (textInput) textInput.value = '';
  if (fileInput) fileInput.value = '';

  hideGlobalLoading();
  closeModal('newStoryModal');
  refreshStoriesTray();
  showToast('24時間ストーリーズを公開しました！', 'success');
}

window.refreshStoriesTray = function() {
  const tray = document.getElementById('storiesTray');
  if (!tray) return;

  const now = Date.now();
  stories = stories.filter(s => s.expiresAt > now);
  localStorage.setItem('cncm_stories_cache', JSON.stringify(stories));

  const addBtn = tray.querySelector('.add-story');
  tray.innerHTML = '';
  if (addBtn) tray.appendChild(addBtn);

  stories.forEach(s => {
    const c = document.createElement('div');
    c.className = 'story-circle glass-interactive';
    c.onclick = () => viewStoryDetail(s);
    c.innerHTML = `
      <div class="story-avatar-wrap">
        ${s.customImage ? `<img src="${s.customImage}">` : (s.avatar || '🎨')}
      </div>
      <span>${s.author}</span>
    `;
    tray.appendChild(c);
  });
};

function viewStoryDetail(story) {
  let mediaDisplay = '';
  if (story.media) {
    if (story.mediaType === 'video') {
      mediaDisplay = `<video src="${story.media}" controls autoplay style="width:100%; border-radius:12px; max-height:300px; margin-top:0.8rem;"></video>`;
    } else {
      mediaDisplay = `<img src="${story.media}" style="width:100%; border-radius:12px; max-height:300px; object-fit:cover; margin-top:0.8rem;">`;
    }
  }

  showCustomDialog({
    icon: '✨',
    title: `${story.author} のストーリーズ`,
    message: `<div style="text-align:left;">${story.content || ''}${mediaDisplay}</div>`
  });
}

document.addEventListener('DOMContentLoaded', () => {
  refreshStoriesTray();
  setInterval(refreshStoriesTray, 600000);
});
