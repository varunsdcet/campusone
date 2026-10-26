import React from 'react';
import { render, fireEvent, cleanup } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LoginScreen } from '../../src/features/auth/LoginScreen';
import { ServicesProvider } from '../../src/app/ServicesProvider';
import { createAppQueryClient } from '../../src/app/queryClient';
import { createTestServices } from '../../src/services';
import type { PublicFlowsService } from '../../src/services/contracts';
import { createMemoryStore } from '../../src/storage/asyncStorage';
import { Routes } from '../../src/navigation/routes';

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

async function renderLogin(publicFlows?: PublicFlowsService) {
  const { repo, services } = createTestServices(createMemoryStore());
  await repo.hydrate();
  const navigation = { navigate: jest.fn(), goBack: jest.fn(), canGoBack: () => false, replace: jest.fn() };
  const ui = await render(
    <SafeAreaProvider>
      <QueryClientProvider client={createAppQueryClient()}>
        <ServicesProvider override={{ repo, services: { ...services, publicFlows } }}>
          <LoginScreen navigation={navigation as never} route={{ key: 'Login', name: 'Login', params: undefined } as never} />
        </ServicesProvider>
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
  return { ...ui, navigation };
}

afterEach(() => cleanup());

describe('LoginScreen public entry points', () => {
  it('is hidden when the public flows are unavailable (mock mode)', async () => {
    const { queryByTestId } = await renderLogin();
    expect(queryByTestId('login-new-here')).toBeNull();
  });

  it('opens apply, English Test and self-paced flows', async () => {
    const { getByTestId, getByText, navigation } = await renderLogin({} as PublicFlowsService);
    expect(getByText('New to Campus One?')).toBeTruthy();
    fireEvent.press(getByTestId('login-apply'));
    fireEvent.press(getByTestId('login-english-test'));
    fireEvent.press(getByTestId('login-selfpaced'));
    expect(navigation.navigate.mock.calls.map(c => c[0])).toEqual([Routes.PublicApply, Routes.PublicEnglishTest, Routes.PublicSelfPaced]);
  });
});
