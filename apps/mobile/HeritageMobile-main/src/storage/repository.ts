import { DB_SCHEMA_VERSION, DB_STORAGE_KEY, DemoDb, TableName } from './schema';
import { KeyValueStore } from './asyncStorage';

type Listener = () => void;

export interface RepositoryOptions {
  store: KeyValueStore;
  seed: () => DemoDb;
  /** Debounce for writes (ms). */
  persistDelayMs?: number;
}

/**
 * Persistent mock repository. Holds the DemoDb in memory, persists it to the
 * key-value store with a schema version, and notifies subscribers on change.
 *
 * Hydration rules:
 *  - no saved data           -> seed
 *  - saved schema != current -> run migration (or reseed if none exists)
 *  - otherwise               -> restore saved data untouched (never reseed over edits)
 */
export class Repository {
  private db: DemoDb | null = null;
  private listeners = new Set<Listener>();
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private hydrated = false;
  private hydratePromise: Promise<void> | null = null;
  private migrations: Record<number, (db: DemoDb) => DemoDb> = {};

  constructor(private readonly options: RepositoryOptions) {}

  registerMigration(toVersion: number, fn: (db: DemoDb) => DemoDb) {
    this.migrations[toVersion] = fn;
  }

  get isHydrated() {
    return this.hydrated;
  }

  hydrate(): Promise<void> {
    if (this.hydratePromise) return this.hydratePromise;
    this.hydratePromise = (async () => {
      let loaded: DemoDb | null = null;
      try {
        const raw = await this.options.store.getItem(DB_STORAGE_KEY);
        if (raw) loaded = JSON.parse(raw) as DemoDb;
      } catch (e) {
        if (__DEV__) console.warn('[repository] failed to read saved db, reseeding', e);
        loaded = null;
      }
      if (!loaded) {
        this.db = this.options.seed();
        await this.persistNow();
      } else if (loaded.schemaVersion !== DB_SCHEMA_VERSION) {
        // Newer-than-known or unknown versions cannot be migrated down: reseed.
        let migrated: DemoDb | null = typeof loaded.schemaVersion === 'number' && loaded.schemaVersion < DB_SCHEMA_VERSION ? loaded : null;
        for (let v = (loaded.schemaVersion ?? 0) + 1; migrated && v <= DB_SCHEMA_VERSION; v++) {
          const m = this.migrations[v];
          if (!m) {
            migrated = null;
            break;
          }
          migrated = m(migrated!);
          migrated.schemaVersion = v;
        }
        this.db = migrated ?? this.options.seed();
        await this.persistNow();
      } else {
        this.db = loaded;
      }
      this.hydrated = true;
      this.emit();
    })();
    return this.hydratePromise;
  }

  /** Read access. Throws if used before hydration. */
  get data(): DemoDb {
    if (!this.db) throw new Error('Repository not hydrated');
    return this.db;
  }

  table<K extends TableName>(name: K): DemoDb[K] {
    return this.data[name];
  }

  find<K extends TableName>(name: K, id: string): DemoDb[K][number] | undefined {
    return (this.data[name] as Array<{ id: string }>).find(r => r.id === id) as DemoDb[K][number] | undefined;
  }

  /** Mutate inside a transaction callback; persists and notifies afterwards. */
  mutate<T>(fn: (db: DemoDb) => T): T {
    const result = fn(this.data);
    this.schedulePersist();
    this.emit();
    return result;
  }

  upsert<K extends TableName>(name: K, record: DemoDb[K][number]) {
    this.mutate(db => {
      const arr = db[name] as Array<{ id: string }>;
      const idx = arr.findIndex(r => r.id === (record as { id: string }).id);
      if (idx >= 0) arr[idx] = record as { id: string };
      else arr.push(record as { id: string });
    });
  }

  remove<K extends TableName>(name: K, id: string) {
    this.mutate(db => {
      const arr = db[name] as Array<{ id: string }>;
      const idx = arr.findIndex(r => r.id === id);
      if (idx >= 0) arr.splice(idx, 1);
    });
  }

  /** Explicit, confirmed demo reset: discard saved data and reseed. */
  async resetToSeed(): Promise<void> {
    this.db = this.options.seed();
    await this.persistNow();
    this.emit();
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  async flush(): Promise<void> {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    await this.persistNow();
  }

  private emit() {
    this.listeners.forEach(l => l());
  }

  private schedulePersist() {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      void this.persistNow();
    }, this.options.persistDelayMs ?? 150);
  }

  private async persistNow() {
    if (!this.db) return;
    try {
      await this.options.store.setItem(DB_STORAGE_KEY, JSON.stringify(this.db));
    } catch (e) {
      if (__DEV__) console.warn('[repository] persist failed', e);
    }
  }
}
