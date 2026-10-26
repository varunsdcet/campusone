import React, { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Screen, ScreenHeader, LoadingState, ErrorState, Button, Stack, Text, Card, KeyValueRow, Icon } from '../../../components';
import { colors, spacing } from '../../../theme';
import { Routes } from '../../../navigation/routes';
import type { RootScreenProps } from '../../../navigation/types';
import { toast } from '../../../state/uiStore';
import { formatDateTime, formatMoney } from '../../../utils/format';
import { useCardCheckout, useProgramme } from './useCatalogue';

const sessionIdFrom = (url: string) => {
  const m = /[?&]session_id=([^&#]+)/.exec(url);
  return m ? decodeURIComponent(m[1]) : undefined;
};

type Paid = { amountCad: number; reference: string; createdAt: string };

/** Hosted Stripe Checkout inside the app; the redirect back to the website is intercepted to finish enrolment. */
export function StripeCheckoutScreen({ navigation, route }: RootScreenProps<'StudentStripeCheckout'>) {
  const { programmeId, url, successUrl, cancelUrl } = route.params;
  const { complete } = useCardCheckout();
  const programme = useProgramme(programmeId);
  const handled = useRef(false);
  const sessionId = useRef<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [paid, setPaid] = useState<Paid | null>(null);

  const finish = async () => {
    if (!sessionId.current) return;
    try {
      const r = await complete.mutateAsync({ programmeId, sessionId: sessionId.current });
      setPaid({ amountCad: r.payment.amountCad, reference: r.payment.reference, createdAt: r.payment.createdAt });
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
      toast('Checkout cancelled. No money was charged.', 'info');
      navigation.goBack();
      return false;
    }
    return true;
  };

  if (paid) {
    return (
      <Screen testID="stripe-checkout-success" header={<ScreenHeader title="Payment complete" backLabel="" />}>
        <Stack>
          <View style={styles.badge}><Icon name="CircleCheck" size={40} color={colors.success600} /></View>
          <Text variant="displaySm" align="center">You're enrolled!</Text>
          <Text variant="body" align="center">Your payment was received and the programme is now in My Learning.</Text>
          <Card>
            <KeyValueRow label="Programme" value={programme.data?.title ?? '—'} />
            <KeyValueRow label="Amount paid" value={formatMoney(paid.amountCad)} />
            <KeyValueRow label="Receipt" value={paid.reference} />
            <KeyValueRow label="Date" value={formatDateTime(paid.createdAt)} border={false} />
          </Card>
          <Button title="Start learning →" onPress={() => navigation.replace(Routes.StudentOutline, { programmeId })} testID="checkout-start" />
          <Button title="Go to My Learning" variant="outline" onPress={() => navigation.replace(Routes.StudentMyLearning)} testID="checkout-mylearning" />
        </Stack>
      </Screen>
    );
  }

  return (
    <Screen testID="stripe-checkout" scroll={false} padded={false} header={<ScreenHeader title="Secure payment" backLabel="" />}>
      {complete.isPending ? <LoadingState label="Confirming your payment…" /> : complete.error ? (
        <Stack style={styles.pad}>
          <ErrorState error={complete.error} onRetry={() => void finish()} />
          <Text variant="caption" align="center">If you were charged, your enrolment will appear in My Learning once the payment is confirmed.</Text>
          <Button title="Back to programme" variant="outline" onPress={() => navigation.goBack()} />
        </Stack>
      ) : handled.current ? <LoadingState /> : (
        <View style={styles.fill}>
          <WebView
            source={{ uri: url }}
            onShouldStartLoadWithRequest={req => intercept(req.url)}
            onNavigationStateChange={nav => { intercept(nav.url); }}
            onLoadEnd={() => setLoading(false)}
            sharedCookiesEnabled
            testID="stripe-webview"
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
