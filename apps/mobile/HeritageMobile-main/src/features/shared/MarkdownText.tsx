import React from 'react';
import { View } from 'react-native';
import { Text } from '../../components';
import { colors } from '../../theme';

/** Tiny markdown renderer for demo content: headings, bullets, numbered lists, **bold**, _italic_. */
export function MarkdownText({ text, color }: { text: string; color?: string }) {
  const lines = text.split('\n');
  return (
    <View style={{ gap: 4 }}>
      {lines.map((line, i) => {
        if (!line.trim()) return <View key={i} style={{ height: 6 }} />;
        if (line.startsWith('## ')) return <Text key={i} variant="titleSm" color={color}>{line.slice(3)}</Text>;
        if (line.startsWith('# ')) return <Text key={i} variant="titleMd" color={color}>{line.slice(2)}</Text>;
        const bullet = /^\s*[-•]\s+/.test(line);
        const num = /^\s*\d+\.\s+/.test(line);
        const body = line.replace(/^\s*[-•]\s+/, '').replace(/^\s*(\d+\.)\s+/, '$1 ');
        return (
          <Text key={i} variant="body" color={color} style={bullet ? { paddingLeft: 12 } : num ? { paddingLeft: 6 } : null}>
            {bullet ? '• ' : ''}{renderInline(body)}
          </Text>
        );
      })}
    </View>
  );
}

function renderInline(s: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|_[^_]+_)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(s))) {
    if (m.index > last) parts.push(s.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith('**')) parts.push(<Text key={k++} variant="bodyStrong">{tok.slice(2, -2)}</Text>);
    else parts.push(<Text key={k++} variant="body" style={{ fontStyle: 'italic' }} color={colors.inkMuted}>{tok.slice(1, -1)}</Text>);
    last = m.index + tok.length;
  }
  if (last < s.length) parts.push(s.slice(last));
  return parts;
}
