/* =========================================================
   GRIDGUARD — charts.js
   Chart.js line charts for Tilt / Temperature / Smoke history
   Keeps a rolling window of the last 60 readings per sensor.
   ========================================================= */

const MAX_POINTS = 60;

const chartDefaults = {
  gridColor: "rgba(148, 163, 184, 0.08)",
  tickColor: "#94A3B8",
  fontFamily: "'JetBrains Mono', monospace",
};

Chart.defaults.color = chartDefaults.tickColor;
Chart.defaults.font.family = chartDefaults.fontFamily;
Chart.defaults.font.size = 10;

function buildLineChart(canvasId, { label, color, glow, suggestedMax }) {
  const ctx = document.getElementById(canvasId).getContext("2d");

  const gradient = ctx.createLinearGradient(0, 0, 0, 220);
  gradient.addColorStop(0, glow);
  gradient.addColorStop(1, "rgba(0,0,0,0)");

  return new Chart(ctx, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label,
          data: [],
          borderColor: color,
          backgroundColor: gradient,
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointHoverBackgroundColor: color,
          tension: 0.35,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400 },
      interaction: { intersect: false, mode: "index" },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#1E293B",
          borderColor: "rgba(148,163,184,0.2)",
          borderWidth: 1,
          titleColor: "#E2E8F0",
          bodyColor: "#E2E8F0",
          padding: 10,
          displayColors: false,
        },
      },
      scales: {
        x: {
          grid: { color: chartDefaults.gridColor, drawTicks: false },
          ticks: { maxTicksLimit: 6, autoSkip: true },
          border: { display: false },
        },
        y: {
          suggestedMin: 0,
          suggestedMax,
          grid: { color: chartDefaults.gridColor, drawTicks: false },
          ticks: { maxTicksLimit: 5 },
          border: { display: false },
        },
      },
    },
  });
}

/* Instantiate the three trend charts */
const tiltChart = buildLineChart("tiltChart", {
  label: "Tilt (°)",
  color: "#38BDF8",
  glow: "rgba(56, 189, 248, 0.25)",
  suggestedMax: 12,
});

const tempChart = buildLineChart("tempChart", {
  label: "Temperature (°C)",
  color: "#FB923C",
  glow: "rgba(251, 146, 60, 0.25)",
  suggestedMax: 65,
});

const smokeChart = buildLineChart("smokeChart", {
  label: "Smoke (ppm)",
  color: "#A78BFA",
  glow: "rgba(167, 139, 250, 0.25)",
  suggestedMax: 500,
});

/**
 * Push a new reading onto a chart, keeping only the last MAX_POINTS.
 * @param {Chart} chart
 * @param {string} label - x-axis label (e.g. formatted time)
 * @param {number} value
 */
function pushReading(chart, label, value) {
  const { labels, datasets } = chart.data;

  labels.push(label);
  datasets[0].data.push(value);

  if (labels.length > MAX_POINTS) {
    labels.shift();
    datasets[0].data.shift();
  }

  chart.update("none");
}

/**
 * Convenience function called from script.js on every new sensor reading.
 * @param {{tilt:number, temp:number, smoke:number}} readings
 * @param {string} timeLabel
 */
function updateCharts(readings, timeLabel) {
  if (typeof readings.tilt === "number") pushReading(tiltChart, timeLabel, readings.tilt);
  if (typeof readings.temp === "number") pushReading(tempChart, timeLabel, readings.temp);
  if (typeof readings.smoke === "number") pushReading(smokeChart, timeLabel, readings.smoke);
}

/* Expose globally for script.js to use */
window.GridGuardCharts = {
  tiltChart,
  tempChart,
  smokeChart,
  updateCharts,
};
