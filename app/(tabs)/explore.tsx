import { Ionicons } from '@expo/vector-icons';
import { Image, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

const travelInfo = [
  { icon: 'footsteps-outline', label: '총 걸음 수', helper: '지구에서 출발 후 누적', value: '8,749,123', unit: '걸음' },
  { icon: 'git-branch-outline', label: '총 이동 거리', helper: '실제 보행 거리 추정', value: '65,618', unit: 'km' },
  { icon: 'rocket-outline', label: '우주 여행 거리', helper: '목성 항성까지의 전체 거리', value: '7,388,342', unit: 'km' },
  { icon: 'time-outline', label: '우주 여행 시간', helper: '지구에서 출발한 시간', value: '24.2', unit: '년' },
] as const;

const weeklySteps = [6200, 8300, 6100, 7600, 12400, 9600, 7842];

export default function DetailScreen() {
  return (
    <View style={styles.root}>
      <View style={styles.starOne} />
      <View style={styles.starTwo} />
      <View style={styles.orbit} />
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Ionicons name="arrow-back" size={26} color="#FFFFFF" />
            <Image resizeMode="contain" source={require('../../reference-ui/타이틀.png')} style={styles.logo} />
            <Ionicons name="share-outline" size={26} color="#FFFFFF" />
          </View>

          <View style={styles.tabs}>
            <View style={styles.tabActive}>
              <Ionicons name="planet-outline" size={22} color="#DCD9FF" />
              <Text style={styles.tabActiveText}>우주 여행 정보</Text>
            </View>
            <Text style={styles.tabText}>기록</Text>
            <Text style={styles.tabText}>분석</Text>
          </View>

          <View style={styles.heroCard}>
            <View style={styles.jupiter} />
            <Text style={styles.overline}>현재 위치</Text>
            <Text style={styles.title}>목성 항성 부근</Text>
            <View style={styles.badge}>
              <View style={styles.badgeDot} />
              <Text style={styles.badgeText}>태양계</Text>
            </View>
            <View style={styles.arrivalRow}>
              <Ionicons name="locate-outline" size={24} color="#FFFFFF" />
              <Text style={styles.arrivalText}>도착까지 43% 남음</Text>
            </View>
            <View style={styles.dotProgress}>
              {Array.from({ length: 16 }).map((_, index) => (
                <View key={index} style={[styles.progressDot, index < 9 && styles.progressDotActive]} />
              ))}
            </View>
          </View>

          <View style={styles.dataCard}>
            {travelInfo.map((item, index) => (
              <View key={item.label} style={[styles.infoRow, index > 0 && styles.infoRowBorder]}>
                <View style={styles.infoIcon}>
                  <Ionicons name={item.icon} size={30} color="#C7C5FF" />
                </View>
                <View style={styles.infoText}>
                  <Text style={styles.infoLabel}>{item.label}</Text>
                  <Text style={styles.infoHelper}>{item.helper}</Text>
                </View>
                <Text style={styles.infoValue}>{item.value} <Text style={styles.infoUnit}>{item.unit}</Text></Text>
              </View>
            ))}
            <View style={styles.formulaBar}>
              <Ionicons name="information-circle-outline" size={18} color="rgba(255,255,255,0.62)" />
              <Text style={styles.formulaText}>1 걸음 = 7.5 km  |  우주선 평균 속도로 환산한 거리입니다.</Text>
            </View>
          </View>

          <View style={styles.cardRow}>
            <View style={styles.smallCard}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>오늘의 미션</Text>
                <Ionicons name="chevron-forward" size={22} color="#FFFFFF" />
              </View>
              <View style={styles.ring}>
                <Text style={styles.ringNumber}>7,842</Text>
                <Text style={styles.ringText}>/ 10,000 걸음</Text>
              </View>
              <Text style={styles.metricLine}>오늘 이동 거리 58.8 km</Text>
              <Text style={styles.metricLine}>우주 여행 거리 441.0 km</Text>
            </View>

            <View style={styles.smallCard}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>이번 주 여정</Text>
                <Ionicons name="chevron-forward" size={22} color="#FFFFFF" />
              </View>
              <View style={styles.chart}>
                {weeklySteps.map((value, index) => (
                  <View key={index} style={styles.chartColumn}>
                    <View style={[styles.chartBar, { height: 32 + (value / 15000) * 96 }]} />
                    <Text style={styles.chartLabel}>{['월', '화', '수', '목', '금', '토', '오늘'][index]}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          <View style={styles.goalCard}>
            <View>
              <Text style={styles.cardTitle}>다음 목표</Text>
              <Text style={styles.goalTitle}>토성 항성</Text>
              <Text style={styles.goalCopy}>78% 까지</Text>
              <Text style={styles.goalPercent}>21% <Text style={styles.goalSmall}>남았어요!</Text></Text>
            </View>
            <View style={styles.saturn}>
              <View style={styles.saturnRing} />
            </View>
            <View>
              <Text style={styles.goalCopy}>남은 거리</Text>
              <Text style={styles.goalValue}>2,749,863 km</Text>
              <Text style={styles.goalCopy}>예상 도달 시간</Text>
              <Text style={styles.goalValue}>13.8년 후</Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  arrivalRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginTop: 46,
  },
  arrivalText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  badge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginTop: 18,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  badgeDot: {
    backgroundColor: '#AAA5FF',
    borderRadius: 999,
    height: 10,
    width: 10,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardRow: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 16,
    width: '100%',
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  chart: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 10,
    height: 154,
    justifyContent: 'space-between',
    marginTop: 18,
  },
  chartBar: {
    backgroundColor: '#AAA5FF',
    borderRadius: 9,
    shadowColor: '#AAA5FF',
    shadowOpacity: 0.8,
    shadowRadius: 12,
    width: 16,
  },
  chartColumn: {
    alignItems: 'center',
    gap: 8,
    justifyContent: 'flex-end',
  },
  chartLabel: {
    color: 'rgba(255,255,255,0.64)',
    fontSize: 12,
  },
  content: {
    padding: 22,
    paddingBottom: 120,
  },
  dataCard: {
    backgroundColor: 'rgba(13,14,20,0.82)',
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 28,
    borderWidth: 1,
    marginTop: 16,
    padding: 20,
  },
  dotProgress: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
    marginTop: 22,
  },
  formulaBar: {
    alignItems: 'center',
    borderTopColor: 'rgba(255,255,255,0.12)',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    paddingTop: 16,
  },
  formulaText: {
    color: 'rgba(255,255,255,0.66)',
    flex: 1,
    fontSize: 13,
  },
  goalCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(13,14,20,0.82)',
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    padding: 20,
  },
  goalCopy: {
    color: 'rgba(255,255,255,0.66)',
    fontSize: 14,
    marginTop: 8,
  },
  goalPercent: {
    color: '#BDB9FF',
    fontSize: 38,
    fontWeight: '300',
    marginTop: 8,
  },
  goalSmall: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 15,
  },
  goalTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    marginTop: 10,
  },
  goalValue: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 10,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroCard: {
    backgroundColor: 'rgba(13,14,20,0.72)',
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 28,
    borderWidth: 1,
    minHeight: 400,
    overflow: 'hidden',
    padding: 24,
    position: 'relative',
  },
  infoHelper: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 14,
    marginTop: 6,
  },
  infoIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(166,162,255,0.08)',
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 999,
    borderWidth: 1,
    height: 60,
    justifyContent: 'center',
    width: 60,
  },
  infoLabel: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  infoRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
    paddingVertical: 16,
  },
  infoRowBorder: {
    borderTopColor: 'rgba(255,255,255,0.12)',
    borderTopWidth: 1,
  },
  infoText: {
    flex: 1,
  },
  infoUnit: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 14,
  },
  infoValue: {
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: '800',
    textAlign: 'right',
  },
  jupiter: {
    backgroundColor: '#C6B199',
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 999,
    borderWidth: 1,
    height: 260,
    opacity: 0.88,
    position: 'absolute',
    right: -70,
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.45,
    shadowRadius: 30,
    top: 34,
    width: 260,
  },
  logo: {
    height: 54,
    width: 210,
  },
  metricLine: {
    color: 'rgba(255,255,255,0.76)',
    fontSize: 14,
    lineHeight: 25,
  },
  orbit: {
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    borderWidth: 1,
    height: 740,
    left: -170,
    position: 'absolute',
    top: 90,
    transform: [{ rotate: '-12deg' }],
    width: 740,
  },
  overline: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 17,
  },
  progressDot: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 999,
    flex: 1,
    height: 6,
  },
  progressDotActive: {
    backgroundColor: '#AAA5FF',
    shadowColor: '#AAA5FF',
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  ring: {
    alignItems: 'center',
    alignSelf: 'center',
    borderColor: '#8F8AFF',
    borderRadius: 999,
    borderWidth: 8,
    height: 126,
    justifyContent: 'center',
    marginVertical: 20,
    shadowColor: '#8F8AFF',
    shadowOpacity: 0.56,
    shadowRadius: 16,
    width: 126,
  },
  ringNumber: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '800',
  },
  ringText: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 13,
  },
  root: {
    backgroundColor: '#020204',
    flex: 1,
  },
  safe: {
    flex: 1,
  },
  saturn: {
    backgroundColor: '#C4B698',
    borderRadius: 999,
    height: 90,
    justifyContent: 'center',
    marginHorizontal: 10,
    width: 90,
  },
  saturnRing: {
    alignSelf: 'center',
    borderColor: 'rgba(255,255,255,0.6)',
    borderRadius: 999,
    borderWidth: 2,
    height: 28,
    transform: [{ rotate: '-18deg' }],
    width: 132,
  },
  smallCard: {
    backgroundColor: 'rgba(13,14,20,0.82)',
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 24,
    borderWidth: 1,
    flex: 1,
    minHeight: 248,
    padding: 18,
  },
  starOne: {
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    height: 3,
    left: 60,
    opacity: 0.8,
    position: 'absolute',
    top: 150,
    width: 3,
  },
  starTwo: {
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    height: 2,
    opacity: 0.6,
    position: 'absolute',
    right: 54,
    top: 300,
    width: 2,
  },
  tabActive: {
    alignItems: 'center',
    borderBottomColor: '#BDB9FF',
    borderBottomWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingBottom: 14,
  },
  tabActiveText: {
    color: '#DCD9FF',
    fontSize: 17,
    fontWeight: '800',
  },
  tabs: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 22,
    marginTop: 22,
  },
  tabText: {
    color: 'rgba(255,255,255,0.38)',
    flex: 1,
    fontSize: 17,
    textAlign: 'center',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: 0,
    marginTop: 14,
  },
});
