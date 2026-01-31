import { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, spacing, typography, radii } from '../theme/tokens';

const OfflineBadge = memo(function OfflineBadge({ online }: { online: boolean }) {
  const { t } = useTranslation();
  
  if (online) return null;
  
  return (
    <View style={styles.wrap}>
      <Text style={styles.icon}>📵</Text>
      <Text style={styles.text}>{t('network.offlineMode')}</Text>
    </View>
  );
});

export default OfflineBadge;

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: colors.errorBg,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.errorBorder,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    fontSize: typography.size.sm,
    marginRight: spacing.xs,
  },
  text: { 
    color: colors.errorDark, 
    fontWeight: typography.weight.bold as any,
    fontSize: typography.size.xs,
  },
});
