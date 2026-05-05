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


class ChatbotService:

    def __init__(self):
        print("[ChatbotService] 초기화 중...")

        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY가 설정되지 않았습니다. .env 파일을 확인해주세요.")
        self.client = OpenAI(api_key=api_key)

        self.config = self._load_config()
        self.characters = self._load_characters()
        self.ch1_data = self._load_ch_data("ch1_data.json")
        self.ch3_data = self._load_ch_data("ch3_data.json")
        self.ch3_results = self._load_ch3_results()

        self.sessions = {}

        print("[ChatbotService] 초기화 완료")

    # ------------------------------------------------------------------ config

    def _load_config(self) -> dict:
        config_path = BASE_DIR / "config" / "chatbot_config.json"
        with open(config_path, "r", encoding="utf-8") as f:
            return json.load(f)

    def _load_ch_data(self, filename: str) -> dict:
        path = BASE_DIR / "static" / "data" / "chatbot" / filename
        with open(path, "r", encoding="utf-8") as f:
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
                "chapter": 1,
                "turn": 0,
                "cleared": [],
                "game_over": False,
                "data": {}
            }
        return self.sessions[session_id]

    def _reset_state(self, session_id: str):
        self.sessions.pop(session_id, None)

    # ------------------------------------------------------------------ LLM

    def _build_prompt(self, character_id: str, user_message: str,
                      game_context: dict = None) -> list:
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
        d = self.ch1_data
        CH1_MEATS    = d["meats"]
        CH1_HEATS    = d["heats"]
        CH1_SAUCES   = d["sauces"]
        CH1_TOPPINGS = d["toppings"]
        CH1_SUCCESS  = {**d["success"], "ingredients": set(d["success"]["ingredients"])}
        dlg = d["dialogues"]
        llm = d["llm_prompts"]

        ch1 = state["data"].setdefault("ch1", {
            "step": 0, "meat": None, "heat": None,
            "sauce": None, "ingredients": []
        })
        step = ch1["step"]

        # Step 0: 인트로 — 트리거 문구 대기
        if step == 0:
            if not user_message:
                return {
                    "reply": dlg["intro"],
                    "step": 0, "choices": [], "multi_select": False, "max_select": 1, "image": None,
                }
            if "도와줄게" in user_message or "도와 줄게" in user_message:
                ch1["step"] = 1
                return {
                    "reply": dlg["step1_prompt"],
                    "step": 1, "choices": CH1_MEATS,
                    "multi_select": False, "max_select": 1, "image": None,
                }
            return {
                "reply": dlg["trigger_wait"],
                "step": 0, "choices": [], "multi_select": False, "max_select": 1, "image": None,
            }

        # Step 1: 고기 선택
        if step == 1:
            if user_message not in CH1_MEATS:
                return {"reply": dlg["step1_error"], "step": 1,
                    "choices": CH1_MEATS, "multi_select": False, "max_select": 1, "image": None}
            ch1["meat"] = user_message
            ch1["step"] = 2
            return {
                "reply": dlg["step2_prompt"],
                "step": 2, "choices": CH1_HEATS,
                "multi_select": False, "max_select": 1, "image": None,
            }

        # Step 2: 굽기 선택
        if step == 2:
            if user_message not in CH1_HEATS:
                return {"reply": dlg["step2_error"], "step": 2,
                    "choices": CH1_HEATS, "multi_select": False, "max_select": 1, "image": None}
            ch1["heat"] = user_message
            ch1["step"] = 3
            return {
                "reply": dlg["step3_prompt"],
                "step": 3, "choices": CH1_SAUCES,
                "multi_select": False, "max_select": 1, "image": None,
            }

        # Step 3: 소스 선택
        if step == 3:
            if user_message not in CH1_SAUCES:
                return {"reply": dlg["step3_error"], "step": 3,
                    "choices": CH1_SAUCES, "multi_select": False, "max_select": 1, "image": None}
            ch1["sauce"] = user_message
            ch1["step"] = 4
            return {
                "reply": dlg["step4_prompt"],
                "step": 4, "choices": CH1_TOPPINGS,
                "multi_select": True, "max_select": 3, "image": None,
            }

        # Step 4: 재료 선택 (최대 3개)
        if step == 4:
            selected = [x for x in re.split(r"[,\s]+", user_message.strip()) if x]
            valid = [x for x in selected if x in CH1_TOPPINGS]
            if len(valid) != 3:
                return {"reply": dlg["step4_error"], "step": 4,
                    "choices": CH1_TOPPINGS, "multi_select": True, "max_select": 3, "image": None}
            ch1["ingredients"] = valid
            ch1["step"] = 5
            return {
                "reply": dlg["step5_prompt"],
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
                reply = self._call_llm(self._build_prompt("mama", llm["success"]))
                return {"reply": reply, "step": "clear", "choices": [], "image": None}
            else:
                state["game_over"] = True
                reply = self._call_llm(self._build_prompt("mama", llm["fail"],
                    {"고기": ch1["meat"], "굽기": ch1["heat"],
                     "소스": ch1["sauce"], "재료": ch1["ingredients"]}))
                return {"reply": reply, "step": "fail", "choices": ["다시하기"], "image": None}

    def _ch2_handler(self, state: dict, user_message: str) -> dict:
        # TODO: CH2 연애설득 미니게임 (브라 오드)
        return {"reply": "[CH2] 아직 구현 전이야.", "image": None}

    def _ch3_handler(self, state: dict, user_message: str) -> dict:
        d = self.ch3_data
        CH3_MEDS     = d["meds"]
        CH3_ORDER    = d["order"]
        CH3_SUCCESS  = d["success"]
        CH3_TOTAL    = d["total_ml"]
        MOUSE_SOUNDS = d["mouse_sounds"]
        ANGRY_MSGS   = d["angry_msgs"]
        WRONG_MSGS   = d["wrong_msgs"]
        dlg = d["dialogues"]
        llm = d["llm_prompts"]

        ch3 = state["data"].setdefault("ch3", {
            "step": 0,
            "나이": None, "나이_ml": 0,
            "얼굴": None, "얼굴_ml": 0,
            "몸매": None, "몸매_ml": 0,
            "스타일": None, "스타일_ml": 0,
        })
        step = ch3["step"]
        ML_BY_POS = [10, 20, 30, 40]

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
                "reply": dlg["intro"] + prompt_for("나이", 100),
                "step": 1, "choices": CH3_MEDS["나이"],
                "multi_select": False, "max_select": 1, "image": None,
                "sound": "mouse_origin",
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
                    "sound": "mouse_mad",
                }

            ml = ML_BY_POS[CH3_MEDS[category].index(user_message)]
            ch3[category] = user_message
            ch3[f"{category}_ml"] = ml
            ch3["step"] = step + 1
            remaining = CH3_TOTAL - used_ml()

            if step == 4:  # 스타일까지 완료 → 먹이기
                return {
                    "reply": dlg["complete"].format(total=used_ml()),
                    "step": 5, "choices": ["먹이기"],
                    "multi_select": False, "max_select": 1, "image": None,
                    "sound": None,
                }
            else:
                next_cat = CH3_ORDER[step]
                return {
                    "reply": prompt_for(next_cat, remaining),
                    "step": step + 1, "choices": CH3_MEDS[next_cat],
                    "multi_select": False, "max_select": 1, "image": None,
                    "sound": "mouse_origin",
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
                    "reply": dlg["ml_mismatch"].format(total=total) + prompt_for("나이", 100),
                    "step": 1, "choices": CH3_MEDS["나이"],
                    "multi_select": False, "max_select": 1, "image": None,
                    "sound": "mouse_mad",
                }

            combo_key = "_".join(ch3[cat] for cat in CH3_ORDER)
            result_image = self.ch3_results.get(combo_key, {}).get("image", None)

            correct = all(ch3[cat] == CH3_SUCCESS[cat] for cat in CH3_ORDER)
            if correct:
                state["cleared"].append(3)
                state["chapter"] = 4
                reply = self._call_llm(self._build_prompt("papa", llm["success"]))
                return {"reply": reply, "step": "clear", "choices": [], "image": result_image, "sound": None}
            else:
                state["game_over"] = True
                desc = ", ".join(
                    f"{c}:{ch3[c]}({ch3[f'{c}_ml']}ml)" for c in CH3_ORDER
                )
                reply = self._call_llm(self._build_prompt("papa", llm["fail"],
                    {"변한_모습": desc}))
                return {"reply": reply, "step": "fail", "choices": ["다시하기"], "image": result_image, "sound": None}

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
