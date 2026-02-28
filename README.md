# Joyjet Ecosystem: Secure HD Synchronization 🚀
---

A high-performance, stealth-oriented synchronization system consisting of a **Node Relay Server** and a **Mobile Hub (Battery Optimizer)**.

## 🛠 Core System Architecture
The ecosystem uses a "Parent-Child" logic based on naming conventions to ensure privacy and high-speed data routing.

### 1. Naming & Permission Logic
The system automatically assigns roles based on the **underscore (`_`)** separator:

| User Type | Name Format | Access Level |
| :--- | :--- | :--- |
| **Admin** | `admin` | Full System Control + Remote Wipe (Requires Secret Key). |
| **Viewer** | `Alpha` | Sees only Ghosts starting with `Alpha_`. |
| **Ghost** | `Alpha_01` | Stealth Node. Relays HD stream to `Alpha`. |

---

## 📡 Server Features (joyjet-server)
* **HD Streaming Engine:** Optimized with `volatile.emit` and 100MB buffer for lag-free monitoring.
* **Socket Rooms:** Uses `socket.join` for instant, private data routing.
* **Environment Security:** Admin access locked via `ADMIN_SECRET_KEY` (GURU_8310).
* **Render Keep-Alive:** Integrated self-heartbeat prevents server sleep.

### Server Deployment
1. Set Environment Variable: `ADMIN_SECRET_KEY=GURU_8310`.
2. Run `npm install` and `npm start`.

---

## 📱 Mobile Hub Features (joyjet-hub)
The app is masked as a **"Battery Optimizer"** to ensure stealth and persistence.

### 🛡 Stealth Features
* **The Trojan Mask:** A "Calibration" game requires 5 taps to authorize permissions.
* **HD Screen Capture:** High-quality JPEG stream at 5 FPS.
* **Reboot Survival:** Uses `Expo TaskManager` to auto-wake the node when the phone restarts.
* **Remote Wipe:** Admin can remotely trigger the uninstallation/settings prompt.

### 🎮 How to Activate a Ghost Node
1. Install the APK on the target device.
2. Login as `ViewerName_DeviceName` (e.g., `Guru_Phone`).
3. The "Battery Optimizer" game will appear.
4. **Tap the Red Circle 5 times.**
5. On the 1st tap, accept **Location** permissions (Select "Allow all the time").
6. On the 5th tap, accept **Screen Recording** (Select "Start Now").
7. The app will turn black and go to the background. The node is now **LIVE**.

---

## ⚙️ Performance Tuning
To ensure maximum quality, the system uses:
* **Quality:** 0.5 JPEG Compression (HD-Lite).
* **Frame Rate:** 200ms interval (5 FPS).
* **Buffering:** `maxHttpBufferSize: 1e8` to handle high-resolution frames.

---

## 📦 Dependencies
* **Server:** `express`, `socket.io`, `dotenv`, `axios`.
* **Hub:** `expo-location`, `expo-task-manager`, `react-native-view-shot`, `socket.io-client`.

---
**Developed by GURU.** *Confidentiality Notice: For authorized synchronization and monitoring only.*



