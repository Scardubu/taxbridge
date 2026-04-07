import React from 'react';
import { render } from '@testing-library/react-native';
import AppIndex from '../app/index';

let mockPreviewMode = true;
let mockOnboardingDone = false;

jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => require('react').createElement('Text', null, href),
}));

jest.mock('../stores/onboardingStore', () => ({
  DEFAULT_TAB_ROUTE: '/(tabs)',
  useIsOnboardingDone: () => mockOnboardingDone,
  usePreviewMode: () => mockPreviewMode,
  useOnboardingStore: (selector: (state: { previewMode: boolean }) => unknown) => selector({ previewMode: mockPreviewMode }),
}));

describe('AppIndex preview routing', () => {
  beforeEach(() => {
    mockPreviewMode = true;
    mockOnboardingDone = false;
  });

  test('routes preview-mode users to tabs on launch', () => {
    const screen = render(<AppIndex />);

    expect(screen.getByText(/tabs/)).toBeTruthy();
  });

  test('routes non-preview incomplete users to onboarding', () => {
    mockPreviewMode = false;
    mockOnboardingDone = false;

    const screen = render(<AppIndex />);

    expect(screen.getByText(/onboarding/)).toBeTruthy();
  });

  test('routes completed-onboarding users to tabs regardless of previewMode', () => {
    mockPreviewMode = false;
    mockOnboardingDone = true;

    const screen = render(<AppIndex />);

    expect(screen.getByText(/tabs/)).toBeTruthy();
  });

  test('cold-start: previewMode true after rehydration routes to tabs', () => {
    // Simulates rehydrated state where KV read completed before guard evaluated
    mockPreviewMode = true;
    mockOnboardingDone = false;

    const screen = render(<AppIndex />);

    expect(screen.getByText(/tabs/)).toBeTruthy();
    expect(screen.queryByText(/onboarding/)).toBeNull();
  });

  test('cold-start: previewMode false after rehydration routes to onboarding', () => {
    // Simulates the RC-H scenario: KV write did not persist before kill
    mockPreviewMode = false;
    mockOnboardingDone = false;

    const screen = render(<AppIndex />);

    expect(screen.getByText(/onboarding/)).toBeTruthy();
    expect(screen.queryByText(/tabs/)).toBeNull();
  });
});
