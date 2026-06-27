export const JST_TIMEZONE = "Asia/Tokyo"

/** 早朝の一括入力では前日をデフォルトにする（JST 9時未満） */
export const EARLY_MORNING_CUTOFF_HOUR_JST = 9

export function getCalendarDayKey(date: Date): string {
    return date.toLocaleDateString("en-CA", { timeZone: JST_TIMEZONE })
}

export function getJstDayBounds(dayKey: string): { start: Date; end: Date } {
    return {
        start: new Date(`${dayKey}T00:00:00+09:00`),
        end: new Date(`${dayKey}T23:59:59.999+09:00`),
    }
}

/** @deprecated Use getJstDayBounds */
export function getUtcDayBounds(dayKey: string): { start: Date; end: Date } {
    return getJstDayBounds(dayKey)
}

export function addCalendarDays(isoDate: string, deltaDays: number): string {
    const [y, m, d] = isoDate.slice(0, 10).split("-").map(Number)
    const utc = Date.UTC(y, m - 1, d) + deltaDays * 86400000
    return new Date(utc).toISOString().slice(0, 10)
}

function getJstHour(date: Date): number {
    return Number(
        date.toLocaleString("en-US", {
            timeZone: JST_TIMEZONE,
            hour: "numeric",
            hour12: false,
        })
    )
}

export function getTodayDateInput(now = new Date()): string {
    return getCalendarDayKey(now)
}

/** 一括評価額入力のデフォルト日付（早朝は前日を返す） */
export function getDefaultValuationDateInput(now = new Date()): string {
    const today = getTodayDateInput(now)
    if (getJstHour(now) < EARLY_MORNING_CUTOFF_HOUR_JST) {
        return addCalendarDays(today, -1)
    }
    return today
}

export function normalizeRecordDate(date: Date): Date {
    const dayKey = getCalendarDayKey(date)
    return new Date(`${dayKey}T12:00:00+09:00`)
}

export function parseValuationDateInput(dateInput: string | Date): Date {
    if (dateInput instanceof Date) {
        return normalizeRecordDate(dateInput)
    }

    const dayKey = dateInput.slice(0, 10)
    return new Date(`${dayKey}T12:00:00+09:00`)
}

export function formatCalendarDayKey(dayKey: string): string {
    const date = parseValuationDateInput(dayKey)
    return date.toLocaleDateString("ja-JP", {
        timeZone: JST_TIMEZONE,
        year: "numeric",
        month: "long",
        day: "numeric",
    })
}
