import React, { useState } from 'react';
import { CalibrationTelemetry, DensiVueTelemetry } from '../types/oscilloscope';
import { useEffect } from 'react';
import { playRelayClack, playTactileClick } from '../utils/audioFeedback';

interface CalibrationViewProps {
  telemetry: CalibrationTelemetry;
  setTelemetry?: React.Dispatch<React.SetStateAction<CalibrationTelemetry>>;
  liveData: DensiVueTelemetry | null;
}

interface AuditEvent {
  id: string;
  timestamp: string;
  classification: string;
  metric: string;
  metricSub: string;
  node: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  duration: string;
  status: 'ACTIVE' | 'CLEARED' | 'RESOLVED' | 'NOMINAL';
  isFlushed?: boolean;
}

export const CalibrationView: React.FC<CalibrationViewProps> = ({
  telemetry,
  liveData,
}) => {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  useEffect(() => {
    setEvents((liveData?.audit ?? []).map((event) => ({
      id: event.id, timestamp: event.timestamp, classification: event.classification,
      metric: `${event.metric}`, metricSub: `(Limit: ${event.limit})`, node: 'LOCAL_ESP32_HOST',
      severity: event.severity, duration: `${Math.floor(event.durationSeconds / 60)}m ${Math.floor(event.durationSeconds % 60)}s`,
      status: event.status,
    })));
  }, [liveData?.generatedAt]);
  const [searchQuery, setSearchQuery] = useState('');
  const [criticalFilterActive, setCriticalFilterActive] = useState(false);

  const handleToggleCriticalFilter = () => {
    if (telemetry.soundEnabled) playTactileClick();
    setCriticalFilterActive((prev) => !prev);
  };

  const handleFlush = () => {
    if (telemetry.soundEnabled) playRelayClack();
    // Fade older non-critical cached entries to reflect local RAM flush
    setEvents((prev) =>
      prev.map((e, idx) => (idx > 1 ? { ...e, isFlushed: true } : e))
    );
  };

  const handleExportCsv = () => {
    if (telemetry.soundEnabled) playRelayClack();
    const headers = [
      'TIMESTAMP (UTC)',
      'EVENT CLASSIFICATION',
      'TRIGGER METRIC',
      'ZONE NODE',
      'SEVERITY',
      'DURATION',
      'STATUS',
    ];
    const rows = filteredEvents.map((e) => [
      e.timestamp,
      e.classification,
      `"${e.metric} ${e.metricSub}"`,
      e.node,
      e.severity,
      e.duration,
      e.status,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DENSIVUE_AUDIT_LOG_EXPORT_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredEvents = events.filter((e) => {
    if (criticalFilterActive && e.severity !== 'CRITICAL') return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      e.classification.toLowerCase().includes(q) ||
      e.node.toLowerCase().includes(q) ||
      e.metric.toLowerCase().includes(q) ||
      e.timestamp.toLowerCase().includes(q)
    );
  });

  return (
    <div className="w-full flex flex-col gap-space-lg font-body-md text-on-surface antialiased select-none pb-12">
      {/* CRT SCANLINE & SUBTLE RETICLE BACKGROUND OVERLAY */}
      <div className="pointer-events-none fixed inset-0 opacity-[0.035] bg-[radial-gradient(#2ff801_1px,transparent_1px)] [background-size:16px_16px] z-30"></div>

      {/* SECTION 1: TOP SUMMARY STRIP (4-COLUMN HARDWARE CHASSIS METRICS) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-gutter-md">
        {/* CARD 1: EVENTS LOGGED */}
        <div className="relative bg-surface-container-lowest p-space-md shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06),0_4px_16px_rgba(0,0,0,0.8)] overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-secondary-container opacity-80 shadow-[0_0_8px_#2ff801]"></div>
          <div className="flex items-center justify-between font-label-sm text-label-sm uppercase tracking-wider text-outline mb-space-xs">
            <span>TOTAL EVENTS LOGGED</span>
            <span className="text-secondary-container flex items-center gap-1 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary-container animate-pulse"></span>
              REG_01
            </span>
          </div>
          <div className="flex items-baseline gap-space-sm my-space-xs">
            <span className="font-display-lg text-4xl xl:text-5xl font-black text-secondary-container drop-shadow-[0_0_10px_rgba(47,248,1,0.6)] font-mono">
              08
            </span>
            <span className="font-label-md text-label-md text-secondary-container opacity-60 font-mono font-bold">
              EVT
            </span>
          </div>
          <div className="font-label-sm text-label-sm text-on-surface-variant flex items-center justify-between">
            <span>EVENTS RECORDED</span>
            <span className="text-secondary tracking-widest text-[10px] bg-surface-container px-1 font-bold">
              BUFFER SYNCED
            </span>
          </div>
        </div>

        {/* CARD 2: CAPACITY BREACHES */}
        <div className="relative bg-surface-container-lowest p-space-md shadow-[inset_0_0_0_1px_rgba(255,180,171,0.2),0_4px_16px_rgba(147,0,10,0.4)] overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-error opacity-90 shadow-[0_0_10px_#ffb4ab]"></div>
          <div className="flex items-center justify-between font-label-sm text-label-sm uppercase tracking-wider text-error mb-space-xs">
            <span className="flex items-center gap-1 font-bold">
              <span className="material-symbols-outlined text-[14px]">warning</span>
              CRITICAL CAPACITY BREACHES
            </span>
            <span className="text-error bg-error-container/40 px-1 font-bold">LVL_4</span>
          </div>
          <div className="flex items-baseline gap-space-sm my-space-xs">
            <span className="font-display-lg text-4xl xl:text-5xl font-black text-error drop-shadow-[0_0_12px_rgba(255,180,171,0.8)] font-mono">
              02
            </span>
            <span className="font-label-md text-label-md text-error opacity-70 font-mono font-bold">
              BREACH
            </span>
          </div>
          <div className="font-label-sm text-label-sm text-error flex items-center justify-between">
            <span className="tracking-tight">STAMPEDE HAZARDS TRIGGERED</span>
            <span className="text-on-error bg-error-container px-1 animate-pulse font-bold">
              ASSERTED
            </span>
          </div>
        </div>

        {/* CARD 3: MAX RECORDED SURGE */}
        <div className="relative bg-surface-container-lowest p-space-md shadow-[inset_0_0_0_1px_rgba(240,120,22,0.25),0_4px_16px_rgba(0,0,0,0.8)] overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary-container opacity-90 shadow-[0_0_8px_#f07816]"></div>
          <div className="flex items-center justify-between font-label-sm text-label-sm uppercase tracking-wider text-outline mb-space-xs">
            <span>MAX RECORDED SURGE</span>
            <span className="text-primary-container bg-surface-container px-1 font-bold">
              VELOCITY
            </span>
          </div>
          <div className="flex items-baseline gap-space-xs my-space-xs">
            <span className="font-display-lg text-4xl xl:text-5xl font-black text-primary-container drop-shadow-[0_0_10px_rgba(240,120,22,0.6)] font-mono">
              +28.4
            </span>
            <span className="font-label-md text-label-md text-primary tracking-tighter font-mono font-bold">
              / MIN
            </span>
          </div>
          <div className="font-label-sm text-label-sm text-on-surface-variant flex items-center justify-between">
            <span>PEAK VELOCITY</span>
            <span className="text-primary font-bold">[GATE_A_CORRIDOR]</span>
          </div>
        </div>

        {/* CARD 4: NON-VOLATILE FIFO STORAGE */}
        <div className="relative bg-surface-container-lowest p-space-md shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06),0_4px_16px_rgba(0,0,0,0.8)] overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-tertiary opacity-80 shadow-[0_0_6px_#f0baae]"></div>
          <div className="flex items-center justify-between font-label-sm text-label-sm uppercase tracking-wider text-outline mb-space-xs">
            <span>NON-VOLATILE FIFO STORAGE</span>
            <span className="text-tertiary font-bold">NVRAM_04</span>
          </div>
          <div className="flex items-baseline gap-space-xs my-space-xs">
            <span className="font-display-lg text-4xl xl:text-5xl font-black text-on-surface drop-shadow-[0_0_6px_rgba(225,227,220,0.3)] font-mono">
              14.2
            </span>
            <span className="font-label-md text-label-md text-on-surface-variant font-mono">
              / 1024 KB
            </span>
          </div>
          <div className="font-label-sm text-label-sm text-on-surface-variant flex items-center justify-between">
            <span>AUTO-CYCLE ACTIVE</span>
            <span className="text-secondary-container bg-surface-container px-1 font-bold">
              [SLOT 04/32]
            </span>
          </div>
        </div>
      </div>

      {/* SECTION 2: MAIN EXPANSIVE CRT AUDIT LOG REGISTER */}
      <div className="flex flex-col bg-surface-container-lowest shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08),0_8px_32px_rgba(0,0,0,0.95)] overflow-hidden relative border border-surface-container-high/60">
        {/* OSCILLOSCOPE CONTROL BEZEL / TABLE CONTROL STRIP */}
        <div className="p-space-md bg-surface-container-low flex flex-wrap items-center justify-between gap-gutter-md">
          {/* LEFT TERMINAL ANNOUNCER */}
          <div className="flex items-center gap-space-md">
            <div className="flex items-center gap-space-xs bg-surface-container px-space-sm py-space-xs text-primary border border-primary/20">
              <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
              <span className="font-label-md text-label-md uppercase tracking-wider font-bold">
                CRITICAL RF TELEMETRY AUDIT LOG
              </span>
            </div>
            <span className="font-label-sm text-label-sm text-on-surface-variant tracking-wider hidden sm:inline-block">
              NON-VOLATILE EVENT TRAIL
            </span>
            <span className="bg-surface-container-lowest text-secondary-container px-space-sm py-space-xs font-label-sm text-label-sm shadow-[0_0_4px_rgba(47,248,1,0.2)] border border-[#1b2b1d]">
              SYS_REG: NVRAM-BANK-A
            </span>
          </div>

          {/* RIGHT CRT MECHANICAL ACTUATION PUSH BUTTONS */}
          <div className="flex flex-wrap items-center gap-space-xs">
            {/* SEARCH ADDR QUICK FILTER */}
            <div className="relative flex items-center bg-surface-container-lowest px-space-sm py-space-xs shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)] border border-surface-container-high">
              <span className="material-symbols-outlined text-outline text-[16px] mr-1">
                search
              </span>
              <input
                className="bg-transparent font-label-sm text-label-sm text-secondary-container placeholder:text-outline focus:outline-none w-40 sm:w-48 uppercase tracking-wider"
                placeholder="SEARCH ADDR / NODE..."
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* EXPORT CSV DUMP */}
            <button
              onClick={handleExportCsv}
              className="flex items-center gap-1 bg-surface-container hover:bg-surface-container-high px-space-sm py-space-xs font-label-sm text-label-sm text-on-surface uppercase tracking-wider transition-colors active:translate-y-px shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] border border-surface-container-high cursor-pointer"
            >
              <span className="material-symbols-outlined text-[14px] text-primary">
                save_alt
              </span>
              <span>[ EXPORT CSV ]</span>
            </button>

            {/* FILTER: CRITICAL */}
            <button
              onClick={handleToggleCriticalFilter}
              className={`flex items-center gap-1 px-space-sm py-space-xs font-label-sm text-label-sm uppercase tracking-wider transition-colors active:translate-y-px shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] border cursor-pointer ${
                criticalFilterActive
                  ? 'bg-error-container text-on-error border-error shadow-[0_0_8px_#ffb4ab]'
                  : 'bg-surface-container hover:bg-surface-container-high text-error border-surface-container-high'
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">filter_alt</span>
              <span>{criticalFilterActive ? '[ FILTER: ACTIVE ]' : '[ FILTER: CRITICAL ]'}</span>
            </button>

            {/* CLEAR LOG / FLUSH */}
            <button
              onClick={handleFlush}
              className="flex items-center gap-1 bg-surface-container hover:bg-error-container/30 px-space-sm py-space-xs font-label-sm text-label-sm text-outline hover:text-error uppercase tracking-wider transition-colors active:translate-y-px shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] border border-surface-container-high cursor-pointer"
            >
              <span className="material-symbols-outlined text-[14px]">backspace</span>
              <span>[ FLUSH ]</span>
            </button>
          </div>
        </div>

        {/* RETICLE LINE DECORATOR */}
        <div className="h-px w-full bg-gradient-to-r from-transparent via-primary/30 to-transparent"></div>

        {/* EXPANSIVE MONOSPACED CRT TERMINAL DATA TABLE */}
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left font-label-md text-label-md whitespace-nowrap min-w-[960px]">
            <thead>
              <tr className="bg-surface-container font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider shadow-[0_1px_0_rgba(255,255,255,0.06)] border-b border-surface-container-high">
                <th className="py-space-sm px-space-md text-primary font-bold">TIMESTAMP (UTC)</th>
                <th className="py-space-sm px-space-md text-on-surface font-bold">
                  EVENT CLASSIFICATION
                </th>
                <th className="py-space-sm px-space-md text-on-surface font-bold">
                  TRIGGER METRIC / TELEMETRY
                </th>
                <th className="py-space-sm px-space-md text-on-surface font-bold">ZONE NODE</th>
                <th className="py-space-sm px-space-md text-on-surface font-bold text-center">
                  SEVERITY
                </th>
                <th className="py-space-sm px-space-md text-on-surface font-bold text-right">
                  DURATION
                </th>
                <th className="py-space-sm px-space-md text-right font-bold text-secondary-container">
                  STATUS
                </th>
              </tr>
            </thead>
            <tbody className="divide-y-0 text-on-surface font-label-md">
              {filteredEvents.length === 0 && (
                <tr><td colSpan={7} className="py-space-xl text-center text-outline font-mono">NO BREACH EVENTS RECORDED</td></tr>
              )}
              {filteredEvents.map((evt, idx) => {
                const isCritical = evt.severity === 'CRITICAL';
                const isWarning = evt.severity === 'WARNING';
                const isInfo = evt.severity === 'INFO';

                return (
                  <tr
                    key={evt.id}
                    className={`group hover:bg-surface-container-high transition-colors ${
                      idx % 2 === 0 ? 'bg-surface-container-lowest/60' : 'bg-surface-container-low/40'
                    } ${evt.isFlushed ? 'opacity-30' : ''}`}
                  >
                    {/* TIMESTAMP */}
                    <td className="py-space-md px-space-md text-outline tracking-wider flex items-center gap-1.5 font-label-sm text-label-sm font-mono">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isCritical
                            ? 'bg-error animate-ping'
                            : isWarning
                            ? 'bg-primary-container'
                            : 'bg-secondary-container'
                        }`}
                      ></span>
                      {evt.timestamp}
                    </td>

                    {/* EVENT CLASSIFICATION */}
                    <td className="py-space-md px-space-md font-bold text-on-surface group-hover:text-primary transition-colors font-mono">
                      {evt.classification}
                    </td>

                    {/* TRIGGER METRIC */}
                    <td
                      className={`py-space-md px-space-md font-semibold font-mono ${
                        isCritical
                          ? 'text-error'
                          : isWarning
                          ? 'text-primary-container'
                          : 'text-secondary-container'
                      }`}
                    >
                      {evt.metric}{' '}
                      <span className="text-outline text-label-sm font-normal">
                        {evt.metricSub}
                      </span>
                    </td>

                    {/* ZONE NODE */}
                    <td className="py-space-md px-space-md text-on-surface-variant font-mono">
                      <span className="bg-surface-container px-space-sm py-0.5 text-on-surface border border-surface-container-high">
                        {evt.node}
                      </span>
                    </td>

                    {/* SEVERITY */}
                    <td className="py-space-md px-space-md text-center">
                      <span
                        className={`font-label-sm text-label-sm font-bold px-space-sm py-0.5 tracking-wider font-mono ${
                          isCritical
                            ? 'bg-error-container text-on-error shadow-[0_0_6px_rgba(255,51,51,0.5)]'
                            : isWarning
                            ? 'bg-primary-container text-on-primary-container shadow-[0_0_6px_rgba(240,120,22,0.5)]'
                            : 'bg-surface-container-high text-secondary-container'
                        }`}
                      >
                        {evt.severity}
                      </span>
                    </td>

                    {/* DURATION */}
                    <td className="py-space-md px-space-md text-right text-on-surface-variant font-label-sm text-label-sm font-mono">
                      {evt.duration}
                    </td>

                    {/* STATUS */}
                    <td
                      className={`py-space-md px-space-md text-right font-semibold font-mono ${
                        evt.status === 'CLEARED' || evt.status === 'NOMINAL'
                          ? 'text-secondary-container'
                          : 'text-primary'
                      }`}
                    >
                      <span className="inline-flex items-center gap-1">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            evt.status === 'CLEARED' || evt.status === 'NOMINAL'
                              ? 'bg-secondary-container shadow-[0_0_6px_#2ff801]'
                              : 'bg-primary shadow-[0_0_4px_#ffb68a]'
                          }`}
                        ></span>
                        {evt.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* RETICLE LINE DECORATOR BOTTOM */}
        <div className="h-px w-full bg-gradient-to-r from-transparent via-outline/20 to-transparent"></div>

        {/* REGISTER SUB-BAR CHASSIS TELEMETRY */}
        <div className="p-space-sm bg-surface-container flex flex-wrap items-center justify-between font-label-sm text-label-sm text-outline gap-space-sm">
          <div className="flex items-center gap-space-md">
            <span>
              API POLL: <span className="text-on-surface font-mono">1s</span>
            </span>
            <span>
              DROPPED: <span className="text-secondary-container font-mono">{telemetry.droppedPkts}</span>
            </span>
            <span>
              SENSOR: <span className="text-secondary-container font-mono">{telemetry.sourceStatus}</span>
            </span>
          </div>
          <div className="flex items-center gap-space-md">
            <span className="text-primary font-semibold font-mono">WINDOW CAPACITY: {telemetry.bufferUsedRecords}/{telemetry.bufferCapacityRecords}</span>
            <span>
              NEXT POINTER: <span className="text-on-surface font-mono">0x7FFF04A0</span>
            </span>
          </div>
        </div>
      </div>

      {/* SECTION 3: MINIMAL FOOTER STATUS STRIP */}
      <div className="w-full bg-surface-container-lowest p-space-sm shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)] flex flex-wrap items-center justify-between font-label-sm text-label-sm text-on-surface-variant gap-gutter-md border border-surface-container-high/60">
        <div className="flex items-center gap-space-xs font-semibold">
          <span className="inline-block w-2 h-2 rounded-full bg-secondary-container animate-pulse shadow-[0_0_6px_#2ff801]"></span>
          <span className="text-on-surface">STATUS:</span>
          <span className="text-secondary-container font-bold">{telemetry.sourceStatus}</span>
          <span className="text-outline">·</span>
          <span className="text-secondary">FIFO INTEGRITY 100%</span>
        </div>
        <div className="flex flex-wrap items-center gap-space-md text-outline font-mono">
          <span>
            DROPPED: <span className="text-primary font-mono font-bold">{telemetry.droppedPkts}</span>
          </span>
          <span className="hidden sm:inline">|</span>
          <span>
            BAUD: <span className="text-on-surface">{telemetry.baudRate} bps</span>
          </span>
          <span className="hidden sm:inline">|</span>
          <span>
            CLOCK: <span className="text-on-surface">{telemetry.clkSource}</span>
          </span>
          <span className="hidden sm:inline">|</span>
          <span>
            BUFFER: <span className="text-secondary-container font-bold">{telemetry.bufferUsedRecords}/{telemetry.bufferCapacityRecords} records</span>
          </span>
        </div>
      </div>
    </div>
  );
};
