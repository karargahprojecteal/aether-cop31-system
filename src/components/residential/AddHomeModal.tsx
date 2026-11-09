import React, { useState } from 'react';
import { 
  X, 
  Home, 
  Building2, 
  ShieldCheck, 
  Zap, 
  ArrowRight, 
  CheckCircle2, 
  Gauge, 
  HelpCircle,
  FileText
} from 'lucide-react';
import { HomeProfile, HousingType, MeterInfrastructure, TariffType } from '../../types/residential';

interface AddHomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveHome: (homeData: Omit<HomeProfile, 'id' | 'createdAt'>) => void;
  tenantId: string;
}

export const AddHomeModal: React.FC<AddHomeModalProps> = ({
  isOpen,
  onClose,
  onSaveHome,
  tenantId,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('Antalya');
  const [housingType, setHousingType] = useState<HousingType>('APARTMENT_IN_BUILDING');
  const [squareMeters, setSquareMeters] = useState(140);
  const [residentCount, setResidentCount] = useState(3);
  const [meterInfra, setMeterInfra] = useState<MeterInfrastructure>('IN_UNIT_BREAKER_PANEL');
  const [heating, setHeating] = useState<'HEAT_PUMP' | 'NATURAL_GAS_COMBI' | 'ELECTRIC_RESISTANCE' | 'CENTRAL_DISTRICT'>('NATURAL_GAS_COMBI');
  const [hasSolar, setHasSolar] = useState(false);
  const [hasEv, setHasEv] = useState(false);
  const [tariffPlan, setTariffPlan] = useState<TariffType>('TURKISH_EPDK_3_TIME');
  const [kvkkConsent, setKvkkConsent] = useState(false);

  if (!isOpen) return null;

  const handleComplete = () => {
    if (!name.trim()) return;
    onSaveHome({
      tenantId,
      name,
      address,
      city,
      housingType,
      squareMeters,
      residentCount,
      meterInfrastructure: meterInfra,
      primaryHeating: heating,
      hasSolarPv: hasSolar,
      hasEvCharger: hasEv,
      tariffPlan,
      isPrimary: false,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-700/80 bg-[#0d131f] p-6 shadow-2xl font-sans">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-950/60 border border-cyan-500/40 text-cyan-400">
              <Home className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">
                Yeni Konut / Mülk Entegrasyon Sihirbazı
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Adım {step} / 3: {step === 1 ? 'Konut Profili' : step === 2 ? 'Sayaç ve Tesisat' : 'Uyumlu Entegrasyon Analizi'}
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

        {/* Step Indicator */}
        <div className="mt-4 flex items-center justify-between gap-2 text-xs font-mono">
          <div className={`flex-1 h-1.5 rounded-full ${step >= 1 ? 'bg-cyan-500' : 'bg-slate-800'}`} />
          <div className={`flex-1 h-1.5 rounded-full ${step >= 2 ? 'bg-cyan-500' : 'bg-slate-800'}`} />
          <div className={`flex-1 h-1.5 rounded-full ${step >= 3 ? 'bg-cyan-500' : 'bg-slate-800'}`} />
        </div>

        {/* STEP 1: Basic Profile */}
        {step === 1 && (
          <div className="mt-5 space-y-4 text-xs font-mono">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Konut / Mülk Adı:</label>
              <input
                type="text"
                placeholder="Örn: Lara Sahil Dairesi veya Yazlık Villa"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-cyan-300 focus:outline-none focus:border-cyan-500 text-xs font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Şehir:</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Konut Tipi:</label>
                <select
                  value={housingType}
                  onChange={(e) => setHousingType(e.target.value as HousingType)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs font-mono"
                >
                  <option value="APARTMENT_IN_BUILDING">Apartman Dairesi (Bina İçi)</option>
                  <option value="DETACHED_VILLA">Müstakil Villa</option>
                  <option value="COMMERCIAL_UNIT">Ticari Ofis / Dükkan</option>
                  <option value="RESIDENTIAL_ESTATE_SITE">Site / Toplu Konut</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Kullanım Alanı (m²):</label>
                <input
                  type="number"
                  value={squareMeters}
                  onChange={(e) => setSquareMeters(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Yaşayan Kişi Sayısı:</label>
                <input
                  type="number"
                  value={residentCount}
                  onChange={(e) => setResidentCount(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs font-mono"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                disabled={!name.trim()}
                onClick={() => setStep(2)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition-all disabled:opacity-40 cursor-pointer"
              >
                <span>Tesisat Adımına Geç</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Meter Infrastructure */}
        {step === 2 && (
          <div className="mt-5 space-y-4 text-xs font-mono">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Elektrik Sayacı ve Tesisat Durumu:
              </label>
              <div className="space-y-2 mt-2">
                {[
                  {
                    id: 'IN_UNIT_BREAKER_PANEL' as MeterInfrastructure,
                    title: 'Daire İçi Sigorta Kutusu Erişimi Var (Önerilen)',
                    desc: 'Daire kapı arkasındaki sigorta kutusu kapağı açılabilir; faz kablosuna harici akım trafosu (CT Clamp) takılabilir.',
                  },
                  {
                    id: 'ELECTRONIC_SMART_METER' as MeterInfrastructure,
                    title: 'Elektronik Akıllı Sayaç (Optik Portlu - Köhler, Luna, Makel)',
                    desc: 'Sayaç ön kapağında optik iletişim gözü var; müstakil sayaç kutusuna fiziksel erişim mümkün.',
                  },
                  {
                    id: 'LOCKED_BASEMENT_PANEL' as MeterInfrastructure,
                    title: 'Kilitli Bodrum / Sayaç Odası (Apartman / Site)',
                    desc: 'Sayaçlar zemin veya bodrum katında kilitli panoda. Wi-Fi sinyali yok; daire içinden ölçüm tercih edilecek.',
                  },
                  {
                    id: 'ANALOG_FERRARIS_METER' as MeterInfrastructure,
                    title: 'Mekanik Sayaç (Eski Dönen Diskli)',
                    desc: 'Dijital veri portu yok; aylık fatura veya akıllı priz ölçümü ile başlanacak.',
                  },
                ].map((item) => (
                  <label
                    key={item.id}
                    onClick={() => setMeterInfra(item.id)}
                    className={`block p-3 rounded-xl border cursor-pointer transition-all ${
                      meterInfra === item.id
                        ? 'bg-cyan-950/40 border-cyan-500/70 text-cyan-200'
                        : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={meterInfra === item.id}
                        onChange={() => setMeterInfra(item.id)}
                        className="text-cyan-500"
                      />
                      <span className="font-semibold text-white">{item.title}</span>
                    </div>
                    <p className="mt-1 pl-5 text-[11px] text-slate-400 font-sans">{item.desc}</p>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasSolar}
                  onChange={(e) => setHasSolar(e.target.checked)}
                />
                <span className="text-slate-300">Çatı Güneş (GES) Var</span>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasEv}
                  onChange={(e) => setHasEv(e.target.checked)}
                />
                <span className="text-slate-300">Elektrikli Araç (EV) Şarjı Var</span>
              </label>
            </div>

            <div className="pt-2 flex justify-between">
              <button
                onClick={() => setStep(1)}
                className="px-3 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-semibold"
              >
                Geri
              </button>
              <button
                onClick={() => setStep(3)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition-all cursor-pointer"
              >
                <span>Analizi Gör</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Pathway Evaluation & Recommendation */}
        {step === 3 && (
          <div className="mt-5 space-y-4 text-xs font-mono">
            <div className="p-4 rounded-xl bg-cyan-950/30 border border-cyan-500/40 space-y-2">
              <div className="flex items-center gap-2 text-cyan-300 font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>AETHER Önerilen Entegrasyon Yolu:</span>
              </div>

              {meterInfra === 'IN_UNIT_BREAKER_PANEL' && (
                <div className="text-slate-300 font-sans space-y-1 text-xs">
                  <p>
                    <strong className="text-white">AETHER Yerel IoT Gateway (CT Clamp Kiti):</strong> Daire içi sigorta kutusundaki ana faz kablosuna takılan mandallı akım trafosu ile binanın bodrumuna inmeden 1 Hz gerçek zamanlı enerji akışı alınabilir.
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Gerekli Donanım: 1 adet Split-Core CT Clamp + Wi-Fi ESP32/Pi Gateway. Elektrik kesilmez, sıfır kablo kesme.
                  </p>
                </div>
              )}

              {meterInfra === 'ELECTRONIC_SMART_METER' && (
                <div className="text-slate-300 font-sans space-y-1 text-xs">
                  <p>
                    <strong className="text-white">Optik Port / P1 Dongle veya Home Assistant:</strong> Mevcut elektronik sayacın manyetik optik gözüne takılan dongle ile sayaç indeksleri doğrudan okunur.
                  </p>
                </div>
              )}

              {(meterInfra === 'LOCKED_BASEMENT_PANEL' || meterInfra === 'ANALOG_FERRARIS_METER') && (
                <div className="text-slate-300 font-sans space-y-1 text-xs">
                  <p>
                    <strong className="text-white">Akıllı Prizler + Aylık Fatura Modu (Sıfır Donanım):</strong> Bodrum sayacına erişim gerekmeden, beyaz eşyalara takılan akıllı prizler ve faturanızdaki kWh verileriyle anında başlanabilir.
                  </p>
                </div>
              )}
            </div>

            {/* KVKK / GDPR Consent */}
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={kvkkConsent}
                  onChange={(e) => setKvkkConsent(e.target.checked)}
                  className="mt-0.5"
                />
                <span className="text-[11px] text-slate-300 leading-relaxed font-sans">
                  <strong>KVKK ve Veri Gizliliği Onayı:</strong> Konutumun elektrik tüketim verilerinin AETHER Yapay Zeka Karar Motoru tarafından anomali ve hayalet yük tespiti amacıyla işlenmesini, şifreli olarak saklanmasını onaylıyorum.
                </span>
              </label>
            </div>

            <div className="pt-2 flex justify-between">
              <button
                onClick={() => setStep(2)}
                className="px-3 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-semibold"
              >
                Geri
              </button>
              <button
                disabled={!kvkkConsent}
                onClick={handleComplete}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white font-bold text-xs transition-all disabled:opacity-40 cursor-pointer shadow-lg shadow-cyan-900/30"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Konutu Kaydet ve Başlat</span>
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
