// apps/frontend/src/app/auth/LoginPage.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { api } from '@/lib/api';

type Step = 'CREDENTIALS' | 'MFA_SETUP' | 'MFA_VERIFY';

interface MfaSetupData {
  secret: string;
  qr_url: string;
  otp_auth_url: string;
}

const T = {
  bg: '#f4f1ec', card: '#ffffff', green: '#2d6a4f', greenBg: '#d8f3dc',
  greenBorder: '#95d5b2', red: '#8b1a1a', redBg: '#fde8e8', redBorder: '#f5b8b8',
  blue: '#1e3a5f', amber: '#92400e', amberBg: '#fef3c7', amberBorder: '#fcd34d',
  text: '#1a1a1a', textSub: '#4a4540', textDim: '#8a857a', border: '#d4cfc5',
  input: '#faf8f5', mono: "'Source Code Pro', monospace",
  display: "'Rajdhani', 'Arial Narrow', sans-serif",
};

// ─── Composant saisie OTP 6 cases ─────────────────────────────────────────────
function OtpInput({ value, onChange, disabled }: {
  value: string; onChange: (v: string) => void; disabled?: boolean;
}): React.ReactElement {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const digits = value.split('').concat(Array(6).fill('')).slice(0, 6);

  const handleChange = (i: number, v: string): void => {
    const clean = v.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[i] = clean;
    onChange(next.join(''));
    if (clean && i < 5) inputs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent): void => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      inputs.current[i - 1]?.focus();
    }
    if (e.key === 'ArrowLeft' && i > 0) inputs.current[i - 1]?.focus();
    if (e.key === 'ArrowRight' && i < 5) inputs.current[i + 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent): void => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    onChange(pasted.padEnd(6, '').slice(0, 6));
    const focusIdx = Math.min(pasted.length, 5);
    inputs.current[focusIdx]?.focus();
  };

  return (
    <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
      {digits.map((d, i) => (
        <input key={i}
          ref={el => { inputs.current[i] = el; }}
          type="text" inputMode="numeric" maxLength={1}
          value={d} disabled={disabled}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={e => e.target.select()}
          style={{
            width: 48, height: 56, textAlign: 'center',
            fontSize: 22, fontWeight: 700, fontFamily: T.mono,
            background: d ? T.greenBg : T.input,
            border: `2px solid ${d ? T.greenBorder : T.border}`,
            borderRadius: 8, color: T.text, outline: 'none',
            transition: 'all 0.15s',
            boxShadow: d ? `0 0 0 3px ${T.green}15` : 'none',
          }} />
      ))}
    </div>
  );
}

// ─── Page Login principale ────────────────────────────────────────────────────
export default function LoginPage(): React.ReactElement {
  const navigate = useNavigate();
  const { setUser, setToken } = useAuthStore();

  const [step, setStep] = useState<Step>('CREDENTIALS');
  const [challengeToken, setChallengeToken] = useState('');
  const [mfaSetup, setMfaSetup] = useState<MfaSetupData | null>(null);

  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Auto-submit quand 6 chiffres saisis
  useEffect(() => {
    if (otpCode.length === 6 && !loading) {
      if (step === 'MFA_SETUP') handleActivateOtp();
      else if (step === 'MFA_VERIFY') handleVerifyOtp();
    }
  }, [otpCode]);

  // ── Étape 1 : identifiants ──────────────────────────────────────────────────
  const handleLogin = async (): Promise<void> => {
    if (!login || !password) { setError('Remplissez tous les champs'); return; }
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { login, password });

      if (data.step === 'MFA_SETUP') {
        setChallengeToken(data.challenge_token);
        setMfaSetup(data.mfa_setup);
        setStep('MFA_SETUP');
      } else if (data.step === 'MFA_VERIFY') {
        setChallengeToken(data.challenge_token);
        setStep('MFA_VERIFY');
      } else if (data.step === 'COMPLETE') {
        // Connexion sans MFA (cas legacy)
        finalizeLogin(data);
      }
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Identifiants incorrects');
    } finally { setLoading(false); }
  };

  // ── Étape 2b : activation MFA (première connexion) ─────────────────────────
  const handleActivateOtp = async (): Promise<void> => {
    if (otpCode.length !== 6) return;
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/activate-otp', {
        challenge_token: challengeToken,
        otp_code: otpCode,
      });
      finalizeLogin(data);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Code OTP invalide');
      setOtpCode('');
    } finally { setLoading(false); }
  };

  // ── Étape 2a : vérification MFA (connexions suivantes) ─────────────────────
  const handleVerifyOtp = async (): Promise<void> => {
    if (otpCode.length !== 6) return;
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/verify-otp', {
        challenge_token: challengeToken,
        otp_code: otpCode,
      });
      finalizeLogin(data);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Code OTP invalide ou expiré');
      setOtpCode('');
    } finally { setLoading(false); }
  };

  const finalizeLogin = (data: {
    access_token: string; refresh_token: string;
    user: { id: string; role: string; base_id: string; nom: string; prenom: string; grade: string };
  }): void => {
    setToken(data.access_token, data.refresh_token);
    setUser(data.user);
    navigate('/', { replace: true });
  };

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') {
      if (step === 'CREDENTIALS') handleLogin();
    }
  };

  const goBack = (): void => {
    setStep('CREDENTIALS');
    setOtpCode('');
    setError('');
    setChallengeToken('');
    setMfaSetup(null);
  };

  return (
    <div style={{ minHeight: '100vh', background: T.bg, display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: 20,
      fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@600;700&family=Source+Code+Pro:wght@400;500&family=Inter:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)} }
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.4} }
        input:focus { outline: none; }
      `}</style>

      <div style={{ width: '100%', maxWidth: 440,
        animation: 'fadeIn 0.4s ease forwards' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 64, height: 64, background: T.green, borderRadius: 16,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 30, marginBottom: 16, boxShadow: `0 8px 24px ${T.green}40` }}>
            ✈
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: T.text,
            fontFamily: T.display, letterSpacing: '0.1em' }}>SIGEA</div>
          <div style={{ fontSize: 11, color: T.textDim, letterSpacing: '0.2em',
            textTransform: 'uppercase', marginTop: 4 }}>
            Forces Aériennes du Cameroun
          </div>
        </div>

        <div style={{ background: T.card, borderRadius: 12, padding: '32px 36px',
          border: `1px solid ${T.border}`,
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>

          {/* ── ÉTAPE 1 : Identifiants ────────────────────────────────────── */}
          {step === 'CREDENTIALS' && (
            <>
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 4 }}>
                  Connexion
                </div>
                <div style={{ fontSize: 12, color: T.textDim }}>
                  Accès réservé au personnel autorisé FAC
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600,
                  color: T.textSub, marginBottom: 6, textTransform: 'uppercase',
                  letterSpacing: '0.08em' }}>Identifiant</label>
                <input value={login} onChange={e => setLogin(e.target.value)}
                  onKeyDown={handleKeyDown} autoFocus
                  placeholder="nom.prenom.base"
                  style={{ width: '100%', padding: '11px 14px', background: T.input,
                    border: `1px solid ${T.border}`, borderRadius: 8, color: T.text,
                    fontSize: 14, fontFamily: T.mono, transition: 'border-color 0.2s' }} />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600,
                  color: T.textSub, marginBottom: 6, textTransform: 'uppercase',
                  letterSpacing: '0.08em' }}>Mot de passe</label>
                <div style={{ position: 'relative' }}>
                  <input value={password} onChange={e => setPassword(e.target.value)}
                    onKeyDown={handleKeyDown}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••••••"
                    style={{ width: '100%', padding: '11px 44px 11px 14px', background: T.input,
                      border: `1px solid ${T.border}`, borderRadius: 8, color: T.text,
                      fontSize: 14, fontFamily: T.mono, transition: 'border-color 0.2s' }} />
                  <button onClick={() => setShowPassword(v => !v)}
                    style={{ position: 'absolute', right: 12, top: '50%',
                      transform: 'translateY(-50%)', background: 'none',
                      border: 'none', cursor: 'pointer', fontSize: 16,
                      color: T.textDim, padding: '2px 4px' }}>
                    {showPassword ? '🙈' : '👁'}
                  </button>
                </div>
              </div>

              {error && (
                <div style={{ padding: '10px 14px', background: T.redBg,
                  border: `1px solid ${T.redBorder}`, borderRadius: 6,
                  fontSize: 12, color: T.red, marginBottom: 16 }}>
                  {error}
                </div>
              )}

              <button onClick={handleLogin} disabled={loading || !login || !password}
                style={{ width: '100%', padding: '13px', background: (!login || !password) ? '#aaa' : T.green,
                  border: 'none', borderRadius: 8, color: '#fff', fontSize: 14,
                  fontWeight: 700, cursor: loading ? 'wait' : (!login || !password) ? 'not-allowed' : 'pointer',
                  letterSpacing: '0.05em', transition: 'all 0.2s',
                  opacity: (!login || !password) ? 0.6 : 1 }}>
                {loading ? '⏳ Vérification…' : 'Connexion →'}
              </button>
            </>
          )}

          {/* ── ÉTAPE 2a : Setup MFA (première connexion) ─────────────────── */}
          {step === 'MFA_SETUP' && mfaSetup && (
            <>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 4,
                  display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 20 }}>🔐</span>
                  Configuration MFA
                </div>
                <div style={{ fontSize: 12, color: T.textDim }}>
                  Première connexion — configurez votre authentificateur
                </div>
              </div>

              {/* Instructions */}
              <div style={{ padding: '12px 14px', background: T.amberBg,
                border: `1px solid ${T.amberBorder}`, borderRadius: 8, marginBottom: 20,
                fontSize: 12, color: T.amber, lineHeight: 1.7 }}>
                <strong>Étapes à suivre :</strong><br />
                1. Ouvrez <strong>Google Authenticator</strong>, <strong>Authy</strong> ou <strong>Microsoft Authenticator</strong><br />
                2. Scannez le QR code ci-dessous<br />
                3. Saisissez le code à 6 chiffres affiché
              </div>

              {/* QR Code */}
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <div style={{ display: 'inline-block', padding: 12, background: '#fff',
                  border: `2px solid ${T.border}`, borderRadius: 12,
                  boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
                  <img src={mfaSetup.qr_url} alt="QR Code MFA"
                    width={180} height={180}
                    style={{ display: 'block', borderRadius: 4 }}
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                </div>
              </div>

              {/* Secret manuel (fallback) */}
              <details style={{ marginBottom: 20 }}>
                <summary style={{ fontSize: 11, color: T.textDim, cursor: 'pointer',
                  textAlign: 'center', marginBottom: 8 }}>
                  Impossible de scanner ? Saisir le code manuellement
                </summary>
                <div style={{ padding: '10px 14px', background: '#f8f8f8',
                  border: `1px solid ${T.border}`, borderRadius: 6,
                  textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: T.textDim, marginBottom: 6 }}>
                    Clé secrète (Base32)
                  </div>
                  <div style={{ fontSize: 14, fontFamily: T.mono, fontWeight: 600,
                    color: T.text, letterSpacing: '0.15em', wordBreak: 'break-all' }}>
                    {mfaSetup.secret.match(/.{1,4}/g)?.join(' ')}
                  </div>
                  <div style={{ fontSize: 10, color: T.textDim, marginTop: 6 }}>
                    Type : TOTP · Algorithme : SHA-1 · Période : 30s · Digits : 6
                  </div>
                </div>
              </details>

              {/* Saisie OTP */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: T.textSub,
                  textAlign: 'center', marginBottom: 12, textTransform: 'uppercase',
                  letterSpacing: '0.08em' }}>
                  Code de confirmation
                </div>
                <OtpInput value={otpCode} onChange={setOtpCode} disabled={loading} />
              </div>

              {error && (
                <div style={{ padding: '10px 14px', background: T.redBg,
                  border: `1px solid ${T.redBorder}`, borderRadius: 6,
                  fontSize: 12, color: T.red, marginBottom: 16, textAlign: 'center' }}>
                  {error}
                </div>
              )}

              <button onClick={handleActivateOtp}
                disabled={loading || otpCode.length !== 6}
                style={{ width: '100%', padding: '13px',
                  background: otpCode.length === 6 ? T.green : '#aaa',
                  border: 'none', borderRadius: 8, color: '#fff', fontSize: 14,
                  fontWeight: 700, cursor: loading ? 'wait' : otpCode.length !== 6 ? 'not-allowed' : 'pointer',
                  opacity: otpCode.length !== 6 ? 0.6 : 1, marginBottom: 10 }}>
                {loading ? '⏳ Activation…' : '✓ Activer et accéder'}
              </button>

              <button onClick={goBack} style={{ width: '100%', padding: '10px',
                background: 'transparent', border: `1px solid ${T.border}`,
                borderRadius: 8, color: T.textDim, fontSize: 13, cursor: 'pointer' }}>
                ← Retour
              </button>
            </>
          )}

          {/* ── ÉTAPE 2b : Vérification MFA (connexions suivantes) ────────── */}
          {step === 'MFA_VERIFY' && (
            <>
              <div style={{ marginBottom: 24, textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 4 }}>
                  Vérification MFA
                </div>
                <div style={{ fontSize: 12, color: T.textDim, lineHeight: 1.6 }}>
                  Ouvrez votre application d'authentification<br />
                  et saisissez le code à 6 chiffres
                </div>
              </div>

              {/* Indicateur de temps */}
              <div style={{ marginBottom: 20, textAlign: 'center' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '5px 12px', background: T.greenBg,
                  border: `1px solid ${T.greenBorder}`, borderRadius: 20,
                  fontSize: 11, color: T.green }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%',
                    background: T.green, display: 'inline-block',
                    animation: 'pulse 1s infinite' }} />
                  Code valide 30 secondes
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <OtpInput value={otpCode} onChange={setOtpCode} disabled={loading} />
              </div>

              {error && (
                <div style={{ padding: '10px 14px', background: T.redBg,
                  border: `1px solid ${T.redBorder}`, borderRadius: 6,
                  fontSize: 12, color: T.red, marginBottom: 16, textAlign: 'center' }}>
                  {error}
                </div>
              )}

              <button onClick={handleVerifyOtp}
                disabled={loading || otpCode.length !== 6}
                style={{ width: '100%', padding: '13px',
                  background: otpCode.length === 6 ? T.green : '#aaa',
                  border: 'none', borderRadius: 8, color: '#fff', fontSize: 14,
                  fontWeight: 700, cursor: loading ? 'wait' : otpCode.length !== 6 ? 'not-allowed' : 'pointer',
                  opacity: otpCode.length !== 6 ? 0.6 : 1, marginBottom: 10 }}>
                {loading ? '⏳ Vérification…' : '→ Accéder'}
              </button>

              <button onClick={goBack} style={{ width: '100%', padding: '10px',
                background: 'transparent', border: `1px solid ${T.border}`,
                borderRadius: 8, color: T.textDim, fontSize: 13, cursor: 'pointer' }}>
                ← Utiliser un autre compte
              </button>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: T.textDim }}>
          SIGEA v1.0 · FAC/DSIC · Accès réservé
        </div>
      </div>
    </div>
  );
}