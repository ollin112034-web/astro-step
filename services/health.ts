import { Platform } from 'react-native';

export type HealthConnectionStatus = 'idle' | 'loading' | 'connected' | 'unsupported' | 'error';

export type HealthStepDay = {
  date: string;
  steps: number;
  distanceMeters: number;
};

export type HealthStepSummary = {
  source: 'apple-health' | 'android-health-connect' | 'unsupported';
  status: HealthConnectionStatus;
  todaySteps: number;
  totalSteps: number;
  dailyAverageSteps: number;
  totalDistanceMeters: number;
  days: HealthStepDay[];
  message: string;
};

type AppleHealthKitModule = typeof import('react-native-health').default;

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export async function requestHealthStepSummary(birthDate?: string): Promise<HealthStepSummary> {
  if (Platform.OS === 'ios') {
    return requestAppleHealthSummary(birthDate);
  }

  if (Platform.OS === 'android') {
    return requestAndroidHealthSummary(birthDate);
  }

  return unsupportedSummary('웹에서는 건강앱 연동을 사용할 수 없습니다.');
}

function getQueryStartDate(birthDate?: string) {
  const parsedBirthDate = parseBirthDate(birthDate);
  const oneYearAgo = new Date(Date.now() - 365 * ONE_DAY_MS);

  if (!parsedBirthDate) {
    return oneYearAgo;
  }

  return parsedBirthDate > oneYearAgo ? parsedBirthDate : oneYearAgo;
}

function parseBirthDate(birthDate?: string) {
  if (!birthDate) {
    return null;
  }

  const match = /^(\d{4})\.(\d{2})\.(\d{2})$/.exec(birthDate);

  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day));

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function requestAppleHealthSummary(birthDate?: string): Promise<HealthStepSummary> {
  let AppleHealthKit: AppleHealthKitModule;

  try {
    const healthModule = require('react-native-health') as { default?: AppleHealthKitModule } & AppleHealthKitModule;
    AppleHealthKit = healthModule.default ?? healthModule;
  } catch (error) {
    return unsupportedSummary('iOS 건강 앱 모듈을 불러오지 못했습니다. 개발 빌드에서 다시 실행해주세요.');
  }

  const isAvailable = await new Promise<boolean>((resolve) => {
    AppleHealthKit.isAvailable((_error: unknown, available: boolean) => resolve(Boolean(available)));
  });

  if (!isAvailable) {
    return unsupportedSummary('이 기기에서는 Apple HealthKit을 사용할 수 없습니다.');
  }

  const permissions = {
    permissions: {
      read: [
        AppleHealthKit.Constants.Permissions.StepCount,
        AppleHealthKit.Constants.Permissions.DistanceWalkingRunning,
      ],
      write: [],
    },
  };

  const permissionError = await new Promise<string | null>((resolve) => {
    AppleHealthKit.initHealthKit(permissions, (error: string) => resolve(error || null));
  });

  if (permissionError) {
    return errorSummary('apple-health', '건강 앱 권한을 받지 못했습니다. iOS 설정에서 권한을 확인해주세요.');
  }

  const startDate = getQueryStartDate(birthDate).toISOString();
  const endDate = new Date().toISOString();

  const stepSamples = await new Promise<Array<{ startDate: string; value: number }>>((resolve, reject) => {
    AppleHealthKit.getDailyStepCountSamples({ startDate, endDate }, (error: string, results) => {
      if (error) {
        reject(new Error(error));
        return;
      }

      resolve(results.map((sample) => ({ startDate: sample.startDate, value: Number(sample.value) || 0 })));
    });
  });

  const distanceSamples = await new Promise<Array<{ startDate: string; value: number }>>((resolve) => {
    AppleHealthKit.getDailyDistanceWalkingRunningSamples(
      { startDate, endDate, unit: AppleHealthKit.Constants.Units.meter },
      (_error: string, results) => {
        resolve(results.map((sample) => ({ startDate: sample.startDate, value: Number(sample.value) || 0 })));
      }
    );
  });

  return buildSummary({
    days: mergeAppleSamples(stepSamples, distanceSamples),
    message: 'iOS 건강 앱에서 걸음 데이터를 가져왔습니다.',
    source: 'apple-health',
  });
}

async function requestAndroidHealthSummary(birthDate?: string): Promise<HealthStepSummary> {
  try {
    const {
      initialize,
      requestPermission,
      readRecords,
    } = require('react-native-health-connect') as typeof import('react-native-health-connect');

    const initialized = await initialize();

    if (!initialized) {
      return unsupportedSummary('Health Connect를 초기화하지 못했습니다. Android 건강 앱 설치와 기기 지원 여부를 확인해주세요.');
    }

    const grantedPermissions = await requestPermission([
      { accessType: 'read', recordType: 'Steps' },
      { accessType: 'read', recordType: 'Distance' },
    ]);

    const canReadSteps = grantedPermissions.some(
      (permission) => permission.accessType === 'read' && permission.recordType === 'Steps'
    );

    if (!canReadSteps) {
      return errorSummary('android-health-connect', '걸음 수 권한을 받지 못했습니다. Android 건강 앱 권한을 확인해주세요.');
    }

    const startTime = getQueryStartDate(birthDate).toISOString();
    const endTime = new Date().toISOString();
    const timeRangeFilter = { operator: 'between' as const, startTime, endTime };
    const stepRecords = await readRecords('Steps', { timeRangeFilter });
    const distanceRecords = await readRecords('Distance', { timeRangeFilter });

    return buildSummary({
      days: mergeAndroidRecords(stepRecords.records, distanceRecords.records),
      message: 'Android 건강 앱에서 걸음 데이터를 가져왔습니다.',
      source: 'android-health-connect',
    });
  } catch (error) {
    return errorSummary(
      'android-health-connect',
      'Android 건강 앱 연동 중 오류가 발생했습니다. 개발 빌드와 Health Connect 설정을 확인해주세요.'
    );
  }
}

function mergeAppleSamples(
  stepSamples: Array<{ startDate: string; value: number }>,
  distanceSamples: Array<{ startDate: string; value: number }>
) {
  const daysByDate = new Map<string, HealthStepDay>();

  stepSamples.forEach((sample) => {
    const date = toDateKey(sample.startDate);
    const current = daysByDate.get(date) ?? { date, distanceMeters: 0, steps: 0 };
    current.steps += sample.value;
    daysByDate.set(date, current);
  });

  distanceSamples.forEach((sample) => {
    const date = toDateKey(sample.startDate);
    const current = daysByDate.get(date) ?? { date, distanceMeters: 0, steps: 0 };
    current.distanceMeters += sample.value;
    daysByDate.set(date, current);
  });

  return Array.from(daysByDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function mergeAndroidRecords(
  stepRecords: Array<{ count: number; startTime: string }>,
  distanceRecords: Array<{ distance?: { inMeters?: number }; startTime: string }>
) {
  const daysByDate = new Map<string, HealthStepDay>();

  stepRecords.forEach((record) => {
    const date = toDateKey(record.startTime);
    const current = daysByDate.get(date) ?? { date, distanceMeters: 0, steps: 0 };
    current.steps += Number(record.count) || 0;
    daysByDate.set(date, current);
  });

  distanceRecords.forEach((record) => {
    const date = toDateKey(record.startTime);
    const current = daysByDate.get(date) ?? { date, distanceMeters: 0, steps: 0 };
    current.distanceMeters += Number(record.distance?.inMeters) || 0;
    daysByDate.set(date, current);
  });

  return Array.from(daysByDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function buildSummary({
  days,
  message,
  source,
}: {
  days: HealthStepDay[];
  message: string;
  source: 'apple-health' | 'android-health-connect';
}): HealthStepSummary {
  const totalSteps = Math.round(days.reduce((sum, day) => sum + day.steps, 0));
  const totalDistanceMeters = Math.round(days.reduce((sum, day) => sum + day.distanceMeters, 0));
  const todayKey = toDateKey(new Date().toISOString());
  const todaySteps = Math.round(days.find((day) => day.date === todayKey)?.steps ?? 0);
  const activeDays = days.filter((day) => day.steps > 0).length || 1;

  return {
    dailyAverageSteps: Math.round(totalSteps / activeDays),
    days,
    message,
    source,
    status: 'connected',
    todaySteps,
    totalDistanceMeters,
    totalSteps,
  };
}

function unsupportedSummary(message: string): HealthStepSummary {
  return {
    dailyAverageSteps: 0,
    days: [],
    message,
    source: 'unsupported',
    status: 'unsupported',
    todaySteps: 0,
    totalDistanceMeters: 0,
    totalSteps: 0,
  };
}

function errorSummary(source: HealthStepSummary['source'], message: string): HealthStepSummary {
  return {
    ...unsupportedSummary(message),
    source,
    status: 'error',
  };
}

function toDateKey(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}
