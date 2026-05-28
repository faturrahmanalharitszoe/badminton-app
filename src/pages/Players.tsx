import React, { useState } from 'react';
import {
  usePlayers,
  useAddPlayer,
  useUpdatePlayer,
  useDeletePlayer,
  useRankings
} from '../hooks/useQueries';
import { UserPlus, Edit2, Trash2, Check, X, ShieldAlert, Star } from 'lucide-react';

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

  // Generate color palette based on name hash for consistent avatar colors
  const getAvatarColor = (name: string) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = [
      'from-indigo-500 to-purple-500',
      'from-cyan-500 to-blue-500',
      'from-emerald-500 to-teal-500',
      'from-amber-500 to-orange-500',
      'from-rose-500 to-pink-500',
      'from-violet-500 to-fuchsia-500'
    ];
    return colors[Math.abs(hash) % colors.length];
  };

  const handleAddPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlayerName.trim()) return;
    if (newPlayerName.trim().length < 2) {
      setErrorMsg('Name must be at least 2 characters');
      return;
    }
    setErrorMsg(null);
    try {
      await addPlayerMutation.mutateAsync(newPlayerName.trim());
      setNewPlayerName('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Error adding player');
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
      alert(err.message || 'Error updating player');
    }
  };

  const handleDeletePlayer = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete player "${name}"?`)) {
      try {
        await deletePlayerMutation.mutateAsync(id);
      } catch (err: any) {
        alert(err.message || 'Error deleting player');
      }
    }
  };

  // Find individual stats for a player
  const getPlayerStats = (playerId: string) => {
    if (!rankings || !rankings.individuals) return null;
    return rankings.individuals.find((ind) => ind.playerId === playerId) || null;
  };

  return (
    <div className="space-y-8">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold font-sans tracking-tight gradient-text">Players Directory</h2>
          <p className="text-sm text-slate-400 mt-1">
            Register players, view their overall performance, and manage the roster.
          </p>
        </div>
        <div className="glass-card px-4 py-2 rounded-xl flex items-center gap-2.5 w-fit">
          <Star className="w-5 h-5 text-brand-secondary fill-brand-secondary/20" />
          <span className="text-sm font-semibold">Total Registered: {players.length}</span>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Form panel */}
        <div className="lg:col-span-1 glass-panel p-6 rounded-2xl border border-dark-800 space-y-6">
          <div className="flex items-center gap-2.5 border-b border-dark-800 pb-4">
            <UserPlus className="w-5 h-5 text-brand-primary" />
            <h3 className="font-bold text-lg">Add New Player</h3>
          </div>

          <form onSubmit={handleAddPlayer} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="playerName" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Full Name
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
              {addPlayerMutation.isPending ? 'Registering...' : 'Register Player'}
            </button>
          </form>
        </div>

        {/* Players List Grid */}
        <div className="lg:col-span-2 space-y-6">
          {isLoading ? (
            <div className="text-center py-12 glass-panel rounded-2xl">
              <div className="w-8 h-8 border-4 border-brand-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-slate-400">Loading players list...</p>
            </div>
          ) : isError ? (
            <div className="p-6 bg-rose-500/10 border border-rose-500/25 rounded-2xl text-center text-rose-300">
              Error fetching players. Please check your database connection.
            </div>
          ) : players.length === 0 ? (
            <div className="text-center py-16 glass-panel rounded-2xl border border-dark-800 space-y-3">
              <span className="text-4xl">🏸</span>
              <h3 className="font-bold text-lg text-slate-300">No players registered yet</h3>
              <p className="text-sm text-slate-500 max-w-sm mx-auto">
                Start by registering players on the left panel so you can pair them and create tournaments.
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
                    className={`glass-card p-5 rounded-2xl flex flex-col justify-between gap-4 ${
                      isEditing ? 'border-brand-primary bg-brand-primary/5' : ''
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      {/* Avatar */}
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-tr ${getAvatarColor(player.name)} flex items-center justify-center shadow-lg shadow-black/25 flex-shrink-0 text-white font-bold text-lg tracking-wide uppercase`}>
                        {player.name.substring(0, 2)}
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
                            <h4 className="font-bold text-base text-white truncate font-sans tracking-wide">
                              {player.name}
                            </h4>
                            <p className="text-[10px] text-slate-500 mt-0.5">
                              Joined {new Date(player.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Stats summary */}
                    <div className="grid grid-cols-4 gap-2 py-2 px-3 bg-dark-950/50 border border-dark-800/80 rounded-xl text-center">
                      <div>
                        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">MP</div>
                        <div className="text-sm font-bold text-slate-200">{stats ? stats.matchesPlayed : 0}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Wins</div>
                        <div className="text-sm font-bold text-emerald-400">{stats ? stats.wins : 0}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Loss</div>
                        <div className="text-sm font-bold text-rose-400">{stats ? stats.losses : 0}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Diff</div>
                        <div className={`text-sm font-bold ${stats && stats.pointDiff >= 0 ? 'text-indigo-400' : 'text-rose-400'}`}>
                          {stats ? (stats.pointDiff > 0 ? `+${stats.pointDiff}` : stats.pointDiff) : 0}
                        </div>
                      </div>
                    </div>

                    {/* Footer Actions & win rate */}
                    <div className="flex items-center justify-between border-t border-dark-800/50 pt-3">
                      {/* Win Rate Badge */}
                      <div className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border tracking-wide uppercase ${winRateColor}`}>
                        {stats && stats.matchesPlayed > 0 ? `${winRatePercent}% WR` : 'No games'}
                      </div>

                      {/* Actions */}
                      {!isEditing && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleStartEdit(player.id, player.name)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-dark-800/60 border border-transparent hover:border-dark-800 transition-all"
                            title="Edit Name"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeletePlayer(player.id, player.name)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all"
                            title="Delete Player"
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
