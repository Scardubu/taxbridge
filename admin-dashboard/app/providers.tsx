'use client';

import React from 'react';
import { AdminI18nProvider } from '../lib/i18n';

export default function Providers({ children }: { children: React.ReactNode }) {
  return <AdminI18nProvider>{children}</AdminI18nProvider>;
}
