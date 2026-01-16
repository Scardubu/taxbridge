import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// User profile from assessment
export interface UserProfile {
  incomeSource: 'salary' | 'business' | 'investments' | 'mixed' | null;
  annualIncome: number | null;
  annualTurnover: number | null;
  businessType: 'sole_prop' | 'partnership' | 'considering_incorporation' | 'not_registered' | null;
  completedAt: string | null;
}

// User preferences
export interface UserPreferences {
  enableGamification: boolean;
  enableLeaderboard: boolean;
  enableReminders: boolean;
}

export type OnboardingStepId =
  | 'profile'
  | 'pit'
  | 'vatcit'
  | 'firs'
  | 'gamification'
  | 'community';

// Onboarding progress
export interface OnboardingProgress {
  currentStep: OnboardingStepId | null;
  completedSteps: OnboardingStepId[];
  skippedSteps: OnboardingStepId[];
  startedAt: string | null;
  completedAt: string | null;
  isComplete: boolean;
}

// Calculator history for tax calculations
export interface CalculatorEntry {
  grossIncome: number;
  rent: number;
  pension: number;
  nhf: number;
  nhis: number;
  chargeableIncome: number;
  estimatedTax: number;
  isExempt: boolean;
  timestamp: string;
}

// Achievement system
export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlockedAt: string | null;
}

interface OnboardingContextType {
  profile: UserProfile;
  progress: OnboardingProgress;
  calculatorHistory: CalculatorEntry[];
  achievements: Achievement[];
  preferences: UserPreferences;
  isOnboardingComplete: boolean;
  
  // Actions
  updateProfile: (profile: Partial<UserProfile>) => Promise<void>;
  updatePreferences: (prefs: Partial<UserPreferences>) => Promise<void>;
  updateProgress: (
    step: OnboardingStepId,
    completed?: boolean,
    skipped?: boolean,
  ) => Promise<OnboardingProgress>;
  addCalculatorEntry: (entry: CalculatorEntry) => Promise<void>;
  unlockAchievement: (id: string) => Promise<void>;
  completeOnboarding: (overrideProgress?: OnboardingProgress) => Promise<void>;
  resetOnboarding: () => Promise<void>;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

const STORAGE_KEYS = {
  PROFILE: '@taxbridge_onboarding_profile',
  PREFERENCES: '@taxbridge_onboarding_preferences',
  PROGRESS: '@taxbridge_onboarding_progress',
  CALCULATOR: '@taxbridge_onboarding_calculator_history',
  ACHIEVEMENTS: '@taxbridge_onboarding_achievements',
} as const;

const LEGACY_STORAGE_KEYS = {
  PROFILE: '@taxbridge:onboarding:profile',
  PREFERENCES: '@taxbridge:onboarding:preferences',
  PROGRESS: '@taxbridge:onboarding:progress',
  CALCULATOR: '@taxbridge:onboarding:calculator',
  ACHIEVEMENTS: '@taxbridge:onboarding:achievements',
} as const;

type StorageKey = keyof typeof STORAGE_KEYS;

const STEP_ID_ORDER: OnboardingStepId[] = [
  'profile',
  'pit',
  'vatcit',
  'firs',
  'gamification',
  'community',
];

const STEP_ID_MAP: Record<number, OnboardingStepId> = {
  1: 'profile',
  2: 'pit',
  3: 'vatcit',
  4: 'firs',
  5: 'gamification',
  6: 'community',
};

function isStepId(value: unknown): value is OnboardingStepId {
  return typeof value === 'string' && STEP_ID_ORDER.includes(value as OnboardingStepId);
}

function mapStepId(value: unknown): OnboardingStepId | null {
  if (isStepId(value)) {
    return value;
  }
  if (typeof value === 'number' && STEP_ID_MAP[value]) {
    return STEP_ID_MAP[value];
  }
  return null;
}

function normalizeStepList(list?: Array<unknown>): OnboardingStepId[] {
  if (!Array.isArray(list)) {
    return [];
  }
  const normalized: OnboardingStepId[] = [];
  list.forEach((item) => {
    const slug = mapStepId(item);
    if (slug && !normalized.includes(slug)) {
      normalized.push(slug);
    }
  });
  return normalized;
}

async function readStorageValue(key: StorageKey): Promise<string | null> {
  const primaryKey = STORAGE_KEYS[key];
  const legacyKey = LEGACY_STORAGE_KEYS[key];
  const value = await AsyncStorage.getItem(primaryKey);
  if (value !== null) {
    return value;
  }
  if (!legacyKey) {
    return null;
  }
  const legacyValue = await AsyncStorage.getItem(legacyKey);
  if (legacyValue !== null) {
    await AsyncStorage.setItem(primaryKey, legacyValue);
  }
  return legacyValue;
}

async function writeStorageValue(key: StorageKey, value: string): Promise<void> {
  const operations = [AsyncStorage.setItem(STORAGE_KEYS[key], value)];
  const legacyKey = LEGACY_STORAGE_KEYS[key];
  if (legacyKey) {
    operations.push(AsyncStorage.setItem(legacyKey, value));
  }
  await Promise.all(operations);
}

const createEmptyProgress = (): OnboardingProgress => ({
  currentStep: null,
  completedSteps: [],
  skippedSteps: [],
  startedAt: null,
  completedAt: null,
  isComplete: false,
});

const DEFAULT_PREFERENCES: UserPreferences = {
  enableGamification: false,
  enableLeaderboard: false,
  enableReminders: true,
};

const DEFAULT_ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_calculator',
    name: 'Tax Calculator Pro',
    description: 'Completed your first tax calculation',
    icon: '🧮',
    unlockedAt: null,
  },
  {
    id: 'pit_exempt',
    name: 'Tax-Free Champion',
    description: 'Discovered your tax-free threshold',
    icon: '🎉',
    unlockedAt: null,
  },
  {
    id: 'vat_aware',
    name: 'VAT Expert',
    description: 'Learned about VAT thresholds',
    icon: '💼',
    unlockedAt: null,
  },
  {
    id: 'cit_explorer',
    name: 'CIT Explorer',
    description: 'Explored Corporate Income Tax',
    icon: '🏢',
    unlockedAt: null,
  },
  {
    id: 'firs_explorer',
    name: 'FIRS Navigator',
    description: 'Tried the mock e-invoicing demo',
    icon: '📱',
    unlockedAt: null,
  },
  {
    id: 'onboarding_complete',
    name: 'Onboarding Master',
    description: 'Completed full tax onboarding',
    icon: '🏆',
    unlockedAt: null,
  },
  {
    id: 'seven_day_streak',
    name: '7-Day Streak',
    description: 'Used TaxBridge for 7 days straight',
    icon: '🔥',
    unlockedAt: null,
  },
];

const cloneAchievements = () => DEFAULT_ACHIEVEMENTS.map((achievement) => ({ ...achievement }));

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile>({
    incomeSource: null,
    annualIncome: null,
    annualTurnover: null,
    businessType: null,
    completedAt: null,
  });

  const [progress, setProgress] = useState<OnboardingProgress>(createEmptyProgress());

  const [calculatorHistory, setCalculatorHistory] = useState<CalculatorEntry[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>(cloneAchievements());
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);

  // Load data from AsyncStorage on mount
  useEffect(() => {
    loadOnboardingData();
  }, []);

  const loadOnboardingData = async () => {
    try {
      const [profileData, progressData, calculatorData, achievementData, prefsData] = await Promise.all([
        readStorageValue('PROFILE'),
        readStorageValue('PROGRESS'),
        readStorageValue('CALCULATOR'),
        readStorageValue('ACHIEVEMENTS'),
        readStorageValue('PREFERENCES'),
      ]);

      if (profileData) {
        setProfile(JSON.parse(profileData));
      }
      if (progressData) {
        const parsed = JSON.parse(progressData);
        setProgress({
          currentStep: mapStepId(parsed.currentStep),
          completedSteps: normalizeStepList(parsed.completedSteps),
          skippedSteps: normalizeStepList(parsed.skippedSteps),
          startedAt: parsed.startedAt ?? null,
          completedAt: parsed.completedAt ?? null,
          isComplete: parsed.isComplete ?? Boolean(parsed.completedAt),
        });
      }
      if (calculatorData) {
        setCalculatorHistory(JSON.parse(calculatorData));
      }
      if (achievementData) {
        setAchievements(JSON.parse(achievementData));
      } else {
        setAchievements(cloneAchievements());
      }
      if (prefsData) {
        setPreferences(JSON.parse(prefsData));
      }
    } catch (error) {
      console.error('Failed to load onboarding data:', error);
    }
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    const newProfile = { ...profile, ...updates };
    setProfile(newProfile);
    await writeStorageValue('PROFILE', JSON.stringify(newProfile));
  };

  const updatePreferences = async (updates: Partial<UserPreferences>) => {
    const newPrefs = { ...preferences, ...updates };
    setPreferences(newPrefs);
    await writeStorageValue('PREFERENCES', JSON.stringify(newPrefs));
  };

  const updateProgress = async (
    step: OnboardingStepId,
    completed = false,
    skipped = false,
  ): Promise<OnboardingProgress> => {
    const newProgress: OnboardingProgress = {
      ...progress,
      currentStep: step,
      completedSteps: [...progress.completedSteps],
      skippedSteps: [...progress.skippedSteps],
    };

    if (!newProgress.startedAt) {
      newProgress.startedAt = new Date().toISOString();
    }

    if (completed && !newProgress.completedSteps.includes(step)) {
      newProgress.completedSteps.push(step);
    }

    if (skipped && !newProgress.skippedSteps.includes(step)) {
      newProgress.skippedSteps.push(step);
    }

    setProgress(newProgress);
    await writeStorageValue('PROGRESS', JSON.stringify(newProgress));

    return newProgress;
  };

  const addCalculatorEntry = async (entry: CalculatorEntry) => {
    const newHistory = [...calculatorHistory, entry];
    setCalculatorHistory(newHistory);
    await writeStorageValue('CALCULATOR', JSON.stringify(newHistory));
    
    // Unlock achievement
    if (calculatorHistory.length === 0) {
      await unlockAchievement('first_calculator');
    }

    if (entry.isExempt) {
      await unlockAchievement('pit_exempt');
    }
  };

  const unlockAchievement = async (id: string) => {
    const newAchievements = achievements.map(a => 
      a.id === id && !a.unlockedAt 
        ? { ...a, unlockedAt: new Date().toISOString() }
        : a
    );
    setAchievements(newAchievements);
    await writeStorageValue('ACHIEVEMENTS', JSON.stringify(newAchievements));
  };

  const completeOnboarding = async (overrideProgress?: OnboardingProgress) => {
    const now = new Date().toISOString();

    const baseProgress = overrideProgress ?? progress;

    const newProgress = {
      ...baseProgress,
      completedAt: now,
      isComplete: true,
    };
    
    const newProfile = {
      ...profile,
      completedAt: now,
    };

    setProgress(newProgress);
    setProfile(newProfile);

    await Promise.all([
      writeStorageValue('PROGRESS', JSON.stringify(newProgress)),
      writeStorageValue('PROFILE', JSON.stringify(newProfile)),
    ]);

    await unlockAchievement('onboarding_complete');
  };

  const resetOnboarding = async () => {
    const emptyProfile: UserProfile = {
      incomeSource: null,
      annualIncome: null,
      annualTurnover: null,
      businessType: null,
      completedAt: null,
    };

    const emptyProgress = createEmptyProgress();

    setProfile(emptyProfile);
    setProgress(emptyProgress);
    setCalculatorHistory([]);
    setAchievements(cloneAchievements());
    setPreferences(DEFAULT_PREFERENCES);

    await Promise.all([
      writeStorageValue('PROFILE', JSON.stringify(emptyProfile)),
      writeStorageValue('PROGRESS', JSON.stringify(emptyProgress)),
      writeStorageValue('CALCULATOR', JSON.stringify([])),
      writeStorageValue('ACHIEVEMENTS', JSON.stringify(cloneAchievements())),
      writeStorageValue('PREFERENCES', JSON.stringify(DEFAULT_PREFERENCES)),
    ]);
  };

  const isOnboardingComplete = progress.isComplete;

  return (
    <OnboardingContext.Provider
      value={{
        profile,
        progress,
        calculatorHistory,
        achievements,
        preferences,
        isOnboardingComplete,
        updateProfile,
        updatePreferences,
        updateProgress,
        addCalculatorEntry,
        unlockAchievement,
        completeOnboarding,
        resetOnboarding,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within OnboardingProvider');
  }
  return context;
}
