console.log("챗봇 JS 로드 완료");

// ── DOM refs ───────────────────────────────────────────────────────────────
const gameContainer = document.querySelector(".game-container");
const username = gameContainer ? gameContainer.dataset.username : "사용자";
const chatLog = document.getElementById("chat-log");
const userMessageInput = document.getElementById("user-message");
const sendBtn = document.getElementById("send-btn");
const sceneImg = document.getElementById("scene-img");
const heartsBox = document.getElementById("hearts-box");
const convincedLabel = document.getElementById("convinced-label");
const questBanner = document.getElementById("quest-banner");

// ── Chapter config ─────────────────────────────────────────────────────────
const CHAPTER_UI = {
  1: {
    name: "Mama Odd",
    scene: "/static/images/chatbot/chat/rect18.png",
    avatar: "/static/images/chatbot/chat/mama_profile.png",
    showHearts: false,
  },
  2: {
    name: "Bro Odd",
    scene: "/static/images/chatbot/chat/bro_question1.png",
    avatar: "/static/images/chatbot/chat/bro_profile.png",
    showHearts: true,
  },
  3: {
    name: "Papa Odd",
    scene: "",
    avatar: "/static/images/chatbot/chat/papa_profile.png",
    showHearts: false,
  },
};

let currentChapter = 0;

// ── Chapter UI update ──────────────────────────────────────────────────────
function applyChapterUI(chapter) {
  if (chapter === currentChapter) return;
  currentChapter = chapter;

  const ui = CHAPTER_UI[chapter];
  if (!ui) return;

  sceneImg.src = ui.scene;



  // Hearts + Convinced: visible only in CH2
  heartsBox.style.display = ui.showHearts ? "flex" : "none";
  if (!ui.showHearts) {
    convincedLabel.style.display = "none";
    updateHearts(0);
  }

  if (!ui.showHearts) {
    questBanner.classList.remove("visible");
  }

  if (chapter !== 1) {
    updateCh1Image(null);
  }
}

// ── CH1 fixed image panel ──────────────────────────────────────────────────
function updateCh1Image(imagePath) {
  const area = document.getElementById("ch1-image-area");
  const img = document.getElementById("ch1-img");
  if (!area || !img) return;
  if (imagePath) {
    img.src = imagePath;
    area.style.display = "block";
    const cl = document.getElementById("chat-log");
    if (cl) {
      cl.appendChild(area);
      cl.scrollTop = cl.scrollHeight;
    }
  } else {
    area.style.display = "none";
  }
}

// ── CH1 image auto-detect ─────────────────────────────────────────────────
const CH1_STATE_MAP = [
  { keywords: ["준비되었다면", "요리 도와줄게"], leftImg: "mama_start", questImg: "mama_quest1", bubbleImg: null },
  { keywords: ["고기 종류", "착하구나"], leftImg: "mama_meat_left", questImg: null, bubbleImg: "mama_meat" },
  { keywords: ["센불로"], leftImg: "mama_fire_left", questImg: null, bubbleImg: "mama_fire" },
  { keywords: ["비법 소스"], leftImg: "mama_sauce_left", questImg: null, bubbleImg: "mama_sauce" },
  { keywords: ["가리는 게 있으면", "재료 좀 선택"], leftImg: "mama_vegetable_left", questImg: null, bubbleImg: "mama_vegetable" },
  { keywords: ["아빠랑 동생 불러서", "먹여보자꾸나"], leftImg: "mama_last", questImg: null, bubbleImg: null },
];

function getCh1Images(text) {
  for (const entry of CH1_STATE_MAP) {
    if (entry.keywords.some(k => text.includes(k))) {
      return {
        leftImg: entry.leftImg ? `/static/images/chatbot/chat/${entry.leftImg}.png` : null,
        questImg: entry.questImg ? `/static/images/chatbot/chat/${entry.questImg}.png` : null,
        bubbleImg: entry.bubbleImg ? `/static/images/chatbot/chat/${entry.bubbleImg}.png` : null
      };
    }
  }
  return { leftImg: null, questImg: null, bubbleImg: null };
}

function updateCh1LeftImage(imagePath) {
  const img = document.getElementById("ch1-left-character-img");
  if (!img) return;
  if (imagePath) {
    img.src = imagePath;
    img.style.display = "block";
  } else {
    img.style.display = "none";
  }
}

// ── Heart display ──────────────────────────────────────────────────────────
const HEART_IMGS = {
  0: "/static/images/chatbot/chat/heart_start.png",
  1: "/static/images/chatbot/chat/heart_question1.png",
  2: "/static/images/chatbot/chat/heart_question2.png",
  3: "/static/images/chatbot/chat/heart_question3.png",
};

const BRO_SCENE_IMGS = {
  0: "/static/images/chatbot/chat/bro_question1.png",
  1: "/static/images/chatbot/chat/bro_question2.png",
  2: "/static/images/chatbot/chat/bro_question3.png",
  3: "/static/images/chatbot/chat/bro_question3.png",
};

function updateHearts(score) {
  const heartsImg = document.getElementById("hearts-img");
  if (heartsImg) {
    heartsImg.src = HEART_IMGS[score] ?? HEART_IMGS[0];
  }
  if (currentChapter === 2 && sceneImg) {
    sceneImg.src = BRO_SCENE_IMGS[score] ?? BRO_SCENE_IMGS[0];
  }
}

// ── Convinced label ────────────────────────────────────────────────────────
function showConvinced() {
  convincedLabel.style.display = "block";
}

function hideConvinced() {
  convincedLabel.style.display = "none";
}

// ── Sound ──────────────────────────────────────────────────────────────────
function playSound(name) {
  const audio = new Audio(`/static/sound/${name}.mp3`);
  audio.play().catch(() => { });
}

// ── Send message ───────────────────────────────────────────────────────────
async function sendMessage(isInitial = false) {
  let message;
  if (isInitial) {
    message = "init";
  } else {
    message = userMessageInput.value.trim();
    if (!message) return;
    appendMessage("user", message);
    userMessageInput.value = "";
  }

  const loadingId = appendMessage("bot", "생각 중...");

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, username }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    removeMessage(loadingId);

    // 사운드 재생
    if (data.sound) {
      playSound(data.sound);
    }

    // Parse reply / image
    let replyText, imagePath;
    if (typeof data.reply === "object" && data.reply !== null) {
      replyText = data.reply.reply || String(data.reply);
      imagePath = data.reply.image || null;
    } else {
      replyText = data.reply;
      imagePath = data.image || null;
    }

    if (data.choices && Array.isArray(data.choices) && data.choices.length > 0) {
      replyText += `\n  선택지: ['${data.choices.join("', '")}']`;
    }

    if (currentChapter === 1) {
      const ch1Imgs = getCh1Images(replyText);
      const finalBubbleImg = ch1Imgs.bubbleImg || imagePath;

      appendMessage("bot", replyText, finalBubbleImg);

      const questImgSrc = ch1Imgs.questImg || (replyText.includes("준비되었다면") ? "/static/images/chatbot/chat/mama_quest1.png" : null);
      if (questImgSrc) {
        updateCh1Image(questImgSrc);
      }

      if (ch1Imgs.leftImg) {
        updateCh1LeftImage(ch1Imgs.leftImg);
      }
    } else {
      appendMessage("bot", replyText, imagePath);
    }

    // ── Chapter switch
    if (data.chapter !== undefined) {
      applyChapterUI(data.chapter);
    }

    // ── Quest banner (CH2 intro response includes quest field)
    if (data.quest) {
      questBanner.textContent = data.quest;
      questBanner.classList.add("visible");
      chatLog.appendChild(questBanner);
      chatLog.scrollTop = chatLog.scrollHeight;
    }

    // ── Hearts & Convinced (CH2)
    if (data.score !== undefined) {
      updateHearts(data.score);
    }
    if (data.convinced) {
      showConvinced();
    } else if (!isInitial) {
      hideConvinced();
    }

  } catch (err) {
    console.error("메시지 전송 에러:", err);
    removeMessage(loadingId);
    appendMessage("bot", "죄송합니다. 오류가 발생했습니다. 다시 시도해주세요.");
  }
}

// ── Append message ─────────────────────────────────────────────────────────
let messageIdCounter = 0;

function appendMessage(sender, text, imageSrc = null) {
  const id = `msg-${messageIdCounter++}`;

  if (sender === "user") {
    const el = document.createElement("div");
    el.classList.add("message", "user");
    el.id = id;
    el.textContent = text;
    if (chatLog) {
      chatLog.appendChild(el);
      chatLog.scrollTop = chatLog.scrollHeight;
    }
    return id;
  }

  // Bot message: avatar + name on left, bubble on right
  const ui = CHAPTER_UI[currentChapter] || {};

  const group = document.createElement("div");
  group.classList.add("bot-msg-group");
  group.id = id;

  const avatar = document.createElement("img");
  avatar.classList.add("bot-msg-avatar");
  avatar.src = ui.avatar || "";
  avatar.alt = "bot";
  avatar.onerror = () => { avatar.style.visibility = "hidden"; };
  group.appendChild(avatar);

  const content = document.createElement("div");
  content.classList.add("bot-msg-content");

  const nameEl = document.createElement("span");
  nameEl.classList.add("bot-msg-name");
  nameEl.textContent = ui.name || "";
  content.appendChild(nameEl);

  const bubble = document.createElement("div");
  bubble.classList.add("message", "bot");

  if (imageSrc) {
    const img = document.createElement("img");
    img.classList.add("bot-big-img");
    img.src = imageSrc;
    img.alt = "챗봇 이미지";
    bubble.appendChild(img);
  }

  const textDiv = document.createElement("div");
  textDiv.textContent = text;
  bubble.appendChild(textDiv);

  content.appendChild(bubble);
  group.appendChild(content);

  if (chatLog) {
    chatLog.appendChild(group);
    chatLog.scrollTop = chatLog.scrollHeight;
  }
  return id;
}

// ── Remove message ─────────────────────────────────────────────────────────
function removeMessage(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

// ── Event listeners ────────────────────────────────────────────────────────
if (userMessageInput) {
  userMessageInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendMessage();
  });
}
if (sendBtn) {
  sendBtn.addEventListener("click", () => sendMessage());
}

// ── Init ───────────────────────────────────────────────────────────────────
window.addEventListener("load", () => {
  applyChapterUI(1);

  setTimeout(() => {
    if (chatLog && chatLog.childElementCount === 0) {
      sendMessage(true);
    }
  }, 500);
});
