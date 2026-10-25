import React from 'react';
import { CalibrationTelemetry } from '../types/oscilloscope';

interface FooterProps {
  telemetry: CalibrationTelemetry;
}

export const Footer: React.FC<FooterProps> = ({ telemetry }) => {
  return (
    <footer className="fixed bottom-0 left-0 w-full h-8 bg-surface-container-lowest z-50 flex items-center justify-between px-margin-desktop font-label-sm text-on-surface-variant border-t border-surface-container-high/60">
      <div className="flex items-center gap-space-lg">
        <span>
          RECORD: <span className="text-on-surface font-semibold">{telemetry.sourceStatus === 'CONNECTED' ? 'CONTINUOUS' : 'WAITING'}</span>
        </span>
        <span>
          DUR: <span className="text-secondary font-semibold font-mono">{telemetry.captureDuration}</span>
        </span>
        <span className="hidden sm:inline">
          BUFFER: <span className="text-on-surface font-semibold">{telemetry.bufferUsedRecords} / {telemetry.bufferCapacityRecords} records</span>
        </span>
      </div>
      <div className="flex items-center gap-space-lg">
        <span className="hidden md:inline">
          SOURCE: <span className="text-on-surface font-semibold">{telemetry.sourceStatus}</span>
        </span>
        <span className="hidden sm:inline">
          BAUD: <span className="text-primary font-semibold font-mono">{telemetry.baudRate} bps</span>
        </span>
        <span>
          DROPPED: <span className="text-secondary font-semibold">{telemetry.droppedPkts}</span>
        </span>
      </div>
    </footer>
  );
};
