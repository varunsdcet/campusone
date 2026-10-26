import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, View, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Text } from './Text';
import { Icon } from './Icon';
import { Button } from './Button';
import { colors, radius, spacing } from '../theme';
import { parseISODate, toISODate } from '../utils/format';

export function DateField({ label, value, onChange, placeholder = 'dd/mm/yyyy', error, minimumDate, maximumDate, testID, required, helper }: { label?: string; value?: string; onChange: (iso: string) => void; placeholder?: string; error?: string; minimumDate?: Date; maximumDate?: Date; testID?: string; required?: boolean; helper?: string }) {
  const [open, setOpen] = useState(false);
  const [temp, setTemp] = useState<Date>(value ? parseISODate(value) : new Date());
  const display = value ? (() => { const d = parseISODate(value); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`; })() : '';
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text variant="label">{label}{required ? <Text variant="label" color={colors.coral600}> *</Text> : null}</Text> : null}
      <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={`${label ?? 'Date'}: ${display || 'not set'}`} onPress={() => { setTemp(value ? parseISODate(value) : new Date()); setOpen(true); }} style={[styles.field, error ? styles.error : null]}>
        <Text variant="body" color={display ? colors.ink : colors.inkFaint} style={{ flex: 1 }}>{display || placeholder}</Text>
        <Icon name="Calendar" size={18} color={colors.inkSecondary} />
      </Pressable>
      {error ? <Text variant="caption" color={colors.danger600}>{error}</Text> : helper ? <Text variant="caption">{helper}</Text> : null}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel="Dismiss date picker" />
        <View style={styles.sheet}>
          <Text variant="titleSm" align="center">{label ?? 'Select date'}</Text>
          <DateTimePicker testID={testID ? `${testID}-picker` : undefined} value={temp} mode="date" display={Platform.OS === 'ios' ? 'inline' : 'default'} minimumDate={minimumDate} maximumDate={maximumDate} onChange={(_, d) => d && setTemp(d)} accentColor={colors.green900} themeVariant="light" />
          <Button title="Use this date" onPress={() => { onChange(toISODate(temp)); setOpen(false); }} testID={testID ? `${testID}-confirm` : undefined} />
          <Button title="Cancel" variant="ghost" onPress={() => setOpen(false)} />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, paddingHorizontal: spacing.md, minHeight: 48 },
  error: { borderColor: colors.danger600 },
  backdrop: { ...StyleSheet.absoluteFill as object, backgroundColor: colors.overlay },
  sheet: { position: 'absolute', left: spacing.lg, right: spacing.lg, top: '18%', backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.sm },
});
