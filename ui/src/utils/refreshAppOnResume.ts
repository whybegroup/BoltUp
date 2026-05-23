import { queryClient, queryKeys } from '../config/queryClient';

/** Invalidate core caches so active screens refetch after resume or notification open. */
export function refreshAppOnResume(): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
  void queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
  void queryClient.invalidateQueries({ queryKey: queryKeys.groups._base });
  void queryClient.invalidateQueries({ queryKey: ['events'] });
  void queryClient.invalidateQueries({ queryKey: ['polls'] });
}
