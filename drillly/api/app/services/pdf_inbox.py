"""Watch PDF inbox folder under Study 学习资料."""

from __future__ import annotations

import shutil
import uuid
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Any

from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.models import PdfImportBatch, PdfImportTask, Question, Tag
from app.services.inbox_ledger import (
    get_import_record,
    is_imported,
    mark_imported,
    should_move_after_import,
)
from app.services.llm import parse_pdf_batch
from app.services.question_tags import attach_tags, merge_task_pdf_tag, tag_ids_for_question
from app.services.settings_store import get_pdf_inbox_dir
from app.tools.split_pdf import split_pdf


async def list_inbox_pdfs() -> list[dict]:
    inbox = get_pdf_inbox_dir()
    inbox.mkdir(parents=True, exist_ok=True)
    files = sorted(inbox.glob("*.pdf"), key=lambda p: p.stat().st_mtime, reverse=True)
    out: list[dict] = []
    for f in files:
        rec = get_import_record(f)
        item = {
            "name": f.name,
            "path": str(f),
            "size_mb": round(f.stat().st_size / (1024 * 1024), 2),
            "modified": f.stat().st_mtime,
            "imported": rec is not None,
        }
        if rec:
            item["imported_at"] = rec.get("imported_at")
            item["task_id"] = rec.get("task_id")
        out.append(item)
    return out


async def iter_inbox_pdf(
    db: Session,
    pdf_path: Path,
    *,
    provider: str,
    model: str | None,
    tags: list[str],
    pages_per_batch: int,
    auto_confirm: bool,
) -> AsyncIterator[dict[str, Any]]:
    """Yield progress events; final event is file_done with result."""
    if not pdf_path.exists():
        raise FileNotFoundError(str(pdf_path))

    yield {"type": "splitting", "file": pdf_path.name}

    batch_size = max(1, min(20, pages_per_batch))
    dest_dir = settings.media_dir / "imports"
    dest_dir.mkdir(parents=True, exist_ok=True)
    safe_name = f"{uuid.uuid4().hex}_{pdf_path.name}"
    dest_path = dest_dir / safe_name
    shutil.copy2(pdf_path, dest_path)

    chunks_dir = settings.media_dir / "imports" / "chunks" / dest_path.stem
    chunk_list = split_pdf(dest_path, chunks_dir, batch_size)
    total_pages = chunk_list[-1][1] if chunk_list else 0

    yield {
        "type": "split_done",
        "file": pdf_path.name,
        "batches": len(chunk_list),
        "total_pages": total_pages,
    }

    source_inbox_path = str(pdf_path.resolve())
    task = PdfImportTask(
        original_name=pdf_path.name,
        file_path=source_inbox_path,
        total_pages=total_pages,
        pages_per_batch=batch_size,
        status="processing",
    )
    tag_objs: list[Tag] = []
    for name in tags:
        t = db.query(Tag).filter(Tag.name == name).first()
        if not t:
            t = Tag(name=name)
            db.add(t)
            db.flush()
        tag_objs.append(t)
    task.tags = tag_objs
    db.add(task)
    db.flush()

    created_ids: list[int] = []
    parsed_count = 0
    batch_total = len(chunk_list)

    for batch_index, (page_start, page_end, chunk_path) in enumerate(chunk_list, start=1):
        yield {
            "type": "batch_start",
            "file": pdf_path.name,
            "batch_index": batch_index,
            "batch_total": batch_total,
            "page_start": page_start,
            "page_end": page_end,
        }

        batch = PdfImportBatch(
            task_id=task.id,
            page_start=page_start,
            page_end=page_end,
            chunk_path=str(chunk_path),
            status="pending",
        )
        db.add(batch)
        db.flush()

        result = await parse_pdf_batch(
            provider,
            model,
            str(chunk_path),
            page_start,
            page_end,
            source_filename=pdf_path.name,
            source_path=source_inbox_path,
            user_tags=tags,
        )
        questions = result["questions"]
        merge_task_pdf_tag(
            db, task, result.get("pdf_tag"), source_pdf=pdf_path.name
        )
        batch.parsed_json = questions
        batch.status = "parsed"
        parsed_count += len(questions)

        if auto_confirm and questions:
            for item in questions:
                q_type = item.get("type", "single_choice")
                q = Question(type=q_type, content=item)
                attach_tags(db, q, tag_ids_for_question(db, item, list(task.tags)))
                db.add(q)
                db.flush()
                created_ids.append(q.id)
            batch.status = "confirmed"

        yield {
            "type": "batch_done",
            "file": pdf_path.name,
            "batch_index": batch_index,
            "batch_total": batch_total,
            "questions": len(questions),
            "pdf_tag": result.get("pdf_tag"),
        }

    task.status = "done"
    db.commit()

    pdf_tag = task.tags[0].name if task.tags else None
    mark_imported(
        pdf_path,
        task_id=task.id,
        question_count=len(created_ids),
        pdf_tag=pdf_tag,
    )

    moved_to: str | None = None
    if should_move_after_import() and pdf_path.exists():
        done_dir = get_pdf_inbox_dir() / "已处理"
        done_dir.mkdir(parents=True, exist_ok=True)
        target = done_dir / pdf_path.name
        if target.exists():
            target = done_dir / f"{uuid.uuid4().hex[:8]}_{pdf_path.name}"
        shutil.move(str(pdf_path), str(target))
        moved_to = str(target)

    yield {
        "type": "file_done",
        "file": pdf_path.name,
        "result": {
            "file": pdf_path.name,
            "source_path": source_inbox_path,
            "pdf_tag": pdf_tag,
            "task_id": task.id,
            "batches": batch_total,
            "parsed_questions": parsed_count,
            "created_question_ids": created_ids,
            "moved_to": moved_to,
            "kept_in_inbox": moved_to is None,
        },
    }


async def process_inbox_pdf(
    db: Session,
    pdf_path: Path,
    *,
    provider: str,
    model: str | None,
    tags: list[str],
    pages_per_batch: int,
    auto_confirm: bool,
) -> dict:
    result: dict | None = None
    async for event in iter_inbox_pdf(
        db,
        pdf_path,
        provider=provider,
        model=model,
        tags=tags,
        pages_per_batch=pages_per_batch,
        auto_confirm=auto_confirm,
    ):
        if event.get("type") == "file_done":
            result = event["result"]
    if result is None:
        raise RuntimeError("import finished without result")
    return result


async def iter_inbox_process_all(
    *,
    provider: str,
    model: str | None,
    tags: list[str],
    pages_per_batch: int,
    auto_confirm: bool,
) -> AsyncIterator[dict[str, Any]]:
    inbox = get_pdf_inbox_dir()
    pdfs = sorted(inbox.glob("*.pdf"))
    pending: list[Path] = []
    skipped_files: list[dict] = []

    for pdf in pdfs:
        if is_imported(pdf):
            rec = get_import_record(pdf) or {}
            skipped_files.append(
                {
                    "file": pdf.name,
                    "reason": "已导入过，跳过（内容未变）",
                    "task_id": rec.get("task_id"),
                    "imported_at": rec.get("imported_at"),
                }
            )
        else:
            pending.append(pdf)

    yield {
        "type": "plan",
        "total_files": len(pdfs),
        "pending_files": len(pending),
        "skipped_files": len(skipped_files),
    }

    for item in skipped_files:
        yield {"type": "skip", **item}

    results: list[dict] = []
    errors: list[dict] = []

    for file_index, pdf in enumerate(pending, start=1):
        yield {
            "type": "file_start",
            "file": pdf.name,
            "file_index": file_index,
            "file_total": len(pending),
        }
        db = SessionLocal()
        try:
            async for event in iter_inbox_pdf(
                db,
                pdf,
                provider=provider,
                model=model,
                tags=tags,
                pages_per_batch=pages_per_batch,
                auto_confirm=auto_confirm,
            ):
                if event.get("type") == "file_done":
                    results.append(event["result"])
                yield event
        except Exception as e:
            db.rollback()
            err = {"file": pdf.name, "error": str(e)}
            errors.append(err)
            yield {"type": "file_error", **err}
        finally:
            db.close()

    yield {
        "type": "complete",
        "processed": len(results),
        "skipped": len(skipped_files),
        "results": results,
        "skipped_files": skipped_files,
        "errors": errors,
    }


async def process_all_inbox(
    db: Session,
    *,
    provider: str,
    model: str | None,
    tags: list[str],
    pages_per_batch: int,
    auto_confirm: bool,
) -> dict:
    summary: dict | None = None
    async for event in iter_inbox_process_all(
        provider=provider,
        model=model,
        tags=tags,
        pages_per_batch=pages_per_batch,
        auto_confirm=auto_confirm,
    ):
        if event.get("type") == "complete":
            summary = event
    return summary or {
        "processed": 0,
        "skipped": 0,
        "results": [],
        "skipped_files": [],
        "errors": [],
    }
