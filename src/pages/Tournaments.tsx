import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useTournaments,
  useAddTournament,
  useDeleteTournament,
  usePlayers,
  useRankings
} from '../hooks/useQueries';
import {
  Trophy,
  Calendar,
  ChevronRight,
  Plus,
  Trash2,
  Users,
  Shuffle,
  GitBranch,
  CheckCircle,
  HelpCircle,
  Command,
  ListOrdered,
  Lock,
  Table2,
  Swords
} from 'lucide-react';

export const Tournaments: React.FC = () => {
  const navigate = useNavigate();
  const { data: tournaments = [], isLoading: loadingTournaments } = useTournaments();
  const { data: players = [] } = usePlayers();
  const { data: rankings } = useRankings();
  const deleteTournamentMutation = useDeleteTournament();
  const addTournamentMutation = useAddTournament();

  // Wizard state
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(1); // 1: Info, 2: Players, 3: Pairings
  const [name, setName] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [format, setFormat] = useState<'single' | 'double'>('double');
  const [mode, setMode] = useState<'knockout' | 'league'>('knockout');
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [teams, setTeams] = useState<string[][]>([]); // Array of teams. Each team is string[] (ids)
  const [manualSelection, setManualSelection] = useState<string[]>([]); // Current manual team formation buffer

  // Schedule command (natural language match ordering)
  const [scheduleCommand, setScheduleCommand] = useState('');
  const [scheduleFeedback, setScheduleFeedback] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const handleTogglePlayer = (id: string) => {
    if (selectedPlayerIds.includes(id)) {
      setSelectedPlayerIds(selectedPlayerIds.filter((pId) => pId !== id));
      // Remove any team containing this player
      setTeams(teams.filter((t) => !t.includes(id)));
    } else {
      setSelectedPlayerIds([...selectedPlayerIds, id]);
    }
  };

  const handleSelectAllPlayers = () => {
    if (selectedPlayerIds.length === players.length) {
      setSelectedPlayerIds([]);
      setTeams([]);
    } else {
      setSelectedPlayerIds(players.map((p) => p.id));
    }
  };

  const startPairingsStep = () => {
    if (selectedPlayerIds.length < 2) return;
    setWizardStep(3);
    setTeams([]);
    setManualSelection([]);
    setScheduleCommand('');
    setScheduleFeedback(null);
  };

  // Pairing Generator: Random
  const generateRandomPairings = () => {
    const shuffled = [...selectedPlayerIds].sort(() => Math.random() - 0.5);
    const newTeams: string[][] = [];

    if (format === 'double') {
      for (let i = 0; i < shuffled.length; i += 2) {
        if (i + 1 < shuffled.length) {
          newTeams.push([shuffled[i], shuffled[i + 1]]);
        } else {
          // Odd player gets a partner from already-paired players
          // (they'll play twice; bracket layout ensures they won't face themselves)
          const partnerIdx = Math.floor(Math.random() * (shuffled.length - 1));
          newTeams.push([shuffled[i], shuffled[partnerIdx]]);
        }
      }
    } else {
      shuffled.forEach((pId) => newTeams.push([pId]));
    }
    setTeams(newTeams);
  };

  // Pairing Generator: Balanced (Highest rank + Lowest rank, etc.)
  const generateBalancedPairings = () => {
    if (format === 'single') {
      // In singles, balanced pairings are just individual slots
      setTeams(selectedPlayerIds.map((pId) => [pId]));
      return;
    }

    // Sort selected players by their rank performance, or defaults
    const individualRanks = rankings?.individuals || [];
    const sortedSelected = [...selectedPlayerIds].sort((a, b) => {
      const idxA = individualRanks.findIndex((r) => r.playerId === a);
      const idxB = individualRanks.findIndex((r) => r.playerId === b);
      // If player has no stats, treat them as middle-ranked
      const rankA = idxA === -1 ? 999 : idxA;
      const rankB = idxB === -1 ? 999 : idxB;
      return rankA - rankB;
    });

    const newTeams: string[][] = [];
    let start = 0;
    let end = sortedSelected.length - 1;

    while (start <= end) {
      if (start === end) {
        // Odd player gets a partner from already-paired players
        // (they'll play twice; bracket layout ensures they won't face themselves)
        const partnerIdx = start > 0 ? start - 1 : start + 1;
        newTeams.push([sortedSelected[start], sortedSelected[Math.min(partnerIdx, sortedSelected.length - 1)]]);
        break;
      }
      // Pair strongest with weakest
      newTeams.push([sortedSelected[start], sortedSelected[end]]);
      start++;
      end--;
    }
    setTeams(newTeams);
  };

  // Manual pairing handler
  const handleManualPairClick = (pId: string) => {
    if (manualSelection.includes(pId)) {
      setManualSelection(manualSelection.filter((id) => id !== pId));
      return;
    }

    if (format === 'single') {
      setTeams([...teams, [pId]]);
      setManualSelection([]);
    } else {
      // Double format manual pairing
      const newSel = [...manualSelection, pId];
      if (newSel.length === 2) {
        setTeams([...teams, newSel]);
        setManualSelection([]);
      } else {
        setManualSelection(newSel);
      }
    }
  };



  const handleRemoveTeam = (index: number) => {
    setTeams(teams.filter((_, i) => i !== index));
    // If we had manual selection buffer, clear it to avoid confusion
    setManualSelection([]);
  };

  const handleStartTournament = async () => {
    if (teams.length < 2) return;
    try {
      const result = await addTournamentMutation.mutateAsync({
        name: name || `Mabar ${new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short' })}`,
        date,
        format,
        mode,
        teams,
      });
      // Reset wizard and navigate to the newly created bracket
      setShowWizard(false);
      resetWizard();
      navigate(`/tournaments/${result.id}`);
    } catch (err: any) {
      alert(err.message || 'Error generating tournament');
    }
  };

  const resetWizard = () => {
    setWizardStep(1);
    setName('');
    setDate(new Date().toISOString().split('T')[0]);
    setFormat('double');
    setMode('knockout');
    setSelectedPlayerIds([]);
    setTeams([]);
    setManualSelection([]);
    setScheduleCommand('');
    setScheduleFeedback(null);
  };

  const handleDeleteTournament = async (id: string, tournamentName: string) => {
    if (window.confirm(`Apakah Anda yakin ingin menghapus turnamen "${tournamentName}"? Ini akan menghapus semua pertandingan dan skor terkait secara permanen.`)) {
      try {
        await deleteTournamentMutation.mutateAsync(id);
      } catch (err: any) {
        alert(err.message || 'Gagal menghapus turnamen');
      }
    }
  };

  const getPlayerName = (id: string) => {
    if (id === 'ghost') return '👻 GHOST';
    return players.find((p) => p.id === id)?.name || 'Pemain Tidak Diketahui';
  };

  // ── Schedule command: parse natural-language match ordering ──
  // e.g. "jangan kasih Marcus dan Kevin main duluan" → those teams play later
  const parseScheduleCommand = (input: string): { mode: 'early' | 'late'; playerNames: string[] } | null => {
    const text = input.toLowerCase().trim();
    if (!text) return null;

    const jangan = /\bjangan\b/.test(text);
    const terakhir = /\b(main\s*terakhir|paling\s*akhir|terakhir)\b/.test(text);
    const earlyKw = /\b(main\s*duluan|main\s*pertama|main\s*awal|duluan|pertama|awal|dulu)\b/.test(text);
    const keNum = text.match(/ke\s*(\d+)/);

    let mode: 'early' | 'late';
    if (terakhir) mode = 'late';
    else if (keNum) mode = parseInt(keNum[1], 10) >= 2 ? 'late' : 'early';
    else if (earlyKw) mode = jangan ? 'late' : 'early';
    else return null;

    const playerNames = players.filter((p) => text.includes(p.name.toLowerCase())).map((p) => p.name);
    if (playerNames.length === 0) return null;

    return { mode, playerNames };
  };

  const applyScheduleCommand = () => {
    if (teams.length === 0) return;
    const parsed = parseScheduleCommand(scheduleCommand);
    if (!parsed) {
      setScheduleFeedback({
        type: 'error',
        text: 'Perintah tidak dikenali. Contoh: "jangan kasih Marcus dan Kevin main duluan".',
      });
      return;
    }

    const isTarget = (team: string[]) => team.some((id) => parsed.playerNames.includes(getPlayerName(id)));
    const targetTeams = teams.filter(isTarget);
    const otherTeams = teams.filter((t) => !isTarget(t));

    if (targetTeams.length === 0) {
      setScheduleFeedback({
        type: 'error',
        text: `Tidak ada tim berisi: ${parsed.playerNames.join(' & ')}. Pastikan nama yang Anda tulis sudah dipilih sebagai pemain.`,
      });
      return;
    }

    const ordered = parsed.mode === 'early' ? [...targetTeams, ...otherTeams] : [...otherTeams, ...targetTeams];
    setTeams(ordered);
    setScheduleFeedback({
      type: 'success',
      text: parsed.mode === 'early'
        ? `Tim ${parsed.playerNames.join(' & ')} akan main duluan — ditempatkan di pertandingan awal bagan.`
        : `Tim ${parsed.playerNames.join(' & ')} tidak akan main pertama — dipindah ke pertandingan berikutnya (ke-2, ke-3, dst).`,
    });
  };

  // Get unassigned players for manual pairings
  const getUnassignedPlayers = () => {
    const assignedIds = teams.flat();
    return selectedPlayerIds.filter((pId) => !assignedIds.includes(pId));
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold font-sans tracking-tight gradient-text">Turnamen</h2>
          <p className="text-sm text-slate-400 mt-1">
            Buat bagan Knockout atau klasemen Liga (round-robin) untuk Ganda Putra & Tunggal.
          </p>
        </div>

        {!showWizard && (
          <button
            onClick={() => setShowWizard(true)}
            className="px-4 py-2.5 rounded-xl gradient-btn flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            <span>Buat Turnamen</span>
          </button>
        )}
      </div>

      {/* Tournament Creator Wizard Panel */}
      {showWizard && (
        <div className="glass-panel p-6 md:p-8 rounded-2xl border border-dark-800 space-y-6 animate-scale-in">
          {/* Wizard Headers */}
          <div className="flex items-center justify-between border-b border-dark-800 pb-4">
            <div className="flex items-center gap-3">
              <Trophy className="w-6 h-6 text-brand-secondary" />
              <h3 className="font-bold text-xl">Pengaturan Turnamen</h3>
            </div>
            <button
              onClick={() => {
                setShowWizard(false);
                resetWizard();
              }}
              className="text-slate-400 hover:text-white glass-btn px-3 py-1.5 rounded-lg text-xs"
            >
              Batal
            </button>
          </div>

          {/* Steps Indicator */}
          <div className="flex items-center gap-2 max-w-lg mx-auto">
            <div className={`flex-1 h-2 rounded-full transition-colors duration-300 ${wizardStep >= 1 ? 'bg-brand-primary' : 'bg-dark-800'}`} />
            <div className={`flex-1 h-2 rounded-full transition-colors duration-300 ${wizardStep >= 2 ? 'bg-brand-primary' : 'bg-dark-800'}`} />
            <div className={`flex-1 h-2 rounded-full transition-colors duration-300 ${wizardStep >= 3 ? 'bg-brand-primary' : 'bg-dark-800'}`} />
          </div>
          <div className="flex justify-between text-xs text-slate-500 font-bold uppercase tracking-wider max-w-lg mx-auto px-1">
            <span className={wizardStep === 1 ? 'text-brand-primary' : ''}>1. Info</span>
            <span className={wizardStep === 2 ? 'text-brand-primary' : ''}>2. Pemain</span>
            <span className={wizardStep === 3 ? 'text-brand-primary' : ''}>3. Pasangan</span>
          </div>

          {/* STEP 1: Basic Info */}
          {wizardStep === 1 && (
            <div className="max-w-md mx-auto space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Nama Turnamen</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="misal: Mabar Jumat Badminton Club"
                  className="w-full glass-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Tanggal</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full glass-input"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Format</label>
                  <select
                    value={format}
                    onChange={(e) => setFormat(e.target.value as 'single' | 'double')}
                    className="w-full glass-input bg-dark-900"
                  >
                    <option value="double">Ganda Putra (MD)</option>
                    <option value="single">Tunggal (1v1)</option>
                  </select>
                </div>
              </div>

              {/* Mode selector: Knockout vs Liga */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Mode Turnamen</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setMode('knockout')}
                    className={`p-3 rounded-xl border text-left transition-all flex items-center gap-3 ${mode === 'knockout' ? 'bg-brand-primary/10 border-brand-primary/50 shadow-md shadow-brand-primary/10' : 'bg-dark-900/40 border-dark-800/80 hover:border-dark-700'}`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${mode === 'knockout' ? 'bg-brand-primary text-white' : 'bg-dark-800 text-slate-400'}`}>
                      <GitBranch className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold ${mode === 'knockout' ? 'text-white' : 'text-slate-300'}`}>Knockout</p>
                      <p className="text-[10px] text-slate-500 leading-tight">Sistem gugur, bagan eliminasi</p>
                    </div>
                    {mode === 'knockout' && <span className="text-brand-primary text-xs">●</span>}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('league')}
                    className={`p-3 rounded-xl border text-left transition-all flex items-center gap-3 ${mode === 'league' ? 'bg-emerald-500/10 border-emerald-500/50 shadow-md shadow-emerald-500/10' : 'bg-dark-900/40 border-dark-800/80 hover:border-dark-700'}`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${mode === 'league' ? 'bg-emerald-500 text-white' : 'bg-dark-800 text-slate-400'}`}>
                      <Table2 className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold ${mode === 'league' ? 'text-white' : 'text-slate-300'}`}>Liga</p>
                      <p className="text-[10px] text-slate-500 leading-tight">Round-robin, semua vs semua</p>
                    </div>
                    {mode === 'league' && <span className="text-emerald-400 text-xs">●</span>}
                  </button>
                </div>
                {mode === 'league' && (
                  <p className="text-[11px] text-emerald-300/80 bg-emerald-500/5 border border-emerald-500/15 rounded-lg px-3 py-2 flex items-center gap-2">
                    <Swords className="w-3.5 h-3.5" />
                    <span>Mode Liga: {teams.length >= 2 ? `${teams.length} tim → ${teams.length * (teams.length - 1) / 2} pertandingan` : 'setiap tim bertemu semua tim, klasemen poin'} (Menang = 3 poin).</span>
                  </p>
                )}
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  onClick={() => setWizardStep(2)}
                  className="glass-btn px-5 py-2.5 rounded-xl flex items-center gap-1.5 hover:border-brand-primary"
                >
                  <span>Pilih Pemain</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Players Selection */}
          {wizardStep === 2 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between bg-dark-950/50 p-4 border border-dark-800 rounded-xl">
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-brand-secondary" />
                  <span className="font-semibold text-slate-300">
                    Terpilih: {selectedPlayerIds.length} pemain ({format === 'double' ? `butuh ${Math.ceil(selectedPlayerIds.length / 2)} tim` : `${selectedPlayerIds.length} tim`})
                  </span>
                </div>
                <button
                  onClick={handleSelectAllPlayers}
                  className="text-xs font-bold text-brand-primary hover:text-white transition-colors"
                >
                  {selectedPlayerIds.length === players.length ? 'Batal Pilih Semua' : 'Pilih Semua'}
                </button>
              </div>

              {players.length === 0 ? (
                <div className="text-center py-10 bg-dark-900/30 rounded-xl border border-dashed border-dark-800 text-slate-500 text-sm">
                  Belum ada pemain terdaftar. Silakan tambah pemain terlebih dahulu di halaman Pemain.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[300px] overflow-y-auto pr-2">
                  {players.map((player) => {
                    const isSelected = selectedPlayerIds.includes(player.id);
                    return (
                      <button
                        key={player.id}
                        onClick={() => handleTogglePlayer(player.id)}
                        className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-left transition-all ${isSelected
                          ? 'bg-brand-primary/10 border-brand-primary/50 text-white font-medium shadow-md shadow-brand-primary/5'
                          : 'bg-dark-900/40 border-dark-800/80 hover:border-dark-700 text-slate-400 hover:text-slate-200'
                          }`}
                      >
                        <div className={`w-4 h-4 rounded flex items-center justify-center border ${isSelected ? 'border-brand-primary bg-brand-primary text-white' : 'border-slate-600'
                          }`}>
                          {isSelected && <span className="text-[10px] font-black">✓</span>}
                        </div>
                        <span className="truncate text-sm font-sans">{player.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Warning for odd players in MD */}
              {format === 'double' && selectedPlayerIds.length % 2 !== 0 && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2 text-xs text-amber-300">
                  <HelpCircle className="w-4.5 h-4.5 text-amber-400 mt-0.5 flex-shrink-0" />
                  <span>
                    Anda memilih jumlah pemain ganjil ({selectedPlayerIds.length}). Di langkah berikutnya, Anda bisa memasangkan pemain yang tersisa dengan pasangan main ganda (double-up) dari pemain yang sudah ada.
                  </span>
                </div>
              )}

              <div className="flex justify-between pt-4 border-t border-dark-800">
                <button onClick={() => setWizardStep(1)} className="glass-btn px-4 py-2.5 rounded-xl">
                  Kembali
                </button>
                <button
                  onClick={startPairingsStep}
                  disabled={selectedPlayerIds.length < 2}
                  className="glass-btn px-5 py-2.5 rounded-xl flex items-center gap-1.5 hover:border-brand-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>Buat Pasangan</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Pairings Builder */}
          {wizardStep === 3 && (
            <div className="space-y-6">
              {/* Quick actions for pairing generation */}
              <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-dark-950/50 border border-dark-800 rounded-xl">
                <div>
                  <h4 className="font-bold text-sm text-slate-300">Bagaimana Anda ingin memasangkan tim?</h4>
                  <p className="text-xs text-slate-500 mt-0.5">Buat pasangan tim yang seimbang atau acak secara otomatis, atau atur secara manual.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={generateBalancedPairings}
                    className="glass-btn px-4 py-2 rounded-lg text-xs flex items-center gap-1.5 hover:border-brand-secondary"
                  >
                    <CheckCircle className="w-3.5 h-3.5 text-brand-secondary" />
                    <span>Otomatis (Seimbang)</span>
                  </button>
                  <button
                    onClick={generateRandomPairings}
                    className="glass-btn px-4 py-2 rounded-lg text-xs flex items-center gap-1.5 hover:border-brand-primary"
                  >
                    <Shuffle className="w-3.5 h-3.5 text-brand-primary" />
                    <span>Otomatis (Acak)</span>
                  </button>
                </div>
              </div>

              {/* Schedule command (natural language ordering) — only for Knockout */}
              {mode === 'knockout' && (
                <div className="p-4 bg-dark-950/50 border border-brand-primary/20 rounded-xl space-y-3">
                  <div className="flex items-start gap-2.5">
                    <Command className="w-4 h-4 text-brand-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-bold text-sm text-slate-300">Atur Urutan Main dengan Perintah</h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Ketik perintah untuk menentukan siapa yang main lebih dulu atau lebih belakangan di bagan. Contoh:{" "}
                        <em>"jangan kasih Marcus dan Kevin main duluan"</em> → mereka main di pertandingan ke-2, ke-3, dst.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={scheduleCommand}
                      onChange={(e) => setScheduleCommand(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && applyScheduleCommand()}
                      placeholder='Misal: "jangan kasih Marcus dan Kevin main duluan"'
                      className="flex-1 glass-input py-2 text-sm"
                    />
                    <button
                      onClick={applyScheduleCommand}
                      className="glass-btn px-4 rounded-xl text-xs flex items-center gap-1.5 hover:border-brand-primary"
                    >
                      <ListOrdered className="w-3.5 h-3.5" />
                      <span>Terapkan</span>
                    </button>
                  </div>
                  {scheduleFeedback && (
                    <p className={`text-xs p-2.5 rounded-xl border ${scheduleFeedback.type === 'error'
                      ? 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                      : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                      }`}>
                      {scheduleFeedback.text}
                    </p>
                  )}
                </div>
              )}
              {mode === 'league' && (
                <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl flex items-start gap-2.5">
                  <Table2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-bold text-sm text-emerald-300">Mode Liga — Round Robin</h4>
                    <p className="text-xs text-slate-400 mt-0.5">Setiap tim akan bertemu semua tim lain sekali. Total {teams.length >= 2 ? `${teams.length * (teams.length - 1) / 2} pertandingan` : 'pertandingan dihitung otomatis'} • Poin: Menang = 3, Kalah = 0 • Urutan main tidak berpengaruh pada klasemen.</p>
                  </div>
                </div>
              )}

              {/* Pairings Builder Workspace */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                {/* Unassigned / Manual selection buffer */}
                <div className="glass-card p-5 rounded-xl space-y-4">
                  <div className="border-b border-dark-800 pb-3 flex items-center justify-between">
                    <h5 className="font-bold text-sm text-slate-300">Pemain Belum Berpasangan ({getUnassignedPlayers().length})</h5>
                    {manualSelection.length > 0 && (
                      <span className="text-[10px] bg-brand-primary/10 text-brand-primary border border-brand-primary/20 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider animate-pulse">
                        {format === 'double' ? `Terpilih ${manualSelection.length}/2` : 'Tunggal terpilih'}
                      </span>
                    )}
                  </div>

                  {getUnassignedPlayers().length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-500">
                      Semua pemain sudah mendapatkan pasangan! Klik "Mulai Turnamen" untuk membuat bagan.
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {getUnassignedPlayers().map((pId) => {
                        const isBuffer = manualSelection.includes(pId);
                        return (
                          <button
                            key={pId}
                            onClick={() => handleManualPairClick(pId)}
                            className={`px-3 py-2 rounded-xl border text-xs font-medium transition-all ${isBuffer
                              ? 'bg-brand-primary text-white border-brand-primary shadow-lg shadow-brand-primary/25'
                              : 'bg-dark-900 border-dark-800/80 hover:border-dark-700 text-slate-300'
                              }`}
                          >
                            {getPlayerName(pId)}
                          </button>
                        );
                      })}

                      {/* Double-Up Partner Trigger for last remaining player */}
                      {format === 'double' && getUnassignedPlayers().length === 1 && (
                        <div className="w-full space-y-3 pt-3 border-t border-dark-800/40">
                          <p className="text-[10px] text-amber-300 font-bold uppercase tracking-wider">
                            Pilih pasangan Main Ganda untuk {getPlayerName(getUnassignedPlayers()[0])}:
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {selectedPlayerIds
                              .filter((id) => id !== getUnassignedPlayers()[0])
                              .map((pId) => (
                                <button
                                  key={`double-${pId}`}
                                  onClick={() => {
                                    setTeams([...teams, [getUnassignedPlayers()[0], pId]]);
                                    setManualSelection([]);
                                  }}
                                  className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/25 hover:border-amber-500/50 text-amber-200 text-xs font-semibold"
                                >
                                  {getPlayerName(pId)}
                                </button>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Formed Teams */}
                <div className="glass-card p-5 rounded-xl space-y-4">
                  <h5 className="font-bold text-sm text-slate-300 border-b border-dark-800 pb-3">
                    Tim Terbentuk ({teams.length})
                  </h5>

                  {teams.length === 0 ? (
                    <div className="text-center py-12 text-xs text-slate-500 border border-dashed border-dark-800 rounded-xl">
                      Belum ada tim yang dibuat. Gunakan tombol otomatis di atas atau klik nama pemain di sebelah kiri untuk memasangkan secara manual.
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                      {teams.map((team, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3 bg-dark-900/60 border border-dark-800/80 rounded-xl text-sm"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs bg-dark-800 text-slate-400 w-5 h-5 flex items-center justify-center rounded-lg font-bold">
                              {idx + 1}
                            </span>
                            <div className="font-medium">
                              {team.map((pId) => getPlayerName(pId)).join('  •  ')}
                            </div>
                          </div>
                          <button
                            onClick={() => handleRemoveTeam(idx)}
                            className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Actions Footer */}
              <div className="flex justify-between pt-4 border-t border-dark-800">
                <button onClick={() => setWizardStep(2)} className="glass-btn px-4 py-2.5 rounded-xl">
                  Kembali
                </button>
                <button
                  onClick={handleStartTournament}
                  disabled={teams.length < 2 || addTournamentMutation.isPending}
                  className="px-5 py-2.5 rounded-xl gradient-btn flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {addTournamentMutation.isPending ? (
                    <span>Menyiapkan Bagan...</span>
                  ) : (
                    <>
                      <GitBranch className="w-5 h-5" />
                      <span>Mulai Turnamen</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tournaments List Grid */}
      {loadingTournaments ? (
        <div className="text-center py-16 glass-panel rounded-2xl">
          <div className="w-8 h-8 border-4 border-brand-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Memuat daftar turnamen...</p>
        </div>
      ) : tournaments.length === 0 ? (
        <div className="text-center py-20 glass-panel rounded-2xl border border-dark-800 space-y-4">
          <span className="text-5xl">🏆</span>
          <h3 className="font-bold text-xl text-slate-300">Belum ada turnamen yang dibuat</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Ayo mulai mabarnya! Klik tombol "Buat Turnamen" di atas untuk memilih pemain, memasangkan mereka, dan membuat bagan pertandingan.
          </p>
          <button
            onClick={() => setShowWizard(true)}
            className="px-5 py-2.5 rounded-xl gradient-btn inline-flex items-center gap-2 text-sm mt-2"
          >
            <Plus className="w-4 h-4" />
            <span>Buat Turnamen</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tournaments.map((tournament) => {
            const isCompleted = tournament.status === 'completed';
            const winnerNames = tournament.winner_team_ids
              ? tournament.winner_team_ids.map((id) => getPlayerName(id)).join(' & ')
              : '';

            return (
              <div
                key={tournament.id}
                className="glass-card rounded-2xl p-6 flex flex-col justify-between gap-5 relative group overflow-hidden border border-dark-800"
              >
                {/* Status indicator line */}
                <div className={`absolute top-0 left-0 right-0 h-1 ${isCompleted
                  ? 'bg-gradient-to-r from-emerald-400 to-teal-400'
                  : 'bg-gradient-to-r from-brand-primary to-brand-secondary'
                  }`} />

                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border tracking-wide uppercase ${isCompleted
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                      : 'bg-brand-primary/10 border-brand-primary/20 text-brand-primary animate-pulse-subtle'
                      }`}>
                      {tournament.status === 'completed' ? 'Selesai' : 'Berjalan'}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteTournament(tournament.id, tournament.name);
                      }}
                      className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      title="Hapus Turnamen"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <h3 className="font-bold text-lg text-white font-sans truncate tracking-wide">
                    {tournament.name}
                  </h3>

                  <div className="space-y-1.5 text-xs text-slate-400">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-slate-500" />
                      <span>{new Date(tournament.date).toLocaleDateString('id-ID', { dateStyle: 'medium' })}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-slate-500" />
                      <span className="capitalize">{tournament.format === 'double' ? "Ganda Putra (MD)" : "Tunggal (1v1)"}</span>
                      <span className={`ml-1 text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${((tournament as any).mode || 'knockout') === 'league' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-brand-primary/10 border-brand-primary/20 text-brand-primary'}`}>
                        {(tournament as any).mode === 'league' ? 'Liga' : 'Knockout'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {(tournament as any).mode === 'league' ? <Table2 className="w-4 h-4 text-emerald-400" /> : <GitBranch className="w-4 h-4 text-slate-500" />}
                      <span>{(tournament as any).mode === 'league' ? 'Round-robin • Semua vs Semua' : 'Sistem Gugur • Bagan Eliminasi'}</span>
                    </div>
                  </div>
                </div>

                {isCompleted && tournament.winner_team_ids && (
                  <div className="bg-emerald-500/5 border border-emerald-500/15 p-3 rounded-xl flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                      🏆
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Pemenang Turnamen</p>
                      <p className="text-xs font-bold text-slate-200 truncate">{winnerNames}</p>
                    </div>
                  </div>
                )}

                {isCompleted && !tournament.winner_team_ids && (
                  <div className="bg-amber-500/5 border border-amber-500/15 p-3 rounded-xl flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">Ditutup Lebih Awal</p>
                      <p className="text-xs text-slate-300 truncate">Sisa pertandingan tidak dimainkan.</p>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => navigate(`/tournaments/${tournament.id}`)}
                  className="w-full py-2.5 rounded-xl glass-btn text-xs flex items-center justify-center gap-2 group-hover:border-brand-primary group-hover:text-white transition-all font-semibold"
                >
                  <span>{isCompleted ? ((tournament as any).mode === 'league' ? 'Lihat Klasemen & Hasil' : 'Lihat Bagan & Hasil') : ((tournament as any).mode === 'league' ? 'Main & Lihat Klasemen' : 'Main & Perbarui Bagan')}</span>
                  <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
