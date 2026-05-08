import React, { useState, useRef, KeyboardEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { useLogin } from '@/hooks/useLogin';

const C = {
  bg: '#060e1a', card: '#0d1e36', cardBorder: '#1a3050',
  input: '#0a1628', inputBorder: '#1e3a5f', inputFocus: '#4a7fbf',
  blue: '#4a7fbf', blueDim: '#1a3a6b', blueText: '#7a9cc4',
  text: '#e8edf5', textDim: '#4a6b8a', textMuted: '#2d4d6e', green: '#1a6b3a',
};

function IconShield(): React.ReactElement {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} width={28} height={28}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
  </svg>;
}
function IconUser(): React.ReactElement {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} width={15} height={15}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
  </svg>;
}
function IconLock(): React.ReactElement {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} width={15} height={15}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
  </svg>;
}
function IconEye({ show }: { show: boolean }): React.ReactElement {
  return show ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} width={15} height={15}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} width={15} height={15}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
function Spinner(): React.ReactElement {
  return <svg viewBox="0 0 24 24" fill="none" width={14} height={14} style={{ animation: 'spin 1s linear infinite' }}>
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" style={{ opacity: 0.25 }} />
    <path fill="currentColor" style={{ opacity: 0.75 }} d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>;
}

function OtpInput({ onComplete, isLoading }: { onComplete: (v: string) => void; isLoading: boolean }): React.ReactElement {
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''));
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const handleChange = (i: number, val: string): void => {
    const d = val.replace(/\D/g, '').slice(-1);
    const next = [...digits]; next[i] = d; setDigits(next);
    if (d && i < 5) refs.current[i + 1]?.focus();
    if (next.every(x => x)) onComplete(next.join(''));
  };
  const handleKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus();
    if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus();
    if (e.key === 'ArrowRight' && i < 5) refs.current[i + 1]?.focus();
  };
  const handlePaste = (e: React.ClipboardEvent): void => {
    e.preventDefault();
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (text.length === 6) { setDigits(text.split('')); onComplete(text); }
  };
  return (
    <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 24 }} onPaste={handlePaste}>
      {digits.map((digit, i) => (
        <input key={i} ref={el => { refs.current[i] = el; }}
          type="text" inputMode="numeric" maxLength={1} value={digit} disabled={isLoading}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
          style={{
            width: 44, height: 56, textAlign: 'center', fontSize: 20, fontWeight: 700,
            fontFamily: "'Share Tech Mono', monospace", background: C.input,
            border: `2px solid ${digit ? C.blue : C.inputBorder}`, borderRadius: 4,
            color: C.text, outline: 'none', boxSizing: 'border-box',
            boxShadow: digit ? '0 0 12px rgba(74,127,191,0.3)' : 'none',
            transition: 'border-color 0.15s, box-shadow 0.15s',
          }}
        />
      ))}
    </div>
  );
}

export default function LoginPage(): React.ReactElement {
  const { user } = useAuthStore();
  const { step, isLoading, submitCredentials, submitOtp, backToCredentials } = useLogin();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [focus, setFocus] = useState<string | null>(null);

  if (user) return <Navigate to="/" replace />;

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (login.trim() && password) submitCredentials(login.trim(), password);
  };

  const inp = (name: string, extra: React.CSSProperties = {}): React.CSSProperties => ({
    width: '100%', paddingLeft: 36, paddingRight: 16, paddingTop: 12, paddingBottom: 12,
    borderRadius: 4, background: C.input, color: C.text, fontSize: 13, outline: 'none',
    fontFamily: "'Share Tech Mono', monospace", letterSpacing: '0.05em', boxSizing: 'border-box',
    border: `1px solid ${focus === name ? C.inputFocus : C.inputBorder}`,
    boxShadow: focus === name ? '0 0 0 3px rgba(74,127,191,0.15)' : 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s', ...extra,
  });

  return (
    <div style={{
      minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: 16, position: 'relative', overflow: 'hidden',
      fontFamily: "'Barlow', sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Barlow:wght@400;500;600;700&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.4} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)} }
        @keyframes scan { 0%{top:-2px}100%{top:100%} }
        input::placeholder { color: #2d4d6e; }
        input:disabled, button:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>

      {/* Grille */}
      <div style={{ position: 'absolute', inset: 0, opacity: 0.04, pointerEvents: 'none',
        backgroundImage: `linear-gradient(rgba(74,127,191,0.8) 1px,transparent 1px),linear-gradient(90deg,rgba(74,127,191,0.8) 1px,transparent 1px)`,
        backgroundSize: '40px 40px' }} />
      {/* Halo */}
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: 600, height: 600, borderRadius: '50%', opacity: 0.06, pointerEvents: 'none',
        background: 'radial-gradient(circle, #1a4a8a 0%, transparent 70%)' }} />
      {/* Scan */}
      <div style={{ position: 'absolute', width: '100%', height: 1, pointerEvents: 'none',
        background: 'linear-gradient(90deg,transparent,rgba(74,127,191,0.4),transparent)',
        opacity: 0.3, animation: 'scan 8s linear infinite' }} />

      {/* Carte */}
      <div style={{
        position: 'relative', width: '100%', maxWidth: 380,
        background: 'linear-gradient(160deg, #0d1e36 0%, #091525 100%)',
        border: `1px solid ${C.cardBorder}`, borderRadius: 8,
        boxShadow: '0 25px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(74,127,191,0.08)',
        overflow: 'hidden', animation: 'fadeIn 0.4s ease forwards',
      }}>
        {/* Trait haut */}
        <div style={{ position: 'absolute', top: 0, left: 32, right: 32, height: 1,
          background: 'linear-gradient(90deg,transparent,rgba(74,127,191,0.6),transparent)' }} />

        {/* Header */}
        <div style={{ padding: '32px 32px 24px', borderBottom: '1px solid #0f2040' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ padding: 8, background: C.input, border: `1px solid ${C.inputBorder}`,
              borderRadius: 6, color: C.blue, display: 'flex' }}>
              <IconShield />
            </div>
            <div>
              <div style={{ fontSize: 11, letterSpacing: '0.3em', color: C.blue, textTransform: 'uppercase',
                fontWeight: 600, fontFamily: "'Share Tech Mono', monospace" }}>FAC · SIGEA</div>
              <div style={{ fontSize: 10, letterSpacing: '0.15em', color: C.textMuted,
                textTransform: 'uppercase', marginTop: 2 }}>Système de Gestion des Escales Aériennes</div>
            </div>
          </div>
          {/* Étapes */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16 }}>
            {(['credentials', 'otp'] as const).map((s, idx) => {
              const active = step === s;
              const done = s === 'credentials' && step === 'otp';
              return (
                <React.Fragment key={s}>
                  {idx > 0 && <div style={{ flex: 1, height: 1, background: '#1a3050' }} />}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11,
                    letterSpacing: '0.1em', textTransform: 'uppercase',
                    color: active ? C.blue : '#1e3a5f', transition: 'color 0.2s' }}>
                    <span style={{ width: 20, height: 20, borderRadius: '50%', fontSize: 10, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: `1px solid ${active ? C.blue : '#1e3a5f'}`,
                      color: active ? C.blue : '#1e3a5f',
                      background: done ? C.blueDim : 'transparent', transition: 'all 0.2s' }}>
                      {done ? '✓' : idx + 1}
                    </span>
                    {s === 'credentials' ? 'Identifiants' : 'Code OTP'}
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '28px 32px' }}>
          {step === 'credentials' && (
            <div style={{ animation: 'fadeIn 0.3s ease forwards' }}>
              <p style={{ fontSize: 12, color: C.textDim, lineHeight: 1.6, marginBottom: 24, marginTop: 0 }}>
                Accès réservé au personnel autorisé.<br />
                Toute tentative non autorisée est enregistrée.
              </p>
              <form onSubmit={handleSubmit}>
                {/* Login */}
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '0.2em',
                    color: C.blueText, textTransform: 'uppercase', marginBottom: 6 }}>Identifiant</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                      color: C.textDim, display: 'flex' }}><IconUser /></span>
                    <input type="text" value={login} autoFocus placeholder="nom.prenom.base"
                      onChange={e => setLogin(e.target.value)} disabled={isLoading}
                      onFocus={() => setFocus('login')} onBlur={() => setFocus(null)}
                      style={inp('login')} autoComplete="username" />
                  </div>
                </div>
                {/* Password */}
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '0.2em',
                    color: C.blueText, textTransform: 'uppercase', marginBottom: 6 }}>Mot de passe</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                      color: C.textDim, display: 'flex' }}><IconLock /></span>
                    <input type={showPwd ? 'text' : 'password'} value={password} placeholder="••••••••••••"
                      onChange={e => setPassword(e.target.value)} disabled={isLoading}
                      onFocus={() => setFocus('password')} onBlur={() => setFocus(null)}
                      style={inp('password', { paddingRight: 40 })} autoComplete="current-password" />
                    <button type="button" onClick={() => setShowPwd(v => !v)} style={{
                      position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer', color: C.textDim, padding: 0, display: 'flex' }}>
                      <IconEye show={showPwd} />
                    </button>
                  </div>
                </div>
                <button type="submit" disabled={isLoading || !login.trim() || !password} style={{
                  width: '100%', padding: '12px 16px', borderRadius: 4, background: C.blueDim,
                  border: '1px solid #2d5a9e', color: '#c8d8f0', fontSize: 12, fontWeight: 600,
                  letterSpacing: '0.2em', textTransform: 'uppercase', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  boxSizing: 'border-box', transition: 'all 0.2s', marginTop: 4,
                }}>
                  {isLoading ? <><Spinner /> Authentification…</> : 'Accéder au système'}
                </button>
              </form>
            </div>
          )}

          {step === 'otp' && (
            <div style={{ animation: 'fadeIn 0.3s ease forwards' }}>
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <p style={{ color: C.blueText, fontSize: 13, marginBottom: 6, marginTop: 0 }}>
                  Vérification à deux facteurs
                </p>
                <p style={{ fontSize: 12, color: C.textDim, lineHeight: 1.6, margin: 0 }}>
                  Saisissez le code à 6 chiffres généré par votre application d'authentification.
                </p>
              </div>
              <OtpInput onComplete={submitOtp} isLoading={isLoading} />
              {isLoading && (
                <div style={{ textAlign: 'center', marginBottom: 12, color: C.blue, fontSize: 11,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Spinner /> Vérification en cours…
                </div>
              )}
              <button onClick={backToCredentials} disabled={isLoading} style={{
                width: '100%', padding: '8px 16px', background: 'transparent', border: 'none',
                color: C.textDim, fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase',
                cursor: 'pointer', marginTop: 12, boxSizing: 'border-box',
              }}>← Retour aux identifiants</button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '0 32px 24px', display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', fontSize: 10, color: '#1e3a5f', letterSpacing: '0.1em',
          textTransform: 'uppercase', fontFamily: "'Share Tech Mono', monospace" }}>
          <span>CONFIDENTIEL · INTRANET FAC</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.green,
              display: 'inline-block', animation: 'pulse 2s infinite' }} />
            SYS OPÉRATIONNEL
          </span>
        </div>
      </div>
    </div>
  );
}