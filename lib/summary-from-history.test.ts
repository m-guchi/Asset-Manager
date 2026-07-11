import { describe, it } from "node:test"
import assert from "node:assert/strict"
import type { HistoryPoint } from "@/types/asset"
import { computePortfolioPerformanceFromHistory } from "./summary-from-history"

function point(date: string, totalAssets: number, totalCost: number, totalRealizedGain = 0): HistoryPoint {
    return { date, totalAssets, totalCost, totalRealizedGain, timestamp: new Date(`${date}T00:00:00+09:00`).getTime() }
}

describe("computePortfolioPerformanceFromHistory", () => {
    it("売却で含み損益が実現益へ移っただけでは損益額推移を変動させない", () => {
        // 前日: 評価額1200・取得額1000（含み益200）、実現益0
        // 当日: 売却により評価額・取得額とも0（現金化）、実現益200
        //   → 含み益200が実現益200へ移っただけで、実質的な損益は変化していない
        const history = [
            point("2026-07-10", 1200, 1000, 0),
            point("2026-07-11", 0, 0, 200),
        ]
        const { dailyChange } = computePortfolioPerformanceFromHistory(history)
        assert.equal(dailyChange, 0)
    })

    it("実際の含み益・実現益の変化は推移に反映される", () => {
        const history = [
            point("2026-07-10", 1200, 1000, 0),
            point("2026-07-11", 1300, 1000, 0),
        ]
        const { dailyChange } = computePortfolioPerformanceFromHistory(history)
        assert.equal(dailyChange, 100)
    })
})
