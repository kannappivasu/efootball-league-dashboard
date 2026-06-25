import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const FOOTBALLERS = [
  "Zinedine Zidane",
  "Ronaldo Nazário",
  "Ronaldinho",
  "Thierry Henry",
  "Paolo Maldini",
  "Lionel Messi",
  "Cristiano Ronaldo",
  "Xavi Hernández",
  "Andrés Iniesta",
  "Roberto Baggio",
  "Kaká",
  "Luís Figo",
  "Rivaldo",
  "Alessandro Del Piero",
  "Fabio Cannavaro",
  "Raúl González",
  "Cafu",
  "Dennis Bergkamp",
  "Roberto Carlos",
  "Pavel Nedvěd",
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface MediaItem {
  title: string;
  thumb: string | null;
  caption: string | null;
  score: number;
}

interface WikipediaMediaItem {
  type?: string;
  title?: string;
  srcset?: Array<{ src?: string }>;
  caption?: { text?: string };
}

interface WikipediaMediaResponse {
  items?: WikipediaMediaItem[];
}

interface WikipediaSummaryResponse {
  thumbnail?: { source?: string };
  originalimage?: { source?: string };
}

async function fetchWithRetry<T>(url: string, retries = 4): Promise<T | null> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "efootball-league-dashboard/1.0 (seed script)" } });
      if (res.status === 429 || res.status >= 500) { await sleep(700 * attempt); continue; }
      if (res.status === 404) return null;
      if (!res.ok) { await sleep(400 * attempt); continue; }
      return await res.json() as T;
    } catch { await sleep(400 * attempt); }
  }
  return null;
}

async function fetchMedia(name: string): Promise<MediaItem[]> {
  const url = `https://en.wikipedia.org/api/rest_v1/page/media-list/${encodeURIComponent(name)}`;
  const json = await fetchWithRetry<WikipediaMediaResponse>(url);
  if (!json) return [];
  return (json.items ?? [])
    .filter((item) => item.type === "image" && Array.isArray(item.srcset) && item.srcset.length)
    .map((item) => {
      const srcset = item.srcset!;
      const src = srcset[srcset.length - 1]?.src ?? srcset[0]?.src;
      const thumb = src ? (src.startsWith("//") ? `https:${src}` : src) : null;
      return {
        title: item.title ?? "",
        thumb,
        caption: item.caption?.text ?? "",
        score: 0,
      };
    })
    .filter((m: MediaItem) => m.thumb && /\.(jpe?g|png)$/i.test(m.title));
}

// Fallback: REST summary thumbnail (the article's lead image).
async function fetchSummaryThumb(name: string): Promise<string | null> {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`;
  const json = await fetchWithRetry<WikipediaSummaryResponse>(url);
  return json?.thumbnail?.source ?? json?.originalimage?.source ?? null;
}

// Prime years: most of these legends peaked 1994-2010.
const PRIME_YEARS = new Set(Array.from({ length: 17 }, (_, i) => 1994 + i)); // 1994..2010

const POSITIVE_TOKENS = [
  "world cup", "fifa", "euro", "copa", "libertadores", "champions league", "ucl", "uefa cup",
  "in action", "playing", "playing for", "during the", "match", " vs ", " v ", "training",
  "cropped", "portrait", "headshot",
  "barcelona", "barça", "barca", "real madrid", "atletico", "atlético", "inter", "milan",
  "ac milan", "juventus", "juve", "parma", "lazio", "roma", "arsenal", "manchester",
  "liverpool", "chelsea", "newcastle", "psg", "psv", "ajax", "bayern", "leverkusen",
  "porto", "benfica", "sporting", "fenerbahçe", "fenerbahce", "fiorentina", "rimini",
  "lecce", "rubin kazan",
  "brazil", "brazilian", "france", "french", "italy", "italian", "italia", "spain", "spanish",
  "portugal", "portuguese", "netherlands", "dutch", "nederland", "argentina", "argentine",
  "czech", "campeonato", "la liga", "serie a", "premier", "eredivisie", "bundesliga",
];

// HARD negatives: jerseys, boots, kits, museum objects, awards galas, ceremony/cannes, post-retirement.
const HARD_NEGATIVE_TOKENS = [
  "jersey", "jerseys", "shirt", "boots", " kit", "kits", "museum", "trophy", "ballon d",
  "medal", "shoes", "presentation",
  "conference", "press", "interview", "festival", "cannes", "laureus", "awards", "award",
  "ceremony", "cerimônia", "cerimonia", "visited", "technical director", "coach", "manager",
  "pundit", "studio", "exhibition", "retired", "induction", "hall of",
  "forcejeo", "diadora", "stadium st", "stadium_st", "st petersburg", "spetersburg",
  "squad", "team photo", "group photo", "comparison", "infographic", "kit chart",
  "banana", ".svg", "diagram",
];

// Footballer surname tokens → bonus for filenames that reference the player themselves.
const NAME_TOKENS: Record<string, string[]> = {
  "Zinedine Zidane": ["zidane"],
  "Ronaldo Nazário": ["ronaldo", "nazario", "nazário", "lima"],
  "Ronaldinho": ["ronaldinho"],
  "Thierry Henry": ["henry"],
  "Paolo Maldini": ["maldini"],
  "Lionel Messi": ["messi"],
  "Cristiano Ronaldo": ["cristiano", "ronaldo"],
  "Xavi Hernández": ["xavi", "hernández", "hernandez"],
  "Andrés Iniesta": ["iniesta"],
  "Roberto Baggio": ["baggio"],
  "Kaká": ["kaká", "kaka"],
  "Luís Figo": ["figo"],
  "Rivaldo": ["rivaldo"],
  "Alessandro Del Piero": ["piero"],
  "Fabio Cannavaro": ["cannavaro"],
  "Raúl González": ["raúl", "raul", "gonzález", "gonzalez"],
  "Cafu": ["cafu"],
  "Dennis Bergkamp": ["bergkamp"],
  "Roberto Carlos": ["roberto carlos", "carlos"],
  "Pavel Nedvěd": ["nedvěd", "nedved"],
};

function scoreImage(item: MediaItem, footballer: string): number {
  const text = `${item.title} ${item.caption}`.toLowerCase();
  let score = 0;

  // HARD negatives first — jerseys/boots/awards are almost always wrong.
  for (const tok of HARD_NEGATIVE_TOKENS) if (text.includes(tok)) score -= 14;

  // Strong bonus when filename references the footballer themselves (likely a portrait).
  const toks = NAME_TOKENS[footballer] ?? [];
  for (const tk of toks) if (item.title.toLowerCase().includes(tk)) score += 5;

  // Year scoring.
  const years = text.match(/\b(19\d{2}|20\d{2})\b/g) ?? [];
  for (const y of years) {
    const n = parseInt(y, 10);
    if (PRIME_YEARS.has(n)) score += 6;
    else if (n >= 2011 && n <= 2015) score -= 2;
    else if (n >= 2016) score -= 12;  // post-retirement / coach era → strong penalty
    else if (n < 1990) score -= 2;
  }

  // Cropped/tight portrait good for avatars.
  if (/\b(cropped|portrait|headshot|head shot)\b/i.test(item.title)) score += 3;

  // Context positives (years already handled).
  for (const tok of POSITIVE_TOKENS) if (text.includes(tok)) score += 2;

  return score;
}

function pickBest(items: MediaItem[], footballer: string): MediaItem | null {
  if (!items.length) return null;
  for (const it of items) it.score = scoreImage(it, footballer);
  items.sort((a, b) => b.score - a.score);
  return items[0];
}

async function main() {
  const players = await prisma.player.findMany({ orderBy: [{ order: "asc" }, { name: "asc" }] });
  if (players.length === 0) { console.error("No players found. Run `npm run db:seed` first."); process.exit(1); }

  console.log("Fetching prime-era images from Wikipedia…\n");
  const picks: { footballer: string; thumb: string; caption: string; score: number; title: string }[] = [];
  for (const f of FOOTBALLERS) {
    let items = await fetchMedia(f);
    if (items.length === 0) {
      await sleep(2500);
      items = await fetchMedia(f);
    }
    if (items.length === 0) {
      await sleep(4000);
      items = await fetchMedia(f);
    }
    let best = pickBest(items, f);
    if (!best) {
      // Final fallback: the article's lead thumbnail.
      const lead = await fetchSummaryThumb(f);
      if (lead) best = { title: "(lead image)", thumb: lead, caption: "lead image", score: 0 };
    }
    if (best && best.thumb) {
      picks.push({ footballer: f, thumb: best.thumb, caption: best.caption ?? "", score: best.score, title: best.title });
      console.log(`✓ ${f}`);
      console.log(`   ${best.title}`);
      if (best.caption) console.log(`   caption: ${best.caption}`);
      console.log(`   score: ${best.score}  (out of ${items.length} images)`);
    } else {
      console.log(`✗ ${f} — no usable image`);
    }
    await sleep(1800); // be nice to the Wikipedia REST API
  }

  if (picks.length === 0) { console.error("Could not fetch any images."); process.exit(1); }

  const shuffled = shuffle(picks);
  console.log("\nAssigning unique avatars:\n");
  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    if (i >= shuffled.length) { console.warn(`  ⚠ ${p.name}: no unique avatar left`); continue; }
    const pick = shuffled[i];
    await prisma.player.update({ where: { id: p.id }, data: { avatar: pick.thumb } });
    console.log(`  ${p.name}  ⟵  ${pick.footballer}  (score ${pick.score})`);
  }

  await prisma.auditLog.create({ data: { actor: "seed", action: "avatars.assign", detail: `Assigned ${Math.min(players.length, shuffled.length)} prime-era footballer avatars` } });
  console.log(`\n✓ Done — ${Math.min(players.length, shuffled.length)} avatars assigned.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
