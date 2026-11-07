import React, { useState } from 'react';
import { X, FileText, CheckCircle2, DollarSign, Zap, Calendar } from 'lucide-react';
import { ManualConsumptionAdapter } from '../../services/adapters/ManualConsumptionAdapter';
import { TariffType } from '../../types/residential';

interface ManualBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
  homeId: string;
  onBillAdded: () => void;
}

export const ManualBillModal: React.FC<ManualBillModalProps> = ({
  isOpen,
  onClose,
  tenantId,
  homeId,
  onBillAdded,
}) => {
  const [invoiceNumber, setInvoiceNumber] = useState(`FAT-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`);
  const [periodStart, setPeriodStart] = useState('2026-10-01');
  const [periodEnd, setPeriodEnd] = useState('2026-10-31');
  const [totalKwh, setTotalKwh] = useState(320);
  const [totalCostTry, setTotalCostTry] = useState(1344);
  const [tariffType, setTariffType] = useState<TariffType>('TURKISH_EPDK_3_TIME');
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const adapter = new ManualConsumptionAdapter();
    adapter.initialize({ tenantId, homeId, deviceId: 'dev-manual-invoice-01' });

    adapter.addManualBill({
      tenantId,
      homeId,
      invoiceNumber,
      periodStart,
      periodEnd,
      totalKwh: Number(totalKwh),
      totalCostTry: Number(totalCostTry),
      tariffType,
    });

    setIsSuccess(true);
    onBillAdded();
    setTimeout(() => {
      setIsSuccess(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-700/80 bg-[#0d131f] p-6 shadow-2xl font-sans">
        
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-950/60 border border-cyan-500/40 text-cyan-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">
                Aylık Elektrik Faturası & Manuel Tüketim Girişi
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Sıfır Donanım Modu (Mekanik & Kilitli Sayaçlar İçin)
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

        <form onSubmit={handleSubmit} className="mt-5 space-y-4 text-xs font-mono">
          <div>
            <label className="block text-slate-300 mb-1">Fatura / Sayaç Belge Numarası:</label>
            <input
              type="text"
              required
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-cyan-300 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 mb-1">Dönem Başlangıç:</label>
              <input
                type="date"
                required
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200"
              />
            </div>
            <div>
              <label className="block text-slate-300 mb-1">Dönem Bitiş:</label>
              <input
                type="date"
                required
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 mb-1">Toplam Tüketim (kWh):</label>
              <input
                type="number"
                required
                min="1"
                value={totalKwh}
                onChange={(e) => setTotalKwh(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-cyan-300"
              />
            </div>
            <div>
              <label className="block text-slate-300 mb-1">Fatura Tutarı (TL):</label>
              <input
                type="number"
                required
                min="1"
                value={totalCostTry}
                onChange={(e) => setTotalCostTry(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-amber-300"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 mb-1">Tarife Türü:</label>
            <select
              value={tariffType}
              onChange={(e) => setTariffType(e.target.value as TariffType)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200"
            >
              <option value="TURKISH_EPDK_3_TIME">EPDK 3-Zamanlı Tarife (Gündüz / Puant / Gece)</option>
              <option value="SINGLE_TARIFF_FLAT">Tek Zamanlı Kademeli Tarife</option>
            </select>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 font-sans leading-relaxed">
            Girilen fatura verisi, döneme ait günlük ortalama baz yükü hesaplayarak mevsimsel regresyon modellerine ve COP31 karbon azaltım karnesine işlenecektir.
          </div>

          <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-400 hover:text-white"
            >
              Vazgeç
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white font-bold cursor-pointer"
            >
              {isSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                  <span>Kaydedildi!</span>
                </>
              ) : (
                <span>Faturayı Kaydet ve Analize Ekle</span>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
