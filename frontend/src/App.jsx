import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { SidebarProvider } from "./context/SidebarContext";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import Layout from "./layout/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ModuleRoute from "./pages/ModuleRoute";

function Themed({ children }) {
  const { user } = useAuth();
  return (
    <ThemeProvider themeColor={user?.theme_color} profileData={user}>
      {children}
    </ThemeProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
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
            </Route>

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </SidebarProvider>
      </Themed>
    </AuthProvider>
  );
}
