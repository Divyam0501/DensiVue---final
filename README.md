# DensiVue + SENTRA

DensiVue is a React/Vite dashboard connected to SENTRA’s ESP32 Wi-Fi probe listener. The included `app.py` is the unified backend for all five dashboard views. The original SENTRA source remains in `sentra/`. The browser UI does not need a Gemini API key.

## Requirements

- Node.js 20.19+ (or 22.12+) and npm
- Python 3.10+
- For live sensor readings: an ESP32 supported by the Arduino ESP32 core and a USB data cable

## Start locally on Windows

Open PowerShell in the project folder. Use two terminals: one for the Python API and one for the dashboard.

### Terminal 1: backend

```powershell
py -3 -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements-backend.txt
$env:SENTRA_SERIAL_PORT = "COM9"  # replace COM9 with the ESP32 port shown in Device Manager
python app.py
```

If PowerShell blocks activation, run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` in that terminal, then activate again. Keep this terminal open. The API should report `DensiVue backend running on http://127.0.0.1:8000`.

### Terminal 2: dashboard

```powershell
npm install
npm run dev
```

Open the local URL Vite prints (normally `http://localhost:3000`). Vite proxies `/api` requests to the backend on port 8000. Keep both terminals open.

## Connect the ESP32

1. Install Arduino IDE and the Espressif ESP32 board package.
2. Open `sentra/firmware/wifi_listener/wifi_listener.ino`, choose your ESP32 board and serial port, and upload the firmware. It listens on Wi-Fi channel 6 and writes `MAC,RSSI,FINGERPRINT,TIMESTAMP_MS` at 115200 baud.
3. Find the port in Windows Device Manager under **Ports (COM & LPT)**. Close Arduino Serial Monitor; only one program can own the port.
4. Set `$env:SENTRA_SERIAL_PORT` to that port in the backend terminal, then run `python app.py`.
5. Check `http://127.0.0.1:8000/api/health` for the backend status and `http://127.0.0.1:8000/api/telemetry` for the dashboard data.

## Run without hardware

The dashboard does not invent readings. Without an ESP32, it will show a waiting state and zero live observations. To replay or follow a capture, set `DENSIVUE_INPUT_FILE` to a CSV or JSONL file whose records use the SENTRA format (`MAC,RSSI,FINGERPRINT,TIMESTAMP_MS`) or JSON objects with `mac`, `rssi`, and `fingerprint` fields. The backend reads existing lines and follows appended lines. For example:

```powershell
$env:DENSIVUE_INPUT_FILE = "C:\captures\sentra.csv"
python app.py
```

Do not set `DENSIVUE_INPUT_FILE` and `SENTRA_SERIAL_PORT` together; the input file takes precedence. The API also accepts a single JSON observation or SENTRA CSV line at `POST /api/ingest`.

## Why it may look like it is not running

- **The API terminal exits with a missing-module error:** activate `.venv` and install `requirements-backend.txt` there.
- **The dashboard shows “offline”:** start `python app.py` first and confirm `/api/health` responds.
- **The dashboard loads but says “waiting for ESP32”:** the API is up, but the serial port is unset/wrong, the ESP32 is disconnected, or Arduino Serial Monitor still owns the port.
- **The dashboard is blank or Vite fails to start:** run `npm install`, check that Node meets the version requirement, and use the URL printed by `npm run dev`.
- **Port already in use:** close the other process using 3000 or 8000, or set `DENSIVUE_PORT` to another backend port and update the Vite proxy in `vite.config.ts` to match.

The original standalone backend at `sentra/backend/main.py` is separate; do not run it alongside `app.py` because both may claim the serial port.

## Measurement limits

SENTRA observes Wi-Fi probe requests only. Device counts are fingerprint-based estimates; fingerprints can collide and do not establish identity. RSSI distance, flow/dwell, and capacity alerts need venue calibration. One receiver cannot measure direction or bearing. The firmware omits SSIDs and raw frame bytes. Keep this local service off untrusted networks.
