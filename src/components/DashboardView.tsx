import React from 'react';
import { ArrowUpRight, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import type { DashboardData } from '../types';
import { PosterFrame } from './PosterFrame';

interface DashboardViewProps {
  data: DashboardData | null;
  loading: boolean;
  onNavigate: (tab: string) => void;
}

const EVENT_LABELS: Record<string, string> = {
  created: 'Yangi kino sinxronlandi',
  updated: 'Post tahrirlandi',
  duplicate_skipped: 'Dublikat o‘tkazib yuborildi',
  media_group_merged: 'Media guruh birlashtirildi',
  marked_unavailable: 'Post o‘chirilgan',
  unauthorized_channel: 'Ruxsatsiz kanal rad etildi',
  error: 'Xatolik',
};

export const DashboardView: React.FC<DashboardViewProps> = ({ data, loading, onNavigate }) => {
  if (loading || !data) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-lg border border-slate-200 bg-white animate-pulse" />
          ))}
        </div>
        <div className="h-80 rounded-lg border border-slate-200 bg-white animate-pulse" />
      </div>
    );
  }

  const { kpis, popular_movies, recent_logs, views_by_genre, activity_series } = data;
  const maxViews = Math.max(...activity_series.map((d) => d.views), 1);
  const maxSyncs = Math.max(...activity_series.map((d) => d.syncs), 1);

  return (
    <div className="space-y-8">
      {/* KPI Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="text-xs font-medium text-slate-500">Katalogdagi kinolar</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-bold tracking-tight text-slate-900 tabular-nums">
              {kpis.total_movies}
            </span>
            <span className="text-xs text-emerald-700 font-medium tabular-nums">
              {kpis.available_movies} ta faol
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            {kpis.needs_review_count > 0
              ? `${kpis.needs_review_count} ta kino tahrir talab qiladi`
              : 'Barcha metama’lumotlar to‘liq'}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="text-xs font-medium text-slate-500">Bot foydalanuvchilari</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-bold tracking-tight text-slate-900 tabular-nums">
              {kpis.total_users}
            </span>
            <span className="text-xs text-slate-600 font-medium tabular-nums">
              DAU: {kpis.daily_active_users}
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500">So‘nggi 24 soatlik faollik</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="text-xs font-medium text-slate-500">Umumiy kino ko‘rishlar</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-bold tracking-tight text-slate-900 tabular-nums">
              {kpis.total_views.toLocaleString('uz-UZ')}
            </span>
            <span className="text-xs text-slate-600 font-medium">file_id oqimi</span>
          </div>
          <div className="mt-2 text-xs text-slate-500">Qayta yuklashsiz tezkor uzatish</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="text-xs font-medium text-slate-500">Ulangan kanallar</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-bold tracking-tight text-slate-900 tabular-nums">
              {kpis.connected_channels}
            </span>
            <span className="text-xs text-emerald-700 font-medium tabular-nums">
              {kpis.sync_success_count} ta hodisa
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500">Avtomatik sinxronizatsiya yoqilgan</div>
        </div>
      </section>

      {/* Activity Chart & Genre Distribution */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Haftalik tomosha va sinxronizatsiya dinamikasi</h2>
              <p className="text-xs text-slate-500 mt-0.5">So‘nggi 7 kun ichidagi real bazaviy harakatlar</p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-600">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-slate-900 rounded-xs inline-block" />
                Tomoshalar
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-blue-600 rounded-xs inline-block" />
                Sinxronlar
              </span>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-3 items-end h-44 pt-4 border-b border-slate-100 pb-3">
            {activity_series.map((day) => {
              const viewPct = Math.max(8, Math.round((day.views / maxViews) * 100));
              const syncPct = Math.max(8, Math.round((day.syncs / maxSyncs) * 100));
              return (
                <div key={day.label} className="flex flex-col items-center gap-2 h-full justify-end">
                  <div className="flex items-end gap-1.5 w-full justify-center h-32">
                    <div
                      className="w-4 bg-slate-900 rounded-t-sm transition-all"
                      style={{ height: `${day.views === 0 ? 4 : viewPct}%` }}
                      title={`Tomoshalar: ${day.views}`}
                    />
                    <div
                      className="w-4 bg-blue-600 rounded-t-sm transition-all"
                      style={{ height: `${day.syncs === 0 ? 4 : syncPct}%` }}
                      title={`Sinxronlar: ${day.syncs}`}
                    />
                  </div>
                  <div className="text-center">
                    <div className="text-xs font-medium text-slate-700">{day.label}</div>
                    <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                      {day.views}/{day.syncs}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-900">Janrlar kesimida</h2>
            <button
              onClick={() => onNavigate('catalog')}
              className="text-xs font-medium text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 whitespace-nowrap shrink-0"
            >
              Katalog
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {views_by_genre.slice(0, 6).map((g) => (
              <div key={g.name} className="py-2.5 flex items-center justify-between text-sm">
                <div>
                  <div className="font-medium text-slate-800">{g.name}</div>
                  <div className="text-xs text-slate-500 tabular-nums">{g.movies} ta kino</div>
                </div>
                <div className="font-mono text-xs font-medium text-slate-700 tabular-nums">
                  {g.views.toLocaleString('uz-UZ')} ko‘rish
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Popular Movies & Recent Sync Logs */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Eng mashhur kinolar</h2>
            <button
              onClick={() => onNavigate('bot')}
              className="text-xs font-medium text-slate-600 hover:text-slate-900 whitespace-nowrap shrink-0"
            >
              Botda ko‘rish
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {popular_movies.map((movie) => (
              <div key={movie.id} className="px-5 py-3 flex items-center gap-3.5 hover:bg-slate-50 transition-colors">
                <PosterFrame src={movie.poster_url} title={movie.title} className="w-10 h-14 rounded shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-slate-900 truncate">{movie.title}</div>
                  <div className="text-xs text-slate-500 mt-0.5 truncate">
                    <span className="font-mono">{movie.movie_code}</span>
                    {movie.release_year ? ` · ${movie.release_year}` : ''}
                    {movie.language_name ? ` · ${movie.language_name}` : ''}
                    {movie.rating ? ` · ★ ${movie.rating}` : ''}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-mono font-semibold text-slate-900 tabular-nums">
                    {movie.views_count.toLocaleString('uz-UZ')}
                  </div>
                  <div className="text-[11px] text-slate-400">ko‘rish</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">So‘nggi kanal sinxronizatsiyalari</h2>
            <button
              onClick={() => onNavigate('sync')}
              className="text-xs font-medium text-blue-600 hover:text-blue-700 whitespace-nowrap shrink-0"
            >
              Sinxron studiyasi
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {recent_logs.slice(0, 7).map((log) => (
              <div key={log.id} className="px-5 py-3 flex items-start gap-3">
                <div className="mt-0.5 shrink-0">
                  {log.event_type === 'unauthorized_channel' || !log.success ? (
                    <XCircle className="w-4 h-4 text-red-600" />
                  ) : log.event_type === 'duplicate_skipped' || log.event_type === 'marked_unavailable' ? (
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-slate-900 truncate">
                      {EVENT_LABELS[log.event_type] || log.event_type}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400 tabular-nums shrink-0">
                      msg #{log.message_id ?? '—'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{log.details}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
