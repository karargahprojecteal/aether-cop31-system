import React, { useState } from 'react';
import { 
  Cpu, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertTriangle, 
  Radio, 
  Clock, 
  ShieldCheck, 
  RefreshCw 
} from 'lucide-react';
import { DeviceRecord } from '../../types/residential';
import { aetherApiClientInstance } from '../../services/api/aetherApiClient';
import { connectionHealthMonitorInstance } from '../../services/integration/ConnectionHealthMonitor';

interface DeviceRegistryViewProps {
  tenantId: string;
  homeId: string;
  onOpenPairing: () => void;
}

export const DeviceRegistryView: React.FC<DeviceRegistryViewProps> = ({
  tenantId,
  homeId,
  onOpenPairing,
}) => {
  const [devices, setDevices] = useState<DeviceRecord[]>(() =>
    aetherApiClientInstance.listDevices(tenantId, homeId)
  );

  const refreshList = () => {
    setDevices(aetherApiClientInstance.listDevices(tenantId, homeId));
  };

  const handleRevoke = (deviceId: string) => {
    aetherApiClientInstance.revokeDevice(tenantId, deviceId);
    refreshList();
  };

  const qualityBadges: Record<string, { label: string; color: string }> = {
    PHYSICAL_METERED: { label: 'FİZİKSEL ANA SAYAÇ', color: 'bg-emerald-950 text-emerald-300 border-emerald-500/50' },
    SUB_METERED: { label: 'ALT SAYAÇ / PRİZ', color: 'bg-cyan-950 text-cyan-300 border-cyan-500/50' },
    DERIVED_NILM: { label: 'NILM AYRIŞTIRMA', color: 'bg-purple-950 text-purple-300 border-purple-500/50' },
    MANUAL_BILL: { label: 'MANUEL FATURA', color: 'bg-amber-950 text-amber-300 border-amber-500/50' },
    ESTIMATED: { label: 'SİMÜLASYON / TAHMİN', color: 'bg-slate-800 text-slate-300 border-slate-700' },
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800/90 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-cyan-950/60 border border-cyan-500/40 text-cyan-400">
                <Cpu className="w-5 h-5" />
              </div>
              <h2 className="text-base font-bold text-white tracking-wide">
                Konut Cihaz & Sayaç Kayıt Defteri (Device Registry)
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Bağlı olan tüm akıllı sayaçlar, CT akım trafoları, alt sayaç röleleri ve akıllı prizlerin canlı sağlık durumu
            </p>
          </div>

          <button
            onClick={onOpenPairing}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white font-semibold text-xs font-mono transition-all cursor-pointer shadow-md shadow-cyan-900/40"
          >
            <Plus className="w-4 h-4" />
            <span>Yeni Cihaz Eşleştir</span>
          </button>
        </div>
      </div>

      {/* Devices List */}
      <div className="space-y-3">
        {devices.length === 0 ? (
          <div className="p-8 text-center rounded-2xl border border-slate-800 bg-slate-900/40 text-xs font-mono">
            <Radio className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <div className="text-slate-300 font-semibold">Bu konuta bağlı cihaz bulunamadı</div>
            <p className="text-slate-500 mt-1">Yeni bir akıllı sayaç veya gateway eklemek için yukarıdaki eşleştirme butonunu kullanın.</p>
          </div>
        ) : (
          devices.map((device) => {
            const health = connectionHealthMonitorInstance.getHealth(device.id);
            const qualityInfo = qualityBadges[device.measurementQuality] || {
              label: device.measurementQuality,
              color: 'bg-slate-800 text-slate-400 border-slate-700',
            };

            return (
              <div
                key={device.id}
                className="glass-panel rounded-2xl p-4.5 border border-slate-800/90 hover:border-slate-700 transition-all shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs font-mono"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-cyan-400 shrink-0 mt-0.5">
                    <Radio className={`w-4 h-4 ${device.pairingStatus === 'PAIRED' ? 'animate-pulse' : ''}`} />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-white text-sm">{device.name}</h3>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${qualityInfo.color}`}>
                        {qualityInfo.label}
                      </span>
                      {device.isSubMeteredOnly && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-950/80 border border-purple-500/40 text-purple-300">
                          SUB-METER ONLY
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 flex flex-wrap items-center gap-3">
                      <span>Model: <strong className="text-slate-300">{device.manufacturer || 'Standart'} {device.model || ''}</strong></span>
                      <span>Protokol: <strong className="text-cyan-400">{device.adapterType}</strong></span>
                      <span>Seri No: <strong className="text-slate-300">{device.serialNumber || 'SN-N/A'}</strong></span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-4 pt-3 md:pt-0 border-t md:border-t-0 border-slate-800">
                  <div className="text-right">
                    <div className="flex items-center gap-1.5 text-emerald-400 font-semibold justify-end">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      <span>{health.status}</span>
                      <span className="text-slate-500 text-[11px]">({health.latencyMs}ms)</span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Paket Hata: %{health.errorRatePercent} • {health.packetsReceived} pkt
                    </div>
                  </div>

                  {device.pairingStatus === 'PAIRED' ? (
                    <button
                      onClick={() => handleRevoke(device.id)}
                      className="p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors cursor-pointer"
                      title="Cihaz Bağlantısını Sonlandır"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  ) : (
                    <span className="text-[10px] px-2 py-1 rounded bg-rose-950 border border-rose-800 text-rose-400 font-bold">
                      İPTAL EDİLDİ
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
};
