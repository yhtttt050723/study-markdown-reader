import json
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload

from app.config import settings
from app.database import get_db
from app.models import PdfImportBatch, PdfImportTask, Question, Tag
from app.schemas.api_models import ParseBatchBody, ProviderOut
from app.services.llm import list_providers, parse_pdf_batch
from app.services.pdf_inbox import iter_inbox_process_all, list_inbox_pdfs, process_all_inbox
from app.services.question_tags import attach_tags, merge_task_pdf_tag, tag_ids_for_question
from app.tools.split_pdf import split_pdf
from pydantic import BaseModel

router = APIRouter(prefix="/api/import", tags=["import"])


class InboxProcessBody(BaseModel):
    provider: str = "tongyi"
    model: str | None = None
    tags: str = ""
    pages_per_batch: int = 5
    auto_confirm: bool = True


@router.get("/providers/", response_model=list[ProviderOut])
def get_providers():
    return [ProviderOut(**p) for p in list_providers()]


@router.post("/pdf/")
async def upload_pdf(
    file: UploadFile = File(...),
    tags: str = Form(""),
    pages_per_batch: int = Form(None),
    db: Session = Depends(get_db),
):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "仅支持 PDF")

    content = await file.read()
    max_bytes = settings.pdf_max_mb * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(400, f"PDF 超过 {settings.pdf_max_mb}MB")

    batch_size = pages_per_batch or settings.pdf_default_pages_per_batch
    batch_size = max(1, min(20, batch_size))

    safe_name = f"{uuid.uuid4().hex}_{Path(file.filename).name}"
    dest_dir = settings.media_dir / "imports"
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest_path = dest_dir / safe_name
    dest_path.write_bytes(content)

    chunks_dir = settings.media_dir / "imports" / "chunks" / dest_path.stem
    chunk_list = split_pdf(dest_path, chunks_dir, batch_size)

    task = PdfImportTask(
        original_name=file.filename,
        file_path=str(dest_path),
        total_pages=chunk_list[-1][1] if chunk_list else 0,
        pages_per_batch=batch_size,
        status="split",
    )
    tag_names = [t.strip() for t in tags.split(",") if t.strip()]
    if tag_names:
        existing = {t.name: t for t in db.query(Tag).filter(Tag.name.in_(tag_names)).all()}
        task.tags = []
        for name in tag_names:
            if name not in existing:
                tag = Tag(name=name)
                db.add(tag)
                db.flush()
                existing[name] = tag
            task.tags.append(existing[name])

    db.add(task)
    db.flush()

    for page_start, page_end, chunk_path in chunk_list:
        batch = PdfImportBatch(
            task_id=task.id,
            page_start=page_start,
            page_end=page_end,
            chunk_path=str(chunk_path),
            status="pending",
        )
        db.add(batch)

    db.commit()
    return {"task_id": task.id, "batches": len(chunk_list)}


def _task_detail(db: Session, task_id: int) -> PdfImportTask:
    task = (
        db.query(PdfImportTask)
        .options(joinedload(PdfImportTask.tags), joinedload(PdfImportTask.batches))
        .filter(PdfImportTask.id == task_id)
        .first()
    )
    if not task:
        raise HTTPException(404, "任务不存在")
    return task


@router.get("/tasks/{task_id}/")
def get_task(task_id: int, db: Session = Depends(get_db)):
    task = _task_detail(db, task_id)
    return {
        "id": task.id,
        "original_name": task.original_name,
        "total_pages": task.total_pages,
        "pages_per_batch": task.pages_per_batch,
        "status": task.status,
        "tags": [{"id": t.id, "name": t.name} for t in task.tags],
        "batches": [
            {
                "id": b.id,
                "page_start": b.page_start,
                "page_end": b.page_end,
                "status": b.status,
            }
            for b in sorted(task.batches, key=lambda x: x.page_start)
        ],
    }


@router.get("/tasks/{task_id}/batches/{bid}/")
def get_batch(task_id: int, bid: int, db: Session = Depends(get_db)):
    batch = (
        db.query(PdfImportBatch)
        .filter(PdfImportBatch.id == bid, PdfImportBatch.task_id == task_id)
        .first()
    )
    if not batch:
        raise HTTPException(404, "批次不存在")
    return {
        "id": batch.id,
        "page_start": batch.page_start,
        "page_end": batch.page_end,
        "status": batch.status,
        "parsed_json": batch.parsed_json,
        "raw_response": batch.raw_response,
    }


@router.post("/tasks/{task_id}/batches/{bid}/parse/")
async def parse_batch(
    task_id: int,
    bid: int,
    body: ParseBatchBody,
    db: Session = Depends(get_db),
):
    batch = (
        db.query(PdfImportBatch)
        .filter(PdfImportBatch.id == bid, PdfImportBatch.task_id == task_id)
        .first()
    )
    if not batch:
        raise HTTPException(404, "批次不存在")

    task = _task_detail(db, task_id)
    user_tags = [t.name for t in task.tags]

    try:
        result = await parse_pdf_batch(
            body.provider,
            body.model,
            batch.chunk_path,
            batch.page_start,
            batch.page_end,
            source_filename=task.original_name,
            source_path=task.file_path,
            user_tags=user_tags,
        )
        questions = result["questions"]
        merge_task_pdf_tag(
            db, task, result.get("pdf_tag"), source_pdf=task.original_name
        )
        batch.parsed_json = questions
        batch.raw_response = json.dumps(
            {"pdf_tag": result.get("pdf_tag"), "questions": questions},
            ensure_ascii=False,
        )
        batch.status = "parsed"
        db.commit()
        return {
            "questions": questions,
            "count": len(questions),
            "pdf_tag": result.get("pdf_tag"),
            "source_pdf": task.original_name,
            "source_path": task.file_path,
        }
    except Exception as e:
        batch.status = "error"
        batch.raw_response = str(e)
        db.commit()
        raise HTTPException(500, str(e)) from e


@router.post("/tasks/{task_id}/batches/{bid}/confirm/")
def confirm_batch(task_id: int, bid: int, db: Session = Depends(get_db)):
    task = _task_detail(db, task_id)
    batch = next((b for b in task.batches if b.id == bid), None)
    if not batch or not batch.parsed_json:
        raise HTTPException(400, "请先解析该批次")

    created = []
    for item in batch.parsed_json:
        q_type = item.get("type", "single_choice")
        tag_ids = tag_ids_for_question(db, item, list(task.tags))
        q = Question(type=q_type, content=item)
        attach_tags(db, q, tag_ids)
        db.add(q)
        db.flush()
        created.append(q.id)

    batch.status = "confirmed"
    task.status = "partial"
    db.commit()
    return {"created_question_ids": created}


@router.get("/inbox/")
async def get_inbox():
    pdfs = await list_inbox_pdfs()
    from app.services.settings_store import get_pdf_inbox_dir

    return {"inbox_dir": str(get_pdf_inbox_dir()), "files": pdfs}


@router.post("/inbox/process-all/")
async def inbox_process_all(body: InboxProcessBody, db: Session = Depends(get_db)):
    tag_list = [t.strip() for t in body.tags.split(",") if t.strip()]
    try:
        return await process_all_inbox(
            db,
            provider=body.provider,
            model=body.model,
            tags=tag_list,
            pages_per_batch=body.pages_per_batch,
            auto_confirm=body.auto_confirm,
        )
    except Exception as e:
        raise HTTPException(500, str(e)) from e


@router.post("/inbox/process-all/stream/")
async def inbox_process_all_stream(body: InboxProcessBody):
    """SSE：批量导入进度（plan / file_start / batch_* / complete）。"""
    tag_list = [t.strip() for t in body.tags.split(",") if t.strip()]

    async def event_stream():
        try:
            async for event in iter_inbox_process_all(
                provider=body.provider,
                model=body.model,
                tags=tag_list,
                pages_per_batch=body.pages_per_batch,
                auto_confirm=body.auto_confirm,
            ):
                yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
        except Exception as e:
            err = {"type": "fatal", "error": str(e)}
            yield f"data: {json.dumps(err, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream; charset=utf-8",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
