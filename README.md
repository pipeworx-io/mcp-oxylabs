# mcp-oxylabs

Oxylabs MCP — Oxylabs Web Scraper API (oxylabs.io)

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1476+ live data sources.

## Tools

| Tool | Description |
|------|-------------|
| `oxylabs_scrape` | Scrape any URL via the Oxylabs Web Scraper API (rotating proxies, anti-bot handling) and return the page HTML with its upstream status code. Set render_js:true to load the page in a headless browser first — use for JS-heavy sites. Calls are synchronous proxying and can take 10-30 seconds. BYOK: _apiKey is "username:password" from the Oxylabs dashboard. Example: oxylabs_scrape({ url: "https://example.com", _apiKey: "myuser:mypass" }) |
| `oxylabs_google_search` | Run a Google search through the Oxylabs Web Scraper API and return structured organic results (position, title, url, description) — Google structured scraping with geo-targeting. Calls are synchronous proxying and can take 10-30 seconds. BYOK: _apiKey is "username:password" from the Oxylabs dashboard. Example: oxylabs_google_search({ query: "best espresso machine", geo_location: "United States", _apiKey: "myuser:mypass" }) |
| `oxylabs_amazon_product` | Fetch structured Amazon product data by ASIN via the Oxylabs Web Scraper API — Amazon structured scraping: title, price, currency, rating, reviews count, stock/availability. Calls are synchronous proxying and can take 10-30 seconds. BYOK: _apiKey is "username:password" from the Oxylabs dashboard. Example: oxylabs_amazon_product({ asin: "B08N5WRWNW", domain: "com", _apiKey: "myuser:mypass" }) |

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "oxylabs": {
      "url": "https://gateway.pipeworx.io/oxylabs/mcp"
    }
  }
}
```

### What this endpoint actually serves

`tools/list` at `https://gateway.pipeworx.io/oxylabs/mcp` returns the tools in the table
above **plus the shared Pipeworx meta-tools** — `ask_pipeworx`,
`discover_tools`, `search_within`, `remember`/`recall` and the rest of the
gateway-wide set. So the tool count you see is larger than this table: a
single-pack endpoint currently lists roughly 30 shared tools alongside the
pack's own. The connection's `initialize` response states its exact scope, and
is the authoritative answer for a given day.

This is deliberate, not multiplexing by accident. The meta-tools are what let a
scoped connection answer a question this pack does not cover — via
`ask_pipeworx`, which routes across the whole catalog — without you adding a
second MCP server. There is currently no way to mount a pack endpoint without
them; if the extra schemas cost you more context than the routing is worth,
connect to the full gateway once rather than to several pack endpoints.

Or connect to the full Pipeworx gateway to get every pack's tools listed
directly, instead of just this one's:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

Both URLs reach the same gateway and the same 1476+ data sources. The
only difference is which pack's tools are listed **directly**; `ask_pipeworx`
reaches all of them from either one.

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English —
this works on the pack endpoint above as well as on the full gateway:

```
ask_pipeworx({ question: "your question about Oxylabs data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT

## No MCP client? Call it over HTTP

This pack takes your own API key (`_apiKey`) — we don't front one for it, so there's no curl here that would run without it. Inspect any tool: `GET https://gateway.pipeworx.io/v1/tools/oxylabs_scrape`. Find one: `POST https://gateway.pipeworx.io/v1/tools/search_packs` with `{"query":"..."}`.
