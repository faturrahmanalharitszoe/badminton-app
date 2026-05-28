import React, { useState } from 'react';
import { useRankings } from '../hooks/useQueries';
import { Search, Medal, RefreshCw, BarChart3, HelpCircle } from 'lucide-react';

export const Rankings: React.FC = () => {
  const { data: rankings, isLoading, isRefetching, refetch } = useRankings();
  const [activeTab, setActiveTab] = useState<'pairs' | 'individuals'>('pairs');
  const [searchQuery, setSearchQuery] = useState('');

  const handleRefresh = () => {
    refetch();
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Medal className="w-5 h-5 text-amber-400 fill-amber-400/20" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-slate-300 fill-slate-300/20" />;
    if (rank === 3) return <Medal className="w-5 h-5 text-amber-700 fill-amber-700/20" />;
    return <span className="text-slate-500 font-bold text-xs pl-1.5">{rank}</span>;
  };

  const getWinRateColor = (rate: number) => {
    if (rate >= 0.7) return 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20';
    if (rate >= 0.5) return 'text-indigo-400 bg-indigo-500/10 border border-indigo-500/20';
    return 'text-slate-400 bg-slate-500/10 border border-slate-700';
  };

  const pairs = rankings?.pairs || [];
  const individuals = rankings?.individuals || [];

  // Filter based on search
  const filteredPairs = pairs.filter(
    (p) =>
      p.player1.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.player2.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredIndividuals = individuals.filter((i) =>
    i.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold font-sans tracking-tight gradient-text">Peringkat & Papan Skor</h2>
          <p className="text-sm text-slate-400 mt-1">
            Klasemen dihitung secara real-time dari semua pertandingan turnamen yang selesai.
          </p>
        </div>

        <button
          onClick={handleRefresh}
          disabled={isLoading || isRefetching}
          className="glass-btn px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 hover:border-brand-primary disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? 'animate-spin' : ''}`} />
          <span>{isRefetching ? 'Menghitung Ulang...' : 'Perbarui Klasemen'}</span>
        </button>
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-dark-900/40 p-2.5 border border-dark-800 rounded-2xl">
        <div className="flex items-center gap-1.5 p-1 bg-dark-950/80 rounded-xl border border-dark-800">
          <button
            onClick={() => {
              setActiveTab('pairs');
              setSearchQuery('');
            }}
            className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all ${
              activeTab === 'pairs'
                ? 'bg-brand-primary text-white shadow shadow-brand-primary/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Ganda Putra
          </button>
          <button
            onClick={() => {
              setActiveTab('individuals');
              setSearchQuery('');
            }}
            className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all ${
              activeTab === 'individuals'
                ? 'bg-brand-primary text-white shadow shadow-brand-primary/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Individu
          </button>
        </div>

        <div className="relative max-w-sm w-full">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={activeTab === 'pairs' ? 'Cari pasangan atau pemain...' : 'Cari pemain...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full glass-input pl-10 py-2 text-xs"
          />
        </div>
      </div>

      {/* Leaderboard Table Container */}
      {isLoading ? (
        <div className="text-center py-20 glass-panel rounded-2xl">
          <div className="w-10 h-10 border-4 border-brand-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400 font-medium">Menghitung klasemen papan skor...</p>
        </div>
      ) : activeTab === 'pairs' && filteredPairs.length === 0 ? (
        <div className="text-center py-16 glass-panel rounded-2xl border border-dark-800 space-y-3">
          <BarChart3 className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="font-bold text-lg text-slate-300">Statistik pasangan belum tersedia</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchQuery 
              ? 'Tidak ada pasangan yang cocok dengan pencarian Anda.' 
              : 'Pertandingan dengan format ganda harus diselesaikan dalam turnamen aktif untuk mulai mencatat peringkat pasangan.'}
          </p>
        </div>
      ) : activeTab === 'individuals' && filteredIndividuals.length === 0 ? (
        <div className="text-center py-16 glass-panel rounded-2xl border border-dark-800 space-y-3">
          <BarChart3 className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="font-bold text-lg text-slate-300">Statistik individu belum tersedia</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchQuery 
              ? 'Tidak ada pemain yang cocok dengan pencarian Anda.' 
              : 'Mainkan pertandingan dalam turnamen untuk menghasilkan statistik pemain dan peringkat individu.'}
          </p>
        </div>
      ) : (
        <div className="glass-panel rounded-2xl border border-dark-800/80 overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-dark-900/80 border-b border-dark-800/80 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <th className="py-4 px-6 text-center w-16">Peringkat</th>
                  <th className="py-4 px-4">{activeTab === 'pairs' ? 'Pasangan Ganda' : 'Nama Pemain'}</th>
                  <th className="py-4 px-4 text-center w-20">Main</th>
                  <th className="py-4 px-4 text-center w-20">Menang</th>
                  <th className="py-4 px-4 text-center w-20">Kalah</th>
                  <th className="py-4 px-4 text-center w-24">Selisih Poin</th>
                  <th className="py-4 px-4 w-40 text-center">Riwayat</th>
                  <th className="py-4 px-6 text-right w-32">Rasio Menang</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-800/50">
                {activeTab === 'pairs'
                  ? filteredPairs.map((pair, index) => {
                      const rank = index + 1;
                      const winRatePercent = Math.round(pair.winRate * 100);

                      return (
                        <tr key={pair.pairKey} className="hover:bg-dark-900/20 transition-colors">
                          <td className="py-4 px-6 text-center flex items-center justify-center">
                            {getRankIcon(rank)}
                          </td>
                          <td className="py-4 px-4 font-semibold text-white">
                            <div className="flex items-center gap-2">
                              <span>{pair.player1.name}</span>
                              <span className="text-[10px] text-slate-500 font-bold px-1.5 py-0.5 rounded bg-dark-950 border border-dark-800">MD</span>
                              <span>{pair.player2.name}</span>
                            </div>
                          </td>
                          <td className="py-4 px-4 text-center font-bold text-slate-300">{pair.matchesPlayed}</td>
                          <td className="py-4 px-4 text-center font-bold text-emerald-400">{pair.wins}</td>
                          <td className="py-4 px-4 text-center font-bold text-rose-400">{pair.losses}</td>
                          <td className={`py-4 px-4 text-center font-semibold ${
                            pair.pointDiff > 0 ? 'text-indigo-400' : pair.pointDiff < 0 ? 'text-rose-400' : 'text-slate-400'
                          }`}>
                            {pair.pointDiff > 0 ? `+${pair.pointDiff}` : pair.pointDiff}
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex items-center justify-center gap-1">
                              {pair.form.map((outcome, idx) => (
                                <span
                                  key={idx}
                                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black tracking-tighter ${
                                    outcome === 'W'
                                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                  }`}
                                  title={outcome === 'W' ? 'Menang' : 'Kalah'}
                                >
                                  {outcome}
                                </span>
                              ))}
                              {pair.form.length === 0 && <span className="text-xs text-slate-600">-</span>}
                            </div>
                          </td>
                          <td className="py-4 px-6 text-right">
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${getWinRateColor(pair.winRate)}`}>
                              {winRatePercent}%
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  : filteredIndividuals.map((ind, index) => {
                      const rank = index + 1;
                      const winRatePercent = Math.round(ind.winRate * 100);

                      return (
                        <tr key={ind.playerId} className="hover:bg-dark-900/20 transition-colors">
                          <td className="py-4 px-6 text-center flex items-center justify-center">
                            {getRankIcon(rank)}
                          </td>
                          <td className="py-4 px-4 font-semibold text-white truncate max-w-xs">
                            {ind.name}
                          </td>
                          <td className="py-4 px-4 text-center font-bold text-slate-300">{ind.matchesPlayed}</td>
                          <td className="py-4 px-4 text-center font-bold text-emerald-400">{ind.wins}</td>
                          <td className="py-4 px-4 text-center font-bold text-rose-400">{ind.losses}</td>
                          <td className={`py-4 px-4 text-center font-semibold ${
                            ind.pointDiff > 0 ? 'text-indigo-400' : ind.pointDiff < 0 ? 'text-rose-400' : 'text-slate-400'
                          }`}>
                            {ind.pointDiff > 0 ? `+${ind.pointDiff}` : ind.pointDiff}
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex items-center justify-center gap-1">
                              {ind.form.map((outcome, idx) => (
                                <span
                                  key={idx}
                                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black tracking-tighter ${
                                    outcome === 'W'
                                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                  }`}
                                  title={outcome === 'W' ? 'Menang' : 'Kalah'}
                                >
                                  {outcome}
                                </span>
                              ))}
                              {ind.form.length === 0 && <span className="text-xs text-slate-600">-</span>}
                            </div>
                          </td>
                          <td className="py-4 px-6 text-right">
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${getWinRateColor(ind.winRate)}`}>
                              {winRatePercent}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Guide details Card */}
      <div className="p-5 bg-dark-900/30 border border-dark-800/80 rounded-2xl flex items-start gap-4">
        <HelpCircle className="w-6 h-6 text-brand-secondary flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="font-bold text-sm text-slate-200">Kriteria Peringkat & Tie Breaker</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            Papan peringkat klasemen mengurutkan pasangan dan pemain berdasarkan <strong>Rasio Menang</strong> (Menang / Total Main) sebagai acuan utama. Jika rasio menang sama, tim akan diurutkan berdasarkan <strong>Total Menang</strong>. Jika masih sama, peringkat akhir ditentukan oleh <strong>Selisih Poin</strong> (Total Poin yang Didapat - Total Poin Kemasukan) yang menunjukkan dominasi permainan.
          </p>
        </div>
      </div>
    </div>
  );
};
