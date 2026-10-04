"""日米日付整合のリーク検査 (データ不要の合成テスト). 実行: python -m pytest -q tests"""
import numpy as np
import pandas as pd

from jpus.align import assert_no_lookahead, us_signal_for_jp


def _series(dates, vals):
    return pd.Series(vals, index=pd.DatetimeIndex(dates), dtype=float)


def test_same_date_us_close_is_not_used():
    # 米国 1/5 (月) の終値は日本 1/6 (火) の寄付前に確定、日本 1/5 には使えない
    us = _series(["2026-01-02", "2026-01-05", "2026-01-06"], [100, 110, 121])
    jp = pd.DatetimeIndex(["2026-01-05", "2026-01-06", "2026-01-07"])
    s = us_signal_for_jp(us, jp)
    assert s.loc["2026-01-05", "us_date"] == pd.Timestamp("2026-01-02")
    assert s.loc["2026-01-06", "us_date"] == pd.Timestamp("2026-01-05")
    assert np.isclose(s.loc["2026-01-06", "us_logret"], np.log(110 / 100))
    assert np.isclose(s.loc["2026-01-07", "us_logret"], np.log(121 / 110))


def test_jp_holiday_accumulates_us_moves():
    # 日本 1/12 (月) 祝日 → 1/13 (火) は米国 1/9 (金) と 1/12 (月) の 2 日分を累積
    us = _series(["2026-01-08", "2026-01-09", "2026-01-12", "2026-01-13"], [100, 102, 105, 104])
    jp = pd.DatetimeIndex(["2026-01-09", "2026-01-13", "2026-01-14"])
    s = us_signal_for_jp(us, jp)
    assert np.isclose(s.loc["2026-01-13", "us_logret"], np.log(105 / 100))
    assert s.loc["2026-01-13", "n_us_new"] == 2


def test_us_holiday_gives_zero_new_info():
    # 米国 1/19 (月) 休場 → 日本 1/20 (火) は新情報なし
    us = _series(["2026-01-15", "2026-01-16", "2026-01-20"], [100, 101, 99])
    jp = pd.DatetimeIndex(["2026-01-16", "2026-01-19", "2026-01-20", "2026-01-21"])
    s = us_signal_for_jp(us, jp)
    assert s.loc["2026-01-20", "n_us_new"] == 0
    assert s.loc["2026-01-20", "us_logret"] == 0


def test_random_perturbation_no_lookahead():
    rng = np.random.default_rng(1)
    us_dates = pd.bdate_range("2020-01-01", "2021-12-31")
    jp_dates = pd.bdate_range("2020-01-01", "2021-12-31")
    jp_dates = jp_dates[rng.random(len(jp_dates)) > 0.05]
    us = pd.Series(100 * np.exp(np.cumsum(rng.normal(0, 0.01, len(us_dates)))), index=us_dates)
    assert_no_lookahead(us, jp_dates, n_checks=100)
