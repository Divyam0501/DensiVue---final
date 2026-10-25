---
version: alpha
name: DensiVue
description: Wi-Fi crowd telemetry dashboard styled as a retro Tektronix CRT monitoring instrument.
colors:
  primary: "#f07816"
  primary-highlight: "#ffb68a"
  phosphor: "#39ff14"
  background: "#111410"
  surface-lowest: "#0c0f0b"
  surface-high: "#282b26"
  text: "#e1e3dc"
  error: "#ffb4ab"
typography:
  sans:
    fontFamily: "Space Grotesk, sans-serif"
  mono:
    fontFamily: "JetBrains Mono, monospace"
rounded:
  DEFAULT: "0.25rem"
  sm: "0.125rem"
  md: "0.25rem"
  lg: "0.375rem"
spacing:
  space-xs: "0.125rem"
  space-sm: "0.25rem"
  space-md: "0.5rem"
  space-lg: "1rem"
  space-xl: "1.5rem"
  margin-desktop: "1.5rem"
components:
  app-shell: { backgroundColor: "colors.background" }
  telemetry-card: { backgroundColor: "colors.surface-lowest", textColor: "colors.text", rounded: "rounded.sm" }
  data-table: { backgroundColor: "colors.surface-high", textColor: "colors.text", typography: "typography.mono" }
  chart: { textColor: "colors.phosphor" }
  warning-control: { backgroundColor: "colors.primary", textColor: "colors.primary-highlight" }
  error-state: { textColor: "colors.error" }
---

# DensiVue Design System

## Overview

### Creative North Star

The interface reads as a dense RF instrument: dark powder-coated chassis, burnt-orange controls, phosphor-green measurements, thin reticles, and compact monospaced readouts. Keep the established DensiVue CRT design while making every live reading traceable to Wi-Fi probe data.

### Product context and register

- **Audience and primary job:** Operators monitoring approximate crowd presence and threshold changes from an ESP32 Wi-Fi probe sniffer.
- **Target market(s) and evidence:** General venue monitoring; no market-specific localization contract is present.
- **Locale(s) and language policy:** English interface; timestamps from the backend are UTC.
- **Usage scene:** Desktop dashboard, continuous monitoring, high information density.
- **Register:** Product instrument UI.
- **Memorable signature:** Green phosphor trace over a dark oscilloscope field, framed by amber hardware controls.
- **Restraint:** Preserve familiar tables, direct status language, and clear connection/error states.
- **Anti-references:** Generic SaaS cards, simulated precision, and camera-style person tracking; the sensor supplies MAC/RSSI/fingerprint/time only.
- **Token ownership/runtime mapping:** `src/index.css` is the runtime token source. This document records the existing palette and typography; no new theme tokens are introduced by telemetry wiring.

## Colors

Use `background` and `surface-lowest` for instrument cavities, `surface-high` for dividers and elevated panels, orange for controls and warning states, and phosphor green for active Wi-Fi readings. Reserve `error` for actual faults or threshold breaches. A missing sensor must be identified with text, not color alone.

## Typography

Use Space Grotesk for readable interface copy and JetBrains Mono for timestamps, measurements, packet identifiers, and compact instrument labels. Use tabular numerals for changing counters. Keep data labels short and preserve full values in tables or inspection surfaces.

## Layout

Keep the dense, full-width desktop instrument layout and existing responsive grid. Give telemetry panels stable dimensions as values update. Tables scroll inside their own region when needed; keep status and primary controls reachable at narrow widths.

## Elevation & Depth

Use tonal layers, thin borders, and restrained inset or glow effects to suggest physical instrument wells. Keep glow on traces and active indicators; do not use it as the only status signal.

## Shapes

Use compact, mostly squared panels with small corner radii. Reticles and table dividers stay thin and precise. Keep interactive controls larger than decorative labels and expose keyboard focus visibly.

## Components

### Foundational visual states

Show connecting, live, stale, offline, waiting-for-sensor, and source-error states distinctly. Retain the last good readings with a stale indication after a refresh failure. Use explicit empty states when no probes or breach events exist.

### Buttons and actions

Preserve the existing compact instrument-button style. Disabled controls explain unavailable input; monitoring-only UI must not imply that a response team was dispatched.

### Navigation and data display

Keep the five existing views and shared header/footer. Use green for captured Wi-Fi data, amber for warning/hold envelopes, and text labels for all zone/count metrics. RSSI-derived distance and flow classifications are estimates.

### Forms and overlays

Keep existing filter and inspection surfaces. Do not fabricate raw packet bytes, SSID, FCS, SNR, or bearing when the firmware stream does not provide them.

### Iconography

Use the existing Material Symbols and Lucide icon sets; pair non-obvious icons with text labels.

### Motion

Use the current CRT sweep and radar sweep as instrument context. Respect reduced motion and avoid random value motion; live trace changes must follow received telemetry.

### Content and data visualization

Label Wi-Fi probe counts and RSSI clearly. Use UTC for event times. Treat fingerprint matching as heuristic device estimation, RSSI distance as site-calibrated approximation, and bearing as unavailable from a single receiver.

## Do's and Don'ts

- **Do:** Keep the oscilloscope palette, compact density, and precise technical labels.
- **Do:** Show connection, freshness, and empty states without replacing the instrument layout.
- **Don't:** Present synthetic values as live sensor readings.
- **Don't:** imply true device identity, physical motion, raw frame capture, or direction from fields the ESP32 does not transmit.
