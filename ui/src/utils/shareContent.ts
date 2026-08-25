import { Platform, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import Toast from 'react-native-toast-message';
import { groupInviteLink } from './inviteLink';
import { eventShareLink, pollShareLink, postShareLink, withShareTimeZone } from './shareLinks';
import {
  eventShareCopy,
  groupInviteShareCopy,
  pollShareCopy,
  postShareCopy,
} from './sharePreviewCopy';

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

export function shareEvent(
  eventId: string,
  details: {
    name: string;
    start?: Date | string | null;
    end?: Date | string | null;
    isAllDay?: boolean | null;
    location?: string | null;
    locationName?: string | null;
    locationAddress?: string | null;
    groupName?: string | null;
  },
): Promise<void> {
  const { title, message } = eventShareCopy(details);
  return shareUrl({
    title,
    message,
    url: withShareTimeZone(eventShareLink(eventId)),
  });
}

export function sharePoll(
  pollId: string,
  details: {
    title: string;
    description?: string | null;
    deadline?: Date | string | null;
    closed?: boolean;
    groupName?: string | null;
  },
): Promise<void> {
  const { title, message } = pollShareCopy(details);
  return shareUrl({
    title,
    message,
    url: withShareTimeZone(pollShareLink(pollId)),
  });
}

export function sharePost(
  groupId: string,
  postId: string,
  details?: {
    title?: string | null;
    body?: string | null;
    authorName?: string | null;
    groupName?: string | null;
  },
): Promise<void> {
  const { title, message } = postShareCopy(details ?? {});
  return shareUrl({
    title,
    message,
    url: postShareLink(groupId, postId),
  });
}

export function shareGroupInvite(
  inviteCode: string,
  details: { name: string; description?: string | null },
): Promise<void> {
  const { title, message } = groupInviteShareCopy(details);
  return shareUrl({
    title,
    message,
    url: groupInviteLink(inviteCode),
    copiedToast: 'Invite link copied',
  });
}
