"""KinTrain AgentCore Runtime HTTP server.

Runtime contract:
- GET /ping
- POST /invocations (SSE stream response)
"""

from __future__ import annotations

import base64
import json
import os
import sys
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlparse


MODEL_ID = os.getenv("MODEL_ID", "anthropic.claude-opus-4-6-v1")
MEMORY_ID = os.getenv("MEMORY_ID", "").strip()
AWS_REGION = os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION") or "ap-northeast-1"
APP_TIMEZONE_DEFAULT = os.getenv("APP_TIMEZONE_DEFAULT", "Asia/Tokyo")
SYSTEM_PROMPT_FILE_PATH = os.getenv("SYSTEM_PROMPT_FILE_PATH", "config/prompts/system-prompt.ja.txt")
PERSONA_FILE_PATH = os.getenv("PERSONA_FILE_PATH", "config/prompts/PERSONA.md")
SOUL_FILE_PATH = os.getenv("SOUL_FILE_PATH", "config/prompts/SOUL.md")
RUNTIME_HOST = os.getenv("RUNTIME_HOST", "0.0.0.0")
RUNTIME_PORT = int(os.getenv("RUNTIME_PORT", "8080"))
STREAM_CHUNK_CHAR_SIZE = int(os.getenv("STREAM_CHUNK_CHAR_SIZE", "24"))
VENDOR_DIR = (Path(__file__).resolve().parent / "vendor").resolve()

if VENDOR_DIR.exists():
    sys.path.insert(0, str(VENDOR_DIR))

def _read_prompt(path_str: str) -> str:
    path = Path(path_str)
    if not path.is_absolute():
        path = (Path(__file__).resolve().parent / path).resolve()
    if not path.exists():
        raise FileNotFoundError(f"Prompt file not found: {path}")
    return path.read_text(encoding="utf-8").strip()


def _load_system_prompt() -> str:
    soul = _read_prompt(SOUL_FILE_PATH)
    persona = _read_prompt(PERSONA_FILE_PATH)
    system_prompt = _read_prompt(SYSTEM_PROMPT_FILE_PATH)
    return "\n\n".join([soul, persona, system_prompt]).strip()


SYSTEM_PROMPT = _load_system_prompt()


def _get_strands_dependencies() -> tuple[Any, Any, Any, Any]:
    try:
        from bedrock_agentcore.memory.integrations.strands.config import AgentCoreMemoryConfig  # type: ignore
        from bedrock_agentcore.memory.integrations.strands.session_manager import (  # type: ignore
            AgentCoreMemorySessionManager,
        )
        from strands import Agent  # type: ignore
        from strands.models import BedrockModel  # type: ignore

        return Agent, BedrockModel, AgentCoreMemoryConfig, AgentCoreMemorySessionManager
    except Exception as exc:
        raise RuntimeError(
            "Required Strands/AgentCore packages are not available. "
            "Install `strands-agents` and `bedrock-agentcore` in runtime package."
        ) from exc


def _extract_bearer_token(authorization_header: str | None) -> str | None:
    if not authorization_header:
        return None
    value = authorization_header.strip()
    if not value.lower().startswith("bearer "):
        return None
    token = value[7:].strip()
    if not token:
        return None
    return token


def _decode_jwt_payload_without_verification(token: str) -> dict[str, Any]:
    try:
        parts = token.split(".")
        if len(parts) < 2:
            return {}
        payload_part = parts[1]
        payload_part += "=" * ((4 - len(payload_part) % 4) % 4)
        payload_raw = base64.urlsafe_b64decode(payload_part.encode("utf-8"))
        payload = json.loads(payload_raw.decode("utf-8"))
        if isinstance(payload, dict):
            return payload
        return {}
    except Exception:
        return {}


def _resolve_actor_id(session_id: str, authorization_header: str | None) -> str:
    token = _extract_bearer_token(authorization_header)
    if token:
        claims = _decode_jwt_payload_without_verification(token)
        sub = claims.get("sub")
        if isinstance(sub, str) and sub.strip():
            return sub.strip()
    # Runtime authorizer should usually guarantee authenticated calls.
    # Fallback is namespaced by session to avoid cross-session contamination.
    return f"anonymous:{session_id}"


def _response_to_text(response: Any) -> str:
    if isinstance(response, str):
        return response
    if isinstance(response, dict):
        for key in ("text", "content", "output_text", "message"):
            value = response.get(key)
            if isinstance(value, str) and value.strip():
                return value
    for attr in ("text", "content", "output_text", "message"):
        value = getattr(response, attr, None)
        if isinstance(value, str) and value.strip():
            return value
    text = str(response)
    return text if isinstance(text, str) else ""


def _chunk_text(text: str, chunk_size: int) -> list[str]:
    if not text:
        return []
    size = max(1, chunk_size)
    return [text[index : index + size] for index in range(0, len(text), size)]


def _run_agent_turn(session_id: str, actor_id: str, user_text: str) -> str:
    if not MEMORY_ID:
        raise RuntimeError("MEMORY_ID is not configured in runtime environment variables.")

    Agent, BedrockModel, AgentCoreMemoryConfig, AgentCoreMemorySessionManager = _get_strands_dependencies()
    model = BedrockModel(model_id=MODEL_ID)

    memory_config = AgentCoreMemoryConfig(
        memory_id=MEMORY_ID,
        actor_id=actor_id,
        session_id=session_id,
    )

    with AgentCoreMemorySessionManager(
        agentcore_memory_config=memory_config,
        region_name=AWS_REGION,
    ) as session_manager:
        agent = Agent(
            model=model,
            system_prompt=SYSTEM_PROMPT,
            session_manager=session_manager,
        )
        response = agent(user_text)
        return _response_to_text(response)


def _sse(event_name: str, payload: dict[str, Any]) -> bytes:
    event_line = f"event: {event_name}\n"
    data_line = f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"
    return (event_line + data_line).encode("utf-8")


class RuntimeHandler(BaseHTTPRequestHandler):
    server_version = "KinTrainRuntime/1.0"
    protocol_version = "HTTP/1.1"

    def _json_response(self, status_code: int, payload: dict[str, Any]) -> None:
        content = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(content)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type,Authorization")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.end_headers()
        self.wfile.write(content)
        self.wfile.flush()

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type,Authorization")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path != "/ping":
            self._json_response(404, {"message": "Not Found"})
            return

        self._json_response(
            200,
            {
                "ok": True,
                "modelId": MODEL_ID,
                "timezoneDefault": APP_TIMEZONE_DEFAULT,
                "promptLoaded": bool(SYSTEM_PROMPT),
            },
        )

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path != "/invocations":
            self._json_response(404, {"message": "Not Found"})
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            raw_body = self.rfile.read(content_length) if content_length > 0 else b"{}"
            payload = json.loads(raw_body.decode("utf-8"))
        except Exception:
            self._json_response(400, {"message": "Invalid JSON payload"})
            return

        user_text = str(payload.get("inputText", "")).strip()
        session_id = str(payload.get("sessionId") or uuid.uuid4())
        authorization_header = self.headers.get("Authorization")
        if not user_text:
            self._json_response(400, {"message": "inputText is required"})
            return

        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "keep-alive")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type,Authorization")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.end_headers()

        try:
            self.wfile.write(_sse("status", {"status": "thinking", "message": "考え中です..."}))
            self.wfile.flush()

            actor_id = _resolve_actor_id(session_id, authorization_header)
            output_text = _run_agent_turn(session_id=session_id, actor_id=actor_id, user_text=user_text)
            for chunk in _chunk_text(output_text, STREAM_CHUNK_CHAR_SIZE):
                self.wfile.write(_sse("chunk", {"chunk": chunk}))
                self.wfile.flush()

            self.wfile.write(_sse("done", {"runtimeSessionId": session_id}))
            self.wfile.flush()
        except Exception as exc:
            self.wfile.write(_sse("status", {"status": "error", "message": f"{type(exc).__name__}: {exc}"}))
            self.wfile.write(_sse("done", {"runtimeSessionId": session_id}))
            self.wfile.flush()

    def log_message(self, fmt: str, *args: Any) -> None:
        # Keep runtime logs concise.
        print(f"{self.address_string()} - {fmt % args}")


def run() -> None:
    server = ThreadingHTTPServer((RUNTIME_HOST, RUNTIME_PORT), RuntimeHandler)
    print(
        json.dumps(
            {
                "message": "KinTrain runtime server started",
                "host": RUNTIME_HOST,
                "port": RUNTIME_PORT,
                "modelId": MODEL_ID,
            },
            ensure_ascii=False,
        )
    )
    server.serve_forever()


if __name__ == "__main__":
    run()
