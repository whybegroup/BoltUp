/** Build iOS reversed client scheme for Google Sign-In config plugin (from EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID). */
function iosGoogleUrlScheme() {
  const id = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  if (!id || typeof id !== 'string') return null;
  const host = id.replace(/\.apps\.googleusercontent\.com$/i, '');
  return `com.googleusercontent.apps.${host}`;
}

const iosUrlScheme = iosGoogleUrlScheme();

const plugins = [
  'expo-router',
  'expo-font',
  'expo-web-browser',
  [
    'expo-notifications',
    {
      icon: './assets/favicon.png',
      color: '#FAFAF9',
    },
  ],
  [
    'expo-image-picker',
    {
      photosPermission: 'moijia needs access to your photos to upload images to events.',
      cameraPermission: 'moijia can use the camera to add photos to events.',
    },
  ],
  [
    'expo-location',
    {
      locationWhenInUsePermission:
        'moijia uses your location to suggest nearby places when setting an event location.',
    },
  ],
];
if (iosUrlScheme) {
  plugins.push(['@react-native-google-signin/google-signin', { iosUrlScheme }]);
}

module.exports = {
  expo: {
    name: 'moijia',
    slug: 'moijia',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/favicon.png',
    scheme: 'moijia',
    userInterfaceStyle: 'dark',
    splash: {
      image: './assets/favicon.png',
      backgroundColor: '#FAFAF9',
      resizeMode: 'contain',
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: 'com.moijia.moijia',
      associatedDomains: ['applinks:moijia.com', 'applinks:moijia.com?mode=developer'],
    },
    android: {
      adaptiveIcon: {
        backgroundColor: '#FAFAF9',
      },
      package: 'com.moijia.moijia',
      /** Lets bottom sheets / modals shrink above the keyboard instead of covering inputs */
      softwareKeyboardLayoutMode: 'resize',
    },
    web: {
      bundler: 'metro',
      favicon: './assets/favicon.png',
    },
    plugins,
    experiments: {
      typedRoutes: true,
      tsconfigPaths: true,
    },
    extra: {
      eas: {
        projectId: "6d4b4dda-eff5-4a0f-80e2-3cc092089a5d",
      },
    },
    "owner": "whybe"
  },
};
