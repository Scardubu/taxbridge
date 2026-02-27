/**
 * TaxBridge — useStreak Hook
 * M09 / F3 — Gamified Compliance Streak + XP
 *
 * Architecture:
 *   SQLite-backed offline-first streak storage.
 *   One row per user in local DB (no userId required — single-device assumption).
 *   `checkin()` is idempotent: same-day calls are no-ops.
 *   Midnight reset uses Lagos timezone (WAT = UTC+1) via Intl.DateTimeFormat.
 *   Backend sync deferred to Week 2 (POST /api/v1/streak/checkin).
 *
 * Constraints:
 *   C-07  Graceful degradation on SQLite failure — hook never throws to caller
 *   C-08  No Math.random — XP increments are deterministic constants
 *
 * XP Scale (deterministic constants):
 *   DAY_1_XP    =  10   (first ever checkin)
 *   DAILY_XP    =   5   (each subsequent checkin)
 *   BONUS_XP_7  =  25   (streak milestone: 7 days)
 *   BONUS_XP_30 = 100   (streak milestone: 30 days)
 *   BONUS_XP_100= 500   (streak milestone: 100 days)
 *
 * Gate:
 *   - Streak cold start < 50ms (SQLite read)
 *   - checkin() is idempotent (same ISO date = no DB write)
 *   - Resets correctly at midnight Lagos time
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import * as SQLite from 'expo-sqlite';

// ─── XP Constants (C-08: deterministic, not random) ────────────────────────

const DAY_1_XP    = 10;
const DAILY_XP    =  5;
const BONUS_XP_7  = 25;
const BONUS_XP_30 = 100;
const BONUS_XP_100= 500;

const MILESTONE_DAYS = [7, 30, 100] as const;
export type MilestoneDays = typeof MILESTONE_DAYS[number];

// ─── Lagos timezone helper (WAT = UTC+1) ─────────────────────────────────────

function lagosDateISO(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lagos',
    year:  'numeric',
    month: '2-digit',
    day:   '2-digit',
  }).format(new Date());
  // Returns YYYY-MM-DD in Lagos local time
}

function lagosYesterdayISO(): string {
  const d = new Date();
  d.setTime(d.getTime() - 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lagos',
    year:  'numeric',
    month: '2-digit',
    day:   '2-digit',
  }).format(d);
}

// ─── DB Schema ───────────────────────────────────────────────────────────────

const DB_NAME   = 'taxbridge.db';
const CREATE_SQL = `
  CREATE TABLE IF NOT EXISTS streak_local (
    id              INTEGER PRIMARY KEY NOT NULL DEFAULT 1,
    current_streak  INTEGER NOT NULL DEFAULT 0,
    longest_streak  INTEGER NOT NULL DEFAULT 0,
    total_xp        INTEGER NOT NULL DEFAULT 0,
    last_checkin    TEXT,
    last_reset_reason TEXT
  );
  INSERT OR IGNORE INTO streak_local (id) VALUES (1);
`;

const READ_SQL   = `SELECT current_streak, longest_streak, total_xp, last_checkin FROM streak_local WHERE id = 1`;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface StreakState {
  currentStreak: number;
  longestStreak: number;
  totalXP:       number;
  lastCheckin:   string | null;  // YYYY-MM-DD Lagos date or null
  isLoading:     boolean;
  /** Non-null when a milestone was just hit — consumer shows confetti */
  milestoneCelebrate: MilestoneDays | null;
}

export interface UseStreakReturn extends StreakState {
  /** Call on every invoice create or compliance action. Idempotent per day. */
  checkin: () => Promise<void>;
  /** Clear the milestone flag after confetti is shown */
  clearMilestone: () => void;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useStreak(): UseStreakReturn {
  const [state, setState] = useState<StreakState>({
    currentStreak:      0,
    longestStreak:      0,
    totalXP:            0,
    lastCheckin:        null,
    isLoading:          true,
    milestoneCelebrate: null,
  });

  const dbRef = useRef<SQLite.SQLiteDatabase | null>(null);

  // ── Initialize DB ──
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const db = await SQLite.openDatabaseAsync(DB_NAME);
        await db.execAsync(CREATE_SQL);
        dbRef.current = db;

        const row = await db.getFirstAsync<{
          current_streak: number;
          longest_streak: number;
          total_xp:       number;
          last_checkin:   string | null;
        }>(READ_SQL);

        if (mounted && row) {
          setState(prev => ({
            ...prev,
            currentStreak: row.current_streak,
            longestStreak: row.longest_streak,
            totalXP:       row.total_xp,
            lastCheckin:   row.last_checkin,
            isLoading:     false,
          }));
        } else if (mounted) {
          setState(prev => ({ ...prev, isLoading: false }));
        }
      } catch {
        // C-07: graceful degradation — hook stays functional with defaults
        if (mounted) setState(prev => ({ ...prev, isLoading: false }));
      }
    })();

    return () => { mounted = false; };
  }, []);

  // ── Checkin ──
  const checkin = useCallback(async () => {
    const db = dbRef.current;
    if (!db) return;

    const today     = lagosDateISO();
    const yesterday = lagosYesterdayISO();

    try {
      const row = await db.getFirstAsync<{
        current_streak: number;
        longest_streak: number;
        total_xp:       number;
        last_checkin:   string | null;
      }>(READ_SQL);

      if (!row) return;

      const { current_streak, longest_streak, total_xp, last_checkin } = row;

      // Idempotency guard — same day = no-op
      if (last_checkin === today) return;

      let newStreak: number;
      let resetReason: string | null = null;

      if (last_checkin === yesterday) {
        // Consecutive day — increment
        newStreak = current_streak + 1;
      } else if (last_checkin === null) {
        // First ever checkin
        newStreak = 1;
      } else {
        // Broke streak — reset
        newStreak     = 1;
        resetReason   = 'missed_day';
      }

      // XP calculation (deterministic — C-08)
      let gained = newStreak === 1 && last_checkin === null ? DAY_1_XP : DAILY_XP;
      if (newStreak === 7)   gained += BONUS_XP_7;
      if (newStreak === 30)  gained += BONUS_XP_30;
      if (newStreak === 100) gained += BONUS_XP_100;

      const newXP      = total_xp + gained;
      const newLongest = Math.max(longest_streak, newStreak);

      await db.runAsync(
        `UPDATE streak_local
         SET current_streak = ?, longest_streak = ?, total_xp = ?,
             last_checkin = ?, last_reset_reason = ?
         WHERE id = 1`,
        [newStreak, newLongest, newXP, today, resetReason],
      );

      // Check milestone
      const milestone = MILESTONE_DAYS.find(m => m === newStreak) ?? null;

      setState({
        currentStreak:      newStreak,
        longestStreak:      newLongest,
        totalXP:            newXP,
        lastCheckin:        today,
        isLoading:          false,
        milestoneCelebrate: milestone as MilestoneDays | null,
      });
    } catch {
      // C-07: swallow DB errors gracefully
    }
  }, []);

  const clearMilestone = useCallback(() => {
    setState(prev => ({ ...prev, milestoneCelebrate: null }));
  }, []);

  return { ...state, checkin, clearMilestone };
}
