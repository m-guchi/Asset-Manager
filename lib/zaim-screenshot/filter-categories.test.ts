import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { filterZaimImportCategories } from "./filter-categories"
import type { ValuationCategoryRef } from "./types"

describe("filterZaimImportCategories", () => {
    it("returns only categories with valuationAlias", () => {
        const categories: ValuationCategoryRef[] = [
            { id: 1, name: "NTT", valuationAlias: "NTT" },
            { id: 2, name: "現金", valuationAlias: null },
            { id: 3, name: "楽天", valuationAlias: "  楽天  " },
        ]

        const filtered = filterZaimImportCategories(categories)

        assert.equal(filtered.length, 2)
        assert.deepEqual(filtered.map((c) => c.id), [1, 3])
    })
})
