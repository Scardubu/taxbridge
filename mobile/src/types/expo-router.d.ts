/**
 * Type declarations for expo-router
 *
 * The app uses @react-navigation for navigation structure.
 * expo-router's `router` singleton is used in some screens for
 * imperative navigation. Metro resolves the module at runtime
 * via Expo's dependency graph.
 */
declare module 'expo-router' {
  export const router: {
    push: (route: string | { pathname: string; params?: Record<string, unknown> }) => void;
    back: () => void;
    replace: (route: string | { pathname: string; params?: Record<string, unknown> }) => void;
    navigate: (route: string | { pathname: string; params?: Record<string, unknown> }) => void;
    canGoBack: () => boolean;
  };
}
