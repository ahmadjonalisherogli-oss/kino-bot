import React, { useEffect, useState } from 'react';
import { Bell, Plus, Shield, Trash2, Users } from 'lucide-react';
import type { BotAdmin, BotUser, BroadcastAnnouncement, SubscriptionChannel } from '../types';

export const SubscriptionsUsersView: React.FC = () => {
  const [subChannels, setSubChannels] = useState<SubscriptionChannel[]>([]);
  const [users, setUsers] = useState<BotUser[]>([]);
  const [admins, setAdmins] = useState<BotAdmin[]>([]);
  const [broadcasts, setBroadcasts] = useState<BroadcastAnnouncement[]>([]);

  const [subForm, setSubForm] = useState({ channel_id: '', title: '', invite_link: '' });
  const [adminForm, setAdminForm] = useState({ telegram_id: '', full_name: '', username: '', role: 'moderator' });
  const [broadcastForm, setBroadcastForm] = useState({ title: '', message_text: '' });
  const [notice, setNotice] = useState<string | null>(null);

  const loadAll = async () => {
    const [sRes, uRes] = await Promise.all([fetch('/api/subscriptions'), fetch('/api/users')]);
    setSubChannels(await sRes.json());
    const uData = await uRes.json();
    setUsers(uData.users || []);
    setAdmins(uData.admins || []);
    setBroadcasts(uData.broadcasts || []);
  };

  useEffect(() => {
    loadAll();
  }, []);

  const addSubChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/subscriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel_id: Number(subForm.channel_id),
        title: subForm.title,
        invite_link: subForm.invite_link,
      }),
    });
    if (res.ok) {
      setSubForm({ channel_id: '', title: '', invite_link: '' });
      setNotice('Majburiy obuna kanali qo‘shildi.');
      loadAll();
    }
  };

  const toggleSub = async (ch: SubscriptionChannel) => {
    await fetch(`/api/subscriptions/${ch.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !ch.is_active }),
    });
    loadAll();
  };

  const deleteSub = async (id: number) => {
    await fetch(`/api/subscriptions/${id}`, { method: 'DELETE' });
    loadAll();
  };

  const addAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/admins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telegram_id: Number(adminForm.telegram_id),
        full_name: adminForm.full_name,
        username: adminForm.username || null,
        role: adminForm.role,
        can_broadcast: adminForm.role === 'superadmin',
      }),
    });
    if (res.ok) {
      setAdminForm({ telegram_id: '', full_name: '', username: '', role: 'moderator' });
      setNotice('Yangi administrator qo‘shildi.');
      loadAll();
    }
  };

  const sendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/broadcasts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(broadcastForm),
    });
    if (res.ok) {
      setBroadcastForm({ title: '', message_text: '' });
      setNotice('Xabarnoma barcha faol foydalanuvchilarga yuborildi.');
      loadAll();
    }
  };

  return (
    <div className="space-y-6">
      {notice && (
        <div className="px-4 py-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg text-sm flex justify-between">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="text-xs underline">
            Yopish
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Mandatory Subscription Channels */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Majburiy obuna kanallari</h2>
            <span className="text-xs text-slate-500 tabular-nums">{subChannels.length} ta kanal</span>
          </div>
          <div className="divide-y divide-slate-100">
            {subChannels.map((ch) => (
              <div key={ch.id} className="py-2.5 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-900 truncate">{ch.title}</div>
                  <div className="text-xs font-mono text-slate-500 truncate">
                    {ch.channel_id} · {ch.invite_link}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => toggleSub(ch)}
                    className={`px-2.5 py-1 text-xs rounded border ${
                      ch.is_active
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    {ch.is_active ? 'Faol' : 'O‘chiq'}
                  </button>
                  <button onClick={() => deleteSub(ch.id)} className="p-1 text-slate-400 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={addSubChannel} className="space-y-2.5 pt-3 border-t border-slate-100">
            <div className="text-xs font-semibold text-slate-700">Yangi homiy kanal qo‘shish</div>
            <div className="grid grid-cols-2 gap-2">
              <input
                required
                type="number"
                placeholder="Kanal ID (-100...)"
                value={subForm.channel_id}
                onChange={(e) => setSubForm({ ...subForm, channel_id: e.target.value })}
                className="px-3 py-1.5 text-xs font-mono border border-slate-200 rounded-md"
              />
              <input
                required
                placeholder="Kanal nomi"
                value={subForm.title}
                onChange={(e) => setSubForm({ ...subForm, title: e.target.value })}
                className="px-3 py-1.5 text-xs border border-slate-200 rounded-md"
              />
            </div>
            <div className="flex gap-2">
              <input
                required
                type="url"
                placeholder="https://t.me/kanalingiz"
                value={subForm.invite_link}
                onChange={(e) => setSubForm({ ...subForm, invite_link: e.target.value })}
                className="flex-1 px-3 py-1.5 text-xs border border-slate-200 rounded-md"
              />
              <button
                type="submit"
                className="px-3 py-1.5 text-xs font-medium bg-slate-900 text-white rounded-md hover:bg-slate-800 inline-flex items-center gap-1 whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" /> Qo‘shish
              </button>
            </div>
          </form>
        </div>

        {/* Broadcast Announcements */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Foydalanuvchilarga xabarnoma yuborish</h2>
            <Bell className="w-4 h-4 text-slate-400" />
          </div>
          <form onSubmit={sendBroadcast} className="space-y-3">
            <input
              required
              placeholder="Xabarnoma sarlavhasi (masalan: Yangi premyeralar)"
              value={broadcastForm.title}
              onChange={(e) => setBroadcastForm({ ...broadcastForm, title: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
            />
            <textarea
              required
              rows={3}
              placeholder="Xabar matni..."
              value={broadcastForm.message_text}
              onChange={(e) => setBroadcastForm({ ...broadcastForm, message_text: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
            />
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium bg-slate-900 text-white rounded-md hover:bg-slate-800"
            >
              Barcha faol foydalanuvchilarga yuborish
            </button>
          </form>

          {broadcasts.length > 0 && (
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <div className="text-xs font-semibold text-slate-700">Yuborilgan xabarnomalar</div>
              {broadcasts.slice(0, 4).map((b) => (
                <div key={b.id} className="text-xs flex items-center justify-between py-1">
                  <span className="font-medium text-slate-800 truncate">{b.title}</span>
                  <span className="font-mono text-emerald-700 tabular-nums shrink-0">
                    {b.sent_count} ta yuborildi
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bot Users & Administrators */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-900">Bot foydalanuvchilari</h3>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="divide-y divide-slate-100">
            {users.map((u) => (
              <div key={u.id} className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <div className="font-medium text-slate-900">
                    {[u.first_name, u.last_name].filter(Boolean).join(' ') || 'Foydalanuvchi'}{' '}
                    {u.username && <span className="text-slate-500">@{u.username}</span>}
                  </div>
                  <div className="font-mono text-slate-400">ID: {u.telegram_id}</div>
                </div>
                <div className="text-right font-mono text-slate-600 tabular-nums">
                  {u.views_count || 0} ko‘rish · {u.favorites_count || 0} sevimli
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Platforma administratorlari</h3>
            <Shield className="w-4 h-4 text-slate-400" />
          </div>
          <div className="divide-y divide-slate-100">
            {admins.map((a) => (
              <div key={a.id} className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <div className="font-medium text-slate-900">{a.full_name}</div>
                  <div className="font-mono text-slate-400">
                    ID: {a.telegram_id} {a.username ? `· @${a.username}` : ''}
                  </div>
                </div>
                <span className="font-mono text-slate-700">{a.role}</span>
              </div>
            ))}
          </div>

          <form onSubmit={addAdmin} className="space-y-2 pt-3 border-t border-slate-100">
            <div className="text-xs font-semibold text-slate-700">Administrator qo‘shish</div>
            <div className="grid grid-cols-2 gap-2">
              <input
                required
                type="number"
                placeholder="Telegram ID"
                value={adminForm.telegram_id}
                onChange={(e) => setAdminForm({ ...adminForm, telegram_id: e.target.value })}
                className="px-3 py-1.5 text-xs font-mono border border-slate-200 rounded-md"
              />
              <input
                required
                placeholder="To‘liq ism"
                value={adminForm.full_name}
                onChange={(e) => setAdminForm({ ...adminForm, full_name: e.target.value })}
                className="px-3 py-1.5 text-xs border border-slate-200 rounded-md"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={adminForm.role}
                onChange={(e) => setAdminForm({ ...adminForm, role: e.target.value })}
                className="px-3 py-1.5 text-xs border border-slate-200 rounded-md bg-white"
              >
                <option value="moderator">Moderator</option>
                <option value="channel_manager">Kanal menejeri</option>
                <option value="superadmin">Superadmin</option>
              </select>
              <button
                type="submit"
                className="px-3 py-1.5 text-xs font-medium bg-slate-900 text-white rounded-md hover:bg-slate-800"
              >
                Saqlash
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
