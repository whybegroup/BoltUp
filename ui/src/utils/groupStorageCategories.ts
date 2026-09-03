import { GroupStorageCategoryId } from '@moijia/client';

export const GROUP_STORAGE_CATEGORIES = [
  GroupStorageCategoryId.GROUP,
  GroupStorageCategoryId.EVENTS,
  GroupStorageCategoryId.POLLS,
  GroupStorageCategoryId.POSTS,
] as const;

export type GroupStorageCategory = (typeof GROUP_STORAGE_CATEGORIES)[number];

export const GROUP_STORAGE_CATEGORY_LABELS: Record<GroupStorageCategory, string> = {
  [GroupStorageCategoryId.GROUP]: 'Group',
  [GroupStorageCategoryId.EVENTS]: 'Events',
  [GroupStorageCategoryId.POLLS]: 'Polls',
  [GroupStorageCategoryId.POSTS]: 'Posts',
};

export const GROUP_STORAGE_CATEGORY_COLORS: Record<GroupStorageCategory, string> = {
  [GroupStorageCategoryId.GROUP]: '#E11D48',
  [GroupStorageCategoryId.EVENTS]: '#F97316',
  [GroupStorageCategoryId.POLLS]: '#EAB308',
  [GroupStorageCategoryId.POSTS]: '#16A34A',
};

export type GroupStorageCategoryUsage = {
  id: GroupStorageCategory;
  usedBytes: number;
};

export function isGroupStorageCategory(value: unknown): value is GroupStorageCategory {
  return (
    value === GroupStorageCategoryId.GROUP ||
    value === GroupStorageCategoryId.EVENTS ||
    value === GroupStorageCategoryId.POLLS ||
    value === GroupStorageCategoryId.POSTS
  );
}

export function groupStorageCategoryUsages(
  categories: Array<{ id: string; usedBytes: number }> | undefined
): GroupStorageCategoryUsage[] {
  return GROUP_STORAGE_CATEGORIES.map((id) => ({
    id,
    usedBytes: Math.max(0, categories?.find((c) => c.id === id)?.usedBytes ?? 0),
  }));
}
