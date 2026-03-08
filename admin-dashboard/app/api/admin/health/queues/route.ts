import { NextResponse } from 'next/server';
import { logError } from '@/lib/logger';
import { fetchHealthEndpoint } from '@/lib/backendHealth';

type QueueStats = {
  name: string;
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
  completed: number;
  dlqDepth?: number;
};

type QueueHealthPayload = {
  status?: 'healthy' | 'degraded' | 'unavailable' | string;
  queues?: QueueStats[];
  timestamp?: string;
  error?: string;
};

function parsePayload(raw: unknown): QueueHealthPayload {
  if (!raw || typeof raw !== 'object') return {};
  return raw as QueueHealthPayload;
}

function mapNrsQueue(queues: QueueStats[] = []) {
  const nrs = queues.find((queue) => queue.name === 'nrs-submission');
  if (!nrs) {
    return {
      waiting: 0,
      active: 0,
      failed: 0,
      completed: 0,
      delayed: 0,
      successRate: null as number | null,
      healthy: false,
    };
  }

  const totalTerminal = nrs.completed + nrs.failed;
  const successRate = totalTerminal > 0 ? nrs.completed / totalTerminal : null;

  return {
    waiting: nrs.waiting,
    active: nrs.active,
    failed: nrs.failed,
    completed: nrs.completed,
    delayed: nrs.delayed,
    successRate,
    healthy: nrs.failed <= 10,
  };
}

function fallbackResponse(message?: string) {
  return NextResponse.json(
    {
      fallback: true,
      nrs: {
        waiting: 0,
        active: 0,
        failed: 0,
        completed: 0,
        delayed: 0,
        successRate: null,
        healthy: false,
      },
      queues: [],
      status: 'unavailable',
      error: message,
      timestamp: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
        'X-Fallback': 'true',
      },
    }
  );
}

export async function GET() {
  try {
    const { data: json, ok } = await fetchHealthEndpoint('/health/queues');
    const data = parsePayload(json);

    const queues = Array.isArray(data.queues) ? data.queues : [];

    return NextResponse.json(
      {
        fallback: !ok,
        nrs: mapNrsQueue(queues),
        queues,
        status: data.status ?? (ok ? 'healthy' : 'unavailable'),
        error: data.error,
        timestamp: data.timestamp ?? new Date().toISOString(),
      },
      {
        status: 200,
        headers: !ok
          ? {
              'Cache-Control': 'no-store',
              'X-Fallback': 'true',
            }
          : undefined,
      }
    );
  } catch (error: unknown) {
    logError('admin/api/health/queues: Error fetching queue health', error);
    const message = error instanceof Error ? error.message : 'Unknown queue health error';
    return fallbackResponse(message);
  }
}
