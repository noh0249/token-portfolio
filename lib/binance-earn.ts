export type EarnPosition = { asset: string; totalAmount: string; productId: string };
type Balance = { symbol: string; amount: number };

export function reconcileBinanceEarn(spot: Balance[], positions: EarnPosition[]): Balance[] {
  const earn = new Map<string, number>(), products = new Set<string>();
  for (const p of positions) {
    const amount = Number(p.totalAmount);
    if (!/^[A-Z0-9]{1,30}$/.test(p.asset) || typeof p.totalAmount !== 'string' || !p.totalAmount.trim() || !Number.isFinite(amount) || amount < 0 || !p.productId || products.has(p.productId)) {
      throw new Error('Invalid Earn position');
    }
    products.add(p.productId);
    earn.set(p.asset, (earn.get(p.asset) ?? 0) + amount);
  }
  // Replace only LD receipts whose underlying balance was verified by the Earn API.
  // Preserve every unverified receipt, so missing valuations keep daily snapshots incomplete.
  const represented = new Set(spot.filter(b => b.symbol.startsWith('LD') && b.symbol.length >= 4 && earn.has(b.symbol.slice(2))).map(b => b.symbol.slice(2)));
  const combined = new Map<string, number>();
  for (const b of spot) {
    if (b.symbol.startsWith('LD') && represented.has(b.symbol.slice(2))) continue;
    combined.set(b.symbol, (combined.get(b.symbol) ?? 0) + b.amount);
  }
  for (const asset of represented) combined.set(asset, (combined.get(asset) ?? 0) + earn.get(asset)!);
  return [...combined].map(([symbol, amount]) => ({ symbol, amount })).filter(b => b.amount > 0);
}
