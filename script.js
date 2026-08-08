/* =========================================================
   GRIDGUARD — script.js
   Main application logic: clock, sidebar nav, sensor status
   thresholds, health gauge, map, event log, and wiring the
   Firebase realtime stream into the UI.
   ========================================================= */

import { subscribeToPole, subscribeToConnectionState, setActivePole, getActivePole } from "./firebase.js";

/* ---------------------------------------------------------
   DOM references
--------------------------------------------------------- */
const el = {
  liveTime: document.getElementById("liveTime"),
  liveDate: document.getElementById("liveDate"),
  connDot: document.getElementById("connDot"),
  connLabel: document.getElementById("connLabel"),
  bellDot: document.getElementById("bellDot"),
  alertCountBadge: document.getElementById("alertCountBadge"),

  globalStatusPill: document.getElementById("globalStatusPill"),
  uptimeValue: document.getElementById("uptimeValue"),
  lastUpdateValue: document.getElementById("lastUpdateValue"),

  tiltValue: document.getElementById("tiltValue"),
  tiltStatusTag: document.getElementById("tiltStatusTag"),
  tiltBar: document.getElementById("tiltBar"),
  cardTilt: document.getElementById("cardTilt"),

  tempValue: document.getElementById("tempValue"),
  tempStatusTag: document.getElementById("tempStatusTag"),
  tempBar: document.getElementById("tempBar"),
  cardTemp: document.getElementById("cardTemp"),

  smokeValue: document.getElementById("smokeValue"),
  smokeStatusTag: document.getElementById("smokeStatusTag"),
  smokeBar: document.getElementById("smokeBar"),
  cardSmoke: document.getElementById("cardSmoke"),

  ldrValue: document.getElementById("ldrValue"),
  ldrStatusTag: document.getElementById("ldrStatusTag"),
  ldrBar: document.getElementById("ldrBar"),
  cardLdr: document.getElementById("cardLdr"),

  gaugeProgress: document.getElementById("gaugeProgress"),
  healthPercent: document.getElementById("healthPercent"),
  healthStatusPill: document.getElementById("healthStatusPill"),
  maintenanceRecommend: document.getElementById("maintenanceRecommend"),
  healthUptime: document.getElementById("healthUptime"),

  mapCoords: document.getElementById("mapCoords"),
  latValue: document.getElementById("latValue"),
  lngValue: document.getElementById("lngValue"),
  gpsStatusText: document.getElementById("gpsStatusText"),
  mapsLink: document.getElementById("mapsLink"),

  eventLog: document.getElementById("eventLog"),
  logEmpty: document.getElementById("logEmpty"),
  clearLogBtn: document.getElementById("clearLogBtn"),

  tblTilt: document.getElementById("tblTilt"),
  tblTemp: document.getElementById("tblTemp"),
  tblSmoke: document.getElementById("tblSmoke"),
  tblLdr: document.getElementById("tblLdr"),
  tblHealth: document.getElementById("tblHealth"),
  tblStatus: document.getElementById("tblStatus"),

  sidebar: document.getElementById("sidebar"),
  sidebarScrim: document.getElementById("sidebarScrim"),
  burgerBtn: document.getElementById("burgerBtn"),
  bellBtn: document.getElementById("bellBtn"),

  poleIdInput: document.getElementById("poleIdInput"),
  footerYear: document.getElementById("footerYear"),
};

const GAUGE_CIRCUMFERENCE = 2 * Math.PI * 86; // r=86, matches SVG

/* ---------------------------------------------------------
   Thresholds (per spec)
--------------------------------------------------------- */
const THRESHOLDS = {
    tilt: { warn: 15, crit: 20, max: 50 },
    temp: { warn: 40, crit: 55, max: 70 },
    smoke: { warn: 150, crit: 400, max: 600 }
};

function classify(value, key) {
  const t = THRESHOLDS[key];
  if (value > t.crit) return "critical";
  if (value >= t.warn) return "warning";
  return "safe";
}

function overallStatus(statuses) {
  if (statuses.includes("critical")) return "critical";
  if (statuses.includes("warning")) return "warning";
  return "safe";
}

const STATUS_LABEL = { safe: "SAFE", warning: "WARNING", critical: "CRITICAL" };
const MAINTENANCE_TEXT = {
  safe: "No Maintenance Required",
  warning: "Inspection Recommended",
  critical: "Immediate Maintenance Required",
};

let alertCount = 0;
let lastOverallStatus = "safe";

/* ---------------------------------------------------------
   Clock
--------------------------------------------------------- */
function tickClock() {
  const now = new Date();
  el.liveTime.textContent = now.toLocaleTimeString("en-GB", { hour12: false });
  el.liveDate.textContent = now.toLocaleDateString("en-US", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
tickClock();
setInterval(tickClock, 1000);
if (el.footerYear) el.footerYear.textContent = new Date().getFullYear();

/* ---------------------------------------------------------
   Sidebar navigation (mobile toggle + active link + smooth scroll)
--------------------------------------------------------- */
function openSidebar() {
  el.sidebar.classList.add("open");
  el.sidebarScrim.classList.remove("d-none");
  requestAnimationFrame(() => el.sidebarScrim.classList.add("show"));
}
function closeSidebar() {
  el.sidebar.classList.remove("open");
  el.sidebarScrim.classList.remove("show");
  setTimeout(() => el.sidebarScrim.classList.add("d-none"), 200);
}
el.burgerBtn?.addEventListener("click", openSidebar);
el.sidebarScrim?.addEventListener("click", closeSidebar);

document.querySelectorAll(".nav-link").forEach((link) => {
  link.addEventListener("click", (e) => {
    document.querySelectorAll(".nav-link").forEach((l) => l.classList.remove("active"));
    link.classList.add("active");
    closeSidebar();
  });
});

el.bellBtn?.addEventListener("click", () => {
  document.getElementById("alerts")?.scrollIntoView({ behavior: "smooth", block: "start" });
  el.bellDot.classList.add("d-none");
});

/* ---------------------------------------------------------
   Event log
--------------------------------------------------------- */
function addLogEntry(eventText, status = "safe") {
  el.logEmpty?.classList.add("d-none");

  const item = document.createElement("div");
  item.className = `log-item ${status === "warning" ? "warn" : status === "critical" ? "crit" : ""}`;

  const time = new Date().toLocaleTimeString("en-GB", { hour12: false });

  item.innerHTML = `
    <span class="log-time">${time}</span>
    <span class="log-event">${eventText}</span>
    <span class="log-status">${STATUS_LABEL[status]}</span>
  `;

  el.eventLog.prepend(item);

  // Keep log to a reasonable length in the DOM
  const items = el.eventLog.querySelectorAll(".log-item");
  if (items.length > 100) items[items.length - 1].remove();

  if (status !== "safe") {
    alertCount += 1;
    el.alertCountBadge.textContent = alertCount;
    el.bellDot.classList.remove("d-none");
  }
}

el.clearLogBtn?.addEventListener("click", () => {
  el.eventLog.innerHTML = "";
  el.logEmpty.classList.remove("d-none");
  el.eventLog.appendChild(el.logEmpty);
  alertCount = 0;
  el.alertCountBadge.textContent = "0";
  el.bellDot.classList.add("d-none");
});

/* ---------------------------------------------------------
   Sensor card updater
--------------------------------------------------------- */
function updateSensorCard({ card, valueEl, tagEl, barEl }, value, status, percent, displayValue) {
  const prevText = valueEl.textContent;
  valueEl.textContent = displayValue;
  if (prevText !== String(displayValue)) {
    valueEl.classList.remove("value-updated");
    void valueEl.offsetWidth; // reflow to restart animation
    valueEl.classList.add("value-updated");
  }

  tagEl.textContent = STATUS_LABEL[status];
  card.dataset.status = status;

  barEl.style.width = `${Math.min(100, Math.max(4, percent))}%`;
  barEl.style.background =
    status === "critical" ? "var(--crit)" : status === "warning" ? "var(--warn)" : "var(--safe)";
}

/* ---------------------------------------------------------
   Health gauge
--------------------------------------------------------- */
function updateGauge(healthPercent, status) {
  const clamped = Math.max(0, Math.min(100, healthPercent));
  const offset = GAUGE_CIRCUMFERENCE - (clamped / 100) * GAUGE_CIRCUMFERENCE;
  el.gaugeProgress.style.strokeDashoffset = offset;

  const color = status === "critical" ? "var(--crit)" : status === "warning" ? "var(--warn)" : "var(--safe)";
  el.gaugeProgress.style.stroke = color;

  el.healthPercent.textContent = `${Math.round(clamped)}%`;

  el.healthStatusPill.textContent = STATUS_LABEL[status];
  el.healthStatusPill.className = `status-pill sm ${status === "warning" ? "warn" : status === "critical" ? "crit" : ""}`;

  el.maintenanceRecommend.textContent = MAINTENANCE_TEXT[status];
}

/* ---------------------------------------------------------
   Global status pill (top strip)
--------------------------------------------------------- */
function updateGlobalStatus(status) {
  el.globalStatusPill.className = `status-pill ${status === "warning" ? "warn" : status === "critical" ? "crit" : ""}`;
  const icon = status === "critical" ? "bi-exclamation-octagon-fill" : status === "warning" ? "bi-exclamation-triangle-fill" : "bi-shield-check";
  el.globalStatusPill.innerHTML = `<i class="bi ${icon}"></i> ${STATUS_LABEL[status]}`;
}

/* ---------------------------------------------------------
   Map panel
--------------------------------------------------------- */
function updateMap(lat, lng) {
  const hasCoords = typeof lat === "number" && typeof lng === "number" && !(lat === 0 && lng === 0);

  if (hasCoords) {
    el.mapCoords.style.display = "flex";
    el.gpsStatusText.parentElement.style.display = "none";
    el.latValue.textContent = lat.toFixed(5);
    el.lngValue.textContent = lng.toFixed(5);
    el.mapsLink.href = `https://www.google.com/maps?q=${lat},${lng}`;
    el.mapsLink.classList.remove("d-none");
  } else {
    el.mapCoords.style.display = "none";
    el.gpsStatusText.parentElement.style.display = "flex";
    el.gpsStatusText.textContent = "GPS Not Available";
    el.mapsLink.classList.add("d-none");
  }
}

/* ---------------------------------------------------------
   Uptime formatter (expects seconds)
--------------------------------------------------------- */
function formatUptime(seconds) {
  if (typeof seconds !== "number" || isNaN(seconds)) return "--";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/* ---------------------------------------------------------
   Connection status
--------------------------------------------------------- */
subscribeToConnectionState((isConnected) => {
  if (isConnected) {
    el.connDot.className = "conn-dot online";
    el.connLabel.textContent = "Connected";
  } else {
    el.connDot.className = "conn-dot offline";
    el.connLabel.textContent = "Disconnected";
    addLogEntry("Firebase connection lost", "warning");
  }
});

/* ---------------------------------------------------------
   Main data handler — called on every Firebase update
--------------------------------------------------------- */
let hasReceivedFirstReading = false;
let previousStatuses = { tilt: "safe", temp: "safe", smoke: "safe" };

function handlePoleData(data) {
  if (!data) return;

  const tilt = Number(data.tilt ?? 0);
  const temp = Number(data.temp ?? 0);
  const smoke = Number(data.smoke ?? 0);
  const ldrRaw = data.ldr;
  const lat = typeof data.lat === "number" ? data.lat : data.latitude;
  const lng = typeof data.lng === "number" ? data.lng : data.longitude;
  const uptimeSeconds = typeof data.uptime === "number" ? data.uptime : null;

  const tiltStatus = classify(tilt, "tilt");
  const tempStatus = classify(temp, "temp");
  const smokeStatus = classify(smoke, "smoke");
  const overall = data.status ? String(data.status).toLowerCase() : overallStatus([tiltStatus, tempStatus, smokeStatus]);

  /* --- sensor cards --- */
  updateSensorCard(
    { card: el.cardTilt, valueEl: el.tiltValue, tagEl: el.tiltStatusTag, barEl: el.tiltBar },
    tilt, tiltStatus, (tilt / THRESHOLDS.tilt.max) * 100, tilt.toFixed(1)
  );
  updateSensorCard(
    { card: el.cardTemp, valueEl: el.tempValue, tagEl: el.tempStatusTag, barEl: el.tempBar },
    temp, tempStatus, (temp / THRESHOLDS.temp.max) * 100, temp.toFixed(1)
  );
  updateSensorCard(
    { card: el.cardSmoke, valueEl: el.smokeValue, tagEl: el.smokeStatusTag, barEl: el.smokeBar },
    smoke, smokeStatus, (smoke / THRESHOLDS.smoke.max) * 100, Math.round(smoke)
  );

  /* street light (LDR) — boolean-ish or numeric */
  const lightOn = ldrRaw === true || ldrRaw === 1 || ldrRaw === "ON" || ldrRaw === "on";
  const lightOff = ldrRaw === false || ldrRaw === 0 || ldrRaw === "OFF" || ldrRaw === "off";
  el.ldrValue.textContent = lightOn ? "ON" : lightOff ? "OFF" : "--";
  el.ldrStatusTag.textContent = lightOn ? "ACTIVE" : lightOff ? "IDLE" : "--";
  el.cardLdr.dataset.status = "safe";
  el.ldrBar.style.width = lightOn ? "100%" : lightOff ? "12%" : "0%";
  el.ldrBar.style.background = "var(--safe)";

  /* --- global status + gauge --- */
  updateGlobalStatus(overall);

  const health = typeof data.health === "number" ? data.health : Math.max(0, 100 - (tiltStatus === "critical" ? 60 : tiltStatus === "warning" ? 25 : 0) - (tempStatus === "critical" ? 60 : tempStatus === "warning" ? 25 : 0) - (smokeStatus === "critical" ? 60 : smokeStatus === "warning" ? 25 : 0));
  updateGauge(health, overall);
  el.healthUptime.textContent = formatUptime(uptimeSeconds);

  /* --- map --- */
  updateMap(lat, lng);

  /* --- uptime / last update strip --- */
  el.uptimeValue.textContent = formatUptime(uptimeSeconds);
  el.lastUpdateValue.textContent = new Date().toLocaleTimeString("en-GB", { hour12: false });

  /* --- status table (Pole Status section) --- */
  el.tblTilt.textContent = `${tilt.toFixed(1)}°`;
  el.tblTemp.textContent = `${temp.toFixed(1)}°C`;
  el.tblSmoke.textContent = `${Math.round(smoke)} ppm`;
  el.tblLdr.textContent = lightOn ? "ON" : lightOff ? "OFF" : "--";
  el.tblHealth.textContent = `${Math.round(health)}%`;
  el.tblStatus.textContent = STATUS_LABEL[overall];
  el.tblStatus.className = `status-pill sm ${overall === "warning" ? "warn" : overall === "critical" ? "crit" : ""}`;

  /* --- charts --- */
  const timeLabel = new Date().toLocaleTimeString("en-GB", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
  window.GridGuardCharts?.updateCharts({ tilt, temp, smoke }, timeLabel);

  /* --- event log (only log on state transitions to avoid spam) --- */
  if (hasReceivedFirstReading) {
    if (tiltStatus !== previousStatuses.tilt) {
      addLogEntry(`Pole Tilt ${tiltStatus === "critical" ? "Critical" : tiltStatus === "warning" ? "Increased" : "Normalized"} (${tilt.toFixed(1)}°)`, tiltStatus);
    }
    if (tempStatus !== previousStatuses.temp) {
      addLogEntry(`Temperature ${tempStatus === "critical" ? "Critical" : tempStatus === "warning" ? "Elevated" : "Normalized"} (${temp.toFixed(1)}°C)`, tempStatus);
    }
    if (smokeStatus !== previousStatuses.smoke) {
      addLogEntry(`Smoke ${smokeStatus === "critical" ? "Critical Alert" : smokeStatus === "warning" ? "Warning" : "Cleared"} (${Math.round(smoke)} ppm)`, smokeStatus);
    }
  } else {
    addLogEntry(`Connected to pole ${getActivePole()} — baseline reading received`, "safe");
  }

  previousStatuses = { tilt: tiltStatus, temp: tempStatus, smoke: smokeStatus };
  hasReceivedFirstReading = true;

  /* --- critical alarm handling --- */
  if (overall === "critical" && lastOverallStatus !== "critical") {
    const cause = tiltStatus === "critical" ? "Pole Tilt" : tempStatus === "critical" ? "Temperature" : "Smoke Level";
    window.GridGuardNotify?.triggerCriticalAlarm(`${cause} on pole ${getActivePole()} has exceeded the critical threshold. Immediate maintenance required.`);
    addLogEntry(`CRITICAL ALERT — ${cause} threshold exceeded`, "critical");
  } else if (overall !== "critical" && lastOverallStatus === "critical") {
    window.GridGuardNotify?.clearCriticalAlarm();
    addLogEntry("Critical condition cleared — status restored", "safe");
  }
  lastOverallStatus = overall;
}

/* ---------------------------------------------------------
   Start listening to Firebase
--------------------------------------------------------- */
let unsubscribe = subscribeToPole(
  handlePoleData,
  () => {
    el.connDot.className = "conn-dot offline";
    el.connLabel.textContent = "Error";
  }
);

/* ---------------------------------------------------------
   Settings: change monitored pole
--------------------------------------------------------- */
el.poleIdInput?.addEventListener("change", (e) => {
  const newId = e.target.value.trim();
  if (!newId) return;

  if (typeof unsubscribe === "function") unsubscribe();
  setActivePole(newId);
  hasReceivedFirstReading = false;
  lastOverallStatus = "safe";

  addLogEntry(`Switched monitoring to pole ${newId}`, "safe");

  unsubscribe = subscribeToPole(handlePoleData, () => {
    el.connDot.className = "conn-dot offline";
    el.connLabel.textContent = "Error";
  });
});

if (el.poleIdInput) el.poleIdInput.value = getActivePole();
