import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts } from '../constants/theme';
import {
  formatSuggestionDistance,
  type LocationSuggestion,
} from '../utils/locationSuggestions';

type Props = {
  suggestion: LocationSuggestion;
  onPress: () => void;
  showBorder?: boolean;
  /** Free-text row: keep whatever the user typed (not a Places pick). */
  variant?: 'place' | 'asEntered';
};

export function LocationSuggestionRow({
  suggestion,
  onPress,
  showBorder,
  variant = 'place',
}: Props) {
  const asEntered = variant === 'asEntered';
  const distance =
    !asEntered && suggestion.distanceMeters != null
      ? formatSuggestionDistance(suggestion.distanceMeters)
      : null;

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.row, showBorder && styles.rowBorder]}
      activeOpacity={0.75}
      accessibilityLabel={
        asEntered ? `Use as entered: ${suggestion.name}` : suggestion.label
      }
    >
      <View style={styles.pinCol}>
        <Ionicons
          name={asEntered ? 'create-outline' : 'location-outline'}
          size={16}
          color={Colors.textMuted}
        />
        {distance ? <Text style={styles.distance}>{distance}</Text> : null}
      </View>
      <View style={styles.textCol}>
        <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">
          {suggestion.name}
        </Text>
        <Text style={styles.address} numberOfLines={2} ellipsizeMode="tail">
          {asEntered ? 'Use as entered' : suggestion.address || ' '}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  pinCol: {
    width: 40,
    alignItems: 'center',
    paddingTop: 1,
    gap: 2,
  },
  distance: {
    fontSize: 10,
    lineHeight: 12,
    color: Colors.textMuted,
    fontFamily: Fonts.regular,
    textAlign: 'center',
  },
  textCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  name: {
    fontSize: 13,
    lineHeight: 18,
    color: Colors.text,
    fontFamily: Fonts.semiBold,
  },
  address: {
    fontSize: 12,
    lineHeight: 16,
    color: Colors.textMuted,
    fontFamily: Fonts.regular,
  },
});
