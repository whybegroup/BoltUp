import React, { useEffect, useRef, useState, type ChangeEvent } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Colors, Fonts, Radius } from '../constants/theme';
import {
  pickImageFromLibrary,
  uploadPickedImageAsset,
  uploadWebImageFile,
  isCancelled,
} from '../services/pickAndUploadImage';
import { uid } from '../utils/api-helpers';

type Tab = 'link' | 'upload';

export type PhotoUrlOrUploadModalProps = {
  visible: boolean;
  onClose: () => void;
  /**
   * Pasted link: called once with the URL. Upload flow: optional `uploadId` matches
   * {@link onPickPreview} so the parent can swap a local preview for the final URL.
   */
  onAdd: (imageUrl: string, uploadId?: string) => void;
  /** After the user picks a file, before upload finishes — close modal and show this URI in the composer. */
  onPickPreview?: (previewUri: string, uploadId: string) => void;
  /** Upload failed after a preview was shown (same uploadId as onPickPreview). */
  onUploadFailed?: (uploadId: string) => void;
  userId: string;
  title?: string;
};

export function PhotoUrlOrUploadModal({
  visible,
  onClose,
  onAdd,
  onPickPreview,
  onUploadFailed,
  userId,
  title = 'Add photo',
}: PhotoUrlOrUploadModalProps) {
  const [tab, setTab] = useState<Tab>('link');
  const [linkUrl, setLinkUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<{ click: () => void } | null>(null);

  useEffect(() => {
    if (!visible) {
      setLinkUrl('');
      setTab('link');
      setBusy(false);
    }
  }, [visible]);

  const resetAndClose = () => {
    onClose();
  };

  const handleAddLink = () => {
    const url = linkUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      Alert.alert('Invalid URL', 'Enter a full URL starting with https://');
      return;
    }
    onAdd(url);
    onClose();
  };

  const handleNativeUpload = async () => {
    setBusy(true);
    let uploadId: string | undefined;
    try {
      const asset = await pickImageFromLibrary();
      if (onPickPreview) {
        uploadId = uid();
        onPickPreview(asset.uri, uploadId);
      }
      onClose();
      setBusy(false);
      const url = await uploadPickedImageAsset(userId, asset);
      onAdd(url, uploadId);
    } catch (e) {
      if (isCancelled(e)) {
        setBusy(false);
        return;
      }
      if (uploadId) onUploadFailed?.(uploadId);
      const msg = e instanceof Error ? e.message : 'Upload failed';
      Alert.alert('Upload', msg);
    } finally {
      setBusy(false);
    }
  };

  const triggerWebFilePicker = () => {
    fileInputRef.current?.click();
  };

  const onWebFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      Alert.alert('Upload', 'Please choose an image file.');
      return;
    }
    let previewUri: string | undefined;
    let uploadId: string | undefined;
    if (onPickPreview) {
      uploadId = uid();
      previewUri = URL.createObjectURL(file);
      onPickPreview(previewUri, uploadId);
    }
    onClose();
    setBusy(true);
    try {
      const url = await uploadWebImageFile(userId, file);
      onAdd(url, uploadId);
      if (previewUri) URL.revokeObjectURL(previewUri);
    } catch (err) {
      if (uploadId) onUploadFailed?.(uploadId);
      if (previewUri) URL.revokeObjectURL(previewUri);
      const msg = err instanceof Error ? err.message : 'Upload failed';
      Alert.alert('Upload', msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={resetAndClose}>
      {Platform.OS === 'web' && (
        <input
          ref={(el) => {
            fileInputRef.current = el;
          }}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={onWebFileChange}
        />
      )}
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={resetAndClose} activeOpacity={1} />
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>

          <View style={styles.tabs}>
            <TouchableOpacity
              onPress={() => setTab('link')}
              style={[styles.tab, tab === 'link' && styles.tabActive]}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, tab === 'link' && styles.tabTextActive]}>Public link</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setTab('upload')}
              style={[styles.tab, tab === 'upload' && styles.tabActive]}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, tab === 'upload' && styles.tabTextActive]}>Upload file</Text>
            </TouchableOpacity>
          </View>

          {tab === 'link' ? (
            <>
              <Text style={styles.hint}>Paste a direct image URL (any host).</Text>
              <TextInput
                value={linkUrl}
                onChangeText={setLinkUrl}
                placeholder="https://example.com/image.jpg"
                placeholderTextColor={Colors.textMuted}
                style={styles.input}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!busy}
              />
              <View style={styles.actions}>
                <TouchableOpacity onPress={resetAndClose} style={styles.secondaryBtn} activeOpacity={0.8}>
                  <Text style={styles.secondaryBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleAddLink}
                  style={[styles.secondaryBtn, styles.primaryBtn]}
                  activeOpacity={0.8}
                  disabled={busy}
                >
                  <Text style={[styles.secondaryBtnText, styles.primaryBtnText]}>Add</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.hint}>
                Images are uploaded to your S3 bucket (configure API env). Until then, use a public link.
              </Text>
              <TouchableOpacity
                style={[styles.uploadBtn, busy && styles.uploadBtnDisabled]}
                onPress={Platform.OS === 'web' ? triggerWebFilePicker : handleNativeUpload}
                disabled={busy}
                activeOpacity={0.85}
              >
                {busy ? (
                  <ActivityIndicator color={Colors.accentFg} />
                ) : (
                  <Text style={styles.uploadBtnText}>Choose image…</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={resetAndClose}
                style={styles.cancelFullWidth}
                activeOpacity={0.8}
                disabled={busy}
              >
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const webBtnBox =
  Platform.OS === 'web'
    ? ({ boxSizing: 'border-box' as const, maxWidth: '100%' as const } as const)
    : null;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.32)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    width: '100%',
    maxWidth: 360,
  },
  title: { fontSize: 16, fontFamily: Fonts.semiBold, color: Colors.text, marginBottom: 12 },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: { borderColor: Colors.text, backgroundColor: Colors.text },
  tabText: { fontSize: 13, fontFamily: Fonts.medium, color: Colors.textSub, textAlign: 'center' },
  tabTextActive: { color: Colors.accentFg },
  hint: { fontSize: 12, fontFamily: Fonts.regular, color: Colors.textMuted, marginBottom: 10, lineHeight: 18 },
  input: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
    fontSize: 14,
    color: Colors.text,
    fontFamily: Fonts.regular,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none', outlineWidth: 0 } as object) : null),
  },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  secondaryBtn: {
    flex: 1,
    minHeight: 44,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...(webBtnBox ?? {}),
  },
  cancelFullWidth: {
    marginTop: 8,
    width: '100%',
    minHeight: 44,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    ...(webBtnBox ?? {}),
  },
  primaryBtn: { borderColor: Colors.accent, backgroundColor: Colors.accent },
  secondaryBtnText: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: Colors.text,
    textAlign: 'center',
    ...(Platform.OS === 'web' ? ({ maxWidth: '100%' as const } as const) : null),
  },
  primaryBtnText: { color: Colors.accentFg },
  uploadBtn: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: Radius.lg,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    minHeight: 48,
    ...(webBtnBox ?? {}),
  },
  uploadBtnDisabled: { opacity: 0.6 },
  uploadBtnText: { fontSize: 15, fontFamily: Fonts.semiBold, color: Colors.accentFg, textAlign: 'center' },
});
