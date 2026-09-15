import { Suspense, lazy, useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";
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
import Modal from "./components/modal/Modal";
import ChangePasswordForm from "./components/form/ChangePasswordForm";
import useSignOutCountdown from "./hooks/useSignOutCountdown";
import { useToast } from "./context/ToastContext";
import ChangePassword from "./pages/modules/users/ChangePassword";
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

// The port's stand-in for Laravel's CheckUserForceChangePassword middleware:
// there is no session to redirect on, so the server computes the policy and
// this blocks the app until the password is changed or waived. It is a prompt,
// not enforcement - the token stays valid and the API is reachable around it,
// which is why /waive-change-password re-checks the rules server-side.
function ForcePasswordGate() {
  const { user, passwordPolicy, loadPasswordPolicy } = useAuth();
  const { handleToast } = useToast();
  const [waiving, setWaiving] = useState(false);
  const { countdown, signingOut, start } = useSignOutCountdown();

  if (!user || !passwordPolicy?.must_change) {
    return null;
  }

  const handleWaive = async () => {
    setWaiving(true);
    try {
      const { data } = await api.post("/waive-change-password");
      handleToast(data.message, data.status);
      // Re-read rather than assuming: the server decides whether this closes.
      if (data.status === "success") await loadPasswordPolicy();
    } catch (error) {
      handleToast("An error occurred while waiving the password", "error");
    } finally {
      setWaiving(false);
    }
  };

  const waiveReason = passwordPolicy.is_default_password
    ? "You cannot waive while using the default password."
    : !passwordPolicy.can_waive
      ? `No waivers left (${passwordPolicy.waivers_used} of ${passwordPolicy.max_waivers} used).`
      : "";

  return (
    <Modal show dismissible={false} widthClass="max-w-2xl" title="Change your password">
      <p className="m-0 text-[13px] leading-6 text-skin-dim">
        {passwordPolicy.is_default_password
          ? "Your account is still using the default password. Set a new one to continue."
          : "Your password is more than three months old. Set a new one to continue."}
      </p>

      <ChangePasswordForm
        showSidePanel={false}
        disabled={signingOut || waiving}
        onSuccess={start}
        extraActions={
          <button
            type="button"
            onClick={handleWaive}
            disabled={!passwordPolicy.can_waive || waiving || signingOut}
            title={waiveReason || undefined}
            className="inline-flex min-h-10.5 items-center justify-center gap-2 rounded-lg border border-skin-border px-4 py-2 text-[13px] font-semibold text-skin-text transition hover:border-skin-accent hover:bg-skin-accent-soft focus-visible:outline-2 focus-visible:outline-skin-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            {waiving ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
            {waiving ? "Waiving..." : "Waive"}
          </button>
        }
      />

      {waiveReason && <p className="m-0 text-[12px] text-skin-dim">{waiveReason}</p>}
      {countdown > 0 && (
        <p role="status" aria-live="polite" className="m-0 text-[13px] text-skin-accent">
          Password updated. Signing out in {countdown}...
        </p>
      )}
    </Modal>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <DocumentTitle />

      <Themed>
        <SidebarProvider>
          <ForcePasswordGate />
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
              <Route path="/change-password" element={<ChangePassword />} />
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