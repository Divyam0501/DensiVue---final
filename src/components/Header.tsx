import React from 'react';
import { Volume2, VolumeX, Camera } from 'lucide-react';
import { CalibrationTelemetry, ScopeConfig, ViewMode } from '../types/oscilloscope';

interface HeaderProps {
  currentView: ViewMode;
  onSelectView: (view: ViewMode) => void;
  telemetry: CalibrationTelemetry;
  config: ScopeConfig;
  onToggleSound: () => void;
  onCycleTrigMode: () => void;
  onSnapshot: () => void;
  sourceStatus: 'connecting' | 'live' | 'stale' | 'offline' | 'waiting' | 'error';
  onRetryTelemetry: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onSelectView,
  telemetry,
  config,
  onToggleSound,
  onCycleTrigMode,
  onSnapshot,
  sourceStatus,
  onRetryTelemetry,
}) => {
  const navTabs: { id: ViewMode; label: string; icon: string }[] = [
    { id: 'analog-trace', label: 'Analog trace', icon: 'show_chart' },
    { id: 'surge-dynamics', label: 'Surge dynamics', icon: 'bolt' },
    { id: 'flow-dwell', label: 'Flow and dwell', icon: 'equalizer' },
    { id: 'spatial-radar', label: 'Spatial radar', icon: 'radar' },
    { id: 'audit', label: 'Audit', icon: 'verified' },
  ];

  return (
    <header className="fixed top-0 left-0 w-full z-50 bg-surface-container-lowest border-b border-surface-container-high shadow-md">
      {/* Top Instrumentation & Hardware Status Row */}
      <div className="h-12 w-full flex items-center justify-between px-margin-desktop border-b border-surface-container-high/40">
        {/* Brand & Bus Link */}
        <div className="flex items-center gap-space-lg">
          <div className="flex items-center gap-space-sm">
            <span className="font-label-lg text-primary tracking-widest font-bold">
              DensiVue
            </span>
            <span className="font-label-sm text-on-surface-variant bg-surface-container px-space-sm py-space-xs rounded border border-surface-container-high">
              LAB-OSCILLOSCOPE 402
            </span>
          </div>

          <div className="h-4 w-px bg-surface-container-high hidden sm:block"></div>

          <div className="flex items-center gap-space-md">
            <div className="flex items-center gap-space-xs bg-surface-container px-space-sm py-space-xs rounded border border-surface-container-high">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  config.streamMode === 'pause'
                    ? 'bg-primary'
                    : sourceStatus === 'live'
                    ? 'bg-secondary-fixed animate-pulse'
                    : 'bg-error'
                }`}
              ></span>
              <span
                title={sourceStatus === 'offline' || sourceStatus === 'stale' ? 'Telemetry unavailable. Use the Retry control on the active view.' : 'Wi-Fi telemetry connection state'}
                className={`font-label-sm ${
                  config.streamMode === 'pause' ? 'text-primary' : sourceStatus === 'live' ? 'text-secondary' : 'text-error'
                }`}
              >
                {config.streamMode === 'pause' ? 'PAUSED' : sourceStatus.toUpperCase()}
              </span>
            </div>
            <div className="flex items-center gap-space-xs font-label-sm text-on-surface-variant">
              <span className="text-primary font-semibold">RF:</span>
              <span>Wi-Fi / CH 6</span>
            </div>
            <div className="hidden md:flex items-center gap-space-xs font-label-sm text-on-surface-variant">
              <span className="text-primary font-semibold">BUS:</span>
              <span>USB SERIAL</span>
            </div>
          </div>
        </div>

        {/* Live Wi-Fi Telemetry Chips */}
        <div className="hidden lg:flex items-center gap-space-lg font-label-sm">
          <div className="flex items-center gap-1.5 bg-surface-container px-space-sm py-1 border border-surface-container-high">
            <span className="text-on-surface-variant text-[10px]">ACTIVE FINGERPRINTS:</span>
            <span className="text-secondary font-mono font-bold">{telemetry.activeDevices}</span>
          </div>
          <div className="flex items-center gap-1.5 bg-surface-container px-space-sm py-1 border border-surface-container-high">
            <span className="text-on-surface-variant text-[10px]">WI-FI PROBES:</span>
            <span className="text-primary font-mono font-bold">{telemetry.wifiRatePps.toFixed(2)} /s</span>
          </div>
          <div className="flex items-center gap-1.5 bg-surface-container px-space-sm py-1 border border-surface-container-high">
            <span className="text-on-surface-variant text-[10px]">MEAN RSSI:</span>
            <span className="text-secondary font-mono font-bold">{telemetry.meanRssi == null ? '--' : `${telemetry.meanRssi.toFixed(1)} dBm`}</span>
          </div>
        </div>

        {/* Right Action Actuators */}
        <div className="flex items-center gap-space-md">
          {(sourceStatus === 'offline' || sourceStatus === 'stale') && (
            <button type="button" onClick={onRetryTelemetry} aria-label="Retry telemetry connection" className="px-space-sm py-space-xs border border-error text-error text-[10px] font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
              RETRY
            </button>
          )}
          {/* Audio Beeper Toggle */}
          <button
            onClick={onToggleSound}
            title={telemetry.soundEnabled ? 'Mute Instrument Audio' : 'Enable Instrument Audio'}
            className={`flex items-center gap-1 px-space-sm py-space-xs border text-label-sm transition-colors ${
              telemetry.soundEnabled
                ? 'bg-surface-container border-primary/40 text-primary'
                : 'bg-surface-container-low border-surface-container-high text-on-surface-variant hover:text-on-surface'
            }`}
          >
            {telemetry.soundEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
            <span className="font-label-sm hidden sm:inline">
              {telemetry.soundEnabled ? 'BEEP ON' : 'BEEP OFF'}
            </span>
          </button>

          {/* Snapshot Button */}
          <button
            onClick={onSnapshot}
            title="Capture CRT Trace Frame"
            className="flex items-center gap-1 bg-surface-container hover:bg-surface-bright text-on-surface border border-surface-container-high px-space-sm py-space-xs text-label-sm transition-colors"
          >
            <Camera size={13} className="text-primary" />
            <span className="font-label-sm hidden sm:inline">DUMP TRACE</span>
          </button>

          {/* Trigger Quick Mode */}
          <button
            onClick={onCycleTrigMode}
            title="Cycle Trigger Mode"
            className="flex items-center gap-space-xs bg-surface-container hover:bg-surface-bright border border-surface-container-high px-space-sm py-space-xs text-on-surface-variant transition-colors"
          >
            <span className="material-symbols-outlined text-[15px] text-secondary">memory</span>
            <span className="font-label-sm text-on-surface font-semibold">
              TRIG: {config.status === 'AUTO' ? 'AUTO' : config.status.startsWith('ARMED') ? 'ARMED' : 'NORM'}
            </span>
          </button>

          {/* User / Operator Badge */}
          <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shadow-md">
            <span className="material-symbols-outlined text-on-primary text-[16px]">person</span>
          </div>
        </div>
      </div>

      {/* Full-Width Top Navigation Bar Row (taking up all the width of the screen) */}
      <nav className="w-full grid grid-cols-5 bg-surface-container-low border-t border-surface-container-high/60">
        {navTabs.map((tab) => {
          const isActive = currentView === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectView(tab.id)}
              className={`relative py-2.5 px-3 flex items-center justify-center gap-2 transition-all border-r border-surface-container-high/50 last:border-r-0 ${
                isActive
                  ? 'bg-primary-container text-on-primary-container font-bold shadow-inner'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
              }`}
            >
              {/* Active top amber line marker */}
              {isActive && (
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary shadow-[0_0_8px_#f07816]"></div>
              )}
              <span className="material-symbols-outlined text-[18px]">
                {tab.icon}
              </span>
              <span className="font-label-md tracking-wider uppercase truncate">
                {tab.label}
              </span>
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-on-primary-container/80 animate-ping hidden md:inline-block"></span>
              )}
            </button>
          );
        })}
      </nav>
    </header>
  );
};
