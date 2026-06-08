// apps/frontend/src/app/App.tsx
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import LoginPage from './auth/LoginPage';
import DashboardPage from './dashboard/DashboardPage';
import ManifestesPage from './manifestes/ManifestesPage';
import VolsPage from './vols/VolsPage';
import ValidationsPage from './validations/ValidationsPage';
import CemaaPage from './cemaa/CemaaPage';
import AdminPage from './admin/AdminPage';
import Layout from '@/components/Layout';
import ProfilePage from './profile/ProfilePage';

function PrivateRoute({ children }: { children: React.ReactNode }): React.ReactElement {
  const { user } = useAuthStore();
  return user ? <Layout>{children}</Layout> : <Navigate to="/login" replace />;
}

export default function App(): React.ReactElement {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
      <Route path="/manifestes/*" element={<PrivateRoute><ManifestesPage /></PrivateRoute>} />
      <Route path="/vols/*" element={<PrivateRoute><VolsPage /></PrivateRoute>} />
      <Route path="/validations" element={<PrivateRoute><ValidationsPage /></PrivateRoute>} />
      <Route path="/cemaa/*" element={<PrivateRoute><CemaaPage /></PrivateRoute>} />
      <Route path="/admin/*" element={<PrivateRoute><AdminPage /></PrivateRoute>} />
      <Route path="/profile" element={<PrivateRoute><ProfilePage /></PrivateRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}