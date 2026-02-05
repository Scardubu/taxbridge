import { StyleSheet } from 'react-native';
import { colors, spacing, radii, typography } from '../../theme/tokens';

export const guideStyles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  title: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
  },
  body: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 7,
    backgroundColor: colors.primary,
  },
  bulletText: {
    flex: 1,
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  callout: {
    backgroundColor: colors.surfaceSlate,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  calloutText: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});
