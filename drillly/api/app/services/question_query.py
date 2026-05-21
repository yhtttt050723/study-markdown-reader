"""Question list filters: PDF source, tags, practice round, random order."""

from __future__ import annotations

import random
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.models import PracticeProgress, Question
from app.services.tag_hierarchy import question_matches_tag_filter


def source_pdf_from_content(content: dict) -> str:
    meta = content.get("metadata") or {}
    return str(meta.get("source_pdf") or "").strip()


def list_pdf_sources(db: Session) -> list[dict[str, Any]]:
    rows = db.query(Question).all()
    counts: dict[str, int] = {}
    for q in rows:
        name = source_pdf_from_content(q.content)
        if name:
            counts[name] = counts.get(name, 0) + 1
    return [
        {"source_pdf": name, "question_count": n}
        for name, n in sorted(counts.items(), key=lambda x: (-x[1], x[0]))
    ]


def load_questions(
    db: Session,
    *,
    tags: str | None = None,
    category: str | None = None,
    q_type: str | None = None,
    source_pdf: str | None = None,
    practice_round: int | None = None,
    round_status: str | None = None,
    order: str = "id",
    limit: int = 500,
    offset: int = 0,
) -> list[Question]:
    q = db.query(Question).options(
        joinedload(Question.tags),
        joinedload(Question.category),
    )
    if q_type:
        q = q.filter(Question.type == q_type)
    if category:
        if category.isdigit():
            q = q.filter(Question.category_id == int(category))
        else:
            from app.models import Category

            q = q.join(Category).filter(Category.name == category)

    rows = q.order_by(Question.id).all()

    if source_pdf:
        rows = [r for r in rows if source_pdf_from_content(r.content) == source_pdf]

    if tags:
        names = [t.strip() for t in tags.split(",") if t.strip()]
        rows = [
            r
            for r in rows
            if any(
                question_matches_tag_filter({t.name for t in r.tags}, n) for n in names
            )
        ]

    if practice_round in (1, 2) and round_status in ("pending", "done"):
        prog = {
            p.question_id: p
            for p in db.query(PracticeProgress).filter(
                PracticeProgress.round == practice_round
            )
        }
        if round_status == "done":
            rows = [r for r in rows if r.id in prog and prog[r.id].done]
        else:
            rows = [r for r in rows if r.id not in prog or not prog[r.id].done]

    if order == "random":
        random.shuffle(rows)
    elif order == "id":
        rows.sort(key=lambda r: r.id)

    return rows[offset : offset + limit]


def progress_map(db: Session, question_ids: list[int]) -> dict[int, dict[str, bool]]:
    if not question_ids:
        return {}
    rows = (
        db.query(PracticeProgress)
        .filter(PracticeProgress.question_id.in_(question_ids))
        .all()
    )
    out: dict[int, dict[str, bool]] = {qid: {"round1": False, "round2": False} for qid in question_ids}
    for p in rows:
        if p.question_id not in out:
            out[p.question_id] = {"round1": False, "round2": False}
        if p.round == 1:
            out[p.question_id]["round1"] = p.done
        elif p.round == 2:
            out[p.question_id]["round2"] = p.done
    return out


def progress_summary(
    db: Session,
    *,
    source_pdf: str | None = None,
) -> dict[str, Any]:
    rows = db.query(Question).all()
    if source_pdf:
        rows = [r for r in rows if source_pdf_from_content(r.content) == source_pdf]
    ids = [r.id for r in rows]
    total = len(ids)
    if not total:
        return {"total": 0, "round1_done": 0, "round2_done": 0}

    prog = progress_map(db, ids)
    r1 = sum(1 for qid in ids if prog[qid]["round1"])
    r2 = sum(1 for qid in ids if prog[qid]["round2"])
    return {"total": total, "round1_done": r1, "round2_done": r2}
