const CORS_HEADERS = {
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Origin': '*',
};

const STEP_TO_COSMIC_KM = 7.5;
const FALLBACK_DAILY_STEPS = 7842;
const WALKING_KM_PER_STEP = 0.00075;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const DESTINATIONS = [
  { name: '지구', routeName: 'EARTH ORBIT', distanceKm: 0 },
  { name: '달 궤도', routeName: 'LUNAR ROUTE', distanceKm: 384400 },
  { name: '화성 궤도', routeName: 'MARS ROUTE', distanceKm: 54600000 },
  { name: '소행성대', routeName: 'ASTEROID BELT', distanceKm: 329000000 },
  { name: '목성 항성', routeName: 'JUPITER ROUTE', distanceKm: 778500000 },
  { name: '토성 항성', routeName: 'SATURN ROUTE', distanceKm: 1433500000 },
  { name: '심우주', routeName: 'DEEP SPACE', distanceKm: 4500000000 },
];

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return json({ ok: true, service: 'astro-step-worker' });
    }

    if (url.pathname === '/journey' && request.method === 'POST') {
      try {
        const payload = await request.json();
        return json(calculateJourney(payload));
      } catch (error) {
        return json({ error: 'Invalid journey request payload.' }, 400);
      }
    }

    if (url.pathname === '/auth/signup' && request.method === 'POST') {
      return handleSignup(request, env);
    }

    if (url.pathname === '/auth/login' && request.method === 'POST') {
      return handleLogin(request, env);
    }

    if (url.pathname === '/auth/google' && request.method === 'POST') {
      return handleGoogleLogin(request, env);
    }

    return json({ error: 'Not found' }, 404);
  },
};

async function handleSignup(request, env) {
  const store = getAuthStore(env);

  if (!store) {
    return json({ error: 'Auth storage is not configured.' }, 500);
  }

  const payload = await readAuthPayload(request);
  const validationError = validateAuthPayload(payload);

  if (validationError) {
    return json({ error: validationError }, 400);
  }

  const email = normalizeEmail(payload.email);
  const existingUser = await store.get(userKey(email), 'json');

  if (existingUser) {
    return json({ error: '이미 가입된 이메일입니다.' }, 409);
  }

  const passwordHash = await hashPassword(payload.password);
  const user = {
    createdAt: new Date().toISOString(),
    email,
    id: crypto.randomUUID(),
    passwordHash,
  };

  await store.put(userKey(email), JSON.stringify(user));

  return createSessionResponse(store, user);
}

async function handleLogin(request, env) {
  const store = getAuthStore(env);

  if (!store) {
    return json({ error: 'Auth storage is not configured.' }, 500);
  }

  const payload = await readAuthPayload(request);
  const validationError = validateAuthPayload(payload);

  if (validationError) {
    return json({ error: validationError }, 400);
  }

  const email = normalizeEmail(payload.email);
  const user = await store.get(userKey(email), 'json');

  if (!user || !(await verifyPassword(payload.password, user.passwordHash))) {
    return json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' }, 401);
  }

  return createSessionResponse(store, user);
}

async function handleGoogleLogin(request, env) {
  try {
    const store = getAuthStore(env);

    if (!store) {
      return json({ error: 'Auth storage is not configured.' }, 500);
    }

    const payload = await readAuthPayload(request);
    const idToken = typeof payload?.idToken === 'string' ? payload.idToken.trim() : '';

    if (!idToken) {
      return json({ error: 'Google 인증 토큰이 필요합니다.' }, 400);
    }

    const googleProfile = await verifyGoogleIdToken(idToken, env);
    const googleKey = `google:${googleProfile.sub}`;
    const email = normalizeEmail(googleProfile.email);
    const existingGoogleUser = await store.get(googleKey, 'json');
    const existingEmailUser = await store.get(userKey(email), 'json');
    const user =
      existingGoogleUser ||
      existingEmailUser || {
        createdAt: new Date().toISOString(),
        email,
        id: crypto.randomUUID(),
        provider: 'google',
      };

    const nextUser = {
      ...user,
      email,
      googleSub: googleProfile.sub,
      name: googleProfile.name || user.name || '',
      picture: googleProfile.picture || user.picture || '',
      provider: user.provider || 'google',
      updatedAt: new Date().toISOString(),
    };

    await store.put(googleKey, JSON.stringify(nextUser));
    await store.put(userKey(email), JSON.stringify(nextUser));

    return createSessionResponse(store, nextUser);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Google 로그인에 실패했습니다.' }, 400);
  }
}

async function readAuthPayload(request) {
  try {
    return await request.json();
  } catch (error) {
    return {};
  }
}

function validateAuthPayload(payload) {
  const email = normalizeEmail(payload?.email);
  const password = typeof payload?.password === 'string' ? payload.password : '';

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return '올바른 이메일을 입력해주세요.';
  }

  if (password.length < 8) {
    return '비밀번호는 8자 이상이어야 합니다.';
  }

  return null;
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function userKey(email) {
  return `user:${email}`;
}

function getAuthStore(env) {
  return env.AUTH_STORE || env.AstroAuthStore || null;
}

async function verifyGoogleIdToken(idToken, env) {
  const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);

  if (!response.ok) {
    throw new Error('Google 토큰 검증에 실패했습니다.');
  }

  const profile = await response.json();
  const allowedAudiences = String(env.GOOGLE_CLIENT_IDS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (allowedAudiences.length === 0) {
    throw new Error('Google OAuth client ID is not configured on the Worker.');
  }

  if (!allowedAudiences.includes(profile.aud)) {
    throw new Error('허용되지 않은 Google OAuth 클라이언트입니다.');
  }

  if (!profile.sub || !profile.email) {
    throw new Error('Google 계정 정보를 확인할 수 없습니다.');
  }

  if (profile.email_verified !== 'true' && profile.email_verified !== true) {
    throw new Error('Google 이메일 인증이 필요합니다.');
  }

  return profile;
}

async function createSessionResponse(store, user) {
  const token = generateToken();
  const session = {
    createdAt: new Date().toISOString(),
    userId: user.id,
  };

  await store.put(`session:${token}`, JSON.stringify(session), { expirationTtl: 60 * 60 * 24 * 30 });

  return json({
    token,
    user: sanitizeUser(user),
  });
}

function sanitizeUser(user) {
  return {
    createdAt: user.createdAt,
    email: user.email,
    id: user.id,
    name: user.name || '',
    picture: user.picture || '',
  };
}

function generateToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function hashPassword(password) {
  const salt = generateToken();
  const hash = await derivePasswordHash(password, salt);
  return `pbkdf2:${salt}:${hash}`;
}

async function verifyPassword(password, storedHash) {
  const [scheme, salt, expectedHash] = String(storedHash || '').split(':');

  if (scheme !== 'pbkdf2' || !salt || !expectedHash) {
    return false;
  }

  const actualHash = await derivePasswordHash(password, salt);
  return timingSafeEqual(actualHash, expectedHash);
}

async function derivePasswordHash(password, saltHex) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    {
      hash: 'SHA-256',
      iterations: 150000,
      name: 'PBKDF2',
      salt: hexToBytes(saltHex),
    },
    key,
    256
  );

  return bytesToHex(new Uint8Array(bits));
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);

  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }

  return bytes;
}

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(left, right) {
  if (left.length !== right.length) {
    return false;
  }

  let result = 0;

  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return result === 0;
}

function calculateJourney(payload) {
  const birthDate = parseBirthDate(payload?.birthDate);
  const healthSummary = payload?.healthSummary;
  const healthTotalSteps = normalizeNumber(healthSummary?.totalSteps);
  const healthDailyAverageSteps = normalizeNumber(healthSummary?.dailyAverageSteps);
  const healthTotalDistanceMeters = normalizeNumber(healthSummary?.totalDistanceMeters);
  const todaySteps = normalizeNumber(healthSummary?.todaySteps) || FALLBACK_DAILY_STEPS;
  const daysAlive = birthDate ? Math.max(1, Math.floor((Date.now() - birthDate.getTime()) / ONE_DAY_MS)) : 0;
  const dailyAverageSteps = healthDailyAverageSteps || FALLBACK_DAILY_STEPS;
  const estimatedLifetimeSteps = daysAlive > 0 ? dailyAverageSteps * daysAlive : 8749123;
  const totalSteps = Math.round(Math.max(healthTotalSteps, estimatedLifetimeSteps));
  const walkingDistanceKm = Math.round(
    healthTotalDistanceMeters > 0 ? healthTotalDistanceMeters / 1000 : totalSteps * WALKING_KM_PER_STEP
  );
  const cosmicDistanceKm = Math.round(totalSteps * STEP_TO_COSMIC_KM);
  const current = resolveCurrentDestination(cosmicDistanceKm);
  const next = resolveNextDestination(cosmicDistanceKm, current.index);
  const progressPercent = calculateProgress(cosmicDistanceKm, current.destination.distanceKm, next.distanceKm);
  const remainingDistanceKm = Math.max(0, next.distanceKm - cosmicDistanceKm);
  const todayCosmicDistanceKm = Math.round(todaySteps * STEP_TO_COSMIC_KM);
  const estimatedDaysToNext = todayCosmicDistanceKm > 0 ? Math.ceil(remainingDistanceKm / todayCosmicDistanceKm) : null;

  return {
    birthDate: payload?.birthDate ?? null,
    cosmicDistanceKm,
    currentLocation: current.destination.name,
    dailyAverageSteps: Math.round(dailyAverageSteps),
    daysAlive,
    estimatedArrivalYears: estimatedDaysToNext === null ? null : Number((estimatedDaysToNext / 365).toFixed(1)),
    journeyPoints: DESTINATIONS.map((destination) => ({
      active: destination.name === current.destination.name,
      label: destination.name,
      progress: calculateOverallProgress(destination.distanceKm),
    })),
    nextDestination: next.name,
    progressPercent,
    remainingDistanceKm,
    routeName: current.destination.routeName,
    source: healthTotalSteps > 0 ? 'health-data-with-lifetime-estimate' : 'fallback-estimate',
    stepToCosmicKm: STEP_TO_COSMIC_KM,
    todayCosmicDistanceKm,
    todaySteps,
    totalSteps,
    walkingDistanceKm,
  };
}

function parseBirthDate(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const match = /^(\d{4})\.(\d{2})\.(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day));

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function resolveCurrentDestination(cosmicDistanceKm) {
  let index = 0;

  for (let i = 0; i < DESTINATIONS.length; i += 1) {
    if (cosmicDistanceKm >= DESTINATIONS[i].distanceKm) {
      index = i;
    }
  }

  return { destination: DESTINATIONS[index], index };
}

function resolveNextDestination(cosmicDistanceKm, currentIndex) {
  return DESTINATIONS.find((destination) => destination.distanceKm > cosmicDistanceKm) ?? DESTINATIONS[currentIndex];
}

function calculateProgress(cosmicDistanceKm, currentDistanceKm, nextDistanceKm) {
  if (nextDistanceKm <= currentDistanceKm) {
    return 100;
  }

  return Math.min(
    100,
    Math.max(0, Math.round(((cosmicDistanceKm - currentDistanceKm) / (nextDistanceKm - currentDistanceKm)) * 100))
  );
}

function calculateOverallProgress(distanceKm) {
  const finalDistanceKm = DESTINATIONS[DESTINATIONS.length - 1].distanceKm;
  return Math.round((distanceKm / finalDistanceKm) * 100);
}

function normalizeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json; charset=utf-8',
    },
    status,
  });
}
