import { memo, useCallback, useMemo, type ComponentProps, type Dispatch, type SetStateAction } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import Markdown, { MarkdownIt } from 'react-native-markdown-display';
import { Colors, Fonts, Radius } from '../constants/theme';
import { useAppRouter } from '../hooks/useAppRouter';
import { openContentLink } from '../utils/inAppLinks';
import { MentionText } from './MentionText';
import { ResolvableImage } from './ResolvableImage';

/**
 * The library's default parser leaves markdown-it's `linkify` off, so bare URLs stay inert
 * text. Fuzzy matching stays off so only explicit http(s) URLs autolink, matching the
 * behaviour of event comments.
 */
const markdownParser = MarkdownIt({ typographer: true, linkify: true });
markdownParser.linkify.set({ fuzzyLink: false, fuzzyEmail: false });

export type ForumPostImageLightboxState = {
  urls: string[];
  index: number;
  alts?: string[];
  ownerName?: string;
  ownerAvatarSeed?: string | null;
  ownerThumbnail?: string | null;
} | null;

type ForumPostMarkdownBodyProps = {
  markdownBody: string;
  markdownStyles: NonNullable<ComponentProps<typeof Markdown>['style']>;
  posterDisplayName: string;
  ownerAvatarSeed: string | null;
  ownerThumbnail: string | null;
  setImageLightbox: Dispatch<SetStateAction<ForumPostImageLightboxState>>;
};

export const ForumPostMarkdownBody = memo(function ForumPostMarkdownBody({
  markdownBody,
  markdownStyles,
  posterDisplayName,
  ownerAvatarSeed,
  ownerThumbnail,
  setImageLightbox,
}: ForumPostMarkdownBodyProps) {
  const router = useAppRouter();

  const rules = useMemo(
    () => ({
      paragraph: (node: any, children: any, _parent: any, mdStyles: any) => (
        <View key={node.key} style={[mdStyles._VIEW_SAFE_paragraph, styles.markdownParagraphColumn]}>
          {children}
        </View>
      ),
      text: (node: any, _children: any, _parent: any, mdStyles: any, inheritedStyles: Record<string, unknown> = {}) => {
        const content = typeof node.content === 'string' ? node.content : '';
        return (
          <MentionText
            key={node.key}
            text={content}
            style={[inheritedStyles, mdStyles.text]}
            mentionStyle={styles.mentionInBody}
          />
        );
      },
      image: (node: any, _children: any, _parent: any, _mdStyles: any) => {
        const rawSrc = node.attributes?.src;
        const src = typeof rawSrc === 'string' ? rawSrc.trim() : '';
        if (!src) return null;
        const alt = typeof node.attributes?.alt === 'string' ? node.attributes.alt : '';
        return (
          <View key={node.key} style={styles.markdownImageWrap}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() =>
                setImageLightbox({
                  urls: [src],
                  index: 0,
                  alts: [alt],
                  ownerName: posterDisplayName,
                  ownerAvatarSeed,
                  ownerThumbnail,
                })
              }
            >
              <ResolvableImage storedUrl={src} style={styles.inlineImage} resizeMode="cover" />
            </TouchableOpacity>
          </View>
        );
      },
    }),
    [posterDisplayName, ownerAvatarSeed, ownerThumbnail, setImageLightbox]
  );

  const onLinkPress = useCallback(
    (url: string) => {
      openContentLink(router, url);
      return false;
    },
    [router]
  );

  return (
    <Markdown
      style={markdownStyles}
      mergeStyle
      rules={rules}
      markdownit={markdownParser}
      onLinkPress={onLinkPress}
    >
      {markdownBody}
    </Markdown>
  );
});

const styles = StyleSheet.create({
  mentionInBody: { color: Colors.accent, fontFamily: Fonts.semiBold },
  inlineImage: {
    width: '100%',
    height: 180,
    borderRadius: Radius.lg,
    backgroundColor: Colors.border,
  },
  /**
   * Paragraph inherits `flexWrap: 'wrap'` from the library's row-based default. In a
   * wrapping column, a flex line is sized from its content, so `stretch` would size text
   * to its intrinsic width and long lines would never break. `nowrap` keeps one line whose
   * cross size is the paragraph width.
   */
  markdownParagraphColumn: {
    flexDirection: 'column',
    alignItems: 'stretch',
    flexWrap: 'nowrap',
    width: '100%',
  },
  markdownImageWrap: { width: '100%', alignSelf: 'stretch', marginVertical: 6 },
});
