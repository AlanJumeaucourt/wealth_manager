export default {
  // ... (keep existing config)
  expo: {
    // ... (keep existing expo config)
    extra: {
      eas: {
        projectId: "83cbd7d6-1dc9-4398-bcf2-189795f0129f",
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
