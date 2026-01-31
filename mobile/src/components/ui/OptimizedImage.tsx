import React, { useState } from 'react';
import { Image, ImageProps, ActivityIndicator, View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { colors } from '../../theme/tokens';

interface OptimizedImageProps extends ImageProps {
  fallbackSource?: ImageProps['source'];
  showLoader?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
}

export function OptimizedImage({
  source,
  fallbackSource,
  showLoader = true,
  style,
  containerStyle,
  ...props
}: OptimizedImageProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  return (
    <View style={[styles.container, containerStyle]}>
      <Image
        source={error && fallbackSource ? fallbackSource : source}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onError={() => setError(true)}
        style={[styles.image, style]}
        {...props}
      />
      {loading && showLoader && (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.primary} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  loader: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
  },
});
