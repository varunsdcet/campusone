import { useState, useCallback } from 'react';
import { Linking } from 'react-native';
import type { SampleAssetKey } from '../../domain/types';
import { viewSampleAsset, shareSampleAsset, viewFile, shareFile, writeTextFile } from './files';
import { toast } from '../../state/uiStore';
import { errorMessage } from '../../services/errors';

/** Shared view/download/share/print helpers with error toasts. */
export function useFileActions() {
  const [busy, setBusy] = useState<string | null>(null);
  const run = useCallback(async (key: string, fn: () => Promise<unknown>, success?: string) => {
    setBusy(key);
    try {
      await fn();
      if (success) toast(success, 'success');
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(null);
    }
  }, []);
  return {
    busy,
    view: (asset: SampleAssetKey) => run(`view:${asset}`, () => viewSampleAsset(asset)),
    download: (asset: SampleAssetKey, fileName?: string) => run(`download:${asset}`, () => shareSampleAsset(asset, fileName)),
    openUrl: (url: string) => run(`open:${url}`, () => Linking.openURL(url).catch(() => { throw new Error('Could not open this link.'); })),
    viewPath: (path: string, mime?: string, title?: string) => run(`view:${path}`, () => viewFile(path, mime, title)),
    sharePath: (path: string, title?: string) => run(`share:${path}`, () => shareFile(path, title)),
    exportText: (fileName: string, content: string) => run(`export:${fileName}`, async () => {
      const p = await writeTextFile(fileName, content);
      await shareFile(p, fileName);
    }),
  };
}
