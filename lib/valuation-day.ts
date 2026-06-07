export function getCalendarDayKey(date: Date): string {
    return date.toISOString().slice(0, 10)
}

export function getUtcDayBounds(dayKey: string): { start: Date; end: Date } {
    return {
        start: new Date(`${dayKey}T00:00:00.000Z`),
        end: new Date(`${dayKey}T23:59:59.999Z`),
    }
}

export function normalizeRecordDate(date: Date): Date {
    const dayKey = getCalendarDayKey(date)
    return new Date(`${dayKey}T12:00:00.000Z`)
}
