import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as Google from 'expo-auth-session/providers/google';
import { useNavigation } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  requestHealthStepSummary,
  type HealthConnectionStatus,
  type HealthStepSummary,
} from '@/services/health';
import {
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
  type AuthSession,
} from '@/services/auth';
import { calculateAstroJourney, type AstroJourneySummary } from '@/services/astroBackend';

WebBrowser.maybeCompleteAuthSession();

type Step = 'splash' | 'login' | 'privacy' | 'birthday' | 'calculating' | 'main';

const PRIVACY_POLICY_URL = 'https://astro-step-app.astro-step.workers.dev/privacy';
const shaderBackgroundSteps: Step[] = ['login', 'privacy', 'birthday', 'calculating'];

const journeyPoints = [
  { label: '지구', progress: 0, active: false },
  { label: '화성 궤도', progress: 15, active: false },
  { label: '소행성대', progress: 32, active: false },
  { label: '목성 항성', progress: 57, active: true },
  { label: '토성 항성', progress: 78, active: false },
  { label: '심우주', progress: 100, active: false },
];

const calculationSteps = [
  ['heart-outline', '건강 데이터 가져오기', 'iOS 건강 앱 / Android 건강 앱에서 걸음 데이터를 준비 중...'],
  ['stats-chart-outline', '데이터 통계 분석', '전체 걸음 수 및 일일 평균 걸음 수 계산 중...'],
  ['calculator-outline', '우주 거리로 환산', '1보 = 7.5km 기준으로 변환 중...'],
  ['rocket-outline', '나이 기반 보정 계산', '데이터가 없는 기간을 평균값으로 보정 중...'],
  ['planet-outline', '최종 거리 합산', '1세부터 현재까지의 전체 거리 합산 중...'],
  ['locate-outline', '현재 우주 위치 계산', '태양계 경로 상의 현재 위치를 찾고 있어요...'],
] as const;

const nearbyBodies = [
  ['이오', '1.2M km'],
  ['유로파', '2.1M km'],
  ['가니메데', '4.3M km'],
  ['칼리스토', '6.2M km'],
];

export default function HomeScreen() {
  const navigation = useNavigation();
  const calculationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [step, setStep] = useState<Step>('splash');
  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');
  const [day, setDay] = useState('');
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [healthStatus, setHealthStatus] = useState<HealthConnectionStatus>('idle');
  const [healthSummary, setHealthSummary] = useState<HealthStepSummary | null>(null);
  const [journeySummary, setJourneySummary] = useState<AstroJourneySummary | null>(null);

  const birthDate = [year, month, day].filter(Boolean).join('.');
  const canContinueBirthday = useMemo(
    () => /^\d{4}$/.test(year) && /^\d{2}$/.test(month) && /^\d{2}$/.test(day),
    [day, month, year]
  );

  useEffect(() => {
    navigation.setOptions({
      tabBarStyle:
        step === 'main'
          ? {
              backgroundColor: 'rgba(2,2,4,0.94)',
              borderColor: 'rgba(255,255,255,0.12)',
              borderTopWidth: 1,
              height: Platform.select({ ios: 84, default: 70 }),
            }
          : { display: 'none' },
    });
  }, [navigation, step]);

  useEffect(() => {
    if (step !== 'splash') {
      return;
    }

    const timer = setTimeout(() => setStep('login'), 1700);

    return () => clearTimeout(timer);
  }, [step]);

  useEffect(() => {
    return () => {
      if (calculationTimerRef.current) {
        clearTimeout(calculationTimerRef.current);
      }
    };
  }, []);

  const handleHealthConnect = async () => {
    setHealthStatus('loading');
    const summary = await requestHealthStepSummary();
    setHealthSummary(summary);
    setHealthStatus(summary.status);

    if (summary.status === 'connected') {
      setStep('birthday');
    }
  };

  const handleBirthdayNext = async () => {
    setStep('calculating');
    const startedAt = Date.now();
    let latestHealthSummary = healthSummary;

    if (healthSummary?.status === 'connected') {
      const refreshedSummary = await requestHealthStepSummary(birthDate);
      setHealthSummary(refreshedSummary);
      setHealthStatus(refreshedSummary.status);
      latestHealthSummary = refreshedSummary;
    }

    const calculatedJourney = await calculateAstroJourney({
      birthDate,
      healthSummary: latestHealthSummary,
    });
    const elapsedMs = Date.now() - startedAt;
    const remainingLoadingMs = Math.max(0, 1600 - elapsedMs);

    setJourneySummary(calculatedJourney);
    if (calculationTimerRef.current) {
      clearTimeout(calculationTimerRef.current);
    }
    calculationTimerRef.current = setTimeout(() => setStep('main'), remainingLoadingMs);
  };

  const handleCalculatingBack = () => {
    if (calculationTimerRef.current) {
      clearTimeout(calculationTimerRef.current);
      calculationTimerRef.current = null;
    }
    setStep('birthday');
  };

  return (
    <SpaceFrame plain={step === 'splash'} shader={shaderBackgroundSteps.includes(step)}>
      {step === 'splash' && <SplashScreen />}
      {step === 'login' && (
        <LoginScreen
          onAuthenticated={(session) => {
            setAuthSession(session);
            setStep('privacy');
          }}
        />
      )}
      {step === 'privacy' && (
        <PrivacyScreen
          healthStatus={healthStatus}
          healthSummary={healthSummary}
          onBack={() => setStep('login')}
          onConnect={handleHealthConnect}
          onSkip={() => setStep('birthday')}
        />
      )}
      {step === 'birthday' && (
        <BirthdayScreen
          canContinue={canContinueBirthday}
          day={day}
          month={month}
          onBack={() => setStep('privacy')}
          onChangeDay={setDay}
          onChangeMonth={setMonth}
          onChangeYear={setYear}
          onNext={handleBirthdayNext}
          year={year}
        />
      )}
      {step === 'calculating' && <CalculatingScreen onBack={handleCalculatingBack} />}
      {step === 'main' && (
        <MainScreen
          authSession={authSession}
          birthDate={birthDate}
          healthSummary={healthSummary}
          journeySummary={journeySummary}
          onRestart={() => setStep('login')}
        />
      )}
    </SpaceFrame>
  );
}

function SpaceFrame({
  children,
  plain = false,
  shader = false,
}: {
  children: ReactNode;
  plain?: boolean;
  shader?: boolean;
}) {
  return (
    <View style={styles.root}>
      {shader && <AnimatedShaderBackground />}
      {!plain && !shader && (
        <>
          <View style={styles.starField}>
            {Array.from({ length: 28 }).map((_, index) => (
              <View
                key={index}
                style={[
                  styles.star,
                  {
                    left: `${(index * 37) % 100}%`,
                    opacity: 0.18 + (index % 5) * 0.12,
                    top: `${(index * 53) % 100}%`,
                  },
                ]}
              />
            ))}
          </View>
          <View style={styles.orbitOne} />
          <View style={styles.orbitTwo} />
          <View style={styles.planetBack} />
        </>
      )}
      <SafeAreaView style={styles.safe}>{children}</SafeAreaView>
    </View>
  );
}

function AnimatedShaderBackground() {
  const motion = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const motionLoop = Animated.loop(
      Animated.timing(motion, {
        duration: 18000,
        easing: Easing.inOut(Easing.sin),
        toValue: 1,
        useNativeDriver: true,
      })
    );
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          duration: 5200,
          easing: Easing.inOut(Easing.quad),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          duration: 5200,
          easing: Easing.inOut(Easing.quad),
          toValue: 0,
          useNativeDriver: true,
        }),
      ])
    );

    motionLoop.start();
    pulseLoop.start();

    return () => {
      motionLoop.stop();
      pulseLoop.stop();
    };
  }, [motion, pulse]);

  const driftX = motion.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [-90, 80, -90],
  });
  const reverseDriftX = motion.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [100, -70, 100],
  });
  const driftY = motion.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [-42, 58, -42],
  });
  const glowScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.94, 1.08],
  });
  const glowOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 0.58],
  });

  return (
    <View pointerEvents="none" style={styles.shaderBackground}>
      <Animated.View
        style={[
          styles.shaderRibbon,
          styles.shaderRibbonOne,
          {
            opacity: glowOpacity,
            transform: [{ translateX: driftX }, { translateY: driftY }, { rotate: '-28deg' }, { scale: glowScale }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.shaderRibbon,
          styles.shaderRibbonTwo,
          {
            transform: [{ translateX: reverseDriftX }, { translateY: driftY }, { rotate: '31deg' }, { scale: glowScale }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.shaderGlow,
          {
            opacity: glowOpacity,
            transform: [{ translateX: reverseDriftX }, { scale: glowScale }],
          },
        ]}
      />
      <View style={styles.shaderVignette} />
      <View style={styles.shaderStars}>
        {Array.from({ length: 34 }).map((_, index) => (
          <View
            key={index}
            style={[
              styles.star,
              {
                height: index % 7 === 0 ? 3 : 2,
                left: `${(index * 29) % 100}%`,
                opacity: 0.16 + (index % 6) * 0.08,
                top: `${(index * 47) % 100}%`,
                width: index % 7 === 0 ? 3 : 2,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

function Logo({ compact = false, large = false }: { compact?: boolean; large?: boolean }) {
  return (
    <View style={large ? styles.logoLarge : compact ? styles.logoCompact : styles.logoBlock}>
      <Text style={large ? styles.logoTextLarge : compact ? styles.logoTextCompact : styles.logoText}>
        Astro Step
      </Text>
      <Text style={large ? styles.logoTaglineLarge : compact ? styles.logoTaglineCompact : styles.logoTagline}>
        YOUR STEPS, YOUR UNIVERSE
      </Text>
    </View>
  );
}

function getGoogleClientIds() {
  const extra = Constants.expoConfig?.extra as
    | {
        googleOAuthAndroidClientId?: string;
        googleOAuthIosClientId?: string;
        googleOAuthWebClientId?: string;
      }
    | undefined;

  return {
    androidClientId: extra?.googleOAuthAndroidClientId?.trim() ?? '',
    iosClientId: extra?.googleOAuthIosClientId?.trim() ?? '',
    webClientId: extra?.googleOAuthWebClientId?.trim() ?? '',
  };
}

function SplashScreen() {
  return (
    <View style={styles.splash}>
      <Image
        resizeMode="cover"
        source={require('../../reference-ui/0.타이틀이미지.png')}
        style={styles.splashImage}
      />
    </View>
  );
}

function LoginScreen({ onAuthenticated }: { onAuthenticated: (session: AuthSession) => void }) {
  const googleClientIds = getGoogleClientIds();
  const googleOAuthConfigured = Object.values(googleClientIds).some(Boolean);
  const [, googleResponse, promptGoogleAsync] = Google.useIdTokenAuthRequest({
    androidClientId: googleClientIds.androidClientId || undefined,
    clientId: googleClientIds.webClientId || googleClientIds.iosClientId || googleClientIds.androidClientId || 'missing-google-client-id',
    iosClientId: googleClientIds.iosClientId || undefined,
    selectAccount: true,
    webClientId: googleClientIds.webClientId || undefined,
  });
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [authStatus, setAuthStatus] = useState<'idle' | 'loading'>('idle');
  const [authMessage, setAuthMessage] = useState('');
  const isSignup = authMode === 'signup';
  const isLoading = authStatus === 'loading';

  useEffect(() => {
    const idToken = googleResponse?.type === 'success' ? googleResponse.params.id_token : null;

    if (!idToken) {
      return;
    }

    let cancelled = false;

    setAuthMessage('');
    setAuthStatus('loading');
    signInWithGoogle(idToken)
      .then((session) => {
        if (!cancelled) {
          onAuthenticated(session);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setAuthMessage(error instanceof Error ? error.message : 'Google 로그인에 실패했습니다.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setAuthStatus('idle');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [googleResponse, onAuthenticated]);

  const handleEmailAuth = async () => {
    setAuthMessage('');

    if (isSignup && password !== confirmPassword) {
      setAuthMessage('비밀번호가 일치하지 않습니다.');
      return;
    }

    setAuthStatus('loading');

    try {
      const session = isSignup
        ? await signUpWithEmail(email, password)
        : await signInWithEmail(email, password);
      onAuthenticated(session);
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : '인증 요청에 실패했습니다.');
    } finally {
      setAuthStatus('idle');
    }
  };

  const handleGoogleAuth = async () => {
    setAuthMessage('');

    if (!googleOAuthConfigured) {
      setAuthMessage('Google OAuth 클라이언트 ID 설정이 필요합니다.');
      return;
    }

    try {
      await promptGoogleAsync();
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : 'Google 로그인 창을 열 수 없습니다.');
    }
  };

  return (
    <CenteredPanel panelStyle={styles.loginGlassPanel}>
      <View style={styles.loginHeader}>
        <View style={styles.loginTitleGroup}>
          <View style={styles.loginLogoWrap}>
            <Logo large />
          </View>
          <Text style={styles.loginTitle}>{isSignup ? '회원가입' : '계정 로그인'}</Text>
          <Text style={styles.loginDescription}>
            {isSignup ? '새 계정을 만들어 우주여행을 시작하세요.' : '계정으로 로그인하여\n우주여행을 시작하세요.'}
          </Text>
        </View>
      </View>

      <View style={styles.loginForm}>
        <View style={styles.loginField}>
          <View style={styles.passwordHeader}>
            <Text style={styles.fieldLabel}>이메일</Text>
            <Pressable disabled={isLoading} onPress={() => setAuthMode(isSignup ? 'login' : 'signup')}>
              <Text style={styles.signupLinkText}>{isSignup ? '로그인' : '회원가입'}</Text>
            </Pressable>
          </View>
          <TextInput
            autoCapitalize="none"
            editable={!isLoading}
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="m@example.com"
            placeholderTextColor="rgba(255,255,255,0.36)"
            style={styles.textInputGlass}
            value={email}
          />
        </View>

        <View style={styles.loginField}>
          <View style={styles.passwordHeader}>
            <Text style={styles.fieldLabel}>비밀번호</Text>
            <Pressable>
              <Text style={styles.forgotPasswordText}>비밀번호 찾기</Text>
            </Pressable>
          </View>
          <TextInput
            editable={!isLoading}
            onChangeText={setPassword}
            placeholder="8자 이상"
            placeholderTextColor="rgba(255,255,255,0.36)"
            secureTextEntry
            style={styles.textInputGlass}
            value={password}
          />
        </View>
        {isSignup && (
          <View style={styles.loginField}>
            <Text style={styles.fieldLabel}>비밀번호 확인</Text>
            <TextInput
              editable={!isLoading}
              onChangeText={setConfirmPassword}
              placeholder="비밀번호를 다시 입력"
              placeholderTextColor="rgba(255,255,255,0.36)"
              secureTextEntry
              style={styles.textInputGlass}
              value={confirmPassword}
            />
          </View>
        )}
      </View>

      {authMessage ? <Text style={styles.authMessage}>{authMessage}</Text> : null}

      <Pressable
        disabled={isLoading}
        onPress={handleEmailAuth}
        style={({ pressed }) => [styles.loginButton, isLoading && styles.disabledButton, pressed && !isLoading && styles.pressed]}>
        {isLoading ? (
          <ActivityIndicator color="#09090B" />
        ) : (
          <Text style={styles.loginButtonText}>{isSignup ? '회원가입' : '로그인'}</Text>
        )}
      </Pressable>

      <AuthButton icon="logo-google" label="Google 계정으로 로그인" onPress={handleGoogleAuth} />
      <AuthButton icon="logo-apple" label="Apple 계정으로 로그인" onPress={() => setAuthMessage('Apple 로그인은 아직 준비 중입니다.')} />
    </CenteredPanel>
  );
}

function PrivacyScreen({
  healthStatus,
  healthSummary,
  onBack,
  onConnect,
  onSkip,
}: {
  healthStatus: HealthConnectionStatus;
  healthSummary: HealthStepSummary | null;
  onBack: () => void;
  onConnect: () => void;
  onSkip: () => void;
}) {
  const isLoading = healthStatus === 'loading';
  const isConnected = healthStatus === 'connected';

  return (
    <CenteredPanel>
      <PanelBackHeader label="로그인 화면으로 돌아가기" onBack={onBack} />
      <View style={styles.healthIconWrap}>
        <View style={styles.healthIcon}>
          <Ionicons name="heart" size={34} color="#ff3b65" />
        </View>
      </View>
      <Text style={styles.panelTitle}>개인정보 동의</Text>
      <Text style={styles.panelCopy}>
        Astro Step은 이메일, 생년월일, 걸음 수를 우주 여행 거리 계산에만 사용합니다.
      </Text>
      <View style={styles.policySummaryCard}>
        <PolicyItem number="1" title="수집 항목">
          이메일, 생년월일, 걸음 수 및 거리 데이터
        </PolicyItem>
        <PolicyItem number="2" title="이용 목적">
          누적 걸음 수를 우주 거리로 환산하고 개인 여정을 계산합니다.
        </PolicyItem>
        <PolicyItem number="3" title="보호 원칙">
          동의 없이 제3자에게 개인정보를 제공하지 않습니다.
        </PolicyItem>
        <Pressable
          onPress={() => WebBrowser.openBrowserAsync(PRIVACY_POLICY_URL)}
          style={({ pressed }) => [styles.policyLinkButton, pressed && styles.pressed]}>
          <Text style={styles.policyLinkText}>개인정보처리방침 전문 보기</Text>
          <Ionicons name="open-outline" size={18} color="#DCD9FF" />
        </Pressable>
      </View>
      <View style={styles.permissionCard}>
        <Text style={styles.permissionTitle}>건강 앱 연동 데이터</Text>
        <PermissionRow icon="footsteps-outline" title="걸음 수" copy="일일 걸음 수 및 전체 걸음 수" />
        <PermissionRow icon="bar-chart-outline" title="거리 데이터" copy="걷기 거리 계산에 필요한 데이터" />
      </View>
      <View style={styles.safeDataCard}>
        <Ionicons
          name={isConnected ? 'checkmark-circle-outline' : 'shield-checkmark-outline'}
          size={30}
          color="#A9A7FF"
        />
        <View style={styles.safeDataText}>
          <Text style={styles.safeDataTitle}>{isConnected ? '건강 앱 연결 완료' : '데이터는 안전하게 보호돼요'}</Text>
          <Text style={styles.safeDataCopy}>
            {healthSummary?.message ?? 'iOS 건강 앱과 Android 건강 앱에서 걸음 수만 읽어옵니다.'}
          </Text>
        </View>
        <Ionicons name="lock-closed-outline" size={20} color="rgba(255,255,255,0.55)" />
      </View>
      {isConnected && healthSummary ? (
        <View style={styles.healthResultCard}>
          <Text style={styles.healthResultLabel}>가져온 걸음 수</Text>
          <Text style={styles.healthResultValue}>{formatNumber(healthSummary.totalSteps)} 걸음</Text>
          <Text style={styles.healthResultCopy}>
            오늘 {formatNumber(healthSummary.todaySteps)} 걸음 · 일 평균{' '}
            {formatNumber(healthSummary.dailyAverageSteps)} 걸음
          </Text>
        </View>
      ) : null}
      <PrimaryButton
        disabled={isLoading}
        label={isLoading ? '연결 중' : isConnected ? '다음' : '동의하고 건강 앱 연결하기'}
        onPress={isConnected ? onSkip : onConnect}
      />
      <Pressable onPress={onSkip} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
        <Text style={styles.secondaryButtonText}>건강 앱 없이 계속하기</Text>
      </Pressable>
    </CenteredPanel>
  );
}

function BirthdayScreen({
  canContinue,
  day,
  month,
  onBack,
  onChangeDay,
  onChangeMonth,
  onChangeYear,
  onNext,
  year,
}: {
  canContinue: boolean;
  day: string;
  month: string;
  onBack: () => void;
  onChangeDay: (value: string) => void;
  onChangeMonth: (value: string) => void;
  onChangeYear: (value: string) => void;
  onNext: () => void;
  year: string;
}) {
  return (
    <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: undefined })} style={styles.flex}>
      <Pressable
        accessibilityLabel="건강 앱 연동 화면으로 돌아가기"
        onPress={onBack}
        style={({ pressed }) => [styles.floatingBackButton, pressed && styles.pressed]}>
        <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
      </Pressable>
      <ScrollView contentContainerStyle={styles.birthdayContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.topStar}>✦</Text>
        <Text style={styles.birthdayTitle}>지구에서{'\n'}여행을 시작한 지{'\n'}얼마나 되었나요?</Text>
        <Text style={styles.birthdayCopy}>정확한 여정 계산을 위해{'\n'}생년월일을 입력해주세요.</Text>
        <View style={styles.earthGlow} />
        <View style={styles.birthdayPanel}>
          <Ionicons name="calendar-outline" size={42} color="#D8D4FF" />
          <Text style={styles.birthdayPanelTitle}>생년월일 입력</Text>
          <View style={styles.birthInputRow}>
            <DateInput label="년" maxLength={4} onChange={onChangeYear} placeholder="YYYY" value={year} />
            <Text style={styles.dateDot}>:</Text>
            <DateInput label="월" maxLength={2} onChange={onChangeMonth} placeholder="MM" value={month} />
            <Text style={styles.dateDot}>:</Text>
            <DateInput label="일" maxLength={2} onChange={onChangeDay} placeholder="DD" value={day} />
          </View>
          <PrimaryButton disabled={!canContinue} label="다음" onPress={onNext} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function CalculatingScreen({ onBack }: { onBack: () => void }) {
  return (
    <ScrollView contentContainerStyle={styles.calculatingContent} showsVerticalScrollIndicator={false}>
      <GlassPanel style={styles.calculatingPanel}>
        <PanelBackHeader label="생년월일 입력 화면으로 돌아가기" onBack={onBack} />
        <Text style={styles.topStar}>✦</Text>
        <Text style={styles.calculatingTitle}>우주 여행 경로를 계산 중입니다</Text>
        <Text style={styles.calculatingCopy}>잠시만 기다려주세요. 정확한 계산을 위해 데이터를 분석하고 있습니다.</Text>
        <View style={styles.timeline}>
          {calculationSteps.map(([icon, title, copy], index) => (
            <View key={title} style={styles.timelineItem}>
              <View style={[styles.timelineIcon, index < 2 && styles.timelineIconDone]}>
                <Ionicons name={icon} size={24} color={index < 3 ? '#D9D6FF' : 'rgba(255,255,255,0.38)'} />
              </View>
              <View style={styles.timelineText}>
                <Text style={[styles.timelineTitle, index > 2 && styles.timelineDim]}>{index + 1}. {title}</Text>
                <Text style={[styles.timelineCopy, index > 2 && styles.timelineDim]}>{copy}</Text>
              </View>
              {index < 2 ? (
                <Ionicons name="checkmark-circle" size={24} color="#D9D6FF" />
              ) : index === 2 ? (
                <ActivityIndicator color="#D9D6FF" />
              ) : (
                <View style={styles.timelineDot} />
              )}
            </View>
          ))}
        </View>
        <View style={styles.astronautScene}>
          <View style={styles.moonGround} />
          <Ionicons name="walk-outline" size={62} color="#FFFFFF" />
        </View>
        <View style={styles.progressRow}>
          <View style={styles.progressTrack}>
            <View style={styles.progressFill} />
          </View>
          <Text style={styles.progressPercent}>67%</Text>
        </View>
        <Text style={styles.tip}>✦ TIP  한 걸음 한 걸음이 우주로 향하는 여정이 됩니다.</Text>
      </GlassPanel>
    </ScrollView>
  );
}

function MainScreen({
  authSession,
  birthDate,
  healthSummary,
  journeySummary,
  onRestart,
}: {
  authSession: AuthSession | null;
  birthDate: string;
  healthSummary: HealthStepSummary | null;
  journeySummary: AstroJourneySummary | null;
  onRestart: () => void;
}) {
  const hasHealthData = healthSummary?.status === 'connected';
  const totalSteps = journeySummary?.totalSteps || healthSummary?.totalSteps || 8749123;
  const todaySteps = journeySummary?.todaySteps || healthSummary?.todaySteps || 7842;
  const walkingDistanceKm = journeySummary?.walkingDistanceKm || Math.round((healthSummary?.totalDistanceMeters || 65618000) / 1000);
  const cosmicDistanceKm = journeySummary?.cosmicDistanceKm || totalSteps * 7.5;
  const todayCosmicDistanceKm = journeySummary?.todayCosmicDistanceKm || todaySteps * 7.5;
  const activeJourneyPoints = journeySummary?.journeyPoints ?? journeyPoints;
  const resolvedMissionStats = [
    { icon: 'footsteps-outline', label: '총 걸음 수', value: formatNumber(totalSteps), unit: '걸음' },
    { icon: 'git-branch-outline', label: '총 이동 거리', value: formatNumber(walkingDistanceKm), unit: 'km' },
    { icon: 'rocket-outline', label: '우주 여행 거리', value: formatNumber(Math.round(cosmicDistanceKm)), unit: 'km' },
    { icon: 'time-outline', label: '일일 평균', value: formatNumber(journeySummary?.dailyAverageSteps || healthSummary?.dailyAverageSteps || 7842), unit: '걸음' },
  ] as const;

  return (
    <ScrollView contentContainerStyle={styles.mainContent} showsVerticalScrollIndicator={false}>
      <View style={styles.appHeader}>
        <Ionicons name="menu" size={30} color="#FFFFFF" />
        <Logo compact />
        <Pressable accessibilityLabel="온보딩 다시 시작" onPress={onRestart} style={styles.bellWrap}>
          <Ionicons name="notifications-outline" size={27} color="#FFFFFF" />
          <View style={styles.noticeDot} />
        </Pressable>
      </View>

      <View style={styles.heroSection}>
        <View style={styles.jupiter} />
        <View style={styles.asteroidOne} />
        <View style={styles.asteroidTwo} />
        <Text style={styles.heroSmall}>현재 우주 위치</Text>
        <Text style={styles.heroTitle}>{journeySummary?.currentLocation ?? '목성 항성'}</Text>
        <Text style={styles.heroSub}>{journeySummary?.routeName ?? 'JUPITER ROUTE'}</Text>
        <Text style={styles.heroPercent}>{journeySummary?.progressPercent ?? 57}%</Text>
        <Text style={styles.heroCopy}>
          {journeySummary
            ? `${journeySummary.nextDestination}까지 ${journeySummary.progressPercent}% 접근 중`
            : '목성까지 57% 접근 중'}
        </Text>
        <Pressable style={({ pressed }) => [styles.shareButton, pressed && styles.pressed]}>
          <Ionicons name="share-social-outline" size={18} color="#FFFFFF" />
          <Text style={styles.shareText}>위치 공유하기</Text>
        </Pressable>
      </View>

      <View style={styles.routeRow}>
        {activeJourneyPoints.map((point) => (
          <View key={point.label} style={styles.routePoint}>
            <View style={[styles.routePlanet, point.active && styles.routePlanetActive]}>
              <View style={[styles.routePlanetCore, point.active && styles.routePlanetCoreActive]} />
            </View>
            <Text style={[styles.routeLabel, point.active && styles.routeLabelActive]}>{point.label}</Text>
            <Text style={[styles.routeProgress, point.active && styles.routeLabelActive]}>{point.progress}%</Text>
          </View>
        ))}
      </View>

      <GlassPanel style={styles.statsPanel}>
        <View style={styles.statsGrid}>
          {resolvedMissionStats.map((stat) => (
            <View key={stat.label} style={styles.statCell}>
              <Text style={styles.statLabel}>{stat.label}</Text>
              <Text style={styles.statValue}>{stat.value}<Text style={styles.statUnit}> {stat.unit}</Text></Text>
              <Ionicons name={stat.icon} size={24} color="rgba(255,255,255,0.55)" />
            </View>
          ))}
        </View>
        <View style={styles.formulaBar}>
          <Text style={styles.formulaAccent}>1 걸음 = 7.5 km</Text>
          <Text style={styles.formulaDivider}>|</Text>
          <Text style={styles.formulaText}>우주선 평균 속도로 환산한 거리입니다.</Text>
          <Ionicons name="information-circle-outline" size={18} color="rgba(255,255,255,0.55)" />
        </View>
      </GlassPanel>

      <View style={styles.cardRow}>
        <GlassPanel style={styles.halfCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>오늘의 미션</Text>
            <Ionicons name="chevron-forward" size={22} color="#FFFFFF" />
          </View>
          <View style={styles.ringProgress}>
            <Text style={styles.ringNumber}>{formatNumber(todaySteps)}</Text>
            <Text style={styles.ringCopy}>/ 10,000 걸음</Text>
          </View>
          <Text style={styles.missionCopy}>오늘 이동 거리 {formatNumber(Math.round(todaySteps * 0.00075))} km</Text>
          <Text style={styles.missionCopy}>우주 여행 거리 {formatNumber(Math.round(todayCosmicDistanceKm))} km</Text>
          <Text style={styles.cardFoot}>✦ 오늘도 우주 한 걸음 더!</Text>
        </GlassPanel>
        <GlassPanel style={styles.halfCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>이번 주 여정</Text>
            <Ionicons name="chevron-forward" size={22} color="#FFFFFF" />
          </View>
          <View style={styles.chart}>
            {[6200, 8300, 6100, 7600, 12400, 9600, 7842].map((value, index) => (
              <View key={index} style={styles.chartColumn}>
                <View style={[styles.chartBar, { height: 38 + (value / 15000) * 82 }]} />
                <Text style={styles.chartLabel}>{['월', '화', '수', '목', '금', '토', '오늘'][index]}</Text>
              </View>
            ))}
          </View>
        </GlassPanel>
      </View>

      <GlassPanel style={styles.nextGoal}>
        <View>
          <Text style={styles.cardTitle}>다음 목표</Text>
          <Text style={styles.nextGoalTitle}>{journeySummary?.nextDestination ?? '토성 항성'}</Text>
          <Text style={styles.nextGoalCopy}>{journeySummary?.progressPercent ?? 78}% 까지</Text>
          <Text style={styles.remainingPercent}>
            {100 - (journeySummary?.progressPercent ?? 79)}% <Text style={styles.remainingCopy}>남았어요!</Text>
          </Text>
        </View>
        <View style={styles.saturnMini}>
          <View style={styles.saturnRingMain} />
        </View>
        <View>
          <Text style={styles.nextGoalCopy}>남은 거리</Text>
          <Text style={styles.nextDistance}>
            {formatNumber(journeySummary?.remainingDistanceKm ?? 2749863)} km
          </Text>
          <Text style={styles.nextGoalCopy}>예상 도달 시간</Text>
          <Text style={styles.nextDistance}>
            {journeySummary?.estimatedArrivalYears === null || journeySummary?.estimatedArrivalYears === undefined
              ? '확인 필요'
              : `${journeySummary.estimatedArrivalYears}년 후`}
          </Text>
        </View>
      </GlassPanel>

      <GlassPanel style={styles.nearbyPanel}>
        <Text style={styles.cardTitle}>근처 천체</Text>
        <View style={styles.nearbyRow}>
          {nearbyBodies.map(([name, distance], index) => (
            <View key={name} style={styles.nearbyBody}>
              <View style={[styles.nearbyMoon, index === 2 && styles.nearbyMoonActive]} />
              <Text style={[styles.routeLabel, index === 2 && styles.routeLabelActive]}>{name}</Text>
              <Text style={styles.nearbyDistance}>거리 {distance}</Text>
            </View>
          ))}
        </View>
      </GlassPanel>

      <GlassPanel style={styles.originPanel}>
        <Text style={styles.originText}>계정: {authSession?.user.email ?? '확인 필요'}</Text>
        <Text style={styles.originText}>출생 기준점: {birthDate || '확인 필요'}</Text>
        <Text style={styles.originText}>
          Health 연동: {hasHealthData ? healthSummary.message : '건강 앱 데이터 없이 데모 값 표시 중'}
        </Text>
        <Text style={styles.originText}>
          백엔드 계산: {journeySummary ? (journeySummary.source === 'app-fallback' ? 'Worker 연결 실패, 앱 보정값 사용' : 'Cloudflare Worker 사용') : '확인 필요'}
        </Text>
      </GlassPanel>
    </ScrollView>
  );
}

function CenteredPanel({ children, panelStyle }: { children: ReactNode; panelStyle?: object }) {
  return (
    <ScrollView contentContainerStyle={styles.centeredContent} showsVerticalScrollIndicator={false}>
      <GlassPanel style={[styles.centeredPanel, panelStyle]}>{children}</GlassPanel>
    </ScrollView>
  );
}

function PanelBackHeader({ label, onBack }: { label: string; onBack: () => void }) {
  return (
    <View style={styles.panelBackHeader}>
      <Pressable
        accessibilityLabel={label}
        onPress={onBack}
        style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
        <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
      </Pressable>
      <View style={styles.headerSpacer} />
    </View>
  );
}

function GlassPanel({ children, style }: { children: ReactNode; style?: object | object[] }) {
  return <View style={[styles.glass, style]}>{children}</View>;
}

function AuthButton({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.authButton, pressed && styles.pressed]}>
      <Ionicons name={icon} size={28} color="#FFFFFF" />
      <Text style={styles.authButtonText}>{label}</Text>
      <Ionicons name="chevron-forward" size={24} color="#FFFFFF" />
    </Pressable>
  );
}

function PrimaryButton({ disabled, label, onPress }: { disabled?: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.primaryButton, disabled && styles.disabledButton, pressed && !disabled && styles.pressed]}>
      <Text style={styles.primaryButtonText}>{label}</Text>
      <Ionicons name="chevron-forward" size={26} color="#FFFFFF" />
    </Pressable>
  );
}

function PolicyItem({ children, number, title }: { children: ReactNode; number: string; title: string }) {
  return (
    <View style={styles.policyItem}>
      <View style={styles.policyNumber}>
        <Text style={styles.policyNumberText}>{number}</Text>
      </View>
      <View style={styles.policyText}>
        <Text style={styles.policyTitle}>{title}</Text>
        <Text style={styles.policyBody}>{children}</Text>
      </View>
    </View>
  );
}

function PermissionRow({ copy, icon, title }: { copy: string; icon: keyof typeof Ionicons.glyphMap; title: string }) {
  return (
    <View style={styles.permissionRow}>
      <View style={styles.permissionIcon}>
        <Ionicons name={icon} size={25} color="#C7C5FF" />
      </View>
      <View style={styles.permissionText}>
        <Text style={styles.permissionRowTitle}>{title}</Text>
        <Text style={styles.permissionCopy}>{copy}</Text>
      </View>
      <View style={styles.permissionCheck}>
        <Ionicons name="checkmark" size={18} color="#FFFFFF" />
      </View>
    </View>
  );
}

function DateInput({
  label,
  maxLength,
  onChange,
  placeholder,
  value,
}: {
  label: string;
  maxLength: number;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <View style={styles.dateInputWrap}>
      <TextInput
        keyboardType="number-pad"
        maxLength={maxLength}
        onChangeText={(next) => onChange(next.replace(/\D/g, '').slice(0, maxLength))}
        placeholder={placeholder}
        placeholderTextColor="rgba(255,255,255,0.36)"
        style={styles.dateInput}
        value={value}
      />
      <Text style={styles.dateLabel}>{label}</Text>
    </View>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('ko-KR').format(Math.round(value));
}

const styles = StyleSheet.create({
  appHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, width: '100%' },
  asteroidOne: { backgroundColor: '#9A9A9A', borderRadius: 12, height: 18, opacity: 0.75, position: 'absolute', right: 50, top: 210, width: 24 },
  asteroidTwo: { backgroundColor: '#5C5C5C', borderRadius: 999, height: 12, opacity: 0.75, position: 'absolute', right: 126, top: 250, width: 12 },
  astronautScene: { alignItems: 'center', height: 132, justifyContent: 'flex-end', marginTop: 18, overflow: 'hidden', width: '100%' },
  authButton: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.12)', borderColor: 'rgba(255,255,255,0.28)', borderRadius: 18, borderWidth: 1, flexDirection: 'row', gap: 14, minHeight: 58, paddingHorizontal: 20, width: '100%' },
  authButtonText: { color: '#FFFFFF', flex: 1, fontSize: 13, fontWeight: '700', letterSpacing: 0 },
  authMessage: { color: '#FFD1D1', fontSize: 12, lineHeight: 18, textAlign: 'center' },
  backButton: { alignItems: 'center', height: 36, justifyContent: 'center', width: 36 },
  bellWrap: { position: 'relative' },
  birthInputRow: { alignItems: 'center', flexDirection: 'row', gap: 10, marginBottom: 28, marginTop: 24 },
  birthdayContent: { alignItems: 'center', flexGrow: 1, justifyContent: 'center', padding: 24 },
  birthdayCopy: { color: 'rgba(255,255,255,0.76)', fontSize: 15, lineHeight: 24, marginTop: 16, textAlign: 'center' },
  birthdayPanel: { alignItems: 'center', backgroundColor: 'rgba(12,12,16,0.78)', borderColor: 'rgba(255,255,255,0.33)', borderRadius: 26, borderWidth: 1, marginTop: 28, padding: 22, width: '100%' },
  birthdayPanelTitle: { color: '#FFFFFF', fontSize: 23, fontWeight: '800', marginTop: 12 },
  birthdayTitle: { color: '#FFFFFF', fontSize: 28, fontWeight: '700', lineHeight: 39, textAlign: 'center' },
  cardFoot: { color: '#D7D4FF', fontSize: 14, marginTop: 18 },
  cardHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  cardRow: { flexDirection: 'row', gap: 14, marginTop: 16, width: '100%' },
  cardTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  centeredContent: { alignItems: 'center', flexGrow: 1, justifyContent: 'center', padding: 24 },
  centeredPanel: { alignItems: 'center', gap: 14, paddingHorizontal: 24, paddingVertical: 28 },
  centerStar: { color: '#FFFFFF', fontSize: 24, textShadowColor: '#FFFFFF', textShadowRadius: 12 },
  chart: { alignItems: 'flex-end', flexDirection: 'row', gap: 9, height: 138, justifyContent: 'space-between', marginTop: 22, width: '100%' },
  chartBar: { backgroundColor: '#A19CFF', borderRadius: 10, shadowColor: '#A19CFF', shadowOpacity: 0.85, shadowRadius: 10, width: 16 },
  chartColumn: { alignItems: 'center', gap: 7, justifyContent: 'flex-end' },
  chartLabel: { color: 'rgba(255,255,255,0.65)', fontSize: 12 },
  checkCircle: { alignItems: 'center', backgroundColor: '#868BFF', borderRadius: 999, height: 32, justifyContent: 'center', shadowColor: '#A7A4FF', shadowOpacity: 0.8, shadowRadius: 14, width: 32 },
  checkRow: { alignItems: 'center', flexDirection: 'row', gap: 12, width: '100%' },
  checkText: { color: 'rgba(255,255,255,0.78)', flex: 1, fontSize: 15 },
  calculatingContent: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  calculatingCopy: { color: 'rgba(255,255,255,0.68)', fontSize: 13, lineHeight: 20, marginTop: 8, textAlign: 'center' },
  calculatingPanel: { padding: 22 },
  calculatingTitle: { color: '#FFFFFF', fontSize: 23, fontWeight: '800', lineHeight: 30, textAlign: 'center' },
  dateDot: { color: 'rgba(255,255,255,0.5)', fontSize: 22, fontWeight: '800' },
  dateInput: { color: '#FFFFFF', fontSize: 20, fontWeight: '800', letterSpacing: 0, padding: 0, textAlign: 'center' },
  dateInputWrap: { alignItems: 'center', borderColor: 'rgba(255,255,255,0.26)', borderRadius: 16, borderWidth: 1, gap: 5, height: 78, justifyContent: 'center', width: 76 },
  dateLabel: { color: 'rgba(255,255,255,0.52)', fontSize: 12 },
  disabledButton: { opacity: 0.42 },
  divider: { backgroundColor: 'rgba(255,255,255,0.16)', flex: 1, height: 1 },
  dividerRow: { alignItems: 'center', flexDirection: 'row', gap: 18, marginTop: 8, width: '100%' },
  dividerText: { color: 'rgba(255,255,255,0.58)', fontSize: 14 },
  earthGlow: { backgroundColor: 'rgba(255,255,255,0.12)', borderColor: 'rgba(255,255,255,0.2)', borderRadius: 999, borderWidth: 1, height: 260, opacity: 0.42, position: 'absolute', top: 276, width: 260 },
  emotionalLine: { bottom: 24, color: 'rgba(255,255,255,0.62)', fontSize: 13, letterSpacing: 0, position: 'absolute', textAlign: 'center' },
  flex: { flex: 1 },
  formulaAccent: { color: '#D7D4FF', fontSize: 14, fontWeight: '800' },
  formulaBar: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16, flexDirection: 'row', gap: 12, marginTop: 14, padding: 14 },
  formulaDivider: { color: 'rgba(255,255,255,0.36)' },
  formulaText: { color: 'rgba(255,255,255,0.68)', flex: 1, fontSize: 13 },
  glass: { backgroundColor: 'rgba(15,16,22,0.74)', borderColor: 'rgba(255,255,255,0.24)', borderRadius: 28, borderWidth: 1, overflow: 'hidden', shadowColor: '#FFFFFF', shadowOpacity: 0.14, shadowRadius: 22, width: '100%' },
  halfCard: { flex: 1, minHeight: 230, padding: 18 },
  headerSpacer: { width: 36 },
  healthIcon: { alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 16, height: 62, justifyContent: 'center', width: 62 },
  healthIconWrap: { alignItems: 'center', borderColor: 'rgba(255,255,255,0.22)', borderRadius: 999, borderStyle: 'dashed', borderWidth: 1, height: 94, justifyContent: 'center', width: 94 },
  healthResultCard: { backgroundColor: 'rgba(169,167,255,0.1)', borderColor: 'rgba(169,167,255,0.24)', borderRadius: 16, borderWidth: 1, padding: 14, width: '100%' },
  healthResultCopy: { color: 'rgba(255,255,255,0.7)', fontSize: 12, lineHeight: 18, marginTop: 5 },
  healthResultLabel: { color: 'rgba(255,255,255,0.62)', fontSize: 12, fontWeight: '800' },
  healthResultValue: { color: '#FFFFFF', fontSize: 23, fontWeight: '900', marginTop: 5 },
  heroCopy: { color: '#FFFFFF', fontSize: 17, marginTop: 4 },
  heroPercent: { color: '#E1DFFF', fontSize: 78, fontWeight: '200', letterSpacing: 0, marginTop: 26, textShadowColor: '#9F9AFF', textShadowRadius: 18 },
  heroSection: { minHeight: 420, overflow: 'hidden', paddingTop: 20, position: 'relative', width: '100%' },
  heroSmall: { color: 'rgba(255,255,255,0.72)', fontSize: 16, marginTop: 18 },
  heroSub: { color: 'rgba(255,255,255,0.48)', fontSize: 18, letterSpacing: 8, marginTop: 8 },
  heroTitle: { color: '#FFFFFF', fontSize: 43, fontWeight: '800', letterSpacing: 0, marginTop: 14 },
  jupiter: { backgroundColor: '#C6B199', borderColor: 'rgba(255,255,255,0.2)', borderRadius: 999, borderWidth: 1, height: 300, opacity: 0.88, position: 'absolute', right: -128, shadowColor: '#FFFFFF', shadowOpacity: 0.4, shadowRadius: 32, top: 34, width: 300 },
  jupiterSplash: { bottom: 52, height: 84, left: 16, width: 84 },
  fieldLabel: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  floatingBackButton: { alignItems: 'center', height: 42, justifyContent: 'center', left: 18, position: 'absolute', top: 18, width: 42, zIndex: 5 },
  forgotPasswordText: { color: 'rgba(255,255,255,0.76)', fontSize: 13, textDecorationLine: 'underline' },
  logoBlock: { alignItems: 'center', width: '100%' },
  logoCompact: { alignItems: 'center', width: 210 },
  logoLarge: { alignItems: 'center', width: 260 },
  logoTagline: { color: '#FFFFFF', fontFamily: 'Exo 2', fontSize: 16, fontWeight: '200', letterSpacing: 3.2, marginTop: 10, textAlign: 'center' },
  logoTaglineCompact: { color: '#FFFFFF', fontFamily: 'Exo 2', fontSize: 8, fontWeight: '200', letterSpacing: 1.6, marginTop: 5, textAlign: 'center' },
  logoTaglineLarge: { color: '#FFFFFF', fontFamily: 'Exo 2', fontSize: 11, fontWeight: '200', letterSpacing: 1.76, marginTop: 7, textAlign: 'center' },
  logoText: { color: '#FFFFFF', fontFamily: 'Exo 2', fontSize: 54, fontWeight: '200', letterSpacing: 8.64, lineHeight: 64, textAlign: 'center' },
  logoTextCompact: { color: '#FFFFFF', fontFamily: 'Exo 2', fontSize: 27, fontWeight: '200', letterSpacing: 4.32, lineHeight: 34, textAlign: 'center' },
  logoTextLarge: { color: '#FFFFFF', fontFamily: 'Exo 2', fontSize: 33, fontWeight: '200', letterSpacing: 5.28, lineHeight: 40, textAlign: 'center' },
  loginButton: { alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 15, justifyContent: 'center', minHeight: 48, width: '100%' },
  loginButtonText: { color: '#09090B', fontSize: 15, fontWeight: '900' },
  loginDescription: { color: 'rgba(255,255,255,0.82)', fontSize: 14, lineHeight: 21, marginTop: 8 },
  loginField: { gap: 9, width: '100%' },
  loginForm: { gap: 18, width: '100%' },
  loginGlassPanel: { backgroundColor: 'rgba(255,255,255,0.16)', borderColor: 'rgba(255,255,255,0.42)', borderWidth: 1.2, paddingHorizontal: 26, paddingVertical: 30, shadowColor: '#FFFFFF', shadowOffset: { height: 10, width: 0 }, shadowOpacity: 0.28, shadowRadius: 30 },
  loginHeader: { alignItems: 'center', width: '100%' },
  loginLogoWrap: { alignItems: 'center', width: '100%' },
  loginTitle: { color: '#FFFFFF', fontSize: 28, fontWeight: '900', lineHeight: 34, marginTop: 12, textShadowColor: 'rgba(255,255,255,0.4)', textShadowRadius: 14 },
  loginTitleGroup: { alignItems: 'center', width: '100%' },
  mainContent: { padding: 22, paddingBottom: 120 },
  mercury: { left: 84, top: 74 },
  missionCopy: { color: 'rgba(255,255,255,0.78)', fontSize: 14, lineHeight: 24 },
  moonGround: { backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 120, bottom: -72, height: 120, position: 'absolute', width: '115%' },
  nearbyBody: { alignItems: 'center', flex: 1, gap: 7 },
  nearbyDistance: { color: 'rgba(255,255,255,0.58)', fontSize: 11, textAlign: 'center' },
  nearbyMoon: { backgroundColor: 'rgba(255,255,255,0.22)', borderColor: 'rgba(255,255,255,0.24)', borderRadius: 999, borderWidth: 1, height: 54, width: 54 },
  nearbyMoonActive: { borderColor: '#D7D4FF', shadowColor: '#D7D4FF', shadowOpacity: 0.75, shadowRadius: 14, transform: [{ scale: 1.15 }] },
  nearbyPanel: { marginTop: 16, padding: 20 },
  nearbyRow: { flexDirection: 'row', gap: 12, marginTop: 18 },
  nextDistance: { color: '#FFFFFF', fontSize: 21, fontWeight: '700', marginBottom: 10 },
  nextGoal: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, padding: 20 },
  nextGoalCopy: { color: 'rgba(255,255,255,0.68)', fontSize: 14, marginTop: 8 },
  nextGoalTitle: { color: '#FFFFFF', fontSize: 28, fontWeight: '800', marginTop: 10 },
  noticeDot: { backgroundColor: '#9D98FF', borderRadius: 999, height: 9, position: 'absolute', right: -1, top: 1, width: 9 },
  orbitOne: { borderColor: 'rgba(255,255,255,0.08)', borderRadius: 999, borderWidth: 1, height: 620, left: -120, position: 'absolute', top: 88, transform: [{ rotate: '-12deg' }], width: 620 },
  orbitTwo: { borderColor: 'rgba(255,255,255,0.06)', borderRadius: 999, borderWidth: 1, height: 760, left: -178, position: 'absolute', top: 38, transform: [{ rotate: '-12deg' }], width: 760 },
  originPanel: { gap: 8, marginTop: 16, padding: 16 },
  originText: { color: 'rgba(255,255,255,0.66)', fontSize: 13 },
  panelBackHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  panelCopy: { color: 'rgba(255,255,255,0.76)', fontSize: 14, lineHeight: 22, textAlign: 'center' },
  panelHeaderRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  panelHint: { color: '#FFFFFF', fontSize: 17, lineHeight: 27, marginTop: 8, textAlign: 'center' },
  panelTitle: { color: '#FFFFFF', fontSize: 28, fontWeight: '900', letterSpacing: 0 },
  panelTitleSmall: { color: '#FFFFFF', fontSize: 19, fontWeight: '800' },
  permissionCard: { borderColor: 'rgba(255,255,255,0.16)', borderRadius: 16, borderWidth: 1, gap: 12, padding: 14, width: '100%' },
  permissionCheck: { alignItems: 'center', backgroundColor: '#9498FF', borderRadius: 999, height: 30, justifyContent: 'center', width: 30 },
  permissionCopy: { color: 'rgba(255,255,255,0.66)', fontSize: 12, marginTop: 3 },
  permissionIcon: { alignItems: 'center', backgroundColor: 'rgba(166,162,255,0.12)', borderColor: 'rgba(255,255,255,0.12)', borderRadius: 999, borderWidth: 1, height: 44, justifyContent: 'center', shadowColor: '#B7B3FF', shadowOpacity: 0.28, shadowRadius: 10, width: 44 },
  permissionRow: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  permissionRowTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  permissionText: { flex: 1 },
  permissionTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', marginBottom: 2 },
  planetBack: { backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 999, bottom: -120, height: 260, left: -88, position: 'absolute', width: 260 },
  policyBody: { color: 'rgba(255,255,255,0.68)', fontSize: 12, lineHeight: 18, marginTop: 3 },
  policyBox: { borderColor: 'rgba(255,255,255,0.18)', borderRadius: 18, borderWidth: 1, gap: 13, maxHeight: 360, padding: 14, width: '100%' },
  policyItem: { flexDirection: 'row', gap: 10 },
  policyLinkButton: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: 6, marginTop: 2, paddingVertical: 4 },
  policyLinkText: { color: '#DCD9FF', fontSize: 13, fontWeight: '800', textDecorationLine: 'underline' },
  policyNumber: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 999, height: 28, justifyContent: 'center', width: 28 },
  policyNumberText: { color: '#FFFFFF', fontSize: 13 },
  policySummaryCard: { borderColor: 'rgba(255,255,255,0.18)', borderRadius: 18, borderWidth: 1, gap: 12, padding: 14, width: '100%' },
  policyText: { flex: 1 },
  policyTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
  primaryButton: { alignItems: 'center', backgroundColor: 'rgba(104,103,172,0.38)', borderColor: 'rgba(197,196,255,0.45)', borderRadius: 18, borderWidth: 1, flexDirection: 'row', justifyContent: 'center', minHeight: 56, paddingHorizontal: 20, shadowColor: '#8F8AFF', shadowOpacity: 0.5, shadowRadius: 16, width: '100%' },
  primaryButtonText: { color: '#FFFFFF', flex: 1, fontSize: 17, fontWeight: '800', textAlign: 'center' },
  progressFill: { backgroundColor: '#DCD9FF', borderRadius: 999, height: '100%', shadowColor: '#DCD9FF', shadowOpacity: 0.85, shadowRadius: 8, width: '67%' },
  progressPercent: { color: '#FFFFFF', fontSize: 23, fontWeight: '800' },
  progressRow: { alignItems: 'center', flexDirection: 'row', gap: 18, marginTop: 12, width: '100%' },
  progressTrack: { backgroundColor: 'rgba(255,255,255,0.18)', borderColor: 'rgba(255,255,255,0.38)', borderRadius: 999, borderWidth: 1, flex: 1, height: 8 },
  remainingCopy: { color: 'rgba(255,255,255,0.7)', fontSize: 15 },
  remainingPercent: { color: '#BDB9FF', fontSize: 38, fontWeight: '300', marginTop: 8 },
  ringCopy: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  ringNumber: { color: '#FFFFFF', fontSize: 28, fontWeight: '800' },
  ringProgress: { alignItems: 'center', borderColor: '#8F8AFF', borderRadius: 999, borderWidth: 8, height: 118, justifyContent: 'center', marginVertical: 18, shadowColor: '#8F8AFF', shadowOpacity: 0.58, shadowRadius: 14, width: 118 },
  root: { backgroundColor: '#020204', flex: 1, overflow: 'hidden' },
  routeLabel: { color: 'rgba(255,255,255,0.68)', fontSize: 12, lineHeight: 17, textAlign: 'center' },
  routeLabelActive: { color: '#DCD9FF' },
  routePlanet: { alignItems: 'center', borderColor: 'rgba(255,255,255,0.16)', borderRadius: 999, borderWidth: 1, height: 36, justifyContent: 'center', width: 36 },
  routePlanetActive: { borderColor: '#DCD9FF', shadowColor: '#DCD9FF', shadowOpacity: 0.9, shadowRadius: 12 },
  routePlanetCore: { backgroundColor: 'rgba(255,255,255,0.35)', borderRadius: 999, height: 18, width: 18 },
  routePlanetCoreActive: { backgroundColor: '#C7BFA7' },
  routePoint: { alignItems: 'center', flex: 1, gap: 8 },
  routeProgress: { color: 'rgba(255,255,255,0.5)', fontSize: 13 },
  routeRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 6, marginBottom: 16, marginTop: 6, width: '100%' },
  safe: { flex: 1 },
  safeDataCard: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.12)', borderRadius: 18, borderWidth: 1, flexDirection: 'row', gap: 14, padding: 18, width: '100%' },
  safeDataCopy: { color: 'rgba(255,255,255,0.66)', fontSize: 13, lineHeight: 19, marginTop: 5 },
  safeDataText: { flex: 1 },
  safeDataTitle: { color: '#C8C4FF', fontSize: 16, fontWeight: '800' },
  saturnMini: { backgroundColor: '#C4B698', borderRadius: 999, height: 96, justifyContent: 'center', marginHorizontal: 10, width: 96 },
  saturnRingMain: { alignSelf: 'center', borderColor: 'rgba(255,255,255,0.6)', borderRadius: 999, borderWidth: 2, height: 30, transform: [{ rotate: '-18deg' }], width: 140 },
  saturnSplash: { height: 56, right: 42, top: 34, width: 56 },
  saturnSplashRing: { borderColor: 'rgba(255,255,255,0.55)', borderRadius: 999, borderWidth: 2, height: 20, left: -16, position: 'absolute', top: 18, transform: [{ rotate: '-18deg' }], width: 88 },
  secondaryButton: { alignItems: 'center', borderColor: 'rgba(255,255,255,0.22)', borderRadius: 17, borderWidth: 1, justifyContent: 'center', minHeight: 48, width: '100%' },
  secondaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  shareButton: { alignItems: 'center', alignSelf: 'flex-start', borderColor: 'rgba(255,255,255,0.34)', borderRadius: 18, borderWidth: 1, flexDirection: 'row', gap: 9, marginTop: 22, paddingHorizontal: 18, paddingVertical: 12 },
  shareText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  shaderBackground: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000000', overflow: 'hidden' },
  shaderGlow: { backgroundColor: 'rgba(96,148,255,0.36)', borderRadius: 999, height: 360, left: -80, position: 'absolute', shadowColor: '#7BD7FF', shadowOpacity: 0.8, shadowRadius: 80, top: 220, width: 360 },
  shaderRibbon: { borderRadius: 999, height: 180, position: 'absolute', shadowOpacity: 0.9, shadowRadius: 56, width: 620 },
  shaderRibbonOne: { backgroundColor: 'rgba(60,210,255,0.24)', left: -250, shadowColor: '#61D8FF', top: 120 },
  shaderRibbonTwo: { backgroundColor: 'rgba(148,94,255,0.28)', right: -280, shadowColor: '#A77CFF', top: 410 },
  shaderStars: { ...StyleSheet.absoluteFillObject },
  shaderVignette: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.32)' },
  signupAccent: { color: '#AFAAFF', fontWeight: '800' },
  signupLinkButton: { alignItems: 'center', alignSelf: 'flex-start', borderRadius: 14, minHeight: 38, justifyContent: 'center', paddingHorizontal: 4 },
  signupLinkText: { color: 'rgba(255,255,255,0.76)', fontSize: 13, textDecorationLine: 'underline' },
  signupText: { color: 'rgba(255,255,255,0.7)', fontSize: 15 },
  solarOrbit: { borderColor: 'rgba(255,255,255,0.18)', borderRadius: 999, borderWidth: 1, position: 'absolute' },
  solarOrbitOne: { height: 210, width: 210 },
  solarOrbitThree: { height: 430, width: 430 },
  solarOrbitTwo: { height: 320, width: 320 },
  solarSystem: { alignItems: 'center', height: 500, justifyContent: 'center', marginTop: 18, width: '100%' },
  spark: { color: '#FFFFFF', fontSize: 16, textShadowColor: '#FFFFFF', textShadowRadius: 10 },
  splash: { backgroundColor: '#020204', flex: 1 },
  splashImage: { height: '100%', width: '100%' },
  splashPlanet: { backgroundColor: 'rgba(255,255,255,0.72)', borderRadius: 999, position: 'absolute' },
  star: { backgroundColor: '#FFFFFF', borderRadius: 999, height: 2, position: 'absolute', width: 2 },
  starField: { ...StyleSheet.absoluteFillObject },
  startButton: { alignItems: 'center', borderColor: 'rgba(255,255,255,0.28)', borderRadius: 26, borderWidth: 1, flexDirection: 'row', gap: 18, justifyContent: 'center', minHeight: 64, paddingHorizontal: 30, width: '84%' },
  startButtonText: { color: '#FFFFFF', fontSize: 20, fontWeight: '500' },
  statCell: { alignItems: 'center', borderRightColor: 'rgba(255,255,255,0.12)', borderRightWidth: 1, flex: 1, gap: 8, minHeight: 106 },
  statLabel: { color: 'rgba(255,255,255,0.76)', fontSize: 12, fontWeight: '800' },
  statsGrid: { flexDirection: 'row' },
  statsPanel: { padding: 18 },
  statUnit: { color: 'rgba(255,255,255,0.72)', fontSize: 13 },
  statValue: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', textAlign: 'center' },
  sun: { backgroundColor: '#FFFFFF', borderRadius: 999, height: 116, shadowColor: '#FFFFFF', shadowOpacity: 1, shadowRadius: 38, width: 116 },
  timeline: { gap: 15, marginTop: 24, width: '100%' },
  timelineCopy: { color: 'rgba(255,255,255,0.68)', fontSize: 12, lineHeight: 18, marginTop: 3 },
  timelineDim: { opacity: 0.45 },
  timelineDot: { backgroundColor: 'rgba(255,255,255,0.36)', borderRadius: 999, height: 8, width: 8 },
  timelineIcon: { alignItems: 'center', borderColor: 'rgba(255,255,255,0.18)', borderRadius: 999, borderWidth: 1, height: 44, justifyContent: 'center', width: 44 },
  timelineIconDone: { borderColor: 'rgba(217,214,255,0.72)', shadowColor: '#D9D6FF', shadowOpacity: 0.35, shadowRadius: 12 },
  timelineItem: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  timelineText: { flex: 1 },
  timelineTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  tip: { color: 'rgba(255,255,255,0.72)', fontSize: 13, marginTop: 12, textAlign: 'center' },
  topStar: { color: '#FFFFFF', fontSize: 24, marginBottom: 14, textAlign: 'center', textShadowColor: '#FFFFFF', textShadowRadius: 16 },
  passwordHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  textInputGlass: { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.2)', borderRadius: 13, borderWidth: 1, color: '#FFFFFF', fontSize: 14, minHeight: 46, paddingHorizontal: 13 },
  venus: { height: 28, right: 92, top: 138, width: 28 },
});
