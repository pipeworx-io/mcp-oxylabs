# mcp-oxylabs

Oxylabs MCP — Oxylabs Web Scraper API (oxylabs.io)

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

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

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Oxylabs data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
