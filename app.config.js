const appJson = require("./app.json");

/** @type {{ expo: import('@expo/config').ExpoConfig }} */
module.exports = {
  expo: {
    ...appJson.expo,
    extra: {
      ...(appJson.expo.extra || {}),
      apiUrl:
        process.env.EXPO_PUBLIC_API_URL?.trim() ||
        appJson.expo.extra?.apiUrl?.trim?.() ||
        "",
    },
  },
};
