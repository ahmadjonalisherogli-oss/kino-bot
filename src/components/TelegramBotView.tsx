import React, { useEffect, useState } from 'react';
import { Check, ExternalLink, Film, Heart, Play, Search, ShieldAlert, User } from 'lucide-react';
import type { Genre, Language, Movie, SubscriptionChannel } from '../types';
import { PosterFrame } from './PosterFrame';

interface TelegramBotViewProps {
  onRefreshDashboard: () => void;
}

const DEMO_USER_TG_ID = 841209311;

export const TelegramBotView: React.FC<TelegramBotViewProps> = ({ onRefreshDashboard }) => {
  const [subChannels, setSubChannels] = useState<SubscriptionChannel[]>([]);
  const [joinedChannelIds, setJoinedChannelIds] = useState<number[]>([]);
  const [isSubVerified, setIsSubVerified] = useState(true);
  const [subNotice, setSubNotice] = useState<string | null>(null);

  const [activeMenu, setActiveMenu] = useState<
    'all' | 'trending' | 'new' | 'popular' | 'search' | 'genres' | 'languages' | 'favorites' | 'stats'
  >('all');
  const [movies, setMovies] = useState<Movie[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [selectedGenreId, setSelectedGenreId] = useState<number | null>(null);
  const [selectedLangId, setSelectedLangId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [watchingMovie, setWatchingMovie] = useState<Movie | null>(null);
  const [userStats, setUserStats] = useState({ views: 0, favs: 0, catalog: 0 });

  const loadSubChannels = async () => {
    const res = await fetch('/api/subscriptions');
    const data: SubscriptionChannel[] = await res.json();
    const active = data.filter((c) => c.is_active);
    setSubChannels(active);
    setJoinedChannelIds(active.map((c) => c.channel_id));
    setIsSubVerified(true);
  };

  const loadTaxonomyAndStats = async () => {
    const [tRes, uRes, dRes] = await Promise.all([
      fetch('/api/taxonomy'),
      fetch('/api/users'),
      fetch('/api/dashboard'),
    ]);
    const tData = await tRes.json();
    const uData = await uRes.json();
    const dData = await dRes.json();
    setGenres(tData.genres || []);
    setLanguages(tData.languages || []);
    const demoUser = (uData.users || []).find((u: { telegram_id: number }) => u.telegram_id === DEMO_USER_TG_ID);
    setUserStats({
      views: demoUser?.views_count || 0,
      favs: demoUser?.favorites_count || 0,
      catalog: dData.kpis?.available_movies || 0,
    });
  };

  const loadMovies = async () => {
    let scope = 'all';
    if (activeMenu === 'trending') scope = 'trending';
    else if (activeMenu === 'popular') scope = 'popular';
    else if (activeMenu === 'favorites') scope = 'favorites';

    const params = new URLSearchParams({
      scope,
      page: String(page),
      pageSize: '6',
      userTelegramId: String(DEMO_USER_TG_ID),
    });
    if (activeMenu === 'search' && searchQuery.trim()) params.set('q', searchQuery.trim());
    if (activeMenu === 'genres' && selectedGenreId) params.set('genreId', String(selectedGenreId));
    if (activeMenu === 'languages' && selectedLangId) params.set('languageId', String(selectedLangId));

    const res = await fetch(`/api/movies?${params}`);
    const data = await res.json();
    setMovies(data.items || []);
    setTotalPages(data.total_pages || 1);
    setTotalCount(data.total_count || 0);
  };

  useEffect(() => {
    loadSubChannels();
    loadTaxonomyAndStats();
  }, []);

  useEffect(() => {
    if (activeMenu !== 'stats') {
      loadMovies();
    }
  }, [activeMenu, page, searchQuery, selectedGenreId, selectedLangId]);

  const handleCheckSubscription = () => {
    const missing = subChannels.filter((c) => !joinedChannelIds.includes(c.channel_id));
    if (missing.length > 0) {
      setIsSubVerified(false);
      setSubNotice(`Hali ${missing.length} ta kanalga obuna bo‘lmadingiz.`);
      return;
    }
    setIsSubVerified(true);
    setSubNotice(null);
  };

  const handleWatch = async (movie: Movie) => {
    const res = await fetch(`/api/movies/${movie.id}/watch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userTelegramId: DEMO_USER_TG_ID }),
    });
    const updated: Movie = await res.json();
    setSelectedMovie(updated);
    setWatchingMovie(updated);
    await loadMovies();
    await loadTaxonomyAndStats();
    onRefreshDashboard();
  };

  const handleToggleFavorite = async (movie: Movie) => {
    const res = await fetch(`/api/movies/${movie.id}/favorite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userTelegramId: DEMO_USER_TG_ID }),
    });
    const data = await res.json();
    setSelectedMovie({ ...movie, is_favorite: data.is_favorite });
    await loadMovies();
    await loadTaxonomyAndStats();
  };

  const menuButtons: Array<{ id: typeof activeMenu; label: string }> = [
    { id: 'all', label: '🎬 Barcha kinolar' },
    { id: 'trending', label: '🔥 Trenddagi kinolar' },
    { id: 'new', label: '🆕 Yangi kinolar' },
    { id: 'popular', label: '⭐ Eng mashhur kinolar' },
    { id: 'search', label: '🔎 Kino qidirish' },
    { id: 'genres', label: '🎭 Janrlar' },
    { id: 'languages', label: '🌍 Til bo‘yicha' },
    { id: 'favorites', label: '❤️ Sevimlilar' },
    { id: 'stats', label: '📊 Mening statistikam' },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Column: Telegram Uzbek Main Menu & Subscription Gate Controls */}
      <div className="lg:col-span-4 space-y-5">
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">O‘zbekcha Bot Menyusi</h2>
              <p className="text-xs text-slate-500">ReplyKeyboard tugmalari (real DB so‘rovlari)</p>
            </div>
            <User className="w-4 h-4 text-slate-400" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            {menuButtons.map((btn, idx) => (
              <button
                key={btn.id}
                onClick={() => {
                  setActiveMenu(btn.id);
                  setPage(1);
                  setSelectedMovie(null);
                  if (btn.id !== 'genres') setSelectedGenreId(null);
                  if (btn.id !== 'languages') setSelectedLangId(null);
                }}
                className={`${
                  idx === 4 ? 'col-span-2' : ''
                } px-3 py-2.5 text-xs font-medium rounded-md border text-left transition-colors whitespace-nowrap truncate ${
                  activeMenu === btn.id
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {/* Mandatory Subscription Gate Simulator */}
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-slate-900">Majburiy obuna tekshiruvi</h3>
            <button
              onClick={() => {
                setJoinedChannelIds([]);
                setIsSubVerified(false);
              }}
              className="text-xs text-blue-600 hover:underline"
            >
              Chiqishni sinash
            </button>
          </div>
          <p className="text-xs text-slate-500 mb-3">
            Foydalanuvchi faol kanallarga a’zo bo‘lmasa, <code>getChatMember</code> tekshiruvi botdan foydalanishni cheklaydi.
          </p>
          {subChannels.length === 0 ? (
            <div className="text-xs text-slate-500">Majburiy kanallar yo‘q (ochiq kirish).</div>
          ) : (
            <div className="space-y-2">
              {subChannels.map((ch) => {
                const isJoined = joinedChannelIds.includes(ch.channel_id);
                return (
                  <div key={ch.id} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100 last:border-0">
                    <span className="font-medium text-slate-700 truncate mr-2">{ch.title}</span>
                    <button
                      onClick={() => {
                        setJoinedChannelIds((prev) =>
                          isJoined ? prev.filter((id) => id !== ch.channel_id) : [...prev, ch.channel_id]
                        );
                      }}
                      className={`px-2.5 py-1 rounded border whitespace-nowrap shrink-0 ${
                        isJoined
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                          : 'border-slate-200 bg-white text-slate-700'
                      }`}
                    >
                      {isJoined ? 'A’zo bo‘lingan' : 'A’zo emas'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Interactive Telegram Bot Viewport */}
      <div className="lg:col-span-8 bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">KinoSync Bot (@kinosync_uz_bot)</div>
            <div className="text-xs text-slate-300">
              O‘zbek tilidagi foydalanuvchi interfeysi · Foydalanuvchi ID: 841209311
            </div>
          </div>
          {!isSubVerified && (
            <span className="text-xs text-amber-300 font-medium">Obuna kutilmoqda</span>
          )}
        </div>

        {/* Subscription Gate Screen */}
        {!isSubVerified && subChannels.length > 0 ? (
          <div className="p-8 max-w-md mx-auto text-center space-y-4">
            <ShieldAlert className="w-10 h-10 text-amber-600 mx-auto" />
            <h3 className="text-base font-semibold text-slate-900">
              Botdan to‘liq foydalanish uchun quyidagi kanallarga obuna bo‘ling
            </h3>
            <p className="text-xs text-slate-500">
              Obuna bo‘lgach, «✅ Obunani tekshirish» tugmasini bosing.
            </p>
            <div className="space-y-2 pt-2">
              {subChannels.map((ch) => (
                <div key={ch.id} className="flex items-center justify-between gap-2 border border-slate-200 rounded-md px-3 py-2">
                  <span className="text-xs font-medium text-slate-800 truncate">{ch.title}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() =>
                        setJoinedChannelIds((prev) =>
                          prev.includes(ch.channel_id) ? prev : [...prev, ch.channel_id]
                        )
                      }
                      className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 inline-flex items-center gap-1"
                    >
                      Kanalga qo‘shilish
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {subNotice && <div className="text-xs text-red-600 font-medium">{subNotice}</div>}
            <button
              onClick={handleCheckSubscription}
              className="w-full py-2.5 text-xs font-semibold bg-slate-900 text-white rounded-md hover:bg-slate-800 inline-flex items-center justify-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              ✅ Obunani tekshirish
            </button>
          </div>
        ) : (
          <div className="p-5 space-y-5">
            {/* Search input when in search mode */}
            {activeMenu === 'search' && (
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Kino nomi, ID, kod (KINO-1001), yil (2024), janr yoki til kiriting..."
                  className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-slate-900"
                />
              </div>
            )}

            {/* Genre selector */}
            {activeMenu === 'genres' && (
              <div className="flex flex-wrap gap-2">
                {genres.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => {
                      setSelectedGenreId(g.id === selectedGenreId ? null : g.id);
                      setPage(1);
                    }}
                    className={`px-3 py-1.5 text-xs font-medium rounded border transition-colors ${
                      selectedGenreId === g.id
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    🎭 {g.name} ({g.movie_count || 0})
                  </button>
                ))}
              </div>
            )}

            {/* Language selector */}
            {activeMenu === 'languages' && (
              <div className="flex flex-wrap gap-2">
                {languages.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => {
                      setSelectedLangId(l.id === selectedLangId ? null : l.id);
                      setPage(1);
                    }}
                    className={`px-3 py-1.5 text-xs font-medium rounded border transition-colors ${
                      selectedLangId === l.id
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    🌍 {l.name} ({l.movie_count || 0})
                  </button>
                ))}
              </div>
            )}

            {/* Personal Stats */}
            {activeMenu === 'stats' ? (
              <div className="border border-slate-200 rounded-lg p-6 space-y-4 bg-slate-50">
                <h3 className="text-base font-semibold text-slate-900">📊 Mening statistikam</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-white border border-slate-200 rounded-md p-4">
                    <div className="text-xs text-slate-500">Tomosha qilingan kinolar</div>
                    <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">{userStats.views} ta</div>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-md p-4">
                    <div className="text-xs text-slate-500">Sevimli kinolar</div>
                    <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">{userStats.favs} ta</div>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-md p-4">
                    <div className="text-xs text-slate-500">Katalogdagi faol kinolar</div>
                    <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">{userStats.catalog} ta</div>
                  </div>
                </div>
              </div>
            ) : selectedMovie ? (
              /* Movie Detail Card (with Watch & Favorite buttons) */
              <div className="border border-slate-200 rounded-lg p-5 space-y-5">
                <div className="flex flex-col sm:flex-row gap-5">
                  <PosterFrame
                    src={selectedMovie.poster_url}
                    title={selectedMovie.title}
                    className="w-full sm:w-44 h-64 rounded-md shrink-0"
                  />
                  <div className="flex-1 space-y-3">
                    <div>
                      <div className="text-xs font-mono text-slate-500">
                        {selectedMovie.movie_code} · ID: {selectedMovie.id}
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 mt-1">{selectedMovie.title}</h3>
                    </div>
                    <div className="text-xs text-slate-600 space-y-1.5">
                      <div>📅 Yil: <strong>{selectedMovie.release_year || 'Ko‘rsatilmagan'}</strong></div>
                      <div>🎭 Janr: <strong>{selectedMovie.genres.map((g) => g.name).join(', ') || 'Ko‘rsatilmagan'}</strong></div>
                      <div>🌍 Til: <strong>{selectedMovie.language_name || 'Ko‘rsatilmagan'}</strong></div>
                      <div>⏱ Davomiyligi: <strong>{selectedMovie.duration_display || 'Ko‘rsatilmagan'}</strong></div>
                      <div>⭐ Reyting: <strong>{selectedMovie.rating ? `${selectedMovie.rating}/10` : 'Ko‘rsatilmagan'}</strong></div>
                      <div>👁 Ko‘rishlar: <strong className="tabular-nums">{selectedMovie.views_count}</strong></div>
                    </div>
                    {selectedMovie.description && (
                      <p className="text-sm text-slate-700 leading-relaxed pt-1">{selectedMovie.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 pt-2">
                      <button
                        onClick={() => handleWatch(selectedMovie)}
                        className="px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-md hover:bg-slate-800 inline-flex items-center gap-1.5"
                      >
                        <Play className="w-3.5 h-3.5 fill-white" />
                        🎬 Kinoni ko‘rish
                      </button>
                      <button
                        onClick={() => handleToggleFavorite(selectedMovie)}
                        className="px-4 py-2 text-xs font-medium border border-slate-200 rounded-md hover:bg-slate-50 inline-flex items-center gap-1.5"
                      >
                        <Heart
                          className={`w-3.5 h-3.5 ${
                            selectedMovie.is_favorite ? 'text-red-600 fill-red-600' : 'text-slate-500'
                          }`}
                        />
                        {selectedMovie.is_favorite ? 'Sevimlilardan o‘chirish' : 'Sevimlilarga qo‘shish'}
                      </button>
                      <button
                        onClick={() => {
                          setSelectedMovie(null);
                          setWatchingMovie(null);
                        }}
                        className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
                      >
                        ⬅️ Ro‘yxatga qaytish
                      </button>
                    </div>
                  </div>
                </div>

                {/* Video Playback via stored Telegram file_id */}
                {watchingMovie && watchingMovie.id === selectedMovie.id && (
                  <div className="bg-slate-950 text-slate-100 rounded-md p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-emerald-400">
                        Telegram serveridan file_id orqali uzatildi (sendVideo)
                      </span>
                      <span className="font-mono text-slate-400">Ko‘rishlar: {watchingMovie.views_count}</span>
                    </div>
                    <div className="font-mono text-xs text-slate-300 break-all bg-slate-900 p-2.5 rounded border border-slate-800">
                      file_id: {watchingMovie.telegram_file_id}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Inline Movie List + Pagination */
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Jami topildi: <strong className="text-slate-800 tabular-nums">{totalCount}</strong> ta</span>
                  <span className="tabular-nums">Sahifa {page}/{totalPages}</span>
                </div>

                {movies.length === 0 ? (
                  <div className="py-12 text-center border border-dashed border-slate-200 rounded-lg text-sm text-slate-500">
                    <Film className="w-6 h-6 text-slate-300 mx-auto mb-2" />
                    Bu bo‘limda kinolar topilmadi.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {movies.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setSelectedMovie(m)}
                        className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg text-left hover:border-slate-400 hover:bg-slate-50/50 transition-colors"
                      >
                        <PosterFrame src={m.poster_url} title={m.title} className="w-12 h-16 rounded shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-slate-900 truncate">{m.title}</div>
                          <div className="text-xs text-slate-500 mt-0.5 truncate">
                            {m.release_year || '—'} · {m.language_name || '—'} {m.rating ? `· ★ ${m.rating}` : ''}
                          </div>
                          <div className="text-[11px] font-mono text-slate-400 mt-1">{m.movie_code}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-center gap-2 pt-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-40"
                  >
                    ⬅️ Oldingi
                  </button>
                  <span className="px-3 py-1.5 text-xs font-mono text-slate-600 tabular-nums">
                    {page}/{totalPages}
                  </span>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-40"
                  >
                    Keyingi ➡️
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
