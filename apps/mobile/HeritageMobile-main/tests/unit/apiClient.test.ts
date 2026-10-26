import { ApiClient } from '../../src/services/api/client';
import { ServiceError } from '../../src/services/errors';
import { createMemoryStore } from '../../src/storage/asyncStorage';

describe('ApiClient error messages', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does not expose an HTML 404 page in the mobile UI', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(
      '<!DOCTYPE html><html><body><pre>Cannot GET /missing</pre></body></html>',
      { status: 404, headers: { 'Content-Type': 'text/html' } },
    ));

    const api = new ApiClient(createMemoryStore());
    await expect(api.get('/missing')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'This feature is not available right now.',
    } satisfies Partial<ServiceError>);
  });

  it('keeps a structured API error message', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(
      JSON.stringify({ error: { message: 'Document is still under review.' } }),
      { status: 409, headers: { 'Content-Type': 'application/json' } },
    ));

    const api = new ApiClient(createMemoryStore());
    await expect(api.post('/documents/finalise')).rejects.toMatchObject({
      code: 'CONFLICT',
      message: 'Document is still under review.',
    } satisfies Partial<ServiceError>);
  });
});
