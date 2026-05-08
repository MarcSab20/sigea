import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth.store';
import { authApi } from '@/services/auth.service';

type Step = 'credentials' | 'otp';

interface UseLoginReturn {
  step: Step;
  isLoading: boolean;
  challengeToken: string | null;
  submitCredentials: (login: string, password: string) => Promise<void>;
  submitOtp: (otp: string) => Promise<void>;
  backToCredentials: () => void;
}

export function useLogin(): UseLoginReturn {
  const navigate = useNavigate();
  const { setAccessToken, setUser } = useAuthStore();

  const [step, setStep] = useState<Step>('credentials');
  const [isLoading, setIsLoading] = useState(false);
  const [challengeToken, setChallengeToken] = useState<string | null>(null);

  const submitCredentials = async (login: string, password: string): Promise<void> => {
    setIsLoading(true);
    try {
      const { challenge_token } = await authApi.login(login, password);
      setChallengeToken(challenge_token);
      setStep('otp');
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401) {
        toast.error('Identifiants invalides');
      } else {
        toast.error('Erreur de connexion — réessayez');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const submitOtp = async (otp: string): Promise<void> => {
    if (!challengeToken) return;
    setIsLoading(true);
    try {
      const { access_token } = await authApi.verifyOtp(challengeToken, otp);
      setAccessToken(access_token);
      const user = await authApi.me();
      setUser(user);
      toast.success('Connexion établie');
      navigate('/', { replace: true });
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401) {
        toast.error('Code OTP invalide ou expiré');
      } else {
        toast.error('Erreur de vérification — réessayez');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const backToCredentials = (): void => {
    setStep('credentials');
    setChallengeToken(null);
  };

  return { step, isLoading, challengeToken, submitCredentials, submitOtp, backToCredentials };
}