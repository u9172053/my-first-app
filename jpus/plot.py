"""損益グラフ表示 (画面表示のみ. ファイル保存はしない)."""
from __future__ import annotations

import japanize_matplotlib  # noqa: F401  日本語フォント
import matplotlib.pyplot as plt
import pandas as pd


def plot_pnl(curves: dict[str, pd.Series], title: str, oos_start: str | pd.Timestamp | None = None,
             ylabel: str = "累積損益 (%, 単利)", show: bool = True, ax=None):
    """日次リターン系列の dict を受け取り、累積損益 (単利, %) を描画して plt.show()."""
    own = ax is None
    if own:
        fig, ax = plt.subplots(figsize=(12, 6))
    x_end = None
    for name, r in curves.items():
        r = pd.Series(r).fillna(0.0)
        ax.plot(r.index, 100 * r.cumsum(), label=name, lw=1.3)
        if len(r):
            x_end = r.index[-1] if x_end is None else max(x_end, r.index[-1])
    if oos_start is not None and x_end is not None:
        ax.axvline(pd.Timestamp(oos_start), color="gray", ls="--", lw=1)
        # 日付軸のまま網掛け (get_xlim() の数値と Timestamp を混ぜると軸が 1970 年まで伸びる)
        ax.axvspan(pd.Timestamp(oos_start), x_end, color="gray", alpha=0.08, label="アウトオブサンプル")
    ax.axhline(0, color="black", lw=0.6)
    ax.set_title(title)
    ax.set_ylabel(ylabel)
    ax.grid(alpha=0.3)
    ax.legend(loc="upper left", fontsize=9)
    if own:
        plt.tight_layout()
        if show:
            plt.show()
    return ax


def plot_bar(values: pd.Series, title: str, xlabel: str = "", ylabel: str = "", show: bool = True):
    fig, ax = plt.subplots(figsize=(12, 5))
    v = pd.Series(values)
    ax.bar(range(len(v)), v.values, color=["tab:blue" if x >= 0 else "tab:red" for x in v.values])
    ax.set_xticks(range(len(v)))
    ax.set_xticklabels([str(i) for i in v.index], rotation=70, fontsize=8)
    ax.axhline(0, color="black", lw=0.6)
    ax.set_title(title)
    ax.set_xlabel(xlabel)
    ax.set_ylabel(ylabel)
    ax.grid(alpha=0.3, axis="y")
    plt.tight_layout()
    if show:
        plt.show()
    return ax
