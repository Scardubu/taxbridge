import React from 'react';
import { View, Image, ActivityIndicator, StyleSheet } from 'react-native';
import { colors } from '../theme/tokens';

const LOGO = require('../../assets/icon-square.png');

/**
 * Shared branded loading screen used during boot hydration phases.
 * Replaces duplicated inline loaders in BootRouter and AppNavigator.
 */
export default function BrandedLoading() {
  return (
    <View style={styles.container}>
      <Image source={LOGO} style={styles.logo} resizeMode="contain" />
      <ActivityIndicator style={styles.spinner} size="small" color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 120,
    height: 120,
  },
  spinner: {
    marginTop: 16,
  },
});
