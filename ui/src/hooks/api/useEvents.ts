import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { EventsService, type EventInput, type EventUpdate, type EventDetailed } from '@boltup/client';
import { queryKeys } from '../../config/queryClient';

interface EventFilters {
  groupId?: string;
  startAfter?: string;
  startBefore?: string;
  limit?: number;
}

export function useEvents(filters?: EventFilters) {
  return useQuery<EventDetailed[]>({
    queryKey: queryKeys.events.list(filters),
    queryFn: () => EventsService.getEvents(
      filters?.groupId,
      filters?.startAfter,
      filters?.startBefore,
      filters?.limit
    ),
  });
}

export function useEvent(id: string) {
  return useQuery({
    queryKey: queryKeys.events.detail(id),
    queryFn: () => EventsService.getEvent(id),
    enabled: !!id,
  });
}

export function useCreateEvent() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: EventInput) => EventsService.createEvent(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.events.all });
    },
  });
}

export function useUpdateEvent(id: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: EventUpdate) => EventsService.updateEvent(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.events.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.events.all });
    },
  });
}

export function useDeleteEvent() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => EventsService.deleteEvent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.events.all });
    },
  });
}
