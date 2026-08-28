import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Radius, Shadows } from '../constants/theme';
import { edgeToEdgeModalProps } from './edgeToEdgeModalProps';
import {
  IMAGE_UPLOAD_QUALITY_LABELS,
  useImageUploadQuality,
  type ImageUploadQuality,
} from '../utils/imageUploadQualityPrefs';

const QUALITY_OPTIONS: Array<{ value: ImageUploadQuality; hint: string }> = [
  { value: 'compressed', hint: 'Resized and compressed for faster uploads' },
  { value: 'original', hint: 'Keeps full resolution, larger files' },
];

type AddImageButtonProps = {
  disabled?: boolean;
  busy?: boolean;
  iconOnly?: boolean;
  tile?: boolean;
  label?: string;
  triggerIconName?: 'camera-outline' | 'image-outline';
  /** Title for the camera/library/link option sheet */
  optionsModalTitle?: string;
  /** Title for the URL entry modal */
  linkModalTitle?: string;
  onTakePhoto: () => Promise<void> | void;
  onChooseFromLibrary: () => Promise<void> | void;
  onInsertLink: (url: string) => Promise<void> | void;
};

export function AddImageButton({
  disabled = false,
  busy = false,
  iconOnly = false,
  tile = false,
  label = 'Add photo',
  triggerIconName = 'camera-outline',
  optionsModalTitle = 'Insert image',
  linkModalTitle = 'Insert image link',
  onTakePhoto,
  onChooseFromLibrary,
  onInsertLink,
}: AddImageButtonProps) {
  const [showOptions, setShowOptions] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showQuality, setShowQuality] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [quality, setQuality] = useImageUploadQuality();
  const isDisabled = disabled || busy;

  const closeAll = () => {
    setShowOptions(false);
    setShowLinkModal(false);
    setShowQuality(false);
  };

  const openOptions = () => {
    setShowQuality(false);
    setShowOptions(true);
  };

  return (
    <>
      <TouchableOpacity
        style={[
          tile ? styles.tileBtn : iconOnly ? styles.iconBtn : styles.labelBtn,
          isDisabled && styles.disabled,
        ]}
        onPress={openOptions}
        disabled={isDisabled}
        accessibilityLabel={label}
      >
        <Ionicons name={triggerIconName} size={tile ? 20 : 16} color={Colors.textSub} />
        {tile ? <Text style={styles.tileLabel}>{label}</Text> : !iconOnly ? <Text style={styles.label}>{label}</Text> : null}
      </TouchableOpacity>

      {showOptions ? (
        <Modal visible transparent animationType="fade" onRequestClose={closeAll} {...edgeToEdgeModalProps}>
          <View style={styles.overlayRoot}>
            <Pressable style={styles.overlayBackdrop} onPress={closeAll} />
            <View style={styles.overlayCenter} pointerEvents="box-none">
              <View style={styles.card} pointerEvents="auto">
                <View style={styles.titleRow}>
                  {showQuality ? (
                    <TouchableOpacity
                      style={styles.headerIconBtn}
                      onPress={() => setShowQuality(false)}
                      accessibilityLabel="Back"
                    >
                      <Ionicons name="chevron-back" size={18} color={Colors.textSub} />
                    </TouchableOpacity>
                  ) : null}
                  <Text style={styles.title}>{showQuality ? 'Upload quality' : optionsModalTitle}</Text>
                  {showQuality ? null : (
                    <TouchableOpacity
                      style={styles.headerIconBtn}
                      onPress={() => setShowQuality(true)}
                      accessibilityLabel="Upload options"
                    >
                      <Ionicons name="ellipsis-vertical" size={18} color={Colors.textSub} />
                    </TouchableOpacity>
                  )}
                </View>

                {showQuality ? (
                  <>
                    <Text style={styles.qualityHint}>
                      Photos are saved as JPEG or PNG so they open on any device.
                    </Text>
                    {QUALITY_OPTIONS.map((opt) => {
                      const active = quality === opt.value;
                      return (
                        <TouchableOpacity
                          key={opt.value}
                          style={[styles.optionBtn, active && styles.optionBtnActive]}
                          onPress={() => {
                            setQuality(opt.value);
                            setShowQuality(false);
                          }}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: active }}
                        >
                          <Ionicons
                            name={active ? 'radio-button-on' : 'radio-button-off'}
                            size={16}
                            color={active ? Colors.accent : Colors.textSub}
                          />
                          <View style={styles.optionTextCol}>
                            <Text style={styles.optionText}>{IMAGE_UPLOAD_QUALITY_LABELS[opt.value]}</Text>
                            <Text style={styles.optionSubText}>{opt.hint}</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </>
                ) : (
                  <>
                    <TouchableOpacity
                      style={styles.optionBtn}
                      onPress={async () => {
                        closeAll();
                        await onTakePhoto();
                      }}
                    >
                      <Ionicons name="camera-outline" size={16} color={Colors.textSub} />
                      <Text style={styles.optionText}>Take photo</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.optionBtn}
                      onPress={async () => {
                        closeAll();
                        await onChooseFromLibrary();
                      }}
                    >
                      <Ionicons name="folder-open-outline" size={16} color={Colors.textSub} />
                      <Text style={styles.optionText}>Choose from library</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.optionBtn}
                      onPress={() => {
                        setShowOptions(false);
                        setShowLinkModal(true);
                      }}
                    >
                      <Ionicons name="link-outline" size={16} color={Colors.textSub} />
                      <Text style={styles.optionText}>Insert link</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          </View>
        </Modal>
      ) : null}

      {showLinkModal ? (
        <Modal visible transparent animationType="fade" onRequestClose={closeAll} {...edgeToEdgeModalProps}>
          <View style={styles.overlayRoot}>
            <Pressable style={styles.overlayBackdrop} onPress={closeAll} />
            <View style={styles.overlayCenter} pointerEvents="box-none">
              <View style={styles.card} pointerEvents="auto">
                <Text style={styles.title}>{linkModalTitle}</Text>
                <TextInput
                  value={linkUrl}
                  onChangeText={setLinkUrl}
                  placeholder="https://example.com/image.jpg"
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.input}
                />
                <View style={styles.actions}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={closeAll}>
                    <Text style={styles.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.applyBtn, !linkUrl.trim() && styles.disabled]}
                    onPress={async () => {
                      const url = linkUrl.trim();
                      if (!url) return;
                      closeAll();
                      setLinkUrl('');
                      await onInsertLink(url);
                    }}
                    disabled={!linkUrl.trim()}
                  >
                    <Text style={styles.applyText}>Apply</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  disabled: { opacity: 0.45 },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 9,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
  },
  label: { fontSize: 12, color: Colors.textSub, fontFamily: Fonts.medium },
  tileBtn: {
    width: 80,
    height: 80,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  tileLabel: {
    fontSize: 11,
    color: Colors.textSub,
    fontFamily: Fonts.medium,
  },
  overlayRoot: { flex: 1 },
  overlayBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: Colors.overlay },
  overlayCenter: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    flexGrow: 0,
    borderRadius: Radius.xl,
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: 14,
    ...Shadows.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 10,
  },
  title: { fontSize: 15, fontFamily: Fonts.semiBold, color: Colors.text, flex: 1 },
  headerIconBtn: {
    width: 30,
    height: 30,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qualityHint: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
    lineHeight: 17,
    marginBottom: 10,
  },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
    marginBottom: 8,
  },
  optionBtnActive: { borderColor: Colors.accent },
  optionTextCol: { flex: 1, gap: 2 },
  optionText: { fontSize: 14, fontFamily: Fonts.medium, color: Colors.text },
  optionSubText: { fontSize: 11, fontFamily: Fonts.regular, color: Colors.textMuted },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.text,
    backgroundColor: Colors.bg,
    marginBottom: 8,
  },
  actions: { marginTop: 4, flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  cancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
  },
  cancelText: { fontSize: 13, fontFamily: Fonts.medium, color: Colors.textSub },
  applyBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.md, backgroundColor: Colors.accent },
  applyText: { fontSize: 13, fontFamily: Fonts.semiBold, color: '#fff' },
});
