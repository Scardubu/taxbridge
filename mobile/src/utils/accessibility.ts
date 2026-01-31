import { AccessibilityInfo } from 'react-native';

export const accessibilityLabelKeys = {
  navBack: 'accessibility.nav.back',
  navClose: 'accessibility.nav.close',
  navMenu: 'accessibility.nav.menu',
  actionScan: 'accessibility.action.scan',
  actionCalculate: 'accessibility.action.calculate',
  actionPay: 'accessibility.action.pay',
  ntaExemption: 'accessibility.nta.exemption',
  ntaStandard: 'accessibility.nta.standard',
  ntaAlert: 'accessibility.nta.alert',
  pidginScan: 'accessibility.pidgin.scan',
  pidginCalculate: 'accessibility.pidgin.calculate',
  pidginPay: 'accessibility.pidgin.pay',
} as const;

export const accessibilityHintKeys = {
  buttonPrimary: 'accessibility.hint.buttonPrimary',
  cardExpandable: 'accessibility.hint.cardExpandable',
  amountEditable: 'accessibility.hint.amountEditable',
} as const;

export const announceForScreenReader = async (message: string) => {
  await AccessibilityInfo.announceForAccessibility(message);
};

export const isScreenReaderEnabled = async (): Promise<boolean> => {
  return await AccessibilityInfo.isScreenReaderEnabled();
};
