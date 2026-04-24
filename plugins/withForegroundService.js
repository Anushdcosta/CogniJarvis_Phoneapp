const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withForegroundService(config) {
  return withAndroidManifest(config, async config => {
    let androidManifest = config.modResults;

    const mainApplication = androidManifest.manifest.application[0];
    
    // Add the service if it doesn't exist
    if (!mainApplication.service) {
        mainApplication.service = [];
    }

    const hasService = mainApplication.service.some(
      s => s.$['android:name'] === 'com.voximplant.foregroundservice.VIForegroundService'
    );

    if (!hasService) {
      mainApplication.service.push({
        $: {
          'android:name': 'com.voximplant.foregroundservice.VIForegroundService',
          'android:exported': 'true',
          'android:foregroundServiceType': 'connectedDevice'
        }
      });
    }

    // Add FOREGROUND_SERVICE_CONNECTED_DEVICE permission
    if (!androidManifest.manifest['uses-permission']) {
      androidManifest.manifest['uses-permission'] = [];
    }
    
    const hasPermission = androidManifest.manifest['uses-permission'].some(
      p => p.$['android:name'] === 'android.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE'
    );

    if (!hasPermission) {
      androidManifest.manifest['uses-permission'].push({
        $: { 'android:name': 'android.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE' }
      });
    }

    return config;
  });
};
