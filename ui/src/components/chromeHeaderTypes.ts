import type { ReactNode } from 'react';

export type ChromeHeaderTheme = {
  backgroundColor: string;
  borderBottomColor: string;
};

export type ChromeHeaderSlotSetters = {
  setHeaderTrailing: (node: ReactNode | null) => void;
  setHeaderTheme: (theme: ChromeHeaderTheme | null) => void;
};

export type ChromeHeaderSlotState = {
  headerTrailing: ReactNode | null;
  headerTheme: ChromeHeaderTheme | null;
};
