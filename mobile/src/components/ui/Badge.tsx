import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radii, spacing, typography } from '../../theme/tokens';

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';
type BadgeSize = 'sm' | 'md';

interface BadgeProps {
	children: React.ReactNode;
	variant?: BadgeVariant;
	size?: BadgeSize;
	icon?: string;
}

const variantStyles: Record<BadgeVariant, { bg: string; text: string }> = {
	success: { bg: colors.successBgSubtle, text: colors.successDark },
	warning: { bg: colors.warningBgSubtle, text: colors.warningDark },
	error: { bg: colors.errorBgSubtle, text: colors.errorDark },
	info: { bg: colors.infoBgSubtle, text: colors.infoDark },
	neutral: { bg: colors.neutralBg, text: colors.textMuted },
};

const sizeStyles: Record<BadgeSize, { paddingHorizontal: number; paddingVertical: number; fontSize: number }> = {
	sm: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, fontSize: typography.size.xs },
	md: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: typography.size.sm },
};

export function Badge({ children, variant = 'neutral', size = 'md', icon }: BadgeProps) {
	const variantStyle = variantStyles[variant];
	const sizeStyle = sizeStyles[size];

	return (
		<View style={[styles.container, { backgroundColor: variantStyle.bg }, sizeStyle]}>
			{icon ? <Text style={[styles.icon, { color: variantStyle.text }]}>{icon}</Text> : null}
			<Text style={[styles.text, { color: variantStyle.text, fontSize: sizeStyle.fontSize }]}>{children}</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flexDirection: 'row',
		alignItems: 'center',
		borderRadius: radii.full,
	},
	icon: {
		marginRight: spacing.xs,
	},
	text: {
		fontWeight: typography.weight.semibold,
	},
});
