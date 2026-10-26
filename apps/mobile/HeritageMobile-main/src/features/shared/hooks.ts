import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { clock } from '../../utils/clock';

/** Confirms before leaving a screen with unsaved changes. */
export function useUnsavedChangesGuard(dirty: boolean, message = 'You have unsaved changes. Discard them?') {
  const navigation = useNavigation();
  const bypass = useRef(false);
  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', e => {
      if (!dirty || bypass.current) return;
      e.preventDefault();
      Alert.alert('Discard changes?', message, [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
      ]);
    });
    return unsub;
  }, [navigation, dirty, message]);
  return { allowLeave: () => { bypass.current = true; } };
}

/** Re-renders every `intervalMs` using the demo clock. */
export function useClockTick(intervalMs = 1000): number {
  const [now, setNow] = useState(clock.now());
  useEffect(() => {
    const id = setInterval(() => setNow(clock.now()), intervalMs);
    const unsub = clock.subscribe(() => setNow(clock.now()));
    return () => { clearInterval(id); unsub(); };
  }, [intervalMs]);
  return now;
}

export function useDebounced<T>(value: T, delay = 250): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}
