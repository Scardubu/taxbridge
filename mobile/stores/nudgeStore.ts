import { create } from 'zustand';
import type { ComplianceNudge, NudgePriority } from '../services/nudgeEngine';

export interface EventNudge extends Omit<ComplianceNudge, 'route'> {
  route: string;
  external?: boolean;
  source: 'admin' | 'system';
}

interface NudgeStore {
  eventNudges: EventNudge[];
  prependNudge: (nudge: EventNudge) => void;
  dismissNudge: (id: string) => void;
  clearEventNudges: () => void;
}

const PRIORITY_ORDER: Record<NudgePriority, number> = {
  critical: 0,
  warning: 1,
  opportunity: 2,
};

export const useNudgeStore = create<NudgeStore>()((set) => ({
  eventNudges: [],
  prependNudge: (nudge) => {
    set((state) => {
      const next = [nudge, ...state.eventNudges.filter((existing) => existing.id !== nudge.id)];
      next.sort((left, right) => PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority]);
      return { eventNudges: next.slice(0, 6) };
    });
  },
  dismissNudge: (id) => {
    set((state) => ({ eventNudges: state.eventNudges.filter((nudge) => nudge.id !== id) }));
  },
  clearEventNudges: () => {
    set({ eventNudges: [] });
  },
}));