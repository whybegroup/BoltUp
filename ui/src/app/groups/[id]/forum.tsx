import { Redirect, useLocalSearchParams } from 'expo-router';
import { firstSearchParam } from '../../../utils/navigationReturn';

/** `/groups/:id/forum` deep links open the group forum screen in the groups tab. */
export default function GroupForumRedirect() {
  const params = useLocalSearchParams<{ id: string; returnTo?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  if (!id) return null;
  const rt = firstSearchParam(params.returnTo);
  const href = rt
    ? (`/(tabs)/groups/${id}/forum?returnTo=${encodeURIComponent(rt)}` as const)
    : (`/(tabs)/groups/${id}/forum` as const);
  return <Redirect href={href} />;
}
