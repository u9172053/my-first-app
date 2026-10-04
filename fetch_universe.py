"""東証の全上場銘柄 (数字4桁コード 1300-9999) の日足を Yahoo Finance から取得して data/daily に CSV 保存.

- 銘柄一覧が手に入らない環境でも動くよう、コードを総当たりで照会する (存在しないコードはスキップ)
- 取得済み CSV があるコードはスキップ (--force で取り直し)
- 2024 年以降の英字入りコード (例: 285A) は総当たり対象外 (必要なら universe.py に個別追加)
- 注意: Yahoo は上場廃止銘柄の履歴を持たないため、この全銘柄データにも生存者バイアスがある

使い方:
    python fetch_universe.py                 # 2010 年以降
    python fetch_universe.py --start 2014-01-01 --batch 80
"""
import argparse
import time

import pandas as pd
import yfinance as yf

from jpus.data import DAILY_DIR, PRICE_COLS, daily_csv_path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--start", default="2010-01-01")
    ap.add_argument("--batch", type=int, default=100)
    ap.add_argument("--lo", type=int, default=1300)
    ap.add_argument("--hi", type=int, default=9999)
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()
    DAILY_DIR.mkdir(parents=True, exist_ok=True)
    codes = [f"{c}.T" for c in range(args.lo, args.hi + 1)]
    todo = [t for t in codes if args.force or not daily_csv_path(t).exists()]
    print(f"照会 {len(todo)} コード (取得済み {len(codes) - len(todo)})")
    n_ok = 0
    for i in range(0, len(todo), args.batch):
        chunk = todo[i:i + args.batch]
        for attempt in range(4):
            try:
                df = yf.download(chunk, start=args.start, interval="1d", auto_adjust=False, progress=False,
                                 group_by="ticker", threads=True, actions=False)
                break
            except Exception as e:
                print(f"  リトライ {attempt + 1}: {e}")
                time.sleep(5 * 2 ** attempt)
        else:
            continue
        if df is None or df.empty:
            continue
        for t in chunk:
            if t not in df.columns.get_level_values(0):
                continue
            x = df[t][[c for c in PRICE_COLS if c in df[t].columns]].dropna(how="all")
            x = x.dropna(subset=["Close"])
            if len(x) < 20:
                continue
            x.index = pd.to_datetime(x.index).tz_localize(None).normalize()
            x.index.name = "Date"
            x = x[~x.index.duplicated(keep="last")].sort_index()
            x.to_csv(daily_csv_path(t))
            n_ok += 1
        print(f"  {i + len(chunk)}/{len(todo)} 照会済み, 保存 {n_ok} 銘柄", flush=True)
        time.sleep(1.0)
    print(f"完了: 保存 {n_ok} 銘柄")


if __name__ == "__main__":
    main()
