import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';

/** Redirects anonymous visitors to /login, remembering where they were headed. */
export default function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <p className="center muted">Loading…</p>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <Outlet />;
}
