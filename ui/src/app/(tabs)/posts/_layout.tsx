import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { Colors } from '../../../constants/theme';
import { PostsChrome } from '../../../components/PostsChrome';

export default function PostsTabLayout() {
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  return (
    <View style={styles.root}>
      <PostsChrome viewMode={viewMode} onViewModeChange={setViewMode} />
      <View style={styles.stack}>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
            contentStyle: { flex: 1, backgroundColor: Colors.bg },
          }}
          initialRouteName="index"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  stack: { flex: 1, minHeight: 0 },
});
