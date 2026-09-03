import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { SidebarProvider } from "./context/SidebarContext";
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

// THIS FILE DOES NOT GROW WITH THE APP. It used to carry one <Route> per
// module action -- /:modulePath, /:modulePath/:moduleAction,
// /:modulePath/:moduleAction/:recordId -- and would have needed another for
// every custom page. Both halves of that are now derived:
//
//   * the guard and the shell are declared ONCE, in the pathless layout
//     route below (Laravel's Route::group(['middleware' => ['auth',
//     'check.user']]) around every admin route in routes/web.php);
//   * every module URL, however deep, goes through one splat route to
//     ModuleRoute, which resolves the page off the filesystem.
//
// Adding a page means adding a FILE under pages/modules/ -- see
// pages/modulePages.js. Nothing is registered here.
export default function App() {
  return (
    <AuthProvider>
      <Themed>
        <SidebarProvider>
          <Routes>
            <Route path="/login" element={<Login />} />

            {/* Pathless layout route: children inherit the auth guard and the
                admin shell, so a new static page is a single line. */}
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

              {/* ONE route for every module and every module action:
                  /roles, /roles/add, /roles/edit/7,
                  /roles/edit-permissions/7, ... This is the equivalent of
                  CommonHelpers::routeController()'s
                  /{one?}/{two?}/{three?}/{four?}/{five?} wildcards, minus the
                  five-segment ceiling. React Router ranks by specificity, not
                  declaration order, so "/dashboard" above always wins. */}
              <Route path="/:modulePath/*" element={<ModuleRoute />} />
            </Route>

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </SidebarProvider>
      </Themed>
    </AuthProvider>
  );
}
