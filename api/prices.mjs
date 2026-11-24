const YAHOO_ENDPOINTS = [
  'https://query1.finance.yahoo.com/v8/finance/chart/BBCA.JK?interval=1d&range=5d',
  'https://query2.finance.yahoo.com/v8/finance/chart/BBCA.JK?interval=1d&range=5d',
];

function getWibTimestamp() {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(new Date());
    const get = (t) => parts.find((p) => p.type === t)?.value || '00';
    const hr = get('hour') === '24' ? '00' : get('hour');
    return `${get('year')}-${get('month')}-${get('day')} ${hr}:${get('minute')}:${get('second')}`;
  } catch {
    return new Date().toISOString().replace('T', ' ').slice(0, 19);
  }
}

export async function fetchBbcaPrice(fetchImpl = fetch) {
  for (const url of YAHOO_ENDPOINTS) {
    try {
      const res = await fetchImpl(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(7000),
      });
      if (!res.ok) continue;
      const json = await res.json();
      const meta = json?.chart?.result?.[0]?.meta;
      const price = Number(meta?.regularMarketPrice || meta?.chartPreviousClose || meta?.previousClose || 0);
      if (price > 0) {
        return { price: Math.round(price), source: 'Yahoo Finance' };
      }
    } catch (err) {
      console.error('[api/prices] BBCA fetch error:', url, err?.message || err);
    }
  }
  return { price: 0, source: '' };
}

export async function fetchBtcPrice(fetchImpl = fetch) {
  // 1. Indodax IDR spot market (fast, reliable, no strict global rate-limit)
  try {
    const res = await fetchImpl('https://indodax.com/api/ticker/btcidr', {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(7000),
    });
    if (res.ok) {
      const json = await res.json();
      const last = Number(json?.ticker?.last || 0);
      if (last > 0) return { price: Math.round(last), source: 'Indodax' };
    }
  } catch (err) {
    console.error('[api/prices] Indodax BTC fetch error:', err?.message || err);
  }

  // 2. Coinbase spot IDR fallback
  try {
    const res = await fetchImpl('https://api.coinbase.com/v2/prices/BTC-IDR/spot', {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(7000),
    });
    if (res.ok) {
      const json = await res.json();
      const spot = Number(json?.data?.amount || 0);
      if (spot > 0) return { price: Math.round(spot), source: 'Coinbase' };
    }
  } catch (err) {
    console.error('[api/prices] Coinbase BTC fetch error:', err?.message || err);
  }

  // 3. CoinGecko fallback
  try {
    const res = await fetchImpl('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=idr', {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(7000),
    });
    if (res.ok) {
      const json = await res.json();
      const cg = Number(json?.bitcoin?.idr || 0);
      if (cg > 0) return { price: Math.round(cg), source: 'CoinGecko' };
    }
  } catch (err) {
    console.error('[api/prices] CoinGecko BTC fetch error:', err?.message || err);
  }

  return { price: 0, source: '' };
}

export async function GET(request) {
  try {
    const reqUrl = new URL(request.url, 'http://localhost');
    const forceRefresh = reqUrl.searchParams.get('refresh') === '1' || reqUrl.searchParams.get('refresh') === 'true';

    const [bbca, btc] = await Promise.all([fetchBbcaPrice(), fetchBtcPrice()]);
    const updatedAt = getWibTimestamp();

    const cacheHeader = forceRefresh
      ? 'no-store'
      : 'public, s-maxage=300, stale-while-revalidate=600';

    return Response.json(
      {
        status: bbca.price > 0 || btc.price > 0 ? 'success' : 'error',
        prices: {
          'BBCA/IDR': bbca.price,
          'BTC/IDR': btc.price,
          updatedAt,
          sources: {
            bbca: bbca.source || 'unavailable',
            btc: btc.source || 'unavailable',
          },
        },
      },
      {
        status: 200,
        headers: {
          'Cache-Control': cacheHeader,
        },
      }
    );
  } catch (err) {
    console.error('[api/prices] Unhandled error:', err);
    return Response.json(
      { status: 'error', message: 'Gagal mengambil harga pasar saat ini' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
