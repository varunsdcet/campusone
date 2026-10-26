import React, { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Screen, ScreenHeader, LoadingState, ErrorState, Button, Stack, Text, Card, KeyValueRow, Icon } from '../../../components';
import { colors, spacing } from '../../../theme';
import { Routes } from '../../../navigation/routes';
import type { RootScreenProps } from '../../../navigation/types';
import { toast } from '../../../state/uiStore';
import { formatDateTime, formatMoney } from '../../../utils/format';
import { useStatements } from '../records/useRecords';
import { useFeePayments } from './useFeePayments';

const sessionIdFrom = (url: string) => {
  const m = /[?&]session_id=([^&#]+)/.exec(url);
  return m ? decodeURIComponent(m[1]) : undefined;
};

/** Stripe hosted Checkout for tuition & fees; the redirect back to the website is intercepted to record the payment. */
export function FeeCheckoutScreen({ navigation, route }: RootScreenProps<'StudentFeeCheckout'>) {
  const { url, successUrl, cancelUrl } = route.params;
  const { confirm } = useFeePayments();
  const handled = useRef(false);
  const sessionId = useRef<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [receipt, setReceipt] = useState<{ amountCad: number; number: number; at: string } | null>(null);
  const statements = useStatements();
  const remaining = statements.data?.find(s => s.termId === 'all')?.balance;

  const finish = async () => {
    if (!sessionId.current) return;
    try {
      const r = await confirm.mutateAsync(sessionId.current);
      setReceipt({ amountCad: r.amountCad, number: r.number, at: new Date().toISOString() });
    } catch {
      // error state shown below
    }
  };

  const intercept = (target: string) => {
    if (handled.current) return false;
    if (target.startsWith(successUrl)) {
      handled.current = true;
      sessionId.current = sessionIdFrom(target);
      if (sessionId.current) void finish();
      else navigation.goBack();
      return false;
    }
    if (target.startsWith(cancelUrl)) {
      handled.current = true;
      toast('Payment cancelled. No money was charged.', 'info');
      navigation.goBack();
      return false;
    }
    return true;
  };

  if (receipt) {
    return (
      <Screen testID="fee-receipt" header={<ScreenHeader title="Payment receipt" backLabel="" />}>
        <Stack>
          <View style={styles.badge}><Icon name="CircleCheck" size={40} color={colors.success600} /></View>
          <Text variant="displaySm" align="center">Payment received</Text>
          <Text variant="body" align="center">Thank you. The payment has been applied to your account.</Text>
          <Card>
            <KeyValueRow label="Amount paid" value={formatMoney(receipt.amountCad)} />
            <KeyValueRow label="Transaction" value={`#${receipt.number}`} />
            <KeyValueRow label="Date" value={formatDateTime(receipt.at)} />
            <KeyValueRow label="Method" value="Card · Stripe" />
            <KeyValueRow label="Remaining balance" value={remaining === undefined ? '—' : formatMoney(Math.max(0, remaining))} border={false} />
          </Card>
          <Button title="View transaction history" onPress={() => navigation.replace(Routes.StudentTransactions, {})} testID="fee-receipt-history" />
          <Button title="Back to statements" variant="outline" onPress={() => navigation.pop(2)} testID="fee-receipt-done" />
        </Stack>
      </Screen>
    );
  }

  return (
    <Screen testID="fee-checkout" scroll={false} padded={false} header={<ScreenHeader title="Pay tuition & fees" backLabel="" />}>
      {confirm.isPending ? <LoadingState label="Confirming your payment…" /> : confirm.error ? (
        <Stack style={styles.pad}>
          <ErrorState error={confirm.error} onRetry={() => void finish()} />
          <Text variant="caption" align="center">If you were charged, the payment will appear in your transaction history once it is confirmed.</Text>
          <Button title="Back to statements" variant="outline" onPress={() => navigation.goBack()} />
        </Stack>
      ) : handled.current ? <LoadingState /> : (
        <View style={styles.fill}>
          <WebView
            source={{ uri: url }}
            onShouldStartLoadWithRequest={req => intercept(req.url)}
            onNavigationStateChange={nav => { intercept(nav.url); }}
            onLoadEnd={() => setLoading(false)}
            sharedCookiesEnabled
            testID="fee-checkout-webview"
          />
          {loading ? <View style={styles.overlay}><LoadingState label="Opening secure checkout…" /></View> : null}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  pad: { padding: spacing.lg },
  overlay: { ...StyleSheet.absoluteFill as object, justifyContent: 'center' },
  badge: { alignSelf: 'center', width: 72, height: 72, borderRadius: 36, backgroundColor: colors.success100, alignItems: 'center', justifyContent: 'center', marginTop: spacing.lg },
});
