import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Trophy,
  TrendingUp,
  Database,
  Menu,
  X,
  Sparkles,
  Info
} from 'lucide-react';
import { hasSupabaseConfig } from '../lib/supabase';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const menuItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Players', path: '/players', icon: Users },
    { name: 'Tournaments', path: '/tournaments', icon: Trophy },
    { name: 'Rankings', path: '/rankings', icon: TrendingUp },
  ];

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-dark-950 text-slate-100 overflow-x-hidden relative">
      {/* Background Animated Glow Orbs */}
      <div className="bg-glow-orb w-[500px] h-[500px] bg-brand-primary/10 top-[-100px] left-[-100px]" />
      <div className="bg-glow-orb w-[600px] h-[600px] bg-brand-secondary/10 bottom-[-100px] right-[-100px]" />

      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex md:w-64 flex-col fixed inset-y-0 left-0 glass-panel border-r border-dark-800/80 z-20">
        {/* Brand logo */}
        <div className="p-6 border-b border-dark-800/80 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-primary to-brand-secondary flex items-center justify-center shadow-lg shadow-brand-primary/30">
            <span className="text-xl font-bold text-white tracking-wider">🏸</span>
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight font-sans">MABAR<span className="text-brand-secondary font-semibold">SMASH</span></h1>
            <p className="text-[10px] text-slate-400 font-medium tracking-widest uppercase">Badminton App</p>
          </div>
        </div>

        {/* Navigation links */}
        <nav className="flex-1 px-4 py-6 space-y-1.5">
          {menuItems.map((item) => {
            const Active = isActive(item.path);
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all duration-200 group relative ${
                  Active
                    ? 'glass-card-active text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-dark-900/40'
                }`}
              >
                {Active && (
                  <span className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-brand-primary rounded-r-full" />
                )}
                <Icon
                  className={`w-5 h-5 transition-transform duration-200 group-hover:scale-110 ${
                    Active ? 'text-brand-secondary' : 'text-slate-500 group-hover:text-slate-400'
                  }`}
                />
                <span className="text-sm font-sans tracking-wide">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Connection status footer */}
        <div className="p-4 border-t border-dark-800/80">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl ${
            hasSupabaseConfig 
              ? 'bg-emerald-500/5 border border-emerald-500/20' 
              : 'bg-amber-500/5 border border-amber-500/20'
          }`}>
            <Database className={`w-4 h-4 ${hasSupabaseConfig ? 'text-emerald-400 animate-pulse' : 'text-amber-400'}`} />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-slate-400 font-semibold tracking-wide uppercase">Connection Status</p>
              <p className="text-xs font-bold text-slate-200 truncate">
                {hasSupabaseConfig ? 'Supabase Connected' : 'Local Demo Mode'}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Top Navigation - Mobile */}
      <header className="md:hidden flex items-center justify-between px-5 py-4 glass-panel border-b border-dark-800 sticky top-0 z-30 w-full">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-primary to-brand-secondary flex items-center justify-center">
            <span className="text-base">🏸</span>
          </div>
          <h1 className="font-bold text-base tracking-tight">MABAR<span className="text-brand-secondary">SMASH</span></h1>
        </div>

        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1.5 rounded-lg bg-dark-900 border border-dark-800 hover:bg-dark-800 text-slate-300 hover:text-white transition-colors"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-20 bg-dark-950/90 backdrop-blur-md pt-20 px-6 flex flex-col justify-between pb-8">
          <nav className="space-y-3">
            {menuItems.map((item) => {
              const Active = isActive(item.path);
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-4 px-5 py-3.5 rounded-xl border ${
                    Active
                      ? 'bg-brand-primary/10 border-brand-primary/40 text-white font-semibold'
                      : 'border-dark-800 bg-dark-900/40 text-slate-400'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${Active ? 'text-brand-secondary' : 'text-slate-500'}`} />
                  <span className="text-base tracking-wide font-sans">{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* Mobile status banner */}
          <div className={`flex items-center gap-3 px-4 py-3.5 rounded-xl ${
            hasSupabaseConfig 
              ? 'bg-emerald-500/5 border border-emerald-500/20' 
              : 'bg-amber-500/5 border border-amber-500/20'
          }`}>
            <Database className={`w-5 h-5 ${hasSupabaseConfig ? 'text-emerald-400' : 'text-amber-400'}`} />
            <div>
              <p className="text-[10px] text-slate-400 font-semibold tracking-wide uppercase">Connection Status</p>
              <p className="text-sm font-bold text-slate-200">
                {hasSupabaseConfig ? 'Supabase Connected' : 'Local Demo Mode'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 min-h-screen md:pl-64 flex flex-col">
        {/* Connection Notice banner for Demo Mode */}
        {!hasSupabaseConfig && (
          <div className="bg-gradient-to-r from-amber-500/10 via-amber-600/10 to-amber-500/10 border-b border-amber-500/20 px-6 py-2.5 flex items-center justify-between text-[11px] text-amber-200/90 font-medium tracking-wide">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span>You are currently in <strong>Demo Mode</strong>. Data is saved locally in this browser. To save in the cloud, configure your <code>.env</code> file.</span>
            </div>
            <div className="flex items-center gap-1.5 opacity-80 hover:opacity-100 cursor-help" title="To connect: Copy .env.example to .env and fill out VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.">
              <Info className="w-3.5 h-3.5" />
              <span>Setup Guide</span>
            </div>
          </div>
        )}

        <div className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
};
