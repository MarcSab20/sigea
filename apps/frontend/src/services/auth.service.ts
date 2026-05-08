import { api } from '@/lib/api';

export interface LoginResponse {
  challenge_token: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
}

export interface SetupOtpResponse {
  qr_code: string;
  secret: string;
}

export const authApi = {
  login: (login: string, password: string): Promise<LoginResponse> =>
    api.post<LoginResponse>('/auth/login', { login, password }).then(r => r.data),

  verifyOtp: (challenge_token: string, otp_code: string): Promise<TokenResponse> =>
    api.post<TokenResponse>('/auth/verify-otp', { challenge_token, otp_code }).then(r => r.data),

  setupOtp: (): Promise<SetupOtpResponse> =>
    api.post<SetupOtpResponse>('/auth/setup-otp').then(r => r.data),

  me: () => api.get('/auth/me').then(r => r.data),

  logout: () => api.post('/auth/logout'),
};