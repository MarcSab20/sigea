// apps/frontend/src/components/Layout.tsx
import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { authApi } from '@/services/auth.service';
import { T } from '@/lib/theme';

const NAV_ITEMS = [
  { path: '/',             label: 'Tableau de Bord', icon: '⊞' },
  { path: '/manifestes',  label: 'Manifestes',       icon: '📋' },
  { path: '/vols',        label: 'Vols',             icon: '✈'  },
  { path: '/validations', label: 'Validations',      icon: '✓'  },
  { path: '/cemaa',       label: 'Espace CEMAA',     icon: '⬡'  },
  { path: '/admin',       label: 'Administration',   icon: '⚙'  },
  { path: '/profile', label: 'Mon profil', icon: '👤' },
];

export default function Layout({ children }: { children: React.ReactNode }): React.ReactElement {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = (): void => {
    // Déconnexion locale immédiate
    try { authApi.logout().catch(() => {}); } catch { /* silent */ }
    logout();
    try { localStorage.clear(); } catch { /* silent */ }
    navigate('/login', { replace: true });
  };

  const sideW = collapsed ? 56 : 220;
  const breadcrumb = NAV_ITEMS.find(n =>
    n.path !== '/' ? location.pathname.startsWith(n.path) : location.pathname === '/'
  )?.label ?? 'SIGEA';

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: T.bg, fontFamily: T.body }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=Source+Code+Pro:wght@400;500&family=Inter:wght@400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: ${T.bgAlt}; }
        ::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 2px; }
        a { text-decoration: none; color: inherit; }
        button { font-family: inherit; }
        select, input, textarea { font-family: inherit; color-scheme: light; }
        @keyframes fadeIn { from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)} }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.5} }
        .nav-item { transition: all 0.15s; border-left: 3px solid transparent; }
        .nav-item:hover { background: ${T.bgAlt} !important; }
        .nav-item.active { background: ${T.greenBg} !important;
          border-left-color: ${T.green} !important; color: ${T.green} !important; }
        .nav-item.cemaa { }
        .nav-item.cemaa:hover { background: ${T.redBg} !important; }
        .nav-item.cemaa.active { background: ${T.redBg} !important;
          border-left-color: ${T.red} !important; color: ${T.red} !important; }
        button:hover:not(:disabled) { filter: brightness(0.93); }
        .row-hover:hover { background: ${T.bgAlt} !important; cursor: pointer; }
      `}</style>

      {/* SIDEBAR */}
      <aside style={{ width: sideW, minHeight: '100vh', background: T.bgCard,
        borderRight: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column',
        position: 'fixed', top: 0, left: 0, zIndex: 100,
        transition: 'width 0.2s ease', overflow: 'hidden',
        boxShadow: '2px 0 8px rgba(0,0,0,0.04)' }}>

        {/* Logo */}
        <div style={{ height: 60, display: 'flex', alignItems: 'center',
          padding: collapsed ? '0 14px' : '0 18px', gap: 12,
          borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
          <div style={{ width: 30, height: 30, background: T.green, borderRadius: 6,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 15, flexShrink: 0, fontWeight: 700 }}>✈</div>
          {!collapsed && (
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, fontFamily: T.display,
                letterSpacing: '0.08em', color: T.text, lineHeight: 1 }}>SIGEA</div>
              <div style={{ fontSize: 9, color: T.textDim, letterSpacing: '0.12em',
                textTransform: 'uppercase', marginTop: 2 }}>Forces Aériennes</div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '8px 0', overflowY: 'auto' }}>
          {NAV_ITEMS.map(item => {
            const isActive = item.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.path);
            const isCemaa = item.path === '/cemaa';
            return (
              <Link key={item.path} to={item.path}
                className={`nav-item${isCemaa ? ' cemaa' : ''}${isActive ? ' active' : ''}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: collapsed ? '11px 14px' : '11px 18px',
                  color: isActive ? (isCemaa ? T.red : T.green) : T.textSub,
                  fontSize: 13, fontWeight: isActive ? 600 : 400,
                  background: isActive ? (isCemaa ? T.redBg : T.greenBg) : 'transparent',
                  cursor: 'pointer', letterSpacing: '0.01em',
                }}>
                <span style={{ fontSize: 15, flexShrink: 0, width: 20, textAlign: 'center',
                  color: isCemaa && isActive ? T.red : 'inherit' }}>
                  {item.icon}
                </span>
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div style={{ borderTop: `1px solid ${T.border}`, padding: '10px', flexShrink: 0 }}>
          {!collapsed && user && (
            <div style={{ padding: '8px 10px', background: T.bgAlt,
              borderRadius: 6, marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: T.text,
                textTransform: 'uppercase' }}>
                {user.role?.replace('_', ' ')}
              </div>
              <div style={{ fontSize: 10, color: T.textDim, marginTop: 2,
                fontFamily: T.mono }}>{user.base_id?.toUpperCase()}</div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={handleLogout} style={{ flex: 1, padding: '7px 8px',
              background: T.redBg, border: `1px solid ${T.redBorder}`,
              borderRadius: 5, color: T.red, fontSize: 11, cursor: 'pointer',
              fontWeight: 500 }}>
              {collapsed ? '⏻' : '⏻ Déconnexion'}
            </button>
            <button onClick={() => setCollapsed(v => !v)} style={{ padding: '7px 9px',
              background: T.bgAlt, border: `1px solid ${T.border}`, borderRadius: 5,
              color: T.textDim, fontSize: 12, cursor: 'pointer' }}>
              {collapsed ? '→' : '←'}
            </button>
          </div>
        </div>
      </aside>

      {/* CONTENU */}
      <div style={{ marginLeft: sideW, flex: 1, display: 'flex',
        flexDirection: 'column', transition: 'margin-left 0.2s ease', minHeight: '100vh' }}>

        {/* Topbar */}
        <header style={{ height: 60, background: T.bgCard,
          borderBottom: `1px solid ${T.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 24px', position: 'sticky', top: 0, zIndex: 50,
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: T.textDim }}>SIGEA</span>
            <span style={{ color: T.border }}>›</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{breadcrumb}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>
                {user?.role?.replace('_', ' ').toUpperCase()}
              </div>
              <div style={{ fontSize: 10, color: T.green, display: 'flex',
                alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%',
                  background: T.green, display: 'inline-block',
                  animation: 'pulse 2s infinite' }} />
                Session active
              </div>
            </div>
          </div>
        </header>

        <main style={{ flex: 1, padding: '24px', overflowY: 'auto',
          animation: 'fadeIn 0.25s ease forwards' }}>
          {children}
        </main>

        <footer style={{ padding: '10px 24px', borderTop: `1px solid ${T.border}`,
          display: 'flex', justifyContent: 'space-between', fontSize: 10,
          color: T.textMute, background: T.bgCard }}>
          <span>SIGEA v1.0 · FAC/DSIC · Confidentiel Défense</span>
          <span>Toutes les actions sont auditées · SHA-256</span>
        </footer>
      </div>
    </div>
  );
}