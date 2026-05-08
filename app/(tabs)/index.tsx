import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
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

type Step = 'splash' | 'privacy' | 'login' | 'health' | 'birthday' | 'calculating' | 'main';

const orbitMetrics = [
  { label: '태양 기준 이동', value: '77,084 km', delta: '+1.92 AU sync' },
  { label: '은하 회전 보정', value: '621.4 km/s', delta: 'Milky Way vector' },
  { label: '오늘 걸음 변환', value: '8,426 step', delta: '6.18 km surface' },
];

export default function HomeScreen() {
  const [step, setStep] = useState<Step>('splash');
  const [birthDate, setBirthDate] = useState('');

  useEffect(() => {
    if (step !== 'splash') {
      return;
    }

    const timer = setTimeout(() => setStep('privacy'), 1600);
    return () => clearTimeout(timer);
  }, [step]);

  useEffect(() => {
    if (step !== 'calculating') {
      return;
    }

    const timer = setTimeout(() => setStep('main'), 2200);
    return () => clearTimeout(timer);
  }, [step]);

  const canContinueBirthday = useMemo(() => /^\d{4}\.\d{2}\.\d{2}$/.test(birthDate), [birthDate]);
  const handleBirthDateChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 8);
    const parts = [digits.slice(0, 4), digits.slice(4, 6), digits.slice(6, 8)].filter(Boolean);
    setBirthDate(parts.join('.'));
  };

  return (
    <SpaceFrame>
      {step === 'splash' && <SplashScreen />}
      {step === 'privacy' && <PrivacyScreen onNext={() => setStep('login')} />}
      {step === 'login' && <LoginScreen onNext={() => setStep('health')} />}
      {step === 'health' && <HealthScreen onNext={() => setStep('birthday')} />}
      {step === 'birthday' && (
        <BirthdayScreen
          birthDate={birthDate}
          canContinue={canContinueBirthday}
          onChangeBirthDate={handleBirthDateChange}
          onNext={() => setStep('calculating')}
        />
      )}
      {step === 'calculating' && <CalculatingScreen />}
      {step === 'main' && <MainScreen birthDate={birthDate} onRestart={() => setStep('privacy')} />}
    </SpaceFrame>
  );
}

function SpaceFrame({ children }: { children: ReactNode }) {
  return (
    <View style={styles.root}>
      <View style={styles.deepSpace} />
      <View style={[styles.star, styles.starOne]} />
      <View style={[styles.star, styles.starTwo]} />
      <View style={[styles.star, styles.starThree]} />
      <View style={styles.orbitRing} />
      <SafeAreaView style={styles.safe}>{children}</SafeAreaView>
    </View>
  );
}

function SplashScreen() {
  return (
    <View style={styles.center}>
      <View style={styles.logoShell}>
        <Ionicons name="planet-outline" size={58} color="#F7F7F7" />
      </View>
      <Text style={styles.brand}>Astro Step</Text>
      <Text style={styles.caption}>COSMIC POSITIONING FROM YOUR STEPS</Text>
      <ActivityIndicator color="#FFFFFF" style={styles.loader} />
    </View>
  );
}

function PrivacyScreen({ onNext }: { onNext: () => void }) {
  return (
    <PanelScreen
      eyebrow="01 / CONSENT"
      title="개인정보 처리 약관"
      body="걸음 수, 생년월일, 로그인 식별자는 우주 위치 계산과 기기 간 동기화에만 사용됩니다."
      icon="shield-checkmark-outline">
      <GlassPanel>
        <InfoRow label="필수" value="서비스 이용 약관 및 개인정보 처리방침" />
        <InfoRow label="보관" value="계정 삭제 시 즉시 파기" />
        <InfoRow label="권한" value="건강 데이터는 사용자가 승인한 항목만 접근" />
      </GlassPanel>
      <PrimaryButton label="동의하고 계속" icon="checkmark" onPress={onNext} />
    </PanelScreen>
  );
}

function LoginScreen({ onNext }: { onNext: () => void }) {
  return (
    <PanelScreen
      eyebrow="02 / SIGN IN"
      title="계정 연결"
      body="iOS와 Android에서 동일한 우주 이동 기록을 이어갈 수 있도록 로그인합니다."
      icon="person-circle-outline">
      <AuthButton label="Google로 계속" icon="logo-google" onPress={onNext} />
      <AuthButton label="Apple로 계속" icon="logo-apple" onPress={onNext} />
    </PanelScreen>
  );
}

function HealthScreen({ onNext }: { onNext: () => void }) {
  return (
    <PanelScreen
      eyebrow="03 / HEALTH"
      title="건강앱 연동"
      body="Apple Health 또는 Google Fit의 걸음 수를 읽어 하루 단위의 우주 이동량으로 환산합니다."
      icon="fitness-outline">
      <GlassPanel>
        <InfoRow label="읽기" value="걸음 수, 거리, 활동 시간" />
        <InfoRow label="쓰기" value="없음" />
        <InfoRow label="동기화" value="백그라운드 갱신 준비" />
      </GlassPanel>
      <PrimaryButton label="건강 데이터 연동 동의" icon="pulse" onPress={onNext} />
    </PanelScreen>
  );
}

function BirthdayScreen({
  birthDate,
  canContinue,
  onChangeBirthDate,
  onNext,
}: {
  birthDate: string;
  canContinue: boolean;
  onChangeBirthDate: (value: string) => void;
  onNext: () => void;
}) {
  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: 'padding', android: undefined })}
      style={styles.flex}>
      <PanelScreen
        eyebrow="04 / ORIGIN"
        title="생년월일 입력"
        body="출생일부터 현재까지 지구, 태양계, 은하 기준 누적 이동 좌표를 계산합니다."
        icon="calendar-outline">
        <TextInput
          keyboardType="number-pad"
          maxLength={10}
          onChangeText={onChangeBirthDate}
          placeholder="YYYY.MM.DD"
          placeholderTextColor="rgba(255,255,255,0.38)"
          style={styles.input}
          value={birthDate}
        />
        <PrimaryButton
          disabled={!canContinue}
          label="우주 좌표 계산"
          icon="sparkles-outline"
          onPress={onNext}
        />
      </PanelScreen>
    </KeyboardAvoidingView>
  );
}

function CalculatingScreen() {
  return (
    <View style={styles.center}>
      <View style={styles.scanPanel}>
        <ActivityIndicator color="#FFFFFF" size="large" />
        <Text style={styles.scanTitle}>좌표 계산 중</Text>
        <Text style={styles.scanCopy}>걸음 벡터와 태양계 공전 데이터를 정렬하고 있습니다.</Text>
        <View style={styles.progressTrack}>
          <View style={styles.progressFill} />
        </View>
      </View>
    </View>
  );
}

function MainScreen({ birthDate, onRestart }: { birthDate: string; onRestart: () => void }) {
  return (
    <ScrollView contentContainerStyle={styles.mainContent} showsVerticalScrollIndicator={false}>
      <View style={styles.mainHeader}>
        <Text style={styles.caption}>CURRENT COSMIC POSITION</Text>
        <Pressable accessibilityLabel="온보딩 다시 시작" onPress={onRestart} style={styles.iconButton}>
          <Ionicons name="refresh" size={18} color="#FFFFFF" />
        </Pressable>
      </View>
      <Text style={styles.heroNumber}>+0.000042 AU</Text>
      <Text style={styles.heroLabel}>오늘의 보행이 태양 기준 궤도에 더한 거리</Text>

      <View style={styles.spaceMap}>
        <View style={styles.mapOrbit} />
        <View style={styles.mapOrbitSmall} />
        <View style={styles.earthDot} />
        <View style={styles.userDot} />
        <Text style={styles.mapLabel}>EARTH RELATIVE VECTOR</Text>
      </View>

      <View style={styles.grid}>
        {orbitMetrics.map((metric) => (
          <View key={metric.label} style={styles.metricCard}>
            <Text style={styles.metricLabel}>{metric.label}</Text>
            <Text style={styles.metricValue}>{metric.value}</Text>
            <Text style={styles.metricDelta}>{metric.delta}</Text>
          </View>
        ))}
      </View>

      <GlassPanel>
        <InfoRow label="출생 기준점" value={birthDate || '1990.01.01'} />
        <InfoRow label="현재 좌표" value="RA 18h 36m / Dec +38.7" />
        <InfoRow label="정밀도" value="Expo Go 데모 모드" />
      </GlassPanel>
    </ScrollView>
  );
}

function PanelScreen({
  body,
  children,
  eyebrow,
  icon,
  title,
}: {
  body: string;
  children: ReactNode;
  eyebrow: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
}) {
  return (
    <ScrollView contentContainerStyle={styles.panelContent} keyboardShouldPersistTaps="handled">
      <View style={styles.panelIcon}>
        <Ionicons name={icon} size={34} color="#FFFFFF" />
      </View>
      <Text style={styles.caption}>{eyebrow}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      <View style={styles.actions}>{children}</View>
    </ScrollView>
  );
}

function GlassPanel({ children }: { children: ReactNode }) {
  return <View style={styles.glass}>{children}</View>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function PrimaryButton({
  disabled,
  icon,
  label,
  onPress,
}: {
  disabled?: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        disabled && styles.disabledButton,
        pressed && !disabled && styles.pressed,
      ]}>
      <Ionicons name={icon} size={19} color="#050505" />
      <Text style={styles.primaryLabel}>{label}</Text>
    </Pressable>
  );
}

function AuthButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.authButton, pressed && styles.pressed]}>
      <Ionicons name={icon} size={22} color="#FFFFFF" />
      <Text style={styles.authLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: 14,
    marginTop: 30,
    width: '100%',
  },
  authButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 22,
  },
  authLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  body: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 16,
    lineHeight: 25,
    marginTop: 16,
    textAlign: 'center',
  },
  brand: {
    color: '#FFFFFF',
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: 0,
    marginTop: 24,
  },
  caption: {
    color: 'rgba(255,255,255,0.54)',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
    textAlign: 'center',
  },
  center: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  deepSpace: {
    backgroundColor: '#020204',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  disabledButton: {
    opacity: 0.36,
  },
  earthDot: {
    backgroundColor: '#FFFFFF',
    borderRadius: 13,
    height: 26,
    left: '48%',
    position: 'absolute',
    top: '47%',
    width: 26,
  },
  flex: {
    flex: 1,
  },
  glass: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 28,
    borderWidth: 1,
    padding: 18,
    width: '100%',
  },
  grid: {
    gap: 12,
  },
  heroLabel: {
    color: 'rgba(255,255,255,0.64)',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
  },
  heroNumber: {
    color: '#FFFFFF',
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: 0,
    marginTop: 28,
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 18,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  infoLabel: {
    color: 'rgba(255,255,255,0.48)',
    fontSize: 12,
    fontWeight: '800',
    width: 86,
  },
  infoRow: {
    alignItems: 'center',
    borderBottomColor: 'rgba(255,255,255,0.08)',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 42,
  },
  infoValue: {
    color: '#FFFFFF',
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 24,
    borderWidth: 1,
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    minHeight: 64,
    paddingHorizontal: 22,
    textAlign: 'center',
  },
  loader: {
    marginTop: 26,
  },
  logoShell: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.22)',
    borderRadius: 42,
    borderWidth: 1,
    height: 84,
    justifyContent: 'center',
    width: 84,
  },
  mainContent: {
    padding: 22,
    paddingBottom: 120,
  },
  mainHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  mapLabel: {
    bottom: 18,
    color: 'rgba(255,255,255,0.46)',
    fontSize: 11,
    fontWeight: '800',
    left: 20,
    letterSpacing: 0,
    position: 'absolute',
  },
  mapOrbit: {
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: 118,
    borderWidth: 1,
    height: 236,
    position: 'absolute',
    width: 236,
  },
  mapOrbitSmall: {
    borderColor: 'rgba(255,255,255,0.24)',
    borderRadius: 72,
    borderWidth: 1,
    height: 144,
    position: 'absolute',
    width: 144,
  },
  metricCard: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
  },
  metricDelta: {
    color: 'rgba(255,255,255,0.46)',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 8,
  },
  metricLabel: {
    color: 'rgba(255,255,255,0.54)',
    fontSize: 12,
    fontWeight: '800',
  },
  metricValue: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    marginTop: 8,
  },
  orbitRing: {
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 240,
    borderWidth: 1,
    height: 480,
    position: 'absolute',
    right: -220,
    top: 86,
    transform: [{ rotate: '-22deg' }],
    width: 480,
  },
  panelContent: {
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    paddingBottom: 80,
  },
  panelIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 34,
    borderWidth: 1,
    height: 68,
    justifyContent: 'center',
    marginBottom: 22,
    width: 68,
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.99 }],
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    minHeight: 56,
    paddingHorizontal: 22,
  },
  primaryLabel: {
    color: '#050505',
    fontSize: 16,
    fontWeight: '900',
  },
  progressFill: {
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    height: '100%',
    width: '68%',
  },
  progressTrack: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 999,
    height: 8,
    marginTop: 24,
    overflow: 'hidden',
    width: '100%',
  },
  root: {
    backgroundColor: '#020204',
    flex: 1,
  },
  safe: {
    flex: 1,
  },
  scanCopy: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
    textAlign: 'center',
  },
  scanPanel: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 30,
    borderWidth: 1,
    padding: 26,
    width: '100%',
  },
  scanTitle: {
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: '900',
    marginTop: 18,
  },
  spaceMap: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: 30,
    borderWidth: 1,
    height: 310,
    justifyContent: 'center',
    marginVertical: 24,
    overflow: 'hidden',
  },
  star: {
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    opacity: 0.74,
    position: 'absolute',
  },
  starOne: {
    height: 3,
    left: 34,
    top: 96,
    width: 3,
  },
  starThree: {
    height: 2,
    right: 72,
    top: 336,
    width: 2,
  },
  starTwo: {
    height: 4,
    right: 42,
    top: 184,
    width: 4,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 0,
    marginTop: 12,
    textAlign: 'center',
  },
  userDot: {
    backgroundColor: '#020204',
    borderColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 3,
    height: 20,
    position: 'absolute',
    right: 92,
    top: 90,
    width: 20,
  },
});
