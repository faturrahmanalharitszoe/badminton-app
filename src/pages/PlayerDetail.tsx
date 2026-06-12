import React, { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { usePlayers, useRankings } from '../hooks/useQueries';
import { db } from '../lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Trophy, Target, TrendingUp, Calendar, Award, BarChart3 } from 'lucide-react';
import { getAvatarColor, getJomokAvatar } from '../lib/avatar';

interface MatchHistory {
    id: string;
    tournamentName: string;
    tournamentDate: string;
    partnerName: string;
    opponentNames: string;
    score: string;
    setScores: { team1: number; team2: number }[] | null;
    result: 'W' | 'L';
    tournamentId: string;
}

export const PlayerDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const playerId = id || '';

    const { data: players = [] } = usePlayers();
    const { data: rankings } = useRankings();

    // Get player match history
    const { data: matchHistory = [], isLoading: loadingHistory } = useQuery({
        queryKey: ['player-history', playerId],
        queryFn: async (): Promise<MatchHistory[]> => {
            const allMatches = await db.getAllMatches();
            const allTournaments = await db.getTournaments();

            const tournamentMap = new Map(allTournaments.map(t => [t.id, t]));
            const playerMatches: MatchHistory[] = [];

            // Filter matches where this player participated
            const playedMatches = allMatches.filter(m =>
                m.winner !== null &&
                m.score1 !== null &&
                m.score2 !== null &&
                (m.team1_ids.includes(playerId) || m.team2_ids.includes(playerId))
            );

            for (const m of playedMatches) {
                const tournament = tournamentMap.get(m.tournament_id);
                if (!tournament) continue;

                const isTeam1 = m.team1_ids.includes(playerId);
                const partner = isTeam1
                    ? m.team1_ids.find(pId => pId !== playerId)
                    : m.team2_ids.find(pId => pId !== playerId);

                const partnerPlayer = players.find(p => p.id === partner);
                const opponentTeam = isTeam1 ? m.team2_ids : m.team1_ids;
                const opponentPlayers = opponentTeam.map(pId =>
                    players.find(p => p.id === pId)?.name || 'Unknown'
                ).join(' & ');

                const won = (isTeam1 && m.winner === 1) || (!isTeam1 && m.winner === 2);

                const setScoreDisplay = m.set_scores && m.set_scores.length > 0
                    ? m.set_scores.map((s: any) => `${s.team1}-${s.team2}`).join(', ')
                    : `${m.score1} - ${m.score2}`;

                playerMatches.push({
                    id: m.id,
                    tournamentName: tournament.name,
                    tournamentDate: tournament.date,
                    partnerName: partnerPlayer?.name || 'Solo',
                    opponentNames: opponentPlayers,
                    score: setScoreDisplay,
                    result: won ? 'W' : 'L',
                    tournamentId: tournament.id,
                    setScores: m.set_scores || null,
                });
            }

            // Sort by date descending
            return playerMatches.sort((a, b) =>
                new Date(b.tournamentDate).getTime() - new Date(a.tournamentDate).getTime()
            );
        },
        enabled: Boolean(playerId) && players.length > 0,
    });

    const player = players.find(p => p.id === playerId);
    const individualStats = rankings?.individuals.find(r => r.playerId === playerId);

    // Calculate additional stats
    const stats = useMemo(() => {
        if (!individualStats) return null;

        const winRatePercent = Math.round(individualStats.winRate * 100);
        const totalPoints = individualStats.pointsWon + individualStats.pointsLost;
        const avgPointsPerMatch = individualStats.matchesPlayed > 0
            ? (individualStats.pointsWon / individualStats.matchesPlayed).toFixed(1)
            : '0';

        return {
            ...individualStats,
            winRatePercent,
            totalPoints,
            avgPointsPerMatch,
        };
    }, [individualStats]);

    if (!player) {
        return (
            <div className="text-center py-16 space-y-4">
                <div className="w-12 h-12 rounded-full bg-rose-500/20 flex items-center justify-center mx-auto">
                    <span className="text-2xl">👤</span>
                </div>
                <h3 className="font-bold text-xl text-slate-300">Pemain tidak ditemukan</h3>
                <Link to="/players" className="inline-flex items-center gap-2 text-brand-primary font-semibold hover:underline">
                    <ArrowLeft className="w-4 h-4" />
                    <span>Kembali ke Pemain</span>
                </Link>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-dark-800 pb-6">
                <div className="flex items-center gap-4">
                    <Link
                        to="/players"
                        className="p-2 rounded-xl bg-dark-900 border border-dark-800 hover:bg-dark-800 text-slate-300 hover:text-white transition-all"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div className="flex items-center gap-4">
                        {/* Player Avatar */}
                        <div className={`w-16 h-16 rounded-2xl bg-gradient-to-tr ${getAvatarColor(player.name)} flex items-center justify-center shadow-lg shadow-black/25 text-white font-bold text-2xl tracking-wide uppercase relative overflow-hidden`}>
                            <span className="z-0">{player.name.substring(0, 2)}</span>
                            <img
                                src={getJomokAvatar(player.id)}
                                alt={player.name}
                                className="absolute inset-0 w-full h-full object-cover z-10"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).remove();
                                }}
                            />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold font-sans text-white tracking-tight">{player.name}</h2>
                            <p className="text-sm text-slate-400 mt-1 flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                                <span>Bergabung {new Date(player.created_at).toLocaleDateString('id-ID', { dateStyle: 'long' })}</span>
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="glass-card p-5 rounded-2xl border border-dark-800 text-center">
                    <div className="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center mx-auto mb-3">
                        <Target className="w-5 h-5 text-brand-primary" />
                    </div>
                    <div className="text-3xl font-bold text-white">{stats?.matchesPlayed || 0}</div>
                    <div className="text-xs text-slate-400 font-medium uppercase tracking-wider mt-1">Pertandingan</div>
                </div>

                <div className="glass-card p-5 rounded-2xl border border-dark-800 text-center">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
                        <Trophy className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div className="text-3xl font-bold text-emerald-400">{stats?.wins || 0}</div>
                    <div className="text-xs text-slate-400 font-medium uppercase tracking-wider mt-1">Menang</div>
                </div>

                <div className="glass-card p-5 rounded-2xl border border-dark-800 text-center">
                    <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center mx-auto mb-3">
                        <BarChart3 className="w-5 h-5 text-rose-400" />
                    </div>
                    <div className="text-3xl font-bold text-rose-400">{stats?.losses || 0}</div>
                    <div className="text-xs text-slate-400 font-medium uppercase tracking-wider mt-1">Kalah</div>
                </div>

                <div className="glass-card p-5 rounded-2xl border border-dark-800 text-center">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center mx-auto mb-3">
                        <TrendingUp className="w-5 h-5 text-amber-400" />
                    </div>
                    <div className="text-3xl font-bold text-amber-400">{stats?.winRatePercent || 0}%</div>
                    <div className="text-xs text-slate-400 font-medium uppercase tracking-wider mt-1">Win Rate</div>
                </div>
            </div>

            {/* Additional Stats */}
            {stats && stats.matchesPlayed > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="glass-card p-5 rounded-2xl border border-dark-800">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-400">Poin Dimenangkan</span>
                            <span className="text-xl font-bold text-indigo-400">{stats.pointsWon}</span>
                        </div>
                    </div>
                    <div className="glass-card p-5 rounded-2xl border border-dark-800">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-400">Poin Dikalahkan</span>
                            <span className="text-xl font-bold text-slate-300">{stats.pointsLost}</span>
                        </div>
                    </div>
                    <div className="glass-card p-5 rounded-2xl border border-dark-800">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-400">Selisih Poin</span>
                            <span className={`text-xl font-bold ${stats.pointDiff >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {stats.pointDiff >= 0 ? `+${stats.pointDiff}` : stats.pointDiff}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* Form Guide */}
            {stats && stats.form.length > 0 && (
                <div className="glass-card p-5 rounded-2xl border border-dark-800">
                    <h3 className="font-bold text-sm text-slate-300 mb-3 flex items-center gap-2">
                        <Award className="w-4 h-4 text-brand-secondary" />
                        Form Guide (5 Pertandingan Terakhir)
                    </h3>
                    <div className="flex items-center gap-2">
                        {stats.form.map((result, idx) => (
                            <div
                                key={idx}
                                className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${result === 'W'
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                    }`}
                            >
                                {result}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Match History */}
            <div className="glass-panel p-6 rounded-2xl border border-dark-800 space-y-4">
                <div className="flex items-center justify-between border-b border-dark-800 pb-4">
                    <h3 className="font-bold text-lg text-white flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-brand-primary" />
                        Riwayat Pertandingan
                    </h3>
                    <span className="text-xs text-slate-500 font-medium">{matchHistory.length} pertandingan</span>
                </div>

                {loadingHistory ? (
                    <div className="text-center py-12">
                        <div className="w-8 h-8 border-4 border-brand-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                        <p className="text-slate-400">Memuat riwayat...</p>
                    </div>
                ) : matchHistory.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                        <span className="text-4xl">🏸</span>
                        <p className="mt-2">Belum ada riwayat pertandingan</p>
                    </div>
                ) : (
                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                        {matchHistory.map((match) => (
                            <Link
                                key={match.id}
                                to={`/tournaments/${match.tournamentId}`}
                                className="block p-4 bg-dark-900/50 border border-dark-800 rounded-xl hover:bg-dark-800/50 hover:border-dark-700 transition-all"
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-semibold text-white text-sm">{match.tournamentName}</span>
                                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${match.result === 'W'
                                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                        : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                                        }`}>
                                        {match.result === 'W' ? 'Menang' : 'Kalah'}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-xs text-slate-400">
                                    <div className="flex items-center gap-2">
                                        <span className="text-slate-500">vs</span>
                                        <span>{match.opponentNames}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-slate-300 font-semibold text-sm">
                                            {match.setScores && match.setScores.length > 0 ? (
                                                <span className="flex items-center gap-1.5">
                                                    {match.setScores.map((s: any, idx: number) => (
                                                        <span key={idx} className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${(match.result === 'W' && s.team1 > s.team2) || (match.result !== 'W' && s.team2 > s.team1)
                                                                ? 'bg-emerald-500/15 text-emerald-300'
                                                                : 'bg-rose-500/15 text-rose-300'
                                                            }`}>
                                                            {s.team1}-{s.team2}
                                                        </span>
                                                    ))}
                                                </span>
                                            ) : (
                                                <span>{match.score}</span>
                                            )}
                                        </span>
                                        <span>{new Date(match.tournamentDate).toLocaleDateString('id-ID', { dateStyle: 'short' })}</span>
                                    </div>
                                </div>
                                {match.partnerName !== 'Solo' && (
                                    <div className="text-xs text-brand-secondary mt-1.5">
                                        Berpasangan dengan: {match.partnerName}
                                    </div>
                                )}
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
