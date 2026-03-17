/* eslint-disable */
import * as Router from 'expo-router';

export * from 'expo-router';

declare module 'expo-router' {
  export namespace ExpoRouter {
    export interface __routes<T extends string = string> extends Record<string, unknown> {
      StaticRoutes: `/` | `/(tabs)` | `/(tabs)/explore` | `/(tabs)/feed` | `/(tabs)/groups` | `/(tabs)/profile` | `/_sitemap` | `/create-event` | `/create-group` | `/explore` | `/feed` | `/group/invite` | `/group/settings` | `/groups` | `/profile`;
      DynamicRoutes: `/event/${Router.SingleRoutePart<T>}` | `/group/${Router.SingleRoutePart<T>}` | `/group/${Router.SingleRoutePart<T>}/invite`;
      DynamicRouteTemplate: `/event/[id]` | `/group/[id]` | `/group/[id]/invite`;
    }
  }
}
