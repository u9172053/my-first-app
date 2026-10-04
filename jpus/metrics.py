"""成績指標と統計検定."""
from __future__ import annotations

import math

import numpy as np
import pandas as pd
from scipy import stats

JP_DAYS = 245  # 東証の年間営業日数の目安


def max_drawdown(cum: pd.Series) -> float:
    """累積損益 (単利の累積和) の最大ドローダウン."""
    peak = cum.cummax()
    return float((cum - peak).min()) if len(cum) else np.nan


def newey_west_tstat(x: pd.Series | np.ndarray, lags: int | None = None) -> float:
    """平均 = 0 の Newey-West (HAC) t 値."""
    x = np.asarray(pd.Series(x).dropna(), dtype=float)
    n = len(x)
    if n < 10:
        return np.nan
    if lags is None:
        lags = int(np.floor(4 * (n / 100) ** (2 / 9)))
    mu = x.mean()
    e = x - mu
    s = e @ e / n
    for L in range(1, lags + 1):
        w = 1 - L / (lags + 1)
        s += 2 * w * (e[L:] @ e[:-L]) / n
    return float(mu / math.sqrt(s / n)) if s > 0 else np.nan


def perf_summary(daily_ret: pd.Series, periods: int = JP_DAYS, trades: pd.Series | None = None) -> dict:
    """日次リターン系列 (ポジション無しの日は 0) の成績. 損益は単利 (固定金額運用) で評価."""
    r = pd.Series(daily_ret).fillna(0.0)
    n = len(r)
    if n == 0:
        return {}
    cum = r.cumsum()
    vol = r.std(ddof=1)
    sharpe = r.mean() / vol * math.sqrt(periods) if vol > 0 else np.nan
    years = n / periods
    tr = trades if trades is not None else r[r != 0]
    out = {
        "期間": f"{r.index[0].date()}~{r.index[-1].date()}" if isinstance(r.index, pd.DatetimeIndex) else "",
        "総損益%": 100 * cum.iloc[-1],
        "年率%": 100 * r.mean() * periods,
        "年率Vol%": 100 * vol * math.sqrt(periods),
        "Sharpe": sharpe,
        "最大DD%": 100 * max_drawdown(cum),
        "取引数": int((tr != 0).sum()),
        "勝率%": 100 * float((tr > 0).mean()) if len(tr) else np.nan,
        "平均bp/取引": 1e4 * float(tr.mean()) if len(tr) else np.nan,
        "t値(NW)": newey_west_tstat(r),
        "年数": years,
    }
    return out


def summary_table(curves: dict[str, pd.Series], split: str | pd.Timestamp | None = None,
                  periods: int = JP_DAYS) -> pd.DataFrame:
    """複数戦略の成績表. split を与えるとイン/アウトオブサンプル別にも出す."""
    rows = []
    for name, r in curves.items():
        r = pd.Series(r).dropna()
        rows.append({"戦略": name, "区間": "全期間", **perf_summary(r, periods)})
        if split is not None:
            sp = pd.Timestamp(split)
            rows.append({"戦略": name, "区間": "IS", **perf_summary(r[r.index < sp], periods)})
            rows.append({"戦略": name, "区間": "OOS", **perf_summary(r[r.index >= sp], periods)})
    df = pd.DataFrame(rows)
    return df


def deflated_sharpe_ratio(sr_hat: float, n_obs: int, n_trials: int, sr_std: float,
                          skew: float = 0.0, kurt: float = 3.0) -> float:
    """Bailey & López de Prado の Deflated Sharpe Ratio (非年率 SR を入力).

    n_trials 個の戦略を試して最良を選んだときに、真の SR > 0 である確率.
    sr_std: 試した戦略群の (非年率) SR の標準偏差.
    """
    if n_trials <= 1:
        sr0 = 0.0
    else:
        g = 0.5772156649
        z1 = stats.norm.ppf(1 - 1 / n_trials)
        z2 = stats.norm.ppf(1 - 1 / (n_trials * math.e))
        sr0 = sr_std * ((1 - g) * z1 + g * z2)
    den = math.sqrt(max(1e-12, 1 - skew * sr_hat + (kurt - 1) / 4 * sr_hat ** 2))
    return float(stats.norm.cdf((sr_hat - sr0) * math.sqrt(n_obs - 1) / den))


def block_bootstrap_pvalue(x: pd.Series, n_boot: int = 2000, block: int = 10, seed: int = 0) -> float:
    """平均 > 0 の片側 p 値 (中心化した系列の移動ブロック・ブートストラップ)."""
    x = np.asarray(pd.Series(x).dropna(), dtype=float)
    n = len(x)
    if n < 2 * block:
        return np.nan
    rng = np.random.default_rng(seed)
    xc = x - x.mean()
    nb = int(np.ceil(n / block))
    starts = rng.integers(0, n - block + 1, size=(n_boot, nb))
    idx = (starts[:, :, None] + np.arange(block)[None, None, :]).reshape(n_boot, -1)[:, :n]
    means = xc[idx].mean(axis=1)
    return float((means >= x.mean()).mean())


def sign_permutation_pvalue(signal: pd.Series, ret: pd.Series, n_perm: int = 2000, seed: int = 0) -> float:
    """シグナルの向き (sign) を時系列ブロックでシャッフルしたときに、実際の
    mean(sign(signal) * ret) 以上が出る確率 (片側)."""
    df = pd.concat([signal, ret], axis=1).dropna()
    s = np.sign(df.iloc[:, 0].values)
    r = df.iloc[:, 1].values
    obs = np.mean(s * r)
    rng = np.random.default_rng(seed)
    cnt = 0
    for _ in range(n_perm):
        k = rng.integers(1, len(s) - 1)
        cnt += np.mean(np.roll(s, k) * r) >= obs  # 円環シフトで自己相関を保つ
    return float((cnt + 1) / (n_perm + 1))
