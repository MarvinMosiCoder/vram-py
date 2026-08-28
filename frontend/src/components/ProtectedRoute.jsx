import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Wrap any route with this. Pass allowedRoles to also restrict by role.
// Usage: <ProtectedRoute allowedRoles={["admin"]}><AdminPage /></ProtectedRoute>
export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();

  if (loading) return null; // still checking the saved token

  if (!user) return <Navigate to="/login" replace />;

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
