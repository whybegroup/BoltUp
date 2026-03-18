const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Add the monorepo root to watch folders and module paths
const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '..');

config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(monorepoRoot, 'node_modules'),
];

module.exports = config;
