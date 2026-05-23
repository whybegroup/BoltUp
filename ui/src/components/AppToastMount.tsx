import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { appToastConfig } from '../config/appToastConfig';

/** Gap below the status bar / notch. */
const TOP_GAP = 12;

/**
 * Mount once in root layout and again inside modal chrome so `Toast.show` uses the
 * topmost ref (see react-native-toast-message) and toasts are not hidden behind stack modals.
 */
export function AppToastMount() {
  const insets = useSafeAreaInsets();
  const topOffset = Math.max(insets.top, 8) + TOP_GAP;

  return (
    <Toast
      config={appToastConfig}
      position="top"
      topOffset={topOffset}
    />
  );
}
