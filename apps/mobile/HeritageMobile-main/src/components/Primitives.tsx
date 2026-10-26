import React, { useState } from 'react';
import { Pressable, StyleSheet, View, ViewStyle, StyleProp, ScrollView, Switch as RNSwitch } from 'react-native';
import { Text } from './Text';
import { Icon, IconName } from './Icon';
import { colors, radius, spacing, touchTarget } from '../theme';
import { isMockMode } from '../config/appConfig';

export function Row({ children, style, gap = spacing.sm, align = 'center', justify, wrap }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; gap?: number; align?: ViewStyle['alignItems']; justify?: ViewStyle['justifyContent']; wrap?: boolean }) {
  return <View style={[{ flexDirection: 'row', alignItems: align, gap, justifyContent: justify, flexWrap: wrap ? 'wrap' : undefined }, style]}>{children}</View>;
}

export function Stack({ children, style, gap = spacing.md }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ gap }, style]}>{children}</View>;
}

export function Divider({ style, dashed }: { style?: StyleProp<ViewStyle>; dashed?: boolean }) {
  return <View style={[styles.divider, dashed ? styles.dashed : null, style]} />;
}

export function Spacer({ h = spacing.md }: { h?: number }) {
  return <View style={{ height: h }} />;
}

export function ProgressBar({ value, color = colors.green700, track = colors.border, height = 8, gradient }: { value: number; color?: string; track?: string; height?: number; gradient?: boolean }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <View style={[styles.track, { backgroundColor: track, height, borderRadius: height / 2 }]} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: pct }}>
      <View style={[styles.fill, { width: `${pct}%`, backgroundColor: color, borderRadius: height / 2 }]} />
      {gradient ? <View style={[styles.fill, { width: `${pct}%`, backgroundColor: colors.gold500, opacity: 0.35, borderRadius: height / 2 }]} /> : null}
    </View>
  );
}

export function StatTile({ label, value, sub, icon, accent, style, valueColor, dark, onPress, testID }: { label: string; value: string | number; sub?: string | React.ReactNode; icon?: IconName; accent?: string; style?: StyleProp<ViewStyle>; valueColor?: string; dark?: boolean; onPress?: () => void; testID?: string }) {
  const content = (
    <>
      <Row justify="space-between">
        <Text variant="overline" color={dark ? colors.green100 : undefined}>{label}</Text>
        {icon ? <Icon name={icon} size={16} color={accent ?? (dark ? colors.gold500 : colors.green700)} /> : null}
      </Row>
      <Text variant="displayMd" color={valueColor ?? (dark ? colors.white : colors.green900)} style={{ fontFamily: 'Inter-Bold', fontSize: 22 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{value}</Text>
      {typeof sub === 'string' ? <Text variant="caption" color={dark ? colors.green100 : undefined}>{sub}</Text> : sub}
    </>
  );
  const base = [styles.stat, dark ? styles.statDark : null, style];
  if (!onPress) return <View testID={testID} style={base}>{content}</View>;
  return (
    <Pressable testID={testID} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label} ${value}`} style={({ pressed }) => [...base, pressed ? { opacity: 0.7 } : null]}>
      {content}
    </Pressable>
  );
}

export function KeyValue({ label, value, mono, align = 'left', style }: { label: string; value: string | React.ReactNode; mono?: boolean; align?: 'left' | 'right'; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ gap: 2, alignItems: align === 'right' ? 'flex-end' : 'flex-start' }, style]}>
      <Text variant="overline">{label}</Text>
      {typeof value === 'string' ? <Text variant={mono ? 'mono' : 'bodyStrong'} color={colors.ink}>{value || '—'}</Text> : value}
    </View>
  );
}

export function KeyValueRow({ label, value, valueColor, border = true }: { label: string; value: string | React.ReactNode; valueColor?: string; border?: boolean }) {
  return (
    <Row justify="space-between" style={[styles.kvRow, border ? styles.kvBorder : null]}>
      <Text variant="bodySm" style={{ flex: 1 }}>{label}</Text>
      {typeof value === 'string' ? <Text variant="bodyStrong" color={valueColor ?? colors.ink} style={{ flexShrink: 1, textAlign: 'right' }}>{value}</Text> : value}
    </Row>
  );
}

export function SectionTitle({ title, right, dot, children, serif, style }: { title: string; right?: React.ReactNode; dot?: boolean; children?: React.ReactNode; serif?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <Row justify="space-between" style={[{ marginBottom: spacing.sm }, style]}>
      <Row gap={6} style={{ flex: 1 }}>
        {dot ? <View style={styles.dot} /> : null}
        <Text variant={serif ? 'displaySm' : 'overline'} color={serif ? undefined : colors.green900} style={serif ? null : { fontSize: 12 }}>{title}</Text>
        {children}
      </Row>
      {right}
    </Row>
  );
}

export function Chip({ label, active, onPress, icon, count, testID, tone = 'dark' }: { label: string; active?: boolean; onPress?: () => void; icon?: IconName; count?: number; testID?: string; tone?: 'dark' | 'coral' }) {
  const activeBg = tone === 'coral' ? colors.coral500 : colors.green900;
  return (
    <Pressable testID={testID} accessibilityRole="tab" accessibilityState={{ selected: !!active }} accessibilityLabel={count !== undefined ? `${label} (${count})` : label} onPress={onPress} style={[styles.chip, active ? { backgroundColor: activeBg, borderColor: activeBg } : null]}>
      {icon ? <Icon name={icon} size={14} color={active ? colors.white : colors.green900} /> : null}
      <Text variant="label" color={active ? colors.white : colors.green900}>{label}{count !== undefined ? ` (${count})` : ''}</Text>
    </Pressable>
  );
}

export function ChipRow<T extends string>({ options, value, onChange, testID, tone }: { options: { value: T; label: string; count?: number; icon?: IconName }[]; value: T; onChange: (v: T) => void; testID?: string; tone?: 'dark' | 'coral' }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow} keyboardShouldPersistTaps="handled">
      {options.map(o => <Chip key={o.value} label={o.label} count={o.count} icon={o.icon} active={o.value === value} onPress={() => onChange(o.value)} testID={testID ? `${testID}-${o.value}` : undefined} tone={tone} />)}
    </ScrollView>
  );
}

export function SegmentedTabs<T extends string>({ options, value, onChange, testID }: { options: { value: T; label: string; count?: number; dot?: string }[]; value: T; onChange: (v: T) => void; testID?: string }) {
  return (
    <View style={styles.segment} accessibilityRole="tablist">
      {options.map(o => {
        const active = o.value === value;
        return (
          <Pressable key={o.value} testID={testID ? `${testID}-${o.value}` : undefined} accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={() => onChange(o.value)} style={[styles.segmentItem, active ? styles.segmentActive : null]}>
            {o.dot ? <View style={[styles.dot, { backgroundColor: o.dot }]} /> : null}
            <Text variant="label" color={active ? colors.green900 : colors.inkSecondary} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={styles.segmentLabel}>{o.label}</Text>
            {o.count !== undefined ? <View style={[styles.count, active ? { backgroundColor: colors.green50 } : null]}><Text variant="caption" color={colors.green900} style={{ fontSize: 11 }}>{o.count}</Text></View> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export function UnderlineTabs<T extends string>({ options, value, onChange, testID }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; testID?: string }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.underlineRow} accessibilityRole="tablist">
      {options.map(o => {
        const active = o.value === value;
        return (
          <Pressable key={o.value} testID={testID ? `${testID}-${o.value}` : undefined} accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={() => onChange(o.value)} style={[styles.underlineTab, active ? styles.underlineActive : null]}>
            <Text variant="label" color={active ? colors.green900 : colors.inkMuted}>{o.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function Accordion({ title, subtitle, children, initiallyOpen = false, right, testID, open: controlledOpen, onToggle, dot, tone = 'surface', titleVariant = 'titleSm' }: { title: string; subtitle?: string; children: React.ReactNode; initiallyOpen?: boolean; right?: React.ReactNode; testID?: string; open?: boolean; onToggle?: (open: boolean) => void; dot?: boolean; tone?: 'surface' | 'plain'; titleVariant?: 'titleSm' | 'overline' | 'displayXs' }) {
  const [internal, setInternal] = useState(initiallyOpen);
  const open = controlledOpen ?? internal;
  const toggle = () => {
    const next = !open;
    setInternal(next);
    onToggle?.(next);
  };
  return (
    <View style={tone === 'surface' ? styles.accordion : null}>
      <Pressable testID={testID} accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={`${title}, ${open ? 'expanded' : 'collapsed'}`} onPress={toggle} style={styles.accordionHeader}>
        {dot ? <View style={styles.dot} /> : null}
        <View style={{ flex: 1 }}>
          <Text variant={titleVariant} color={colors.green900}>{title}</Text>
          {subtitle ? <Text variant="caption">{subtitle}</Text> : null}
        </View>
        {right}
        <View style={styles.chevronCircle}><Icon name={open ? 'ChevronUp' : 'ChevronDown'} size={18} color={colors.inkSecondary} /></View>
      </Pressable>
      {open ? <View style={styles.accordionBody}>{children}</View> : null}
    </View>
  );
}

export function Checkbox({ checked, onChange, label, testID, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: string; testID?: string; disabled?: boolean }) {
  return (
    <Pressable testID={testID} accessibilityRole="checkbox" accessibilityState={{ checked, disabled }} accessibilityLabel={label} onPress={() => onChange(!checked)} disabled={disabled} style={styles.checkRow}>
      <View style={[styles.checkbox, checked ? styles.checkboxOn : null]}>{checked ? <Icon name="Check" size={14} color={colors.white} strokeWidth={3} /> : null}</View>
      {label ? <Text variant="body" color={colors.ink} style={{ flexShrink: 1 }}>{label}</Text> : null}
    </Pressable>
  );
}

export function RadioRow({ selected, onPress, label, description, testID, disabled, disabledReason }: { selected: boolean; onPress: () => void; label: string; description?: string; testID?: string; disabled?: boolean; disabledReason?: string }) {
  return (
    <Pressable testID={testID} accessibilityRole="radio" accessibilityState={{ selected, disabled }} onPress={onPress} disabled={disabled} style={[styles.radioRow, selected ? styles.radioRowOn : null, disabled ? { opacity: 0.55 } : null]}>
      <View style={[styles.radio, selected ? styles.radioOn : null]}>{selected ? <View style={styles.radioDot} /> : null}</View>
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong">{label}</Text>
        {description ? <Text variant="caption">{description}</Text> : null}
        {disabled && disabledReason ? <Text variant="caption" color={colors.coral600}>{disabledReason}</Text> : null}
      </View>
    </Pressable>
  );
}

export function Toggle({ value, onChange, label, testID, labelColor }: { value: boolean; onChange: (v: boolean) => void; label: string; testID?: string; labelColor?: string }) {
  return (
    <Row justify="space-between" style={{ minHeight: touchTarget }}>
      <Text variant="body" color={labelColor ?? colors.ink} style={{ flex: 1 }}>{label}</Text>
      <RNSwitch testID={testID} accessibilityLabel={label} value={value} onValueChange={onChange} trackColor={{ true: colors.green700, false: colors.borderStrong }} />
    </Row>
  );
}

export function Avatar({ initials, size = 40, bg = colors.green900, fg = colors.white }: { initials: string; size?: number; bg?: string; fg?: string }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel={`Avatar ${initials}`}>
      <Text variant="label" color={fg} style={{ fontSize: size * 0.36 }}>{initials}</Text>
    </View>
  );
}

export function Pager({ page, pageCount, onChange, pageSize, onPageSize, total, testID }: { page: number; pageCount: number; onChange: (p: number) => void; pageSize?: number; onPageSize?: (n: number) => void; total?: number; testID?: string }) {
  return (
    <Row justify="space-between" style={styles.pager}>
      <Text variant="bodySm">{total !== undefined ? `Results: ${total}` : ''}{pageSize && onPageSize ? ` • Per page: ${pageSize}` : ''}</Text>
      <Row gap={4}>
        <Pressable testID={testID ? `${testID}-prev` : undefined} accessibilityRole="button" accessibilityLabel="Previous page" disabled={page <= 1} onPress={() => onChange(page - 1)} style={[styles.pageBtn, page <= 1 ? { opacity: 0.4 } : null]}><Icon name="ChevronLeft" size={18} /></Pressable>
        <Text variant="label">Page {page} of {pageCount}</Text>
        <Pressable testID={testID ? `${testID}-next` : undefined} accessibilityRole="button" accessibilityLabel="Next page" disabled={page >= pageCount} onPress={() => onChange(page + 1)} style={[styles.pageBtn, page >= pageCount ? { opacity: 0.4 } : null]}><Icon name="ChevronRight" size={18} /></Pressable>
      </Row>
    </Row>
  );
}

export function AlphabetBar({ value, onChange, letters, testID }: { value: string; onChange: (l: string) => void; letters?: string[]; testID?: string }) {
  const all = letters ?? ['ALL', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
      {all.map(l => {
        const active = l === value;
        return (
          <Pressable key={l} testID={testID ? `${testID}-${l}` : undefined} accessibilityRole="button" accessibilityLabel={`Filter ${l}`} accessibilityState={{ selected: active }} onPress={() => onChange(l)} style={[styles.letter, active ? styles.letterActive : null]}>
            <Text variant="label" color={active ? colors.white : colors.green900}>{l}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function InfoBanner({ icon = 'Info', title, text, tone = 'green', children }: { icon?: IconName; title?: string; text?: string; tone?: 'green' | 'coral' | 'gold' | 'grey' | 'teal' | 'warning'; children?: React.ReactNode }) {
  const map = { green: [colors.green50, colors.green900], coral: [colors.coral50, colors.coral600], gold: [colors.gold50, colors.gold600], grey: [colors.surfaceMuted, colors.inkSecondary], teal: [colors.teal100, colors.teal600], warning: [colors.warning100, colors.warning600] } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={[styles.banner, { backgroundColor: bg }]}>
      <Icon name={icon} size={18} color={fg} />
      <View style={{ flex: 1, gap: 2 }}>
        {title ? <Text variant="label" color={fg}>{title}</Text> : null}
        {text ? <Text variant="bodySm" color={tone === 'grey' ? colors.inkSecondary : colors.ink}>{text}</Text> : null}
        {children}
      </View>
    </View>
  );
}

export function DemoLabel({ text = 'DEMO · synthetic data', style }: { text?: string; style?: StyleProp<ViewStyle> }) {
  if (!isMockMode()) return null;
  return (
    <View style={[styles.demo, style]} accessibilityLabel={text}>
      <Icon name="FlaskConical" size={12} color={colors.gold600} />
      <Text variant="caption" color={colors.gold600} style={{ fontSize: 11 }}>{text}</Text>
    </View>
  );
}

export function ListRow({ title, subtitle, icon, iconBg, iconColor, right, onPress, testID, chevron = true, leading }: { title: string; subtitle?: string; icon?: IconName; iconBg?: string; iconColor?: string; right?: React.ReactNode; onPress?: () => void; testID?: string; chevron?: boolean; leading?: React.ReactNode }) {
  const inner = (
    <Row gap={spacing.md} style={styles.listRow}>
      {leading ?? (icon ? <View style={[styles.listIcon, { backgroundColor: iconBg ?? colors.green50 }]}><Icon name={icon} size={20} color={iconColor ?? colors.green900} /></View> : null)}
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong" numberOfLines={2}>{title}</Text>
        {subtitle ? <Text variant="caption" numberOfLines={2}>{subtitle}</Text> : null}
      </View>
      {right}
      {onPress && chevron ? <Icon name="ChevronRight" size={18} color={colors.inkMuted} /> : null}
    </Row>
  );
  if (!onPress) return inner;
  return <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>{inner}</Pressable>;
}

const styles = StyleSheet.create({
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm },
  dashed: { borderStyle: 'dashed', borderWidth: 1, borderColor: colors.border, backgroundColor: 'transparent', height: 0 },
  track: { overflow: 'hidden', width: '100%' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  stat: { flex: 1, minWidth: 120, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: 4 },
  statDark: { backgroundColor: colors.green900, borderColor: colors.green900 },
  kvRow: { paddingVertical: 10 },
  kvBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.green900 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, minHeight: 36, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipRow: { gap: spacing.sm, paddingVertical: 4 },
  segment: { flexDirection: 'row', backgroundColor: colors.surfaceMuted, borderRadius: radius.pill, padding: 4 },
  segmentItem: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 40, paddingHorizontal: 8, borderRadius: radius.pill },
  segmentActive: { backgroundColor: colors.surface, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  segmentLabel: { flexShrink: 1 },
  count: { backgroundColor: colors.surface, paddingHorizontal: 7, paddingVertical: 1, borderRadius: 10 },
  underlineRow: { gap: spacing.lg, paddingHorizontal: 4 },
  underlineTab: { paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: 'transparent', minHeight: touchTarget, justifyContent: 'center' },
  underlineActive: { borderBottomColor: colors.green900 },
  accordion: { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  accordionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.lg, minHeight: 56 },
  accordionBody: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.sm },
  chevronCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: touchTarget, flexShrink: 1 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  checkboxOn: { backgroundColor: colors.green900, borderColor: colors.green900 },
  radioRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, minHeight: touchTarget, backgroundColor: colors.surface },
  radioRowOn: { borderColor: colors.green900, backgroundColor: colors.green50 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: colors.green900 },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.green900 },
  pager: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  pageBtn: { width: 36, height: 36, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  letter: { minWidth: 40, height: 40, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  letterActive: { backgroundColor: colors.green900, borderColor: colors.green900 },
  banner: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, alignItems: 'flex-start' },
  demo: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: colors.gold50, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  listRow: { minHeight: 56, paddingVertical: 8 },
  listIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
