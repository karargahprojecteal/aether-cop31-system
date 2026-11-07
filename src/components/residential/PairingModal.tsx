import React, { useState, useEffect } from 'react';
import { X, Key, ShieldCheck, CheckCircle2, Clock, Radio, ArrowRight, AlertTriangle } from 'lucide-react';
import { IntegrationPathway, DeviceRecord, PairingToken } from '../../types/residential';
import { pairingServiceInstance } from '../../services/integration/PairingService';

interface PairingModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
  homeId: string;
  initialPathway?: IntegrationPathway;
  onDevicePaired: (device: DeviceRecord) => void;
}

export const PairingModal: React.FC<PairingModalProps> = ({
  isOpen,
  onClose,
  tenantId,
  homeId,
  initialPathway = 'LOCAL_GATEWAY',
  onDevicePaired,
}) => {
  const [deviceType, setDeviceType] = useState<DeviceRecord['deviceType']>('MAIN_METER');
  const [adapterType, setAdapterType] = useState<IntegrationPathway>(initialPathway);
  const [pairingToken, setPairingToken] = useState<PairingToken | null>(null);
  const [deviceName, setDeviceName] = useState('Yeni Akıllı Sayaç / Gateway');
  const [manufacturer, setManufacturer] = useState('AETHER IoT');
  const [serialNumber, setSerialNumber] = useState('');
  const [timeLeftSec, setTimeLeftSec] = useState(900); // 15 mins
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [pairingSuccess, setPairingSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      // Generate new pairing token immediately
      const token = pairingServiceInstance.generatePairingToken(
        tenantId,
        homeId,
        deviceType,
        adapterType
      );
      setPairingToken(token);
      setTimeLeftSec(900);
      setPairingSuccess(false);
      setErrorMessage('');
    }
  }, [isOpen, tenantId, homeId, deviceType, adapterType]);

  useEffect(() => {
    if (!isOpen || !pairingToken) return;
    const interval = setInterval(() => {
      setTimeLeftSec((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen, pairingToken]);

  if (!isOpen) return null;

  const handleClaim = () => {
    if (!pairingToken) return;
    setIsRedeeming(true);
    setErrorMessage('');

    setTimeout(() => {
      const result = pairingServiceInstance.redeemPairingToken(tenantId, pairingToken.token, {
        name: deviceName,
        manufacturer,
        serialNumber: serialNumber || `SN-${pairingToken.token}`,
      });

      setIsRedeeming(false);
      if (result.success && result.device) {
        setPairingSuccess(true);
        onDevicePaired(result.device);
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setErrorMessage(result.error || 'Eşleştirme başarısız oldu');
      }
    }, 800);
  };

  const minutes = Math.floor(timeLeftSec / 60);
  const seconds = timeLeftSec % 60;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-700/80 bg-[#0d131f] p-6 shadow-2xl font-sans">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-950/60 border border-cyan-500/40 text-cyan-400">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">
                Güvenli Cihaz Eşleştirme (Pairing)
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                15 Dakikalık Tek Kullanımlık Kriptografik Token
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

        {/* Pairing Code Card */}
        <div className="mt-5 p-5 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-cyan-500/30 text-center space-y-2">
          <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
            Cihaz / Ağ Geçidi Eşleştirme Kodu
          </div>
          
          <div className="text-4xl font-extrabold font-mono text-cyan-300 tracking-widest py-2 select-all drop-shadow-[0_0_15px_rgba(6,182,212,0.4)]">
            {pairingToken?.token || '........'}
          </div>

          <div className="flex items-center justify-center gap-1.5 text-xs font-mono text-slate-400">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>Kalan Süre: </span>
            <strong className="text-amber-300">
              {minutes}:{seconds < 10 ? `0${seconds}` : seconds}
            </strong>
          </div>
        </div>

        {/* Form Inputs */}
        <div className="mt-4 space-y-3 text-xs font-mono">
          <div>
            <label className="block text-slate-300 mb-1">Cihaz İsmi:</label>
            <input
              type="text"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-cyan-300 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 mb-1">Üretici / Model:</label>
              <input
                type="text"
                value={manufacturer}
                onChange={(e) => setManufacturer(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200"
              />
            </div>
            <div>
              <label className="block text-slate-300 mb-1">Seri No (Opsiyonel):</label>
              <input
                type="text"
                placeholder="SN-..."
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200"
              />
            </div>
          </div>
        </div>

        {errorMessage && (
          <div className="mt-3 p-3 rounded-xl bg-rose-950/60 border border-rose-500/50 text-rose-300 text-xs font-mono flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
          >
            İptal
          </button>

          <button
            disabled={isRedeeming || pairingSuccess || timeLeftSec === 0}
            onClick={handleClaim}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white font-bold text-xs font-mono transition-all disabled:opacity-40 cursor-pointer shadow-lg shadow-cyan-900/30"
          >
            {pairingSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                <span>Eşleşti!</span>
              </>
            ) : isRedeeming ? (
              <span>Doğrulanıyor...</span>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Kodu Doğrula ve Bağla</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
