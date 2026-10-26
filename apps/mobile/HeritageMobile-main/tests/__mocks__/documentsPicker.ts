export const types = { pdf: 'pdf', doc: 'doc', docx: 'docx', xls: 'xls', xlsx: 'xlsx', ppt: 'ppt', pptx: 'pptx', images: 'images', zip: 'zip' };
export const errorCodes = { OPERATION_CANCELED: 'OPERATION_CANCELED', IN_PROGRESS: 'IN_PROGRESS', UNABLE_TO_OPEN_FILE_TYPE: 'UNABLE_TO_OPEN_FILE_TYPE' };
export const isErrorWithCode = (e: unknown): e is { code: string; message?: string } => typeof e === 'object' && !!e && 'code' in e;
export let nextPick: (() => Promise<unknown[]>) | null = null;
export const __setNextPick = (fn: typeof nextPick) => { nextPick = fn; };
export const pick = async () => (nextPick ? nextPick() : [{ uri: 'file:///tmp/test.pdf', name: 'test.pdf', type: 'application/pdf', size: 1234 }]);
export const keepLocalCopy = async ({ files }: { files: { uri: string; fileName: string }[] }) => files.map(f => ({ status: 'success', localUri: `file:///Documents/${f.fileName}`, sourceUri: f.uri }));
