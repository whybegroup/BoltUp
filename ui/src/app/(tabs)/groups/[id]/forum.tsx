import { useLocalSearchParams } from 'expo-router';
import { GroupForumView } from '../../../../components/GroupForumView';

export default function GroupForumScreen() {
  const params = useLocalSearchParams<{
    id: string;
    postId?: string | string[];
    commentId?: string | string[];
  }>();
  const groupId = Array.isArray(params.id) ? params.id[0] : params.id;
  const focusPostId = Array.isArray(params.postId) ? params.postId[0] : params.postId;
  const focusCommentId = Array.isArray(params.commentId) ? params.commentId[0] : params.commentId;
  if (!groupId) return null;
  return (
    <GroupForumView
      groupId={groupId}
      focusPostId={focusPostId ?? undefined}
      focusCommentId={focusCommentId ?? undefined}
    />
  );
}
