---
name: Cathode Precision Systems
colors:
  surface: '#111410'
  surface-dim: '#111410'
  surface-bright: '#373a35'
  surface-container-lowest: '#0c0f0b'
  surface-container-low: '#191c18'
  surface-container: '#1d201c'
  surface-container-high: '#282b26'
  surface-container-highest: '#333631'
  on-surface: '#e1e3dc'
  on-surface-variant: '#dec1b1'
  inverse-surface: '#e1e3dc'
  inverse-on-surface: '#2e312d'
  outline: '#a68b7d'
  outline-variant: '#574236'
  surface-tint: '#ffb68a'
  primary: '#ffb68a'
  on-primary: '#522300'
  primary-container: '#f07816'
  on-primary-container: '#532400'
  inverse-primary: '#984700'
  secondary: '#d7ffc5'
  on-secondary: '#053900'
  secondary-container: '#2ff801'
  on-secondary-container: '#0f6d00'
  tertiary: '#f0baae'
  on-tertiary: '#492720'
  tertiary-container: '#bf8e83'
  on-tertiary-container: '#4b2821'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffdbc8'
  primary-fixed-dim: '#ffb68a'
  on-primary-fixed: '#321300'
  on-primary-fixed-variant: '#743500'
  secondary-fixed: '#79ff5b'
  secondary-fixed-dim: '#2ae500'
  on-secondary-fixed: '#022100'
  on-secondary-fixed-variant: '#095300'
  tertiary-fixed: '#ffdad3'
  tertiary-fixed-dim: '#f0baae'
  on-tertiary-fixed: '#30130d'
  on-tertiary-fixed-variant: '#633d35'
  background: '#111410'
  on-background: '#e1e3dc'
  surface-variant: '#333631'
typography:
  display-lg:
    fontFamily: JetBrains Mono
    fontSize: 3rem
    fontWeight: '700'
    lineHeight: 3.25rem
    letterSpacing: -0.05em
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 2rem
    fontWeight: '700'
    lineHeight: 2.25rem
    letterSpacing: -0.03em
  headline-lg-mobile:
    fontFamily: Space Grotesk
    fontSize: 1.5rem
    fontWeight: '700'
    lineHeight: 1.75rem
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 1.25rem
    fontWeight: '600'
    lineHeight: 1.5rem
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Space Grotesk
    fontSize: 1rem
    fontWeight: '400'
    lineHeight: 1.5rem
  body-md:
    fontFamily: Space Grotesk
    fontSize: 0.875rem
    fontWeight: '400'
    lineHeight: 1.25rem
  label-lg:
    fontFamily: JetBrains Mono
    fontSize: 0.875rem
    fontWeight: '600'
    lineHeight: 1.25rem
    letterSpacing: 0.05em
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 0.75rem
    fontWeight: '500'
    lineHeight: 1rem
    letterSpacing: 0.08em
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 0.625rem
    fontWeight: '500'
    lineHeight: 0.875rem
    letterSpacing: 0.1em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 0.5rem
  gutter-md: 1rem
  margin: 1rem
  margin-desktop: 1.5rem
  space-xs: 0.125rem
  space-sm: 0.25rem
  space-md: 0.5rem
  space-lg: 1rem
  space-xl: 1.5rem
---

## Brand & Style

This design system targets laboratory test benches, radio-frequency engineering environments, and precision signal monitoring stations. The aesthetic is purely utilitarian, uncompromising, and machined—drawing direct heritage from rack-mounted cathode-ray oscilloscopes, spectrum analyzers, and avionics instrumentation panels. 

Visual principles:
- **Physical Instrument Fidelity:** Interfaces mimic milled anodized bezels, recessed CRT phosphor screens, rotary detents, and illuminated rocker indicators.
- **Strict Anti-Decorative Discipline:** SaaS conventions such as generic vibrant blue gradients, glassmorphic frosted panels, floating soft pastel cards, and organic rounded pills are explicitly prohibited.
- **High-Density Legibility:** Information hierarchy prioritizes telemetry readability under extreme lighting conditions—from dark RF cleanrooms to brightly illuminated calibration labs. Every line, reticle, and bezel edge serves a physical measurement or demarcation function.

## Colors

The palette operates under an absolute low-reflectance, high-contrast matrix built upon an obsidian chassis.

### Palette Architecture
- **Chassis & Void (Neutrals):** 
  - Absolute Floor: `#000000` (Signal viewport background, CRT screen depth).
  - Recessed Chassis: `#080808` (Bezel housing, backplanes).
  - Surface Panel: `#121212` (Module housings, control surfaces).
  - High Surface / Line: `#222222` (Milled chamfers, mechanical dividing lines).
  - Off-White Technical Readout: `#D8DAD3` (Labels, legends, units, static values).
  - Muted Technical Legend: `#73766D` (Secondary telemetry scales, sub-metrics).

- **Core Illumination (Primary):**
  - Instrument Amber / Burnt Orange: `#F07816` (Primary action toggles, active trigger states, channel selection).
  - Deep Burnt Tone: `#D94A0D` (Engaged state, active alarms, channel markers).
  - Incandescent Warning: `#FFB323` (Caution states, marginal tolerances, reference levels).

- **Cathode Phosphor (Secondary):**
  - Phosphor Neon Green: `#39FF14` (Trace waveform vectors, primary signal telemetry, frequency markers).
  - Damped Trace: `#22C55E` (Secondary waveforms, reference sweep baselines).

- **Reticle & CRT Substrate (Tertiary):**
  - Grid Line Base: `#2A0E08` (CRT graticule lines, internal division tick marks).
  - Major Reticle: `#3B120C` (Orthogonal axis lines, center crosshairs).

### Implementation Rules
Never render gradients across surfaces; all transitions between chassis layers are stepped and hard-edged. Colored emissive elements (`#39FF14`, `#F07816`) exist only as signal traces, active LEDs, or focused numeric readouts.

## Typography

Typography functions as calibration equipment. The pairing splits cleanly between structural instrument identification and precision dynamic telemetry.

- **Structural Typography (`Space Grotesk`):** Used for chassis module titles, channel headers, and system-level mode controls. Features rigid geometry and mechanical junctions.
- **Telemetry & Data Display (`JetBrains Mono`):** Applied to all quantitative readouts, frequency domains, decibel registers, graticule axis indices, and timestamp logs. Monospaced tabular alignment ensures jitter-free rendering during rapid numeric cycling.
- **Casing & Capitalization:** All labels, parameter keys, and system states must be rendered in full uppercase (`text-transform: uppercase`) to preserve the screen-printed metal panel look.

## Layout & Spacing

The layout model is governed by modular physical rack-mount dimensions (analogous to 19-inch sub-racks) with ultra-dense 4px/8px incremental spacing.

### Screen Adaptations & Layout Matrix
- **Desktop / Workstation Monitor (≥1200px):** 16-column fixed-proportion modular grid. Channels 1 through 4 align in persistent side-by-side or stacked quadrant configurations. Viewport margins are fixed at `1.5rem`, with tight internal sub-rack gutters of `0.5rem` to maximize CRT viewport real estate.
- **Tablet / Portable Field Unit (768px - 1199px):** 8-column layout. Waveform scope retains primary viewport (70% screen height); parameter banks collapse into horizontal scroll bands or bottom drawer racks.
- **Mobile Handheld Diagnostic (≤767px):** 4-column layout. Scopes default to single-channel priority with instant toggle keys; numeric telemetry shifts below the CRT viewport in 2-column tabular clusters. Gutters compress to `0.25rem`.

All component interiors prioritize space minimization: padding scales tightly from `space-xs` (2px) on parameter flags to `space-md` (8px) on rack containers.

## Elevation & Depth

Elevation is established via physical chassis depth, milled hardware bezels, and cathode luminescence rather than soft ambient shadows.

### Depth Hierarchy
1. **Recessed Well (Scope Viewports):** `#000000` base with an inset border (`inset 0 0 0 1px #222222`, `inset 0 2px 4px rgba(0,0,0,0.8)`), simulating a screen sunken behind an aluminum bezel.
2. **Chassis Plane (Rack Surface):** Flat `#080808` to `#121212` with crisp, high-contrast separation lines (`1px solid #1A1A1A`).
3. **Milled Controls & Modules:** Flat surface `#161616` framed by a dual-tone border: `1px solid #282828` on top/left, `1px solid #000000` on bottom/right to replicate CNC cut angles.
4. **Active Luminescence (Phosphor & Filament Glow):**
   - Signal Trace Glow: `drop-shadow(0 0 2px rgba(57, 255, 20, 0.8))` and `drop-shadow(0 0 6px rgba(57, 255, 20, 0.3))`.
   - Amber Actuation Indicator: `box-shadow: 0 0 4px #F07816, inset 0 0 2px #FFB323`.

## Shapes

The form language is industrial, sharp, and architectural.

- **Base Radius:** Elements utilize a subtle `0.25rem` (4px) corner radius to denote precision stamped sheet-metal or CNC-milled structural frames.
- **Reticles & Scopes:** Absolute 0px sharp boundary rectangles. Internal grid lines are strictly 1px hairlines without edge anti-aliasing artifacts.
- **Hardware Enclosures:** Chassis cards feature 4px corners with 1px outer borders to maintain crisp, non-organic visual delineation. 
- **Pills and circles** are reserved strictly for circular mechanical knobs, BNC jack indicators, and LED status diodes.

## Components

### Buttons & Actuators
- **Rocker/Push Switches:** Flat background `#121212`, 1px border `#282828`, text formatted in `label-sm` JetBrains Mono off-white. Active state shifts surface to `#1C1C1C` with an illuminated inset amber marker (`#F07816`, 2px bar along the top edge).
- **Hazard / Master Action:** Dark safety red `#2A0E08` with border `#D94A0D`, text `#FFB323`. Active: full `#D94A0D` fill with `#000000` text.

### Inputs & Rotary Steps
- **Numeric Field Input:** Direct-entry boxes with dark background `#000000`, inset border `1px solid #222222`. Active focus switches border to `#F07816`. Text appears in `JetBrains Mono` glowing `#39FF14`.
- **Rotary Parameter Steppers:** Paired vertical button modules `[+]` and `[-]` with machined 1px separation lines, controlling parameter stepping with tactile key repeat.

### Oscilloscope Graticule & Traces
- **Viewport:** Pure `#000000` backdrop overlaid with a 10x8 division reticle.
- **Reticle Grid:** Hairline 1px grid composed of `#2A0E08`, center axes highlighted in `#3B120C` with 2px tick markers along the center X and Y planes.
- **Traces:** Vector paths rendered with 1.5px stroke width in phosphor green (`#39FF14`) or secondary burnt orange (`#F07816`), carrying an emissive drop-shadow filter.

### Telemetry Badges & Chips
- **Channel Indicators (CH1 - CH4):** Rectangular blocks with a 4px corner. Solid `#D94A0D` background with black JetBrains Mono text for active states; recessed `#121212` background with `#73766D` border and text for unselected states.

### Data Tables & Event Logs
- **Log Stream:** Fixed-width rows separated by `1px solid #141414`. Timestamp in `#73766D`, parameter address in `#D8DAD3`, instantaneous measurement value in `#39FF14`. Alternating zebra fills are strictly disallowed; visual scanning relies on mono column tracks.

### Checkboxes & Toggle Pins
- **Hardware Toggles:** 12px square markers. Inactive: hollow box with `1px solid #333333`. Active: solid `#F07816` fill featuring a centered `#000000` dot.