import React, { useEffect, useState } from 'react';
import { CheckCircle2, Edit3, Film, Link2, RefreshCw, Send, ShieldCheck, Trash2, UploadCloud } from 'lucide-react';
import type { ChannelPost, SyncLog, TelegramChannel } from '../types';

interface ChannelSyncViewProps {
  onRefreshDashboard: () => void;
}

export const ChannelSyncView: React.FC<ChannelSyncViewProps> = ({ onRefreshDashboard }) => {
  const [channels, setChannels] = useState<TelegramChannel[]>([]);
  const [posts, setPosts] = useState<ChannelPost[]>([]);
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'warn' | 'err'; text: string } | null>(null);

  // Add channel form
  const [newChannelId, setNewChannelId] = useState('');
  const [newChannelTitle, setNewChannelTitle] = useState('');
  const [newChannelUser, setNewChannelUser] = useState('');

  // Channel Post Sync Tester
  const [selectedChannelId, setSelectedChannelId] = useState<number>(-1002145908812);
  const [postMessageId, setPostMessageId] = useState<number>(501);
  const [postType, setPostType] = useState<'video' | 'document' | 'album'>('video');
  const [fileId, setFileId] = useState('BAACAgIAAxkBAAI_sync_hd_501');
  const [fileUniqueId, setFileUniqueId] = useState('AgAD_UNIQ_SYNC_501');
  const [caption, setCaption] = useState(
    '🎬 Movie: Interstellar\n📅 Year: 2014\n🎭 Genre: Sci-Fi, Drama\n🌍 Language: O‘zbekcha\n⭐ Rating: 8.7\n⏱ Duration: 2 soat 49 daq\n📝 Description: Yulduzlararo sayohat haqidagi afsonaviy ilmiy-fantastik film.'
  );

  // Real Bot Token Verifier
  const [botToken, setBotToken] = useState('');
  const [tokenResult, setTokenResult] = useState<string | null>(null);

  const loadSyncData = async () => {
    const res = await fetch('/api/channels');
    const data = await res.json();
    setChannels(data.channels || []);
    setPosts(data.posts || []);
    setLogs(data.logs || []);
    if (data.channels?.length > 0 && !data.channels.some((c: TelegramChannel) => c.channel_id === selectedChannelId)) {
      setSelectedChannelId(data.channels[0].channel_id);
    }
  };

  useEffect(() => {
    loadSyncData();
  }, []);

  const handleAddChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel_id: Number(newChannelId),
        title: newChannelTitle,
        username: newChannelUser || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setFeedback({ type: 'err', text: data.error });
      return;
    }
    setNewChannelId('');
    setNewChannelTitle('');
    setNewChannelUser('');
    setFeedback({ type: 'ok', text: 'Kanal sinxronizatsiya tizimiga ulandi.' });
    await loadSyncData();
    onRefreshDashboard();
  };

  const toggleChannelSync = async (ch: TelegramChannel) => {
    await fetch(`/api/channels/${ch.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sync_enabled: !ch.sync_enabled }),
    });
    await loadSyncData();
  };

  const handlePublishChannelPost = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/sync/channel-post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telegram_channel_id: selectedChannelId,
        message_id: postMessageId,
        caption,
        file_id: fileId,
        file_unique_id: fileUniqueId,
        is_document_video: postType === 'document',
        mime_type: postType === 'document' ? 'video/x-matroska' : 'video/mp4',
        media_group_id: postType === 'album' ? `mg_${postMessageId}` : null,
        is_media_group_album: postType === 'album',
        poster_file_id: postType === 'album' ? `AgACAgIAA_poster_${postMessageId}` : null,
      }),
    });
    const data = await res.json();
    if (res.status === 403) {
      setFeedback({ type: 'err', text: data.message });
    } else if (data.action === 'duplicate_skipped') {
      setFeedback({
        type: 'warn',
        text: `Dublikat aniqlandi (${data.reason})! Qayta yozish oldi olindi va SyncLog ga yozildi.`,
      });
    } else if (data.action === 'created') {
      setFeedback({
        type: 'ok',
        text: `Sinxronlandi: "${data.movie.title}" [${data.movie.movie_code}] katalogga avtomatik qo‘shildi.`,
      });
      setPostMessageId((n) => n + 1);
      setFileId(`BAACAgIAAxkBAAI_sync_${postMessageId + 1}`);
      setFileUniqueId(`AgAD_UNIQ_SYNC_${postMessageId + 1}`);
    }
    await loadSyncData();
    onRefreshDashboard();
  };

  const handleEditPost = async (post: ChannelPost) => {
    const updatedCaption = `${post.raw_caption || `🎬 Movie: ${post.movie_title || 'Film'}`}\n⭐ Rating: 9.0`;
    await fetch(`/api/sync/channel-post/${post.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caption: updatedCaption }),
    });
    setFeedback({ type: 'ok', text: `Post #${post.message_id} tahrirlandi (edited_channel_post) va bazada yangilandi.` });
    await loadSyncData();
    onRefreshDashboard();
  };

  const handleDeletePost = async (post: ChannelPost) => {
    await fetch(`/api/sync/channel-post/${post.id}`, { method: 'DELETE' });
    setFeedback({
      type: 'warn',
      text: `Post #${post.message_id} o‘chirilgan deb belgilandi. Kino katalogda "Mavjud emas" holatiga o‘tdi.`,
    });
    await loadSyncData();
    onRefreshDashboard();
  };

  const verifyRealToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setTokenResult('Tekshirilmoqda...');
    const res = await fetch('/api/telegram/verify-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: botToken }),
    });
    const data = await res.json();
    if (!res.ok) {
      setTokenResult(`Xato: ${data.error}`);
    } else {
      setTokenResult(`Tasdiqlandi: @${data.bot.username} (ID: ${data.bot.id})`);
    }
  };

  return (
    <div className="space-y-6">
      {feedback && (
        <div
          className={`px-4 py-3 rounded-lg border text-sm flex items-center justify-between ${
            feedback.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : feedback.type === 'warn'
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          <span>{feedback.text}</span>
          <button onClick={() => setFeedback(null)} className="text-xs underline ml-4">
            Yopish
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Channel Post Publisher (Auto-Sync Tester) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Avtomatik kanal-bot sinxronizatsiyasi</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Kanalga video, hujjat (.mkv) yoki Media Group albom joylash hodisasini real bazada sinab ko‘ring
              </p>
            </div>
            <UploadCloud className="w-5 h-5 text-slate-400" />
          </div>

          <form onSubmit={handlePublishChannelPost} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Manba kanal</label>
                <select
                  value={selectedChannelId}
                  onChange={(e) => setSelectedChannelId(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md bg-white"
                >
                  {channels.map((ch) => (
                    <option key={ch.id} value={ch.channel_id}>
                      {ch.title} ({ch.channel_id})
                    </option>
                  ))}
                  <option value={-100999999999}>Ruxsatsiz kanal (-100999999999)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Post turi</label>
                <select
                  value={postType}
                  onChange={(e) => setPostType(e.target.value as typeof postType)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md bg-white"
                >
                  <option value="video">Video xabar (MP4)</option>
                  <option value="document">Video hujjat (MKV/AVI)</option>
                  <option value="album">Media Group (Poster + Video)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Xabar ID</label>
                <input
                  type="number"
                  value={postMessageId}
                  onChange={(e) => setPostMessageId(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-md"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Telegram file_id</label>
                <input
                  required
                  value={fileId}
                  onChange={(e) => setFileId(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-md"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">file_unique_id (Dublikat nazorati)</label>
                <input
                  required
                  value={fileUniqueId}
                  onChange={(e) => setFileUniqueId(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-md"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Strukturaviy post matni (Caption Parser)
              </label>
              <textarea
                rows={7}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-md leading-relaxed"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() =>
                  setCaption('🎬 Kino: Yulduzlararo Sayohat\n📅 Yil: 2025\n🎭 Janr: Fantastika, Sarguzasht')
                }
                className="text-xs text-slate-600 hover:text-slate-900 underline"
              >
                To‘liq bo‘lmagan matn namunasini qo‘yish
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-medium bg-slate-900 text-white rounded-md hover:bg-slate-800 inline-flex items-center gap-2 whitespace-nowrap shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                Kanalga joylash va sinxronlash
              </button>
            </div>
          </form>
        </div>

        {/* Connected Channels & Real Bot Token Check */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <h2 className="text-base font-semibold text-slate-900 mb-3">Ulangan kanallar</h2>
            <div className="divide-y divide-slate-100 mb-4">
              {channels.map((ch) => (
                <div key={ch.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900 truncate">{ch.title}</div>
                    <div className="text-xs font-mono text-slate-500">
                      {ch.channel_id} {ch.username ? `· @${ch.username}` : ''} · {ch.synced_count || 0} ta post
                    </div>
                  </div>
                  <button
                    onClick={() => toggleChannelSync(ch)}
                    className={`px-3 py-1 text-xs font-medium rounded border whitespace-nowrap shrink-0 ${
                      ch.sync_enabled
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : 'border-slate-200 bg-slate-50 text-slate-600'
                    }`}
                  >
                    {ch.sync_enabled ? 'Sinxron faol' : 'To‘xtatilgan'}
                  </button>
                </div>
              ))}
            </div>

            <form onSubmit={handleAddChannel} className="space-y-2.5 pt-3 border-t border-slate-100">
              <div className="text-xs font-semibold text-slate-700">Yangi kanal ulash</div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  required
                  type="number"
                  placeholder="Kanal ID (-100...)"
                  value={newChannelId}
                  onChange={(e) => setNewChannelId(e.target.value)}
                  className="px-3 py-1.5 text-xs font-mono border border-slate-200 rounded-md"
                />
                <input
                  placeholder="@username"
                  value={newChannelUser}
                  onChange={(e) => setNewChannelUser(e.target.value)}
                  className="px-3 py-1.5 text-xs border border-slate-200 rounded-md"
                />
              </div>
              <div className="flex gap-2">
                <input
                  required
                  placeholder="Kanal nomi"
                  value={newChannelTitle}
                  onChange={(e) => setNewChannelTitle(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-xs border border-slate-200 rounded-md"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 text-xs font-medium bg-slate-900 text-white rounded-md hover:bg-slate-800 whitespace-nowrap shrink-0"
                >
                  Ulash
                </button>
              </div>
            </form>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className="w-4 h-4 text-slate-700" />
              <h3 className="text-sm font-semibold text-slate-900">Telegram Bot Token tekshiruvi</h3>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Haqiqiy @BotFather tokeningizni Telegram API (<code>getMe</code>) orqali tekshiring (serverda saqlanmaydi).
            </p>
            <form onSubmit={verifyRealToken} className="flex gap-2">
              <input
                type="password"
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                placeholder="123456789:AAH..."
                className="flex-1 px-3 py-1.5 text-xs font-mono border border-slate-200 rounded-md"
              />
              <button
                type="submit"
                className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-md hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                Tekshirish
              </button>
            </form>
            {tokenResult && <div className="mt-2 text-xs font-mono text-slate-700">{tokenResult}</div>}
          </div>
        </div>
      </div>

      {/* Synchronized Channel Posts & Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Sinxronlangan kanal postlari</h3>
            <button onClick={loadSyncData} className="text-xs text-slate-500 hover:text-slate-900 inline-flex items-center gap-1">
              <RefreshCw className="w-3.5 h-3.5" /> Yangilash
            </button>
          </div>
          <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
            {posts.map((p) => (
              <div key={p.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-900 truncate">
                    {p.movie_title || 'Nomsiz post'}{' '}
                    <span className="font-mono text-xs text-slate-400">#{p.message_id}</span>
                  </div>
                  <div className="text-xs text-slate-500 truncate">
                    {p.channel_title} · {p.status} · <span className="font-mono">{p.file_unique_id}</span>
                  </div>
                </div>
                {!p.is_deleted && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleEditPost(p)}
                      className="px-2.5 py-1 text-xs border border-slate-200 rounded hover:bg-slate-50 inline-flex items-center gap-1"
                      title="edited_channel_post simulyatsiyasi"
                    >
                      <Edit3 className="w-3 h-3" /> Tahrir
                    </button>
                    <button
                      onClick={() => handleDeletePost(p)}
                      className="px-2.5 py-1 text-xs border border-red-200 text-red-700 rounded hover:bg-red-50 inline-flex items-center gap-1"
                      title="Post o‘chirilganini belgilash"
                    >
                      <Trash2 className="w-3 h-3" /> O‘chirish
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Sinxronizatsiya jurnali (SyncLog)</h3>
            <span className="text-xs text-slate-500 tabular-nums">{logs.length} ta yozuv</span>
          </div>
          <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
            {logs.map((l) => (
              <div key={l.id} className="px-5 py-3 text-xs">
                <div className="flex items-center justify-between font-medium text-slate-800">
                  <span className="font-mono">{l.event_type}</span>
                  <span className={l.success ? 'text-emerald-700' : 'text-red-700'}>
                    {l.success ? 'Muvaffaqiyatli' : 'Rad etildi'}
                  </span>
                </div>
                <div className="text-slate-600 mt-1">{l.details}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
