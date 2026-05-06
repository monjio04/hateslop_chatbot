console.log("챗봇 JS 로드 완료");

// ── DOM refs ───────────────────────────────────────────────────────────────
const gameContainer  = document.querySelector(".game-container");
const username       = gameContainer ? gameContainer.dataset.username : "사용자";
const chatLog        = document.getElementById("chat-log");
const userMessageInput = document.getElementById("user-message");
const sendBtn        = document.getElementById("send-btn");
const sceneImg       = document.getElementById("scene-img");
const heartsBox      = document.getElementById("hearts-box");
const questBanner    = document.getElementById("quest-banner");

// ── Chapter config ─────────────────────────────────────────────────────────
const CHAPTER_UI = {
  1: {
    name:        "Mama Odd",
    scene:       "/static/images/chatbot/chat/rect18.png",
    avatar:      "/static/images/chatbot/chat/mama_profile.png",
    bottomLabel: "/static/images/chatbot/chat/Recipe.png",
  },
  2: {
    name:        "Bro Odd",
    scene:       "/static/images/chatbot/chat/rect18.png",
    avatar:      "/static/images/chatbot/chat/bro_profile.png",
    bottomLabel: "/static/images/chatbot/chat/Convinced.png",
  },
  3: {
    name:        "Papa Odd",
    scene:       "",
    avatar:      "/static/images/chatbot/chat/papa_profile.png",
    bottomLabel: null,
  },
};

let currentChapter = 0;

// ── Bro images ─────────────────────────────────────────────────────────────
let currentBroQ = -1;
const BRO_RANDOM_IMGS = [1, 2, 3, 4, 5].map(
  n => `/static/images/chatbot/chat/bro_random${n}.png`
);
const BRO_QUESTION_IMGS = [1, 2, 3].map(
  n => `/static/images/chatbot/chat/bro_question${n}.png`
);

function setBroQuestion(qIdx) {
  const safeIdx = Math.min(qIdx, BRO_QUESTION_IMGS.length - 1);
  updateCh1LeftImage(BRO_QUESTION_IMGS[safeIdx]);
}

function showBroRandom() {
  updateCh1LeftImage(
    BRO_RANDOM_IMGS[Math.floor(Math.random() * BRO_RANDOM_IMGS.length)]
  );
}

// ── Chapter UI update ──────────────────────────────────────────────────────
function applyChapterUI(chapter) {
  if (chapter === currentChapter) return;

  currentChapter = chapter;

  const ui = CHAPTER_UI[chapter];
  if (!ui) return;

  // Scene image
  if (sceneImg) {
    sceneImg.src = ui.scene;
  }

  // Bottom label
  const bottomLabel = document.getElementById("bottom-label");
  if (bottomLabel) {
    if (ui.bottomLabel) {
      bottomLabel.src = ui.bottomLabel;
      bottomLabel.style.display = "block";
    } else {
      bottomLabel.style.display = "none";
    }
  }

  // Recipe steps text: CH1 only
  const stepsEl = document.getElementById("recipe-steps-text");
  if (stepsEl) {
    stepsEl.style.display = chapter === 1 ? "block" : "none";
  }

  // Hearts: CH2 only
  if (heartsBox) {
    heartsBox.style.display = chapter === 2 ? "block" : "none";

    if (chapter === 2) {
      updateHearts(0);
    }
  }

  // Quest banner: remove on non-CH2
  if (chapter !== 2 && questBanner) {
    questBanner.classList.remove("visible");
  }

  // CH1 image panel: hide when leaving CH1
  if (chapter !== 1) {
    updateCh1Image(null);
  }

  // Bro: reset when leaving CH2
  if (chapter !== 2) {
    currentBroQ = -1;
    updateCh1LeftImage(null);
  }

  // CH2: start bro question 0
  if (chapter === 2) {
    setBroQuestion(0);
  }
}

// ── CH1 fixed image panel ──────────────────────────────────────────────────
function updateCh1Image(imagePath) {
  const area = document.getElementById("ch1-image-area");
  const img  = document.getElementById("ch1-img");

  if (!area || !img) return;

  if (imagePath) {
    img.src = imagePath;
    img.onload = () => {
      if (chatLog) chatLog.scrollTop = chatLog.scrollHeight;
    };

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
  {
    keywords: ["준비되었다면", "요리 도와줄게"],
    leftImg: "mama_start",
    questImg: "mama_quest1",
    bubbleImg: null
  },
  {
    keywords: ["고기 종류", "착하구나"],
    leftImg: "mama_meat_left",
    questImg: null,
    bubbleImg: "mama_meat"
  },
  {
    keywords: ["센불로"],
    leftImg: "mama_fire_left",
    questImg: null,
    bubbleImg: "mama_fire"
  },
  {
    keywords: ["비법 소스"],
    leftImg: "mama_sauce_left",
    questImg: null,
    bubbleImg: "mama_sauce"
  },
  {
    keywords: ["가리는 게 있으면", "재료 좀 선택"],
    leftImg: "mama_vegetable_left",
    questImg: null,
    bubbleImg: "mama_vegetable"
  },
  {
    keywords: ["아빠랑 동생 불러서", "먹여보자꾸나"],
    leftImg: "mama_last",
    questImg: null,
    bubbleImg: null
  },
];

function getCh1Images(text) {
  for (const entry of CH1_STATE_MAP) {
    if (entry.keywords.some(k => text.includes(k))) {
      return {
        leftImg: entry.leftImg
          ? `/static/images/chatbot/chat/${entry.leftImg}.png`
          : null,
        questImg: entry.questImg
          ? `/static/images/chatbot/chat/${entry.questImg}.png`
          : null,
        bubbleImg: entry.bubbleImg
          ? `/static/images/chatbot/chat/${entry.bubbleImg}.png`
          : null
      };
    }
  }

  return {
    leftImg: null,
    questImg: null,
    bubbleImg: null
  };
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

function updateHearts(score) {
  const heartsImg = document.getElementById("hearts-img");

  if (heartsImg) {
    heartsImg.src = HEART_IMGS[score] ?? HEART_IMGS[0];
  }
}

// ── Convinced label ────────────────────────────────────────────────────────
function showConvinced() {}
function hideConvinced() {}

function renderCh2Payload(resp) {
  const text = typeof resp.reply === "string"
    ? resp.reply
    : resp.reply?.reply || "";

  appendMessage("bot", text, resp.image || null);

  if (resp.quest && questBanner) {
    questBanner.textContent = resp.quest;
    questBanner.classList.add("visible");
  }

  if (resp.score !== undefined) {
    updateHearts(resp.score);
  }

  if (resp.question_idx !== undefined) {
    currentBroQ = resp.question_idx;
    setBroQuestion(currentBroQ);
  } else {
    currentBroQ = 0;
    setBroQuestion(0);
  }
}

// ── CH2 intro auto-fetch ───────────────────────────────────────────────────
async function fetchCh2Intro() {
  const loadingId = appendMessage("bot", "생각 중...");

  try {
    const res = await fetch("/api/chat", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        message: " ",
        username
      }),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const resp = await res.json();
    console.log("[CH2 INTRO DATA]", resp);

    removeMessage(loadingId);

    renderCh2Payload(resp);

  } catch (err) {
    console.error("CH2 intro fetch error:", err);
    removeMessage(loadingId);
    appendMessage("bot", "남동생 대화를 불러오는 중 오류가 발생했어.");
  }
}

// ── Sound ──────────────────────────────────────────────────────────────────
function playSound(name) {
  const audio = new Audio(`/static/sound/${name}.mp3`);
  audio.play().catch(() => {});
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
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        message,
        username
      }),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    console.log("[CHAT API DATA]", data);

    removeMessage(loadingId);

    if (data.sound) {
      playSound(data.sound);
    }

    // Parse reply / image
    let replyText = "";
    let imagePath = null;

    if (typeof data.reply === "object" && data.reply !== null) {
      replyText = data.reply.reply || String(data.reply);
      imagePath = data.reply.image || data.image || null;
    } else {
      replyText = data.reply || "";
      imagePath = data.image || null;
    }

    if (data.choices && Array.isArray(data.choices) && data.choices.length > 0) {
      replyText += `\n  선택지: ['${data.choices.join("', '")}']`;
    }

    // ── Chapter switch를 메시지 출력 전에 먼저 판단
    const beforeChapter = currentChapter;

    if (data.chapter !== undefined) {
      // CH1 성공 후 CH2로 넘어가는 순간
      if (data.chapter === 2 && beforeChapter === 1) {
        // 엄마 성공 멘트는 먼저 CH1 스타일로 보여준다.
        const ch1Imgs = getCh1Images(replyText);
        const finalBubbleImg = ch1Imgs.bubbleImg || imagePath;

        appendMessage("bot", replyText, finalBubbleImg);
        updateCh1Image("/static/images/chatbot/chat/mama_quest1_success.png");

        // 잠깐 성공 이미지 보여준 뒤, CH2 화면으로 전환하고 남동생 intro를 가져온다.
        setTimeout(() => {
          if (chatLog) {
            chatLog.innerHTML = "";
          }

          applyChapterUI(2);

          setTimeout(() => {
            if (data.next_reply !== undefined) {
              renderCh2Payload({
                reply: data.next_reply,
                image: data.next_image || null,
                question_idx: data.next_question_idx,
                score: data.next_score
              });
            } else {
              fetchCh2Intro();
            }
          }, 700);

        }, 4500);

        return;
      }

      applyChapterUI(data.chapter);
    }

    // ── 일반 메시지 출력
    if (currentChapter === 1) {
      const ch1Imgs = getCh1Images(replyText);
      const finalBubbleImg = ch1Imgs.bubbleImg || imagePath;

      appendMessage("bot", replyText, finalBubbleImg);

      const questImgSrc = ch1Imgs.questImg || (
        replyText.includes("준비되었다면")
          ? "/static/images/chatbot/chat/mama_quest1.png"
          : null
      );

      if (questImgSrc) {
        updateCh1Image(questImgSrc);
      }

      if (ch1Imgs.leftImg) {
        updateCh1LeftImage(ch1Imgs.leftImg);
      }

    } else {
      // 핵심: CH2 포함 나머지 챕터는 서버가 준 replyText 그대로 출력
      appendMessage("bot", replyText, imagePath);
    }

    // ── Quest banner
    if (data.quest && questBanner) {
      questBanner.textContent = data.quest;
      questBanner.classList.add("visible");
      chatLog.appendChild(questBanner);
      chatLog.scrollTop = chatLog.scrollHeight;
    }

    // ── Hearts
    if (data.score !== undefined) {
      updateHearts(data.score);
    }

    // ── Bro image update
    if (currentChapter === 2) {
      if (data.question_idx !== undefined && data.question_idx !== currentBroQ) {
        currentBroQ = data.question_idx;
        setBroQuestion(currentBroQ);
      } else {
        showBroRandom();
      }
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
  avatar.onerror = () => {
    avatar.style.visibility = "hidden";
  };
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
    img.onload = () => {
      if (chatLog) chatLog.scrollTop = chatLog.scrollHeight;
    };
    bubble.appendChild(img);
  }

  const textDiv = document.createElement("div");
  textDiv.textContent = text || "";
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

  if (el) {
    el.remove();
  }
}

// ── Event listeners ────────────────────────────────────────────────────────
if (userMessageInput) {
  userMessageInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      sendMessage();
    }
  });
}

if (sendBtn) {
  sendBtn.addEventListener("click", () => {
    sendMessage();
  });
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
