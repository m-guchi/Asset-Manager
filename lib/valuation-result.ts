export type ValuationWriteResult =
    | { success: true }
    | { success: false; error?: string }
    | { needsConfirmation: true; existingValue: number; dayKey: string }

export function isValuationNeedsConfirmation(
    result: ValuationWriteResult
): result is { needsConfirmation: true; existingValue: number; dayKey: string } {
    return "needsConfirmation" in result && result.needsConfirmation
}

export function isValuationSuccess(
    result: ValuationWriteResult
): result is { success: true } {
    return "success" in result && result.success
}

export function isValuationFailure(
    result: ValuationWriteResult
): result is { success: false; error?: string } {
    return "success" in result && !result.success
}
