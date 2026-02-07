import * as Haptics from '../utils/safeHaptics';

export function useHapticFeedback() {
  const light = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  const medium = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  const heavy = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  const success = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  const warning = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  const error = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

  return { light, medium, heavy, success, warning, error };
}
