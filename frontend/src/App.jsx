import { Suspense, lazy } from "react";
import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { SidebarProvider } from "./context/SidebarContext";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import DocumentTitle from "./components/system/DocumentTitle";
import Layout from "./layout/Layout";
import Login from "./pages/auth/Login";
import Dashboard from "./pages/Dashboard";
import ModuleRoute from "./pages/ModuleRoute";
import Profile from "./pages/modules/users/Profile";
import AnnouncementsModal from "./components/modal/AnnoucementModal";
import api from "./api";

const Chat = lazy(() => import("./pages/chat/Chat"));

// Shown while a lazily-loaded route chunk is fetched. Deliberately plain: it
// appears for a few hundred milliseconds on first visit and never again, since
// the chunk is cached afterwards.
function RouteFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-live="polite">
      <span className="size-6 animate-spin rounded-full border-2 border-skin-border border-t-skin-accent" />
      <span className="sr-only">Loading</span>
    </div>
  );
}

function Themed({ children }) {
  const { user } = useAuth();

  return (
    <ThemeProvider
      themeColor={user?.theme_color}
      profileData={user}
    >
      {children}
    </ThemeProvider>
  );
}

function ProfileRoute() {
  const { user } = useAuth();

  return <Profile page_title="Profile" user={user} />;
}

function AnnouncementGate() {
  const { user, announcementQueue, setAnnouncementQueue } = useAuth();

  if (!user || announcementQueue.length === 0) {
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

export default function App() {
  return (
    <AuthProvider>
      <DocumentTitle />

      <Themed>
        <SidebarProvider>
          <AnnouncementGate />

          <Routes>
            <Route path="/login" element={<Login />} />

            <Route
              element={
                <ProtectedRoute>
                  <Layout>
                    <Outlet />
                  </Layout>
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/:modulePath/*" element={<ModuleRoute />} />
              <Route path="/profile" element={<ProfileRoute />} />
              <Route
                path="/chat"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <Chat />
                  </Suspense>
                }
              />
            </Route>

            <Route
              path="*"
              element={<Navigate to="/dashboard" replace />}
            />
          </Routes>
        </SidebarProvider>
      </Themed>
    </AuthProvider>
  );
}