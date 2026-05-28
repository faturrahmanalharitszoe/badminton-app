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
  HelpCircle
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
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [teams, setTeams] = useState<string[][]>([]); // Array of teams. Each team is string[] (ids)
  const [manualSelection, setManualSelection] = useState<string[]>([]); // Current manual team formation buffer

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
          // Odd player gets a double-up partner from all other selected players
          const otherPlayers = selectedPlayerIds.filter((pId) => pId !== shuffled[i]);
          const randomPartner = otherPlayers.length > 0 
            ? otherPlayers[Math.floor(Math.random() * otherPlayers.length)] 
            : 'ghost';
          newTeams.push([shuffled[i], randomPartner]);
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
        // Odd player gets a double-up partner from all other selected players
        const otherPlayers = selectedPlayerIds.filter((pId) => pId !== sortedSelected[start]);
        const randomPartner = otherPlayers.length > 0 
          ? otherPlayers[Math.floor(Math.random() * otherPlayers.length)] 
          : 'ghost';
        newTeams.push([sortedSelected[start], randomPartner]);
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
    setSelectedPlayerIds([]);
    setTeams([]);
    setManualSelection([]);
  };

  const handleDeleteTournament = async (id: string, tournamentName: string) => {
    if (window.confirm(`Are you sure you want to delete tournament "${tournamentName}"? This will permanently delete all associated matches and scores.`)) {
      try {
        await deleteTournamentMutation.mutateAsync(id);
      } catch (err: any) {
        alert(err.message || 'Error deleting tournament');
      }
    }
  };

  const getPlayerName = (id: string) => {
    if (id === 'ghost') return '👻 GHOST';
    return players.find((p) => p.id === id)?.name || 'Unknown Player';
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
          <h2 className="text-3xl font-bold font-sans tracking-tight gradient-text">Tournaments</h2>
          <p className="text-sm text-slate-400 mt-1">
            Create, view, and run brackets for Men's Doubles (MD) and Singles games.
          </p>
        </div>

        {!showWizard && (
          <button
            onClick={() => setShowWizard(true)}
            className="px-4 py-2.5 rounded-xl gradient-btn flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            <span>Create Tournament</span>
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
              <h3 className="font-bold text-xl">Tournament Setup Wizard</h3>
            </div>
            <button
              onClick={() => {
                setShowWizard(false);
                resetWizard();
              }}
              className="text-slate-400 hover:text-white glass-btn px-3 py-1.5 rounded-lg text-xs"
            >
              Cancel
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
            <span className={wizardStep === 2 ? 'text-brand-primary' : ''}>2. Players</span>
            <span className={wizardStep === 3 ? 'text-brand-primary' : ''}>3. Pairings</span>
          </div>

          {/* STEP 1: Basic Info */}
          {wizardStep === 1 && (
            <div className="max-w-md mx-auto space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Tournament Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Mabar Jumat Badminton Club"
                  className="w-full glass-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Date</label>
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
                    <option value="double">Men's Doubles (MD)</option>
                    <option value="single">Singles (1v1)</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  onClick={() => setWizardStep(2)}
                  className="glass-btn px-5 py-2.5 rounded-xl flex items-center gap-1.5 hover:border-brand-primary"
                >
                  <span>Select Players</span>
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
                    Selected: {selectedPlayerIds.length} players ({format === 'double' ? `${Math.ceil(selectedPlayerIds.length / 2)} teams needed` : `${selectedPlayerIds.length} teams`})
                  </span>
                </div>
                <button
                  onClick={handleSelectAllPlayers}
                  className="text-xs font-bold text-brand-primary hover:text-white transition-colors"
                >
                  {selectedPlayerIds.length === players.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>

              {players.length === 0 ? (
                <div className="text-center py-10 bg-dark-900/30 rounded-xl border border-dashed border-dark-800 text-slate-500 text-sm">
                  No players registered. Please add players first in the Players page.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[300px] overflow-y-auto pr-2">
                  {players.map((player) => {
                    const isSelected = selectedPlayerIds.includes(player.id);
                    return (
                      <button
                        key={player.id}
                        onClick={() => handleTogglePlayer(player.id)}
                        className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-left transition-all ${
                          isSelected
                            ? 'bg-brand-primary/10 border-brand-primary/50 text-white font-medium shadow-md shadow-brand-primary/5'
                            : 'bg-dark-900/40 border-dark-800/80 hover:border-dark-700 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded flex items-center justify-center border ${
                          isSelected ? 'border-brand-primary bg-brand-primary text-white' : 'border-slate-600'
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
                    You selected an odd number of players ({selectedPlayerIds.length}). In the next step, you can pair the odd player with a <strong>GHOST partner</strong>.
                  </span>
                </div>
              )}

              <div className="flex justify-between pt-4 border-t border-dark-800">
                <button onClick={() => setWizardStep(1)} className="glass-btn px-4 py-2.5 rounded-xl">
                  Back
                </button>
                <button
                  onClick={startPairingsStep}
                  disabled={selectedPlayerIds.length < 2}
                  className="glass-btn px-5 py-2.5 rounded-xl flex items-center gap-1.5 hover:border-brand-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>Build Pairings</span>
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
                  <h4 className="font-bold text-sm text-slate-300">How would you like to pair up teams?</h4>
                  <p className="text-xs text-slate-500 mt-0.5">Generate balanced or random teams automatically, or assign them manually.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={generateBalancedPairings}
                    className="glass-btn px-4 py-2 rounded-lg text-xs flex items-center gap-1.5 hover:border-brand-secondary"
                  >
                    <CheckCircle className="w-3.5 h-3.5 text-brand-secondary" />
                    <span>Auto (Balanced)</span>
                  </button>
                  <button
                    onClick={generateRandomPairings}
                    className="glass-btn px-4 py-2 rounded-lg text-xs flex items-center gap-1.5 hover:border-brand-primary"
                  >
                    <Shuffle className="w-3.5 h-3.5 text-brand-primary" />
                    <span>Auto (Random)</span>
                  </button>
                </div>
              </div>

              {/* Pairings Builder Workspace */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                {/* Unassigned / Manual selection buffer */}
                <div className="glass-card p-5 rounded-xl space-y-4">
                  <div className="border-b border-dark-800 pb-3 flex items-center justify-between">
                    <h5 className="font-bold text-sm text-slate-300">Unassigned Players ({getUnassignedPlayers().length})</h5>
                    {manualSelection.length > 0 && (
                      <span className="text-[10px] bg-brand-primary/10 text-brand-primary border border-brand-primary/20 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider animate-pulse">
                        {format === 'double' ? `Selected ${manualSelection.length}/2` : 'Singles selected'}
                      </span>
                    )}
                  </div>
                  
                  {getUnassignedPlayers().length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-500">
                      All players assigned! Click "Start Tournament" to create the bracket.
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {getUnassignedPlayers().map((pId) => {
                        const isBuffer = manualSelection.includes(pId);
                        return (
                          <button
                            key={pId}
                            onClick={() => handleManualPairClick(pId)}
                            className={`px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
                              isBuffer
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
                            Choose a Double-Up partner for {getPlayerName(getUnassignedPlayers()[0])}:
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
                    Formed Teams ({teams.length})
                  </h5>
                  
                  {teams.length === 0 ? (
                    <div className="text-center py-12 text-xs text-slate-500 border border-dashed border-dark-800 rounded-xl">
                      No teams created yet. Use auto-generators above or click players on the left to form teams manually.
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
                  Back
                </button>
                <button
                  onClick={handleStartTournament}
                  disabled={teams.length < 2 || addTournamentMutation.isPending}
                  className="px-5 py-2.5 rounded-xl gradient-btn flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {addTournamentMutation.isPending ? (
                    <span>Initializing Bracket...</span>
                  ) : (
                    <>
                      <GitBranch className="w-5 h-5" />
                      <span>Start Tournament</span>
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
          <p className="text-slate-400">Loading tournaments list...</p>
        </div>
      ) : tournaments.length === 0 ? (
        <div className="text-center py-20 glass-panel rounded-2xl border border-dark-800 space-y-4">
          <span className="text-5xl">🏆</span>
          <h3 className="font-bold text-xl text-slate-300">No tournaments created yet</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Get the mabar started! Click the "Create Tournament" button at the top to select players, pair them up, and build a bracket.
          </p>
          <button
            onClick={() => setShowWizard(true)}
            className="px-5 py-2.5 rounded-xl gradient-btn inline-flex items-center gap-2 text-sm mt-2"
          >
            <Plus className="w-4 h-4" />
            <span>Create Tournament</span>
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
                <div className={`absolute top-0 left-0 right-0 h-1 ${
                  isCompleted 
                    ? 'bg-gradient-to-r from-emerald-400 to-teal-400' 
                    : 'bg-gradient-to-r from-brand-primary to-brand-secondary'
                }`} />

                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border tracking-wide uppercase ${
                      isCompleted 
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                        : 'bg-brand-primary/10 border-brand-primary/20 text-brand-primary animate-pulse-subtle'
                    }`}>
                      {tournament.status}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteTournament(tournament.id, tournament.name);
                      }}
                      className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors opacity-0 group-hover:opacity-100 duration-200"
                      title="Delete Tournament"
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
                      <span>{new Date(tournament.date).toLocaleDateString(undefined, { dateStyle: 'medium' })}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-slate-500" />
                      <span className="capitalize">{tournament.format === 'double' ? "Men's Doubles (MD)" : "Singles (1v1)"}</span>
                    </div>
                  </div>
                </div>

                {isCompleted && (
                  <div className="bg-emerald-500/5 border border-emerald-500/15 p-3 rounded-xl flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                      🏆
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Tournament Winner</p>
                      <p className="text-xs font-bold text-slate-200 truncate">{winnerNames}</p>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => navigate(`/tournaments/${tournament.id}`)}
                  className="w-full py-2.5 rounded-xl glass-btn text-xs flex items-center justify-center gap-2 group-hover:border-brand-primary group-hover:text-white transition-all font-semibold"
                >
                  <span>{isCompleted ? 'View Bracket & Results' : 'Play & Update Bracket'}</span>
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
