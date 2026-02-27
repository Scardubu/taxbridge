/**
 * TaxBridge Embedding Pipeline
 * ============================
 * Converts prompt modules into vector embeddings for RAG-based
 * dynamic context retrieval. Evolves the system from static
 * module injection to query-driven context selection.
 *
 * Place in: prompts/loaders/embedding-pipeline.ts
 *
 * Setup:
 *   npm install @anthropic-ai/sdk openai @xenova/transformers
 *   npx ts-node embedding-pipeline.ts build
 *   npx ts-node embedding-pipeline.ts query "how do I fix OCR confidence"
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EmbeddedChunk {
  id: string;                 // sha256 of content
  moduleId: string;           // e.g. 'M03'
  heading: string;            // Section heading within module
  content: string;            // Raw text of this chunk
  embedding: number[];        // 384-dim vector (all-MiniLM-L6-v2)
  tokenEstimate: number;
  lastUpdated: string;
}

export interface EmbeddingsIndex {
  version: string;
  builtAt: string;
  chunks: EmbeddedChunk[];
}

// ─── Chunking Strategy ────────────────────────────────────────────────────────
// Split each module by H2/H3 headings (##/###)
// Target chunk size: ~300-500 tokens (1,200-2,000 chars)
// Never split a code block across chunks

function chunkModule(moduleId: string, content: string): Array<{ heading: string; text: string }> {
  const lines = content.split('\n');
  const chunks: Array<{ heading: string; text: string }> = [];

  let currentHeading = 'Introduction';
  let currentLines: string[] = [];
  let inCodeBlock = false;

  for (const line of lines) {
    if (line.startsWith('```')) inCodeBlock = !inCodeBlock;

    if (!inCodeBlock && (line.startsWith('## ') || line.startsWith('### '))) {
      if (currentLines.length > 5) {
        chunks.push({
          heading: currentHeading,
          text: currentLines.join('\n').trim(),
        });
      }
      currentHeading = line.replace(/^#+\s/, '').trim();
      currentLines = [line];
    } else {
      currentLines.push(line);
    }
  }

  if (currentLines.length > 5) {
    chunks.push({ heading: currentHeading, text: currentLines.join('\n').trim() });
  }

  return chunks;
}

// ─── Embedding Function ───────────────────────────────────────────────────────
// Uses local all-MiniLM-L6-v2 (no API cost, 384 dimensions)
// Falls back to OpenAI text-embedding-3-small if local model unavailable

async function embedText(text: string): Promise<number[]> {
  try {
    // Local embedding (preferred — no API cost, works offline)
    const { pipeline } = await import('@xenova/transformers');
    const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data as Float32Array);
  } catch {
    try {
      // Fallback: OpenAI embeddings
      const { OpenAI } = await import('openai');
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const response = await client.embeddings.create({
        model: 'text-embedding-3-small',
        input: text.slice(0, 8000), // 8k token limit
      });
      return response.data[0].embedding;
    } catch {
      // Final fallback: deterministic hash-based pseudo-embedding (dev/CI use only)
      // Not suitable for semantic search, but allows index to be built without dependencies
      const hash = crypto.createHash('sha256').update(text).digest();
      const vec = Array.from({ length: 384 }, (_, i) => (hash[i % 32] / 255) * 2 - 1);
      return vec;
    }
  }
}

// ─── Build Index ──────────────────────────────────────────────────────────────

const PROMPTS_ROOT = path.resolve(__dirname, '..');
const INDEX_PATH = path.join(PROMPTS_ROOT, 'embeddings', 'index.json');

const MODULE_FILES = [
  { id: 'M00', file: 'core/M00-identity-rules.md' },
  { id: 'M01', file: 'backend/M01-backend-architecture.md' },
  { id: 'M02', file: 'mobile/M02-mobile-ux.md' },
  { id: 'M03', file: 'ai/M03-ai-intelligence.md' },
  { id: 'M04', file: 'payments/M04-payments-compliance.md' },
  { id: 'M05', file: 'data/M05-data-tax-engine.md' },
  { id: 'M06', file: 'devops/M06-deployment-devops.md' },
  { id: 'M07', file: 'monetization/M07-monetization-analytics.md' },
];

export async function buildEmbeddingsIndex(): Promise<void> {
  console.log('[Embeddings] Building index...');
  await fs.mkdir(path.join(PROMPTS_ROOT, 'embeddings'), { recursive: true });

  const allChunks: EmbeddedChunk[] = [];

  for (const { id: moduleId, file } of MODULE_FILES) {
    const filePath = path.join(PROMPTS_ROOT, file);
    let content: string;

    try {
      content = await fs.readFile(filePath, 'utf-8');
    } catch {
      console.warn(`[Embeddings] Skipping ${moduleId} — file not found: ${filePath}`);
      continue;
    }

    const chunks = chunkModule(moduleId, content);
    console.log(`[Embeddings] ${moduleId}: ${chunks.length} chunks`);

    for (const chunk of chunks) {
      const chunkText = `Module: ${moduleId}\nSection: ${chunk.heading}\n\n${chunk.text}`;
      const id = crypto.createHash('sha256').update(chunkText).digest('hex').slice(0, 16);

      let embedding: number[];
      try {
        embedding = await embedText(chunkText);
      } catch (err) {
        console.error(`[Embeddings] Failed to embed ${moduleId}/${chunk.heading}:`, err);
        continue;
      }

      allChunks.push({
        id,
        moduleId,
        heading: chunk.heading,
        content: chunk.text,
        embedding,
        tokenEstimate: Math.ceil(chunkText.length / 4),
        lastUpdated: new Date().toISOString(),
      });
    }
  }

  const index: EmbeddingsIndex = {
    version: '1.0',
    builtAt: new Date().toISOString(),
    chunks: allChunks,
  };

  await fs.writeFile(INDEX_PATH, JSON.stringify(index, null, 2));
  console.log(`[Embeddings] Index built: ${allChunks.length} chunks → ${INDEX_PATH}`);
}

// ─── Cosine Similarity ────────────────────────────────────────────────────────

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] ** 2;
    magB += b[i] ** 2;
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

// ─── Query Interface ──────────────────────────────────────────────────────────

export interface RetrievedChunk {
  moduleId: string;
  heading: string;
  content: string;
  similarity: number;
  tokenEstimate: number;
}

export async function queryContext(
  query: string,
  options: {
    topK?: number;
    minSimilarity?: number;
    maxTokens?: number;
  } = {}
): Promise<{ chunks: RetrievedChunk[]; totalTokens: number }> {
  const { topK = 5, minSimilarity = 0.5, maxTokens = 3000 } = options;

  // Load index
  const indexRaw = await fs.readFile(INDEX_PATH, 'utf-8');
  const index: EmbeddingsIndex = JSON.parse(indexRaw);

  // Always include M00 (identity rules) — not subject to similarity threshold
  const m00Chunks = index.chunks.filter(c => c.moduleId === 'M00');
  const otherChunks = index.chunks.filter(c => c.moduleId !== 'M00');

  // Embed the query
  const queryEmbedding = await embedText(query);

  // Score all non-M00 chunks
  const scored = otherChunks.map(chunk => ({
    ...chunk,
    similarity: cosineSimilarity(queryEmbedding, chunk.embedding),
  }));

  // Sort by similarity, filter by threshold
  const relevant = scored
    .filter(c => c.similarity >= minSimilarity)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);

  // Build result within token budget
  const result: RetrievedChunk[] = [];
  let totalTokens = m00Chunks.reduce((s, c) => s + c.tokenEstimate, 0);

  // Add M00 chunks first (always)
  for (const chunk of m00Chunks) {
    result.push({ ...chunk, similarity: 1.0 });
  }

  // Add relevant chunks within budget
  for (const chunk of relevant) {
    if (totalTokens + chunk.tokenEstimate > maxTokens) break;
    result.push(chunk);
    totalTokens += chunk.tokenEstimate;
  }

  return { chunks: result, totalTokens };
}

// ─── Format for Injection ─────────────────────────────────────────────────────

export async function getRAGContext(query: string, maxTokens: number = 3000): Promise<string> {
  const { chunks, totalTokens } = await queryContext(query, { maxTokens });

  const sections = chunks.map(c =>
    `<!-- ${c.moduleId}: ${c.heading} (similarity: ${c.similarity.toFixed(2)}) -->\n${c.content}`
  );

  return [
    `<!-- TaxBridge RAG Context — ${chunks.length} chunks, ~${totalTokens} tokens -->`,
    ...sections,
  ].join('\n\n---\n\n');
}

// ─── Verification ─────────────────────────────────────────────────────────────

export async function verifyIndex(): Promise<void> {
  try {
    const indexRaw = await fs.readFile(INDEX_PATH, 'utf-8');
    const index: EmbeddingsIndex = JSON.parse(indexRaw);
    const moduleIds = [...new Set(index.chunks.map(c => c.moduleId))];

    console.log(`[Verify] Index built: ${index.builtAt}`);
    console.log(`[Verify] Total chunks: ${index.chunks.length}`);
    console.log(`[Verify] Modules indexed: ${moduleIds.join(', ')}`);

    const missingModules = MODULE_FILES.map(m => m.id).filter(id => !moduleIds.includes(id));
    if (missingModules.length > 0) {
      console.warn(`[Verify] MISSING modules in index: ${missingModules.join(', ')}`);
      process.exitCode = 1;
    } else {
      console.log('[Verify] All modules indexed ✓');
    }
  } catch {
    console.error('[Verify] No index found. Run: npx ts-node embedding-pipeline.ts build');
    process.exitCode = 1;
  }
}

// ─── CLI ──────────────────────────────────────────────────────────────────────

if (require.main === module) {
  const command = process.argv[2];
  const arg = process.argv.slice(3).join(' ');

  (async () => {
    switch (command) {
      case 'build':
        await buildEmbeddingsIndex();
        break;
      case 'query':
        if (!arg) { console.error('Usage: ... query "your question"'); process.exit(1); }
        const ctx = await getRAGContext(arg);
        console.log(ctx);
        break;
      case 'verify':
        await verifyIndex();
        break;
      default:
        console.log('Commands: build | query "<question>" | verify');
    }
  })().catch(console.error);
}
