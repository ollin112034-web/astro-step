import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

const detailGroups = [
  {
    title: '지구 좌표',
    rows: [
      ['위도 보정', '+37.5665'],
      ['경도 보정', '+126.9780'],
      ['자전 속도', '0.38 km/s'],
    ],
  },
  {
    title: '태양계 좌표',
    rows: [
      ['태양 기준 거리', '1.000042 AU'],
      ['공전 위상', '128.4 deg'],
      ['일일 변위', '2,574,000 km'],
    ],
  },
  {
    title: '은하 좌표',
    rows: [
      ['은하 중심 거리', '26,660 ly'],
      ['회전 속도', '220 km/s'],
      ['누적 이동', '6.94e+12 km'],
    ],
  },
];

export default function DetailScreen() {
  return (
    <View style={styles.root}>
      <View style={styles.starOne} />
      <View style={styles.starTwo} />
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.headerIcon}>
            <Ionicons name="analytics-outline" size={34} color="#FFFFFF" />
          </View>
          <Text style={styles.caption}>ASTRO STEP TELEMETRY</Text>
          <Text style={styles.title}>상세 수치</Text>
          <Text style={styles.body}>걸음 수를 지구, 태양계, 은하 기준 좌표계로 나누어 표시합니다.</Text>

          <View style={styles.summaryPanel}>
            <Text style={styles.summaryLabel}>TOTAL COSMIC DISTANCE</Text>
            <Text style={styles.summaryValue}>14,982,441,093 km</Text>
            <Text style={styles.summaryCopy}>출생 기준점부터 현재까지 추정된 누적 이동 거리</Text>
          </View>

          {detailGroups.map((group) => (
            <View key={group.title} style={styles.group}>
              <Text style={styles.groupTitle}>{group.title}</Text>
              {group.rows.map(([label, value]) => (
                <View key={label} style={styles.row}>
                  <Text style={styles.rowLabel}>{label}</Text>
                  <Text style={styles.rowValue}>{value}</Text>
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    color: 'rgba(255,255,255,0.66)',
    fontSize: 15,
    lineHeight: 23,
    marginTop: 12,
    textAlign: 'center',
  },
  caption: {
    color: 'rgba(255,255,255,0.54)',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
    textAlign: 'center',
  },
  content: {
    alignItems: 'center',
    padding: 22,
    paddingBottom: 120,
  },
  group: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: 26,
    borderWidth: 1,
    marginTop: 14,
    padding: 18,
    width: '100%',
  },
  groupTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 8,
  },
  headerIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 34,
    borderWidth: 1,
    height: 68,
    justifyContent: 'center',
    marginBottom: 18,
    marginTop: 12,
    width: 68,
  },
  root: {
    backgroundColor: '#020204',
    flex: 1,
  },
  row: {
    alignItems: 'center',
    borderTopColor: 'rgba(255,255,255,0.08)',
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  rowLabel: {
    color: 'rgba(255,255,255,0.52)',
    fontSize: 13,
    fontWeight: '800',
  },
  rowValue: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  safe: {
    flex: 1,
  },
  starOne: {
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    height: 4,
    left: 42,
    opacity: 0.7,
    position: 'absolute',
    top: 126,
    width: 4,
  },
  starTwo: {
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    height: 2,
    opacity: 0.6,
    position: 'absolute',
    right: 58,
    top: 284,
    width: 2,
  },
  summaryCopy: {
    color: 'rgba(255,255,255,0.52)',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
  },
  summaryLabel: {
    color: 'rgba(255,255,255,0.48)',
    fontSize: 12,
    fontWeight: '900',
  },
  summaryPanel: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 30,
    borderWidth: 1,
    marginTop: 26,
    padding: 22,
    width: '100%',
  },
  summaryValue: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 0,
    marginTop: 10,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 0,
    marginTop: 10,
    textAlign: 'center',
  },
});
