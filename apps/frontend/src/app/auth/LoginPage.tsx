import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { api } from '@/lib/api';

type Step = 'FIRST_USE' | 'CREDENTIALS' | 'MFA_SETUP' | 'BACKUP_CODES' | 'MFA_VERIFY';

const C = {
  bg: '#F8F6F2', card: '#ffffff',
  anthracite: '#2b2f33', anthraciteSub: '#4b5157', anthraciteDim: '#7c828a',
  green: '#1f6e3d', greenBg: '#e3f1e8', greenBorder: '#9cc7ad',
  red: '#9b1c1c', redBg: '#fbe9e9', redBorder: '#e2a3a3',
  border: '#d9d4cc', input: '#fbfaf7',
  mono: "'Source Code Pro', monospace",
  display: "'Rajdhani', 'Arial Narrow', sans-serif",
};

const PWD_MIN = 14;
const BACKUP_SECONDS = 180;

function OtpInput({ value, onChange, disabled }: {
  value: string; onChange: (v: string) => void; disabled?: boolean;
}): React.ReactElement {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.split('').concat(Array(6).fill('')).slice(0, 6);
  const handle = (i: number, v: string): void => {
    const clean = v.replace(/\D/g, '').slice(-1);
    const next = [...digits]; next[i] = clean; onChange(next.join(''));
    if (clean && i < 5) inputs.current[i + 1]?.focus();
  };
  const key = (i: number, e: React.KeyboardEvent): void => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) inputs.current[i - 1]?.focus();
  };
  const paste = (e: React.ClipboardEvent): void => {
    e.preventDefault();
    const p = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    onChange(p); inputs.current[Math.min(p.length, 5)]?.focus();
  };
  return (
    <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
      {digits.map((d, i) => (
        <input key={i} ref={el => { inputs.current[i] = el; }}
          type="text" inputMode="numeric" maxLength={1} value={d} disabled={disabled}
          onChange={e => handle(i, e.target.value)} onKeyDown={e => key(i, e)}
          onPaste={paste} onFocus={e => e.target.select()}
          style={{
            width: 48, height: 56, textAlign: 'center', fontSize: 22, fontWeight: 700,
            fontFamily: C.mono, background: d ? C.greenBg : C.input,
            border: `2px solid ${d ? C.greenBorder : C.border}`, borderRadius: 6,
            color: C.anthracite, outline: 'none',
          }} />
      ))}
    </div>
  );
}

export default function LoginPage(): React.ReactElement {
  const navigate = useNavigate();
  const { setUser, setAccessToken } = useAuthStore();

  const [step, setStep] = useState<Step>('FIRST_USE');
  const [firstConnection, setFirstConnection] = useState(false);
  const [challengeToken, setChallengeToken] = useState('');
  const [mfaSetup, setMfaSetup] = useState<{ secret: string; qr_url: string } | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [backupCountdown, setBackupCountdown] = useState(BACKUP_SECONDS);
  const [pendingComplete, setPendingComplete] = useState<any>(null);

  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [useBackup, setUseBackup] = useState(false);
  const [backupInput, setBackupInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPwd, setShowPwd] = useState(false);

  useEffect(() => {
    if (step === 'MFA_SETUP' && otpCode.length === 6 && !loading) handleActivate();
    if (step === 'MFA_VERIFY' && !useBackup && otpCode.length === 6 && !loading) handleVerify();
  }, [otpCode]);

  useEffect(() => {
    if (step !== 'BACKUP_CODES') return;
    setBackupCountdown(BACKUP_SECONDS);
    const t = setInterval(() => {
      setBackupCountdown(s => {
        if (s <= 1) { clearInterval(t); finalize(pendingComplete); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [step]);

  const finalize = (data: any): void => {
    if (!data) return;
    setAccessToken(data.access_token);
    setUser(data.user);
    navigate('/', { replace: true });
  };

  const handleLogin = async (): Promise<void> => {
    if (!login || !password) { setError('Renseignez tous les champs'); return; }
    if (firstConnection && password.length < PWD_MIN) {
      setError(`Mot de passe : ${PWD_MIN} caractères minimum`); return;
    }
    setError(''); setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { login, password, first_connection: firstConnection });
      if (data.step === 'MFA_SETUP') { setChallengeToken(data.challenge_token); setMfaSetup(data.mfa_setup); setStep('MFA_SETUP'); }
      else if (data.step === 'MFA_VERIFY') { setChallengeToken(data.challenge_token); setStep('MFA_VERIFY'); }
      else finalize(data);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Authentification refusée');
    } finally { setLoading(false); }
  };

  const handleActivate = async (): Promise<void> => {
    if (otpCode.length !== 6) return;
    setError(''); setLoading(true);
    try {
      const { data } = await api.post('/auth/activate-otp', { challenge_token: challengeToken, otp_code: otpCode });
      setBackupCodes(data.backup_codes ?? []);
      setPendingComplete(data);
      setStep('BACKUP_CODES');
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Code OTP invalide'); setOtpCode('');
    } finally { setLoading(false); }
  };

  const handleVerify = async (): Promise<void> => {
    if (otpCode.length !== 6) return;
    setError(''); setLoading(true);
    try {
      const { data } = await api.post('/auth/verify-otp', { challenge_token: challengeToken, otp_code: otpCode });
      finalize(data);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Code OTP invalide ou expiré'); setOtpCode('');
    } finally { setLoading(false); }
  };

  const handleBackup = async (): Promise<void> => {
    if (!backupInput.trim()) return;
    setError(''); setLoading(true);
    try {
      const { data } = await api.post('/auth/verify-backup-code', { challenge_token: challengeToken, backup_code: backupInput });
      finalize(data);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Code de secours invalide');
    } finally { setLoading(false); }
  };

  const reset = (): void => {
    setStep('FIRST_USE'); setOtpCode(''); setError(''); setChallengeToken('');
    setMfaSetup(null); setUseBackup(false); setBackupInput('');
  };

  const errBox = error && (
    <div style={{ padding: '10px 14px', background: C.redBg, border: `1px solid ${C.redBorder}`,
      borderRadius: 6, fontSize: 12, color: C.red, marginBottom: 16, textAlign: 'center' }}>{error}</div>
  );

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: 20, fontFamily: "'Inter', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@600;700&family=Source+Code+Pro:wght@400;600&family=Inter:wght@400;500;600&display=swap');
        *{box-sizing:border-box}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>

      <div style={{ width: '100%', maxWidth: 460 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 60, height: 60, background: C.anthracite, borderRadius: 12,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
            color: '#fff', marginBottom: 14 }}>✈</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: C.anthracite, fontFamily: C.display,
            letterSpacing: '0.12em' }}>SIGEA</div>
          <div style={{ fontSize: 10, color: C.anthraciteDim, letterSpacing: '0.24em',
            textTransform: 'uppercase', marginTop: 4 }}>Accès compartimenté — FAC</div>
        </div>

        <div style={{ background: C.card, borderRadius: 10, padding: '30px 34px',
          border: `1px solid ${C.border}`, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>

          {step === 'FIRST_USE' && (
            <>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.anthracite, marginBottom: 6 }}>
                Vérification d'accès
              </div>
              <div style={{ fontSize: 13, color: C.anthraciteSub, marginBottom: 22, lineHeight: 1.6 }}>
                Est-ce votre première connexion sur cet appareil / ce poste ?
              </div>
              <button onClick={() => { setFirstConnection(true); setStep('CREDENTIALS'); }}
                style={{ width: '100%', padding: '14px', marginBottom: 12, background: C.greenBg,
                  border: `1px solid ${C.greenBorder}`, borderRadius: 8, color: C.green,
                  fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                Oui, c'est ma première connexion
              </button>
              <button onClick={() => { setFirstConnection(false); setStep('CREDENTIALS'); }}
                style={{ width: '100%', padding: '14px', background: C.input,
                  border: `1px solid ${C.border}`, borderRadius: 8, color: C.anthraciteSub,
                  fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                Non, ce n'est pas ma première connexion
              </button>
            </>
          )}

          {step === 'CREDENTIALS' && (
            <>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.anthracite, marginBottom: 4 }}>
                {firstConnection ? 'Enrôlement sécurisé' : 'Authentification'}
              </div>
              <div style={{ fontSize: 12, color: C.anthraciteDim, marginBottom: 22 }}>
                Accès réservé au personnel autorisé
              </div>
              <label style={lbl}>Identifiant</label>
              <input value={login} onChange={e => setLogin(e.target.value)} autoFocus
                placeholder="nom.prenom.base" style={inp} />
              <div style={{ height: 14 }} />
              <label style={lbl}>Mot de passe {firstConnection && <span style={{ color: C.anthraciteDim }}>(14 car. min.)</span>}</label>
              <div style={{ position: 'relative' }}>
                <input value={password} onChange={e => setPassword(e.target.value)}
                  type={showPwd ? 'text' : 'password'} placeholder="••••••••••••••"
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  style={{ ...inp, paddingRight: 42 }} />
                <button onClick={() => setShowPwd(v => !v)} style={{ position: 'absolute', right: 10,
                  top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none',
                  cursor: 'pointer', fontSize: 15 }}>{showPwd ? '🙈' : '👁'}</button>
              </div>
              <div style={{ height: 18 }} />
              {errBox}
              <button onClick={handleLogin} disabled={loading || !login || !password}
                style={btn(loading || !login || !password)}>
                {loading ? 'Vérification…' : firstConnection ? 'Démarrer l\'enrôlement →' : 'Connexion →'}
              </button>
              <button onClick={reset} style={linkBtn}>← Retour</button>
            </>
          )}

          {step === 'MFA_SETUP' && mfaSetup && (
            <>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.anthracite, marginBottom: 4 }}>🔐 Configuration MFA</div>
              <div style={{ fontSize: 12, color: C.anthraciteDim, marginBottom: 16 }}>Codes renouvelés toutes les 60 secondes</div>
              <div style={{ padding: '10px 12px', background: C.greenBg, border: `1px solid ${C.greenBorder}`,
                borderRadius: 8, fontSize: 11, color: C.green, marginBottom: 16, lineHeight: 1.6 }}>
                Utilisez une application honorant la période de 60 s : <strong>FreeOTP</strong>, <strong>Aegis</strong> ou <strong>Authy</strong>.
              </div>
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <img src={mfaSetup.qr_url} alt="QR MFA" width={200} height={200}
                  style={{ border: `2px solid ${C.border}`, borderRadius: 8, padding: 8, background: '#fff' }} />
              </div>
              <details style={{ marginBottom: 16 }}>
                <summary style={{ fontSize: 11, color: C.anthraciteDim, cursor: 'pointer', textAlign: 'center' }}>
                  Saisir la clé manuellement
                </summary>
                <div style={{ marginTop: 8, padding: 10, background: C.input, borderRadius: 6,
                  textAlign: 'center', fontFamily: C.mono, fontSize: 13, fontWeight: 600,
                  color: C.anthracite, letterSpacing: '0.12em', wordBreak: 'break-all' }}>
                  {mfaSetup.secret.match(/.{1,4}/g)?.join(' ')}
                </div>
              </details>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.anthraciteSub, textAlign: 'center',
                marginBottom: 12, textTransform: 'uppercase' }}>Code de confirmation</div>
              <OtpInput value={otpCode} onChange={setOtpCode} disabled={loading} />
              <div style={{ height: 16 }} />
              {errBox}
              <button onClick={handleActivate} disabled={loading || otpCode.length !== 6}
                style={btn(loading || otpCode.length !== 6)}>
                {loading ? 'Activation…' : '✓ Activer'}
              </button>
              <button onClick={reset} style={linkBtn}>← Annuler</button>
            </>
          )}

          {step === 'BACKUP_CODES' && (
            <>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.red, marginBottom: 6 }}>⚠ Codes de secours</div>
              <div style={{ padding: '12px 14px', background: C.redBg, border: `1px solid ${C.redBorder}`,
                borderRadius: 8, fontSize: 12, color: C.red, marginBottom: 16, lineHeight: 1.6 }}>
                Ces deux codes ne seront affichés qu'une seule et unique fois. Notez-les immédiatement
                et conservez-les en lieu sûr. Ils ne seront plus jamais affichés.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                {backupCodes.map((c, i) => (
                  <div key={i} style={{ padding: '12px 16px', background: C.input,
                    border: `1px dashed ${C.anthraciteDim}`, borderRadius: 6, textAlign: 'center',
                    fontFamily: C.mono, fontSize: 17, fontWeight: 600, letterSpacing: '0.1em',
                    color: C.anthracite }}>{c}</div>
                ))}
              </div>
              <div style={{ textAlign: 'center', fontSize: 12, color: C.anthraciteDim, marginBottom: 16 }}>
                Disparition automatique dans <strong style={{ color: C.red }}>{backupCountdown}s</strong>
              </div>
              <button onClick={() => finalize(pendingComplete)} style={btn(false)}>
                J'ai noté mes codes — Continuer
              </button>
            </>
          )}

          {step === 'MFA_VERIFY' && (
            <>
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <div style={{ fontSize: 34, marginBottom: 8 }}>🔒</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.anthracite }}>Vérification MFA</div>
                <div style={{ fontSize: 12, color: C.anthraciteDim, marginTop: 4 }}>
                  {useBackup ? 'Saisissez un code de secours' : 'Code à 6 chiffres (valide 60 s)'}
                </div>
              </div>
              {!useBackup ? (
                <OtpInput value={otpCode} onChange={setOtpCode} disabled={loading} />
              ) : (
                <input value={backupInput} onChange={e => setBackupInput(e.target.value.toUpperCase())}
                  placeholder="XXXXX-XXXXX-XXXXX-XXXXX" style={{ ...inp, textAlign: 'center',
                    fontFamily: C.mono, letterSpacing: '0.1em' }} />
              )}
              <div style={{ height: 16 }} />
              {errBox}
              <button onClick={useBackup ? handleBackup : handleVerify}
                disabled={loading || (!useBackup && otpCode.length !== 6) || (useBackup && !backupInput)}
                style={btn(loading || (!useBackup && otpCode.length !== 6) || (useBackup && !backupInput))}>
                {loading ? 'Vérification…' : '→ Accéder'}
              </button>
              <button onClick={() => { setUseBackup(v => !v); setError(''); setOtpCode(''); setBackupInput(''); }}
                style={linkBtn}>
                {useBackup ? 'Utiliser le code OTP' : 'Utiliser un code de secours'}
              </button>
              <button onClick={reset} style={{ ...linkBtn, marginTop: 4 }}>← Autre compte</button>
            </>
          )}
        </div>
        <div style={{ textAlign: 'center', marginTop: 18, fontSize: 10, color: C.anthraciteDim }}>
          SIGEA v1.0 · FAC/DSIC · Journalisation immuable SHA-256
        </div>
      </div>
    </div>
  );

  // styles inline réutilisés
}

const lbl: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600,
  color: '#4b5157', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' };
const inp: React.CSSProperties = { width: '100%', padding: '11px 14px', background: '#fbfaf7',
  border: '1px solid #d9d4cc', borderRadius: 8, color: '#2b2f33', fontSize: 14,
  fontFamily: "'Source Code Pro', monospace", outline: 'none' };
const btn = (disabled: boolean): React.CSSProperties => ({ width: '100%', padding: '13px',
  background: disabled ? '#b9b3a8' : '#1f6e3d', border: 'none', borderRadius: 8, color: '#fff',
  fontSize: 14, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', letterSpacing: '0.04em' });
const linkBtn: React.CSSProperties = { width: '100%', padding: '10px', marginTop: 10,
  background: 'transparent', border: 'none', color: '#7c828a', fontSize: 13, cursor: 'pointer' };