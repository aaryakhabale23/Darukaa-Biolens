const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add 'tflite' to Metro asset resolver extensions.
config.resolver.assetExts.push('tflite');

module.exports = config;
