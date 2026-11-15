import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.safigroom.os',
  appName: 'SafiGroom OS',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
