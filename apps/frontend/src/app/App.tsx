// apps/frontend/src/app/App.tsx
//
// ═══════════════════════════════════════════════════════════════════════════
// CE QUI CHANGE
// ═══════════════════════════════════════════════════════════════════════════
// • /validations disparaît : le circuit de validation du manifeste n'existe
//   plus, il vit dans /listes.
// • /manifestes n'est plus réservé au chef d'escale — ce rôle est supprimé.
//   L'écran devient celui du commandant de bord et de la lecture.
// • /scops et /listes apparaissent.
//
// Rappel qui mérite d'être relu à chaque modification de ce fichier : ces
// gardes de rôle NE FONT QUE masquer des écrans. Le vrai contrôle est côté
// serveur, où chaque route porte sa propre liste de rôles et où le
// cloisonnement base/RMIA est appliqué en SQL. Ne relâchez jamais l'un en
// comptant sur l'autre.

import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import LandingPage from './landing/LandingPage';
import LoginPage from './auth/LoginPage';
import DashboardPage from './dashboard/DashboardPage';
import ManifestesPage from './manifestes/ManifestesPage';
import VolsPage from './vols/VolsPage';
import ScopsPage from './scops/ScopsPage';
import ListesPage from './listes/ListesPage';
import ListeDetailPage from './listes/ListeDetailPage';
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

/** Racine à double visage : vitrine publique si non connecté, tableau de bord sinon. */
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

      {/* ── Planification et diffusion ── */}
      <Route path="/vols/*" element={<PrivateRoute><VolsPage /></PrivateRoute>} />
      <Route path="/scops"  element={
        <RoleRoute roles={['scops', 'admin']}><ScopsPage /></RoleRoute>
      } />

      {/*
        Listes : ouvert à tous les rôles du circuit. Le serveur ne renvoie que
        les listes du périmètre de l'appelant — un écran vide est la réponse
        correcte pour quelqu'un qui n'a rien à traiter, et il vaut mieux qu'une
        redirection silencieuse qu'on prend pour une panne.
      */}
      <Route path="/listes"     element={<PrivateRoute><ListesPage /></PrivateRoute>} />
      <Route path="/listes/:id" element={<PrivateRoute><ListeDetailPage /></PrivateRoute>} />

      {/* ── Manifestes : lecture, et discrimination finale du COMBORD ── */}
      <Route path="/manifestes/*" element={<PrivateRoute><ManifestesPage /></PrivateRoute>} />

      {/*
        Deux espaces d'autorité centrale, strictement cloisonnés : chaque garde
        ne nomme QU'UN rôle, en miroir du cloisonnement des clés de chiffrement
        côté service.
      */}
      <Route path="/cemaa/*" element={<RoleRoute roles={['cemaa']}><CemaaPage /></RoleRoute>} />
      <Route path="/mage/*"  element={<RoleRoute roles={['mage']}><MagePage /></RoleRoute>} />

      <Route path="/exploitation" element={
        <RoleRoute roles={['admin', 'combase', 'comgmo', 'comsecbase', 'comea', 'scops', 'cemaa', 'mage']}>
          <ExploitationPage />
        </RoleRoute>
      } />

      {/* Archives : ouvert à tous, cloisonné par base et RMIA côté serveur. */}
      <Route path="/archives" element={<PrivateRoute><ArchivesPage /></PrivateRoute>} />

      <Route path="/admin/*" element={<RoleRoute roles={['admin']}><AdminPage /></RoleRoute>} />
      <Route path="/profile" element={<PrivateRoute><ProfilePage /></PrivateRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}