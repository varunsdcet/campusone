import React, { useEffect, useMemo } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { ServicesProvider } from './ServicesProvider';
import { createAppQueryClient } from './queryClient';
import { RootNavigator } from '../navigation/RootNavigator';
import { Toasts } from '../components/Toasts';
import { OfflineBanner } from '../components/OfflineBanner';
import { clock } from '../utils/clock';
import { DEMO_ANCHOR_ISO } from '../fixtures/constants';
import { registerAllScreens } from '../features/registerScreens';
import { appConfig } from '../config/appConfig';

registerAllScreens();

export default function App() {
  const queryClient = useMemo(() => createAppQueryClient(), []);
  useEffect(() => {
    // Demo clock: anchor "today" to the fixture date so demo data stays coherent.
    if (appConfig.mode === 'mock' && clock.getOffsetMs() === 0) {
      clock.setOffsetMs(new Date(DEMO_ANCHOR_ISO).getTime() - Date.now());
    }
  }, []);
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <QueryClientProvider client={queryClient}>
        <ServicesProvider>
          <RootNavigator />
          <Toasts />
          <OfflineBanner />
        </ServicesProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
