// apps/frontend/src/app/App.tsx
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import LandingPage from './landing/LandingPage';
import LoginPage from './auth/LoginPage';
import DashboardPage from './dashboard/DashboardPage';
import ManifestesPage from './manifestes/ManifestesPage';
import VolsPage from './vols/VolsPage';
import ValidationsPage from './validations/ValidationsPage';
import CemaaPage from './cemaa/CemaaPage';
import MagePage from './mage/MagePage';
import ExploitationPage from './exploitation/ExploitationPage';
import ArchivesPage from './archives/ArchivesPage';
import AdminPage from './admin/AdminPage';
import Layout from '@/components/Layout';
import ProfilePage from './profile/ProfilePage';

function PrivateRoute({ children }: { children: React.ReactNode }): React.ReactElement {
  const { user } = useAuthStore();
  return user ? <Layout>{children}</Layout> : <Navigate to="/login" replace />;
}

function RoleRoute(
  { roles, children }: { roles: string[]; children: React.ReactNode },
): React.ReactElement {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to="/" replace />;
  return <Layout>{children}</Layout>;
}

/**
 * Racine à double visage : vitrine publique si non connecté, tableau de bord
 * sinon. Préserve les redirections existantes (`navigate('/')` après login,
 * `/login` sur échec de rafraîchissement).
 */
function Racine(): React.ReactElement {
  const { user } = useAuthStore();
  return user ? <Layout><DashboardPage /></Layout> : <LandingPage />;
}

export default function App(): React.ReactElement {
  return (
    <Routes>
      {/* ── Public ── */}
      <Route path="/"        element={<Racine />} />
      <Route path="/accueil" element={<LandingPage />} />
      <Route path="/login"   element={<LoginPage />} />

      {/* ── Authentifié ── */}
      <Route path="/manifestes/*" element={<RoleRoute roles={['chef_escale']}><ManifestesPage /></RoleRoute>} />
      <Route path="/vols/*"       element={<PrivateRoute><VolsPage /></PrivateRoute>} />
      <Route path="/validations"  element={<PrivateRoute><ValidationsPage /></PrivateRoute>} />

      {/*
        Deux espaces d'autorité centrale, strictement cloisonnés : chaque garde
        ne nomme QU'UN rôle. Pendant IHM du cloisonnement des clés de
        chiffrement côté service.
      */}
      <Route path="/cemaa/*" element={<RoleRoute roles={['cemaa']}><CemaaPage /></RoleRoute>} />
      <Route path="/mage/*"  element={<RoleRoute roles={['mage']}><MagePage /></RoleRoute>} />

      {/*
        Exploitation : la garde de rôle ci-dessous NE FAIT QUE masquer l'écran.
        Le vrai contrôle est côté serveur, où chaque endpoint porte sa propre
        liste de rôles et où le cloisonnement par base est appliqué en SQL.
        Ne relâchez jamais l'un en comptant sur l'autre.
      */}
      <Route path="/exploitation" element={
        <RoleRoute roles={['admin', 'combase', 'comgmo', 'comea', 'comeso', 'cemaa', 'mage']}>
          <ExploitationPage />
        </RoleRoute>
      } />

      {/* Archivé : ouvert à tous, cloisonné par base côté serveur. */}
      <Route path="/archives" element={<PrivateRoute><ArchivesPage /></PrivateRoute>} />

      <Route path="/admin/*" element={<RoleRoute roles={['admin']}><AdminPage /></RoleRoute>} />
      <Route path="/profile" element={<PrivateRoute><ProfilePage /></PrivateRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}