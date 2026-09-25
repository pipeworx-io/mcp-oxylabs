interface McpToolDefinition {
  name: string;
  description: string;
  /** Human-facing one-liner (fleet #1967). Optional; consumers fall back to
   *  description. Kept in step with shared/src/types.ts — scripts/lib/
   *  check-inlined-types.mjs reports drift at publish time. */
  summary?: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
    anyOf?: Array<{ required: string[] }>;
    oneOf?: Array<{ required: string[] }>;
    allOf?: Array<{ required: string[] }>;
  };
  outputSchema?: Record<string, unknown>;
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * Oxylabs MCP — Oxylabs Web Scraper API (oxylabs.io)
 *
 * Oxylabs exposes a SINGLE realtime endpoint (POST
 * https://realtime.oxylabs.io/v1/queries); the target site/behavior is
 * selected via the `source` body field. Auth is HTTP Basic with the Oxylabs
 * API user's username and password.
 *
 * Tools:
 * - oxylabs_scrape:         source "universal" — fetch any URL, optionally
 *                           browser-rendered (render:"html") for JS-heavy sites.
 * - oxylabs_google_search:  source "google_search" + parse:true — structured
 *                           Google organic results.
 * - oxylabs_amazon_product: source "amazon_product" + parse:true — structured
 *                           Amazon product data by ASIN.
 *
 * BYO-key via _apiKey as "username:password" (the API-user credentials from
 * the Oxylabs dashboard, https://dashboard.oxylabs.io). Free trial includes
 * up to 2K results (per oxylabs.io, verified 2026-07).
 *
 * Response envelope: { results: [{ content, status_code, url, ... }] } —
 * `content` is a STRING for raw HTML and an OBJECT when parse:true.
 *
 * Realtime calls proxy the scrape synchronously and can take 10-30s; every
 * request uses a 25s AbortController timeout.
 *
 * WEB-VERIFIED against https://developers.oxylabs.io (2026-07); endpoint
 * probed live — bogus credentials return HTTP 401.
 */


const ENDPOINT = 'https://realtime.oxylabs.io/v1/queries';
const DASHBOARD_URL = 'https://dashboard.oxylabs.io';
const DOCS_URL = 'https://developers.oxylabs.io';

const KEY_HINT =
  `Pass your Oxylabs Web Scraper API credentials via _apiKey in the form "username:password" — the API-user username and password from the Oxylabs dashboard (${DASHBOARD_URL}). Free trial includes up to 2K results. Docs: ${DOCS_URL}`;

// Cap raw HTML returned downstream — pages can be megabytes.
const MAX_CONTENT_CHARS = 20000;
// Oxylabs realtime calls proxy the scrape synchronously (10-30s is normal).
const TIMEOUT_MS = 25000;

const tools: McpToolExport['tools'] = [
  {
    name: 'oxylabs_scrape',
    description:
      'Scrape any URL via the Oxylabs Web Scraper API (rotating proxies, anti-bot handling) and return the page HTML with its upstream status code. Set render_js:true to load the page in a headless browser first — use for JS-heavy sites. Calls are synchronous proxying and can take 10-30 seconds. BYOK: _apiKey is "username:password" from the Oxylabs dashboard. Example: oxylabs_scrape({ url: "https://example.com", _apiKey: "myuser:mypass" })',
    inputSchema: {
      type: 'object' as const,
      properties: {
        url: {
          type: 'string',
          description: 'The absolute URL to scrape, e.g. "https://example.com/products"',
        },
        render_js: {
          type: 'boolean',
          description:
            'When true, render the page in a headless browser (executes JavaScript) before returning HTML. Use for JS-heavy sites. Default false (faster raw fetch).',
        },
        geo_location: {
          type: 'string',
          description:
            'Geo location to proxy the request from, e.g. "United States" or "Germany". Optional.',
        },
        _apiKey: {
          type: 'string',
          description:
            'Oxylabs API credentials as "username:password" from the Oxylabs dashboard (https://dashboard.oxylabs.io). Free trial includes up to 2K results.',
        },
      },
      required: ['url', '_apiKey'],
    },
  },
  {
    name: 'oxylabs_google_search',
    description:
      'Run a Google search through the Oxylabs Web Scraper API and return structured organic results (position, title, url, description) — Google structured scraping with geo-targeting. Calls are synchronous proxying and can take 10-30 seconds. BYOK: _apiKey is "username:password" from the Oxylabs dashboard. Example: oxylabs_google_search({ query: "best espresso machine", geo_location: "United States", _apiKey: "myuser:mypass" })',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'The Google search query, e.g. "best espresso machine 2026"',
        },
        geo_location: {
          type: 'string',
          description:
            'Geo location for localized results, e.g. "United States", "London,England,United Kingdom". Optional.',
        },
        pages: {
          type: 'number',
          description: 'Number of result pages to fetch. Default 1.',
        },
        _apiKey: {
          type: 'string',
          description:
            'Oxylabs API credentials as "username:password" from the Oxylabs dashboard (https://dashboard.oxylabs.io). Free trial includes up to 2K results.',
        },
      },
      required: ['query', '_apiKey'],
    },
  },
  {
    name: 'oxylabs_amazon_product',
    description:
      'Fetch structured Amazon product data by ASIN via the Oxylabs Web Scraper API — Amazon structured scraping: title, price, currency, rating, reviews count, stock/availability. Calls are synchronous proxying and can take 10-30 seconds. BYOK: _apiKey is "username:password" from the Oxylabs dashboard. Example: oxylabs_amazon_product({ asin: "B08N5WRWNW", domain: "com", _apiKey: "myuser:mypass" })',
    inputSchema: {
      type: 'object' as const,
      properties: {
        asin: {
          type: 'string',
          description: 'The Amazon product ASIN (10-character ID), e.g. "B08N5WRWNW"',
        },
        domain: {
          type: 'string',
          description:
            'Amazon marketplace domain suffix: "com" (default), "co.uk", "de", "co.jp", etc.',
        },
        _apiKey: {
          type: 'string',
          description:
            'Oxylabs API credentials as "username:password" from the Oxylabs dashboard (https://dashboard.oxylabs.io). Free trial includes up to 2K results.',
        },
      },
      required: ['asin', '_apiKey'],
    },
  },
];

// ---------------------------------------------------------------------------

function oxylabsError(status: number, tool: string, detail?: string): Error {
  const tail = detail ? ` — ${detail}` : '';
  if (status === 401 || status === 403) {
    return new Error(
      `Oxylabs ${tool}: auth failed (HTTP ${status}). Check the credential format — _apiKey must be "username:password" (both parts, separated by a colon), using the API-user credentials from ${DASHBOARD_URL}. ${KEY_HINT}${tail}`,
    );
  }
  if (status === 429 || status === 402) {
    return new Error(
      `Oxylabs ${tool}: rate-limited or out of credits (HTTP ${status}). Your Oxylabs plan's request rate or result quota is exhausted — slow down and retry, or review your plan/usage at ${DASHBOARD_URL}.${tail}`,
    );
  }
  if (status === 400) {
    return new Error(
      `Oxylabs ${tool}: invalid request (HTTP 400) — check the arguments against ${DOCS_URL}.${tail}`,
    );
  }
  return new Error(`Oxylabs ${tool} error: HTTP ${status}${tail}`);
}

// Pull a message out of a non-2xx body, best-effort. Oxylabs error bodies are
// usually JSON with a `message` field.
async function readErrorDetail(res: Response): Promise<string | undefined> {
  try {
    const text = await res.text();
    if (!text) return undefined;
    try {
      const j = JSON.parse(text) as { message?: unknown; detail?: unknown };
      const m = j.message ?? j.detail;
      if (typeof m === 'string') return m;
      if (m != null) return JSON.stringify(m);
    } catch {
      return text.slice(0, 300);
    }
  } catch {
    // ignore
  }
  return undefined;
}

interface OxylabsResult {
  content?: unknown;
  status_code?: number;
  url?: string;
  [key: string]: unknown;
}

// POST to the single realtime endpoint; returns the first entry of the
// { results: [...] } envelope.
async function oxylabsPost(
  body: Record<string, unknown>,
  apiKey: string,
  tool: string,
): Promise<OxylabsResult> {
  if (!apiKey) {
    throw new Error(`Oxylabs ${tool} requires credentials. ${KEY_HINT}`);
  }
  if (!apiKey.includes(':')) {
    throw new Error(
      `Oxylabs ${tool}: _apiKey must be in "username:password" form (a colon separating the two parts). ${KEY_HINT}`,
    );
  }

  // HTTP Basic with the "username:password" pair as-is.
  const auth = 'Basic ' + btoa(apiKey);

  // Realtime calls proxy the scrape synchronously — allow up to 25s.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    const e = err as Error;
    if (e.name === 'AbortError') {
      throw new Error(
        `Oxylabs ${tool}: timed out after ${TIMEOUT_MS / 1000}s. Oxylabs realtime calls proxy the scrape synchronously and heavy targets (JS rendering, multi-page) can exceed this window — retry, simplify the request (fewer pages, render_js off), or try again later.`,
      );
    }
    throw new Error(`Oxylabs ${tool}: network error contacting realtime.oxylabs.io — ${e.message}`);
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw oxylabsError(res.status, tool, detail);
  }

  const text = await res.text();
  let data: { results?: OxylabsResult[] };
  try {
    data = JSON.parse(text) as { results?: OxylabsResult[] };
  } catch {
    throw new Error(
      `Oxylabs ${tool}: unexpected non-JSON response from realtime.oxylabs.io (HTTP ${res.status}).`,
    );
  }

  const first = data.results?.[0];
  if (!first) {
    throw new Error(
      `Oxylabs ${tool}: the response contained an empty results array — the job may have produced zero results. Check the arguments and retry.`,
    );
  }
  return first;
}

// Truncate a raw-HTML string so huge pages stay LLM-friendly.
function truncate(content: string): { content: string; content_length: number; truncated: boolean } {
  const truncated = content.length > MAX_CONTENT_CHARS;
  return {
    content: truncated ? content.slice(0, MAX_CONTENT_CHARS) : content,
    content_length: content.length,
    truncated,
  };
}

function pick<T = unknown>(obj: unknown, key: string): T | undefined {
  if (obj && typeof obj === 'object') {
    return (obj as Record<string, unknown>)[key] as T | undefined;
  }
  return undefined;
}

// ---------------------------------------------------------------------------

async function scrape(args: Record<string, unknown>, apiKey: string) {
  const url = args.url as string;
  if (!url) {
    throw new Error('oxylabs_scrape requires a `url` (absolute, e.g. "https://example.com").');
  }

  const body: Record<string, unknown> = { source: 'universal', url };
  if (args.render_js) body.render = 'html';
  if (args.geo_location) body.geo_location = String(args.geo_location);

  const result = await oxylabsPost(body, apiKey, 'oxylabs_scrape');

  // universal source returns content as a raw HTML string.
  const raw = result.content;
  const html = typeof raw === 'string' ? raw : JSON.stringify(raw ?? '');
  return {
    url: result.url ?? url,
    status_code: result.status_code ?? null,
    rendered: Boolean(args.render_js),
    ...truncate(html),
  };
}

interface OrganicEntry {
  pos?: number;
  url?: string;
  title?: string;
  desc?: string;
}

async function googleSearch(args: Record<string, unknown>, apiKey: string) {
  const query = args.query as string;
  if (!query) {
    throw new Error('oxylabs_google_search requires a `query`, e.g. "best espresso machine".');
  }
  const pages = typeof args.pages === 'number' && args.pages > 0 ? Math.min(args.pages, 5) : 1;

  const body: Record<string, unknown> = {
    source: 'google_search',
    query,
    parse: true,
    pages,
  };
  if (args.geo_location) body.geo_location = String(args.geo_location);

  const result = await oxylabsPost(body, apiKey, 'oxylabs_google_search');

  // parse:true → content is an object: content.results.organic = [{pos,url,title,desc},...]
  const content = result.content;
  const organicRaw =
    pick<OrganicEntry[]>(pick(content, 'results'), 'organic') ?? [];
  const organic = (Array.isArray(organicRaw) ? organicRaw : []).map((r) => ({
    pos: r.pos ?? null,
    title: r.title ?? null,
    url: r.url ?? null,
    desc: r.desc ?? null,
  }));

  return {
    query,
    pages_requested: pages,
    status_code: result.status_code ?? null,
    result_count: organic.length,
    organic,
  };
}

async function amazonProduct(args: Record<string, unknown>, apiKey: string) {
  const asin = args.asin as string;
  if (!asin) {
    throw new Error(
      'oxylabs_amazon_product requires an `asin` (10-character Amazon product ID, e.g. "B08N5WRWNW").',
    );
  }
  const domain = (args.domain as string) || 'com';

  const body: Record<string, unknown> = {
    source: 'amazon_product',
    query: asin,
    domain,
    parse: true,
  };

  const result = await oxylabsPost(body, apiKey, 'oxylabs_amazon_product');

  // parse:true → content is the parsed product object.
  const c = result.content;
  return {
    asin: pick<string>(c, 'asin') ?? asin,
    domain,
    url: result.url ?? pick<string>(c, 'url') ?? null,
    status_code: result.status_code ?? null,
    title: pick<string>(c, 'title') ?? null,
    brand: pick<string>(c, 'brand') ?? null,
    price: pick<number>(c, 'price') ?? null,
    currency: pick<string>(c, 'currency') ?? null,
    rating: pick<number>(c, 'rating') ?? null,
    reviews_count: pick<number>(c, 'reviews_count') ?? null,
    stock: pick<string>(c, 'stock') ?? null,
  };
}

// ---------------------------------------------------------------------------

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const apiKey = args._apiKey as string;
  delete args._apiKey;

  if (!apiKey) {
    throw new Error(`Oxylabs requires credentials via _apiKey. ${KEY_HINT}`);
  }

  switch (name) {
    case 'oxylabs_scrape':
      return scrape(args, apiKey);
    case 'oxylabs_google_search':
      return googleSearch(args, apiKey);
    case 'oxylabs_amazon_product':
      return amazonProduct(args, apiKey);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;
