/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ViewMode, ScopeConfig, SpectrumConfig, CalibrationTelemetry, PacketEvent } from './types/oscilloscope';
import { useDensiVueTelemetry } from './hooks/useDensiVueTelemetry';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { HexDumpModal } from './components/HexDumpModal';
import { AlertDetailModal } from './components/AlertDetailModal';
import { AnalogTraceView } from './views/AnalogTraceView';
import { SurgeDynamicsView } from './views/SurgeDynamicsView';
import { SpectrumAnalyzerView } from './views/SpectrumAnalyzerView';
import { ProtocolBusView } from './views/ProtocolBusView';
import { CalibrationView } from './views/CalibrationView';
import { playRelayClack, playTactileClick } from './utils/audioFeedback';

export default function App() {
  const [currentView, setCurrentView] = useState<ViewMode>('analog-trace');
  const [inspectingPacket, setInspectingPacket] = useState<PacketEvent | null>(null);
  const [alertModalOpen, setAlertModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const { data: liveData, state: connectionState, retry: retryTelemetry } = useDensiVueTelemetry();

  // Scope Configuration State
  const [scopeConfig, setScopeConfig] = useState<ScopeConfig>({
    timeDiv: '25ms',
    trigLevelMv: 140,
    trigSlope: 'POS (+)',
    status: 'ARMED / TRIGGERED',
    probeAtten: '10X',
    coupling: 'AC 50Ω',
    offsetV: 0.0,
    ch1VoltsDiv: 100,
    ch2VoltsDiv: 50,
    triggerSensPercent: 72,
    triggerSensDb: 1.4,
    sampleRate: 'Wi-Fi / CH 6',
    noiseFloorDbm: -94,
    isPaused: false,
    streamMode: 'live',
    filterType: 'all',
  });

  // Spectrum Analyzer Config State
  const [spectrumConfig, setSpectrumConfig] = useState<SpectrumConfig>({
    centerFreqMhz: 2442.0,
    spanMhz: 100,
    rbwKhz: 100,
    vbwKhz: 30,
    detector: 'Peak',
    averaging: 16,
    marker1Freq: 2437.0,
    marker2Freq: 2462.0,
    waterfallSpeed: 1,
  });

  // Hardware readings are limited to fields actually present in the Wi-Fi sniffer stream.
  const [telemetry, setTelemetry] = useState<CalibrationTelemetry>({
    activeDevices: 0, meanRssi: null, sourceStatus: 'CONNECTING',
    wifiRatePps: 0, totalObservations: 0, wifiProbes: 0, blePackets: 0, bufferCapacityPercent: 0,
    bufferUsedRecords: 0, bufferCapacityRecords: 1024, hardware: 'WAITING FOR ESP32', ntpStatus: 'HOST UTC',
    captureDuration: '00:00:00', droppedPkts: 0, fifoHealth: 'WAITING', clkSource: 'HOST CLOCK / UTC',
    baudRate: 115200, soundEnabled: true,
  });

  useEffect(() => {
    if (!liveData) {
      setTelemetry((prev) => ({ ...prev, sourceStatus: connectionState.toUpperCase(), hardware: connectionState === 'offline' ? 'BACKEND OFFLINE' : 'CONNECTING TO BACKEND' }));
      return;
    }
    const seconds = liveData.summary.captureDurationSeconds;
    const duration = `${String(Math.floor(seconds / 3600)).padStart(2, '0')}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    setTelemetry((prev) => ({
      ...prev, activeDevices: liveData.summary.uniqueDevices, meanRssi: liveData.summary.meanRssi, sourceStatus: liveData.source.status.toUpperCase(),
      totalObservations: liveData.summary.totalObservations, wifiProbes: liveData.summary.wifiProbes, blePackets: 0,
      wifiRatePps: liveData.summary.wifiRatePps, bufferCapacityPercent: liveData.summary.bufferCapacityPercent,
      bufferUsedRecords: liveData.summary.bufferUsed, bufferCapacityRecords: liveData.summary.bufferCapacity,
      hardware: liveData.source.status === 'connected' ? 'ESP32 WI-FI / SERIAL' : 'WAITING FOR ESP32',
      ntpStatus: 'HOST UTC', captureDuration: duration, droppedPkts: liveData.summary.droppedRecords,
      fifoHealth: `${100 - liveData.summary.bufferCapacityPercent}% FREE`, clkSource: 'HOST CLOCK / UTC',
      baudRate: liveData.summary.baudRate,
    }));
  }, [liveData, connectionState]);

  const packets = liveData?.analog.packets ?? [];

  const handleToggleSound = () => {
    const next = !telemetry.soundEnabled;
    setTelemetry((prev) => ({ ...prev, soundEnabled: next }));
    if (next) playTactileClick();
    showToast(next ? 'ACOUSTIC BEEPER ENABLED' : 'ACOUSTIC BEEPER MUTED');
  };

  const handleCycleTrigMode = () => {
    if (telemetry.soundEnabled) playRelayClack();
    const modes: ('ARMED / TRIGGERED' | 'AUTO' | 'SINGLE')[] = ['ARMED / TRIGGERED', 'AUTO', 'SINGLE'];
    setScopeConfig((prev) => {
      const idx = modes.indexOf(prev.status as any);
      const next = modes[(idx + 1) % modes.length];
      showToast(`TRIGGER MODE: ${next}`);
      return { ...prev, status: next };
    });
  };

  const handleSnapshot = () => {
    if (telemetry.soundEnabled) playRelayClack();
    showToast('CRT PHOSPHOR FRAME SAVED TO DISK BUFFER');
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2200);
  };

  return (
    <div className="min-h-screen bg-background text-on-surface antialiased font-sans select-none flex flex-col">
      {/* Fixed Full-Width Top Header & Navigation Bar */}
      <Header
        currentView={currentView}
        onSelectView={(view) => {
          if (telemetry.soundEnabled) playTactileClick();
          setCurrentView(view);
        }}
        telemetry={telemetry}
        config={scopeConfig}
        onToggleSound={handleToggleSound}
        onCycleTrigMode={handleCycleTrigMode}
        onSnapshot={handleSnapshot}
        sourceStatus={connectionState === 'offline' || connectionState === 'stale' ? connectionState : !liveData ? 'connecting' : liveData.source.status === 'connected' ? 'live' : liveData.source.status === 'error' ? 'error' : 'waiting'}
        onRetryTelemetry={retryTelemetry}
      />

      {/* Main Full-Width View Area */}
      <div className="w-full flex-1">
        <main className="w-full pt-[104px] pb-10 min-h-screen bg-background px-margin-desktop">
          {currentView === 'analog-trace' && (
            <AnalogTraceView
              config={scopeConfig}
              setConfig={setScopeConfig}
              telemetry={telemetry}
              setTelemetry={setTelemetry}
              packets={packets}
              onInspectPacket={(pkt) => setInspectingPacket(pkt)}
              onOpenAlertModal={() => setAlertModalOpen(true)}
              liveData={liveData}
            />
          )}

          {currentView === 'surge-dynamics' && (
            <SurgeDynamicsView
              telemetry={telemetry}
              packets={packets}
              onInspectPacket={(pkt) => setInspectingPacket(pkt)}
              liveData={liveData}
            />
          )}

          {currentView === 'flow-dwell' && (
            <SpectrumAnalyzerView
              telemetry={telemetry}
              config={spectrumConfig}
              setConfig={setSpectrumConfig}
              liveData={liveData}
            />
          )}

          {currentView === 'spatial-radar' && (
            <ProtocolBusView
              packets={packets}
              telemetry={telemetry}
              onInspectPacket={(pkt) => setInspectingPacket(pkt)}
              liveData={liveData}
            />
          )}

          {currentView === 'audit' && (
            <CalibrationView
              telemetry={telemetry}
              setTelemetry={setTelemetry}
              liveData={liveData}
            />
          )}
        </main>
      </div>

      {/* Fixed Bottom Instrument Footer */}
      <Footer telemetry={telemetry} />

      {/* Hex Dump Modal */}
      <HexDumpModal
        packet={inspectingPacket}
        onClose={() => setInspectingPacket(null)}
      />

      {/* Anomaly Inspection Modal */}
      <AlertDetailModal
        isOpen={alertModalOpen}
        onClose={() => setAlertModalOpen(false)}
        onInspectPacket={(pkt) => setInspectingPacket(pkt)}
        samplePacket={packets[0] ?? null}
      />

      {/* Transient Action Toast */}
      {toastMessage && (
        <div className="fixed bottom-12 right-6 z-50 bg-primary-container text-on-primary-container px-space-md py-space-sm font-label-sm font-bold shadow-xl border border-primary/50 flex items-center gap-2 animate-bounce">
          <span className="w-2 h-2 rounded-full bg-white"></span>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
