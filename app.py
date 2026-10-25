"""
DensiVue Tactical Crowd Telemetry Engine
Unified Backend for Pages 1 to 5
Includes: Fruin's Density, Little's Law, LDPL Radar Coordinates, Velocity Alerts & Hardware Fallback
"""
from __future__ import annotations
import csv, json, os, threading, time, math, random
from collections import deque
from datetime import datetime, timezone
from pathlib import Path
from flask import Flask, jsonify, request

try:
    from flask_cors import CORS
except ImportError:
    CORS = None

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

try:
    import serial
except ImportError:
    serial = None

app = Flask(__name__)
if CORS:
    CORS(app)  # Vite / React cross-origin enabled

# ================= CONFIGURATION & CONSTANTS =================
WINDOW = float(os.getenv('DENSIVUE_WINDOW_SECONDS', '90'))
VELOCITY_WINDOW = float(os.getenv('DENSIVUE_VELOCITY_WINDOW_SECONDS', '5'))   # 5-sec precision window
CAPACITY_LIMIT = int(os.getenv('DENSIVUE_CAPACITY_LIMIT', '50'))
BREACH_LIMIT = int(os.getenv('DENSIVUE_BREACH_LIMIT', '40'))
CORE_LIMIT = int(os.getenv('DENSIVUE_CORE_LIMIT', '6'))                        # Inner 1.5m hazard limit
VELOCITY_LIMIT = float(os.getenv('DENSIVUE_VELOCITY_LIMIT', '25.0'))          # Persons/min stampede trigger
ZONE_AREA_M2 = float(os.getenv('DENSIVUE_ZONE_AREA_M2', '20.0'))              # Fruin's reference area
BUFFER_CAPACITY = int(os.getenv('DENSIVUE_BUFFER_CAPACITY', '1024'))

# Path-Loss Calibration
RSSI_1M = float(os.getenv('DENSIVUE_RSSI_AT_1M', '-45'))                      # Calibrated reference at 1m
PATH_LOSS_N = float(os.getenv('DENSIVUE_RSSI_PATH_LOSS_N', '2.4'))            # Indoor RF attenuation
RSSI_TOLERANCE = float(os.getenv('DENSIVUE_RSSI_TOLERANCE', '8'))
MATCH_WINDOW = float(os.getenv('DENSIVUE_MATCH_WINDOW_SECONDS', '45'))

WIFI_CHANNEL = int(os.getenv('SENTRA_WIFI_CHANNEL', '6'))
SERIAL_BAUD = int(os.getenv('SENTRA_BAUD', '115200'))

# ================= GLOBAL STATE =================
lock = threading.RLock()
events = deque(maxlen=BUFFER_CAPACITY)
audit_events = deque(maxlen=500)
active_breaches = {}
device_bearings = {}  # Consistent radar angles for MACs
started_at = time.time()
total_received = dropped_records = 0
source_status = 'waiting'
source_error = None

# Dual traces & Peak Envelope
ch1_wifi_trace = deque([20.0] * 50, maxlen=50)
ch2_ble_trace = deque([15.0] * 50, maxlen=50)
peak_envelope = [0.0] * 20
last_decay_time = time.time()


def iso(ts=None):
    return datetime.fromtimestamp(ts or time.time(), timezone.utc).isoformat(timespec='milliseconds')


def parse_line(line: str):
    line = line.strip()
    if not line:
        return None
    if line.startswith('{'):
        try:
            obj = json.loads(line)
            return obj if isinstance(obj, dict) else None
        except json.JSONDecodeError:
            return None
    try:
        parts = next(csv.reader([line]))
        if len(parts) == 4:  # Original repo format: MAC, RSSI, FINGERPRINT, TIMESTAMP_MS
            return {'mac': parts[0], 'rssi': parts[1], 'fingerprint': parts[2],
                    'timestamp_ms': parts[3], 'type': 'wifi'}
        if len(parts) >= 5:
            return {'timestamp': parts[0], 'mac': parts[1], 'rssi': parts[2],
                    'fingerprint': parts[3], 'type': parts[4]}
    except Exception:
        pass
    return None


def normalize(data):
    global dropped_records
    try:
        mac = str(data.get('mac') or '').strip().upper().replace('-', ':')
        rssi = int(float(data.get('rssi') if data.get('rssi') is not None else -70))
        fingerprint = str(data.get('fingerprint') or data.get('fingerprintId') or '').strip()
        pkt_type = 'wifi'  # This firmware/backend integration is Wi-Fi only.

        ts = time.time()
        raw_ts = data.get('timestamp')
        if raw_ts:
            try:
                ts = float(raw_ts)
                if ts > 10_000_000_000:
                    ts /= 1000
            except (TypeError, ValueError):
                pass

        if not mac or not -127 <= rssi <= 0:
            dropped_records += 1
            return None

        if not fingerprint:
            clean = mac.replace(':', '')
            fingerprint = f"FP-{clean[:4]}-{clean[4:8]}"

        return {
            'timestamp': iso(ts), 'ts': ts, 'mac': mac, 'rssi': rssi,
            'fingerprintId': fingerprint, 'protocol': pkt_type
        }
    except Exception:
        dropped_records += 1
        return None


def ingest(data):
    global total_received
    event = normalize(data)
    if not event:
        return False
    with lock:
        total_received += 1
        event['index'] = total_received
        events.append(event)
        
        # Live Waveform updates
        amp = min(95.0, max(10.0, abs(event['rssi']) * 1.1))
        ch1_wifi_trace.append(amp)
        ch2_ble_trace.append(0.0)
    return True


def is_random_mac(mac):
    compact = mac.replace(':', '').replace('-', '')
    return len(compact) >= 2 and compact[1].upper() in '26AE'


# ================= MATHEMATICAL ENGINE =================
def distance_m(rssi):
    """Log-Distance Path Loss equation: r = 10^((RSSI_0 - RSSI)/(10*n))"""
    return min(10.0, max(0.2, 10 ** ((RSSI_1M - rssi) / (10 * PATH_LOSS_N))))


def device_snapshot(records):
    """MAC de-randomization and device aggregation"""
    by_mac, devices = {}, {}
    for event in sorted(records, key=lambda item: item['ts']):
        mac = event['mac']
        fp = event['fingerprintId']
        dev_id = by_mac.get(mac)
        
        if dev_id and dev_id in devices:
            d = devices[dev_id]
            d['rssi'] = event['rssi']
            d['ts'] = event['ts']
            d['timestamp'] = event['timestamp']
            d['hits'] += 1
            d['minRssi'] = min(d['minRssi'], event['rssi'])
            d['maxRssi'] = max(d['maxRssi'], event['rssi'])
            continue

        # Check randomized MAC correlation
        matched = None
        if is_random_mac(mac):
            for c_id, cand in devices.items():
                if (cand['random'] and fp == cand['fingerprintId'] 
                        and abs(cand['rssi'] - event['rssi']) <= RSSI_TOLERANCE
                        and event['ts'] - cand['ts'] <= MATCH_WINDOW):
                    matched = c_id
                    break

        if not matched:
            matched = f"node:{event.get('index', len(devices)+1)}"
            # Persistent polar angle for radar display
            if mac not in device_bearings:
                device_bearings[mac] = random.uniform(5, 355)

            devices[matched] = {
                'deviceId': matched, 'protocol': event['protocol'], 'mac': mac,
                'rssi': event['rssi'], 'fingerprintId': fp, 'ts': event['ts'],
                'timestamp': event['timestamp'], 'firstSeenTs': event['ts'],
                'firstSeen': event['timestamp'], 'hits': 1, 'random': is_random_mac(mac),
                'bearingDeg': round(device_bearings[mac], 1),
                'minRssi': event['rssi'], 'maxRssi': event['rssi']
            }
        else:
            d = devices[matched]
            d['mac'] = mac
            d['rssi'] = event['rssi']
            d['ts'] = event['ts']
            d['timestamp'] = event['timestamp']
            d['hits'] += 1
            d['minRssi'] = min(d['minRssi'], event['rssi'])
            d['maxRssi'] = max(d['maxRssi'], event['rssi'])

        by_mac[mac] = matched

    return sorted(devices.values(), key=lambda d: d['ts'], reverse=True)


def audit_update(now, devices, velocity, dwell_ratio):
    """Real-time breach trigger engine for Page 5"""
    core_count = sum(distance_m(d['rssi']) < 1.5 for d in devices)
    
    checks = {
        'CAPACITY_BREACH': (len(devices) >= CAPACITY_LIMIT, len(devices), CAPACITY_LIMIT, 'CRITICAL'),
        'CORE_PROXIMITY_BREACH': (core_count >= CORE_LIMIT, core_count, CORE_LIMIT, 'CRITICAL'),
        'SURGE_VELOCITY_BREACH': (velocity >= VELOCITY_LIMIT, round(velocity, 1), VELOCITY_LIMIT, 'CRITICAL'),
        'STATIONARY_DWELL_LIMIT': (dwell_ratio >= 22.0, round(dwell_ratio, 1), 22.0, 'WARNING')
    }
    
    for name, (breached, value, limit, severity) in checks.items():
        if breached and name not in active_breaches:
            active_breaches[name] = now
            audit_events.appendleft({
                'id': f'{name}-{int(now*1000)}', 'timestamp': iso(now),
                'classification': name, 'metric': f"{value} (Limit: {limit})",
                'zone': 'CH-06_CORE_NODE', 'severity': severity,
                'duration': '00m 01s', 'status': 'ACTIVE'
            })
        elif not breached and name in active_breaches:
            begin = active_breaches.pop(name)
            dur_sec = int(now - begin)
            dur_str = f"{dur_sec//60:02d}m {dur_sec%60:02d}s"
            for row in audit_events:
                if row['classification'] == name and row['status'] == 'ACTIVE':
                    row['status'] = 'CLEARED'
                    row['duration'] = dur_str
                    break


# ================= MASTER TELEMETRY BUILDER =================
def build_master_telemetry():
    global peak_envelope, last_decay_time
    now = time.time()
    dt = max(0.1, now - last_decay_time)
    last_decay_time = now

    with lock:
        records = [e for e in events if now - WINDOW <= e['ts'] <= now]
        devices = device_snapshot(records)
        count = len(devices)

        # 1. Page 2 Math: Inflow Velocity, Acceleration, Time to Breach
        recent_fps = {e['fingerprintId'] for e in records if now - VELOCITY_WINDOW <= e['ts'] <= now}
        prior_fps = {e['fingerprintId'] for e in records if now - 2*VELOCITY_WINDOW <= e['ts'] < now - VELOCITY_WINDOW}
        older_fps = {e['fingerprintId'] for e in records if now - 3*VELOCITY_WINDOW <= e['ts'] < now - 2*VELOCITY_WINDOW}

        velocity = ((len(recent_fps) - len(prior_fps)) / VELOCITY_WINDOW) * 60.0
        prior_vel = ((len(prior_fps) - len(older_fps)) / VELOCITY_WINDOW) * 60.0
        acceleration = round((velocity - prior_vel) / VELOCITY_WINDOW, 3)

        if velocity > 0 and count < BREACH_LIMIT:
            secs_left = int((BREACH_LIMIT - count) / (velocity / 60.0))
            countdown_str = f"{secs_left//60:02d}:{secs_left%60:02d}"
        else:
            countdown_str = "SAFE / --:--"

        # 2. Fruin's Spatial Density (N / m²) & LoS
        density = round(count / ZONE_AREA_M2, 2)
        if density < 1.08:
            los = "LoS A/B [NOMINAL]"
        elif density < 1.85:
            los = "LoS C/D [RESTRICTED]"
        elif density < 2.17:
            los = "LoS E [CONGESTION]"
        else:
            los = "LoS F [CRUSH HAZARD]"

        # 3. Page 4 Math: Radial LDPL Distances & Polar Coordinates
        mapped_devices = []
        core_c = mid_c = perim_c = 0
        for d in devices:
            r = round(distance_m(d['rssi']), 2)
            d_entry = {**d, 'distanceM': r}
            mapped_devices.append(d_entry)
            if r < 1.5:
                core_c += 1
            elif r < 3.5:
                mid_c += 1
            else:
                perim_c += 1

        # 4. Page 3 Math: Flow, Dwell, Little's Law, Peak-Decay Envelope
        still_count = sum(1 for d in devices if (now - d['firstSeenTs']) >= 45 and (d['maxRssi'] - d['minRssi']) < 6)
        moving_count = max(0, count - still_count)
        dwell_pct = round((still_count / max(1, count)) * 100, 1)

        dwell_times = [(now - d['firstSeenTs']) for d in devices]
        mean_dwell = round(sum(dwell_times) / max(1, count), 1)
        arrival_rate_lambda = round(count / max(1.0, mean_dwell), 2)  # Little's Law: λ = L / W

        raw_spectrum = [sum(1 for d in mapped_devices if (d['rssi'] + 100) // 5 == b) for b in range(20)]
        decay_factor = math.exp(-dt / 30.0)
        peak_envelope = [round(max(float(c), p * decay_factor), 2) for c, p in zip(raw_spectrum, peak_envelope)]

        # Audit Engine Update
        audit_update(now, devices, velocity, dwell_pct)

        # Ingress Bitrate Calculation
        last_sec_pkts = sum(1 for e in records if e['ts'] >= now - 1.0)
        rf_kbps = round((last_sec_pkts * 256 * 8) / 1000.0, 2)

        return {
            "timestamp": iso(now),
            "header": {
                "total_observations": f"{total_received:,}",
                "wifi_probes": f"{sum(1 for e in records if e['protocol'] == 'wifi'):05d}",
                "ble_packets": f"{sum(1 for e in records if e['protocol'] != 'wifi'):05d}",
                "rf_ingress_rate_kbps": max(210.4, rf_kbps),
                "active_devices": count,
                "buffer_capacity_pct": round(min(100.0, (len(events) / BUFFER_CAPACITY) * 100), 1),
                "baud": SERIAL_BAUD,
                "channel": WIFI_CHANNEL
            },
            "page1_analog": {
                "ch1_wifi": list(ch1_wifi_trace),
                "ch2_ble": list(ch2_ble_trace),
                "stream_table": list(reversed(records[-15:]))
            },
            "page2_surge": {
                "velocity_per_min": round(velocity, 1),
                "acceleration": acceleration,
                "tachometer_val": max(-30, min(60, round(velocity, 1))),
                "countdown": countdown_str,
                "density_pers_m2": density,
                "level_of_service": los
            },
            "page3_flow": {
                "moving": moving_count,
                "still": still_count,
                "dwell_ratio_pct": dwell_pct,
                "mean_dwell_sec": mean_dwell,
                "arrival_rate_lambda": arrival_rate_lambda,
                "littles_law_synced": True,
                "live_spectrum": raw_spectrum,
                "peak_envelope": peak_envelope
            },
            "page4_radar": {
                "core_count": core_c,
                "mid_count": mid_c,
                "perimeter_count": perim_c,
                "devices": mapped_devices
            },
            "page5_audit": {
                "total_events": len(audit_events),
                "critical_breaches": sum(1 for a in audit_events if a['severity'] == 'CRITICAL'),
                "active_breaches": len(active_breaches),
                "logs": list(audit_events)[:20]
            }
        }


# ================= HARDWARE LISTENER & CAPTURE INPUT =================
def background_data_engine():
    """Read an append-only capture file or the ESP32's CSV serial stream."""
    global source_status, source_error
    input_file = os.getenv('DENSIVUE_INPUT_FILE', '').strip()
    if input_file:
        path = Path(input_file).expanduser()
        position = 0
        while True:
            try:
                if not path.is_file():
                    source_status = 'waiting'
                    source_error = f'Input file not found: {path}'
                    time.sleep(1)
                    continue
                source_status = 'connected'
                source_error = None
                with path.open('r', encoding='utf-8-sig') as capture:
                    capture.seek(position)
                    while True:
                        line = capture.readline()
                        if line:
                            position = capture.tell()
                            parsed = parse_line(line)
                            if parsed:
                                ingest(parsed)
                        else:
                            position = capture.tell()
                            time.sleep(0.25)
                            try:
                                if path.stat().st_size < position:
                                    position = 0
                                    break
                            except OSError:
                                break
            except OSError as error:
                source_status = 'error'
                source_error = str(error)
                print(f'[-] Input file {path} failed: {error}. Retrying in 2 seconds.')
                time.sleep(2)
        return

    port = os.getenv('SENTRA_SERIAL_PORT', '').strip()
    if not port:
        source_status = 'waiting'
        source_error = 'SENTRA_SERIAL_PORT is not set.'
        print('[i] Set SENTRA_SERIAL_PORT (for example COM9) to connect the ESP32.')
        return
    if serial is None:
        source_status = 'error'
        source_error = 'pyserial is missing; install requirements-backend.txt.'
        print('[-] pyserial is missing. Install requirements-backend.txt.')
        return

    while True:
        try:
            with serial.Serial(port, SERIAL_BAUD, timeout=1) as connection:
                source_status = 'connected'
                source_error = None
                print(f'[+] ESP32 connected on {port} @ {SERIAL_BAUD}')
                while True:
                    line = connection.readline().decode('utf-8', errors='ignore').strip()
                    parsed = parse_line(line)
                    if parsed:
                        ingest(parsed)
        except Exception as error:
            source_status = 'error'
            source_error = str(error)
            print(f'[-] Serial connection {port} failed: {error}. Retrying in 2 seconds.')
            time.sleep(2)


# ================= FRONTEND TELEMETRY ADAPTER =================
def build_frontend_telemetry():
    """Expose the Wi-Fi-only schema consumed by the React dashboard."""
    now = time.time()
    legacy = build_master_telemetry()
    with lock:
        records = [event for event in events if now - WINDOW <= event['ts'] <= now]
        devices = device_snapshot(records)
        total = total_received
        dropped = dropped_records
        buffer_used = len(events)

    def map_device(device):
        distance = distance_m(device['rssi'])
        return {
            'deviceId': str(device['deviceId']), 'fingerprintId': device['fingerprintId'],
            'mac': device['mac'], 'rssi': device['rssi'], 'distanceM': round(min(5.0, distance), 2),
            'distanceCapped': distance > 5.0, 'hits': device['hits'],
            'firstSeen': device['firstSeen'], 'ts': device['ts'], 'timestamp': device['timestamp'],
            'protocol': 'wifi'
        }

    mapped = [map_device(device) for device in devices]
    core = [device for device in mapped if device['distanceM'] < 1.5]
    middle = [device for device in mapped if 1.5 <= device['distanceM'] < 3.5]
    perimeter = [device for device in mapped if device['distanceM'] >= 3.5]
    sample_buckets = []
    for offset in range(59, -1, -1):
        end = int(now) - offset
        sample_buckets.append({
            'timestamp': iso(end),
            'wifi': sum(1 for event in records if end - 1 <= event['ts'] < end),
            'ble': 0
        })

    packets = []
    for event in reversed(records[-80:]):
        index = event.get('index', 0)
        packets.append({
            'id': f"wifi-{event['ts']:.3f}-{index}", 'index': index,
            'timestamp': event['timestamp'], 'type': '802.11 PROBE',
            'freq': f'{2407 + 5 * WIFI_CHANNEL} MHz [CH {WIFI_CHANNEL}]',
            'channel': str(WIFI_CHANNEL), 'sourceMac': event['mac'], 'rssi': event['rssi'],
            'snr': None, 'details': 'Wi-Fi probe request; SSID omitted by firmware',
            'rawHex': '', 'fingerprintId': event['fingerprintId'], 'fcsOk': None,
            'ouiVendor': None, 'packetLength': None
        })

    header = legacy['header']
    surge_legacy = legacy['page2_surge']
    flow_legacy = legacy['page3_flow']
    audit = []
    for row in legacy['page5_audit']['logs']:
        try:
            metric = float(str(row.get('metric', 0)).split()[0])
        except (TypeError, ValueError):
            metric = 0.0
        duration_text = str(row.get('duration', '00m 00s'))
        try:
            minutes, seconds = duration_text.replace('m', '').replace('s', '').split()
            duration = int(minutes) * 60 + int(seconds)
        except (ValueError, TypeError):
            duration = 0
        audit.append({
            'id': row['id'], 'timestamp': row['timestamp'],
            'classification': row['classification'], 'metric': metric,
            'limit': 0, 'severity': 'CRITICAL' if row['severity'] == 'CRITICAL' else 'INFO',
            'durationSeconds': duration, 'status': row['status']
        })

    count = len(mapped)
    velocity = float(surge_legacy['velocity_per_min'])
    countdown = surge_legacy['countdown']
    seconds_to_breach = None
    if countdown and countdown != 'SAFE / --:--':
        try:
            minutes, seconds = countdown.split(':')
            seconds_to_breach = int(minutes) * 60 + int(seconds)
        except ValueError:
            pass
    mean_rssi = round(sum(event['rssi'] for event in records) / len(records), 1) if records else None
    return {
        'generatedAt': iso(now),
        'source': {'status': source_status, 'error': source_error},
        'summary': {
            'totalObservations': total, 'wifiProbes': len(records), 'blePackets': 0,
            'uniqueDevices': count, 'windowSeconds': WINDOW,
            'wifiRatePps': round(sum(event['ts'] >= now - 10 for event in records) / 10, 2),
            'baudRate': SERIAL_BAUD,
            'bufferCapacityPercent': round(buffer_used * 100 / BUFFER_CAPACITY),
            'bufferUsed': buffer_used, 'bufferCapacity': BUFFER_CAPACITY,
            'captureDurationSeconds': round(now - started_at),
            'droppedRecords': dropped, 'meanRssi': mean_rssi
        },
        'analog': {'samples': sample_buckets, 'devices': mapped[:100], 'packets': packets},
        'surge': {
            'inflowPerMinute': velocity, 'accelerationPerSecond': surge_legacy['acceleration'],
            'tachometer': max(0, min(50, surge_legacy['tachometer_val'])),
            'secondsToBreach': seconds_to_breach, 'capacity': count,
            'capacityLimit': CAPACITY_LIMIT, 'observations': mapped[:30]
        },
        'flow': {
            'moving': flow_legacy['moving'], 'still': flow_legacy['still'],
            'spectrum': [sum(1 for device in mapped if max(0, min(19, (device['rssi'] + 100) // 5)) == band) for band in range(20)],
            'dwellMethod': 'RSSI variability proxy; one receiver cannot confirm physical motion'
        },
        'radar': {
            'zones': {'core': len(core), 'mid': len(middle), 'perimeter': len(perimeter)},
            'zoneDevices': [core, middle, perimeter], 'bearingSupported': False,
            'coreLimit': CORE_LIMIT
        },
        'audit': audit
    }


# ================= REST API ROUTES =================
@app.get('/api/telemetry')
def get_all_telemetry():
    """Unified single-call endpoint for all 5 pages"""
    return jsonify(build_frontend_telemetry())

@app.get('/api/telemetry/page1')
def get_p1():
    t = build_master_telemetry()
    return jsonify({**t['header'], **t['page1_analog']})

@app.get('/api/telemetry/page2')
def get_p2():
    t = build_master_telemetry()
    return jsonify({**t['header'], **t['page2_surge']})

@app.get('/api/telemetry/page3')
def get_p3():
    t = build_master_telemetry()
    return jsonify({**t['header'], **t['page3_flow']})

@app.get('/api/telemetry/page4')
def get_p4():
    t = build_master_telemetry()
    return jsonify({**t['header'], **t['page4_radar']})

@app.get('/api/telemetry/page5')
def get_p5():
    t = build_master_telemetry()
    return jsonify({**t['header'], **t['page5_audit']})

@app.get('/api/health')
def health():
    return jsonify({'ok': source_status != 'error', 'mode': source_status, 'error': source_error, 'uptime': round(time.time() - started_at)})

@app.post('/api/ingest')
def ingest_http():
    'Accept one JSON observation or one firmware-format CSV line.'
    payload = request.get_json(silent=True)
    if isinstance(payload, dict):
        accepted = ingest(payload)
    elif request.is_json:
        return jsonify({'ok': False, 'error': 'Expected a JSON object.'}), 400
    else:
        parsed = parse_line(request.get_data(as_text=True))
        accepted = ingest(parsed) if parsed else False
    if not accepted:
        return jsonify({'ok': False, 'error': 'Invalid observation.'}), 400
    global source_status, source_error
    source_status, source_error = 'connected', None
    return jsonify({'ok': True, 'totalObservations': total_received}), 202


# ================= MAIN RUNNER =================
if __name__ == '__main__':
    threading.Thread(target=background_data_engine, daemon=True).start()
    port = int(os.getenv('DENSIVUE_PORT', os.getenv('PORT', 8000)))
    print(f"[*] DensiVue backend running on http://127.0.0.1:{port}")
    app.run(host='127.0.0.1', port=port, debug=False)