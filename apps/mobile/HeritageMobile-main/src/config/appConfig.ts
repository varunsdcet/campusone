import { z } from 'zod';

/**
 * Single validated configuration boundary.
 * `mode` decides whether the app talks to the live Heritage API ("api") or to
 * the persistent local mock repository ("mock", used by unit/e2e tests and
 * offline demos). Nothing else in the app should read environment values directly.
 */
const ConfigSchema = z.object({
  mode: z.enum(['mock', 'api']).default('api'),
  apiBaseUrl: z.string().url().optional(),
  /** Origin used to resolve relative asset/file URLs returned by the API. */
  webOrigin: z.string().url().optional(),
  apiTimeoutMs: z.number().int().positive().default(20000),
  demo: z.object({
    /** Base simulated latency for mock service calls (ms). */
    latencyMs: z.number().int().min(0).default(350),
    /** Persisted storage schema version. Bump with a migration. */
    schemaVersion: z.number().int().positive().default(1),
    /** Enables the developer gallery / scenario controls. */
    devToolsEnabled: z.boolean().default(false),
    attachmentMaxBytes: z.number().int().positive().default(10 * 1024 * 1024), // 10 MiB (from Assignment Details design)
    attachmentMaxCount: z.number().int().positive().default(1),
  }),
});

export type AppConfig = z.infer<typeof ConfigSchema>;

const rawConfig = {
  mode: 'api',
  apiBaseUrl: 'https://myvccbc.com/__api',
  webOrigin: 'https://myvccbc.com',
  demo: { devToolsEnabled: false, latencyMs: 0 },
};

export const appConfig: AppConfig = ConfigSchema.parse(rawConfig);

export function isMockMode(): boolean {
  return appConfig.mode === 'mock';
}
