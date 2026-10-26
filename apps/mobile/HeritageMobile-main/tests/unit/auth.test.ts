import { createTestServices } from '../../src/services';
import { createMemoryStore } from '../../src/storage/asyncStorage';
import { scenario } from '../../src/services/mock/simulate';
import { DEMO_PASSWORD } from '../../src/fixtures/constants';
import { ServiceError } from '../../src/services/errors';

beforeEach(() => scenario.set({ latencyMs: 0, mode: 'success', methodFilter: undefined }));

describe('AuthService (mock)', () => {
  it('logs in the demo student and remembers the session', async () => {
    const store = createMemoryStore();
    const { repo, services } = createTestServices(store);
    await repo.hydrate();
    const r = await services.auth.login({ loginId: 'ST-2024-001', password: DEMO_PASSWORD, rememberMe: true });
    expect(r.user.role).toBe('student');
    expect(r.user.demoPassword).toBe('');
    const restored = await services.auth.restoreSession();
    expect(restored?.user.id).toBe(r.user.id);
    await services.auth.logout();
    expect(await services.auth.restoreSession()).toBeNull();
  });

  it('rejects invalid credentials with UNAUTHENTICATED', async () => {
    const { repo, services } = createTestServices(createMemoryStore());
    await repo.hydrate();
    await expect(services.auth.login({ loginId: 'ST-2024-001', password: 'wrong', rememberMe: false })).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('does not persist a session when remember me is off', async () => {
    const { repo, services } = createTestServices(createMemoryStore());
    await repo.hydrate();
    await services.auth.login({ loginId: 'monica.dahiya@heritage.edu', password: DEMO_PASSWORD, rememberMe: false });
    expect(await services.auth.restoreSession()).toBeNull();
  });

  it('scenario: permission denied is one-shot so retry succeeds', async () => {
    const { repo, services } = createTestServices(createMemoryStore());
    await repo.hydrate();
    scenario.set({ mode: 'permissionDenied', oneShot: true });
    await expect(services.catalogue.listProgrammes()).rejects.toBeInstanceOf(ServiceError);
    await expect(services.catalogue.listProgrammes()).resolves.toBeInstanceOf(Array);
  });
});
