import React, { useEffect, useState } from 'react';
import { Archive, Check, Copy, Edit3, Plus, RotateCcw, Search, Star, Trash2, X } from 'lucide-react';
import type { Genre, Language, Movie } from '../types';
import { PosterFrame } from './PosterFrame';

interface CatalogViewProps {
  onRefreshDashboard: () => void;
  openCreateSignal: number;
}

export const CatalogView: React.FC<CatalogViewProps> = ({ onRefreshDashboard, openCreateSignal }) => {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [scope, setScope] = useState<'admin_manage' | 'trending' | 'archived'>('admin_manage');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [editingMovie, setEditingMovie] = useState<Movie | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [formState, setFormState] = useState({
    title: '',
    movie_code: '',
    release_year: '',
    genres_text: '',
    language_name: "O‘zbekcha",
    duration_display: '',
    rating: '',
    telegram_file_id: '',
    description: '',
    is_trending: false,
    is_available: true,
  });

  useEffect(() => {
    if (openCreateSignal > 0) {
      setFormState({
        title: '',
        movie_code: '',
        release_year: '2025',
        genres_text: 'Drama',
        language_name: "O‘zbekcha",
        duration_display: '2 soat 10 daq',
        rating: '8.5',
        telegram_file_id: `BAACAgIAAxkBAAI_${Date.now()}`,
        description: '',
        is_trending: false,
        is_available: true,
      });
      setShowCreateModal(true);
    }
  }, [openCreateSignal]);

  const loadMovies = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ scope, page: String(page), pageSize: '8' });
      if (query.trim()) params.set('q', query.trim());
      const [mRes, tRes] = await Promise.all([fetch(`/api/movies?${params}`), fetch('/api/taxonomy')]);
      const mData = await mRes.json();
      const tData = await tRes.json();
      setMovies(mData.items || []);
      setTotalPages(mData.total_pages || 1);
      setTotalCount(mData.total_count || 0);
      setGenres(tData.genres || []);
      setLanguages(tData.languages || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMovies();
  }, [scope, page, query]);

  const handleCopy = (val: string) => {
    navigator.clipboard.writeText(val);
    setCopiedId(val);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const openEdit = (m: Movie) => {
    setEditingMovie(m);
    setFormState({
      title: m.title,
      movie_code: m.movie_code,
      release_year: m.release_year ? String(m.release_year) : '',
      genres_text: m.genres.map((g) => g.name).join(', '),
      language_name: m.language_name || '',
      duration_display: m.duration_display || '',
      rating: m.rating !== null ? String(m.rating) : '',
      telegram_file_id: m.telegram_file_id,
      description: m.description || '',
      is_trending: m.is_trending,
      is_available: m.is_available,
    });
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMovie) return;
    await fetch(`/api/movies/${editingMovie.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: formState.title,
        release_year: formState.release_year ? Number(formState.release_year) : null,
        genres: formState.genres_text.split(',').map((s) => s.trim()).filter(Boolean),
        language_name: formState.language_name,
        duration_display: formState.duration_display,
        rating: formState.rating ? Number(formState.rating) : null,
        telegram_file_id: formState.telegram_file_id,
        description: formState.description,
        is_trending: formState.is_trending,
        is_available: formState.is_available,
      }),
    });
    setEditingMovie(null);
    await loadMovies();
    onRefreshDashboard();
  };

  const createMovie = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/movies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: formState.title,
        movie_code: formState.movie_code || undefined,
        release_year: formState.release_year ? Number(formState.release_year) : null,
        genres: formState.genres_text.split(',').map((s) => s.trim()).filter(Boolean),
        language_name: formState.language_name,
        duration_display: formState.duration_display,
        rating: formState.rating ? Number(formState.rating) : null,
        telegram_file_id: formState.telegram_file_id,
        description: formState.description,
        is_trending: formState.is_trending,
      }),
    });
    setShowCreateModal(false);
    await loadMovies();
    onRefreshDashboard();
  };

  const toggleArchive = async (m: Movie) => {
    await fetch(`/api/movies/${m.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_archived: !m.is_archived, is_available: m.is_archived }),
    });
    await loadMovies();
    onRefreshDashboard();
  };

  const deleteMovie = async (id: number) => {
    await fetch(`/api/movies/${id}`, { method: 'DELETE' });
    await loadMovies();
    onRefreshDashboard();
  };

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 rounded-lg p-4">
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md w-fit">
          {[
            { id: 'admin_manage', label: 'Faol katalog' },
            { id: 'trending', label: 'Trenddagilar' },
            { id: 'archived', label: 'Arxiv' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setScope(tab.id as typeof scope);
                setPage(1);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                scope === tab.id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 flex-1 md:max-w-md">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Nomi, kod (KINO-1001), ID, yil, janr..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-slate-900"
            />
          </div>
          <button
            onClick={() => {
              setFormState({
                title: '',
                movie_code: '',
                release_year: '2025',
                genres_text: '',
                language_name: "O‘zbekcha",
                duration_display: '',
                rating: '',
                telegram_file_id: `BAACAgIAAxkBAAI_${Date.now()}`,
                description: '',
                is_trending: false,
                is_available: true,
              });
              setShowCreateModal(true);
            }}
            className="px-4 py-2 text-xs font-medium bg-slate-900 text-white rounded-md hover:bg-slate-800 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Qo‘lda qo‘shish
          </button>
        </div>
      </div>

      {/* Movie Data Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                <th className="py-3 px-4">Kino</th>
                <th className="py-3 px-4">Kod va ID</th>
                <th className="py-3 px-4">Telegram file_id</th>
                <th className="py-3 px-4">Holat</th>
                <th className="py-3 px-4 text-right">Ko‘rishlar</th>
                <th className="py-3 px-4 text-right">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500">
                    Katalog yuklanmoqda...
                  </td>
                </tr>
              ) : movies.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    Hech qanday kino topilmadi. Kanal sinxronizatsiyasi orqali video yuboring yoki qo‘lda qo‘shing.
                  </td>
                </tr>
              ) : (
                movies.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <PosterFrame src={m.poster_url} title={m.title} className="w-10 h-14 rounded shrink-0" />
                        <div className="min-w-0">
                          <div className="font-medium text-slate-900 flex items-center gap-1.5">
                            <span className="truncate max-w-xs">{m.title}</span>
                            {m.is_trending && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {m.release_year || 'Yil yo‘q'} · {m.genres.map((g) => g.name).join(', ') || 'Janr yo‘q'} · {m.language_name || 'Til yo‘q'}
                            {m.rating ? ` · ★ ${m.rating}` : ''}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-700 tabular-nums">
                      <div>{m.movie_code}</div>
                      <div className="text-slate-400">
                        ID: {m.id} {m.channel_message_id ? `· msg #${m.channel_message_id}` : ''}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => handleCopy(m.telegram_file_id)}
                        className="inline-flex items-center gap-1.5 font-mono text-xs text-slate-600 hover:text-slate-900 max-w-[200px]"
                        title={m.telegram_file_id}
                      >
                        <span className="truncate">{m.telegram_file_id}</span>
                        {copiedId === m.telegram_file_id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        )}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-xs">
                      {!m.is_available ? (
                        <span className="text-red-700 font-medium">Mavjud emas</span>
                      ) : m.needs_metadata_review ? (
                        <span className="text-amber-700 font-medium">To‘ldirish zarur</span>
                      ) : (
                        <span className="text-emerald-700 font-medium">Faol · Sinxron</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs font-medium text-slate-800 tabular-nums">
                      {m.views_count.toLocaleString('uz-UZ')}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => openEdit(m)}
                          className="p-2 text-slate-500 hover:text-slate-900 rounded hover:bg-slate-100"
                          title="Tahrirlash"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => toggleArchive(m)}
                          className="p-2 text-slate-500 hover:text-slate-900 rounded hover:bg-slate-100"
                          title={m.is_archived ? 'Tiklash' : 'Arxivlash'}
                        >
                          {m.is_archived ? <RotateCcw className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => deleteMovie(m.id)}
                          className="p-2 text-slate-400 hover:text-red-600 rounded hover:bg-red-50"
                          title="O‘chirish"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <div className="tabular-nums">
            Jami: <strong>{totalCount}</strong> ta kino · Sahifa {page}/{totalPages}
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-40 whitespace-nowrap shrink-0"
            >
              Oldingi
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-40 whitespace-nowrap shrink-0"
            >
              Keyingi
            </button>
          </div>
        </div>
      </div>

      {/* Genres & Languages summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs font-semibold text-slate-700 mb-2">Mavjud janrlar ({genres.length})</div>
          <div className="text-xs text-slate-600 leading-relaxed">
            {genres.map((g) => `${g.name} (${g.movie_count || 0})`).join(' · ') || 'Janrlar yo‘q'}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs font-semibold text-slate-700 mb-2">Tillar ({languages.length})</div>
          <div className="text-xs text-slate-600 leading-relaxed">
            {languages.map((l) => `${l.name} [${l.code}] (${l.movie_count || 0})`).join(' · ') || 'Tillar yo‘q'}
          </div>
        </div>
      </div>

      {/* Create / Edit Modal */}
      {(editingMovie || showCreateModal) && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg w-full max-w-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">
                {editingMovie ? `Kinoni tahrirlash (${editingMovie.movie_code})` : 'Yangi kino qo‘shish'}
              </h3>
              <button
                onClick={() => {
                  setEditingMovie(null);
                  setShowCreateModal(false);
                }}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={editingMovie ? saveEdit : createMovie} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">Kino nomi *</label>
                  <input
                    required
                    value={formState.title}
                    onChange={(e) => setFormState({ ...formState, title: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Yil</label>
                  <input
                    type="number"
                    value={formState.release_year}
                    onChange={(e) => setFormState({ ...formState, release_year: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Reyting (0–10)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    value={formState.rating}
                    onChange={(e) => setFormState({ ...formState, rating: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Janrlar (vergul bilan)</label>
                  <input
                    value={formState.genres_text}
                    onChange={(e) => setFormState({ ...formState, genres_text: e.target.value })}
                    placeholder="Fantastika, Drama"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Til</label>
                  <input
                    value={formState.language_name}
                    onChange={(e) => setFormState({ ...formState, language_name: e.target.value })}
                    placeholder="O‘zbekcha"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Davomiyligi</label>
                  <input
                    value={formState.duration_display}
                    onChange={(e) => setFormState({ ...formState, duration_display: e.target.value })}
                    placeholder="2 soat 15 daq"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Telegram file_id *</label>
                  <input
                    required
                    value={formState.telegram_file_id}
                    onChange={(e) => setFormState({ ...formState, telegram_file_id: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-md"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">Tavsif</label>
                  <textarea
                    rows={3}
                    value={formState.description}
                    onChange={(e) => setFormState({ ...formState, description: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
                  />
                </div>
                <div className="flex items-center gap-4 sm:col-span-2">
                  <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={formState.is_trending}
                      onChange={(e) => setFormState({ ...formState, is_trending: e.target.checked })}
                    />
                    Trenddagi kino
                  </label>
                  {editingMovie && (
                    <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
                      <input
                        type="checkbox"
                        checked={formState.is_available}
                        onChange={(e) => setFormState({ ...formState, is_available: e.target.checked })}
                      />
                      Botda mavjud
                    </label>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setEditingMovie(null);
                    setShowCreateModal(false);
                  }}
                  className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-md hover:bg-slate-50"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-medium bg-slate-900 text-white rounded-md hover:bg-slate-800"
                >
                  Saqlash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
