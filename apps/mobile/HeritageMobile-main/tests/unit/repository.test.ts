import { Repository } from '../../src/storage/repository';
import { createMemoryStore } from '../../src/storage/asyncStorage';
import { buildSeed } from '../../src/fixtures/seed';
import { DB_STORAGE_KEY } from '../../src/storage/schema';

describe('Repository persistence', () => {
  it('seeds on first run and persists', async () => {
    const store = createMemoryStore();
    const repo = new Repository({ store, seed: buildSeed, persistDelayMs: 0 });
    await repo.hydrate();
    expect(repo.data.users.length).toBeGreaterThan(0);
    expect(await store.getItem(DB_STORAGE_KEY)).not.toBeNull();
  });

  it('does not reseed over saved changes on restart', async () => {
    const store = createMemoryStore();
    const repo = new Repository({ store, seed: buildSeed, persistDelayMs: 0 });
    await repo.hydrate();
    repo.mutate(db => { db.notifications[0].read = true; db.notifications[0].title = 'CHANGED'; });
    await repo.flush();
    const repo2 = new Repository({ store, seed: buildSeed, persistDelayMs: 0 });
    await repo2.hydrate();
    expect(repo2.data.notifications[0].title).toBe('CHANGED');
  });

  it('resetToSeed restores fixtures explicitly', async () => {
    const store = createMemoryStore();
    const repo = new Repository({ store, seed: buildSeed, persistDelayMs: 0 });
    await repo.hydrate();
    repo.mutate(db => { db.notifications[0].title = 'CHANGED'; });
    await repo.resetToSeed();
    expect(repo.data.notifications[0].title).not.toBe('CHANGED');
  });

  it('reseeds when the saved schema version is unknown and no migration exists', async () => {
    const store = createMemoryStore({ [DB_STORAGE_KEY]: JSON.stringify({ schemaVersion: 999, users: [] }) });
    const repo = new Repository({ store, seed: buildSeed, persistDelayMs: 0 });
    await repo.hydrate();
    expect(repo.data.users.length).toBeGreaterThan(0);
  });
});
