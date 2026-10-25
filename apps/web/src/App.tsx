import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import AcceptInvite from './pages/AcceptInvite';
import Billing from './pages/Billing';
import Login from './pages/Login';
import Projects from './pages/Projects';
import Register from './pages/Register';
import Team from './pages/Team';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/accept-invite" element={<AcceptInvite />} />
        <Route element={<Layout />}>
          <Route path="/" element={<Projects />} />
          <Route path="/team" element={<Team />} />
          <Route path="/billing" element={<Billing />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
