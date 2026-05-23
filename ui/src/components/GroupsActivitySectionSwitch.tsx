import { useState, useMemo, useCallback } from 'react';
import { type Href } from 'expo-router';
import { useAppRouter as useRouter } from '../hooks/useAppRouter';
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
  /** When true, the section label is the current page (no navigation). */
  isOnSectionRoot?: boolean;
};

export function useGroupsActivitySectionSwitch(
  groupId: string,
  current: GroupsActivitySection,
  options?: UseGroupsActivitySectionSwitchOptions
) {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);

  const goToSectionRoot = useCallback(
    (section: GroupsActivitySection) => {
      router.replace(SECTION_META[section].href(groupId));
    },
    [groupId, router]
  );

  const switchToSection = useCallback(
    (section: GroupsActivitySection) => {
      router.push(SECTION_META[section].href(groupId));
    },
    [groupId, router]
  );

  const segment = useMemo((): BreadcrumbSegment => {
    const meta = SECTION_META[current];
    return {
      label: meta.label,
      ...(options?.isOnSectionRoot ? {} : { onPress: () => goToSectionRoot(current) }),
      showSwitchChevron: true,
      switchChevronOpen: visible,
      onSwitchChevronPress: (a) => {
        setAnchor(a);
        setVisible((open) => !open);
      },
    };
  }, [current, goToSectionRoot, options?.isOnSectionRoot, visible]);

  const modal = (
    <GroupsBreadcrumbDropdownModal
      visible={visible}
      onClose={() => setVisible(false)}
      anchor={anchor}
      items={SECTION_ITEMS}
      selectedId={current}
      onSelect={(id) => {
        const section = id as GroupsActivitySection;
        if (section === current && options?.isOnSectionRoot) return;
        switchToSection(section);
      }}
      menuWidth={MENU_WIDTH}
    />
  );

  return { segment, modal };
}
