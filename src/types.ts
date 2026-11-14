export interface Genre {
  id: number;
  name: string;
  slug: string;
  movie_count?: number;
}

export interface Language {
  id: number;
  name: string;
  code: string;
  movie_count?: number;
}

export interface Movie {
  id: number;
  movie_code: string;
  title: string;
  description: string | null;
  release_year: number | null;
  genres: Genre[];
  language_id: number | null;
  language_name: string | null;
  duration_seconds: number | null;
  duration_display: string | null;
  rating: number | null;
  poster_url: string | null;
  poster_file_id: string | null;
  telegram_file_id: string;
  telegram_file_unique_id: string;
  is_document_video: boolean;
  mime_type: string | null;
  source_channel_id: number | null;
  source_channel_title: string | null;
  channel_message_id: number | null;
  media_group_id: string | null;
  origin: 'channel_sync' | 'manual_admin';
  views_count: number;
  is_trending: boolean;
  is_available: boolean;
  is_archived: boolean;
  needs_metadata_review: boolean;
  is_favorite?: boolean;
  published_at: string;
  updated_at: string;
}

export interface TelegramChannel {
  id: number;
  channel_id: number;
  title: string;
  username: string | null;
  is_active: boolean;
  sync_enabled: boolean;
  auto_publish: boolean;
  last_synced_at: string | null;
  synced_count?: number;
}

export interface ChannelPost {
  id: number;
  channel_id: number;
  channel_title: string;
  message_id: number;
  media_group_id: string | null;
  file_id: string;
  file_unique_id: string;
  raw_caption: string | null;
  movie_id: number | null;
  movie_title: string | null;
  movie_code: string | null;
  status: string;
  is_deleted: boolean;
  synced_at: string;
  edited_at: string | null;
}

export interface SubscriptionChannel {
  id: number;
  channel_id: number;
  title: string;
  username: string | null;
  invite_link: string;
  is_active: boolean;
  order_priority: number;
}

export interface SyncLog {
  id: number;
  telegram_channel_id: number | null;
  channel_title: string | null;
  message_id: number | null;
  movie_id: number | null;
  movie_title: string | null;
  event_type: string;
  details: string;
  success: boolean;
  created_at: string;
}

export interface BotUser {
  id: number;
  telegram_id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  is_blocked: boolean;
  last_active_at: string;
  joined_at: string;
  views_count?: number;
  favorites_count?: number;
}

export interface BotAdmin {
  id: number;
  telegram_id: number;
  username: string | null;
  full_name: string;
  role: 'superadmin' | 'moderator' | 'channel_manager';
  can_manage_channels: boolean;
  can_broadcast: boolean;
  is_active: boolean;
}

export interface BroadcastAnnouncement {
  id: number;
  title: string;
  message_text: string;
  status: string;
  sent_count: number;
  failed_count: number;
  created_at: string;
  completed_at: string | null;
}

export interface DashboardData {
  kpis: {
    total_movies: number;
    available_movies: number;
    total_users: number;
    daily_active_users: number;
    total_views: number;
    connected_channels: number;
    sync_success_count: number;
    needs_review_count: number;
  };
  popular_movies: Movie[];
  recent_movies: Movie[];
  recent_logs: SyncLog[];
  views_by_genre: Array<{ name: string; views: number; movies: number }>;
  activity_series: Array<{ label: string; views: number; syncs: number }>;
}

export interface CodebaseTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  children?: CodebaseTreeNode[];
}
