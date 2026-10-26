import React from 'react';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LoginScreen } from '../../src/features/auth/LoginScreen';
import { ServicesProvider } from '../../src/app/ServicesProvider';
import { createAppQueryClient } from '../../src/app/queryClient';
import { createTestServices } from '../../src/services';
import { createMemoryStore } from '../../src/storage/asyncStorage';
import { useSessionStore } from '../../src/state/sessionStore';
import { scenario } from '../../src/services/mock/simulate';
import { DEMO_PASSWORD } from '../../src/fixtures/constants';

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

// Kept in its own file: RNTL 14 + sequential async renders in one file made label queries flaky (see QA_REPORT).
describe('LoginScreen sign-in', () => {
  it('signs in the demo student and toggles password visibility', async () => {
    const { getByTestId, getByLabelText } = await renderLogin();
    fireEvent.press(getByLabelText('Show password'));
    await waitFor(() => expect(getByTestId('login-password').props.secureTextEntry).toBe(false));
    fireEvent.changeText(getByTestId('login-id'), 'ST-2024-001');
    fireEvent.changeText(getByTestId('login-password'), DEMO_PASSWORD);
    fireEvent.press(getByTestId('login-submit'));
    await waitFor(() => expect(useSessionStore.getState().status).toBe('signedIn'));
    expect(useSessionStore.getState().user?.role).toBe('student');
  });
});
