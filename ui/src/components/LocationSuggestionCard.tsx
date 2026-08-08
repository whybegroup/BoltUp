import { StyleSheet, Text, View } from 'react-native';
import { Colors, Fonts, Radius } from '../constants/theme';
import type { LocationSuggestion } from '../utils/locationSuggestions';
import { LocationSuggestionRow } from './LocationSuggestionRow';

type Props = {
  typed: string;
  suggestions: LocationSuggestion[];
  suggesting: boolean;
  suggestionError: string | null;
  /** Hide “Use as entered” after a Places suggestion was selected. */
  showAsEntered?: boolean;
  onPickAsEntered: (typed: string) => void;
  onPickSuggestion: (suggestion: LocationSuggestion) => void;
};

/**
 * Suggestion dropdown: optional free-text row (“Use as entered”),
 * then Places results (with optional searching / error states).
 */
export function LocationSuggestionCard({
  typed,
  suggestions,
  suggesting,
  suggestionError,
  showAsEntered = true,
  onPickAsEntered,
  onPickSuggestion,
}: Props) {
  const q = typed.trim();
  if (q.length < 3) return null;

  const showFreeText = showAsEntered;
  const hasPlacesBlock = suggesting || !!suggestionError || suggestions.length > 0;
  if (!showFreeText && !hasPlacesBlock) return null;

  return (
    <View style={styles.card}>
      {showFreeText ? (
        <LocationSuggestionRow
          variant="asEntered"
          suggestion={{
            id: 'as-entered',
            label: q,
            name: q,
            address: 'Use as entered',
          }}
          showBorder={hasPlacesBlock}
          onPress={() => onPickAsEntered(q)}
        />
      ) : null}
      {suggesting ? (
        <Text style={styles.hint}>Searching locations…</Text>
      ) : null}
      {suggestionError ? <Text style={styles.error}>{suggestionError}</Text> : null}
      {suggestions.map((s, idx) => (
        <LocationSuggestionRow
          key={s.id}
          suggestion={s}
          showBorder={idx < suggestions.length - 1}
          onPress={() => onPickSuggestion(s)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    overflow: 'hidden',
    backgroundColor: '#FAFAFA',
  },
  hint: {
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 12,
    color: Colors.textMuted,
    fontFamily: Fonts.regular,
  },
  error: {
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 12,
    color: '#EF4444',
    fontFamily: Fonts.regular,
    lineHeight: 16,
  },
});
