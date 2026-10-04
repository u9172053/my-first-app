"""s2: 東証「寄付(板寄せ)」周辺の構造的な穴の検証 —
  (A) 米国要因で説明できない寄付ギャップの過剰反応 (クロスセクション)
  (B) ADR 理論価格 (米国上場 ADR × 為替 → 東証の理論価格)
  (C) 日本休場明けの米国累積リターン (GW・年末年始・3連休明け)

実行: cd /home/user/my-first-app && python3 studies/s2_gap_overreaction_adr.py
(初回のみ: FXY 日足 と ユニバース約 100 銘柄の 1 時間足 (直近約730日) を Yahoo から取得して data/ に CSV 保存
 (1〜3 分). 2 回目以降は CSV を読むだけで 30 秒程度. 結果ファイルや画像は保存しない. グラフは plt.show() で表示するだけ.)

==========================================================================================
【取引所・証券会社・コストの前提】 (jpus.costs.TSECost)
  - 売買する市場   : 東京証券取引所 (個別株・ETF). 寄付は 寄成 (板寄せ), 決済は 引成 (板寄せ).
  - 証券会社       : SBI証券 オンライン. 売買手数料 0 円 (ゼロ革命, 現物・信用とも).
  - 執行コスト     : 既定 片道 5bp (板寄せ価格への自己インパクト等のバッファ). 感応度 0/2/5/10bp.
                     寄付価格を使うルールには +10bp (片道 15bp) の頑健性チェックも付ける.
  - 買い           : 現物 (金利なし).  売り: 制度信用の空売り (貸株料 年1.15%, 日計りでも 1 日分).
                     逆日歩・空売り価格規制・値幅制限 (ストップ高安で寄らない) ・税金は考慮しない.
  - 損益は「1 単位ノーショナル」あたりの単利. ロング・ショート (L/S) は 買い1 + 売り1 (グロス 2) あたり.
  - 損益分岐: 「損益分岐(往復bp)」= 1 単位の往復 1 回あたりのグロス平均 bp
              (= 片道コストをいくらまで払えるか × 2. L/S は 1 日に往復 2 回なので 1 日のグロスの半分).
==========================================================================================
【シグナルのタイミング (JST)】  日本の取引日 D について
  - 米国データ (^GSPC, ^SOX, ^TNX, CL=F, FXY, ADR): 米国日付 d < D の終値のみ
    (jpus.align.us_signal_for_jp と同じ searchsorted ロジック. 米国 d の引けは JST d+1 の 5-6 時).
  - 為替 JPY=X (Yahoo 日足): 日付 < D のみ. ※ 調べたところ 2010 年以降の Yahoo の JPY=X 日足は
    Open≒Close で、「Close」は実質ロンドン 0 時 (= その日の始まり, JST 8-9 時) の値. つまり
    JPY=X の日付 < D の値は 約 1 日古い (リークはしないが情報が遅い).
    そこで ADR の円換算には 米国上場の円 ETF「FXY」(NYSE Arca, ADR と同時刻 16:00 ET 引け) を使い、
    USD/JPY ∝ 1/FXY とする (定数倍は比率の移動中央値で吸収).
  - 東証データ: 前営業日 (D-1) の大引けまで. ローリング推定 (回帰係数・残差 σ・ADR 比率) は全て D より前のデータのみ.
  - 「寄付価格を使用 (板寄せ気配で近似可能)」と明記したルールは D の寄付値そのものをシグナルに使う.
    実際には 8:59 の板寄せ気配で近似して寄成を出すか、寄付を見てから成行で入る必要があるので、
    頑健性として (1) 片道 +10bp, (2) 1 時間足で 10:00 (9 時台足の終値) に約定 を必ず併記する.
  - 事前予測だけのルール (寄付価格を使わない) は 08:59 までに全て計算でき、寄成で約定可能.
【売買】 原則 D の寄付で建てて D の大引けで手仕舞う (日計り, open→close).
【IS/OOS】 IS = 〜2018-12-31, OOS = 2019-01-01〜最新. パラメータ (k, 標準化, 閾値, 向き, 構成) は
           IS の純損益 (片道 5bp) の Sharpe 最大で選び、OOS では凍結. 試した全バリアントの数と成績を表示し、
           見出しには Deflated Sharpe (試行数で割り引き) と Bonferroni 補正を付ける.
           参考として「拡大窓ウォークフォワード」(OOS の各年をその前年末までの全データで同じ候補から選び直す) も表示し、
           これも Bonferroni の本数に含める.
【各パートの中身】
 (A) 個別株 (ETF 除く, ユニバース約 100 銘柄. 現存大型株なので生存者バイアスあり) ごとに
     gap(D) = 寄付/前日大引け - 1 を 寄付前ファクター [S&P500, SOX, 米10年金利(差分), USD/JPY(JPY=X),
     USD/JPY(FXY, 米国引け時点), WTI] に 過去 250 営業日 (D を含まない) のローリング OLS で回帰 → 予測 ĝ(D).
     残差 e(D) = gap(D) - ĝ(D) [寄付価格を使用]. 残差の小さい k 銘柄を買い・大きい k 銘柄を売り (または 1321.T でヘッジ).
     寄付価格を使わない版: ĝ(D) だけで順張り/逆張り (市場は米国情報に過剰/過小反応するか?).
     指数レベル (A3): 1321.T 自身の gap を同じファクターで回帰し、ĝ の符号で 1321.T を日中売買.
 (B) ADR: implied_JP(d) = ADR終値(d) / FXY(d) / 比率, 比率 = 過去 60 回の [ADR/FXY ÷ 東証終値] の中央値
     (d 自身を含まない. 比率の急変 = ADR 比率変更は自動検知). implied_gap(D) = implied_JP(最後の米国日 < D) / 東証終値(D-1) - 1.
     (i) implied_gap が実際の gap を当てるか (健全性), (ii) implied_gap - 実gap [寄付価格を使用] /
     implied_gap 単独 [事前] が 寄付→大引け を予測するか. ルールは銘柄ごとの方向売買 (閾値) と
     銘柄横断の L/S (市場中立) の両方. 権利落ち日 (と翌営業日) は除外 (配当の日付ズレ対策, 事前に既知).
 (C) n_us_new >= 2 (日本が休場中に米国が 2 セッション以上動いた日) と通常日で、1321.T/1306.T と
     リードラグペアの 寄付→大引け, ギャップの織り込み具合を比較. 標本が小さいのでブートストラップ p 値と件数を明示.
【データの注意 (このスクリプトで対処)】
  - Yahoo の東証日足「始値」は 2008Q1〜2009Q2 に 40〜68% の日で前日終値と同値 (欠損埋めとみられる).
    放置すると 2008-09 年の「寄付→大引け」が実は前日比になり、米国→日本の順張りや ADR ルールの IS が大きく水増しされる.
    → 始値を使う計算は 2009-07-01 以降のみ (IS は実質 2009-07〜2018).
  - 1306.T など一部 ETF は未調整の分割が混入 (例 1306.T 2015-01-05 に -90%). |gap|,|日中| が 個別株 40% / 指数ETF 15%
    を超える日はデータ異常として除外 (事前に固定した閾値).
  - ユニバースは現存の大型株 (東芝 6502.T などの上場廃止銘柄はデータなし) → 生存者バイアスあり.
【リーク版】 「米国日付 = 日本日付 で単純結合 (米国 D 日の終値は東証 D 日の大引け後に確定)」した版を
            「リーク版(実行不可能)」として表示し、リークでどれだけ成績が水増しされるかを見せる. 取引可能な結果ではない.
"""
from __future__ import annotations

import math
import sys
import time
import warnings
from dataclasses import dataclass
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from scipy import stats

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))  # `python3 studies/xxx.py` で jpus を読めるように

from jpus.align import assert_no_lookahead, last_us_index_before, us_signal_for_jp
from jpus.costs import TSECost, calendar_hold_days
from jpus.data import daily_csv_path, fetch_daily, fetch_intraday, load_daily, load_intraday
from jpus.metrics import JP_DAYS, block_bootstrap_pvalue, deflated_sharpe_ratio, newey_west_tstat
from jpus.plot import plot_pnl  # japanize_matplotlib を読み込む (日本語フォント)
from jpus.universe import ADR_MAP, JP_ALL, JP_ETF, JP_NAMES, LEAD_LAG_PAIRS

warnings.filterwarnings("ignore", message=".*Sorting by default.*")
warnings.filterwarnings("ignore", category=RuntimeWarning)
pd.set_option("display.unicode.east_asian_width", True)
pd.set_option("display.width", 250)
pd.set_option("display.max_columns", 40)
pd.set_option("display.max_rows", 300)

# ------------------------------------------------------------------------------------------
# 設定
# ------------------------------------------------------------------------------------------
IS_END = pd.Timestamp("2018-12-31")
OOS_START = pd.Timestamp("2019-01-01")
SLIP = 5.0                       # 既定 片道 bp
SENS = [0.0, 2.0, 5.0, 10.0]     # 感応度 (片道 bp)
EXTRA_SLIP = 10.0                # 寄付価格依存ルールの頑健性 (+10bp)
WIN = 250                        # ローリング回帰の窓 (営業日, D を含まない)
MIN_OBS = 150                    # 回帰に必要な最低観測数
MIN_XS = 40                      # クロスセクションに必要な最低銘柄数
K_GRID = [3, 5, 10, 20]
GAP_CLIP = 0.10                  # 回帰推定時のみ gap を ±10% でクリップ (外れ値対策, 事前固定)
ADR_WIN = 60                     # ADR 比率の中央値の窓 (観測数)
ADR_BREAK = 0.30                 # 比率の構造変化検知 (対数差)
IG_SANITY = 0.15                 # |implied_gap| > 15% はデータ異常として取引しない (事前に分かる)
DELISTED = {"6502.T"}            # 東芝 (2023 上場廃止, データなし) → 生存者バイアスの一例
OPEN_OK_FROM = pd.Timestamp("2009-07-01")  # Yahoo の東証「始値」は 2009Q2 以前 40〜68% の日で前日終値と同値 (欠損埋め) → 使わない
ERR_STOCK, ERR_ETF = 0.40, 0.15  # |gap| や |日中| がこれを超える日はデータ異常 (未調整の分割等) とみなす (事前固定)
HOLD1 = float(calendar_hold_days(pd.Series([pd.Timestamp("2020-01-06")]),
                                 pd.Series([pd.Timestamp("2020-01-06")]))[0])  # 日計り = 1 日
T0 = time.time()


def rt(side: int, bps: float) -> float:
    """TSECost の往復コスト (片道 bps). side=+1 現物買い, -1 信用売り (貸株料 1 日分込み)."""
    return float(TSECost().with_slippage(bps).round_trip(side, HOLD1))


def is_mask(idx):
    return np.asarray(idx <= IS_END)


def oos_mask(idx):
    return np.asarray(idx >= OOS_START)


def hdr(title: str):
    print("\n" + "=" * 100)
    print(title)
    print("=" * 100)


# ------------------------------------------------------------------------------------------
# 戦略コンテナと成績
# ------------------------------------------------------------------------------------------
@dataclass
class Strat:
    """日次のグロス損益と建玉量 (往復回数) を持つ. コストは片道 bp を後から変えられる."""
    name: str
    gross: pd.Series      # 日次グロスリターン
    long_n: pd.Series     # 当日の買い (現物) ノーショナル
    short_n: pd.Series    # 当日の売り (制度信用) ノーショナル
    family: str = ""
    uses_open: bool = False

    def cost(self, bps: float) -> pd.Series:
        return self.long_n * rt(+1, bps) + self.short_n * rt(-1, bps)

    def net(self, bps: float = SLIP) -> pd.Series:
        return self.gross - self.cost(bps)

    @property
    def active(self) -> pd.Series:
        return (self.long_n + self.short_n) > 0


def stats_block(s: Strat, mask, bps: float = SLIP) -> dict:
    g = s.gross[mask]
    L, S = s.long_n[mask], s.short_n[mask]
    act = (L + S) > 0
    net = s.net(bps)[mask]
    n_act = int(act.sum())
    if n_act == 0:
        return {"取引日数": 0}
    sd = net.std(ddof=1)
    sr = net.mean() / sd * math.sqrt(JP_DAYS) if sd > 0 else np.nan
    units = (L + S).sum()
    fin = (L * rt(+1, 0) + S * rt(-1, 0)).sum()
    dense = act.mean() > 0.5
    pb = block_bootstrap_pvalue(net[act] if not dense else net, block=5 if dense else 1, n_boot=1000)
    out = {
        "取引日数": n_act,
        "年率%": 100 * net.mean() * JP_DAYS,
        "Sharpe": sr,
        "グロスbp/日": 1e4 * g[act].mean(),
        "純bp/日": 1e4 * net[act].mean(),
        "t値(NW)": newey_west_tstat(net),
        "p(boot)": pb,
        "損益分岐(往復bp)": 1e4 * g.sum() / units,
        "損益分岐(片道bp)": 1e4 * (g.sum() - fin) / (2 * units),
    }
    for b in SENS:
        out[f"純bp@{int(b)}"] = 1e4 * s.net(b)[mask][act].mean()
    return out


def strat_table(strats: list[Strat], bps: float = SLIP) -> pd.DataFrame:
    rows = []
    for s in strats:
        idx = s.gross.index
        for lab, m in [("IS", is_mask(idx)), ("OOS", oos_mask(idx))]:
            rows.append({"戦略": s.name, "区間": lab, **stats_block(s, m, bps)})
    return pd.DataFrame(rows)


def daily_sr(x: pd.Series) -> float:
    sd = x.std(ddof=1)
    return float(x.mean() / sd) if sd > 0 else np.nan


def select_on_is(variants: list[Strat], label: str) -> tuple[Strat, pd.DataFrame, dict]:
    """IS の純損益 (片道 5bp) の Sharpe 最大を選ぶ. 全バリアントの IS/OOS を返す."""
    rows = []
    for v in variants:
        net = v.net(SLIP)
        i, o = is_mask(net.index), oos_mask(net.index)
        rows.append({"バリアント": v.name,
                     "IS_Sharpe": daily_sr(net[i]) * math.sqrt(JP_DAYS),
                     "IS_グロスbp/日": 1e4 * v.gross[i][v.active[i]].mean(),
                     "IS_純bp/日": 1e4 * net[i][v.active[i]].mean(),
                     "IS_日数": int(v.active[i].sum()),
                     "OOS_Sharpe": daily_sr(net[o]) * math.sqrt(JP_DAYS),
                     "OOS_グロスbp/日": 1e4 * v.gross[o][v.active[o]].mean(),
                     "OOS_純bp/日": 1e4 * net[o][v.active[o]].mean(),
                     "OOS_日数": int(v.active[o].sum())})
    tab = pd.DataFrame(rows)
    best_i = int(tab["IS_Sharpe"].fillna(-np.inf).values.argmax())
    best = variants[best_i]
    tab["選択"] = ["★" if j == best_i else "" for j in range(len(tab))]
    # Deflated Sharpe (IS: 最良を選んだ標本そのもの / OOS: 凍結後. 試行数 = バリアント数)
    is_srs = np.array([daily_sr(v.net(SLIP)[is_mask(v.gross.index)]) for v in variants], dtype=float)
    sr_std = float(np.nanstd(is_srs, ddof=1)) if len(variants) > 1 else 0.0
    info = {"n_trials": len(variants), "sr_std": sr_std}
    for lab, mfun in [("IS", is_mask), ("OOS", oos_mask)]:
        x = best.net(SLIP)[mfun(best.gross.index)]
        x = x.dropna()
        sr = daily_sr(x)
        sk = float(stats.skew(x)) if len(x) > 10 else 0.0
        ku = float(stats.kurtosis(x, fisher=False)) if len(x) > 10 else 3.0
        info[f"DSR_{lab}"] = deflated_sharpe_ratio(sr, len(x), len(variants), sr_std, sk, ku) if np.isfinite(sr) else np.nan
    print(f"\n[{label}] 試したバリアント数 = {len(variants)} (IS の Sharpe 最大を ★ で凍結. 純 = 片道{SLIP:.0f}bp 控除後."
          " OOS 列は参考表示で選択には使っていない)")
    print(tab.round(3).to_string(index=False))
    print(f"  → 凍結: {best.name}   Deflated Sharpe: IS={info['DSR_IS']:.3f}  OOS={info['DSR_OOS']:.3f}"
          f"  (試行数 {len(variants)}, IS Sharpe の標準偏差 {sr_std * math.sqrt(JP_DAYS):.2f}/年率)")
    if tab["IS_Sharpe"].iloc[best_i] <= 0:
        print("  ※ IS で純損益がプラスのバリアントが 1 つもない → 本来の結論は「取引しない」. 形式上 IS 最良を凍結して OOS を表示.")
    return best, tab, info


def walk_forward(variants: list[Strat], label: str, info: dict) -> tuple[Strat, dict]:
    """拡大窓ウォークフォワード: OOS の各年 Y は「Y-1 年末までの全データ」で純 Sharpe 最大のバリアントを使う (毎年再選択)."""
    idx = variants[0].gross.index
    g = pd.Series(0.0, index=idx)
    L = pd.Series(0.0, index=idx)
    S = pd.Series(0.0, index=idx)
    picks = []
    for y in sorted(set(idx.year[idx >= OOS_START])):
        train = idx < pd.Timestamp(f"{y}-01-01")
        srs = np.array([daily_sr(v.net(SLIP)[train]) for v in variants], dtype=float)
        j = int(np.nanargmax(srs))
        m = idx.year == y
        g[m], L[m], S[m] = variants[j].gross[m], variants[j].long_n[m], variants[j].short_n[m]
        picks.append(f"{y}:{variants[j].name.split(' ', 1)[-1]}")
    st = Strat(f"WF[{label}] 年次再選択", g, L, S, "WF", variants[0].uses_open)
    x = st.net(SLIP)[oos_mask(idx)]
    sk = float(stats.skew(x)) if len(x) > 10 else 0.0
    ku = float(stats.kurtosis(x, fisher=False)) if len(x) > 10 else 3.0
    sr = daily_sr(x)
    wi = {"n_trials": info["n_trials"], "sr_std": info["sr_std"], "DSR_IS": np.nan,
          "DSR_OOS": deflated_sharpe_ratio(sr, len(x), info["n_trials"], info["sr_std"], sk, ku) if np.isfinite(sr) else np.nan}
    print(f"  ウォークフォワード[{label}] の年ごとの選択: " + " | ".join(picks))
    return st, wi


def print_strat_table(strats: list[Strat], title: str):
    t = strat_table(strats)
    cols = ["戦略", "区間", "取引日数", "年率%", "Sharpe", "グロスbp/日", "純bp/日", "t値(NW)", "p(boot)",
            "損益分岐(往復bp)", "損益分岐(片道bp)"] + [f"純bp@{int(b)}" for b in SENS]
    t = t[[c for c in cols if c in t.columns]]
    print(f"\n--- {title} (コスト既定 片道{SLIP:.0f}bp. 純bp@x = 片道 x bp のときの純 bp/日) ---")
    print(t.round(2).to_string(index=False))
    return t


def plot_panels(panels, oos=OOS_START, height=4.6):
    """複数パネルの累積損益 (jpus.plot.plot_pnl を各パネルに使い、最後に plt.show())."""
    fig, axes = plt.subplots(len(panels), 1, figsize=(12, height * len(panels)), sharex=True)
    axes = np.atleast_1d(axes)
    for ax, (curves, title) in zip(axes, panels):
        plot_pnl(curves, title, oos, ax=ax, show=False)
        ax.legend(loc="lower left", fontsize=8)
    plt.tight_layout()
    plt.show()


def bootstrap_diff_pvalue(a, b, n_boot=2000, seed=0) -> float:
    """2 群の平均差 (a - b) = 0 の両側ブートストラップ p 値 (群ごとに中心化して再標本化)."""
    a = np.asarray(a, float)
    b = np.asarray(b, float)
    a, b = a[np.isfinite(a)], b[np.isfinite(b)]
    if len(a) < 5 or len(b) < 5:
        return np.nan
    rng = np.random.default_rng(seed)
    obs = a.mean() - b.mean()
    ac, bc = a - a.mean(), b - b.mean()
    d = np.empty(n_boot)
    for i in range(0, n_boot, 250):
        m = min(250, n_boot - i)
        ia = rng.integers(0, len(a), (m, len(a)), dtype=np.int32)
        ib = rng.integers(0, len(b), (m, len(b)), dtype=np.int32)
        d[i:i + m] = ac[ia].mean(1) - bc[ib].mean(1)
    return float((np.abs(d) >= abs(obs)).mean())


def slope(x, y):
    m = np.isfinite(x) & np.isfinite(y)
    if m.sum() < 5 or np.var(x[m]) == 0:
        return np.nan
    return float(np.cov(x[m], y[m])[0, 1] / np.var(x[m], ddof=1))


def bootstrap_slope_diff_pvalue(x1, y1, x0, y0, n_boot=1000, seed=0) -> float:
    """傾き(群1) - 傾き(群0) = 0 の両側ブートストラップ p 値 (各群で (x,y) ペアを再標本化し差を中心化)."""
    rng = np.random.default_rng(seed)
    m1 = np.isfinite(x1) & np.isfinite(y1)
    m0 = np.isfinite(x0) & np.isfinite(y0)
    x1, y1, x0, y0 = x1[m1], y1[m1], x0[m0], y0[m0]
    if len(x1) < 10 or len(x0) < 10:
        return np.nan
    obs = slope(x1, y1) - slope(x0, y0)
    d = np.empty(n_boot)
    for i in range(n_boot):
        a = rng.integers(0, len(x1), len(x1))
        b = rng.integers(0, len(x0), len(x0))
        d[i] = slope(x1[a], y1[a]) - slope(x0[b], y0[b])
    d = d - np.nanmean(d)
    return float((np.abs(d) >= abs(obs)).mean())


# ------------------------------------------------------------------------------------------
# データ
# ------------------------------------------------------------------------------------------
def build_calendar() -> pd.DatetimeIndex:
    """東証の営業日 = 大型株と TOPIX ETF の取引日の和集合 (1321.T は 2009 年に寄付欠損が多いので使わない)."""
    idx = None
    for t in ["7203.T", "8306.T", "6758.T", "9984.T", "6501.T", "1306.T"]:
        i = load_daily(t).index
        idx = i if idx is None else idx.union(i)
    return idx[idx >= "2008-01-01"]


def load_jp(ticker: str, cal=None, adjust=True) -> pd.DataFrame:
    """東証日足. 2009-07 より前の「始値」は欠損扱い (データ品質チェック参照)."""
    df = load_daily(ticker, adjust=adjust).copy()
    df.loc[df.index < OPEN_OK_FROM, "Open"] = np.nan
    return df if cal is None else df.reindex(cal)


def load_jp_panel(tickers, cal, adjust=True):
    O, C = {}, {}
    for t in tickers:
        try:
            df = load_jp(t, adjust=adjust)
        except Exception as e:  # noqa: BLE001
            print(f"  [skip] {t}: {e}")
            continue
        O[t], C[t] = df["Open"], df["Close"]
    O = pd.DataFrame(O).reindex(cal)
    C = pd.DataFrame(C).reindex(cal)
    return O, C


def gap_intra(O, C, etf=False):
    """gap = 寄付/前営業日大引け - 1, 日中 = 大引け/寄付 - 1. データ異常 (|値| > 閾値) は NaN."""
    thr = ERR_ETF if etf else ERR_STOCK
    gap = O / C.shift(1) - 1
    intra = C / O - 1
    return gap.where(gap.abs() <= thr), intra.where(intra.abs() <= thr)


def data_quality_check(tickers):
    hdr("データ品質チェック (Yahoo 日足の東証「始値」)")
    res = {}
    for t in tickers:
        try:
            d = load_daily(t, adjust=False)
        except Exception:  # noqa: BLE001
            continue
        res[t] = (d["Open"] == d["Close"].shift(1)).groupby(d.index.to_period("Q")).mean()
    r = pd.DataFrame(res).median(axis=1)
    q = r.loc[:"2010Q2"]
    print("始値 == 前営業日終値 となる日の割合 (ユニバース中央値, 四半期):")
    print("  " + "  ".join(f"{k}:{v:.0%}" for k, v in q.items()))
    later = r.loc["2010Q3":]
    print(f"  2010Q3 以降の平均: {later.mean():.1%} (呼値の粗さで自然に起こる水準)")
    print(f"  → 2009Q2 以前は欠損を前日終値で埋めたとみられる. 始値を使う計算 (gap/日中) は {OPEN_OK_FROM.date()} 以降のみ.")
    print("    (この補正をしないと 2008-09 年の『日中リターン』が実は前日比になり、米国→日本の順張りが IS で大きく水増しされる)")
    print(f"  データ異常フィルタ: |gap| または |日中| が 個別株 {ERR_STOCK:.0%} / 指数ETF {ERR_ETF:.0%} 超の日は除外"
          " (例: 1306.T 2015-01-05 の -90% 等の未調整分割)")


def us_level_diff_for_jp(level: pd.Series, cal: pd.DatetimeIndex) -> pd.Series:
    """us_signal_for_jp と同じ日付規則 (米国日付 < D) で「水準の差分」を返す (^TNX 用)."""
    s = level.dropna().sort_index()
    s = s[~s.index.duplicated(keep="last")]
    pos = last_us_index_before(s.index, cal)
    lv = np.where(pos >= 0, s.values[np.maximum(pos, 0)], np.nan)
    out = lv - np.r_[np.nan, lv[:-1]]
    return pd.Series(out, index=cal)


def us_logret_same_date_LEAKY(close: pd.Series, cal: pd.DatetimeIndex) -> pd.Series:
    """リーク版(実行不可能): 米国日付 <= D (同じ日付で結合). 米国 D 日の終値は東証 D 日の大引けの後に確定する."""
    s = close.dropna().sort_index()
    s = s[~s.index.duplicated(keep="last")]
    pos = np.searchsorted(s.index.values, cal.values, side="right") - 1
    lv = np.where(pos >= 0, np.log(s.values[np.maximum(pos, 0)]), np.nan)
    return pd.Series(lv - np.r_[np.nan, lv[:-1]], index=cal)


def raw_adj_factor(ticker: str) -> pd.Series:
    """Yahoo の Adj Close / Close (配当調整係数). 権利落ち日の検出に使う."""
    df = pd.read_csv(daily_csv_path(ticker), index_col=0, parse_dates=True)
    df = df.dropna(subset=["Open", "Close"])
    df = df[(df["Open"] > 0) & (df["Close"] > 0)]
    if ticker.endswith(".T"):
        df = df[df["Volume"] > 0]
    return (df["Adj Close"] / df["Close"]).astype(float)


def ex_dates(ticker: str) -> pd.DatetimeIndex:
    f = raw_adj_factor(ticker)
    r = f / f.shift(1) - 1
    return f.index[(r > 1e-4).values]


# ------------------------------------------------------------------------------------------
# (A) ローリング回帰
# ------------------------------------------------------------------------------------------
def rolling_ols(y: np.ndarray, X: np.ndarray, win: int = WIN, min_obs: int = MIN_OBS):
    """各 t について 行 [t-win, t) (t を含まない) で OLS → (beta_t, 残差σ_t, 観測数). リークなし."""
    T, p = X.shape
    m = np.isfinite(y) & np.isfinite(X).all(1)
    Xm = np.where(m[:, None], X, 0.0)
    ym = np.where(m, y, 0.0)

    def wsum(a):
        cs = np.concatenate([np.zeros((1,) + a.shape[1:]), np.cumsum(a, axis=0)], axis=0)
        t = np.arange(T)
        lo = np.maximum(t - win, 0)
        return cs[t] - cs[lo]  # rows lo..t-1

    n = wsum(m.astype(float))
    XX = wsum(np.einsum("ti,tj->tij", Xm, Xm))
    Xy = wsum(Xm * ym[:, None])
    yy = wsum(ym * ym)
    ok = n >= min_obs
    A = np.where(ok[:, None, None], XX, np.eye(p)[None]) + 1e-10 * np.eye(p)[None]
    b = np.linalg.solve(A, np.where(ok[:, None], Xy, 0.0)[..., None])[..., 0]
    ssr = yy - 2 * (b * Xy).sum(1) + np.einsum("ti,tij,tj->t", b, XX, b)
    s = np.sqrt(np.maximum(ssr, 1e-12) / np.maximum(n - p, 1))
    b[~ok] = np.nan
    s[~ok] = np.nan
    return b, s, n


def xs_portfolio(z, sel_valid, ret, k, mode="LS", hedge=None, min_n=MIN_XS):
    """毎日 z の小さい k 銘柄を買い (bottom), 大きい k 銘柄を売り (top).
    mode='LS': 売りは top-k 個別株 / 'LH': 売りはヘッジ ETF (買いと同額).
    ret が NaN の銘柄 (その日に寄らなかった) は約定しなかったとみなし損益 0・コスト 0."""
    T, N = z.shape
    nval = sel_valid.sum(1)
    ok = nval >= max(min_n, 2 * k)
    asc = np.argsort(np.where(sel_valid, z, np.inf), axis=1, kind="stable")[:, :k]
    desc = np.argsort(np.where(sel_valid, -z, np.inf), axis=1, kind="stable")[:, :k]
    rows = np.arange(T)[:, None]
    rl, rs = ret[rows, asc], ret[rows, desc]
    fl, fs = np.isfinite(rl), np.isfinite(rs)
    long_n = fl.sum(1) / k
    gl = np.where(fl, rl, 0.0).sum(1) / k
    if mode == "LS":
        short_n = fs.sum(1) / k
        gross = gl - np.where(fs, rs, 0.0).sum(1) / k
    else:
        hf = np.isfinite(hedge)
        short_n = long_n * hf
        gross = gl - long_n * np.where(hf, hedge, 0.0)
    gross = np.where(ok, gross, 0.0)
    long_n = np.where(ok, long_n, 0.0)
    short_n = np.where(ok, short_n, 0.0)
    return gross, long_n, short_n, asc, desc, ok


def hedge_intraday(cal) -> np.ndarray:
    """ヘッジ用 1321.T の 寄付→大引け. 1321.T の寄付欠損日 (2009-10 年に多い) は 1306.T で代替."""
    h = load_jp("1321.T", cal)
    h2 = load_jp("1306.T", cal)
    _, a = gap_intra(h["Open"], h["Close"], etf=True)
    _, b = gap_intra(h2["Open"], h2["Close"], etf=True)
    return a.fillna(b).values


def make_strat(name, cal, gross, long_n, short_n, family, uses_open):
    return Strat(name, pd.Series(gross, index=cal), pd.Series(long_n, index=cal),
                 pd.Series(short_n, index=cal), family, uses_open)


def xs_corr(sig: np.ndarray, ret: np.ndarray, valid: np.ndarray, min_n=MIN_XS) -> np.ndarray:
    """日ごとのクロスセクション相関 (Fama-MacBeth 型)."""
    v = valid & np.isfinite(sig) & np.isfinite(ret)
    s = np.where(v, sig, np.nan)
    r = np.where(v, ret, np.nan)
    s = s - np.nanmean(s, axis=1, keepdims=True)
    r = r - np.nanmean(r, axis=1, keepdims=True)
    num = np.nansum(s * r, axis=1)
    den = np.sqrt(np.nansum(s * s, axis=1) * np.nansum(r * r, axis=1))
    c = num / den
    c[v.sum(1) < min_n] = np.nan
    return c


def part_a(cal, results):
    hdr("(A) 米国要因で説明できない寄付ギャップ (残差) の過剰反応 — クロスセクション")
    eq = [t for t in JP_ALL if t not in JP_ETF and t not in DELISTED]
    print(f"ユニバース: JP 個別株 {len(eq)} 銘柄 (ETF 除外, 上場廃止の {sorted(DELISTED)} はデータなしで除外 → 生存者バイアスあり)")
    O, C = load_jp_panel(eq, cal)
    keep = [t for t in O.columns if O[t].notna().sum() >= 300]
    O, C = O[keep], C[keep]
    tick = list(O.columns)
    gdf, idf = gap_intra(O, C)
    gap, intra = gdf.values, idf.values
    prev_ok = C.shift(1).notna().values  # 前日に取引があった (寄付前に既知)
    print(f"  有効銘柄 {len(tick)} / 東証営業日 {len(cal)} ({cal[0].date()}〜{cal[-1].date()})")

    # ---- 寄付前ファクター (米国日付 < D) ----
    fac_src = {"SP500": "^GSPC", "SOX": "^SOX", "WTI": "CL=F", "USDJPY(JPY=X)": "JPY=X", "USDJPY(FXY)": "FXY"}
    closes = {k: load_daily(v)["Close"] for k, v in fac_src.items()}
    tnx = load_daily("^TNX")["Close"]
    F = pd.DataFrame(index=cal)
    for k, c in closes.items():
        F[k] = us_signal_for_jp(c, cal)["us_logret"]
    F["USDJPY(FXY)"] = -F["USDJPY(FXY)"]  # FXY は円の価値 → 符号反転で USD/JPY 上昇 = +
    F["WTI"] = F["WTI"].clip(-0.3, 0.3)   # 2020/4 のマイナス価格前後の異常値対策 (事前固定)
    F["US10Y(差分)"] = us_level_diff_for_jp(tnx, cal)
    F = F[["SP500", "SOX", "US10Y(差分)", "USDJPY(JPY=X)", "USDJPY(FXY)", "WTI"]]
    # リーク検査 (jpus.align の検査関数)
    for k in ["SP500", "SOX", "USDJPY(FXY)", "WTI"]:
        assert_no_lookahead(closes[k], cal, n_checks=30)
    print("  リーク検査 (米国データを D 以降で書き換えても D のファクターが不変): OK")
    # リーク版: 同じ日付で結合
    FL = pd.DataFrame(index=cal)
    for k, c in closes.items():
        FL[k] = us_logret_same_date_LEAKY(c, cal)
    FL["USDJPY(FXY)"] = -FL["USDJPY(FXY)"]
    FL["WTI"] = FL["WTI"].clip(-0.3, 0.3)
    tl = tnx.dropna().sort_index()
    p_ = np.searchsorted(tl.index.values, cal.values, side="right") - 1
    lv = np.where(p_ >= 0, tl.values[np.maximum(p_, 0)], np.nan)
    FL["US10Y(差分)"] = lv - np.r_[np.nan, lv[:-1]]
    FL = FL[F.columns]

    X = np.column_stack([np.ones(len(cal)), F.values])
    XL = np.column_stack([np.ones(len(cal)), FL.values])
    T, N = gap.shape
    ghat = np.full((T, N), np.nan)
    ghat_leak = np.full((T, N), np.nan)
    sres = np.full((T, N), np.nan)
    betas_last = {}
    for j in range(N):
        y = np.clip(gap[:, j], -GAP_CLIP, GAP_CLIP)
        b, s, n = rolling_ols(y, X)
        ghat[:, j] = (X * b).sum(1)
        ghat_leak[:, j] = (XL * b).sum(1)
        sres[:, j] = s
        betas_last[tick[j]] = b[-1]
    # 回帰のリーク検査: 1 銘柄で D 以降の gap を書き換えても ĝ(D) は不変
    j0 = tick.index("7203.T")
    y0 = np.clip(gap[:, j0], -GAP_CLIP, GAP_CLIP)
    b0, _, _ = rolling_ols(y0, X)
    tD = len(cal) // 2
    y1 = y0.copy()
    y1[tD:] = np.random.default_rng(0).normal(0, 0.05, T - tD)
    b1, _, _ = rolling_ols(y1, X)
    assert np.allclose(b0[:tD + 1], b1[:tD + 1], equal_nan=True), "rolling OLS lookahead!"
    print("  リーク検査 (ローリング回帰: D 以降の gap を乱数に置換しても D までの係数が不変): OK")

    resid = gap - ghat
    zstd = resid / sres
    bt = pd.DataFrame(betas_last, index=["定数"] + list(F.columns)).T
    print("\n  直近の回帰係数 (例: 代表銘柄. 過去250営業日):")
    show = [t for t in ["7203.T", "8035.T", "8306.T", "9983.T", "4502.T", "1605.T"] if t in bt.index]
    bt2 = bt.loc[show].copy()
    bt2.index = [f"{t} {JP_NAMES.get(t, '')}" for t in show]
    print(bt2.round(3).to_string())

    # 当てはまり (アウトオブサンプル予測としての R², ĝ は常に過去の係数)
    res_rows = []
    for lab, m in [("IS", is_mask(cal)), ("OOS", oos_mask(cal))]:
        g, gh = gap[m], ghat[m]
        v = np.isfinite(g) & np.isfinite(gh)
        r2 = 1 - np.nansum((g[v] - gh[v]) ** 2) / np.nansum((g[v] - np.nanmean(g[v])) ** 2)
        res_rows.append({"区間": lab, "観測数": int(v.sum()), "ĝ→gap 予測R²(事前予測)": r2,
                         "gap の標準偏差(bp)": 1e4 * np.nanstd(g[v]), "残差の標準偏差(bp)": 1e4 * np.nanstd(g[v] - gh[v])})
    print("\n  米国ファクターによる寄付ギャップの事前予測力:")
    print(pd.DataFrame(res_rows).round(3).to_string(index=False))

    # ---- Fama-MacBeth: 寄付→大引け とのクロスセクション相関 ----
    valid_open = np.isfinite(gap) & np.isfinite(ghat)
    valid_pre = np.isfinite(ghat) & prev_ok
    fm = {"生ギャップ [寄付価格を使用]": xs_corr(gap, intra, valid_open),
          "残差 e [寄付価格を使用]": xs_corr(resid, intra, valid_open),
          "標準化残差 e/σ [寄付価格を使用]": xs_corr(zstd, intra, valid_open & np.isfinite(zstd)),
          "予測ギャップ ĝ (事前)": xs_corr(ghat, intra, valid_pre),
          "参考: gap と ĝ (織り込み度)": xs_corr(ghat, gap, valid_open)}
    rows = []
    for k, c in fm.items():
        for lab, m in [("IS", is_mask(cal)), ("OOS", oos_mask(cal))]:
            x = pd.Series(c[m]).dropna()
            rows.append({"シグナル": k, "区間": lab, "日数": len(x), "平均相関×100": 100 * x.mean(),
                         "t値(NW)": newey_west_tstat(x)})
    print("\n  日次クロスセクション相関 (シグナル vs 寄付→大引け. 負 = 逆張りが効く = 寄付で行き過ぎ):")
    print(pd.DataFrame(rows).round(2).to_string(index=False))

    # ---- 戦略 ----
    h_intra = hedge_intraday(cal)

    resid_vars, sel_store = [], {}
    for mode in ["LS", "LH"]:
        for stdz in [False, True]:
            for k in K_GRID:
                z = zstd if stdz else resid
                sv = valid_open & np.isfinite(z)
                g, L, S, asc, desc, ok = xs_portfolio(z, sv, intra, k, mode, h_intra)
                nm = f"残差逆張り[寄付] {'L/S' if mode == 'LS' else '買い+1321売り'} {'標準化' if stdz else '生'} k={k}"
                st = make_strat(nm, cal, g, L, S, "A_resid", True)
                resid_vars.append(st)
                sel_store[nm] = (asc, desc, ok, mode, k, z, sv)
    bestA1, tabA1, infoA1 = select_on_is(resid_vars, "A1: 残差逆張り [寄付価格を使用]")
    results["WF_A1"] = (*walk_forward(resid_vars, "A1", infoA1), None)

    pre_vars = []
    for direction in ["逆張り", "順張り"]:
        for k in K_GRID:
            z = ghat if direction == "逆張り" else -ghat
            g, L, S, *_ = xs_portfolio(z, valid_pre, intra, k, "LS")
            pre_vars.append(make_strat(f"ĝ{direction}(事前) L/S k={k}", cal, g, L, S, "A_pre", False))
    bestA2, tabA2, infoA2 = select_on_is(pre_vars, "A2: 予測ギャップ ĝ のみ (寄付価格を使わない)")
    results["WF_A2"] = (*walk_forward(pre_vars, "A2", infoA2), None)

    # ---- A3: 指数 ETF (1321.T) の時系列. 市場全体として米国情報に過剰/過小反応するか ----
    e1321 = load_jp("1321.T", cal)
    g1321, i1321 = gap_intra(e1321["Open"], e1321["Close"], etf=True)
    b_, _, _ = rolling_ols(np.clip(g1321.values, -GAP_CLIP, GAP_CLIP), X)
    gh1321 = (X * b_).sum(1)
    gh1321_leak = (XL * b_).sum(1)
    r1321 = i1321.values
    f1321 = np.isfinite(r1321)
    diag = []
    for lab, m in [("IS", is_mask(cal)), ("OOS", oos_mask(cal))]:
        v = m & np.isfinite(gh1321) & f1321 & np.isfinite(g1321.values)
        diag.append({"区間": lab, "日数": int(v.sum()), "gap~ĝ 傾き(織り込み)": slope(gh1321[v], g1321.values[v]),
                     "日中~ĝ 傾き(正=過小反応/負=過剰反応)": slope(gh1321[v], r1321[v]),
                     "相関(ĝ,日中)": np.corrcoef(gh1321[v], r1321[v])[0, 1]})
    print("\n  1321.T (日経225 ETF): 米国ファクターによる予測ギャップ ĝ と 寄付→大引け の関係 (時系列):")
    print(pd.DataFrame(diag).round(3).to_string(index=False))
    ts_vars = []
    for dn, sg in [("順張り", 1.0), ("逆張り", -1.0)]:
        for thr in [0.0, 0.005]:
            pos = np.where(np.abs(gh1321) > thr, sg * np.sign(gh1321), 0.0)
            pos = np.where(np.isfinite(gh1321) & f1321, pos, 0.0)
            ts_vars.append(make_strat(f"1321.T ĝ{dn}(事前) |ĝ|>{thr * 100:.1f}%", cal, pos * np.where(f1321, r1321, 0),
                                      (pos > 0).astype(float), (pos < 0).astype(float), "A_ts", False))
    bestA3, tabA3, infoA3 = select_on_is(ts_vars, "A3: 1321.T を 予測ギャップ ĝ の符号で日中売買 (寄付価格を使わない)")
    results["WF_A3"] = (*walk_forward(ts_vars, "A3", infoA3), None)
    posL = np.where(np.isfinite(gh1321_leak) & f1321, np.sign(gh1321_leak), 0.0)
    leakA_ts = make_strat("リーク版(実行不可能): 1321.T ĝ を同日付の米国終値で計算 順張り", cal,
                          posL * np.where(f1321, r1321, 0), (posL > 0).astype(float), (posL < 0).astype(float),
                          "leak", False)

    # 比較: 生ギャップ逆張り (同じ構成・k で. 残差化に価値があるか)
    asc, desc, ok, mode, k, z, sv = sel_store[bestA1.name]
    g, L, S, *_ = xs_portfolio(gap, valid_open, intra, k, mode, h_intra)
    raw_gap = make_strat(f"参考: 生ギャップ逆張り[寄付] ({'L/S' if mode == 'LS' else '買い+1321売り'} k={k})",
                         cal, g, L, S, "A_ref", True)
    # 頑健性 (1) +10bp
    a1_extra = Strat(bestA1.name + " +10bp", bestA1.gross, bestA1.long_n, bestA1.short_n, "A_resid", True)
    # リーク版
    g, L, S, *_ = xs_portfolio(-ghat_leak, valid_pre, intra, 5, "LS")
    leakA = make_strat("リーク版(実行不可能): ĝ を同日付の米国終値で計算 順張り k=5", cal, g, L, S, "leak", False)
    # ベンチマーク
    vi = np.isfinite(intra) & prev_ok
    ew = np.where(vi, intra, 0).sum(1) / np.maximum(vi.sum(1), 1)
    bench_ew = make_strat("ベンチ: 全銘柄 等金額 寄付買い→大引け売り", cal, ew, (vi.sum(1) > 0).astype(float),
                          np.zeros(T), "bench", False)
    hv = np.isfinite(h_intra)
    bench_1321 = make_strat("ベンチ: 1321.T 寄付買い→大引け売り(毎日)", cal, np.where(hv, h_intra, 0), hv.astype(float),
                            np.zeros(T), "bench", False)

    t = print_strat_table([bestA1, raw_gap, bestA2, bestA3, leakA, leakA_ts, bench_ew, bench_1321],
                          "A: 凍結ルールとベンチマーク")
    # +10bp は片道 15bp で別表示
    r10 = strat_table([a1_extra], bps=SLIP + EXTRA_SLIP)
    print(f"\n  頑健性(1) {bestA1.name} を 片道 {SLIP + EXTRA_SLIP:.0f}bp で:")
    print(r10[["戦略", "区間", "取引日数", "年率%", "Sharpe", "純bp/日", "t値(NW)"]].round(2).to_string(index=False))

    # ---- 頑健性 (2): 1 時間足で 10:00 約定 ----
    a1_10 = robustness_1h(cal, tick, O, C, sel_store[bestA1.name], hedge_ticker="1321.T")

    p1 = {f"{bestA1.name} 片道{b:.0f}bp" + (" (グロス)" if b == 0 else ""): bestA1.net(b) for b in [0, 2, 5]}
    p1[f"{bestA1.name} 片道{SLIP + EXTRA_SLIP:.0f}bp (+10bp 頑健性)"] = bestA1.net(SLIP + EXTRA_SLIP)
    p1[raw_gap.name + " 片道5bp"] = raw_gap.net(SLIP)
    p2 = {f"{bestA2.name} 純5bp": bestA2.net(SLIP), f"{bestA3.name} 純5bp": bestA3.net(SLIP),
          bench_ew.name + " 純5bp": bench_ew.net(SLIP), bench_1321.name + " 純5bp": bench_1321.net(SLIP)}
    plot_panels([(p1, "(A) [寄付価格を使用] 残差逆張り (IS で凍結) のコスト感応度: グロスはプラスだが片道5bpで消える"),
                 (p2, "(A) 寄付前の情報だけのルール (ĝ) とベンチマーク (純損益, 片道5bp)")])
    # シグナルの強さ (コストと無関係): 日次クロスセクション相関の累積. 逆張りシグナルは符号を反転 (上向き = 効いている)
    fig, ax = plt.subplots(figsize=(12, 5))
    for k_, sg_ in [("生ギャップ [寄付価格を使用]", -1), ("残差 e [寄付価格を使用]", -1),
                    ("標準化残差 e/σ [寄付価格を使用]", -1), ("予測ギャップ ĝ (事前)", 1)]:
        c = pd.Series(fm[k_] * sg_, index=cal).fillna(0)
        ax.plot(cal, c.cumsum(), lw=1.2, label=(f"{k_} 逆張り" if sg_ < 0 else f"{k_} 順張り"))
    ax.axvline(OOS_START, color="gray", ls="--", lw=1)
    ax.axvspan(OOS_START, cal[-1], color="gray", alpha=0.08, label="アウトオブサンプル")
    ax.axhline(0, color="black", lw=0.6)
    ax.set_title("(A) シグナルの強さ: 日次クロスセクション相関 (シグナル vs 寄付→大引け) の累積 — コスト控除前")
    ax.set_ylabel("相関の累積和")
    ax.grid(alpha=0.3)
    ax.legend(loc="upper left", fontsize=8)
    plt.tight_layout()
    plt.show()

    results["A1"] = (bestA1, infoA1, bench_ew)
    results["A2"] = (bestA2, infoA2, bench_ew)
    results["A3"] = (bestA3, infoA3, bench_1321)
    results["A_leak"] = leakA
    results["A_leak_ts"] = leakA_ts
    results["A_raw_gap"] = raw_gap
    results["A1_10h"] = a1_10
    results["A1_extra"] = a1_extra
    results["n_A"] = len(resid_vars) + len(pre_vars) + len(ts_vars)
    return t


def robustness_1h(cal, tick, O, C, sel, hedge_ticker="1321.T"):
    """凍結した残差ルールの銘柄選択はそのまま、約定を 9 時台 1 時間足の終値 (≒10:00) にしたら?"""
    asc, desc, ok, mode, k, z, sv = sel
    print(f"\n  頑健性(2): 1 時間足 (直近約730日) で 寄付約定 vs 10:00 約定 (9時台足の終値) を同じ日・同じ銘柄で比較")
    need = list(tick) + [hedge_ticker]
    fetch_intraday([t for t in need if t not in DELISTED], "1h")  # 既存 CSV があればスキップ
    Ou, Cu = load_jp_panel(list(tick) + [hedge_ticker], cal, adjust=False)
    P10 = pd.DataFrame(index=cal, columns=Ou.columns, dtype=float)
    H9O = pd.DataFrame(index=cal, columns=Ou.columns, dtype=float)
    for t in Ou.columns:
        try:
            h = load_intraday(t, "1h", fetch_if_missing=False)
        except Exception:  # noqa: BLE001
            continue
        h9 = h[h.index.hour == 9]
        d = pd.DatetimeIndex(h9.index.tz_localize(None).normalize())
        P10[t] = pd.Series(h9["Close"].values, index=d).groupby(level=0).last().reindex(cal)
        H9O[t] = pd.Series(h9["Open"].values, index=d).groupby(level=0).last().reindex(cal)
    # 分割調整の不一致 (1 時間足と日足) を除外
    ratio = H9O / Ou
    bad = (ratio < 0.8) | (ratio > 1.25)
    P10 = P10.mask(bad)
    r10 = (Cu / P10 - 1).where(lambda x: x.abs() <= ERR_STOCK).values
    ro = (Cu / Ou - 1).where(lambda x: x.abs() <= ERR_STOCK).values
    hed10 = r10[:, -1]
    hedo = ro[:, -1]
    r10, ro = r10[:, :-1], ro[:, :-1]
    days = np.isfinite(hed10) & ok
    T = len(cal)
    rows = np.arange(T)[:, None]
    out = {}
    for lab, R, H in [("寄付約定", ro, hedo), ("10:00約定", r10, hed10)]:
        both_l = np.isfinite(ro[rows, asc]) & np.isfinite(r10[rows, asc])
        both_s = np.isfinite(ro[rows, desc]) & np.isfinite(r10[rows, desc])
        rl = np.where(both_l, R[rows, asc], 0).sum(1) / k
        Ln = both_l.sum(1) / k
        if mode == "LS":
            rs = np.where(both_s, R[rows, desc], 0).sum(1) / k
            Sn = both_s.sum(1) / k
            g = rl - rs
        else:
            Sn = Ln.copy()
            g = rl - Ln * np.where(np.isfinite(H), H, 0)
        cov = (both_l.sum(1) / k >= 0.8) & ((both_s.sum(1) / k >= 0.8) if mode == "LS" else True)
        dd = days & cov  # 選ばれた銘柄の 8 割以上で 1 時間足がある日だけ (両方の約定方法で同じ日・同じ銘柄)
        g = np.where(dd, g, 0)
        Ln = np.where(dd, Ln, 0)
        Sn = np.where(dd, Sn, 0)
        out[lab] = make_strat(f"残差逆張り {lab} (1h重複期間)", cal, g, Ln, Sn, "A_rob", True)
    d0 = cal[out["寄付約定"].active.values]
    if len(d0) == 0:
        print("  1 時間足データがないため省略")
        return out
    sub = {k_: Strat(v.name, v.gross[d0[0]:], v.long_n[d0[0]:], v.short_n[d0[0]:]) for k_, v in out.items()}
    rows_ = []
    for k_, v in sub.items():
        m = np.ones(len(v.gross), bool)
        rows_.append({"約定": k_, "期間": f"{d0[0].date()}〜{d0[-1].date()}", **stats_block(v, m)})
    print(pd.DataFrame(rows_)[["約定", "期間", "取引日数", "年率%", "Sharpe", "グロスbp/日", "純bp/日", "t値(NW)",
                               "損益分岐(片道bp)"]].round(2).to_string(index=False))
    print("  ※ Yahoo の東証 1 時間足は 9 時台足の Open が公式の寄付値と一致しない日が多い (板寄せ約定を含まない模様).\n"
          "    そのため 10:00 約定は 9 時台足の Close を使い、決済は日足の公式大引け.")
    plot_pnl({f"{v.name} 純5bp": v.net(SLIP) for v in sub.values()},
             "(A) 頑健性: 寄付で約定 vs 10:00 に約定 (同じ銘柄選択, 1時間足の重複期間, 全期間OOS)", None)
    return sub


# ------------------------------------------------------------------------------------------
# (B) ADR 理論価格
# ------------------------------------------------------------------------------------------
ADR_NYSE = ["TM", "SONY", "MUFG", "SMFG", "MFG", "NMR", "HMC", "IX", "TAK"]
ADR_OTC = ["SFTBY", "NTDOY", "FANUY", "SHECY", "FUJIY", "HTHIY", "DNZOY"]  # OTC で 2012 年以前から履歴があり出来高ゼロ日 <1%


def robust_ratio(q: np.ndarray, dates: pd.DatetimeIndex, win=ADR_WIN, thr=ADR_BREAK):
    """各 i について q[<i] の直近 win 個の中央値 (i 自身は含まない).
    直近 3 観測がそれ以前の中央値から同方向に thr 超乖離したら「比率変更」とみなし、以後はそこからの観測のみ使う."""
    n = len(q)
    out = np.full(n, np.nan)
    start = 0
    breaks = []
    for i in range(n):
        lo = max(start, i - win)
        w = q[lo:i]
        w = w[np.isfinite(w)]
        if len(w) >= 8:
            base = np.median(w[:-3])
            last3 = w[-3:]
            dv = last3 - base
            if np.all(np.abs(dv) > thr) and (np.all(dv > 0) or np.all(dv < 0)):
                # 直近 3 観測の位置を探して start をそこへ
                idx_valid = np.where(np.isfinite(q[:i]))[0]
                start = int(idx_valid[-3])
                breaks.append((dates[start].date(), float(np.exp(np.median(last3) - base))))
                w = q[start:i]
                w = w[np.isfinite(w)]
        if len(w) >= 3:
            out[i] = np.median(w)
    return out, breaks


def adr_signals(adr, jp, cal, fxy, Cun_jp, leaky=False):
    """implied_gap(D) を返す. leaky=True は 米国日付 <= D (リーク版)."""
    a = load_daily(adr, adjust=False)
    a = a[a["Volume"] > 0]  # 約定のない日 (気配のみ) は使わない
    ac = a["Close"]
    f = fxy.reindex(ac.index)
    lv = np.log(ac / f)  # = log(ADR 円換算) + 定数
    jc = Cun_jp.dropna()
    pos = np.searchsorted(jc.index.values, ac.index.values, side="right") - 1
    same = (pos >= 0) & (jc.index.values[np.maximum(pos, 0)] == ac.index.values)  # 同じ暦日に東証も取引
    q = np.where(same, lv.values - np.log(jc.values[np.maximum(pos, 0)]), np.nan)
    ratio, breaks = robust_ratio(q, ac.index)
    implied = pd.Series(lv.values - ratio, index=ac.index)  # log implied JP price at US date d
    implied = implied[np.isfinite(implied.values)]
    if leaky:
        p = np.searchsorted(implied.index.values, cal.values, side="right") - 1
    else:
        p = last_us_index_before(implied.index, cal)
    imp_D = np.where(p >= 0, implied.values[np.maximum(p, 0)], np.nan)
    d_used = np.where(p >= 0, implied.index.values[np.maximum(p, 0)], np.datetime64("NaT"))
    prev_close = Cun_jp.reindex(cal).shift(1).values
    prev_date = np.r_[np.datetime64("NaT"), cal.values[:-1]]
    fresh = d_used >= prev_date  # ADR の引けが東証の前日大引けより後
    ig = np.exp(imp_D - np.log(prev_close)) - 1
    ig = np.where(fresh, ig, np.nan)
    ig = np.where(np.abs(ig) > IG_SANITY, np.nan, ig)
    return pd.Series(ig, index=cal), breaks


def part_b(cal, results):
    hdr("(B) ADR 理論価格 (ADR 終値 × USD/JPY ÷ 比率) から東証の寄付・日中を予測")
    fxy = load_daily("FXY", adjust=False)["Close"]
    assert_no_lookahead(fxy, cal, n_checks=20)
    pairs = [(a, ADR_MAP[a]) for a in ADR_NYSE + ADR_OTC]
    jp_t = sorted({j for _, j in pairs})
    Oa, Ca = load_jp_panel(jp_t, cal, adjust=True)
    Ou, Cu = load_jp_panel(jp_t, cal, adjust=False)
    gap_adj, intra = gap_intra(Oa, Ca)
    IG, IGL, brk = {}, {}, {}
    for a, j in pairs:
        IG[a], brk[a] = adr_signals(a, j, cal, fxy, Cu[j])
        IGL[a], _ = adr_signals(a, j, cal, fxy, Cu[j], leaky=True)
    IG = pd.DataFrame(IG)
    IGL = pd.DataFrame(IGL)
    GAP = pd.DataFrame({a: gap_adj[j] for a, j in pairs})
    INTRA = pd.DataFrame({a: intra[j] for a, j in pairs})

    # リーク検査: ADR/FXY/東証の D 以降を書き換えても implied_gap(D) が変わらない
    a0, j0 = "TM", "7203.T"
    D = cal[len(cal) // 2]
    ig0, _ = adr_signals(a0, j0, cal, fxy, Cu[j0])
    cu_p = Cu[j0].copy()
    cu_p[cu_p.index >= D] *= 1.3
    fx_p = fxy.copy()
    fx_p[fx_p.index >= D] *= 0.7
    ig1, _ = adr_signals(a0, j0, cal, fx_p, cu_p)
    assert np.allclose(ig0[:D].values, ig1[:D].values, equal_nan=True), "ADR lookahead!"
    print("リーク検査 (D 以降の東証終値・FXY を書き換えても D までの implied_gap が不変): OK")

    # 比率変更の検知結果
    print("\n比率 (ADR×USDJPY÷東証) の構造変化の自動検知 (ADR 比率変更・分割の扱い):")
    for a, b in brk.items():
        if b:
            print(f"  {a:6s} ({ADR_MAP[a]}): " + ", ".join(f"{d} ×{r:.2f}" for d, r in b))
    print("  (上記以外は Yahoo の分割調整済み Close 同士で比率が連続. 例: TM は 2021 年のトヨタ 5 分割で ADR 比率 1:2→1:10 に"
          "なったが、Yahoo は東証側を分割調整しているので比率 ≒10 で一定)")

    # 権利落ち日の診断 (東証の権利落ち日 E は配当基準日から事前に分かる暦. ここでは Yahoo の調整係数の変化から検出)
    rows, offrows = [], []
    exwin = pd.DataFrame(False, index=cal, columns=IG.columns)
    for a, j in pairs:
        exj = ex_dates(j)
        exj = exj[(exj >= cal[0])]
        exa = ex_dates(a)
        offs = []
        for e in exj:
            dd = (exa - e).days
            dd = dd[np.abs(dd) <= 10]
            if len(dd):
                offs.append(int(dd[np.argmin(np.abs(dd))]))
        pos = cal.searchsorted(exj)
        m = np.zeros(len(cal), bool)
        for p in pos:
            for q in (p, p + 1):  # 権利落ち日 E とその翌営業日 E+1 を除外
                if 0 <= q < len(cal):
                    m[q] = True
        exwin[a] = m
        dev = (IG[a] - GAP[a]).values
        unadj_gap = (Ou[j] / Cu[j].shift(1) - 1).values
        at = {}
        for off in range(-2, 5):
            pp = pos + off
            pp = pp[(pp >= 0) & (pp < len(cal))]
            at[off] = 1e4 * np.nanmean(dev[pp]) if len(pp) else np.nan
        offrows.append(at)
        e0 = pos[pos < len(cal)]
        rows.append({"ADR": a, "東証": j, "権利落ち回数": len(exj),
                     "ADR権利落ち-東証(暦日)中央値": np.median(offs) if offs else np.nan,
                     "乖離bp E(調整後gap)": at[0], "乖離bp E(未調整gap)": 1e4 * np.nanmean(IG[a].values[e0] - unadj_gap[e0]),
                     "乖離bp E+1": at[1],
                     "乖離bp 通常日": 1e4 * np.nanmean(dev[~m]), "|乖離|bp 通常日": 1e4 * np.nanmean(np.abs(dev[~m]))})
    print("\n権利落ち (3月・9月末など) 周辺の歪み診断 (乖離 = implied_gap - 実際の gap, E = 東証の権利落ち日):")
    print(pd.DataFrame(rows).round(1).to_string(index=False))
    om = pd.DataFrame(offrows).mean()
    print("  全ペア平均の乖離bp (E からの営業日オフセット別): " + ", ".join(f"E{k:+d}: {v:.0f}" for k, v in om.items()))
    print("  → 未調整 gap だと E に配当分『割安』に見え、調整後 gap でも E と E+1 に ADR 側の権利落ち日のズレによる歪みが残る."
          " ルールでは調整後 gap を使い、E と E+1 は取引しない (事前に分かる暦). E-2..E-1, E+2..E+4 はノイズの範囲.")
    IGx = IG.mask(exwin)
    DEV = (IGx - GAP)

    # (i) 健全性: implied_gap は実際の gap を当てるか / (ii) 寄付→大引け の予測
    rows = []
    for a, j in pairs:
        for lab, m in [("IS", is_mask(cal)), ("OOS", oos_mask(cal))]:
            x, g, r, dv = IGx[a].values[m], GAP[a].values[m], INTRA[a].values[m], DEV[a].values[m]
            v = np.isfinite(x) & np.isfinite(g)
            vr = v & np.isfinite(r)
            rows.append({"ADR": a, "区間": lab, "日数": int(v.sum()),
                         "相関(ig,gap)": np.corrcoef(x[v], g[v])[0, 1] if v.sum() > 20 else np.nan,
                         "傾き(gap~ig)": slope(x[v], g[v]),
                         "符号一致%": 100 * np.mean(np.sign(x[v]) == np.sign(g[v])) if v.sum() else np.nan,
                         "相関(ig-gap,日中)[寄付]": np.corrcoef(dv[vr], r[vr])[0, 1] if vr.sum() > 20 else np.nan,
                         "相関(ig,日中)[事前]": np.corrcoef(x[vr], r[vr])[0, 1] if vr.sum() > 20 else np.nan})
    print("\n(i)(ii) ペアごとの予測力 (ig = implied_gap. 相関×1):")
    print(pd.DataFrame(rows).round(3).to_string(index=False))

    # 日次クロスセクション相関 (市場全体の動きを除いた予測力)
    allc = ADR_NYSE + ADR_OTC
    vo = np.isfinite(DEV[allc].values) & np.isfinite(INTRA[allc].values)
    rows = []
    for nm_, sg_, vv in [("乖離 (ig-gap) [寄付価格を使用]", DEV, vo),
                         ("implied_gap (事前)", IGx, np.isfinite(IGx[allc].values))]:
        c = xs_corr(sg_[allc].values, INTRA[allc].values, vv, min_n=8)
        for lab, m in [("IS", is_mask(cal)), ("OOS", oos_mask(cal))]:
            x = pd.Series(c[m]).dropna()
            rows.append({"シグナル": nm_, "区間": lab, "日数": len(x), "平均相関×100": 100 * x.mean(),
                         "t値(NW)": newey_west_tstat(x)})
    print("\n16 ペアの日次クロスセクション相関 (シグナル vs 寄付→大引け, 市場要因を除いた比較):")
    print(pd.DataFrame(rows).round(2).to_string(index=False))

    # ---- ルール ----
    def per_stock_rule(sig, thr, mode, cols, sgn=1.0, hedge=None, name="", uses_open=True, fam="B"):
        s = sig[cols].values * sgn
        r = INTRA[cols].values
        pos = np.where(np.abs(s) > thr, np.sign(s), 0.0)
        if mode == "long":
            pos = np.where(pos > 0, pos, 0.0)
        pos = np.where(np.isfinite(s), pos, 0.0)
        filled = (pos != 0) & np.isfinite(r)
        n = filled.sum(1)
        w = np.where(filled, 1.0 / np.maximum(n, 1)[:, None], 0.0)
        g = (w * pos * np.where(filled, r, 0)).sum(1)
        L = (w * (pos > 0)).sum(1)
        S = (w * (pos < 0)).sum(1)
        if hedge is not None:  # 市場ヘッジ: 各ポジションと逆向きに 1321.T を同額
            net_dir = (w * pos).sum(1)
            hv = np.isfinite(hedge)
            g = g - net_dir * np.where(hv, hedge, 0)
            L = L + np.where(hv, np.clip(-net_dir, 0, None), 0)
            S = S + np.where(hv, np.clip(net_dir, 0, None), 0)
        return make_strat(name, cal, g, L, S, fam, uses_open)

    uni = {"NYSE9": ADR_NYSE, "NYSE9+OTC7": ADR_NYSE + ADR_OTC}
    open_vars = []
    for un, cols in uni.items():
        for mode in ["LS", "long"]:
            for thr in [0.0, 0.003, 0.006, 0.010]:
                nm = f"ADR乖離[寄付] {un} {'買い売り' if mode == 'LS' else '買いのみ'} |乖離|>{thr * 100:.1f}%"
                open_vars.append(per_stock_rule(DEV, thr, mode, cols, name=nm))
    # クロスセクション版 (市場中立): 乖離の大きい k 銘柄を買い・小さい k 銘柄を売り
    def xs_rule(sig, cols, k, sgn, name, uses_open):
        S_ = sig[cols].values * sgn
        R_ = INTRA[cols].values
        g, L, S, *_ = xs_portfolio(-S_, np.isfinite(S_), R_, k, "LS", min_n=max(2 * k, 4))
        return make_strat(name, cal, g, L, S, "B", uses_open)

    for un, cols in uni.items():
        for k in [1, 2, 3]:
            open_vars.append(xs_rule(DEV, cols, k, 1.0, f"ADR乖離[寄付] {un} 横断L/S k={k}", True))
    bestB1, tabB1, infoB1 = select_on_is(open_vars, "B1: ADR理論価格 - 実際の寄付 (乖離) [寄付価格を使用]")
    results["WF_B1"] = (*walk_forward(open_vars, "B1", infoB1), None)
    pre_vars = []
    for un, cols in uni.items():
        for sgn, dn in [(1.0, "順張り"), (-1.0, "逆張り")]:
            for thr in [0.0, 0.005, 0.010, 0.020]:
                nm = f"ADR implied_gap {dn}(事前) {un} |ig|>{thr * 100:.1f}%"
                pre_vars.append(per_stock_rule(IGx, thr, "LS", cols, sgn=sgn, name=nm, uses_open=False))
    for un, cols in uni.items():
        for sgn, dn in [(1.0, "順張り"), (-1.0, "逆張り")]:
            pre_vars.append(xs_rule(IGx, cols, 2, sgn, f"ADR implied_gap {dn}(事前) {un} 横断L/S k=2", False))
    bestB2, tabB2, infoB2 = select_on_is(pre_vars, "B2: ADR implied_gap 単独 (寄付価格を使わない)")
    results["WF_B2"] = (*walk_forward(pre_vars, "B2", infoB2), None)

    # 凍結ルールのヘッジ版 & リーク版 & ベンチ
    h_intra = hedge_intraday(cal)
    pB1 = parse_b(bestB1.name)
    if pB1["mode"] == "XS":  # 横断 L/S は既に市場中立 → 参考として時系列版 (|乖離|>1%) の 1321 ヘッジ
        B1h = per_stock_rule(DEV, 0.010, "LS", uni[pB1["un"]], hedge=h_intra,
                             name=f"参考: ADR乖離[寄付] {pB1['un']} 買い売り |乖離|>1.0% +1321ヘッジ")
    else:
        B1h = per_stock_rule(DEV, pB1["thr"], pB1["mode"], uni[pB1["un"]], hedge=h_intra,
                             name=bestB1.name + " +1321ヘッジ")
    DEVL = IGL.mask(exwin) - GAP
    leakB = per_stock_rule(DEVL, 0.0, "LS", ADR_NYSE, name="リーク版(実行不可能): ADR 同日付終値で乖離 NYSE9 買い売り",
                           fam="leak")
    r = INTRA[ADR_NYSE].values
    v = np.isfinite(r) & np.isfinite(Ca[[ADR_MAP[a] for a in ADR_NYSE]].shift(1).values)
    ew = np.where(v, r, 0).sum(1) / np.maximum(v.sum(1), 1)
    benchB = make_strat("ベンチ: ADR 対象9銘柄 等金額 寄付買い→大引け売り", cal, ew, (v.sum(1) > 0).astype(float),
                        np.zeros(len(cal)), "bench", False)
    t = print_strat_table([bestB1, B1h, bestB2, leakB, benchB], "B: 凍結ルールとベンチマーク")
    r10 = strat_table([bestB1], bps=SLIP + EXTRA_SLIP)
    print(f"\n  頑健性 {bestB1.name} を 片道 {SLIP + EXTRA_SLIP:.0f}bp で:")
    print(r10[["戦略", "区間", "取引日数", "年率%", "Sharpe", "純bp/日", "t値(NW)"]].round(2).to_string(index=False))
    q1 = {f"{bestB1.name} 片道{b:.0f}bp" + (" (グロス)" if b == 0 else ""): bestB1.net(b) for b in [0, 5]}
    q1[f"{bestB1.name} 片道15bp (+10bp 頑健性)"] = bestB1.net(SLIP + EXTRA_SLIP)
    q1[f"{B1h.name} 片道5bp"] = B1h.net(SLIP)
    q2 = {f"{bestB2.name} 純5bp": bestB2.net(SLIP), benchB.name + " 純5bp": benchB.net(SLIP)}
    plot_panels([(q1, "(B) [寄付価格を使用] ADR理論価格と寄付の乖離 (IS で凍結): コスト感応度"),
                 (q2, "(B) 寄付前の ADR implied_gap だけのルール とベンチマーク (純損益, 片道5bp)")])
    results["B1"] = (bestB1, infoB1, benchB)
    results["B1h"] = B1h
    results["B2"] = (bestB2, infoB2, benchB)
    results["B_leak"] = leakB
    results["n_B"] = len(open_vars) + len(pre_vars)
    return t


def parse_b(name: str) -> dict:
    un = "NYSE9+OTC7" if "NYSE9+OTC7" in name else "NYSE9"
    if "横断" in name:
        return {"un": un, "mode": "XS", "k": int(name.split("k=")[-1])}
    mode = "long" if "買いのみ" in name else "LS"
    thr = float(name.split(">")[-1].replace("%", "")) / 100
    return {"un": un, "mode": mode, "thr": thr}


# ------------------------------------------------------------------------------------------
# (C) 日本休場明けの米国累積
# ------------------------------------------------------------------------------------------
def part_c(cal, results):
    hdr("(C) 日本の休場明け (n_us_new >= 2): 米国の累積リターンを寄付で織り込みきれているか")
    sp = load_daily("^GSPC")["Close"]
    sig = us_signal_for_jp(sp, cal)
    n_new = sig["n_us_new"].values
    us_ret = sig["us_logret"].values
    H = n_new >= 2
    Nn = n_new == 1
    Z = n_new == 0
    cnt = []
    for lab, m in [("IS", is_mask(cal)), ("OOS", oos_mask(cal))]:
        vc = pd.Series(n_new[m]).value_counts().sort_index()
        cnt.append({"区間": lab, **{f"n_us_new={int(k)}": int(v) for k, v in vc.items() if np.isfinite(k)}})
    print("日本の営業日を「前営業日の大引け以降に新しく確定した米国セッション数」で分類 (件数):")
    print(pd.DataFrame(cnt).fillna(0).to_string(index=False))
    hol = cal[H]
    print(f"  n_us_new>=2 の例 (直近): {', '.join(str(d.date()) for d in hol[-8:])}")

    etf = {}
    for t in ["1321.T", "1306.T"]:
        df = load_jp(t, cal)
        g_, i_ = gap_intra(df["Open"], df["Close"], etf=True)
        etf[t] = pd.DataFrame({"gap": g_, "intra": i_})

    rows = []
    for t, d in etf.items():
        for lab, m in [("IS", is_mask(cal)), ("OOS", oos_mask(cal)), ("全期間", np.ones(len(cal), bool))]:
            g, r = d["gap"].values, d["intra"].values
            for gl, gm in [("休場明け(n>=2)", H), ("通常(n=1)", Nn), ("米休場明け(n=0)", Z)]:
                mm = m & gm & np.isfinite(r)
                rows.append({"銘柄": t, "区間": lab, "日の種類": gl, "件数": int(mm.sum()),
                             "日中平均bp": 1e4 * np.nanmean(r[mm]) if mm.sum() else np.nan,
                             "gap平均bp": 1e4 * np.nanmean(g[mm]) if mm.sum() else np.nan,
                             "gap傾き(対S&P累積)": slope(us_ret[mm], g[mm]),
                             "日中傾き(対S&P累積)": slope(us_ret[mm], r[mm])})
            # 差の検定
            mH = m & H & np.isfinite(d["intra"].values)
            mN = m & Nn & np.isfinite(d["intra"].values)
            p_mean = bootstrap_diff_pvalue(d["intra"].values[mH], d["intra"].values[mN])
            p_gs = bootstrap_slope_diff_pvalue(us_ret[mH], d["gap"].values[mH], us_ret[mN], d["gap"].values[mN])
            p_is = bootstrap_slope_diff_pvalue(us_ret[mH], d["intra"].values[mH], us_ret[mN], d["intra"].values[mN])
            rows.append({"銘柄": t, "区間": lab, "日の種類": "→ 差の p 値(boot,両側)", "件数": np.nan,
                         "日中平均bp": p_mean, "gap平均bp": np.nan, "gap傾き(対S&P累積)": p_gs,
                         "日中傾き(対S&P累積)": p_is})
    print("\n1321.T / 1306.T: 休場明け vs 通常日 (傾き = 米国 S&P500 累積対数リターンに対する回帰係数):")
    print("  gap 傾きが通常日より小さい = 寄付で織り込み不足 / 日中傾き > 0 = 日中も米国方向に続く (過小反応)")
    print(pd.DataFrame(rows).round(3).to_string(index=False))

    # ---- ルール (ETF) ----
    etf_vars = []
    for t, d in etf.items():
        r = d["intra"].values
        fill = np.isfinite(r)
        for rule in ["順張り", "逆張り", "常に買い", "常に売り"]:
            if rule == "順張り":
                pos = np.sign(us_ret)
            elif rule == "逆張り":
                pos = -np.sign(us_ret)
            elif rule == "常に買い":
                pos = np.ones(len(cal))
            else:
                pos = -np.ones(len(cal))
            pos = np.where(H & np.isfinite(us_ret) & fill, pos, 0.0)
            g = pos * np.where(fill, r, 0)
            etf_vars.append(make_strat(f"休場明け {t} {rule}(S&P累積の符号)" if "張り" in rule else f"休場明け {t} {rule}",
                                       cal, g, (pos > 0).astype(float), (pos < 0).astype(float), "C_etf", False))
    bestC1, tabC1, infoC1 = select_on_is(etf_vars, "C1: 休場明けの ETF 日中ルール (寄付価格を使わない)")
    results["WF_C1"] = (*walk_forward(etf_vars, "C1", infoC1), None)
    r1321 = etf["1321.T"]["intra"].values
    r1306 = etf["1306.T"]["intra"].values
    tk = "1321.T" if "1321" in bestC1.name else "1306.T"
    rr = r1321 if tk == "1321.T" else r1306
    fill = np.isfinite(rr)
    benchCH = make_strat(f"ベンチ: 休場明けだけ {tk} 寄付買い→大引け売り", cal, np.where(H & fill, rr, 0),
                         (H & fill).astype(float), np.zeros(len(cal)), "bench", False)
    benchCA = make_strat(f"ベンチ: 毎日 {tk} 寄付買い→大引け売り", cal, np.where(fill, rr, 0), fill.astype(float),
                         np.zeros(len(cal)), "bench", False)

    # ---- リードラグペア ----
    eqO, eqC = {}, {}
    rows = []
    sig_cache = {}
    pair_pos, pair_ret = [], []
    for lead, fol in LEAD_LAG_PAIRS:
        try:
            if lead not in sig_cache:
                sig_cache[lead] = us_signal_for_jp(load_daily(lead)["Close"], cal)["us_logret"].values
            if fol not in eqO:
                df = load_jp(fol, cal)
                eqO[fol], eqC[fol] = gap_intra(df["Open"], df["Close"], etf=fol in JP_ETF)
        except Exception as e:  # noqa: BLE001
            print(f"  [skip] {lead}->{fol}: {e}")
            continue
        x = sig_cache[lead]
        g, r = eqO[fol].values, eqC[fol].values  # (gap, 日中)
        pos = np.where(H & np.isfinite(x) & np.isfinite(r), np.sign(x), 0.0)
        pair_pos.append(pos)
        pair_ret.append(np.where(np.isfinite(r), r, 0.0))
        row = {"ペア": f"{lead}->{fol} {JP_NAMES.get(fol, '')}"}
        for lab, m in [("IS", is_mask(cal)), ("OOS", oos_mask(cal))]:
            mh = m & H & np.isfinite(x) & np.isfinite(r)
            mn = m & Nn & np.isfinite(x) & np.isfinite(r)
            row[f"{lab}件数H"] = int(mh.sum())
            row[f"{lab}日中傾きH"] = slope(x[mh], r[mh])
            row[f"{lab}日中傾き通常"] = slope(x[mn], r[mn])
            row[f"{lab}gap傾きH"] = slope(x[mh], g[mh])
            row[f"{lab}gap傾き通常"] = slope(x[mn], g[mn])
            row[f"{lab}順張りbpH"] = 1e4 * np.mean(np.sign(x[mh]) * r[mh]) if mh.sum() else np.nan
        rows.append(row)
    pt = pd.DataFrame(rows)
    print(f"\nリードラグペア 全 {len(pt)} ペア: 休場明け(H) と 通常日 の 日中/gap の傾き と 順張り(米国累積の符号)の平均 bp (グロス):")
    print(pt.round(3).to_string(index=False))
    for lab in ["IS", "OOS"]:
        hh, nn = pt[f"{lab}日中傾きH"], pt[f"{lab}日中傾き通常"]
        ok_ = hh.notna() & nn.notna()
        print(f"  {lab}: 日中傾きの平均 休場明け {hh[ok_].mean():.3f} vs 通常日 {nn[ok_].mean():.3f}"
              f" (休場明け > 通常 のペア {int((hh[ok_] > nn[ok_]).sum())}/{int(ok_.sum())});"
              f" gap 傾きの平均 休場明け {pt[f'{lab}gap傾きH'][ok_].mean():.3f} vs 通常日 {pt[f'{lab}gap傾き通常'][ok_].mean():.3f}")
    for lab in ["IS", "OOS"]:
        a = pt[f"{lab}日中傾きH"].dropna()
        b_ = pt[f"{lab}順張りbpH"].dropna()
        k_pos = int((a > 0).sum())
        p_sign = stats.binomtest(k_pos, len(a), 0.5).pvalue if len(a) else np.nan
        print(f"  {lab}: 休場明けの日中傾き > 0 のペア {k_pos}/{len(a)} (符号検定 p={p_sign:.3f}; ペア間は相関が強いので過大評価に注意),"
              f" 順張り平均 {b_.mean():.1f}bp")
    P = np.array(pair_pos).T
    R = np.array(pair_ret).T
    pv = []
    for sgn, dn in [(1.0, "順張り"), (-1.0, "逆張り")]:
        pos = P * sgn
        n = (pos != 0).sum(1)
        w = np.where(pos != 0, 1.0 / np.maximum(n, 1)[:, None], 0.0)
        g = (w * pos * R).sum(1)
        L = (w * (pos > 0)).sum(1)
        S = (w * (pos < 0)).sum(1)
        pv.append(make_strat(f"休場明け リードラグ全ペア {dn} (等金額)", cal, g, L, S, "C_pairs", False))
    bestC2, tabC2, infoC2 = select_on_is(pv, "C2: 休場明けのリードラグ全ペア合成 (寄付価格を使わない)")
    results["WF_C2"] = (*walk_forward(pv, "C2", infoC2), None)

    t = print_strat_table([bestC1, bestC2, benchCH, benchCA], "C: 凍結ルールとベンチマーク (取引は休場明けのみ)")
    # 休場明けの日だけで見た p 値
    for s in [bestC1, bestC2]:
        for lab, m in [("IS", is_mask(cal)), ("OOS", oos_mask(cal))]:
            x = s.net(SLIP)[m][s.active[m]]
            print(f"  {s.name} {lab}: 件数 {len(x)}, 純平均 {1e4 * x.mean():.1f}bp, "
                  f"ブートストラップ p(平均>0, iid) = {block_bootstrap_pvalue(x, block=1, n_boot=2000):.3f}")
    plot_pnl({f"{bestC1.name} 純5bp": bestC1.net(SLIP), f"{bestC2.name} 純5bp": bestC2.net(SLIP),
              f"{bestC2.name} グロス(コスト0)": bestC2.net(0.0),
              benchCH.name + " 純5bp": benchCH.net(SLIP)},
             "(C) 日本の休場明け (年 12 回前後): 凍結ルール vs 同じ日のベンチマーク (寄付価格は不使用)", OOS_START)
    results["C1"] = (bestC1, infoC1, benchCH)
    results["C2"] = (bestC2, infoC2, benchCH)
    results["n_C"] = len(etf_vars) + len(pv)
    return t


# ------------------------------------------------------------------------------------------
# まとめ
# ------------------------------------------------------------------------------------------
def final_summary(results):
    hdr("まとめ: 凍結した見出しルール (OOS = 2019〜). 多重検定補正付き")
    base = ["A1", "A2", "A3", "B1", "B2", "C1", "C2"]
    heads = base + [f"WF_{h}" for h in base]
    for h in base:  # WF のベンチは凍結ルールと同じ
        st, wi, _ = results[f"WF_{h}"]
        results[f"WF_{h}"] = (st, wi, results[h][2])
    m_heads = len(heads)
    n_total = results["n_A"] + results["n_B"] + results["n_C"]
    rows = []
    for h in heads:
        s, info, bench = results[h]
        o = stats_block(s, oos_mask(s.gross.index))
        i = stats_block(s, is_mask(s.gross.index))
        bo = stats_block(bench, oos_mask(bench.gross.index))
        t = o.get("t値(NW)", np.nan)
        p1 = 1 - stats.norm.cdf(t) if np.isfinite(t) else np.nan
        rows.append({"ID": h, "戦略": s.name if not h.startswith("WF") else f"{s.name} (候補 {info['n_trials']})",
                     "寄付価格": "使用" if s.uses_open else "不使用",
                     "IS_Sharpe": i.get("Sharpe"), "OOS_Sharpe": o.get("Sharpe"), "OOS年率%": o.get("年率%"),
                     "OOS純bp/日": o.get("純bp/日"), "OOS日数": o.get("取引日数"), "OOS_t": t,
                     "p(片側)": p1, "p×Bonf": min(1.0, p1 * m_heads) if np.isfinite(p1) else np.nan,
                     "DSR_IS": info["DSR_IS"], "DSR_OOS": info["DSR_OOS"], "試行数": info["n_trials"],
                     "損益分岐往復bp(OOS)": o.get("損益分岐(往復bp)"),
                     "ベンチOOS_Sharpe": bo.get("Sharpe"), "ベンチOOS年率%": bo.get("年率%")})
        r_ = rows[-1]
        if (r_["OOS_Sharpe"] or -9) >= 0.5 and r_["p×Bonf"] < 0.05 and r_["DSR_OOS"] > 0.95:
            r_["判定"] = "有望"
        elif (r_["OOS純bp/日"] or -9) > 0 and (r_["OOS_t"] or -9) > 1.0:
            r_["判定"] = "微妙"
        else:
            r_["判定"] = "利益なし"
        if not h.startswith("WF") and (r_["IS_Sharpe"] or -9) <= 0:
            r_["判定"] += "(ISでも全滅)"
    df = pd.DataFrame(rows)
    print(df.round(3).to_string(index=False))
    print(f"\n試したバリアント総数 = {n_total} (A {results['n_A']}, B {results['n_B']}, C {results['n_C']})"
          f"  + 参考/頑健性/リーク版は選択に使っていない.\nBonferroni は表の {m_heads} 本 (IS 凍結 7 + ウォークフォワード 7) で補正."
          " WF = 毎年それまでの全データで同じ候補から選び直す (リークなし). WF の IS 列は空.")
    lk = []
    for key, honest in [("A_leak", results["A2"][0]), ("A_leak_ts", results["A3"][0]), ("B_leak", results["B1"][0])]:
        s = results[key]
        for lab, m in [("IS", is_mask(s.gross.index)), ("OOS", oos_mask(s.gross.index))]:
            o = stats_block(s, m)
            ho = stats_block(honest, m)
            lk.append({"リーク版(実行不可能)": s.name, "区間": lab, "Sharpe": o.get("Sharpe"), "純bp/日": o.get("純bp/日"),
                       "比較: 正直版": honest.name, "正直版Sharpe": ho.get("Sharpe")})
    print("\nリーク版(実行不可能) と正直版の比較 — 日付の結合を 1 日間違えるだけでこれだけ水増しされる:")
    print(pd.DataFrame(lk).round(2).to_string(index=False))
    a10 = results.get("A1_10h")
    if isinstance(a10, dict) and a10:
        print("\nA1 の 1 時間足頑健性 (重複期間):")
        for k, v in a10.items():
            o = stats_block(v, np.ones(len(v.gross), bool))
            print(f"  {k}: Sharpe {o.get('Sharpe', np.nan):.2f}, 純bp/日 {o.get('純bp/日', np.nan):.1f}, "
                  f"グロスbp/日 {o.get('グロスbp/日', np.nan):.1f}, 日数 {o.get('取引日数', 0)}")
    plot_pnl({f"{results['A_leak_ts'].name} 純5bp": results["A_leak_ts"].net(SLIP),
              f"正直版: {results['A3'][0].name} 純5bp": results["A3"][0].net(SLIP),
              f"{results['A_leak'].name} 純5bp": results["A_leak"].net(SLIP),
              f"{results['B_leak'].name} 純5bp": results["B_leak"].net(SLIP),
              f"正直版: {results['B1'][0].name} [寄付価格を使用] 純5bp": results["B1"][0].net(SLIP)},
             "リーク版(実行不可能) vs 正直版: 米国日付を同じ日付で結合すると成績が水増しされる", OOS_START)
    return df


def main():
    print("s2: 寄付ギャップの過剰反応 / ADR理論価格 / 休場明けの米国累積  (東証 × SBI証券, 片道 5bp, 現物買い・信用売り)")
    print(f"IS 〜{IS_END.date()} / OOS {OOS_START.date()}〜")
    fetch_daily(["FXY"])  # 米国上場の円 ETF (無ければ取得して data/daily に保存)
    cal = build_calendar()
    data_quality_check([t for t in JP_ALL if t not in JP_ETF and t not in DELISTED])
    results = {}
    part_a(cal, results)
    print(f"\n[経過 {time.time() - T0:.0f} 秒]")
    part_b(cal, results)
    print(f"\n[経過 {time.time() - T0:.0f} 秒]")
    part_c(cal, results)
    print(f"\n[経過 {time.time() - T0:.0f} 秒]")
    final_summary(results)
    print(f"\n総実行時間 {time.time() - T0:.0f} 秒")


if __name__ == "__main__":
    main()
