import React, { useState } from 'react';
import { X, Copy, Check, Download, Binary } from 'lucide-react';
import { PacketEvent } from '../types/oscilloscope';

interface HexDumpModalProps {
  packet: PacketEvent | null;
  onClose: () => void;
}

export const HexDumpModal: React.FC<HexDumpModalProps> = ({ packet, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [selectedByteIndex, setSelectedByteIndex] = useState<number | null>(null);

  if (!packet) return null;

  const hexBytes = packet.rawHex.trim() ? packet.rawHex.trim().split(/\s+/) : [];

  const handleCopy = () => {
    if (!packet.rawHex) return;
    navigator.clipboard.writeText(packet.rawHex);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const content = `// DensiVue Lab-Oscilloscope 402 - RF Demodulation Dump
// Index: #${packet.index}
// Timestamp: ${packet.timestamp}
// Type: ${packet.type}
// Frequency: ${packet.freq}
// Source MAC: ${packet.sourceMac} (${packet.ouiVendor || 'Unknown'})
// RSSI: ${packet.rssi} dBm, SNR: ${packet.snr == null ? 'not transmitted' : `${packet.snr} dB`}
// FCS Check: ${packet.fcsOk == null ? 'not transmitted' : packet.fcsOk ? 'VALID' : 'CORRUPT'}

RAW HEX BYTES (${hexBytes.length} bytes; not carried by this serial format):
${packet.rawHex}
`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `packet_${packet.index}_dump.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Split into rows of 16 bytes for standard hex editor format
  const rows: { offset: string; hex: string[]; ascii: string; startIndex: number }[] = [];
  for (let i = 0; i < hexBytes.length; i += 16) {
    const chunk = hexBytes.slice(i, i + 16);
    const offset = i.toString(16).padStart(8, '0').toUpperCase();
    const ascii = chunk
      .map((b) => {
        const val = parseInt(b, 16);
        return val >= 32 && val <= 126 ? String.fromCharCode(val) : '.';
      })
      .join('');
    rows.push({ offset, hex: chunk, ascii, startIndex: i });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl bg-surface-container-lowest border border-primary/40 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Bezel Top Bar */}
        <div className="bg-primary-container px-space-md py-space-sm flex items-center justify-between text-on-primary-container border-b border-on-primary-container/20">
          <div className="flex items-center gap-space-sm">
            <div className="w-2.5 h-2.5 rounded-full bg-on-primary-container/30 flex items-center justify-center">
              <div className="w-1 h-0.5 bg-primary-container"></div>
            </div>
            <span className="font-label-md font-bold tracking-widest uppercase">
              FRAME METADATA // RECORD #{packet.index}
            </span>
            <span className="font-label-sm bg-surface-container-lowest text-primary px-space-sm py-0.5 rounded">
              {packet.type}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-on-primary-container/20 text-on-primary-container rounded transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Packet Metadata Summary Strip */}
        <div className="bg-surface-container-low p-space-md border-b border-surface-container-high grid grid-cols-2 sm:grid-cols-5 gap-space-md font-label-sm">
          <div>
            <span className="text-on-surface-variant text-[10px] uppercase block">TIMESTAMP</span>
            <span className="text-on-surface font-semibold">{packet.timestamp}</span>
          </div>
          <div>
            <span className="text-on-surface-variant text-[10px] uppercase block">SOURCE MAC</span>
            <span className="text-on-surface font-semibold truncate block">
              {packet.sourceMac}
            </span>
          </div>
          <div>
            <span className="text-on-surface-variant text-[10px] uppercase block">RSSI SIGNAL</span>
            <span className="text-secondary font-semibold font-mono">
              {packet.rssi} dBm
            </span>
          </div>
          <div>
            <span className="text-on-surface-variant text-[10px] uppercase block">FINGERPRINT ID</span>
            <span className="text-primary font-semibold font-mono truncate block">
              {packet.fingerprintId}
            </span>
          </div>
          <div>
            <span className="text-on-surface-variant text-[10px] uppercase block">HARDWARE OUI</span>
            <span className="text-secondary font-semibold truncate block">
              {packet.ouiVendor || 'Not included in serial stream'}
            </span>
          </div>
        </div>

        {/* Content Body: Dual Pane Hex Viewer + Protocol Tree */}
        <div className="p-space-md overflow-y-auto space-y-space-md">
          {/* Hex Editor Grid */}
          <div className="bg-[#0c0303] p-space-md border border-[#3b120c] font-mono text-xs overflow-x-auto">
            <div className="text-on-surface-variant text-[11px] pb-space-xs border-b border-[#3b120c] mb-space-xs flex">
              <span className="w-24 text-on-surface-variant">OFFSET</span>
              <span className="flex-1 tracking-wider text-primary">
                00 01 02 03 04 05 06 07  08 09 0A 0B 0C 0D 0E 0F
              </span>
              <span className="w-40 text-right text-secondary">ASCII DECODE</span>
            </div>

            <div className="space-y-1">
              {rows.length === 0 && <div className="py-space-lg text-center text-on-surface-variant">Raw 802.11 bytes are not included in the ESP32 serial record.</div>}
              {rows.map((row) => (
                <div key={row.offset} className="flex items-center hover:bg-surface-container-high/40 transition-colors py-0.5">
                  <span className="w-24 text-on-surface-variant select-none">{row.offset}</span>
                  <div className="flex-1 flex gap-1 sm:gap-2">
                    {row.hex.map((byte, idx) => {
                      const globalIdx = row.startIndex + idx;
                      const isSelected = selectedByteIndex === globalIdx;
                      return (
                        <span
                          key={idx}
                          onClick={() => setSelectedByteIndex(globalIdx)}
                          className={`cursor-pointer px-0.5 rounded transition-colors ${
                            isSelected
                              ? 'bg-primary text-on-primary font-bold shadow'
                              : 'text-on-surface hover:text-secondary hover:bg-surface-container'
                          }`}
                        >
                          {byte}
                        </span>
                      );
                    })}
                  </div>
                  <span className="w-40 text-right text-secondary tracking-widest select-all">
                    {row.ascii}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Protocol Field Dissection */}
          <div className="bg-surface-container-low p-space-md border border-surface-container-high space-y-space-sm font-label-sm">
            <div className="flex items-center gap-space-sm text-primary font-bold uppercase text-xs">
              <Binary size={14} />
              <span>PROTOCOL FIELD DISSECTOR</span>
            </div>

            <div className="space-y-space-xs text-xs">
              <div className="p-space-xs bg-surface-container flex justify-between items-center border border-surface-container-high">
                <span className="text-on-surface-variant">FRAME TYPE:</span>
                <span className="text-secondary font-mono">Probe request (firmware subtype filter)</span>
              </div>
              <div className="p-space-xs bg-surface-container flex justify-between items-center border border-surface-container-high">
                <span className="text-on-surface-variant">TRANSMITTER ADDRESS (TA):</span>
                <span className="text-primary font-mono">{packet.sourceMac}</span>
              </div>
              <div className="p-space-xs bg-surface-container flex justify-between items-center border border-surface-container-high">
                <span className="text-on-surface-variant">DESTINATION ADDRESS:</span>
                <span className="text-on-surface font-mono">NOT INCLUDED IN STREAM</span>
              </div>
              <div className="p-space-xs bg-surface-container flex justify-between items-center border border-surface-container-high">
                <span className="text-on-surface-variant">SSID PARAMETER SET:</span>
                <span className="text-secondary font-mono">NOT INCLUDED IN STREAM</span>
              </div>
              <div className="p-space-xs bg-surface-container flex justify-between items-center border border-surface-container-high">
                <span className="text-on-surface-variant">SUPPORTED DATA RATES:</span>
                <span className="text-on-surface font-mono">NOT INCLUDED IN STREAM</span>
              </div>
              <div className="p-space-xs bg-surface-container flex justify-between items-center border border-surface-container-high">
                <span className="text-on-surface-variant">FRAME CHECK SEQUENCE (FCS):</span>
                <span className="text-secondary font-mono font-bold">{packet.fcsOk == null ? 'NOT INCLUDED IN STREAM' : packet.fcsOk ? 'VALID' : 'INVALID'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="bg-surface-container-low px-space-md py-space-sm border-t border-surface-container-high flex items-center justify-between font-label-sm">
          <div className="text-on-surface-variant text-[11px]">
            {selectedByteIndex !== null ? (
              <span>
                Selected Offset: <span className="text-primary font-mono font-bold">0x{selectedByteIndex.toString(16).toUpperCase()}</span> (Byte #{selectedByteIndex})
              </span>
            ) : (
              <span>Click any byte to inspect bitmask and offset</span>
            )}
          </div>
          <div className="flex items-center gap-space-sm">
            <button
              onClick={handleCopy}
              disabled={!packet.rawHex}
              className="bg-surface-container hover:bg-surface-bright text-on-surface px-space-md py-space-xs flex items-center gap-1 border border-surface-container-high transition-colors"
            >
              {copied ? <Check size={14} className="text-secondary" /> : <Copy size={14} />}
              <span>{copied ? 'COPIED HEX' : packet.rawHex ? 'COPY RAW HEX' : 'NO RAW HEX'}</span>
            </button>
            <button
              onClick={handleDownload}
              className="bg-primary text-on-primary font-bold px-space-md py-space-xs flex items-center gap-1 hover:bg-primary-fixed transition-colors"
            >
              <Download size={14} />
              <span>EXPORT METADATA</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
