import { okxMarketDataService } from "../src/services/okx/market-rest";
import { getDefaultOkxInstruments } from "../src/services/okx/config";

async function main() {
  const instruments = getDefaultOkxInstruments();

  for (const instId of instruments) {
    const bundle = await okxMarketDataService.getMarketBundle(instId, {
      bookDepth: 5,
      candleBar: "1m",
      candleLimit: 30,
      tradeLimit: 10,
    });

    console.log(JSON.stringify({
      instId,
      last: bundle.ticker.last,
      change24hPct: bundle.ticker.change24hPct,
      bestBid: bundle.book.bestBid?.price,
      bestAsk: bundle.book.bestAsk?.price,
      candleCount: bundle.candles.length,
      tradeCount: bundle.trades.length,
      fundingRate: bundle.fundingRate?.fundingRate,
      openInterest: bundle.openInterest?.openInterest,
    }, null, 2));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
