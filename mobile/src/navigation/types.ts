import type { NavigatorScreenParams } from '@react-navigation/native';

export type MainTabParamList = {
  Home: undefined;
  Create: { openScan?: boolean } | undefined;
  Invoices:
    | {
        filter?: string;
        highlightId?: string;
        customerId?: string;
        transactionId?: string;
      }
    | undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  Onboarding: undefined;
  Login: undefined;
  Register: undefined;
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  Payment: undefined;
  TaxGuide: undefined;
  Payroll: undefined;
  CreatePayroll: undefined;
  PayrollDetail: { id: string };
  Compliance: undefined;
  Crypto: undefined;
  Reconciliation: undefined;
  Documents: undefined;
  Team: undefined;
};
