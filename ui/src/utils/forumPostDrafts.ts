import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_PREFIX = '@moijia/forumPostDraft/v1';

export type ForumPostFileAttachment = { name: string; url: string };

export type ForumGroupDraftV1 = {
  v: 1;
  newPost: {
    markdown: string;
    photos: string[];
    files: ForumPostFileAttachment[];
  } | null;
  /** Unpublished edits keyed by post id */
  postEdits: Record<
    string,
    { markdown: string; photos: string[]; files: ForumPostFileAttachment[] }
  >;
};

function storageKey(userId: string, groupId: string): string {
  return `${STORAGE_PREFIX}/${userId}/${groupId}`;
}

function isPhotoArray(x: unknown): x is string[] {
  return Array.isArray(x) && x.every((u) => typeof u === 'string');
}

function parseFilesArray(x: unknown): ForumPostFileAttachment[] {
  if (!Array.isArray(x)) return [];
  const out: ForumPostFileAttachment[] = [];
  for (const item of x) {
    if (!item || typeof item !== 'object') continue;
    const name = typeof (item as { name?: unknown }).name === 'string' ? (item as { name: string }).name : '';
    const url = typeof (item as { url?: unknown }).url === 'string' ? (item as { url: string }).url : '';
    if (url) out.push({ name: name || 'Attachment', url });
  }
  return out;
}

export async function loadForumGroupDraft(userId: string, groupId: string): Promise<ForumGroupDraftV1 | null> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(userId, groupId));
    if (!raw) return null;
    const p = JSON.parse(raw) as Record<string, unknown>;
    if (p.v !== 1 || typeof p !== 'object' || p === null) return null;

    let newPost: ForumGroupDraftV1['newPost'] = null;
    const np = p.newPost;
    if (np && typeof np === 'object' && np !== null) {
      const markdown = typeof (np as { markdown?: unknown }).markdown === 'string' ? (np as { markdown: string }).markdown : '';
      const photosRaw = (np as { photos?: unknown }).photos;
      const photos = isPhotoArray(photosRaw) ? photosRaw : [];
      const files = parseFilesArray((np as { files?: unknown }).files);
      if (markdown.trim() || photos.length > 0 || files.length > 0) {
        newPost = { markdown, photos, files };
      }
    }

    const postEdits: ForumGroupDraftV1['postEdits'] = {};
    const pe = p.postEdits;
    if (pe && typeof pe === 'object' && pe !== null) {
      for (const [pid, entry] of Object.entries(pe)) {
        if (typeof pid !== 'string' || !entry || typeof entry !== 'object') continue;
        const markdown = typeof (entry as { markdown?: unknown }).markdown === 'string' ? (entry as { markdown: string }).markdown : '';
        const photosRaw = (entry as { photos?: unknown }).photos;
        const photos = isPhotoArray(photosRaw) ? photosRaw : [];
        const files = parseFilesArray((entry as { files?: unknown }).files);
        if (markdown.trim() || photos.length > 0 || files.length > 0) {
          postEdits[pid] = { markdown, photos, files };
        }
      }
    }

    return { v: 1, newPost, postEdits };
  } catch {
    return null;
  }
}

export async function saveForumGroupDraft(userId: string, groupId: string, draft: ForumGroupDraftV1): Promise<void> {
  try {
    await AsyncStorage.setItem(storageKey(userId, groupId), JSON.stringify(draft));
  } catch {
    /* ignore */
  }
}
