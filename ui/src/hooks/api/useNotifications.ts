import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { NotificationsService, type Notification, type NotificationInput } from '@moijia/client';
import { queryKeys } from '../../config/queryClient';

export function useNotifications(userId?: string) {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return useQuery({
    queryKey: userId
      ? [...queryKeys.notifications.user(userId), timeZone]
      : [...queryKeys.notifications.all, timeZone],
    queryFn: () => NotificationsService.getNotifications(userId, timeZone),
    enabled: !!userId,
    staleTime: 0,
    gcTime: 0,
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchOnReconnect: true,
  });
}

export function useCreateNotification() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: NotificationInput) => NotificationsService.createNotification(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
}

function patchNotificationRead(list: Notification[] | undefined, id: string, read: boolean) {
  return list?.map((n) => (n.id === id ? { ...n, read } : n));
}

export function useUpdateNotification() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, read }: { id: string; read: boolean }) => 
      NotificationsService.updateNotification(id, { read }),
    onMutate: async ({ id, read }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.notifications.all });
      queryClient.setQueriesData<Notification[]>(
        { queryKey: queryKeys.notifications.all },
        (old) => patchNotificationRead(old, id, read)
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (userId: string) => 
      NotificationsService.markAllAsRead(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
}
