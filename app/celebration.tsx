import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, Text, Vibration, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Button } from '../src/components/Button';
import { Screen } from '../src/components/Screen';
import { continueHabitStage, markCelebrationSeen, setGoalStatus } from '../src/repositories/goals';
import { startReplanDraft } from '../src/repositories/plans';
import { useAppTheme } from '../src/theme/useAppTheme';

const particles = [
  [-82, -88], [-45, -116], [4, -126], [54, -108], [88, -66], [92, 2], [62, 72], [4, 94], [-58, 78], [-92, 20],
];

export default function CelebrationScreen() {
  const { goalId, type = 'habit' } = useLocalSearchParams<{ goalId: string; type?: 'habit' | 'goal' }>();
  const router = useRouter();
  const theme = useAppTheme();
  const progress = useRef(new Animated.Value(0)).current;
  const [reducedMotion, setReducedMotion] = useState(false);
  const isGoal = type === 'goal';

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (!active) return;
      setReducedMotion(reduced);
      Animated.timing(progress, { toValue: 1, duration: reduced ? 350 : isGoal ? 1800 : 1100, useNativeDriver: true }).start();
      if (!reduced) Vibration.vibrate(isGoal ? [0, 60, 80, 60] : 35);
    });
    if (goalId) void markCelebrationSeen(goalId, isGoal ? 'goal' : 'habit');
    return () => { active = false; Vibration.cancel(); };
  }, [goalId, isGoal, progress]);

  const particleViews = useMemo(() => particles.map(([x, y], index) => (
    <Animated.View key={`${x}-${y}`} style={[styles.particle, { backgroundColor: index % 3 === 0 ? theme.colors.brandPressed : theme.colors.brand, opacity: progress.interpolate({ inputRange: [0, 0.12, 0.82, 1], outputRange: [0, 1, 0.75, 0] }), transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, x] }) }, { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, y] }) }, { scale: progress.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0.2, 1, 0.65] }) }] }]} />
  )), [progress, theme.colors.brand, theme.colors.brandPressed]);

  const close = () => router.replace({ pathname: '/goals/[id]', params: { id: goalId } });
  const continueStage = async () => { if (goalId) await continueHabitStage(goalId); close(); };
  const pause = async () => { if (goalId) await setGoalStatus(goalId, 'paused'); close(); };
  const adjust = async () => { if (!goalId) return; await startReplanDraft(goalId); router.replace({ pathname: '/goals/plan', params: { id: goalId } }); };
  const completeGoal = async () => { if (!goalId) return; await setGoalStatus(goalId, 'completed'); router.replace({ pathname: '/celebration', params: { goalId, type: 'goal' } }); };

  return (
    <Screen title="" scroll={false}>
      <View style={styles.root} accessibilityRole="summary" accessibilityLabel={isGoal ? '目标完成，做得很好' : '习惯阶段达成，继续保持'}>
        <View style={styles.art}>{!reducedMotion ? particleViews : null}<Animated.View style={[styles.badge, { borderColor: theme.colors.brand, backgroundColor: theme.colors.brandSoft, opacity: progress, transform: [{ scale: reducedMotion ? 1 : progress.interpolate({ inputRange: [0, 0.65, 1], outputRange: [0.55, 1.08, 1] }) }] }]}><Text style={[styles.check, { color: theme.colors.brandPressed }]}>✓</Text></Animated.View></View>
        <Animated.View style={{ opacity: progress }}><Text style={[styles.title, { color: theme.colors.text }]}>{isGoal ? '目标完成，真棒！' : '一个阶段达成了！'}</Text><Text style={[styles.subtitle, { color: theme.colors.secondaryText }]}>{isGoal ? '你把计划变成了真实的进展。给自己一点肯定，也记得好好休息。' : '这次进步已经记录。下一步由你决定，不会自动开启新阶段。'}</Text></Animated.View>
        <View style={styles.actions}>{isGoal ? <Button title="回到目标" onPress={close} /> : <><Button title="继续保持同一习惯" onPress={() => void continueStage()} /><Button title="调整后再继续" variant="secondary" onPress={() => void adjust()} /><Button title="暂时停一停" variant="ghost" onPress={() => void pause()} /><Button title="这个目标已完成" variant="ghost" onPress={() => void completeGoal()} /></>}</View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, justifyContent: 'center', paddingBottom: 30 }, art: { height: 240, alignItems: 'center', justifyContent: 'center' }, badge: { width: 132, height: 132, borderRadius: 66, borderWidth: 4, alignItems: 'center', justifyContent: 'center' }, check: { fontSize: 68, lineHeight: 78, fontWeight: '700' }, particle: { position: 'absolute', width: 11, height: 11, borderRadius: 6 }, title: { fontSize: 29, lineHeight: 38, fontWeight: '700', textAlign: 'center' }, subtitle: { fontSize: 16, lineHeight: 24, textAlign: 'center', marginTop: 10, paddingHorizontal: 8 }, actions: { gap: 8, marginTop: 32 } });
