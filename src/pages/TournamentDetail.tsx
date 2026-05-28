import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  useTournament,
  useMatches,
  useUpdateMatchScore,
  usePlayers
} from '../hooks/useQueries';
import { Trophy, ArrowLeft, Edit3, Calendar, Award, Info, AlertTriangle } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useQueryClient } from '@tanstack/react-query';
import { db } from '../lib/supabase';

export const TournamentDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const tournamentId = id || '';
  
  const { data: tournament, isLoading: loadingTournament } = useTournament(tournamentId);
  const { data: matches = [], isLoading: loadingMatches } = useMatches(tournamentId);
  const { data: players = [] } = usePlayers();
  const updateMatchScoreMutation = useUpdateMatchScore();
  const queryClient = useQueryClient();

  // Score modal states
  const [selectedMatch, setSelectedMatch] = useState<any | null>(null);
  const [score1, setScore1] = useState<string>('');
  const [score2, setScore2] = useState<string>('');
  const [modalError, setModalError] = useState<string | null>(null);

  // Trigger confetti if tournament status changes to completed
  useEffect(() => {
    if (tournament && tournament.status === 'completed' && tournament.winner_team_ids) {
      // Fire confetti twice for extra premium effect
      confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.6 }
      });
      setTimeout(() => {
        confetti({
          particleCount: 80,
          angle: 60,
          spread: 55,
          origin: { x: 0 }
        });
        confetti({
          particleCount: 80,
          angle: 120,
          spread: 55,
          origin: { x: 1 }
        });
      }, 300);
    }
  }, [tournament?.status]);

  if (loadingTournament || loadingMatches) {
    return (
      <div className="text-center py-20">
        <div className="w-10 h-10 border-4 border-brand-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-400">Memuat bagan turnamen...</p>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="text-center py-16 space-y-4">
        <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto" />
        <h3 className="font-bold text-xl text-slate-300">Turnamen tidak ditemukan</h3>
        <Link to="/tournaments" className="inline-flex items-center gap-2 text-brand-primary font-semibold hover:underline">
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Turnamen</span>
        </Link>
      </div>
    );
  }

  const getPlayerName = (pId: string) => {
    if (pId === 'ghost') return '👻 GHOST';
    return players.find((p) => p.id === pId)?.name || 'Tidak Diketahui';
  };

  const getTeamNames = (teamIds: string[]) => {
    if (!teamIds || teamIds.length === 0) return 'Menunggu...';
    return teamIds.map((id) => getPlayerName(id)).join(' & ');
  };

  const handleOpenScoreModal = (match: any) => {
    // Cannot play matches that don't have teams filled yet
    if (!match.team1_ids.length || !match.team2_ids.length) return;

    setSelectedMatch(match);
    setScore1(match.score1 !== null ? String(match.score1) : '');
    setScore2(match.score2 !== null ? String(match.score2) : '');
    setModalError(null);
  };

  const handleSaveScore = async () => {
    if (!selectedMatch) return;
    const s1 = parseInt(score1);
    const s2 = parseInt(score2);

    if (isNaN(s1) || isNaN(s2) || s1 < 0 || s2 < 0) {
      setModalError('Silakan masukkan skor non-negatif yang valid');
      return;
    }

    if (s1 === s2) {
      setModalError('Pertandingan bulu tangkis tidak bisa berakhir seri');
      return;
    }

    const winner: 1 | 2 = s1 > s2 ? 1 : 2;

    try {
      await updateMatchScoreMutation.mutateAsync({
        tournamentId,
        match: selectedMatch,
        score1: s1,
        score2: s2,
        winner,
      });
      setSelectedMatch(null);
    } catch (err: any) {
      setModalError(err.message || 'Gagal memperbarui skor');
    }
  };

  const handleSwapPlayer = async (teamNum: 1 | 2, playerIndex: number, newPlayerId: string) => {
    if (!selectedMatch) return;
    
    let updatedTeam1 = [...selectedMatch.team1_ids];
    let updatedTeam2 = [...selectedMatch.team2_ids];
    
    if (teamNum === 1) {
      updatedTeam1[playerIndex] = newPlayerId;
    } else {
      updatedTeam2[playerIndex] = newPlayerId;
    }

    try {
      await db.updateMatchTeams(selectedMatch.id, updatedTeam1, updatedTeam2);
      setSelectedMatch({
        ...selectedMatch,
        team1_ids: updatedTeam1,
        team2_ids: updatedTeam2,
      });
      queryClient.invalidateQueries({ queryKey: ['matches', tournamentId] });
    } catch (err: any) {
      alert(err.message || 'Gagal mengganti pemain');
    }
  };

  // Math setup for drawing the bracket tree
  const maxRound = Math.max(...matches.map((m) => m.round), 1);
  const cardWidth = 260;
  const colSpacing = 80;
  const cardHeight = 110;
  const cardSpacing = 40;
  
  // Height of the leaf column (Round 1)
  const numMatchesRound1 = Math.pow(2, maxRound - 1);
  const totalHeight = numMatchesRound1 * cardHeight + (numMatchesRound1 - 1) * cardSpacing;
  const totalWidth = maxRound * cardWidth + (maxRound - 1) * colSpacing;

  // Cache of node Y positions
  const nodeYCache = new Map<string, number>();

  const getCoords = (round: number, index: number) => {
    const x = (round - 1) * (cardWidth + colSpacing);
    const cacheKey = `${round}_${index}`;
    
    if (nodeYCache.has(cacheKey)) {
      return { x, y: nodeYCache.get(cacheKey)! };
    }

    let y = 0;
    if (round === 1) {
      y = index * (cardHeight + cardSpacing);
    } else {
      // average of children coordinates in previous round
      const child1 = getCoords(round - 1, index * 2);
      const child2 = getCoords(round - 1, index * 2 + 1);
      y = (child1.y + child2.y) / 2;
    }

    nodeYCache.set(cacheKey, y);
    return { x, y };
  };

  // Pre-calculate positions for all matches
  const positionedMatches = matches.map((match) => {
    const coords = getCoords(match.round, match.match_index);
    return {
      ...match,
      x: coords.x,
      y: coords.y,
    };
  });

  return (
    <div className="space-y-6">
      {/* Back nav & summary */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-dark-800 pb-5">
        <div className="flex items-center gap-3">
          <Link
            to="/tournaments"
            className="p-2 rounded-xl bg-dark-900 border border-dark-800 hover:bg-dark-800 text-slate-300 hover:text-white transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h2 className="text-2xl font-bold font-sans text-white tracking-tight flex items-center gap-2">
              {tournament.name}
              {tournament.status === 'completed' && <Trophy className="w-5 h-5 text-amber-400 fill-amber-400/20" />}
            </h2>
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5 font-medium">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>{new Date(tournament.date).toLocaleDateString('id-ID', { dateStyle: 'long' })}</span>
              <span>•</span>
              <span>Format {tournament.format === 'double' ? 'Ganda Putra (MD)' : 'Tunggal'}</span>
            </p>
          </div>
        </div>

        {tournament.status === 'completed' && tournament.winner_team_ids && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 px-5 py-3 rounded-2xl flex items-center gap-3 max-w-sm">
            <Award className="w-6 h-6 text-emerald-400 animate-bounce flex-shrink-0" />
            <div className="min-w-0">
              <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Juara Turnamen</span>
              <h4 className="text-sm font-bold text-slate-100 truncate">{getTeamNames(tournament.winner_team_ids)}</h4>
            </div>
          </div>
        )}
      </div>

      {/* Guide Banner */}
      <div className="p-3 bg-dark-900/60 border border-dark-800 rounded-xl flex items-start gap-2.5 text-xs text-slate-400">
        <Info className="w-4.5 h-4.5 text-brand-primary mt-0.5 flex-shrink-0" />
        <span>
          <strong>Cara memperbarui skor:</strong> Klik pada kotak pertandingan yang aktif untuk memasukkan skor. Pemenang secara otomatis akan melaju ke babak berikutnya. Bye akan diproses secara otomatis.
        </span>
      </div>

      {/* Bracket Canvas Area */}
      <div className="w-full overflow-x-auto py-8 px-4 glass-panel rounded-2xl border border-dark-800/80">
        <div
          className="relative mx-auto select-none"
          style={{ width: `${totalWidth}px`, height: `${totalHeight}px` }}
        >
          {/* SVG Connector Lines */}
          <svg
            className="absolute inset-0 pointer-events-none z-0"
            style={{ width: `${totalWidth}px`, height: `${totalHeight}px` }}
          >
            {positionedMatches.map((match) => {
              if (!match.next_match_id) return null;
              
              // Find parent coords
              const parentMatch = positionedMatches.find((m) => m.id === match.next_match_id);
              if (!parentMatch) return null;

              const x1 = match.x + cardWidth;
              const y1 = match.y + cardHeight / 2;
              
              const x2 = parentMatch.x;
              const y2 = parentMatch.y + cardHeight / 2;
              
              const xMid = (x1 + x2) / 2;

              // Highlight line if match is played and its winner is going to the next match
              const nextTeamFilled = match.next_match_is_team2
                ? parentMatch.team2_ids.length > 0
                : parentMatch.team1_ids.length > 0;
              const isLineActive = match.winner !== null && nextTeamFilled;

              return (
                <path
                  key={`line-${match.id}`}
                  d={`M ${x1} ${y1} H ${xMid} V ${y2} H ${x2}`}
                  className={isLineActive ? 'bracket-line-active' : 'bracket-line'}
                />
              );
            })}
          </svg>

          {/* Match Nodes */}
          {positionedMatches.map((match) => {
            const isTeam1Bye = match.round === 1 && match.team1_ids.length === 0 && match.team2_ids.length > 0;
            const isTeam2Bye = match.round === 1 && match.team2_ids.length === 0 && match.team1_ids.length > 0;
            const hasTeams = match.team1_ids.length > 0 && match.team2_ids.length > 0;
            
            // Check active state
            const isClickable = hasTeams;

            return (
              <div
                key={match.id}
                onClick={() => isClickable && handleOpenScoreModal(match)}
                className={`absolute glass-card rounded-xl p-3 flex flex-col justify-between shadow-md transition-all duration-300 z-10 ${
                  isClickable 
                    ? 'cursor-pointer hover:scale-102 hover:shadow-lg' 
                    : 'opacity-85'
                }`}
                style={{
                  width: `${cardWidth}px`,
                  height: `${cardHeight}px`,
                  left: `${match.x}px`,
                  top: `${match.y}px`,
                }}
              >
                {/* Match Header / Round Badge */}
                <div className="flex justify-between items-center text-[9px] font-bold text-slate-500 uppercase tracking-widest border-b border-dark-800/40 pb-1.5 mb-1.5">
                  <span>Pertandingan {match.match_index + 1}</span>
                  <span className="text-brand-primary">
                    {match.round === maxRound ? 'Final' : match.round === maxRound - 1 ? 'Semifinal' : `Babak ${match.round}`}
                  </span>
                </div>

                {/* Team 1 Row */}
                <div className={`flex items-center justify-between text-xs py-1 rounded px-1.5 ${
                  match.winner === 1 
                    ? 'bg-emerald-500/5 text-emerald-300 border border-emerald-500/10 font-bold' 
                    : match.winner === 2 
                    ? 'text-slate-500 line-through' 
                    : 'text-slate-300'
                }`}>
                  <span className="truncate max-w-[190px]">
                    {isTeam1Bye 
                      ? 'BYE (Lolos)' 
                      : (match.team1_ids.length > 0 ? getTeamNames(match.team1_ids) : 'Menunggu...')}
                  </span>
                  <span className="font-bold text-sm">
                    {match.score1 !== null ? match.score1 : '-'}
                  </span>
                </div>

                {/* Team 2 Row */}
                <div className={`flex items-center justify-between text-xs py-1 rounded px-1.5 ${
                  match.winner === 2 
                    ? 'bg-emerald-500/5 text-emerald-300 border border-emerald-500/10 font-bold' 
                    : match.winner === 1 
                    ? 'text-slate-500 line-through' 
                    : 'text-slate-300'
                }`}>
                  <span className="truncate max-w-[190px]">
                    {isTeam2Bye 
                      ? 'BYE (Lolos)' 
                      : (match.team2_ids.length > 0 ? getTeamNames(match.team2_ids) : 'Menunggu...')}
                  </span>
                  <span className="font-bold text-sm">
                    {match.score2 !== null ? match.score2 : '-'}
                  </span>
                </div>

                {/* Action Trigger hint */}
                {isClickable && (
                  <div className="absolute right-2.5 top-2 opacity-0 hover:opacity-100 group-hover:opacity-100 text-brand-secondary">
                    <Edit3 className="w-3 h-3" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Score Modal */}
      {selectedMatch && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="glass-panel max-w-md w-full p-6 rounded-2xl border border-dark-800 space-y-6 animate-scale-in">
            {/* Header */}
            <div className="border-b border-dark-800 pb-3">
              <h3 className="font-bold text-lg text-white">Masukkan Skor Pertandingan</h3>
              <p className="text-xs text-slate-400 mt-0.5">Babak {selectedMatch.round} • Pertandingan {selectedMatch.match_index + 1}</p>
            </div>

            {/* Inputs */}
            <div className="space-y-4 py-2">
              {/* Team 1 Score Input */}
              <div className="flex items-center justify-between gap-4 p-3 bg-dark-950/40 border border-dark-800 rounded-xl">
                <span className="text-sm font-semibold truncate flex-1">{getTeamNames(selectedMatch.team1_ids)}</span>
                <input
                  type="number"
                  value={score1}
                  onChange={(e) => setScore1(e.target.value)}
                  placeholder="0"
                  min="0"
                  max="50"
                  className="w-16 glass-input py-1.5 text-center font-bold text-lg"
                />
              </div>

              {/* Team 2 Score Input */}
              <div className="flex items-center justify-between gap-4 p-3 bg-dark-950/40 border border-dark-800 rounded-xl">
                <span className="text-sm font-semibold truncate flex-1">{getTeamNames(selectedMatch.team2_ids)}</span>
                <input
                  type="number"
                  value={score2}
                  onChange={(e) => setScore2(e.target.value)}
                  placeholder="0"
                  min="0"
                  max="50"
                  className="w-16 glass-input py-1.5 text-center font-bold text-lg"
                />
              </div>
            </div>

            {/* Substitution editor */}
            <div className="space-y-3 pt-3 border-t border-dark-800/80">
              <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                👥 Sesuaikan Formasi / Pergantian Pemain
              </h4>
              
              <div className="space-y-3 text-xs bg-dark-950/20 p-3 rounded-xl border border-dark-800/40">
                {/* Team 1 Players */}
                <div className="space-y-1.5">
                  <span className="font-bold text-[10px] text-brand-primary block uppercase">Formasi Tim 1:</span>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedMatch.team1_ids.map((pId: string, idx: number) => (
                      <select
                        key={`team1-sub-${idx}`}
                        value={pId}
                        onChange={(e) => handleSwapPlayer(1, idx, e.target.value)}
                        className="glass-input bg-dark-900 py-1 px-2 text-xs"
                      >
                        {players.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    ))}
                  </div>
                </div>

                {/* Team 2 Players */}
                <div className="space-y-1.5">
                  <span className="font-bold text-[10px] text-brand-secondary block uppercase">Formasi Tim 2:</span>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedMatch.team2_ids.map((pId: string, idx: number) => (
                      <select
                        key={`team2-sub-${idx}`}
                        value={pId}
                        onChange={(e) => handleSwapPlayer(2, idx, e.target.value)}
                        className="glass-input bg-dark-900 py-1 px-2 text-xs"
                      >
                        {players.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {modalError && (
              <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-xl text-center">
                {modalError}
              </p>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 justify-end pt-3 border-t border-dark-800">
              <button
                onClick={() => setSelectedMatch(null)}
                className="glass-btn px-4 py-2.5 rounded-xl text-xs"
              >
                Batal
              </button>
              <button
                onClick={handleSaveScore}
                className="px-5 py-2.5 rounded-xl gradient-btn text-xs font-bold"
              >
                Simpan Skor
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
