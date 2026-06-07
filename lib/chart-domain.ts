export function clampDomainOffset(
    offset: number,
    dataMinTime: number,
    dataMaxTime: number
): number {
    let newOffset = offset
    if (newOffset > 0) newOffset = 0

    const minOffset = dataMinTime - dataMaxTime
    if (minOffset >= 0) {
        newOffset = 0
    } else if (newOffset < minOffset) {
        newOffset = minOffset
    }

    return newOffset
}

export function computeDomainOffsetForSelectedTimestamp(
    selectedTimestamp: number,
    timeRange: string,
    dataMinTime: number,
    dataMaxTime: number
): number {
    let offset: number
    if (timeRange === "ALL") {
        const dataRange = dataMaxTime - dataMinTime
        offset = selectedTimestamp - dataMaxTime - 0.1 * dataRange
    } else {
        offset = selectedTimestamp - dataMaxTime
    }

    return clampDomainOffset(offset, dataMinTime, dataMaxTime)
}
