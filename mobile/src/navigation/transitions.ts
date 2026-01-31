import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { animations } from '../theme/tokens';

export const screenTransitions = {
  slideFromRight: {
    animation: 'slide_from_right',
    animationDuration: animations.duration.normal,
  } as NativeStackNavigationOptions,
  modal: {
    animation: 'slide_from_bottom',
    animationDuration: animations.duration.normal,
    presentation: 'modal',
  } as NativeStackNavigationOptions,
  fade: {
    animation: 'fade',
    animationDuration: animations.duration.fast,
  } as NativeStackNavigationOptions,
};
