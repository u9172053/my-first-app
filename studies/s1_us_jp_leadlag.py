#!/usr/bin/env python3
"""S1: 「米国関連株 (前日) → 日本関連株 (当日)」リードラグ検証 (リーク対策済み)

ユーザーの問い: 「関連する米国株が前日に上がったら、日本株を買えば儲かるか?」
→ jpus.universe.LEAD_LAG_PAIRS の全 67 ペアについて、取引コスト込み・先読みなしで検証する。

実行: cd /home/user/my-first-app && python3 studies/s1_us_jp_leadlag.py   (所要 1 分程度)

■ 市場・証券会社・コスト (jpus.costs.TSECost)
  - 売買対象 : 東京証券取引所 (TSE) の現物株・ETF. 証券会社は SBI証券 (オンライン) を想定.
  - 手数料   : 0 円 (「ゼロ革命」. 現物・信用とも).
  - 執行     : 寄成 (09:00 寄付の板寄せ) / 引成 (大引けの板寄せ). スプレッドは払わない代わりに
               片道 5bp の執行コスト (板寄せ価格への自己インパクト・気配のズレ) を計上.
               感度分析で片道 0/2/5/10bp も表示. 損益分岐コスト (=平均粗利 bp/往復) も表示.
  - 買い     : 現物 (金利なし).  売り (空売り): 制度信用. 貸株料 年 1.15% を暦日数 (最低 1 日) で日割り.
               逆日歩・税金 (20.315%)・100 株単位の端数・貸借銘柄でない銘柄の空売り不可は考慮しない.

■ シグナルのタイミング (時刻は JST)
  - 米国の日付 d の終値は JST の d+1 日 05:00 (夏時間) / 06:00 (冬時間) に確定する.
    Yahoo の先物日足 (CL=F, HG=F, GC=F) も取引日付で、d の終値は遅くとも d 17:00 ET (= d+1 07:00 JST) に確定.
  - 日本の取引日 D の寄付 (09:00) 前に使えるのは「米国日付 d < D (暦日で厳密に小さい)」の終値だけ.
    x(D) = jpus.align.us_signal_for_jp による「直前の日本営業日以降に新しく確定した米国の対数リターン」
          (日本が祝日の間に動いた分は累積. 米国休場で新情報が無い日 (n_us_new == 0) は取引しない).
  - z(D) = x(D) / (σ60 × √n_us_new).  σ60 = シグナルのリターンより前の米国 60 セッションの日次対数リターン
          の標準偏差 (シグナル自身のリターンも含めない = 米国系列で shift(1)). 全期間での正規化は一切しない.
  - 日本株の当日の寄付価格・値動きはシグナルに使わない (寄付価格は約定価格としてのみ使う).
    → 「寄付価格を使用」ラベルの戦略は本スタディには無い.

■ 売買 (エントリー/エグジット)
  - 寄→引  : D の寄付 Open(D) で寄成 → D の大引け Close(D) で引成 (日計り. 毎回往復コスト).
  - 寄→翌寄: Open(D) で寄成 → 翌営業日の Open(D+1) で寄成決済. 翌日も同じ向きなら持ち越す
             (売買しない) のでポジション変化分だけコスト. 空売りは保有暦日数分の貸株料.
  - 戦略族 (θ ∈ {0, 0.5, 1.0, 1.5}):
      順張り買い : z > θ なら買い          順張り売買 : |z| > θ なら sign(z) 方向
      逆張り買い : z < -θ なら買い         逆張り売買 : |z| > θ なら -sign(z) 方向
    4 族 × 4 θ × 2 保有期間 = 32 通り (全て表示).
  - ポートフォリオ: その日シグナルが出た (ペア, 日) に資金を等分 (稼働ペアの単純平均).
    同一銘柄を複数ペアが同時に売買しても相殺しない (コスト面で保守的).

■ 期間・パラメータ選択
  - データ品質: Yahoo の東証日足は 2008-01〜2009-05 に「始値=前日終値, 高値=始値, 安値=終値」の合成足が
    25〜60% 含まれ、寄→引リターンが実質「前日終値→終値」になる (米国の動きを取り込む隠れたリーク).
    そのため検証は 2010-01-01 から (この期間の歪みは「リーク版(iii)」として表示).
  - IS (選択用) : 2010-01-01〜2018-12-31,  OOS (凍結して評価): 2019-01-01〜データ最終日.
  - 全ペア共通の 1 ルールを IS の純 Sharpe (片道 5bp) 最大で選んで凍結 (主結果).
    参考: ペア別に IS 最良ルールを選び IS の NW t ≥ 2 のペアだけ採用 (過剰適合しやすい手順).
  - 多重検定: Deflated Sharpe Ratio (試行数 32) と Bonferroni 補正 p 値を表示.

■ ベンチマーク・検定
  - 無条件: 全ペアの日本株を毎日 寄→引 (または 寄→翌寄) で買う (ドリフト・生存者バイアスの基準).
  - 市場ヘッジ版: 1321.T (日経225ETF) を過去 250 日 (D の前日まで) のベータ分だけ逆方向に同じ時間売買
    (寄→引 は寄→引リターン同士のベータ, 寄→翌寄 は前日までの終値→終値リターンのベータ). ヘッジ側にもコスト.
  - ランダム日プラセボ: 凍結ルールのシグナル行列を (全ペア同時に) ランダムに時間方向へ循環シフト.
  - ペア別診断: corr(z, 寄付ギャップ), corr(z, 寄→引) と Newey-West t, IS/OOS の符号の安定性.

■ リーク版 (実行不可能. 「リーク版」と明記. 比較用であり取引可能な結果ではない)
  (i)  前日の大引けで建てる: 米国 D-1 日の終値 (日本の D-1 大引け後に確定) を見て D-1 の大引けで建て D の引けで決済.
  (ii) 同日付の米国リターン: 米国 D 日 (日本の D 大引け後に確定) の動きで D の寄→引を売買.
  (iii) 2008-2009 の合成足 (始値=前日終値) をそのまま使った場合.
  (iv) 後知恵選択: 全期間 (OOS 含む) の成績でペア別ルールを選んだ場合.

結果ファイル・画像は保存しない (グラフは plt.show で表示のみ). 生存者バイアス (現在上場の大型株のみ.
東芝 6502.T 等は対象外) があるため、必ず無条件ベンチマーク・ヘッジ版との差で判断すること.
"""
from __future__ import annotations

import math
import sys
import time
import warnings
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:  # `python3 studies/xxx.py` で実行しても jpus を import できるように
    sys.path.insert(0, str(ROOT))

import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402
from scipy import stats  # noqa: E402

import japanize_matplotlib  # noqa: E402,F401  日本語フォント (jpus.plot でも読み込む)
import matplotlib.pyplot as plt  # noqa: E402

from jpus.align import assert_no_lookahead, jp_returns, last_us_index_before, us_signal_for_jp  # noqa: E402
from jpus.costs import TSECost, calendar_hold_days  # noqa: E402
from jpus.data import load_daily  # noqa: E402
from jpus.metrics import JP_DAYS, deflated_sharpe_ratio, max_drawdown, newey_west_tstat  # noqa: E402
from jpus.plot import plot_bar, plot_pnl  # noqa: E402
from jpus.universe import JP_NAMES, LEAD_LAG_PAIRS  # noqa: E402

warnings.filterwarnings("ignore", category=RuntimeWarning)
warnings.filterwarnings("ignore", message=".*Sorting by default.*")
pd.set_option("display.width", 250)
pd.set_option("display.max_columns", 40)
pd.set_option("display.max_rows", 400)
pd.set_option("display.unicode.east_asian_width", True)

# ============================================================ 設定
START = pd.Timestamp("2010-01-01")        # 合成足 (2008-2009/5) を避ける
OOS_START = pd.Timestamp("2019-01-01")    # IS = 2010-2018, OOS = 2019-
BAD_START, BAD_END = "2008-02-01", "2009-05-31"   # 合成足が多い期間 (リーク版 iii の表示用)
THETAS = [0.0, 0.5, 1.0, 1.5]
FAMILIES = ["順張り買い", "順張り売買", "逆張り買い", "逆張り売買"]
MODES = {"寄→引": "intra", "寄→翌寄": "on"}
VOL_WIN = 60          # z 用の米国ボラ (過去 60 セッション)
BETA_WIN, BETA_MINP = 250, 120
HEDGE_TICKER = "1321.T"
COST = TSECost()      # SBI証券: 手数料 0, 片道 5bp, 貸株料 1.15%
SLIPS = [0.0, 2.0, 5.0, 10.0]
N_PLACEBO = 300
T_ADOPT = 2.0         # ペア別選択で採用する IS の NW t 値
SEED = 42


def hr(title: str) -> None:
    print("\n" + "=" * 100)
    print(title)
    print("=" * 100)


def fmt(df: pd.DataFrame, nd: int = 2) -> str:
    return df.to_string(float_format=lambda v: f"{v:,.{nd}f}")


def pair_label(us_t: str, jp_t: str) -> str:
    return f"{us_t}→{jp_t} {JP_NAMES.get(jp_t, '')}"


# ============================================================ データ
_CACHE: dict[str, pd.DataFrame] = {}


def get_daily(t: str) -> pd.DataFrame:
    if t not in _CACHE:
        _CACHE[t] = load_daily(t)
    return _CACHE[t]


def us_close_clean(us_t: str) -> pd.Series:
    us = get_daily(us_t)["Close"].dropna().sort_index()
    return us[~us.index.duplicated(keep="last")]


def compute_z(us: pd.Series, jp_dates: pd.DatetimeIndex) -> tuple[pd.DataFrame, np.ndarray]:
    """us_signal_for_jp + 過去 60 セッションのボラで z 化 (リークなし). 戻り値: (sig, z)."""
    sig = us_signal_for_jp(us, jp_dates)
    lr = np.log(us).diff()
    sd = lr.rolling(VOL_WIN, min_periods=VOL_WIN).std().shift(1)  # シグナルのリターン自身を含まない
    pos = last_us_index_before(us.index, jp_dates)                 # 米国日付 < D の最後
    sd_pos = np.where(pos >= 0, sd.to_numpy()[np.maximum(pos, 0)], np.nan)
    n = sig["n_us_new"].to_numpy(float)
    x = sig["us_logret"].to_numpy(float)
    z = np.where(n >= 1, x / (sd_pos * np.sqrt(np.where(n >= 1, n, 1.0))), np.nan)
    return sig, z


def build_pair(us_t: str, jp_t: str, hedge_ret: pd.DataFrame) -> pd.DataFrame:
    """1 ペア分の日次テーブル (日本株の取引日 index, 全履歴)."""
    jp = get_daily(jp_t)
    us = us_close_clean(us_t)
    jr = jp_returns(jp)
    sig, z = compute_z(us, jp.index)
    lr = np.log(us).diff()
    sd = lr.rolling(VOL_WIN, min_periods=VOL_WIN).std().shift(1)
    d = pd.DataFrame(index=jp.index)
    d["z"] = z
    d["x"] = sig["us_logret"]
    d["n_new"] = sig["n_us_new"]
    # リーク版(ii): 「米国日付 == D」のリターン (D の東証大引け後に確定するので実際には使えない)
    d["z_same"] = (lr / sd).reindex(jp.index)
    d["gap"], d["intra"], d["c2c"], d["o2o"] = jr["gap"], jr["intraday"], jr["c2c"], jr["next_o2o"]
    dates = pd.Series(jp.index, index=jp.index)
    nxt = jr["next_date"].fillna(dates + pd.Timedelta(days=1))
    prv = dates.shift(1).fillna(dates - pd.Timedelta(days=1))
    d["hd_o2o"] = calendar_hold_days(dates, nxt)      # 寄→翌寄 の貸株料日数
    d["hd_c2c"] = calendar_hold_days(prv, dates)      # 前日引→当日引 (リーク版 i) の日数
    # 市場ヘッジ (1321.T) : ベータは D の前日までのデータのみ (shift(1))
    h = hedge_ret.reindex(jp.index)
    d["h_intra"], d["h_o2o"], d["hd_h_o2o"] = h["intraday"], h["next_o2o"], h["hd_o2o"]
    if jp_t == HEDGE_TICKER:
        d["b_intra"] = 1.0
        d["b_c2c"] = 1.0
    else:
        for col, hcol, out in [("intra", "intraday", "b_intra"), ("c2c", "c2c", "b_c2c")]:
            cov = d[col].rolling(BETA_WIN, min_periods=BETA_MINP).cov(h[hcol])
            var = h[hcol].rolling(BETA_WIN, min_periods=BETA_MINP).var()
            d[out] = (cov / var).shift(1)
    return d


# ============================================================ 戦略計算
def positions(Z: np.ndarray, fam: str, th: float) -> np.ndarray:
    with np.errstate(invalid="ignore"):
        if fam == "順張り買い":
            S = (Z > th).astype(float)
        elif fam == "順張り売買":
            S = np.sign(Z) * (np.abs(Z) > th)
        elif fam == "逆張り買い":
            S = (Z < -th).astype(float)
        elif fam == "逆張り売買":
            S = -np.sign(Z) * (np.abs(Z) > th)
        else:
            raise ValueError(fam)
    S = np.where(np.isnan(Z), 0.0, S)
    return S


def leg_cost(W: np.ndarray, mode: str, HD: np.ndarray | None, cost: TSECost) -> tuple[np.ndarray, np.ndarray]:
    """1 単位ポジション W (T×N) のコスト (リターン比率) と売買回転 (片道の合計)."""
    if mode == "intra":   # 寄成→引成: 毎日往復. TSECost.round_trip をそのまま使う (空売りは貸株料 1 日)
        c = cost.round_trip(np.sign(W), np.ones_like(W)) * np.abs(W)
        return c, 2 * np.abs(W)
    # 持ち越し: ポジションの変化分だけ片道コスト. 空売りは保有暦日数分の貸株料.
    slip = cost.commission_rate + cost.slippage_bps / 1e4
    prev = np.vstack([np.zeros((1, W.shape[1])), W[:-1]])
    turn = np.abs(W - prev)
    hd = np.ones_like(W) if HD is None else np.where(np.isnan(HD), 1.0, np.maximum(HD, 1.0))
    long_rate = cost.margin_buy_rate if cost.use_margin_for_long else 0.0
    fin = (cost.stock_loan_rate * np.maximum(-W, 0) + long_rate * np.maximum(W, 0)) * hd / 365
    return slip * turn + fin, turn


def run(S: np.ndarray, R: np.ndarray, mode: str, HD: np.ndarray | None = None, cost: TSECost = COST,
        hedge: tuple | None = None) -> dict:
    """ペアごと 1 単位で売買した損益と、稼働ペア平均のポートフォリオ日次損益."""
    valid = ~np.isnan(R)
    if hedge is not None:
        Rh, B, HDh = hedge
        valid &= ~np.isnan(Rh) & ~np.isnan(B)
    S = np.where(valid, S, 0.0)
    R0 = np.where(valid, R, 0.0)
    gross = S * R0
    c, turn = leg_cost(S, mode, HD, cost)
    if hedge is not None:
        H = -S * np.where(valid, B, 0.0)               # 1321.T を β 分だけ逆方向
        gross = gross + H * np.where(valid, Rh, 0.0)
        ch, _ = leg_cost(H, mode, HDh, cost)
        c = c + ch
    active = (S != 0) | (c != 0)
    n_act = active.sum(axis=1)
    net = (gross - c).sum(axis=1) / np.maximum(n_act, 1)
    gp = gross.sum(axis=1) / np.maximum(n_act, 1)
    return {"S": S, "R": np.where(valid, R, np.nan), "gross": gross, "cost": c, "turn": turn,
            "net": pd.Series(net, index=CAL), "gross_p": pd.Series(gp, index=CAL), "n_act": n_act}


def block_stats(res: dict, mask: np.ndarray) -> dict:
    """期間 mask の成績. bp は (ペア, 日) 1 取引あたり. 年率・Sharpe はポートフォリオ日次損益から."""
    S, g, c, tv, R = res["S"][mask], res["gross"][mask], res["cost"][mask], res["turn"][mask], res["R"][mask]
    net = res["net"][mask]
    n_tr = int((S != 0).sum())
    gs, cs = float(g.sum()), float(c.sum())
    rt = float(tv.sum()) / 2
    mu = np.nanmean(R, axis=0)
    drift_adj = float(np.nansum(np.where(S != 0, S * (R - mu), 0.0)))
    sd = net.std(ddof=1)
    return {
        "取引数": n_tr,
        "粗bp/取引": 1e4 * gs / n_tr if n_tr else np.nan,
        "純bp/取引": 1e4 * (gs - cs) / n_tr if n_tr else np.nan,
        "ドリフト控除bp": 1e4 * drift_adj / n_tr if n_tr else np.nan,
        "分岐bp(往復)": 1e4 * gs / rt if rt > 0 else np.nan,
        "年率%": 100 * net.mean() * JP_DAYS,
        "Sharpe": net.mean() / sd * math.sqrt(JP_DAYS) if sd > 0 else np.nan,
        "t(NW)": newey_west_tstat(net),
        "最大DD%": 100 * max_drawdown(net.cumsum()),
        "勝率%": 100 * float((net[net != 0] > 0).mean()) if (net != 0).any() else np.nan,
    }


def pair_daily_net(res: dict, j: int, mask: np.ndarray) -> np.ndarray:
    """ペア j の 1 単位日次純損益 (そのペアのデータがある日のみ)."""
    m = mask & ~np.isnan(res["R"][:, j])
    return (res["gross"][:, j] - res["cost"][:, j])[m]


def sharpe_of(x: np.ndarray) -> float:
    x = np.asarray(x, float)
    if len(x) < 30:
        return np.nan
    s = x.std(ddof=1)
    return float(x.mean() / s * math.sqrt(JP_DAYS)) if s > 0 else np.nan


def nw_corr(x: pd.Series, y: pd.Series) -> tuple[float, float, int]:
    """相関と、傾き = 0 の Newey-West t 値 ((x-x̄)(y-ȳ) の平均の HAC t)."""
    d = pd.concat([x, y], axis=1).dropna()
    if len(d) < 60:
        return np.nan, np.nan, len(d)
    a, b = d.iloc[:, 0], d.iloc[:, 1]
    return float(a.corr(b)), newey_west_tstat((a - a.mean()) * (b - b.mean())), len(d)


# ============================================================ メイン
T0 = time.time()
hr("S1: 米国関連株(前日) → 日本関連株(当日) リードラグ検証  [東証 × SBI証券, 手数料0円, 片道5bp, 貸株料1.15%]")
print(f"IS: {START.date()}〜2018-12-31 / OOS: {OOS_START.date()}〜  (2008-2009 は合成足のため除外)")

hedge_df = get_daily(HEDGE_TICKER)
hedge_ret = jp_returns(hedge_df)
hedge_ret["hd_o2o"] = calendar_hold_days(pd.Series(hedge_df.index, index=hedge_df.index),
                                         hedge_ret["next_date"].fillna(pd.Series(hedge_df.index, index=hedge_df.index)
                                                                       + pd.Timedelta(days=1)))

PAIRS, SKIPPED, FULL = [], [], {}
for us_t, jp_t in LEAD_LAG_PAIRS:
    try:
        d = build_pair(us_t, jp_t, hedge_ret)
    except Exception as e:  # データ欠損
        SKIPPED.append((us_t, jp_t, str(e)))
        continue
    if d.loc[START:, "z"].notna().sum() < 100:
        SKIPPED.append((us_t, jp_t, "2010年以降のデータ不足"))
        continue
    pid = f"{us_t}→{jp_t}"
    PAIRS.append((pid, us_t, jp_t))
    FULL[pid] = d
print(f"ペア数: 定義 {len(LEAD_LAG_PAIRS)} / 使用 {len(PAIRS)} / スキップ {len(SKIPPED)} {[s[:2] for s in SKIPPED]}")

# 共通カレンダー (2010 以降の日本の取引日)
CAL = pd.DatetimeIndex(sorted(set().union(*[FULL[p].index[FULL[p].index >= START] for p, _, _ in PAIRS])))
IS_M = np.asarray(CAL < OOS_START)
OOS_M = ~IS_M
ALL_M = np.ones(len(CAL), bool)
FIELDS = ["z", "z_same", "gap", "intra", "c2c", "o2o", "hd_o2o", "hd_c2c", "h_intra", "h_o2o", "hd_h_o2o",
          "b_intra", "b_c2c"]
A = {f: pd.DataFrame({p: FULL[p][f].reindex(CAL) for p, _, _ in PAIRS}, index=CAL).to_numpy(float) for f in FIELDS}
NP = len(PAIRS)
PIDS = [p for p, _, _ in PAIRS]

MODE_ARGS = {
    "寄→引": dict(R=A["intra"], mode="intra", HD=None, hedge=(A["h_intra"], A["b_intra"], None)),
    "寄→翌寄": dict(R=A["o2o"], mode="on", HD=A["hd_o2o"], hedge=(A["h_o2o"], A["b_c2c"], A["hd_h_o2o"])),
}


def run_mode(S, mk, cost=COST, hedged=False):
    a = MODE_ARGS[mk]
    return run(S, a["R"], a["mode"], a["HD"], cost, a["hedge"] if hedged else None)


# ------------------------------------------------------------ 1. リーク検査
hr("1. リーク検査 (D 以降の米国データを書き換えても D のシグナルが変わらないこと)")
rng = np.random.default_rng(SEED)
n_ok = 0
for pid, us_t, jp_t in PAIRS:
    jd = get_daily(jp_t).index
    assert_no_lookahead(us_close_clean(us_t), jd[jd >= START - pd.Timedelta(days=400)], n_checks=8, seed=n_ok)
    n_ok += 1
print(f"  jpus.align.assert_no_lookahead: {n_ok} ペアすべて合格 (us_logret)")
# z (σ60 を含む) と リーク版(ii) を自前で検査
z_fail, leak_detect = 0, 0
for pid, us_t, jp_t in PAIRS[:: max(1, NP // 8)]:
    us = us_close_clean(us_t)
    jd = get_daily(jp_t).index
    jd = jd[jd >= START]
    _, z0 = compute_z(us, jd)
    base_same = FULL[pid]["z_same"].reindex(jd)
    for D in rng.choice(jd[100:], size=10, replace=False):
        D = pd.Timestamp(D)
        pert = us.copy()
        m = pert.index >= D
        pert[m] = pert[m] * rng.uniform(0.7, 1.3, m.sum())
        _, z1 = compute_z(pert, jd)
        k = jd.get_loc(D)
        if not (np.isnan(z0[k]) and np.isnan(z1[k])) and not np.isclose(z0[k], z1[k]):
            z_fail += 1
        lrp = np.log(pert).diff()
        zs = (lrp / lrp.rolling(VOL_WIN, min_periods=VOL_WIN).std().shift(1)).reindex([D]).iloc[0]
        if np.isfinite(zs) and np.isfinite(base_same.loc[D]) and not np.isclose(zs, base_same.loc[D]):
            leak_detect += 1
print(f"  z(D) (σ60 込み) の書き換えテスト: 不一致 {z_fail} 件 → {'合格' if z_fail == 0 else '★失敗★'}")
print(f"  参考: リーク版(ii) 同日付シグナルは同じテストで {leak_detect} 件変化 → 未来情報を使っていることを検出")
if z_fail:
    raise AssertionError("z にリークがあります")

# ------------------------------------------------------------ 2. データ品質 (合成足)
hr("2. データ品質: 2008-2009 の Yahoo 東証日足の合成足 (始値=前日終値, 高値=始値, 安値=終値)")
qrows = []
for pid, us_t, jp_t in PAIRS:
    jp = get_daily(jp_t)
    o, h, l, c = jp["Open"], jp["High"], jp["Low"], jp["Close"]
    syn = (o == c.shift(1)) & (h == np.maximum(o, c)) & (l == np.minimum(o, c))
    d = FULL[pid]
    bad = d.loc[BAD_START:BAD_END].dropna(subset=["z", "intra"])
    good = d.loc[START:].dropna(subset=["z", "intra"])
    qrows.append({
        "合成足率08-09/5%": 100 * syn.loc[BAD_START:BAD_END].mean() if len(syn.loc[BAD_START:BAD_END]) else np.nan,
        "合成足率2010-%": 100 * syn.loc[START:].mean(),
        "corr(z,寄引)08-09": bad["z"].corr(bad["intra"]) if len(bad) > 60 else np.nan,
        "corr(z,寄引)2010-": good["z"].corr(good["intra"]),
        "順張り売買bp08-09": 1e4 * (np.sign(bad["z"]) * bad["intra"]).mean() if len(bad) > 60 else np.nan,
        "順張り売買bp2010-": 1e4 * (np.sign(good["z"]) * good["intra"]).mean(),
    })
Q = pd.DataFrame(qrows, index=PIDS)
print(fmt(Q.describe().loc[["count", "mean", "50%"]].rename(index={"count": "ペア数", "mean": "平均", "50%": "中央値"}), 3))
print("  → 2008〜2009/5 の『寄→引』は実質『前日終値→終値』で米国の動きを含むため、順張りが大きく儲かって見える"
      "\n    (= データ起因のリーク). 本検証は 2010-01-01 以降のみ使用.")

# ------------------------------------------------------------ 3. ペア別診断
hr("3. ペア別診断: 米国シグナル z は寄付ギャップにほぼ織り込まれ、寄→引にはほとんど残らない")
drows = []
for pid, us_t, jp_t in PAIRS:
    d = FULL[pid].loc[START:]
    row = {"ペア": pair_label(us_t, jp_t)}
    for per, dd in [("IS", d[d.index < OOS_START]), ("OOS", d[d.index >= OOS_START])]:
        cg, tg, n = nw_corr(dd["z"], dd["gap"])
        ci, ti, _ = nw_corr(dd["z"], dd["intra"])
        cov_g = dd[["z", "gap"]].dropna().cov().iloc[0, 1] if n >= 60 else np.nan
        cov_c = dd[["z", "c2c"]].dropna().cov().iloc[0, 1] if n >= 60 else np.nan
        row.update({f"{per}日数": n, f"{per}ρ(z,ギャップ)": cg, f"{per}ρ(z,寄引)": ci, f"{per}t寄引": ti,
                    f"{per}ギャップ比%": 100 * cov_g / cov_c if (n >= 60 and cov_c > 0) else np.nan})
    drows.append(row)
DIAG = pd.DataFrame(drows, index=PIDS)
print(fmt(DIAG.drop(columns=["ペア"]).set_index(DIAG["ペア"]), 3))
both = DIAG.dropna(subset=["ISρ(z,寄引)", "OOSρ(z,寄引)"])
same_sign = (np.sign(both["ISρ(z,寄引)"]) == np.sign(both["OOSρ(z,寄引)"])).mean()
print(f"\n  ρ(z, 寄付ギャップ) 中央値: IS {DIAG['ISρ(z,ギャップ)'].median():+.3f} / OOS {DIAG['OOSρ(z,ギャップ)'].median():+.3f}"
      f"   ρ(z, 寄→引) 中央値: IS {DIAG['ISρ(z,寄引)'].median():+.3f} / OOS {DIAG['OOSρ(z,寄引)'].median():+.3f}")
print(f"  前日比 (終値→終値) の反応のうち寄付ギャップで生じる割合 (中央値): IS {DIAG['ISギャップ比%'].median():.0f}%"
      f" / OOS {DIAG['OOSギャップ比%'].median():.0f}%  (100% 超 = 寄付で行き過ぎ、日中に戻る)")
print(f"  ρ(z,寄引) の符号が IS と OOS で一致するペアの割合: {100 * same_sign:.0f}% ({len(both)} ペア中)")
print(f"  |t寄引| ≥ 2 のペア数: IS {int((DIAG['ISt寄引'].abs() >= 2).sum())} (正 {int((DIAG['ISt寄引'] >= 2).sum())}, "
      f"負 {int((DIAG['ISt寄引'] <= -2).sum())}) / OOS {int((DIAG['OOSt寄引'].abs() >= 2).sum())} "
      f"(正 {int((DIAG['OOSt寄引'] >= 2).sum())}, 負 {int((DIAG['OOSt寄引'] <= -2).sum())})  ※ 67 ペアで偶然 3 程度は出る")

# ------------------------------------------------------------ 4. 32 通りの共通ルール
hr("4. 全ペア共通ルール 32 通り (片道 5bp, 稼働ペア等分ポートフォリオ). IS の純 Sharpe 最大を凍結 → OOS")
VAR = {}
rows = []
for fam in FAMILIES:
    for th in THETAS:
        S = positions(A["z"], fam, th)
        for mk in MODES:
            name = f"{fam} θ={th:g} {mk}"
            res = run_mode(S, mk)
            si, so = block_stats(res, IS_M), block_stats(res, OOS_M)
            # ペア別 (1 単位) の日次純損益 Sharpe (ペア別選択・後知恵選択用)
            ps = {per: np.array([sharpe_of(pair_daily_net(res, j, m)) for j in range(NP)])
                  for per, m in [("IS", IS_M), ("OOS", OOS_M), ("ALL", ALL_M)]}
            pt = {per: np.array([newey_west_tstat(pair_daily_net(res, j, m)) if (~np.isnan(res["R"][m, j])).sum() > 60
                                 else np.nan for j in range(NP)]) for per, m in [("IS", IS_M), ("ALL", ALL_M)]}
            VAR[name] = {"fam": fam, "th": th, "mk": mk, "net": res["net"], "IS": si, "OOS": so, "pS": ps, "pT": pt,
                         "sr_is_d": si["Sharpe"] / math.sqrt(JP_DAYS), "sr_oos_d": so["Sharpe"] / math.sqrt(JP_DAYS)}
            rows.append({"ルール": name, **{f"IS {k}": si[k] for k in ["取引数", "粗bp/取引", "純bp/取引", "Sharpe", "t(NW)"]},
                         **{f"OOS {k}": so[k] for k in ["取引数", "粗bp/取引", "純bp/取引", "Sharpe", "t(NW)"]}})
GRID = pd.DataFrame(rows).set_index("ルール")
BEST = GRID["IS Sharpe"].idxmax()
BEST_TR = GRID.loc[[n for n in GRID.index if n.startswith("順張り")], "IS Sharpe"].idxmax()
BEST_CT = GRID.loc[[n for n in GRID.index if n.startswith("逆張り")], "IS Sharpe"].idxmax()
USERQ = "順張り買い θ=0 寄→引"
mark = pd.Series("", index=GRID.index)
mark[BEST] += "★凍結"
mark[USERQ] += "◎問い"
G2 = GRID.copy()
G2.insert(0, "印", mark)
print(fmt(G2, 2))
print(f"\n  ★ IS で選ばれた共通ルール (凍結): {BEST}   IS Sharpe {GRID.loc[BEST, 'IS Sharpe']:+.2f} → OOS Sharpe "
      f"{GRID.loc[BEST, 'OOS Sharpe']:+.2f}")
print(f"  ◎ ユーザーの問いそのもの「米国が上がったら寄付で買い→引けで売り」 = {USERQ}")
print(f"  IS で純 Sharpe > 0 のルール数: {(GRID['IS Sharpe'] > 0).sum()} / 32,  OOS で > 0: {(GRID['OOS Sharpe'] > 0).sum()} / 32")
print(f"  IS と OOS の純 Sharpe の順位相関 (32 通り): {stats.spearmanr(GRID['IS Sharpe'], GRID['OOS Sharpe'])[0]:+.2f}")
if GRID.loc[BEST, "IS Sharpe"] <= 0:
    print("  ※ IS 最良でも純 Sharpe ≤ 0. 実務上は『IS の時点で採用しない』が正しい判断 (以下は参考として凍結ルールの OOS を表示).")

# ------------------------------------------------------------ 5. 凍結ルールとベンチマーク
hr("5. 凍結ルール vs ベンチマーク (無条件買い / 市場ヘッジ / ランダム日プラセボ)")


def strat(name: str, hedged: bool = False, cost: TSECost = COST) -> dict:
    v = VAR[name]
    return run_mode(positions(A["z"], v["fam"], v["th"]), v["mk"], cost, hedged)


ONES_I = np.where(~np.isnan(A["intra"]), 1.0, 0.0)
ONES_O = np.where(~np.isnan(A["o2o"]), 1.0, 0.0)
RES = {
    f"凍結: {BEST}": strat(BEST),
    f"凍結(1321.Tヘッジ): {BEST}": strat(BEST, hedged=True),
    f"順張り最良(IS選択): {BEST_TR}": strat(BEST_TR),
    f"逆張り最良(IS選択): {BEST_CT}": strat(BEST_CT),
    f"問い: {USERQ}": strat(USERQ),
    f"問い(1321.Tヘッジ): {USERQ}": strat(USERQ, hedged=True),
    "無条件 毎日 寄→引 買い": run_mode(ONES_I, "寄→引"),
    "無条件 毎日 寄→引 買い(1321.Tヘッジ)": run_mode(ONES_I, "寄→引", hedged=True),
    "無条件 寄→翌寄 買い持ち": run_mode(ONES_O, "寄→翌寄"),
}
brow = []
for k, res in RES.items():
    for per, m in [("IS", IS_M), ("OOS", OOS_M)]:
        brow.append({"戦略": k, "区間": per, **block_stats(res, m)})
BENCH = pd.DataFrame(brow).set_index(["戦略", "区間"])
print(fmt(BENCH, 2))
print("  ※ bp は (ペア, 日) 1 取引あたり. 年率%/Sharpe/t は『その日稼働したペアに資金を等分』した日次損益から."
      "\n    ドリフト控除bp = 各ペアの期間平均リターンを差し引いた (シグナルの向きだけの) 粗利.")


def placebo(name_res: dict, name: str, mk: str, n_rep: int = N_PLACEBO) -> dict:
    """シグナル行列を全ペア同時に時間方向へ循環シフト (同じ取引数・同じ相関構造, 日付だけランダム)."""
    S_full = name_res["S"]
    a = MODE_ARGS[mk]
    out = {}
    for per, m in [("IS", IS_M), ("OOS", OOS_M)]:
        idx = np.where(m)[0]
        Sp, Rp = S_full[idx], a["R"][idx]
        HDp = None if a["HD"] is None else a["HD"][idx]
        actual = float(name_res["net"].to_numpy()[idx].mean())
        rr = np.random.default_rng(SEED + (0 if per == "IS" else 1))
        sims, ntr = [], []
        for _ in range(n_rep):
            k = int(rr.integers(20, len(idx) - 20))
            Ss = np.roll(Sp, k, axis=0)
            valid = ~np.isnan(Rp)
            Ss = np.where(valid, Ss, 0.0)
            gross = Ss * np.where(valid, Rp, 0.0)
            c, _ = leg_cost(Ss, a["mode"], HDp, COST)
            act = (Ss != 0) | (c != 0)
            sims.append(((gross - c).sum(1) / np.maximum(act.sum(1), 1)).mean())
            ntr.append((Ss != 0).sum())
        sims = np.array(sims)
        out[per] = {"実際 bp/日": 1e4 * actual, "プラセボ平均 bp/日": 1e4 * sims.mean(),
                    "プラセボ95%点": 1e4 * np.quantile(sims, 0.95), "p値(片側)": (np.sum(sims >= actual) + 1) / (n_rep + 1),
                    "実際取引数": int((Sp != 0).sum()), "プラセボ平均取引数": float(np.mean(ntr))}
    return out


PL = {}
for nm, key in [(BEST, f"凍結: {BEST}"), (USERQ, f"問い: {USERQ}"), (BEST_CT, f"逆張り最良(IS選択): {BEST_CT}")]:
    if nm in PL:
        continue
    pr = placebo(RES[key], nm, VAR[nm]["mk"])
    for per in ["IS", "OOS"]:
        PL[(nm, per)] = pr[per]
PLT = pd.DataFrame(PL).T
PLT.index.names = ["ルール", "区間"]
print("\n[ランダム日プラセボ] (ポートフォリオ純損益 bp/日, 片道 5bp, 循環シフト 300 回)")
print(fmt(PLT, 3))

# ------------------------------------------------------------ 6. コスト感度
hr("6. コスト感度 (片道 0/2/5/10bp. 空売りの貸株料 1.15% は常に計上) と損益分岐")
crow = []
for nm in dict.fromkeys([BEST, BEST_TR, BEST_CT, USERQ]):
    for b in SLIPS:
        res = strat(nm, cost=COST.with_slippage(b))
        for per, m in [("IS", IS_M), ("OOS", OOS_M)]:
            s = block_stats(res, m)
            crow.append({"ルール": nm, "片道bp": b, "区間": per, "純bp/取引": s["純bp/取引"], "年率%": s["年率%"],
                         "Sharpe": s["Sharpe"], "t(NW)": s["t(NW)"], "分岐bp(往復)": s["分岐bp(往復)"]})
COSTT = pd.DataFrame(crow).pivot_table(index=["ルール", "片道bp"], columns="区間",
                                       values=["純bp/取引", "年率%", "Sharpe", "分岐bp(往復)"], sort=False)
print(fmt(COSTT, 2))
print("  分岐bp(往復) = 平均粗利 bp/往復. 片道コスト×2 がこれを下回らないと利益が出ない (寄→引 は毎日往復).")

# ------------------------------------------------------------ 7. 年別
hr("7. 年別成績 (片道 5bp, ポートフォリオ純損益)")
yr_keys = [f"凍結: {BEST}", f"問い: {USERQ}", f"逆張り最良(IS選択): {BEST_CT}", "無条件 毎日 寄→引 買い"]
years = CAL.year
yrow = []
for y in sorted(set(years)):
    m = np.asarray(years == y)
    row = {"年": y, "区間": "IS" if y < OOS_START.year else "OOS"}
    for k in yr_keys:
        s = block_stats(RES[k], m)
        short = k.split(":")[0]
        row[f"{short} 純bp/取引"] = s["純bp/取引"]
        row[f"{short} 年率%"] = s["年率%"]
    yrow.append(row)
YR = pd.DataFrame(yrow).set_index("年")
print(fmt(YR, 1))
print(f"  凍結 = {BEST} / 問い = {USERQ} / 逆張り最良 = {BEST_CT}")

# ------------------------------------------------------------ 8. 凍結ルールのペア別 OOS
hr(f"8. 凍結ルール [{BEST}] のペア別成績 (1 単位, 片道 5bp)")
rb = RES[f"凍結: {BEST}"]
prow = []
for j, (pid, us_t, jp_t) in enumerate(PAIRS):
    r = {"ペア": pair_label(us_t, jp_t)}
    for per, m in [("IS", IS_M), ("OOS", OOS_M)]:
        S, g, c = rb["S"][m, j], rb["gross"][m, j], rb["cost"][m, j]
        n = int((S != 0).sum())
        x = pair_daily_net(rb, j, m)
        r[f"{per}取引数"] = n
        r[f"{per}粗bp"] = 1e4 * g.sum() / n if n else np.nan
        r[f"{per}純bp"] = 1e4 * (g.sum() - c.sum()) / n if n else np.nan
        r[f"{per}t"] = newey_west_tstat(x) if len(x) > 60 else np.nan
    prow.append(r)
PP = pd.DataFrame(prow, index=PIDS)
print(fmt(PP.set_index("ペア"), 2))
bb = PP.dropna(subset=["IS純bp", "OOS純bp"])
print(f"\n  OOS 純bp > 0 のペア: {(PP['OOS純bp'] > 0).sum()} / {PP['OOS純bp'].notna().sum()}"
      f"   IS と OOS で純bp の符号が一致: {100 * (np.sign(bb['IS純bp']) == np.sign(bb['OOS純bp'])).mean():.0f}%")

# ------------------------------------------------------------ 9. ペア別に IS 最良ルールを選ぶ (過剰適合の確認)
hr(f"9. 参考: ペア別に IS 最良ルールを選択 (32 通り × {NP} ペア = {32 * NP} 通り), IS の NW t ≥ {T_ADOPT:g} のペアだけ採用")
names = list(VAR)


def select_per_pair(period: str) -> list[tuple[int, str, float, float]]:
    """period ('IS' or 'ALL') の Sharpe 最大ルールを各ペアで選ぶ. (ペア, ルール, Sharpe, t)."""
    out = []
    for j in range(NP):
        srs = np.array([VAR[n]["pS"][period][j] for n in names])
        if np.all(np.isnan(srs)):
            continue
        k = int(np.nanargmax(srs))
        out.append((j, names[k], float(srs[k]), float(VAR[names[k]]["pT"][period][j])))
    return out


def per_pair_portfolio(sel: list[tuple[int, str, float, float]]) -> dict:
    """採用ペアをそれぞれのルールで 1 単位売買し、稼働ペアで等分."""
    G = np.zeros((len(CAL), NP))
    C = np.zeros_like(G)
    Sall = np.zeros_like(G)
    Rall = np.full_like(G, np.nan)
    TV = np.zeros_like(G)
    by_rule: dict[str, list[int]] = {}
    for j, n, _, _ in sel:
        by_rule.setdefault(n, []).append(j)
    for n, js in by_rule.items():
        res = strat(n)
        G[:, js], C[:, js], Sall[:, js], Rall[:, js], TV[:, js] = (res["gross"][:, js], res["cost"][:, js],
                                                                  res["S"][:, js], res["R"][:, js], res["turn"][:, js])
    act = (Sall != 0) | (C != 0)
    net = (G - C).sum(1) / np.maximum(act.sum(1), 1)
    return {"S": Sall, "R": Rall, "gross": G, "cost": C, "turn": TV, "net": pd.Series(net, index=CAL)}


sel_is = select_per_pair("IS")
adopt_is = [s for s in sel_is if np.isfinite(s[3]) and s[3] >= T_ADOPT]
PPS = per_pair_portfolio(adopt_is)
srow = []
for j, n, sr, t in adopt_is:
    us_t, jp_t = PAIRS[j][1], PAIRS[j][2]
    x_oos = pair_daily_net(strat(n), j, OOS_M)
    srow.append({"ペア": pair_label(us_t, jp_t), "IS選択ルール": n, "IS Sharpe": sr, "IS t": t,
                 "OOS Sharpe": sharpe_of(x_oos), "OOS t": newey_west_tstat(x_oos)})
SEL = pd.DataFrame(srow)
print(fmt(SEL.set_index("ペア"), 2) if len(SEL) else "  採用ペアなし")
fam_cnt = pd.Series([n.split(" ")[0] for _, n, _, _ in sel_is]).value_counts()
print(f"\n  各ペアの IS 最良ルールの族の内訳 (採用前, {len(sel_is)} ペア): {fam_cnt.to_dict()}")
print(f"  採用 {len(adopt_is)} ペア (IS で計 {32 * NP} 通りを試した最大値なので IS の t は大きく割り引いて見ること)")
for per, m in [("IS", IS_M), ("OOS", OOS_M)]:
    s = block_stats(PPS, m)
    print(f"  ペア別選択ポートフォリオ {per}: 取引数 {s['取引数']}, 純bp/取引 {s['純bp/取引']:+.2f}, 年率 {s['年率%']:+.2f}%,"
          f" Sharpe {s['Sharpe']:+.2f}, t {s['t(NW)']:+.2f}")
if len(SEL):
    print(f"  採用ペアのうち OOS Sharpe > 0: {(SEL['OOS Sharpe'] > 0).sum()} / {len(SEL)}")

# ------------------------------------------------------------ 10. リーク版
hr("10. リーク版 (実行不可能!) — リークがあると成績がどれだけ水増しされるか")
LEAK_FAM, LEAK_TH = "順張り売買", 0.0
S_leak = positions(A["z"], LEAK_FAM, LEAK_TH)
S_same = positions(A["z_same"], LEAK_FAM, LEAK_TH)
LEAK = {
    f"正直版: {LEAK_FAM} θ=0 寄→引 (米国 d<D)": run(S_leak, A["intra"], "intra"),
    "リーク版(実行不可能)(i) 前日引け→当日引け (米国 D-1 終値は日本 D-1 引け後に確定)":
        run(S_leak, A["c2c"], "on", A["hd_c2c"]),
    "リーク版(実行不可能)(ii) 同日付の米国リターン (米国 D は日本 D の引け後に確定)":
        run(S_same, A["intra"], "intra"),
}
# (iv) 後知恵選択: 全期間 (OOS 含む) の Sharpe でペア別ルールを選ぶ
sel_all = [s for s in select_per_pair("ALL") if np.isfinite(s[3]) and s[3] >= T_ADOPT]
LEAK["リーク版(実行不可能)(iv) 後知恵選択: 全期間の成績でペア別ルールを選択"] = per_pair_portfolio(sel_all)
LEAK[f"正直版: ペア別 IS 選択 (採用 {len(adopt_is)} ペア)"] = PPS
lrow = []
for k, res in LEAK.items():
    for per, m in [("IS", IS_M), ("OOS", OOS_M)]:
        s = block_stats(res, m)
        lrow.append({"戦略": k, "区間": per, **{c: s[c] for c in ["取引数", "粗bp/取引", "純bp/取引", "年率%", "Sharpe", "t(NW)"]}})
LK = pd.DataFrame(lrow).set_index(["戦略", "区間"])
print(fmt(LK, 2))
print(f"\n  リーク版(iii) 2008-02〜2009-05 の合成足をそのまま使った {LEAK_FAM} θ=0 寄→引: 粗 {Q['順張り売買bp08-09'].mean():+.1f} bp/取引"
      f" (ペア平均)  vs  2010 年以降の正直版: {Q['順張り売買bp2010-'].mean():+.1f} bp/取引")
print(f"  リーク版(iv) 採用 {len(sel_all)} ペア. 『OOS』も選択に使っているので OOS 成績は見せかけ.")

# ------------------------------------------------------------ 11. 多重検定
hr("11. 多重検定の補正 (Deflated Sharpe Ratio / Bonferroni)")
sr_is_all = np.array([VAR[n]["sr_is_d"] for n in names])
sr_oos_all = np.array([VAR[n]["sr_oos_d"] for n in names])
fr_net = RES[f"凍結: {BEST}"]["net"]
x_is, x_oos = fr_net[IS_M], fr_net[OOS_M]
dsr_is = deflated_sharpe_ratio(VAR[BEST]["sr_is_d"], int(IS_M.sum()), len(names), float(np.nanstd(sr_is_all, ddof=1)),
                               float(stats.skew(x_is)), float(stats.kurtosis(x_is, fisher=False)))
dsr_oos = deflated_sharpe_ratio(VAR[BEST]["sr_oos_d"], int(OOS_M.sum()), len(names), float(np.nanstd(sr_oos_all, ddof=1)),
                                float(stats.skew(x_oos)), float(stats.kurtosis(x_oos, fisher=False)))
t_oos = newey_west_tstat(x_oos)
p_oos = 1 - stats.norm.cdf(t_oos)
N_PORT_TESTS = len(names) + 1   # 共通ルール 32 + ペア別選択手順 1
print(f"  凍結ルール: {BEST}")
print(f"  IS  Sharpe(年率) {VAR[BEST]['IS']['Sharpe']:+.2f}, DSR (32 通りから最良を選んだ補正後に真の SR>0 の確率) = {dsr_is:.3f}")
print(f"  OOS Sharpe(年率) {VAR[BEST]['OOS']['Sharpe']:+.2f}, NW t = {t_oos:+.2f}, 片側 p = {p_oos:.4f}, "
      f"Bonferroni (×{N_PORT_TESTS}) p = {min(1.0, p_oos * N_PORT_TESTS):.4f}")
print(f"  (保守的参考) OOS でも 32 通りから選んだと仮定した DSR = {dsr_oos:.3f}")
s_pp = block_stats(PPS, OOS_M)
p_pp = 1 - stats.norm.cdf(s_pp["t(NW)"]) if np.isfinite(s_pp["t(NW)"]) else np.nan
print(f"  ペア別 IS 選択ポートフォリオ: OOS t = {s_pp['t(NW)']:+.2f}, 片側 p = {p_pp:.4f}, "
      f"Bonferroni (×{N_PORT_TESTS}) p = {min(1.0, p_pp * N_PORT_TESTS):.4f}")
N_TRIED = len(names) + len(names) * NP
print(f"  試した戦略の総数: 共通ルール {len(names)} + ペア別 {len(names) * NP} = {N_TRIED} (リーク版 4・ベンチマーク 3 は別)")

# ------------------------------------------------------------ 12. 結論
hr("12. 結論 (要約)")
sb_is, sb_oos = VAR[BEST]["IS"], VAR[BEST]["OOS"]
uq_is, uq_oos = VAR[USERQ]["IS"], VAR[USERQ]["OOS"]
ub = block_stats(RES["無条件 毎日 寄→引 買い"], OOS_M)
print(f"  ・ユーザーの問い「前日に米国関連株が上がったら寄付で買い→引けで売る」({USERQ}):\n"
      f"      粗 {uq_is['粗bp/取引']:+.1f}bp (IS) / {uq_oos['粗bp/取引']:+.1f}bp (OOS) / 取引, 純 {uq_is['純bp/取引']:+.1f} / "
      f"{uq_oos['純bp/取引']:+.1f}bp, OOS Sharpe {uq_oos['Sharpe']:+.2f}  (無条件の毎日 寄→引 買い OOS: 粗 {ub['粗bp/取引']:+.1f}bp)")
print(f"  ・米国の前日の動きは寄付ギャップでほぼ織り込み済み (ギャップ比 中央値 OOS {DIAG['OOSギャップ比%'].median():.0f}%)."
      f" 寄→引 に残る相関の中央値は {DIAG['OOSρ(z,寄引)'].median():+.3f}")
print(f"  ・IS で選んだ共通ルール {BEST}: IS 純 {sb_is['純bp/取引']:+.1f}bp, Sharpe {sb_is['Sharpe']:+.2f} → OOS 純 "
      f"{sb_oos['純bp/取引']:+.1f}bp, Sharpe {sb_oos['Sharpe']:+.2f}, t {sb_oos['t(NW)']:+.2f}")
print(f"  ・リーク版は (i) {LK.loc[(list(LEAK)[1], 'OOS'), '純bp/取引']:+.1f}bp, (ii) {LK.loc[(list(LEAK)[2], 'OOS'), '純bp/取引']:+.1f}bp"
      f" / 取引 (OOS) と桁違いに良く見えるが実行不可能.")
print(f"\n経過時間 {time.time() - T0:.0f} 秒. 以下グラフを表示 (閉じると次へ).")

# ------------------------------------------------------------ 13. グラフ
plot_pnl({
    f"凍結共通ルール: {BEST}": RES[f"凍結: {BEST}"]["net"],
    f"凍結ルール 1321.Tヘッジ": RES[f"凍結(1321.Tヘッジ): {BEST}"]["net"],
    f"順張り(IS最良): {BEST_TR}": RES[f"順張り最良(IS選択): {BEST_TR}"]["net"],
    f"逆張り(IS最良): {BEST_CT}": RES[f"逆張り最良(IS選択): {BEST_CT}"]["net"],
    f"問い: {USERQ}": RES[f"問い: {USERQ}"]["net"],
    "無条件 毎日 寄→引 買い": RES["無条件 毎日 寄→引 買い"]["net"],
    f"ペア別IS選択 ({len(adopt_is)}ペア)": PPS["net"],
}, f"S1 米国→日本リードラグ: 実行可能な戦略の累積純損益 (東証×SBI, 片道5bp, {len(PAIRS)}ペア等分)", OOS_START)

plot_pnl({
    f"正直版: {LEAK_FAM} θ=0 寄→引": LEAK[f"正直版: {LEAK_FAM} θ=0 寄→引 (米国 d<D)"]["net"],
    "リーク版(実行不可能)(i) 前日引け→当日引け": LEAK[list(LEAK)[1]]["net"],
    "リーク版(実行不可能)(ii) 同日付の米国リターン": LEAK[list(LEAK)[2]]["net"],
    "リーク版(実行不可能)(iv) 全期間で後知恵選択": LEAK[list(LEAK)[3]]["net"],
    "正直版: ペア別IS選択": PPS["net"],
}, "S1 リーク版 (実行不可能) と正直版の比較: 先読みすると成績は桁違いに水増しされる", OOS_START)

oos_bp = PP.set_index(PP["ペア"].str.split(" ").str[0])["OOS純bp"].dropna().sort_values()
plot_bar(oos_bp, f"凍結ルール [{BEST}] のペア別 OOS 純損益 (bp/取引, 片道5bp)", ylabel="bp/取引")

fig, ax = plt.subplots(figsize=(14, 5.5))
dd = DIAG.set_index(DIAG.index.str.replace(".T", "", regex=False))
order = dd["OOSρ(z,ギャップ)"].sort_values().index
xs = np.arange(len(order))
ax.bar(xs - 0.27, dd.loc[order, "OOSρ(z,ギャップ)"], width=0.27, label="OOS ρ(z, 寄付ギャップ)", color="tab:blue")
ax.bar(xs, dd.loc[order, "OOSρ(z,寄引)"], width=0.27, label="OOS ρ(z, 寄→引)", color="tab:orange")
ax.bar(xs + 0.27, dd.loc[order, "ISρ(z,寄引)"], width=0.27, label="IS ρ(z, 寄→引)", color="tab:gray")
ax.set_xticks(xs)
ax.set_xticklabels(order, rotation=80, fontsize=7)
ax.axhline(0, color="black", lw=0.6)
ax.set_ylabel("相関係数")
ax.set_title("米国シグナル z と日本株リターンの相関: ほぼ全て寄付ギャップに織り込まれ、寄→引には残らない")
ax.grid(alpha=0.3, axis="y")
ax.legend(loc="upper left", fontsize=9)
plt.tight_layout()
plt.show()
