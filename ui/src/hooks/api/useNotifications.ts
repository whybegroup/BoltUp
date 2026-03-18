import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { NotificationsService, type NotificationInput } from '@boltup/client';
import { queryKeys } from '../../config/queryClient';

export function useNotifications(userId?: string) {
  return useQuery({
    queryKey: userId ? queryKeys.notifications.user(userId) : queryKeys.notifications.all,
    queryFn: () => NotificationsService.getNotifications(userId),
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

export function useUpdateNotification() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, read }: { id: string; read: boolean }) => 
      NotificationsService.updateNotification(id, { read }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
}
