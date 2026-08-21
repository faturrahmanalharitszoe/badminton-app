import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  useTournament,
  useMatches,
  useUpdateMatchScore,
  usePlayers,
  useAddTeamToTournament,
  useDeleteTournament,
  useAddPlayer,
  useSetTournamentStatus,
  useUpdateLeagueTeam
} from '../hooks/useQueries';
import { Trophy, ArrowLeft, Edit3, Calendar, Award, Info, AlertTriangle, Users, Trash2, UserPlus, X, Lock, Unlock, Table2, Swords, BarChart3, GitBranch, Pencil, Shuffle } from 'lucide-react';
import { computeLeagueStandings } from '../hooks/useQueries';
import confetti from 'canvas-confetti';
import { useQueryClient } from '@tanstack/react-query';
import { db } from '../lib/supabase';
import type { Match } from '../lib/supabase';
import { getAvatarColor, getJomokAvatar } from '../lib/avatar';

export const TournamentDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const tournamentId = id || '';

  const { data: tournament, isLoading: loadingTournament } = useTournament(tournamentId);
  const { data: matches = [], isLoading: loadingMatches } = useMatches(tournamentId);
  const { data: players = [] } = usePlayers();
  const updateMatchScoreMutation = useUpdateMatchScore();
  const addTeamMutation = useAddTeamToTournament();
  const deleteTournamentMutation = useDeleteTournament();
  const addPlayerMutation = useAddPlayer();
  const setStatusMutation = useSetTournamentStatus();
  const updateLeagueTeamMutation = useUpdateLeagueTeam();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Score modal states
  const [selectedMatch, setSelectedMatch] = useState<any | null>(null);
  const [sets, setSets] = useState<{ t1: string; t2: string }[]>([{ t1: '', t2: '' }]);
  const [modalError, setModalError] = useState<string | null>(null);

  // Fill-bye (add new team) modal states
  const [fillOpen, setFillOpen] = useState(false);
  const [fillMatch, setFillMatch] = useState<Match | null>(null);
  const [fillSlot, setFillSlot] = useState<'team1' | 'team2'>('team1');
  const [fillSelectedIds, setFillSelectedIds] = useState<string[]>([]);
  const [fillNewPlayerName, setFillNewPlayerName] = useState('');
  const [fillError, setFillError] = useState<string | null>(null);

  // Edit team (ganti pasangan) modal states — liga only
  const [editTeamOpen, setEditTeamOpen] = useState(false);
  const [editOldTeamIds, setEditOldTeamIds] = useState<string[]>([]);
  const [editSelectedIds, setEditSelectedIds] = useState<string[]>([]);
  const [editNewPlayerName, setEditNewPlayerName] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  // Player lookup map - must be before conditional returns (Rules of Hooks)
  const playerLookup = useMemo(() => {
    const map = new Map<string, string>();
    players.forEach((p) => {
      map.set(p.id, p.name);
    });
    return map;
  }, [players]);

  const getPlayerName = useCallback((pId: string) => {
    if (pId === 'ghost') return '👻 GHOST';
    return playerLookup.get(pId) || 'Tidak Diketahui';
  }, [playerLookup]);

  const getTeamNames = useCallback((teamIds: string[]) => {
    if (!teamIds || teamIds.length === 0) return 'Menunggu...';
    return teamIds.map((id) => getPlayerName(id)).join(' & ');
  }, [getPlayerName]);

  // First empty slot of a match (fully-empty matches are fillable too).
  const getEmptySlot = useCallback((match: Match): 'team1' | 'team2' | null => {
    const t1Empty = !match.team1_ids || match.team1_ids.length === 0;
    const t2Empty = !match.team2_ids || match.team2_ids.length === 0;
    if (t1Empty) return 'team1';
    if (t2Empty) return 'team2';
    return null;
  }, []);

  // Player ids already participating in this tournament (so we can't duplicate them).
  const tournamentPlayerIds = useMemo(() => {
    const s = new Set<string>();
    matches.forEach((m) => {
      (m.team1_ids || []).forEach((id) => id !== 'ghost' && s.add(id));
      (m.team2_ids || []).forEach((id) => id !== 'ghost' && s.add(id));
    });
    return s;
  }, [matches]);

  const isLeague = (tournament as any)?.mode === 'league';

  const leagueStandings = useMemo(() => {
    if (!isLeague) return [];
    return computeLeagueStandings(matches);
  }, [matches, isLeague]);

  const leagueProgress = useMemo(() => {
    const total = matches.length;
    const done = matches.filter((m) => m.winner !== null).length;
    return { total, done, pct: total ? Math.round((done / total) * 100) : 0 };
  }, [matches]);

  const handleOpenFillModal = (match: Match) => {
    const slot = getEmptySlot(match);
    if (!slot) return;
    setFillMatch(match);
    setFillSlot(slot);
    setFillSelectedIds([]);
    setFillNewPlayerName('');
    setFillError(null);
    setFillOpen(true);
  };

  const handleAddTeamButton = () => {
    setFillMatch(null);
    setFillSlot('team1');
    setFillSelectedIds([]);
    setFillNewPlayerName('');
    setFillError(null);
    setFillOpen(true);
  };

  const toggleFillPlayer = (pId: string) => {
    setFillSelectedIds((prev) => {
      if (prev.includes(pId)) return prev.filter((id) => id !== pId);
      if (tournament?.format === 'double') {
        if (prev.length >= 2) return prev;
        return [...prev, pId];
      }
      return [pId];
    });
  };

  const handleCreateFillPlayer = async () => {
    const name = fillNewPlayerName.trim();
    if (name.length < 2) {
      setFillError('Nama pemain minimal 2 karakter');
      return;
    }
    try {
      const player = await addPlayerMutation.mutateAsync(name);
      setFillNewPlayerName('');
      setFillSelectedIds((prev) => {
        if (tournament?.format === 'double') {
          if (prev.length >= 2) return prev;
          return [...prev, player.id];
        }
        return [player.id];
      });
      setFillError(null);
    } catch (err: any) {
      setFillError(err.message || 'Gagal menambahkan pemain');
    }
  };

  const handleSubmitFill = async () => {
    const needed = tournament?.format === 'double' ? 2 : 1;
    const teamIds = [...fillSelectedIds];
    if (teamIds.length !== needed) {
      setFillError(tournament?.format === 'double' ? 'Pilih 2 pemain untuk membentuk tim ganda (wajib pilih 2, tidak diacak otomatis).' : 'Pilih 1 pemain untuk tim tunggal.');
      return;
    }
    try {
      const result = await addTeamMutation.mutateAsync({
        tournamentId,
        matchId: fillMatch ? fillMatch.id : null,
        teamIds,
      });
      setFillOpen(false);
      setFillMatch(null);
      setFillSelectedIds([]);
      setFillError(null);
      if (result.expanded) {
        alert('Bagan diperluas: tim baru ditempatkan di babak tambahan.');
      }
    } catch (err: any) {
      setFillError(err.message || 'Gagal menambahkan pemain');
    }
  };

  // ── Ganti pasangan (liga) handlers ──
  const handleOpenEditTeam = (teamIds: string[]) => {
    setEditOldTeamIds([...teamIds]);
    setEditSelectedIds([...teamIds]);
    setEditNewPlayerName('');
    setEditError(null);
    setEditTeamOpen(true);
  };
  const toggleEditPlayer = (pId: string) => {
    setEditSelectedIds((prev) => {
      if (prev.includes(pId)) return prev.filter((id) => id !== pId);
      if (tournament?.format === 'double') {
        if (prev.length >= 2) return prev;
        return [...prev, pId];
      }
      return [pId];
    });
  };
  const handleCreateEditPlayer = async () => {
    const name = editNewPlayerName.trim();
    if (name.length < 2) { setEditError('Nama pemain minimal 2 karakter'); return; }
    try {
      const player = await addPlayerMutation.mutateAsync(name);
      setEditNewPlayerName('');
      setEditSelectedIds((prev) => {
        if (tournament?.format === 'double') {
          if (prev.length >= 2) return prev;
          return [...prev, player.id];
        }
        return [player.id];
      });
      setEditError(null);
    } catch (err: any) { setEditError(err.message || 'Gagal menambahkan pemain'); }
  };
  const shuffleEditTeam = () => {
    const available = players.filter((p) => {
      // boleh pakai pemain baru yang belum di turnamen, atau anggota tim lama
      const isInOtherTeam = tournamentPlayerIds.has(p.id) && !editOldTeamIds.includes(p.id);
      return !isInOtherTeam;
    });
    // simple: pick 2 random from available excluding current selection? just random 2
    const shuffled = [...available].sort(() => Math.random() - 0.5);
    const needed = tournament?.format === 'double' ? 2 : 1;
    setEditSelectedIds(shuffled.slice(0, needed).map((p) => p.id));
  };
  const handleSubmitEditTeam = async () => {
    const needed = tournament?.format === 'double' ? 2 : 1;
    if (editSelectedIds.length !== needed) {
      setEditError(needed === 2 ? 'Wajib pilih 2 pemain untuk ganda.' : 'Wajib pilih 1 pemain.');
      return;
    }
    try {
      await updateLeagueTeamMutation.mutateAsync({ tournamentId, oldTeamIds: editOldTeamIds, newTeamIds: editSelectedIds });
      setEditTeamOpen(false);
      setEditOldTeamIds([]);
      setEditSelectedIds([]);
      setEditError(null);
    } catch (err: any) { setEditError(err.message || 'Gagal mengganti pasangan'); }
  };

  const handleDeleteTournament = async () => {
    if (!tournament) return;
    if (window.confirm(`Apakah Anda yakin ingin menghapus turnamen "${tournament.name}"? Ini akan menghapus semua pertandingan dan skor terkait secara permanen.`)) {
      try {
        await deleteTournamentMutation.mutateAsync(tournament.id);
        navigate('/tournaments');
      } catch (err: any) {
        alert(err.message || 'Gagal menghapus turnamen');
      }
    }
  };

  const handleCloseTournament = async () => {
    if (!tournament) return;
    if (window.confirm(`Tutup turnamen "${tournament.name}" sekarang? Pertandingan yang sudah dimainkan tetap dihitung, tetapi sisa pertandingan tidak akan dimainkan dan tidak ada juara yang ditentukan.`)) {
      try {
        await setStatusMutation.mutateAsync({ id: tournament.id, status: 'completed' });
      } catch (err: any) {
        alert(err.message || 'Gagal menutup turnamen');
      }
    }
  };

  const handleReopenTournament = async () => {
    if (!tournament) return;
    if (window.confirm(`Buka kembali turnamen "${tournament.name}"? Anda bisa melanjutkan pertandingan yang tersisa.`)) {
      try {
        await setStatusMutation.mutateAsync({ id: tournament.id, status: 'active' });
      } catch (err: any) {
        alert(err.message || 'Gagal membuka kembali turnamen');
      }
    }
  };

  // Helper component to render player avatar with name
  const PlayerAvatarWithName = useCallback(({ pId, showName = true }: { pId: string; showName?: boolean }) => {
    if (pId === 'ghost') {
      return <span className="text-slate-400">👻 GHOST</span>;
    }
    const name = playerLookup.get(pId) || 'Tidak Diketahui';
    return (
      <Link
        to={`/players/${pId}`}
        className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`w-5 h-5 rounded-md bg-gradient-to-tr ${getAvatarColor(name)} flex items-center justify-center text-white text-[8px] font-bold uppercase relative overflow-hidden flex-shrink-0`}
        >
          <span className="z-0">{name.substring(0, 1)}</span>
          <img
            src={getJomokAvatar(pId)}
            alt={name}
            className="absolute inset-0 w-full h-full object-cover z-10"
            onError={(e) => {
              (e.target as HTMLImageElement).remove();
            }}
          />
        </div>
        {showName && <span className="truncate">{name}</span>}
      </Link>
    );
  }, [playerLookup]);

  // Helper component to render team with avatars
  const TeamDisplay = useCallback(({ teamIds, isWinner, isLoser }: { teamIds: string[]; isWinner?: boolean; isLoser?: boolean }) => {
    if (!teamIds || teamIds.length === 0) {
      return <span className="text-slate-500 italic">Menunggu...</span>;
    }
    return (
      <div className={`flex items-center gap-1 flex-wrap ${isWinner ? 'text-emerald-300' : isLoser ? 'text-slate-500 line-through' : 'text-slate-300'}`}>
        {teamIds.map((pId, idx) => (
          <React.Fragment key={pId}>
            <PlayerAvatarWithName pId={pId} />
            {idx < teamIds.length - 1 && <span className="text-slate-500">&</span>}
          </React.Fragment>
        ))}
      </div>
    );
  }, [PlayerAvatarWithName]);

  // Math setup for drawing the bracket tree - MUST be before conditional returns (Rules of Hooks)
  const cardWidth = 260;
  const colSpacing = 80;
  const cardHeight = 110;
  const cardSpacing = 40;

  const { positionedMatches, totalWidth, totalHeight, maxRound } = useMemo(() => {
    if (matches.length === 0) {
      return { positionedMatches: [], totalWidth: 0, totalHeight: 0, maxRound: 1 };
    }
    const mRound = Math.max(...matches.map((m) => m.round), 1);

    // Height of the leaf column (Round 1)
    const numMatchesRound1 = Math.pow(2, mRound - 1);
    const tHeight = numMatchesRound1 * cardHeight + (numMatchesRound1 - 1) * cardSpacing;
    const tWidth = mRound * cardWidth + (mRound - 1) * colSpacing;

    // Cache of node Y positions
    const nodeYCache = new Map<string, number>();

    const getCoords = (round: number, index: number): { x: number; y: number } => {
      const x = (round - 1) * (cardWidth + colSpacing);
      const cacheKey = `${round}_${index}`;

      if (nodeYCache.has(cacheKey)) {
        return { x, y: nodeYCache.get(cacheKey)! };
      }

      let y = 0;
      if (round === 1) {
        y = index * (cardHeight + cardSpacing);
      } else {
        const child1 = getCoords(round - 1, index * 2);
        const child2 = getCoords(round - 1, index * 2 + 1);
        y = (child1.y + child2.y) / 2;
      }

      nodeYCache.set(cacheKey, y);
      return { x, y };
    };

    const positioned = matches.map((match) => {
      const coords = getCoords(match.round, match.match_index);
      return {
        ...match,
        x: coords.x,
        y: coords.y,
      };
    });

    return { positionedMatches: positioned, totalWidth: tWidth, totalHeight: tHeight, maxRound: mRound };
  }, [matches]);

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

  const handleOpenScoreModal = (match: any) => {
    if (!match.team1_ids.length || !match.team2_ids.length) return;

    setSelectedMatch(match);
    // Restore previous set scores if editing, otherwise start with 1 empty set
    if (match.set_scores && match.set_scores.length > 0) {
      setSets(match.set_scores.map((s: any) => ({ t1: String(s.team1), t2: String(s.team2) })));
    } else {
      setSets([{ t1: '', t2: '' }]);
    }
    setModalError(null);
  };

  const handleSaveScore = async () => {
    if (!selectedMatch) return;

    // Parse all set scores
    const parsed = sets.map((s) => ({ team1: parseInt(s.t1), team2: parseInt(s.t2) }));
    const valid = parsed.every((s) => !isNaN(s.team1) && !isNaN(s.team2) && s.team1 >= 0 && s.team2 >= 0);
    if (!valid) {
      setModalError('Silakan masukkan skor non-negatif yang valid untuk semua set');
      return;
    }

    // Each set must have a winner (no ties in badminton)
    const hasTie = parsed.some((s) => s.team1 === s.team2);
    if (hasTie) {
      setModalError('Setiap set tidak boleh seri');
      return;
    }

    // Best of 3: count sets won by each team
    let team1Sets = 0;
    let team2Sets = 0;
    parsed.forEach((s) => {
      if (s.team1 > s.team2) team1Sets++;
      else team2Sets++;
    });

    if (team1Sets === team2Sets) {
      setModalError('Pertandingan tidak boleh seri — isi cukup set untuk menentukan pemenang');
      return;
    }

    const winner: 1 | 2 = team1Sets > team2Sets ? 1 : 2;

    try {
      await updateMatchScoreMutation.mutateAsync({
        tournamentId,
        match: selectedMatch,
        score1: team1Sets,
        score2: team2Sets,
        winner,
        set_scores: parsed,
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
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5 font-medium flex-wrap">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>{new Date(tournament.date).toLocaleDateString('id-ID', { dateStyle: 'long' })}</span>
              <span>•</span>
              <span>Format {tournament.format === 'double' ? 'Ganda Putra (MD)' : 'Tunggal'}</span>
              <span>•</span>
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${isLeague ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-brand-primary/10 border-brand-primary/20 text-brand-primary'}`}>
                {isLeague ? <Table2 className="w-3 h-3" /> : <GitBranch className="w-3 h-3" />}
                {isLeague ? 'Liga • Round Robin' : 'Knockout • Sistem Gugur'}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {tournament.status === 'active' && (
            <>
              <button
                onClick={handleAddTeamButton}
                className="px-4 py-2.5 rounded-xl gradient-btn flex items-center gap-2 text-xs font-bold"
                title="Tambahkan pemain baru ke turnamen yang sedang berjalan"
              >
                <Users className="w-4 h-4" />
                <span>Tambah Pemain</span>
              </button>
              <button
                onClick={handleCloseTournament}
                className="px-4 py-2.5 rounded-xl glass-btn flex items-center gap-2 text-xs font-bold text-amber-300 border-amber-500/30 hover:bg-amber-500/10 hover:border-amber-500/50"
                title="Tutup turnamen lebih awal (pertandingan yang sudah dimainkan tetap dihitung)"
              >
                <Lock className="w-4 h-4" />
                <span>Tutup Turnamen</span>
              </button>
            </>
          )}
          {tournament.status === 'completed' && !tournament.winner_team_ids && (
            <button
              onClick={handleReopenTournament}
              className="px-4 py-2.5 rounded-xl glass-btn flex items-center gap-2 text-xs font-bold text-brand-primary border-brand-primary/30 hover:bg-brand-primary/10 hover:border-brand-primary/50"
              title="Buka kembali turnamen untuk melanjutkan pertandingan"
            >
              <Unlock className="w-4 h-4" />
              <span>Buka Kembali</span>
            </button>
          )}
          <button
            onClick={handleDeleteTournament}
            className="px-4 py-2.5 rounded-xl glass-btn flex items-center gap-2 text-xs font-bold text-rose-400 border-rose-500/30 hover:bg-rose-500/10 hover:border-rose-500/50"
            title="Hapus Turnamen"
          >
            <Trash2 className="w-4 h-4" />
            <span>Hapus</span>
          </button>
        </div>
      </div>

      {/* Winner banner (tournament finished normally) */}
      {tournament.status === 'completed' && tournament.winner_team_ids && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 px-5 py-3 rounded-2xl flex items-center gap-3 max-w-sm">
          <Award className="w-6 h-6 text-emerald-400 animate-bounce flex-shrink-0" />
          <div className="min-w-0">
            <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Juara Turnamen</span>
            <h4 className="text-sm font-bold text-slate-100 truncate">{getTeamNames(tournament.winner_team_ids)}</h4>
          </div>
        </div>
      )}

      {/* Closed-early note (tournament closed without a winner) */}
      {tournament.status === 'completed' && !tournament.winner_team_ids && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2.5 text-xs text-amber-300">
          <Lock className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
          <span>
            <strong>Turnamen ditutup lebih awal.</strong> Pertandingan yang sudah dimainkan tetap dihitung, sisa pertandingan tidak dimainkan, dan tidak ada juara yang ditentukan. Klik "Buka Kembali" untuk melanjutkan.
          </span>
        </div>
      )}

      {/* Guide Banner */}
      {tournament.status === 'active' && !isLeague && (
        <div className="p-3 bg-dark-900/60 border border-dark-800 rounded-xl flex items-start gap-2.5 text-xs text-slate-400">
          <Info className="w-4.5 h-4.5 text-brand-primary mt-0.5 flex-shrink-0" />
          <span>
            <strong>Cara memperbarui skor:</strong> Klik pada kotak pertandingan yang aktif untuk memasukkan skor. Pemenang secara otomatis akan melaju ke babak berikutnya. Kotak <strong>BYE</strong> yang putus-putus bisa diklik untuk mengisi tim baru (mis. teman yang datang telat).
          </span>
        </div>
      )}
      {tournament.status === 'active' && isLeague && (
        <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl flex items-start gap-2.5 text-xs text-slate-300">
          <Table2 className="w-4.5 h-4.5 text-emerald-400 mt-0.5 flex-shrink-0" />
          <span>
            <strong>Mode Liga:</strong> Klik kartu pertandingan untuk memasukkan skor. Klasemen di bawah akan ter-update otomatis (Menang = 3 poin). Semua tim bertemu satu kali — peringkat 1 jadi juara saat semua laga selesai.
            {leagueProgress.total > 0 && <span className="ml-1 text-emerald-300 font-bold">{leagueProgress.done}/{leagueProgress.total} laga selesai ({leagueProgress.pct}%)</span>}
          </span>
        </div>
      )}

      {/* ── LEAGUE VIEW ── */}
      {isLeague ? (
        <div className="space-y-6">
          {/* League standings */}
          <div className="glass-panel rounded-2xl border border-dark-800/80 overflow-hidden">
            <div className="p-5 border-b border-dark-800 flex items-center justify-between">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-emerald-400" />
                Klasemen Liga
              </h3>
              <span className="text-[11px] text-slate-400 font-medium">{leagueStandings.length} tim • {leagueProgress.done}/{leagueProgress.total} laga</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-dark-900/60 border-b border-dark-800 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <th className="py-3 px-4 text-center w-12">#</th>
                    <th className="py-3 px-4">Tim</th>
                    <th className="py-3 px-3 text-center">Main</th>
                    <th className="py-3 px-3 text-center">M</th>
                    <th className="py-3 px-3 text-center">K</th>
                    <th className="py-3 px-3 text-center">Poin</th>
                    <th className="py-3 px-3 text-center">Selisih</th>
                    {tournament.status === 'active' && <th className="py-3 px-3 text-center w-20">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-800/50">
                  {leagueStandings.length === 0 ? (
                    <tr><td colSpan={tournament.status === 'active' ? 8 : 7} className="py-8 text-center text-xs text-slate-500">Belum ada data klasemen</td></tr>
                  ) : leagueStandings.map((s, idx) => {
                    const isLeader = idx === 0 && s.played > 0;
                    const isCompletedLeague = leagueProgress.pct === 100;
                    return (
                      <tr key={s.teamKey} className={`${isLeader ? 'bg-emerald-500/5' : ''} hover:bg-dark-900/20 transition-colors`}>
                        <td className="py-3 px-4 text-center">
                          <span className={`w-6 h-6 rounded-full inline-flex items-center justify-center text-[11px] font-black ${idx === 0 ? 'bg-amber-400/15 text-amber-400 border border-amber-400/20' : idx === 1 ? 'bg-slate-400/10 text-slate-300 border border-slate-400/20' : idx === 2 ? 'bg-amber-700/10 text-amber-700 border border-amber-700/20' : 'text-slate-500'}`}>{idx + 1}</span>
                        </td>
                        <td className="py-3 px-4 font-semibold text-white text-xs">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <TeamDisplay teamIds={s.teamIds} />
                            {isLeader && isCompletedLeague && <span className="text-[9px] bg-emerald-500 text-white px-1.5 py-0.5 rounded-full font-bold">JUARA</span>}
                            {isLeader && !isCompletedLeague && <span className="text-[9px] bg-brand-primary/20 text-brand-primary border border-brand-primary/30 px-1.5 py-0.5 rounded-full font-bold">PEMIIMPIN</span>}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center text-xs font-bold text-slate-300">{s.played}</td>
                        <td className="py-3 px-3 text-center text-xs font-bold text-emerald-400">{s.wins}</td>
                        <td className="py-3 px-3 text-center text-xs font-bold text-rose-400">{s.losses}</td>
                        <td className="py-3 px-3 text-center"><span className={`px-2 py-1 rounded-lg text-xs font-black ${isLeader ? 'bg-emerald-500 text-white' : 'bg-dark-800 text-slate-300'}`}>{s.points}</span></td>
                        <td className={`py-3 px-3 text-center text-xs font-bold ${s.pointDiff > 0 ? 'text-indigo-400' : s.pointDiff < 0 ? 'text-rose-400' : 'text-slate-500'}`}>{s.pointDiff > 0 ? `+${s.pointDiff}` : s.pointDiff}</td>
                        {tournament.status === 'active' && (
                          <td className="py-3 px-3 text-center">
                            <button
                              onClick={() => handleOpenEditTeam(s.teamIds)}
                              className="px-2.5 py-1 rounded-lg glass-btn text-[11px] font-bold flex items-center gap-1 mx-auto hover:border-brand-primary"
                              title="Ganti pasangan"
                            >
                              <Pencil className="w-3 h-3" /> Ganti
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* League matches grid */}
          <div>
            <h3 className="font-bold text-sm flex items-center gap-2 mb-3">
              <Swords className="w-4 h-4 text-brand-primary" />
              Jadwal Pertandingan ({matches.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {matches
                .slice()
                .sort((a, b) => a.match_index - b.match_index)
                .map((match, idx) => {
                  const isActive = tournament.status === 'active';
                  const isClickable = isActive;
                  const hasScore = match.winner !== null;
                  return (
                    <div
                      key={match.id}
                      onClick={() => isClickable && handleOpenScoreModal(match)}
                      className={`glass-card rounded-xl p-4 flex flex-col gap-3 transition-all ${isClickable ? 'cursor-pointer hover:border-brand-primary/40 hover:shadow-lg' : ''} ${hasScore ? 'border-emerald-500/20 bg-emerald-500/[0.03]' : ''}`}
                    >
                      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-slate-500">
                        <span>Match {idx + 1}</span>
                        <span className={`px-2 py-0.5 rounded-full border text-[9px] ${hasScore ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'}`}>{hasScore ? 'Selesai' : 'Belum main'}</span>
                      </div>
                      <div className={`flex items-center justify-between p-2.5 rounded-xl border ${match.winner === 1 ? 'bg-emerald-500/10 border-emerald-500/20' : match.winner === 2 ? 'bg-dark-800/50 border-dark-800' : 'bg-dark-900/40 border-dark-800'}`}>
                        <div className={`text-xs font-medium ${match.winner === 1 ? 'text-emerald-300' : match.winner === 2 ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                          <TeamDisplay teamIds={match.team1_ids} isWinner={match.winner === 1} isLoser={match.winner === 2} />
                        </div>
                        <span className="font-black text-sm min-w-[28px] text-right">{match.set_scores ? match.set_scores.filter((s: any) => s.team1 > s.team2).length : (match.score1 ?? '-')}</span>
                      </div>
                      <div className="text-center text-[10px] text-slate-600 font-bold">VS</div>
                      <div className={`flex items-center justify-between p-2.5 rounded-xl border ${match.winner === 2 ? 'bg-emerald-500/10 border-emerald-500/20' : match.winner === 1 ? 'bg-dark-800/50 border-dark-800' : 'bg-dark-900/40 border-dark-800'}`}>
                        <div className={`text-xs font-medium ${match.winner === 2 ? 'text-emerald-300' : match.winner === 1 ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                          <TeamDisplay teamIds={match.team2_ids} isWinner={match.winner === 2} isLoser={match.winner === 1} />
                        </div>
                        <span className="font-black text-sm min-w-[28px] text-right">{match.set_scores ? match.set_scores.filter((s: any) => s.team2 > s.team1).length : (match.score2 ?? '-')}</span>
                      </div>
                      {match.set_scores && match.set_scores.length > 0 && (
                        <div className="flex flex-wrap gap-1 justify-center">
                          {match.set_scores.map((s: any, i: number) => (
                            <span key={i} className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${(match.winner === 1 && s.team1 > s.team2) || (match.winner === 2 && s.team2 > s.team1) ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'}`}>{s.team1}-{s.team2}</span>
                          ))}
                        </div>
                      )}
                      {isClickable && <div className="flex items-center justify-center gap-1 text-[10px] text-brand-primary font-semibold pt-1"><Edit3 className="w-3 h-3" /> Klik untuk isi/edit skor</div>}
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      ) : (
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
            const byeSlot = getEmptySlot(match);
            const isBye = byeSlot !== null;
            const isActive = tournament.status === 'active';

            // Check active state
            const isClickable = isActive && hasTeams;

            return (
              <div
                key={match.id}
                onClick={() => {
                  if (isClickable) {
                    handleOpenScoreModal(match);
                  } else if (isActive && isBye && match.round === 1) {
                    handleOpenFillModal(match);
                  }
                }}
                className={`absolute glass-card rounded-xl p-3 flex flex-col justify-between shadow-md transition-all duration-300 z-10 ${isClickable
                  ? 'cursor-pointer hover:scale-102 hover:shadow-lg'
                  : isBye && isActive
                    ? 'cursor-pointer border-dashed border-brand-primary/40 hover:border-brand-primary/80 bg-brand-primary/5'
                    : isBye
                      ? 'border-dashed border-dark-700/60 opacity-85'
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
                <div className={`flex items-center justify-between text-xs py-1 rounded px-1.5 ${match.winner === 1
                  ? 'bg-emerald-500/5 border border-emerald-500/10'
                  : match.winner === 2
                    ? 'text-slate-500'
                    : 'text-slate-300'
                  }`}>
                  <div className="truncate max-w-[190px]">
                    {isTeam1Bye ? (
                      <span className="text-slate-400 italic">BYE — klik untuk isi</span>
                    ) : (
                      <TeamDisplay
                        teamIds={match.team1_ids}
                        isWinner={match.winner === 1}
                        isLoser={match.winner === 2}
                      />
                    )}
                  </div>
                  <span className="font-bold text-sm flex-shrink-0 min-w-[24px] text-right">
                    {match.set_scores ? match.set_scores.filter((s: any) => s.team1 > s.team2).length : (match.score1 !== null ? match.score1 : '-')}
                  </span>
                </div>

                {/* Team 2 Row */}
                <div className={`flex items-center justify-between text-xs py-1 rounded px-1.5 ${match.winner === 2
                  ? 'bg-emerald-500/5 border border-emerald-500/10'
                  : match.winner === 1
                    ? 'text-slate-500'
                    : 'text-slate-300'
                  }`}>
                  <div className="truncate max-w-[190px]">
                    {isTeam2Bye ? (
                      <span className="text-slate-400 italic">BYE — klik untuk isi</span>
                    ) : (
                      <TeamDisplay
                        teamIds={match.team2_ids}
                        isWinner={match.winner === 2}
                        isLoser={match.winner === 1}
                      />
                    )}
                  </div>
                  <span className="font-bold text-sm flex-shrink-0 min-w-[24px] text-right">
                    {match.set_scores ? match.set_scores.filter((s: any) => s.team2 > s.team1).length : (match.score2 !== null ? match.score2 : '-')}
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
      )}

      {/* Score Modal */}
      {selectedMatch && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="glass-panel max-w-md w-full p-6 rounded-2xl border border-dark-800 space-y-6 animate-scale-in">
            {/* Header */}
            <div className="border-b border-dark-800 pb-3">
              <h3 className="font-bold text-lg text-white">Masukkan Skor Pertandingan</h3>
              <p className="text-xs text-slate-400 mt-0.5">Babak {selectedMatch.round} • Pertandingan {selectedMatch.match_index + 1}</p>
              {/* Best-of-3 Set Inputs */}
              <div className="space-y-3 py-2">
                <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold uppercase tracking-wider px-1">
                  <span>Set</span>
                  <span className="flex gap-6">
                    <span>{getTeamNames(selectedMatch.team1_ids)}</span>
                    <span>{getTeamNames(selectedMatch.team2_ids)}</span>
                  </span>
                </div>
                {sets.map((set, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-3 p-2.5 bg-dark-950/40 border border-dark-800 rounded-xl"
                  >
                    <span className="text-xs font-bold text-slate-400 w-6">Set {idx + 1}</span>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        value={set.t1}
                        onChange={(e) => {
                          const next = [...sets];
                          next[idx] = { ...next[idx], t1: e.target.value };
                          setSets(next);
                        }}
                        placeholder="0"
                        min="0"
                        max="50"
                        className="w-20 glass-input py-1.5 text-center font-bold text-base"
                      />
                      <span className="text-slate-600 font-bold text-lg">:</span>
                      <input
                        type="number"
                        value={set.t2}
                        onChange={(e) => {
                          const next = [...sets];
                          next[idx] = { ...next[idx], t2: e.target.value };
                          setSets(next);
                        }}
                        placeholder="0"
                        min="0"
                        max="50"
                        className="w-20 glass-input py-1.5 text-center font-bold text-base"
                      />
                    </div>
                    {idx > 0 && (
                      <button
                        onClick={() => setSets(sets.filter((_, i) => i !== idx))}
                        className="text-[10px] text-rose-400 hover:text-rose-300 ml-1"
                      >
                        Hapus
                      </button>
                    )}
                  </div>
                ))}
                {sets.length < 3 && (
                  <button
                    onClick={() => setSets([...sets, { t1: '', t2: '' }])}
                    className="text-xs text-brand-primary hover:text-brand-secondary transition-colors"
                  >
                    + Tambah Set
                  </button>
                )}
                <p className="text-[10px] text-slate-500 italic">Best of 3 — pemenang ditentukan dari jumlah set yang dimenangkan</p>
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
        </div>
      )}

      {/* Fill-Bye / Add New Player Modal */}
      {fillOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="glass-panel max-w-md w-full p-6 rounded-2xl border border-dark-800 space-y-5 animate-scale-in">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-dark-800 pb-3">
              <div>
                <h3 className="font-bold text-lg text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-brand-secondary" />
                  Tambah Pemain
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {fillMatch ? (
                    <>Babak {fillMatch.round} • Pertandingan {fillMatch.match_index + 1}
                      {fillSlot === 'team1' ? ' • Slot Tim 1' : ' • Slot Tim 2'}</>
                  ) : isLeague ? (
                    'Mode Liga • Tim baru akan bertemu semua tim yang sudah ada'
                  ) : (
                    'Posisi otomatis • Bagan diperluas bila penuh'
                  )}
                </p>
              </div>
              <button
                onClick={() => setFillOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-dark-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Opponent already waiting (only when a specific slot was chosen) */}
            {fillMatch && (
              <div className="p-3 bg-dark-950/40 border border-dark-800 rounded-xl text-xs">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Lawan (sudah terisi)</span>
                <span className="text-slate-200 font-medium">
                  {fillSlot === 'team1' ? getTeamNames(fillMatch.team2_ids) : getTeamNames(fillMatch.team1_ids)}
                </span>
              </div>
            )}

            {/* Doubles partner note */}
            {tournament?.format === 'double' && (
              <div className="p-3 bg-brand-primary/5 border border-brand-primary/20 rounded-xl text-xs text-slate-300">
                {isLeague ? 'Mode Liga: wajib pilih 2 pemain untuk tim ganda (tidak ada partner acak).' : 'Pilih 2 pemain untuk tim ganda (wajib 2, tidak diacak otomatis).'}
              </div>
            )}

            {/* Quick-create new player */}
            <div className="space-y-2">
              <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Pemain belum terdaftar?</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={fillNewPlayerName}
                  onChange={(e) => setFillNewPlayerName(e.target.value)}
                  placeholder="Nama pemain baru"
                  className="flex-1 glass-input py-2 text-sm"
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateFillPlayer()}
                />
                <button
                  onClick={handleCreateFillPlayer}
                  disabled={addPlayerMutation.isPending || !fillNewPlayerName.trim()}
                  className="glass-btn px-3 rounded-xl flex items-center gap-1.5 text-xs disabled:opacity-50"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Tambah</span>
                </button>
              </div>
            </div>

            {/* Player selection */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                  Pilih {tournament?.format === 'double' ? '2 pemain' : '1 pemain'}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${fillSelectedIds.length === (tournament?.format === 'double' ? 2 : 1)
                  ? 'bg-brand-primary/10 border-brand-primary/30 text-brand-primary'
                  : 'bg-dark-800/40 border-dark-700 text-slate-400'
                  }`}>
                  {fillSelectedIds.length}/{tournament?.format === 'double' ? 2 : 1}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-[240px] overflow-y-auto pr-1">
                {players.length === 0 ? (
                  <div className="col-span-2 text-center py-8 text-xs text-slate-500 border border-dashed border-dark-800 rounded-xl">
                    Belum ada pemain terdaftar. Buat pemain baru di atas.
                  </div>
                ) : (
                  players.map((p) => {
                    const inTournament = tournamentPlayerIds.has(p.id);
                    const isSelected = fillSelectedIds.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        onClick={() => !inTournament && toggleFillPlayer(p.id)}
                        disabled={inTournament}
                        className={`px-3 py-2 rounded-xl border text-left text-xs font-medium transition-all ${isSelected
                          ? 'bg-brand-primary/15 border-brand-primary/60 text-white'
                          : inTournament
                            ? 'opacity-40 cursor-not-allowed border-dark-800 text-slate-500'
                            : 'bg-dark-900 border-dark-800/80 hover:border-brand-primary/50 text-slate-300'
                          }`}
                      >
                        <span className="truncate block">{p.name}</span>
                        {inTournament && <span className="text-[9px] text-slate-600 block">sudah di turnamen</span>}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Error Message */}
            {fillError && (
              <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-xl text-center">
                {fillError}
              </p>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 justify-end pt-2 border-t border-dark-800">
              <button
                onClick={() => setFillOpen(false)}
                className="glass-btn px-4 py-2.5 rounded-xl text-xs"
              >
                Batal
              </button>
              <button
                onClick={handleSubmitFill}
                disabled={addTeamMutation.isPending}
                className="px-5 py-2.5 rounded-xl gradient-btn text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
              >
                <Users className="w-4 h-4" />
                {addTeamMutation.isPending ? 'Menambahkan...' : isLeague ? 'Tambahkan ke Liga' : 'Tambahkan ke Bagan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Team / Ganti Pasangan Modal — Liga only */}
      {editTeamOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="glass-panel max-w-md w-full p-6 rounded-2xl border border-dark-800 space-y-5 animate-scale-in">
            <div className="flex items-start justify-between border-b border-dark-800 pb-3">
              <div>
                <h3 className="font-bold text-lg text-white flex items-center gap-2">
                  <Pencil className="w-4 h-4 text-emerald-400" />
                  Ganti Pasangan
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Tim saat ini: <span className="text-slate-200 font-semibold">{getTeamNames(editOldTeamIds)}</span> → semua jadwal tim ini akan terupdate.
                </p>
              </div>
              <button onClick={() => setEditTeamOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-dark-800 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick-create new player */}
            <div className="space-y-2">
              <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Pemain belum terdaftar?</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={editNewPlayerName}
                  onChange={(e) => setEditNewPlayerName(e.target.value)}
                  placeholder="Nama pemain baru"
                  className="flex-1 glass-input py-2 text-sm"
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateEditPlayer()}
                />
                <button
                  onClick={handleCreateEditPlayer}
                  disabled={addPlayerMutation.isPending || !editNewPlayerName.trim()}
                  className="glass-btn px-3 rounded-xl flex items-center gap-1.5 text-xs disabled:opacity-50"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Tambah</span>
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                  Pilih {tournament?.format === 'double' ? '2 pemain' : '1 pemain'} baru
                </span>
                <div className="flex items-center gap-2">
                  <button onClick={shuffleEditTeam} className="text-[10px] glass-btn px-2 py-1 rounded-lg flex items-center gap-1" title="Acak pasangan dari pemain tersedia">
                    <Shuffle className="w-3 h-3" /> Acak
                  </button>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${editSelectedIds.length === (tournament?.format === 'double' ? 2 : 1) ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-dark-800/40 border-dark-700 text-slate-400'}`}>
                    {editSelectedIds.length}/{tournament?.format === 'double' ? 2 : 1}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-[240px] overflow-y-auto pr-1">
                {players.map((p) => {
                  const isOldMember = editOldTeamIds.includes(p.id);
                  const isInOtherTeam = tournamentPlayerIds.has(p.id) && !isOldMember;
                  const isSelected = editSelectedIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => !isInOtherTeam && toggleEditPlayer(p.id)}
                      disabled={isInOtherTeam}
                      className={`px-3 py-2 rounded-xl border text-left text-xs font-medium transition-all ${isSelected ? 'bg-emerald-500/15 border-emerald-500/60 text-white' : isInOtherTeam ? 'opacity-40 cursor-not-allowed border-dark-800 text-slate-500' : 'bg-dark-900 border-dark-800/80 hover:border-emerald-500/50 text-slate-300'}`}
                    >
                      <span className="truncate block">{p.name}</span>
                      {isOldMember && <span className="text-[9px] text-emerald-400 block">anggota saat ini</span>}
                      {isInOtherTeam && <span className="text-[9px] text-slate-600 block">sudah di tim lain</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {editError && <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-xl text-center">{editError}</p>}

            <div className="flex items-center gap-3 justify-end pt-2 border-t border-dark-800">
              <button onClick={() => setEditTeamOpen(false)} className="glass-btn px-4 py-2.5 rounded-xl text-xs">Batal</button>
              <button onClick={handleSubmitEditTeam} disabled={updateLeagueTeamMutation.isPending} className="px-5 py-2.5 rounded-xl gradient-btn text-xs font-bold flex items-center gap-1.5 disabled:opacity-50">
                <Pencil className="w-4 h-4" />
                {updateLeagueTeamMutation.isPending ? 'Menyimpan...' : 'Simpan Pasangan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
