// Resolves each label in drugs.json to a DailyMed SPL set id and downloads
// the XML to data/dailymed/<setid>.xml. Writes data/dailymed/manifest.json
// recording what was resolved, so ingest never has to call the API.
//
//   npm run labels:fetch
//
// Resolution: search DailyMed by the brand or generic name, keep results
// whose title names the expected labeler (drops repackagers), take the most
// recently published. Already-downloaded XML is never re-fetched.
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';

const API = 'https://dailymed.nlm.nih.gov/dailymed/services/v2';
const DIR = 'data/dailymed';
const PAUSE_MS = 300;   // be polite; no documented limit, but this is a shared service

const list = JSON.parse(await readFile('drugs.json', 'utf8'));
await mkdir(DIR, { recursive: true });

const sleep = ms => new Promise(r => setTimeout(r, ms));
const exists = p => access(p).then(() => true, () => false);

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

// DailyMed returns published_date like "Jun 10, 2026"
const asDate = s => new Date(s);

// search:  brand or generic name passed to DailyMed
// labeler: substring the title must contain (drops repackagers)
// match:   substring the title must contain (e.g. "INJECTION" to pick a dosage form)
// exclude: substring the title must not contain (e.g. "HYCELA" to skip a co-formulation)
async function resolve({ search, labeler, match, exclude }) {
  const url = `${API}/spls.json?drug_name=${encodeURIComponent(search)}&pagesize=100`;
  const { data = [] } = await getJson(url);
  const up = s => s.toUpperCase();
  let candidates = data.filter(d => {
    const t = up(d.title);
    if (labeler && !t.includes(up(labeler))) return false;
    if (match   && !t.includes(up(match)))   return false;
    if (exclude &&  t.includes(up(exclude))) return false;
    return true;
  });
  // a title that starts with the search term is the product itself; one that
  // merely contains it is usually a combination ("PIOGLITAZONE AND METFORMIN")
  const own = candidates.filter(d => up(d.title).startsWith(up(search)));
  if (own.length) candidates = own;
  if (candidates.length === 0) return { error: `no label found for "${search}"${labeler ? ` by ${labeler}` : ''} (${data.length} results total)` };
  candidates.sort((a, b) => asDate(b.published_date) - asDate(a.published_date));
  const pick = candidates[0];
  return { setid: pick.setid, title: pick.title, published: pick.published_date, fallback: !labeler };
}

const manifest = [];
let fetched = 0, cached = 0, failed = 0;

for (const entry of list) {
  for (const spec of entry.labels) {
    const r = await resolve(spec);
    await sleep(PAUSE_MS);
    if (r.error) {
      console.log(`  ✗ ${entry.prod_ai.padEnd(28)} ${r.error}`);
      failed++;
      continue;
    }
    const path = `${DIR}/${r.setid}.xml`;
    if (await exists(path)) {
      cached++;
    } else {
      const res = await fetch(`${API}/spls/${r.setid}.xml`);
      if (!res.ok) { console.log(`  ✗ ${entry.prod_ai.padEnd(28)} download ${res.status} for ${r.setid}`); failed++; continue; }
      await writeFile(path, Buffer.from(await res.arrayBuffer()));
      fetched++;
      await sleep(PAUSE_MS);
    }
    manifest.push({ prod_ai: entry.prod_ai, search: spec.search, setid: r.setid, title: r.title, published: r.published, path });
    console.log(`  ${(await exists(path)) ? '·' : '↓'} ${entry.prod_ai.padEnd(28)} ${spec.search.padEnd(24)} ${r.title.slice(0, 70)}${r.fallback ? '   [no labeler filter]' : ''}`);
  }
}

await writeFile(`${DIR}/manifest.json`, JSON.stringify(manifest, null, 2));
console.log(`\n  resolved ${manifest.length} labels · downloaded ${fetched} · already on disk ${cached} · failed ${failed}`);
console.log(`  manifest: ${DIR}/manifest.json`);
if (failed) process.exitCode = 1;
