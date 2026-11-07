import React, { useState } from 'react';
import { X, Radio, Cpu, CheckCircle2, Shield, ArrowRight, Zap, RefreshCw } from 'lucide-react';
import { DataSourceMode } from '../../types/telemetry';
import { useTelemetry } from '../../context/TelemetryContext';

interface HardwareSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HardwareSourceModal: React.FC<HardwareSourceModalProps> = ({ isOpen, onClose }) => {
  const { mode, setMode, providerStatus } = useTelemetry();
  const [selectedMode, setSelectedMode] = useState<DataSourceMode>(mode);
  const [endpointInput, setEndpointInput] = useState<string>(
    mode === 'SIMULATION' ? 'AETHER-Virtual-NILM-Engine://local-synth' : providerStatus.sourceEndpoint
  );

  if (!isOpen) return null;

  const handleSave = () => {
    setMode(selectedMode, endpointInput);
    onClose();
  };

  const sources: {
    id: DataSourceMode;
    title: string;
    description: string;
    badge: string;
    defaultEndpoint: string;
    protocol: string;
  }[] = [
    {
      id: 'SIMULATION',
      title: 'AETHER Sanallaştırılmış NILM Simülatörü',
      description: 'Fiziksel sensör bağlanana kadar binanın 24 saatlik dinamik enerji döngüsünü, hayalet yükleri, hava durumunu ve şebeke dalgalanmalarını matematiksel olarak simüle eder.',
      badge: 'TEST / JÜRİ HAZIR',
      defaultEndpoint: 'AETHER-Virtual-NILM-Engine://local-synth',
      protocol: 'İç Sentetik Üreteç (1 Hz)',
    },
    {
      id: 'LIVE_MQTT',
      title: 'Canlı MQTT Broker / Endüstriyel IoT',
      description: 'Mevcut bina otomasyonu (BMS), PLC veya akıllı sayaç MQTT yayıncısına doğrudan abone olarak gerçek zamanlı telemetri paketlerini işler.',
      badge: 'DONANIM HAZIR',
      defaultEndpoint: 'mqtt://192.168.1.100:1883/telemetry/main_feeder',
      protocol: 'MQTT v5.0 / QoS 1',
    },
    {
      id: 'LIVE_WEBSOCKET',
      title: 'Canlı WebSocket / RS485 Modbus Ağ Geçidi',
      description: 'Ana elektrik panosundaki RS485 Modbus seri port dönüştürücüsünden gelen binary akımı doğrudan WebSocket soketinden çeker.',
      badge: 'DÜŞÜK GECİKME',
      defaultEndpoint: 'ws://192.168.1.150:8080/aether/telemetry',
      protocol: 'WebSocket Full-Duplex',
    },
    {
      id: 'LIVE_SMART_METER_REST',
      title: 'Akıllı Sayaç REST API (Smart Meter Gateway)',
      description: 'Dağıtım şirketi veya tesis akıllı sayacının (OSOS/AMR) JSON API uç noktasına periyodik istek atarak yük profillerini çeker.',
      badge: 'DAĞITIM ENTEGRASYONU',
      defaultEndpoint: 'https://smartmeter.facility.local/api/v1/telemetry',
      protocol: 'HTTPS REST Polling',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-700/80 bg-[#0d131f] p-6 shadow-2xl">
        
        {/* Başlık */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-950/60 border border-cyan-500/40 text-cyan-400">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">
                Donanım Soyutlama & Veri Kaynağı Seçimi
              </h2>
              <p className="text-xs text-slate-400">
                AETHER Donanımdan Bağımsız (Hardware-Agnostic) Veri İletim Katmanı
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Bilgilendirme Notu */}
        <div className="mt-4 p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-start gap-3">
          <Shield className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          <p className="text-xs text-slate-300 leading-relaxed">
            <strong className="text-cyan-300">Sıfır Donanım Mimarisi:</strong> AETHER yazılımı, fiziksel sensör veya pahalı alt sayaç montajı beklemez. Akıllı sayaç API'lerine, MQTT kuyruklarına veya seri dönüştürücülere tek tıkla bağlanabilir. Sunum esnasında "Simülasyon Modu" seçilidir.
          </p>
        </div>

        {/* Veri Kaynağı Listesi */}
        <div className="mt-4 space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
          {sources.map((src) => {
            const isSelected = selectedMode === src.id;
            return (
              <div
                key={src.id}
                onClick={() => {
                  setSelectedMode(src.id);
                  setEndpointInput(src.defaultEndpoint);
                }}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-cyan-950/30 border-cyan-500/60 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                    : 'bg-slate-900/50 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/80'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      isSelected ? 'border-cyan-400 bg-cyan-500/20' : 'border-slate-600'
                    }`}>
                      {isSelected && <div className="w-2 h-2 rounded-full bg-cyan-400" />}
                    </div>
                    <span className="text-sm font-semibold text-white">{src.title}</span>
                  </div>
                  <span className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded-full border ${
                    isSelected
                      ? 'bg-cyan-950 text-cyan-300 border-cyan-700'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}>
                    {src.badge}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1 pl-6 leading-relaxed">
                  {src.description}
                </p>
                <div className="mt-2 pl-6 flex items-center gap-3 text-[11px] font-mono text-slate-500">
                  <span>Protokol: <strong className="text-slate-300">{src.protocol}</strong></span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Endpoint Input */}
        <div className="mt-4">
          <label className="block text-xs font-mono text-slate-400 mb-1">
            Hedef Bağlantı Noktası (Endpoint / URI):
          </label>
          <input
            type="text"
            value={endpointInput}
            onChange={(e) => setEndpointInput(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
          />
        </div>

        {/* Footer Butonları */}
        <div className="mt-6 flex items-center justify-between pt-4 border-t border-slate-800">
          <div className="text-xs font-mono text-slate-400">
            Aktif Gecikme: <span className="text-emerald-400">{providerStatus.lastPingMs} ms</span> | Paket: <span className="text-emerald-400">1.0 Hz</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              Vazgeç
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 shadow-lg shadow-cyan-900/30 transition-all cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Kaynağı Değiştir ve Bağlan</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
