import os
import json
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

        # 유저별 게임 상태 저장소 (session_id → state)
        self.sessions = {}

        print("[ChatbotService] 초기화 완료")

    # ------------------------------------------------------------------ config

    def _load_config(self) -> dict:
        config_path = BASE_DIR / "config" / "chatbot_config.json"
        with open(config_path, "r", encoding="utf-8") as f:
            return json.load(f)

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
        # TODO: CH1 요리 미니게임 (마마 오드)
        return {"reply": "[CH1] 아직 구현 전이야.", "image": None}

    def _ch2_handler(self, state: dict, user_message: str) -> dict:
        # TODO: CH2 연애설득 미니게임 (브라 오드)
        return {"reply": "[CH2] 아직 구현 전이야.", "image": None}

    def _ch3_handler(self, state: dict, user_message: str) -> dict:
        # TODO: CH3 변신 미니게임 (파파 오드)
        return {"reply": "[CH3] 아직 구현 전이야.", "image": None}

    # ------------------------------------------------------------------ public

    def generate_response(self, user_message: str, username: str = "사용자") -> dict:
        session_id = username

        if user_message.strip().lower() == "init":
            self._reset_state(session_id)
            game_name = self.config.get("name", "게임")
            return {
                "reply": f"어서 와, {game_name}에. 살아남을 수 있을지 두고 봐.",
                "image": None,
            }

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
    print(service.generate_response("init", "테스터"))
    print(service.generate_response("안녕", "테스터"))
