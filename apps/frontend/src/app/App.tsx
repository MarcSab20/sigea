import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { useWebSocket } from '@/hooks/useWebSocket';
import LoginPage from './auth/LoginPage';
import DashboardPage from './dashboard/DashboardPage';
import ManifestesPage from './manifestes/ManifestesPage';
import CemaaPage from './cemaa/CemaaPage';
import AdminPage from './admin/AdminPage';
import { RoleUtilisateur } from '@sigea/shared-types';

function PrivateRoute({ children }: { children: React.ReactNode }): React.ReactElement {
  const { user } = useAuthStore();
  return user ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App(): React.ReactElement {
  useWebSocket();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
      <Route path="/manifestes/*" element={<PrivateRoute><ManifestesPage /></PrivateRoute>} />
      <Route path="/cemaa/*" element={<PrivateRoute><CemaaPage /></PrivateRoute>} />
      <Route path="/admin/*" element={<PrivateRoute><AdminPage /></PrivateRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
