const TYPING_SPEED = 50;
const PAUSE_AFTER = 1500;

// 장면 데이터 구성
const scenes = [
    {
        bg: "/static/images/chatbot/opening/friend.png",
        segments: [
            { text: "쉬는 시간, 교실 안은 시끌시끌하다.\n친구들은 삼삼오오 모여 떠들고, 누군가는 엎드려 자고 있다.", size: "18px" },
            { text: "그때—\n네 앞자리에 앉아 있던 제일 친한 친구가\n갑자기 몸을 돌려 말을 건다.", size: "18px" },
            { text: "👤 친구: 야, 내일 뭐해?\n👤 친구: 저번에 너가 너희 집 놀러 오라고 했잖아\n👤 친구: 그거 갑자기 생각났는데…", size: "18px" },
            { text: "👤 친구: 내일 놀러 가도 돼?\n👤 친구: 같이 공부하자!", size: "18px" }
        ]
    },
    {
        bg: "/static/images/chatbot/opening/opening_background3.png",
        segments: [
            { text: "그 순간, 머릿속이 멈칫한다.", size: "18px" },
            { text: "…맞다.\n우리 집.", size: "18px" },
            { text: "겉보기엔 평범하지만—\n한 발만 들어오면 바로 눈치챌 수 있다.", size: "18px" },
            { text: "우리 가족은… 어딘가 하나씩 이상하다.", size: "25px" }
        ]
    },
    // 신규 추가: 캐릭터 소개 장면 (마마 오드)
    {
        bg: "/static/images/chatbot/opening/opening_mama.png",
        type: "intro",
        name: "마마 오드",
        title: "요리 테러리스트",
        titleSize: "25px", statsSize: "18px",
        stats: "요리 중 냄비 태움: 수십 회\n정체불명 요리 탄생: 셀 수 없음\n집을 폭발시킬 뻔한 사건: 17회"
    },
    {
        bg: "/static/images/chatbot/opening/opening_bro.png",
        type: "intro",
        name: "브로 오드",
        title: "사회성 테러리스트",
        titleSize: "23px", statsSize: "17px",
        stats: "고백 망하게 만든 발언: 29회\n분위기 싸하게 만든 횟수: 셀 수 없음\n눈치 없이 폭탄 발언 투척: 일상 수준"
    },
    {
        bg: "/static/images/chatbot/opening/opening_papa.png",
        type: "intro",
        name: "파파 오드",
        title: "발명 테러리스트",
        titleSize: "25px", statsSize: "18px",
        stats: "원인 불명 폭발 사건: 다수\n집 전기 나감: 23회\n정체불명 기계 제작 후 방치: 셀 수 없음"
    },
    {
        bg: "/static/images/chatbot/opening/opening_quest.png",
        bgFit: "fill",
        type: "quest",
        text: "친구가 오기 전,\n가족들을 ‘정상 상태’로 만들어라.\n\n총 3개의 퀘스트를 모두 통과해야\n친구가 이상함을 눈치채지 못한 채 무사히 방문할 수 있다.",
        size: "28px"
    },
    {
        bg: "/static/images/chatbot/opening/charachter_setting.png",
        bgFit: "contain",
        type: "setting"
    }
];

const bgEl = document.querySelector(".bg-img");
const textEl = document.getElementById("typewriter");
const dialogBox = document.getElementById("dialog-box");
const introBox = document.getElementById("intro-box");
const questBox = document.getElementById("quest-box");
const settingBox = document.getElementById("setting-box");
const statsEl = document.getElementById("stats-typewriter");
const questEl = document.getElementById("quest-typewriter");
const finalBtn = document.getElementById("final-next-btn");

let sceneIdx = 0;
let segIdx = 0;
let charIdx = 0;
let statsIdx = 0;
let questIdx = 0;

function applyScene(si) {
    bgEl.src = scenes[si].bg;
    if (scenes[si].bgPosition) {
        bgEl.style.objectPosition = scenes[si].bgPosition;
    } else {
        bgEl.style.objectPosition = "center center";
    }

    if (scenes[si].bgFit) {
        bgEl.style.objectFit = scenes[si].bgFit;
    } else {
        bgEl.style.objectFit = "cover";
    }
}

function type() {
    const scene = scenes[sceneIdx];

    // 1. 캐릭터 소개(intro) 타입일 경우
    if (scene.type === "intro") {
        dialogBox.style.display = "none";
        introBox.style.display = "flex";
        if (questBox) questBox.style.display = "none";

        document.getElementById("char-name").textContent = scene.name;
        document.getElementById("char-title").textContent = scene.title;
        document.getElementById("char-title").style.fontSize = scene.titleSize || "20px";
        statsEl.style.fontSize = scene.statsSize || "20px";

        typeStats(scene.stats);
    }
    // 3. 퀘스트 타입일 경우
    else if (scene.type === "quest") {
        dialogBox.style.display = "none";
        introBox.style.display = "none";
        if (settingBox) settingBox.style.display = "none";
        if (questBox) questBox.style.display = "flex";

        if (scene.size && questEl) {
            questEl.style.fontSize = scene.size;
        }
        typeQuest(scene.text);
    }
    // 4. 세팅 타입일 경우
    else if (scene.type === "setting") {
        dialogBox.style.display = "none";
        introBox.style.display = "none";
        if (questBox) questBox.style.display = "none";
        if (settingBox) settingBox.style.display = "block";
        checkNext();
    }
    // 2. 일반 대사 타입일 경우
    else {
        dialogBox.style.display = "flex";
        introBox.style.display = "none";
        if (questBox) questBox.style.display = "none";
        if (settingBox) settingBox.style.display = "none";

        const seg = scene.segments[segIdx];
        textEl.style.fontSize = seg.size;

        if (charIdx < seg.text.length) {
            textEl.textContent += seg.text[charIdx];
            charIdx++;
            setTimeout(type, TYPING_SPEED);
        } else {
            checkNext();
        }
    }
}

// 전적 부분 전용 타이핑 함수
function typeStats(text) {
    if (statsIdx < text.length) {
        statsEl.textContent += text[statsIdx];
        statsIdx++;
        setTimeout(() => typeStats(text), TYPING_SPEED);
    } else {
        checkNext();
    }
}

// 퀘스트 부분 전용 타이핑 함수
function typeQuest(text) {
    if (questIdx < text.length) {
        questEl.textContent += text[questIdx];
        questIdx++;
        setTimeout(() => typeQuest(text), TYPING_SPEED);
    } else {
        checkNext();
    }
}

function checkNext() {
    // 마지막 씬의 마지막 단계인지 확인
    const isLastScene = sceneIdx >= scenes.length - 1;
    const isIntroType = scenes[sceneIdx].type === "intro";
    const isQuestType = scenes[sceneIdx].type === "quest";
    const isSettingType = scenes[sceneIdx].type === "setting";
    const isLastSeg = !isIntroType && !isQuestType && !isSettingType && (segIdx >= scenes[sceneIdx].segments.length - 1);

    if (isLastScene && (isIntroType || isQuestType || isSettingType || isLastSeg)) {
        // 모든 연출 종료 시 '이야기 시작하기' 버튼 즉시 노출
        if (finalBtn) finalBtn.style.display = "block";
        return;
    }

    // 다음 단계로 넘어가기 위한 대기
    setTimeout(nextStep, PAUSE_AFTER);
}

function nextStep() {
    charIdx = 0;
    statsIdx = 0;
    questIdx = 0;
    textEl.textContent = "";
    statsEl.textContent = "";
    if (questEl) questEl.textContent = "";

    const scene = scenes[sceneIdx];

    // 일반 대사 씬에서 다음 세그먼트로
    if (scene.segments && segIdx < scene.segments.length - 1) {
        segIdx++;
    }
    // 씬 자체를 전환
    else {
        sceneIdx++;
        segIdx = 0;
        applyScene(sceneIdx);
    }

    type();
}

// 다음 화면으로 넘어갈 때 이름 저장 및 전달
if (finalBtn) {
    finalBtn.addEventListener("click", function (e) {
        e.preventDefault(); // 기본 이동 동작 막기

        const nameInput = document.getElementById("user-name-input");
        let userName = nameInput ? nameInput.value.trim() : "";

        // 아무것도 입력하지 않았을 때의 기본값 지정 (필요 시 수정 가능)
        if (!userName) userName = "사용자";

        // 브라우저 로컬 저장소에 저장 (클라이언트용)
        localStorage.setItem("playerName", userName);

        // URL 쿼리 파라미터로 붙여서 chat.html로 이동 (서버 전달용)
        const chatUrl = this.getAttribute("href");
        window.location.href = `${chatUrl}?username=${encodeURIComponent(userName)}`;
    });
}

window.onload = () => {
    applyScene(0);
    type();
};