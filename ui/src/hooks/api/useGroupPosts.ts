import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  GroupsService,
  type GroupPost,
  type GroupPostCommentCreateInput,
  type GroupPostCreateInput,
} from '@moijia/client';
import { queryKeys } from '../../config/queryClient';

export function useGroupPosts(groupId: string, userId: string) {
  return useQuery<GroupPost[]>({
    queryKey: queryKeys.groups.posts(groupId, userId),
    queryFn: () => GroupsService.getGroupPosts(groupId, userId),
    enabled: !!groupId && !!userId,
    refetchInterval: 3000,
  });
}

function invalidateGroupPostQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  groupId: string,
  userId: string
) {
  queryClient.invalidateQueries({ queryKey: queryKeys.groups.posts(groupId, userId) });
}

export function useCreateGroupPost(groupId: string, userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: GroupPostCreateInput) => GroupsService.createGroupPost(groupId, input),
    onSuccess: () => invalidateGroupPostQueries(queryClient, groupId, userId),
  });
}

export function useToggleGroupPostReaction(groupId: string, userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, emoji }: { postId: string; emoji: string }) =>
      GroupsService.toggleGroupPostReaction(postId, { userId, emoji }),
    onSuccess: () => invalidateGroupPostQueries(queryClient, groupId, userId),
  });
}

export function useCreateGroupPostComment(groupId: string, userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, input }: { postId: string; input: GroupPostCommentCreateInput }) =>
      GroupsService.createGroupPostComment(postId, input),
    onSuccess: () => invalidateGroupPostQueries(queryClient, groupId, userId),
  });
}

export function useToggleGroupPostCommentReaction(groupId: string, userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ commentId, emoji }: { commentId: string; emoji: string }) =>
      GroupsService.toggleGroupPostCommentReaction(commentId, { userId, emoji }),
    onSuccess: () => invalidateGroupPostQueries(queryClient, groupId, userId),
  });
}
