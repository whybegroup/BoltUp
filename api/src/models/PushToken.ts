export interface PushTokenInput {
  token: string;
  platform: 'ios' | 'android';
  deviceId?: string;
}

export interface PushTokenUnregisterInput {
  token: string;
}
