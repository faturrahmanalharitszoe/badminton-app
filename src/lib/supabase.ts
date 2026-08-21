import { createClient } from '@supabase/supabase-js';

export interface Player {
  id: string;
  name: string;
  created_at: string;
}

export type TournamentMode = 'knockout' | 'league';

export interface Tournament {
  id: string;
  name: string;
  date: string;
  format: 'single' | 'double';
  mode: TournamentMode;
  status: 'active' | 'completed';
  winner_team_ids: string[] | null;
  created_at: string;
}

export interface SetScore {
  team1: number;
  team2: number;
}

export interface Match {
  id: string;
  tournament_id: string;
  round: number;
  match_index: number;
  team1_ids: string[];
  team2_ids: string[];
  score1: number | null;
  score2: number | null;
  winner: 1 | 2 | null;
  next_match_id: string | null;
  next_match_is_team2: boolean;
  created_at: string;
  set_scores: SetScore[] | null;
}

// Check environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const hasSupabaseConfig =
  Boolean(supabaseUrl) &&
  supabaseUrl !== 'https://your-project-id.supabase.co' &&
  Boolean(supabaseAnonKey) &&
  supabaseAnonKey !== 'your-supabase-anon-key';

// Initialize Supabase if keys exist
const supabase = hasSupabaseConfig ? createClient(supabaseUrl, supabaseAnonKey) : null;

// ── Auto-detect set_scores column availability ──
// The anon key cannot run DDL, so we probe once and cache the result.
// If missing, localStorage bridge handles persistence until the column is added.
const probeSetScoresColumn = async () => {
  if (!supabase) return;
  try {
    const { error } = await supabase
      .from('matches')
      .select('set_scores')
      .limit(1);
    if (error) {
      const msg = (error.message || '').toLowerCase();
      if (msg.includes('set_scores') || msg.includes('column') || msg.includes('schema cache')) {
        console.info(
          '%c[Badminton App] set_scores column not found in Supabase.\n' +
          'Run this SQL in your Supabase SQL Editor to enable cloud persistence:\n\n' +
          'ALTER TABLE matches ADD COLUMN IF NOT EXISTS set_scores JSONB DEFAULT NULL;\n\n' +
          'Until then, set_scores are saved in localStorage (browser only).',
          'color: #f59e0b; font-weight: bold;'
        );
      }
    } else {
      console.info('%c[Badminton App] set_scores column detected ✓', 'color: #22c55e;');
    }
  } catch {
    // Ignore error
  }
};

// Run probe once at module load (fire-and-forget)
if (supabase) {
  probeSetScoresColumn();
}

// Demo/Mock Data Seeding
const SEED_PLAYERS: Player[] = [
  { id: 'p1', name: 'Marcus Gideon', created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString() },
  { id: 'p2', name: 'Kevin Sanjaya', created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString() },
  { id: 'p3', name: 'Hendra Setiawan', created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 29).toISOString() },
  { id: 'p4', name: 'Mohammad Ahsan', created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 29).toISOString() },
  { id: 'p5', name: 'Fajar Alfian', created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 28).toISOString() },
  { id: 'p6', name: 'Muhammad Rian Ardianto', created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 28).toISOString() },
  { id: 'p7', name: 'Leo Rolly Carnando', created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 27).toISOString() },
  { id: 'p8', name: 'Daniel Marthin', created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 27).toISOString() },
];

const initializeLocalStorage = () => {
  if (!localStorage.getItem('mabar_players')) {
    localStorage.setItem('mabar_players', JSON.stringify(SEED_PLAYERS));
  }
  if (!localStorage.getItem('mabar_tournaments')) {
    localStorage.setItem('mabar_tournaments', JSON.stringify([]));
  }
  if (!localStorage.getItem('mabar_matches')) {
    localStorage.setItem('mabar_matches', JSON.stringify([]));
  }
};

if (!hasSupabaseConfig) {
  initializeLocalStorage();
}

// LocalStorage Database Client
const localDb = {
  // Players CRUD
  getPlayers: async (): Promise<Player[]> => {
    initializeLocalStorage();
    return JSON.parse(localStorage.getItem('mabar_players') || '[]');
  },
  createPlayer: async (name: string): Promise<Player> => {
    const players = await localDb.getPlayers();
    if (players.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      throw new Error('Player name already exists');
    }
    const newPlayer: Player = {
      id: crypto.randomUUID(),
      name,
      created_at: new Date().toISOString(),
    };
    players.push(newPlayer);
    localStorage.setItem('mabar_players', JSON.stringify(players));
    return newPlayer;
  },
  updatePlayer: async (id: string, name: string): Promise<Player> => {
    const players = await localDb.getPlayers();
    const index = players.findIndex((p) => p.id === id);
    if (index === -1) throw new Error('Player not found');
    if (players.some((p) => p.id !== id && p.name.toLowerCase() === name.toLowerCase())) {
      throw new Error('Player name already exists');
    }
    players[index].name = name;
    localStorage.setItem('mabar_players', JSON.stringify(players));
    return players[index];
  },
  deletePlayer: async (id: string): Promise<void> => {
    const players = await localDb.getPlayers();
    const updated = players.filter((p) => p.id !== id);
    localStorage.setItem('mabar_players', JSON.stringify(updated));

    // Cleanup matches referencing deleted player by moving to an empty array slot or similar,
    // though in practice, you might prevent deletion if active matches exist.
  },

  // Tournaments CRUD
  getTournaments: async (): Promise<Tournament[]> => {
    initializeLocalStorage();
    const list: Tournament[] = JSON.parse(localStorage.getItem('mabar_tournaments') || '[]');
    // migrate old data without mode
    let migrated = false;
    list.forEach((t: any) => { if (!t.mode) { t.mode = 'knockout'; migrated = true; } });
    if (migrated) localStorage.setItem('mabar_tournaments', JSON.stringify(list));
    return list;
  },
  getTournamentById: async (id: string): Promise<Tournament | null> => {
    const list = await localDb.getTournaments();
    return list.find((t) => t.id === id) || null;
  },
  createTournament: async (name: string, date: string, format: 'single' | 'double', mode: TournamentMode = 'knockout'): Promise<Tournament> => {
    const tournaments = await localDb.getTournaments();
    const newTournament: Tournament = {
      id: crypto.randomUUID(),
      name,
      date,
      format,
      mode,
      status: 'active',
      winner_team_ids: null,
      created_at: new Date().toISOString(),
    };
    tournaments.push(newTournament);
    localStorage.setItem('mabar_tournaments', JSON.stringify(tournaments));
    return newTournament;
  },
  updateTournamentWinner: async (id: string, winnerTeamIds: string[] | null): Promise<Tournament> => {
    const tournaments = await localDb.getTournaments();
    const index = tournaments.findIndex((t) => t.id === id);
    if (index === -1) throw new Error('Tournament not found');
    tournaments[index].winner_team_ids = winnerTeamIds;
    tournaments[index].status = winnerTeamIds ? 'completed' : 'active';
    localStorage.setItem('mabar_tournaments', JSON.stringify(tournaments));
    return tournaments[index];
  },
  setTournamentStatus: async (id: string, status: 'active' | 'completed'): Promise<Tournament> => {
    const tournaments = await localDb.getTournaments();
    const index = tournaments.findIndex((t) => t.id === id);
    if (index === -1) throw new Error('Tournament not found');
    tournaments[index].status = status;
    localStorage.setItem('mabar_tournaments', JSON.stringify(tournaments));
    return tournaments[index];
  },
  deleteTournament: async (id: string): Promise<void> => {
    const tournaments = await localDb.getTournaments();
    const updated = tournaments.filter((t) => t.id !== id);
    localStorage.setItem('mabar_tournaments', JSON.stringify(updated));

    // Also delete matches
    const matches = JSON.parse(localStorage.getItem('mabar_matches') || '[]');
    const filteredMatches = matches.filter((m: Match) => m.tournament_id !== id);
    localStorage.setItem('mabar_matches', JSON.stringify(filteredMatches));
  },

  // Matches CRUD
  getMatches: async (tournamentId: string): Promise<Match[]> => {
    initializeLocalStorage();
    const matches: Match[] = JSON.parse(localStorage.getItem('mabar_matches') || '[]');
    return matches.filter((m) => m.tournament_id === tournamentId);
  },
  getAllMatches: async (): Promise<Match[]> => {
    initializeLocalStorage();
    return JSON.parse(localStorage.getItem('mabar_matches') || '[]');
  },
  createMatches: async (newMatches: Match[]): Promise<Match[]> => {
    initializeLocalStorage();
    const matches: Match[] = JSON.parse(localStorage.getItem('mabar_matches') || '[]');
    matches.push(...newMatches);
    localStorage.setItem('mabar_matches', JSON.stringify(matches));
    return newMatches;
  },
  updateMatchScore: async (
    matchId: string,
    score1: number,
    score2: number,
    winner: 1 | 2,
    set_scores?: SetScore[]
  ): Promise<Match> => {
    initializeLocalStorage();
    const matches: Match[] = JSON.parse(localStorage.getItem('mabar_matches') || '[]');
    const index = matches.findIndex((m) => m.id === matchId);
    if (index === -1) throw new Error('Match not found');

    matches[index].score1 = score1;
    matches[index].score2 = score2;
    matches[index].winner = winner;
    if (set_scores) {
      matches[index].set_scores = set_scores;
    }

    localStorage.setItem('mabar_matches', JSON.stringify(matches));
    return matches[index];
  },
  updateMatchTeams: async (
    matchId: string,
    team1Ids: string[],
    team2Ids: string[]
  ): Promise<Match> => {
    initializeLocalStorage();
    const matches: Match[] = JSON.parse(localStorage.getItem('mabar_matches') || '[]');
    const index = matches.findIndex((m) => m.id === matchId);
    if (index === -1) throw new Error('Match not found');

    matches[index].team1_ids = team1Ids;
    matches[index].team2_ids = team2Ids;

    localStorage.setItem('mabar_matches', JSON.stringify(matches));
    return matches[index];
  },
  updateMatchFields: async (matchId: string, fields: Partial<Match>): Promise<Match> => {
    initializeLocalStorage();
    const matches: Match[] = JSON.parse(localStorage.getItem('mabar_matches') || '[]');
    const index = matches.findIndex((m) => m.id === matchId);
    if (index === -1) throw new Error('Match not found');
    matches[index] = { ...matches[index], ...fields };
    localStorage.setItem('mabar_matches', JSON.stringify(matches));
    return matches[index];
  },
  updateLeagueTeam: async (tournamentId: string, oldTeamIds: string[], newTeamIds: string[]): Promise<void> => {
    initializeLocalStorage();
    const oldKey = [...oldTeamIds].sort().join('_');
    const newKey = [...newTeamIds].sort().join('_');
    if (oldKey === newKey) return;
    const allMatches: Match[] = JSON.parse(localStorage.getItem('mabar_matches') || '[]');
    const tournamentMatches = allMatches.filter((m) => m.tournament_id === tournamentId);
    // validate not duplicate team or player overlap with other teams
    const otherTeams = new Set<string>();
    const otherPlayerIds = new Set<string>();
    tournamentMatches.forEach((m) => {
      [m.team1_ids, m.team2_ids].forEach((team) => {
        if (!team || team.length === 0) return;
        const k = [...team].sort().join('_');
        if (k !== oldKey) {
          otherTeams.add(k);
          team.forEach((pid) => otherPlayerIds.add(pid));
        }
      });
    });
    if (otherTeams.has(newKey)) throw new Error('Tim tersebut sudah ada di liga');
    for (const pid of newTeamIds) {
      if (otherPlayerIds.has(pid) && !oldTeamIds.includes(pid)) {
        throw new Error('Salah satu pemain sudah ada di tim lain');
      }
    }
    // also check within newTeamIds no duplicate
    if (new Set(newTeamIds).size !== newTeamIds.length) throw new Error('Pemain tidak boleh duplikat dalam satu tim');
    let updated = false;
    for (const m of allMatches) {
      if (m.tournament_id !== tournamentId) continue;
      let changed = false;
      if ([...m.team1_ids].sort().join('_') === oldKey) { m.team1_ids = [...newTeamIds]; changed = true; }
      if ([...m.team2_ids].sort().join('_') === oldKey) { m.team2_ids = [...newTeamIds]; changed = true; }
      if (changed) updated = true;
    }
    if (!updated) throw new Error('Tim tidak ditemukan di jadwal liga');
    localStorage.setItem('mabar_matches', JSON.stringify(allMatches));
  },
};

// ── Add-team / Fill-bye helper ──
// Fills the empty slot of a round-1 BYE match with a new team, and undoes the
// auto-advance that the bye team had already received (so it has to play again).
// Returns the list of matches that were modified (caller persists them).
const prepareTeamFill = (
  matches: Match[],
  matchId: string,
  emptySlot: 'team1' | 'team2',
  newTeamIds: string[]
): Match[] => {
  const byId = new Map<string, Match>(matches.map((m) => [m.id, m]));
  const target = byId.get(matchId);
  if (!target) throw new Error('Pertandingan tidak ditemukan');

  if (emptySlot === 'team1') target.team1_ids = [...newTeamIds];
  else target.team2_ids = [...newTeamIds];

  // It's a real match now — clear any auto-bye result
  target.winner = null;
  target.score1 = null;
  target.score2 = null;
  target.set_scores = null;

  const toUpdate: Match[] = [target];

  // Undo the auto-advance of the previously-lone team into the parent match.
  if (target.next_match_id) {
    const parent = byId.get(target.next_match_id);
    if (parent) {
      const slotKey = target.next_match_is_team2 ? 'team2_ids' : 'team1_ids';
      if (parent[slotKey].length > 0) {
        // Can't undo a bye whose advanced team has already been played.
        if (parent.winner !== null || parent.score1 !== null || parent.score2 !== null) {
          throw new Error('Slot bye ini sudah terlanjur dimainkan. Gunakan slot bye lain.');
        }
        parent[slotKey] = [];
        toUpdate.push(parent);
      }
    }
  }

  return toUpdate;
};

// First empty slot of a match ('team1' wins ties, so fully-empty matches are fillable too).
const getEmptySlot = (m: Match): 'team1' | 'team2' | null => {
  if (!m.team1_ids || m.team1_ids.length === 0) return 'team1';
  if (!m.team2_ids || m.team2_ids.length === 0) return 'team2';
  return null;
};

// A round-1 slot that can still receive a new team (parent hasn't been played yet).
const isSafeFillableSlot = (matches: Match[], m: Match): boolean => {
  if (m.round !== 1 || getEmptySlot(m) === null) return false;
  if (m.next_match_id) {
    const parent = matches.find((p) => p.id === m.next_match_id);
    if (parent && (parent.winner !== null || parent.score1 !== null || parent.score2 !== null)) return false;
  }
  return true;
};

// Expands a full bracket (exact power-of-2 team count) by one round so a late team
// can join, WITHOUT moving/shuffling any existing matches. Existing matches keep
// their teams; only the old final gets rewired to feed a new final.
const expandBracket = async (matches: Match[], tournamentId: string, newTeamIds: string[]): Promise<void> => {
  const byKey = new Map<string, Match>(matches.map((m) => [`${m.round}_${m.match_index}`, m]));
  const oldRounds = Math.max(...matches.map((m) => m.round), 1);
  const oldTeamCount = Math.pow(2, oldRounds);
  const newRounds = Math.ceil(Math.log2(oldTeamCount + 1));
  if (newRounds <= oldRounds) throw new Error('Bagan tidak dapat diperluas');

  // Pre-generate ids for the new matches.
  const idMap = new Map<string, string>();
  for (let r = 1; r <= newRounds; r++) {
    const cnt = Math.pow(2, newRounds - r);
    for (let m = 0; m < cnt; m++) {
      const key = `${r}_${m}`;
      if (!byKey.has(key)) idMap.set(key, crypto.randomUUID());
    }
  }

  const toCreate: any[] = [];
  const toUpdate: Match[] = [];

  for (let r = 1; r <= newRounds; r++) {
    const cnt = Math.pow(2, newRounds - r);
    for (let m = 0; m < cnt; m++) {
      const key = `${r}_${m}`;

      let nextMatchId: string | null = null;
      let nextMatchIsTeam2 = false;
      if (r < newRounds) {
        const parentKey = `${r + 1}_${Math.floor(m / 2)}`;
        const parent = byKey.get(parentKey);
        nextMatchId = parent ? parent.id : idMap.get(parentKey) || null;
        nextMatchIsTeam2 = m % 2 !== 0;
      }

      const existing = byKey.get(key);
      if (existing) {
        // Only the old final gets re-pointed to the new final.
        if (existing.next_match_id !== nextMatchId || existing.next_match_is_team2 !== nextMatchIsTeam2) {
          existing.next_match_id = nextMatchId;
          existing.next_match_is_team2 = nextMatchIsTeam2;
          toUpdate.push(existing);
        }
        continue;
      }

      toCreate.push({
        id: idMap.get(key)!,
        tournament_id: tournamentId,
        round: r,
        match_index: m,
        team1_ids: [],
        team2_ids: [],
        score1: null,
        score2: null,
        winner: null,
        next_match_id: nextMatchId,
        next_match_is_team2: nextMatchIsTeam2,
        created_at: new Date().toISOString(),
      });
    }
  }

  // Place the new team in the LAST round-1 match (opposite side of the old bracket).
  const lastR1Key = `1_${Math.pow(2, newRounds - 1) - 1}`;
  const lastR1 = toCreate.find((c) => `${c.round}_${c.match_index}` === lastR1Key);
  if (lastR1) {
    lastR1.team1_ids = [...newTeamIds];
    lastR1.score1 = 0;
    lastR1.score2 = 0;
    lastR1.winner = 1;
  }

  // Insert new matches in dependency order (highest round first) so each match's
  // next_match_id parent already exists when its FK constraint is checked.
  for (let r = newRounds; r >= 1; r--) {
    const roundCreates = toCreate.filter((c) => c.round === r);
    if (roundCreates.length) await db.createMatches(roundCreates);
  }

  // Now rewire the old final to feed the new final (the new final already exists).
  for (const m of toUpdate) {
    await db.updateMatchFields(m.id, {
      next_match_id: m.next_match_id,
      next_match_is_team2: m.next_match_is_team2,
    });
  }

  // Walk the new team up to the final through its (empty) subtree byes.
  await propagateNewTeamUpward(tournamentId, newRounds);
};

// Walks the newly-added team up from its round-1 slot to the new final, marking
// each intermediate match as a bye (the team advances) and leaving the final
// waiting for its real opponent.
const propagateNewTeamUpward = async (tournamentId: string, newRounds: number): Promise<void> => {
  const all = await db.getMatches(tournamentId);
  const byKey = new Map<string, Match>(all.map((m) => [`${m.round}_${m.match_index}`, m]));

  let r = 1;
  let m = Math.pow(2, newRounds - 1) - 1; // last round-1 match
  let teamSlot: 'team1' | 'team2' = 'team1';

  while (r < newRounds) {
    const current = byKey.get(`${r}_${m}`);
    if (!current) break;
    const team = current[teamSlot === 'team1' ? 'team1_ids' : 'team2_ids'];
    if (!team || team.length === 0) break;

    const nextMatch = current.next_match_id
      ? byKey.get(`${r + 1}_${Math.floor(m / 2)}`) || all.find((x) => x.id === current.next_match_id)
      : null;
    if (!nextMatch) break;

    const nextSlot: 'team1' | 'team2' = current.next_match_is_team2 ? 'team2' : 'team1';
    nextMatch[nextSlot === 'team1' ? 'team1_ids' : 'team2_ids'] = [...team];

    if (r + 1 < newRounds) {
      // Intermediate match → auto-bye so the team keeps advancing.
      nextMatch.winner = nextSlot === 'team1' ? 1 : 2;
      nextMatch.score1 = 0;
      nextMatch.score2 = 0;
    } else {
      // The new final → team is placed but must wait for its opponent.
      nextMatch.winner = null;
      nextMatch.score1 = null;
      nextMatch.score2 = null;
    }

    await db.updateMatchFields(nextMatch.id, {
      team1_ids: nextMatch.team1_ids,
      team2_ids: nextMatch.team2_ids,
      winner: nextMatch.winner,
      score1: nextMatch.score1,
      score2: nextMatch.score2,
    });

    r++;
    m = Math.floor(m / 2);
    teamSlot = nextSlot;
  }
};

// Unified Database API
export const db = {
  // Players
  getPlayers: async (): Promise<Player[]> => {
    if (supabase) {
      const { data, error } = await supabase.from('players').select('*').order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    }
    return localDb.getPlayers();
  },
  createPlayer: async (name: string): Promise<Player> => {
    if (supabase) {
      const { data, error } = await supabase.from('players').insert([{ name }]).select().single();
      if (error) {
        if (error.code === '23505') throw new Error('Player name already exists');
        throw error;
      }
      return data;
    }
    return localDb.createPlayer(name);
  },
  updatePlayer: async (id: string, name: string): Promise<Player> => {
    if (supabase) {
      const { data, error } = await supabase.from('players').update({ name }).eq('id', id).select().single();
      if (error) {
        if (error.code === '23505') throw new Error('Player name already exists');
        throw error;
      }
      return data;
    }
    return localDb.updatePlayer(id, name);
  },
  deletePlayer: async (id: string): Promise<void> => {
    if (supabase) {
      const { error } = await supabase.from('players').delete().eq('id', id);
      if (error) throw error;
      return;
    }
    return localDb.deletePlayer(id);
  },

  // Tournaments
  getTournaments: async (): Promise<Tournament[]> => {
    if (supabase) {
      const { data, error } = await supabase.from('tournaments').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      const bridge = JSON.parse(localStorage.getItem('mabar_tournament_mode_bridge') || '{}');
      return (data || []).map((t: any) => ({
        ...t,
        mode: t.mode || bridge[t.id] || 'knockout',
      }));
    }
    return localDb.getTournaments();
  },
  getTournamentById: async (id: string): Promise<Tournament | null> => {
    if (supabase) {
      const { data, error } = await supabase.from('tournaments').select('*').eq('id', id).single();
      if (error) return null;
      const bridge = JSON.parse(localStorage.getItem('mabar_tournament_mode_bridge') || '{}');
      return { ...data, mode: (data as any).mode || bridge[data.id] || 'knockout' };
    }
    return localDb.getTournamentById(id);
  },
  createTournament: async (name: string, date: string, format: 'single' | 'double', mode: TournamentMode = 'knockout'): Promise<Tournament> => {
    if (supabase) {
      const payload: any = { name, date, format, status: 'active', mode };
      const { data, error } = await supabase
        .from('tournaments')
        .insert([payload])
        .select()
        .single();
      if (error) {
        // fallback if mode column missing (older schema)
        const msg = (error.message || '').toLowerCase();
        if (msg.includes('mode') || msg.includes('column') || msg.includes('schema cache')) {
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('tournaments')
            .insert([{ name, date, format, status: 'active' }])
            .select()
            .single();
          if (fallbackError) throw fallbackError;
          // store mode in localStorage bridge
          const bridge = JSON.parse(localStorage.getItem('mabar_tournament_mode_bridge') || '{}');
          bridge[fallbackData.id] = mode;
          localStorage.setItem('mabar_tournament_mode_bridge', JSON.stringify(bridge));
          fallbackData.mode = mode;
          return fallbackData;
        }
        throw error;
      }
      return data;
    }
    return localDb.createTournament(name, date, format, mode);
  },
  updateTournamentWinner: async (id: string, winnerTeamIds: string[] | null): Promise<Tournament> => {
    if (supabase) {
      const { data, error } = await supabase
        .from('tournaments')
        .update({
          winner_team_ids: winnerTeamIds,
          status: winnerTeamIds ? 'completed' : 'active',
        })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    }
    return localDb.updateTournamentWinner(id, winnerTeamIds);
  },
  setTournamentStatus: async (id: string, status: 'active' | 'completed'): Promise<Tournament> => {
    if (supabase) {
      const { data, error } = await supabase
        .from('tournaments')
        .update({ status })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    }
    return localDb.setTournamentStatus(id, status);
  },
  deleteTournament: async (id: string): Promise<void> => {
    if (supabase) {
      const { error } = await supabase.from('tournaments').delete().eq('id', id);
      if (error) throw error;
      return;
    }
    return localDb.deleteTournament(id);
  },

  // Matches
  getMatches: async (tournamentId: string): Promise<Match[]> => {
    if (supabase) {
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('round', { ascending: true })
        .order('match_index', { ascending: true });
      if (error) throw error;
      // Restore set_scores from localStorage bridge if missing in DB
      const bridgeData = JSON.parse(localStorage.getItem('mabar_set_scores_bridge') || '{}');
      return (data || []).map((m: Match) => {
        if (!m.set_scores && bridgeData[m.id]) {
          m.set_scores = bridgeData[m.id];
        }
        return m;
      });
    }
    return localDb.getMatches(tournamentId);
  },
  getAllMatches: async (): Promise<Match[]> => {
    if (supabase) {
      const { data, error } = await supabase.from('matches').select('*');
      if (error) throw error;
      // Restore set_scores from localStorage bridge if missing in DB
      const bridgeData = JSON.parse(localStorage.getItem('mabar_set_scores_bridge') || '{}');
      return (data || []).map((m: Match) => {
        if (!m.set_scores && bridgeData[m.id]) {
          m.set_scores = bridgeData[m.id];
        }
        return m;
      });
    }
    return localDb.getAllMatches();
  },
  createMatches: async (newMatches: Omit<Match, 'id' | 'created_at'>[]): Promise<Match[]> => {
    if (supabase) {
      const { data, error } = await supabase.from('matches').insert(newMatches).select();
      if (error) throw error;
      return data || [];
    }
    const matchesWithIds = newMatches.map((m: any) => ({
      ...m,
      id: m.id || crypto.randomUUID(),
      created_at: m.created_at || new Date().toISOString(),
    }));
    return localDb.createMatches(matchesWithIds);
  },
  updateMatchScore: async (
    matchId: string,
    score1: number,
    score2: number,
    winner: 1 | 2,
    set_scores?: SetScore[]
  ): Promise<Match> => {
    if (supabase) {
      // Send score data; if set_scores column doesn't exist, retry without it
      const updatePayload: any = { score1, score2, winner };
      if (set_scores) updatePayload.set_scores = set_scores;
      const { data, error } = await supabase
        .from('matches')
        .update(updatePayload)
        .eq('id', matchId)
        .select()
        .single();
      if (error) {
        // Column might not exist yet — retry without set_scores
        const msg = (error.message || '').toLowerCase();
        if (set_scores && (msg.includes('set_scores') || msg.includes('column') || msg.includes('schema cache'))) {
          // Save set_scores in localStorage as bridge since Supabase column is missing
          if (set_scores) {
            const bridgeData = JSON.parse(localStorage.getItem('mabar_set_scores_bridge') || '{}');
            bridgeData[matchId] = set_scores;
            localStorage.setItem('mabar_set_scores_bridge', JSON.stringify(bridgeData));
          }
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('matches')
            .update({ score1, score2, winner })
            .eq('id', matchId)
            .select()
            .single();
          if (fallbackError) throw fallbackError;
          // Attach set_scores from bridge so returned match has it
          if (fallbackData && set_scores) {
            fallbackData.set_scores = set_scores;
          }
          return fallbackData;
        }
        throw error;
      }
      return data;
    }
    return localDb.updateMatchScore(matchId, score1, score2, winner, set_scores);
  },
  updateMatchTeams: async (
    matchId: string,
    team1Ids: string[],
    team2Ids: string[]
  ): Promise<Match> => {
    if (supabase) {
      const { data, error } = await supabase
        .from('matches')
        .update({ team1_ids: team1Ids, team2_ids: team2Ids })
        .eq('id', matchId)
        .select()
        .single();
      if (error) throw error;
      return data;
    }
    return localDb.updateMatchTeams(matchId, team1Ids, team2Ids);
  },
  updateMatchFields: async (matchId: string, fields: Partial<Match>): Promise<Match> => {
    if (supabase) {
      const payload: any = {};
      if (fields.team1_ids !== undefined) payload.team1_ids = fields.team1_ids;
      if (fields.team2_ids !== undefined) payload.team2_ids = fields.team2_ids;
      if (fields.winner !== undefined) payload.winner = fields.winner;
      if (fields.score1 !== undefined) payload.score1 = fields.score1;
      if (fields.score2 !== undefined) payload.score2 = fields.score2;
      if (fields.set_scores !== undefined) payload.set_scores = fields.set_scores;
      if (fields.next_match_id !== undefined) payload.next_match_id = fields.next_match_id;
      if (fields.next_match_is_team2 !== undefined) payload.next_match_is_team2 = fields.next_match_is_team2;

      const { data, error } = await supabase
        .from('matches')
        .update(payload)
        .eq('id', matchId)
        .select()
        .single();
      if (error) {
        const msg = (error.message || '').toLowerCase();
        if (fields.set_scores !== undefined && (msg.includes('set_scores') || msg.includes('column') || msg.includes('schema cache'))) {
          // Column missing — keep set_scores in the localStorage bridge
          const bridgeData = JSON.parse(localStorage.getItem('mabar_set_scores_bridge') || '{}');
          if (fields.set_scores === null) delete bridgeData[matchId];
          else bridgeData[matchId] = fields.set_scores;
          localStorage.setItem('mabar_set_scores_bridge', JSON.stringify(bridgeData));

          const fallbackPayload = { ...payload };
          delete fallbackPayload.set_scores;
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('matches')
            .update(fallbackPayload)
            .eq('id', matchId)
            .select()
            .single();
          if (fallbackError) throw fallbackError;
          if (fallbackData && fields.set_scores !== null) fallbackData.set_scores = fields.set_scores;
          return fallbackData;
        }
        throw error;
      }
      return data;
    }
    return localDb.updateMatchFields(matchId, fields);
  },
  addTeamToTournament: async (
    tournamentId: string,
    matchId: string | null,
    newTeamIds: string[]
  ): Promise<{ expanded: boolean }> => {
    const tournament = await db.getTournamentById(tournamentId);
    const mode = (tournament as any)?.mode || 'knockout';
    const matches = await db.getMatches(tournamentId);

    // ── League mode: every new team plays everyone else ──
    if (mode === 'league') {
      // Collect existing distinct teams
      const teamKeys = new Set<string>();
      const teamMap = new Map<string, string[]>();
      matches.forEach((m) => {
        if (m.team1_ids?.length) {
          const k = [...m.team1_ids].sort().join('_');
          if (!teamKeys.has(k)) { teamKeys.add(k); teamMap.set(k, m.team1_ids); }
        }
        if (m.team2_ids?.length) {
          const k = [...m.team2_ids].sort().join('_');
          if (!teamKeys.has(k)) { teamKeys.add(k); teamMap.set(k, m.team2_ids); }
        }
      });
      const newKey = [...newTeamIds].sort().join('_');
      if (teamKeys.has(newKey)) throw new Error('Tim sudah ada di liga');

      const existingTeams = Array.from(teamMap.values());
      if (existingTeams.length === 0) throw new Error('Tidak ada tim di liga');

      const nextIdx = matches.length > 0 ? Math.max(...matches.map((m) => m.match_index)) + 1 : 0;
      const toCreate: any[] = existingTeams.map((opponent, i) => ({
        id: crypto.randomUUID(),
        tournament_id: tournamentId,
        round: 1,
        match_index: nextIdx + i,
        team1_ids: [...opponent],
        team2_ids: [...newTeamIds],
        score1: null,
        score2: null,
        winner: null,
        next_match_id: null,
        next_match_is_team2: false,
        created_at: new Date().toISOString(),
      }));
      if (toCreate.length) await db.createMatches(toCreate);
      return { expanded: false };
    }

    // ── Knockout mode: existing logic ──
    // Explicit target (clicked a specific slot).
    if (matchId) {
      const target = matches.find((m) => m.id === matchId);
      const slot = target ? getEmptySlot(target) : null;
      if (!target || !slot) throw new Error('Slot pertandingan sudah terisi atau tidak ditemukan');
      const toUpdate = prepareTeamFill(matches, matchId, slot, newTeamIds);
      for (const m of toUpdate) {
        await db.updateMatchFields(m.id, {
          team1_ids: m.team1_ids,
          team2_ids: m.team2_ids,
          winner: m.winner,
          score1: m.score1,
          score2: m.score2,
          set_scores: m.set_scores,
        });
      }
      return { expanded: false };
    }

    // Auto-find the first available slot.
    const fillable = matches.find((m) => isSafeFillableSlot(matches, m));
    if (fillable) {
      const slot = getEmptySlot(fillable)!;
      const toUpdate = prepareTeamFill(matches, fillable.id, slot, newTeamIds);
      for (const m of toUpdate) {
        await db.updateMatchFields(m.id, {
          team1_ids: m.team1_ids,
          team2_ids: m.team2_ids,
          winner: m.winner,
          score1: m.score1,
          score2: m.score2,
          set_scores: m.set_scores,
        });
      }
      return { expanded: false };
    }

    // No room left → expand the bracket without touching existing matches.
    await expandBracket(matches, tournamentId, newTeamIds);
    return { expanded: true };
  },
  updateLeagueTeam: async (tournamentId: string, oldTeamIds: string[], newTeamIds: string[]): Promise<void> => {
    const tournament = await db.getTournamentById(tournamentId);
    const mode = (tournament as any)?.mode || 'knockout';
    if (mode !== 'league') throw new Error('Ganti pasangan hanya untuk mode Liga');
    const format = (tournament as any)?.format;
    const needed = format === 'double' ? 2 : 1;
    if (newTeamIds.length !== needed) throw new Error(needed === 2 ? 'Pilih 2 pemain untuk ganda' : 'Pilih 1 pemain untuk tunggal');
    if (new Set(newTeamIds).size !== newTeamIds.length) throw new Error('Pemain tidak boleh duplikat dalam satu tim');
    const oldKey = [...oldTeamIds].sort().join('_');
    const newKey = [...newTeamIds].sort().join('_');
    if (oldKey === newKey) return;
    const matches = await db.getMatches(tournamentId);
    const otherTeams = new Set<string>();
    const otherPlayerIds = new Set<string>();
    matches.forEach((m) => {
      [m.team1_ids, m.team2_ids].forEach((team) => {
        if (!team || team.length === 0) return;
        const k = [...team].sort().join('_');
        if (k !== oldKey) { otherTeams.add(k); team.forEach((pid: string) => otherPlayerIds.add(pid)); }
      });
    });
    if (otherTeams.has(newKey)) throw new Error('Tim tersebut sudah ada di liga');
    for (const pid of newTeamIds) {
      if (otherPlayerIds.has(pid) && !oldTeamIds.includes(pid)) throw new Error('Salah satu pemain sudah ada di tim lain di liga ini');
    }
    // collect matches to update
    const toUpdate = matches.filter((m) => [...m.team1_ids].sort().join('_') === oldKey || [...m.team2_ids].sort().join('_') === oldKey);
    if (toUpdate.length === 0) throw new Error('Tim tidak ditemukan di jadwal liga');
    for (const m of toUpdate) {
      const newTeam1 = [...m.team1_ids].sort().join('_') === oldKey ? [...newTeamIds] : m.team1_ids;
      const newTeam2 = [...m.team2_ids].sort().join('_') === oldKey ? [...newTeamIds] : m.team2_ids;
      await db.updateMatchFields(m.id, { team1_ids: newTeam1, team2_ids: newTeam2 });
    }
    // if champion was old team, update tournament winner
    const t = await db.getTournamentById(tournamentId);
    if (t?.winner_team_ids && [...t.winner_team_ids].sort().join('_') === oldKey) {
      await db.updateTournamentWinner(tournamentId, [...newTeamIds]);
    }
  },
};
