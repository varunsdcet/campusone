import React, { useEffect, useState } from 'react';
import { Screen, ScreenHeader, Text, Stack, Button, LoadingState, ErrorState, Card, DemoLabel } from '../../components';
import type { RootScreenProps } from '../../navigation/types';
import { viewSampleAsset, shareSampleAsset, sampleAssetInfo } from './files';
import type { SampleAssetKey } from '../../domain/types';
import { isMockMode } from '../../config/appConfig';

/** Inferred: opens a bundled sample file in the native viewer with share/print fallback. */
export function FileViewerScreen({ navigation, route }: RootScreenProps<'FileViewer'>) {
  const asset = route.params.asset as SampleAssetKey;
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const open = async () => {
    setLoading(true); setError(null);
    try { await viewSampleAsset(asset); } catch (e) { setError(e); } finally { setLoading(false); }
  };
  useEffect(() => { void open(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset]);
  const info = sampleAssetInfo(asset);
  return (
    <Screen testID="file-viewer" header={<ScreenHeader title={route.params.title} />}>
      <Stack>
        {loading ? <LoadingState label={isMockMode() ? 'Opening sample file…' : 'Opening file…'} /> : error ? <ErrorState error={error} onRetry={open} /> : <Card><Text variant="body">{info?.title ?? asset}</Text><Text variant="caption">The native document viewer was presented. Reopen or share it below.</Text></Card>}
        <Button title="Open again" variant="outline" onPress={open} />
        <Button title="Share / print" onPress={() => shareSampleAsset(asset)} />
        <Button title="Close" variant="ghost" onPress={() => navigation.goBack()} />
        <DemoLabel text="Bundled sample file" />
      </Stack>
    </Screen>
  );
}
