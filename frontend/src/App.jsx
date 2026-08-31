import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import Layout from "./layout/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ModuleRoute from "./pages/ModuleRoute";

// ThemeProvider needs the signed-in user's theme_color, which comes from
// their *role* via GET /me -- so it has to sit inside AuthProvider, not
// beside it. Hence this thin bridge instead of nesting the two directly.
// Before login, themeColor is undefined and themeOptions falls back to the
// default skin.
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
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Layout>
                  <Dashboard />
                </Layout>
              </ProtectedRoute>
            }
          />
          {/* One route serves every module in adm_modules. React Router
            ranks by specificity, not declaration order, so the static
            "/dashboard" above always wins over this. */}
          <Route
            path="/:modulePath"
            element={
              <ProtectedRoute>
                <Layout>
                  <ModuleRoute />
                </Layout>
              </ProtectedRoute>
            }
          />
          {/* The route form of a row action, for useEditRoute:
              /roles/edit/1. Same component -- GeneratedModulePage reads
              :moduleAction and :recordId and opens its edit panel. Without
              this, that prop would navigate straight into the catch-all. */}
          <Route
            path="/:modulePath/:moduleAction/:recordId"
            element={
              <ProtectedRoute>
                <Layout>
                  <ModuleRoute />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Themed>
    </AuthProvider>
  );
}
