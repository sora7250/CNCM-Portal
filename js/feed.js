/**
 * CNCM Feed Module - feed.js
 * 役割: Threadsライクな複数画像添付・投稿・いいね・SWR永続化
 */

let feedPosts = JSON.parse(localStorage.getItem('cncm_feed_cache') || '[]');
let feedSelectedImages = [];

window.handleFeedImageSelect = function(e) {
  const files = Array.from(e.target.files);
  if (!files.length) return;

  const strip = document.getElementById('feedImagePreviewStrip');
  strip.style.display = 'flex';

  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      feedSelectedImages.push(evt.target.result);
      const img = document.createElement('img');
      img.src = evt.target.result;
      img.className = 'image-preview-thumb';
      strip.appendChild(img);
    };
    reader.readAsDataURL(file);
  });
};

window.publishFeedPost = function() {
  const input = document.getElementById('feedPostInput');
  const text = input ? input.value.trim() : '';

  if (!text && feedSelectedImages.length === 0) {
    return showToast('本文または画像を入力してください', 'error');
  }

  showGlobalLoading('投稿を公開中...');

  const newPost = {
    id: 'post_' + Date.now(),
    author: currentUser.name,
    customId: currentUser.customId,
    avatar: currentUser.avatar,
    customImage: currentUser.customImage,
    rank: currentUser.rank,
    text: text,
    images: [...feedSelectedImages],
    likes: 0,
    time: '今'
  };

  feedPosts.unshift(newPost);
  localStorage.setItem('cncm_feed_cache', JSON.stringify(feedPosts));

  input.value = '';
  feedSelectedImages = [];
  const strip = document.getElementById('feedImagePreviewStrip');
  if (strip) {
    strip.innerHTML = '';
    strip.style.display = 'none';
  }

  if (GAS_DATABASE_URL && !GAS_DATABASE_URL.includes("YOUR_DATABASE")) {
    fetch(GAS_DATABASE_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "publishFeedPost", post: newPost })
    }).catch(() => {});
  }

  setTimeout(() => {
    hideGlobalLoading();
    renderFeed();
    showToast('フィードに投稿しました！', 'success');
  }, 400);
};

window.renderFeed = function() {
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
    card.className = 'glass-card feed-card';

    let mediaHtml = '';
    if (post.images && post.images.length > 0) {
      mediaHtml = `<div class="feed-media-grid">` + 
        post.images.map(img => `<img src="${img}" onclick="window.open('${img}', '_blank')">`).join('') + 
        `</div>`;
    }

    card.innerHTML = `
      <div class="feed-header">
        <div class="header-avatar" style="width:30px; height:30px;">
          ${post.customImage ? `<img src="${post.customImage}">` : (post.avatar || '🎨')}
        </div>
        <strong>${post.author}</strong>
        <span class="ore-rank-badge rank-${(post.rank || 'coal').toLowerCase()}">${post.rank || 'Coal'}</span>
        <span class="sub-text">${post.time}</span>
      </div>
      <div style="font-size:0.9rem; line-height:1.5; margin:0.6rem 0; white-space:pre-wrap;">${post.text}</div>
      ${mediaHtml}
      <div class="feed-actions">
        <span class="glass-interactive" onclick="likeFeedPost('${post.id}')">❤️ ${post.likes}</span>
        <span class="glass-interactive" onclick="openUserProfile('${post.customId}')">👤 プロフィール</span>
      </div>
    `;
    stream.appendChild(card);
  });
};

window.likeFeedPost = function(id) {
  const p = feedPosts.find(x => x.id === id);
  if (p) {
    p.likes++;
    localStorage.setItem('cncm_feed_cache', JSON.stringify(feedPosts));
    renderFeed();
  }
};

window.refreshFeedFromStore = function() {
  feedPosts = JSON.parse(localStorage.getItem('cncm_feed_cache') || '[]');
  renderFeed();
};

document.addEventListener('DOMContentLoaded', () => {
  renderFeed();
});
