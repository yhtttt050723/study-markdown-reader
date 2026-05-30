from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import Question, Submission
from app.schemas.api_models import (
    PracticeProgressBody,
    PracticeStateOut,
    QuestionOut,
    SubmitBody,
    SubmissionOut,
    TagOut,
)
from app.services.grading import grade_answer
from app.services.markdown_export import build_export
from app.services.practice_progress import set_round_done
from app.services.question_query import (
    list_pdf_sources,
    load_questions,
    progress_map,
    progress_summary,
    source_pdf_from_content,
)

router = APIRouter(prefix="/api/practice", tags=["practice"])


def _question_to_out(q: Question, prog: dict[str, bool]) -> QuestionOut:
    return QuestionOut(
        id=q.id,
        bank_id=q.bank_id,
        category_id=q.category_id,
        type=q.type,
        content=q.content,
        status=q.status,
        tags=[TagOut.model_validate(t) for t in q.tags],
        category=q.category,
        practice=PracticeStateOut(
            round1=prog.get("round1", False),
            round2=prog.get("round2", False),
            source_pdf=source_pdf_from_content(q.content),
        ),
    )


@router.get("/pdf-sources/")
def pdf_sources(db: Session = Depends(get_db)):
    return list_pdf_sources(db)


@router.post("/backfill-source-tags/")
def backfill_source_tags(db: Session = Depends(get_db)):
    """为已有题目补上「来源·PDF文件名」标签（一次性）。"""
    from app.services.pdf_source_tag import ensure_pdf_source_tag
    from app.services.question_tags import attach_tags

    rows = (
        db.query(Question)
        .filter(Question.source_pdf != "")
        .options(joinload(Question.tags))
        .all()
    )
    updated = 0
    for q in rows:
        name = (q.source_pdf or "").strip() or source_pdf_from_content(q.content)
        if not name:
            continue
        tag = ensure_pdf_source_tag(db, name)
        if not tag:
            continue
        ids = [t.id for t in q.tags]
        if tag.id not in ids:
            ids.append(tag.id)
            attach_tags(db, q, ids)
            updated += 1
    db.commit()
    return {"updated": updated}


@router.get("/progress/summary/")
def get_progress_summary(
    db: Session = Depends(get_db),
    source_pdf: str | None = None,
):
    return progress_summary(db, source_pdf=source_pdf)


@router.get("/questions/", response_model=list[QuestionOut])
def list_practice_questions(
    db: Session = Depends(get_db),
    tags: str | None = None,
    category: str | None = None,
    type: str | None = Query(None, alias="type"),
    source_pdf: str | None = None,
    search: str | None = Query(None, max_length=200, description="题干/选项部分文字"),
    practice_round: int | None = Query(None, ge=1, le=2),
    round_status: str | None = Query(None, pattern="^(pending|done)$"),
    order: str = Query("id", pattern="^(id|random)$"),
    limit: int = Query(500, le=500),
    offset: int = 0,
):
    rows = load_questions(
        db,
        tags=tags,
        category=category,
        q_type=type,
        source_pdf=source_pdf,
        search=search,
        practice_round=practice_round,
        round_status=round_status,
        order=order,
        limit=limit,
        offset=offset,
    )
    pmap = progress_map(db, [r.id for r in rows])
    return [_question_to_out(r, pmap.get(r.id, {})) for r in rows]


@router.post("/progress/{question_id}/")
def update_progress(
    question_id: int,
    body: PracticeProgressBody,
    db: Session = Depends(get_db),
):
    if body.round not in (1, 2):
        raise HTTPException(400, "round 须为 1 或 2")
    q = db.query(Question).filter(Question.id == question_id).first()
    if not q:
        raise HTTPException(404, "题目不存在")
    row = set_round_done(db, question_id, body.round, body.done)
    return {"ok": True, "question_id": question_id, "round": row.round, "done": row.done}


@router.post("/submit/", response_model=SubmissionOut)
def submit_answer(body: SubmitBody, db: Session = Depends(get_db)):
    q = db.query(Question).filter(Question.id == body.question_id).first()
    if not q:
        raise HTTPException(404, "题目不存在")

    answer = dict(body.answer)
    if body.language and q.type == "coding":
        answer.setdefault("language", body.language)
        answer.setdefault("code", answer.get("value") or answer.get("code") or "")

    score, ok = grade_answer(q.type, q.content, answer)
    if q.type == "coding":
        score, ok = 0.0, False

    sub = Submission(
        question_id=q.id,
        answer=answer,
        score=score,
        is_correct=ok,
        duration_ms=body.duration_ms,
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)

    if body.practice_round in (1, 2):
        set_round_done(db, q.id, body.practice_round, True)

    return sub


@router.get("/submissions/", response_model=list[SubmissionOut])
def list_submissions(
    db: Session = Depends(get_db),
    question_id: int | None = Query(None),
    limit: int = Query(50, le=100),
):
    q = db.query(Submission).order_by(Submission.created_at.desc())
    if question_id is not None:
        q = q.filter(Submission.question_id == question_id)
    return q.limit(limit).all()


@router.get("/export/markdown/")
def export_markdown(
    db: Session = Depends(get_db),
    tags: str | None = None,
    category: str | None = None,
    type: str | None = None,
    source_pdf: str | None = None,
    search: str | None = Query(None, max_length=200),
    include_answers: bool = False,
    include_submissions: bool = True,
    format: str = Query("single", alias="format"),
    save_to_study: bool = False,
):
    questions = load_questions(
        db,
        tags=tags,
        category=category,
        q_type=type,
        source_pdf=source_pdf,
        search=search,
    )
    data, filename, media_type = build_export(
        db,
        questions,
        include_answers=include_answers,
        include_submissions=include_submissions,
        fmt=format,
    )
    if save_to_study:
        from app.config import settings

        path = settings.export_dir / filename
        path.write_bytes(data)

    return Response(
        content=data,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
