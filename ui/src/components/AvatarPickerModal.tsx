import { useRef, useEffect, useState, useMemo, type MutableRefObject } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Radius } from '../constants/theme';
import { edgeToEdgeModalProps } from './edgeToEdgeModalProps';
import { GroupAvatarPicker } from './GroupAvatarPicker';
import { UserAvatarPicker } from './UserAvatarPicker';
import { uploadPendingAvatarFile, type PendingAvatarFile } from '../services/pickAndUploadImage';

const DEFAULT_AVATAR_SEED = 'auto';

type AvatarVariant = 'user' | 'group';

interface AvatarPickerModalProps {
  variant: AvatarVariant;
  visible: boolean;
  /** Backdrop / close icon: discard unsaved changes (parent resets drafts) and hide. */
  onRequestClose: () => void;
  /** After successful Save; hide only so parent cache can update before resetting drafts. */
  onAfterSave?: () => void;
  seed: string;
  onSeedChange: (text: string) => void;
  thumbnail: string | null;
  onThumbnailChange: (text: string | null) => void;
  /** Firebase uid for S3 uploads (same flow as event photos). */
  userId?: string;
  /** For user variant: shows "Use initial" option to clear to letter avatar. */
  userName?: string;
  /** When provided, shows Save button. Only updates when Save is pressed. */
  onSave?: (seed: string, thumbnail: string | null) => void | Promise<void>;
  isSaving?: boolean;
  /**
   * Defer file upload until Save / Create. Defaults to true when `onSave` is set.
   * Pass explicitly for flows without `onSave` (e.g. new group + Create).
   */
  deferFileUpload?: boolean;
  /** Optional shared ref (e.g. create-group reads on Create). Uses internal ref when omitted. */
  pendingAvatarFileRef?: MutableRefObject<PendingAvatarFile | null>;
  /** When set, avatar photo uploads count toward this group's storage quota. */
  groupId?: string;
}

export function AvatarPickerModal({
  variant,
  visible,
  onRequestClose,
  onAfterSave,
  seed,
  onSeedChange,
  thumbnail,
  onThumbnailChange,
  userId = '',
  userName,
  onSave,
  isSaving,
  deferFileUpload: deferFileUploadProp,
  pendingAvatarFileRef: pendingAvatarFileRefProp,
  groupId,
}: AvatarPickerModalProps) {
  const { width: winW, height: winH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const internalPendingRef = useRef<PendingAvatarFile | null>(null);
  const pendingRef = pendingAvatarFileRefProp ?? internalPendingRef;
  const deferLocalFiles = deferFileUploadProp ?? !!onSave;
  const [isCommitting, setIsCommitting] = useState(false);

  const padX = 16;
  const padTop = Math.max(insets.top, 12);
  const padBottom = Math.max(insets.bottom, 12);
  const cardWidth = Math.min(winW - padX * 2, 720);
  const cardHeight = Math.max(400, winH - padTop - padBottom);

  const overlayStyle = useMemo(
    () => [styles.overlay, { paddingTop: padTop, paddingBottom: padBottom, paddingHorizontal: padX }],
    [padTop, padBottom, padX],
  );

  useEffect(() => {
    if (!visible) {
      const p = pendingRef.current;
      if (p?.kind === 'web') URL.revokeObjectURL(p.objectUrl);
      pendingRef.current = null;
    }
  }, [visible]);

  const title = variant === 'user' ? 'Choose avatar' : 'Choose group avatar';
  const busy = isCommitting || !!isSaving;

  const handleSave = async () => {
    if (!onSave) return;
    setIsCommitting(true);
    try {
      let thumb = thumbnail;
      if (deferLocalFiles && pendingRef.current && userId.trim()) {
        const p = pendingRef.current;
        thumb = await uploadPendingAvatarFile(userId.trim(), p, { groupId });
        onThumbnailChange(thumb);
        if (p.kind === 'web') URL.revokeObjectURL(p.objectUrl);
        pendingRef.current = null;
      }
      await onSave(seed.trim() || DEFAULT_AVATAR_SEED, thumb);
      (onAfterSave ?? onRequestClose)();
    } finally {
      setIsCommitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onRequestClose}
      {...edgeToEdgeModalProps}
    >
      <View style={overlayStyle}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onRequestClose}
        />
        <View style={[styles.card, { width: cardWidth, height: cardHeight }]}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity
              onPress={onRequestClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={22} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>
          <ScrollView
            showsVerticalScrollIndicator={false}
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            bounces={false}
          >
            {variant === 'group' ? (
              <GroupAvatarPicker
                defaultSeed={DEFAULT_AVATAR_SEED}
                value={seed}
                onChangeText={onSeedChange}
                thumbnail={thumbnail}
                onThumbnailChange={onThumbnailChange}
                uploadUserId={userId}
                inputStyle={styles.input}
                deferFileUpload={deferLocalFiles}
                pendingAvatarFileRef={pendingRef}
                groupId={groupId}
              />
            ) : (
              <UserAvatarPicker
                value={seed}
                onChangeBackgroundColor={(colors) => onSeedChange(colors.hex)}
                thumbnail={thumbnail}
                onThumbnailChange={onThumbnailChange}
                uploadUserId={userId}
                userName={userName}
                deferFileUpload={deferLocalFiles}
                pendingAvatarFileRef={pendingRef}
              />
            )}
          </ScrollView>
          {onSave ? (
            <TouchableOpacity
              onPress={handleSave}
              disabled={busy}
              style={[styles.saveBtn, busy && styles.saveBtnDisabled]}
              activeOpacity={0.8}
            >
              {busy ? (
                <ActivityIndicator size="small" color={Colors.textMuted} />
              ) : (
                <Text style={styles.saveBtnText}>Save</Text>
              )}
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay:  {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.32)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card:    {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 20,
    flex: 1,
    maxHeight: undefined,
    overflow: 'hidden',
    zIndex: 1,
  },
  header:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexShrink: 0 },
  title:   { fontSize: 18, fontFamily: Fonts.semiBold, color: Colors.text },
  scroll:  { flexGrow: 1, flexShrink: 1 },
  scrollContent: { paddingBottom: 8 },
  input:   { padding: 10, paddingHorizontal: 12, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface, fontSize: 14, color: Colors.text, fontFamily: Fonts.regular },
  saveBtn: { marginTop: 12, paddingVertical: 12, borderRadius: Radius.lg, backgroundColor: Colors.accent, alignItems: 'center', flexShrink: 0 },
  saveBtnDisabled: { backgroundColor: Colors.border },
  saveBtnText: { fontSize: 14, fontFamily: Fonts.semiBold, color: Colors.accentFg },
});
