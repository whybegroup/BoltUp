import { ApiError } from '@moijia/client';

export function isNotFoundError(error: unknown): boolean {
  if (error instanceof ApiError) return error.status === 404;
  if (error && typeof error === 'object' && 'status' in error) {
    const s = (error as { status?: unknown }).status;
    return s === 404;
  }
  return false;
}

export const NOT_GROUP_MEMBER_CODE = 'NOT_GROUP_MEMBER';

export type NotGroupMemberInfo = {
  groupId: string;
  groupName: string;
  membershipStatus: 'none' | 'pending';
  requireApprovalToJoin: boolean;
};

function errorBody(error: unknown): Record<string, unknown> | null {
  if (error instanceof ApiError && error.body && typeof error.body === 'object') {
    return error.body as Record<string, unknown>;
  }
  if (error && typeof error === 'object' && 'body' in error) {
    const body = (error as { body?: unknown }).body;
    if (body && typeof body === 'object') return body as Record<string, unknown>;
  }
  return null;
}

export function parseNotGroupMemberError(error: unknown): NotGroupMemberInfo | null {
  const body = errorBody(error);
  if (!body || body.code !== NOT_GROUP_MEMBER_CODE) return null;
  const groupId = typeof body.groupId === 'string' ? body.groupId.trim() : '';
  const groupName = typeof body.groupName === 'string' ? body.groupName.trim() : '';
  if (!groupId || !groupName) return null;
  return {
    groupId,
    groupName,
    membershipStatus: body.membershipStatus === 'pending' ? 'pending' : 'none',
    requireApprovalToJoin: body.requireApprovalToJoin !== false,
  };
}

export function isNotGroupMemberError(error: unknown): boolean {
  return parseNotGroupMemberError(error) != null;
}

/**
 * For React Query `refetchInterval`: stop polling while the query is in error.
 * Covers 404 plus any case where `error` is not shaped like ApiError (e.g. duplicate bundles).
 */
export function refetchIntervalUnlessNotFound(ms: number) {
  return (query: { state: { status: string } }) => (query.state.status === 'error' ? false : ms);
}

/** For React Query `retry`: do not retry missing resources or share-link membership denials. */
export function retryUnlessNotFound(failureCount: number, error: unknown): boolean {
  if (isNotFoundError(error) || isNotGroupMemberError(error)) return false;
  return failureCount < 3;
}
