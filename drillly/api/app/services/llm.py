import json
from pathlib import Path
from typing import Any

import httpx
from pypdf import PdfReader

from app.config import settings
from app.services.pdf_metadata import enrich_questions
from app.services.settings_store import get_effective_keys


def list_providers() -> list[dict]:
    keys = get_effective_keys()
    items = [
        {
            "id": "mock",
            "label": "Mock（无 Key 测试）",
            "model": "mock-v1",
            "available": True,
        },
    ]
    if keys["tongyi"]:
        items.append(
            {
                "id": "tongyi",
                "label": "通义千问",
                "model": settings.tongyi_model,
                "available": True,
            }
        )
    if keys["deepseek"]:
        items.append(
            {
                "id": "deepseek",
                "label": "DeepSeek",
                "model": settings.deepseek_model,
                "available": True,
            }
        )
    return items


def _extract_chunk_text(chunk_path: str, max_chars: int = 14000) -> str:
    path = Path(chunk_path)
    if not path.is_file():
        return ""
    try:
        reader = PdfReader(str(path))
        parts = [page.extract_text() or "" for page in reader.pages]
        text = "\n".join(parts).strip()
        return text[:max_chars] if text else ""
    except Exception:
        return ""


def _mock_questions(
    page_start: int,
    page_end: int,
    *,
    source_filename: str,
    source_path: str,
    user_tags: list[str],
) -> list[dict[str, Any]]:
    raw = [
        {
            "type": "single_choice",
            "title": f"示例单选（第 {page_start}–{page_end} 页）",
            "stem": r"已知 $f(x)=x^2$，则 $f'(2)=$",
            "options": [
                {"key": "A", "content": "$2$"},
                {"key": "B", "content": "$4$"},
                {"key": "C", "content": "$8$"},
                {"key": "D", "content": "$16$"},
            ],
            "answer": ["B"],
            "explanation": r"$f'(x)=2x$，故 $f'(2)=4$。",
            "metadata": {"difficulty": "easy", "page": page_start},
        },
        {
            "type": "coding",
            "title": "示例代码题",
            "stem": "读入两个整数，输出它们的和。",
            "answer": [],
            "language": "python",
            "explanation": "使用 `a+b` 即可。",
            "metadata": {"difficulty": "easy", "page": page_start},
        },
    ]
    enriched, _ = enrich_questions(
        raw,
        source_filename=source_filename,
        source_path=source_path,
        user_tags=user_tags,
        page_start=page_start,
        page_end=page_end,
        pdf_tag=None,
    )
    return enriched


def _parse_model_payload(data: Any) -> tuple[list[dict[str, Any]], str | None]:
    pdf_tag: str | None = None
    if isinstance(data, dict):
        pdf_tag = data.get("pdf_tag") or data.get("batch_tag")
        if isinstance(pdf_tag, str):
            pdf_tag = pdf_tag.strip() or None
        questions = data.get("questions")
        if questions is None and "type" in data:
            return [data], pdf_tag
        if not isinstance(questions, list):
            raise ValueError("模型返回缺少 questions 数组")
        return questions, pdf_tag
    if isinstance(data, list):
        return data, None
    raise ValueError("模型返回不是题目数组")


async def parse_pdf_batch(
    provider: str,
    model: str | None,
    chunk_path: str,
    page_start: int,
    page_end: int,
    *,
    source_filename: str = "",
    source_path: str = "",
    user_tags: list[str] | None = None,
) -> dict[str, Any]:
    """Parse a PDF chunk; returns questions + pdf_tag for task tagging."""
    tags = user_tags or []
    filename = source_filename or Path(chunk_path).name
    path = source_path or str(Path(chunk_path).resolve())

    if provider == "mock":
        questions = _mock_questions(
            page_start,
            page_end,
            source_filename=filename,
            source_path=path,
            user_tags=tags,
        )
        _, pdf_tag = enrich_questions(
            questions,
            source_filename=filename,
            source_path=path,
            user_tags=tags,
            page_start=page_start,
            page_end=page_end,
        )
        return {"questions": questions, "pdf_tag": pdf_tag}

    keys = get_effective_keys()
    if provider == "deepseek" and keys["deepseek"]:
        raw = await _call_openai_compat(
            base_url="https://api.deepseek.com/v1",
            api_key=keys["deepseek"],
            model=model or settings.deepseek_model,
            chunk_path=chunk_path,
            page_start=page_start,
            page_end=page_end,
            source_filename=filename,
            source_path=path,
            user_tags=tags,
        )
    elif provider == "tongyi" and keys["tongyi"]:
        raw = await _call_openai_compat(
            base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
            api_key=keys["tongyi"],
            model=model or settings.tongyi_model,
            chunk_path=chunk_path,
            page_start=page_start,
            page_end=page_end,
            source_filename=filename,
            source_path=path,
            user_tags=tags,
        )
    else:
        raise ValueError(f"提供商不可用或未配置 Key: {provider}")

    questions, pdf_tag = _parse_model_payload(raw)
    questions, pdf_tag = enrich_questions(
        questions,
        source_filename=filename,
        source_path=path,
        user_tags=tags,
        page_start=page_start,
        page_end=page_end,
        pdf_tag=pdf_tag,
    )
    return {"questions": questions, "pdf_tag": pdf_tag}


async def _call_openai_compat(
    base_url: str,
    api_key: str,
    model: str,
    chunk_path: str,
    page_start: int,
    page_end: int,
    source_filename: str,
    source_path: str,
    user_tags: list[str],
) -> Any:
    pdf_text = _extract_chunk_text(chunk_path)
    user_tag_line = "、".join(user_tags) if user_tags else "（无）"
    text_block = pdf_text if pdf_text else "（未能提取文本，请根据页码与文件名合理推断题型结构）"

    prompt = f"""你是试卷解析助手。请根据以下 PDF 片段内容输出 JSON。

【来源信息（必须写入每题 metadata）】
- 文件名 source_pdf: {source_filename}
- 路径 source_path: {source_path}
- 页码范围: 第 {page_start}–{page_end} 页
- 用户已指定标签: {user_tag_line}

【PDF 文本】
{text_block}

【输出格式】仅输出一个 JSON 对象，不要 markdown 代码块：
{{
  "pdf_tag": "大标签：整份 PDF 一个主题（2-6 字，如：行测、高三数学、Python）",
  "questions": [
    {{
      "type": "single_choice | multiple_choice | coding",
      "title": "题目标题",
      "stem": "题干，数学用 LaTeX",
      "options": [{{"key": "A", "content": "..."}}],
      "answer": ["A"],
      "explanation": "解析",
      "metadata": {{
        "difficulty": "easy | medium | hard",
        "source_pdf": "{source_filename}",
        "source_path": "{source_path}",
        "page": {page_start},
        "tag_group": "与大标签 pdf_tag 相同",
        "tags": ["小标签1", "小标签2"]
      }}
    }}
  ]
}}

要求：
- pdf_tag / tag_group 只写一个大标签，不要重复堆砌。
- metadata.tags 每题最多 2 个小标签（章节/知识点），不要写大标签、不要写文件名。
- 每题必须有 source_pdf、source_path、page、tag_group、tags。"""

    async with httpx.AsyncClient(timeout=120.0) as client:
        r = await client.post(
            f"{base_url.rstrip('/')}/chat/completions",
            headers={"Authorization": f"Bearer {api_key}"},
            json={
                "model": model,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.2,
            },
        )
        r.raise_for_status()
        text = r.json()["choices"][0]["message"]["content"]
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[-1].rsplit("```", 1)[0]
    return json.loads(text)
