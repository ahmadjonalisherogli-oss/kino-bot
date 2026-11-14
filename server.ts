import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

function sqlVal(v: unknown): SQLInputValue {
  if (v === undefined || v === null) return null;
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'bigint') return v;
  if (v instanceof Uint8Array) return v;
  return String(v);
}

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 3000);
const PLATFORM_ROOT = path.resolve(__dirname, 'telegram_movie_platform');
const DB_PATH = path.resolve(__dirname, 'telegram_cinema.db');

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS genres (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS languages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      code TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS telegram_channels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id INTEGER NOT NULL UNIQUE,
      title TEXT NOT NULL,
      username TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      sync_enabled INTEGER NOT NULL DEFAULT 1,
      auto_publish INTEGER NOT NULL DEFAULT 1,
      last_synced_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS movies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      movie_code TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT,
      release_year INTEGER,
      language_id INTEGER REFERENCES languages(id) ON DELETE SET NULL,
      duration_seconds INTEGER,
      duration_display TEXT,
      rating REAL,
      poster_url TEXT,
      poster_file_id TEXT,
      telegram_file_id TEXT NOT NULL,
      telegram_file_unique_id TEXT UNIQUE,
      is_document_video INTEGER NOT NULL DEFAULT 0,
      mime_type TEXT,
      source_channel_id INTEGER REFERENCES telegram_channels(id) ON DELETE SET NULL,
      channel_message_id INTEGER,
      media_group_id TEXT,
      origin TEXT NOT NULL DEFAULT 'channel_sync',
      views_count INTEGER NOT NULL DEFAULT 0,
      is_trending INTEGER NOT NULL DEFAULT 0,
      is_available INTEGER NOT NULL DEFAULT 1,
      is_archived INTEGER NOT NULL DEFAULT 0,
      needs_metadata_review INTEGER NOT NULL DEFAULT 0,
      published_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(source_channel_id, channel_message_id)
    );

    CREATE TABLE IF NOT EXISTS movie_genres (
      movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
      genre_id INTEGER NOT NULL REFERENCES genres(id) ON DELETE CASCADE,
      PRIMARY KEY (movie_id, genre_id)
    );

    CREATE TABLE IF NOT EXISTS channel_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id INTEGER NOT NULL REFERENCES telegram_channels(id) ON DELETE CASCADE,
      message_id INTEGER NOT NULL,
      media_group_id TEXT,
      file_id TEXT NOT NULL,
      file_unique_id TEXT,
      raw_caption TEXT,
      movie_id INTEGER REFERENCES movies(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'synced',
      is_deleted INTEGER NOT NULL DEFAULT 0,
      synced_at TEXT NOT NULL DEFAULT (datetime('now')),
      edited_at TEXT,
      UNIQUE(channel_id, message_id)
    );

    CREATE TABLE IF NOT EXISTS bot_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id INTEGER NOT NULL UNIQUE,
      username TEXT,
      first_name TEXT,
      last_name TEXT,
      is_blocked INTEGER NOT NULL DEFAULT 0,
      last_active_at TEXT NOT NULL DEFAULT (datetime('now')),
      joined_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS favorites (
      user_id INTEGER NOT NULL REFERENCES bot_users(id) ON DELETE CASCADE,
      movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, movie_id)
    );

    CREATE TABLE IF NOT EXISTS movie_views (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES bot_users(id) ON DELETE SET NULL,
      movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
      viewed_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS bot_admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id INTEGER NOT NULL UNIQUE,
      username TEXT,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'moderator',
      can_manage_channels INTEGER NOT NULL DEFAULT 1,
      can_broadcast INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS subscription_channels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id INTEGER NOT NULL UNIQUE,
      title TEXT NOT NULL,
      username TEXT,
      invite_link TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      order_priority INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS sync_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_channel_id INTEGER,
      channel_title TEXT,
      message_id INTEGER,
      movie_id INTEGER REFERENCES movies(id) ON DELETE SET NULL,
      movie_title TEXT,
      event_type TEXT NOT NULL,
      details TEXT NOT NULL,
      success INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS broadcasts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      message_text TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'completed',
      sent_count INTEGER NOT NULL DEFAULT 0,
      failed_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_movies_catalog ON movies(is_available, is_archived, published_at DESC);
    CREATE INDEX IF NOT EXISTS idx_movies_views ON movies(views_count DESC);
    CREATE INDEX IF NOT EXISTS idx_synclogs_created ON sync_logs(created_at DESC);
  `);
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-') || `item-${Date.now()}`;
}

interface ParsedCaption {
  title: string | null;
  releaseYear: number | null;
  genres: string[];
  language: string | null;
  rating: number | null;
  durationText: string | null;
  movieCode: string | null;
  description: string | null;
  isComplete: boolean;
}

function parseMovieCaption(caption: string | null | undefined): ParsedCaption {
  const result: ParsedCaption = {
    title: null,
    releaseYear: null,
    genres: [],
    language: null,
    rating: null,
    durationText: null,
    movieCode: null,
    description: null,
    isComplete: false,
  };
  if (!caption || !caption.trim()) return result;

  const patterns: Array<[string, RegExp]> = [
    ['title', /^(?:🎬|🎥|🎞️?)?\s*(?:movie|kino|film|title|nomi)\s*[:\-]\s*(.+)$/i],
    ['year', /^(?:📅|🗓️?)?\s*(?:year|yil|yili|release)\s*[:\-]\s*(\d{4})\b/i],
    ['genres', /^(?:🎭|🏷️?)?\s*(?:genre|genres|janr|janri|janrlar)\s*[:\-]\s*(.+)$/i],
    ['language', /^(?:🌍|🌐|🗣️?)?\s*(?:language|lang|til|tili)\s*[:\-]\s*(.+)$/i],
    ['rating', /^(?:⭐|🌟|💯)?\s*(?:rating|imdb|reyting|baho)\s*[:\-]\s*([0-9]+(?:[.,][0-9]+)?)/i],
    ['duration', /^(?:⏱️?|⏳|🕒)?\s*(?:duration|length|davomiyligi|vaqti)\s*[:\-]\s*(.+)$/i],
    ['code', /^(?:🆔|🔢|#)?\s*(?:code|kod|id|kino\s*kodi)\s*[:\-]\s*([A-Za-z0-9_\-]+)/i],
    ['description', /^(?:📝|📄|ℹ️?)?\s*(?:description|desc|tavsif|haqida|izoh)\s*[:\-]\s*(.+)$/i],
  ];

  const unmatched: string[] = [];
  const descLines: string[] = [];
  let inDesc = false;

  for (const rawLine of caption.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      if (inDesc && descLines.length > 0) descLines.push('');
      continue;
    }
    let matched = false;
    for (const [key, regex] of patterns) {
      const m = line.match(regex);
      if (!m) continue;
      const val = m[1].trim();
      inDesc = false;
      if (key === 'title' && !result.title) result.title = val;
      else if (key === 'year' && result.releaseYear === null) {
        const y = Number.parseInt(val, 10);
        if (y >= 1888 && y <= 2100) result.releaseYear = y;
      } else if (key === 'genres') {
        for (const part of val.split(/[,/|]+/).map((s) => s.trim().replace(/^#/, '')).filter(Boolean)) {
          if (!result.genres.includes(part)) result.genres.push(part);
        }
      } else if (key === 'language' && !result.language) {
        result.language = val;
      } else if (key === 'rating' && result.rating === null) {
        const r = Number.parseFloat(val.replace(',', '.'));
        if (!Number.isNaN(r) && r >= 0 && r <= 10) result.rating = Math.round(r * 10) / 10;
      } else if (key === 'duration' && !result.durationText) {
        result.durationText = val;
      } else if (key === 'code' && !result.movieCode) {
        result.movieCode = val.toUpperCase();
      } else if (key === 'description') {
        descLines.push(val);
        inDesc = true;
      }
      matched = true;
      break;
    }

    if (!matched) {
      if (inDesc) descLines.push(line);
      else if (!line.startsWith('@') && !line.startsWith('https://t.me/')) unmatched.push(line);
    }
  }

  if (!result.title && unmatched.length > 0) {
    const first = unmatched.shift()!.replace(/^[🎬🎥🎞️\s]+/, '').trim();
    if (first) result.title = first;
  }
  if (descLines.length > 0) {
    result.description = descLines.join('\n').trim();
  } else if (unmatched.length > 0) {
    const cleaned = unmatched.filter((l) => !/^(?:#\w+\s*)+$/.test(l)).join('\n').trim();
    if (cleaned) result.description = cleaned;
  }

  result.isComplete = Boolean(result.title && result.releaseYear && result.genres.length > 0 && result.language);
  return result;
}

function seedInitialData() {
  const movieCountRow = db.prepare('SELECT COUNT(*) as cnt FROM movies').get() as { cnt: number };
  if (movieCountRow.cnt > 0) return;

  db.exec('BEGIN');
  try {
    const insertLang = db.prepare('INSERT OR IGNORE INTO languages (name, code) VALUES (?, ?)');
    insertLang.run("O‘zbekcha", 'uz');
    insertLang.run('Ruscha', 'ru');
    insertLang.run('Inglizcha', 'en');

    const insertGenre = db.prepare('INSERT OR IGNORE INTO genres (name, slug) VALUES (?, ?)');
    for (const g of ['Fantastika', 'Drama', 'Tarixiy', 'Triller', 'Sarguzasht', 'Jangari']) {
      insertGenre.run(g, slugify(g));
    }

    const insertChannel = db.prepare(
      `INSERT INTO telegram_channels (channel_id, title, username, is_active, sync_enabled, auto_publish, last_synced_at) VALUES (?, ?, ?, 1, 1, 1, datetime('now'))`
    );
    const ch1 = insertChannel.run(-1002145908812, 'KinoSync HD Premyeralar', 'kinosync_hd').lastInsertRowid;
    const ch2 = insertChannel.run(-1002198431105, 'O‘zbekcha Tarjima Kinolar', 'uz_tarjima_kino').lastInsertRowid;

    db.prepare(
      'INSERT INTO subscription_channels (channel_id, title, username, invite_link, is_active, order_priority) VALUES (?, ?, ?, ?, 1, 1)'
    ).run(-1002145908812, 'KinoSync Rasmiy Kanali', 'kinosync_hd', 'https://t.me/kinosync_hd');

    const insertUser = db.prepare(
      'INSERT INTO bot_users (telegram_id, username, first_name, last_name, last_active_at, joined_at) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const demoUserId = insertUser.run(
      841209311,
      'aziz_cinema',
      'Azizbek',
      'Karimov',
      new Date().toISOString(),
      new Date(Date.now() - 86400000 * 14).toISOString()
    ).lastInsertRowid;
    insertUser.run(519023441, 'madina_uz', 'Madina', 'Toshmatova', new Date().toISOString(), new Date(Date.now() - 86400000 * 9).toISOString());
    insertUser.run(772391042, 'sardor_dev', 'Sardor', 'Rustamov', new Date(Date.now() - 3600000 * 4).toISOString(), new Date(Date.now() - 86400000 * 5).toISOString());

    db.prepare(
      'INSERT INTO bot_admins (telegram_id, username, full_name, role, can_manage_channels, can_broadcast, is_active) VALUES (?, ?, ?, ?, 1, 1, 1)'
    ).run(841209311, 'aziz_cinema', 'Azizbek Karimov', 'superadmin');

    const uzId = (db.prepare("SELECT id FROM languages WHERE code='uz'").get() as { id: number }).id;
    const enId = (db.prepare("SELECT id FROM languages WHERE code='en'").get() as { id: number }).id;

    const initialMovies = [
      {
        code: 'KINO-1001',
        title: 'Koinot Sarguzashti: Yangi Ufq',
        desc: 'Uzoq ekzosayyoraga yo‘l olgan tadqiqotchilar jamoasi vaqt va gravitatsiya sinovidan o‘tadi.',
        year: 2024,
        lang: uzId,
        durSec: 9420,
        durDisp: '2 soat 37 daq',
        rating: 8.8,
        poster: '/src/assets/images/poster_cosmos_odyssey_1794582354857.jpg',
        fileId: 'BAACAgIAAxkBAAIBY2d9x8A1_cosmos_hd_1080p',
        uniqId: 'AgAD_UNIQ_COSMOS_1001',
        ch: ch1,
        msgId: 401,
        views: 1842,
        trending: 1,
        genres: ['Fantastika', 'Drama'],
      },
      {
        code: 'KINO-1002',
        title: 'Samarqand Ufqlari',
        desc: 'XV asr Samarqand ilm-fan va me’morchilik markazidagi buyuk kashfiyotlar va sadoqat qissasi.',
        year: 2025,
        lang: uzId,
        durSec: 7980,
        durDisp: '2 soat 13 daq',
        rating: 9.1,
        poster: '/src/assets/images/poster_samarkand_horizon_1794582355322.jpg',
        fileId: 'BAACAgIAAxkBAAIBZGd9x9B2_samarkand_hd',
        uniqId: 'AgAD_UNIQ_SAMARKAND_1002',
        ch: ch2,
        msgId: 118,
        views: 2490,
        trending: 1,
        genres: ['Tarixiy', 'Drama'],
      },
      {
        code: 'KINO-1003',
        title: 'Tungi Shifr',
        desc: 'Yomg‘irli shaharda yo‘qolgan shifrlangan arxivni izlayotgan tergovchi kutilmagan fitnaga duch keladi.',
        year: 2023,
        lang: uzId,
        durSec: 6900,
        durDisp: '1 soat 55 daq',
        rating: 8.4,
        poster: '/src/assets/images/poster_night_cipher_1794582356321.jpg',
        fileId: 'BAACAgIAAxkBAAIBZWd9y0C3_night_cipher',
        uniqId: 'AgAD_UNIQ_NIGHT_1003',
        ch: ch1,
        msgId: 402,
        views: 1120,
        trending: 0,
        genres: ['Triller', 'Jangari'],
      },
      {
        code: 'KINO-1004',
        title: 'Dovon Qutqaruvi',
        desc: 'Qor bo‘ronida baland tog‘ tizmasida qolib ketgan alpinistlarni qutqarish bo‘yicha xavfli operatsiya.',
        year: 2024,
        lang: enId,
        durSec: 7320,
        durDisp: '2 soat 02 daq',
        rating: 8.2,
        poster: '/src/assets/images/poster_alpine_rescue_1794582356761.jpg',
        fileId: 'BAACAgIAAxkBAAIBZmd9y1D4_alpine_rescue',
        uniqId: 'AgAD_UNIQ_ALPINE_1004',
        ch: ch1,
        msgId: 403,
        views: 965,
        trending: 1,
        genres: ['Sarguzasht', 'Triller'],
      },
    ];

    const insertMovie = db.prepare(`
      INSERT INTO movies (
        movie_code, title, description, release_year, language_id, duration_seconds, duration_display,
        rating, poster_url, telegram_file_id, telegram_file_unique_id, source_channel_id, channel_message_id,
        origin, views_count, is_trending, is_available, is_archived, needs_metadata_review, published_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'channel_sync', ?, ?, 1, 0, 0, ?)
    `);
    const insertPost = db.prepare(`
      INSERT INTO channel_posts (channel_id, message_id, file_id, file_unique_id, raw_caption, movie_id, status)
      VALUES (?, ?, ?, ?, ?, ?, 'synced')
    `);
    const insertLog = db.prepare(`
      INSERT INTO sync_logs (telegram_channel_id, channel_title, message_id, movie_id, movie_title, event_type, details, success)
      VALUES (?, ?, ?, ?, ?, 'created', ?, 1)
    `);

    initialMovies.forEach((m, idx) => {
      const pubDate = new Date(Date.now() - idx * 86400000).toISOString();
      const movieId = Number(
        insertMovie.run(
          m.code, m.title, m.desc, m.year, m.lang, m.durSec, m.durDisp, m.rating,
          m.poster, m.fileId, m.uniqId, m.ch, m.msgId, m.views, m.trending, pubDate
        ).lastInsertRowid
      );

      for (const gName of m.genres) {
        const gRow = db.prepare('SELECT id FROM genres WHERE name = ?').get(gName) as { id: number } | undefined;
        if (gRow) db.prepare('INSERT OR IGNORE INTO movie_genres (movie_id, genre_id) VALUES (?, ?)').run(movieId, gRow.id);
      }

      const caption = `🎬 Movie: ${m.title}\n📅 Year: ${m.year}\n🎭 Genre: ${m.genres.join(', ')}\n⭐ Rating: ${m.rating}\n🆔 Code: ${m.code}`;
      insertPost.run(m.ch, m.msgId, m.fileId, m.uniqId, caption, movieId);

      const chInfo = db.prepare('SELECT channel_id, title FROM telegram_channels WHERE id = ?').get(m.ch) as { channel_id: number; title: string };
      insertLog.run(chInfo.channel_id, chInfo.title, m.msgId, movieId, m.title, `Avtomatik sinxronizatsiya: ${m.title} [${m.code}]`);
    });

    db.prepare('INSERT OR IGNORE INTO favorites (user_id, movie_id) VALUES (?, ?)').run(demoUserId, 2);
    db.prepare('INSERT INTO movie_views (user_id, movie_id) VALUES (?, ?)').run(demoUserId, 1);
    db.prepare('INSERT INTO movie_views (user_id, movie_id) VALUES (?, ?)').run(demoUserId, 2);

    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

initSchema();
seedInitialData();

function enrichMovies(rows: Array<Record<string, unknown>>, userTelegramId?: number) {
  let favSet = new Set<number>();
  if (userTelegramId) {
    const userRow = db.prepare('SELECT id FROM bot_users WHERE telegram_id = ?').get(userTelegramId) as { id: number } | undefined;
    if (userRow) {
      const favRows = db.prepare('SELECT movie_id FROM favorites WHERE user_id = ?').all(userRow.id) as Array<{ movie_id: number }>;
      favSet = new Set(favRows.map((r) => r.movie_id));
    }
  }

  const getGenresStmt = db.prepare(`
    SELECT g.id, g.name, g.slug FROM genres g
    JOIN movie_genres mg ON mg.genre_id = g.id
    WHERE mg.movie_id = ?
    ORDER BY g.name
  `);

  return rows.map((row) => {
    const genres = getGenresStmt.all(row.id as number);
    return {
      ...row,
      is_document_video: Boolean(row.is_document_video),
      is_trending: Boolean(row.is_trending),
      is_available: Boolean(row.is_available),
      is_archived: Boolean(row.is_archived),
      needs_metadata_review: Boolean(row.needs_metadata_review),
      is_favorite: favSet.has(row.id as number),
      genres,
    };
  });
}

function generateNextMovieCode(): string {
  const row = db.prepare('SELECT COALESCE(MAX(id), 0) as max_id FROM movies').get() as { max_id: number };
  let candidateNum = 1000 + row.max_id + 1;
  while (db.prepare('SELECT 1 FROM movies WHERE movie_code = ?').get(`KINO-${candidateNum}`)) {
    candidateNum += 1;
  }
  return `KINO-${candidateNum}`;
}

function ensureGenre(name: string): number {
  const clean = name.trim().slice(0, 80);
  const existing = db.prepare('SELECT id FROM genres WHERE LOWER(name) = LOWER(?)').get(clean) as { id: number } | undefined;
  if (existing) return existing.id;
  return Number(db.prepare('INSERT INTO genres (name, slug) VALUES (?, ?)').run(clean, slugify(clean)).lastInsertRowid);
}

function ensureLanguage(name: string): number {
  const clean = name.trim().slice(0, 80);
  const existing = db.prepare('SELECT id FROM languages WHERE LOWER(name) = LOWER(?)').get(clean) as { id: number } | undefined;
  if (existing) return existing.id;
  const code = clean.slice(0, 8).toLowerCase().replace(/[^a-z0-9]/g, '') || 'oth';
  const uniqueCode = db.prepare('SELECT 1 FROM languages WHERE code = ?').get(code) ? `${code}_${Date.now() % 1000}` : code;
  return Number(db.prepare('INSERT INTO languages (name, code) VALUES (?, ?)').run(clean, uniqueCode).lastInsertRowid);
}

const app = express();
app.use(express.json({ limit: '2mb' }));

// Dashboard Analytics
app.get('/api/dashboard', (_req, res) => {
  const totalMovies = (db.prepare('SELECT COUNT(*) as c FROM movies WHERE is_archived = 0').get() as { c: number }).c;
  const availableMovies = (db.prepare('SELECT COUNT(*) as c FROM movies WHERE is_available = 1 AND is_archived = 0').get() as { c: number }).c;
  const totalUsers = (db.prepare('SELECT COUNT(*) as c FROM bot_users').get() as { c: number }).c;
  const dau = (db.prepare("SELECT COUNT(*) as c FROM bot_users WHERE datetime(last_active_at) >= datetime('now', '-1 day')").get() as { c: number }).c;
  const totalViews = (db.prepare('SELECT COALESCE(SUM(views_count), 0) as s FROM movies').get() as { s: number }).s;
  const connectedChannels = (db.prepare('SELECT COUNT(*) as c FROM telegram_channels WHERE is_active = 1').get() as { c: number }).c;
  const syncSuccess = (db.prepare('SELECT COUNT(*) as c FROM sync_logs WHERE success = 1').get() as { c: number }).c;
  const needsReview = (db.prepare('SELECT COUNT(*) as c FROM movies WHERE needs_metadata_review = 1 AND is_archived = 0').get() as { c: number }).c;

  const baseSelect = `
    SELECT m.*, l.name as language_name, tc.title as source_channel_title
    FROM movies m
    LEFT JOIN languages l ON l.id = m.language_id
    LEFT JOIN telegram_channels tc ON tc.id = m.source_channel_id
  `;

  const popularRaw = db.prepare(`${baseSelect} WHERE m.is_available = 1 AND m.is_archived = 0 ORDER BY m.views_count DESC LIMIT 6`).all() as Array<Record<string, unknown>>;
  const recentRaw = db.prepare(`${baseSelect} WHERE m.is_archived = 0 ORDER BY m.published_at DESC, m.id DESC LIMIT 6`).all() as Array<Record<string, unknown>>;
  const recentLogs = db.prepare('SELECT * FROM sync_logs ORDER BY created_at DESC, id DESC LIMIT 12').all();

  const viewsByGenre = db.prepare(`
    SELECT g.name, COALESCE(SUM(m.views_count), 0) as views, COUNT(DISTINCT m.id) as movies
    FROM genres g
    LEFT JOIN movie_genres mg ON mg.genre_id = g.id
    LEFT JOIN movies m ON m.id = mg.movie_id AND m.is_archived = 0
    GROUP BY g.id
    ORDER BY views DESC
  `).all();

  // Compute last 7 days activity anchored to real counts
  const days = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];
  const activitySeries = days.map((label, idx) => {
    const daySyncs = (db.prepare(`SELECT COUNT(*) as c FROM sync_logs WHERE date(created_at) = date('now', '-${6 - idx} days')`).get() as { c: number }).c;
    const dayViews = (db.prepare(`SELECT COUNT(*) as c FROM movie_views WHERE date(viewed_at) = date('now', '-${6 - idx} days')`).get() as { c: number }).c;
    return {
      label,
      views: dayViews,
      syncs: daySyncs,
    };
  });

  res.json({
    kpis: {
      total_movies: totalMovies,
      available_movies: availableMovies,
      total_users: totalUsers,
      daily_active_users: dau,
      total_views: totalViews,
      connected_channels: connectedChannels,
      sync_success_count: syncSuccess,
      needs_review_count: needsReview,
    },
    popular_movies: enrichMovies(popularRaw),
    recent_movies: enrichMovies(recentRaw),
    recent_logs: recentLogs,
    views_by_genre: viewsByGenre,
    activity_series: activitySeries,
  });
});

// Movies catalog, search & pagination
app.get('/api/movies', (req, res) => {
  const scope = String(req.query.scope || 'all');
  const q = String(req.query.q || '').trim();
  const genreId = req.query.genreId ? Number(req.query.genreId) : null;
  const languageId = req.query.languageId ? Number(req.query.languageId) : null;
  const page = Math.max(1, Number(req.query.page || 1));
  const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize || 8)));
  const userTelegramId = req.query.userTelegramId ? Number(req.query.userTelegramId) : 841209311;

  const where: string[] = [];
  const params: Array<string | number> = [];

  if (scope === 'archived') {
    where.push('m.is_archived = 1');
  } else if (scope !== 'admin_all') {
    where.push('m.is_archived = 0');
    if (scope !== 'admin_manage') {
      where.push('m.is_available = 1');
    }
  }

  if (scope === 'trending') {
    where.push('m.is_trending = 1');
  } else if (scope === 'favorites') {
    where.push('m.id IN (SELECT f.movie_id FROM favorites f JOIN bot_users u ON u.id = f.user_id WHERE u.telegram_id = ?)');
    params.push(userTelegramId);
  }

  if (genreId) {
    where.push('m.id IN (SELECT mg.movie_id FROM movie_genres mg WHERE mg.genre_id = ?)');
    params.push(genreId);
  }
  if (languageId) {
    where.push('m.language_id = ?');
    params.push(languageId);
  }

  if (q) {
    const like = `%${q}%`;
    if (/^\d+$/.test(q)) {
      const num = Number.parseInt(q, 10);
      where.push('(m.id = ? OR m.release_year = ? OR m.movie_code LIKE ? OR m.title LIKE ?)');
      params.push(num, num, like, like);
    } else {
      where.push(`(
        m.title LIKE ? OR m.movie_code LIKE ? OR COALESCE(m.description, '') LIKE ?
        OR COALESCE(l.name, '') LIKE ?
        OR m.id IN (SELECT mg.movie_id FROM movie_genres mg JOIN genres g ON g.id = mg.genre_id WHERE g.name LIKE ?)
      )`);
      params.push(like, like, like, like, like);
    }
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  let orderBy = 'ORDER BY m.published_at DESC, m.id DESC';
  if (scope === 'popular' || scope === 'trending') {
    orderBy = 'ORDER BY m.views_count DESC, COALESCE(m.rating, 0) DESC, m.id DESC';
  }

  const countSql = `
    SELECT COUNT(DISTINCT m.id) as total
    FROM movies m
    LEFT JOIN languages l ON l.id = m.language_id
    ${whereSql}
  `;
  const totalCount = (db.prepare(countSql).get(...params) as { total: number }).total;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * pageSize;

  const listSql = `
    SELECT m.*, l.name as language_name, tc.title as source_channel_title
    FROM movies m
    LEFT JOIN languages l ON l.id = m.language_id
    LEFT JOIN telegram_channels tc ON tc.id = m.source_channel_id
    ${whereSql}
    ${orderBy}
    LIMIT ? OFFSET ?
  `;
  const rows = db.prepare(listSql).all(...params, pageSize, offset) as Array<Record<string, unknown>>;

  res.json({
    items: enrichMovies(rows, userTelegramId),
    page: safePage,
    total_pages: totalPages,
    total_count: totalCount,
  });
});

app.post('/api/movies', (req, res) => {
  const {
    title,
    movie_code,
    description,
    release_year,
    genres = [],
    language_name,
    duration_display,
    rating,
    telegram_file_id,
    poster_url,
    is_trending = false,
  } = req.body || {};

  if (!title || !telegram_file_id) {
    res.status(400).json({ error: 'Film nomi va Telegram file_id kiritilishi shart.' });
    return;
  }

  const code = (movie_code && String(movie_code).trim().toUpperCase()) || generateNextMovieCode();
  const uniq = `MAN_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const langId = language_name ? ensureLanguage(String(language_name)) : null;

  db.exec('BEGIN');
  try {
    const movieId = Number(
      db.prepare(`
        INSERT INTO movies (
          movie_code, title, description, release_year, language_id, duration_display,
          rating, poster_url, telegram_file_id, telegram_file_unique_id, origin,
          is_trending, is_available, needs_metadata_review, published_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual_admin', ?, 1, ?, datetime('now'))
      `).run(
        code,
        String(title).trim(),
        description ? String(description).trim() : null,
        release_year ? Number(release_year) : null,
        langId,
        duration_display ? String(duration_display).trim() : null,
        rating !== undefined && rating !== '' && rating !== null ? Number(rating) : null,
        poster_url || null,
        String(telegram_file_id).trim(),
        uniq,
        is_trending ? 1 : 0,
        release_year && genres.length > 0 && language_name ? 0 : 1
      ).lastInsertRowid
    );

    if (Array.isArray(genres)) {
      for (const g of genres) {
        if (String(g).trim()) {
          const gid = ensureGenre(String(g));
          db.prepare('INSERT OR IGNORE INTO movie_genres (movie_id, genre_id) VALUES (?, ?)').run(movieId, gid);
        }
      }
    }
    db.exec('COMMIT');
    const created = db.prepare(`
      SELECT m.*, l.name as language_name, tc.title as source_channel_title
      FROM movies m LEFT JOIN languages l ON l.id = m.language_id
      LEFT JOIN telegram_channels tc ON tc.id = m.source_channel_id WHERE m.id = ?
    `).get(movieId) as Record<string, unknown>;
    res.status(201).json(enrichMovies([created])[0]);
  } catch (err) {
    db.exec('ROLLBACK');
    res.status(400).json({ error: err instanceof Error ? err.message : 'Saqlashda xatolik' });
  }
});

app.patch('/api/movies/:id', (req, res) => {
  const movieId = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM movies WHERE id = ?').get(movieId) as Record<string, unknown> | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Kino topilmadi.' });
    return;
  }

  const body = req.body || {};
  const langId = body.language_name !== undefined
    ? (body.language_name ? ensureLanguage(String(body.language_name)) : null)
    : (existing.language_id as number | null);

  db.exec('BEGIN');
  try {
    db.prepare(`
      UPDATE movies SET
        title = ?,
        description = ?,
        release_year = ?,
        language_id = ?,
        duration_display = ?,
        rating = ?,
        telegram_file_id = ?,
        is_trending = ?,
        is_available = ?,
        is_archived = ?,
        needs_metadata_review = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      body.title !== undefined ? String(body.title).trim() : sqlVal(existing.title),
      body.description !== undefined ? (body.description ? String(body.description) : null) : sqlVal(existing.description),
      body.release_year !== undefined ? (body.release_year ? Number(body.release_year) : null) : sqlVal(existing.release_year),
      langId,
      body.duration_display !== undefined ? (body.duration_display ? String(body.duration_display) : null) : sqlVal(existing.duration_display),
      body.rating !== undefined ? (body.rating !== null && body.rating !== '' ? Number(body.rating) : null) : sqlVal(existing.rating),
      body.telegram_file_id !== undefined ? String(body.telegram_file_id).trim() : sqlVal(existing.telegram_file_id),
      body.is_trending !== undefined ? (body.is_trending ? 1 : 0) : sqlVal(existing.is_trending),
      body.is_available !== undefined ? (body.is_available ? 1 : 0) : sqlVal(existing.is_available),
      body.is_archived !== undefined ? (body.is_archived ? 1 : 0) : sqlVal(existing.is_archived),
      body.needs_metadata_review !== undefined ? (body.needs_metadata_review ? 1 : 0) : 0,
      movieId
    );

    if (Array.isArray(body.genres)) {
      db.prepare('DELETE FROM movie_genres WHERE movie_id = ?').run(movieId);
      for (const g of body.genres) {
        if (String(g).trim()) {
          const gid = ensureGenre(String(g));
          db.prepare('INSERT OR IGNORE INTO movie_genres (movie_id, genre_id) VALUES (?, ?)').run(movieId, gid);
        }
      }
    }
    db.exec('COMMIT');
    const updated = db.prepare(`
      SELECT m.*, l.name as language_name, tc.title as source_channel_title
      FROM movies m LEFT JOIN languages l ON l.id = m.language_id
      LEFT JOIN telegram_channels tc ON tc.id = m.source_channel_id WHERE m.id = ?
    `).get(movieId) as Record<string, unknown>;
    res.json(enrichMovies([updated])[0]);
  } catch (err) {
    db.exec('ROLLBACK');
    res.status(400).json({ error: err instanceof Error ? err.message : 'Yangilashda xatolik' });
  }
});

app.delete('/api/movies/:id', (req, res) => {
  const movieId = Number(req.params.id);
  db.prepare('DELETE FROM movies WHERE id = ?').run(movieId);
  res.json({ deleted: true });
});

app.post('/api/movies/:id/watch', (req, res) => {
  const movieId = Number(req.params.id);
  const userTelegramId = Number(req.body?.userTelegramId || 841209311);
  const movie = db.prepare('SELECT * FROM movies WHERE id = ? AND is_available = 1').get(movieId) as Record<string, unknown> | undefined;
  if (!movie) {
    res.status(404).json({ error: 'Kino mavjud emas.' });
    return;
  }
  const user = db.prepare('SELECT id FROM bot_users WHERE telegram_id = ?').get(userTelegramId) as { id: number } | undefined;
  if (user) {
    db.prepare('INSERT INTO movie_views (user_id, movie_id) VALUES (?, ?)').run(user.id, movieId);
    db.prepare("UPDATE bot_users SET last_active_at = datetime('now') WHERE id = ?").run(user.id);
  }
  db.prepare('UPDATE movies SET views_count = views_count + 1 WHERE id = ?').run(movieId);
  const updated = db.prepare(`
    SELECT m.*, l.name as language_name, tc.title as source_channel_title
    FROM movies m LEFT JOIN languages l ON l.id = m.language_id
    LEFT JOIN telegram_channels tc ON tc.id = m.source_channel_id WHERE m.id = ?
  `).get(movieId) as Record<string, unknown>;
  res.json(enrichMovies([updated], userTelegramId)[0]);
});

app.post('/api/movies/:id/favorite', (req, res) => {
  const movieId = Number(req.params.id);
  const userTelegramId = Number(req.body?.userTelegramId || 841209311);
  const user = db.prepare('SELECT id FROM bot_users WHERE telegram_id = ?').get(userTelegramId) as { id: number } | undefined;
  if (!user) {
    res.status(404).json({ error: 'Foydalanuvchi topilmadi.' });
    return;
  }
  const existing = db.prepare('SELECT 1 FROM favorites WHERE user_id = ? AND movie_id = ?').get(user.id, movieId);
  if (existing) {
    db.prepare('DELETE FROM favorites WHERE user_id = ? AND movie_id = ?').run(user.id, movieId);
    res.json({ is_favorite: false });
  } else {
    db.prepare('INSERT INTO favorites (user_id, movie_id) VALUES (?, ?)').run(user.id, movieId);
    res.json({ is_favorite: true });
  }
});

// Taxonomy (Genres & Languages)
app.get('/api/taxonomy', (_req, res) => {
  const genres = db.prepare(`
    SELECT g.*, COUNT(DISTINCT mg.movie_id) as movie_count
    FROM genres g
    LEFT JOIN movie_genres mg ON mg.genre_id = g.id
    LEFT JOIN movies m ON m.id = mg.movie_id AND m.is_available = 1 AND m.is_archived = 0
    GROUP BY g.id ORDER BY g.name
  `).all();
  const languages = db.prepare(`
    SELECT l.*, COUNT(DISTINCT m.id) as movie_count
    FROM languages l
    LEFT JOIN movies m ON m.language_id = l.id AND m.is_available = 1 AND m.is_archived = 0
    GROUP BY l.id ORDER BY l.name
  `).all();
  res.json({ genres, languages });
});

app.post('/api/genres', (req, res) => {
  const name = String(req.body?.name || '').trim();
  if (!name) {
    res.status(400).json({ error: 'Janr nomi kiritilishi shart.' });
    return;
  }
  const id = ensureGenre(name);
  res.status(201).json(db.prepare('SELECT * FROM genres WHERE id = ?').get(id));
});

app.post('/api/languages', (req, res) => {
  const name = String(req.body?.name || '').trim();
  if (!name) {
    res.status(400).json({ error: 'Til nomi kiritilishi shart.' });
    return;
  }
  const id = ensureLanguage(name);
  res.status(201).json(db.prepare('SELECT * FROM languages WHERE id = ?').get(id));
});

// Connected Channels & Channel Posts
app.get('/api/channels', (_req, res) => {
  const channels = db.prepare(`
    SELECT tc.*, COUNT(cp.id) as synced_count
    FROM telegram_channels tc
    LEFT JOIN channel_posts cp ON cp.channel_id = tc.id AND cp.is_deleted = 0
    GROUP BY tc.id ORDER BY tc.created_at DESC
  `).all().map((c: Record<string, unknown>) => ({
    ...c,
    is_active: Boolean(c.is_active),
    sync_enabled: Boolean(c.sync_enabled),
    auto_publish: Boolean(c.auto_publish),
  }));

  const posts = db.prepare(`
    SELECT cp.*, tc.title as channel_title, m.title as movie_title, m.movie_code
    FROM channel_posts cp
    JOIN telegram_channels tc ON tc.id = cp.channel_id
    LEFT JOIN movies m ON m.id = cp.movie_id
    ORDER BY cp.synced_at DESC, cp.id DESC
    LIMIT 40
  `).all().map((p: Record<string, unknown>) => ({ ...p, is_deleted: Boolean(p.is_deleted) }));

  const logs = db.prepare('SELECT * FROM sync_logs ORDER BY created_at DESC, id DESC LIMIT 40').all().map((l: Record<string, unknown>) => ({
    ...l,
    success: Boolean(l.success),
  }));

  res.json({ channels, posts, logs });
});

app.post('/api/channels', (req, res) => {
  const { channel_id, title, username, auto_publish = true } = req.body || {};
  if (!channel_id || !title) {
    res.status(400).json({ error: 'Kanal ID (-100...) va nomi talab qilinadi.' });
    return;
  }
  try {
    const id = Number(
      db.prepare(
        'INSERT INTO telegram_channels (channel_id, title, username, is_active, sync_enabled, auto_publish) VALUES (?, ?, ?, 1, 1, ?)'
      ).run(Number(channel_id), String(title).trim(), username ? String(username).replace(/^@/, '') : null, auto_publish ? 1 : 0).lastInsertRowid
    );
    res.status(201).json(db.prepare('SELECT * FROM telegram_channels WHERE id = ?').get(id));
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Kanal allaqachon mavjud' });
  }
});

app.patch('/api/channels/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM telegram_channels WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Kanal topilmadi.' });
    return;
  }
  const b = req.body || {};
  db.prepare('UPDATE telegram_channels SET is_active = ?, sync_enabled = ?, auto_publish = ? WHERE id = ?').run(
    b.is_active !== undefined ? (b.is_active ? 1 : 0) : sqlVal(existing.is_active),
    b.sync_enabled !== undefined ? (b.sync_enabled ? 1 : 0) : sqlVal(existing.sync_enabled),
    b.auto_publish !== undefined ? (b.auto_publish ? 1 : 0) : sqlVal(existing.auto_publish),
    id
  );
  res.json(db.prepare('SELECT * FROM telegram_channels WHERE id = ?').get(id));
});

// Automatic Channel-to-Bot Sync Engine Endpoint (Single Post or Media Group)
app.post('/api/sync/channel-post', (req, res) => {
  const {
    telegram_channel_id,
    message_id,
    caption,
    file_id,
    file_unique_id,
    is_document_video = false,
    mime_type = 'video/mp4',
    media_group_id = null,
    poster_url = null,
    poster_file_id = null,
    is_media_group_album = false,
  } = req.body || {};

  if (!telegram_channel_id || !message_id || !file_id || !file_unique_id) {
    res.status(400).json({ error: 'channel_id, message_id, file_id va file_unique_id majburiy.' });
    return;
  }

  const tgChannelId = Number(telegram_channel_id);
  const msgId = Number(message_id);

  db.exec('BEGIN');
  try {
    const channel = db.prepare('SELECT * FROM telegram_channels WHERE channel_id = ? AND is_active = 1 AND sync_enabled = 1').get(tgChannelId) as Record<string, unknown> | undefined;
    if (!channel) {
      db.prepare(
        "INSERT INTO sync_logs (telegram_channel_id, message_id, event_type, details, success) VALUES (?, ?, 'unauthorized_channel', ?, 0)"
      ).run(tgChannelId, msgId, `Ruxsatsiz yoki o‘chirilgan kanaldan post rad etildi: ${tgChannelId}`);
      db.exec('COMMIT');
      res.status(403).json({ action: 'unauthorized_channel', message: 'Kanal ro‘yxatga olinmagan yoki sinxronizatsiya o‘chirilgan.' });
      return;
    }

    const chDbId = Number(channel.id);
    const chTitle = String(channel.title);

    // Duplicate check 1: (channel_id, message_id)
    const dupMsg = db.prepare('SELECT * FROM channel_posts WHERE channel_id = ? AND message_id = ?').get(chDbId, msgId) as Record<string, unknown> | undefined;
    if (dupMsg) {
      db.prepare(
        "INSERT INTO sync_logs (telegram_channel_id, channel_title, message_id, movie_id, event_type, details, success) VALUES (?, ?, ?, ?, 'duplicate_skipped', ?, 1)"
      ).run(tgChannelId, chTitle, msgId, sqlVal(dupMsg.movie_id), `Xabar ID #${msgId} bo‘yicha dublikat o‘tkazib yuborildi.`);
      db.exec('COMMIT');
      res.json({ action: 'duplicate_skipped', reason: 'message_id', movie_id: dupMsg.movie_id });
      return;
    }

    // Duplicate check 2: file_unique_id
    const dupFile = db.prepare('SELECT * FROM movies WHERE telegram_file_unique_id = ?').get(String(file_unique_id)) as Record<string, unknown> | undefined;
    if (dupFile) {
      db.prepare(
        "INSERT INTO channel_posts (channel_id, message_id, media_group_id, file_id, file_unique_id, raw_caption, movie_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'duplicate')"
      ).run(chDbId, msgId, sqlVal(media_group_id), String(file_id), String(file_unique_id), caption ? String(caption) : null, sqlVal(dupFile.id));
      db.prepare(
        "INSERT INTO sync_logs (telegram_channel_id, channel_title, message_id, movie_id, movie_title, event_type, details, success) VALUES (?, ?, ?, ?, ?, 'duplicate_skipped', ?, 1)"
      ).run(tgChannelId, chTitle, msgId, sqlVal(dupFile.id), sqlVal(dupFile.title), `file_unique_id (${file_unique_id}) bo‘yicha dublikat video aniqlandi.`);
      db.exec('COMMIT');
      res.json({ action: 'duplicate_skipped', reason: 'file_unique_id', movie_id: dupFile.id });
      return;
    }

    const parsed = parseMovieCaption(caption);
    const resolvedTitle = parsed.title || `Nomsiz kino #${msgId}`;
    const needsReview = parsed.isComplete ? 0 : 1;
    const langId = parsed.language ? ensureLanguage(parsed.language) : null;
    let movieCode = parsed.movieCode || generateNextMovieCode();
    if (db.prepare('SELECT 1 FROM movies WHERE movie_code = ?').get(movieCode)) {
      movieCode = generateNextMovieCode();
    }

    const movieId = Number(
      db.prepare(`
        INSERT INTO movies (
          movie_code, title, description, release_year, language_id, duration_display,
          rating, poster_url, poster_file_id, telegram_file_id, telegram_file_unique_id,
          is_document_video, mime_type, source_channel_id, channel_message_id, media_group_id,
          origin, is_available, needs_metadata_review, published_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'channel_sync', ?, ?, datetime('now'))
      `).run(
        movieCode,
        resolvedTitle,
        parsed.description,
        parsed.releaseYear,
        langId,
        parsed.durationText,
        parsed.rating,
        poster_url,
        poster_file_id,
        String(file_id),
        String(file_unique_id),
        is_document_video ? 1 : 0,
        mime_type,
        chDbId,
        msgId,
        media_group_id,
        channel.auto_publish ? 1 : 0,
        needsReview
      ).lastInsertRowid
    );

    for (const g of parsed.genres) {
      const gid = ensureGenre(g);
      db.prepare('INSERT OR IGNORE INTO movie_genres (movie_id, genre_id) VALUES (?, ?)').run(movieId, gid);
    }

    db.prepare(
      "INSERT INTO channel_posts (channel_id, message_id, media_group_id, file_id, file_unique_id, raw_caption, movie_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'synced')"
    ).run(chDbId, msgId, media_group_id, String(file_id), String(file_unique_id), caption || null, movieId);

    db.prepare("UPDATE telegram_channels SET last_synced_at = datetime('now') WHERE id = ?").run(chDbId);

    if (is_media_group_album) {
      db.prepare(
        "INSERT INTO sync_logs (telegram_channel_id, channel_title, message_id, movie_id, movie_title, event_type, details, success) VALUES (?, ?, ?, ?, ?, 'media_group_merged', ?, 1)"
      ).run(tgChannelId, chTitle, msgId, movieId, resolvedTitle, `Albom (poster + video + caption) birlashtirilib sinxronlandi: ${resolvedTitle} [${movieCode}]`);
    } else {
      db.prepare(
        "INSERT INTO sync_logs (telegram_channel_id, channel_title, message_id, movie_id, movie_title, event_type, details, success) VALUES (?, ?, ?, ?, ?, 'created', ?, 1)"
      ).run(tgChannelId, chTitle, msgId, movieId, resolvedTitle, `Kino avtomatik qo‘shildi: ${resolvedTitle} [${movieCode}]`);
    }

    db.exec('COMMIT');
    const createdMovie = db.prepare(`
      SELECT m.*, l.name as language_name, tc.title as source_channel_title
      FROM movies m LEFT JOIN languages l ON l.id = m.language_id
      LEFT JOIN telegram_channels tc ON tc.id = m.source_channel_id WHERE m.id = ?
    `).get(movieId) as Record<string, unknown>;
    res.status(201).json({ action: 'created', movie: enrichMovies([createdMovie])[0] });
  } catch (err) {
    db.exec('ROLLBACK');
    res.status(500).json({ error: err instanceof Error ? err.message : 'Sinxronizatsiya xatosi' });
  }
});

// Edited channel post handler simulation
app.patch('/api/sync/channel-post/:id', (req, res) => {
  const postId = Number(req.params.id);
  const post = db.prepare(`
    SELECT cp.*, tc.channel_id as tg_channel_id, tc.title as channel_title
    FROM channel_posts cp JOIN telegram_channels tc ON tc.id = cp.channel_id
    WHERE cp.id = ?
  `).get(postId) as Record<string, unknown> | undefined;

  if (!post || !post.movie_id) {
    res.status(404).json({ error: 'Kanal posti yoki bog‘langan kino topilmadi.' });
    return;
  }

  const caption = req.body?.caption as string | undefined;
  const parsed = parseMovieCaption(caption);

  db.exec('BEGIN');
  try {
    const movieIdNum = Number(post.movie_id);
    const movie = db.prepare('SELECT * FROM movies WHERE id = ?').get(movieIdNum) as Record<string, unknown>;
    const langId = parsed.language ? ensureLanguage(parsed.language) : sqlVal(movie.language_id);

    db.prepare(`
      UPDATE movies SET
        title = COALESCE(?, title),
        description = COALESCE(?, description),
        release_year = COALESCE(?, release_year),
        language_id = ?,
        duration_display = COALESCE(?, duration_display),
        rating = COALESCE(?, rating),
        needs_metadata_review = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      parsed.title,
      parsed.description,
      parsed.releaseYear,
      langId,
      parsed.durationText,
      parsed.rating,
      parsed.isComplete ? 0 : 1,
      movieIdNum
    );

    if (parsed.genres.length > 0) {
      db.prepare('DELETE FROM movie_genres WHERE movie_id = ?').run(movieIdNum);
      for (const g of parsed.genres) {
        const gid = ensureGenre(g);
        db.prepare('INSERT OR IGNORE INTO movie_genres (movie_id, genre_id) VALUES (?, ?)').run(movieIdNum, gid);
      }
    }

    db.prepare("UPDATE channel_posts SET raw_caption = ?, status = 'updated', edited_at = datetime('now') WHERE id = ?").run(
      caption || sqlVal(post.raw_caption),
      postId
    );
    db.prepare(
      "INSERT INTO sync_logs (telegram_channel_id, channel_title, message_id, movie_id, movie_title, event_type, details, success) VALUES (?, ?, ?, ?, ?, 'updated', ?, 1)"
    ).run(
      sqlVal(post.tg_channel_id),
      sqlVal(post.channel_title),
      sqlVal(post.message_id),
      movieIdNum,
      parsed.title || sqlVal(movie.title),
      `Tahrirlangan kanal posti yangilandi: ${parsed.title || String(movie.title)}`
    );

    db.exec('COMMIT');
    res.json({ action: 'updated', movie_id: movieIdNum });
  } catch (err) {
    db.exec('ROLLBACK');
    res.status(500).json({ error: err instanceof Error ? err.message : 'Yangilash xatosi' });
  }
});

// Mark channel post deleted / movie unavailable
app.delete('/api/sync/channel-post/:id', (req, res) => {
  const postId = Number(req.params.id);
  const post = db.prepare(`
    SELECT cp.*, tc.channel_id as tg_channel_id, tc.title as channel_title, m.title as movie_title
    FROM channel_posts cp
    JOIN telegram_channels tc ON tc.id = cp.channel_id
    LEFT JOIN movies m ON m.id = cp.movie_id
    WHERE cp.id = ?
  `).get(postId) as Record<string, unknown> | undefined;

  if (!post) {
    res.status(404).json({ error: 'Post topilmadi.' });
    return;
  }

  db.exec('BEGIN');
  try {
    db.prepare("UPDATE channel_posts SET is_deleted = 1, status = 'unavailable' WHERE id = ?").run(postId);
    if (post.movie_id) {
      db.prepare("UPDATE movies SET is_available = 0, updated_at = datetime('now') WHERE id = ?").run(sqlVal(post.movie_id));
    }
    db.prepare(
      "INSERT INTO sync_logs (telegram_channel_id, channel_title, message_id, movie_id, movie_title, event_type, details, success) VALUES (?, ?, ?, ?, ?, 'marked_unavailable', ?, 1)"
    ).run(
      sqlVal(post.tg_channel_id),
      sqlVal(post.channel_title),
      sqlVal(post.message_id),
      sqlVal(post.movie_id),
      sqlVal(post.movie_title),
      `Manba kanal posti (#${String(post.message_id)}) o‘chirilgani sababli kino mavjud emas deb belgilandi.`
    );
    db.exec('COMMIT');
    res.json({ action: 'marked_unavailable', post_id: postId });
  } catch (err) {
    db.exec('ROLLBACK');
    res.status(500).json({ error: 'Xatolik yuz berdi.' });
  }
});

// Mandatory Subscription Channels
app.get('/api/subscriptions', (_req, res) => {
  const rows = db.prepare('SELECT * FROM subscription_channels ORDER BY order_priority ASC, id ASC').all()
    .map((r: Record<string, unknown>) => ({ ...r, is_active: Boolean(r.is_active) }));
  res.json(rows);
});

app.post('/api/subscriptions', (req, res) => {
  const { channel_id, title, username, invite_link } = req.body || {};
  if (!channel_id || !title || !invite_link) {
    res.status(400).json({ error: 'Kanal ID, nomi va havola talab qilinadi.' });
    return;
  }
  try {
    const id = Number(
      db.prepare(
        'INSERT INTO subscription_channels (channel_id, title, username, invite_link, is_active) VALUES (?, ?, ?, ?, 1)'
      ).run(Number(channel_id), String(title).trim(), username || null, String(invite_link).trim()).lastInsertRowid
    );
    res.status(201).json(db.prepare('SELECT * FROM subscription_channels WHERE id = ?').get(id));
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Qo‘shib bo‘lmadi' });
  }
});

app.patch('/api/subscriptions/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM subscription_channels WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Topilmadi' });
    return;
  }
  db.prepare('UPDATE subscription_channels SET is_active = ? WHERE id = ?').run(
    req.body?.is_active ? 1 : 0,
    id
  );
  res.json(db.prepare('SELECT * FROM subscription_channels WHERE id = ?').get(id));
});

app.delete('/api/subscriptions/:id', (req, res) => {
  db.prepare('DELETE FROM subscription_channels WHERE id = ?').run(Number(req.params.id));
  res.json({ deleted: true });
});

// Users, Admins & Broadcasts
app.get('/api/users', (_req, res) => {
  const users = db.prepare(`
    SELECT u.*,
      (SELECT COUNT(*) FROM movie_views mv WHERE mv.user_id = u.id) as views_count,
      (SELECT COUNT(*) FROM favorites f WHERE f.user_id = u.id) as favorites_count
    FROM bot_users u ORDER BY u.last_active_at DESC
  `).all().map((u: Record<string, unknown>) => ({ ...u, is_blocked: Boolean(u.is_blocked) }));

  const admins = db.prepare('SELECT * FROM bot_admins ORDER BY id ASC').all().map((a: Record<string, unknown>) => ({
    ...a,
    can_manage_channels: Boolean(a.can_manage_channels),
    can_broadcast: Boolean(a.can_broadcast),
    is_active: Boolean(a.is_active),
  }));

  const broadcasts = db.prepare('SELECT * FROM broadcasts ORDER BY created_at DESC LIMIT 20').all();
  res.json({ users, admins, broadcasts });
});

app.post('/api/admins', (req, res) => {
  const { telegram_id, username, full_name, role = 'moderator', can_broadcast = false } = req.body || {};
  if (!telegram_id || !full_name) {
    res.status(400).json({ error: 'Telegram ID va to‘liq ism shart.' });
    return;
  }
  try {
    const id = Number(
      db.prepare(
        'INSERT INTO bot_admins (telegram_id, username, full_name, role, can_manage_channels, can_broadcast, is_active) VALUES (?, ?, ?, ?, 1, ?, 1)'
      ).run(Number(telegram_id), username || null, String(full_name).trim(), role, can_broadcast ? 1 : 0).lastInsertRowid
    );
    res.status(201).json(db.prepare('SELECT * FROM bot_admins WHERE id = ?').get(id));
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Admin qo‘shishda xato' });
  }
});

app.post('/api/broadcasts', (req, res) => {
  const { title, message_text } = req.body || {};
  if (!title || !message_text) {
    res.status(400).json({ error: 'Sarlavha va xabar matni kiritilishi shart.' });
    return;
  }
  const activeUsers = (db.prepare('SELECT COUNT(*) as c FROM bot_users WHERE is_blocked = 0').get() as { c: number }).c;
  const id = Number(
    db.prepare(
      "INSERT INTO broadcasts (title, message_text, status, sent_count, failed_count, completed_at) VALUES (?, ?, 'completed', ?, 0, datetime('now'))"
    ).run(String(title).trim(), String(message_text).trim(), activeUsers).lastInsertRowid
  );
  res.status(201).json(db.prepare('SELECT * FROM broadcasts WHERE id = ?').get(id));
});

// Live Telegram Bot API token verifier (optional utility — never stores token on disk)
app.post('/api/telegram/verify-token', async (req, res) => {
  const token = String(req.body?.token || '').trim();
  if (!token || !token.includes(':')) {
    res.status(400).json({ error: 'Yaroqli Telegram Bot Token formatini kiriting.' });
    return;
  }
  try {
    const tgRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await tgRes.json();
    if (!tgRes.ok || !data.ok) {
      res.status(400).json({ error: data.description || 'Telegram API xatoligi.' });
      return;
    }
    res.json({ ok: true, bot: data.result });
  } catch {
    res.status(502).json({ error: 'Telegram API bilan bog‘lanishda tarmoq xatoligi.' });
  }
});

// Codebase Explorer endpoints for browsing telegram_movie_platform/
function buildTree(dirPath: string, relativeBase = ''): Array<Record<string, unknown>> {
  if (!fs.existsSync(dirPath)) return [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    .filter((e) => !e.name.startsWith('__pycache__') && e.name !== '.pytest_cache')
    .sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

  return entries.map((entry) => {
    const full = path.join(dirPath, entry.name);
    const rel = relativeBase ? `${relativeBase}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      return {
        name: entry.name,
        path: rel,
        type: 'directory',
        children: buildTree(full, rel),
      };
    }
    const stat = fs.statSync(full);
    return {
      name: entry.name,
      path: rel,
      type: 'file',
      size: stat.size,
    };
  });
}

app.get('/api/codebase/tree', (_req, res) => {
  res.json(buildTree(PLATFORM_ROOT));
});

app.get('/api/codebase/file', (req, res) => {
  const relPath = String(req.query.path || '');
  const resolved = path.resolve(PLATFORM_ROOT, relPath);
  if (!resolved.startsWith(PLATFORM_ROOT) || !fs.existsSync(resolved) || fs.statSync(resolved).isDirectory()) {
    res.status(404).json({ error: 'Fayl topilmadi.' });
    return;
  }
  res.json({
    path: relPath,
    content: fs.readFileSync(resolved, 'utf8'),
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`KinoSync platform server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
