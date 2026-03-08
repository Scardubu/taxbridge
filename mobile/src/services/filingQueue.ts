import AsyncStorage from '@react-native-async-storage/async-storage';

const FILING_QUEUE_KEY = 'taxbridge:filingQueue:v1';

export interface QueuedFilingRequest {
  idempotencyKey: string;
  endpoint: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

async function readQueue(): Promise<QueuedFilingRequest[]> {
  try {
    const raw = await AsyncStorage.getItem(FILING_QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueuedFilingRequest[]) : [];
  } catch {
    return [];
  }
}

async function writeQueue(items: QueuedFilingRequest[]): Promise<void> {
  await AsyncStorage.setItem(FILING_QUEUE_KEY, JSON.stringify(items));
}

export async function enqueueFilingRequest(request: QueuedFilingRequest): Promise<void> {
  const existing = await readQueue();
  const deduped = existing.filter((item) => item.idempotencyKey !== request.idempotencyKey);
  deduped.push(request);
  await writeQueue(deduped);
}

export async function listQueuedFilingRequests(): Promise<QueuedFilingRequest[]> {
  return readQueue();
}

export async function removeQueuedFilingRequest(idempotencyKey: string): Promise<void> {
  const existing = await readQueue();
  await writeQueue(existing.filter((item) => item.idempotencyKey !== idempotencyKey));
}

export async function clearQueuedFilingRequests(): Promise<void> {
  await writeQueue([]);
}
