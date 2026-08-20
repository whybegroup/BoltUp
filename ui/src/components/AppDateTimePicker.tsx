import { Platform } from 'react-native';
import DateTimePicker, {
  type AndroidNativeProps,
  type IOSNativeProps,
} from '@react-native-community/datetimepicker';
import { Colors } from '../constants/theme';

type Props = IOSNativeProps | AndroidNativeProps;

/** Light chrome: native iOS UIDatePicker follows `userInterfaceStyle: 'dark'` unless overridden. */
export default function AppDateTimePicker(props: Props) {
  if (Platform.OS === 'ios') {
    return <DateTimePicker {...props} themeVariant="light" accentColor={Colors.accent} />;
  }
  return <DateTimePicker {...props} />;
}
