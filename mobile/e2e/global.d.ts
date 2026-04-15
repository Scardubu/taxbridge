/**
 * Minimal ambient declarations for Detox E2E globals.
 * Detox runs in its own Jest preset — these types satisfy the TS language server
 * when @types/detox is not installed in the project root.
 */

interface DetoxBy {
  id(id: string): DetoxMatcher;
  text(text: string): DetoxMatcher;
  label(label: string): DetoxMatcher;
  type(type: string): DetoxMatcher;
}

interface DetoxMatcher {}

interface DetoxElement {
  tap(): Promise<void>;
  typeText(text: string): Promise<void>;
  scroll(pixels: number, direction: 'up' | 'down' | 'left' | 'right'): Promise<void>;
  swipe(direction: 'up' | 'down' | 'left' | 'right'): Promise<void>;
}

interface DetoxExpect {
  toBeVisible(): Promise<void>;
  toBeNotVisible(): Promise<void>;
  toExist(): Promise<void>;
  toHaveText(text: string): Promise<void>;
}

interface DetoxDevice {
  launchApp(params?: { delete?: boolean; newInstance?: boolean }): Promise<void>;
  reloadReactNative(): Promise<void>;
  terminateApp(): Promise<void>;
}

declare const device: DetoxDevice;
declare const by: DetoxBy;
declare function element(matcher: DetoxMatcher): DetoxElement;
declare function expect(element: DetoxElement): DetoxExpect;
