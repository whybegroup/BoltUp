import { useMemo, useCallback } from 'react';
import { useAppRouter as useRouter } from '../../hooks/useAppRouter';
import type { BreadcrumbSegment } from '../GroupsBreadcrumbTrail';
import { usePoll } from '../../hooks/api';
import { useCurrentUserContext } from '../../contexts/CurrentUserContext';
import { breadcrumbTruncate } from '../../utils/helpers';
import { ALL_POLLS_HREF, navigatePollsTabTo } from '../../utils/tabBreadcrumbNav';
import { usePollScopeNav } from './PollScopeNavContext';

export function usePollScopeBreadcrumbs(pollId: string | null) {
  const router = useRouter();
  const { userId: currentUserId } = useCurrentUserContext();
  const { data: poll } = usePoll(pollId ?? '', currentUserId ?? '');

  const navCallbacks = usePollScopeNav();

  const goToAllPolls = useCallback(() => {
    if (!pollId) return;
    navigatePollsTabTo(router, ALL_POLLS_HREF, navCallbacks);
  }, [router, pollId, navCallbacks]);

  const segments: BreadcrumbSegment[] = useMemo(() => {
    if (!pollId) {
      return [{ label: 'All Polls' }];
    }
    const pollLabel = breadcrumbTruncate(poll?.title?.trim() ? poll.title : 'Poll');
    return [
      { label: 'All Polls', onPress: goToAllPolls },
      { label: pollLabel },
    ];
  }, [pollId, poll?.title, goToAllPolls]);

  return { segments };
}
