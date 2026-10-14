/**
 * Embeddings for the "Superpower Bio Semantic Match" (5 pts).
 *
 * Two providers share one interface and one dimension (384) so the pgvector
 * column never changes:
 * - `local`: all-MiniLM-L6-v2 running on-device through transformers.js. The
 *   model (~23 MB, quantized) is downloaded once into `.cache/models`; text
 *   never leaves the machine.
 * - `hash`: dependency-free lexical fallback (feature-hashed unigrams and
 *   bigrams). Used when the model cannot be loaded, e.g. offline.
 *
 * Vectors from different providers are not comparable, so every stored vector
 * is tagged with `provider.model` and similarity is only computed within one model.
 */
import { fileURLToPath } from 'node:url';

export const EMBEDDING_DIMENSIONS = 384;

export interface EmbeddingProvider {
  /** Stored next to each vector, e.g. "minilm-l6-v2" or "hash-v1". */
  readonly model: string;
  embed(texts: string[]): Promise<number[][]>;
}

export type EmbeddingProviderKind = 'local' | 'hash';

const DEFAULT_CACHE_DIR = fileURLToPath(new URL('../../../.cache/models', import.meta.url));

/* ------------------------------ hash ------------------------------- */

const STOPWORDS = new Set(
  'a an and are as at be by for from has have i in is it its me my of on or our the to with who will want seeking need across into over than that this deep senior junior se ses'.split(
    ' ',
  ),
);

function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+.\-/ ]+/g, ' ')
    .split(/[\s/]+/)
    .map((t) => t.replace(/^[.\-]+|[.\-]+$/g, ''))
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

export class HashEmbeddingProvider implements EmbeddingProvider {
  readonly model = 'hash-v1';

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((text) => {
      const vec = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
      const toks = tokens(text);
      const features = [...toks, ...toks.slice(1).map((t, i) => `${toks[i]}_${t}`)];
      const tf = new Map<string, number>();
      for (const f of features) tf.set(f, (tf.get(f) ?? 0) + 1);
      for (const [feature, count] of tf) {
        const h = fnv1a(feature);
        const weight = (1 + Math.log(count)) * (feature.includes('_') ? 0.5 : 1);
        vec[h % EMBEDDING_DIMENSIONS] += h & 0x80000000 ? -weight : weight;
      }
      return normalize(vec);
    });
  }
}

/* ------------------------------ local ------------------------------ */

type Extractor = (texts: string[], opts: { pooling: 'mean'; normalize: boolean }) => Promise<{ tolist(): number[][] }>;

export class LocalEmbeddingProvider implements EmbeddingProvider {
  readonly model = 'minilm-l6-v2';
  private extractor: Promise<Extractor> | null = null;

  constructor(private readonly cacheDir = process.env.MODELS_CACHE_DIR ?? DEFAULT_CACHE_DIR) {}

  private load(): Promise<Extractor> {
    this.extractor ??= (async () => {
      const { pipeline, env } = await import('@huggingface/transformers');
      env.cacheDir = this.cacheDir;
      // Container images ship the model; never reach Hugging Face from there.
      if (process.env.MODELS_OFFLINE === '1') env.allowRemoteModels = false;
      const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
        dtype: 'q8',
      });
      return extractor as unknown as Extractor;
    })();
    return this.extractor;
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const extractor = await this.load();
    const out: number[][] = [];
    for (let i = 0; i < texts.length; i += 16) {
      const batch = texts.slice(i, i + 16).map((t) => t || ' ');
      const tensor = await extractor(batch, { pooling: 'mean', normalize: true });
      out.push(...tensor.tolist());
      // Small batches + a yield keep the event loop responsive on small (1/4 vCPU) containers.
      await new Promise((resolve) => setImmediate(resolve));
    }
    return out;
  }
}

/* ----------------------------- factory ----------------------------- */

/**
 * Returns the configured provider. `local` falls back to `hash` (with a
 * warning) if the model cannot be loaded, so the demo always starts.
 */
export async function createEmbeddingProvider(
  kind: string = process.env.EMBEDDINGS_PROVIDER ?? 'local',
  log: (msg: string) => void = console.warn,
): Promise<EmbeddingProvider> {
  if (kind === 'hash') return new HashEmbeddingProvider();
  const local = new LocalEmbeddingProvider();
  try {
    await local.embed(['warm-up']);
    return local;
  } catch (err) {
    log(
      `[embeddings] Could not load the local MiniLM model (${(err as Error).message}); falling back to lexical hash embeddings.`,
    );
    return new HashEmbeddingProvider();
  }
}

/* ------------------------------ utils ------------------------------ */

export function normalize(vec: number[]): number[] {
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  return norm === 0 ? vec : vec.map((v) => v / norm);
}

export function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}
