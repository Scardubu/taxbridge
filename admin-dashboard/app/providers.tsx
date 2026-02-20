'use client';

import React from 'react';
import { SWRConfig } from 'swr';
import { AdminI18nProvider } from '../lib/i18n';
import { swrConfig } from '../lib/swrConfig';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig value={swrConfig}>
      <AdminI18nProvider>{children}</AdminI18nProvider>
    </SWRConfig>
  );
}
