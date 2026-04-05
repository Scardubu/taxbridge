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
  useOnboardingStore: (selector: (state: { previewMode: boolean }) => unknown) => selector({ previewMode: mockPreviewMode }),
}));

describe('AppIndex preview routing', () => {
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
});
