"""Persist API keys & paths to data/settings.json; sync to .env for server restart."""

from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any

from app.config import API_ROOT, settings

SETTINGS_PATH = API_ROOT / "data" / "settings.json"
ENV_PATH = API_ROOT / ".env"

MASK = "********"


def _load_raw() -> dict[str, Any]:
    if not SETTINGS_PATH.exists():
        return {}
    try:
        return json.loads(SETTINGS_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}


def _save_raw(data: dict[str, Any]) -> None:
    SETTINGS_PATH.parent.mkdir(parents=True, exist_ok=True)
    SETTINGS_PATH.write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def _mask_key(key: str | None) -> str:
    if not key:
        return ""
    if len(key) <= 8:
        return MASK
    return key[:4] + MASK + key[-4:]


def get_effective_keys() -> dict[str, str]:
    raw = _load_raw()
    return {
        "tongyi": (raw.get("tongyi_api_key") or settings.tongyi_api_key or "").strip(),
        "deepseek": (raw.get("deepseek_api_key") or settings.deepseek_api_key or "").strip(),
    }


def apply_keys_to_runtime() -> None:
    keys = get_effective_keys()
    if keys["tongyi"]:
        os.environ["TONGYI_API_KEY"] = keys["tongyi"]
        settings.tongyi_api_key = keys["tongyi"]
    if keys["deepseek"]:
        os.environ["DEEPSEEK_API_KEY"] = keys["deepseek"]
        settings.deepseek_api_key = keys["deepseek"]


def _update_env_file(updates: dict[str, str]) -> None:
    lines: list[str] = []
    if ENV_PATH.exists():
        lines = ENV_PATH.read_text(encoding="utf-8").splitlines()
    present = set()
    out: list[str] = []
    for line in lines:
        m = re.match(r"^([A-Z_]+)=", line)
        if m and m.group(1) in updates:
            key = m.group(1)
            if updates[key]:
                out.append(f"{key}={updates[key]}")
            present.add(key)
        else:
            out.append(line)
    for key, val in updates.items():
        if key not in present and val:
            out.append(f"{key}={val}")
    ENV_PATH.write_text("\n".join(out).rstrip() + "\n", encoding="utf-8")


def get_public_settings() -> dict[str, Any]:
    raw = _load_raw()
    keys = get_effective_keys()
    return {
        "tongyi_api_key_masked": _mask_key(keys["tongyi"]),
        "deepseek_api_key_masked": _mask_key(keys["deepseek"]),
        "tongyi_configured": bool(keys["tongyi"]),
        "deepseek_configured": bool(keys["deepseek"]),
        "llm_default_provider": raw.get("llm_default_provider") or settings.llm_default_provider,
        "pdf_inbox_dir": str(get_pdf_inbox_dir()),
        "pdf_pages_per_batch": int(
            raw.get("pdf_pages_per_batch") or settings.pdf_default_pages_per_batch
        ),
        "study_export_wrongbook": str(get_wrongbook_export_dir()),
        "study_video_progress_file": str(get_video_progress_file()),
    }


def update_settings(
    *,
    tongyi_api_key: str | None = None,
    deepseek_api_key: str | None = None,
    llm_default_provider: str | None = None,
    pdf_pages_per_batch: int | None = None,
) -> dict[str, Any]:
    raw = _load_raw()
    env_updates: dict[str, str] = {}

    if tongyi_api_key is not None and tongyi_api_key.strip() and tongyi_api_key != MASK:
        raw["tongyi_api_key"] = tongyi_api_key.strip()
        env_updates["TONGYI_API_KEY"] = raw["tongyi_api_key"]
    if deepseek_api_key is not None and deepseek_api_key.strip() and deepseek_api_key != MASK:
        raw["deepseek_api_key"] = deepseek_api_key.strip()
        env_updates["DEEPSEEK_API_KEY"] = raw["deepseek_api_key"]
    if llm_default_provider:
        raw["llm_default_provider"] = llm_default_provider
        env_updates["LLM_DEFAULT_PROVIDER"] = llm_default_provider
    if pdf_pages_per_batch is not None:
        raw["pdf_pages_per_batch"] = pdf_pages_per_batch

    _save_raw(raw)
    if env_updates:
        _update_env_file(env_updates)
    apply_keys_to_runtime()
    return get_public_settings()


def init_settings_from_env() -> None:
    """On startup: load settings.json; seed from .env if missing."""
    raw = _load_raw()
    changed = False
    if not raw.get("tongyi_api_key") and settings.tongyi_api_key:
        raw["tongyi_api_key"] = settings.tongyi_api_key
        changed = True
    if not raw.get("deepseek_api_key") and settings.deepseek_api_key:
        raw["deepseek_api_key"] = settings.deepseek_api_key
        changed = True
    if changed:
        _save_raw(raw)
    apply_keys_to_runtime()


def get_pdf_inbox_dir() -> Path:
    raw = _load_raw()
    if raw.get("pdf_inbox_dir"):
        return Path(raw["pdf_inbox_dir"])
    return Path(settings.study_root) / "学习资料" / "做题" / "PDF待导入"


def get_wrongbook_export_dir() -> Path:
    d = Path(settings.study_root) / "学习资料" / "做题" / "同步错题"
    d.mkdir(parents=True, exist_ok=True)
    return d


def get_video_progress_file() -> Path:
    return Path(settings.study_root) / "学习资料" / "学习视频进度" / "视频进度看板数据.md"


def ensure_study_dirs() -> None:
    get_pdf_inbox_dir().mkdir(parents=True, exist_ok=True)
    get_wrongbook_export_dir().mkdir(parents=True, exist_ok=True)
