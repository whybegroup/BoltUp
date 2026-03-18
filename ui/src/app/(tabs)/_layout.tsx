import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Fonts } from '../../constants/theme';

function TabIcon({ focused, label, icon }: { focused: boolean; label: string; icon: string }) {
  return (
    <View style={styles.tabItem}>
      <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
        <Text style={styles.iconText}>{icon}</Text>
      </View>
      <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>{label}</Text>
    </View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
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
        name="feed"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} label="Feed" icon="⚡" />,
        }}
      />
      <Tabs.Screen
        name="groups"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} label="Groups" icon="💬" />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} label="Explore" icon="🔍" />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} label="Profile" icon="👤" />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabItem: { alignItems: 'center', paddingTop: 8, gap: 3 },
  iconWrap: {
    width: 40, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
  },
  iconWrapActive: { backgroundColor: '#F0F0EE' },
  iconText: { fontSize: 18 },
  tabLabel: {
    fontSize: 10, fontFamily: Fonts.regular, color: Colors.textMuted,
  },
  tabLabelActive: {
    fontFamily: Fonts.bold, color: Colors.text,
  },
});
