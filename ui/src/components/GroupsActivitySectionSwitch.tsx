import { useState, useMemo, useCallback } from 'react';
import { useRouter, type Href } from 'expo-router';
import { withReturnTo } from '../utils/navigationReturn';
import type { BreadcrumbSegment } from './GroupsBreadcrumbTrail';
import {
  GroupsBreadcrumbDropdownModal,
  type BreadcrumbDropdownItem,
} from './groupsBreadcrumbDropdown';

export type GroupsActivitySection = 'events' | 'polls' | 'posts';

const SECTION_META: Record<GroupsActivitySection, { label: string; href: (groupId: string) => Href }> = {
  events: {
    label: 'Events',
    href: (groupId) => `/(tabs)/groups/${groupId}/events` as Href,
  },
  polls: {
    label: 'Polls',
    href: (groupId) => `/(tabs)/groups/${groupId}/polls` as Href,
  },
  posts: {
    label: 'Posts',
    href: (groupId) => `/(tabs)/groups/${groupId}/forum` as Href,
  },
};

const ALL_SECTIONS: GroupsActivitySection[] = ['events', 'polls', 'posts'];

const MENU_WIDTH = 200;

const SECTION_ITEMS: BreadcrumbDropdownItem[] = ALL_SECTIONS.map((section) => ({
  id: section,
  label: SECTION_META[section].label,
}));

type UseGroupsActivitySectionSwitchOptions = {
  returnPathname?: string;
};

export function useGroupsActivitySectionSwitch(
  groupId: string,
  current: GroupsActivitySection,
  options?: UseGroupsActivitySectionSwitchOptions
) {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);

  const navigateToSection = useCallback(
    (section: GroupsActivitySection) => {
      const href = SECTION_META[section].href(groupId);
      router.push(
        options?.returnPathname
          ? withReturnTo(String(href), String(options.returnPathname))
          : href
      );
    },
    [groupId, options?.returnPathname, router]
  );

  const segment = useMemo((): BreadcrumbSegment => {
    const meta = SECTION_META[current];
    return {
      label: meta.label,
      onPress: () => navigateToSection(current),
      showSwitchChevron: true,
      switchChevronOpen: visible,
      onSwitchChevronPress: (a) => {
        setAnchor(a);
        setVisible((open) => !open);
      },
    };
  }, [current, navigateToSection, visible]);

  const modal = (
    <GroupsBreadcrumbDropdownModal
      visible={visible}
      onClose={() => setVisible(false)}
      anchor={anchor}
      items={SECTION_ITEMS}
      selectedId={current}
      onSelect={(id) => navigateToSection(id as GroupsActivitySection)}
      menuWidth={MENU_WIDTH}
    />
  );

  return { segment, modal };
}
