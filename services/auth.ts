import Constants from 'expo-constants';

const DEFAULT_API_URL = 'https://astro-step-app.astro-step.workers.dev';

export type AuthUser = {
  id: string;
  email: string;
  createdAt: string;
};

export type AuthSession = {
  token: string;
  user: AuthUser;
};

type AuthResponse = AuthSession | { error: string };

export async function signUpWithEmail(email: string, password: string): Promise<AuthSession> {
  return requestAuth('/auth/signup', email, password);
}

export async function signInWithEmail(email: string, password: string): Promise<AuthSession> {
  return requestAuth('/auth/login', email, password);
}

async function requestAuth(path: string, email: string, password: string) {
  const response = await fetch(`${getAstroApiUrl()}${path}`, {
    body: JSON.stringify({ email, password }),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });
  const payload = (await response.json()) as AuthResponse;

  if (!response.ok || 'error' in payload) {
    throw new Error('error' in payload ? payload.error : '인증 요청에 실패했습니다.');
  }

  return payload;
}

function getAstroApiUrl() {
  const extra = Constants.expoConfig?.extra as { astroApiUrl?: string } | undefined;
  const configuredUrl = process.env.EXPO_PUBLIC_ASTRO_API_URL || extra?.astroApiUrl || DEFAULT_API_URL;

  return configuredUrl.replace(/\/$/, '');
}
