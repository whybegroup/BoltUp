import { useLocalSearchParams } from 'expo-router';
import { GroupForumView } from '../../../../../components/GroupForumView';
import { GroupScopeNavProvider } from '../../../../../components/groupScope/GroupScopeNavContext';
import { firstSearchParam } from '../../../../../utils/navigationReturn';

export default function EventsTabGroupForumScreen() {
  const params = useLocalSearchParams<{
    id: string;
    postId?: string | string[];
    commentId?: string | string[];
  }>();
  const groupId = firstSearchParam(params.id);
  const focusPostId = firstSearchParam(params.postId);
  const focusCommentId = firstSearchParam(params.commentId);
  if (!groupId) return null;
  return (
    <GroupScopeNavProvider>
      <GroupForumView
        groupId={groupId}
        focusPostId={focusPostId ?? undefined}
        focusCommentId={focusCommentId ?? undefined}
      />
    </GroupScopeNavProvider>
  );
}
