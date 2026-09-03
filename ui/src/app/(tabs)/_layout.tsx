import type { ReactNode } from 'react';
import { useMemo, useRef } from 'react';
import { Tabs, usePathname, type Href } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Fonts } from '../../constants/theme';
import { useCurrentUserContext } from '../../contexts/CurrentUserContext';
import { useAppRouter as useRouter } from '../../hooks/useAppRouter';
import { UserAvatar } from '../../components/UserAvatar';
import { EventsCalendarGlyph, GroupsPeopleGlyph } from '../../components/TabScreenIcons';

type TabName = 'groups' | 'events' | 'polls' | 'posts' | 'profile';

const TAB_ROOT_HREF: Record<TabName, Href> = {
  groups: '/(tabs)/groups',
  events: '/(tabs)/events',
  polls: '/(tabs)/polls',
  posts: '/(tabs)/posts',
  profile: '/(tabs)/profile',
};

function isTabRoot(tab: TabName, pathname: string): boolean {
  const normalized = pathname.replace(/^\/\(tabs\)/, '') || '/';
  return normalized === `/${tab}`;
}

function pathnameIsOnTab(tab: TabName, pathname: string): boolean {
  const normalized = pathname.replace(/^\/\(tabs\)/, '') || '/';
  return normalized === `/${tab}` || normalized.startsWith(`/${tab}/`);
}

type TabNavState = {
  type?: string;
  index?: number;
  routes?: Array<{ name: string; state?: TabNavState }>;
};

type TabNavigation = {
  isFocused: () => boolean;
  getState?: () => TabNavState | undefined;
};

function nestedStackIndex(state: TabNavState | undefined, tab: TabName): number | null {
  if (!state) return null;
  if (state.type === 'tab' && Array.isArray(state.routes)) {
    const route =
      state.routes.find((r) => r.name === tab) ?? state.routes[state.index ?? 0];
    if (!route?.state) return 0;
    return nestedStackIndex(route.state, tab) ?? route.state.index ?? 0;
  }
  if (typeof state.index === 'number') return state.index;
  return 0;
}

function isTabAtRoot(navigation: TabNavigation, tab: TabName, pathname: string): boolean {
  if (pathnameIsOnTab(tab, pathname)) return isTabRoot(tab, pathname);
  const nested = nestedStackIndex(navigation.getState?.(), tab);
  return nested == null || nested === 0;
}

const SAME_TAB_PRESS_MS = 450;

/** Renders in React Navigation's label slot (full tab width), not inside the ~31px icon wrapper. */
function TabBarLabel({
  focused,
  color,
  children,
}: {
  focused: boolean;
  color: string;
  children: string;
}) {
  return (
    <Text
      style={[styles.tabBarLabelText, { color }, focused && styles.tabBarLabelTextFocused]}
      numberOfLines={1}
    >
      {children}
    </Text>
  );
}

function TabBarGlyph({
  focused,
  iconNode,
  isAvatar,
  user,
}: {
  focused: boolean;
  iconNode?: ReactNode;
  isAvatar?: boolean;
  user?: { name: string; displayName?: string; thumbnail?: string | null; avatarSeed?: string | null } | null;
}) {
  if (isAvatar && user) {
    return (
      <View style={[styles.avatarWrap, focused && styles.iconWrapActive]}>
        <UserAvatar
          seed={user.displayName || user.name}
          thumbnail={user.thumbnail}
          backgroundColor={user.avatarSeed ? [user.avatarSeed] : undefined}
          size={26}
          style={styles.avatarImg}
        />
      </View>
    );
  }

  if (isAvatar && !user) {
    const c = focused ? Colors.text : Colors.textMuted;
    return (
      <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
        <Ionicons name="person-outline" size={20} color={c} />
      </View>
    );
  }

  return <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>{iconNode}</View>;
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { user: me } = useCurrentUserContext();
  const pathname = usePathname();
  const router = useRouter();

  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const routerRef = useRef(router);
  routerRef.current = router;
  const lastSameTabPressAt = useRef<Partial<Record<TabName, number>>>({});

  const tabListeners = useMemo(() => {
    const make =
      (tab: TabName) =>
      ({ navigation }: { navigation: TabNavigation }) => ({
        tabPress: (e: { preventDefault: () => void }) => {
          const now = Date.now();
          const prev = lastSameTabPressAt.current[tab] ?? 0;
          if (now - prev < SAME_TAB_PRESS_MS) {
            e.preventDefault();
            return;
          }
          lastSameTabPressAt.current[tab] = now;

          if (!navigation.isFocused()) return;

          e.preventDefault();
          if (isTabAtRoot(navigation, tab, pathnameRef.current)) return;
          routerRef.current.replace(TAB_ROOT_HREF[tab]);
        },
      });
    return {
      groups: make('groups'),
      events: make('events'),
      polls: make('polls'),
      posts: make('posts'),
      profile: make('profile'),
    };
  }, []);

  const tabBarLabelFn = (props: { focused: boolean; color: string; children: string }) => (
    <TabBarLabel focused={props.focused} color={props.color}>
      {props.children}
    </TabBarLabel>
  );

  return (
    <Tabs
      initialRouteName="groups"
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: Colors.text,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabel: tabBarLabelFn,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopWidth: 1,
          borderTopColor: Colors.border,
          height: 56 + insets.bottom,
          paddingBottom: insets.bottom,
        },
      }}
    >
      <Tabs.Screen
        name="groups"
        listeners={tabListeners.groups}
        options={{
          title: 'Groups',
          tabBarIcon: ({ focused }) => (
            <TabBarGlyph
              focused={focused}
              iconNode={<GroupsPeopleGlyph size={20} color={focused ? Colors.text : Colors.textMuted} />}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="events"
        listeners={tabListeners.events}
        options={{
          title: 'Events',
          tabBarIcon: ({ focused }) => (
            <TabBarGlyph
              focused={focused}
              iconNode={<EventsCalendarGlyph size={20} color={focused ? Colors.text : Colors.textMuted} />}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="polls"
        listeners={tabListeners.polls}
        options={{
          title: 'Polls',
          tabBarIcon: ({ focused }) => (
            <TabBarGlyph
              focused={focused}
              iconNode={
                <Ionicons
                  name="bar-chart-outline"
                  size={20}
                  color={focused ? Colors.text : Colors.textMuted}
                />
              }
            />
          ),
        }}
      />
      <Tabs.Screen
        name="posts"
        listeners={tabListeners.posts}
        options={{
          title: 'Posts',
          tabBarIcon: ({ focused }) => (
            <TabBarGlyph
              focused={focused}
              iconNode={
                <Ionicons
                  name="newspaper-outline"
                  size={20}
                  color={focused ? Colors.text : Colors.textMuted}
                />
              }
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        listeners={tabListeners.profile}
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => <TabBarGlyph focused={focused} isAvatar user={me} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    width: 40,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: { backgroundColor: '#F0F0EE' },
  avatarWrap: {
    width: 26,
    height: 26,
    minWidth: 26,
    minHeight: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: 26, height: 26, minWidth: 26, minHeight: 26, borderRadius: 13 },
  tabBarLabelText: {
    fontSize: 10,
    fontFamily: Fonts.regular,
    textAlign: 'center',
    marginTop: 2,
  },
  tabBarLabelTextFocused: {
    fontFamily: Fonts.bold,
  },
});
