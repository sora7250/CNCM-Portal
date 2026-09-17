/**
 * CNCM Gemini AI Agent Engine - ai-agent.js
 * 役割: 独立プロキシGAS経由のセキュアLLM対話, 制作相談・マルチターン文脈保持
 */

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
  const userText = input ? input.value.trim() : '';
  if (!userText) return;

  const stream = document.getElementById('aiChatStream');

  // 1. ユーザー発言描画
  const userBubble = document.createElement('div');
  userBubble.className = 'chat-bubble mine';
  userBubble.innerText = userText;
  stream.appendChild(userBubble);
  input.value = '';
  stream.scrollTop = stream.scrollHeight;

  // 2. 思考中インジケータ
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
      throw new Error("core.js 内の GAS_GEMINI_PROXY_URL が未設定です。Gemini専用プロキシGASのURLを設定してください。");
    }

    // 3. 独立プロキシGASへ中継リクエスト
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
