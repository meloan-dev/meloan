// Curated Robinhood Chain meme contracts. Exact addresses prevent ticker look-alikes.
// Classification: CoinGecko's Robinhood Chain Meme category, checked 2026-10-09.
// Market admission also requires a valid price and a qualifying USDG/ETH/WETH pool.
export const MEME_TOKENS = [
  {
    "symbol": "AI",
    "name": "Artificial Inu",
    "address": "0x2e8c31162b855a2ffa90f6f8634643ad6f111e18",
    "source": "https://www.coingecko.com/en/coins/artificial-inu-3"
  },
  {
    "symbol": "CASHCAT",
    "name": "Cash Cat",
    "address": "0x020bfc650a365f8bb26819deaabf3e21291018b4",
    "source": "https://www.coingecko.com/en/coins/cash-cat"
  },
  {
    "symbol": "BONER",
    "name": "Boner Coin",
    "address": "0x98096d17e191b3da1d5f99a6d7b3584351b11e18",
    "source": "https://www.coingecko.com/en/coins/boner-coin"
  },
  {
    "symbol": "UBIK",
    "name": "ubik",
    "address": "0x812486eaea648819853f8e372dc9f1516c7868bd",
    "source": "https://www.coingecko.com/en/coins/ubik"
  },
  {
    "symbol": "MEME",
    "name": "A Meme Coin",
    "address": "0x385f4f8ae47651ce5f58f5265395a669f8281e18",
    "source": "https://www.coingecko.com/en/coins/a-meme-coin"
  },
  {
    "symbol": "SHROOM",
    "name": "MUSHROOM",
    "address": "0xab093def657f15df31b33922a95e047add645b29",
    "source": "https://www.coingecko.com/en/coins/mushroom-2"
  },
  {
    "symbol": "ROBINCAT",
    "name": "ROBINCAT",
    "address": "0xded852de9fe9ba9b6f27f39e8e81cf851a5c79cc",
    "source": "https://www.coingecko.com/en/coins/robincat"
  },
  {
    "symbol": "ROBIN",
    "name": "Robin the Frog",
    "address": "0x11b70d0243baf75e85ce03201a92b5b7c33beb59",
    "source": "https://www.coingecko.com/en/coins/robin-the-frog"
  },
  {
    "symbol": "VRAX",
    "name": "Commander Vrax",
    "address": "0x94641b97010608c3827fb058074889f19868ff33",
    "source": "https://www.coingecko.com/en/coins/commander-vrax-2"
  },
  {
    "symbol": "HOODINU",
    "name": "Hood Sword Inu",
    "address": "0xe59d493540a5b467fda09299a62c64c97db28972",
    "source": "https://www.coingecko.com/en/coins/hood-sword-inu"
  },
  {
    "symbol": "SWORDCAT",
    "name": "cat wif sword",
    "address": "0xeb72730086812cbe418f6036578e8a72248c2244",
    "source": "https://www.coingecko.com/en/coins/cat-wif-sword-3"
  },
  {
    "symbol": "CHUMP",
    "name": "Chump Coin",
    "address": "0x0e0d2c89a5a019fe1cf762e5e33187631dacc21b",
    "source": "https://www.coingecko.com/en/coins/chump-coin"
  },
  {
    "symbol": "JOHN",
    "name": "Little John",
    "address": "0xe170dc96ca10103e0d4c5d9293c5a3a72ee365a5",
    "source": "https://www.coingecko.com/en/coins/little-john"
  },
  {
    "symbol": "BABY",
    "name": "BabyCashCat",
    "address": "0x6a6a57d1e94eb586c5b505a1c81434bda3d6ed97",
    "source": "https://www.coingecko.com/en/coins/babycashcat"
  },
  {
    "symbol": "PIPEDOG",
    "name": "pipedog",
    "address": "0x5cb6f181081301b44905f3ae15419112ecabd8a6",
    "source": "https://www.coingecko.com/en/coins/pipedog"
  },
  {
    "symbol": "BUN",
    "name": "Bundle Cat",
    "address": "0x07ebb29a38fbcb41563817e5e19f2cec619c90d2",
    "source": "https://www.coingecko.com/en/coins/bundle-cat"
  },
  {
    "symbol": "HMM",
    "name": "Thinking Cat",
    "address": "0x7fe995a80075df3dc8ae11a9b82c7fe4202cd87f",
    "source": "https://www.coingecko.com/en/coins/thinking-cat"
  },
  {
    "symbol": "ZZZ",
    "name": "ZZZ",
    "address": "0x7dbf38976f6d3b9c529e7d9484a71898b409ee6a",
    "source": "https://www.coingecko.com/en/coins/zzz-2"
  },
  {
    "symbol": "TENDIES",
    "name": "TENDIES",
    "address": "0x45242320dbb855eea8fd36804c6487e10e97fcf9",
    "source": "https://www.coingecko.com/en/coins/tendies-2"
  }
];

const registry = new Map(MEME_TOKENS.map(token => [token.address, token]));
export const memeToken = address => registry.get(String(address || '').toLowerCase());
export const isMemeToken = address => !!memeToken(address);
