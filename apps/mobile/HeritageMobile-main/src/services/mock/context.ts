import { Repository } from '../../storage/repository';
import { KeyValueStore } from '../../storage/asyncStorage';

export interface MockContext {
  repo: Repository;
  /** Separate key-value store for session (not part of demo db reset). */
  sessionStore: KeyValueStore;
}

export const SESSION_KEY = 'heritage.session.v1';
