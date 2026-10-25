import React from 'react';
import { X, AlertTriangle, ShieldAlert, Activity, ArrowRight } from 'lucide-react';
import { PacketEvent } from '../types/oscilloscope';

interface AlertDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInspectPacket: (packet: PacketEvent) => void;
  samplePacket: PacketEvent | null;
}

export const AlertDetailModal: React.FC<AlertDetailModalProps> = ({
  isOpen,
  onClose,
  onInspectPacket,
  samplePacket,
}) => {
  if (!isOpen || !samplePacket) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-surface-container-lowest border border-error/50 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-[#93000a] text-[#ffdad6] px-space-md py-space-sm flex items-center justify-between border-b border-[#ffb4ab]/30">
          <div className="flex items-center gap-space-sm">
            <ShieldAlert size={18} className="text-[#ffb4ab]" />
            <span className="font-label-md font-bold tracking-widest uppercase">
              LATEST WI-FI PROBE OBSERVATION
            </span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-space-lg space-y-space-md font-label-sm">
          {/* Main Anomaly Card */}
          <div className="p-space-md bg-surface-container-low border border-surface-container-high space-y-space-xs">
            <div className="flex items-center justify-between text-error font-bold">
              <span className="flex items-center gap-1">
                <AlertTriangle size={14} />
                CAPTURED FRAME: {samplePacket.type} / RSSI {samplePacket.rssi} dBm
              </span>
              <span className="text-on-surface-variant text-[10px]">TIME: {samplePacket.timestamp}</span>
            </div>
            <p className="text-on-surface-variant text-xs leading-relaxed">
              The ESP32 serial stream reports the source MAC, RSSI, probe-structure fingerprint, and device timestamp. This firmware does not transmit packet bytes, SSID content, SNR, or FCS status.
            </p>
          </div>

          {/* Anomaly Metrics Grid */}
          <div className="grid grid-cols-3 gap-space-sm">
            <div className="p-space-sm bg-surface-container border border-surface-container-high">
              <span className="text-on-surface-variant text-[10px] uppercase block">PEAK BURST</span>
              <span className="text-error font-mono font-bold text-sm">{samplePacket.rssi} dBm</span>
            </div>
            <div className="p-space-sm bg-surface-container border border-surface-container-high">
              <span className="text-on-surface-variant text-[10px] uppercase block">MAC ENTROPY</span>
              <span className="text-primary font-mono font-bold text-sm">{samplePacket.fingerprintId}</span>
            </div>
            <div className="p-space-sm bg-surface-container border border-surface-container-high">
              <span className="text-on-surface-variant text-[10px] uppercase block">CHANNEL OCCUPANCY</span>
              <span className="text-secondary font-mono font-bold text-sm">{samplePacket.channel}</span>
            </div>
          </div>

          {/* Action Recommendations */}
          <div className="p-space-md bg-surface-container-low border border-surface-container-high space-y-space-xs text-xs">
            <span className="text-on-surface font-bold flex items-center gap-1">
              <Activity size={14} className="text-secondary" /> RECOMMENDED ACTIONS:
            </span>
            <ul className="list-disc list-inside space-y-1 text-on-surface-variant">
              <li>Use RSSI and fingerprint trends to compare observations within the rolling window.</li>
              <li>Treat this fingerprint as a heuristic device key, not a verified identity.</li>
              <li>Raw packet bytes are unavailable from the current ESP32 serial format.</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-surface-container-low px-space-md py-space-sm border-t border-surface-container-high flex items-center justify-between font-label-sm">
          <span className="text-on-surface-variant text-[11px]">
            FINGERPRINT: {samplePacket.fingerprintId}
          </span>
          <div className="flex gap-space-sm">
            <button
              onClick={() => {
                onClose();
                onInspectPacket(samplePacket);
              }}
              className="bg-primary text-on-primary font-bold px-space-md py-space-xs flex items-center gap-1 hover:bg-primary-fixed transition-colors"
            >
              <span>INSPECT CAPTURED PROBE</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
