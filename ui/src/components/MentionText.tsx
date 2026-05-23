import { Fragment, type ReactNode } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { Colors, Fonts } from '../constants/theme';

const MENTION_RE = /(?:^|[^a-zA-Z0-9_])@([a-zA-Z0-9_]+)/g;

/** Inline @mention highlighting for plain text and markdown text nodes. */
export function MentionText({
  text,
  style,
  mentionStyle,
}: {
  text: string;
  style?: StyleProp<TextStyle>;
  mentionStyle?: StyleProp<TextStyle>;
}) {
  const mention = mentionStyle ?? styles.mention;
  const lines = text.split('\n');

  return (
    <Text style={style}>
      {lines.map((line, lineIdx) => (
        <Fragment key={lineIdx}>
          {lineIdx > 0 ? '\n' : null}
          {renderLineMentions(line, mention)}
        </Fragment>
      ))}
    </Text>
  );
}

function renderLineMentions(line: string, mentionStyle: StyleProp<TextStyle>) {
  const parts: ReactNode[] = [];
  let pos = 0;
  let m: RegExpExecArray | null;
  MENTION_RE.lastIndex = 0;
  while ((m = MENTION_RE.exec(line)) !== null) {
    const start = m.index;
    const end = start + m[0].length;
    if (start > pos) parts.push(<Text key={`t${pos}`}>{line.slice(pos, start)}</Text>);
    const slice = line.slice(start, end);
    const at = slice.lastIndexOf('@');
    parts.push(
      <Text key={`m${start}`}>
        {slice.slice(0, at)}
        <Text style={mentionStyle}>{slice.slice(at)}</Text>
      </Text>
    );
    pos = end;
  }
  if (pos < line.length) parts.push(<Text key={`t${pos}`}>{line.slice(pos)}</Text>);
  if (parts.length === 0) return <Text>{line}</Text>;
  return parts;
}

const styles = {
  mention: { color: Colors.accent, fontFamily: Fonts.semiBold },
};
