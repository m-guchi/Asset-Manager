import type { ValuationCategoryRef } from "./types"

/** Zaimスクショ読込の対象（Zaim表示名が設定された項目のみ、valuationOrder順） */
export function filterZaimImportCategories(
    categories: ValuationCategoryRef[]
): ValuationCategoryRef[] {
    return categories.filter((c) => c.valuationAlias?.trim())
}
