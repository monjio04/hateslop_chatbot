import os
import re
import json
import random
from pathlib import Path
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent
CHARACTERS_DIR = BASE_DIR / "config" / "characters"

CH1_MEATS    = ["소고기", "돼지고기", "닭고기"]
CH1_HEATS    = ["약불로 천천히 굽기", "중불로 적당히 굽기", "강불로 빠르게 굽기"]
CH1_SAUCES   = ["케첩", "머스타드", "바베큐소스", "고추장", "간장", "꿀", "와사비", "초코소스", "딸기잼"]
CH1_TOPPINGS = ["양상추", "토마토", "양파", "피클", "할라피뇨", "아보카도", "깻잎", "김치", "파인애플", "젤리"]
CH1_SUCCESS  = {
    "meat": "돼지고기",
    "heat": "중불로 적당히 굽기",
    "sauce": "바베큐소스",
    "ingredients": {"양상추", "피클", "양파"}
}

CH3_MEDS = {
    "나이":   ["아재약", "영포티약", "오지콤약", "동안약"],
    "얼굴":   ["흉악범상약", "큐티상약", "부처님상약", "아랍상약"],
    "몸매":   ["배툭튀약", "멸치약", "모델약", "근육빵빵약"],
    "스타일": ["나시룩약", "산악회룩약", "스트릿룩약", "댄디룩약"],
}
CH3_ORDER   = ["나이", "얼굴", "몸매", "스타일"]
CH3_SUCCESS = {"나이": "오지콤약", "얼굴": "큐티상약", "몸매": "배툭튀약", "스타일": "댄디룩약"}
CH3_TOTAL   = 100


class ChatbotService:

    def __init__(self):
        print("[ChatbotService] 초기화 중...")

        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY가 설정되지 않았습니다. .env 파일을 확인해주세요.")
        self.client = OpenAI(api_key=api_key)

        self.config = self._load_config()
        self.characters = self._load_characters()
        self.ch3_results = self._load_ch3_results()

        # 유저별 게임 상태 저장소 (session_id → state)
        self.sessions = {}

        print("[ChatbotService] 초기화 완료")

    # ------------------------------------------------------------------ config

    def _load_config(self) -> dict:
        config_path = BASE_DIR / "config" / "chatbot_config.json"
        with open(config_path, "r", encoding="utf-8") as f:
            return json.load(f)

    def _load_ch3_results(self) -> dict:
        path = BASE_DIR / "static" / "data" / "chatbot" / "ch3_results.json"
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except FileNotFoundError:
            return {}

    def _load_characters(self) -> dict:
        """config/characters/*.json 을 모두 읽어서 id 키로 반환"""
        characters = {}
        for char_file in CHARACTERS_DIR.glob("*.json"):
            with open(char_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                characters[data["id"]] = data
        return characters

    # ------------------------------------------------------------------ state

    def _get_state(self, session_id: str) -> dict:
        if session_id not in self.sessions:
            self.sessions[session_id] = {
                "chapter": 1,       # 현재 챕터 (1~3)
                "turn": 0,          # 현재 챕터 내 턴 수
                "cleared": [],      # 클리어한 챕터 id 목록
                "game_over": False,
                "data": {}          # 챕터별 임시 데이터 (선택지 누적 등)
            }
        return self.sessions[session_id]

    def _reset_state(self, session_id: str):
        self.sessions.pop(session_id, None)

    # ------------------------------------------------------------------ LLM

    def _build_prompt(self, character_id: str, user_message: str,
                      game_context: dict = None) -> list:
        """
        OpenAI messages 배열 구성.
        나중에 RAG를 추가할 때는 game_context에 검색 결과를 넣으면 됩니다.
        """
        char = self.characters.get(character_id, {})

        system_content = (
            f"당신은 '{char.get('name', '캐릭터')}'입니다.\n"
            f"역할: {char.get('role', '')}\n"
            f"성격: {char.get('personality', '')}\n"
            f"말투: {char.get('speech_style', '')}\n"
            f"배경: {char.get('background', '')}"
        )

        if game_context:
            system_content += (
                "\n\n[현재 게임 상황]\n"
                + json.dumps(game_context, ensure_ascii=False, indent=2)
            )

        return [
            {"role": "system", "content": system_content},
            {"role": "user", "content": user_message},
        ]

    def _call_llm(self, messages: list, temperature: float = 0.8) -> str:
        response = self.client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            temperature=temperature,
            max_tokens=500,
        )
        return response.choices[0].message.content

    # ------------------------------------------------------------------ chapters

    def _ch1_handler(self, state: dict, user_message: str) -> dict:
        ch1 = state["data"].setdefault("ch1", {
            "step": 0, "meat": None, "heat": None,
            "sauce": None, "ingredients": []
        })
        step = ch1["step"]

        # Step 0: 인트로 — 트리거 문구 대기
        if step == 0:
            if not user_message:  # init 직후 첫 호출
                return {
                    "reply": (
                        "내일 너 친구 온다며? 엄마가 맛있는 햄버거 해줄게~\n\n"
                        "준비되었다면 \"엄마 내가 요리 도와줄게\"라고 적어보렴!"
                    ),
                    "step": 0, "choices": [], "multi_select": False, "max_select": 1, "image": None,
                }
            if "도와줄게" in user_message or "도와 줄게" in user_message:
                ch1["step"] = 1
                return {
                    "reply": "그래? 착하구나~ 고기 종류 하나 선택해줄래?",
                    "step": 1, "choices": CH1_MEATS,
                    "multi_select": False, "max_select": 1, "image": None,
                }
            return {
                "reply": "준비되었다면 \"엄마 내가 요리 도와줄게\"라고 적어보렴!",
                "step": 0, "choices": [], "multi_select": False, "max_select": 1, "image": None,
            }

        # Step 1: 고기 선택
        if step == 1:
            if user_message not in CH1_MEATS:
                return {"reply": "고기 목록에서 하나만 골라, 알지?", "step": 1,
                    "choices": CH1_MEATS, "multi_select": False, "max_select": 1, "image": None}
            ch1["meat"] = user_message
            ch1["step"] = 2
            return {
                "reply": "고기는 역시 센불로 구워야 하지 않을까?",
                "step": 2, "choices": CH1_HEATS,
                "multi_select": False, "max_select": 1, "image": None,
            }

        # Step 2: 굽기 선택
        if step == 2:
            if user_message not in CH1_HEATS:
                return {"reply": "제대로 골라!", "step": 2,
                    "choices": CH1_HEATS, "multi_select": False, "max_select": 1, "image": None}
            ch1["heat"] = user_message
            ch1["step"] = 3
            return {
                "reply": "엄마의 비법 소스로 만들어볼까? 이 중에 더 넣고 싶은 거 있니?",
                "step": 3, "choices": CH1_SAUCES,
                "multi_select": False, "max_select": 1, "image": None,
            }

        # Step 3: 소스 선택
        if step == 3:
            if user_message not in CH1_SAUCES:
                return {"reply": "소스 목록에서 골라!", "step": 3,
                    "choices": CH1_SAUCES, "multi_select": False, "max_select": 1, "image": None}
            ch1["sauce"] = user_message
            ch1["step"] = 4
            return {
                "reply": "혹시 친구가 가리는 게 있으면 어쩌니..? 네가 친구 입맛 아니깐 재료 좀 선택해줄래?",
                "step": 4, "choices": CH1_TOPPINGS,
                "multi_select": True, "max_select": 3, "image": None,
            }

        # Step 4: 재료 선택 (최대 3개)
        if step == 4:
            selected = [x for x in re.split(r"[,\s]+", user_message.strip()) if x]
            valid = [x for x in selected if x in CH1_TOPPINGS]
            if len(valid) != 3:
                return {"reply": "재료 3개만 골라, 알지?", "step": 4,
                    "choices": CH1_TOPPINGS, "multi_select": True, "max_select": 3, "image": None}
            ch1["ingredients"] = valid
            ch1["step"] = 5
            return {
                "reply": "그럼 너네 아빠랑 동생 불러서 먹여보자꾸나~",
                "step": 5, "choices": ["시식하기"],
                "multi_select": False, "max_select": 1, "image": None,
            }

        # Step 5: 시식 — 성공/실패 판정
        if step == 5:
            is_success = (
                ch1["meat"] == CH1_SUCCESS["meat"] and
                ch1["heat"] == CH1_SUCCESS["heat"] and
                ch1["sauce"] == CH1_SUCCESS["sauce"] and
                set(ch1["ingredients"]) == CH1_SUCCESS["ingredients"]
            )
            if is_success:
                state["cleared"].append(1)
                state["chapter"] = 2
                reply = self._call_llm(self._build_prompt("mama",
                    "햄버거가 완벽하게 완성됐어. 기쁘지만 절대 내색 안 하는 마마 오드의 짧은 성공 대사를 해줘."))
                return {"reply": reply, "step": "clear", "choices": [], "image": None}
            else:
                state["game_over"] = True
                reply = self._call_llm(self._build_prompt("mama",
                    "이상한 햄버거를 먹은 아빠와 동생이 배탈났어. 마마 오드가 자기 요리는 문제없다며 우기는 짧은 대사를 해줘.",
                    {"고기": ch1["meat"], "굽기": ch1["heat"],
                     "소스": ch1["sauce"], "재료": ch1["ingredients"]}))
                return {"reply": reply, "step": "fail",
                    "choices": ["다시하기"], "image": None}

    def _ch2_handler(self, state: dict, user_message: str) -> dict:
        # TODO: CH2 연애설득 미니게임 (브라 오드)
        return {"reply": "[CH2] 아직 구현 전이야.", "image": None}

    def _ch3_handler(self, state: dict, user_message: str) -> dict:
        ch3 = state["data"].setdefault("ch3", {
            "step": 0,
            "나이": None, "나이_ml": 0,
            "얼굴": None, "얼굴_ml": 0,
            "몸매": None, "몸매_ml": 0,
            "스타일": None, "스타일_ml": 0,
        })
        step = ch3["step"]
        ML_BY_POS = [10, 20, 30, 40]

        MOUSE_SOUNDS = {
            "나이":   "찍찍찍 찍찍.. 찍!",
            "얼굴":   "찍 찍찍찍.. 찍",
            "몸매":   "찍찍찍찍 찍찍찍",
            "스타일": "찍찍! 찍.. 찍찍",
        }
        ANGRY_MSGS = {
            "나이":   "야이!! 나이 약부터 빨리 골라!! 꾸물대지 말고!",
            "얼굴":   "얼굴은 뭐로 할 거야?! 빨리 정하라고!!",
            "몸매":   "신체 약 어서 골라!! 시간 없다고!!",
            "스타일": "스타일까지 골라야 끝난다고!! 빨리빨리!!",
        }
        WRONG_MSGS = {
            "나이": [
                "야이!! 그게 나이 약이야?! 목록 좀 제대로 봐!!",
                "눈 뜨고 다시 봐!! 나이 약 목록에서 골라야지!!",
                "이 답답한 녀석!! 나이 약을 제대로 고르란 말이야!!",
            ],
            "얼굴": [
                "얼굴 약도 제대로 못 고르냐?! 다시 골라!!",
                "목록에 없는 걸 왜 골라!! 얼굴 약 다시!!",
                "시간 없다고!! 얼굴 약 빨리 제대로 된 걸 골라!!",
            ],
            "몸매": [
                "신체 약을 그것도 못 골라?! 다시 봐!!",
                "시간 없다고!! 신체 약 목록에서 제대로 골라!!",
                "이 멍청한 녀석!! 신체 약 다시!!",
            ],
            "스타일": [
                "마지막에서 틀리냐?! 스타일 약 다시 골라!!",
                "거의 다 왔잖아!! 목록에서 제대로 골라!!",
                "빨리!! 스타일 약 제대로 된 걸로 골라!!",
            ],
        }

        def used_ml():
            return sum(ch3[f"{c}_ml"] for c in CH3_ORDER)

        def prompt_for(category, remaining, msg=None):
            sound = MOUSE_SOUNDS[category]
            if msg is None:
                msg = ANGRY_MSGS[category]
            meds = ", ".join(CH3_MEDS[category])
            return (
                f"\"{sound}\"\n"
                f"({msg} — {meds})\n"
                f"남은 ml: {remaining}ml"
            )

        # Step 0: 인트로 → 나이 약 선택
        if step == 0:
            ch3["step"] = 1
            return {
                "reply": (
                    "\"내 발명… 드디어 완성되었… 찍찍…\"\n\n"
                    "그 순간, 아빠는 눈앞에서 새끼 쥐로 변해버렸다.\n\n"
                    "[Quest 3] 아빠를 원래 모습으로 되돌리세요.\n\n"
                    "당신의 주변에는 네 가지 종류의 약병이 놓여 있습니다.\n"
                    "각 병에는 '나이', '얼굴', '신체', '스타일'이라고 적혀 있습니다.\n"
                    "표를 참고해 총 100ml의 해독약을 조합한 뒤, 쥐가 된 아빠에게 먹이세요.\n\n"
                    + prompt_for("나이", 100)
                ),
                "step": 1, "choices": CH3_MEDS["나이"],
                "multi_select": False, "max_select": 1, "image": None,
            }

        # Steps 1~4: 각 카테고리 약 선택 (ml 자동 결정)
        if 1 <= step <= 4:
            cat_idx = step - 1
            category = CH3_ORDER[cat_idx]

            if user_message not in CH3_MEDS[category]:
                wrong_msg = random.choice(WRONG_MSGS[category])
                return {
                    "reply": prompt_for(category, CH3_TOTAL - used_ml(), msg=wrong_msg),
                    "step": step, "choices": CH3_MEDS[category],
                    "multi_select": False, "max_select": 1, "image": None,
                }

            ml = ML_BY_POS[CH3_MEDS[category].index(user_message)]
            ch3[category] = user_message
            ch3[f"{category}_ml"] = ml
            ch3["step"] = step + 1
            remaining = CH3_TOTAL - used_ml()

            if step == 4:  # 스타일까지 완료 → 먹이기
                return {
                    "reply": f"총 {used_ml()}ml 완성!\n아빠(쥐)에게 먹여볼까?",
                    "step": 5, "choices": ["먹이기"],
                    "multi_select": False, "max_select": 1, "image": None,
                }
            else:
                next_cat = CH3_ORDER[step]
                return {
                    "reply": prompt_for(next_cat, remaining),
                    "step": step + 1, "choices": CH3_MEDS[next_cat],
                    "multi_select": False, "max_select": 1, "image": None,
                }

        # Step 5: 먹이기 → 용량 체크 → 성공/실패 판정
        if step == 5:
            total = used_ml()

            if total != CH3_TOTAL:
                # 용량 불일치 → 처음부터 다시
                state["data"]["ch3"] = {
                    "step": 1,
                    "나이": None, "나이_ml": 0,
                    "얼굴": None, "얼굴_ml": 0,
                    "몸매": None, "몸매_ml": 0,
                    "스타일": None, "스타일_ml": 0,
                }
                return {
                    "reply": (
                        f"용량이 맞지 않습니다. (현재 {total}ml) 다시 선택해주세요.\n\n"
                        + prompt_for("나이", 100)
                    ),
                    "step": 1, "choices": CH3_MEDS["나이"],
                    "multi_select": False, "max_select": 1, "image": None,
                }

            combo_key = "_".join(ch3[cat] for cat in CH3_ORDER)
            result_image = self.ch3_results.get(combo_key, {}).get("image", None)

            correct = all(ch3[cat] == CH3_SUCCESS[cat] for cat in CH3_ORDER)
            if correct:
                state["cleared"].append(3)
                state["chapter"] = 4
                reply = self._call_llm(self._build_prompt("papa",
                    "해독약을 마시고 원래 모습으로 돌아온 파파 오드의 짧은 성공 대사를 해줘."))
                return {"reply": reply, "step": "clear", "choices": [], "image": result_image}
            else:
                state["game_over"] = True
                desc = ", ".join(
                    f"{c}:{ch3[c]}({ch3[f'{c}_ml']}ml)" for c in CH3_ORDER
                )
                reply = self._call_llm(self._build_prompt("papa",
                    "해독약 조합이 틀려서 이상하게 변한 파파 오드의 짧고 황당한 실패 대사를 해줘.",
                    {"변한_모습": desc}))
                return {"reply": reply, "step": "fail", "choices": ["다시하기"], "image": result_image}

    # ------------------------------------------------------------------ public

    def generate_response(self, user_message: str, username: str = "사용자") -> dict:
        session_id = username

        if user_message.strip().lower() == "init":
            self._reset_state(session_id)
            state = self._get_state(session_id)
            return self._ch1_handler(state, "")
        if user_message.strip() == "다시하기":
            state = self._get_state(session_id)
            state["data"].pop("ch1", None)
            state["game_over"] = False
            state["chapter"] = 1
            return self._ch1_handler(state, "")

        state = self._get_state(session_id)

        if state["game_over"]:
            return {
                "reply": "게임이 끝났어. 다시 시작하려면 'init'을 입력해.",
                "image": None,
            }

        try:
            chapter = state["chapter"]

            if chapter == 1:
                return self._ch1_handler(state, user_message)
            elif chapter == 2:
                return self._ch2_handler(state, user_message)
            elif chapter == 3:
                return self._ch3_handler(state, user_message)
            else:
                state["game_over"] = True
                return {
                    "reply": "축하해! 괴짜 가족에서 살아남았어!",
                    "image": None,
                }

        except Exception as e:
            print(f"[ERROR] 응답 생성 실패: {e}")
            return {"reply": "오류가 발생했어. 다시 시도해줘.", "image": None}


# --------------------------------------------------------------------------
# 싱글톤

_chatbot_service = None


def get_chatbot_service():
    global _chatbot_service
    if _chatbot_service is None:
        _chatbot_service = ChatbotService()
    return _chatbot_service


# --------------------------------------------------------------------------
# 로컬 테스트

if __name__ == "__main__":
    service = get_chatbot_service()
    username = "테스터"

    print("테스트할 챕터를 선택하세요: 1(엄마) / 3(아빠)")
    ch = input("챕터 번호 > ").strip()

    state = service._get_state(username)
    if ch == "3":
        state["chapter"] = 3
        res = service._ch3_handler(state, "")
        speaker = "아빠"
    else:
        res = service.generate_response("init", username)
        speaker = "엄마"

    print(f"\n[{speaker}] {res['reply']}")
    if res.get("choices"):
        print(f"  선택지: {res['choices']}")

    while True:
        try:
            user_input = input("\n> ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\n종료합니다.")
            break

        res = service.generate_response(user_input, username)
        print(f"\n[캐릭터] {res['reply']}")
        if res.get("choices"):
            print(f"  선택지: {res['choices']}")
        if res.get("step") in ("clear", "fail"):
            break
