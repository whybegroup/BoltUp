import { View, StyleSheet } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Colors } from '../../../../constants/theme';
import { InnerGroupSubpageBridge } from '../../../../components/groupScope/InnerGroupSubpageBridge';
import { useGroupsTabParentNavigation } from '../../../../components/groupScope/useGroupsTabParentNavigation';

export default function GroupDetailStackLayout() {
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const groupId = Array.isArray(params.id) ? params.id[0] : params.id;

  useGroupsTabParentNavigation();

  return (
    <View style={styles.root}>
      {groupId ? <InnerGroupSubpageBridge groupId={groupId} /> : null}
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: { flex: 1, backgroundColor: Colors.bg },
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
});
