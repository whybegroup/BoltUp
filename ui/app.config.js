module.exports = {
  expo: {
    name: 'Popin',
    slug: 'popin',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    scheme: 'popin',
    userInterfaceStyle: 'light',
    splash: {
      backgroundColor: '#FAFAF9'
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: 'com.popin.app'
    },
    android: {
      adaptiveIcon: {
        backgroundColor: '#FAFAF9'
      },
      package: 'com.popin.app'
    },
    web: {
      bundler: 'metro',
      favicon: './assets/favicon.png'
    },
    plugins: [
      'expo-router',
      'expo-font'
    ],
    experiments: {
      typedRoutes: true,
      tsconfigPaths: true
    }
  }
};
