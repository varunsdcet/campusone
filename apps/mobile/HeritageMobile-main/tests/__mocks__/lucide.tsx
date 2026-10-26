import React from 'react';
import { View } from 'react-native';
// CommonJS export is required so the Proxy itself becomes the module (Jest moduleNameMapper target).
declare const module: { exports: unknown };
const handler: ProxyHandler<Record<string, unknown>> = { get: (_t, name) => (typeof name === 'string' && name !== '__esModule' ? () => <View accessibilityLabel={`icon-${name}`} /> : undefined) };
module.exports = new Proxy({}, handler);
