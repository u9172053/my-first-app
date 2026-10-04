"""yfinance (Yahoo Finance) からのデータ取得と CSV キャッシュ.

チャートデータは data/ 以下に CSV で保存し、2 回目以降は CSV から読む。
  - 日足   : data/daily/<ticker>.csv     (auto_adjust=False で Open/High/Low/Close/Adj Close/Volume を保存)
  - 分/時足: data/intraday/<interval>/<ticker>.csv (UTC タイムスタンプで保存)

価格の意味:
  - 東証銘柄 (xxxx.T) : 東京証券取引所の約定値 (Open=寄付, Close=大引け)
  - 米国株/ETF        : NYSE/Nasdaq 統合気配の日足 (Close=16:00 ET 引け)
  - 為替 (JPY=X)      : Yahoo の USD/JPY 指標レート (日足はロンドン 0 時区切り ≒ JST 8-9 時区切り)
  - 先物 (CL=F 等)    : CME 等の期近つなぎ足

load_daily(adjust=True) は配当・分割調整済み OHLC を返す
  (調整係数 = Adj Close / Close を Open/High/Low/Close すべてに掛ける)。
同日内の Open→Close リターンは調整係数が同じなので未調整と一致し、
Close→翌Open (オーバーナイト) は権利落ちの影響が正しく配当込みで扱われる。
"""
from __future__ import annotations

import os
import time
from pathlib import Path
from typing import Iterable

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = Path(os.environ.get("JPUS_DATA_DIR", ROOT / "data"))
DAILY_DIR = DATA_DIR / "daily"
INTRADAY_DIR = DATA_DIR / "intraday"

DEFAULT_START = "2008-01-01"
PRICE_COLS = ["Open", "High", "Low", "Close", "Adj Close", "Volume"]


def _safe_name(ticker: str) -> str:
    return ticker.replace("^", "_IDX_").replace("=", "_EQ_").replace("/", "_")


def daily_csv_path(ticker: str) -> Path:
    return DAILY_DIR / f"{_safe_name(ticker)}.csv"


def intraday_csv_path(ticker: str, interval: str) -> Path:
    return INTRADAY_DIR / interval / f"{_safe_name(ticker)}.csv"


def _flatten(df: pd.DataFrame, ticker: str) -> pd.DataFrame:
    if isinstance(df.columns, pd.MultiIndex):
        lv = [i for i in range(df.columns.nlevels) if ticker in df.columns.get_level_values(i)]
        if lv:
            df = df.xs(ticker, axis=1, level=lv[0])
        else:
            df.columns = df.columns.get_level_values(0)
    return df


def fetch_daily(tickers: Iterable[str] | str, start: str = DEFAULT_START, end: str | None = None,
                force: bool = False, sleep: float = 0.5) -> dict[str, Path]:
    """日足を取得して CSV 保存する. 既に CSV があれば (force=False なら) スキップ."""
    import yfinance as yf

    if isinstance(tickers, str):
        tickers = [tickers]
    DAILY_DIR.mkdir(parents=True, exist_ok=True)
    out: dict[str, Path] = {}
    for t in tickers:
        path = daily_csv_path(t)
        if path.exists() and not force:
            out[t] = path
            continue
        for attempt in range(4):
            try:
                df = yf.download(t, start=start, end=end, interval="1d", auto_adjust=False,
                                 progress=False, threads=False, actions=False)
                break
            except Exception as e:  # ネットワーク一時エラー
                if attempt == 3:
                    print(f"[fetch_daily] {t}: 取得失敗 {e}")
                    df = None
                time.sleep(2 ** attempt)
        if df is None or len(df) == 0:
            print(f"[fetch_daily] {t}: データなし")
            continue
        df = _flatten(df, t)
        df = df[[c for c in PRICE_COLS if c in df.columns]].copy()
        df.index = pd.to_datetime(df.index).tz_localize(None).normalize()
        df.index.name = "Date"
        df = df[~df.index.duplicated(keep="last")].sort_index()
        df.to_csv(path)
        out[t] = path
        time.sleep(sleep)
    return out


def fetch_intraday(tickers: Iterable[str] | str, interval: str = "1h", period: str | None = None,
                   force: bool = False, sleep: float = 0.5) -> dict[str, Path]:
    """分足/時間足を取得して CSV 保存 (UTC). Yahoo の上限: 1h=730日, 5m/15m/30m=60日, 1m=7日."""
    import yfinance as yf

    if isinstance(tickers, str):
        tickers = [tickers]
    if period is None:
        period = {"1h": "730d", "60m": "730d", "90m": "60d", "30m": "60d", "15m": "60d",
                  "5m": "60d", "2m": "60d", "1m": "7d"}.get(interval, "60d")
    d = INTRADAY_DIR / interval
    d.mkdir(parents=True, exist_ok=True)
    out: dict[str, Path] = {}
    for t in tickers:
        path = intraday_csv_path(t, interval)
        if path.exists() and not force:
            out[t] = path
            continue
        df = yf.download(t, period=period, interval=interval, auto_adjust=False,
                         progress=False, threads=False, prepost=False)
        if df is None or len(df) == 0:
            print(f"[fetch_intraday] {t} {interval}: データなし")
            continue
        df = _flatten(df, t)
        df = df[[c for c in PRICE_COLS if c in df.columns]].copy()
        idx = pd.to_datetime(df.index)
        if idx.tz is None:
            idx = idx.tz_localize("UTC")
        df.index = idx.tz_convert("UTC")
        df.index.name = "Datetime"
        # 既存 CSV があれば結合して履歴を伸ばす (Yahoo は直近しか返さないため)
        if path.exists():
            old = pd.read_csv(path, index_col=0)
            old.index = pd.to_datetime(old.index, utc=True)
            df = pd.concat([old, df])
        df = df[~df.index.duplicated(keep="last")].sort_index()
        df.to_csv(path)
        out[t] = path
        time.sleep(sleep)
    return out


def load_daily(ticker: str, adjust: bool = True, fetch_if_missing: bool = True,
               min_volume: float | None = 0) -> pd.DataFrame:
    """日足を CSV から読む (無ければ取得).

    adjust=True: 配当・分割調整済みの Open/High/Low/Close を返す.
    min_volume: 東証銘柄で出来高 <= min_volume の日 (Yahoo の欠損/祝日ダミー行) を除外.
                指数・為替は出来高 0 が普通なので自動的に除外対象外.
    """
    path = daily_csv_path(ticker)
    if not path.exists():
        if not fetch_if_missing:
            raise FileNotFoundError(path)
        fetch_daily(ticker)
    df = pd.read_csv(path, index_col=0, parse_dates=True)
    df = df.dropna(subset=["Open", "Close"])
    df = df[(df["Open"] > 0) & (df["Close"] > 0)]
    is_tse = ticker.endswith(".T")
    if is_tse and min_volume is not None and "Volume" in df.columns:
        df = df[df["Volume"] > min_volume]
    if adjust and "Adj Close" in df.columns:
        f = (df["Adj Close"] / df["Close"]).astype(float)
        for c in ["Open", "High", "Low", "Close"]:
            df[c] = df[c] * f
    return df[["Open", "High", "Low", "Close", "Volume"]].astype(float)


def load_intraday(ticker: str, interval: str = "1h", tz: str = "Asia/Tokyo",
                  fetch_if_missing: bool = True) -> pd.DataFrame:
    path = intraday_csv_path(ticker, interval)
    if not path.exists():
        if not fetch_if_missing:
            raise FileNotFoundError(path)
        fetch_intraday(ticker, interval)
    df = pd.read_csv(path, index_col=0)
    df.index = pd.to_datetime(df.index, utc=True).tz_convert(tz)
    return df[["Open", "High", "Low", "Close", "Volume"]].astype(float)


def load_close_panel(tickers: Iterable[str], adjust: bool = True, field: str = "Close") -> pd.DataFrame:
    """複数銘柄の終値 (等) を横並びにした DataFrame. 取引日が異なる市場同士は NaN を含む."""
    cols = {}
    for t in tickers:
        try:
            cols[t] = load_daily(t, adjust=adjust)[field]
        except Exception as e:
            print(f"[load_close_panel] {t}: {e}")
    return pd.DataFrame(cols).sort_index()
