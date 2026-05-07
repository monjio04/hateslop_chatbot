console.log("챗봇 JS 로드 완료");

// ── DOM refs ───────────────────────────────────────────────────────────────
const gameContainer = document.querySelector(".game-container");
const username = gameContainer ? gameContainer.dataset.username : "사용자";
const chatLog = document.getElementById("chat-log");
const userMessageInput = document.getElementById("user-message");
const sendBtn        = document.getElementById("send-btn");
const sceneImg       = document.getElementById("scene-img");
const heartsBox      = document.getElementById("hearts-box");
const convincedLabel = document.getElementById("convinced-label");
const questBanner    = document.getElementById("quest-banner");

// ── Chapter config ─────────────────────────────────────────────────────────
const CHAPTER_UI = {
  1: {
    name: "Mama Odd",
    scene: "/static/images/chatbot/chat/rect18.png",
    avatar: "/static/images/chatbot/chat/mama_profile.png",
    bottomLabel: "/static/images/chatbot/chat/Recipe.png",
    showHearts: false,
  },
  2: {
    name: "Bro Odd",
    scene: "/static/images/chatbot/chat/rect18.png",
    avatar: "/static/images/chatbot/chat/bro_profile.png",
    bottomLabel: "/static/images/chatbot/chat/Convinced.png",
    showHearts: true,
  },
  3: {
    name:        "Papa Odd",
    scene:       "",
    avatar:      "/static/images/chatbot/chat/papa_profile.png",
    bottomLabel: "/static/images/chatbot/chat/Poison.png",
  },
};

const PAPA_PIC1_TRIGGER = "내 발명";
const PAPA_PIC2_TRIGGER = "그 순간, 아빠는 눈앞에서 새끼 쥐로 변해버렸다";
const PAPA_QUEST3_IMG = "/static/images/chatbot/chat/papa_quest3.png";
const MOUSE_SOUNDS = ["mouse_origin"];
const PAPA_BAR_VALUES = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

let currentChapter = 0;
let currentBroQ = -1;
let mouseTimerInterval = null;

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

function clearChatForChapterTransition() {
  const imageArea = document.getElementById("ch1-image-area");
  const inputBar = document.querySelector(".input-bar");
  const rightPanel = document.querySelector(".right-panel");

  if (imageArea && rightPanel && inputBar) {
    imageArea.style.display = "none";
    rightPanel.insertBefore(imageArea, inputBar);
  }

  if (chatLog) {
    chatLog.innerHTML = "";
  }
}

function updatePapaBar(usedMl = 0) {
  const papaBarImg = document.getElementById("papa-bar-img");
  if (!papaBarImg) return;

  const numericMl = Number(usedMl);
  const safeMl = Number.isFinite(numericMl) ? numericMl : 0;
  const closestMl = PAPA_BAR_VALUES.reduce((best, current) => (
    Math.abs(current - safeMl) < Math.abs(best - safeMl) ? current : best
  ), 0);

  papaBarImg.src = `/static/images/chatbot/chat/papa_bar_${closestMl}.png`;
}

function showEndingVideo(videoSrc) {
  document.body.innerHTML = "";
  document.body.style.margin = "0";
  document.body.style.background = "#000";
  document.body.style.overflow = "hidden";

  const video = document.createElement("video");
  video.src = videoSrc;
  video.autoplay = true;
  video.controls = true;
  video.playsInline = true;
  video.style.width = "100vw";
  video.style.height = "100vh";
  video.style.objectFit = "contain";
  video.style.display = "block";

  document.body.appendChild(video);
  video.play().catch(() => {});
}

function updateRecipeHighlight(step) {
  const recipeItems = document.querySelectorAll("[data-recipe-step]");
  recipeItems.forEach((item) => {
    item.classList.toggle("active", item.dataset.recipeStep === String(step));
  });
}

// ── Chapter UI update ──────────────────────────────────────────────────────
function applyChapterUI(chapter) {
  if (chapter === currentChapter) return;

  const prevChapter = currentChapter;
  currentChapter = chapter;


  const ui = CHAPTER_UI[chapter];
  if (!ui) return;

  if (sceneImg) {
    sceneImg.src = ui.scene;
  }

  const bottomLabel = document.getElementById("bottom-label");
  if (bottomLabel) {
    if (ui.bottomLabel) {
      bottomLabel.src = ui.bottomLabel;
      bottomLabel.style.display = "block";
    } else {
      bottomLabel.style.display = "none";
    }
  }

  const recipeStepsText = document.getElementById("recipe-steps-text");
  if (recipeStepsText) {
    recipeStepsText.style.display = chapter === 1 ? "block" : "none";
  }
  if (chapter !== 1) {
    updateRecipeHighlight(null);
  }

  const papaBarImg = document.getElementById("papa-bar-img");
  if (papaBarImg) {
    updatePapaBar(0);
    papaBarImg.style.display = chapter === 3 ? "block" : "none";
  }

  // Hearts + Convinced: visible only in CH2
  if (heartsBox) {
    heartsBox.style.display = ui.showHearts ? "flex" : "none";
  }
  if (!ui.showHearts) {
    if (convincedLabel) {
      convincedLabel.style.display = "none";
    }
    updateHearts(0);
  }

  // Quest banner: remove on non-CH2
  if (chapter !== 2 && questBanner) {
    questBanner.classList.remove("visible");
  }

  // CH1 image panel: hide when leaving CH1
  if (chapter !== 1) {
    updateCh1Image(null);
  }

  if (chapter !== 2 && chapter !== 3) {
    currentBroQ = -1;
    updateCh1LeftImage(null);
  }

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

function updatePapaSceneFromText(text) {
  if (!text) return;

  if (text.includes(PAPA_PIC1_TRIGGER)) {
    updateCh1LeftImage("/static/images/chatbot/chat/papa_pic1.png");
  }

  if (text.includes(PAPA_PIC2_TRIGGER)) {
    setTimeout(() => {
      if (currentChapter === 3) {
        updateCh1LeftImage("/static/images/chatbot/chat/papa_pic2.png");
      }
    }, text.includes(PAPA_PIC1_TRIGGER) ? 3000 : 0);
  }
}

function isPapaIntroText(text) {
  return Boolean(text && text.includes(PAPA_PIC1_TRIGGER) && text.includes(PAPA_PIC2_TRIGGER));
}

function isBroIntroText(text) {
  return Boolean(text && text.includes("내일 누나 친구 온다며?") && text.includes("Quest 2"));
}

function formatChoices(text, choices) {
  if (!choices || !Array.isArray(choices) || choices.length === 0) {
    return text;
  }

  return `${text}\n  선택지: ['${choices.join("', '")}']`;
}

function renderPapaIntroSequence(rawText, imagePath, choices = []) {
  const text = (rawText || "").replace(/\r\n/g, "\n").trim();
  const firstMatch = text.match(/"내 발명[\s\S]*?찍찍…"/);
  const firstLine = firstMatch ? firstMatch[0] : "\"내 발명… 드디어 완성되었… 찍찍…\"";
  const secondLine = "그 순간, 아빠는 눈앞에서 새끼 쥐로 변해버렸다.";
  const instructionStart = text.indexOf("당신의 주변에는");
  const promptStart = text.indexOf("\"찍찍찍");
  const instructionText = instructionStart >= 0 && promptStart >= 0
    ? text.slice(instructionStart, promptStart).trim()
    : "";
  const promptText = promptStart >= 0 ? text.slice(promptStart).trim() : "";

  appendMessage("bot", firstLine, imagePath);
  playPapaSqueakSound(firstLine);
  updateCh1LeftImage("/static/images/chatbot/chat/papa_pic1.png");

  setTimeout(() => {
    appendMessage("bot", secondLine);
    updateCh1LeftImage("/static/images/chatbot/chat/papa_pic2.png");
    updateCh1Image(PAPA_QUEST3_IMG);
  }, 3000);

  setTimeout(() => {
    if (instructionText) {
      appendMessage("bot", instructionText);
    }
    updateCh1LeftImage("/static/images/chatbot/chat/papa_chart.png");
  }, 6000);

  setTimeout(() => {
    if (promptText) {
      if (promptText.includes("[SPLIT]")) {
        const parts = promptText.split("[SPLIT]");
        appendMessage("bot", parts[0].trim());
        appendMessage("bot", formatChoices(parts[1].trim(), choices));
      } else {
        appendMessage("bot", formatChoices(promptText, choices));
      }
      playPapaSqueakSound(promptText);
    }
  }, 7500);
}

// ── CH2 intro sequence ─────────────────────────────────────────────────────
function renderBroIntroSequence(rawText, imagePath, score, questionIdx) {
  const text = (rawText || "").replace(/\r\n/g, "\n").trim();
  const parts = text.split("\n\n").filter(p => p.trim());

  // Expected parts: [Intro, Quest Banner Text, First Question]
  const introText = parts[0] || "";
  const questText = parts[1] || "Quest 2 : 동생의 연애력을 키우세요";
  const firstQ    = parts[2] || "";

  appendMessage("bot", introText);

  setTimeout(() => {
    updateCh1Image("/static/images/chatbot/chat/bro_quest2.png");
  }, 2500);

  setTimeout(() => {
    if (firstQ) {
      appendMessage("bot", firstQ);
    }
    if (score !== undefined) updateHearts(score);
    if (questionIdx !== undefined) {
      currentBroQ = questionIdx;
      setBroQuestion(currentBroQ);
    }
  }, 5000);
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
function showConvinced() { }
function hideConvinced() { }

function renderCh2Payload(resp) {
  const text = typeof resp.reply === "string"
    ? resp.reply
    : resp.reply?.reply || "";

  if (isBroIntroText(text)) {
    renderBroIntroSequence(text, resp.image, resp.score, resp.question_idx);
    return;
  }

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
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
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
  audio.play().catch(() => { });
}

function playRandomMouseSound() { }


function playPapaSqueakSound(text) {
  if (text && text.includes("찍찍")) {
    playRandomMouseSound();
  }
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

    const isPapaIntro = data.chapter === 3 && data.step === 1 && isPapaIntroText(replyText);
    const shouldUsePapaSqueakSound = data.chapter === 3 && replyText.includes("찍찍");

    if (shouldUsePapaSqueakSound) {
      if (!isPapaIntro) {
        playPapaSqueakSound(replyText);
      }
    } else if (data.sound) {
      playSound(data.sound);
    }

    if (!isPapaIntro && data.choices && Array.isArray(data.choices) && data.choices.length > 0) {
      replyText = formatChoices(replyText, data.choices);
    }

    const beforeChapter = currentChapter;

    if (data.chapter === 4) {
      if (replyText) appendMessage("bot", replyText, imagePath);
      updateCh1Image("/static/images/chatbot/chat/papa_quest3_success.png");
      setTimeout(() => {
        window.location.href = "/success";
      }, 4500);
      return;
    }

    if (data.chapter === 2 && beforeChapter === 1) {
      const ch1Imgs = getCh1Images(replyText);
      const finalBubbleImg = ch1Imgs.bubbleImg || imagePath;

      appendMessage("bot", replyText, finalBubbleImg);
      updateCh1Image("/static/images/chatbot/chat/mama_quest1_success.png");

      setTimeout(() => {
        clearChatForChapterTransition();
        applyChapterUI(2);

        setTimeout(() => {
          if (data.next_reply !== undefined) {
            const nextResp = {
              reply: data.next_reply,
              image: data.next_image || null,
              question_idx: data.next_question_idx,
              score: data.next_score
            };
            if (isBroIntroText(data.next_reply)) {
              renderBroIntroSequence(data.next_reply, nextResp.image, nextResp.score, nextResp.question_idx);
            } else {
              renderCh2Payload(nextResp);
            }
          } else {
            fetchCh2Intro();
          }
        }, 700);
      }, 4500);

      return;
    }

    if (data.chapter === 3 && beforeChapter === 2 && data.step === "clear") {
      updateHearts(data.score ?? 3);
      appendMessage("bot", replyText, imagePath);
      updateCh1Image("/static/images/chatbot/chat/bro_quest2_success.png");

      setTimeout(() => {
        clearChatForChapterTransition();
        applyChapterUI(3);
        updatePapaBar(data.next_used_ml ?? 0);

        setTimeout(() => {
          const nextReplyText = data.next_reply || "";
          if (isPapaIntroText(nextReplyText)) {
            renderPapaIntroSequence(nextReplyText, data.next_image || null, data.next_choices || []);
          } else {
            if (nextReplyText.includes("찍찍")) {
              playPapaSqueakSound(nextReplyText);
            } else if (data.next_sound) {
              playSound(data.next_sound);
            }

            appendMessage("bot", formatChoices(nextReplyText, data.next_choices), data.next_image || null);
            updatePapaSceneFromText(nextReplyText);
          }
        }, 700);
      }, 4500);

      return;
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
      if (data.chapter === 3 && isPapaIntro) {
        renderPapaIntroSequence(replyText, imagePath, data.choices || []);
      } else if (data.chapter === 3 && replyText.includes("[SPLIT]")) {
        const parts = replyText.split("[SPLIT]");
        appendMessage("bot", parts[0].trim(), imagePath);
        appendMessage("bot", parts[1].trim());
      } else {
        appendMessage("bot", replyText, imagePath);
      }

      if (data.chapter === 3 && !isPapaIntro) {
        updatePapaSceneFromText(replyText);
      }
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

    // ── Hearts
    if (data.score !== undefined) {
      updateHearts(data.score);
    }

    if (data.chapter === 3 && data.used_ml !== undefined) {
      updatePapaBar(data.used_ml);
    }

    if (data.chapter === 1 && data.step !== undefined) {
      updateRecipeHighlight(data.step);
    }

    if (currentChapter === 2) {
      if (data.question_idx !== undefined && data.question_idx !== currentBroQ) {
        currentBroQ = data.question_idx;
        setBroQuestion(currentBroQ);
      } else if (!isInitial) {
        showBroRandom();
      }
    }
    if (data.convinced) {
      showConvinced();
    } else if (!isInitial) {
      hideConvinced();
    }

    // ── Fail redirect
    if (data.step === "fail") {
      localStorage.setItem("restartChapter", currentChapter);
      localStorage.setItem("restartUsername", username);
      setTimeout(() => {
        window.location.href = `/fail?id=${data.fail_id || 'DEFAULT'}&username=${encodeURIComponent(username)}`;
      }, 2000);
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
  const params = new URLSearchParams(window.location.search);
  const restartChapter = params.get("restart");

  const storedChapter = localStorage.getItem("restartChapter");
  localStorage.removeItem("restartChapter");
  localStorage.removeItem("restartUsername");

  if (storedChapter) {
    setTimeout(() => {
      sendMessageRaw(`restart_${storedChapter}`);
    }, 500);
  } else {
    applyChapterUI(1);
    setTimeout(() => {
      if (chatLog && chatLog.childElementCount === 0) {
        sendMessage(true);
      }
    }, 500);
  }
});

async function sendMessageRaw(message) {
  const loadingId = appendMessage("bot", "생각 중...");
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, username }),
    });
    const data = await res.json();
    removeMessage(loadingId);

    const chapter = data.chapter;
    if (chapter !== undefined) applyChapterUI(chapter);

    const text = typeof data.reply === "string" ? data.reply : (data.reply?.reply || "");
    const img  = data.image || null;

    if (chapter === 3) {
      if (isPapaIntroText(text)) {
        renderPapaIntroSequence(text, img, data.choices || []);
      } else {
        appendMessage("bot", formatChoices(text, data.choices || []), img);
        updatePapaSceneFromText(text);
        if (text.includes("찍찍")) playPapaSqueakSound(text);
      }
    } else if (chapter === 2) {
      if (isBroIntroText(text)) {
        renderBroIntroSequence(text, img, data.score, data.question_idx);
      } else {
        renderCh2Payload(data);
      }
    } else {
      appendMessage("bot", text, img);
      if (data.choices && data.choices.length > 0 && data.step !== "clear") {
        appendMessage("bot", `선택지: [${data.choices.join(", ")}]`);
      }
    }
    if (data.used_ml !== undefined) updatePapaBar(data.used_ml);
  } catch (err) {
    removeMessage(loadingId);
  }
}
