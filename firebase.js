/* =========================================================
   GRIDGUARD — firebase.js
   Firebase Web SDK v10 (Modular) initialization + realtime listener
   ========================================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getDatabase,
  ref,
  onValue,
  onDisconnect,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";

/* =========================================================
   >>> REPLACE WITH YOUR OWN FIREBASE PROJECT CONFIG <<<
   Get this from: Firebase Console > Project Settings > General
   ========================================================= */
const firebaseConfig = {
  apiKey: "AIzaSyB4j3LMwEyEgAw8JQTRs1bI-4MtoGM4-EA",
  authDomain: "gridgaurd-2fe5c.firebaseapp.com",
  databaseURL: "https://gridgaurd-2fe5c-default-rtdb.firebaseio.com",
  projectId: "gridgaurd-2fe5c",
  storageBucket: "gridgaurd-2fe5c.firebasestorage.app",
  messagingSenderId: "459381136565",
  appId: "1:459381136565:web:581b799c4b4f669665b2fc",
};

/* ---------------------------------------------------------
   Initialize Firebase app + Realtime Database
--------------------------------------------------------- */
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

/* ---------------------------------------------------------
   Active pole (can be changed from Settings panel)
--------------------------------------------------------- */
let currentPoleId = localStorage.getItem("gridguard_pole_id") || "P101";

/**
 * Returns the RTDB path for a given pole.
 * Structure: GridGuard/poles/<poleId>/{tilt,temp,smoke,ldr,health,status,uptime,timestamp}
 */
function poleRef(poleId = currentPoleId) {
  return ref(db, `GridGuard/poles/${poleId}`);
}

/**
 * Subscribe to realtime updates for a pole.
 * @param {(data: object) => void} callback - invoked with the pole's data object
 * @param {(err: Error) => void} onError - invoked on read error
 * @param {string} [poleId] - optional pole id override
 * @returns {() => void} unsubscribe function
 */
function subscribeToPole(callback, onError, poleId = currentPoleId) {
  const dataRef = poleRef(poleId);

  const unsubscribe = onValue(
    dataRef,
    (snapshot) => {
      const val = snapshot.val();
      if (val) {
        callback(val);
      } else {
        callback(null);
      }
    },
    (error) => {
      console.error("[GridGuard] Firebase read error:", error);
      if (onError) onError(error);
    }
  );

  return unsubscribe;
}

/**
 * Monitors the special Firebase ".info/connected" path to know
 * whether the client currently has a live connection to RTDB.
 * @param {(isConnected: boolean) => void} callback
 */
function subscribeToConnectionState(callback) {
  const connectedRef = ref(db, ".info/connected");
  onValue(connectedRef, (snap) => {
    const isConnected = snap.val() === true;
    callback(isConnected);
  });
}

/**
 * Change which pole is being monitored at runtime.
 * @param {string} poleId
 */
function setActivePole(poleId) {
  currentPoleId = poleId;
  localStorage.setItem("gridguard_pole_id", poleId);
}

function getActivePole() {
  return currentPoleId;
}

/* Expose a small API on window so non-module scripts (script.js
   is a module too, but charts.js / notification.js are not) can
   coordinate if ever needed. */
window.GridGuardFirebase = {
  db,
  poleRef,
  subscribeToPole,
  subscribeToConnectionState,
  setActivePole,
  getActivePole,
  serverTimestamp,
  onDisconnect,
};

export {
  db,
  poleRef,
  subscribeToPole,
  subscribeToConnectionState,
  setActivePole,
  getActivePole,
};