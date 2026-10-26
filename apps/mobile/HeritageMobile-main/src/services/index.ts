import { appConfig } from '../config/appConfig';
import type { Services } from './contracts';
import { createMockServices } from './mock';
import { createApiServices } from './api';
import { Repository } from '../storage/repository';
import { asyncStorageAdapter, KeyValueStore } from '../storage/asyncStorage';
import { buildSeed } from '../fixtures/seed';

export type { Services } from './contracts';

let repoSingleton: Repository | null = null;
let servicesSingleton: Services | null = null;

/** Live mode keeps its on-device data (learning progress, bookmarks) apart from the demo database. */
const liveStore: KeyValueStore = {
  getItem: key => asyncStorageAdapter.getItem(`campusone.live.${key}`),
  setItem: (key, value) => asyncStorageAdapter.setItem(`campusone.live.${key}`, value),
  removeItem: key => asyncStorageAdapter.removeItem(`campusone.live.${key}`),
};

export function getRepository(): Repository {
  if (!repoSingleton) {
    repoSingleton = appConfig.mode === 'mock'
      ? new Repository({ store: asyncStorageAdapter, seed: buildSeed })
      : new Repository({ store: liveStore, seed: buildSeed });
  }
  return repoSingleton;
}

export function getServices(): Services {
  if (!servicesSingleton) {
    servicesSingleton = appConfig.mode === 'mock'
      ? createMockServices({ repo: getRepository(), sessionStore: asyncStorageAdapter })
      : createApiServices({ repo: getRepository(), store: asyncStorageAdapter });
  }
  return servicesSingleton;
}

/** Test helper: build an isolated service set on an in-memory store. */
export function createTestServices(store: KeyValueStore, sessionStore: KeyValueStore = store) {
  const repo = new Repository({ store, seed: buildSeed, persistDelayMs: 0 });
  return { repo, services: createMockServices({ repo, sessionStore }) };
}
