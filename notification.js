/* =========================================================
   GRIDGUARD — notification.js
   Handles the CRITICAL alarm overlay, alarm sound, blink
   animation, and the browser Notification API (optional).
   ========================================================= */

(function () {
  const overlay = document.getElementById("alarmOverlay");
  const alarmMessage = document.getElementById("alarmMessage");
  const acknowledgeBtn = document.getElementById("acknowledgeAlarm");
  const alarmAudio = document.getElementById("alarmAudio");
  const appShell = document.getElementById("appShell");
  const alarmSoundToggle = document.getElementById("alarmSoundToggle");

  let isAlarmActive = false;
  let acknowledgedForThisEvent = false;

  /* Ask for desktop notification permission up front (non-blocking) */
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }

  function soundEnabled() {
    return alarmSoundToggle ? alarmSoundToggle.checked : true;
  }

  /**
   * Trigger the full critical alarm experience: red glow, popup,
   * blinking, and sound.
   * @param {string} message
   */
  function triggerCriticalAlarm(message) {
    isAlarmActive = true;
    acknowledgedForThisEvent = false;

    alarmMessage.textContent = message || "A monitored value has entered a critical state.";
    overlay.classList.remove("d-none");
    appShell.classList.add("alarm-active");

    if (soundEnabled() && alarmAudio) {
      alarmAudio.loop = true;
      alarmAudio.currentTime = 0;
      alarmAudio.play().catch(() => {
        /* Autoplay may be blocked until the user interacts with the page */
      });
    }

    if ("Notification" in window && Notification.permission === "granted") {
      try {
        new Notification("GridGuard — CRITICAL ALERT", {
          body: message,
          icon: "",
        });
      } catch (e) {
        /* ignore notification errors */
      }
    }
  }

  /**
   * Clear the alarm state (called automatically once status
   * returns to a non-critical level).
   */
  function clearCriticalAlarm() {
    isAlarmActive = false;
    overlay.classList.add("d-none");
    appShell.classList.remove("alarm-active");
    if (alarmAudio) {
      alarmAudio.pause();
      alarmAudio.currentTime = 0;
    }
  }

  acknowledgeBtn.addEventListener("click", () => {
    acknowledgedForThisEvent = true;
    overlay.classList.add("d-none");
    if (alarmAudio) {
      alarmAudio.pause();
      alarmAudio.currentTime = 0;
    }
    /* The red glow on the shell persists as a passive warning
       until the underlying reading actually clears. */
  });

  window.GridGuardNotify = {
    triggerCriticalAlarm,
    clearCriticalAlarm,
    isAlarmActive: () => isAlarmActive,
    isAcknowledged: () => acknowledgedForThisEvent,
  };
})();
