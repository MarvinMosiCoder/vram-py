from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.admin_announcements import AdminAnnouncements

router = APIRouter(tags=["announcements"])

@router.get("/announcements/unread")
def unread_announcements(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    announcements = db.query(Announcement)
                    .filter(Announcement.status == "ACTIVE")
                    .filter(
                        ~db.query(User)
                        .filter(
                            User.announcement_id == Announcement.id,
                            User.adm_user_id == user.id
                        )
                        .exists()
                    )
                    .all()