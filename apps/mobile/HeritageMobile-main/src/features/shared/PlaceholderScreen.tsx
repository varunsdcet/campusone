import React from 'react';
import { useRoute } from '@react-navigation/native';
import { Screen, ScreenHeader, EmptyState } from '../../components';

/** Temporary scaffold used only while a screen is being implemented. */
export function PlaceholderScreen() {
  const route = useRoute();
  return (
    <Screen header={<ScreenHeader title={route.name} />} testID={`placeholder-${route.name}`}>
      <EmptyState icon="Construction" title={route.name} message={`Params: ${JSON.stringify(route.params ?? {})}`} />
    </Screen>
  );
}
