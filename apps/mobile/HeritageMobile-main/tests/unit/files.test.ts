import { pickAttachment, canPreviewInApp } from '../../src/features/shared/files';
import { __setNextPick } from '../__mocks__/documentsPicker';

describe('document picker wrapper', () => {
  it('keeps a local copy and returns an attachment', async () => {
    __setNextPick(async () => [{ uri: 'file:///tmp/a.pdf', name: 'a.pdf', type: 'application/pdf', size: 500 }]);
    const r = await pickAttachment();
    expect(r.status).toBe('picked');
    if (r.status === 'picked') expect(r.attachment.uri).toBe('file:///Documents/a.pdf');
  });
  it('rejects oversize and unsupported files; reports cancellation', async () => {
    __setNextPick(async () => [{ uri: 'file:///tmp/big.pdf', name: 'big.pdf', type: 'application/pdf', size: 11 * 1024 * 1024 }]);
    expect((await pickAttachment()).status).toBe('error');
    __setNextPick(async () => [{ uri: 'file:///tmp/x.exe', name: 'x.exe', type: 'application/octet-stream', size: 10 }]);
    expect((await pickAttachment()).status).toBe('error');
    __setNextPick(async () => { throw { code: 'OPERATION_CANCELED' }; });
    expect((await pickAttachment()).status).toBe('cancelled');
    __setNextPick(null);
  });
  it('knows which formats preview in-app', () => {
    expect(canPreviewInApp('application/pdf', 'a.pdf')).toBe(true);
    expect(canPreviewInApp('application/zip', 'a.zip')).toBe(false);
  });
});
