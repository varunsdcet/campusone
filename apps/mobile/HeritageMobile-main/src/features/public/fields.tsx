import React from 'react';
import { View } from 'react-native';
import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form';
import { Checkbox, DateField, Input, Select, Text, type InputProps } from '../../components';
import { colors } from '../../theme';
import { asOptions } from './forms';

type Base<T extends FieldValues> = { control: Control<T>; name: Path<T>; testID?: string };

export function TextField<T extends FieldValues>({ control, name, ...rest }: Base<T> & Omit<InputProps, 'value' | 'onChangeText' | 'onBlur' | 'error'>) {
  return (
    <Controller control={control} name={name} render={({ field, fieldState }) => (
      <Input {...rest} value={String(field.value ?? '')} onChangeText={field.onChange} onBlur={field.onBlur} error={fieldState.error?.message} />
    )} />
  );
}

export function SelectField<T extends FieldValues>({ control, name, label, options, required, testID }: Base<T> & { label: string; options: string[]; required?: boolean }) {
  return (
    <Controller control={control} name={name} render={({ field, fieldState }) => (
      <Select label={label} required={required} value={field.value || undefined} onChange={field.onChange} options={asOptions(options)} error={fieldState.error?.message} sheetTitle={label} testID={testID} />
    )} />
  );
}

export function DateInputField<T extends FieldValues>({ control, name, label, required, testID }: Base<T> & { label: string; required?: boolean }) {
  return (
    <Controller control={control} name={name} render={({ field, fieldState }) => (
      <DateField label={label} required={required} value={field.value || undefined} onChange={field.onChange} maximumDate={new Date()} error={fieldState.error?.message} testID={testID} />
    )} />
  );
}

export function CheckField<T extends FieldValues>({ control, name, label, testID }: Base<T> & { label: string }) {
  return (
    <Controller control={control} name={name} render={({ field, fieldState }) => (
      <View style={{ gap: 4 }}>
        <Checkbox checked={!!field.value} onChange={field.onChange} label={label} testID={testID} />
        {fieldState.error?.message ? <Text variant="caption" color={colors.danger600}>{fieldState.error.message}</Text> : null}
      </View>
    )} />
  );
}
