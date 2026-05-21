from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import Category, Question, Tag
from app.services.tag_hierarchy import build_tag_tree, question_matches_tag_filter
from app.schemas.api_models import (
    CategoryCreate,
    CategoryOut,
    QuestionCreate,
    QuestionOut,
    QuestionPatch,
    TagCreate,
    TagOut,
)

router = APIRouter(prefix="/api/questions", tags=["questions"])


@router.get("/stats/")
def question_stats(db: Session = Depends(get_db)):
    total = db.query(Question).count()
    return {"total": total}


@router.get("/tags/", response_model=list[TagOut])
def list_tags(db: Session = Depends(get_db)):
    return db.query(Tag).order_by(Tag.name).all()


@router.get("/tags/tree/")
def list_tags_tree(db: Session = Depends(get_db)):
    """大标签 + 小标签树，供练习页两级筛选。"""
    tags = db.query(Tag).order_by(Tag.name).all()
    return build_tag_tree(tags)


@router.post("/tags/", response_model=TagOut)
def create_tag(body: TagCreate, db: Session = Depends(get_db)):
    if db.query(Tag).filter(Tag.name == body.name).first():
        raise HTTPException(400, "标签已存在")
    tag = Tag(name=body.name, color=body.color)
    db.add(tag)
    db.commit()
    db.refresh(tag)
    return tag


@router.get("/categories/", response_model=list[CategoryOut])
def list_categories(db: Session = Depends(get_db)):
    return db.query(Category).order_by(Category.sort_order, Category.name).all()


@router.post("/categories/", response_model=CategoryOut)
def create_category(body: CategoryCreate, db: Session = Depends(get_db)):
    if db.query(Category).filter(Category.name == body.name).first():
        raise HTTPException(400, "分类已存在")
    cat = Category(**body.model_dump())
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


def _load_question(db: Session, qid: int) -> Question:
    q = (
        db.query(Question)
        .options(joinedload(Question.tags), joinedload(Question.category))
        .filter(Question.id == qid)
        .first()
    )
    if not q:
        raise HTTPException(404, "题目不存在")
    return q


@router.get("/", response_model=list[QuestionOut])
def list_questions(
    db: Session = Depends(get_db),
    tags: str | None = Query(None),
    category: str | None = Query(None),
    type: str | None = Query(None, alias="type"),
    limit: int = Query(200, le=500),
    offset: int = 0,
):
    q = db.query(Question).options(
        joinedload(Question.tags),
        joinedload(Question.category),
    )
    if type:
        q = q.filter(Question.type == type)
    if category:
        if category.isdigit():
            q = q.filter(Question.category_id == int(category))
        else:
            q = q.join(Category).filter(Category.name == category)
    rows = q.order_by(Question.id).offset(offset).limit(limit).all()
    if tags:
        names = [t.strip() for t in tags.split(",") if t.strip()]
        rows = [
            r
            for r in rows
            if any(
                question_matches_tag_filter({t.name for t in r.tags}, n) for n in names
            )
        ]
    return rows


@router.post("/", response_model=QuestionOut)
def create_question(body: QuestionCreate, db: Session = Depends(get_db)):
    q = Question(
        bank_id=body.bank_id,
        category_id=body.category_id,
        type=body.type,
        content=body.content,
    )
    if body.tag_ids:
        q.tags = db.query(Tag).filter(Tag.id.in_(body.tag_ids)).all()
    db.add(q)
    db.commit()
    db.refresh(q)
    return _load_question(db, q.id)


@router.get("/{qid}/", response_model=QuestionOut)
def get_question(qid: int, db: Session = Depends(get_db)):
    return _load_question(db, qid)


@router.patch("/{qid}/", response_model=QuestionOut)
def patch_question(qid: int, body: QuestionPatch, db: Session = Depends(get_db)):
    q = _load_question(db, qid)
    if body.category_id is not None:
        q.category_id = body.category_id
    if body.content is not None:
        q.content = body.content
    if body.tag_ids is not None:
        q.tags = db.query(Tag).filter(Tag.id.in_(body.tag_ids)).all()
    db.commit()
    return _load_question(db, qid)


@router.delete("/{qid}/")
def delete_question(qid: int, db: Session = Depends(get_db)):
    q = _load_question(db, qid)
    db.delete(q)
    db.commit()
    return {"ok": True}
