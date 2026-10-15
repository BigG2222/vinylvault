// Plain-HTTP traffic is only allowed while the server runs on the home network (http://192.168…).
// Once EXPO_PUBLIC_VISION_PROXY_URL is an https:// address, the build talks HTTPS only, as Google Play expects.
module.exports = ({ config }) => {
  const httpServer = (process.env.EXPO_PUBLIC_VISION_PROXY_URL ?? '').startsWith('http://');
  const plugins = config.plugins.map((p) =>
    Array.isArray(p) && p[0] === 'expo-build-properties'
      ? [p[0], { ...p[1], android: { ...p[1].android, usesCleartextTraffic: httpServer } }]
      : p,
  );
  return { ...config, plugins };
};
