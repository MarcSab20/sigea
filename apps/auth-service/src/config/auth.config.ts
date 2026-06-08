import { registerAs } from '@nestjs/config';

export default registerAs('auth', () => ({
  bcryptRounds: 12,
  passwordMinLength: 14,
  passwordRotationDays: 90,
  passwordHistorySize: 5,
  sessionInactivityMinutes: 30,
  otpWindow: 1, 
}));
