"""取引所・証券会社ごとのコストモデル.

想定 (2026 年時点の各社公表条件をベースにした既定値. 改定されうるので実運用前に要確認):

[東証 現物/信用 × SBI証券 (オンライン, 電子交付設定済み)]
  - 売買手数料           : 0 円 (「ゼロ革命」. 現物・信用とも. 楽天証券ゼロコースも同条件)
  - 執行コスト(片道)     : 既定 5bp. 寄成/引成 (板寄せ) で約定させる前提なのでスプレッドは
                           払わないが、板寄せ価格への自己インパクト・気配のズレ分のバッファ.
  - 信用 買方金利        : 年 2.80% (制度信用). 日計りでも 1 日分かかる.
  - 信用 貸株料 (売り)   : 年 1.15% (制度信用). 逆日歩は考慮しない (別途リスク).
  - 税金                 : 考慮しない (譲渡益 20.315%)
  - 売買単位             : 100 株. 値嵩株は最低投資額が大きい (ここでは比率で計算)

[大阪取引所 日経225マイクロ先物 × SBI証券] (ヘッジ用の参考)
  - 手数料 11 円/枚 (税込), 1 枚 = 日経平均 × 10 円, 呼値 5 円

[FX: GMOクリック証券 FXネオ]
  - 手数料 0 円, USD/JPY スプレッド 0.2 銭 (原則固定・例外あり) = 往復で 0.002 円/USD
  - チャートは Yahoo の USD/JPY 指標レート (GMO の実レートではない) で近似
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd


@dataclass(frozen=True)
class TSECost:
    """東京証券取引所 × SBI証券 の 1 トレードあたりコスト (リターン比率)."""
    commission_rate: float = 0.0          # 片道手数料率 (ゼロ革命で 0)
    slippage_bps: float = 5.0             # 片道 執行コスト [bp]
    margin_buy_rate: float = 0.028        # 制度信用 買方金利 (年率)
    stock_loan_rate: float = 0.0115       # 制度信用 貸株料 (年率)
    use_margin_for_long: bool = False     # 買いを信用で建てるなら True (現物なら金利なし)

    def round_trip(self, side: int | np.ndarray | pd.Series = 1,
                   hold_days: int | np.ndarray | pd.Series = 1) -> np.ndarray | float:
        """往復コスト (リターン比率). side: +1 買い / -1 売り / 0 ノーポジ.

        hold_days: 信用金利・貸株料の日数 (暦日. 同日決済でも 1 日).
        """
        side = np.asarray(side, dtype=float)
        hold_days = np.maximum(np.asarray(hold_days, dtype=float), 1.0)
        base = 2 * (self.commission_rate + self.slippage_bps / 1e4)
        long_fin = (self.margin_buy_rate if self.use_margin_for_long else 0.0) * hold_days / 365
        short_fin = self.stock_loan_rate * hold_days / 365
        fin = np.where(side > 0, long_fin, np.where(side < 0, short_fin, 0.0))
        return np.where(side != 0, base + fin, 0.0)

    def with_slippage(self, bps: float) -> "TSECost":
        return TSECost(self.commission_rate, bps, self.margin_buy_rate, self.stock_loan_rate,
                       self.use_margin_for_long)


@dataclass(frozen=True)
class OSEMicroNikkeiCost:
    """大阪取引所 日経225マイクロ先物 × SBI証券."""
    fee_yen_per_lot: float = 11.0
    multiplier: float = 10.0
    tick: float = 5.0
    slippage_ticks: float = 1.0  # 往復で何 tick 不利に約定するか

    def round_trip(self, index_level: float | np.ndarray) -> np.ndarray | float:
        lvl = np.asarray(index_level, dtype=float)
        return (2 * self.fee_yen_per_lot / (lvl * self.multiplier)) + self.slippage_ticks * self.tick / lvl


@dataclass(frozen=True)
class GMOClickFXCost:
    """GMOクリック証券 FXネオ (USD/JPY)."""
    spread_yen: float = 0.002     # 0.2 銭 (往復でこの分だけ不利)
    extra_slip_yen: float = 0.0   # 指標時などのスリッページ追加

    def round_trip(self, price: float | np.ndarray) -> np.ndarray | float:
        return (self.spread_yen + self.extra_slip_yen) / np.asarray(price, dtype=float)


def calendar_hold_days(entry_dates: pd.Series | pd.DatetimeIndex, exit_dates: pd.Series | pd.DatetimeIndex) -> np.ndarray:
    """信用金利の日数 (暦日, 最低 1 日). 受渡日ベースの近似として約定日の差を使う."""
    e = pd.to_datetime(pd.Series(entry_dates)).values
    x = pd.to_datetime(pd.Series(exit_dates)).values
    d = (x - e).astype("timedelta64[D]").astype(float)
    return np.maximum(d, 1.0)
