import React, { useState, useEffect, useRef } from 'react';
import { CalibrationTelemetry, SpectrumConfig, DensiVueTelemetry } from '../types/oscilloscope';
import { playTactileClick, playRelayClack } from '../utils/audioFeedback';

interface SpectrumAnalyzerViewProps {
  telemetry: CalibrationTelemetry;
  config: SpectrumConfig;
  setConfig: React.Dispatch<React.SetStateAction<SpectrumConfig>>;
  liveData: DensiVueTelemetry | null;
}

export const SpectrumAnalyzerView: React.FC<SpectrumAnalyzerViewProps> = ({
  telemetry,
  liveData,
}) => {
  const [isHoldTrace, setIsHoldTrace] = useState(false);
  const [autoCentered, setAutoCentered] = useState(false);
  const movingCount = liveData?.flow.moving ?? 0;
  const stillCount = liveData?.flow.still ?? 0;
  const [livePoints, setLivePoints] = useState<[number, number][]>([[20, 525], [1380, 525]]);
  const [heldPoints, setHeldPoints] = useState<[number, number][]>([[20, 525], [1380, 525]]);
  const [m1Dbm, setM1Dbm] = useState<number | null>(null);
  const [m2Dbm, setM2Dbm] = useState<number | null>(null);

  useEffect(() => {
    const bins = liveData?.flow.spectrum ?? [];
    const peak = Math.max(1, ...bins);
    const points = bins.map((value, index): [number, number] => [
      20 + (bins.length <= 1 ? 0 : index * (1360 / (bins.length - 1))),
      525 - (value / peak) * 400,
    ]);
    if (!isHoldTrace) setLivePoints(points.length ? points : [[20, 525], [1380, 525]]);
    setHeldPoints((previous) => {
      if (previous.length !== points.length || previous.length < 2) return points.length ? points : [[20, 525], [1380, 525]];
      return points.map((point, index): [number, number] => [point[0], Math.min(point[1], previous[index][1])]);
    });
    setM1Dbm(liveData?.summary.meanRssi ?? null);
    setM2Dbm(liveData?.analog.devices.length ? liveData.analog.devices.reduce((peakRssi, device) => Math.max(peakRssi, device.rssi), -127) : null);
  }, [liveData?.generatedAt, isHoldTrace]);

  const totalPax = movingCount + stillCount;
  const dwellRetentionRate = (totalPax ? stillCount / totalPax : 0).toFixed(3);
  const rssiToX = (value: number | null) => value == null ? null : 20 + Math.max(0, Math.min(100, value + 100)) * 13.6;
  const m1X = rssiToX(m1Dbm);
  const m2X = rssiToX(m2Dbm);
  const strokePath = livePoints.reduce(
    (acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p[0].toFixed(1)},${p[1].toFixed(1)}`,
    ''
  );
  const areaPath = `${strokePath} L 1380,525 L 20,525 Z`;
  const envelopePath = heldPoints.reduce(
    (acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p[0].toFixed(1)},${p[1].toFixed(1)}`,
    ''
  );

  const handleHoldToggle = () => {
    if (telemetry.soundEnabled) playTactileClick();
    setIsHoldTrace((prev) => !prev);
  };

  const handleResetPeakHold = () => {
    if (telemetry.soundEnabled) playRelayClack();
    setHeldPoints(livePoints);
  };

  const handleAutoCentering = () => {
    if (telemetry.soundEnabled) playTactileClick();
    setAutoCentered((prev) => !prev);
  };

  return (
    <div className="w-full flex flex-col gap-2.5 max-w-full font-body-md text-on-surface antialiased select-none pb-12">
      {/* TOP CHASSIS BANNER */}
      <header className="bg-[#0b100d] border border-[#17251a] p-2.5 rounded flex flex-col gap-1.5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 font-label-md text-xs text-[#dbe4dc] border-b border-[#17251a] pb-1.5">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#39ff14] animate-pulse shadow-[0_0_10px_#39ff14]"></span>
              <span className="font-headline-md text-sm tracking-tight text-white font-bold">
                DENSIVUE TRANSIT ANALYZER 402
              </span>
            </div>
            <span className="text-[#3f5042]">/</span>
            <span className="text-[#39ff14] font-bold">● LIVE</span>
            <span className="text-[#7d9180]">
              SR: <span className="text-white font-bold">2.5 GS/s</span>
            </span>
            <span className="text-[#7d9180]">
              BUS: <span className="text-white font-bold">USB-C / 480M</span>
            </span>
          </div>
          <div className="flex items-center gap-3 text-[#7d9180]">
            <span className="bg-[#121c14] border border-[#1c2e1f] px-2 py-0.5 rounded text-[#ff7700]">
              RSSI HISTOGRAM: <span className="text-[#ff7700] font-bold">LIVE</span>
            </span>
            <span className="text-[#3f5042]">|</span>
            <span className="text-[#a4b7a6]">
              RSSI HISTOGRAM: <span className="text-[#39ff14] font-bold">LIVE</span>
            </span>
            <span className="text-[#3f5042]">|</span>
            <span>
              BAUD: <span className="text-[#dbe4dc]">{telemetry.baudRate} bps</span>
            </span>
            <span className="bg-[#ff7700] text-[#190b00] px-2 py-0.5 rounded font-bold">
              OP: LAB-04
            </span>
          </div>
        </div>
      </header>

      {/* FULL-WIDTH EXPANSIVE TEKTRONIX CRT OSCILLOSCOPE / SPECTRUM DISPLAY */}
      <section className="bg-[#090e0b] border border-[#17251a] p-2 rounded flex flex-col gap-1.5 shadow-[0_0_24px_rgba(0,0,0,0.9)]">
        {/* Outer CRT Bezel Recess */}
        <div className="relative bg-[#040705] rounded border border-[#142217] p-2.5 overflow-hidden shadow-[inset_0_0_30px_rgba(0,0,0,0.98)]">
          {/* CRT Phosphor Glass Glow & Scanline Grille */}
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_50%_45%,rgba(57,255,20,0.06),transparent_80%)] z-10"></div>
          <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,22,17,0)_50%,rgba(0,0,0,0.45)_50%)] bg-[length:100%_4px] opacity-40 z-10"></div>

          {/* TOP SCOPE CRT METADATA BAR (STRICT LABORATORY FORMAT) */}
          <div className="relative z-20 flex flex-wrap items-center justify-between gap-2 font-label-sm text-[11px] text-[#ff7700] pb-2 border-b border-[#18281b] select-none">
            {/* Left Scope Config */}
            <div className="flex items-center gap-2">
              <span className="bg-[#0b140d] px-1.5 py-0.5 text-[#39ff14] border border-[#1c301e] font-semibold">
                REF: -20.0 dBm
              </span>
              <span className="text-[#96a997]">SCALE: 10.0 dB/DIV</span>
              <span className="text-[#334435]">|</span>
              <span className="text-[#96a997]">ATTEN: 10 dB</span>
              <span className="text-[#334435]">|</span>
              <span className="text-[#96a997]">RES BW: 300 kHz</span>
            </div>

            {/* Center Machine Spec */}
            <div className="hidden xl:flex items-center gap-1.5 text-center">
              <span className="text-[#ff7700] font-bold tracking-wider">
                DENSIVUE TRANSIT ANALYZER 402
              </span>
              <span className="text-[#415543]">//</span>
              <span className="text-[#39ff14] font-medium tracking-wide">
                DUAL-TRACE SPECTRUM ANALYZER
              </span>
            </div>

            {/* Right Marker Measurements */}
            <div className="flex items-center gap-2 text-right">
              <span className="text-[#ff7700] font-bold">
                AVG RSSI ({(m1Dbm == null ? '--' : m1Dbm.toFixed(1))} dBm)
              </span>
              <span className="text-[#334435]">|</span>
              <span className="text-[#39ff14] font-bold">
                STRONGEST RSSI ({(m2Dbm == null ? '--' : m2Dbm.toFixed(1))} dBm)
              </span>
              <span className="text-[#334435]">|</span>
            </div>
          </div>

          {/* EXPANSIVE WIDESCREEN VECTOR RETICLE SVG CANVAS */}
          <div className="relative w-full h-[370px] xl:h-[430px] z-20 flex items-center justify-center my-1">
            <svg
              className="w-full h-full"
              preserveAspectRatio="none"
              viewBox="0 0 1400 560"
            >
              <defs>
                {/* 10 Horizontal Divisions x 8 Vertical Divisions Reticle Grid (140px x 70px) */}
                <pattern
                  height="70"
                  id="wide-graticule-grid"
                  patternUnits="userSpaceOnUse"
                  width="140"
                >
                  <path
                    d="M 140 0 L 0 0 0 70"
                    fill="none"
                    opacity="0.85"
                    stroke="#122514"
                    strokeDasharray="2,2"
                    strokeWidth="0.9"
                  ></path>
                  {/* Reticle sub-division cross-hairs on minor divisions */}
                  <circle cx="70" cy="35" fill="#1b361e" opacity="0.7" r="0.75"></circle>
                  <circle cx="35" cy="35" fill="#152b17" opacity="0.5" r="0.5"></circle>
                  <circle cx="105" cy="35" fill="#152b17" opacity="0.5" r="0.5"></circle>
                </pattern>

                {/* Phosphor Neon Green Glow Filter (#39ff14) */}
                <filter height="140%" id="crt-phosphor-glow" width="140%" x="-20%" y="-20%">
                  <feGaussianBlur result="glow" stdDeviation="2.4"></feGaussianBlur>
                  <feMerge>
                    <feMergeNode in="glow"></feMergeNode>
                    <feMergeNode in="SourceGraphic"></feMergeNode>
                  </feMerge>
                </filter>

                {/* Amber Max-Hold Envelope Glow Filter (#ff7700) */}
                <filter height="140%" id="crt-amber-glow" width="140%" x="-20%" y="-20%">
                  <feGaussianBlur result="glow" stdDeviation="3.0"></feGaussianBlur>
                  <feMerge>
                    <feMergeNode in="glow"></feMergeNode>
                    <feMergeNode in="SourceGraphic"></feMergeNode>
                  </feMerge>
                </filter>

                {/* Amber Peak Envelope Area Fill Gradient */}
                <linearGradient id="wide-envelope-fill" x1="0%" x2="0%" y1="0%" y2="100%">
                  <stop offset="0%" stopColor="#ff7700" stopOpacity="0.25"></stop>
                  <stop offset="65%" stopColor="#d45b00" stopOpacity="0.06"></stop>
                  <stop offset="100%" stopColor="#050806" stopOpacity="0.0"></stop>
                </linearGradient>

                {/* Neon Green Trace Underflow Gradient */}
                <linearGradient id="wide-live-fill" x1="0%" x2="0%" y1="0%" y2="100%">
                  <stop offset="0%" stopColor="#39ff14" stopOpacity="0.16"></stop>
                  <stop offset="100%" stopColor="#050806" stopOpacity="0.0"></stop>
                </linearGradient>
              </defs>

              {/* Background Reticle Grid */}
              <rect
                fill="url(#wide-graticule-grid)"
                height="560"
                width="1400"
                x="0"
                y="0"
              ></rect>

              {/* Major Center Axes & Reticle Crosshair Calibration */}
              <line
                stroke="#1c3e1e"
                strokeWidth="1.2"
                x1="0"
                x2="1400"
                y1="280"
                y2="280"
              ></line>
              <line
                stroke="#1c3e1e"
                strokeWidth="1.2"
                x1="700"
                x2="700"
                y1="0"
                y2="560"
              ></line>

              {/* Center Vertical Calibration Ticks (on Center line x=700) */}
              <g stroke="#2d6131" strokeWidth="1.2">
                <line x1="693" x2="707" y1="70" y2="70"></line>
                <line x1="693" x2="707" y1="140" y2="140"></line>
                <line x1="693" x2="707" y1="210" y2="210"></line>
                <line x1="693" x2="707" y1="350" y2="350"></line>
                <line x1="693" x2="707" y1="420" y2="420"></line>
                <line x1="693" x2="707" y1="490" y2="490"></line>
                {/* Center Horizontal Major Ticks (on Center line y=280) */}
                <line x1="140" x2="140" y1="274" y2="286"></line>
                <line x1="280" x2="280" y1="274" y2="286"></line>
                <line x1="420" x2="420" y1="274" y2="286"></line>
                <line x1="560" x2="560" y1="274" y2="286"></line>
                <line x1="840" x2="840" y1="274" y2="286"></line>
                <line x1="980" x2="980" y1="274" y2="286"></line>
                <line x1="1120" x2="1120" y1="274" y2="286"></line>
                <line x1="1260" x2="1260" y1="274" y2="286"></line>
              </g>

              {/* Amplitude Scale Vertical Readouts (Y-Axis Left) */}
              <g
                fill="#2e5931"
                fontFamily="JetBrains Mono"
                fontSize="9.5"
                textAnchor="start"
              >
                <text x="12" y="24">-20 dBm [REF]</text>
                <text x="12" y="74">-30 dBm</text>
                <text x="12" y="144">-40 dBm</text>
                <text x="12" y="214">-50 dBm</text>
                <text x="12" y="284">-60 dBm</text>
                <text x="12" y="354">-70 dBm</text>
                <text x="12" y="424">-80 dBm</text>
                <text x="12" y="494">-90 dBm</text>
                <text x="12" y="546">-100 dBm [FLOOR]</text>
              </g>

              {/* Horizontal Channel & Frequency Markers (X-Axis Bottom) */}
              <g
                fill="#2e5931"
                fontFamily="JetBrains Mono"
                fontSize="9.5"
                textAnchor="middle"
              >
                <text x="70" y="552">-100 dBm</text>
                <text x="350" y="552">-75 dBm</text>
                <text x="700" y="552">-50 dBm</text>
                <text x="1050" y="552">-25 dBm</text>
                <text x="1330" y="552">0 dBm</text>
              </g>

              {/* ================= TRACE 1: AMBER MAX-HOLD DWELL ENVELOPE ================= */}
              {/* Fill under Envelope */}
              <path d={`${envelopePath} Z`} fill="url(#wide-envelope-fill)"></path>

              {/* Peak Dwell Max-Hold Stroke Curve (#ff7700) */}
              <path
                d={envelopePath}
                fill="none"
                filter="url(#crt-amber-glow)"
                stroke="#ff7700"
                strokeWidth="2.5"
              ></path>

              {/* M1 marks the current mean RSSI on the RSSI axis. */}
              {m1X !== null && <><line
                opacity="0.65"
                stroke="#ff7700"
                strokeDasharray="3,3"
                strokeWidth="1.2"
                x1={m1X}
                x2={m1X}
                y1="118"
                y2="530"
              ></line>

              {/* Marker M1 Badge Anchor */}
              <g transform={`translate(${m1X}, 106)`}>
                <polygon fill="#ff7700" points="0,0 -8,-13 8,-13"></polygon>
                <rect
                  fill="#1b0e03"
                  height="21"
                  rx="2"
                  stroke="#ff7700"
                  strokeWidth="1.2"
                  width="130"
                  x="-65"
                  y="-35"
                ></rect>
                <text
                  fill="#ffb68a"
                  fontFamily="JetBrains Mono"
                  fontSize="10.5"
                  fontWeight="700"
                  textAnchor="middle"
                  x="0"
                  y="-21"
                >
                  ▼ AVG {(m1Dbm == null ? '--' : m1Dbm.toFixed(1))} dBm
                </text>
              </g></>}

              {/* ================= TRACE 2: JAGGED REAL-TIME NEON GREEN SPECTRUM TRACE (#39ff14) ================= */}
              {/* Live Underflow Area */}
              <path d={areaPath} fill="url(#wide-live-fill)" id="wide-live-area"></path>

              {/* Live Jagged Spectrum Stroke Line */}
              <path
                d={strokePath}
                fill="none"
                filter="url(#crt-phosphor-glow)"
                id="wide-live-stroke"
                stroke="#39ff14"
                strokeWidth="2"
              ></path>

              {/* M2 marks the strongest current device RSSI. */}
              {m2X !== null && <><line
                opacity="0.65"
                stroke="#39ff14"
                strokeDasharray="3,3"
                strokeWidth="1.2"
                x1={m2X}
                x2={m2X}
                y1="212"
                y2="530"
              ></line>

              {/* Marker M2 Badge Anchor */}
              <g transform={`translate(${m2X}, 200)`}>
                <polygon fill="#39ff14" points="0,0 -8,-13 8,-13"></polygon>
                <rect
                  fill="#061908"
                  height="21"
                  rx="2"
                  stroke="#39ff14"
                  strokeWidth="1.2"
                  width="130"
                  x="-65"
                  y="-35"
                ></rect>
                <text
                  fill="#39ff14"
                  fontFamily="JetBrains Mono"
                  fontSize="10.5"
                  fontWeight="700"
                  textAnchor="middle"
                  x="0"
                  y="-21"
                >
                  ▼ PEAK {(m2Dbm == null ? '--' : m2Dbm.toFixed(1))} dBm
                </text>
              </g></>}
            </svg>
          </div>

          {/* RETICLE BOTTOM LEGEND & CRT DETECTOR SPEC */}
          <div className="relative z-20 flex flex-wrap items-center justify-between gap-2 font-label-sm text-[11px] border-t border-[#18281b] pt-2 select-none">
            <div className="flex items-center gap-5">
              <span className="flex items-center gap-1.5 text-[#39ff14] font-bold">
                <span className="inline-block w-2.5 h-2.5 bg-[#39ff14] shadow-[0_0_8px_#39ff14]"></span>
                LIVE TRANSIT FLOW (#39ff14 NEON GREEN)
              </span>
              <span className="flex items-center gap-1.5 text-[#ff7700] font-bold">
                <span className="inline-block w-2.5 h-2.5 bg-[#ff7700] shadow-[0_0_8px_#ff7700]"></span>
                DWELL MAX-HOLD ENVELOPE (#ff7700 AMBER)
              </span>
            </div>
            <div className="flex items-center gap-3 text-[#798e7b]">
              <span>
                SWEEP: <span className="text-white font-bold">120ms CONTINUOUS</span>
              </span>
              <span className="text-[#324534]">|</span>
              <span>
                DETECTOR: <span className="text-white font-bold">PEAK + RMS DUAL</span>
              </span>
              <span className="text-[#324534]">|</span>
              <span>
                VIDEO BW: <span className="text-white font-bold">30 kHz</span>
              </span>
            </div>
          </div>
        </div>

        {/* CRT Control Strip / Scope Trigger Actuators */}
        <div className="bg-[#0c120e] px-3 py-1.5 rounded flex flex-wrap items-center justify-between gap-2 text-xs font-label-sm">
          <div className="flex items-center gap-2">
            <button
              onClick={handleHoldToggle}
              className={`px-2.5 py-1 rounded border flex items-center gap-1.5 transition-colors cursor-pointer ${
                isHoldTrace
                  ? 'bg-[#2b1706] text-[#ff7700] border-[#ff7700] font-bold shadow-[0_0_8px_rgba(255,119,0,0.4)]'
                  : 'bg-[#142017] hover:bg-[#1a2d20] text-white border-[#213524]'
              }`}
            >
              <span className="material-symbols-outlined text-[14px] text-[#ff7700]">
                {isHoldTrace ? 'play_arrow' : 'pause'}
              </span>
              <span>{isHoldTrace ? 'RESUME TRACE' : 'HOLD TRACE'}</span>
            </button>

            <button
              onClick={handleResetPeakHold}
              className="bg-[#142017] hover:bg-[#1a2d20] text-white px-2.5 py-1 rounded border border-[#213524] flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[14px] text-[#39ff14]">
                restart_alt
              </span>
              <span>RESET PEAK-HOLD</span>
            </button>

            <button
              onClick={handleAutoCentering}
              className={`px-2.5 py-1 rounded border flex items-center gap-1.5 transition-colors cursor-pointer ${
                autoCentered
                  ? 'bg-[#0e2413] text-[#39ff14] border-[#39ff14] font-bold'
                  : 'bg-[#142017] hover:bg-[#1a2d20] text-white border-[#213524]'
              }`}
            >
              <span className="material-symbols-outlined text-[14px] text-[#8ea590]">
                tune
              </span>
              <span>AUTO CENTERING</span>
            </button>
          </div>

          <div className="flex items-center gap-4 text-[#6d816f]">
            <span>
              GRATICULE: <span className="text-white">10x8 RETICLE EXPANDED</span>
            </span>
            <span className="text-[#2b3a2d]">|</span>
            <span className="text-[#a4b7a6]">
              PERSISTENCE: <span className="text-[#39ff14]">INFINITE MAX-HOLD</span>
            </span>
          </div>
        </div>
      </section>

      {/* HORIZONTAL TELEMETRY BLOCK (3 INLINE SECTIONS, BOTTOM ~25% HEIGHT) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5">
        {/* SECTION A: LIVE HEADCOUNT SPLIT (BOLD & GLOWING NUMERALS) */}
        <div className="lg:col-span-5 bg-[#0a100c] border border-[#17251a] p-3 rounded flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between border-b border-[#17251a] pb-1.5">
            <span className="font-label-sm text-[10px] uppercase tracking-wider text-[#6b806d] font-bold flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[14px] text-[#ff7700]">
                group
              </span>
              HEADCOUNT SPLIT DISPERSION
            </span>
            <span className="font-label-sm text-[10px] text-[#39ff14] bg-[#0f1d11] px-1.5 py-0.5 rounded border border-[#1c3620] font-bold">
              RSSI VARIABILITY PROXY
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 py-2">
            {/* RSSI VARIABLE */}
            <div className="bg-[#050806] border border-[#162719] p-3 rounded flex flex-col justify-between relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="font-label-sm text-[11px] uppercase tracking-wider text-[#39ff14] flex items-center gap-1.5 font-bold">
                  <span className="inline-block w-2 h-2 rounded-full bg-[#39ff14] shadow-[0_0_8px_#39ff14]"></span>
                  RSSI VARIABLE
                </span>
                <span className="material-symbols-outlined text-[16px] text-[#39ff14]">
                  trending_up
                </span>
              </div>
              <div className="py-1">
                <span className="font-display-lg text-4xl xl:text-5xl font-black text-[#39ff14] tracking-tight leading-none drop-shadow-[0_0_14px_rgba(57,255,20,0.65)] font-mono">
                  {movingCount}
                </span>
              </div>
              <span className="font-label-sm text-[10px] text-[#718573] uppercase tracking-wider font-semibold">
                FINGERPRINTS WITH RSSI RANGE ≥ 8 dB
              </span>
            </div>

            {/* RSSI STABLE */}
            <div className="bg-[#050806] border border-[#2b1706] p-3 rounded flex flex-col justify-between relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="font-label-sm text-[11px] uppercase tracking-wider text-[#ff7700] flex items-center gap-1.5 font-bold">
                  <span className="inline-block w-2 h-2 rounded-full bg-[#ff7700] shadow-[0_0_8px_#ff7700]"></span>
                  RSSI STABLE
                </span>
                <span className="material-symbols-outlined text-[16px] text-[#ff7700]">
                  timer
                </span>
              </div>
              <div className="py-1">
                <span className="font-display-lg text-4xl xl:text-5xl font-black text-[#ff7700] tracking-tight leading-none drop-shadow-[0_0_14px_rgba(255,119,0,0.65)] font-mono">
                  {String(stillCount).padStart(2, '0')}
                </span>
              </div>
              <span className="font-label-sm text-[10px] text-[#937b67] uppercase tracking-wider font-semibold">
                FINGERPRINTS WITH STABLE RSSI
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between font-label-sm text-[10px] text-[#556957]">
            <span>
              AGGREGATE: <span className="text-white font-bold">{totalPax} PAX TOTAL</span>
            </span>
            <span>
              STABLE RSSI SHARE:{' '}
              <span className="text-[#ff7700] font-bold font-mono">{dwellRetentionRate}</span>
            </span>
          </div>
        </div>

        {/* SECTION B: ACCUMULATION & DENSITY RATIO */}
        <div className="lg:col-span-4 bg-[#0a100c] border border-[#17251a] p-3 rounded flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between border-b border-[#17251a] pb-1.5">
            <span className="font-label-sm text-[10px] uppercase tracking-wider text-[#6b806d] font-bold">
              ACCUMULATION GAUGING
            </span>
            <span className="font-label-sm text-[10px] text-[#ff7700] bg-[#1d1003] px-1.5 py-0.5 rounded border border-[#3b1e06] font-bold">
              RATIO N_still / N_tot
            </span>
          </div>

          {/* Dwell Accumulation Visualization Bar */}
          <div className="my-auto py-2 flex flex-col gap-2">
            <div className="flex items-baseline justify-between font-label-sm">
              <div className="flex items-baseline gap-2">
                <span className="font-display-lg text-2xl xl:text-3xl font-black text-[#ff7700] font-mono">
                  {(parseFloat(dwellRetentionRate) * 100).toFixed(1)}%
                </span>
                <span className="text-[10px] text-[#869586] uppercase">
                  STABLE RSSI SHARE
                </span>
              </div>
              <span className="text-[10px] text-[#39ff14] font-bold font-mono">
                RSSI HEURISTIC
              </span>
            </div>

            {/* Segmented LED Gauge */}
            <div className="w-full bg-[#050806] border border-[#162719] p-1.5 rounded flex gap-1">
              {Array.from({ length: 20 }).map((_, i) => {
                const active = i < Math.round((parseFloat(dwellRetentionRate) * 100) / 5);
                return (
                  <div
                    key={i}
                    className={`h-3 flex-1 rounded-[1px] transition-all duration-300 ${
                      active
                        ? i > 14
                          ? 'bg-[#ffb4ab] shadow-[0_0_6px_#ffb4ab]'
                          : i > 10
                          ? 'bg-[#ff7700] shadow-[0_0_6px_#ff7700]'
                          : 'bg-[#39ff14] shadow-[0_0_4px_#39ff14]'
                        : 'bg-[#121c14]'
                    }`}
                  />
                );
              })}
            </div>

            <div className="flex justify-between items-center text-[9px] font-mono text-[#5d6e5e]">
              <span>0% [FREE FLOW]</span>
              <span>25% [THRESHOLD]</span>
              <span>50% [CHOKE]</span>
            </div>
          </div>

          <div className="font-label-sm text-[10px] text-[#556957] border-t border-[#17251a] pt-1 flex justify-between">
            <span>SAMPLE RATE: 100 Hz</span>
            <span>
              MOTION BASIS: <span className="text-[#ff7700] font-bold">RSSI VARIATION ONLY</span>
            </span>
          </div>
        </div>

        {/* SECTION C: OPERATIONAL STATUS */}
        <div className="lg:col-span-3 bg-[#0a100c] border border-[#17251a] p-3 rounded flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between border-b border-[#17251a] pb-1.5">
            <span className="font-label-sm text-[10px] uppercase tracking-wider text-[#6b806d] font-bold">
              SECTOR FLOW DIAGNOSTIC
            </span>
            <span className="font-label-sm text-[10px] text-[#7d917f] font-mono font-bold">
              CORRIDOR 04
            </span>
          </div>

          <div className="flex flex-col gap-2 my-auto py-2">
            {/* Glowing Badge */}
            <div className="bg-[#0b1b0f] border border-[#1e3c23] px-2.5 py-1.5 rounded flex items-center gap-2 shadow-[0_0_12px_rgba(57,255,20,0.15)]">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#39ff14] shadow-[0_0_8px_#39ff14] animate-pulse"></span>
              <span className="font-label-sm text-[11px] text-[#39ff14] font-bold uppercase tracking-wider leading-snug">
                {stillCount > movingCount ? '● HIGH RSSI STABILITY PROXY' : '● RSSI VARIABILITY PROXY'}
              </span>
            </div>
            {/* Subtext description */}
            <p className="font-body-md text-xs text-[#a2b5a4] leading-relaxed">
              {movingCount} fingerprints show an RSSI range of at least 8 dB; {stillCount} show less variation. This single-receiver heuristic does not establish actual motion or corridor direction.
            </p>
          </div>

          <div className="flex items-center justify-between font-label-sm text-[10px] text-[#556957] border-t border-[#17251a] pt-1">
            <span>
              INPUT: <span className="text-[#39ff14] font-bold">{telemetry.sourceStatus}</span>
            </span>
            <span className="text-[#ff7700] font-bold">RSSI-ONLY ESTIMATE</span>
          </div>
        </div>
      </div>
    </div>
  );
};
