import React from 'react';
import { render, fireEvent, cleanup } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LoginScreen } from '../../src/features/auth/LoginScreen';
import { ServicesProvider } from '../../src/app/ServicesProvider';
import { createAppQueryClient } from '../../src/app/queryClient';
import { createTestServices } from '../../src/services';
import { createMemoryStore } from '../../src/storage/asyncStorage';
import { useSessionStore } from '../../src/state/sessionStore';
import { scenario } from '../../src/services/mock/simulate';

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

const fakeNavigation = { navigate: jest.fn(), goBack: jest.fn(), canGoBack: () => false, replace: jest.fn() };

async function renderLogin() {
  const { repo, services } = createTestServices(createMemoryStore());
  await repo.hydrate();
  const qc = createAppQueryClient();
  const ui = await render(
    <SafeAreaProvider>
      <QueryClientProvider client={qc}>
        <ServicesProvider override={{ repo, services }}>
          <LoginScreen navigation={fakeNavigation as never} route={{ key: 'Login', name: 'Login', params: undefined } as never} />
        </ServicesProvider>
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
  return { ...ui, repo };
}

afterEach(() => cleanup());

beforeEach(() => { scenario.set({ latencyMs: 0, mode: 'success' }); useSessionStore.setState({ status: 'signedOut', session: null, user: null }); });

describe('LoginScreen', () => {
  it('shows validation errors for empty fields', async () => {
    const { getByTestId, findByText } = await renderLogin();
    fireEvent.press(getByTestId('login-submit'));
    expect(await findByText(/^Enter your email$/)).toBeTruthy();
    expect(await findByText('Enter your password')).toBeTruthy();
  });

  it('shows an invalid-credentials error and keeps the user signed out', async () => {
    const { getByTestId, findByText } = await renderLogin();
    fireEvent.changeText(getByTestId('login-id'), 'ST-2024-001');
    fireEvent.changeText(getByTestId('login-password'), 'nope');
    fireEvent.press(getByTestId('login-submit'));
    expect(await findByText(/Invalid credentials/)).toBeTruthy();
    expect(useSessionStore.getState().status).toBe('signedOut');
  });
});
