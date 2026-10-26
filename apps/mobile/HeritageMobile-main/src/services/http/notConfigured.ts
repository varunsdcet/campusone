import { notConfigured } from '../errors';

/**
 * Creates a service whose every method rejects with a typed NOT_CONFIGURED
 * error. Replace individual methods as real endpoints are wired up:
 *
 *   const auth = withHttpMethods(createNotConfiguredService<AuthService>('auth'), {
 *     login: async (input) => mapLoginResponse(await http.request('POST', '/v1/auth/login', toLoginDto(input))),
 *   });
 */
export function createNotConfiguredService<T extends object>(name: string): T {
  return new Proxy({} as T, {
    get(_target, prop) {
      if (typeof prop !== 'string') return undefined;
      return async () => {
        throw notConfigured(`${name}.${prop}`);
      };
    },
  });
}

export function withHttpMethods<T extends object>(base: T, overrides: Partial<T>): T {
  return new Proxy(base, {
    get(target, prop, receiver) {
      if (typeof prop === 'string' && prop in overrides) return (overrides as Record<string, unknown>)[prop];
      return Reflect.get(target, prop, receiver);
    },
  });
}
