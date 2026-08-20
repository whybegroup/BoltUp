import { Platform, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import Toast from 'react-native-toast-message';
import { eventShareLink, pollShareLink, postShareLink } from './shareLinks';

/** RN Modal teardown cancels the Android share intent if Share runs in the same tick. */
const SHARE_AFTER_MODAL_MS = 350;

/** Dismiss a RN Modal, then present the OS share sheet (keeps the web user-gesture). */
export function shareFromModal(dismissModal: () => void, share: () => Promise<void>): void {
  if (Platform.OS === 'web') {
    void share().finally(dismissModal);
    return;
  }
  dismissModal();
  setTimeout(() => {
    void share();
  }, SHARE_AFTER_MODAL_MS);
}

export async function shareUrl(opts: {
  title: string;
  message: string;
  url: string;
  copiedToast?: string;
}): Promise<void> {
  const { title, message, url } = opts;
  const copiedToast = opts.copiedToast ?? 'Link copied';
  const messageWithUrl = message.includes(url) ? message : `${message}\n${url}`;
  const copyFallback = async () => {
    await Clipboard.setStringAsync(url).catch(() => {});
    Toast.show({ type: 'success', text1: copiedToast });
  };
  try {
    if (Platform.OS === 'web') {
      const nav = typeof navigator !== 'undefined' ? navigator : undefined;
      if (nav && typeof nav.share === 'function') {
        try {
          await nav.share({ title, text: messageWithUrl, url });
          return;
        } catch (e: any) {
          if (e?.name === 'AbortError') return;
        }
      }
      await copyFallback();
      return;
    }
    await Share.share(
      Platform.OS === 'ios' ? { url, message } : { message: messageWithUrl, title },
    );
  } catch (e: any) {
    if (e?.name === 'AbortError') return;
    await copyFallback();
  }
}

export function shareEvent(eventId: string, eventName: string): Promise<void> {
  const name = eventName.trim() || 'this event';
  return shareUrl({
    title: `${name} on Moijia`,
    message: `Check out ${name} on Moijia!`,
    url: eventShareLink(eventId),
  });
}

export function sharePoll(pollId: string, pollTitle: string): Promise<void> {
  const title = pollTitle.trim() || 'this poll';
  return shareUrl({
    title: `${title} on Moijia`,
    message: `Vote on ${title} on Moijia!`,
    url: pollShareLink(pollId),
  });
}

export function sharePost(groupId: string, postId: string, groupName?: string): Promise<void> {
  const group = (groupName ?? '').trim() || 'the group';
  return shareUrl({
    title: `Post in ${group} on Moijia`,
    message: `Check out this post in ${group} on Moijia!`,
    url: postShareLink(groupId, postId),
  });
}
