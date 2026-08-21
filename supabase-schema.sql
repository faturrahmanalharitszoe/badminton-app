-- SQL Schema for Badminton App
-- Execute this script in your Supabase SQL Editor (https://supabase.com)

-- Drop tables if they exist (for clean setup/reset)
-- DROP TABLE IF EXISTS matches;
-- DROP TABLE IF EXISTS tournaments;
-- DROP TABLE IF EXISTS players;

-- 1. Players Table
CREATE TABLE IF NOT EXISTS players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE CHECK (char_length(name) >= 2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Tournaments Table
CREATE TABLE IF NOT EXISTS tournaments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    format TEXT NOT NULL DEFAULT 'double' CHECK (format IN ('single', 'double')),
    mode TEXT NOT NULL DEFAULT 'knockout' CHECK (mode IN ('knockout', 'league')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
    winner_team_ids UUID[] DEFAULT NULL, -- Will contain player UUIDs of the winning team
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Matches Table
CREATE TABLE IF NOT EXISTS matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    round INTEGER NOT NULL, -- 1 for Round 1 (farthest), 2 for Round 2, etc.
    match_index INTEGER NOT NULL, -- index of the match in that round (e.g. 0, 1, 2...)
    team1_ids UUID[] DEFAULT '{}', -- Array of player UUIDs in Team 1
    team2_ids UUID[] DEFAULT '{}', -- Array of player UUIDs in Team 2
    score1 INTEGER,
    score2 INTEGER,
    winner INTEGER CHECK (winner IN (1, 2)),
    next_match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
    next_match_is_team2 BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    set_scores JSONB DEFAULT NULL, -- Array of set scores: [{"team1":21,"team2":19}, ...]
    
    -- Ensure each match index in a tournament's round is unique
    CONSTRAINT unique_tournament_round_match UNIQUE (tournament_id, round, match_index)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_players_name ON players(name);
CREATE INDEX IF NOT EXISTS idx_matches_tournament_id ON matches(tournament_id);
CREATE INDEX IF NOT EXISTS idx_matches_next_match_id ON matches(next_match_id);

-- Enable Realtime for all tables (optional, but awesome)
alter publication supabase_realtime add table players;
alter publication supabase_realtime add table tournaments;
alter publication supabase_realtime add table matches;

-- Migration: Add set_scores column to matches (run if table already exists)
-- ALTER TABLE matches ADD COLUMN IF NOT EXISTS set_scores JSONB DEFAULT NULL;
-- Migration: Add mode column to tournaments for league support
-- ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'knockout' CHECK (mode IN ('knockout', 'league'));
