import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  Bot,
  Code2,
  Film,
  Menu,
  Plus,
  RefreshCw,
  ShieldCheck,
  X,
} from 'lucide-react';
import type { DashboardData } from './types';
import { DashboardView } from './components/DashboardView';
import { CatalogView } from './components/CatalogView';
import { ChannelSyncView } from './components/ChannelSyncView';
import { TelegramBotView } from './components/TelegramBotView';
import { SubscriptionsUsersView } from './components/SubscriptionsUsersView';
import { CodebaseDeploymentView } from './components/CodebaseDeploymentView';

type TabId = 'dashboard' | 'catalog' | 'sync' | 'bot' | 'users' | 'codebase';

const NAV_ITEMS: Array<{ id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'dashboard', label: 'Boshqaruv paneli', icon: BarChart3 },
  { id: 'catalog', label: 'Kinolar katalogi', icon: Film },
  { id: 'sync', label: 'Kanal sinxronizatsiyasi', icon: RefreshCw },
  { id: 'bot', label: 'Telegram Bot (UZ)', icon: Bot },
  { id: 'users', label: 'Obuna va Xabarlar', icon: ShieldCheck },
  { id: 'codebase', label: 'Kod bazasi va VPS', icon: Code2 },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loadingDash, setLoadingDash] = useState(true);
  const [createMovieSignal, setCreateMovieSignal] = useState(0);

  const loadDashboard = async () => {
    try {
      const res = await fetch('/api/dashboard');
      const data = await res.json();
      setDashboardData(data);
    } finally {
      setLoadingDash(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const currentNav = NAV_ITEMS.find((n) => n.id === activeTab)!;

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-white border-r border-slate-200">
        <div className="h-16 px-5 flex items-center border-b border-slate-200">
          <span className="text-lg font-bold tracking-tight text-slate-900 font-display whitespace-nowrap">
            KinoSync Studio
          </span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 text-xs text-slate-500 space-y-1">
          <div className="font-medium text-slate-700">Arxitektura to‘plami</div>
          <div>Aiogram 3 · Django 5 · PostgreSQL · Redis</div>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden bg-slate-900/50">
          <div className="w-64 h-full bg-white border-r border-slate-200 flex flex-col">
            <div className="h-14 px-4 flex items-center justify-between border-b border-slate-200">
              <span className="font-bold text-slate-900 font-display">KinoSync Studio</span>
              <button onClick={() => setMobileMenuOpen(false)} className="p-1 text-slate-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="p-3 space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-md ${
                      activeTab === item.id ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 md:pl-64 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 text-slate-600 hover:text-slate-900"
              aria-label="Menyuni ochish"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="text-sm text-slate-500 truncate">
              <span>Platforma</span>
              <span className="mx-2 text-slate-300">/</span>
              <span className="font-semibold text-slate-900">{currentNav.label}</span>
            </div>
          </div>

          <button
            onClick={() => {
              setActiveTab('catalog');
              setCreateMovieSignal((s) => s + 1);
            }}
            className="px-4 py-2 text-xs font-medium bg-slate-900 text-white rounded-md hover:bg-slate-800 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Yangi kino
          </button>
        </header>

        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto">
          {activeTab === 'dashboard' && (
            <DashboardView
              data={dashboardData}
              loading={loadingDash}
              onNavigate={(tab) => setActiveTab(tab as TabId)}
            />
          )}
          {activeTab === 'catalog' && (
            <CatalogView
              onRefreshDashboard={loadDashboard}
              openCreateSignal={createMovieSignal}
            />
          )}
          {activeTab === 'sync' && (
            <ChannelSyncView onRefreshDashboard={loadDashboard} />
          )}
          {activeTab === 'bot' && (
            <TelegramBotView onRefreshDashboard={loadDashboard} />
          )}
          {activeTab === 'users' && <SubscriptionsUsersView />}
          {activeTab === 'codebase' && <CodebaseDeploymentView />}
        </main>
      </div>
    </div>
  );
}
