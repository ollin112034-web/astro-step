const CORS_HEADERS = {
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Origin': '*',
};

const STEP_TO_COSMIC_KM = 7.5;
const FALLBACK_DAILY_STEPS = 7842;
const WALKING_KM_PER_STEP = 0.00075;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const PASSWORD_HASH_ITERATIONS = 60000;

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

    if (url.pathname === '/privacy') {
      return html(PRIVACY_POLICY_HTML);
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
      return runAuthHandler(() => handleSignup(request, env));
    }

    if (url.pathname === '/auth/login' && request.method === 'POST') {
      return runAuthHandler(() => handleLogin(request, env));
    }

    if (url.pathname === '/auth/google' && request.method === 'POST') {
      return runAuthHandler(() => handleGoogleLogin(request, env));
    }

    return json({ error: 'Not found' }, 404);
  },
};

async function runAuthHandler(handler) {
  try {
    return await handler();
  } catch (error) {
    console.error('Auth handler failed', error);
    return json({ error: '인증 처리 중 서버 오류가 발생했습니다.' }, 500);
  }
}

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
      iterations: PASSWORD_HASH_ITERATIONS,
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

function html(body, status = 200) {
  return new Response(body, {
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'text/html; charset=utf-8',
    },
    status,
  });
}

const PRIVACY_POLICY_HTML = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Astro Step 개인정보처리방침</title>
  <style>
    :root { color-scheme: dark; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; background: #020204; color: #fff; line-height: 1.7; }
    main { box-sizing: border-box; margin: 0 auto; max-width: 760px; padding: 40px 22px 72px; }
    h1 { font-size: 30px; line-height: 1.25; margin: 0 0 8px; }
    h2 { font-size: 18px; margin: 30px 0 8px; }
    p, li { color: rgba(255,255,255,.76); font-size: 15px; }
    .meta { color: rgba(255,255,255,.54); font-size: 13px; margin-bottom: 28px; }
    .card { background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.16); border-radius: 18px; padding: 18px; }
    a { color: #dcd9ff; }
  </style>
</head>
<body>
  <main>
    <h1>Astro Step 개인정보처리방침</h1>
    <p class="meta">시행일: 2026년 5월 8일</p>
    <section class="card">
      <p>Astro Step은 사용자의 걸음 수를 우주 여행 거리로 환산하기 위해 필요한 최소한의 정보만 수집하고 사용합니다.</p>
    </section>

    <h2>1. 수집하는 정보</h2>
    <ul>
      <li>계정 정보: 이메일 주소, 로그인 제공자 정보</li>
      <li>사용자 입력 정보: 생년월일</li>
      <li>건강 데이터: 걸음 수, 이동 거리, 기간별 활동 요약</li>
      <li>서비스 운영 정보: 요청 시각, 오류 로그 등 서비스 안정성에 필요한 기술 정보</li>
    </ul>

    <h2>2. 이용 목적</h2>
    <p>수집한 정보는 회원가입 및 로그인, 누적 걸음 수 계산, 우주 거리 환산, 개인 여정 화면 제공, 서비스 오류 분석에 사용됩니다.</p>

    <h2>3. 건강 데이터 처리</h2>
    <p>건강 앱 연동은 사용자가 명시적으로 동의한 경우에만 수행됩니다. Astro Step은 걸음 수와 거리 계산에 필요한 데이터만 읽으며, 건강 앱에 데이터를 쓰지 않습니다.</p>

    <h2>4. 보관 기간</h2>
    <p>계정 정보와 서비스 이용 정보는 회원 탈퇴 또는 삭제 요청 시까지 보관합니다. 법령상 보관이 필요한 정보는 해당 기간 동안 별도 보관할 수 있습니다.</p>

    <h2>5. 제3자 제공</h2>
    <p>Astro Step은 사용자의 동의 없이 개인정보를 제3자에게 제공하지 않습니다. 다만 법령에 따른 요청이 있는 경우 예외가 있을 수 있습니다.</p>

    <h2>6. 문의</h2>
    <p>개인정보 관련 문의는 앱 운영자에게 문의해 주세요.</p>
  </main>
</body>
</html>`;
