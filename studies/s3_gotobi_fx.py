#!/usr/bin/env python3
"""S3: 「仲値 (ゴトー日)」USD/JPY アノマリー と 「東京時間の円高/円安」ドリフトの検証 (リーク対策済み)

ユーザーの問い: 「五十日 (ゴトー日) は輸入企業のドル買いで 9:55 の仲値に向けてドル円が上がる.
                 朝に買って仲値で売れば儲かるか? 仲値後は下がるのか?」
→ Yahoo の USD/JPY 1 時間足 (約 2.8 年) と 5 分足 (直近 60 日) で、コスト込み・先読みなしで検証する.

実行: cd /home/user/my-first-app && python3 studies/s3_gotobi_fx.py   (所要 数秒, メモリ 0.3GB 程度)

■ 市場・証券会社・コスト (jpus.costs.GMOClickFXCost)
  - 売買対象 : 店頭 FX の USD/JPY. 証券会社は GMOクリック証券「FXネオ」を想定.
  - 手数料   : 0 円.  スプレッド: USD/JPY 0.2 銭 (原則固定・例外あり) を往復コストとして 1 回だけ計上
               (1万通貨なら 1 往復 20 円). 感度分析で 0 / 0.2 / 0.5 / 1.0 銭 も表示し、損益分岐 (= 平均粗利 銭/回) も表示.
  - 注意     : 原則固定スプレッドは提示時間内 (USD/JPY は概ね 9:00〜翌3:00. 要確認) のみ. 07:00/08:00 の早朝は
               対象時間外でスプレッドが大きく広がりうる (特に冬時間の 07:00 はロールオーバー直後). → 0.5/1.0 銭の感度を必ず見ること.
  - スワップ : ロールオーバーは 07:00 JST (米国夏時間中は 06:00). 本スタディの売買はすべて同じ取引日内
               (07:00 以降に建てて翌 05:00 までに決済) なので スワップの受払いは発生しない.
  - 価格     : Yahoo の USD/JPY 指標レート (JPY=X). GMO の実際の約定レート (Bid/Ask) ではない.
               スプレッドは上記コストで別途差し引く. 「1万通貨あたり円」は (決済−建値)×10,000 − スプレッド×10,000.
               「%」は名目元本 (1 ドル分) 比. レバレッジは掛けない前提 (1万通貨 ≒ 150 万円の元本に対する損益).

■ データとタイミング (時刻はすべて JST)
  - 1 時間足: load_intraday('JPY=X','1h') 2023-12-18〜2026-10-03. Yahoo の時刻は「足の開始時刻」なので
              09:00 の足の終値 = 10:00 直前の価格 (= 10:00 の価格として使う). 「a 時に建てる」= a 時開始の足の始値,
              「b 時に決済」= (b−1) 時開始の足の終値.
  - 5 分足  : load_intraday('JPY=X','5m') 直近 60 日 (2026-07-14〜). 9:55 ちょうど (= 09:50 開始の足の終値) の決済を検証.
              5 分足の 1 時間区切りの価格は 1 時間足と完全一致することを確認済み (同一ソース).
  - データ品質: 週末 (土 05-07時 〜 月 08/09時) は欠損. Yahoo は月曜の 07:00 足が常に無く、冬時間は 08:00 足も無い
                (週初の足 = ロンドン 0 時). → 該当する月曜の 07:00/08:00 エントリーは「取引なし」扱い.
                その他の欠損 (クリスマス・年末年始, 2025-09-16 の 09 時足, 2026-02-02(月) 終日 等) も取引なし.
                土曜早朝の値動きゼロ足は売買窓に入らない. 介入・指標による急変動は除外しない (中央値も併記).
  - 営業日・五十日: 内閣府公表の国民の祝日 + 銀行休業日 (12/31〜1/3) をコードに直書きし (事前に分かっている暦),
                平日からそれらを除いた日を東京の営業日とする. 東証の取引日 (1306.T ∪ ^N225 の日足) と一致することを検証.
                五十日 = 日付が 5,10,15,20,25 の営業日 + 月末営業日. 名目日が休日なら「前営業日」(同月内に無い場合 =
                1 月 5 日などは翌営業日). 暦だけで決まるので先読みはない.
  - シグナルに価格は一切使わない (五十日かどうかと時刻のみ). 「寄付価格を使用」に当たる戦略は無い.

■ 売買ルール (候補 = 24 通り + 第 2 アイデア 8 通り = 計 32 通りを全て表示)
  - 仲値前ロング: 07:00 / 08:00 / 09:00 に成行買い → 10:00 (09:00 足の終値) に成行売り.   3 窓
  - 仲値後リバーサル (ショート): 10:00 に売り → 11:00 / 12:00 / 15:00 に買戻し.            3 窓
  - 日の集合: 全五十日 / 月末のみ / 5〜25日のみ (月末除く) / 全営業日.                      4 集合
    → 6 窓 × 4 集合 = 24 候補. 対照 (候補ではない): 同じ窓の「非五十日」.
  - 事前仮説 (データを見る前に固定): 全五十日の 08:00→10:00 ロング.
  - 第 2 アイデア「時間帯ドリフト」: 早朝 07→09 / 東京 09→15 / ロンドン 15→21 / NY 21→翌05 の 4 窓を全営業日に売買.
    方向 (買い/売り) は IS の平均の符号で決める → 4 窓 × 2 方向 = 8 試行.
  - 5 分足 (直近 60 日のみ, 全て OOS 期間): 08:00/09:00 → 09:55 ちょうど の決済、09:55→10:00 / 11:00 の動き、
    五十日の 08:00〜11:00 の高値の時刻分布 (標本 10 日程度なので参考).

■ 期間・パラメータ選択
  - IS = 2023-12-18〜2025-05-13 (前半), OOS = 2025-05-14〜2026-10-02 (後半). 分割点は現データの営業日の中央値で、
    データを追加しても動かさない (OOS を後から都合よく動かさないため).
  - 各ファミリー (仲値前ロング 12 候補, リバーサル 12 候補, 時間帯 8 試行) で IS の純 Sharpe (0.2 銭) 最大を選んで凍結し、
    OOS で評価. 事前仮説も並べて表示.
  - 多重検定: 32 試行で Deflated Sharpe Ratio, Bonferroni 補正 p 値.

■ ベンチマーク・検定 (シグナル vs ドリフトの分離)
  - 同じ時間窓の「非五十日」と「全営業日」(ドリフト・時間帯効果だけを拾う無条件ベンチマーク). 差の Welch t 検定.
  - 曜日固定効果つき回帰 (窓リターン = 定数 + 五十日ダミー + 曜日ダミー, HC1 頑健標準誤差).
  - 並べ替え検定: 営業日の間で五十日ラベルを 10,000 回シャッフル (五十日の日数は固定) し、平均以上が出る確率.
  - 年別表, 五十日の種類別 (5/10/15/20/25日/月末)・曜日別・休日による日付移動の有無.
  - 時間帯ドリフト: 期間平均の 1 時間あたりドリフト × 窓の時間数 を引いた「ドリフト調整後」も表示.

■ リーク版 (実行不可能. 「リーク版(実行不可能)」と明記. 取引可能な結果と混同しないこと)
  (A) 後知恵選択: OOS の成績を見て 12 候補から最良を選んだ場合の OOS 成績.
  (B) 同日の値動きでフィルタ: 09:00 時点で 07:00 より上がっていた五十日だけ「07:00 に」買う (09:00 の情報で 07:00 に建てる).
      対比として実行可能版 (同じ条件で 09:00 に買う) も表示.

結果ファイル・画像は保存しない (グラフは plt.show で表示のみ). データ期間が約 2.8 年と短く、1 回の為替介入や
急変動が結果を左右しうる点に注意.
"""
from __future__ import annotations

import math
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:  # `python3 studies/xxx.py` で実行しても jpus を import できるように
    sys.path.insert(0, str(ROOT))

import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402
from scipy import stats  # noqa: E402

from jpus import plot as _jplot  # noqa: E402,F401  (japanize_matplotlib を読み込んで日本語表示)
from jpus.costs import GMOClickFXCost  # noqa: E402
from jpus.data import load_daily, load_intraday  # noqa: E402
from jpus.metrics import JP_DAYS, deflated_sharpe_ratio, newey_west_tstat  # noqa: E402

pd.set_option("display.width", 250)
pd.set_option("display.max_columns", 40)
pd.set_option("display.max_rows", 200)
pd.set_option("display.unicode.east_asian_width", True)

T0 = time.time()

# ----------------------------------------------------------------------------------------------
# 設定
# ----------------------------------------------------------------------------------------------
SPLIT = pd.Timestamp("2025-05-14")    # IS < SPLIT <= OOS (現データの営業日の中央値. 固定)
BASE_SPREAD_SEN = 0.2                  # GMOクリック証券 FXネオ USD/JPY 0.2 銭 (往復)
SPREADS_SEN = [0.0, 0.2, 0.5, 1.0]     # 感度分析
LOT = 10_000                           # 1万通貨
N_PERM = 10_000
RNG = np.random.default_rng(20240505)
COL = {"g": "#2a78d6", "ng": "#eb6834", "all": "#7a7a7a", "c3": "#1baf7a", "c4": "#eda100", "c5": "#4a3aa7"}

# 国民の祝日 (振替休日・国民の休日を含む. 内閣府公表) + 銀行休業日 12/31・1/2・1/3. 事前に分かっている暦.
JP_HOLIDAYS = pd.DatetimeIndex(pd.to_datetime([
    "2023-12-31",
    "2024-01-01", "2024-01-02", "2024-01-03", "2024-01-08", "2024-02-11", "2024-02-12", "2024-02-23",
    "2024-03-20", "2024-04-29", "2024-05-03", "2024-05-04", "2024-05-05", "2024-05-06", "2024-07-15",
    "2024-08-11", "2024-08-12", "2024-09-16", "2024-09-22", "2024-09-23", "2024-10-14", "2024-11-03",
    "2024-11-04", "2024-11-23", "2024-12-31",
    "2025-01-01", "2025-01-02", "2025-01-03", "2025-01-13", "2025-02-11", "2025-02-23", "2025-02-24",
    "2025-03-20", "2025-04-29", "2025-05-03", "2025-05-04", "2025-05-05", "2025-05-06", "2025-07-21",
    "2025-08-11", "2025-09-15", "2025-09-23", "2025-10-13", "2025-11-03", "2025-11-23", "2025-11-24",
    "2025-12-31",
    "2026-01-01", "2026-01-02", "2026-01-03", "2026-01-12", "2026-02-11", "2026-02-23", "2026-03-20",
    "2026-04-29", "2026-05-03", "2026-05-04", "2026-05-05", "2026-05-06", "2026-07-20", "2026-08-11",
    "2026-09-21", "2026-09-22", "2026-09-23", "2026-10-12", "2026-11-03", "2026-11-23", "2026-12-31",
]))
CAL_START, CAL_END = pd.Timestamp("2023-12-01"), pd.Timestamp("2026-12-31")


def hr(title: str) -> None:
    print("\n" + "=" * 110 + f"\n■ {title}\n" + "=" * 110)


def fmt(df: pd.DataFrame, nd: int = 2) -> str:
    return df.to_string(float_format=lambda v: f"{v:,.{nd}f}")


# ----------------------------------------------------------------------------------------------
# 1. データ読み込みと品質チェック
# ----------------------------------------------------------------------------------------------
hr("1. データ (Yahoo USD/JPY 指標レート. GMO の約定レートではない) と品質チェック")
H1 = load_intraday("JPY=X", "1h")
M5 = load_intraday("JPY=X", "5m")


def quality(h: pd.DataFrame, name: str, step: pd.Timedelta) -> None:
    idx = h.index
    gaps = idx.to_series().diff()
    weekend = (gaps > pd.Timedelta(hours=40)) & (idx.dayofweek == 0)
    irregular = (gaps > step) & ~weekend
    flat = h["High"] == h["Low"]
    print(f"[{name}] {len(h):,} 本  {idx[0]} 〜 {idx[-1]}  (タイムスタンプ = 足の開始時刻, JST)")
    print(f"  週末の欠損 {int(weekend.sum())} 回 (月曜の最初の足の時刻: "
          f"{h[idx.dayofweek == 0].groupby(idx[idx.dayofweek == 0].date).apply(lambda x: x.index[0].strftime('%H:%M')).value_counts().to_dict()})")
    if irregular.any():
        rows = [f"{(t - g).strftime('%Y-%m-%d %H:%M')} → {t.strftime('%m-%d %H:%M')} ({g})"
                for t, g in gaps[irregular].items()]
        print(f"  週末以外の欠損 {len(rows)} 件: " + "; ".join(rows))
    wd = {0: "月", 1: "火", 2: "水", 3: "木", 4: "金", 5: "土", 6: "日"}
    fl = flat.groupby(idx.dayofweek).sum()
    print(f"  値動きゼロ (高値=安値) の足: {int(flat.sum())} 本 ("
          + ", ".join(f"{wd[k]}{int(v)}" for k, v in fl.items() if v > 0) + ") → ほぼ土曜早朝の週末クローズ足. 売買窓では使わない")
    if step == pd.Timedelta(hours=1):
        big = (np.log(h["Close"] / h["Open"]).abs() * 1e4).sort_values().tail(5)
        print("  1 時間で最も大きく動いた足 (bp): "
              + ", ".join(f"{t.strftime('%Y-%m-%d %H:%M')} {v:.0f}" for t, v in big[::-1].items())
              + "  (介入・指標. 外れ値として除外はしない)")


quality(H1, "1時間足", pd.Timedelta(hours=1))
quality(M5, "5分足", pd.Timedelta(minutes=5))
# 1 時間足と 5 分足の一致確認 (10:00 の価格 = 09:00 足の終値 = 09:55 開始の 5 分足の終値)
_m5c = M5["Close"].copy()
_m5c.index = _m5c.index - pd.Timedelta(minutes=55)
_j = H1.index.intersection(_m5c.index)
print(f"  1 時間足の終値 vs 対応する 5 分足 (xx:55 開始) の終値: 共通 {len(_j)} 本, 最大差 "
      f"{(H1.loc[_j, 'Close'] - _m5c.loc[_j]).abs().max() * 100:.3f} 銭 (同一ソース)")

# ----------------------------------------------------------------------------------------------
# 2. 東京の営業日と五十日 (暦だけで決まる = 先読みなし)
# ----------------------------------------------------------------------------------------------
hr("2. 東京の営業日カレンダーと五十日の定義")
_wd = pd.bdate_range(CAL_START, CAL_END)
BDAYS_ALL = _wd.difference(JP_HOLIDAYS)
# 東証の取引日との照合 (データのある期間)
_tse = load_daily("1306.T").index.union(load_daily("^N225").index)
_lo, _hi = pd.Timestamp("2023-12-18"), min(_tse.max(), pd.Timestamp("2026-10-02"))
_tse = _tse[(_tse >= _lo) & (_tse <= _hi)]
_cal = BDAYS_ALL[(BDAYS_ALL >= _lo) & (BDAYS_ALL <= _hi)]
_d1, _d2 = _cal.difference(_tse), _tse.difference(_cal)
print(f"直書きの祝日暦による営業日 {len(_cal)} 日 vs 東証取引日 {len(_tse)} 日 ({_lo.date()}〜{_hi.date()}): "
      f"暦にあって東証に無い {len(_d1)} 日, 東証にあって暦に無い {len(_d2)} 日"
      + ("  → 一致" if len(_d1) == 0 and len(_d2) == 0 else f"  ※不一致: {list(_d1.date)} {list(_d2.date)}"))


def build_gotobi(bdays: pd.DatetimeIndex) -> pd.DataFrame:
    """五十日表 (index = 営業日). 名目日が休日なら前営業日 (同月内に無ければ翌営業日)."""
    out = pd.DataFrame(index=bdays)
    out["五十日"] = False
    out["種類"] = "非五十日"
    out["前倒し"] = False
    s = pd.Series(bdays, index=bdays)
    for (y, m), grp in s.groupby([bdays.year, bdays.month]):
        days = pd.DatetimeIndex(grp.values)
        for n in (5, 10, 15, 20, 25):
            nominal = pd.Timestamp(year=y, month=m, day=n)
            prev = days[days <= nominal]
            d = prev[-1] if len(prev) else days[days >= nominal][0]
            out.loc[d, ["五十日", "種類", "前倒し"]] = [True, f"{n}日", d != nominal]
        d = days[-1]
        out.loc[d, ["五十日", "種類", "前倒し"]] = [True, "月末", False]
    out["曜日"] = np.array(["月", "火", "水", "木", "金"])[bdays.dayofweek]
    out["月曜"] = bdays.dayofweek == 0
    return out


GT = build_gotobi(BDAYS_ALL)

# ----------------------------------------------------------------------------------------------
# 3. 時間足パネル (行 = 取引日 D [D 07:00〜D+1 06:59], 列 = 07:00 からの経過時間)
# ----------------------------------------------------------------------------------------------
_t = H1.index
_sdate = (_t - pd.Timedelta(hours=7)).tz_localize(None).normalize()
_off = (_t.hour - 7) % 24
_long = pd.DataFrame({"sdate": _sdate, "off": _off, "O": H1["Open"].values, "C": H1["Close"].values})
PO = _long.pivot(index="sdate", columns="off", values="O").reindex(columns=range(24))
PC = _long.pivot(index="sdate", columns="off", values="C").reindex(columns=range(24))

first_day = PO.index.min()
last_day = PC.index[PC[21].notna()].max()  # 翌 05:00 まで揃う最後の取引日
BD = BDAYS_ALL[(BDAYS_ALL >= first_day) & (BDAYS_ALL <= last_day)]
G = GT.loc[BD]
IS = pd.Series(BD < SPLIT, index=BD)
OOS = ~IS
PO, PC = PO.reindex(BD), PC.reindex(BD)
print(f"検証営業日: {BD[0].date()}〜{BD[-1].date()} 計 {len(BD)} 日 (IS {int(IS.sum())} 日 / OOS {int(OOS.sum())} 日), "
      f"うち五十日 {int(G['五十日'].sum())} 日 (IS {int((G['五十日'] & IS).sum())} / OOS {int((G['五十日'] & OOS).sum())})")
_k = G.loc[G["五十日"], "種類"].value_counts().reindex(["5日", "10日", "15日", "20日", "25日", "月末"])
print("五十日の内訳: " + ", ".join(f"{k} {v}" for k, v in _k.items())
      + f";  休日のため日付移動 (前営業日へ. 前営業日が前月になる 1 月 5 日のみ翌営業日) {int(G['前倒し'].sum())} 日, 月曜の五十日 {int((G['五十日'] & G['月曜']).sum())} 日")


def win(a: int, b: int) -> tuple[pd.Series, pd.Series]:
    """a 時開始の足の始値で建て、b 時の価格 (= b−1 時開始の足の終値) で決済. b > 24 は翌日 (例 29 = 翌 05:00)."""
    return PO[a - 7].rename("entry"), PC[b - 8].rename("exit")


def hhmm(x: int) -> str:
    return f"{x % 24:02d}:00" if x < 24 else f"翌{x % 24:02d}:00"


# ----------------------------------------------------------------------------------------------
# 4. 戦略の評価関数
# ----------------------------------------------------------------------------------------------
def trades(a: int, b: int, sel: pd.Series, side: int, spread_sen: float = BASE_SPREAD_SEN) -> pd.DataFrame:
    """選択日 sel の窓 a→b の売買 (side=+1 買い / −1 売り). 両端の足が無い日は取引なし."""
    e, x = win(a, b)
    ok = sel.reindex(BD).fillna(False).astype(bool) & e.notna() & x.notna()
    e, x = e[ok], x[ok]
    cost = GMOClickFXCost(spread_yen=spread_sen / 100).round_trip(e.values)
    df = pd.DataFrame(index=e.index)
    df["entry"], df["exit"] = e, x
    df["gross"] = side * (x / e - 1)
    df["net"] = df["gross"] - cost
    df["gross_sen"] = side * (x - e) * 100
    df["net_sen"] = df["gross_sen"] - spread_sen
    df["yen"] = df["net_sen"] * LOT / 100   # 1万通貨あたり純損益 (円)
    return df


def daily(tr: pd.DataFrame, col: str = "net") -> pd.Series:
    """営業日ベースの日次リターン (取引のない日は 0)."""
    s = pd.Series(0.0, index=BD)
    s.loc[tr.index] = tr[col].values
    return s


def stat(tr: pd.DataFrame, mask: pd.Series | None = None) -> dict:
    m = pd.Series(True, index=BD) if mask is None else mask
    t = tr[m.reindex(tr.index).values]
    d = daily(tr)[m]
    n = len(t)
    sd = d.std(ddof=1)
    cum = t["yen"].cumsum()
    return {
        "取引数": n,
        "粗 銭/回": t["gross_sen"].mean() if n else np.nan,
        "粗 中央値銭": t["gross_sen"].median() if n else np.nan,
        "純 銭/回": t["net_sen"].mean() if n else np.nan,
        "純 bp/回": 1e4 * t["net"].mean() if n else np.nan,
        "勝率%": 100 * (t["net"] > 0).mean() if n else np.nan,
        "t値": stats.ttest_1samp(t["net"], 0).statistic if n > 2 else np.nan,
        "NW t(日次)": newey_west_tstat(d),
        "年率%": 100 * d.mean() * JP_DAYS,
        "Sharpe": d.mean() / sd * math.sqrt(JP_DAYS) if sd > 0 else np.nan,
        "1万通貨 累計円": t["yen"].sum(),
        "最大DD円": float((cum - cum.cummax().clip(lower=0)).min()) if n else np.nan,  # 1万通貨あたり
    }


ALLD = pd.Series(True, index=BD)
GOTO = G["五十日"]
NONG = ~GOTO
ME = G["種類"] == "月末"
MID = GOTO & ~ME
DAYSETS = {"全五十日": GOTO, "月末のみ": ME, "5〜25日のみ": MID, "全営業日": ALLD}
LONG_W = [(7, 10), (8, 10), (9, 10)]
REV_W = [(10, 11), (10, 12), (10, 15)]
APRIORI = ("仲値前ロング", 8, 10, "全五十日")

# ----------------------------------------------------------------------------------------------
# 5. 全 24 候補 (+ 対照) の IS / OOS 成績
# ----------------------------------------------------------------------------------------------
hr(f"3. 五十日 全 24 候補の成績 (コスト {BASE_SPREAD_SEN} 銭/往復 込み, 純損益). ★=IS 純Sharpe 最大で凍結, ◎=事前仮説")
CANDS = []
for fam, wins, side in [("仲値前ロング", LONG_W, +1), ("仲値後ショート", REV_W, -1)]:
    for (a, b) in wins:
        for ds in DAYSETS:
            CANDS.append((fam, a, b, ds, side))

rows, TR = [], {}
for fam, a, b, ds, side in CANDS:
    tr = trades(a, b, DAYSETS[ds], side)
    TR[(fam, a, b, ds)] = tr
    si, so, sf = stat(tr, IS), stat(tr, OOS), stat(tr)
    rows.append({"族": fam, "窓": f"{hhmm(a)}→{hhmm(b)}", "日": ds,
                 "IS 回数": si["取引数"], "IS 純銭/回": si["純 銭/回"], "IS Sharpe": si["Sharpe"], "IS t": si["t値"],
                 "OOS 回数": so["取引数"], "OOS 純銭/回": so["純 銭/回"], "OOS Sharpe": so["Sharpe"], "OOS t": so["t値"],
                 "全 Sharpe": sf["Sharpe"], "_key": (fam, a, b, ds)})
CT = pd.DataFrame(rows)
SEL = {}
for fam in ["仲値前ロング", "仲値後ショート"]:
    sub = CT[CT["族"] == fam]
    SEL[fam] = sub.loc[sub["IS Sharpe"].idxmax(), "_key"]
CT["印"] = [("★" if k in SEL.values() else "") + ("◎" if k == APRIORI else "") for k in CT["_key"]]
print(fmt(CT.drop(columns="_key").set_index(["族", "窓", "日"]), 2))

# 対照: 非五十日
rows = []
for fam, wins, side in [("仲値前ロング", LONG_W, +1), ("仲値後ショート", REV_W, -1)]:
    for (a, b) in wins:
        tg, tn = trades(a, b, GOTO, side, 0.0), trades(a, b, NONG, side, 0.0)
        for per, msk in [("IS", IS), ("OOS", OOS), ("全期間", ALLD)]:
            g = tg.loc[msk.reindex(tg.index).values, "gross_sen"]
            n = tn.loc[msk.reindex(tn.index).values, "gross_sen"]
            w = stats.ttest_ind(g, n, equal_var=False)
            rows.append({"族": fam, "窓": f"{hhmm(a)}→{hhmm(b)}", "区間": per, "五十日 粗銭": g.mean(), "五十日 n": len(g),
                         "非五十日 粗銭": n.mean(), "非五十日 n": len(n), "差 銭": g.mean() - n.mean(),
                         "Welch t": w.statistic, "p(両側)": w.pvalue})
WT = pd.DataFrame(rows).set_index(["族", "窓", "区間"])
print("\n[対照] 同じ窓の 五十日 vs 非五十日 (粗リターン, 銭/回. 売り窓は売り方向の損益):")
print(fmt(WT, 3))

# ----------------------------------------------------------------------------------------------
# 6. 凍結した戦略の詳細
# ----------------------------------------------------------------------------------------------
FOCUS = {"凍結(仲値前ロング)": SEL["仲値前ロング"], "事前仮説": APRIORI, "凍結(仲値後ショート)": SEL["仲値後ショート"]}
hr("4. 凍結した戦略 (IS で選択) と事前仮説の IS/OOS 成績 (純損益, 0.2 銭)")
rows = []
for lab, key in FOCUS.items():
    fam, a, b, ds = key
    side = +1 if fam == "仲値前ロング" else -1
    tr = TR[key]
    for per, msk in [("IS", IS), ("OOS", OOS), ("全期間", ALLD)]:
        rows.append({"戦略": f"{lab}: {ds} {hhmm(a)}→{hhmm(b)} {'買' if side > 0 else '売'}", "区間": per, **stat(tr, msk)})
    # 無条件ベンチマーク: 同じ窓を全営業日 / 非五十日
    for bl, bm in [("全営業日(同じ窓)", ALLD), ("非五十日(同じ窓)", NONG)]:
        tb = trades(a, b, bm, side)
        rows.append({"戦略": f"  └ 比較: {bl}", "区間": "OOS", **stat(tb, OOS)})
FT = pd.DataFrame(rows).set_index(["戦略", "区間"])
print(fmt(FT, 2))

# ----------------------------------------------------------------------------------------------
# 7. 統計検定: 並べ替え検定・曜日固定効果回帰・Deflated Sharpe
# ----------------------------------------------------------------------------------------------
hr("5. 統計検定 (並べ替え検定 / 曜日固定効果つき回帰 / Deflated Sharpe / Bonferroni)")


def perm_p(r: np.ndarray, lab: np.ndarray, n_perm: int = N_PERM) -> float:
    """五十日ラベルを営業日間でシャッフル (日数固定) して、平均 ≥ 実績 となる確率 (片側)."""
    obs = r[lab].mean()
    k, n = int(lab.sum()), len(r)
    cnt, done = 0, 0
    while done < n_perm:
        m = min(1000, n_perm - done)
        idx = np.argsort(RNG.random((m, n)), axis=1)[:, :k]
        cnt += int((r[idx].mean(axis=1) >= obs).sum())
        done += m
    return (cnt + 1) / (n_perm + 1)


def ols_hc1(y: np.ndarray, X: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    XtX_inv = np.linalg.inv(X.T @ X)
    b = XtX_inv @ X.T @ y
    e = y - X @ b
    n, k = X.shape
    cov = XtX_inv @ (X.T @ (X * (e ** 2)[:, None])) @ XtX_inv * n / (n - k)
    return b, b / np.sqrt(np.diag(cov))


rows = []
for fam, wins, side in [("仲値前ロング", LONG_W, +1), ("仲値後ショート", REV_W, -1)]:
    for (a, b) in wins:
        tr = trades(a, b, ALLD, side, 0.0)
        for per, msk in [("IS", IS), ("OOS", OOS), ("全期間", ALLD)]:
            t = tr[msk.reindex(tr.index).values]
            lab = GOTO.reindex(t.index).values
            r = t["gross_sen"].values
            dow = t.index.dayofweek.values
            present = sorted(set(dow))  # 07:00 窓は月曜のデータが無いので、存在する曜日だけでダミーを作る
            X = np.column_stack([np.ones(len(r)), lab.astype(float)] + [(dow == k).astype(float) for k in present[1:]])
            bb, tt = ols_hc1(r, X)
            rows.append({"族": fam, "窓": f"{hhmm(a)}→{hhmm(b)}", "区間": per,
                         "五十日 平均銭": r[lab].mean(), "並べ替え p(片側)": perm_p(r, lab),
                         "回帰 五十日効果 銭": bb[1], "回帰 t(HC1)": tt[1]})
PT = pd.DataFrame(rows).set_index(["族", "窓", "区間"])
print(f"並べ替え検定 {N_PERM:,} 回 / 回帰: 窓の粗リターン(銭, 売り窓は売り方向) = 定数 + 五十日ダミー + 曜日ダミー")
print(fmt(PT, 3))


# 時間帯ドリフト (第 2 アイデア) もここで試行に数えるため先に計算
SESS = {"早朝 07→09": (7, 9), "東京 09→15": (9, 15), "ロンドン 15→21": (15, 21), "NY 21→翌05": (21, 29)}
SESS_TR = {}
for nm, (a, b) in SESS.items():
    for side in (+1, -1):
        SESS_TR[(nm, side)] = trades(a, b, ALLD, side)

# 32 試行の日次 Sharpe (非年率, 全期間) の分布
all_daily = {k: daily(v) for k, v in TR.items()}
all_daily.update({k: daily(v) for k, v in SESS_TR.items()})
N_TRIALS = len(all_daily)
sr_all = np.array([d.mean() / d.std(ddof=1) for d in all_daily.values()])
SR_STD = float(np.std(sr_all, ddof=1))


def dsr_row(name: str, d: pd.Series) -> dict:
    out = {"戦略": name}
    for per, msk in [("全期間", ALLD), ("OOS", OOS)]:
        x = d[msk]
        sr = x.mean() / x.std(ddof=1)
        sk, ku = float(stats.skew(x)), float(stats.kurtosis(x, fisher=False))
        out[f"{per} 年率Sharpe"] = sr * math.sqrt(JP_DAYS)
        if per == "全期間":
            out["DSR(32試行)"] = deflated_sharpe_ratio(sr, len(x), N_TRIALS, SR_STD, sk, ku)
            p1 = 1 - stats.norm.cdf(newey_west_tstat(x))
            out["p(片側, NW)"] = p1
            out["Bonferroni p"] = min(1.0, p1 * N_TRIALS)
        else:
            out["OOS PSR(SR>0確率)"] = deflated_sharpe_ratio(sr, len(x), 1, 0.0, sk, ku)
    return out


# ----------------------------------------------------------------------------------------------
# 8. 第 2 アイデア: 時間帯ドリフト (東京時間の円高/円安?)
# ----------------------------------------------------------------------------------------------
# 期間ごとのドリフト (全ての 1 時間足の平均値幅 = 1 時間あたりの平均トレンド)
_hb = (H1["Close"] - H1["Open"]) * 100
_hd = _hb.index.tz_localize(None).normalize()
DRIFT_H = {"IS": _hb[_hd < SPLIT].mean(), "OOS": _hb[_hd >= SPLIT].mean()}
srows, SESS_SEL = [], None
best_is = -np.inf
for nm, (a, b) in SESS.items():
    tl = SESS_TR[(nm, +1)]
    g_is = tl.loc[IS.reindex(tl.index).values, "gross_sen"]
    side = 1 if g_is.mean() > 0 else -1
    tr = SESS_TR[(nm, side)]
    si, so = stat(tr, IS), stat(tr, OOS)
    g_oos = tl.loc[OOS.reindex(tl.index).values, "gross_sen"]
    hrs = b - a
    srows.append({"時間帯": nm, "時間数": hrs,
                  "IS 買い粗銭/日": g_is.mean(), "IS t": stats.ttest_1samp(g_is, 0).statistic,
                  "IS ドリフト調整後": g_is.mean() - DRIFT_H["IS"] * hrs,
                  "OOS 買い粗銭/日": g_oos.mean(), "OOS t": stats.ttest_1samp(g_oos, 0).statistic,
                  "OOS ドリフト調整後": g_oos.mean() - DRIFT_H["OOS"] * hrs,
                  "方向(IS決定)": "買い" if side > 0 else "売り",
                  "IS 純Sharpe": si["Sharpe"], "OOS 純銭/日": so["純 銭/回"], "OOS 純Sharpe": so["Sharpe"],
                  "OOS 1万通貨円": so["1万通貨 累計円"]})
    if si["Sharpe"] > best_is:
        best_is, SESS_SEL = si["Sharpe"], (nm, side)
ST = pd.DataFrame(srows).set_index("時間帯")

# ----------------------------------------------------------------------------------------------
# DSR 表 (凍結戦略 + 事前仮説 + 時間帯)
# ----------------------------------------------------------------------------------------------
drows = [dsr_row(f"{lab}: {k[3]} {hhmm(k[1])}→{hhmm(k[2])}", all_daily[k]) for lab, k in FOCUS.items()]
drows.append(dsr_row(f"凍結(時間帯): {SESS_SEL[0]} {'買い' if SESS_SEL[1] > 0 else '売り'}", all_daily[SESS_SEL]))
DT = pd.DataFrame(drows).set_index("戦略")
print(f"\n多重検定: 試行数 {N_TRIALS} (五十日 24 + 時間帯 4窓×2方向 8). 試行の日次 Sharpe の標準偏差 {SR_STD:.4f} (非年率)")
print(fmt(DT, 3))

# ----------------------------------------------------------------------------------------------
# 9. 年別表と内訳
# ----------------------------------------------------------------------------------------------
hr("6. 年別 (凍結戦略・事前仮説 vs 同じ窓の非五十日). 銭/回は粗, 1万通貨円は 0.2 銭控除後")
rows = []
for lab, key in FOCUS.items():
    fam, a, b, ds = key
    side = +1 if fam == "仲値前ロング" else -1
    tg, tn = TR[key], trades(a, b, NONG, side)
    for y in sorted(set(BD.year)):
        g, n = tg[tg.index.year == y], tn[tn.index.year == y]
        rows.append({"戦略": f"{lab}: {ds} {hhmm(a)}→{hhmm(b)}", "年": f"{y}" + ("(12月のみ)" if y == 2023 else ""),
                     "回数": len(g), "粗 銭/回": g["gross_sen"].mean(), "勝率%": 100 * (g["net"] > 0).mean(),
                     "t値": stats.ttest_1samp(g["gross_sen"], 0).statistic if len(g) > 2 else np.nan,
                     "非五十日 粗銭": n["gross_sen"].mean(), "差 銭": g["gross_sen"].mean() - n["gross_sen"].mean(),
                     "1万通貨 純円": g["yen"].sum()})
print(fmt(pd.DataFrame(rows).set_index(["戦略", "年"]), 2))

hr("7. 内訳: 五十日の種類 / 曜日 / 休日による日付移動 (窓 = 事前仮説 08:00→10:00 買い と 仲値後 10:00→12:00 売り. 粗 銭/回)")


def breakdown(a: int, b: int, side: int) -> pd.DataFrame:
    tr = trades(a, b, ALLD, side, 0.0)
    gg = G.reindex(tr.index)
    tr = tr.assign(種類=gg["種類"].values, 曜日=gg["曜日"].values, 前倒し=gg["前倒し"].values,
                   五十日=gg["五十日"].values, IS=IS.reindex(tr.index).values)
    out = []

    def add(name, m):
        t = tr[m]
        out.append({"区分": name, "回数": len(t), "粗 銭/回": t["gross_sen"].mean(),
                    "t値": stats.ttest_1samp(t["gross_sen"], 0).statistic if len(t) > 2 else np.nan,
                    "勝率%": 100 * (t["gross_sen"] > 0).mean(),
                    "IS 銭": t.loc[t["IS"], "gross_sen"].mean(), "OOS 銭": t.loc[~t["IS"], "gross_sen"].mean()})

    for k in ["5日", "10日", "15日", "20日", "25日", "月末"]:
        add(f"五十日:{k}", tr["種類"] == k)
    add("五十日:月中(15日・20日)", tr["種類"].isin(["15日", "20日"]))
    add("五十日:月初(5日・10日)", tr["種類"].isin(["5日", "10日"]))
    add("非五十日", ~tr["五十日"])
    for w in ["月", "火", "水", "木", "金"]:
        add(f"五十日 {w}曜", tr["五十日"] & (tr["曜日"] == w))
        add(f"非五十日 {w}曜", ~tr["五十日"] & (tr["曜日"] == w))
    add("五十日:休日で日付移動", tr["五十日"] & tr["前倒し"])
    add("五十日:移動なし", tr["五十日"] & ~tr["前倒し"])
    return pd.DataFrame(out).set_index("区分")


B1, B2 = breakdown(8, 10, +1), breakdown(10, 12, -1)
print(fmt(pd.concat({"08:00→10:00 買い": B1, "10:00→12:00 売り": B2}, axis=1), 2))
print("※ 月曜の 08:00 足は冬時間には Yahoo に無いため、月曜の 08:00→10:00 は夏時間の日だけ.")

# ----------------------------------------------------------------------------------------------
# 10. コスト感度と損益分岐
# ----------------------------------------------------------------------------------------------
hr("8. コスト感度 (GMO FXネオ スプレッド 0 / 0.2 / 0.5 / 1.0 銭) と損益分岐スプレッド")
rows = []
focus2 = {**{lab: (key, +1 if key[0] == "仲値前ロング" else -1) for lab, key in FOCUS.items()}}
for lab, (key, side) in focus2.items():
    fam, a, b, ds = key
    sel = DAYSETS[ds]
    for per, msk in [("IS", IS), ("OOS", OOS)]:
        row = {"戦略": f"{lab}: {ds} {hhmm(a)}→{hhmm(b)}", "区間": per}
        for sp in SPREADS_SEN:
            s = stat(trades(a, b, sel, side, sp), msk)
            row[f"{sp}銭 純銭/回"] = s["純 銭/回"]
            row[f"{sp}銭 Sharpe"] = s["Sharpe"]
        row["損益分岐 銭/往復"] = stat(trades(a, b, sel, side, 0.0), msk)["粗 銭/回"]
        rows.append(row)
nm_s, sd_s = SESS_SEL
a, b = SESS[nm_s]
for per, msk in [("IS", IS), ("OOS", OOS)]:
    row = {"戦略": f"凍結(時間帯): {nm_s} {'買い' if sd_s > 0 else '売り'}", "区間": per}
    for sp in SPREADS_SEN:
        s = stat(trades(a, b, ALLD, sd_s, sp), msk)
        row[f"{sp}銭 純銭/回"], row[f"{sp}銭 Sharpe"] = s["純 銭/回"], s["Sharpe"]
    row["損益分岐 銭/往復"] = stat(trades(a, b, ALLD, sd_s, 0.0), msk)["粗 銭/回"]
    rows.append(row)
print(fmt(pd.DataFrame(rows).set_index(["戦略", "区間"]), 2))
print("※ 1 銭 = 1万通貨で 100 円. USD/JPY 150 円なら 1 銭 ≒ 0.67bp. 損益分岐 = 粗利の平均 (これ以下のスプレッドなら黒字).")

# ----------------------------------------------------------------------------------------------
# 11. 5 分足で 9:55 ちょうどの決済を検証 (直近 60 日 = 全て OOS 期間)
# ----------------------------------------------------------------------------------------------
hr("9. 5 分足 (直近約 60 日) で仲値 9:55 ちょうどの決済を検証 (標本が小さいので参考値)")
_t5 = M5.index
_d5 = _t5.tz_localize(None).normalize()
_mo = (_t5.hour - 8) * 60 + _t5.minute
_k5 = (_mo >= 0) & (_mo < 240)
_l5 = pd.DataFrame({"d": _d5[_k5], "m": _mo[_k5], "O": M5["Open"].values[_k5], "C": M5["Close"].values[_k5]})
QO = _l5.pivot(index="d", columns="m", values="O").reindex(columns=range(0, 240, 5))
QC = _l5.pivot(index="d", columns="m", values="C").reindex(columns=range(0, 240, 5))
BD5 = BD[(BD >= QO.index.min()) & (BD <= QO.index.max())]
QO, QC = QO.reindex(BD5), QC.reindex(BD5)
g5 = GOTO.reindex(BD5).values


def p5(t: str, kind: str) -> pd.Series:
    """時刻 t の価格. kind='O': t 開始の足の始値 / 'C': t の 5 分前開始の足の終値 (= t の価格)."""
    hh, mm = map(int, t.split(":"))
    m = (hh - 8) * 60 + mm
    return QO[m] if kind == "O" else QC[m - 5]


W5 = {"08:00→09:55 買い": (p5("08:00", "O"), p5("09:55", "C"), +1),
      "08:00→10:00 買い": (p5("08:00", "O"), p5("10:00", "C"), +1),
      "09:00→09:55 買い": (p5("09:00", "O"), p5("09:55", "C"), +1),
      "09:00→10:00 買い": (p5("09:00", "O"), p5("10:00", "C"), +1),
      "09:55→10:00 売り": (p5("09:55", "C"), p5("10:00", "C"), -1),
      "09:55→11:00 売り": (p5("09:55", "C"), p5("11:00", "C"), -1),
      "09:55→12:00 売り": (p5("09:55", "C"), p5("12:00", "C"), -1)}
rows = []
for nm, (e, x, side) in W5.items():
    r = side * (x - e) * 100
    for lab, m in [("五十日", g5), ("非五十日", ~g5)]:
        v = r[m].dropna()
        rows.append({"窓": nm, "日": lab, "回数": len(v), "粗 銭/回": v.mean(), "純 銭/回(0.2銭)": v.mean() - BASE_SPREAD_SEN,
                     "t値": stats.ttest_1samp(v, 0).statistic if len(v) > 2 else np.nan, "勝率%": 100 * (v > 0).mean()})
Q5 = pd.DataFrame(rows).set_index(["窓", "日"])
print(f"5 分足の営業日 {len(BD5)} 日 ({BD5[0].date()}〜{BD5[-1].date()}), うち五十日 {int(g5.sum())} 日")
print(fmt(Q5, 2))
# 1 時間足との整合: 08:00→10:00
_e1, _x1 = win(8, 10)
_c = pd.concat([(_x1 - _e1).reindex(BD5), (p5("10:00", "C") - p5("08:00", "O"))], axis=1).dropna()
print(f"1 時間足 08:00→10:00 と 5 分足の同じ窓の差: 最大 {(_c.iloc[:, 0] - _c.iloc[:, 1]).abs().max() * 100:.4f} 銭 ({len(_c)} 日)")
# 五十日の 08:00〜11:00 の高値の時刻
_cc = QC.loc[g5, list(range(0, 180, 5))]
_peak = _cc.idxmax(axis=1).dropna().astype(int) + 5  # 足の終了時刻 (08:00 からの分)
_pk = [f"{8 + m // 60:02d}:{m % 60:02d}" for m in _peak]
print(f"五十日 ({len(_pk)} 日) の 08:05〜11:00 の 5 分足終値が最も高かった時刻: {', '.join(sorted(_pk))}")
print(f"  → 09:45〜10:00 に高値: {sum(9 * 60 + 45 <= 8 * 60 + m <= 10 * 60 for m in _peak)} / {len(_pk)} 日")

# ----------------------------------------------------------------------------------------------
# 12. リーク版 (実行不可能)
# ----------------------------------------------------------------------------------------------
hr("10. リーク版(実行不可能) — 先読みが成績をどれだけ水増しするかの見本. 取引可能な結果ではない")
lsub = CT[CT["族"] == "仲値前ロング"]
k_leakA = lsub.loc[lsub["OOS Sharpe"].idxmax(), "_key"]
rows = [{"版": "実行可能: IS で凍結 " + f"{SEL['仲値前ロング'][3]} {hhmm(SEL['仲値前ロング'][1])}→10:00",
         **stat(TR[SEL["仲値前ロング"]], OOS)},
        {"版": "リーク版(実行不可能) A: OOS を見て選択 " + f"{k_leakA[3]} {hhmm(k_leakA[1])}→10:00",
         **stat(TR[k_leakA], OOS)}]
# (B) 09:00 の価格を見て 07:00 に買う
e7, x10 = win(7, 10)
e9, _ = win(9, 10)
up = (e9 > e7) & GOTO
rows.append({"版": "リーク版(実行不可能) B: 07→09 上昇の五十日だけ 07:00 買い", **stat(trades(7, 10, up, +1), OOS)})
rows.append({"版": "実行可能: 07→09 上昇の五十日だけ 09:00 買い", **stat(trades(9, 10, up, +1), OOS)})
rows.append({"版": "実行可能: 全五十日 07:00 買い (条件なし)", **stat(trades(7, 10, GOTO, +1), OOS)})
print("(OOS 期間の成績, 0.2 銭控除)")
print(fmt(pd.DataFrame(rows).set_index("版"), 2))

# ----------------------------------------------------------------------------------------------
# 13. 第 2 アイデアの表示
# ----------------------------------------------------------------------------------------------
hr("11. 第 2 アイデア: 時間帯ドリフト (東京時間に円高/円安になりやすいか). 全営業日, スワップなしの窓")
print(f"1 時間あたり平均ドリフト: IS {DRIFT_H['IS']:+.3f} 銭/時, OOS {DRIFT_H['OOS']:+.3f} 銭/時 "
      f"(ドリフト調整後 = 窓の平均 − ドリフト×時間数)")
print(fmt(ST, 2))
rows = []
for nm, (a, b) in SESS.items():
    tl = SESS_TR[(nm, +1)]
    r = {"時間帯": nm}
    for y in sorted(set(BD.year)):
        r[f"{y} 買い粗銭"] = tl.loc[tl.index.year == y, "gross_sen"].mean()
    rows.append(r)
print("\n年別 (買い方向の粗 銭/日):")
print(fmt(pd.DataFrame(rows).set_index("時間帯"), 2))
# 米国夏時間/冬時間の別 (冬時間は 07:00 がロールオーバー直後でスプレッドが最も広く、Yahoo の 07:00 始値も不安定になりうる)
_dst = pd.Series([pd.Timestamp(d).tz_localize("America/New_York").dst() != pd.Timedelta(0) for d in BD], index=BD)
rows = []
for nm, (a, b, sel) in {"早朝 07→09 全営業日": (7, 9, ALLD), "07:00→10:00 全五十日": (7, 10, GOTO),
                        "08:00→10:00 全五十日": (8, 10, GOTO), "09:00→10:00 全五十日": (9, 10, GOTO)}.items():
    tr = trades(a, b, sel, +1, 0.0)
    for lab, m in [("米国夏時間", _dst), ("米国冬時間", ~_dst)]:
        v = tr.loc[m.reindex(tr.index).values, "gross_sen"]
        rows.append({"窓(買い)": nm, "季節": lab, "回数": len(v), "粗 銭/回": v.mean(), "中央値": v.median(),
                     "t値": stats.ttest_1samp(v, 0).statistic})
print("\n夏時間/冬時間の別 (全期間, 粗 銭/回. 冬時間の 07:00 はロールオーバー直後で実際のスプレッドが特に広い):")
print(fmt(pd.DataFrame(rows).set_index(["窓(買い)", "季節"]), 2))

_tok = SESS_TR[("東京 09→15", +1)]["gross_sen"]
_oth = (SESS_TR[("ロンドン 15→21", +1)]["gross_sen"].reindex(_tok.index)
        + SESS_TR[("NY 21→翌05", +1)]["gross_sen"].reindex(_tok.index))
_dd = (_tok / 6 - _oth / 14).dropna()
print(f"\n東京 (1 時間あたり) − 海外 (ロンドン+NY, 1 時間あたり) の差: 全期間 {_dd.mean():+.3f} 銭/時 "
      f"(t={stats.ttest_1samp(_dd, 0).statistic:.2f}), IS {_dd[_dd.index < SPLIT].mean():+.3f}, OOS {_dd[_dd.index >= SPLIT].mean():+.3f}")

# ----------------------------------------------------------------------------------------------
# 14. グラフ
# ----------------------------------------------------------------------------------------------


def shade_oos(ax, x_end) -> None:
    ax.axvline(SPLIT, color="gray", ls="--", lw=1)
    ax.axvspan(SPLIT, x_end, color="gray", alpha=0.10, label="アウトオブサンプル (OOS)")


# 図1: 凍結窓の累積損益 (円/1万通貨)
fam, a, b, ds = SEL["仲値前ロング"]
fig, axes = plt.subplots(2, 1, figsize=(12, 9), sharex=True)
ax = axes[0]
for lab, sel, c, lw in [(f"{ds} (凍結)", DAYSETS[ds], COL["g"], 2.0), ("非五十日 (対照)", NONG, COL["ng"], 1.5),
                        ("全営業日 (無条件)", ALLD, COL["all"], 1.2)]:
    t = trades(a, b, sel, +1)
    yen = pd.Series(0.0, index=BD)
    yen.loc[t.index] = t["yen"].values
    ax.plot(BD, yen.cumsum(), color=c, lw=lw, label=lab)
if (a, b, ds) != APRIORI[1:]:
    t = TR[APRIORI]
    yen = pd.Series(0.0, index=BD)
    yen.loc[t.index] = t["yen"].values
    ax.plot(BD, yen.cumsum(), color=COL["c5"], lw=1.3, ls="--", label="事前仮説: 全五十日 08:00→10:00")
shade_oos(ax, BD[-1])
ax.axhline(0, color="black", lw=0.6)
ax.set_title(f"仲値前ロング {hhmm(a)}→{hhmm(b)} の累積損益 (1万通貨/回, スプレッド 0.2 銭控除)  ※Yahoo 指標レート. GMO の約定値ではない")
ax.set_ylabel("累積損益 (円)")
ax.grid(alpha=0.3)
ax.legend(loc="upper left", fontsize=9)
ax = axes[1]
fam2, a2, b2, ds2 = SEL["仲値後ショート"]
for lab, sel, c, lw in [(f"{ds2} (凍結)", DAYSETS[ds2], COL["g"], 2.0), ("非五十日 (対照)", NONG, COL["ng"], 1.5),
                        ("全営業日 (無条件)", ALLD, COL["all"], 1.2)]:
    t = trades(a2, b2, sel, -1)
    yen = pd.Series(0.0, index=BD)
    yen.loc[t.index] = t["yen"].values
    ax.plot(BD, yen.cumsum(), color=c, lw=lw, label=lab)
shade_oos(ax, BD[-1])
ax.axhline(0, color="black", lw=0.6)
ax.set_title(f"仲値後ショート {hhmm(a2)}→{hhmm(b2)} の累積損益 (1万通貨/回, 0.2 銭控除)")
ax.set_ylabel("累積損益 (円)")
ax.grid(alpha=0.3)
ax.legend(loc="upper left", fontsize=9)
plt.tight_layout()
plt.show()

# 図2: 平均的な 1 日の値動き (07:00 始値基準, 銭)
path = PC.sub(PO[0], axis=0) * 100           # 列 k = (07:00+k+1 時) の価格 − 07:00 始値
path.insert(0, -1, 0.0)
path = path.loc[PO[0].notna(), list(range(-1, 22))]  # 07:00 足のある日 (月曜は除外), 翌 05:00 まで
xs = np.arange(7, 7 + 23)                   # 07:00 〜 翌 05:00 (金曜深夜の欠損で標本が変わる 05 時以降は描かない)
fig, axes = plt.subplots(1, 2, figsize=(14, 5.5), sharey=True)
for ax, (per, msk) in zip(axes, [("IS", IS), ("OOS", OOS)]):
    for lab, m, c in [("五十日", GOTO, COL["g"]), ("非五十日", NONG, COL["ng"])]:
        sub = path[(m & msk).reindex(path.index).values]
        mu, se = sub.mean(), sub.std(ddof=1) / np.sqrt(sub.notna().sum())
        ax.plot(xs, mu.values, color=c, lw=2, marker="o", ms=3, label=f"{lab} (n={len(sub)})")
        ax.fill_between(xs, (mu - se).values, (mu + se).values, color=c, alpha=0.15)
    ax.axvline(9 + 55 / 60, color="black", ls=":", lw=1.2, label="仲値 9:55")
    ax.axvspan(9, 15, color=COL["c3"], alpha=0.06, label="東京 09-15時")
    ax.axhline(0, color="black", lw=0.6)
    ax.set_xticks(xs[::2])
    ax.set_xticklabels([f"{x % 24}時" for x in xs[::2]], fontsize=8)
    ax.set_title(f"USD/JPY の平均経路 ({per}: {'〜' + str((SPLIT - pd.Timedelta(days=1)).date()) if per == 'IS' else str(SPLIT.date()) + '〜'})")
    ax.set_xlabel("時刻 (JST, 07:00 始値を 0 とした変化. 帯は ±1 標準誤差)")
    ax.grid(alpha=0.3)
    ax.legend(loc="lower left", fontsize=8)
axes[0].set_ylabel("07:00 からの変化 (銭)")
plt.tight_layout()
plt.show()

# 図3: 5 分足 08:00〜12:00 の平均経路
p5path = QC.sub(QO[0], axis=0) * 100
xm = 8 + (np.arange(0, 240, 5) + 5) / 60
fig, ax = plt.subplots(figsize=(12, 5))
for lab, m, c in [("五十日", g5, COL["g"]), ("非五十日", ~g5, COL["ng"])]:
    sub = p5path[m]
    mu, se = sub.mean(), sub.std(ddof=1) / np.sqrt(sub.notna().sum())
    ax.plot(xm, mu.values, color=c, lw=2, label=f"{lab} (n={len(sub)})")
    ax.fill_between(xm, (mu - se).values, (mu + se).values, color=c, alpha=0.15)
ax.axvline(9 + 55 / 60, color="black", ls=":", lw=1.2, label="仲値 9:55")
ax.axhline(0, color="black", lw=0.6)
ax.set_xticks(np.arange(8, 12.01, 0.5))
ax.set_xticklabels([f"{int(x)}:{int(round((x % 1) * 60)):02d}" for x in np.arange(8, 12.01, 0.5)])
ax.set_title(f"5 分足: 08:00 始値からの平均変化 ({BD5[0].date()}〜{BD5[-1].date()}, 全て OOS 期間. 標本が小さく参考値)")
ax.set_ylabel("08:00 からの変化 (銭)")
ax.set_xlabel("時刻 (JST). 帯は ±1 標準誤差")
ax.grid(alpha=0.3)
ax.legend(loc="lower left", fontsize=9)
plt.tight_layout()
plt.show()

# 図4: 時間帯ドリフト (買い方向, 0.2 銭控除, 1万通貨)
fig, ax = plt.subplots(figsize=(12, 6))
for (nm, c) in zip(SESS, [COL["c4"], COL["g"], COL["c3"], COL["ng"]]):
    t = SESS_TR[(nm, +1)]
    yen = pd.Series(0.0, index=BD)
    yen.loc[t.index] = t["yen"].values
    ax.plot(BD, yen.cumsum(), color=c, lw=1.6, label=f"{nm} 毎日買い")
shade_oos(ax, BD[-1])
ax.axhline(0, color="black", lw=0.6)
ax.set_title("時間帯ドリフト: 各時間帯に毎営業日 USD/JPY を買った場合の累積損益 (1万通貨, 0.2 銭控除, スワップなし)")
ax.set_ylabel("累積損益 (円)")
ax.grid(alpha=0.3)
ax.legend(loc="upper left", fontsize=9)
plt.tight_layout()
plt.show()

# ----------------------------------------------------------------------------------------------
# 15. 結論
# ----------------------------------------------------------------------------------------------
hr("12. 結論 (取引可能なのは「実行可能」な凍結ルールのみ. リーク版は比較用)")


def verdict(so: dict, dsr: float) -> str:
    if so["Sharpe"] > 0.5 and so["t値"] > 2 and dsr > 0.95:
        return "有望"
    if so["Sharpe"] > 0 and so["純 銭/回"] > 0:
        return "微妙 (OOS はプラスだが統計的に弱い/多重検定に耐えない)"
    return "不採算"


for lab, key in FOCUS.items():
    fam, a, b, ds = key
    si, so = stat(TR[key], IS), stat(TR[key], OOS)
    dsr = DT.iloc[list(FOCUS).index(lab)]["DSR(32試行)"]
    print(f"- {lab} [{ds} {hhmm(a)}→{hhmm(b)} {'買い' if fam == '仲値前ロング' else '売り'}]: "
          f"IS {si['純 銭/回']:+.2f} 銭/回 (Sharpe {si['Sharpe']:.2f}, {si['取引数']} 回) → "
          f"OOS {so['純 銭/回']:+.2f} 銭/回 (Sharpe {so['Sharpe']:.2f}, t={so['t値']:.2f}, {so['取引数']} 回, "
          f"1万通貨で {so['1万通貨 累計円']:+,.0f} 円). DSR={dsr:.2f} → 判定: {verdict(so, dsr)}")
nm_s, sd_s = SESS_SEL
si, so = stat(SESS_TR[SESS_SEL], IS), stat(SESS_TR[SESS_SEL], OOS)
dsr = DT.iloc[-1]["DSR(32試行)"]
print(f"- 凍結(時間帯) [{nm_s} {'買い' if sd_s > 0 else '売り'}]: IS Sharpe {si['Sharpe']:.2f} → OOS {so['純 銭/回']:+.2f} 銭/日 "
      f"(Sharpe {so['Sharpe']:.2f}, t={so['t値']:.2f}). DSR={dsr:.2f} → 判定: {verdict(so, dsr)}")
print(f"- 試した候補の総数: 五十日 {len(CANDS)} + 時間帯 8 = {N_TRIALS} (他に対照・内訳・夏冬別・5 分足・リーク版を参考表示.\n"
      "  内訳・夏冬別などの事後的な切り口は選択に使っておらず、たまたま良く見える区分があっても多重検定の外側なので信用しないこと).")

# 要点 (数値は上の表から)
w = WT.loc[("仲値前ロング", "08:00→10:00", "全期間")]
pp = PT.loc[("仲値前ロング", "08:00→10:00", "全期間"), "並べ替え p(片側)"]
r_is = PT.loc[("仲値後ショート", "10:00→12:00", "IS")]
r_oos = PT.loc[("仲値後ショート", "10:00→12:00", "OOS")]
q = Q5.loc[("08:00→09:55 買い", "五十日")]
qn = Q5.loc[("08:00→09:55 買い", "非五十日")]
print("\n【要点】")
print(f"  1) 仲値前の上昇: 08:00→10:00 の平均は 五十日 {w['五十日 粗銭']:+.2f} 銭 vs 非五十日 {w['非五十日 粗銭']:+.2f} 銭 "
      f"(差 {w['差 銭']:+.2f} 銭, Welch p={w['p(両側)']:.2f}, 並べ替え p={pp:.2f}). 2023-12〜2026-10 の Yahoo データでは五十日効果は検出できない.")
print(f"  2) 仲値後の下落: 10:00→12:00 売りは IS で五十日効果 {r_is['回帰 五十日効果 銭']:+.1f} 銭 (並べ替え p={r_is['並べ替え p(片側)']:.3f}) "
      f"だったが OOS では {r_oos['回帰 五十日効果 銭']:+.1f} 銭 (p={r_oos['並べ替え p(片側)']:.2f}) と消滅. IS の有意性は偶然/過剰適合と見るのが妥当.")
print(f"  3) 5 分足 (OOS 内の直近 {int(q['回数'])} 回の五十日): 08:00→09:55 買いは {q['粗 銭/回']:+.1f} 銭 (t={q['t値']:.2f}), "
      f"非五十日 {qn['粗 銭/回']:+.1f} 銭. 向きは仮説通りだが標本が小さく有意ではなく、高値の時刻も 9:55 に集中しない.")
print(f"  4) 時間帯ドリフト: 東京時間と海外時間の差は {_dd.mean():+.2f} 銭/時 (t={stats.ttest_1samp(_dd, 0).statistic:.2f}). "
      "「東京時間の円高」も「自国通貨安」も、コスト以前に統計的な偏りとして確認できない.")
print("  5) コスト (0.2 銭) は 1 時間の値動き (標準偏差 10〜20 銭) に比べて小さく、儲からない原因はコストではなく『期待値が無い』こと.\n"
      "     ただし 07:00/08:00 の早朝は原則固定スプレッドの対象外で、実際のコストは 0.2 銭より大きい可能性が高い.")
print(f"\n所要時間 {time.time() - T0:.1f} 秒")
