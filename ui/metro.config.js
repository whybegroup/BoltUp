const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Add the monorepo root to watch folders and module paths
const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '..');

config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];
// markdown-it expects Node's "punycode"; map to the npm polyfill for React Native
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  punycode: require.resolve('punycode'),
};

module.exports = config;
