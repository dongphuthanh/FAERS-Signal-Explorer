// Text -> 384-dim unit vectors, locally, on the CPU.
//
// all-MiniLM-L6-v2 via @xenova/transformers (ONNX Runtime). The model is
// downloaded once into data/models/ and read from disk after that. Mean
// pooling + L2 normalisation, so cosine similarity is a plain dot product and
// pgvector's <=> operator gives 1 - cosine.
import { pipeline, env } from '@xenova/transformers';

env.cacheDir = 'data/models';
env.allowLocalModels = false;

export const MODEL = 'Xenova/all-MiniLM-L6-v2';
export const DIMS = 384;

let extractor;   // loaded once per process

async function load() {
  extractor ??= await pipeline('feature-extraction', MODEL, { quantized: true });
  return extractor;
}

// texts: string[] -> number[][] (each length DIMS)
export async function embed(texts, { batchSize = 32 } = {}) {
  const pipe = await load();
  const out = [];
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const t = await pipe(batch, { pooling: 'mean', normalize: true });
    out.push(...t.tolist());
  }
  return out;
}

// pgvector's text form: '[0.1,0.2,...]'
export const toVectorLiteral = v => `[${v.join(',')}]`;
