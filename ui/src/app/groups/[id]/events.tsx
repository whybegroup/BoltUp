import { Redirect, useLocalSearchParams } from 'expo-router';
import { firstSearchParam } from '../../../utils/navigationReturn';

/** `/groups/:id/events` deep links open the group events screen in the groups tab. */
export default function GroupEventsRedirect() {
  const params = useLocalSearchParams<{ id: string; returnTo?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  if (!id) return null;
  const rt = firstSearchParam(params.returnTo);
  const href = rt
    ? (`/(tabs)/groups/${id}/events?returnTo=${encodeURIComponent(rt)}` as const)
    : (`/(tabs)/groups/${id}/events` as const);
  return <Redirect href={href} />;
}
