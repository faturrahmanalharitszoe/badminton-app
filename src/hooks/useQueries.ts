import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '../lib/supabase';
import type { Player, Match, SetScore } from '../lib/supabase';

// Keys
export const queryKeys = {
  players: ['players'] as const,
  tournaments: ['tournaments'] as const,
  tournament: (id: string) => ['tournament', id] as const,
  matches: (tournamentId: string) => ['matches', tournamentId] as const,
};

// -------------------------------------------------------------
// PLAYERS HOOKS
// -------------------------------------------------------------
export const usePlayers = () => {
  return useQuery({
    queryKey: queryKeys.players,
    queryFn: db.getPlayers,
  });
};

export const useAddPlayer = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: db.createPlayer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.players });
    },
  });
};

export const useUpdatePlayer = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => db.updatePlayer(id, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.players });
    },
  });
};

export const useDeletePlayer = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: db.deletePlayer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.players });
    },
  });
};

// -------------------------------------------------------------
// TOURNAMENTS HOOKS
// -------------------------------------------------------------
export const useTournaments = () => {
  return useQuery({
    queryKey: queryKeys.tournaments,
    queryFn: db.getTournaments,
  });
};

export const useTournament = (id: string) => {
  return useQuery({
    queryKey: queryKeys.tournament(id),
    queryFn: () => db.getTournamentById(id),
    enabled: Boolean(id),
  });
};

export const useDeleteTournament = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: db.deleteTournament,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tournaments });
    },
  });
};

// -------------------------------------------------------------
// BRACKET GENERATION & TOURNAMENT INITIALIZATION HOOK
// -------------------------------------------------------------
export const useAddTournament = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      name,
      date,
      format,
      teams, // Array of team arrays, e.g. [[player1, player2], [player3, player4]]
    }: {
      name: string;
      date: string;
      format: 'single' | 'double';
      teams: string[][]; // Array of player IDs
    }) => {
      // 1. Create the tournament
      const tournament = await db.createTournament(name, date, format);
      const tId = tournament.id;

      const numTeams = teams.length;
      if (numTeams < 2) {
        throw new Error('Need at least 2 teams to create a tournament');
      }

      // Calculate rounds: ceil(log2(numTeams))
      const rounds = Math.ceil(Math.log2(numTeams));

      // We will generate the matches round-by-round from Finals down to Round 1.
      // Store matches in a map: round_index -> Match placeholder
      // Key: `${round}_${match_index}`
      const matchMap = new Map<string, Omit<Match, 'id' | 'created_at'>>();

      // Let's create placeholders in memory and keep track of relations.
      // In JS, to generate the IDs, we can pre-generate UUIDs for all nodes.
      const matchIdMap = new Map<string, string>();

      // Pre-allocate UUIDs
      for (let r = 1; r <= rounds; r++) {
        const matchesInRound = Math.pow(2, rounds - r);
        for (let m = 0; m < matchesInRound; m++) {
          matchIdMap.set(`${r}_${m}`, crypto.randomUUID());
        }
      }

      // Generate nodes from Finals (round = rounds) down to Round 1 (round = 1)
      for (let r = rounds; r >= 1; r--) {
        const matchesInRound = Math.pow(2, rounds - r);
        for (let m = 0; m < matchesInRound; m++) {
          const key = `${r}_${m}`;
          const currentId = matchIdMap.get(key)!;

          // Next match calculations (feeds into parent)
          let nextMatchId: string | null = null;
          let nextMatchIsTeam2 = false;

          if (r < rounds) {
            const parentIndex = Math.floor(m / 2);
            const parentKey = `${r + 1}_${parentIndex}`;
            nextMatchId = matchIdMap.get(parentKey) || null;
            nextMatchIsTeam2 = m % 2 !== 0;
          }

          matchMap.set(key, {
            id: currentId,
            tournament_id: tId,
            round: r,
            match_index: m,
            team1_ids: [],
            team2_ids: [],
            score1: null,
            score2: null,
            winner: null,
            next_match_id: nextMatchId,
            next_match_is_team2: nextMatchIsTeam2,
          } as any);
        }
      }

      // Distribute teams in Round 1 (round = 1)
      const numMatchesRound1 = Math.pow(2, rounds - 1);

      // How many matches will have 2 teams playing: teams.length - numMatchesRound1
      // How many matches will have 1 team (bye): 2 * numMatchesRound1 - teams.length
      const doubleMatches = numTeams - numMatchesRound1;

      let teamPointer = 0;

      for (let m = 0; m < numMatchesRound1; m++) {
        const key = `1_${m}`;
        const matchData = matchMap.get(key)!;

        if (m < doubleMatches) {
          // Playing match (2 teams)
          matchData.team1_ids = teams[teamPointer++];
          matchData.team2_ids = teams[teamPointer++];
        } else if (teamPointer < numTeams) {
          // Bye match (1 team, empty second team)
          matchData.team1_ids = teams[teamPointer++];
          matchData.team2_ids = []; // Bye

          // Since it's a bye, we automatically set it as won!
          matchData.score1 = 0;
          matchData.score2 = 0;
          matchData.winner = 1;
        } else {
          // Completely empty slot (should not happen if teams are sorted, but handle safely)
          matchData.team1_ids = [];
          matchData.team2_ids = [];
        }
      }

      // ── Resolve duplicate-player conflicts in Round 1 ──
      // When an odd player is duplicated across two teams, those teams might end up
      // facing each other in the same match. Swap one team to the other half of the
      // bracket so the duplicated player's two teams can only meet in the Final.
      const halfSize = Math.ceil(numMatchesRound1 / 2);
      for (let m = 0; m < numMatchesRound1; m++) {
        const key = `1_${m}`;
        const match = matchMap.get(key)!;
        if (match.team1_ids.length === 0 || match.team2_ids.length === 0) continue;

        const allIds = [...match.team1_ids, ...match.team2_ids];
        const conflictPlayer = allIds.find((p: string, i: number) => allIds.indexOf(p) !== i);
        if (!conflictPlayer) continue;

        // Find another match in the opposite half to swap with
        const inTopHalf = m < halfSize;
        const searchStart = inTopHalf ? halfSize : 0;
        const searchEnd = inTopHalf ? numMatchesRound1 : halfSize;

        for (let j = searchStart; j < searchEnd; j++) {
          if (j === m) continue;
          const otherKey = `1_${j}`;
          const other = matchMap.get(otherKey)!;
          if (other.team1_ids.length === 0) continue;

          // Swap team2 of current match with team1 of the other-half match
          const tmpTeam = [...match.team2_ids];
          const otherTeam = [...other.team1_ids];
          match.team2_ids = otherTeam;
          other.team1_ids = tmpTeam;

          // Check if conflict resolved in current match
          const newAll = [...match.team1_ids, ...match.team2_ids];
          if (!newAll.some((p: string, i: number) => newAll.indexOf(p) !== i)) break;

          // Revert if still conflicting
          match.team2_ids = tmpTeam;
          other.team1_ids = otherTeam;
        }
      }

      // Propagate byes to Round 2 immediately!
      // This is a premium touch. If any match in Round 1 has a winner already (due to bye),
      // we push that team to the parent node in Round 2.
      for (let m = 0; m < numMatchesRound1; m++) {
        const key = `1_${m}`;
        const matchData = matchMap.get(key)!;

        if (matchData.winner === 1 && matchData.next_match_id) {
          const parentRound = 2;
          const parentIndex = Math.floor(m / 2);
          const parentKey = `${parentRound}_${parentIndex}`;
          const parentMatch = matchMap.get(parentKey);

          if (parentMatch) {
            if (matchData.next_match_is_team2) {
              parentMatch.team2_ids = matchData.team1_ids;
            } else {
              parentMatch.team1_ids = matchData.team1_ids;
            }
          }
        }
      }

      // Convert all mapped matches into an array to write to DB
      const matchesArray = Array.from(matchMap.values()) as any[];

      // Batch write matches
      await db.createMatches(matchesArray);

      return tournament;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tournaments });
    },
  });
};

// -------------------------------------------------------------
// MATCHES HOOKS
// -------------------------------------------------------------
export const useMatches = (tournamentId: string) => {
  return useQuery({
    queryKey: queryKeys.matches(tournamentId),
    queryFn: () => db.getMatches(tournamentId),
    enabled: Boolean(tournamentId),
  });
};

export const useUpdateMatchScore = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      tournamentId,
      match,
      score1,
      score2,
      winner,
      set_scores,
    }: {
      tournamentId: string;
      match: Match;
      score1: number;
      score2: number;
      winner: 1 | 2;
      set_scores?: SetScore[];
    }) => {
      // 1. Update the match score
      const updatedMatch = await db.updateMatchScore(match.id, score1, score2, winner, set_scores);

      const winnerTeamIds = winner === 1 ? match.team1_ids : match.team2_ids;

      // Fetch all matches for the tournament to coordinate propagation
      const allMatches = await db.getMatches(tournamentId);

      // 2. Propagate winner to next match if it exists
      if (match.next_match_id) {
        const nextMatch = allMatches.find((m) => m.id === match.next_match_id);
        if (!nextMatch) throw new Error('Next match not found for propagation');

        let nextTeam1 = nextMatch.team1_ids;
        let nextTeam2 = nextMatch.team2_ids;

        if (match.next_match_is_team2) {
          nextTeam2 = winnerTeamIds;
        } else {
          nextTeam1 = winnerTeamIds;
        }

        // Update teams for the next match
        await db.updateMatchTeams(match.next_match_id, nextTeam1, nextTeam2);
      } else {
        // No next match! This is the Finals match!
        // Update the tournament winner
        await db.updateTournamentWinner(tournamentId, winnerTeamIds);
      }

      return updatedMatch;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.matches(variables.tournamentId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.tournament(variables.tournamentId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.tournaments });
    },
  });
};

// -------------------------------------------------------------
// LEADERBOARD & STATS COMPUTATION HOOKS
// -------------------------------------------------------------
export interface PairRanking {
  pairKey: string;
  player1: Player;
  player2: Player;
  matchesPlayed: number;
  wins: number;
  losses: number;
  winRate: number;
  pointsWon: number;
  pointsLost: number;
  pointDiff: number;
  form: ('W' | 'L')[];
}

export interface IndividualRanking {
  playerId: string;
  name: string;
  matchesPlayed: number;
  wins: number;
  losses: number;
  winRate: number;
  pointsWon: number;
  pointsLost: number;
  pointDiff: number;
  form: ('W' | 'L')[];
}

export const useRankings = () => {
  const { data: players = [] } = usePlayers();

  return useQuery({
    queryKey: ['rankings'],
    queryFn: async () => {
      const allMatches = await db.getAllMatches();
      const playersMap = new Map<string, Player>(players.map((p) => [p.id, p]));

      // Group calculations
      const pairStats = new Map<string, {
        player1Id: string;
        player2Id: string;
        wins: number;
        losses: number;
        pointsWon: number;
        pointsLost: number;
        form: { date: string; result: 'W' | 'L' }[];
      }>();

      const indStats = new Map<string, {
        wins: number;
        losses: number;
        pointsWon: number;
        pointsLost: number;
        form: { date: string; result: 'W' | 'L' }[];
      }>();

      // Filter matches that are completed (have a winner) and format double (2 vs 2)
      // Note: we can also calculate singles, but user requested MD (Men's Doubles) context.
      const playedMatches = allMatches.filter((m) => m.winner !== null && m.score1 !== null && m.score2 !== null);

      // Sort matches by creation date so form guide is chronological
      const sortedMatches = [...playedMatches].sort((a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

      for (const m of sortedMatches) {
        const team1 = m.team1_ids || [];
        const team2 = m.team2_ids || [];
        const score1 = m.score1 ?? 0;
        const score2 = m.score2 ?? 0;
        const winner = m.winner;

        // Compute actual game points from set_scores if available, else fall back to set-count scores
        let t1Points = score1;
        let t2Points = score2;
        if (m.set_scores && m.set_scores.length > 0) {
          t1Points = m.set_scores.reduce((sum: number, s: any) => sum + (s.team1 || 0), 0);
          t2Points = m.set_scores.reduce((sum: number, s: any) => sum + (s.team2 || 0), 0);
        }

        const isDouble = team1.length === 2 && team2.length === 2;

        if (isDouble) {
          const t1_sorted = [...team1].sort();
          const t2_sorted = [...team2].sort();

          const p1Key = t1_sorted.join('_');
          const p2Key = t2_sorted.join('_');

          // Initialize stats
          if (!pairStats.has(p1Key)) {
            pairStats.set(p1Key, { player1Id: t1_sorted[0], player2Id: t1_sorted[1], wins: 0, losses: 0, pointsWon: 0, pointsLost: 0, form: [] });
          }
          if (!pairStats.has(p2Key)) {
            pairStats.set(p2Key, { player1Id: t2_sorted[0], player2Id: t2_sorted[1], wins: 0, losses: 0, pointsWon: 0, pointsLost: 0, form: [] });
          }

          const s1 = pairStats.get(p1Key)!;
          const s2 = pairStats.get(p2Key)!;

          s1.pointsWon += t1Points;
          s1.pointsLost += t2Points;
          s2.pointsWon += t2Points;
          s2.pointsLost += t1Points;

          if (winner === 1) {
            s1.wins++;
            s1.form.push({ date: m.created_at, result: 'W' });
            s2.losses++;
            s2.form.push({ date: m.created_at, result: 'L' });
          } else if (winner === 2) {
            s1.losses++;
            s1.form.push({ date: m.created_at, result: 'L' });
            s2.wins++;
            s2.form.push({ date: m.created_at, result: 'W' });
          }
        }

        // Individual stats (runs for all players in the match)
        const allParticipants = [...team1, ...team2];
        allParticipants.forEach((pId) => {
          if (!indStats.has(pId)) {
            indStats.set(pId, { wins: 0, losses: 0, pointsWon: 0, pointsLost: 0, form: [] });
          }
        });

        team1.forEach((pId) => {
          const s = indStats.get(pId)!;
          s.pointsWon += t1Points;
          s.pointsLost += t2Points;
          if (winner === 1) {
            s.wins++;
            s.form.push({ date: m.created_at, result: 'W' });
          } else if (winner === 2) {
            s.losses++;
            s.form.push({ date: m.created_at, result: 'L' });
          }
        });

        team2.forEach((pId) => {
          const s = indStats.get(pId)!;
          s.pointsWon += t2Points;
          s.pointsLost += t1Points;
          if (winner === 2) {
            s.wins++;
            s.form.push({ date: m.created_at, result: 'W' });
          } else if (winner === 1) {
            s.losses++;
            s.form.push({ date: m.created_at, result: 'L' });
          }
        });
      }

      // Format Pair Rankings
      const pairsList: PairRanking[] = [];
      pairStats.forEach((stat, key) => {
        const p1 = playersMap.get(stat.player1Id);
        const p2 = playersMap.get(stat.player2Id);

        // If one of the players was deleted, skip or use a fallback name
        if (p1 && p2) {
          const mp = stat.wins + stat.losses;
          pairsList.push({
            pairKey: key,
            player1: p1,
            player2: p2,
            matchesPlayed: mp,
            wins: stat.wins,
            losses: stat.losses,
            winRate: mp > 0 ? stat.wins / mp : 0,
            pointsWon: stat.pointsWon,
            pointsLost: stat.pointsLost,
            pointDiff: stat.pointsWon - stat.pointsLost,
            // Keep last 5 matches
            form: stat.form.slice(-5).map((f) => f.result),
          });
        }
      });

      // Sort Pairs: Win Rate desc, Wins desc, PointDiff desc
      pairsList.sort((a, b) => {
        if (b.winRate !== a.winRate) return b.winRate - a.winRate;
        if (b.wins !== a.wins) return b.wins - a.wins;
        return b.pointDiff - a.pointDiff;
      });

      // Format Individual Rankings
      const indList: IndividualRanking[] = [];
      indStats.forEach((stat, pId) => {
        const p = playersMap.get(pId);
        if (p) {
          const mp = stat.wins + stat.losses;
          indList.push({
            playerId: pId,
            name: p.name,
            matchesPlayed: mp,
            wins: stat.wins,
            losses: stat.losses,
            winRate: mp > 0 ? stat.wins / mp : 0,
            pointsWon: stat.pointsWon,
            pointsLost: stat.pointsLost,
            pointDiff: stat.pointsWon - stat.pointsLost,
            form: stat.form.slice(-5).map((f) => f.result),
          });
        }
      });

      // Sort Individuals
      indList.sort((a, b) => {
        if (b.winRate !== a.winRate) return b.winRate - a.winRate;
        if (b.wins !== a.wins) return b.wins - a.wins;
        return b.pointDiff - a.pointDiff;
      });

      return {
        pairs: pairsList,
        individuals: indList,
      };
    },
    // Recalculate whenever players data updates
    enabled: players.length > 0,
  });
};
