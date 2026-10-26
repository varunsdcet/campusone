import React, { useMemo, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { Screen, ScreenHeader, Text, Card, Row, Stack, Button, Pill, LoadingState, ErrorState, EmptyState, Icon, Select, KeyValueRow, InfoBanner, DemoLabel, Input, Divider, Chip, ConfirmSheet } from '../../../components';
import { colors, spacing } from '../../../theme';
import { Routes } from '../../../navigation/routes';
import type { RootScreenProps } from '../../../navigation/types';
import { useStatements, useTransactions, useRecordMutations } from '../records/useRecords';
import { formatDate, formatMoney, formatMoneyParen } from '../../../utils/format';
import { useFileActions } from '../../shared/useFileActions';
import { toast } from '../../../state/uiStore';
import { ServiceError, errorMessage } from '../../../services/errors';
import { appConfig, isMockMode } from '../../../config/appConfig';
import { useFeePayments } from './useFeePayments';

export function FinanceScreen({ navigation }: RootScreenProps<'StudentFinance'>) {
  const statements = useStatements();
  const files = useFileActions();
  const [termId, setTermId] = useState<string | null>(null);
  const list = statements.data ?? [];
  const sel = list.find(s => s.termId === termId) ?? list[0];
  const pay = useFeePayments();
  const accountOwing = list.find(s => s.termId === 'all')?.balance ?? sel?.balance ?? 0;
  return (
    <Screen testID="finance-screen" header={<ScreenHeader />}>
      {statements.isLoading ? <LoadingState /> : statements.error || !sel ? <ErrorState error={statements.error ?? new Error('No statements')} onRetry={() => statements.refetch()} /> : (
        <Stack>
          <Text variant="displayLg">Financial Statements</Text>
          <Text variant="body">Review your term tuition, fees, payment records, and outstanding balance.</Text>
          <Select label="Term" leftIcon="Calendar" value={sel.termId} onChange={setTermId} options={list.map(s => ({ value: s.termId, label: s.termLabel, description: `Balance ${formatMoney(s.balance)}` }))} testID="finance-term" />
          <Card>
            <Row justify="space-between"><Text variant="overline">Current statement: {sel.termLabel}</Text>{isMockMode() ? <Button title="Download" variant="ghost" size="sm" fullWidth={false} icon={<Icon name="Download" size={14} color={colors.green900} />} loading={files.busy === 'download:statement'} onPress={() => files.download('statement', `statement-${sel.termLabel.replace(/\W+/g, '-')}-SAMPLE.pdf`)} testID="finance-download" /> : null}</Row>
            <Text variant="label" style={{ marginTop: spacing.sm }}>New fees & charges</Text>
            {sel.charges.length ? sel.charges.map((c, i) => <KeyValueRow key={`${c.label}-${i}`} label={c.label} value={formatMoney(c.amount)} />) : <Text variant="bodySm">No charges on this statement.</Text>}
            <View style={styles.summary}>
              <Text variant="overline" style={{ marginBottom: 4 }}>Statement summary</Text>
              <KeyValueRow label="Total New Fees & Charges:" value={formatMoneyParen(-sel.totalCharges)} valueColor={colors.danger600} border={false} />
              {sel.taxes.map(t => <KeyValueRow key={t.label} label={`${t.label}:`} value={formatMoneyParen(-t.amount)} valueColor={colors.danger600} border={false} />)}
              <KeyValueRow label="Total Payments:" value={formatMoney(sel.totalPayments)} valueColor={colors.success600} border={false} />
              <Divider dashed />
              <Row justify="space-between"><View><Text variant="label">Statement Balance:</Text><Text variant="caption">{sel.balance > 0 ? (isMockMode() ? 'Outstanding due immediately (demo)' : 'Outstanding due immediately') : 'No balance due'}</Text></View><Pill label={formatMoneyParen(-sel.balance)} tone={sel.balance > 0 ? 'red' : 'green'} /></Row>
            </View>
            {isMockMode() ? (
              <Button title="Pay Outstanding Balance (demo)" icon={<Icon name="CreditCard" size={16} color={colors.white} />} style={{ marginTop: spacing.md }} disabled={sel.balance <= 0} disabledReason="No outstanding balance for this term" onPress={() => navigation.navigate(Routes.StudentPayBalance, { termId: sel.termId, amount: sel.balance })} testID="finance-pay" />
            ) : pay.supported ? (
              <Button title="Pay Outstanding Balance" icon={<Icon name="CreditCard" size={16} color={colors.white} />} style={{ marginTop: spacing.md }} disabled={accountOwing < 1} disabledReason="No outstanding balance on your account" onPress={() => navigation.navigate(Routes.StudentPayBalance, { termId: 'all', amount: accountOwing })} testID="finance-pay" />
            ) : (
              <Button title="Pay on Campus One website" icon={<Icon name="CreditCard" size={16} color={colors.white} />} style={{ marginTop: spacing.md }} disabled={accountOwing <= 0} disabledReason="No outstanding balance on your account" onPress={() => Linking.openURL(`${appConfig.webOrigin ?? ''}/student/fees`).catch(() => toast('Could not open the Campus One website.', 'error'))} testID="finance-pay" />
            )}
            {!isMockMode() && pay.supported && accountOwing >= 1 ? <Text variant="caption" align="center" style={{ marginTop: 4 }}>Account balance {formatMoney(accountOwing)} · secure card payment by Stripe</Text> : null}
            <Button title="View Transaction History →" variant="outline" style={{ marginTop: spacing.sm }} onPress={() => navigation.navigate(Routes.StudentTransactions, { termId: sel.termId })} testID="finance-history" />
          </Card>
          <DemoLabel text="Balances derived from charges and transactions · no real payment" />
        </Stack>
      )}
    </Screen>
  );
}

export function TransactionsScreen({ route, navigation }: RootScreenProps<'StudentTransactions'>) {
  const statements = useStatements();
  const [termId, setTermId] = useState<string>(route.params?.termId ?? 'all');
  const tx = useTransactions(termId === 'all' ? undefined : termId);
  const total = useMemo(() => (tx.data ?? []).reduce((a, t) => a + (t.amount > 0 ? t.amount : 0), 0), [tx.data]);
  const charges = useMemo(() => (tx.data ?? []).reduce((a, t) => a + (t.amount < 0 ? -t.amount : 0), 0), [tx.data]);
  const balanceAfter = useMemo(() => {
    const out = new Map<string, number>();
    let owing = 0;
    [...(tx.data ?? [])].reverse().forEach(t => { owing -= t.amount; out.set(t.id, owing); });
    return out;
  }, [tx.data]);
  return (
    <Screen testID="transactions-screen" header={<ScreenHeader title="Transaction history" />}>
      <Stack>
        <Select label="Term" value={termId} onChange={setTermId} options={[{ value: 'all', label: 'All terms' }, ...(statements.data ?? []).map(s => ({ value: s.termId, label: s.termLabel }))]} testID="tx-term" />
        {tx.isLoading ? <LoadingState /> : tx.error ? <ErrorState error={tx.error} onRetry={() => tx.refetch()} /> : !tx.data?.length ? <EmptyState icon="Receipt" title="No transactions" /> : (
          <Card>
            <Text variant="overline" style={{ marginBottom: spacing.xs }}>{tx.data.length} transactions</Text>
            <View style={styles.totals}>
              <KeyValueRow label="Charges" value={formatMoney(charges)} valueColor={colors.danger600} border={false} />
              <KeyValueRow label="Payments" value={formatMoney(total)} valueColor={colors.success600} border={false} />
              <KeyValueRow label="Balance" value={formatMoney(Math.max(0, charges - total))} border={false} />
            </View>
            {tx.data.map(t => (
              <Row key={t.id} justify="space-between" style={styles.txRow}>
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong">{t.description}</Text>
                  <Text variant="caption">{formatDate(t.date)} · {t.amount > 0 ? 'Payment' : t.amount < 0 ? 'Charge' : 'Adjustment'}{t.reference ? ` · ${t.reference}` : ''}{t.kind === 'demo-payment' ? ' · DEMO' : ''}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text variant="label" color={t.amount > 0 ? colors.success600 : t.amount === 0 ? colors.inkMuted : colors.danger600}>{t.amount > 0 ? '+' : ''}{formatMoney(t.amount)}</Text>
                  <Text variant="caption">Bal {formatMoney(Math.max(0, balanceAfter.get(t.id) ?? 0))}</Text>
                </View>
              </Row>
            ))}
          </Card>
        )}
        <Button title="Back to statements" variant="outline" onPress={() => navigation.goBack()} />
      </Stack>
    </Screen>
  );
}

export function PayBalanceScreen({ route, navigation }: RootScreenProps<'StudentPayBalance'>) {
  const { termId, amount } = route.params;
  const m = useRecordMutations();
  const [value, setValue] = useState(String(amount.toFixed(2)));
  const [outcome, setOutcome] = useState<'success' | 'cancel' | 'fail'>('success');
  const [result, setResult] = useState<string | null>(null);
  const num = Number(value);
  const valid = !Number.isNaN(num) && num > 0 && num <= amount + 0.005;
  if (!isMockMode()) return <LivePayBalance amount={amount} navigation={navigation} />;
  const pay = async () => {
    setResult(null);
    try {
      const tx = await m.payBalance.mutateAsync({ termId, amount: num, outcome });
      if (!tx) { toast('Payment cancelled — no money charged', 'info'); navigation.goBack(); return; }
      toast('Demo payment recorded', 'success');
      navigation.replace(Routes.StudentTransactions, { termId });
    } catch (e) {
      setResult(errorMessage(e));
      if (!ServiceError.is(e, 'SERVER')) toast(errorMessage(e), 'error');
    }
  };
  return (
    <Screen testID="pay-balance" header={<ScreenHeader title="Demo payment" />}>
      <Stack>
        <InfoBanner tone="gold" icon="FlaskConical" title="Demo checkout" text="No real payment is made, no card details are collected, and no provider is contacted. A local transaction is recorded on success." />
        <Card>
          <KeyValueRow label="Outstanding balance" value={formatMoney(amount)} />
          <Input label="Amount to pay (CAD)" keyboardType="decimal-pad" value={value} onChangeText={setValue} error={!valid ? `Enter an amount between 0.01 and ${amount.toFixed(2)}` : undefined} testID="pay-amount" />
          <Select label="Simulated outcome (demo control)" value={outcome} onChange={setOutcome} options={[{ value: 'success', label: 'Success' }, { value: 'cancel', label: 'Cancelled' }, { value: 'fail', label: 'Declined (retryable)' }]} testID="pay-outcome" />
          {result ? <InfoBanner tone="coral" icon="TriangleAlert" title="Payment declined (simulated)" text={result} /> : null}
          <Button title="Continue to demo payment →" variant="coral" onPress={pay} disabled={!valid} disabledReason="Enter a valid amount" loading={m.payBalance.isPending} style={{ marginTop: spacing.sm }} testID="pay-continue" />
          {result ? <Button title="Retry" variant="outline" onPress={() => { setOutcome('success'); void pay(); }} testID="pay-retry" /> : null}
          <Button title="Cancel" variant="ghost" onPress={() => navigation.goBack()} testID="pay-cancel" />
        </Card>
        <DemoLabel text="No funds move" />
      </Stack>
    </Screen>
  );
}

function LivePayBalance({ amount, navigation }: { amount: number; navigation: RootScreenProps<'StudentPayBalance'>['navigation'] }) {
  const pay = useFeePayments();
  const [value, setValue] = useState(amount.toFixed(2));
  const [confirming, setConfirming] = useState(false);
  const num = Math.round(Number(value) * 100) / 100;
  const valid = !Number.isNaN(num) && num >= 1 && num <= amount + 0.005;
  const presets = [
    { label: 'Full balance', value: amount },
    ...(amount >= 2 ? [{ label: 'Half', value: Math.round(amount * 50) / 100 }] : []),
    ...[100, 500, 1000].filter(v => v < amount).map(v => ({ label: formatMoney(v).replace(/\.00.*$/, ''), value: v })),
  ];
  const start = async () => {
    try {
      const c = await pay.start.mutateAsync(num);
      setConfirming(false);
      navigation.navigate(Routes.StudentFeeCheckout, { url: c.url, successUrl: c.successUrl, cancelUrl: c.cancelUrl });
    } catch (e) {
      setConfirming(false);
      toast(errorMessage(e), 'error');
    }
  };
  return (
    <Screen testID="pay-balance" header={<ScreenHeader title="Pay balance" />}>
      <Stack>
        <InfoBanner tone="green" icon="ShieldCheck" title="Secure card payment" text="You'll enter your card on Stripe's secure page. Campus One never sees your card details. The payment is added to your account as soon as it's confirmed." />
        <Card>
          <KeyValueRow label="Outstanding balance" value={formatMoney(amount)} />
          <Text variant="label" style={{ marginTop: spacing.sm }}>Choose an amount</Text>
          <Row gap={8} style={styles.presets}>
            {presets.map(p => <Chip key={p.label} label={p.label} active={Math.abs(num - p.value) < 0.005} onPress={() => setValue(p.value.toFixed(2))} testID={`pay-preset-${p.label}`} />)}
          </Row>
          <Input label="Amount to pay (CAD)" keyboardType="decimal-pad" value={value} onChangeText={setValue} error={!valid ? `Enter an amount between 1.00 and ${amount.toFixed(2)}` : undefined} testID="pay-amount" />
          <Button title={valid ? `Pay ${formatMoney(num)} by card →` : 'Pay by card →'} variant="coral" onPress={() => setConfirming(true)} disabled={!valid} disabledReason="Enter a valid amount" style={{ marginTop: spacing.sm }} testID="pay-continue" />
          <Button title="Cancel" variant="ghost" onPress={() => navigation.goBack()} testID="pay-cancel" />
        </Card>
        <Text variant="caption" align="center">Payments processed securely by Stripe</Text>
      </Stack>
      <ConfirmSheet
        visible={confirming}
        onClose={() => setConfirming(false)}
        icon="CreditCard"
        title={`Pay ${formatMoney(num)}?`}
        message={`You'll be taken to Stripe's secure page to enter your card. Balance after this payment: ${formatMoney(Math.max(0, amount - num))}.`}
        confirmLabel="Continue to card payment"
        loading={pay.start.isPending}
        onConfirm={start}
        testID="pay-confirm"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: { backgroundColor: colors.surfaceMuted, borderRadius: 12, padding: spacing.md, marginTop: spacing.md },
  txRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  presets: { flexWrap: 'wrap', marginVertical: spacing.xs },
  totals: { backgroundColor: colors.surfaceMuted, borderRadius: 12, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, marginBottom: spacing.sm },
});
