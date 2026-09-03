import { type Href } from 'expo-router';

/**
 * Parse the fromEventId query parameter from search params
 */
export function parseFromEventId(
  searchParams: { fromEventId?: string | string[] } | undefined
): string | undefined {
  if (!searchParams?.fromEventId) return undefined;
  return Array.isArray(searchParams.fromEventId) 
    ? searchParams.fromEventId[0] 
    : searchParams.fromEventId;
}

/**
 * Build a query string with fromEventId if present
 */
export function buildEventIdQuery(fromEventId: string | undefined): string {
  return fromEventId ? `?fromEventId=${fromEventId}` : '';
}

/**
 * Append fromEventId to a URL path
 */
export function withFromEventId(path: string, fromEventId: string | undefined): Href {
  return `${path}${buildEventIdQuery(fromEventId)}` as Href;
}

/**
 * Build a group detail URL with optional fromEventId
 */
export function buildGroupDetailUrl(
  groupId: string,
  options: {
    isInEventsTab: boolean;
    fromEventId?: string;
  }
): Href {
  const basePath = options.isInEventsTab
    ? `/(tabs)/events/group/${groupId}`
    : `/(tabs)/groups/${groupId}`;
  return withFromEventId(basePath, options.fromEventId);
}

/**
 * Build a group events URL with optional fromEventId
 */
export function buildGroupEventsUrl(
  groupId: string,
  options: {
    isInEventsTab: boolean;
    fromEventId?: string;
  }
): Href {
  const basePath = options.isInEventsTab
    ? `/(tabs)/events/group/${groupId}/events`
    : `/(tabs)/groups/${groupId}/events`;
  return withFromEventId(basePath, options.fromEventId);
}

/**
 * Build a group event detail URL with optional fromEventId
 */
export function buildGroupEventDetailUrl(
  groupId: string,
  eventId: string,
  options: {
    isInEventsTab: boolean;
    fromEventId?: string;
  }
): Href {
  const basePath = options.isInEventsTab
    ? `/(tabs)/events/group/${groupId}/events/${eventId}`
    : `/(tabs)/groups/${groupId}/events/${eventId}`;
  return withFromEventId(basePath, options.fromEventId);
}

/**
 * Build a group polls URL with optional fromEventId
 */
export function buildGroupPollsUrl(
  groupId: string,
  options: {
    isInEventsTab: boolean;
    fromEventId?: string;
  }
): Href {
  const basePath = options.isInEventsTab
    ? `/(tabs)/events/group/${groupId}/polls`
    : `/(tabs)/groups/${groupId}/polls`;
  return withFromEventId(basePath, options.fromEventId);
}

/**
 * Build a group forum URL with optional fromEventId
 */
export function buildGroupForumUrl(
  groupId: string,
  options: {
    isInEventsTab: boolean;
    fromEventId?: string;
  }
): Href {
  const basePath = options.isInEventsTab
    ? `/(tabs)/events/group/${groupId}/forum`
    : `/(tabs)/groups/${groupId}/forum`;
  return withFromEventId(basePath, options.fromEventId);
}

/**
 * Build a group members URL with optional fromEventId
 */
export function buildGroupMembersUrl(
  groupId: string,
  options: {
    isInEventsTab: boolean;
    fromEventId?: string;
  }
): Href {
  const basePath = options.isInEventsTab
    ? `/(tabs)/events/group/${groupId}/members`
    : `/(tabs)/groups/${groupId}/members`;
  return withFromEventId(basePath, options.fromEventId);
}

/**
 * Build a group settings URL with optional fromEventId
 */
export function buildGroupSettingsUrl(
  groupId: string,
  options: {
    isInEventsTab: boolean;
    fromEventId?: string;
  }
): Href {
  const basePath = options.isInEventsTab
    ? `/(tabs)/events/group/${groupId}/settings`
    : `/(tabs)/groups/${groupId}/settings`;
  return withFromEventId(basePath, options.fromEventId);
}

/**
 * Build a group media URL with optional fromEventId
 */
export function buildGroupStorageUrl(
  groupId: string,
  options: {
    isInEventsTab: boolean;
    fromEventId?: string;
  }
): Href {
  const basePath = options.isInEventsTab
    ? `/(tabs)/events/group/${groupId}/storage`
    : `/(tabs)/groups/${groupId}/storage`;
  return withFromEventId(basePath, options.fromEventId);
}

/**
 * Build a group storage category URL with optional fromEventId
 */
export function buildGroupStorageCategoryUrl(
  groupId: string,
  category: string,
  options: {
    isInEventsTab: boolean;
    fromEventId?: string;
  }
): Href {
  const basePath = options.isInEventsTab
    ? `/(tabs)/events/group/${groupId}/storage/${category}`
    : `/(tabs)/groups/${groupId}/storage/${category}`;
  return withFromEventId(basePath, options.fromEventId);
}
