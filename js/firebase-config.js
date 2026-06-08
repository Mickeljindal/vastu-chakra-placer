/* =====================================================================
   Firebase Configuration
   ---------------------------------------------------------------------
   Replace these values with your actual Firebase project config.
   Get them from: Firebase Console → Project Settings → General → Your apps

   SETUP STEPS:
   1. Go to https://console.firebase.google.com
   2. Create a new project (e.g. "vastu-chakra-placer")
   3. Enable Authentication → Sign-in methods → Google + Email/Password
   4. Create Firestore Database (production mode)
   5. Copy your web app config below
   ===================================================================== */
const FIREBASE_CONFIG = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

/* =====================================================================
   Razorpay Configuration
   ---------------------------------------------------------------------
   Get from: https://dashboard.razorpay.com → Settings → API Keys

   SETUP STEPS:
   1. Create a Razorpay account at https://razorpay.com
   2. Go to Settings → API Keys → Generate Key
   3. Create a Subscription Plan:
      Dashboard → Subscriptions → Plans → Create Plan
      - Plan Name: "Pro Monthly"
      - Amount: 99900 (₹999 in paise)
      - Period: monthly
      - Interval: 1
      Copy the plan_id below.
   ===================================================================== */
const RAZORPAY_CONFIG = {
  key_id: "",               // starts with "rzp_test_" or "rzp_live_"
  plan_id_monthly: "",      // starts with "plan_"
  plan_id_yearly: "",       // optional yearly plan
};
