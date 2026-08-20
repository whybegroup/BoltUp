import { Redirect, useLocalSearchParams, type Href } from 'expo-router';
import { firstSearchParam } from '../../../utils/navigationReturn';

/** `/groups/:id/forum` deep links open the group forum screen in the groups tab. */
export default function GroupForumRedirect() {
  const params = useLocalSearchParams<{
    id: string;
    returnTo?: string | string[];
    postId?: string | string[];
    commentId?: string | string[];
  }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  if (!id) return null;
  const rt = firstSearchParam(params.returnTo);
  const postId = firstSearchParam(params.postId);
  const commentId = firstSearchParam(params.commentId);
  const qs = new URLSearchParams();
  if (rt) qs.set('returnTo', rt);
  if (postId) qs.set('postId', postId);
  if (commentId) qs.set('commentId', commentId);
  const q = qs.toString();
  const href = (`/(tabs)/groups/${id}/forum${q ? `?${q}` : ''}`) as Href;
  return <Redirect href={href} />;
}
