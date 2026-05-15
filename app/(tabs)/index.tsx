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
  BackHandler,
  Easing,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  PanResponder,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  useWindowDimensions,
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

type Step = 'splash' | 'onboarding' | 'terms' | 'login' | 'health' | 'birthday' | 'calculating' | 'main';

const PRIVACY_POLICY_URL = 'https://astro-step-app.astro-step.workers.dev/privacy';
const TERMS_OF_SERVICE_URL = 'https://astro-step-app.astro-step.workers.dev/terms';
const shaderBackgroundSteps: Step[] = [];

const journeyPoints = [
  { label: '지구', progress: 0, active: false },
  { label: '화성 궤도', progress: 15, active: false },
  { label: '소행성대', progress: 32, active: false },
  { label: '목성 항성', progress: 57, active: true },
  { label: '토성 항성', progress: 78, active: false },
  { label: '심우주', progress: 100, active: false },
];

const nearbyBodies = [
  ['이오', '1.2M km'],
  ['유로파', '2.1M km'],
  ['가니메데', '4.3M km'],
  ['칼리스토', '6.2M km'],
];

const onboardingPages = [
  {
    icon: 'footsteps-outline',
    subtitle: '건강 데이터와 추정 기록을 합쳐\n생애 누적 걸음을 보여드려요',
    title: '당신의 지구 여정\n걸음으로 기록하세요',
  },
  {
    icon: 'rocket-outline',
    subtitle: '하루의 걸음이 모여\n당신만의 우주 항해 거리가 됩니다',
    title: '걸음이 쌓이면\n우주가 열립니다',
  },
  {
    icon: 'planet-outline',
    subtitle: '누적 걸음을 우주 거리로 바꿔\n현재 위치를 보여드릴게요',
    title: '지금 당신은\n어디쯤 걷고 있을까요?',
  },
] as const satisfies readonly {
  icon: keyof typeof Ionicons.glyphMap;
  subtitle: string;
  title: string;
}[];

export default function HomeScreen() {
  const navigation = useNavigation();
  const calculationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [step, setStep] = useState<Step>('splash');
  const [authEntryMode, setAuthEntryMode] = useState<'login' | 'signup'>('login');
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

    const timer = setTimeout(() => setStep('onboarding'), 1700);

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

  return (
    <SpaceFrame plain={step === 'splash' || step === 'onboarding' || step === 'terms' || step === 'login' || step === 'health' || step === 'birthday' || step === 'calculating'} shader={shaderBackgroundSteps.includes(step)}>
      {step === 'splash' && <SplashScreen />}
      {step === 'onboarding' && (
        <OnboardingScreen
          onLogin={() => {
            setAuthEntryMode('login');
            setStep('login');
          }}
          onStart={() => {
            setAuthEntryMode('signup');
            setStep('terms');
          }}
        />
      )}
      {step === 'terms' && (
        <TermsScreen
          onLater={() => {
            setAuthEntryMode('signup');
            setStep('login');
          }}
          onNext={() => {
            setAuthEntryMode('signup');
            setStep('login');
          }}
        />
      )}
      {step === 'login' && (
        <LoginScreen
          initialMode={authEntryMode}
          onAuthenticated={(session) => {
            setAuthSession(session);
            setStep('health');
          }}
        />
      )}
      {step === 'health' && (
        <HealthConnectScreen
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
          onBack={() => setStep('health')}
          onChangeDay={setDay}
          onChangeMonth={setMonth}
          onChangeYear={setYear}
          onNext={handleBirthdayNext}
          year={year}
        />
      )}
      {step === 'calculating' && <CalculatingScreen />}
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
      <SafeAreaView style={[styles.safe, plain && styles.plainSafe]}>{children}</SafeAreaView>
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

function OnboardingScreen({ onLogin, onStart }: { onLogin: () => void; onStart: () => void }) {
  const { height, width } = useWindowDimensions();
  const carouselRef = useRef<ScrollView>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const visiblePageRef = useRef(0);
  const [activePage, setActivePage] = useState(0);
  const isCompact = height < 760;
  const logoScale = Math.min(1, Math.max(0.84, width / 390));
  const loopedPages = [...onboardingPages, onboardingPages[0]];

  useEffect(() => {
    if (!width) {
      return;
    }

    const interval = setInterval(() => {
      const nextPage = visiblePageRef.current + 1;
      visiblePageRef.current = nextPage;
      setActivePage(nextPage % onboardingPages.length);
      carouselRef.current?.scrollTo({ animated: true, x: nextPage * width });
    }, 3000);

    return () => clearInterval(interval);
  }, [width]);

  const handleCarouselSettled = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const page = Math.round(event.nativeEvent.contentOffset.x / width);

    if (page === onboardingPages.length) {
      visiblePageRef.current = 0;
      setActivePage(0);
      requestAnimationFrame(() => {
        carouselRef.current?.scrollTo({ animated: false, x: 0 });
      });
      return;
    }

    visiblePageRef.current = page;
    setActivePage(page);
  };

  return (
    <View style={styles.onboardingScreen}>
      <View pointerEvents="none" style={styles.onboardingBackdrop} />

      <View style={[styles.onboardingLogoArea, isCompact && styles.onboardingLogoAreaCompact]}>
        <View style={{ transform: [{ scale: logoScale }] }}>
          <Image
            resizeMode="contain"
            source={require('../../assets/images/astro-step-logo.png')}
            style={styles.onboardingLogoImage}
          />
        </View>
      </View>

      <View style={[styles.onboardingCopyArea, isCompact && styles.onboardingCopyAreaCompact]}>
        <Animated.ScrollView
          ref={carouselRef}
          horizontal
          onMomentumScrollEnd={handleCarouselSettled}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: true })}
          pagingEnabled
          scrollEventThrottle={16}
          showsHorizontalScrollIndicator={false}
          style={styles.onboardingCarousel}
        >
          {loopedPages.map((page, index) => {
            const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
            const opacity = scrollX.interpolate({
              inputRange,
              outputRange: [0.34, 1, 0.34],
              extrapolate: 'clamp',
            });
            const translateX = scrollX.interpolate({
              inputRange,
              outputRange: [28, 0, -28],
              extrapolate: 'clamp',
            });

            return (
              <Animated.View
                key={`${page.title}-${index}`}
                style={[
                  styles.onboardingSlide,
                  {
                    opacity,
                    transform: [{ translateX }],
                    width,
                  },
                ]}
              >
                <Ionicons name={page.icon} size={30} color="#FFFFFF" style={styles.onboardingSlideIcon} />
                <Text style={styles.onboardingTitle}>{page.title}</Text>
                <Text style={styles.onboardingSubtitle}>{page.subtitle}</Text>
              </Animated.View>
            );
          })}
        </Animated.ScrollView>
        <View style={styles.onboardingDots}>
          {[0, 1, 2].map((index) => (
            <View key={index} style={[styles.onboardingDot, index === activePage && styles.onboardingDotActive]} />
          ))}
        </View>
      </View>

      <View style={[styles.onboardingActionArea, isCompact && styles.onboardingActionAreaCompact]}>
        <Pressable onPress={onStart} style={({ pressed }) => [styles.onboardingButton, pressed && styles.pressed]}>
          <Text style={styles.onboardingButtonText}>시작하기</Text>
        </Pressable>
        <Pressable onPress={onLogin} hitSlop={12} style={({ pressed }) => pressed && styles.pressed}>
          <Text style={styles.onboardingLoginLink}>이미 계정이 있어요</Text>
        </Pressable>
      </View>
    </View>
  );
}

function TermsScreen({ onLater, onNext }: { onLater: () => void; onNext: () => void }) {
  const { height } = useWindowDimensions();
  const [privacyAgreed, setPrivacyAgreed] = useState(false);
  const [termsAgreed, setTermsAgreed] = useState(false);
  const canContinue = privacyAgreed && termsAgreed;
  const isCompact = height < 760;

  return (
    <View style={[styles.termsContent, isCompact && styles.termsContentCompact]}>
      <View style={styles.termsLogoWrap}>
        <Image
          resizeMode="contain"
          source={require('../../assets/images/astro-step-logo.png')}
          style={styles.termsLogoImage}
        />
      </View>

      <View style={[styles.termsHeader, isCompact && styles.termsHeaderCompact]}>
        <Text style={styles.termsTitle}>개인정보 및 약관 동의</Text>
        <Text style={styles.termsSubtitle}>서비스 이용을 위해 아래 항목에 동의해주세요</Text>
      </View>

      <View style={[styles.termsList, isCompact && styles.termsListCompact]}>
        <AgreementRow
          checked={privacyAgreed}
          description="계정 생성, 기록 저장, 서비스 제공을 위해 필요해요"
          linkLabel="개인정보처리방침 전체보기"
          onLinkPress={() => WebBrowser.openBrowserAsync(PRIVACY_POLICY_URL)}
          onToggle={() => setPrivacyAgreed((current) => !current)}
          title="개인정보 수집 및 이용에 동의합니다"
        />
        <View style={styles.termsDivider} />
        <AgreementRow
          checked={termsAgreed}
          description="앱 이용을 위한 기본 약관입니다"
          linkLabel="서비스 이용약관 전체보기"
          onLinkPress={() => WebBrowser.openBrowserAsync(TERMS_OF_SERVICE_URL)}
          onToggle={() => setTermsAgreed((current) => !current)}
          title="서비스 이용약관에 동의합니다"
        />
      </View>

      <View style={[styles.termsActionArea, isCompact && styles.termsActionAreaCompact]}>
        <Pressable
          disabled={!canContinue}
          onPress={onNext}
          style={({ pressed }) => [
            styles.termsPrimaryButton,
            !canContinue && styles.termsPrimaryButtonDisabled,
            pressed && canContinue && styles.pressed,
          ]}>
          <Text style={styles.termsPrimaryButtonText}>동의하고 계속</Text>
        </Pressable>
        <Pressable onPress={onLater} hitSlop={12} style={({ pressed }) => pressed && styles.pressed}>
          <Text style={styles.termsLaterLink}>나중에 할게요</Text>
        </Pressable>
      </View>
    </View>
  );
}

function AgreementRow({
  checked,
  description,
  linkLabel,
  onLinkPress,
  onToggle,
  title,
}: {
  checked: boolean;
  description: string;
  linkLabel: string;
  onLinkPress: () => void;
  onToggle: () => void;
  title: string;
}) {
  return (
    <View style={styles.agreementRow}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        onPress={onToggle}
        style={({ pressed }) => [styles.agreementCheckbox, checked && styles.agreementCheckboxChecked, pressed && styles.pressed]}>
        {checked ? <Ionicons name="checkmark" size={22} color="#050607" /> : null}
      </Pressable>
      <View style={styles.agreementTextGroup}>
        <Pressable onPress={onToggle} style={({ pressed }) => pressed && styles.pressed}>
          <Text style={styles.agreementTitle}>{title}</Text>
        </Pressable>
        <Text style={styles.agreementDescription}>{description}</Text>
        <Pressable onPress={onLinkPress} hitSlop={8} style={({ pressed }) => pressed && styles.pressed}>
          <Text style={styles.agreementLink}>{linkLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function LoginScreen({
  initialMode,
  onAuthenticated,
}: {
  initialMode: 'login' | 'signup';
  onAuthenticated: (session: AuthSession) => void;
}) {
  const googleClientIds = getGoogleClientIds();
  const googleOAuthConfigured = Object.values(googleClientIds).some(Boolean);
  const [, googleResponse, promptGoogleAsync] = Google.useIdTokenAuthRequest({
    androidClientId: googleClientIds.androidClientId || undefined,
    clientId: googleClientIds.webClientId || googleClientIds.iosClientId || googleClientIds.androidClientId || 'missing-google-client-id',
    iosClientId: googleClientIds.iosClientId || undefined,
    selectAccount: true,
    webClientId: googleClientIds.webClientId || undefined,
  });
  const [authMode, setAuthMode] = useState<'login' | 'signup'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberLogin, setRememberLogin] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
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
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.loginScreen}>
      <ScrollView contentContainerStyle={styles.loginContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Image
          resizeMode="contain"
          source={require('../../assets/images/astro-step-logo.png')}
          style={styles.loginBrandImage}
        />

        <View style={styles.loginHeader}>
          <Text style={styles.loginTitle}>{isSignup ? '회원가입' : '로그인'}</Text>
          <Text style={styles.loginDescription}>
            {isSignup ? '당신의 여정을 시작하세요' : '당신의 여정을 이어가세요'}
          </Text>
        </View>

        <View style={styles.loginForm}>
          <View style={styles.loginField}>
            <Text style={styles.fieldLabel}>이메일</Text>
            <View style={styles.loginInputWrap}>
              <Ionicons name="at-outline" size={30} color="rgba(255,255,255,0.72)" />
              <TextInput
                autoCapitalize="none"
                editable={!isLoading}
                keyboardType="email-address"
                onChangeText={setEmail}
                placeholder="이메일을 입력하세요"
                placeholderTextColor="rgba(255,255,255,0.48)"
                style={styles.loginTextInput}
                value={email}
              />
            </View>
          </View>

          <View style={styles.loginField}>
            <Text style={styles.fieldLabel}>비밀번호</Text>
            <View style={styles.loginInputWrap}>
              <Ionicons name="lock-closed-outline" size={28} color="rgba(255,255,255,0.72)" />
              <TextInput
                editable={!isLoading}
                onChangeText={setPassword}
                placeholder="비밀번호를 입력하세요"
                placeholderTextColor="rgba(255,255,255,0.48)"
                secureTextEntry={!passwordVisible}
                style={styles.loginTextInput}
                value={password}
              />
              <Pressable
                accessibilityLabel={passwordVisible ? '비밀번호 숨기기' : '비밀번호 보기'}
                hitSlop={10}
                onPress={() => setPasswordVisible((current) => !current)}
                style={({ pressed }) => pressed && styles.pressed}>
                <Ionicons name={passwordVisible ? 'eye-off-outline' : 'eye-outline'} size={28} color="rgba(255,255,255,0.78)" />
              </Pressable>
            </View>
          </View>

          {isSignup && (
            <View style={styles.loginField}>
              <Text style={styles.fieldLabel}>비밀번호 확인</Text>
              <View style={styles.loginInputWrap}>
                <Ionicons name="lock-closed-outline" size={28} color="rgba(255,255,255,0.72)" />
                <TextInput
                  editable={!isLoading}
                  onChangeText={setConfirmPassword}
                  placeholder="비밀번호를 다시 입력하세요"
                  placeholderTextColor="rgba(255,255,255,0.48)"
                  secureTextEntry={!passwordVisible}
                  style={styles.loginTextInput}
                  value={confirmPassword}
                />
              </View>
            </View>
          )}
        </View>

        {!isSignup && (
          <View style={styles.loginOptionsRow}>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: rememberLogin }}
              onPress={() => setRememberLogin((current) => !current)}
              style={({ pressed }) => [styles.loginCheckboxRow, pressed && styles.pressed]}>
              <View style={[styles.loginCheckbox, rememberLogin && styles.loginCheckboxChecked]}>
                {rememberLogin ? <Ionicons name="checkmark" size={18} color="#050607" /> : null}
              </View>
              <Text style={styles.loginOptionText}>로그인 상태 유지</Text>
            </Pressable>
            <Pressable hitSlop={10} onPress={() => setAuthMessage('비밀번호 재설정은 아직 준비 중입니다.')} style={({ pressed }) => pressed && styles.pressed}>
              <Text style={styles.forgotPasswordText}>비밀번호를 잊으셨나요?</Text>
            </Pressable>
          </View>
        )}

        {authMessage ? <Text style={styles.authMessage}>{authMessage}</Text> : null}

        <Pressable
          disabled={isLoading}
          onPress={handleEmailAuth}
          style={({ pressed }) => [styles.loginButton, isLoading && styles.disabledButton, pressed && !isLoading && styles.pressed]}>
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.loginButtonText}>{isSignup ? '회원가입' : '로그인'}</Text>
          )}
        </Pressable>

        <View style={styles.loginSwitchRow}>
          <Text style={styles.signupText}>{isSignup ? '이미 계정이 있으신가요?' : '계정이 없으신가요?'}</Text>
          <Pressable disabled={isLoading} hitSlop={10} onPress={() => setAuthMode(isSignup ? 'login' : 'signup')} style={({ pressed }) => pressed && styles.pressed}>
            <Text style={styles.signupLinkText}>{isSignup ? '로그인' : '회원가입'}</Text>
          </Pressable>
        </View>

        <View style={styles.dividerRow}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>또는</Text>
          <View style={styles.divider} />
        </View>

        <View style={styles.socialAuthRow}>
          <AuthButton icon="logo-google" label="Google" onPress={handleGoogleAuth} />
          <AuthButton icon="logo-apple" label="Apple" onPress={() => setAuthMessage('Apple 로그인은 아직 준비 중입니다.')} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function HealthConnectScreen({
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
  const { height, width } = useWindowDimensions();
  const swipeTranslateX = useRef(new Animated.Value(0)).current;
  const isLoading = healthStatus === 'loading';
  const isConnected = healthStatus === 'connected';
  const hasMessage = healthSummary && healthSummary.status !== 'idle';
  const isCompact = height < 760;
  const isTiny = height < 700;
  const iosBackPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Platform.OS === 'ios' &&
          gesture.moveX - gesture.dx <= 28 &&
          gesture.dx > 10 &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.4,
        onPanResponderMove: (_, gesture) => {
          swipeTranslateX.setValue(Math.max(0, gesture.dx));
        },
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dx > width * 0.24 || gesture.vx > 0.55) {
            Animated.timing(swipeTranslateX, {
              duration: 180,
              easing: Easing.out(Easing.cubic),
              toValue: width,
              useNativeDriver: true,
            }).start(({ finished }) => {
              if (finished) {
                swipeTranslateX.setValue(0);
                onBack();
              }
            });
            return;
          }

          Animated.spring(swipeTranslateX, {
            damping: 22,
            stiffness: 220,
            toValue: 0,
            useNativeDriver: true,
          }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(swipeTranslateX, {
            damping: 22,
            stiffness: 220,
            toValue: 0,
            useNativeDriver: true,
          }).start();
        },
      }),
    [onBack, swipeTranslateX, width]
  );

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });

    return () => subscription.remove();
  }, [onBack]);

  return (
    <SafeAreaView style={styles.healthConnectScreen}>
      <Animated.View
        style={[
          styles.healthConnectSwipeSurface,
          Platform.OS === 'ios' && {
            transform: [{ translateX: swipeTranslateX }],
          },
        ]}
        {...(Platform.OS === 'ios' ? iosBackPanResponder.panHandlers : {})}>
        <View style={[styles.healthConnectContent, isCompact && styles.healthConnectContentCompact, isTiny && styles.healthConnectContentTiny]}>
        <Image
          resizeMode="contain"
          source={require('../../assets/images/astro-step-logo.png')}
          style={[styles.healthConnectLogo, isCompact && styles.healthConnectLogoCompact, isTiny && styles.healthConnectLogoTiny]}
        />

        <View style={[styles.appleHealthIcon, isCompact && styles.appleHealthIconCompact, isTiny && styles.appleHealthIconTiny]}>
          <Ionicons name="heart" size={isTiny ? 42 : isCompact ? 50 : 58} color="#FF1F32" />
        </View>

        <View style={[styles.healthConnectHeader, isCompact && styles.healthConnectHeaderCompact, isTiny && styles.healthConnectHeaderTiny]}>
          <Text style={[styles.healthConnectTitle, isCompact && styles.healthConnectTitleCompact, isTiny && styles.healthConnectTitleTiny]}>
            Apple Health에 연결하기
          </Text>
          <Text style={[styles.healthConnectSubtitle, isCompact && styles.healthConnectSubtitleCompact, isTiny && styles.healthConnectSubtitleTiny]}>
            걸음 수 기록을 불러와 더 정확한 여정을 시작하세요
          </Text>
        </View>

        <View style={[styles.healthBenefitList, isCompact && styles.healthBenefitListCompact, isTiny && styles.healthBenefitListTiny]}>
          <HealthBenefit compact={isCompact} tiny={isTiny} icon="footsteps" text="과거 걸음 수를 빠르게 가져와요" />
          <HealthBenefit compact={isCompact} tiny={isTiny} icon="stats-chart" text="실제 기록과 추정 기록을 구분해 보여줘요" />
          <HealthBenefit compact={isCompact} tiny={isTiny} icon="earth" text="당신의 지구 여정을 더 정확하게 계산해요" />
        </View>

        {hasMessage ? (
          <View style={[styles.healthConnectStatus, isCompact && styles.healthConnectStatusCompact]}>
            <Ionicons
              name={isConnected ? 'checkmark-circle' : 'information-circle'}
              size={22}
              color={isConnected ? '#BFD0EF' : '#A8B6D4'}
            />
            <Text style={styles.healthConnectStatusText}>
              {isConnected && healthSummary
                ? `${formatNumber(healthSummary.totalSteps)} 걸음을 가져왔어요`
                : healthSummary.message}
            </Text>
          </View>
        ) : null}

        <View style={[styles.healthConnectActions, isCompact && styles.healthConnectActionsCompact, isTiny && styles.healthConnectActionsTiny]}>
          <Pressable
            disabled={isLoading}
            onPress={isConnected ? onSkip : onConnect}
            style={({ pressed }) => [
              styles.healthConnectButton,
              isLoading && styles.disabledButton,
              pressed && !isLoading && styles.pressed,
            ]}>
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.healthConnectButtonText}>{isConnected ? '다음' : 'Apple 건강 활성화'}</Text>
            )}
          </Pressable>
          <Pressable onPress={onSkip} style={({ pressed }) => [styles.healthConnectLater, pressed && styles.pressed]}>
            <Text style={styles.healthConnectLaterText}>아마 나중에요</Text>
          </Pressable>
        </View>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

function HealthBenefit({
  compact = false,
  icon,
  text,
  tiny = false,
}: {
  compact?: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  tiny?: boolean;
}) {
  return (
    <View style={[styles.healthBenefitRow, tiny && styles.healthBenefitRowTiny]}>
      <Ionicons name={icon} size={tiny ? 22 : compact ? 26 : 30} color="#AAB6CF" style={styles.healthBenefitIcon} />
      <Text style={[styles.healthBenefitText, compact && styles.healthBenefitTextCompact, tiny && styles.healthBenefitTextTiny]}>{text}</Text>
    </View>
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
  const { height, width } = useWindowDimensions();
  const swipeTranslateX = useRef(new Animated.Value(0)).current;
  const isCompact = height < 760;
  const birthDateValue = formatBirthDateInput(`${year}${month}${day}`);
  const iosBackPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Platform.OS === 'ios' &&
          gesture.moveX - gesture.dx <= 28 &&
          gesture.dx > 10 &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.4,
        onPanResponderMove: (_, gesture) => {
          swipeTranslateX.setValue(Math.max(0, gesture.dx));
        },
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dx > width * 0.24 || gesture.vx > 0.55) {
            Animated.timing(swipeTranslateX, {
              duration: 180,
              easing: Easing.out(Easing.cubic),
              toValue: width,
              useNativeDriver: true,
            }).start(({ finished }) => {
              if (finished) {
                swipeTranslateX.setValue(0);
                onBack();
              }
            });
            return;
          }

          Animated.spring(swipeTranslateX, {
            damping: 22,
            stiffness: 220,
            toValue: 0,
            useNativeDriver: true,
          }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(swipeTranslateX, {
            damping: 22,
            stiffness: 220,
            toValue: 0,
            useNativeDriver: true,
          }).start();
        },
      }),
    [onBack, swipeTranslateX, width]
  );

  const handleBirthDateChange = (nextValue: string) => {
    const digits = nextValue.replace(/\D/g, '').slice(0, 8);

    onChangeYear(digits.slice(0, 4));
    onChangeMonth(digits.slice(4, 6));
    onChangeDay(digits.slice(6, 8));
  };

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });

    return () => subscription.remove();
  }, [onBack]);

  return (
    <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: undefined })} style={styles.birthdayScreen}>
      <TouchableWithoutFeedback accessible={false} onPress={Keyboard.dismiss}>
        <Animated.View
          style={[
            styles.birthdaySwipeSurface,
            Platform.OS === 'ios' && { transform: [{ translateX: swipeTranslateX }] },
          ]}
          {...(Platform.OS === 'ios' ? iosBackPanResponder.panHandlers : {})}>
          <View style={[styles.birthdayContent, isCompact && styles.birthdayContentCompact]}>
            <Image
              resizeMode="contain"
              source={require('../../assets/images/astro-step-logo.png')}
              style={[styles.birthdayLogo, isCompact && styles.birthdayLogoCompact]}
            />

            <View style={[styles.birthdayHeader, isCompact && styles.birthdayHeaderCompact]}>
              <Ionicons name="calendar-clear-outline" size={34} color="#FFFFFF" style={styles.birthdayHeaderIcon} />
              <Text style={[styles.birthdayTitle, isCompact && styles.birthdayTitleCompact]}>
                지구에서 여행을 시작한 지{'\n'}얼마나 되었나요?
              </Text>
              <Text style={styles.birthdayCopy}>기록되지 않은 과거 걸음을 추정하기 위해 필요해요</Text>
            </View>

            <View style={[styles.birthdayForm, isCompact && styles.birthdayFormCompact]}>
              <Text style={styles.birthdayLabel}>생년월일</Text>
              <View style={styles.birthdayInputWrap}>
                <TextInput
                  keyboardType="number-pad"
                  maxLength={10}
                  onChangeText={handleBirthDateChange}
                  placeholder="1998.06.21"
                  placeholderTextColor="rgba(255,255,255,0.42)"
                  style={styles.birthdayInput}
                  value={birthDateValue}
                />
                <Ionicons name="calendar-outline" size={25} color="rgba(255,255,255,0.64)" />
              </View>
              <Text style={styles.birthdayHint}>입력한 생년월일은 추정 기록 계산에만 사용돼요</Text>
              <Pressable hitSlop={10} style={({ pressed }) => pressed && styles.pressed}>
                <Text style={styles.birthdayHelpLink}>왜 필요한가요?</Text>
              </Pressable>
            </View>

            <Pressable
              disabled={!canContinue}
              onPress={onNext}
              style={({ pressed }) => [
                styles.birthdayNextButton,
                !canContinue && styles.disabledButton,
                pressed && canContinue && styles.pressed,
              ]}>
              <Text style={styles.birthdayNextButtonText}>다음</Text>
            </Pressable>
          </View>
        </Animated.View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

function CalculatingScreen() {
  return (
    <View style={styles.calculatingScreen}>
      <View style={styles.calculatingContent}>
        <Image
          resizeMode="contain"
          source={require('../../assets/images/astro-step-logo.png')}
          style={styles.calculatingLogo}
        />

        <View style={styles.calculatingHeader}>
          <Text style={styles.calculatingTitle}>우주여행 경로를{'\n'}계산중입니다</Text>
          <Text style={styles.calculatingCopy}>잠시만 기다려주세요</Text>
        </View>

        <View style={styles.calculatingOrbitScene}>
          <View style={styles.calculatingStarOne} />
          <View style={styles.calculatingStarTwo} />
          <View style={styles.calculatingStarThree} />
          <View style={styles.calculatingOrbitOuter} />
          <View style={styles.calculatingOrbitInner} />
          <View style={[styles.calculatingOrbitDot, styles.calculatingOrbitDotTop]} />
          <View style={[styles.calculatingOrbitDot, styles.calculatingOrbitDotRight]} />
          <View style={[styles.calculatingOrbitDot, styles.calculatingOrbitDotBottom]} />
          <View style={[styles.calculatingOrbitDot, styles.calculatingOrbitDotLeft]} />
          <View style={styles.calculatingEarth}>
            <Ionicons name="earth-outline" size={70} color="#9BD6FF" />
          </View>
          <View style={styles.calculatingTrail}>
            <View style={styles.calculatingTrailDot} />
            <View style={styles.calculatingTrailDot} />
            <View style={styles.calculatingTrailDot} />
            <View style={styles.calculatingTrailDot} />
          </View>
          <View style={styles.calculatingRocket}>
            <Ionicons name="rocket-outline" size={78} color="#B9E3FF" />
          </View>
        </View>

        <View style={styles.calculatingInfo}>
          <View style={styles.calculatingFormulaRow}>
            <Ionicons name="sparkles-outline" size={28} color="#58B9FF" />
            <Text style={styles.calculatingFormula}>
              우주 환산 공식: 걸음 수 × <Text style={styles.calculatingAccent}>7.5 km</Text> = 우주 환산 거리
            </Text>
          </View>
          <View style={styles.calculatingQuestionRow}>
            <Ionicons name="help-circle-outline" size={28} color="#58B9FF" />
            <Text style={styles.calculatingQuestion}>
              왜 7.5 km인가요? 우주왕복선이 지구에서 우주 궤도에 도달하려면 약 초속 7.5 km가 필요하기 때문에, Astro Step은 그 숫자에서 착안해 1보를 7.5 km의 우주 거리로 환산했어요.
            </Text>
          </View>
        </View>
      </View>
    </View>
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

function GlassPanel({ children, style }: { children: ReactNode; style?: object | object[] }) {
  return <View style={[styles.glass, style]}>{children}</View>;
}

function AuthButton({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.authButton, pressed && styles.pressed]}>
      <Ionicons name={icon} size={28} color="#FFFFFF" />
      <Text style={styles.authButtonText}>{label}</Text>
    </Pressable>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('ko-KR').format(Math.round(value));
}

function formatBirthDateInput(digits: string) {
  const normalized = digits.replace(/\D/g, '').slice(0, 8);
  const parts = [normalized.slice(0, 4), normalized.slice(4, 6), normalized.slice(6, 8)].filter(Boolean);

  return parts.join('.');
}

const styles = StyleSheet.create({
  agreementCheckbox: { alignItems: 'center', borderColor: 'rgba(255,255,255,0.7)', borderRadius: 8, borderWidth: 1.5, height: 32, justifyContent: 'center', width: 32 },
  agreementCheckboxChecked: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  agreementDescription: { color: 'rgba(255,255,255,0.68)', fontSize: 12, lineHeight: 18, marginTop: 8 },
  agreementLink: { color: '#8FA8D8', fontSize: 12, lineHeight: 18, marginTop: 14 },
  agreementRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 22, width: '100%' },
  agreementTextGroup: { flex: 1, paddingTop: 3 },
  agreementTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', lineHeight: 23 },
  appHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, width: '100%' },
  asteroidOne: { backgroundColor: '#9A9A9A', borderRadius: 12, height: 18, opacity: 0.75, position: 'absolute', right: 50, top: 210, width: 24 },
  asteroidTwo: { backgroundColor: '#5C5C5C', borderRadius: 999, height: 12, opacity: 0.75, position: 'absolute', right: 126, top: 250, width: 12 },
  astronautScene: { alignItems: 'center', height: 132, justifyContent: 'flex-end', marginTop: 18, overflow: 'hidden', width: '100%' },
  authButton: { alignItems: 'center', borderColor: 'rgba(255,255,255,0.28)', borderRadius: 14, borderWidth: 1.2, flex: 1, flexDirection: 'row', gap: 12, height: 52, justifyContent: 'center' },
  authButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', letterSpacing: 0 },
  authMessage: { color: '#FFD1D1', fontSize: 12, lineHeight: 18, marginTop: 10, textAlign: 'center' },
  backButton: { alignItems: 'center', height: 36, justifyContent: 'center', width: 36 },
  bellWrap: { position: 'relative' },
  birthInputRow: { alignItems: 'center', flexDirection: 'row', gap: 10, marginBottom: 28, marginTop: 24 },
  birthdayContent: { alignItems: 'center', flex: 1, paddingBottom: 30, paddingHorizontal: 36, paddingTop: 42 },
  birthdayContentCompact: { paddingBottom: 18, paddingHorizontal: 30, paddingTop: 20 },
  birthdayCopy: { color: 'rgba(255,255,255,0.72)', fontSize: 14, lineHeight: 21, marginTop: 22, textAlign: 'center' },
  birthdayForm: { marginTop: 36, width: '100%' },
  birthdayFormCompact: { marginTop: 22 },
  birthdayHeader: { alignItems: 'center', marginTop: 74, width: '100%' },
  birthdayHeaderCompact: { marginTop: 38 },
  birthdayHeaderIcon: { marginBottom: 18, opacity: 0.96 },
  birthdayHelpLink: { color: '#8DB5F5', fontSize: 16, fontWeight: '500', marginTop: 34, textAlign: 'center' },
  birthdayHint: { color: 'rgba(255,255,255,0.48)', fontSize: 13, lineHeight: 19, marginTop: 14, paddingHorizontal: 14 },
  birthdayInput: { color: '#FFFFFF', flex: 1, fontSize: 20, fontWeight: '400', letterSpacing: 0, padding: 0 },
  birthdayInputWrap: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.34)', borderRadius: 20, borderWidth: 1.2, flexDirection: 'row', gap: 14, height: 64, marginTop: 18, paddingHorizontal: 20, width: '100%' },
  birthdayLabel: { alignSelf: 'flex-start', color: '#FFFFFF', fontSize: 18, fontWeight: '700', lineHeight: 25 },
  birthdayLogo: { height: 62, width: 265 },
  birthdayLogoCompact: { height: 50, width: 220 },
  birthdayNextButton: { alignItems: 'center', backgroundColor: '#8992A2', borderRadius: 999, height: 60, justifyContent: 'center', marginTop: 'auto', shadowColor: '#AEB7C8', shadowOffset: { height: 10, width: 0 }, shadowOpacity: 0.18, shadowRadius: 22, width: '100%' },
  birthdayNextButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  birthdayPanel: { alignItems: 'center', backgroundColor: 'rgba(12,12,16,0.78)', borderColor: 'rgba(255,255,255,0.33)', borderRadius: 26, borderWidth: 1, marginTop: 28, padding: 22, width: '100%' },
  birthdayPanelTitle: { color: '#FFFFFF', fontSize: 23, fontWeight: '800', marginTop: 12 },
  birthdayScreen: { backgroundColor: '#050607', flex: 1 },
  birthdaySwipeSurface: { flex: 1 },
  birthdayTitle: { color: '#FFFFFF', fontSize: 28, fontWeight: '800', lineHeight: 35, textAlign: 'center', textShadowColor: 'rgba(255,255,255,0.35)', textShadowRadius: 12 },
  birthdayTitleCompact: { fontSize: 25, lineHeight: 31 },
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
  calculatingAccent: { color: '#58B9FF' },
  calculatingContent: { alignItems: 'center', flex: 1, paddingBottom: 34, paddingHorizontal: 34, paddingTop: 74 },
  calculatingCopy: { color: 'rgba(255,255,255,0.62)', fontSize: 18, lineHeight: 26, marginTop: 28, textAlign: 'center' },
  calculatingEarth: { alignItems: 'center', bottom: 62, height: 88, justifyContent: 'center', left: 56, position: 'absolute', shadowColor: '#58B9FF', shadowOpacity: 0.9, shadowRadius: 18, width: 88 },
  calculatingFormula: { color: 'rgba(255,255,255,0.82)', flex: 1, fontSize: 16, lineHeight: 24 },
  calculatingFormulaRow: { alignItems: 'center', flexDirection: 'row', gap: 18, width: '100%' },
  calculatingHeader: { alignItems: 'center', marginTop: 130, width: '100%' },
  calculatingInfo: { gap: 28, marginTop: 42, width: '100%' },
  calculatingLogo: { height: 62, width: 265 },
  calculatingOrbitDot: { backgroundColor: '#8DD1FF', borderRadius: 999, height: 16, position: 'absolute', shadowColor: '#67C4FF', shadowOpacity: 1, shadowRadius: 14, width: 16 },
  calculatingOrbitDotBottom: { bottom: -8, left: 162 },
  calculatingOrbitDotLeft: { left: -8, top: 118 },
  calculatingOrbitDotRight: { right: -8, top: 118 },
  calculatingOrbitDotTop: { left: 162, top: -8 },
  calculatingOrbitInner: { borderColor: 'rgba(88,185,255,0.38)', borderRadius: 999, borderStyle: 'dotted', borderWidth: 1.2, height: 260, left: 37, position: 'absolute', top: 20, width: 260 },
  calculatingOrbitOuter: { borderColor: 'rgba(88,185,255,0.62)', borderRadius: 999, borderWidth: 1, height: 300, left: 17, position: 'absolute', top: 0, width: 300 },
  calculatingOrbitScene: { height: 300, marginTop: 46, position: 'relative', width: 334 },
  calculatingQuestion: { color: 'rgba(255,255,255,0.62)', flex: 1, fontSize: 16, lineHeight: 31 },
  calculatingQuestionRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 18, width: '100%' },
  calculatingRocket: { position: 'absolute', right: 58, shadowColor: '#58B9FF', shadowOpacity: 0.9, shadowRadius: 18, top: 92, transform: [{ rotate: '38deg' }] },
  calculatingScreen: { backgroundColor: '#050607', flex: 1 },
  calculatingStarOne: { backgroundColor: '#8DD1FF', borderRadius: 999, height: 3, left: 10, position: 'absolute', top: 22, width: 3 },
  calculatingStarThree: { backgroundColor: '#8DD1FF', borderRadius: 999, height: 3, position: 'absolute', right: 14, top: 38, width: 3 },
  calculatingStarTwo: { backgroundColor: '#8DD1FF', borderRadius: 999, height: 4, left: 46, position: 'absolute', top: 194, width: 4 },
  calculatingTitle: { color: '#FFFFFF', fontSize: 34, fontWeight: '900', letterSpacing: 0, lineHeight: 48, textAlign: 'center', textShadowColor: 'rgba(255,255,255,0.34)', textShadowRadius: 14 },
  calculatingTrail: { alignItems: 'center', flexDirection: 'row', gap: 10, left: 138, position: 'absolute', top: 170, transform: [{ rotate: '-24deg' }] },
  calculatingTrailDot: { backgroundColor: '#8DD1FF', borderRadius: 999, height: 4, shadowColor: '#58B9FF', shadowOpacity: 0.8, shadowRadius: 8, width: 4 },
  dateDot: { color: 'rgba(255,255,255,0.5)', fontSize: 22, fontWeight: '800' },
  dateInput: { color: '#FFFFFF', fontSize: 20, fontWeight: '800', letterSpacing: 0, padding: 0, textAlign: 'center' },
  dateInputWrap: { alignItems: 'center', borderColor: 'rgba(255,255,255,0.26)', borderRadius: 16, borderWidth: 1, gap: 5, height: 78, justifyContent: 'center', width: 76 },
  dateLabel: { color: 'rgba(255,255,255,0.52)', fontSize: 12 },
  disabledButton: { opacity: 0.42 },
  divider: { backgroundColor: 'rgba(255,255,255,0.2)', flex: 1, height: 1 },
  dividerRow: { alignItems: 'center', flexDirection: 'row', gap: 18, marginTop: 24, width: '100%' },
  dividerText: { color: 'rgba(255,255,255,0.72)', fontSize: 14 },
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
  appleHealthIcon: { alignItems: 'center', alignSelf: 'center', backgroundColor: '#FFFFFF', borderRadius: 26, height: 104, justifyContent: 'center', marginTop: 42, shadowColor: '#FFFFFF', shadowOffset: { height: 14, width: 0 }, shadowOpacity: 0.2, shadowRadius: 26, width: 104 },
  appleHealthIconCompact: { borderRadius: 22, height: 82, marginTop: 22, width: 82 },
  appleHealthIconTiny: { borderRadius: 18, height: 68, marginTop: 12, width: 68 },
  healthBackButton: { alignItems: 'center', height: 44, justifyContent: 'center', left: 16, position: 'absolute', top: Platform.select({ ios: 58, default: 28 }), width: 44, zIndex: 4 },
  healthBenefitIcon: { width: 48 },
  healthBenefitList: { gap: 24, marginTop: 34, width: '100%' },
  healthBenefitListCompact: { gap: 16, marginTop: 22 },
  healthBenefitListTiny: { gap: 12, marginTop: 14 },
  healthBenefitRow: { alignItems: 'center', flexDirection: 'row', gap: 14, width: '100%' },
  healthBenefitRowTiny: { gap: 10 },
  healthBenefitText: { color: 'rgba(255,255,255,0.78)', flex: 1, fontSize: 14, fontWeight: '500', lineHeight: 21 },
  healthBenefitTextCompact: { fontSize: 13, lineHeight: 19 },
  healthBenefitTextTiny: { fontSize: 11, lineHeight: 16 },
  healthConnectActions: { gap: 12, marginTop: 'auto', paddingTop: 14, width: '100%' },
  healthConnectActionsCompact: { gap: 8, paddingTop: 10 },
  healthConnectActionsTiny: { gap: 4, paddingTop: 6 },
  healthConnectButton: { alignItems: 'center', backgroundColor: '#8992A2', borderRadius: 999, height: 56, justifyContent: 'center', shadowColor: '#AEB7C8', shadowOffset: { height: 10, width: 0 }, shadowOpacity: 0.18, shadowRadius: 22, width: '100%' },
  healthConnectButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  healthConnectContent: { alignItems: 'center', flex: 1, paddingBottom: 8, paddingHorizontal: 38, paddingTop: 24 },
  healthConnectContentCompact: { paddingBottom: 4, paddingHorizontal: 30, paddingTop: 14 },
  healthConnectContentTiny: { paddingBottom: 0, paddingHorizontal: 28, paddingTop: 6 },
  healthConnectHeader: { alignItems: 'center', marginTop: 36, width: '100%' },
  healthConnectHeaderCompact: { marginTop: 20 },
  healthConnectHeaderTiny: { marginTop: 12 },
  healthConnectLater: { alignItems: 'center', minHeight: 30, justifyContent: 'center' },
  healthConnectLaterText: { color: '#8EA5D2', fontSize: 13, fontWeight: '500' },
  healthConnectLogo: { height: 54, width: 232 },
  healthConnectLogoCompact: { height: 40, width: 190 },
  healthConnectLogoTiny: { height: 32, width: 158 },
  healthConnectScreen: { backgroundColor: '#050607', flex: 1 },
  healthConnectStatus: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)', borderRadius: 18, borderWidth: 1, flexDirection: 'row', gap: 10, marginTop: 14, paddingHorizontal: 16, paddingVertical: 10, width: '100%' },
  healthConnectStatusCompact: { marginTop: 8, paddingVertical: 7 },
  healthConnectStatusText: { color: 'rgba(255,255,255,0.76)', flex: 1, fontSize: 14, lineHeight: 20 },
  healthConnectSwipeSurface: { flex: 1 },
  healthConnectSubtitle: { color: 'rgba(255,255,255,0.74)', fontSize: 13, fontWeight: '400', lineHeight: 20, marginTop: 12, textAlign: 'center' },
  healthConnectSubtitleCompact: { fontSize: 12, lineHeight: 18, marginTop: 8 },
  healthConnectSubtitleTiny: { fontSize: 11, lineHeight: 16, marginTop: 5 },
  healthConnectTitle: { color: '#FFFFFF', fontSize: 26, fontWeight: '800', letterSpacing: 0, lineHeight: 33, textAlign: 'center', textShadowColor: 'rgba(255,255,255,0.38)', textShadowRadius: 12 },
  healthConnectTitleCompact: { fontSize: 22, lineHeight: 28 },
  healthConnectTitleTiny: { fontSize: 20, lineHeight: 25 },
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
  fieldLabel: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  floatingBackButton: { alignItems: 'center', height: 42, justifyContent: 'center', left: 18, position: 'absolute', top: 18, width: 42, zIndex: 5 },
  forgotPasswordText: { color: '#7EA2FF', fontSize: 13, fontWeight: '600' },
  logoBlock: { alignItems: 'center', width: '100%' },
  logoCompact: { alignItems: 'center', width: 210 },
  logoLarge: { alignItems: 'center', width: 260 },
  logoTagline: { color: '#FFFFFF', fontFamily: 'Exo 2', fontSize: 16, fontWeight: '200', letterSpacing: 3.2, marginTop: 10, textAlign: 'center' },
  logoTaglineCompact: { color: '#FFFFFF', fontFamily: 'Exo 2', fontSize: 8, fontWeight: '200', letterSpacing: 1.6, marginTop: 5, textAlign: 'center' },
  logoTaglineLarge: { color: '#FFFFFF', fontFamily: 'Exo 2', fontSize: 11, fontWeight: '200', letterSpacing: 1.76, marginTop: 7, textAlign: 'center' },
  logoText: { color: '#FFFFFF', fontFamily: 'Exo 2', fontSize: 54, fontWeight: '200', letterSpacing: 8.64, lineHeight: 64, textAlign: 'center' },
  logoTextCompact: { color: '#FFFFFF', fontFamily: 'Exo 2', fontSize: 27, fontWeight: '200', letterSpacing: 4.32, lineHeight: 34, textAlign: 'center' },
  logoTextLarge: { color: '#FFFFFF', fontFamily: 'Exo 2', fontSize: 33, fontWeight: '200', letterSpacing: 5.28, lineHeight: 40, textAlign: 'center' },
  loginBrandImage: { alignSelf: 'center', height: 64, marginTop: 18, width: 265 },
  loginButton: { alignItems: 'center', backgroundColor: '#8E96A6', borderRadius: 16, height: 52, justifyContent: 'center', marginTop: 22, shadowColor: '#FFFFFF', shadowOffset: { height: 10, width: 0 }, shadowOpacity: 0.14, shadowRadius: 20, width: '100%' },
  loginButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  loginCheckbox: { alignItems: 'center', borderColor: 'rgba(255,255,255,0.34)', borderRadius: 5, borderWidth: 1.4, height: 20, justifyContent: 'center', width: 20 },
  loginCheckboxChecked: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  loginCheckboxRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  loginContent: { flexGrow: 1, paddingBottom: 24, paddingHorizontal: 36, paddingTop: 4 },
  loginDescription: { color: 'rgba(255,255,255,0.72)', fontSize: 14, lineHeight: 21, marginTop: 8, textAlign: 'center' },
  loginField: { gap: 10, width: '100%' },
  loginForm: { gap: 22, marginTop: 34, width: '100%' },
  loginGlassPanel: { backgroundColor: 'rgba(255,255,255,0.16)', borderColor: 'rgba(255,255,255,0.42)', borderWidth: 1.2, paddingHorizontal: 26, paddingVertical: 30, shadowColor: '#FFFFFF', shadowOffset: { height: 10, width: 0 }, shadowOpacity: 0.28, shadowRadius: 30 },
  loginHeader: { alignItems: 'center', marginTop: 34, width: '100%' },
  loginInputWrap: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.07)', borderColor: 'rgba(255,255,255,0.22)', borderRadius: 13, borderWidth: 1.2, flexDirection: 'row', gap: 16, height: 52, paddingHorizontal: 16, width: '100%' },
  loginLogoWrap: { alignItems: 'center', width: '100%' },
  loginOptionText: { color: 'rgba(255,255,255,0.82)', fontSize: 13 },
  loginOptionsRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 18, width: '100%' },
  loginScreen: { backgroundColor: '#050607', flex: 1 },
  loginSwitchRow: { alignItems: 'center', flexDirection: 'row', gap: 4, justifyContent: 'center', marginTop: 22 },
  loginTextInput: { color: '#FFFFFF', flex: 1, fontSize: 14, fontWeight: '500', letterSpacing: 0, padding: 0 },
  loginTitle: { color: '#FFFFFF', fontSize: 28, fontWeight: '800', lineHeight: 35, textAlign: 'center', textShadowColor: 'rgba(255,255,255,0.4)', textShadowRadius: 14 },
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
  onboardingActionArea: { alignItems: 'center', gap: 20, paddingBottom: 64, paddingHorizontal: 42, width: '100%' },
  onboardingActionAreaCompact: { gap: 14, paddingBottom: 40 },
  onboardingBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: '#050607', overflow: 'hidden' },
  onboardingButton: { alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 999, height: 58, justifyContent: 'center', overflow: 'hidden', shadowColor: '#FFFFFF', shadowOffset: { height: 10, width: 0 }, shadowOpacity: 0.16, shadowRadius: 18, width: '100%' },
  onboardingButtonText: { color: '#050607', fontSize: 17, fontWeight: '700', letterSpacing: 0 },
  onboardingCarousel: { flexGrow: 0, height: 214, width: '100%' },
  onboardingCopyArea: { alignItems: 'center', flex: 1, justifyContent: 'center', paddingTop: 18, width: '100%' },
  onboardingCopyAreaCompact: { justifyContent: 'flex-start', paddingTop: 34 },
  onboardingDot: { backgroundColor: '#34383D', borderRadius: 999, height: 7, width: 7 },
  onboardingDotActive: { backgroundColor: '#7897F2', transform: [{ scale: 1.14 }] },
  onboardingDots: { alignItems: 'center', flexDirection: 'row', gap: 10, marginTop: 35 },
  onboardingGlowCenter: { backgroundColor: 'rgba(190,204,225,0.08)', borderRadius: 999, height: 420, left: -30, position: 'absolute', top: 260, transform: [{ rotate: '-10deg' }], width: 460 },
  onboardingGlowTop: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 999, height: 260, position: 'absolute', right: -90, top: -40, width: 260 },
  onboardingLoginLink: { color: '#89A7F2', fontSize: 15, fontWeight: '600', letterSpacing: 0, textAlign: 'center' },
  onboardingLogoArea: { alignItems: 'center', height: 232, justifyContent: 'flex-end', paddingHorizontal: 28, width: '100%' },
  onboardingLogoAreaCompact: { height: 190 },
  onboardingLogoImage: { height: 64, width: 265 },
  onboardingScreen: { backgroundColor: '#050607', flex: 1, justifyContent: 'space-between' },
  onboardingSlide: { alignItems: 'center', height: 214, justifyContent: 'center', paddingHorizontal: 28 },
  onboardingSlideIcon: { marginBottom: 16, opacity: 0.96 },
  onboardingSubtitle: { color: 'rgba(255,255,255,0.68)', fontSize: 13, fontWeight: '400', lineHeight: 21, marginTop: 30, textAlign: 'center' },
  onboardingTitle: { color: '#FFFFFF', fontSize: 34, fontWeight: '400', letterSpacing: 0, lineHeight: 42, textAlign: 'center' },
  onboardingVignette: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.28)' },
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
  plainSafe: { backgroundColor: '#050607' },
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
  signupLinkText: { color: '#7EA2FF', fontSize: 13, fontWeight: '800' },
  signupText: { color: 'rgba(255,255,255,0.78)', fontSize: 13 },
  socialAuthRow: { flexDirection: 'row', gap: 20, marginTop: 24, width: '100%' },
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
  termsActionArea: { alignItems: 'center', gap: 22, marginTop: 58, paddingHorizontal: 0, width: '100%' },
  termsActionAreaCompact: { gap: 16, marginTop: 34 },
  termsContent: { backgroundColor: '#050607', flex: 1, paddingBottom: 38, paddingHorizontal: 36, paddingTop: 28 },
  termsContentCompact: { paddingBottom: 26, paddingHorizontal: 30, paddingTop: 18 },
  termsDivider: { backgroundColor: 'rgba(255,255,255,0.26)', height: 1, marginVertical: 30, width: '100%' },
  termsHeader: { alignItems: 'center', marginTop: 58 },
  termsHeaderCompact: { marginTop: 34 },
  termsLaterLink: { color: '#8FA8D8', fontSize: 14, fontWeight: '500', textAlign: 'center' },
  termsList: { marginTop: 52, width: '100%' },
  termsListCompact: { marginTop: 34 },
  termsLogoImage: { height: 63, width: 260 },
  termsLogoWrap: { alignItems: 'center', width: '100%' },
  termsPrimaryButton: { alignItems: 'center', backgroundColor: '#8C95A5', borderRadius: 999, height: 60, justifyContent: 'center', shadowColor: '#FFFFFF', shadowOffset: { height: 10, width: 0 }, shadowOpacity: 0.13, shadowRadius: 18, width: '100%' },
  termsPrimaryButtonDisabled: { opacity: 0.52 },
  termsPrimaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  termsSubtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 14, lineHeight: 21, marginTop: 18, textAlign: 'center' },
  termsTitle: { color: '#FFFFFF', fontSize: 28, fontWeight: '800', lineHeight: 35, textAlign: 'center' },
  passwordHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  textInputGlass: { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.2)', borderRadius: 13, borderWidth: 1, color: '#FFFFFF', fontSize: 14, minHeight: 46, paddingHorizontal: 13 },
  venus: { height: 28, right: 92, top: 138, width: 28 },
});
