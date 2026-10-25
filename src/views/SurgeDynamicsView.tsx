import React, { useState, useEffect, useRef } from 'react';
import { CalibrationTelemetry, PacketEvent, DensiVueTelemetry } from '../types/oscilloscope';
import { playRelayClack, playTactileClick } from '../utils/audioFeedback';

interface SurgeObservation {
  id: string;
  timestamp: string;
  mac: string;
  channel: string;
  rssi: number;
  surgeWeight: string;
  chokeVector: string;
  stateFlag: string;
  flagType: 'surge' | 'bottleneck' | 'tracking' | 'escalation';
}

interface SurgeDynamicsViewProps {
  telemetry: CalibrationTelemetry;
  packets: PacketEvent[];
  onInspectPacket: (packet: PacketEvent) => void;
  liveData: DensiVueTelemetry | null;
}

export const SurgeDynamicsView: React.FC<SurgeDynamicsViewProps> = ({
  telemetry,
  packets,
  onInspectPacket,
  liveData,
}) => {
  const inflowVelocity = liveData?.surge.inflowPerMinute ?? 0;
  const countdownSeconds = liveData?.surge.secondsToBreach ?? null;
  const [streamMode, setStreamMode] = useState<'live' | 'demo' | 'pause'>('live');
  const surgeRows: SurgeObservation[] = (liveData?.surge.observations ?? []).map((device, index) => {
    const core = device.distanceM < 1.5;
    return {
      id: `${device.deviceId}-${index}`,
      timestamp: new Date(device.timestamp).toLocaleTimeString('en-GB', { hour12: false }),
      mac: device.mac, channel: 'CH 06', rssi: device.rssi,
      surgeWeight: `${device.hits} probes / window`,
      chokeVector: `${device.distanceCapped ? '>5.0' : device.distanceM.toFixed(1)} M RSSI ESTIMATE`,
      stateFlag: core ? '■ CORE ZONE' : '● TRACKING',
      flagType: core ? 'bottleneck' : 'tracking',
    };
  });

  // Format countdown seconds into MM:SS
  const formatCountdown = (secs: number | null) => {
    if (secs == null || !Number.isFinite(secs)) return '--:--';
    const safeSecs = Math.max(0, Math.floor(secs));
    const m = Math.floor(safeSecs / 60);
    const s = safeSecs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Convert inflow velocity (0 to 50) to tachometer angle in degrees (0 to 180 deg)
  // Center is at 230, 185; Radius is 145
  // Needle position is driven by the backend rate estimate
  const velocityClamped = Math.max(0, Math.min(50, inflowVelocity));
  const needleAngleDeg = (velocityClamped / 50) * 180; // 0 deg at left, 180 deg at right
  const rad = (needleAngleDeg * Math.PI) / 180;
  const needleLen = 130;
  const cx = 230;
  const cy = 185;
  const needleTipX = cx - needleLen * Math.cos(rad);
  const needleTipY = cy - needleLen * Math.sin(rad);

  return (
    <div className="w-full max-w-[1520px] mx-auto py-space-sm space-y-space-md select-none">
      {/* SUB-HEADER CHASSIS STRIP */}
      <div className="w-full bg-surface-container-low px-margin-desktop py-space-sm flex flex-wrap items-center justify-between gap-space-sm shadow-[inset_0_-1px_0_rgba(255,255,255,0.06)] border border-surface-container-high/60">
        <div className="flex items-center gap-space-sm flex-wrap">
          <span className="w-2.5 h-2.5 bg-primary-container shadow-[0_0_8px_#f07816]"></span>
          <span className="font-label-md uppercase tracking-wider text-on-surface font-bold">
            DENSI-SURGE 402B <span className="text-on-surface-variant font-normal">SER: 884-X992-RF</span>
          </span>
          <span className="text-surface-variant">|</span>
          <span className="font-label-sm uppercase tracking-widest text-primary font-semibold">
            REAL-TIME INFLOW &amp; STAMPEDE THREAT VECTOR ANALYZER
          </span>
        </div>

        {/* Active telemetry badge row */}
        <div className="flex items-center flex-wrap gap-space-xs font-label-sm">
          <div className="bg-surface-container-lowest px-space-sm py-space-xs flex items-center gap-space-xs border border-surface-container-high">
            <span className="text-on-surface-variant">INFLOW VELOCITY:</span>
            <span className="text-primary font-bold tracking-wider font-mono">
              {inflowVelocity >= 0 ? '+' : ''}{inflowVelocity.toFixed(1)} pers/min
            </span>
          </div>
          <div className="bg-surface-container-lowest px-space-sm py-space-xs flex items-center gap-space-xs border border-surface-container-high">
            <span className="text-on-surface-variant">SURGE ACCELERATION:</span>
            <span className="text-primary-container font-bold tracking-wider font-mono flex items-center">
              {liveData?.surge.accelerationPerSecond != null && liveData.surge.accelerationPerSecond >= 0 ? '▲ +' : '▼ '}{liveData?.surge.accelerationPerSecond?.toFixed(3) ?? '0.000'} pers/min/s
            </span>
          </div>
          <div className="bg-primary-container text-on-primary-container px-space-sm py-space-xs font-bold tracking-wider uppercase shadow-[0_0_6px_rgba(240,120,22,0.4)]">
            HAZARD: {liveData?.surge.capacity != null && liveData.surge.capacity >= liveData.surge.capacityLimit ? 'CAPACITY LIMIT' : inflowVelocity > 25 ? 'RISING INFLOW' : 'MONITORING'}
          </div>
          <div className="bg-surface-container-high px-space-sm py-space-xs border border-surface-container-highest text-primary-fixed flex items-center gap-space-xs">
            <span className="material-symbols-outlined text-[13px] text-primary">warning</span>
            <span>ZONE: RSSI-DERIVED PROXIMITY</span>
          </div>
          <div className="bg-surface-container-lowest px-space-sm py-space-xs flex items-center gap-space-xs border border-surface-container-high text-secondary-fixed">
            <span className="w-1.5 h-1.5 rounded-full bg-secondary-fixed animate-pulse"></span>
            <span>SOURCE: {telemetry.sourceStatus}</span>
            <span className="text-surface-variant">|</span>
            <span className="text-secondary font-bold">COUNT ESTIMATE</span>
          </div>
        </div>
      </div>

      {/* MAIN DUAL-COLUMN WORKSPACE */}
      <div className="w-full grid grid-cols-1 xl:grid-cols-12 gap-space-md">
        {/* LEFT/CENTER COLUMN: CRT DISPLAY (~60% -> col-span-7 on 12-col) */}
        <div className="xl:col-span-7 flex flex-col bg-surface-container-lowest p-space-xs shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08),inset_0_4px_16px_rgba(0,0,0,0.95)] border border-surface-container-high">
          {/* CRT Bezel Header Plate */}
          <div className="bg-surface-container-low px-space-md py-space-xs flex items-center justify-between font-label-sm border-b border-surface-container-high/60">
            <div className="flex items-center gap-space-sm">
              <span className="w-2 h-2 bg-secondary-fixed rounded-sm shadow-[0_0_6px_#79ff5b]"></span>
              <span className="text-on-surface font-bold tracking-wider uppercase">
                DYNAMIC INFLOW VELOCITY MONITOR // 10×8 RETICLE
              </span>
            </div>
            <div className="flex items-center gap-space-md text-on-surface-variant">
              <span>BEAM: <span className="text-primary font-mono">14.2 kV</span></span>
              <span>PERSISTENCE: <span className="text-secondary font-mono">420ms</span></span>
              <span>SWEEP: <span className="text-secondary font-mono">250ms (CONT)</span></span>
            </div>
          </div>

          {/* Recessed Phosphor Screen with CRT Scanline Effect */}
          <div className="relative w-full bg-[#050806] p-space-md overflow-hidden flex flex-col justify-between shadow-[inset_0_0_40px_rgba(0,0,0,0.95),inset_0_0_8px_rgba(47,248,1,0.06)] min-h-[560px] border border-[#222222]">
            {/* 10x8 Reticle Grid overlay */}
            <div
              className="absolute inset-0 pointer-events-none opacity-20"
              style={{
                backgroundImage:
                  'linear-gradient(to right, #2a0e08 1px, transparent 1px), linear-gradient(to bottom, #2a0e08 1px, transparent 1px)',
                backgroundSize: '10% 12.5%',
              }}
            ></div>
            {/* Center Axes */}
            <div className="absolute inset-x-0 top-1/2 h-[1px] bg-[#574236] pointer-events-none opacity-40"></div>
            <div className="absolute inset-y-0 left-1/2 w-[1px] bg-[#574236] pointer-events-none opacity-40"></div>

            {/* UPPER HALF: Tachometer / Dynamic Arc Dial */}
            <div className="relative z-10 w-full flex flex-col items-center pt-space-xs">
              <div className="w-full flex items-center justify-between font-label-sm px-space-md mb-space-xs">
                <span className="text-primary font-bold tracking-widest uppercase bg-surface-container-low px-space-xs py-space-xs border border-surface-container-high">
                  CH1: TACHOMETER DERIVATIVE
                </span>
                <span className="text-on-surface-variant tracking-wider font-mono">
                  WINDOW: 60s RUNNING RECURSION
                </span>
              </div>

              {/* Circular Arc SVG Instrument Gauge */}
              <div className="relative w-full max-w-[480px] h-[220px] flex items-center justify-center">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 460 215">
                  <defs>
                    <linearGradient id="needle-grad" x1="0%" y1="100%" x2="0%" y2="0%">
                      <stop offset="0%" stopColor="#8a3e08" />
                      <stop offset="70%" stopColor="#f07816" />
                      <stop offset="100%" stopColor="#ffb68a" />
                    </linearGradient>
                  </defs>

                  {/* Subdued background track (center: 230, 185; radius: 145) */}
                  <path
                    d="M 85 185 A 145 145 0 0 1 375 185"
                    fill="none"
                    stroke="#191c18"
                    strokeWidth="8"
                    strokeLinecap="round"
                  />

                  {/* Sleek Arc Bands: 0 to 15 (Green), 15 to 25 (Amber), 25 to 50 (Red) */}
                  <path
                    d="M 85 185 A 145 145 0 0 1 145 68"
                    fill="none"
                    stroke="#2ae500"
                    strokeWidth="6"
                    strokeLinecap="round"
                    opacity="0.95"
                  />
                  <path
                    d="M 149 65 A 145 145 0 0 1 226 40"
                    fill="none"
                    stroke="#f07816"
                    strokeWidth="6.5"
                    opacity="0.95"
                  />
                  <path
                    d="M 234 40 A 145 145 0 0 1 375 185"
                    fill="none"
                    stroke="#ff5252"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray="6 3"
                    opacity="0.9"
                  />

                  {/* Ticks */}
                  <g strokeLinecap="round">
                    <line x1="112" y1="101" x2="118" y2="106" stroke="#574236" strokeWidth="1.5" />
                    <line x1="151" y1="63" x2="155" y2="70" stroke="#f07816" strokeWidth="1.5" />
                    <line x1="309" y1="63" x2="305" y2="70" stroke="#ff5252" strokeWidth="1.5" />
                    <line x1="348" y1="101" x2="342" y2="106" stroke="#ff5252" strokeWidth="1.5" />

                    <line x1="72" y1="185" x2="82" y2="185" stroke="#79ff5b" strokeWidth="2.5" />
                    <line x1="104" y1="115" x2="112" y2="121" stroke="#79ff5b" strokeWidth="2.5" />
                    <line x1="175" y1="55" x2="179" y2="65" stroke="#f07816" strokeWidth="2.5" />
                    <line x1="230" y1="30" x2="230" y2="42" stroke="#ff5252" strokeWidth="2.5" />
                    <line x1="285" y1="55" x2="281" y2="65" stroke="#ffb4ab" strokeWidth="2.5" />
                    <line x1="356" y1="115" x2="348" y2="121" stroke="#ffb4ab" strokeWidth="2.5" />
                    <line x1="388" y1="185" x2="378" y2="185" stroke="#ffb4ab" strokeWidth="2.5" />
                  </g>

                  {/* Radially offset labels */}
                  <g fontFamily="JetBrains Mono" fontSize="11" fontWeight="700" textAnchor="middle">
                    <text x="54" y="189" fill="#79ff5b">0</text>
                    <text x="88" y="110" fill="#79ff5b">10</text>
                    <text x="165" y="43" fill="#f07816">20</text>
                    <text x="230" y="22" fill="#ff5252">25</text>
                    <text x="295" y="43" fill="#ffb4ab">30</text>
                    <text x="372" y="110" fill="#ffb4ab">40</text>
                    <text x="406" y="189" fill="#ffb4ab">50</text>
                  </g>

                  {/* Dynamic Needle pointing to current velocity */}
                  <g className="transition-all duration-300 ease-out">
                    <line
                      x1={cx}
                      y1={cy}
                      x2={needleTipX}
                      y2={needleTipY}
                      stroke="#ffb68a"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  </g>

                  {/* Pivot Hub */}
                  <circle cx="230" cy="185" r="10" fill="#0c0f0b" stroke="#574236" strokeWidth="2" />
                  <circle cx="230" cy="185" r="6.5" fill="#1d201c" stroke="#f07816" strokeWidth="1.5" />
                  <circle cx="230" cy="185" r="3" fill="#ffb68a" />
                </svg>

                {/* Central Digital Readout */}
                <div className="absolute bottom-0 flex flex-col items-center pointer-events-none">
                  <span className="font-display-lg text-[2.5rem] leading-none text-primary tracking-tighter font-bold drop-shadow-[0_0_12px_rgba(240,120,22,0.7)] font-mono">
                    +{inflowVelocity.toFixed(1)}
                  </span>
                  <span className="font-label-sm text-[9px] uppercase tracking-widest text-primary-fixed mt-[2px]">
                    ΔN/Δt INFLOW VELOCITY (PERS / MIN)
                  </span>
                </div>

                {/* Secondary Flanking Badges */}
                <div className="absolute left-1 bottom-1 bg-surface-container-lowest/90 px-space-sm py-[2px] border border-surface-container flex flex-col">
                  <span className="font-label-sm text-[8px] uppercase tracking-wider text-outline">BASE RATE</span>
                  <span className="font-label-md text-[11px] text-secondary-fixed font-bold leading-tight font-mono">
                    +8.2 <span className="text-[8px] font-normal text-outline">p/m</span>
                  </span>
                </div>
                <div className="absolute right-1 bottom-1 bg-surface-container-lowest/90 px-space-sm py-[2px] border border-surface-container flex flex-col items-end">
                  <span className="font-label-sm text-[8px] uppercase tracking-wider text-outline">MAX PEAK (03:12)</span>
                  <span className="font-label-md text-[11px] text-error font-bold leading-tight font-mono">
                    +28.4 <span className="text-[8px] font-normal text-outline">p/m</span>
                  </span>
                </div>
              </div>

              {/* Sector Legend Badges under arc */}
              <div className="grid grid-cols-3 gap-space-xs w-full max-w-[480px] mt-space-xs">
                <div className="bg-surface-container-lowest px-space-xs py-space-xs border border-surface-container-high flex items-center justify-between font-label-sm text-[9px]">
                  <span className="text-secondary-fixed font-bold">● 0-15</span>
                  <span className="text-on-surface-variant">NOMINAL</span>
                </div>
                <div className="bg-surface-container px-space-xs py-space-xs border border-primary/30 flex items-center justify-between font-label-sm text-[9px] text-primary">
                  <span className="font-bold">▲ 15-25</span>
                  <span className="font-bold">WARNING</span>
                </div>
                <div className="bg-surface-container-lowest px-space-xs py-space-xs border border-error/30 flex items-center justify-between font-label-sm text-[9px] text-error">
                  <span className="font-bold">■ 25-50</span>
                  <span>CRITICAL</span>
                </div>
              </div>
            </div>

            {/* RETICLE HORIZONTAL SEPARATOR */}
            <div className="relative w-full h-[1px] bg-outline-variant my-space-md opacity-40"></div>

            {/* LOWER HALF: Oscilloscope Inflow Waveform vs Critical Choke Threshold */}
            <div className="relative z-10 w-full flex flex-col flex-1 pt-space-xs">
              <div className="flex items-center justify-between font-label-sm text-on-surface-variant mb-space-xs">
                <div className="flex items-center gap-space-sm">
                  <span className="text-primary font-bold">WAVEFORM REPOSITORY: TRACE-A</span>
                  <span className="text-outline">COUPLING: DC</span>
                </div>
                <div className="flex items-center gap-space-xs text-error font-bold">
                  <span className="w-2 h-2 rounded-full bg-error animate-ping"></span>
                  <span>THRESHOLD ALERT ARMED</span>
                </div>
              </div>

              {/* Oscilloscope Waveform Well */}
              <div className="relative w-full h-44 bg-[#020402] border border-[#222222] overflow-hidden shadow-[inset_0_0_12px_rgba(0,0,0,0.9)] flex items-center">
                {/* 25px Grid */}
                <div
                  className="absolute inset-0 pointer-events-none opacity-20"
                  style={{
                    backgroundImage:
                      'linear-gradient(to right, #2a0e08 1px, transparent 1px), linear-gradient(to bottom, #2a0e08 1px, transparent 1px)',
                    backgroundSize: '25px 25px',
                  }}
                ></div>

                {/* Critical Choke Threshold Line at 28% height (+25 pers/min) */}
                <div className="absolute inset-x-0 top-[28%] flex items-center z-10">
                  <div className="w-full border-b border-dashed border-error opacity-90"></div>
                  <div className="absolute right-3 -top-2 bg-error text-[#111410] px-space-xs py-[1px] font-label-sm text-[9px] font-bold tracking-wider">
                    --- CRITICAL CHOKE THRESHOLD (+25 pers/min) ---
                  </div>
                </div>

                <div className="absolute left-1 bottom-4 font-label-sm text-[9px] text-outline flex items-center gap-[2px]">
                  <span className="material-symbols-outlined text-[10px]">arrow_right</span>
                  <span>GND 0.0</span>
                </div>

                {/* Smooth Curve SVG */}
                <svg className="relative w-full h-full" preserveAspectRatio="none" viewBox="0 0 600 160">
                  <path
                    d="M 0 135 Q 30 130 50 120 T 100 130 T 150 115 T 200 125 T 250 95 T 300 100 T 350 75 T 400 85 T 450 58 T 500 50 T 540 45 L 570 42 L 600 40"
                    fill="none"
                    opacity="0.3"
                    stroke="#f07816"
                    strokeLinecap="round"
                    strokeWidth="4"
                  />
                  <path
                    d="M 0 135 Q 30 130 50 120 T 100 130 T 150 115 T 200 125 T 250 95 T 300 100 T 350 75 T 400 85 T 450 58 T 500 50 T 540 45 L 570 42 L 600 40"
                    fill="none"
                    stroke="#ffb68a"
                    strokeLinecap="round"
                    strokeWidth="1.8"
                  />
                  {/* Electron beam head */}
                  <circle cx="600" cy="40" fill="#2ff801" r="4" />
                  <line x1="600" x2="600" y1="0" y2="160" stroke="#79ff5b" strokeWidth="1" strokeDasharray="2 2" opacity="0.6" />
                </svg>

                {/* Inflection Annotation */}
                <div className="absolute left-[360px] top-[40%] bg-surface-container-lowest/90 px-space-xs py-[2px] border border-primary/40 font-label-sm text-[9px] text-primary flex items-center gap-space-xs pointer-events-none">
                  <span>t-15s: INFLECTION</span>
                  <span className="text-error font-bold font-mono">+18.6 p/m</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: STAMPEDE EARLY WARNING & CHOKE DYNAMICS MODULE (~40% -> col-span-5) */}
        <div className="xl:col-span-5 flex flex-col gap-space-sm bg-surface-container-lowest p-space-xs shadow-[inset_0_0_0_1px_rgba(240,120,22,0.6)] border border-primary/40">
          {/* Module Header Bar (Solid Amber Instrument Banner) */}
          <div className="bg-primary-container px-space-md py-space-xs flex items-center justify-between text-on-primary-container shadow-[0_0_8px_rgba(240,120,22,0.3)]">
            <div className="flex items-center gap-space-xs font-bold tracking-wider font-label-md uppercase">
              <span className="material-symbols-outlined text-[16px]">warning</span>
              <span>STAMPEDE THREAT &amp; CORRIDOR CHOKE MODULE</span>
            </div>
            <div className="flex items-center gap-space-xs bg-surface-container-lowest px-space-xs py-[2px] text-secondary font-label-sm text-[9px] font-bold border border-secondary/30">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary-fixed animate-pulse"></span>
              <span>FIFO: ARMED</span>
            </div>
          </div>

          <div className="flex flex-col gap-space-sm p-space-xs">
            {/* CARD 1: PREDICTIVE TIME-TO-BREACH COUNTDOWN */}
            <div className="bg-surface-container-low p-space-md flex flex-col gap-space-xs relative overflow-hidden border border-surface-container-high shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]">
              <div className="flex items-center justify-between">
                <span className="font-label-sm uppercase tracking-widest text-outline">
                  PREDICTIVE TIME-TO-BREACH CLOCK
                </span>
                <span className="font-label-sm text-[9px] bg-error-container text-on-error-container px-space-xs py-[1px] font-bold uppercase animate-pulse border border-error/40">
                  ZONE LIMIT WARNING
                </span>
              </div>

              {/* Digital Clock Big Phosphor Segment */}
              <div className="flex items-baseline justify-between mt-space-xs">
                <div className="flex items-center gap-space-sm">
                  <div className="font-display-lg text-[3.8rem] leading-none font-bold text-primary tracking-tight drop-shadow-[0_0_12px_rgba(240,120,22,0.7)] font-mono">
                    {formatCountdown(countdownSeconds)}
                  </div>
                </div>
                <div className="flex flex-col items-end font-label-sm">
                  <span className="text-error font-bold text-xs">RATE: RUNAWAY</span>
                  <span className="text-on-surface-variant text-[11px] font-mono">LIMIT: 50 PERS</span>
                </div>
              </div>

              <div className="bg-surface-container-lowest px-space-sm py-space-xs flex items-center justify-between font-label-sm text-primary-fixed mt-space-xs border border-surface-container-high">
                <div className="flex items-center gap-space-xs">
                  <span className="w-2 h-2 rounded-full bg-error animate-ping"></span>
                  <span className="font-bold text-error">
                    {countdownSeconds == null ? 'NO BREACH ETA: INFLOW NOT RISING' : `${formatCountdown(countdownSeconds)} REMAINING TO CAPACITY LIMIT`}
                  </span>
                </div>
                <span className="text-on-surface-variant text-[10px] font-mono">99.4% CONFIDENCE</span>
              </div>
            </div>

            {/* CARD 2: SPLIT TELEMETRY GRID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm">
              {/* Sub-card A: Surge Acceleration */}
              <div className="bg-surface-container-low p-space-md flex flex-col justify-between border border-surface-container-high">
                <div className="flex items-center justify-between">
                  <span className="font-label-sm text-[10px] uppercase text-outline">
                    INFLOW ACCELERATION ESTIMATE
                  </span>
                  <span className="material-symbols-outlined text-primary text-[14px]">speed</span>
                </div>
                <div className="my-space-sm">
                  <span className="font-headline-lg font-bold text-primary font-display-lg block leading-none font-mono">
                    {liveData?.surge.accelerationPerSecond != null && liveData.surge.accelerationPerSecond > 0 ? '+' : ''}{liveData?.surge.accelerationPerSecond?.toFixed(3) ?? '0.000'}
                  </span>
                  <span className="font-label-sm text-on-surface-variant tracking-wider uppercase">
                    PERS / MIN / SEC
                  </span>
                </div>
                <div className="bg-surface-container-lowest px-space-xs py-space-xs border border-surface-container-high flex items-center justify-between font-label-sm">
                  <span className="text-primary-container font-bold flex items-center gap-space-xs">
                    {inflowVelocity > 0 ? '▲ ACCELERATING' : inflowVelocity < 0 ? '▼ EASING' : '● STEADY'}
                  </span>
                  <span className="text-error font-bold font-mono">{Math.abs(inflowVelocity).toFixed(1)} /min</span>
                </div>
              </div>

              {/* Sub-card B: Zone Occupancy Capacity */}
              <div className="bg-surface-container-low p-space-md flex flex-col justify-between border border-surface-container-high">
                <div className="flex items-center justify-between">
                  <span className="font-label-sm text-[10px] uppercase text-outline">
                    ZONE OCCUPANCY CAPACITY
                  </span>
                  <span className="font-label-sm text-primary font-bold font-mono">({liveData?.surge.capacity ?? 0} / {liveData?.surge.capacityLimit ?? 50} devices)</span>
                </div>
                <div className="my-space-sm flex items-baseline gap-space-xs">
                  <span className="font-headline-lg font-bold text-primary font-display-lg leading-none font-mono">
                    {Math.round(((liveData?.surge.capacity ?? 0) / Math.max(1, liveData?.surge.capacityLimit ?? 50)) * 100)}%
                  </span>
                  <span className="font-label-sm text-error uppercase font-bold tracking-wider">
                    {(liveData?.surge.capacity ?? 0) >= (liveData?.surge.capacityLimit ?? 50) ? 'LIMIT REACHED' : 'RSSI ESTIMATE'}
                  </span>
                </div>
                {/* Segmented 10-step Physical LED Progress Bar */}
                <div className="flex items-center gap-[3px] w-full pt-space-xs" aria-label={`Capacity ${liveData?.surge.capacity ?? 0} of ${liveData?.surge.capacityLimit ?? 50}`}>
                  {Array.from({ length: 10 }, (_, index) => {
                    const percent = ((liveData?.surge.capacity ?? 0) / Math.max(1, liveData?.surge.capacityLimit ?? 50)) * 100;
                    const filled = index < Math.ceil(percent / 10);
                    return <span key={index} className={`h-3 flex-1 ${filled ? percent >= 90 ? 'bg-error animate-pulse shadow-[0_0_6px_#ffb4ab]' : 'bg-primary-container shadow-[0_0_4px_#f07816]' : 'bg-surface-container-high'}`}></span>;
                  })}
                </div>
              </div>
            </div>

            {/* CARD 3: HIGH-VISIBILITY CORRIDOR STATUS BADGE */}
            <div className="bg-primary-container text-on-primary-container p-space-md flex flex-col sm:flex-row items-center justify-between gap-space-sm shadow-[0_0_12px_rgba(240,120,22,0.4)] my-space-xs">
              <div className="flex items-center gap-space-sm">
                <span className="material-symbols-outlined text-[24px]">crisis_alert</span>
                <div className="flex flex-col">
                  <span className="font-label-md font-bold uppercase tracking-wider">
                    {inflowVelocity > 25 ? '▲ RISING WI-FI OBSERVATION RATE' : '● WI-FI CROWD MONITOR'}
                  </span>
                  <span className="font-label-sm text-[10px] opacity-90 tracking-wide uppercase">
                    Single-sensor fingerprint count and RSSI zone estimates
                  </span>
                </div>
              </div>
              <span className="bg-surface-container-lowest text-primary font-label-sm uppercase px-space-md py-space-xs font-bold tracking-wider shrink-0 border border-primary/40">MONITORING ONLY</span>
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM CONSOLE STREAM & TELEMETRY ALERT TICKER */}
      <div className="w-full pb-space-md flex flex-col gap-space-xs">
        {/* Console Bar Header with Stream Controls */}
        <div className="w-full bg-surface-container-low px-space-md py-space-xs flex flex-wrap items-center justify-between gap-space-sm border border-surface-container-high">
          <div className="flex items-center gap-space-sm">
            <span className="w-2 h-2 rounded-full bg-secondary-fixed animate-ping"></span>
            <span className="font-label-sm uppercase font-bold tracking-wider text-on-surface">
              ESP32 DEVICE OBSERVATION STREAM // FIELDS: TIMESTAMP · MAC · RSSI · FINGERPRINT ID
            </span>
          </div>
          <div className="flex items-center gap-space-xs font-label-sm">
            <button
              onClick={() => {
                playRelayClack();
                setStreamMode('live');
              }}
              className={`px-space-sm py-[2px] uppercase font-bold flex items-center gap-space-xs border transition-colors ${
                streamMode === 'live'
                  ? 'bg-primary text-on-primary border-primary'
                  : 'bg-surface-container text-secondary-fixed border-surface-container-high hover:bg-surface-container-high'
              }`}
            >
              <span className="material-symbols-outlined text-[12px]">sensors</span>
              LIVE RF STREAM
            </button>
            <button
              onClick={() => {
                playRelayClack();
                setStreamMode('demo');
              }}
              className={`px-space-sm py-[2px] uppercase border transition-colors ${
                streamMode === 'demo'
                  ? 'bg-primary text-on-primary font-bold border-primary'
                  : 'bg-surface-container text-on-surface-variant border-surface-container-high hover:bg-surface-container-high'
              }`}
            >
              DEMO CAPTURE
            </button>
            <button
              onClick={() => {
                playRelayClack();
                setStreamMode('pause');
              }}
              className={`px-space-sm py-[2px] uppercase border transition-colors ${
                streamMode === 'pause'
                  ? 'bg-primary text-on-primary font-bold border-primary'
                  : 'bg-surface-container text-tertiary border-surface-container-high hover:bg-surface-container-high'
              }`}
            >
              PAUSE SWEEP
            </button>
          </div>
        </div>

        {/* Alert Ticker Banner */}
        <div className="w-full bg-surface-container-lowest px-space-md py-space-sm border border-primary-container flex items-center gap-space-sm shadow-[0_0_8px_rgba(240,120,22,0.25)]">
          <span className="material-symbols-outlined text-primary-container text-[20px] shrink-0 animate-pulse">
            crisis_alert
          </span>
          <span className="font-label-sm text-primary tracking-wide">
            <strong className="font-bold text-primary-fixed">▲ WARNING:</strong> Rapid inflow surge detected at Gate 3 Turnstile Bank. Stampede Hazard countdown armed (02:45). Bottleneck corridor limit approaching critical density (39/50 PERS).
          </span>
        </div>

        {/* Demodulation Packet Event Stream (Monospace Telemetry) */}
        <div className="w-full bg-surface-container-lowest font-label-sm text-[11px] p-space-sm flex flex-col gap-[2px] shadow-[inset_0_2px_8px_rgba(0,0,0,0.9)] overflow-x-auto border border-surface-container-high">
          <div className="grid grid-cols-12 gap-space-xs py-[3px] px-space-xs text-on-surface-variant border-b border-surface-container font-bold text-[9px] uppercase tracking-wider">
            <span className="col-span-2">TIMESTAMP</span>
            <span className="col-span-2">TRANSMITTER MAC</span>
            <span className="col-span-1">CHANNEL</span>
            <span className="col-span-1">RSSI</span>
            <span className="col-span-2">SURGE WEIGHT</span>
            <span className="col-span-2">CHOKE VECTOR</span>
            <span className="col-span-2 text-right">STATE FLAG</span>
          </div>

          {/* Observations Rows */}
          {surgeRows.length === 0 && <div className="px-space-sm py-space-md text-on-surface-variant font-mono text-xs">Waiting for Wi-Fi probe records…</div>}
          {surgeRows.map((row, idx) => (
            <div
              key={row.id}
              className={`grid grid-cols-12 gap-space-xs py-[3px] px-space-xs hover:bg-surface-container transition-colors text-on-surface font-mono ${
                idx === 0 && streamMode === 'live' ? 'bg-surface-container/50' : ''
              }`}
            >
              <span className="col-span-2 text-outline flex items-center gap-1.5">
                {idx === 0 && streamMode === 'live' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary-fixed animate-ping"></span>
                )}
                <span>{row.timestamp}</span>
              </span>
              <span className="col-span-2 text-primary-fixed font-bold">{row.mac}</span>
              <span className="col-span-1 text-secondary-fixed">{row.channel}</span>
              <span
                className={`col-span-1 font-bold ${
                  row.rssi > -50 ? 'text-secondary-fixed' : 'text-error'
                }`}
              >
                {row.rssi} dBm
              </span>
              <span className="col-span-2 text-primary font-bold">{row.surgeWeight}</span>
              <span className="col-span-2 text-on-surface-variant truncate">{row.chokeVector}</span>
              <span
                className={`col-span-2 text-right font-bold ${
                  row.flagType === 'surge'
                    ? 'text-primary-container'
                    : row.flagType === 'bottleneck'
                    ? 'text-error'
                    : row.flagType === 'escalation'
                    ? 'text-error'
                    : 'text-secondary-fixed'
                }`}
              >
                {row.stateFlag}
              </span>
            </div>
          ))}
        </div>

        {/* Bottom Physical Hardware Metric Line */}
        <div className="w-full bg-surface-container-low px-space-md py-space-xs flex flex-wrap items-center justify-between font-label-sm text-[9px] text-on-surface-variant border border-surface-container-high/60">
          <div className="flex items-center gap-space-md flex-wrap font-mono">
            <span>RECORD: <span className="text-secondary-fixed font-bold">CONTINUOUS</span></span>
            <span>BUFFER: <span className="text-on-surface">{telemetry.bufferUsedRecords} / {telemetry.bufferCapacityRecords} records</span></span>
            <span>SOURCE: <span className="text-primary-fixed">{telemetry.sourceStatus}</span></span>
            <span>BAUD: <span className="text-on-surface">{telemetry.baudRate} bps</span></span>
          </div>
          <div className="flex items-center gap-space-md flex-wrap font-mono">
            <span>CRC: <span className="text-secondary-fixed font-bold">PASSED (0 ERR)</span></span>
            <span>ACTIVE DEVICES: <span className="text-primary font-bold">{liveData?.summary.uniqueDevices ?? 0}</span></span>
            <span>JITTER: <span className="text-tertiary">1.12 ps</span></span>
            <span className="text-primary-container font-bold">RACK SYS OK</span>
          </div>
        </div>
      </div>
    </div>
  );
};
