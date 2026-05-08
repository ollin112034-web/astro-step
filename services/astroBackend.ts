import Constants from 'expo-constants';

import type { HealthStepSummary } from '@/services/health';

export type AstroJourneyPoint = {
  label: string;
  progress: number;
  active: boolean;
};

export type AstroJourneySummary = {
  birthDate: string | null;
  cosmicDistanceKm: number;
  currentLocation: string;
  dailyAverageSteps: number;
  daysAlive: number;
  estimatedArrivalYears: number | null;
  journeyPoints: AstroJourneyPoint[];
  nextDestination: string;
  progressPercent: number;
  remainingDistanceKm: number;
  routeName: string;
  source: 'health-data-with-lifetime-estimate' | 'fallback-estimate' | 'app-fallback';
  stepToCosmicKm: number;
  todayCosmicDistanceKm: number;
  todaySteps: number;
  totalSteps: number;
  walkingDistanceKm: number;
};

type CalculateJourneyInput = {
  birthDate: string;
  healthSummary: HealthStepSummary | null;
};

const STEP_TO_COSMIC_KM = 7.5;
const FALLBACK_DAILY_STEPS = 7842;
const WALKING_KM_PER_STEP = 0.00075;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const DEFAULT_API_URL = 'https://astro-step-app.astro-step.workers.dev';

const DESTINATIONS = [
  { name: '지구', routeName: 'EARTH ORBIT', distanceKm: 0 },
  { name: '달 궤도', routeName: 'LUNAR ROUTE', distanceKm: 384400 },
  { name: '화성 궤도', routeName: 'MARS ROUTE', distanceKm: 54600000 },
  { name: '소행성대', routeName: 'ASTEROID BELT', distanceKm: 329000000 },
  { name: '목성 항성', routeName: 'JUPITER ROUTE', distanceKm: 778500000 },
  { name: '토성 항성', routeName: 'SATURN ROUTE', distanceKm: 1433500000 },
  { name: '심우주', routeName: 'DEEP SPACE', distanceKm: 4500000000 },
];

export async function calculateAstroJourney({
  birthDate,
  healthSummary,
}: CalculateJourneyInput): Promise<AstroJourneySummary> {
  const apiUrl = getAstroApiUrl();

  if (!apiUrl) {
    return calculateFallbackJourney({ birthDate, healthSummary });
  }

  try {
    const response = await fetch(`${apiUrl}/journey`, {
      body: JSON.stringify({ birthDate, healthSummary: toBackendHealthSummary(healthSummary) }),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error(`Astro backend responded with ${response.status}`);
    }

    return (await response.json()) as AstroJourneySummary;
  } catch (error) {
    return calculateFallbackJourney({ birthDate, healthSummary });
  }
}

function toBackendHealthSummary(healthSummary: HealthStepSummary | null) {
  if (!healthSummary || healthSummary.status !== 'connected') {
    return null;
  }

  return {
    dailyAverageSteps: healthSummary.dailyAverageSteps,
    source: healthSummary.source,
    status: healthSummary.status,
    todaySteps: healthSummary.todaySteps,
    totalDistanceMeters: healthSummary.totalDistanceMeters,
    totalSteps: healthSummary.totalSteps,
  };
}

function getAstroApiUrl() {
  const extra = Constants.expoConfig?.extra as { astroApiUrl?: string } | undefined;
  const configuredUrl = process.env.EXPO_PUBLIC_ASTRO_API_URL || extra?.astroApiUrl || DEFAULT_API_URL;

  return configuredUrl.replace(/\/$/, '');
}

function calculateFallbackJourney({ birthDate, healthSummary }: CalculateJourneyInput): AstroJourneySummary {
  const parsedBirthDate = parseBirthDate(birthDate);
  const healthTotalSteps = normalizeNumber(healthSummary?.totalSteps);
  const dailyAverageSteps = normalizeNumber(healthSummary?.dailyAverageSteps) || FALLBACK_DAILY_STEPS;
  const daysAlive = parsedBirthDate ? Math.max(1, Math.floor((Date.now() - parsedBirthDate.getTime()) / ONE_DAY_MS)) : 0;
  const estimatedLifetimeSteps = daysAlive > 0 ? dailyAverageSteps * daysAlive : 8749123;
  const totalSteps = Math.round(Math.max(healthTotalSteps, estimatedLifetimeSteps));
  const todaySteps = normalizeNumber(healthSummary?.todaySteps) || FALLBACK_DAILY_STEPS;
  const walkingDistanceKm = Math.round(
    normalizeNumber(healthSummary?.totalDistanceMeters) > 0
      ? normalizeNumber(healthSummary?.totalDistanceMeters) / 1000
      : totalSteps * WALKING_KM_PER_STEP
  );
  const cosmicDistanceKm = Math.round(totalSteps * STEP_TO_COSMIC_KM);
  const current = resolveCurrentDestination(cosmicDistanceKm);
  const next = resolveNextDestination(cosmicDistanceKm, current.index);
  const remainingDistanceKm = Math.max(0, next.distanceKm - cosmicDistanceKm);
  const todayCosmicDistanceKm = Math.round(todaySteps * STEP_TO_COSMIC_KM);
  const estimatedDaysToNext = todayCosmicDistanceKm > 0 ? Math.ceil(remainingDistanceKm / todayCosmicDistanceKm) : null;

  return {
    birthDate,
    cosmicDistanceKm,
    currentLocation: current.destination.name,
    dailyAverageSteps: Math.round(dailyAverageSteps),
    daysAlive,
    estimatedArrivalYears: estimatedDaysToNext === null ? null : Number((estimatedDaysToNext / 365).toFixed(1)),
    journeyPoints: DESTINATIONS.map((destination) => ({
      active: destination.name === current.destination.name,
      label: destination.name,
      progress: Math.round((destination.distanceKm / DESTINATIONS[DESTINATIONS.length - 1].distanceKm) * 100),
    })),
    nextDestination: next.name,
    progressPercent: calculateProgress(cosmicDistanceKm, current.destination.distanceKm, next.distanceKm),
    remainingDistanceKm,
    routeName: current.destination.routeName,
    source: 'app-fallback',
    stepToCosmicKm: STEP_TO_COSMIC_KM,
    todayCosmicDistanceKm,
    todaySteps,
    totalSteps,
    walkingDistanceKm,
  };
}

function parseBirthDate(value: string) {
  const match = /^(\d{4})\.(\d{2})\.(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day));

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function resolveCurrentDestination(cosmicDistanceKm: number) {
  let index = 0;

  for (let i = 0; i < DESTINATIONS.length; i += 1) {
    if (cosmicDistanceKm >= DESTINATIONS[i].distanceKm) {
      index = i;
    }
  }

  return { destination: DESTINATIONS[index], index };
}

function resolveNextDestination(cosmicDistanceKm: number, currentIndex: number) {
  return DESTINATIONS.find((destination) => destination.distanceKm > cosmicDistanceKm) ?? DESTINATIONS[currentIndex];
}

function calculateProgress(cosmicDistanceKm: number, currentDistanceKm: number, nextDistanceKm: number) {
  if (nextDistanceKm <= currentDistanceKm) {
    return 100;
  }

  return Math.min(
    100,
    Math.max(0, Math.round(((cosmicDistanceKm - currentDistanceKm) / (nextDistanceKm - currentDistanceKm)) * 100))
  );
}

function normalizeNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}
