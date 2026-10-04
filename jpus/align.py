"""リークしない日米の日付整合.

時刻関係 (JST):
  東証        : 09:00 寄付 ～ 15:30 大引け (2024/11/5 以降. それ以前は 15:00)
  米国 現物   : 22:30/23:30 寄付 ～ 翌 05:00(夏時間)/06:00(冬時間) 引け
  → 米国の「日付 d」の終値が確定するのは JST で d+1 日の朝 5～6 時.

ルール: 日本の取引日 D の寄付 (09:00 JST) までに確定している米国終値は
        「米国日付 d < D (暦日で厳密に小さい)」のものだけ.
        d == D の米国終値は D の東証大引けより後 (翌朝) に確定するので使ってはいけない.

us_signal_for_jp():
  日本の取引日 D について、「直前の日本取引日 Dp の大引け以降に新しく確定した米国情報」
  = log(P_us[最後の d < D]) - log(P_us[最後の d < Dp]) を返す.
  - 普通の日          : 米国前日 1 日分のリターン
  - 日本が祝日で休場  : 休場中に米国で動いた分を累積
  - 米国が休場        : 0 (新情報なし) → n_us_new == 0
"""
from __future__ import annotations

import numpy as np
import pandas as pd


def last_us_index_before(us_dates: pd.DatetimeIndex, jp_dates: pd.DatetimeIndex) -> np.ndarray:
    """各 jp_date について「us_date < jp_date」を満たす最後の us_dates の位置 (無ければ -1)."""
    us_dates = pd.DatetimeIndex(us_dates).sort_values()
    return np.searchsorted(us_dates.values, pd.DatetimeIndex(jp_dates).values, side="left") - 1


def us_signal_for_jp(us_close: pd.Series, jp_dates: pd.DatetimeIndex) -> pd.DataFrame:
    """日本の取引日ごとに、寄付前に利用可能な米国情報を返す (リークなし).

    Returns DataFrame(index=jp_dates):
        us_date   : 使った米国終値の日付 (必ず < D)
        us_logret : 直前の日本取引日以降に新しく確定した米国の対数リターン
        n_us_new  : その間に確定した米国セッション数 (0 なら新情報なし)
    """
    us = us_close.dropna().sort_index()
    us = us[~us.index.duplicated(keep="last")]
    jp_dates = pd.DatetimeIndex(jp_dates).sort_values()
    pos = last_us_index_before(us.index, jp_dates)
    valid = pos >= 0
    lvl = np.full(len(jp_dates), np.nan)
    lvl[valid] = np.log(us.values[pos[valid]])
    us_date = pd.Series(pd.NaT, index=jp_dates)
    us_date[valid] = us.index[pos[valid]]
    prev_pos = np.r_[-1, pos[:-1]]
    prev_lvl = np.r_[np.nan, lvl[:-1]]
    out = pd.DataFrame(index=jp_dates)
    out["us_date"] = us_date
    out["us_logret"] = lvl - prev_lvl
    out["n_us_new"] = np.where(valid & (prev_pos >= 0), pos - prev_pos, np.nan)
    out.loc[out.index[0], ["us_logret", "n_us_new"]] = np.nan  # 先頭は直前日が不明
    return out


def us_signal_lagged_for_jp(us_close: pd.Series, jp_dates: pd.DatetimeIndex, lag_sessions: int = 1) -> pd.Series:
    """米国 k セッション前までのリターン (多日ラグ検証用). lag_sessions=1 は us_signal_for_jp と同じ情報の 1 日分."""
    us = np.log(us_close.dropna().sort_index())
    r = us.diff()
    pos = last_us_index_before(us.index, jp_dates)
    p = pos - (lag_sessions - 1)
    vals = np.full(len(jp_dates), np.nan)
    ok = p >= 1
    vals[ok] = r.values[p[ok]]
    return pd.Series(vals, index=pd.DatetimeIndex(jp_dates))


def jp_returns(df: pd.DataFrame) -> pd.DataFrame:
    """東証日足から各種リターン (単純リターン).

    gap      : 前日大引け → 当日寄付   (寄付前の情報で取引は不可能. 予測対象としてのみ使う)
    intraday : 当日寄付 → 当日大引け  (寄付前の情報で「寄成買い→引成売り」すれば取れる)
    c2c      : 前日大引け → 当日大引け
    next_o2o : 当日寄付 → 翌営業日寄付
    """
    o, c = df["Open"], df["Close"]
    out = pd.DataFrame(index=df.index)
    out["gap"] = o / c.shift(1) - 1
    out["intraday"] = c / o - 1
    out["c2c"] = c / c.shift(1) - 1
    out["next_o2o"] = o.shift(-1) / o - 1
    out["next_date"] = pd.Series(df.index, index=df.index).shift(-1)
    return out


def assert_no_lookahead(us_close: pd.Series, jp_dates: pd.DatetimeIndex, n_checks: int = 50, seed: int = 0) -> None:
    """リーク検査: 日付 D 以降の米国データをランダムに書き換えても D のシグナルが変わらないことを確認."""
    rng = np.random.default_rng(seed)
    base = us_signal_for_jp(us_close, jp_dates)
    jp_dates = pd.DatetimeIndex(jp_dates)
    for D in rng.choice(jp_dates[5:], size=min(n_checks, len(jp_dates) - 5), replace=False):
        D = pd.Timestamp(D)
        pert = us_close.copy()
        m = pert.index >= D
        pert[m] = pert[m] * rng.uniform(0.5, 1.5, m.sum())
        s = us_signal_for_jp(pert, jp_dates)
        a, b = base.loc[D, "us_logret"], s.loc[D, "us_logret"]
        if not (np.isnan(a) and np.isnan(b)) and not np.isclose(a, b):
            raise AssertionError(f"lookahead detected at {D.date()}: {a} vs {b}")
