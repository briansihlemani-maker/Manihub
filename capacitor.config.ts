import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'za.co.manihub.app',
  appName: 'ManiHub',
  webDir: 'www',
  bundledWebRuntime: false,
  backgroundColor: '#003b25',
  android: {
    allowMixedContent: false
  },
  ios: {
    contentInset: 'automatic'
  }
};

export default config;
