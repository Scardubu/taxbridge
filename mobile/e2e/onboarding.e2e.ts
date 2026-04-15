describe('Onboarding Flow', () => {
  beforeAll(async () => {
    await device.launchApp({ delete: true });
  });

  it('completes onboarding without crash', async () => {
    await element(by.id('startOnboarding')).tap();
    await element(by.id('businessType')).tap();
    await element(by.id('continue')).tap();
    await element(by.id('completeOnboarding')).tap();
    await expect(element(by.id('tabsHome'))).toBeVisible();
  });

  it('skipForNow works correctly', async () => {
    await device.reloadReactNative();
    await element(by.id('skipForNow')).tap();
    await expect(element(by.id('tabsHome'))).toBeVisible();
  });
});
