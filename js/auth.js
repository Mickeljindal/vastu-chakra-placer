/* =====================================================================
   Auth & Subscription Module
   - Firebase Auth (Google + Email/Password)
   - Firestore user profile & subscription status
   - Razorpay subscription checkout
   - Feature gating based on plan
   ===================================================================== */
(function () {
  "use strict";

  /* ============ PLANS & LIMITS ============ */
  const PLANS = {
    free: {
      name: "Free",
      exportsPerMonth: 3,
      customWatermark: false,
      googleMaps: false,
      savedAnalyses: 1,
      forcedWatermark: true, // adds "Powered by Vastu Chakra Placer"
    },
    pro: {
      name: "Pro",
      exportsPerMonth: Infinity,
      customWatermark: true,
      googleMaps: true,
      savedAnalyses: 50,
      forcedWatermark: false,
    },
  };

  /* ============ STATE ============ */
  let currentUser = null;
  let userDoc = null; // Firestore doc data: { plan, exports_this_month, subscription_id, ... }
  let db = null;
  let auth = null;

  /* ============ INIT FIREBASE ============ */
  function initFirebase() {
    if (!FIREBASE_CONFIG.apiKey) {
      console.warn("Firebase not configured. Running in offline/free mode.");
      showApp("free");
      return;
    }
    // Firebase is loaded via CDN in index.html
    if (!window.firebase) {
      console.warn("Firebase SDK not loaded.");
      showApp("free");
      return;
    }
    firebase.initializeApp(FIREBASE_CONFIG);
    auth = firebase.auth();
    db = firebase.firestore();

    auth.onAuthStateChanged(async (user) => {
      if (user) {
        currentUser = user;
        await loadUserProfile(user);
        hideAuthScreen();
        showApp(userDoc.plan || "free");
        updateAccountUI();
      } else {
        currentUser = null;
        userDoc = null;
        showAuthScreen();
      }
    });
  }

  /* ============ USER PROFILE (Firestore) ============ */
  async function loadUserProfile(user) {
    const ref = db.collection("users").doc(user.uid);
    const snap = await ref.get();
    if (snap.exists) {
      userDoc = snap.data();
      // reset monthly counter if new month
      const now = new Date();
      const monthKey = now.getFullYear() + "-" + (now.getMonth() + 1);
      if (userDoc.exports_month_key !== monthKey) {
        await ref.update({ exports_this_month: 0, exports_month_key: monthKey });
        userDoc.exports_this_month = 0;
        userDoc.exports_month_key = monthKey;
      }
    } else {
      // new user — create profile
      const now = new Date();
      const monthKey = now.getFullYear() + "-" + (now.getMonth() + 1);
      userDoc = {
        email: user.email,
        name: user.displayName || "",
        plan: "free",
        exports_this_month: 0,
        exports_month_key: monthKey,
        subscription_id: null,
        created_at: firebase.firestore.FieldValue.serverTimestamp(),
      };
      await ref.set(userDoc);
    }
  }

  /* ============ AUTH ACTIONS ============ */
  function signInWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch((e) => showAuthError(e.message));
  }

  function signInWithEmail(email, password) {
    auth.signInWithEmailAndPassword(email, password).catch((e) => {
      if (e.code === "auth/user-not-found") {
        // auto-create account
        auth.createUserWithEmailAndPassword(email, password).catch((e2) => showAuthError(e2.message));
      } else {
        showAuthError(e.message);
      }
    });
  }

  function signOut() {
    auth.signOut();
  }

  /* ============ RAZORPAY SUBSCRIPTION ============ */
  function startSubscription(planType) {
    if (!RAZORPAY_CONFIG.key_id) {
      alert("Razorpay not configured. Contact support.");
      return;
    }
    const planId = planType === "yearly" ? RAZORPAY_CONFIG.plan_id_yearly : RAZORPAY_CONFIG.plan_id_monthly;
    if (!planId) {
      alert("Subscription plan not configured.");
      return;
    }

    const options = {
      key: RAZORPAY_CONFIG.key_id,
      subscription_id: "", // created server-side ideally; for client-only we use plan + customer
      plan_id: planId,
      name: "Vastu Shakti Chakra Placer",
      description: planType === "yearly" ? "Pro Plan — Yearly" : "Pro Plan — Monthly",
      image: "",
      prefill: {
        name: currentUser ? currentUser.displayName || "" : "",
        email: currentUser ? currentUser.email || "" : "",
      },
      theme: { color: "#e07b1a" },
      handler: async function (response) {
        // Payment successful — update Firestore
        if (db && currentUser) {
          await db.collection("users").doc(currentUser.uid).update({
            plan: "pro",
            subscription_id: response.razorpay_subscription_id || response.razorpay_payment_id,
            subscription_start: firebase.firestore.FieldValue.serverTimestamp(),
          });
          userDoc.plan = "pro";
          showApp("pro");
          updateAccountUI();
          alert("🎉 Welcome to Pro! All features are now unlocked.");
        }
      },
    };

    const rzp = new Razorpay(options);
    rzp.open();
  }

  /* ============ FEATURE GATING ============ */
  function canExport() {
    const plan = PLANS[userDoc ? userDoc.plan : "free"];
    if (plan.exportsPerMonth === Infinity) return true;
    return (userDoc ? userDoc.exports_this_month : 0) < plan.exportsPerMonth;
  }

  async function recordExport() {
    if (!db || !currentUser) return;
    const newCount = (userDoc.exports_this_month || 0) + 1;
    await db.collection("users").doc(currentUser.uid).update({ exports_this_month: newCount });
    userDoc.exports_this_month = newCount;
    updateAccountUI();
  }

  function getCurrentPlan() {
    return PLANS[userDoc ? userDoc.plan : "free"];
  }

  function isPro() {
    return userDoc && userDoc.plan === "pro";
  }

  /* ============ UI HELPERS ============ */
  function showAuthScreen() {
    const s = document.getElementById("authScreen");
    if (s) s.hidden = false;
    const a = document.getElementById("appMain");
    if (a) a.hidden = true;
  }

  function hideAuthScreen() {
    const s = document.getElementById("authScreen");
    if (s) s.hidden = true;
    const a = document.getElementById("appMain");
    if (a) a.hidden = false;
  }

  function showApp(plan) {
    hideAuthScreen();
    // toggle pro-only features
    document.querySelectorAll("[data-pro]").forEach((el) => {
      el.classList.toggle("feature-locked", plan !== "pro");
    });
  }

  function showAuthError(msg) {
    const el = document.getElementById("authError");
    if (el) { el.textContent = msg; el.hidden = false; }
  }

  function updateAccountUI() {
    const nameEl = document.getElementById("accountName");
    const planEl = document.getElementById("accountPlan");
    const exportsEl = document.getElementById("accountExports");
    if (nameEl && currentUser) nameEl.textContent = currentUser.displayName || currentUser.email;
    if (planEl) planEl.textContent = isPro() ? "Pro" : "Free";
    if (exportsEl) {
      const plan = getCurrentPlan();
      const used = userDoc ? userDoc.exports_this_month : 0;
      const max = plan.exportsPerMonth === Infinity ? "∞" : plan.exportsPerMonth;
      exportsEl.textContent = used + " / " + max;
    }
  }

  /* ============ EXPOSE GLOBALLY ============ */
  window.VastuAuth = {
    init: initFirebase,
    signInWithGoogle,
    signInWithEmail,
    signOut,
    startSubscription,
    canExport,
    recordExport,
    getCurrentPlan,
    isPro,
    PLANS,
    getUser: () => currentUser,
  };
})();
