import React, { useRef, useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { PacketEvent, ScopeConfig, CalibrationTelemetry, DensiVueTelemetry } from '../types/oscilloscope';
import { playTactileClick, playRelayClack, playTriggerPing } from '../utils/audioFeedback';

interface AnalogTraceViewProps {
  config: ScopeConfig;
  setConfig: React.Dispatch<React.SetStateAction<ScopeConfig>>;
  telemetry: CalibrationTelemetry;
  setTelemetry: React.Dispatch<React.SetStateAction<CalibrationTelemetry>>;
  packets: PacketEvent[];
  onInspectPacket: (packet: PacketEvent) => void;
  onOpenAlertModal: () => void;
  liveData: DensiVueTelemetry | null;
}

export const AnalogTraceView: React.FC<AnalogTraceViewProps> = ({
  config,
  setConfig,
  telemetry,
  setTelemetry,
  packets,
  onInspectPacket,
  onOpenAlertModal,
  liveData,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isFrozen, setIsFrozen] = useState(false);
  const activeAlert = liveData?.audit.find((event) => event.status === 'ACTIVE') ?? null;

  // Sweep animation state stored in ref so it doesn't cause re-renders
  const stateRef = useRef({
    sweepX: 0,
    historyCH1: [] as { x: number; y: number }[],
    historyCH2: [] as { x: number; y: number }[],
    ch1Y: -0.15,
    ch2Y: 0.22,
    isPaused: config.streamMode === 'pause' || isFrozen,
    soundEnabled: telemetry.soundEnabled,
    samples: [] as DensiVueTelemetry['analog']['samples'],
  });

  useEffect(() => {
    stateRef.current.isPaused = config.streamMode === 'pause' || isFrozen;
    stateRef.current.soundEnabled = telemetry.soundEnabled;
  }, [config.streamMode, isFrozen, telemetry.soundEnabled]);

  useEffect(() => {
    stateRef.current.samples = liveData?.analog.samples ?? [];
  }, [liveData?.generatedAt]);

  // CRT Canvas Phosphor Sweeper Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const handleResize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    const render = () => {
      const { width, height } = canvas;
      const dpr = window.devicePixelRatio || 1;
      const st = stateRef.current;

      if (!st.isPaused && width > 0 && height > 0) {
        // Phosphor persistence decay simulation
        ctx.fillStyle = 'rgba(20, 5, 4, 0.12)';
        ctx.fillRect(0, 0, width, height);

        // Convert actual one-second Wi-Fi probe buckets into a phosphor trace.
        const sampleIndex = st.samples.length ? Math.min(st.samples.length - 1, Math.floor((st.sweepX / width) * st.samples.length)) : -1;
        const wifiCount = sampleIndex >= 0 ? st.samples[sampleIndex].wifi : 0;
        const peakCount = Math.max(1, ...st.samples.map((sample) => sample.wifi));
        const targetCH1 = -0.15 - Math.min(0.8, (wifiCount / peakCount) * 0.8);
        st.ch1Y += (targetCH1 - st.ch1Y) * 0.35;
        st.ch2Y = 0.22; // BLE is intentionally disabled for this Wi-Fi-only build.

        const normalizedCH1 = (st.ch1Y + 1) * 0.5 * height;
        const normalizedCH2 = (st.ch2Y + 1) * 0.5 * height;

        st.historyCH1.push({ x: st.sweepX, y: normalizedCH1 });
        st.historyCH2.push({ x: st.sweepX, y: normalizedCH2 });

        const maxPoints = 500;
        if (st.historyCH1.length > maxPoints) {
          st.historyCH1.shift();
          st.historyCH2.shift();
        }

        // Draw CH1: Phosphor Neon Green #39FF14 Trace
        ctx.beginPath();
        ctx.lineWidth = 2 * dpr;
        ctx.strokeStyle = '#39FF14';
        ctx.shadowColor = '#39FF14';
        ctx.shadowBlur = 8;

        for (let i = 0; i < st.historyCH1.length; i++) {
          const pt = st.historyCH1[i];
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();

        // Draw CH2: Burnt Orange / Amber #F07816 Trace
        ctx.beginPath();
        ctx.lineWidth = 1.6 * dpr;
        ctx.strokeStyle = '#F07816';
        ctx.shadowColor = '#F07816';
        ctx.shadowBlur = 6;

        for (let i = 0; i < st.historyCH2.length; i++) {
          const pt = st.historyCH2[i];
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Draw Leading Phosphor Spot (The Electron Beam Head)
        ctx.fillStyle = '#FFFFFF';
        ctx.shadowColor = '#39FF14';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(st.sweepX, normalizedCH1, 2.5 * dpr, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowColor = '#F07816';
        ctx.beginPath();
        ctx.arc(st.sweepX, normalizedCH2, 2 * dpr, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Advance Sweep Timebase
        st.sweepX += 2.5 * dpr;
        if (st.sweepX > width) {
          st.sweepX = 0;
          st.historyCH1 = [];
          st.historyCH2 = [];
          if (st.soundEnabled && st.samples.some((sample) => sample.wifi > 0)) {
            playTriggerPing();
          }
        }
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleClearDisplay = () => {
    if (telemetry.soundEnabled) playRelayClack();
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#140504';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }
    stateRef.current.historyCH1 = [];
    stateRef.current.historyCH2 = [];
    stateRef.current.sweepX = 0;
  };

  const handleToggleFreeze = () => {
    if (telemetry.soundEnabled) playRelayClack();
    setIsFrozen(!isFrozen);
  };

  // Filter packets
  const filteredPackets = packets.filter((p) => {
    if (config.filterType === 'wifi') return p.type.includes('802.11');
    if (config.filterType === 'ble') return p.type.includes('BLE');
    if (config.filterType === 'anomalies') return p.rssi > -50 || (p.snr ?? 0) > 30;
    return true;
  });

  return (
    <div className="w-full max-w-[1520px] mx-auto py-space-md space-y-space-md">
      {/* TOP INSTRUMENT METRICS / SUB-RACK HEADER STRIP */}
      <div className="w-full bg-surface-container-lowest p-space-md flex flex-wrap items-center justify-between gap-space-md border border-surface-container-high/60 shadow-sm">
        <div className="flex items-center gap-space-lg">
          <div className="flex items-center gap-space-sm">
            <div className="w-2.5 h-2.5 bg-primary-container"></div>
            <span className="font-label-lg text-primary tracking-widest font-bold">
              TEK-SENTRA 402B
            </span>
            <span className="font-label-sm text-on-surface-variant bg-surface-container-high px-space-sm py-space-xs border border-surface-container-highest">
              SER: 884-X992-RF
            </span>
          </div>
          <div className="h-4 w-px bg-surface-container-highest"></div>
        </div>

        <div className="flex items-center gap-space-xl font-label-sm">
          <div className="flex flex-col">
            <span className="text-on-surface-variant text-[10px] uppercase">Wi-Fi Probe Rate</span>
            <span className="text-secondary font-label-md font-mono" id="stat-ingress">
              {telemetry.wifiRatePps.toFixed(2)} probes/s
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-on-surface-variant text-[10px] uppercase">Wi-Fi Frame Ingress</span>
            <span className="text-on-surface font-label-md font-mono" id="stat-wifi">
              {telemetry.wifiProbes.toLocaleString('en-US')} fr
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-on-surface-variant text-[10px] uppercase">BLE Input (disabled)</span>
            <span className="text-on-surface font-label-md font-mono" id="stat-ble">
              DISABLED
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-on-surface-variant text-[10px] uppercase">Mean RSSI</span>
            <span className="text-secondary font-label-md flex items-center gap-1 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary-fixed"></span>
              {telemetry.meanRssi == null ? '--' : `${telemetry.meanRssi.toFixed(1)} dBm`}
            </span>
          </div>
          <div className="flex items-center gap-space-xs bg-surface-container-high px-space-sm py-space-xs text-on-surface border border-surface-container-highest">
            <span className="w-2 h-2 rounded-full bg-secondary-fixed animate-ping"></span>
            <span className="font-label-sm text-secondary font-bold">WIFI PROBE SYNC</span>
          </div>
        </div>
      </div>

      {/* MAIN CHASSIS CONSOLE (Center Dual-Bay Physical Chassis) */}
      <div className="w-full bg-surface-container-lowest p-space-md grid grid-cols-12 gap-space-md border border-surface-container-high/60">
        {/* LEFT SECTION: CRT PHOSPHOR OSCILLOSCOPE BAY (~66% / 8 columns) */}
        <div className="col-span-12 xl:col-span-8 flex flex-col bg-surface-container-low p-space-md border border-surface-container-high/80">
          {/* CRT Top Bezel with Screws and Model Plate */}
          <div className="flex items-center justify-between pb-space-sm px-space-sm">
            <div className="flex items-center gap-space-md">
              <div className="w-3 h-3 rounded-full bg-surface-container-highest flex items-center justify-center border border-black/50">
                <div className="w-1.5 h-0.5 bg-background"></div>
              </div>
              <span className="font-label-sm text-on-surface-variant tracking-widest uppercase">
                ANALOG PHOSPHOR MONITOR // 10×8 RETICLE
              </span>
            </div>
            <div className="flex items-center gap-space-md font-label-sm">
              <span className="text-secondary bg-surface-container px-space-sm py-space-xs border border-surface-container-high">
                BEAM: 14.2 kV
              </span>
              <span className="text-on-surface-variant">PERSISTENCE: 420ms</span>
              <div className="w-3 h-3 rounded-full bg-surface-container-highest flex items-center justify-center border border-black/50">
                <div className="w-1.5 h-0.5 bg-background"></div>
              </div>
            </div>
          </div>

          {/* RECESSED CRT SCREEN WELL (Dark Red Tint Phosphor Chamber) */}
          <div className="relative w-full aspect-[16/9] min-h-[380px] bg-[#140504] overflow-hidden flex flex-col justify-between p-space-md border-2 border-[#222222] shadow-[inset_0_0_24px_rgba(0,0,0,0.95)]">
            {/* Optical Vignette & Mesh Overlay */}
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,rgba(255,100,50,0.06)_0%,rgba(5,1,1,0.88)_100%)] z-10 crt-scanlines"></div>

            {/* 10x8 Division Graticule Reticle SVG Layer */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none z-10"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <pattern
                  id="graticule-grid"
                  width="10%"
                  height="12.5%"
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d="M 0 0 L 100 0 100 100 0 100 Z"
                    fill="none"
                    stroke="#3b120c"
                    strokeDasharray="2,3"
                    strokeWidth="0.75"
                  />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#graticule-grid)" />
              {/* Major Center Axes with 0.2 div subdivision ticks */}
              <line x1="50%" y1="0" x2="50%" y2="100%" stroke="#5a180f" strokeWidth="1.2" />
              <line x1="0" y1="50%" x2="100%" y2="50%" stroke="#5a180f" strokeWidth="1.2" />
              {/* Axis Sub-tick Marks on Center Lines */}
              <g stroke="#7e2215" strokeWidth="1">
                {/* Y-Center Sub-Ticks */}
                <line x1="49%" y1="12.5%" x2="51%" y2="12.5%" />
                <line x1="49%" y1="25%" x2="51%" y2="25%" />
                <line x1="49%" y1="37.5%" x2="51%" y2="37.5%" />
                <line x1="49%" y1="62.5%" x2="51%" y2="62.5%" />
                <line x1="49%" y1="75%" x2="51%" y2="75%" />
                <line x1="49%" y1="87.5%" x2="51%" y2="87.5%" />
                {/* X-Center Sub-Ticks */}
                <line x1="10%" y1="48.5%" x2="10%" y2="51.5%" />
                <line x1="20%" y1="48.5%" x2="20%" y2="51.5%" />
                <line x1="30%" y1="48.5%" x2="30%" y2="51.5%" />
                <line x1="40%" y1="48.5%" x2="40%" y2="51.5%" />
                <line x1="60%" y1="48.5%" x2="60%" y2="51.5%" />
                <line x1="70%" y1="48.5%" x2="70%" y2="51.5%" />
                <line x1="80%" y1="48.5%" x2="80%" y2="51.5%" />
                <line x1="90%" y1="48.5%" x2="90%" y2="51.5%" />
              </g>
            </svg>

            {/* Interactive CRT Oscilloscope Canvas (Real-time Phosphor Sweeping) */}
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full z-0 block" />

            {/* CRT TOP OVERLAY (Telemetry Labels) */}
            <div className="relative z-20 flex justify-between items-start font-label-sm pointer-events-none">
              <div className="space-y-space-xs bg-[#0c0303]/90 p-space-sm backdrop-blur-sm border border-[#3b120c]/60">
                <div className="flex items-center gap-space-sm text-secondary">
                  <span className="w-2 h-2 rounded-sm bg-secondary-fixed"></span>
                  <span className="font-bold tracking-wider">
                    CH1: 2.4GHz RF / Wi-Fi [{config.ch1VoltsDiv}mV/DIV]
                  </span>
                  <span className="text-on-surface-variant text-[10px]">BW: 20MHz</span>
                </div>
                <div className="flex items-center gap-space-sm text-primary">
                  <span className="w-2 h-2 rounded-sm bg-primary-container"></span>
                  <span className="font-bold tracking-wider">
                    CH2: DISABLED [{config.ch2VoltsDiv}mV/DIV]
                  </span>
                  <span className="text-on-surface-variant text-[10px]">CH: 37/38/39</span>
                </div>
              </div>
              <div className="bg-[#0c0303]/90 px-space-sm py-space-xs text-right backdrop-blur-sm border border-[#3b120c]/60">
                <span className="text-secondary font-bold block" id="crt-frame-rate">
                  SAMPLE: {config.sampleRate}
                </span>
                <span className="text-primary text-[10px] block">
                  TRIG SLOPE: {config.trigSlope}
                </span>
              </div>
            </div>

            {/* CRT BOTTOM OVERLAY (Trigger & Timebase Parameters) */}
            <div className="relative z-20 flex justify-between items-end font-label-sm pointer-events-none">
              <div className="bg-[#0c0303]/90 px-space-sm py-space-xs flex items-center gap-space-md backdrop-blur-sm border border-[#3b120c]/60">
                <span className="text-on-surface-variant">
                  TIME/DIV: <span className="text-on-surface font-semibold">{config.timeDiv}</span>
                </span>
                <span className="text-on-surface-variant">
                  TRIG LEVEL:{' '}
                  <span className="text-secondary font-semibold">
                    +{config.trigLevelMv}mV
                  </span>
                </span>
                <span className="text-on-surface-variant">
                  STATUS:{' '}
                  <span className="text-secondary font-bold">
                    {isFrozen ? 'TRACE HOLD' : config.status}
                  </span>
                </span>
              </div>
              <div className="bg-[#0c0303]/90 px-space-sm py-space-xs text-on-surface-variant text-[10px] flex items-center gap-space-sm backdrop-blur-sm border border-[#3b120c]/60">
                <span>ACQ BUFFER: RING {telemetry.bufferCapacityRecords} RECORDS</span>
                <span className="text-primary">NOISE FLOOR: {config.noiseFloorDbm} dBm</span>
              </div>
            </div>
          </div>

          {/* CRT Bottom Hardware Calibration Sub-Strip */}
          <div className="flex flex-wrap items-center justify-between pt-space-sm px-space-sm text-on-surface-variant font-label-sm">
            <div className="flex items-center gap-space-lg">
              <span className="flex items-center gap-space-xs">
                <span className="w-1.5 h-1.5 bg-primary rounded-full"></span> PROBE ATTEN:{' '}
                {config.probeAtten}
              </span>
              <span>COUPLING: {config.coupling}</span>
              <span>OFFSET: {config.offsetV.toFixed(2)} V</span>
            </div>
            <div className="flex items-center gap-space-md">
              <button
                onClick={handleToggleFreeze}
                className={`px-space-md py-space-xs border border-surface-container-highest transition-all flex items-center gap-space-xs active:scale-95 ${
                  isFrozen
                    ? 'bg-primary text-on-primary font-bold shadow'
                    : 'bg-surface-container-high text-on-surface hover:bg-surface-bright'
                }`}
                id="btnTraceFreeze"
              >
                <span className="material-symbols-outlined text-[14px]">ac_unit</span>
                <span>{isFrozen ? 'RESUME TRACE' : 'HOLD TRACE'}</span>
              </button>
              <button
                onClick={handleClearDisplay}
                className="bg-surface-container-high px-space-md py-space-xs text-on-surface hover:bg-surface-bright active:scale-95 transition-all flex items-center gap-space-xs border border-surface-container-highest"
                id="btnTraceClear"
              >
                <span className="material-symbols-outlined text-[14px]">refresh</span>
                <span>CLEAR DISP</span>
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT SECTION: INDUSTRIAL BURNT-ORANGE CONTROL MODULE (~34% / 4 columns) */}
        <div className="col-span-12 xl:col-span-4 bg-primary-container p-space-md flex flex-col justify-between shadow-xl">
          <div className="space-y-space-md">
            {/* Orange Panel Top Label & Panel Screws */}
            <div className="flex items-center justify-between text-on-primary-container pb-space-xs border-b border-on-primary-container/20">
              <div className="flex items-center gap-space-sm">
                <div className="w-2.5 h-2.5 rounded-full bg-on-primary-container/30 flex items-center justify-center">
                  <div className="w-1 h-0.5 bg-primary-container"></div>
                </div>
                <span className="font-label-md font-bold tracking-widest">
                  RF TELEMETRY ACQUISITION MODULE
                </span>
              </div>
              <div className="w-2.5 h-2.5 rounded-full bg-on-primary-container/30 flex items-center justify-center">
                <div className="w-1 h-0.5 bg-primary-container"></div>
              </div>
            </div>

            {/* PRIMARY DIGITAL VFD / 7-SEGMENT NUMERICAL READOUT */}
            <div className="bg-surface-container-lowest p-space-md shadow-inner flex flex-col justify-between border border-black/40">
              <div className="flex items-center justify-between text-[10px] font-label-sm text-on-surface-variant tracking-wider uppercase">
                <span>TOTAL OBSERVATIONS (LIVE)</span>
                <span className="flex items-center gap-1 text-primary">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary-container animate-pulse"></span>
                  ACTIVE FIFO
                </span>
              </div>
              {/* Glowing Digital Display Value */}
              <div className="py-space-sm flex items-baseline justify-between">
                <span
                  className="font-display-lg text-primary tracking-wider select-none font-bold tabular-nums"
                  id="vfd-counter"
                >
                  {telemetry.totalObservations.toLocaleString('en-US')}
                </span>
                <span className="font-label-sm text-on-surface-variant font-semibold">EVENTS/Σ</span>
              </div>
              {/* Secondary Metrics Strip inside the VFD well */}
              <div className="grid grid-cols-2 gap-space-sm pt-space-xs border-t border-surface-container-highest">
                <div className="bg-surface-container p-space-xs">
                  <span className="text-[10px] block text-on-surface-variant font-label-sm">
                    WI-FI PROBES
                  </span>
                  <span
                    className="font-label-lg text-secondary font-bold tabular-nums"
                    id="sub-wifi-counter"
                  >
                    {telemetry.wifiProbes.toString().padStart(5, '0')}
                  </span>
                </div>
                <div className="bg-surface-container p-space-xs">
                  <span className="text-[10px] block text-on-surface-variant font-label-sm">
                    BLE INPUT DISABLED
                  </span>
                  <span
                    className="font-label-lg text-primary font-bold tabular-nums"
                    id="sub-ble-counter"
                  >
                    OFF
                  </span>
                </div>
              </div>
            </div>



            {/* CIRCULAR ANALOG GAUGE: BUFFER UTILIZATION / REVIEW THRESHOLD */}
            <div className="bg-surface-container-lowest p-space-md flex items-center justify-between gap-space-md border border-black/40">
              <div className="flex-1 space-y-space-xs">
                <span className="font-label-sm text-on-surface-variant tracking-wider uppercase block">
                  BUFFER CAPACITY
                </span>
                <div className="flex items-baseline gap-space-sm">
                  <span className="font-headline-lg text-primary font-bold">
                    {telemetry.bufferCapacityPercent}%
                  </span>
                  <span className="font-label-sm text-secondary font-medium">
                    {telemetry.bufferUsedRecords} / {telemetry.bufferCapacityRecords} records
                  </span>
                </div>
                <p className="font-label-sm text-on-surface-variant text-[11px] leading-tight">
                  Ring memory saturation high. Auto-purge FIFO active on slot 4.
                </p>
              </div>
              {/* Precision Circular Gauge SVG */}
              <div className="w-24 h-24 relative flex-shrink-0">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  {/* Track */}
                  <circle cx="50" cy="50" fill="none" r="38" stroke="#282b26" strokeWidth="8" />
                  {/* Ticks arc */}
                  <circle
                    cx="50"
                    cy="50"
                    fill="none"
                    r="38"
                    stroke="#574236"
                    strokeDasharray="2 6"
                    strokeWidth="8"
                  />
                  {/* Value arc uses live buffer occupancy */}
                  <circle
                    cx="50"
                    cy="50"
                    fill="none"
                    r="38"
                    stroke="#f07816"
                    strokeDasharray="238.7"
                    strokeDashoffset={238.7 * (1 - telemetry.bufferCapacityPercent / 100)}
                    strokeLinecap="butt"
                    strokeWidth="8"
                  />
                </svg>
                {/* Center Hub */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="font-label-sm text-primary font-bold">CRIT</span>
                  <span className="font-label-sm text-[9px] text-on-surface-variant">
                    {telemetry.bufferCapacityPercent}%
                  </span>
                </div>
              </div>
            </div>

            {/* CONTEXTUAL ALERT BOX (Beneath the circular dial) */}
            <div className="bg-surface-container-lowest p-space-sm space-y-space-xs border border-primary/40">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-space-sm">
                  <span className="w-2 h-2 rounded-full bg-primary-container animate-ping"></span>
                  <span className="font-label-sm text-primary font-bold uppercase tracking-wider">
                    {activeAlert ? `ACTIVE BREACH: ${activeAlert.classification}` : 'NO ACTIVE THRESHOLD BREACH'}
                  </span>
                </div>
                <span className="font-label-sm text-on-surface-variant text-[10px]">
                  {activeAlert ? new Date(activeAlert.timestamp).toLocaleTimeString('en-GB', { timeZone: 'UTC', hour12: false }) + ' UTC' : 'LIVE WINDOW'}
                </span>
              </div>
              <p className="font-label-sm text-on-surface-variant text-[11px]">
                {activeAlert ? `${activeAlert.metric} observed against a limit of ${activeAlert.limit}.` : `${liveData?.summary.uniqueDevices ?? 0} active fingerprints in the rolling Wi-Fi observation window.`}
              </p>
              <div className="pt-space-xs flex items-center justify-between">
                <span className="font-label-sm text-[10px] text-error font-medium">
                  DROPPED: {telemetry.droppedPkts}
                </span>
                <button
                  onClick={onOpenAlertModal}
                  disabled={packets.length === 0}
                  className="bg-primary text-on-primary px-space-md py-space-xs font-label-sm font-bold tracking-wider hover:bg-primary-fixed active:scale-95 transition-all flex items-center gap-1 shadow disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span>INSPECT LATEST PROBE</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Orange Chassis Bottom Fastener detail */}
          <div className="pt-space-md flex items-center justify-between text-on-primary-container/60 text-[10px] font-label-sm border-t border-on-primary-container/20">
            <span>SPEC: MIL-STD-810G</span>
            <span>CALIBRATED: 2025-01-14</span>
            <span>CHASSIS REF 0402-B</span>
          </div>
        </div>
      </div>

      {/* LOWER INSTRUMENT CHASSIS: EVENT LOG STREAM & DECODE BUS */}
      <div className="w-full bg-surface-container-lowest p-space-md space-y-space-md border border-surface-container-high/60">
        {/* Strip Header & Quick Toggles */}
        <div className="flex flex-wrap items-center justify-between gap-space-md border-b border-surface-container-high pb-space-sm">
          <div className="flex items-center gap-space-lg">
            <div className="flex items-center gap-space-sm">
              <span className="w-2 h-2 rounded-full bg-secondary-fixed animate-ping"></span>
              <span className="font-label-md text-primary font-bold tracking-widest uppercase">
                ESP32-S3 DEMODULATED DEVICE STREAM
              </span>
            </div>
            <div className="flex items-center gap-space-xs font-label-sm text-on-surface-variant">
              <span>PORT:</span>
              <span className="text-secondary bg-surface-container px-space-sm py-space-xs border border-surface-container-high font-mono">
                USB SERIAL ({telemetry.baudRate} bps)
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-space-xs font-label-sm text-on-surface-variant">
              <span>ACTIVE INGRESS:</span>
              <span className="text-primary font-mono font-bold">
                {filteredPackets.length} DEVICES
              </span>
            </div>
          </div>

          {/* Trace Stream Mode Actuators */}
          <div className="flex items-center gap-space-sm font-label-sm">
            <button
              onClick={() => {
                if (telemetry.soundEnabled) playRelayClack();
                setConfig((c) => ({ ...c, streamMode: 'live' }));
              }}
              className={`px-space-md py-space-xs font-bold tracking-wider transition-colors border ${
                config.streamMode === 'live'
                  ? 'bg-primary text-on-primary border-primary shadow'
                  : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface border-surface-container-highest'
              }`}
              id="modeLive"
            >
              WI-FI INPUT / {telemetry.sourceStatus}
            </button>
            <button
              onClick={() => {
                if (telemetry.soundEnabled) playRelayClack();
                setConfig((c) => ({ ...c, streamMode: 'demo' }));
              }}
              className={`px-space-md py-space-xs transition-colors border ${
                config.streamMode === 'demo'
                  ? 'bg-primary text-on-primary font-bold border-primary shadow'
                  : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface border-surface-container-highest'
              }`}
              id="modeDemo"
            >
              DEMO CAPTURE
            </button>
            <button
              onClick={() => {
                if (telemetry.soundEnabled) playRelayClack();
                setConfig((c) => ({ ...c, streamMode: 'pause' }));
              }}
              className={`px-space-md py-space-xs transition-colors border ${
                config.streamMode === 'pause'
                  ? 'bg-primary text-on-primary font-bold border-primary shadow'
                  : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface border-surface-container-highest'
              }`}
              id="modePause"
            >
              PAUSE SWEEP
            </button>
          </div>
        </div>

        {/* Real-time Packet Event Stream Table */}
        <div className="w-full overflow-x-auto max-h-[380px] overflow-y-auto">
          <table className="w-full text-left font-label-sm border-collapse">
            <thead className="sticky top-0 bg-surface-container-lowest z-10">
              <tr className="text-on-surface-variant border-b border-surface-container-high uppercase text-[10px] tracking-wider">
                <th className="py-space-xs px-space-md">TIMESTAMP</th>
                <th className="py-space-xs px-space-md">MAC ADDRESS</th>
                <th className="py-space-xs px-space-md">RSSI</th>
                <th className="py-space-xs px-space-md">FINGERPRINT ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-high text-on-surface font-mono text-xs">
              {filteredPackets.length === 0 && <tr><td colSpan={4} className="py-space-lg text-center text-on-surface-variant">Waiting for Wi-Fi probe records…</td></tr>}
              {filteredPackets.slice(0, 15).map((pkt, idx) => {
                const isNewest = idx === 0 && config.streamMode === 'live';
                return (
                  <tr
                    key={pkt.id}
                    className={`hover:bg-surface-container transition-colors group cursor-pointer ${
                      isNewest ? 'bg-surface-container/60' : ''
                    }`}
                    onClick={() => onInspectPacket(pkt)}
                  >
                    <td className="py-space-sm px-space-md text-on-surface-variant">
                      <div className="flex items-center gap-2">
                        {isNewest ? (
                          <span className="w-1.5 h-1.5 rounded-full bg-secondary-fixed animate-ping"></span>
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-surface-container-highest"></span>
                        )}
                        <span>{pkt.timestamp}</span>
                      </div>
                    </td>
                    <td className="py-space-sm px-space-md text-on-surface font-semibold tracking-wide">
                      {pkt.sourceMac}
                    </td>
                    <td className="py-space-sm px-space-md text-secondary font-bold">
                      {pkt.rssi} dBm
                    </td>
                    <td className="py-space-sm px-space-md">
                      <span className="inline-flex items-center gap-1.5 bg-surface-container text-primary font-bold px-space-sm py-0.5 border border-primary/30 tracking-wider">
                        <span className="w-1 h-2 bg-primary"></span>
                        {pkt.fingerprintId}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* BOTTOM TELEMETRY STRIP */}
        <div className="pt-space-sm border-t border-surface-container-high flex flex-wrap items-center justify-between text-on-surface-variant font-label-sm gap-space-md">
          <div className="flex items-center gap-space-lg">
            <span className="flex items-center gap-space-xs">
              <span className="material-symbols-outlined text-[16px] text-secondary">memory</span>
              HARDWARE: <span className="text-on-surface">{telemetry.hardware}</span>
            </span>
            <span className="flex items-center gap-space-xs">
              <span className="material-symbols-outlined text-[16px] text-secondary">schedule</span>
              CLOCK: <span className="text-secondary">{telemetry.ntpStatus}</span>
            </span>
          </div>
          <div className="flex items-center gap-space-lg">
            <span>
              CAPTURE DURATION:{' '}
              <span className="text-on-surface font-semibold">{telemetry.captureDuration}</span>
            </span>
            <span>
              DROPPED PKTS:{' '}
              <span className="text-secondary font-semibold">
                {telemetry.droppedPkts} ({telemetry.totalObservations ? ((telemetry.droppedPkts / telemetry.totalObservations) * 100).toFixed(2) : '0.00'}%)
              </span>
            </span>
            <span className="text-primary font-semibold">
              FIFO HEALTH: {telemetry.fifoHealth}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
