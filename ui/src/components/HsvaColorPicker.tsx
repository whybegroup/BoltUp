import { useState } from 'react';
import { View, StyleSheet, type LayoutChangeEvent } from 'react-native';
import ColorPicker, { HueSlider, OpacitySlider, Panel1, type ColorFormatsObject } from 'reanimated-color-picker';

type Props = {
  value: string;
  onComplete: (colors: ColorFormatsObject) => void;
  showOpacity?: boolean;
};

/** Wait for a real width so HueSlider/Panel1 gradients are not painted at 0px (one solid color). */
export function HsvaColorPicker({ value, onComplete, showOpacity = true }: Props) {
  const [width, setWidth] = useState(0);

  const onLayout = (e: LayoutChangeEvent) => {
    const next = Math.round(e.nativeEvent.layout.width);
    if (next > 0 && next !== width) setWidth(next);
  };

  const sliderStyle = { width, marginTop: 16, borderRadius: 8 };

  return (
    <View onLayout={onLayout} collapsable={false} style={styles.wrap}>
      {width > 0 ? (
        <ColorPicker value={value} onCompleteJS={onComplete} style={{ width }}>
          <Panel1 style={{ width, height: Math.max(140, Math.round(width * 0.55)), borderRadius: 8 }} />
          <HueSlider style={sliderStyle} />
          {showOpacity ? <OpacitySlider style={sliderStyle} /> : null}
        </ColorPicker>
      ) : (
        <View style={styles.placeholder} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  placeholder: { height: 220 },
});
