import express from "express";
import fetch from "node-fetch";
import { LRUCache } from "lru-cache";
import { ethers } from "ethers";

const app = express();
const PORT = process.env.PORT || 4000;

// Cache setup
const cache = new LRUCache({ max: 5000, ttl: 1000 * 60 * 60 });

// Chain mapping
const CHAIN_MAP = {
  "1": "ethereum",
  "ethereum": "ethereum",
  "137": "polygon",
  "polygon": "polygon",
  "56": "bsc",
  "bsc": "bsc",
  "42161": "arbitrum",
  "arbitrum": "arbitrum",
  "10": "optimism",
  "optimism": "optimism",
  "43114": "avalanche",
  "avax": "avalanche",
  "8453": "base",
  "base": "base",
  "250": "fantom",
  "fantom": "fantom"
};

const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)"
];

const FALLBACK_RPC = process.env.FALLBACK_RPC || "https://cloudflare-eth.com";
const provider = new ethers.JsonRpcProvider(FALLBACK_RPC);

function normalizeAddress(addr) {
  try {
    return ethers.getAddress(addr);
  } catch {
    return addr.toLowerCase();
  }
}

function resolveChainSlug(chainInput) {
  if (!chainInput) return "ethereum";
  const key = String(chainInput).toLowerCase();
  return CHAIN_MAP[key] || key;
}

// --- DefiLlama ---
async function fetchFromDefiLlama(chainSlug, addresses) {
  const key = `llama:${chainSlug}:${addresses.join(",")}`;
  if (cache.has(key)) return cache.get(key);

  const url = `https://coins.llama.fi/prices/current/${addresses.map(a => `${chainSlug}:${a}`).join(",")}`;
  const res = await fetch(url);
  if (!res.ok) return { coins: {} };
  const json = await res.json();
  cache.set(key, json);
  return json;
}

// --- CoinGecko universal search ---
async function fetchFromCoinGeckoBySymbol(symbol) {
  try {
    const key = `cg:${symbol.toLowerCase()}`;
    if (cache.has(key)) return cache.get(key);

    const url = `https://api.coingecko.com/api/v3/search?query=${symbol}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();

    if (data.coins && data.coins.length > 0) {
      const match = data.coins.find(c => c.symbol?.toLowerCase() === symbol.toLowerCase()) || data.coins[0];
      const result = {
        id: match.id,
        symbol: match.symbol?.toLowerCase(),
        name: match.name,
        image: match.large || match.thumb || null
      };
      cache.set(key, result);
      return result;
    }
    return null;
  } catch {
    return null;
  }
}

// --- On-chain fallback ---
async function fetchOnChainNameSymbol(address) {
  const key = `onchain:${address.toLowerCase()}`;
  if (cache.has(key)) return cache.get(key);
  try {
    const contract = new ethers.Contract(address, ERC20_ABI, provider);
    const [name, symbol] = await Promise.allSettled([
      contract.name().catch(() => null),
      contract.symbol().catch(() => null)
    ]);
    const result = {
      name: name.status === "fulfilled" ? name.value : null,
      symbol: symbol.status === "fulfilled" ? symbol.value : null
    };
    cache.set(key, result);
    return result;
  } catch {
    return { name: null, symbol: null };
  }
}

function formatTokenOutput(rawName, rawSymbol, imageUrl, contractAddress) {
  const symbol = rawSymbol ? rawSymbol.toLowerCase() : null;
  const name = rawName || (symbol ? symbol.toUpperCase() : null);
  const id = name ? name.toLowerCase().replace(/\s+/g, "-") : (symbol || contractAddress).toLowerCase();
  return { id, symbol, name, image: imageUrl || null, contractAddress: normalizeAddress(contractAddress) };
}

// --- API Routes ---
app.get("/api/tokeninfo", async (req, res) => {
  try {
    const { chain = "ethereum", address } = req.query;
    if (!address) return res.status(400).json({ error: "Missing address" });
    const out = await handleBatch([address], chain);
    res.json(out[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/tokeninfo/batch", async (req, res) => {
  try {
    const { chain = "ethereum", addresses } = req.query;
    if (!addresses) return res.status(400).json({ error: "Missing addresses" });
    const addrList = String(addresses).split(",").map(a => a.trim()).filter(Boolean);
    const out = await handleBatch(addrList, chain);
    res.json(out);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// --- Core Logic ---
async function handleBatch(addresses, chainInput) {
  const chainSlug = resolveChainSlug(chainInput);
  const normalized = addresses.map(a => a.toLowerCase());
  const results = [];
  let llamaData = { coins: {} };

  try {
    llamaData = await fetchFromDefiLlama(chainSlug, normalized);
  } catch (err) {
    console.warn("DefiLlama failed:", err.message);
  }

  for (const addr of normalized) {
    const tokenInfo = llamaData.coins?.[`${chainSlug}:${addr}`] || {};
    let name = tokenInfo.name || tokenInfo.symbol || null;
    let symbol = tokenInfo.symbol || null;
    let image = tokenInfo.logo || tokenInfo.logo_url || null;

    if (!name || !symbol) {
      const onchain = await fetchOnChainNameSymbol(addr);
      if (!name && onchain.name) name = onchain.name;
      if (!symbol && onchain.symbol) symbol = onchain.symbol;
    }

    // Always try CoinGecko for image
    if (!image && symbol) {
      const cgData = await fetchFromCoinGeckoBySymbol(symbol);
      if (cgData && cgData.image) image = cgData.image;
      if (!name && cgData?.name) name = cgData.name;
    }

    results.push(formatTokenOutput(name, symbol, image, addr));
  }

  return results;
}

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`✅ tokeninfo API running on http://localhost:${PORT}`);
});
