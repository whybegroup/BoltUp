import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Modal,
  Linking,
  ActivityIndicator,
  Pressable,
  Platform,
  Dimensions,
  Animated,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Markdown from 'react-native-markdown-display';
import { Colors, Fonts, Radius, Shadows } from '../constants/theme';
import { COMMENT_REACTION_EMOJIS } from '../constants/commentReactionEmojis';
import { DEFAULT_COMMENT_QUICK_REACTIONS_LIST } from '../utils/commentQuickReactionsPrefs';
import { ReactionEmojiGlyph } from './ReactionEmojiGlyph';
import { useCommentQuickReactions } from '../hooks/useCommentQuickReactions';
import { useCurrentUserContext } from '../contexts/CurrentUserContext';
import {
  useGroup,
  useGroups,
  useNotifications,
  useAllGroupMemberColors,
  useGroupPosts,
  useUsers,
  useCreateGroupPost,
  useToggleGroupPostReaction,
  useCreateGroupPostComment,
  useToggleGroupPostCommentReaction,
} from '../hooks/api';
import { GroupsTopHeader } from './GroupsTopHeader';
import { GroupsBreadcrumbTrail, type BreadcrumbSegment } from './GroupsBreadcrumbTrail';
import { NotificationsPanelModal } from './NotificationsPanelModal';
import { EmojiBar } from './EmojiBar';
import { CommentsSection } from './CommentsSection';
import { UserAvatar } from './UserAvatar';
import { ResolvableImage } from './ResolvableImage';
import { ImageLightboxModal } from './ImageLightboxModal';
import { AddImageButton } from './AddImageButton';
import { CommentReplyQuote } from './CommentReplyQuote';
import { type GroupPost, type GroupPostComment } from '@moijia/client';
import { pickAndUploadCoverPhoto, takeAndUploadCoverPhoto } from '../services/pickAndUploadImage';

export type GroupForumViewProps = {
  groupId: string;
  switchableGroups?: { id: string; name: string }[];
  onSwitchGroup?: (groupId: string) => void;
};

function forumId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatCreatedAt(value: string | number): string {
  const date = typeof value === 'string' ? new Date(value) : new Date(value);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function parseImageLine(trimmedLine: string): { alt: string; url: string } | null {
  const markdownMatch = trimmedLine.match(/^!\[(.*?)\]\(([^)\s]+)\)$/);
  if (markdownMatch) {
    return { alt: markdownMatch[1] || 'Image', url: markdownMatch[2] };
  }
  const plainUrlLike = /^[^\s]+$/.test(trimmedLine);
  if (!plainUrlLike) return null;
  const looksLikeImageUrl = /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i.test(trimmedLine);
  if (looksLikeImageUrl) {
    return { alt: 'Image', url: trimmedLine };
  }
  return null;
}

function extractMarkdownImagesFromText(line: string): {
  textWithoutImages: string;
  images: Array<{ alt: string; url: string }>;
} {
  const images: Array<{ alt: string; url: string }> = [];
  const textWithoutImages = line.replace(/!\[(.*?)\]\(([^)\s]+)\)/g, (_match, alt, url) => {
    images.push({ alt: alt || 'Image', url });
    return '';
  });
  return { textWithoutImages, images };
}

function wrapBareUrlsWithMarkdown(text: string): string {
  return text.replace(/(^|[\s\n])(https?:\/\/[^\s)]+)(?=$|[\s\n])/gi, (_match, prefix, rawUrl) => {
    const url = rawUrl.trim();
    const isAlreadyMarkdown = /\]\([^)]+\)$/.test(prefix + url);
    if (isAlreadyMarkdown) return `${prefix}${url}`;
    const isImageUrl = /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i.test(url);
    if (isImageUrl) return `${prefix}![Image](${url})`;
    return `${prefix}[${url}](${url})`;
  });
}

export function GroupForumView({ groupId, switchableGroups = [], onSwitchGroup }: GroupForumViewProps) {
  const router = useRouter();
  const { userId: currentUserId } = useCurrentUserContext();
  const scrollRef = useRef<ScrollView | null>(null);
  const scrollViewportYRef = useRef(0);
  const scrollOffsetYRef = useRef(0);
  const commentRowRefs = useRef<Record<string, View | null>>({});
  const postTopByIdRef = useRef<Record<string, number>>({});
  const commentRowTopByIdRef = useRef<Record<string, number>>({});
  const highlightOpacityByIdRef = useRef<Record<string, Animated.Value>>({});
  const [showNotifs, setShowNotifs] = useState(false);
  const [showSwitchGroups, setShowSwitchGroups] = useState(false);
  const [postBody, setPostBody] = useState('');
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [composerSelection, setComposerSelection] = useState<{ start: number; end: number }>({
    start: 0,
    end: 0,
  });
  const [composerLinkPopover, setComposerLinkPopover] = useState<{
    mode: 'link' | 'image';
    text: string;
    url: string;
    replaceStart?: number;
    replaceEnd?: number;
  } | null>(null);
  const [expandedPostBodyById, setExpandedPostBodyById] = useState<Record<string, boolean>>({});
  const [postCarouselWidthById, setPostCarouselWidthById] = useState<Record<string, number>>({});
  const [postCarouselIndexById, setPostCarouselIndexById] = useState<Record<string, number>>({});
  const [draftComments, setDraftComments] = useState<Record<string, string>>({});
  const [replyTargetByPost, setReplyTargetByPost] = useState<Record<string, string | null>>({});
  const [expandedCommentsByPost, setExpandedCommentsByPost] = useState<Record<string, boolean>>({});
  const [reactionQuickPickerTarget, setReactionQuickPickerTarget] = useState<
    { kind: 'post' | 'comment'; id: string } | null
  >(null);
  const [reactionQuickPickerAnchor, setReactionQuickPickerAnchor] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [reactionPickerTarget, setReactionPickerTarget] = useState<
    { kind: 'post' | 'comment'; id: string } | null
  >(null);
  const [reactionDetailModal, setReactionDetailModal] = useState<{
    emoji: string;
    userIds: string[];
  } | null>(null);
  const [imageLightbox, setImageLightbox] = useState<{
    urls: string[];
    index: number;
    alts?: string[];
    ownerName?: string;
    ownerAvatarSeed?: string | null;
    ownerThumbnail?: string | null;
  } | null>(null);
  const [highlightedCommentIds, setHighlightedCommentIds] = useState<Record<string, true>>({});
  const reactionButtonRefs = useRef<Record<string, View | null>>({});

  const { data: group, isError } = useGroup(groupId, currentUserId ?? '');
  const { data: allGroupsForChrome = [] } = useGroups(currentUserId ?? '', true);
  const { data: allUsers = [] } = useUsers();
  const { data: notifs = [], isLoading: notifsLoading } = useNotifications(currentUserId || '');
  const { data: groupColors = {} } = useAllGroupMemberColors(currentUserId || '');
  const { data: posts = [], isLoading: postsLoading } = useGroupPosts(groupId, currentUserId ?? '');
  const createPostMutation = useCreateGroupPost(groupId, currentUserId ?? '');
  const togglePostReactionMutation = useToggleGroupPostReaction(groupId, currentUserId ?? '');
  const createCommentMutation = useCreateGroupPostComment(groupId, currentUserId ?? '');
  const toggleCommentReactionMutation = useToggleGroupPostCommentReaction(groupId, currentUserId ?? '');
  const { data: commentQuickReactions = [...DEFAULT_COMMENT_QUICK_REACTIONS_LIST] } =
    useCommentQuickReactions(currentUserId);

  const titleIsSwitchable = switchableGroups.length > 0 && !!onSwitchGroup;

  const goToOverview = useCallback(() => {
    router.replace('/(tabs)/groups');
  }, [router]);

  const breadcrumbSegments: BreadcrumbSegment[] = useMemo(() => {
    if (!group) return [{ label: 'All Groups', onPress: goToOverview }];
    return [
      { label: 'All Groups', onPress: goToOverview },
      {
        label: group.name,
        onPress: titleIsSwitchable
          ? () => setShowSwitchGroups(true)
          : () => router.push(`/(tabs)/groups/${groupId}` as Href),
        showSwitchChevron: titleIsSwitchable,
      },
      { label: 'Posts' },
    ];
  }, [group, goToOverview, groupId, router, titleIsSwitchable]);

  const eventEligibleGroupCount = useMemo(
    () =>
      allGroupsForChrome.filter(
        (g) => !g.deletedAt && (g.membershipStatus === 'member' || g.membershipStatus === 'admin')
      ).length,
    [allGroupsForChrome]
  );
  const unreadNotifCount = useMemo(() => notifs.filter((n) => !n.read).length, [notifs]);

  useEffect(() => {
    if (isError || (group && group.membershipStatus === 'none')) {
      router.replace('/(tabs)/groups');
    }
  }, [group, isError, router]);

  useEffect(() => {
    if (group?.membershipStatus === 'pending') {
      router.replace(`/(tabs)/groups/${groupId}` as Href);
    }
  }, [group?.membershipStatus, groupId, router]);

  const replaceComposerSelection = useCallback(
    (
      transform: (selectedText: string) => {
        insert: string;
        selectionStart: number;
        selectionEnd: number;
      }
    ) => {
      setPostBody((prev) => {
        const start = Math.max(0, Math.min(composerSelection.start, prev.length));
        const end = Math.max(start, Math.min(composerSelection.end, prev.length));
        const before = prev.slice(0, start);
        const selected = prev.slice(start, end);
        const after = prev.slice(end);
        const next = transform(selected);
        const nextBody = `${before}${next.insert}${after}`;
        setComposerSelection({
          start: start + next.selectionStart,
          end: start + next.selectionEnd,
        });
        return nextBody;
      });
    },
    [composerSelection.end, composerSelection.start]
  );

  const insertImageAtSelection = useCallback(
    (url: string) => {
      replaceComposerSelection((selected) => {
        const inner = selected?.trim() || 'Image';
        const insert = `![${inner}](${url})`;
        return { insert, selectionStart: 2, selectionEnd: 2 + inner.length };
      });
    },
    [replaceComposerSelection]
  );

  const uploadAndInsertImage = useCallback(async () => {
    if (!currentUserId || isUploadingAttachment) return;
    try {
      setIsUploadingAttachment(true);
      const publicUrl = await pickAndUploadCoverPhoto(currentUserId);
      if (!publicUrl) return;
      insertImageAtSelection(publicUrl);
    } finally {
      setIsUploadingAttachment(false);
    }
  }, [currentUserId, insertImageAtSelection, isUploadingAttachment]);

  const takePhotoAndInsertImage = useCallback(async () => {
    if (!currentUserId || isUploadingAttachment) return;
    try {
      setIsUploadingAttachment(true);
      const publicUrl = await takeAndUploadCoverPhoto(currentUserId);
      if (!publicUrl) return;
      insertImageAtSelection(publicUrl);
    } catch (e) {
      Alert.alert('Upload', e instanceof Error ? e.message : 'Could not upload photo');
    } finally {
      setIsUploadingAttachment(false);
    }
  }, [currentUserId, insertImageAtSelection, isUploadingAttachment]);

  const applyTool = useCallback(
    (tool: 'bold' | 'italic' | 'bullet' | 'link' | 'image') => {
      if (tool === 'bold') {
        replaceComposerSelection((selected) => {
          const inner = selected || 'bold text';
          const insert = `**${inner}**`;
          return { insert, selectionStart: 2, selectionEnd: 2 + inner.length };
        });
        return;
      }
      if (tool === 'italic') {
        replaceComposerSelection((selected) => {
          const inner = selected || 'italic text';
          const insert = `*${inner}*`;
          return { insert, selectionStart: 1, selectionEnd: 1 + inner.length };
        });
        return;
      }
      if (tool === 'link') {
        replaceComposerSelection((selected) => {
          const inner = selected || 'link text';
          const insert = `[${inner}](https://example.com)`;
          return { insert, selectionStart: 1, selectionEnd: 1 + inner.length };
        });
        return;
      }
      if (tool === 'image') {
        replaceComposerSelection((selected) => {
          const inner = selected || ' ';
          const insert = `![${inner}](https://example.com/image.jpg)`;
          return { insert, selectionStart: 2, selectionEnd: 2 + inner.length };
        });
        return;
      }
      replaceComposerSelection((selected) => {
        if (!selected) {
          const insert = '- bullet item';
          return { insert, selectionStart: 2, selectionEnd: insert.length };
        }
        const lines = selected.split(/\r?\n/);
        const bulleted = lines.map((line) => (line.trim().startsWith('- ') ? line : `- ${line}`)).join('\n');
        return { insert: bulleted, selectionStart: 0, selectionEnd: bulleted.length };
      });
    },
    [replaceComposerSelection]
  );

  const detectHeadingLevelAtSelection = useCallback(() => {
    const start = Math.max(0, Math.min(composerSelection.start, postBody.length));
    const end = Math.max(start, Math.min(composerSelection.end, postBody.length));
    const lineStart = postBody.lastIndexOf('\n', start - 1) + 1;
    const lineEndIdx = postBody.indexOf('\n', end);
    const lineEnd = lineEndIdx === -1 ? postBody.length : lineEndIdx;
    const activeSegment = postBody.slice(lineStart, lineEnd);
    const match = activeSegment.match(/^\s*(#{1,6})\s+/);
    return match ? Math.max(1, Math.min(6, match[1].length)) : 0;
  }, [composerSelection.end, composerSelection.start, postBody]);

  const applyHeadingLevel = useCallback(
    (level: number) => {
    const safeLevel = Math.max(1, Math.min(6, level));
    const marker = `${'#'.repeat(safeLevel)} `;
    setPostBody((prev) => {
      const start = Math.max(0, Math.min(composerSelection.start, prev.length));
      const end = Math.max(start, Math.min(composerSelection.end, prev.length));
      const hasSelection = end > start;
      if (hasSelection) {
        const before = prev.slice(0, start);
        const selected = prev.slice(start, end);
        const after = prev.slice(end);
        const headed = selected
          .split(/\r?\n/)
          .map((line) => {
            if (!line.trim()) return line;
            const stripped = line.replace(/^(\s*)(#{1,6}\s+)?/, '$1');
            return `${marker}${stripped.trimStart()}`;
          })
          .join('\n');
        setComposerSelection({ start, end: start + headed.length });
        return `${before}${headed}${after}`;
      }

      const lineStart = prev.lastIndexOf('\n', start - 1) + 1;
      const lineEndIdx = prev.indexOf('\n', start);
      const lineEnd = lineEndIdx === -1 ? prev.length : lineEndIdx;
      const line = prev.slice(lineStart, lineEnd);
      const linePrefixMatch = line.match(/^(\s*)/);
      const indent = linePrefixMatch?.[1] ?? '';
      const content = line.replace(/^(\s*)(#{1,6}\s+)?/, '$1').slice(indent.length);
      const nextLine = `${indent}${marker}${content.trimStart()}`;
      const before = prev.slice(0, lineStart);
      const after = prev.slice(lineEnd);
      const cursorOffsetInLine = start - lineStart;
      const nextCursor = Math.min(lineStart + nextLine.length, lineStart + marker.length + Math.max(0, cursorOffsetInLine));
      setComposerSelection({ start: nextCursor, end: nextCursor });
      return `${before}${nextLine}${after}`;
    });
    },
    [composerSelection.end, composerSelection.start]
  );

  const increaseTextSize = useCallback(() => {
    const current = detectHeadingLevelAtSelection();
    const next = current === 0 ? 4 : Math.max(1, current - 1);
    applyHeadingLevel(next);
  }, [applyHeadingLevel, detectHeadingLevelAtSelection]);

  const decreaseTextSize = useCallback(() => {
    const current = detectHeadingLevelAtSelection();
    const next = current === 0 ? 5 : Math.min(6, current + 1);
    applyHeadingLevel(next);
  }, [applyHeadingLevel, detectHeadingLevelAtSelection]);

  const openComposerLinkPopover = useCallback(
    (mode: 'link' | 'image') => {
      const start = Math.max(0, Math.min(composerSelection.start, postBody.length));
      const end = Math.max(start, Math.min(composerSelection.end, postBody.length));
      const selected = postBody.slice(start, end).trim();
      let matchedText = selected;
      let matchedUrl = '';
      let replaceStart: number | undefined;
      let replaceEnd: number | undefined;

      const tokenRegex = /(!?)\[(.*?)\]\(([^)\s]+)\)/g;
      let match: RegExpExecArray | null;
      while ((match = tokenRegex.exec(postBody)) !== null) {
        const isImageToken = match[1] === '!';
        const tokenMode = isImageToken ? 'image' : 'link';
        if (tokenMode !== mode) continue;
        const tokenStart = match.index;
        const tokenEnd = tokenStart + match[0].length;
        const intersectsSelection = start < tokenEnd && end > tokenStart;
        const cursorInside = start === end && start >= tokenStart && start <= tokenEnd;
        if (!intersectsSelection && !cursorInside) continue;
        matchedText = match[2] ?? '';
        matchedUrl = match[3] ?? '';
        replaceStart = tokenStart;
        replaceEnd = tokenEnd;
        break;
      }

      setComposerLinkPopover({
        mode,
        text: matchedText,
        url: matchedUrl,
        replaceStart,
        replaceEnd,
      });
    },
    [composerSelection.end, composerSelection.start, postBody]
  );

  const applyComposerLinkPopover = useCallback(() => {
    if (!composerLinkPopover) return;
    const cleanUrl = composerLinkPopover.url.trim();
    if (!cleanUrl) return;
    const cleanText = composerLinkPopover.text.trim();
    const hasReplaceRange =
      typeof composerLinkPopover.replaceStart === 'number' &&
      typeof composerLinkPopover.replaceEnd === 'number' &&
      composerLinkPopover.replaceEnd >= composerLinkPopover.replaceStart;
    if (hasReplaceRange) {
      const replaceStart = Math.max(0, Math.min(composerLinkPopover.replaceStart ?? 0, postBody.length));
      const replaceEnd = Math.max(
        replaceStart,
        Math.min(composerLinkPopover.replaceEnd ?? replaceStart, postBody.length)
      );
      const before = postBody.slice(0, replaceStart);
      const after = postBody.slice(replaceEnd);
      if (composerLinkPopover.mode === 'link') {
        const inner = cleanText || 'link text';
        const insert = `[${inner}](${cleanUrl})`;
        setPostBody(`${before}${insert}${after}`);
        setComposerSelection({ start: replaceStart + 1, end: replaceStart + 1 + inner.length });
      } else {
        const inner = cleanText || ' ';
        const insert = `![${inner}](${cleanUrl})`;
        setPostBody(`${before}${insert}${after}`);
        setComposerSelection({ start: replaceStart + 2, end: replaceStart + 2 + inner.length });
      }
      setComposerLinkPopover(null);
      return;
    }
    if (composerLinkPopover.mode === 'link') {
      replaceComposerSelection((selected) => {
        const inner = cleanText || selected || 'link text';
        const insert = `[${inner}](${cleanUrl})`;
        return { insert, selectionStart: 1, selectionEnd: 1 + inner.length };
      });
    } else {
      replaceComposerSelection((selected) => {
        const inner = cleanText || selected || ' ';
        const insert = `![${inner}](${cleanUrl})`;
        return { insert, selectionStart: 2, selectionEnd: 2 + inner.length };
      });
    }
    setComposerLinkPopover(null);
  }, [composerLinkPopover, postBody, replaceComposerSelection]);

  const markdownStyles = useMemo(
    () => ({
      body: { color: Colors.text, fontFamily: Fonts.regular, fontSize: 14, lineHeight: 21 },
      paragraph: { marginTop: 0, marginBottom: 0, color: Colors.text, fontFamily: Fonts.regular, fontSize: 14, lineHeight: 21 },
      strong: { fontFamily: Fonts.semiBold },
      em: { fontStyle: 'italic' as const },
      link: { color: Colors.accent, textDecorationLine: 'underline' as const },
      heading1: { fontFamily: Fonts.semiBold, fontSize: 24, lineHeight: 30, marginTop: 0, marginBottom: 4, color: Colors.text },
      heading2: { fontFamily: Fonts.semiBold, fontSize: 20, lineHeight: 26, marginTop: 0, marginBottom: 4, color: Colors.text },
      heading3: { fontFamily: Fonts.semiBold, fontSize: 17, lineHeight: 23, marginTop: 0, marginBottom: 4, color: Colors.text },
      bullet_list: { marginTop: 0, marginBottom: 0 },
      ordered_list: { marginTop: 0, marginBottom: 0 },
      list_item: { marginTop: 0, marginBottom: 0 },
    }),
    []
  );

  const renderRichBody = useCallback(
    (body: string, keyPrefix: string) => {
      const lines = body.split(/\r?\n/);
      const allImageUrls: string[] = [];
      const allImageAlts: string[] = [];
      for (const line of lines) {
        const parsedImage = parseImageLine(line.trim());
        if (parsedImage) {
          allImageUrls.push(parsedImage.url);
          allImageAlts.push(parsedImage.alt || '');
          continue;
        }
        const extracted = extractMarkdownImagesFromText(line);
        extracted.images.forEach((img) => {
          allImageUrls.push(img.url);
          allImageAlts.push(img.alt || '');
        });
      }
      let renderedImageIdx = 0;
      return (
        <View style={styles.richBodyWrap}>
          {lines.map((line, i) => {
            const trimmed = line.trim();
            const parsedImage = parseImageLine(trimmed);
            if (parsedImage) {
              const currentIdx = renderedImageIdx++;
              return (
                <View key={`${keyPrefix}-img-${i}`} style={styles.imageBlock}>
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() =>
                      setImageLightbox({
                        urls: allImageUrls,
                        index: currentIdx,
                        alts: allImageAlts,
                        ownerName: currentUserId ? getUserDisplayName(currentUserId) : group?.name,
                      })
                    }
                  >
                    <ResolvableImage storedUrl={parsedImage.url} style={styles.inlineImage} resizeMode="cover" />
                  </TouchableOpacity>
                  <Text style={styles.imageCaption}>{parsedImage.alt}</Text>
                </View>
              );
            }
            const { textWithoutImages, images } = extractMarkdownImagesFromText(line);
            const lineWithoutImagesTrimmed = textWithoutImages.trim();

            if (!lineWithoutImagesTrimmed && images.length === 0) {
              return <View key={`${keyPrefix}-spacer-${i}`} style={styles.lineSpacer} />;
            }

            return (
              <View key={`${keyPrefix}-mixed-${i}`} style={styles.richBodyWrap}>
                {lineWithoutImagesTrimmed ? (
                  <Markdown
                    style={markdownStyles}
                    onLinkPress={(url) => {
                      Linking.openURL(url);
                      return false;
                    }}
                  >
                    {lineWithoutImagesTrimmed}
                  </Markdown>
                ) : null}
                {images.map((image, imageIdx) => (
                  (() => {
                    const currentIdx = renderedImageIdx++;
                    return (
                  <View key={`${keyPrefix}-img-inline-${i}-${imageIdx}`} style={styles.imageBlock}>
                    <TouchableOpacity
                      activeOpacity={0.9}
                      onPress={() =>
                        setImageLightbox({
                          urls: allImageUrls,
                          index: currentIdx,
                          alts: allImageAlts,
                          ownerName: currentUserId ? getUserDisplayName(currentUserId) : group?.name,
                        })
                      }
                    >
                      <ResolvableImage storedUrl={image.url} style={styles.inlineImage} resizeMode="cover" />
                    </TouchableOpacity>
                    <Text style={styles.imageCaption}>{image.alt}</Text>
                  </View>
                    );
                  })()
                ))}
              </View>
            );
          })}
        </View>
      );
    },
    [currentUserId, group?.name, markdownStyles]
  );

  const parsePostBody = useCallback((body: string) => {
    const lines = body.split(/\r?\n/);
    const textLines: string[] = [];
    const images: Array<{ alt: string; url: string }> = [];
    for (const line of lines) {
      const trimmed = line.trim();
      const parsedImage = parseImageLine(trimmed);
      if (parsedImage) {
        images.push(parsedImage);
        continue;
      }
      const extracted = extractMarkdownImagesFromText(line);
      if (extracted.images.length > 0) {
        images.push(...extracted.images);
      }
      const remainingLine = extracted.textWithoutImages;
      if (remainingLine.trim().length > 0) {
        textLines.push(remainingLine);
      }
    }
    return { textLines, images };
  }, []);

  const usersById = useMemo(() => new Map(allUsers.map((u) => [u.id, u])), [allUsers]);
  const getUserDisplayName = useCallback(
    (userId: string) => {
      const user = usersById.get(userId);
      return user?.displayName || user?.name || 'Member';
    },
    [usersById]
  );

  const createPost = useCallback(async () => {
    const body = postBody.trim();
    if (!body || !currentUserId) return;
    const title = body.split(/\r?\n/).map((line) => line.trim()).find(Boolean)?.slice(0, 80) || 'Post';
    await createPostMutation.mutateAsync({
      id: forumId('post'),
      userId: currentUserId,
      title,
      body,
    });
    setPostBody('');
  }, [createPostMutation, currentUserId, postBody]);

  const handleComposerChangeText = useCallback(
    (nextBody: string) => {
      const prevBody = postBody;
      if (!nextBody.includes('http') || nextBody === prevBody) {
        setPostBody(nextBody);
        return;
      }

      let prefix = 0;
      while (prefix < prevBody.length && prefix < nextBody.length && prevBody[prefix] === nextBody[prefix]) {
        prefix += 1;
      }
      let suffix = 0;
      while (
        suffix < prevBody.length - prefix &&
        suffix < nextBody.length - prefix &&
        prevBody[prevBody.length - 1 - suffix] === nextBody[nextBody.length - 1 - suffix]
      ) {
        suffix += 1;
      }

      const inserted = nextBody.slice(prefix, nextBody.length - suffix);
      if (inserted.length <= 1) {
        setPostBody(nextBody);
        return;
      }

      const convertedInserted = wrapBareUrlsWithMarkdown(inserted);
      if (convertedInserted === inserted) {
        setPostBody(nextBody);
        return;
      }

      const convertedBody = `${nextBody.slice(0, prefix)}${convertedInserted}${nextBody.slice(nextBody.length - suffix)}`;
      setPostBody(convertedBody);
      const delta = convertedInserted.length - inserted.length;
      const nextCaret = Math.max(0, Math.min(convertedBody.length, composerSelection.end + delta));
      setComposerSelection({ start: nextCaret, end: nextCaret });
    },
    [composerSelection.end, postBody]
  );

  const commentTree = useCallback((comments: GroupPostComment[]) => {
    const byParent = new Map<string, GroupPostComment[]>();
    const roots: GroupPostComment[] = [];
    for (const c of comments) {
      const key = c.parentCommentId ?? '__root__';
      if (key === '__root__') roots.push(c);
      const arr = byParent.get(key) ?? [];
      arr.push(c);
      byParent.set(key, arr);
    }
    const childrenOf = (id: string) => byParent.get(id) ?? [];
    return { roots, childrenOf };
  }, []);

  const addComment = useCallback(
    async (postId: string) => {
      if (!currentUserId) return;
      const raw = (draftComments[postId] ?? '').trim();
      if (!raw) return;
      await createCommentMutation.mutateAsync({
        postId,
        input: {
          id: forumId('comment'),
          userId: currentUserId,
          body: raw,
          parentCommentId: replyTargetByPost[postId] ?? undefined,
        },
      });
      setDraftComments((prev) => ({ ...prev, [postId]: '' }));
      setReplyTargetByPost((prev) => ({ ...prev, [postId]: null }));
    },
    [createCommentMutation, currentUserId, draftComments, replyTargetByPost]
  );

  const applyReactionAndDismiss = (emoji: string) => {
    const target = reactionQuickPickerTarget ?? reactionPickerTarget;
    if (!target) return;
    if (target.kind === 'post') {
      togglePostReactionMutation.mutate({ postId: target.id, emoji });
    } else {
      toggleCommentReactionMutation.mutate({ commentId: target.id, emoji });
    }
    setReactionQuickPickerTarget(null);
    setReactionQuickPickerAnchor(null);
    setReactionPickerTarget(null);
  };

  const openReactionQuickPicker = useCallback((target: { kind: 'post' | 'comment'; id: string }) => {
    const key = `${target.kind}:${target.id}`;
    const node = reactionButtonRefs.current[key] as
      | (View & { measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => void })
      | null;
    if (!node?.measureInWindow) {
      setReactionQuickPickerAnchor(null);
      setReactionQuickPickerTarget(target);
      return;
    }
    node.measureInWindow((x, y, width, height) => {
      setReactionQuickPickerAnchor({ x, y, width, height });
      setReactionQuickPickerTarget(target);
    });
  }, []);

  const quickPickerStyle = useMemo(() => {
    const screenWidth = Dimensions.get('window').width;
    const cardWidth = 316;
    const cardHeight = 62;
    const margin = 10;
    if (!reactionQuickPickerAnchor) return { top: 120, left: (screenWidth - cardWidth) / 2 };
    const centeredLeft = reactionQuickPickerAnchor.x + reactionQuickPickerAnchor.width / 2 - cardWidth / 2;
    const left = Math.max(margin, Math.min(screenWidth - cardWidth - margin, centeredLeft));
    const top = Math.max(12, reactionQuickPickerAnchor.y - cardHeight - 8);
    return { top, left };
  }, [reactionQuickPickerAnchor]);

  const openReactionDetailModal = useCallback((payload: { emoji: string; userIds: string[] }) => {
    setReactionDetailModal(payload);
  }, []);
  const updatePostCarouselIndex = useCallback(
    (postId: string, imageCount: number, offsetX: number, measuredWidth: number) => {
      if (imageCount <= 1) return;
      const width = Math.max(measuredWidth || postCarouselWidthById[postId] || 1, 1);
      const nextIndex = Math.max(0, Math.min(imageCount - 1, Math.round(offsetX / width)));
      setPostCarouselIndexById((prev) => {
        if (prev[postId] === nextIndex) return prev;
        return { ...prev, [postId]: nextIndex };
      });
    },
    [postCarouselWidthById]
  );
  const getHighlightOpacity = useCallback((commentId: string) => {
    if (!highlightOpacityByIdRef.current[commentId]) {
      highlightOpacityByIdRef.current[commentId] = new Animated.Value(0);
    }
    return highlightOpacityByIdRef.current[commentId];
  }, []);
  const jumpToComment = useCallback((commentId: string) => {
    const node = commentRowRefs.current[commentId] as
      | (View & { measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => void })
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
  }, [getHighlightOpacity]);

  if (!group) return null;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <GroupsTopHeader
        userId={currentUserId}
        eventEligibleGroupCount={eventEligibleGroupCount}
        showNotifs={showNotifs}
        onToggleNotifs={() => setShowNotifs((p) => !p)}
        unreadCount={unreadNotifCount}
      />
      <GroupsBreadcrumbTrail segments={breadcrumbSegments} />

      <ScrollView
        ref={(node) => {
          scrollRef.current = node;
          if (!node) return;
          const measurable = node as ScrollView & {
            measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void;
          };
          measurable.measureInWindow?.((_x, y) => {
            scrollViewportYRef.current = y;
          });
        }}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        onScroll={(e) => {
          scrollOffsetYRef.current = e.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
      >
        <View style={styles.card}>
          <View style={styles.cardPad}>
            <View style={styles.attachToolbarRow}>
              <AddImageButton
                iconOnly
                label="Add image"
                triggerIconName="camera-outline"
                disabled={isUploadingAttachment}
                busy={isUploadingAttachment}
                onTakePhoto={takePhotoAndInsertImage}
                onChooseFromLibrary={uploadAndInsertImage}
                onInsertLink={async (url) => {
                  insertImageAtSelection(url);
                }}
              />
              <TouchableOpacity
                style={[styles.attachToolbarBtn, isUploadingAttachment && styles.postBtnDisabled]}
                onPress={() => openComposerLinkPopover('link')}
                disabled={isUploadingAttachment}
                accessibilityLabel="Insert link"
              >
                <Ionicons name="link-outline" size={16} color={Colors.textSub} />
              </TouchableOpacity>
            </View>
            <TextInput
              value={postBody}
              onChangeText={handleComposerChangeText}
              selection={composerSelection}
              onSelectionChange={(e) => setComposerSelection(e.nativeEvent.selection)}
              placeholder="Write your post - use markdown for advanced formatting"
              placeholderTextColor={Colors.textMuted}
              style={styles.bodyInput}
              multiline
              textAlignVertical="top"
            />
            <View style={styles.previewCard}>
              {postBody.trim() ? (
                renderRichBody(postBody, 'composer-preview')
              ) : (
                <Text style={styles.emptyText}>Post preview appears here as you type.</Text>
              )}
            </View>
            <TouchableOpacity
              style={[styles.postBtn, !postBody.trim() && styles.postBtnDisabled]}
              onPress={createPost}
              disabled={!postBody.trim()}
            >
              <Text style={styles.postBtnText}>Publish Post</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={[styles.sectionLabel, { marginTop: 18 }]}>POSTS</Text>
        {postsLoading ? (
          <View style={styles.card}>
            <View style={styles.cardPad}>
              <ActivityIndicator color={Colors.textSub} />
            </View>
          </View>
        ) : posts.length === 0 ? (
          <View style={styles.card}>
            <View style={styles.cardPad}>
              <Text style={styles.emptyText}>
                No posts yet. Start a discussion and group members can react, comment, and reply.
              </Text>
            </View>
          </View>
        ) : (
          posts.map((post) => (
            <View
              key={post.id}
              style={[styles.card, { marginBottom: 14 }]}
              onLayout={(e) => {
                postTopByIdRef.current[post.id] = e.nativeEvent.layout.y;
              }}
            >
              <View style={styles.cardPad}>
                <Text style={styles.metaText}>
                  {post.userId === currentUserId
                    ? `${getUserDisplayName(post.userId)} (you)`
                    : getUserDisplayName(post.userId)}{' '}
                  · {formatCreatedAt(post.createdAt)}
                </Text>
                {(() => {
                  const parsed = parsePostBody(post.body);
                  const textLines = parsed.textLines;
                  const joined = textLines.join('\n').trim();
                  const hasText = joined.length > 0;
                  const overChars = joined.length > 200;
                  const overLines = textLines.filter((line) => line.trim().length > 0).length > 3;
                  const needsCollapse = hasText && (overChars || overLines);
                  const expanded = !!expandedPostBodyById[post.id];
                  const collapsedText = overChars ? `${joined.slice(0, 200).trimEnd()}…` : joined;
                  const textToShow = expanded ? joined : collapsedText;
                  const carouselWidth = postCarouselWidthById[post.id] ?? 260;
                  const carouselIndex = postCarouselIndexById[post.id] ?? 0;
                  const postOwner = usersById.get(post.userId);
                  return (
                    <>
                      {hasText ? (
                        <>
                          <Text
                            style={styles.postBodyText}
                            numberOfLines={expanded ? undefined : 3}
                            ellipsizeMode="tail"
                          >
                            {textToShow}
                          </Text>
                          {needsCollapse ? (
                            <TouchableOpacity
                              onPress={() =>
                                setExpandedPostBodyById((prev) => ({
                                  ...prev,
                                  [post.id]: !prev[post.id],
                                }))
                              }
                              style={styles.readMoreBtn}
                            >
                              <Text style={styles.readMoreText}>
                                {expanded ? 'Read less' : 'Read more'}
                              </Text>
                            </TouchableOpacity>
                          ) : null}
                        </>
                      ) : null}
                      {parsed.images.length > 0 ? (
                        <View
                          style={styles.postImageCarouselWrap}
                          onLayout={(e) =>
                            setPostCarouselWidthById((prev) => ({
                              ...prev,
                              [post.id]: Math.max(200, e.nativeEvent.layout.width),
                            }))
                          }
                        >
                          <ScrollView
                            horizontal
                            pagingEnabled
                            showsHorizontalScrollIndicator={false}
                            style={styles.postImageCarousel}
                            onScroll={(e) =>
                              updatePostCarouselIndex(
                                post.id,
                                parsed.images.length,
                                e.nativeEvent.contentOffset.x,
                                e.nativeEvent.layoutMeasurement.width
                              )
                            }
                            onMomentumScrollEnd={(e) =>
                              updatePostCarouselIndex(
                                post.id,
                                parsed.images.length,
                                e.nativeEvent.contentOffset.x,
                                e.nativeEvent.layoutMeasurement.width
                              )
                            }
                            onScrollEndDrag={(e) =>
                              updatePostCarouselIndex(
                                post.id,
                                parsed.images.length,
                                e.nativeEvent.contentOffset.x,
                                e.nativeEvent.layoutMeasurement.width
                              )
                            }
                            scrollEventThrottle={16}
                          >
                            {parsed.images.map((image, idx) => (
                              <View key={`${post.id}-img-${idx}`} style={{ width: carouselWidth }}>
                                <TouchableOpacity
                                  activeOpacity={0.9}
                                  onPress={() =>
                                    setImageLightbox({
                                      urls: parsed.images.map((img) => img.url),
                                      index: idx,
                                      alts: parsed.images.map((img) => img.alt || ''),
                                      ownerName: getUserDisplayName(post.userId),
                                      ownerAvatarSeed: postOwner?.avatarSeed ?? null,
                                      ownerThumbnail: postOwner?.thumbnail ?? null,
                                    })
                                  }
                                >
                                  <ResolvableImage
                                    storedUrl={image.url}
                                    style={styles.inlineImage}
                                    resizeMode="cover"
                                  />
                                </TouchableOpacity>
                                <Text style={styles.imageCaption}>{image.alt}</Text>
                              </View>
                            ))}
                          </ScrollView>
                          {parsed.images.length > 1 ? (
                            <View style={styles.carouselDotsRow}>
                              {parsed.images.map((_img, idx) => (
                                <View
                                  key={`${post.id}-dot-${idx}`}
                                  style={[
                                    styles.carouselDot,
                                    idx === carouselIndex && styles.carouselDotActive,
                                  ]}
                                />
                              ))}
                            </View>
                          ) : null}
                        </View>
                      ) : null}
                    </>
                  );
                })()}

                {post.reactions.length > 0 ? (
                  <View style={styles.reactionRow}>
                    {post.reactions.map((entry) => (
                      <TouchableOpacity
                        key={`${post.id}-existing-${entry.emoji}`}
                        style={styles.reactionBtn}
                        onPress={() =>
                          togglePostReactionMutation.mutate({ postId: post.id, emoji: entry.emoji })
                        }
                        onLongPress={() =>
                          openReactionDetailModal({ emoji: entry.emoji, userIds: entry.userIds })
                        }
                      >
                        <Text style={styles.reactionLabel}>
                          {entry.emoji} {entry.count}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}
                <View style={styles.reactionRow}>
                  <TouchableOpacity
                    ref={(node) => {
                      reactionButtonRefs.current[`post:${post.id}`] = node;
                    }}
                    style={styles.iconActionBtn}
                    onPress={() => openReactionQuickPicker({ kind: 'post', id: post.id })}
                    onLongPress={() => openReactionQuickPicker({ kind: 'post', id: post.id })}
                    accessibilityLabel="Add reaction"
                    activeOpacity={0.75}
                  >
                    <Ionicons name="happy-outline" size={15} color={Colors.textSub} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.iconActionBtn}
                    onPress={() =>
                      setExpandedCommentsByPost((prev) => ({ ...prev, [post.id]: !prev[post.id] }))
                    }
                  >
                    <Ionicons name="chatbubble-outline" size={15} color={Colors.textSub} />
                    <Text style={styles.iconActionText}>Comments ({post.comments.length})</Text>
                  </TouchableOpacity>
                </View>
                {expandedCommentsByPost[post.id] ? (
                  <CommentsSection
                    isEmpty={post.comments.length === 0}
                    containerStyle={styles.postCommentsSection}
                    emptyContent={<Text style={styles.emptyText}>No comments yet.</Text>}
                  >
                    {(() => {
                      const { roots, childrenOf } = commentTree(post.comments);
                      const commentsById = new Map(post.comments.map((c) => [c.id, c]));
                      const renderCommentNode = (comment: GroupPostComment, level: number) => {
                        const children = childrenOf(comment.id);
                        const commentUser = usersById.get(comment.userId);
                        const repliedTo = comment.parentCommentId
                          ? commentsById.get(comment.parentCommentId) ?? null
                          : null;
                        return (
                          <View
                            key={comment.id}
                            ref={(node) => {
                              commentRowRefs.current[comment.id] = node;
                            }}
                            onLayout={(e) => {
                              const postTop = postTopByIdRef.current[post.id] ?? 0;
                              commentRowTopByIdRef.current[comment.id] = postTop + e.nativeEvent.layout.y;
                            }}
                          >
                            <View
                              style={[
                                styles.commentRow,
                              ]}
                            >
                                {highlightedCommentIds[comment.id] ? (
                                  <Animated.View
                                    pointerEvents="none"
                                    style={[
                                      styles.commentRowHighlightOverlay,
                                      {
                                        opacity: getHighlightOpacity(comment.id),
                                      },
                                    ]}
                                  />
                                ) : null}
                              <UserAvatar
                                seed={getUserDisplayName(comment.userId)}
                                backgroundColor={[commentUser?.avatarSeed ?? '']}
                                thumbnail={commentUser?.thumbnail}
                                size={34}
                              />
                              <View style={{ flex: 1, minWidth: 0 }}>
                                <View style={styles.commentHeaderRow}>
                                  <Text style={styles.commentName}>
                                    {comment.userId === currentUserId
                                      ? `${getUserDisplayName(comment.userId)} (you)`
                                      : getUserDisplayName(comment.userId)}
                                  </Text>
                                  <Text style={styles.commentTime} numberOfLines={1}>
                                    {formatCreatedAt(comment.createdAt)}
                                  </Text>
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
                                <Text style={styles.commentText}>{comment.body}</Text>
                                {comment.reactions.length > 0 ? (
                                  <View style={styles.reactionChipsRow}>
                                    {comment.reactions.map((entry) => (
                                      <TouchableOpacity
                                        key={`${comment.id}-existing-${entry.emoji}`}
                                        style={styles.reactionChip}
                                        onPress={() =>
                                          toggleCommentReactionMutation.mutate({
                                            commentId: comment.id,
                                            emoji: entry.emoji,
                                          })
                                        }
                                        onLongPress={() =>
                                          openReactionDetailModal({
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
                                    onPress={() =>
                                      openReactionQuickPicker({ kind: 'comment', id: comment.id })
                                    }
                                    onLongPress={() =>
                                      openReactionQuickPicker({ kind: 'comment', id: comment.id })
                                    }
                                    accessibilityLabel="Add reaction"
                                    activeOpacity={0.75}
                                  >
                                    <Ionicons name="happy-outline" size={15} color={Colors.textSub} />
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    style={styles.iconActionBtn}
                                    onPress={() =>
                                      setReplyTargetByPost((prev) => ({ ...prev, [post.id]: comment.id }))
                                    }
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
                      };
                      return roots.map((r) => renderCommentNode(r, 0));
                    })()}
                    <View style={styles.commentComposer}>
                      {replyTargetByPost[post.id] ? (
                        <View style={styles.replyingBadge}>
                          <Text style={styles.replyingBadgeText}>Replying to comment</Text>
                          <TouchableOpacity
                            onPress={() =>
                              setReplyTargetByPost((prev) => ({ ...prev, [post.id]: null }))
                            }
                          >
                            <Ionicons name="close" size={14} color={Colors.textMuted} />
                          </TouchableOpacity>
                        </View>
                      ) : null}
                      <TextInput
                        value={draftComments[post.id] ?? ''}
                        onChangeText={(v) => setDraftComments((prev) => ({ ...prev, [post.id]: v }))}
                        placeholder={replyTargetByPost[post.id] ? 'Write a reply' : 'Add a comment'}
                        placeholderTextColor={Colors.textMuted}
                        style={styles.commentInput}
                        multiline
                      />
                      <TouchableOpacity style={styles.replyBtn} onPress={() => void addComment(post.id)}>
                        <Text style={styles.replyBtnText}>
                          {replyTargetByPost[post.id] ? 'Reply' : 'Comment'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </CommentsSection>
                ) : null}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {showSwitchGroups && onSwitchGroup && switchableGroups.length > 0 ? (
        <Modal visible transparent animationType="fade" onRequestClose={() => setShowSwitchGroups(false)}>
          <TouchableOpacity style={styles.menuOverlay} onPress={() => setShowSwitchGroups(false)} activeOpacity={1}>
            <View style={styles.switchGroupsCard}>
              <Text style={styles.switchGroupsTitle}>Switch group</Text>
              <ScrollView style={styles.switchGroupsList} keyboardShouldPersistTaps="handled">
                {switchableGroups.map((g) => (
                  <TouchableOpacity
                    key={g.id}
                    onPress={() => {
                      setShowSwitchGroups(false);
                      onSwitchGroup(g.id);
                    }}
                    style={styles.switchGroupsRow}
                  >
                    <Text style={styles.switchGroupsRowText} numberOfLines={2}>
                      {g.name}
                    </Text>
                    <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>
      ) : null}

      {reactionQuickPickerTarget && currentUserId ? (
        <Modal
          visible
          transparent
          animationType="fade"
          presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}
          onRequestClose={() => setReactionQuickPickerTarget(null)}
          statusBarTranslucent
        >
          <View style={styles.commentReactionPickerRoot}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => {
                setReactionQuickPickerTarget(null);
                setReactionQuickPickerAnchor(null);
              }}
              accessibilityRole="button"
              accessibilityLabel="Close quick reactions"
            />
            <View style={styles.commentReactionQuickPickerRoot} pointerEvents="box-none">
              <View style={[styles.commentReactionQuickPickerCard, quickPickerStyle]} pointerEvents="auto">
                <EmojiBar
                  quickReactions={commentQuickReactions}
                  onPressReaction={applyReactionAndDismiss}
                  onPressViewAll={() => {
                    setReactionPickerTarget(reactionQuickPickerTarget);
                    setReactionQuickPickerTarget(null);
                    setReactionQuickPickerAnchor(null);
                  }}
                  disabled={togglePostReactionMutation.isPending || toggleCommentReactionMutation.isPending}
                  viewAllAccessibilityLabel="View all emojis"
                />
              </View>
            </View>
          </View>
        </Modal>
      ) : null}

      {reactionPickerTarget && currentUserId ? (
        <Modal
          visible
          transparent
          animationType="fade"
          presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}
          onRequestClose={() => setReactionPickerTarget(null)}
          statusBarTranslucent
        >
          <View style={styles.commentReactionPickerRoot}>
            <Pressable
              style={[StyleSheet.absoluteFill, { backgroundColor: Colors.overlay }]}
              onPress={() => setReactionPickerTarget(null)}
              accessibilityRole="button"
              accessibilityLabel="Close emoji picker"
            />
            <View style={styles.commentReactionPickerCenter} pointerEvents="box-none">
              <View style={styles.commentReactionPickerCard} pointerEvents="auto">
                <Text style={styles.commentReactionPickerTitle}>Choose a reaction</Text>
                <ScrollView
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  style={styles.commentReactionPickerScroll}
                  contentContainerStyle={styles.commentReactionPickerGrid}
                >
                  {COMMENT_REACTION_EMOJIS.map((emoji, emojiIdx) => (
                    <TouchableOpacity
                      key={`${emoji}-${emojiIdx}`}
                      onPress={() => applyReactionAndDismiss(emoji)}
                      disabled={
                        togglePostReactionMutation.isPending || toggleCommentReactionMutation.isPending
                      }
                      style={styles.commentActionEmojiHit}
                      accessibilityLabel={`React with ${emoji}`}
                    >
                      <ReactionEmojiGlyph emoji={emoji} size={22} />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}

      {reactionDetailModal ? (
        <Modal
          visible
          transparent
          animationType="fade"
          presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}
          onRequestClose={() => setReactionDetailModal(null)}
          statusBarTranslucent
        >
          <View style={styles.commentReactionPickerRoot}>
            <Pressable
              style={[StyleSheet.absoluteFill, { backgroundColor: Colors.overlay }]}
              onPress={() => setReactionDetailModal(null)}
              accessibilityRole="button"
              accessibilityLabel="Close reaction details"
            />
            <View style={styles.commentReactionPickerCenter} pointerEvents="box-none">
              <View style={styles.reactionDetailCard} pointerEvents="auto">
                <Text style={styles.reactionDetailTitle}>
                  {reactionDetailModal.emoji} Reactions ({reactionDetailModal.userIds.length})
                </Text>
                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  style={styles.reactionDetailScroll}
                >
                  {reactionDetailModal.userIds.map((uid) => {
                    const user = usersById.get(uid);
                    return (
                      <View key={`${reactionDetailModal.emoji}-${uid}`} style={styles.reactionDetailRow}>
                        <UserAvatar
                          seed={getUserDisplayName(uid)}
                          backgroundColor={[user?.avatarSeed ?? '']}
                          thumbnail={user?.thumbnail}
                          size={28}
                        />
                        <Text style={styles.reactionDetailName}>
                          {uid === currentUserId
                            ? `${getUserDisplayName(uid)} (you)`
                            : getUserDisplayName(uid)}
                        </Text>
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}

      <ImageLightboxModal
        visible={imageLightbox !== null}
        urls={imageLightbox?.urls ?? []}
        index={imageLightbox?.index ?? 0}
        onChangeIndex={(nextIndex) => setImageLightbox((prev) => (prev ? { ...prev, index: nextIndex } : prev))}
        onClose={() => setImageLightbox(null)}
        headerAvatar={
          imageLightbox ? (
            <UserAvatar
              seed={imageLightbox.ownerName || 'Image'}
              backgroundColor={[imageLightbox.ownerAvatarSeed ?? '']}
              thumbnail={imageLightbox.ownerThumbnail ?? null}
              size={28}
            />
          ) : undefined
        }
        title={imageLightbox?.ownerName}
        subtitle={
          imageLightbox
            ? imageLightbox.urls.length > 1
              ? `${
                  (imageLightbox.alts?.[imageLightbox.index] || '').trim() || 'Image'
                } · ${imageLightbox.index + 1} of ${imageLightbox.urls.length}`
              : (imageLightbox.alts?.[imageLightbox.index] || '').trim() || 'Image'
            : undefined
        }
      />

      {composerLinkPopover ? (
        <Modal
          visible
          transparent
          animationType="fade"
          presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}
          onRequestClose={() => setComposerLinkPopover(null)}
          statusBarTranslucent
        >
          <View style={styles.commentReactionPickerRoot}>
            <Pressable
              style={[StyleSheet.absoluteFill, { backgroundColor: Colors.overlay }]}
              onPress={() => setComposerLinkPopover(null)}
              accessibilityRole="button"
              accessibilityLabel="Close link editor"
            />
            <View style={styles.commentReactionPickerCenter} pointerEvents="box-none">
              <View style={styles.composerLinkPopoverCard} pointerEvents="auto">
                <Text style={styles.composerLinkPopoverTitle}>Insert link</Text>
                <TextInput
                  value={composerLinkPopover.text}
                  onChangeText={(text) => setComposerLinkPopover((prev) => (prev ? { ...prev, text } : prev))}
                  placeholder="Displayed text"
                  placeholderTextColor={Colors.textMuted}
                  style={styles.composerLinkPopoverInput}
                />
                <TextInput
                  value={composerLinkPopover.url}
                  onChangeText={(url) => setComposerLinkPopover((prev) => (prev ? { ...prev, url } : prev))}
                  placeholder="https://example.com"
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.composerLinkPopoverInput}
                />
                <View style={styles.composerLinkPopoverActions}>
                  <TouchableOpacity
                    style={styles.composerLinkPopoverCancelBtn}
                    onPress={() => setComposerLinkPopover(null)}
                  >
                    <Text style={styles.composerLinkPopoverCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.composerLinkPopoverApplyBtn,
                      !composerLinkPopover.url.trim() && styles.postBtnDisabled,
                    ]}
                    disabled={!composerLinkPopover.url.trim()}
                    onPress={applyComposerLinkPopover}
                  >
                    <Text style={styles.composerLinkPopoverApplyText}>Apply</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}

      <NotificationsPanelModal
        visible={showNotifs}
        onClose={() => setShowNotifs(false)}
        userId={currentUserId || ''}
        notifications={notifs}
        isLoading={notifsLoading}
        groups={allGroupsForChrome.map((g) => ({ id: g.id, name: g.name }))}
        groupColors={groupColors}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 110 },
  sectionLabel: {
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius['2xl'],
    overflow: 'hidden',
  },
  cardPad: { padding: 14 },
  attachToolbarRow: {
    marginTop: 8,
    marginBottom: 6,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  attachToolbarBtn: {
    width: 34,
    height: 34,
    borderRadius: 9,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markdownSupportText: {
    marginTop: 10,
    marginBottom: 8,
    color: Colors.textMuted,
    fontFamily: Fonts.regular,
    fontSize: 12,
  },
  markdownSupportLink: {
    color: Colors.accent,
    textDecorationLine: 'underline',
    fontFamily: Fonts.medium,
  },
  bodyInput: {
    minHeight: 140,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.text,
    marginBottom: 10,
  },
  previewCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    backgroundColor: Colors.bg,
    padding: 10,
    marginBottom: 10,
  },
  postBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: Radius.lg,
    backgroundColor: Colors.accent,
  },
  postBtnDisabled: { opacity: 0.45 },
  postBtnText: { color: '#fff', fontFamily: Fonts.semiBold, fontSize: 13 },
  emptyText: { color: Colors.textMuted, fontFamily: Fonts.regular, fontSize: 14, lineHeight: 21 },
  metaText: { fontSize: 12, fontFamily: Fonts.regular, color: Colors.textMuted, marginBottom: 12 },
  postImageCarouselWrap: { marginBottom: 8 },
  postImageCarousel: { width: '100%' },
  carouselDotsRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  carouselDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.border,
  },
  carouselDotActive: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.textSub,
  },
  postBodyText: { fontSize: 14, lineHeight: 21, color: Colors.text, fontFamily: Fonts.regular },
  readMoreBtn: { alignSelf: 'flex-start', marginTop: 4 },
  readMoreText: { fontSize: 12, fontFamily: Fonts.semiBold, color: Colors.textSub },
  richBodyWrap: { gap: 4 },
  lineSpacer: { height: 8 },
  imageBlock: { marginVertical: 6 },
  inlineImage: {
    width: '100%',
    height: 180,
    borderRadius: Radius.lg,
    backgroundColor: Colors.border,
  },
  imageCaption: {
    marginTop: 6,
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
  },
  groupPhotoLightbox: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.93)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupPhotoLightboxHeader: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  groupPhotoLightboxName: { fontSize: 13, fontFamily: Fonts.semiBold, color: '#fff' },
  groupPhotoLightboxSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.45)',
    fontFamily: Fonts.regular,
  },
  groupPhotoLightboxClose: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radius.lg,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  groupPhotoLightboxImg: { width: '100%', height: '100%' },
  groupPhotoLightboxImageWrap: {
    flex: 1,
    width: '100%',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupPhotoLightboxTapLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '40%',
  },
  groupPhotoLightboxTapRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: '40%',
  },
  groupPhotoLightboxNavBtn: {
    position: 'absolute',
    top: '50%',
    marginTop: -22,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.42)',
    zIndex: 6,
    elevation: 6,
  },
  groupPhotoLightboxNavBtnDisabled: { opacity: 0.28 },
  groupPhotoLightboxNavPrev: { left: 10 },
  groupPhotoLightboxNavNext: { right: 10 },
  reactionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  iconActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
  },
  commentActionEmojiHit: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentReactionPickerRoot: {
    flex: 1,
  },
  commentReactionPickerCenter: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  commentReactionQuickPickerRoot: {
    ...StyleSheet.absoluteFillObject,
  },
  commentReactionQuickPickerCard: {
    position: 'absolute',
    width: 316,
    borderRadius: Radius['2xl'],
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
    ...Shadows.md,
  },
  commentReactionPickerCard: {
    width: '100%',
    maxWidth: 340,
    maxHeight: Dimensions.get('window').height * 0.62,
    borderRadius: Radius.xl,
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    paddingTop: 14,
    paddingHorizontal: 12,
    paddingBottom: 10,
    ...Shadows.md,
  },
  commentReactionPickerTitle: {
    fontSize: 15,
    fontFamily: Fonts.semiBold,
    color: Colors.text,
    marginBottom: 10,
    textAlign: 'center',
  },
  commentReactionPickerScroll: {
    maxHeight: Dimensions.get('window').height * 0.48,
  },
  commentReactionPickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: 4,
    paddingBottom: 8,
  },
  reactionDetailCard: {
    width: '100%',
    maxWidth: 340,
    maxHeight: Dimensions.get('window').height * 0.62,
    borderRadius: Radius.xl,
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    paddingTop: 14,
    paddingHorizontal: 14,
    paddingBottom: 12,
    ...Shadows.md,
  },
  reactionDetailTitle: {
    fontSize: 15,
    fontFamily: Fonts.semiBold,
    color: Colors.text,
    marginBottom: 10,
    textAlign: 'center',
  },
  reactionDetailScroll: {
    maxHeight: Dimensions.get('window').height * 0.46,
  },
  reactionDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  reactionDetailName: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    color: Colors.text,
  },
  composerLinkPopoverCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: Radius.xl,
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: 14,
    ...Shadows.md,
  },
  composerLinkPopoverTitle: {
    fontSize: 15,
    fontFamily: Fonts.semiBold,
    color: Colors.text,
    marginBottom: 10,
  },
  composerLinkPopoverInput: {
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
  composerLinkPopoverActions: {
    marginTop: 4,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  composerLinkPopoverCancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
  },
  composerLinkPopoverCancelText: {
    fontSize: 13,
    fontFamily: Fonts.medium,
    color: Colors.textSub,
  },
  composerLinkPopoverApplyBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.md,
    backgroundColor: Colors.accent,
  },
  composerLinkPopoverApplyText: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: '#fff',
  },
  iconActionText: { fontSize: 12, fontFamily: Fonts.medium, color: Colors.textSub },
  reactionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
  },
  reactionLabel: { fontSize: 13, fontFamily: Fonts.medium, color: Colors.textSub },
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
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  replyComposer: { marginTop: 10, gap: 8 },
  replyingBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.bg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  replyingBadgeText: { fontSize: 11, color: Colors.textMuted, fontFamily: Fonts.medium },
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
  commentHeaderRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 4 },
  commentName: { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.text },
  commentTime: { fontSize: 11, color: Colors.textMuted, fontFamily: Fonts.regular, flexShrink: 0 },
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
  replyCard: {
    marginTop: 10,
    marginLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: Colors.border,
    paddingLeft: 8,
  },
  commentMeta: { fontSize: 11, fontFamily: Fonts.regular, color: Colors.textMuted, marginBottom: 4 },
  commentBody: { fontSize: 13, fontFamily: Fonts.regular, color: Colors.text, lineHeight: 20 },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  switchGroupsCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 0,
    width: '100%',
    maxWidth: 340,
    maxHeight: '70%',
    ...Shadows.lg,
  },
  switchGroupsTitle: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  switchGroupsList: { maxHeight: 400 },
  switchGroupsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  switchGroupsRowText: { flex: 1, fontSize: 15, fontFamily: Fonts.medium, color: Colors.text },
});
