import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';
import type { RouteName } from './routes';

export type AppNavigation = NativeStackNavigationProp<RootStackParamList>;

export function useAppNavigation(): AppNavigation {
  return useNavigation<AppNavigation>();
}

/** Navigate by route name + loosely typed params (used by data-driven menus/links). */
export function navigateTo(navigation: { navigate: unknown }, route: RouteName | string, params?: Record<string, unknown>) {
  (navigation.navigate as (name: string, params?: Record<string, unknown>) => void)(route, params);
}
