"use client";

import AnnouncementsModal from "@/components/modal/AnnouncementModal";
import { useAuth } from "@/context/authContext";
import api from "@/lib/http";

export default function AnnouncementGate() {
  const { user, announcementQueue, setAnnouncementQueue, passwordPolicy } = useAuth();

  // The Laravel middleware checks check_user before unread announcements, so a
  // forced password change outranks them. Without this the two modals stack.
  if (!user || passwordPolicy?.must_change || announcementQueue.length === 0) {
    return null;
  }

  const currentAnnouncement = announcementQueue[0];

  const handleAnnouncementNext = async () => {
    if (!currentAnnouncement) return;

    try {
      await api.post(`/announcements/${currentAnnouncement.id}/read`);
    } catch (error) {
      console.error("Failed to mark announcement as read:", error);
    }

    setAnnouncementQueue((prev) => prev.slice(1));
  };

  return (
    <AnnouncementsModal
      show={!!currentAnnouncement}
      onClose={() => setAnnouncementQueue((prev) => prev.slice(1))}
      title={currentAnnouncement.title || "Announcement"}
      theme="bg-skin-blue"
      fontColor="text-white"
      withButton
      currentIndex={0}
      total={announcementQueue.length}
      createdAt={currentAnnouncement.created_at}
      onClick={handleAnnouncementNext}
      loading={false}
      isDisabled={false}
    >
      <div className="space-y-3">
        <p className="m-0 text-[15px] leading-7 text-gray-700">
          {currentAnnouncement.message || currentAnnouncement.content || "You have a new announcement."}
        </p>
      </div>
    </AnnouncementsModal>
  );
}
