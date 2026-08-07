# GridGuard

**Intelligent Utility Pole Health Monitoring System** — an industrial SCADA-style dashboard for real-time monitoring of utility poles fitted with an ESP32 and MPU6050 (tilt), DHT11 (temperature), MQ2 (smoke), and LDR (street light) sensors, streamed through Firebase Realtime Database.

---

## 1. Project Structure

```
GridGuard/
├── index.html          # Main dashboard markup
├── style.css            # Industrial dark SCADA theme
├── firebase.js           # Firebase v10 modular init + realtime listener
├── charts.js             # Chart.js trend charts (tilt / temp / smoke)
├── notification.js       # Critical alarm overlay, sound, blink logic
├── script.js             # App orchestration: status logic, UI updates, event log
├── README.md
└── assets/
    └── sounds/
        └── alarm.mp3      # (add your own alarm audio file here)
```

---

## 2. Requirements

- A modern browser (Chrome, Edge, Firefox) with ES module support.
- A Firebase project with **Realtime Database** enabled.
- (Optional) A local static file server — opening `index.html` directly with `file://` works for most features, but ES modules and some browsers behave better when served over `http://`.

---

## 3. Firebase Setup

### 3.1 Create a Firebase project
1. Go to [console.firebase.google.com](https://console.firebase.google.com).
2. Click **Add project**, name it (e.g. `gridguard`), and finish the wizard.

### 3.2 Enable Realtime Database
1. In the left sidebar, open **Build → Realtime Database**.
2. Click **Create Database**, choose a region, and start in **test mode** for development (lock it down with rules before going to production — see §3.5).

### 3.3 Set the database structure
GridGuard expects data at:

```
GridGuard/
└── poles/
    └── P101/
        ├── tilt: 2.3          // degrees
        ├── temp: 31.5         // °C
        ├── smoke: 80          // ppm
        ├── ldr: true          // true = light ON, false = OFF
        ├── health: 96         // 0–100 (optional; auto-computed if omitted)
        ├── status: "safe"     // "safe" | "warning" | "critical" (optional; auto-computed if omitted)
        ├── uptime: 154302     // seconds since boot
        ├── lat: 10.0159       // optional GPS latitude
        ├── lng: 76.3419       // optional GPS longitude
        └── timestamp: 1735689600
```

You can seed this manually from the Firebase Console (Realtime Database → import JSON), or push it from your ESP32 firmware.

### 3.4 Get your web app config
1. In **Project Settings → General**, scroll to **Your apps** and click the **Web** (`</>`) icon to register a web app.
2. Copy the generated `firebaseConfig` object.

### 3.5 Secure your database (before production)
Test-mode rules allow public read/write. Before deploying, restrict access, for example:

```json
{
  "rules": {
    "GridGuard": {
      "poles": {
        ".read": true,
        ".write": "auth != null"
      }
    }
  }
}
```

Adjust to your authentication strategy (Firebase Auth, API keys on the ESP32 side, etc.).

---

## 4. How to Change the Firebase Config

Open **`firebase.js`** and replace the placeholder object near the top of the file:

```js
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};
```

with the values copied from step 3.4. Save the file — no build step is required.

To monitor a different pole ID by default, either:
- change the value in **Settings → Monitored Pole** inside the running dashboard, or
- edit the fallback in `firebase.js`: `let currentPoleId = localStorage.getItem("gridguard_pole_id") || "P101";`

---

## 5. How to Run (Local Development)

Because `script.js` and `firebase.js` use ES modules, serve the folder over HTTP rather than opening the file directly:

**Option A — VS Code Live Server**
1. Open the `GridGuard` folder in VS Code.
2. Install the "Live Server" extension.
3. Right-click `index.html` → **Open with Live Server**.

**Option B — Python**
```bash
cd GridGuard
python3 -m http.server 8080
```
Then visit `http://localhost:8080`.

**Option C — Node**
```bash
cd GridGuard
npx serve .
```

---

## 6. How to Deploy

### Firebase Hosting (recommended — pairs naturally with Realtime Database)
```bash
npm install -g firebase-tools
firebase login
firebase init hosting   # select your project, set "GridGuard" as the public directory
firebase deploy
```

### Netlify / Vercel
Drag-and-drop the `GridGuard` folder onto Netlify's dashboard, or run:
```bash
npx netlify-cli deploy --dir=GridGuard --prod
```

### GitHub Pages
1. Push the `GridGuard` folder to a GitHub repository.
2. Repo **Settings → Pages** → set the source branch/folder.
3. Your dashboard will be live at `https://<username>.github.io/<repo>/`.

---

## 7. ESP32 Firmware Notes (reference)

The firmware side is not included in this repository, but each pole's ESP32 should periodically push JSON like the structure in §3.3 to:

```
PUT https://<PROJECT_ID>-default-rtdb.firebaseio.com/GridGuard/poles/P101.json
```

using the Firebase REST API or the `Firebase-ESP-Client` Arduino library, reading:
- **MPU6050** → compute tilt angle from accelerometer X/Y/Z.
- **DHT11** → temperature in °C.
- **MQ2** → analog read mapped to an approximate ppm value.
- **LDR** → digital/analog threshold to determine street light ON/OFF.

---

## 8. Status Thresholds

| Sensor | Safe | Warning | Critical |
|---|---|---|---|
| Tilt | < 5° | 5° – 8° | > 8° |
| Temperature | < 40°C | 40°C – 55°C | > 55°C |
| Smoke | < 150 ppm | 150 – 400 ppm | > 400 ppm |

Maintenance guidance follows the same tiers: **Safe** → no action, **Warning** → inspection recommended, **Critical** → immediate maintenance required, and the dashboard automatically switches into full-screen alarm mode (red glow, popup, sound) whenever any sensor crosses into Critical.

---

## 9. Adding the Alarm Sound

Place an MP3 file at `assets/sounds/alarm.mp3`. Any short looping siren/alert tone works — the app already references this path in `index.html` (`<audio id="alarmAudio" src="assets/sounds/alarm.mp3">`) and loops it for the duration of a critical event.

---

## 10. License

Provided as-is for the GridGuard IoT project. Adapt freely for your deployment.
