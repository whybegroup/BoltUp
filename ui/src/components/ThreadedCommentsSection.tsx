import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Modal,
  Pressable,
  Platform,
  Animated,
  ActivityIndicator,
  Alert,
  Dimensions,
  type ScrollView,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Radius, Shadows } from '../constants/theme';
import { ReactionEmojiGlyph } from './ReactionEmojiGlyph';
import { CommentsSection } from './CommentsSection';
import { CommentReplyQuote } from './CommentReplyQuote';

export const COMMENT_THREAD_OPTIONS_MENU_WIDTH = 240;

/** Minimal threaded comment shape (group post comments + mapped event comments). */
export type ThreadComment = {
  id: string;
  userId: string;
  body: string;
  parentCommentId: string | null;
  createdAt: string | number | Date;
  reactions: Array<{ emoji: string; count: number; userIds: string[] }>;
};

function toTimestamp(value: ThreadComment['createdAt']): number {
  if (value instanceof Date) return value.getTime();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

export function invalidReplyParentIds(editingId: string, comments: ThreadComment[]): Set<string> {
  const invalid = new Set<string>([editingId]);
  const walk = (cid: string) => {
    for (const ch of comments) {
      if (ch.parentCommentId === cid) {
        invalid.add(ch.id);
        walk(ch.id);
      }
    }
  };
  walk(editingId);
  return invalid;
}

/** Map API event comments (`text` + `replyToCommentId`) into thread rows. */
export function mapApiEventCommentsToThread(
  comments: Array<{
    id: string;
    userId: string;
    text: string;
    replyToCommentId?: string | null;
    createdAt: Date | string | number;
    reactions: ThreadComment['reactions'];
  }>
): ThreadComment[] {
  return comments.map((c) => ({
    id: c.id,
    userId: c.userId,
    body: c.text ?? '',
    parentCommentId: c.replyToCommentId ?? null,
    createdAt: c.createdAt,
    reactions: c.reactions,
  }));
}

export function buildCommentTree(comments: ThreadComment[]) {
  const sorted = [...comments].sort((a, b) => toTimestamp(a.createdAt) - toTimestamp(b.createdAt));
  // Keep visual ordering strictly chronological; reply parent only affects quote/context.
  const childrenOf = (_id: string) => [] as ThreadComment[];
  return { roots: sorted, childrenOf };
}

export type ThreadedCommentsSectionProps = {
  comments: ThreadComment[];
  /** Vertical offset of this thread’s container (for scroll positioning). */
  ancestorTopPx: number;
  scrollRef: React.RefObject<ScrollView | null>;
  scrollViewportYRef: React.MutableRefObject<number>;
  scrollOffsetYRef: React.MutableRefObject<number>;

  currentUserId: string | null | undefined;
  getUserDisplayName: (userId: string) => string;
  formatCommentTime: (createdAt: ThreadComment['createdAt']) => string;

  draftText: string;
  onDraftTextChange: (text: string) => void;
  replyTargetId: string | null;
  onReplyTargetChange: (id: string | null) => void;
  onSubmitDraft: () => void;

  commentEdit: { commentId: string } | null;
  commentEditText: string;
  onCommentEditTextChange: (text: string) => void;
  commentEditParentId: string | null;
  onCommentEditParentIdChange: (id: string | null) => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  saveEditBusy: boolean;
  /** Event comments cannot change reply parent while editing (API). Default true. */
  supportsEditReplyParent?: boolean;

  onToggleReaction: (commentId: string, emoji: string) => void;
  onReactionChipLongPress?: (payload: { emoji: string; userIds: string[] }) => void;
  onOpenReactionQuickPicker: (commentId: string) => void;

  onBeginEdit: (commentId: string) => void;
  confirmDeleteComment: (commentId: string) => void;

  containerStyle?: StyleProp<ViewStyle>;

  renderAvatar: (userId: string, displayName: string) => ReactNode;
  /** Defaults to plain body text. */
  renderCommentBody?: (comment: ThreadComment) => ReactNode;
  /** Replace only the composer below the list (default: markdown plain TextInput). */
  renderComposer?: () => ReactNode;
  /**
   * Replace default edit UI for a comment. Return null to use built-in group-style editor.
   * Receives child subtree to render under the edited comment.
   */
  renderEditingComment?: (args: {
    comment: ThreadComment;
    childNodes: ReactNode;
  }) => ReactNode | null;

  /** Parent-owned map for reaction quick-picker anchor (`comment:${id}` keys). */
  reactionButtonRefs: React.MutableRefObject<Record<string, View | null>>;
};

export function ThreadedCommentsSection({
  comments,
  ancestorTopPx,
  scrollRef,
  scrollViewportYRef,
  scrollOffsetYRef,
  currentUserId,
  getUserDisplayName,
  formatCommentTime,
  draftText,
  onDraftTextChange,
  replyTargetId,
  onReplyTargetChange,
  onSubmitDraft,
  commentEdit,
  commentEditText,
  onCommentEditTextChange,
  commentEditParentId,
  onCommentEditParentIdChange,
  onCancelEdit,
  onSaveEdit,
  saveEditBusy,
  supportsEditReplyParent = true,
  onToggleReaction,
  onReactionChipLongPress,
  onOpenReactionQuickPicker,
  onBeginEdit,
  confirmDeleteComment,
  containerStyle,
  renderAvatar,
  renderCommentBody,
  renderComposer,
  renderEditingComment,
  reactionButtonRefs,
}: ThreadedCommentsSectionProps) {
  const commentRowRefs = useRef<Record<string, View | null>>({});
  const commentRowTopByIdRef = useRef<Record<string, number>>({});
  const commentMenuButtonRefs = useRef<Record<string, View | null>>({});
  const highlightOpacityByIdRef = useRef<Record<string, Animated.Value>>({});
  const [highlightedCommentIds, setHighlightedCommentIds] = useState<Record<string, true>>({});
  const [commentOptionsTarget, setCommentOptionsTarget] = useState<{
    commentId: string;
    anchor: { x: number; y: number; width: number; height: number };
  } | null>(null);

  const commentOptionsPopoverLayout = useMemo(() => {
    if (!commentOptionsTarget) return null;
    const aw = Dimensions.get('window').width;
    const { anchor } = commentOptionsTarget;
    let left = anchor.x + anchor.width - COMMENT_THREAD_OPTIONS_MENU_WIDTH;
    left = Math.max(8, Math.min(left, aw - COMMENT_THREAD_OPTIONS_MENU_WIDTH - 8));
    const top = anchor.y + anchor.height + 4;
    return { left, top };
  }, [commentOptionsTarget]);

  const getHighlightOpacity = useCallback((commentId: string) => {
    if (!highlightOpacityByIdRef.current[commentId]) {
      highlightOpacityByIdRef.current[commentId] = new Animated.Value(0);
    }
    return highlightOpacityByIdRef.current[commentId];
  }, []);

  const jumpToComment = useCallback(
    (commentId: string) => {
      const node = commentRowRefs.current[commentId] as
        | (View & {
            measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => void;
          })
        | null;
      if (node?.measureInWindow) {
        node.measureInWindow((_x, y) => {
          const viewportY = scrollViewportYRef.current;
          const absoluteTarget = scrollOffsetYRef.current + (y - viewportY);
          scrollRef.current?.scrollTo({ y: Math.max(0, absoluteTarget - 18), animated: true });
        });
      } else {
        const y = commentRowTopByIdRef.current[commentId];
        if (typeof y !== 'number' || !Number.isFinite(y)) return;
        scrollRef.current?.scrollTo({ y: Math.max(0, y - 18), animated: true });
      }
      const opacity = getHighlightOpacity(commentId);
      setHighlightedCommentIds((prev) => ({ ...prev, [commentId]: true }));
      opacity.stopAnimation();
      opacity.setValue(1);
      Animated.timing(opacity, {
        toValue: 0,
        duration: 1500,
        useNativeDriver: true,
      }).start(() => {
        setHighlightedCommentIds((prev) => {
          if (!prev[commentId]) return prev;
          const next = { ...prev };
          delete next[commentId];
          return next;
        });
      });
    },
    [getHighlightOpacity, scrollOffsetYRef, scrollRef, scrollViewportYRef]
  );

  const openCommentMenu = useCallback((commentId: string) => {
    const node = commentMenuButtonRefs.current[commentId] as
      | (View & {
          measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void;
        })
      | null;
    node?.measureInWindow?.((x, y, width, height) => {
      setCommentOptionsTarget({
        commentId,
        anchor: { x, y, width, height },
      });
    });
  }, []);

  const commentsById = useMemo(() => new Map(comments.map((c) => [c.id, c])), [comments]);

  const { roots, childrenOf } = useMemo(() => buildCommentTree(comments), [comments]);
  const editingComment = useMemo(
    () => (commentEdit ? commentsById.get(commentEdit.commentId) ?? null : null),
    [commentEdit, commentsById]
  );

  const renderCommentNode = useCallback(
    (comment: ThreadComment, level: number): ReactNode => {
      const children = childrenOf(comment.id);
      const displayName = getUserDisplayName(comment.userId);
      const repliedTo = comment.parentCommentId
        ? commentsById.get(comment.parentCommentId) ?? null
        : null;
      const isMine = comment.userId === currentUserId;
      const isEditing = !!commentEdit && commentEdit.commentId === comment.id;

      if (isEditing) {
        const customEdit = renderEditingComment?.({
          comment,
          childNodes: <>{children.map((child) => renderCommentNode(child, level + 1))}</>,
        });
        if (customEdit != null) {
          return (
            <View
              key={comment.id}
              ref={(node) => {
                commentRowRefs.current[comment.id] = node;
              }}
              onLayout={(e) => {
                commentRowTopByIdRef.current[comment.id] =
                  ancestorTopPx + e.nativeEvent.layout.y;
              }}
            >
              {customEdit}
            </View>
          );
        }

        return (
          <View
            key={comment.id}
            ref={(node) => {
              commentRowRefs.current[comment.id] = node;
            }}
            onLayout={(e) => {
              commentRowTopByIdRef.current[comment.id] = ancestorTopPx + e.nativeEvent.layout.y;
            }}
          >
            <View style={styles.commentRow}>
              {renderAvatar(comment.userId, displayName)}
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={styles.commentHeaderRow}>
                  <View style={styles.commentHeaderTitleCluster}>
                    <Text
                      numberOfLines={1}
                      ellipsizeMode="tail"
                      style={styles.commentHeaderInlineRoot}
                    >
                      <Text style={[styles.commentName, styles.commentNameMe]}>
                        {`${displayName} (me)`}
                      </Text>
                      <Text style={styles.commentTimeInline}>
                        {formatCommentTime(comment.createdAt)}
                      </Text>
                    </Text>
                  </View>
                </View>
                {(() => {
                  const editParentRaw =
                    commentEditParentId === null
                      ? null
                      : comments.find((x) => x.id === commentEditParentId) ?? null;
                  const editParent =
                    editParentRaw &&
                    editingComment &&
                    toTimestamp(editParentRaw.createdAt) > toTimestamp(editingComment.createdAt)
                      ? null
                      : editParentRaw;
                  const hasReplyTarget =
                    supportsEditReplyParent && !!(commentEditParentId && editParent);

                  return (
                    <>
                      {hasReplyTarget ? (
                        <View style={styles.commentEditReplyComposer}>
                          <View style={styles.composerReplyPreviewRow}>
                            <View style={[styles.replyQuoteStrip, styles.composerReplyQuoteStrip]}>
                              <Ionicons
                                name="return-down-forward"
                                size={14}
                                color={Colors.textMuted}
                                style={{ marginTop: 2 }}
                              />
                              <View style={{ flex: 1, minWidth: 0 }}>
                                <Text style={styles.replyQuoteAuthor} numberOfLines={1}>
                                  {getUserDisplayName(editParent!.userId)}
                                </Text>
                                <Text style={styles.replyQuotePreview} numberOfLines={2}>
                                  {editParent!.body || '(no text)'}
                                </Text>
                              </View>
                            </View>
                            <TouchableOpacity
                              onPress={() => onCommentEditParentIdChange(null)}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              accessibilityLabel="Clear reply target"
                            >
                              <Ionicons name="close" size={20} color={Colors.textMuted} />
                            </TouchableOpacity>
                          </View>
                        </View>
                      ) : null}
                      {supportsEditReplyParent && commentEditParentId && !editParent ? (
                        <Text style={styles.commentEditStaleHint}>
                          Reply target unavailable — tap Reply on an earlier comment to attach this edit
                          to a thread.
                        </Text>
                      ) : null}
                      <TextInput
                        value={commentEditText}
                        onChangeText={onCommentEditTextChange}
                        placeholder={
                          supportsEditReplyParent && commentEditParentId
                            ? 'Write a reply'
                            : 'Edit comment'
                        }
                        placeholderTextColor={Colors.textMuted}
                        style={[styles.commentInput, styles.commentEditInput]}
                        multiline
                        textAlignVertical="top"
                      />
                      <View style={styles.commentEditActions}>
                        <TouchableOpacity onPress={onCancelEdit} style={styles.commentEditSecondaryBtn}>
                          <Text style={styles.commentEditSecondaryBtnText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => void onSaveEdit()}
                          disabled={saveEditBusy || !commentEditText.trim()}
                          style={[
                            styles.commentEditPrimaryBtn,
                            (saveEditBusy || !commentEditText.trim()) &&
                              styles.commentEditPrimaryBtnDisabled,
                          ]}
                        >
                          {saveEditBusy ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Text style={styles.commentEditPrimaryBtnText}>Save</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    </>
                  );
                })()}
              </View>
            </View>
            {children.map((child) => renderCommentNode(child, level + 1))}
          </View>
        );
      }

      return (
        <View
          key={comment.id}
          ref={(node) => {
            commentRowRefs.current[comment.id] = node;
          }}
          onLayout={(e) => {
            commentRowTopByIdRef.current[comment.id] = ancestorTopPx + e.nativeEvent.layout.y;
          }}
        >
          <View style={styles.commentRow}>
            {highlightedCommentIds[comment.id] ? (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.commentRowHighlightOverlay,
                  { opacity: getHighlightOpacity(comment.id) },
                ]}
              />
            ) : null}
            {renderAvatar(comment.userId, displayName)}
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={styles.commentHeaderRow}>
                <View style={styles.commentHeaderTitleCluster}>
                  <Text
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={styles.commentHeaderInlineRoot}
                  >
                    <Text style={[styles.commentName, isMine && styles.commentNameMe]}>
                      {isMine ? `${displayName} (me)` : displayName}
                    </Text>
                    <Text style={styles.commentTimeInline}>
                      {formatCommentTime(comment.createdAt)}
                    </Text>
                  </Text>
                </View>
                {isMine || (comment.body ?? '').trim().length > 0 ? (
                  <TouchableOpacity
                    ref={(node) => {
                      commentMenuButtonRefs.current[comment.id] = node;
                    }}
                    onPress={() => openCommentMenu(comment.id)}
                    style={styles.commentMenuBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityLabel="Comment options"
                  >
                    <Ionicons name="ellipsis-vertical" size={18} color={Colors.textSub} />
                  </TouchableOpacity>
                ) : null}
              </View>
              {repliedTo ? (
                <CommentReplyQuote
                  onPress={() => jumpToComment(repliedTo.id)}
                  author={getUserDisplayName(repliedTo.userId)}
                  preview={repliedTo.body || '(no text)'}
                  containerStyle={styles.replyQuoteStrip}
                  pressedStyle={styles.replyQuotePressed}
                  authorStyle={styles.replyQuoteAuthor}
                  previewStyle={styles.replyQuotePreview}
                  accessibilityLabel="Jump to replied comment"
                />
              ) : null}
              {renderCommentBody ? (
                renderCommentBody(comment)
              ) : (
                <Text style={styles.commentText}>{comment.body}</Text>
              )}
              {comment.reactions.length > 0 ? (
                <View style={styles.reactionChipsRow}>
                  {comment.reactions.map((entry) => (
                    <TouchableOpacity
                      key={`${comment.id}-existing-${entry.emoji}`}
                      style={styles.reactionChip}
                      onPress={() => onToggleReaction(comment.id, entry.emoji)}
                      onLongPress={() =>
                        onReactionChipLongPress?.({
                          emoji: entry.emoji,
                          userIds: entry.userIds,
                        })
                      }
                    >
                      <View style={styles.reactionChipInner}>
                        <ReactionEmojiGlyph emoji={entry.emoji} size={17} />
                        <Text style={styles.reactionChipCount}>{entry.count}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
              <View style={styles.reactionRow}>
                <TouchableOpacity
                  ref={(node) => {
                    reactionButtonRefs.current[`comment:${comment.id}`] = node;
                  }}
                  style={styles.iconActionBtn}
                  onPress={() => onOpenReactionQuickPicker(comment.id)}
                  onLongPress={() => onOpenReactionQuickPicker(comment.id)}
                  accessibilityLabel="Add reaction"
                  activeOpacity={0.75}
                >
                  <Ionicons name="happy-outline" size={15} color={Colors.textSub} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.iconActionBtn}
                  onPress={() => {
                    if (commentEdit) {
                      if (commentEdit.commentId === comment.id) return;
                      const invalid = invalidReplyParentIds(commentEdit.commentId, comments);
                      const editing =
                        commentsById.get(commentEdit.commentId) ??
                        comments.find((x) => x.id === commentEdit.commentId) ??
                        null;
                      const isFutureParent =
                        !!editing &&
                        toTimestamp(comment.createdAt) > toTimestamp(editing.createdAt);
                      if (!invalid.has(comment.id) && !isFutureParent) {
                        onCommentEditParentIdChange(comment.id);
                      }
                      return;
                    }
                    onReplyTargetChange(comment.id);
                  }}
                >
                  <Ionicons
                    name="return-up-forward-outline"
                    size={15}
                    color={Colors.textSub}
                  />
                  <Text style={styles.iconActionText}>Reply</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
          {children.map((child) => renderCommentNode(child, level + 1))}
        </View>
      );
    },
    [
      ancestorTopPx,
      childrenOf,
      commentEdit,
      commentEditParentId,
      commentEditText,
      comments,
      commentsById,
      currentUserId,
      editingComment,
      formatCommentTime,
      getHighlightOpacity,
      getUserDisplayName,
      highlightedCommentIds,
      jumpToComment,
      onCancelEdit,
      onCommentEditParentIdChange,
      onCommentEditTextChange,
      onOpenReactionQuickPicker,
      onReactionChipLongPress,
      onReplyTargetChange,
      onSaveEdit,
      onToggleReaction,
      openCommentMenu,
      renderAvatar,
      renderCommentBody,
      renderEditingComment,
      saveEditBusy,
      supportsEditReplyParent,
    ]
  );

  const replyTargetComment = replyTargetId ? commentsById.get(replyTargetId) : undefined;

  const menuComment = commentOptionsTarget
    ? commentsById.get(commentOptionsTarget.commentId)
    : undefined;
  const copyText = (menuComment?.body ?? '').trim();
  const canEditDelete =
    !!currentUserId && menuComment && menuComment.userId === currentUserId;
  const showCopy = copyText.length > 0;
  const showEdit = canEditDelete;
  const showDelete = canEditDelete;

  return (
    <>
      <CommentsSection
        isEmpty={comments.length === 0}
        containerStyle={containerStyle}
      >
        <>
          {roots.map((r) => renderCommentNode(r, 0))}
          {renderComposer ? (
            renderComposer()
          ) : (
            <View style={styles.commentComposer}>
              {replyTargetComment ? (
                <View style={styles.composerReplyPreviewRow}>
                  <View style={[styles.replyQuoteStrip, styles.composerReplyQuoteStrip]}>
                    <Ionicons
                      name="return-down-forward"
                      size={14}
                      color={Colors.textMuted}
                      style={{ marginTop: 2 }}
                    />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.replyQuoteAuthor} numberOfLines={1}>
                        {getUserDisplayName(replyTargetComment.userId)}
                      </Text>
                      <Text style={styles.replyQuotePreview} numberOfLines={2}>
                        {replyTargetComment.body || '(no text)'}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => onReplyTargetChange(null)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityLabel="Cancel reply"
                  >
                    <Ionicons name="close" size={20} color={Colors.textMuted} />
                  </TouchableOpacity>
                </View>
              ) : null}
              <TextInput
                value={draftText}
                onChangeText={onDraftTextChange}
                placeholder={replyTargetId ? 'Write a reply' : 'Add a comment'}
                placeholderTextColor={Colors.textMuted}
                style={styles.commentInput}
                multiline
              />
              <TouchableOpacity style={styles.replyBtn} onPress={() => void onSubmitDraft()}>
                <Text style={styles.replyBtnText}>{replyTargetId ? 'Reply' : 'Comment'}</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      </CommentsSection>

      {commentOptionsTarget && commentOptionsPopoverLayout ? (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setCommentOptionsTarget(null)}
        >
          <View style={styles.commentOptionsModalRoot} pointerEvents="box-none">
            <Pressable
              style={styles.commentOptionsDismiss}
              onPress={() => setCommentOptionsTarget(null)}
              accessibilityRole="button"
              accessibilityLabel="Dismiss menu"
            />
            <View
              style={[
                styles.commentOptionsPopoverWrap,
                {
                  left: commentOptionsPopoverLayout.left,
                  top: commentOptionsPopoverLayout.top,
                  width: COMMENT_THREAD_OPTIONS_MENU_WIDTH,
                },
              ]}
              pointerEvents="box-none"
            >
              <View style={styles.commentOptionsCard}>
                {showCopy ? (
                  <TouchableOpacity
                    style={[
                      styles.commentOptionsRow,
                      !showEdit && !showDelete ? styles.commentOptionsRowLast : undefined,
                    ]}
                    onPress={async () => {
                      await Clipboard.setStringAsync(copyText);
                      setCommentOptionsTarget(null);
                      if (Platform.OS !== 'web') {
                        Alert.alert('Copied', 'Comment text copied to clipboard.');
                      }
                    }}
                  >
                    <Ionicons name="copy-outline" size={20} color={Colors.text} />
                    <Text style={styles.commentOptionsLabel}>Copy</Text>
                  </TouchableOpacity>
                ) : null}
                {showEdit ? (
                  <TouchableOpacity
                    style={[
                      styles.commentOptionsRow,
                      !showDelete ? styles.commentOptionsRowLast : undefined,
                    ]}
                    onPress={() => {
                      if (menuComment) {
                        setCommentOptionsTarget(null);
                        onBeginEdit(menuComment.id);
                      }
                    }}
                  >
                    <Ionicons name="create-outline" size={20} color={Colors.text} />
                    <Text style={styles.commentOptionsLabel}>Edit</Text>
                  </TouchableOpacity>
                ) : null}
                {showDelete ? (
                  <TouchableOpacity
                    style={[styles.commentOptionsRow, styles.commentOptionsRowLast]}
                    onPress={() => {
                      setCommentOptionsTarget(null);
                      if (commentOptionsTarget) confirmDeleteComment(commentOptionsTarget.commentId);
                    }}
                  >
                    <Ionicons name="trash-outline" size={20} color={Colors.notGoing} />
                    <Text style={[styles.commentOptionsLabel, styles.commentOptionsLabelDanger]}>
                      Delete
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  commentOptionsModalRoot: {
    flex: 1,
  },
  commentOptionsDismiss: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  commentOptionsPopoverWrap: {
    position: 'absolute',
    zIndex: 20,
    elevation: 20,
  },
  commentOptionsCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    width: '100%',
    ...Shadows.lg,
  },
  commentOptionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  commentOptionsRowLast: { borderBottomWidth: 0 },
  commentOptionsLabel: { fontSize: 15, fontFamily: Fonts.medium, color: Colors.text, flex: 1 },
  commentOptionsLabelDanger: { color: Colors.notGoing },
  postCommentsSection: {
    marginTop: 8,
    backgroundColor: Colors.surface,
    borderRadius: Radius['2xl'],
    overflow: 'hidden',
  },
  commentComposer: {
    marginTop: 8,
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 8,
  },
  composerReplyPreviewRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  composerReplyQuoteStrip: {
    flex: 1,
    marginTop: 0,
    marginBottom: 0,
  },
  commentEditReplyComposer: {
    gap: 8,
    marginTop: 4,
  },
  commentEditStaleHint: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
    lineHeight: 17,
    marginBottom: 8,
    marginTop: 2,
  },
  commentEditInput: {
    marginTop: 8,
    minHeight: 72,
  },
  commentEditActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 10,
  },
  commentEditSecondaryBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  commentEditSecondaryBtnText: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: Colors.textSub,
  },
  commentEditPrimaryBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.md,
    backgroundColor: Colors.accent,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentEditPrimaryBtnDisabled: { opacity: 0.45 },
  commentEditPrimaryBtnText: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: '#fff',
  },
  commentInput: {
    minHeight: 42,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: Colors.text,
    backgroundColor: Colors.bg,
  },
  replyBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  replyBtnText: { fontSize: 12, fontFamily: Fonts.semiBold, color: Colors.textSub },
  commentRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    position: 'relative',
  },
  commentRowHighlightOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#fff7cc',
  },
  commentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  commentHeaderTitleCluster: {
    flex: 1,
    minWidth: 0,
    marginRight: 4,
  },
  commentHeaderInlineRoot: {
    width: '100%',
  },
  commentName: { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.text },
  commentNameMe: { color: Colors.going },
  commentMenuBtn: { padding: 2 },
  commentTimeInline: {
    fontSize: 11,
    color: Colors.textMuted,
    fontFamily: Fonts.regular,
    flexShrink: 0,
    marginLeft: 8,
  },
  commentText: { fontSize: 14, color: Colors.text, fontFamily: Fonts.regular, lineHeight: 20 },
  replyQuoteStrip: {
    marginTop: 4,
    marginBottom: 4,
    borderRadius: Radius.lg,
    backgroundColor: Colors.bg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    paddingVertical: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  replyQuotePressed: {
    opacity: 0.9,
  },
  replyQuoteAuthor: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    color: Colors.textMuted,
  },
  replyQuotePreview: {
    fontSize: 14,
    color: Colors.textMuted,
    fontFamily: Fonts.regular,
    lineHeight: 20,
  },
  reactionChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  reactionChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.lg,
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  reactionChipInner: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  reactionChipCount: { fontSize: 13, fontFamily: Fonts.medium, color: Colors.text },
  reactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  iconActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderRadius: Radius.md,
  },
  iconActionText: { fontSize: 12, fontFamily: Fonts.medium, color: Colors.textSub },
});
