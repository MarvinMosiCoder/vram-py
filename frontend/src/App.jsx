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

export default function App() {
  return (
    <AuthProvider>
      <DocumentTitle />

      <Themed>
        <SidebarProvider>
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