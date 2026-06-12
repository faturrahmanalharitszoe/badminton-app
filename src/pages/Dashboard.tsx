import React, { useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  usePlayers,
  useTournaments,
  useRankings
} from '../hooks/useQueries';
import {
  Trophy,
  Users,
  Activity,
  Award,
  ChevronRight,
  Clock,
  Sparkles,
  Plus
} from 'lucide-react';
import { db } from '../lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { getAvatarColor, getJomokAvatar } from '../lib/avatar';


export const Dashboard: React.FC = () => {
  const { data: players = [] } = usePlayers();
  const { data: tournaments = [] } = useTournaments();
  const { data: rankings } = useRankings();

  // Query all matches across all tournaments to count games and get recent ones
  const { data: allMatches = [] } = useQuery({
    queryKey: ['all-matches-dashboard'],
    queryFn: db.getAllMatches,
  });

  const activeTournaments = useMemo(() => tournaments.filter((t) => t.status === 'active'), [tournaments]);
  const completedMatches = useMemo(() => allMatches.filter((m) => m.winner !== null), [allMatches]);

  // Sort and take last 4 completed matches for recent results feed
  const recentResults = useMemo(() => {
    return [...completedMatches]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 4);
  }, [completedMatches]);

  const topPairs = useMemo(() => rankings?.pairs?.slice(0, 3) || [], [rankings]);
  const topIndividuals = useMemo(() => rankings?.individuals?.slice(0, 3) || [], [rankings]);

  const playerLookup = useMemo(() => {
    const map = new Map<string, string>();
    players.forEach((p) => {
      map.set(p.id, p.name);
    });
    return map;
  }, [players]);

  const getPlayerName = useCallback((id: string) => {
    if (id === 'ghost') return '👻 GHOST';
    return playerLookup.get(id) || 'Tidak Diketahui';
  }, [playerLookup]);

  const getTeamNames = useCallback((teamIds: string[]) => {
    if (!teamIds || teamIds.length === 0) return 'Bye';
    return teamIds.map((id) => getPlayerName(id)).join(' & ');
  }, [getPlayerName]);

  const getTournamentName = useCallback((tId: string) => {
    return tournaments.find((t) => t.id === tId)?.name || 'Mabar Smash';
  }, [tournaments]);

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-brand-primary/10 via-dark-900 to-brand-secondary/10 border border-dark-800/80 p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl">
        <div className="space-y-2 z-10">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-brand-secondary animate-pulse" />
            <span className="text-xs font-bold text-brand-secondary uppercase tracking-widest">Ringkasan Dashboard</span>
          </div>
          <h2 className="text-3xl font-extrabold font-sans text-white tracking-tight leading-none">
            Welcome to Amba<span className="text-brand-secondary">Lanton</span>!
          </h2>
          <p className="text-sm text-slate-400 max-w-xl">
            Teman setia mabar badminton Anda. Atur sesi lapangan, buat pasangan tim yang seimbang secara adil, buat bagan turnamen secara instan, dan catat klasemen peringkat ganda secara otomatis!
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 z-10">
          <Link
            to="/tournaments"
            className="px-4 py-2.5 rounded-xl gradient-btn flex items-center gap-1.5 text-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Turnamen Baru</span>
          </Link>
          <Link
            to="/players"
            className="px-4 py-2.5 rounded-xl glass-btn flex items-center gap-1.5 text-sm"
          >
            <Users className="w-4 h-4" />
            <span>Kelola Pemain</span>
          </Link>
        </div>

        {/* Glow decorative */}
        <div className="absolute right-[-80px] top-[-50px] w-64 h-64 bg-brand-primary/15 rounded-full blur-[80px] pointer-events-none" />
      </div>

      {/* Stats Cards Section */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Players */}
        <div className="glass-card p-5 rounded-2xl border border-dark-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Pemain</p>
            <h3 className="text-xl font-bold text-white mt-0.5">{players.length}</h3>
          </div>
        </div>

        {/* Card 2: Total Tournaments */}
        <div className="glass-card p-5 rounded-2xl border border-dark-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Turnamen</p>
            <h3 className="text-xl font-bold text-white mt-0.5">{tournaments.length}</h3>
          </div>
        </div>

        {/* Card 3: Active Brackets */}
        <div className="glass-card p-5 rounded-2xl border border-dark-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-brand-secondary/10 border border-brand-secondary/20 flex items-center justify-center text-brand-secondary">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Game Aktif</p>
            <h3 className="text-xl font-bold text-white mt-0.5">{activeTournaments.length}</h3>
          </div>
        </div>

        {/* Card 4: Matches Played */}
        <div className="glass-card p-5 rounded-2xl border border-dark-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Game Selesai</p>
            <h3 className="text-xl font-bold text-white mt-0.5">{completedMatches.length}</h3>
          </div>
        </div>
      </div>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Left Side: Active Tournaments & Recent Results */}
        <div className="lg:col-span-2 space-y-8">

          {/* Active Tournaments Column */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white tracking-wide flex items-center gap-2">
                <Activity className="w-5 h-5 text-brand-primary" />
                <span>Turnamen Sedang Berjalan</span>
              </h3>
              {activeTournaments.length > 0 && (
                <span className="text-[10px] bg-brand-primary/10 text-brand-primary px-2 py-0.5 rounded-full font-bold">
                  {activeTournaments.length} AKTIF
                </span>
              )}
            </div>

            {activeTournaments.length === 0 ? (
              <div className="text-center py-10 bg-dark-900/20 border border-dark-800/80 rounded-2xl text-slate-500 text-sm space-y-2">
                <p>Tidak ada turnamen aktif saat ini.</p>
                <Link to="/tournaments" className="text-brand-primary hover:underline font-semibold text-xs inline-flex items-center gap-1">
                  <span>Buat turnamen sekarang</span>
                  <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeTournaments.slice(0, 2).map((t) => (
                  <div
                    key={t.id}
                    className="glass-card p-5 rounded-2xl border border-dark-800 flex flex-col justify-between gap-4"
                  >
                    <div>
                      <h4 className="font-bold text-sm text-white truncate">{t.name}</h4>
                      <p className="text-[10px] text-slate-500 mt-1 capitalize">Format {t.format === 'double' ? 'Ganda (MD)' : 'Tunggal (1v1)'}</p>
                    </div>
                    <Link
                      to={`/tournaments/${t.id}`}
                      className="text-xs text-brand-secondary font-bold hover:text-white flex items-center gap-1 hover:gap-1.5 transition-all w-fit"
                    >
                      <span>Update skor & bagan</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Results Feed */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-white tracking-wide flex items-center gap-2">
              <Clock className="w-5 h-5 text-slate-400" />
              <span>Hasil Pertandingan Terakhir</span>
            </h3>

            {recentResults.length === 0 ? (
              <div className="text-center py-10 bg-dark-900/20 border border-dark-800/80 rounded-2xl text-slate-500 text-xs">
                Belum ada hasil pertandingan yang tercatat. Selesaikan pertandingan di bagan turnamen untuk melihat riwayat di sini.
              </div>
            ) : (
              <div className="space-y-3">
                {recentResults.map((match) => (
                  <div
                    key={match.id}
                    className="glass-card p-4 rounded-xl border border-dark-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      {/* Tournament label */}
                      <span className="text-[9px] font-bold text-brand-primary uppercase tracking-widest block mb-1">
                        {getTournamentName(match.tournament_id)}
                      </span>
                      {/* Pairs info */}
                      <div className="flex flex-col gap-1 text-xs">
                        <div className={`flex items-center gap-2 ${match.winner === 1 ? 'text-emerald-400 font-bold' : 'text-slate-400'}`}>
                          <span className="truncate">{getTeamNames(match.team1_ids)}</span>
                          {match.winner === 1 && <span className="text-[10px]">🏆</span>}
                        </div>
                        <div className={`flex items-center gap-2 ${match.winner === 2 ? 'text-emerald-400 font-bold' : 'text-slate-400'}`}>
                          <span className="truncate">{getTeamNames(match.team2_ids)}</span>
                          {match.winner === 2 && <span className="text-[10px]">🏆</span>}
                        </div>
                      </div>
                    </div>

                    {/* Scores display — per-set breakdown */}
                    <div className="flex items-center gap-1.5 bg-dark-950/80 border border-dark-800 px-2.5 py-1.5 rounded-lg">
                      {match.set_scores && match.set_scores.length > 0 ? (
                        match.set_scores.map((s: any, idx: number) => (
                          <span
                            key={idx}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${(match.winner === 1 && s.team1 > s.team2) || (match.winner === 2 && s.team2 > s.team1)
                                ? 'bg-emerald-500/15 text-emerald-300'
                                : 'bg-rose-500/15 text-rose-300'
                              }`}
                          >
                            {s.team1}-{s.team2}
                          </span>
                        ))
                      ) : (
                        <span className={`text-sm font-black ${match.winner === 1 ? 'text-emerald-400' : match.winner === 2 ? 'text-rose-400' : 'text-slate-200'}`}>
                          <span className={match.winner === 1 ? 'text-emerald-400' : ''}>{match.score1}</span>
                          <span className="text-slate-600 mx-1">:</span>
                          <span className={match.winner === 2 ? 'text-emerald-400' : ''}>{match.score2}</span>
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Leaderboard Previews */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-panel p-5 rounded-2xl border border-dark-800 space-y-6">

            {/* MD Pairs Preview */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-dark-800 pb-3">
                <h4 className="font-bold text-sm text-slate-200 tracking-wide flex items-center gap-2">
                  <Trophy className="w-4.5 h-4.5 text-amber-500" />
                  <span>Pasangan Terbaik (MD)</span>
                </h4>
                <Link to="/rankings" className="text-[10px] text-brand-primary font-bold hover:underline">
                  Lihat Semua
                </Link>
              </div>

              {topPairs.length === 0 ? (
                <p className="text-xs text-slate-500 py-2">Belum ada peringkat tercatat.</p>
              ) : (
                <div className="space-y-3.5">
                  {topPairs.map((pair, index) => (
                    <div key={pair.pairKey} className="flex items-center justify-between gap-4 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-5 h-5 flex items-center justify-center rounded-full font-black ${index === 0 ? 'bg-amber-400/10 text-amber-400 border border-amber-400/20' :
                          index === 1 ? 'bg-slate-300/10 text-slate-300 border border-slate-300/20' :
                            'bg-amber-700/10 text-amber-700 border border-amber-700/20'
                          }`}>
                          {index + 1}
                        </span>
                        <span className="font-semibold text-slate-300 truncate">
                          {pair.player1.name} & {pair.player2.name}
                        </span>
                      </div>
                      <span className="font-bold text-slate-400">{Math.round(pair.winRate * 100)}% WR</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Individual Preview */}
            <div className="space-y-4 border-t border-dark-800 pt-5">
              <div className="flex items-center justify-between border-b border-dark-800 pb-3">
                <h4 className="font-bold text-sm text-slate-200 tracking-wide flex items-center gap-2">
                  <Award className="w-4.5 h-4.5 text-brand-secondary" />
                  <span>Pemain Terbaik (Individu)</span>
                </h4>
                <Link to="/rankings" className="text-[10px] text-brand-primary font-bold hover:underline">
                  Lihat Semua
                </Link>
              </div>

              {topIndividuals.length === 0 ? (
                <p className="text-xs text-slate-500 py-2">Belum ada peringkat tercatat.</p>
              ) : (
                <div className="space-y-3.5">
                  {topIndividuals.map((ind, index) => (
                    <div key={ind.playerId} className="flex items-center justify-between gap-4 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-5 h-5 flex items-center justify-center rounded-full font-black ${index === 0 ? 'bg-amber-400/10 text-amber-400 border border-amber-400/20' :
                          index === 1 ? 'bg-slate-300/10 text-slate-300 border border-slate-300/20' :
                            'bg-amber-700/10 text-amber-700 border border-amber-700/20'
                          }`}>
                          {index + 1}
                        </span>
                        {/* Avatar */}
                        <div className={`w-6 h-6 rounded-md bg-gradient-to-tr ${getAvatarColor(ind.name)} flex items-center justify-center shadow-sm flex-shrink-0 text-white font-bold text-[8px] uppercase relative overflow-hidden`}>
                          <span className="z-0">{ind.name.substring(0, 2)}</span>
                          <img
                            src={getJomokAvatar(ind.playerId)}
                            alt={ind.name}
                            className="absolute inset-0 w-full h-full object-cover z-10 transition-transform duration-300 hover:scale-110"
                            onError={(e) => {
                              (e.target as HTMLImageElement).remove();
                            }}
                          />
                        </div>
                        <span className="font-semibold text-slate-300 truncate">{ind.name}</span>
                      </div>
                      <span className="font-bold text-slate-400">{Math.round(ind.winRate * 100)}% WR</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};
