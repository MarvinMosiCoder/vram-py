from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.admin_notifications import AdminNotifications

router = APIRouter(tags=["notification"])

class UpdateNotificationRequest(BaseModel):
    notification_id: int

@router.get("/notifications")
def get_notifications(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    notifications = (
        db.query(AdminNotifications)
        .filter(
            AdminNotifications.adm_user_id == current_user.id
        )
        .order_by(AdminNotifications.created_at.desc())
        .limit(20)
        .all()
    )

    unread_count = (
        db.query(AdminNotifications)
        .filter(
            AdminNotifications.adm_user_id == current_user.id,
            AdminNotifications.is_read == 0,
        )
        .count()
    )

    return {
        "notifications": notifications,
        "unread_count": unread_count,
    }

@router.post("/read")
def mark_as_read(
    payload: UpdateNotificationRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    updated = (
        db.query(AdminNotifications)
        .filter(
            AdminNotifications.adm_user_id == current_user.id,
            AdminNotifications.id == payload.notification_id,
        )
        .update(
            {"is_read": 1},
            synchronize_session=False,
        )
    )

    if updated == 0:
        return {
            "message": "Notification not found.",
            "status": "error",
        }

    db.commit()

    return {
        "message": "Notification marked as read.",
        "status": "success",
    }

@router.get("/read-all'")
def get_notifications(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
  updated = 
        db.query(AdminNotifications)
        .filter(
            AdminNotifications.adm_user_id == current_user.id,
            AdminNotifications.is_read == 0,
        )
        .update(
            {"is_read": 1},
            synchronize_session=True,
        )

          db.commit()

    return {
        "message": "All notifications marked as read.",
        "updated": updated,
        "status": "success",
    }
    