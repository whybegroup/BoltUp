const { withPodfile } = require('expo/config-plugins');

/** Static frameworks need module maps for Google/Firebase ObjC pods. */
function withIosModularHeaders(config) {
  return withPodfile(config, (config) => {
    let contents = config.modResults.contents;
    if (contents.includes('use_modular_headers!')) {
      return config;
    }
    if (contents.includes('prepare_react_native_project!')) {
      contents = contents.replace(
        'prepare_react_native_project!',
        'prepare_react_native_project!\nuse_modular_headers!',
      );
    } else {
      contents = `use_modular_headers!\n${contents}`;
    }
    config.modResults.contents = contents;
    return config;
  });
}

module.exports = withIosModularHeaders;
