import React, { useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  usePlayers,
  useAddPlayer,
  useUpdatePlayer,
  useDeletePlayer,
  useRankings
} from '../hooks/useQueries';
import { UserPlus, Edit2, Trash2, Check, X, ShieldAlert, Star, ExternalLink } from 'lucide-react';
import { getAvatarColor, getJomokAvatar } from '../lib/avatar';

export const Players: React.FC = () => {
  const { data: players = [], isLoading, isError } = usePlayers();
  const { data: rankings } = useRankings();
  const addPlayerMutation = useAddPlayer();
  const updatePlayerMutation = useUpdatePlayer();
  const deletePlayerMutation = useDeletePlayer();

  const [newPlayerName, setNewPlayerName] = useState('');
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);


  const handleAddPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlayerName.trim()) return;
    if (newPlayerName.trim().length < 2) {
      setErrorMsg('Nama harus minimal 2 karakter');
      return;
    }
    setErrorMsg(null);
    try {
      await addPlayerMutation.mutateAsync(newPlayerName.trim());
      setNewPlayerName('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menambahkan pemain');
    }
  };

  const handleStartEdit = (id: string, name: string) => {
    setEditingPlayerId(id);
    setEditingName(name);
  };

  const handleCancelEdit = () => {
    setEditingPlayerId(null);
    setEditingName('');
  };

  const handleSaveEdit = async (id: string) => {
    if (!editingName.trim()) return;
    try {
      await updatePlayerMutation.mutateAsync({ id, name: editingName.trim() });
      setEditingPlayerId(null);
    } catch (err: any) {
      alert(err.message || 'Gagal mengedit nama pemain');
    }
  };

  const handleDeletePlayer = async (id: string, name: string) => {
    if (window.confirm(`Apakah Anda yakin ingin menghapus pemain "${name}"?`)) {
      try {
        await deletePlayerMutation.mutateAsync(id);
      } catch (err: any) {
        alert(err.message || 'Gagal menghapus pemain');
      }
    }
  };

  const playerStatsMap = useMemo(() => {
    const map = new Map<string, any>();
    if (rankings && rankings.individuals) {
      rankings.individuals.forEach((ind) => {
        map.set(ind.playerId, ind);
      });
    }
    return map;
  }, [rankings]);

  // Find individual stats for a player
  const getPlayerStats = useCallback((playerId: string) => {
    return playerStatsMap.get(playerId) || null;
  }, [playerStatsMap]);

  return (
    <div className="space-y-8">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold font-sans tracking-tight gradient-text">Direktori Pemain</h2>
          <p className="text-sm text-slate-400 mt-1">
            Daftarkan pemain, lihat performa keseluruhan mereka, dan kelola daftar pemain.
          </p>
        </div>
        <div className="glass-card px-4 py-2 rounded-xl flex items-center gap-2.5 w-fit">
          <Star className="w-5 h-5 text-brand-secondary fill-brand-secondary/20" />
          <span className="text-sm font-semibold">Total Terdaftar: {players.length}</span>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Form panel */}
        <div className="lg:col-span-1 glass-panel p-6 rounded-2xl border border-dark-800 space-y-6">
          <div className="flex items-center gap-2.5 border-b border-dark-800 pb-4">
            <UserPlus className="w-5 h-5 text-brand-primary" />
            <h3 className="font-bold text-lg">Tambah Pemain Baru</h3>
          </div>

          <form onSubmit={handleAddPlayer} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="playerName" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Nama Lengkap
              </label>
              <input
                id="playerName"
                type="text"
                value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value)}
                placeholder="e.g. Hendra Setiawan"
                className="w-full glass-input"
                disabled={addPlayerMutation.isPending}
              />
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-2 text-xs text-rose-300">
                <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={addPlayerMutation.isPending || !newPlayerName.trim()}
              className="w-full py-2.5 rounded-xl gradient-btn flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {addPlayerMutation.isPending ? 'Mendaftarkan...' : 'Daftarkan Pemain'}
            </button>
          </form>
        </div>

        {/* Players List Grid */}
        <div className="lg:col-span-2 space-y-6">
          {isLoading ? (
            <div className="text-center py-12 glass-panel rounded-2xl">
              <div className="w-8 h-8 border-4 border-brand-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-slate-400">Memuat daftar pemain...</p>
            </div>
          ) : isError ? (
            <div className="p-6 bg-rose-500/10 border border-rose-500/25 rounded-2xl text-center text-rose-300">
              Gagal memuat data pemain. Silakan periksa koneksi database Anda.
            </div>
          ) : players.length === 0 ? (
            <div className="text-center py-16 glass-panel rounded-2xl border border-dark-800 space-y-3">
              <span className="text-4xl">🏸</span>
              <h3 className="font-bold text-lg text-slate-300">Belum ada pemain terdaftar</h3>
              <p className="text-sm text-slate-500 max-w-sm mx-auto">
                Mulai dengan mendaftarkan pemain di panel kiri agar Anda dapat memasangkan mereka dan membuat turnamen.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {players.map((player) => {
                const isEditing = editingPlayerId === player.id;
                const stats = getPlayerStats(player.id);
                const winRatePercent = stats ? Math.round(stats.winRate * 100) : 0;

                // Color coding for win rates
                const winRateColor =
                  winRatePercent >= 65 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' :
                    winRatePercent >= 45 ? 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' :
                      stats && stats.matchesPlayed > 0 ? 'text-slate-400 bg-slate-500/10 border-slate-500/20' :
                        'text-slate-500 bg-slate-800/30 border-dark-700/50';

                return (
                  <div
                    key={player.id}
                    className={`glass-card p-5 rounded-2xl flex flex-col justify-between gap-4 ${isEditing ? 'border-brand-primary bg-brand-primary/5' : ''
                      }`}
                  >
                    <div className="flex items-start gap-4">
                      {/* Avatar */}
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-tr ${getAvatarColor(player.name)} flex items-center justify-center shadow-lg shadow-black/25 flex-shrink-0 text-white font-bold text-lg tracking-wide uppercase relative overflow-hidden`}>
                        <span className="z-0">{player.name.substring(0, 2)}</span>
                        <img
                          src={getJomokAvatar(player.id)}
                          alt={player.name}
                          className="absolute inset-0 w-full h-full object-cover z-10 transition-transform duration-300 hover:scale-110"
                          onError={(e) => {
                            (e.target as HTMLImageElement).remove();
                          }}
                        />
                      </div>

                      {/* Name & Title */}
                      <div className="flex-1 min-w-0">
                        {isEditing ? (
                          <div className="flex items-center gap-2 mt-1">
                            <input
                              type="text"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              className="w-full glass-input py-1 px-3 text-sm"
                            />
                            <button
                              onClick={() => handleSaveEdit(player.id)}
                              className="p-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-white transition-all"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div>
                            <Link
                              to={`/players/${player.id}`}
                              className="group flex items-center gap-1.5"
                            >
                              <h4 className="font-bold text-base text-white truncate font-sans tracking-wide group-hover:text-brand-primary transition-colors">
                                {player.name}
                              </h4>
                              <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-brand-primary opacity-0 group-hover:opacity-100 transition-all" />
                            </Link>
                            <p className="text-[10px] text-slate-500 mt-0.5">
                              Bergabung sejak {new Date(player.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Stats summary */}
                    <div className="grid grid-cols-4 gap-2 py-2 px-3 bg-dark-950/50 border border-dark-800/80 rounded-xl text-center">
                      <div>
                        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Main</div>
                        <div className="text-sm font-bold text-slate-200">{stats ? stats.matchesPlayed : 0}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Menang</div>
                        <div className="text-sm font-bold text-emerald-400">{stats ? stats.wins : 0}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Kalah</div>
                        <div className="text-sm font-bold text-rose-400">{stats ? stats.losses : 0}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Selisih</div>
                        <div className={`text-sm font-bold ${stats && stats.pointDiff >= 0 ? 'text-indigo-400' : 'text-rose-400'}`}>
                          {stats ? (stats.pointDiff > 0 ? `+${stats.pointDiff}` : stats.pointDiff) : 0}
                        </div>
                      </div>
                    </div>

                    {/* Footer Actions & win rate */}
                    <div className="flex items-center justify-between border-t border-dark-800/50 pt-3">
                      {/* Win Rate Badge */}
                      <div className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border tracking-wide uppercase ${winRateColor}`}>
                        {stats && stats.matchesPlayed > 0 ? `${winRatePercent}% WR` : 'Belum main'}
                      </div>

                      {/* Actions */}
                      {!isEditing && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleStartEdit(player.id, player.name)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-dark-800/60 border border-transparent hover:border-dark-800 transition-all"
                            title="Edit Nama"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeletePlayer(player.id, player.name)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all"
                            title="Hapus Pemain"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
