import { Linking } from 'react-native';
import type { Href, Router } from 'expo-router';
import { uploadUrlToDownloadUrl } from '../services/pickAndUploadImage';
import { eventDetailHref, groupForumHref } from './tabBreadcrumbNav';

const SHARE_LINK_HOSTS = new Set(['moijia.com', 'www.moijia.com']);

/**
 * Share links point at the bare `/event/:id` style routes, which exist so a cold launch from
 * outside the app can deep link. In-app navigation instead targets the `(tabs)` routes so the
 * tab bar and back behaviour are preserved.
 */
export function inAppHrefForUrl(url: string): Href | null {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }

  const isShareHost = parsed.protocol === 'https:' && SHARE_LINK_HOSTS.has(parsed.hostname);
  const isAppScheme = parsed.protocol === 'moijia:';
  if (!isShareHost && !isAppScheme) return null;

  // `moijia://event/x` puts the first segment in the host rather than the path.
  const path = isAppScheme ? `/${parsed.hostname}${parsed.pathname}` : parsed.pathname;
  const segments = path.split('/').filter(Boolean);
  const commentId = parsed.searchParams.get('commentId') ?? undefined;

  if (segments[0] === 'event' && segments[1]) {
    return eventDetailHref(segments[1], { commentId });
  }
  if (segments[0] === 'poll' && segments[1]) {
    return `/(tabs)/polls/${segments[1]}` as Href;
  }
  if (segments[0] === 'groups' && segments[1] && segments[2] === 'forum') {
    const postId = parsed.searchParams.get('postId') ?? undefined;
    return groupForumHref(segments[1], { postId, commentId });
  }
  if (segments[0] === 'join' && segments[1]) {
    return `/join/${segments[1]}` as Href;
  }

  // Any other moijia.com path (marketing pages and such) has no in-app equivalent.
  return null;
}

/**
 * Opens a URL found in user content. Moijia share links navigate in place; everything else is
 * handed to the OS. iOS will not route a universal link back into the app that owns it, so
 * internal links have to be intercepted here rather than relying on `associatedDomains`.
 */
export function openContentLink(router: Pick<Router, 'push'>, url: string): void {
  const href = inAppHrefForUrl(url);
  if (href) {
    router.push(href);
    return;
  }
  void Linking.openURL(uploadUrlToDownloadUrl(url));
}
