import { useLocalSearchParams } from 'expo-router';
import { GroupEventDetailView } from '../../../../../../components/GroupEventDetailView';
import { GroupScopeNavProvider } from '../../../../../../components/groupScope/GroupScopeNavContext';
import { firstSearchParam } from '../../../../../../utils/navigationReturn';

export default function EventsTabGroupEventDetailScreen() {
  const params = useLocalSearchParams<{
    id: string;
    eventId: string;
    commentId?: string | string[];
  }>();
  const groupId = firstSearchParam(params.id);
  const eventId = firstSearchParam(params.eventId);
  const focusCommentId = firstSearchParam(params.commentId);

  if (!groupId || !eventId) return null;
  return (
    <GroupScopeNavProvider>
      <GroupEventDetailView
        groupId={groupId}
        eventId={eventId}
        focusCommentId={focusCommentId}
      />
    </GroupScopeNavProvider>
  );
}
