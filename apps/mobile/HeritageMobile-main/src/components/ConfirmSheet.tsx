import React from 'react';
import { StyleSheet, View } from 'react-native';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
import { Text } from './Text';
import { Icon, IconName } from './Icon';
import { colors, spacing } from '../theme';

export interface ConfirmSheetProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string | React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  icon?: IconName;
  testID?: string;
}

export function ConfirmSheet({ visible, onClose, onConfirm, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', destructive, loading, icon, testID }: ConfirmSheetProps) {
  return (
    <BottomSheet visible={visible} onClose={onClose} locked={loading} scroll={false} testID={testID}>
      <View style={styles.wrap}>
        <View style={[styles.iconCircle, { backgroundColor: destructive ? colors.danger100 : colors.green50 }]}>
          <Icon name={icon ?? (destructive ? 'Trash2' : 'CircleCheck')} size={26} color={destructive ? colors.danger600 : colors.green900} />
        </View>
        <Text variant="displaySm" align="center">{title}</Text>
        {typeof message === 'string' ? <Text variant="body" align="center">{message}</Text> : message}
        <Button title={confirmLabel} variant={destructive ? 'danger' : 'primary'} onPress={onConfirm} loading={loading} testID={testID ? `${testID}-confirm` : undefined} />
        <Button title={cancelLabel} variant="ghost" onPress={onClose} disabled={loading} testID={testID ? `${testID}-cancel` : undefined} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing.md, paddingTop: spacing.sm },
  iconCircle: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
});
