/* =====================================================================
   App configuration
   ---------------------------------------------------------------------
   GOOGLE MAPS (optional):
   You normally do NOT need to edit this file. The "Use Map (True North)"
   tab lets each user paste their own Google Maps API key directly in the
   app — it is saved in their browser (localStorage) only.

   This value below is just an optional fallback/default key. If you want
   every visitor to share one key (e.g. a tightly domain-restricted key),
   paste it here. Otherwise leave it blank.

   How to get a key (free tier is generous):
   1. Go to https://console.cloud.google.com/google/maps-apis
   2. Create a project, enable "Maps JavaScript API" and "Places API".
   3. Create an API key under Credentials.
   4. (Recommended) Restrict the key to your website domain.

   The app works fully via "Upload Plan" even with no key at all.
   ===================================================================== */
window.APP_CONFIG = {
  GOOGLE_MAPS_API_KEY: ""
};
