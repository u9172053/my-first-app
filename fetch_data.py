"""検証に使うチャートデータを Yahoo Finance から取得して data/ に CSV 保存する.

使い方:
    python fetch_data.py            # 未取得分だけ取得
    python fetch_data.py --force    # 全部取り直し (最新日まで更新)
"""
import argparse

from jpus.data import fetch_daily, fetch_intraday
from jpus.universe import ALL

INTRADAY_1H = ["JPY=X", "EURJPY=X", "1321.T", "1306.T", "8035.T", "6857.T", "^N225", "SPY", "ES=F", "NIY=F"]
INTRADAY_5M = ["JPY=X"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true", help="既存 CSV を無視して取り直す")
    ap.add_argument("--start", default="2008-01-01")
    args = ap.parse_args()
    tickers = sorted(set(ALL + ["^N225", "^TOPX"]))
    print(f"日足 {len(tickers)} 銘柄を取得 ...")
    got = fetch_daily(tickers, start=args.start, force=args.force)
    missing = sorted(set(tickers) - set(got))
    print(f"取得 {len(got)} / 未取得 {len(missing)}: {missing}")
    print("時間足 (1h, 直近730日) を取得 ...")
    fetch_intraday(INTRADAY_1H, "1h", force=args.force)
    print("5分足 (直近60日) を取得 ...")
    fetch_intraday(INTRADAY_5M, "5m", force=args.force)
    print("完了")


if __name__ == "__main__":
    main()
