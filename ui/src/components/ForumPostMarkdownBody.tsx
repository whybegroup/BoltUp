import { memo, useCallback, useMemo, type ComponentProps, type Dispatch, type SetStateAction } from 'react';
import { Linking, StyleSheet, TouchableOpacity, View } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { Colors, Fonts, Radius } from '../constants/theme';
import { uploadUrlToDownloadUrl } from '../services/pickAndUploadImage';
import { MentionText } from './MentionText';
import { ResolvableImage } from './ResolvableImage';

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

  const onLinkPress = useCallback((url: string) => {
    Linking.openURL(uploadUrlToDownloadUrl(url));
    return false;
  }, []);

  return (
    <Markdown style={markdownStyles} mergeStyle rules={rules} onLinkPress={onLinkPress}>
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
  markdownParagraphColumn: { flexDirection: 'column', alignItems: 'stretch' },
  markdownImageWrap: { width: '100%', alignSelf: 'stretch', marginVertical: 6 },
});
