const appJson = require("./app.json");

let fileApiUrl = "";
try {
  fileApiUrl = require("./config/publicApi.json").apiUrl?.trim?.() || "";
} catch {
  fileApiUrl = "";
}

const PLACEHOLDER = "https://CHANGEZ-MOI.example.com";
const resolvedFile = fileApiUrl && fileApiUrl !== PLACEHOLDER ? fileApiUrl : "";

/** @type {{ expo: import('@expo/config').ExpoConfig }} */
module.exports = {
  expo: {
    ...appJson.expo,
    extra: {
      apiUrl: process.env.EXPO_PUBLIC_API_URL?.trim() || resolvedFile || "",
    },
  },
};
