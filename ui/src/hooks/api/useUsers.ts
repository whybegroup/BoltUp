import { useQuery } from '@tanstack/react-query';
import { UsersService } from '@boltup/client';
import { queryKeys } from '../../config/queryClient';

export function useUsers() {
  return useQuery({
    queryKey: queryKeys.users.all,
    queryFn: () => UsersService.getUsers(),
  });
}

export function useUser(id: string) {
  return useQuery({
    queryKey: queryKeys.users.detail(id),
    queryFn: () => UsersService.getUser(id),
    enabled: !!id,
  });
}
