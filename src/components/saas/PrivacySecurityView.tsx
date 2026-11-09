import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Download, 
  Trash2, 
  AlertTriangle, 
  FileText, 
  Lock, 
  CheckCircle2,
  Clock
} from 'lucide-react';
import { TenantContext } from '../../types/saas';
import { aetherApiClientInstance } from '../../services/api/aetherApiClient';

interface PrivacySecurityProps {
  context: TenantContext;
}

export const PrivacySecurityView: React.FC<PrivacySecurityProps> = ({ context }) => {
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [purgeMessage, setPurgeMessage] = useState('');
  const [exportSuccess, setExportSuccess] = useState(false);

  const logs = aetherApiClientInstance.listAuditLogs(context.tenantId, 15);

  const handleExportData = () => {
    const data = aetherApiClientInstance.exportTenantData(context);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AETHER_KVKK_EXPORT_${context.tenantId}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExportSuccess(true);
    setTimeout(() => setExportSuccess(false), 3000);
  };

  const handlePurge = () => {
    try {
      const result = aetherApiClientInstance.purgeTenantData(context, deleteConfirmation);
      setPurgeMessage(result.message);
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800/90 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-cyan-950/60 border border-cyan-500/40 text-cyan-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h2 className="text-base font-bold text-white tracking-wide">
                KVKK & GDPR Güvenlik, Gizlilik ve Veri Denetim Merkezi
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
              6698 Sayılı Kişisel Verilerin Korunması Kanunu (KVKK) uyarınca konut enerji telemetri verileriniz şifrelenir, asla üçüncü partilere satılmaz ve dilediğiniz an tek tıkla dışa aktarılabilir veya kalıcı olarak silinebilir.
            </p>
          </div>
        </div>
      </div>

      {/* Action Cards: Data Export & Right to be Forgotten */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        
        {/* Data Portability / Export */}
        <div className="glass-panel rounded-2xl p-5 border border-slate-800/90 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
              <Download className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-bold font-mono text-white">VERİ TAŞINABİLİRLİĞİ (KVKK Madde 11)</h3>
            </div>
            <p className="text-xs text-slate-300 mt-3 leading-relaxed font-sans">
              Konutunuza ait tüm ham sayaç telemetrisi, saatlik tüketim kayıtları, kayıtlı cihazlar ve denetim loglarını içeren eksiksiz veri paketini standart JSON formatında cihazınıza indirin.
            </p>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between">
            <span className="text-[10px] font-mono text-slate-500">JSON Formatı • Anında İndirme</span>
            <button
              onClick={handleExportData}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs font-mono transition-all cursor-pointer shadow-md shadow-cyan-950"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{exportSuccess ? 'Veriler İndirildi!' : 'Verilerimi İndir'}</span>
            </button>
          </div>
        </div>

        {/* Right to Erasure / Purge */}
        <div className="glass-panel-danger rounded-2xl p-5 border border-rose-500/30 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-3 border-b border-rose-900/60">
              <Trash2 className="w-4 h-4 text-rose-400" />
              <h3 className="text-xs font-bold font-mono text-rose-200">UNUTULMA HAKKI (HESAP & VERİ SİLME)</h3>
            </div>
            <p className="text-xs text-slate-300 mt-3 leading-relaxed font-sans">
              Bu işlem konutunuza ait tüm telemetri kayıtlarını, cihaz eşleştirmelerini ve yapay zeka optimizasyon geçmişini kalıcı olarak silinmek üzere işaretler. Geri alınamaz.
            </p>
          </div>

          {purgeMessage ? (
            <div className="mt-4 p-3 rounded-xl bg-rose-950/80 border border-rose-500 text-rose-200 text-xs font-mono">
              {purgeMessage}
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              <input
                type="text"
                placeholder={`Onay için 'DELETE-${context.tenantId}' yazın`}
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-rose-900/80 text-rose-300 placeholder:text-slate-600 text-xs font-mono"
              />
              <button
                disabled={deleteConfirmation !== `DELETE-${context.tenantId}`}
                onClick={handlePurge}
                className="w-full py-2 rounded-xl bg-rose-700 hover:bg-rose-600 text-white font-bold text-xs font-mono transition-all disabled:opacity-40 cursor-pointer"
              >
                Tüm Verileri Kalıcı Olarak Sil
              </button>
            </div>
          )}
        </div>

      </div>

      {/* Security Audit Log Stream */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800/90 shadow-xl">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">Güvenlik & Değişiklik Denetim İzi (Audit Log)</h3>
          </div>
          <span className="text-[10px] font-mono text-slate-500">Değiştirilemez Kütük</span>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500 uppercase text-[10px]">
                <th className="py-2 px-3">Zaman</th>
                <th className="py-2 px-3">Kullanıcı</th>
                <th className="py-2 px-3">İşlem / Kategori</th>
                <th className="py-2 px-3">Detay</th>
                <th className="py-2 px-3 text-right">Seviye</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-900/40">
                  <td className="py-2.5 px-3 text-slate-500">{new Date(log.timestamp).toLocaleTimeString('tr-TR')}</td>
                  <td className="py-2.5 px-3 font-semibold text-white">{log.userEmail}</td>
                  <td className="py-2.5 px-3 text-cyan-400">{log.action}</td>
                  <td className="py-2.5 px-3 text-slate-400 truncate max-w-xs">{JSON.stringify(log.details)}</td>
                  <td className="py-2.5 px-3 text-right">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                      log.severity === 'CRITICAL'
                        ? 'bg-rose-950 text-rose-300 border-rose-700'
                        : log.severity === 'WARNING'
                        ? 'bg-amber-950 text-amber-300 border-amber-700'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}>
                      {log.severity}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
