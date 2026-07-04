from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from app.models.report import Report


def get_by_id(db: Session, report_id: int) -> Report | None:
    return db.get(Report, report_id)


def create(
    db: Session,
    reporter_id: int,
    target_type: str,
    target_id: int,
    reason: str,
    comment: str,
) -> Report:
    report = Report(
        reporter_id=reporter_id,
        target_type=target_type,
        reason=reason,
        comment=comment,
        post_id=target_id if target_type == "post" else None,
        comment_id=target_id if target_type == "comment" else None,
        reported_user_id=target_id if target_type == "user" else None,
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


def list_all(
    db: Session, status: str | None, target_type: str | None, offset: int, limit: int
) -> list[Report]:
    q = db.query(Report)
    if status:
        q = q.filter(Report.status == status)
    if target_type:
        q = q.filter(Report.target_type == target_type)
    return q.order_by(desc(Report.created_at)).offset(offset).limit(limit).all()


def count(db: Session, status: str | None, target_type: str | None) -> int:
    q = db.query(func.count(Report.id))
    if status:
        q = q.filter(Report.status == status)
    if target_type:
        q = q.filter(Report.target_type == target_type)
    return q.scalar() or 0


def set_status(db: Session, report: Report, status: str) -> Report:
    report.status = status
    db.commit()
    db.refresh(report)
    return report


def delete(db: Session, report: Report) -> None:
    db.delete(report)
    db.commit()
