export default {
  // ... (keep existing config)
  expo: {
    // ... (keep existing expo config)
    extra: {
      eas: {
        projectId: "9d2079bd-e4a1-47ce-8d0c-286dad02dc7c",
      },
    },
    plugins: [
      // ... (keep existing plugins)
    ],
    scheme: 'wealth-manager',
  },
  routes: {
    // ... (keep existing routes)
    '/AddAccountScreen': 'AddAccountScreen',
  },
  "android": {
    "package": "com.wealthmanager.app",
    "versionCode": 1
  }
};
