# DensiVue UX Contract

## Data source and ownership

- `app.py` is the local source of truth for captured Wi-Fi probe observations and derived aggregates.
- React polls `/api/telemetry` centrally through `src/hooks/useDensiVueTelemetry.ts`; views consume one shared response.
- The GitHub ESP32 record is `MAC,RSSI,FINGERPRINT,TIMESTAMP_MS`. The firmware supplies Wi-Fi probe observations only.
- No frontend mock values are used as fallback data. Empty input produces zero readings and a waiting/empty state.

## Async and recovery behavior

- Poll once immediately, then every second; use bounded backoff after request failures.
- Keep last successful readings visible as stale when refresh fails. Offer a retry control for API connectivity failure.
- Distinguish API connectivity from sensor connection: an available API can report that the ESP32 is still waiting.
- Do not announce each background counter update. Persistent source errors remain visible in the instrument status.

## Cross-view data contract

- Analog trace consumes recent one-second Wi-Fi buckets, actual probe records, and summary counters.
- Surge consumes windowed fingerprint count, count delta, acceleration estimate, capacity, and recent device observations.
- Flow/dwell consumes RSSI histogram and an RSSI-variability proxy; it does not claim confirmed physical motion.
- Spatial radar consumes RSSI-derived distance zones. A single receiver cannot measure bearing; any angular spread is layout-only.
- Audit lists only backend-generated threshold events; no sample incidents are seeded.

## Privacy and measurement limits

- The API is intended for local use. Device MACs and fingerprints are present in packet/device rows; do not expose the unauthenticated local server to an untrusted network.
- RSSI distance requires site calibration. Fingerprints can collide and are not verified identities.
- The firmware omits raw frame bytes, SSID, SNR, FCS, and bearing; the UI must not claim those readings.
- Flow/dwell labels are heuristic, and capacity/time-to-breach depend on configured site thresholds.
