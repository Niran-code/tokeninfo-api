import express from "express";
import fetch from "node-fetch";
import Fuse from "fuse.js";
import { LRUCache } from "lru-cache";

const app = express();
const PORT = 4000;

const cache = new LRUCache({ max: 5000, ttl: 1000 * 60 * 60 });

// Supported EVM Chains
const EVM_CHAINS = [
  "ethereum",
  "polygon-pos",
  "arbitrum-one",
  "optimistic-ethereum",
  "avalanche",
  "base",
  "bsc",
  "fantom",
  "gnosis",
  "celo",
  "linea",
  "scroll",
  "zksync"
];

// Load full token list from CoinGecko once on startup
let fullTokenList = [];

async function loadTokens() {
  console.log("🌍 Fetching token list from CoinGecko...");
  const url = "https://api.coingecko.com/api/v3/coins/list?include_platform=true";
  const res = await fetch(url);
  const data = await res.json();
  fullTokenList = data.filter(
    (t) =>
      t.platforms &&
      Object.keys(t.platforms).some((p) => EVM_CHAINS.includes(p))
  );
  console.log(`✅ Loaded ${fullTokenList.length} EVM tokens`);
}

// Build fuzzy search index
function buildFuse() {
  return new Fuse(fullTokenList, {
    keys: ["id", "symbol", "name"],
    threshold: 0.3
  });
}

// --- API Search Route ---
app.get("/api/search", async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) return res.status(400).json({ error: "Missing query" });

    const fuse = buildFuse();
    const matches = fuse.search(query).slice(0, 10);
    const results = [];

    for (const { item } of matches) {
      for (const [chain, address] of Object.entries(item.platforms)) {
        if (!EVM_CHAINS.includes(chain) || !address || !address.startsWith("0x")) continue;

        results.push({
          id: item.id,
          symbol: item.symbol?.toUpperCase(),
          name: item.name,
          chain,
          contractAddress: address,
          image: `https://coin-images.coingecko.com/coins/images/${item.id}.png`
        });
      }
    }

    if (results.length === 0) {
      return res.json([{ message: "No EVM token match found" }]);
    }

    res.json(results);
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ error: err.message });
  }
});

// --- Startup ---
app.listen(PORT, async () => {
  await loadTokens();
  console.log(`✅ Token search API running at http://localhost:${PORT}`);
});
