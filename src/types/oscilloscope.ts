export type ViewMode = 'analog-trace' | 'surge-dynamics' | 'flow-dwell' | 'spatial-radar' | 'audit';

export type PacketType = '802.11 PROBE' | 'BLE 5.0 ADV' | '802.11 BEACON' | 'BLE SCAN_REQ' | '802.11 DATA';

export interface PacketEvent {
  id: string;
  index: number;
  timestamp: string;
  type: PacketType;
  freq: string;
  channel: string;
  sourceMac: string;
  rssi: number;
  snr?: number | null;
  details: string;
  rawHex: string;
  fingerprintId: string;
  ssid?: string;
  advData?: string;
  fcsOk?: boolean | null;
  ouiVendor?: string;
  packetLength?: number | null;
}

export interface ScopeConfig {
  timeDiv: string;
  trigLevelMv: number;
  trigSlope: 'POS (+)' | 'NEG (-)';
  status: 'ARMED / TRIGGERED' | 'AUTO' | 'SINGLE' | 'HOLD';
  probeAtten: '1X' | '10X' | '100X';
  coupling: 'AC 50Ω' | 'DC 50Ω' | 'GND';
  offsetV: number;
  ch1VoltsDiv: number; // in mV
  ch2VoltsDiv: number; // in mV
  triggerSensPercent: number;
  triggerSensDb: number;
  sampleRate: string;
  noiseFloorDbm: number;
  isPaused: boolean;
  streamMode: 'live' | 'demo' | 'pause';
  filterType: 'all' | 'wifi' | 'ble' | 'anomalies';
}

export interface SpectrumConfig {
  centerFreqMhz: number;
  spanMhz: number;
  rbwKhz: number;
  vbwKhz: number;
  detector: 'Peak' | 'RMS' | 'MaxHold' | 'Average';
  averaging: number;
  marker1Freq: number;
  marker2Freq: number;
  waterfallSpeed: number;
}

export interface CalibrationTelemetry {
  activeDevices: number;
  meanRssi: number | null;
  sourceStatus: string;
  wifiRatePps: number;
  totalObservations: number;
  wifiProbes: number;
  blePackets: number;
  bufferCapacityPercent: number;
  bufferUsedRecords: number;
  bufferCapacityRecords: number;
  hardware: string;
  ntpStatus: string;
  captureDuration: string;
  droppedPkts: number;
  fifoHealth: string;
  clkSource: string;
  baudRate: number;
  soundEnabled: boolean;
}

export interface DensiVueDevice {
  deviceId: string;
  fingerprintId: string;
  mac: string;
  rssi: number;
  distanceM: number;
  distanceCapped?: boolean;
  hits: number;
  firstSeen: string;
  ts: number;
  timestamp: string;
  protocol: 'wifi';
}

export interface DensiVueAuditEvent {
  id: string;
  timestamp: string;
  classification: string;
  metric: number;
  limit: number;
  severity: 'CRITICAL' | 'INFO';
  durationSeconds: number;
  status: 'ACTIVE' | 'CLEARED';
}

export interface DensiVueTelemetry {
  generatedAt: string;
  source: { status: 'waiting' | 'connected' | 'error'; error: string | null };
  summary: {
    totalObservations: number;
    wifiProbes: number;
    baudRate: number;
    blePackets: 0;
    uniqueDevices: number;
    windowSeconds: number;
    wifiRatePps: number;
    bufferCapacityPercent: number;
    bufferUsed: number;
    bufferCapacity: number;
    captureDurationSeconds: number;
    droppedRecords: number;
    meanRssi: number | null;
  };
  analog: { samples: { timestamp: string; wifi: number; ble: 0 }[]; devices: DensiVueDevice[]; packets: PacketEvent[] };
  surge: {
    inflowPerMinute: number;
    accelerationPerSecond: number;
    tachometer: number;
    secondsToBreach: number | null;
    capacity: number;
    capacityLimit: number;
    observations: DensiVueDevice[];
  };
  flow: { moving: number; still: number; spectrum: number[]; dwellMethod: string };
  radar: {
    zones: { core: number; mid: number; perimeter: number };
    zoneDevices: DensiVueDevice[][];
    bearingSupported: false;
    coreLimit: number;
  };
  audit: DensiVueAuditEvent[];
}
