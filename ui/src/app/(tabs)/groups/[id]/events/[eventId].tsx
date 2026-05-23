import { useLocalSearchParams } from 'expo-router';
import { GroupEventDetailView } from '../../../../../components/GroupEventDetailView';
import { firstSearchParam } from '../../../../../utils/navigationReturn';

export default function GroupEventDetailRoute() {
  const params = useLocalSearchParams<{
    id: string;
    eventId: string;
    commentId?: string | string[];
  }>();
  const groupId = Array.isArray(params.id) ? params.id[0] : params.id;
  const eventId = Array.isArray(params.eventId) ? params.eventId[0] : params.eventId;
  const focusCommentId = firstSearchParam(
    Array.isArray(params.commentId) ? params.commentId[0] : params.commentId
  );
  if (!groupId || !eventId) return null;
  return (
    <GroupEventDetailView
      groupId={groupId}
      eventId={eventId}
      focusCommentId={focusCommentId}
    />
  );
}
