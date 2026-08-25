import { Platform, type ModalProps } from 'react-native';

/**
 * Draw the Dialog under the status bar so the overlay isn't inset.
 * `navigationBarTranslucent` is omitted — it can size the window to 0 on some devices.
 */
export const edgeToEdgeModalProps: Pick<ModalProps, 'statusBarTranslucent'> =
  Platform.OS === 'android' ? { statusBarTranslucent: true } : {};
