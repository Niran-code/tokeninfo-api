# Token Metadata API

## Overview
The **Token Metadata API** is an open-source REST API that provides structured token information (name, symbol, image, and contract address) for any **ERC-20 token** across major EVM-compatible blockchains.  
It operates entirely on public data sources — no API keys or private services required.

This API serves as a reliable metadata layer for decentralized wallets, explorers, and dApps.

---

## Features

- **Multi-chain support**: Ethereum, Polygon, BSC, Arbitrum, Optimism, Avalanche, Base, and Fantom  
- **Accurate token metadata**: Fetches name, symbol, and logo  
- **Open-source and keyless**: No API keys or rate limits from paid providers  
- **Batch token lookup**: Resolve multiple token contracts in one request  
- **Layered fallback system**: DefiLlama → CoinGecko → TrustWallet assets → On-chain data  
- **LRU caching**: Reduces redundant API calls and improves performance  
- **Supports over 250,000+ ERC-20 tokens** in the required format  

---

## Tech Stack

| Component | Technology |
|------------|-------------|
| Runtime | Node.js 20+ |
| Framework | Express.js |
| Blockchain SDK | Ethers.js |
| Cache | LRUCache |
| APIs Used | DefiLlama, CoinGecko (public), TrustWallet assets |
| Output Format | JSON |
| License | MIT |

---

## Installation

Clone the repository:
```bash
git clone https://github.com/<your-username>/tokeninfo-api.git
cd tokeninfo-api
