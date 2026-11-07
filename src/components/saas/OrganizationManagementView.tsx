import React, { useState } from 'react';
import { 
  Building2, 
  Users, 
  UserPlus, 
  ShieldCheck, 
  Mail, 
  Trash2, 
  CheckCircle2, 
  Lock,
  X 
} from 'lucide-react';
import { OrganizationMember, UserRole, TenantContext } from '../../types/saas';
import { aetherApiClientInstance } from '../../services/api/aetherApiClient';

interface OrgManagementProps {
  context: TenantContext;
}

export const OrganizationManagementView: React.FC<OrgManagementProps> = ({ context }) => {
  const [members, setMembers] = useState<OrganizationMember[]>(() =>
    aetherApiClientInstance.listMembers(context)
  );
  const [org, setOrg] = useState(() =>
    aetherApiClientInstance.getOrganization(context.tenantId)
  );

  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('ANALYST');
  const [showInviteModal, setShowInviteModal] = useState(false);

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !newName.trim()) return;

    const invited = aetherApiClientInstance.addMember(context, {
      tenantId: context.tenantId,
      userId: `user-${Date.now()}`,
      name: newName,
      email: newEmail,
      role: newRole,
      assignedHomeIds: [],
    });

    setMembers([...members, invited]);
    setNewEmail('');
    setNewName('');
    setShowInviteModal(false);
  };

  const roleBadges: Record<UserRole, { label: string; color: string }> = {
    OWNER: { label: 'KURUCU / OWNER', color: 'bg-emerald-950 text-emerald-300 border-emerald-500/50' },
    ENERGY_MANAGER: { label: 'ENERJİ YÖNETİCİSİ', color: 'bg-cyan-950 text-cyan-300 border-cyan-500/50' },
    ANALYST: { label: 'VERİ ANALİSTİ', color: 'bg-blue-950 text-blue-300 border-blue-500/50' },
    AUDITOR: { label: 'DENETÇİ (AUDITOR)', color: 'bg-purple-950 text-purple-300 border-purple-500/50' },
    RESIDENT_VIEWER: { label: 'SAKİN / RESIDENT', color: 'bg-slate-800 text-slate-300 border-slate-700' },
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800/90 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-cyan-950/60 border border-cyan-500/40 text-cyan-400">
                <Building2 className="w-5 h-5" />
              </div>
              <h2 className="text-base font-bold text-white tracking-wide">
                Organizasyon & Çoklu Kullanıcı Rol Yönetimi (RBAC)
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Kurumsal ve konut bazlı rol yetkilendirmesi, ekip üyeleri ve veri erişim sınırları
            </p>
          </div>

          <button
            onClick={() => setShowInviteModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white font-semibold text-xs font-mono transition-all cursor-pointer shadow-md shadow-cyan-900/30"
          >
            <UserPlus className="w-4 h-4" />
            <span>Yeni Üye Davet Et</span>
          </button>
        </div>

        {/* Organization Info Strip */}
        {org && (
          <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
            <div>
              <span className="text-slate-500">Organizasyon: </span>
              <strong className="text-white">{org.name}</strong>
            </div>
            <div>
              <span className="text-slate-500">Tenant Slug: </span>
              <strong className="text-cyan-300">{org.slug}</strong>
            </div>
            <div>
              <span className="text-slate-500">İletişim: </span>
              <strong className="text-slate-300">{org.contactEmail}</strong>
            </div>
          </div>
        )}
      </div>

      {/* Members Table */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800/90 shadow-xl overflow-hidden">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">Yetkili Ekip Üyeleri ({members.length})</h3>
          </div>
          <span className="text-xs font-mono text-slate-400">Sunucu Taraflı İzolasyon Aktif</span>
        </div>

        <div className="overflow-x-auto mt-4">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500 uppercase text-[10px]">
                <th className="py-2.5 px-3">Kullanıcı Adı</th>
                <th className="py-2.5 px-3">E-Posta</th>
                <th className="py-2.5 px-3">Rol & Yetki</th>
                <th className="py-2.5 px-3">Erişilebilir Konutlar</th>
                <th className="py-2.5 px-3 text-right">Katılım Tarihi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {members.map((m) => {
                const badge = roleBadges[m.role];
                return (
                  <tr key={m.id} className="hover:bg-slate-900/40">
                    <td className="py-3 px-3 font-semibold text-white">{m.name}</td>
                    <td className="py-3 px-3 text-slate-400">{m.email}</td>
                    <td className="py-3 px-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${badge.color}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-400">
                      {m.assignedHomeIds.length === 0 ? 'Tüm Konutlar (Kurumsal)' : `${m.assignedHomeIds.length} Konut`}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-500">
                      {new Date(m.invitedAt).toLocaleDateString('tr-TR')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="relative w-full max-w-md rounded-2xl border border-slate-700/80 bg-[#0d131f] p-6 shadow-2xl font-mono text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-white text-sm">Yeni Ekip Üyesi Davet Et</h3>
              <button onClick={() => setShowInviteModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleInvite} className="mt-4 space-y-3">
              <div>
                <label className="block text-slate-300 mb-1">Ad Soyad:</label>
                <input
                  type="text"
                  required
                  placeholder="Ahmet Yılmaz"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-cyan-300 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">E-Posta:</label>
                <input
                  type="email"
                  required
                  placeholder="ahmet@sirket.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-cyan-300 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Kullanıcı Rolü:</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200"
                >
                  <option value="ENERGY_MANAGER">Enerji Yöneticisi (Mülk & Cihaz Yönetir)</option>
                  <option value="ANALYST">Veri Analisti (Yalnızca Rapor ve Grafik Görür)</option>
                  <option value="AUDITOR">Denetçi (COP31 Raporlarını Doğrular)</option>
                  <option value="RESIDENT_VIEWER">Sakin / Kiracı (Sadece Kendi Dairesini Görür)</option>
                </select>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold cursor-pointer"
                >
                  Daveti Gönder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
