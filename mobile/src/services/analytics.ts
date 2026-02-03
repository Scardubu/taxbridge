/**
 * TaxBridge Analytics Service
 * 
 * Phase 7: User Flow and Onboarding Optimizations
 * 
 * Lightweight analytics for tracking user engagement, onboarding completion,
 * and feature usage without external dependencies.
 * 
 * Features:
 * - Event logging with timestamps
 * - Onboarding funnel tracking
 * - Screen view tracking
 * - A/B test variant assignment
 * - Local persistence for offline support
 * - Privacy-conscious (no PII)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { addBreadcrumb } from './sentry';
import { createLogger } from '../utils/logger';

const log = createLogger('analytics');

// ============================================================================
// Types
// ============================================================================

export type EventCategory = 
  | 'onboarding'
  | 'navigation'
  | 'invoice'
  | 'sync'
  | 'search'
  | 'settings'
  | 'engagement';

export interface AnalyticsEvent {
  id: string;
  category: EventCategory;
  action: string;
  label?: string;
  value?: number;
  timestamp: number;
  sessionId: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface OnboardingMetrics {
  startedAt: number;
  completedAt?: number;
  totalDuration?: number;
  stepsCompleted: string[];
  stepsSkipped: string[];
  dropOffStep?: string;
  personalizationAnswers: Record<string, string | number>;
  quizScores: Record<string, number>;
}

export interface SessionMetrics {
  sessionId: string;
  startedAt: number;
  endedAt?: number;
  screenViews: string[];
  invoicesCreated: number;
  searchesPerformed: number;
  syncsTriggered: number;
}

export interface ABTestVariant {
  testId: string;
  variant: 'A' | 'B' | 'control';
  assignedAt: number;
}

// ============================================================================
// Storage Keys
// ============================================================================

const STORAGE_KEYS = {
  EVENTS: 'tb_analytics_events',
  ONBOARDING_METRICS: 'tb_onboarding_metrics',
  SESSION: 'tb_session_metrics',
  AB_TESTS: 'tb_ab_tests',
  USER_ID: 'tb_analytics_user_id',
};

// ============================================================================
// Helpers
// ============================================================================

const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

let currentSessionId = generateId();
let eventQueue: AnalyticsEvent[] = [];
let flushTimer: NodeJS.Timeout | null = null;
const isTestEnv = process.env.NODE_ENV === 'test';

// ============================================================================
// Core Analytics Functions
// ============================================================================

/**
 * Track a generic analytics event
 */
export async function trackEvent(
  category: EventCategory,
  action: string,
  label?: string,
  value?: number,
  metadata?: Record<string, string | number | boolean>
): Promise<void> {
  if (isTestEnv) {
    return;
  }

  const event: AnalyticsEvent = {
    id: generateId(),
    category,
    action,
    label,
    value,
    timestamp: Date.now(),
    sessionId: currentSessionId,
    metadata,
  };

  eventQueue.push(event);

  // Log to Sentry breadcrumbs for debugging
  addBreadcrumb({
    category: `analytics:${category}`,
    message: `${action}${label ? ` - ${label}` : ''}`,
    level: 'info',
    data: { value, ...metadata },
  });

  log.debug('Event tracked', { category, action, label });

  // Debounced flush
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(flushEvents, 5000);
}

/**
 * Flush events to persistent storage
 */
async function flushEvents(): Promise<void> {
  if (eventQueue.length === 0) return;

  try {
    const existingJson = await AsyncStorage.getItem(STORAGE_KEYS.EVENTS);
    const existing: AnalyticsEvent[] = existingJson ? JSON.parse(existingJson) : [];
    
    // Keep last 500 events to prevent storage bloat
    const combined = [...existing, ...eventQueue].slice(-500);
    
    await AsyncStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(combined));
    eventQueue = [];
    
    log.debug('Events flushed to storage', { count: combined.length });
  } catch (error) {
    log.error('Failed to flush events', { error });
  }
}

// ============================================================================
// Onboarding Analytics
// ============================================================================

/**
 * Start onboarding tracking
 */
export async function trackOnboardingStart(): Promise<void> {
  const metrics: OnboardingMetrics = {
    startedAt: Date.now(),
    stepsCompleted: [],
    stepsSkipped: [],
    personalizationAnswers: {},
    quizScores: {},
  };

  await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING_METRICS, JSON.stringify(metrics));
  await trackEvent('onboarding', 'started');
}

/**
 * Track onboarding step completion
 */
export async function trackOnboardingStep(
  stepId: string,
  completed: boolean,
  skipped: boolean,
  duration: number
): Promise<void> {
  try {
    const metricsJson = await AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING_METRICS);
    const metrics: OnboardingMetrics = metricsJson 
      ? JSON.parse(metricsJson) 
      : { startedAt: Date.now(), stepsCompleted: [], stepsSkipped: [], personalizationAnswers: {}, quizScores: {} };

    if (completed) {
      metrics.stepsCompleted.push(stepId);
    } else if (skipped) {
      metrics.stepsSkipped.push(stepId);
    }

    await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING_METRICS, JSON.stringify(metrics));

    await trackEvent('onboarding', completed ? 'step_completed' : 'step_skipped', stepId, duration, {
      stepIndex: metrics.stepsCompleted.length + metrics.stepsSkipped.length,
    });
  } catch (error) {
    log.error('Failed to track onboarding step', { error, stepId });
  }
}

/**
 * Track personalization answers from quick questionnaire
 */
export async function trackPersonalization(
  question: string,
  answer: string | number
): Promise<void> {
  try {
    const metricsJson = await AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING_METRICS);
    const metrics: OnboardingMetrics = metricsJson 
      ? JSON.parse(metricsJson) 
      : { startedAt: Date.now(), stepsCompleted: [], stepsSkipped: [], personalizationAnswers: {}, quizScores: {} };

    metrics.personalizationAnswers[question] = answer;

    await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING_METRICS, JSON.stringify(metrics));
    await trackEvent('onboarding', 'personalization', question, typeof answer === 'number' ? answer : undefined);
  } catch (error) {
    log.error('Failed to track personalization', { error, question });
  }
}

/**
 * Track quiz score
 */
export async function trackQuizScore(quizId: string, score: number, total: number): Promise<void> {
  try {
    const metricsJson = await AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING_METRICS);
    const metrics: OnboardingMetrics = metricsJson 
      ? JSON.parse(metricsJson) 
      : { startedAt: Date.now(), stepsCompleted: [], stepsSkipped: [], personalizationAnswers: {}, quizScores: {} };

    metrics.quizScores[quizId] = score;

    await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING_METRICS, JSON.stringify(metrics));
    await trackEvent('onboarding', 'quiz_completed', quizId, score, { total, percentage: (score / total) * 100 });
  } catch (error) {
    log.error('Failed to track quiz score', { error, quizId });
  }
}

/**
 * Track onboarding completion
 */
export async function trackOnboardingComplete(): Promise<void> {
  try {
    const metricsJson = await AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING_METRICS);
    const metrics: OnboardingMetrics = metricsJson 
      ? JSON.parse(metricsJson) 
      : { startedAt: Date.now(), stepsCompleted: [], stepsSkipped: [], personalizationAnswers: {}, quizScores: {} };

    metrics.completedAt = Date.now();
    metrics.totalDuration = metrics.completedAt - metrics.startedAt;

    await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING_METRICS, JSON.stringify(metrics));

    await trackEvent('onboarding', 'completed', undefined, metrics.totalDuration, {
      stepsCompleted: metrics.stepsCompleted.length,
      stepsSkipped: metrics.stepsSkipped.length,
      totalSteps: metrics.stepsCompleted.length + metrics.stepsSkipped.length,
    });
  } catch (error) {
    log.error('Failed to track onboarding completion', { error });
  }
}

/**
 * Track onboarding drop-off
 */
export async function trackOnboardingDropOff(stepId: string): Promise<void> {
  try {
    const metricsJson = await AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING_METRICS);
    const metrics: OnboardingMetrics = metricsJson 
      ? JSON.parse(metricsJson) 
      : { startedAt: Date.now(), stepsCompleted: [], stepsSkipped: [], personalizationAnswers: {}, quizScores: {} };

    metrics.dropOffStep = stepId;

    await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING_METRICS, JSON.stringify(metrics));
    await trackEvent('onboarding', 'drop_off', stepId);
  } catch (error) {
    log.error('Failed to track onboarding drop-off', { error, stepId });
  }
}

// ============================================================================
// Screen & Navigation Tracking
// ============================================================================

/**
 * Track screen view
 */
export async function trackScreenView(screenName: string): Promise<void> {
  await trackEvent('navigation', 'screen_view', screenName);
}

/**
 * Track navigation action
 */
export async function trackNavigation(from: string, to: string, method: 'tab' | 'fab' | 'button' | 'gesture'): Promise<void> {
  await trackEvent('navigation', 'navigate', `${from} -> ${to}`, undefined, { method });
}

// ============================================================================
// Feature Usage Tracking
// ============================================================================

/**
 * Track invoice creation
 */
export async function trackInvoiceCreated(itemCount: number, total: number, offline: boolean): Promise<void> {
  await trackEvent('invoice', 'created', undefined, total, { itemCount, offline });
}

/**
 * Track search performed
 */
export async function trackSearch(query: string, resultsCount: number): Promise<void> {
  // Don't log the actual query for privacy - just track that a search occurred
  await trackEvent('search', 'performed', undefined, resultsCount, { queryLength: query.length });
}

/**
 * Track sync action
 */
export async function trackSync(trigger: 'manual' | 'auto' | 'reconnect', result: 'success' | 'partial' | 'failed', synced: number): Promise<void> {
  await trackEvent('sync', trigger, result, synced);
}

// ============================================================================
// A/B Testing
// ============================================================================

/**
 * Get or assign A/B test variant
 */
export async function getABTestVariant(testId: string): Promise<'A' | 'B' | 'control'> {
  try {
    const testsJson = await AsyncStorage.getItem(STORAGE_KEYS.AB_TESTS);
    const tests: Record<string, ABTestVariant> = testsJson ? JSON.parse(testsJson) : {};

    if (tests[testId]) {
      return tests[testId].variant;
    }

    // Assign random variant with 33% each
    const random = Math.random();
    const variant: 'A' | 'B' | 'control' = random < 0.33 ? 'A' : random < 0.66 ? 'B' : 'control';

    tests[testId] = {
      testId,
      variant,
      assignedAt: Date.now(),
    };

    await AsyncStorage.setItem(STORAGE_KEYS.AB_TESTS, JSON.stringify(tests));
    await trackEvent('engagement', 'ab_test_assigned', testId, undefined, { variant });

    return variant;
  } catch (error) {
    log.error('Failed to get A/B test variant', { error, testId });
    return 'control';
  }
}

// ============================================================================
// Metrics Retrieval (for debugging/admin)
// ============================================================================

/**
 * Get onboarding metrics
 */
export async function getOnboardingMetrics(): Promise<OnboardingMetrics | null> {
  try {
    const metricsJson = await AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING_METRICS);
    return metricsJson ? JSON.parse(metricsJson) : null;
  } catch {
    return null;
  }
}

/**
 * Get all events (for debugging)
 */
export async function getAllEvents(): Promise<AnalyticsEvent[]> {
  try {
    const eventsJson = await AsyncStorage.getItem(STORAGE_KEYS.EVENTS);
    return eventsJson ? JSON.parse(eventsJson) : [];
  } catch {
    return [];
  }
}

/**
 * Retrieve stored analytics events
 */
export async function getAnalyticsData(): Promise<AnalyticsEvent[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.EVENTS);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    log.error('Failed to retrieve analytics data', error as Error);
    return [];
  }
}

/**
 * Clear all analytics data
 */
export async function clearAnalytics(): Promise<void> {
  await Promise.all([
    AsyncStorage.removeItem(STORAGE_KEYS.EVENTS),
    AsyncStorage.removeItem(STORAGE_KEYS.ONBOARDING_METRICS),
    AsyncStorage.removeItem(STORAGE_KEYS.SESSION),
    AsyncStorage.removeItem(STORAGE_KEYS.AB_TESTS),
  ]);
  eventQueue = [];
  log.info('Analytics data cleared');
}

/**
 * Start a new session
 */
export function startNewSession(): void {
  currentSessionId = generateId();
  trackEvent('engagement', 'session_start');
}

/**
 * End current session
 */
export function endSession(): void {
  trackEvent('engagement', 'session_end');
  flushEvents();
}

// Initialize session on module load
startNewSession();
