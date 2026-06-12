import { createClient } from '@supabase/supabase-js';

export interface Player {
  id: string;
  name: string;
  created_at: string;
}

export interface Tournament {
  id: string;
  name: string;
  date: string;
  format: 'single' | 'double';
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
let setScoresColumnExists = false;

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
        setScoresColumnExists = false;
        console.info(
          '%c[Badminton App] set_scores column not found in Supabase.\n' +
          'Run this SQL in your Supabase SQL Editor to enable cloud persistence:\n\n' +
          'ALTER TABLE matches ADD COLUMN IF NOT EXISTS set_scores JSONB DEFAULT NULL;\n\n' +
          'Until then, set_scores are saved in localStorage (browser only).',
          'color: #f59e0b; font-weight: bold;'
        );
      } else {
        setScoresColumnExists = false;
      }
    } else {
      setScoresColumnExists = true;
      console.info('%c[Badminton App] set_scores column detected ✓', 'color: #22c55e;');
    }
  } catch {
    setScoresColumnExists = false;
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
    return JSON.parse(localStorage.getItem('mabar_tournaments') || '[]');
  },
  getTournamentById: async (id: string): Promise<Tournament | null> => {
    const list = await localDb.getTournaments();
    return list.find((t) => t.id === id) || null;
  },
  createTournament: async (name: string, date: string, format: 'single' | 'double'): Promise<Tournament> => {
    const tournaments = await localDb.getTournaments();
    const newTournament: Tournament = {
      id: crypto.randomUUID(),
      name,
      date,
      format,
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
      return data || [];
    }
    return localDb.getTournaments();
  },
  getTournamentById: async (id: string): Promise<Tournament | null> => {
    if (supabase) {
      const { data, error } = await supabase.from('tournaments').select('*').eq('id', id).single();
      if (error) return null;
      return data;
    }
    return localDb.getTournamentById(id);
  },
  createTournament: async (name: string, date: string, format: 'single' | 'double'): Promise<Tournament> => {
    if (supabase) {
      const { data, error } = await supabase
        .from('tournaments')
        .insert([{ name, date, format, status: 'active' }])
        .select()
        .single();
      if (error) throw error;
      return data;
    }
    return localDb.createTournament(name, date, format);
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
};
