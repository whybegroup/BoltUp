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

export function useUpdateGroupPost(groupId: string, userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      postId,
      title,
      body,
    }: {
      postId: string;
      title: string;
      body: string;
    }) => GroupsService.updateGroupPost(postId, { userId, title, body }),
    onSuccess: () => invalidateGroupPostQueries(queryClient, groupId, userId),
  });
}

export function useDeleteGroupPost(groupId: string, userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (postId: string) => GroupsService.deleteGroupPost(postId, userId),
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

export function useUpdateGroupPostComment(groupId: string, userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      commentId,
      body,
      parentCommentId,
    }: {
      commentId: string;
      body: string;
      parentCommentId: string | null;
    }) =>
      GroupsService.updateGroupPostComment(commentId, { userId, body, parentCommentId }),
    onSuccess: () => invalidateGroupPostQueries(queryClient, groupId, userId),
  });
}

export function useDeleteGroupPostComment(groupId: string, userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => GroupsService.deleteGroupPostComment(commentId, userId),
    onSuccess: () => invalidateGroupPostQueries(queryClient, groupId, userId),
  });
}
