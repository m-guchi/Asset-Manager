"use client"

import * as React from "react"

import { Input } from "@/components/ui/input"

function toRawValue(input: string): string {
    let value = input.replace(/[^\d.-]/g, "")

    const isNegative = value.startsWith("-")
    value = value.replace(/-/g, "")

    const firstDot = value.indexOf(".")
    if (firstDot !== -1) {
        value = value.slice(0, firstDot + 1) + value.slice(firstDot + 1).replace(/\./g, "")
    }

    return (isNegative ? "-" : "") + value
}

function toDisplayValue(raw: string): string {
    if (raw === "" || raw === "-") return raw

    const isNegative = raw.startsWith("-")
    const unsigned = isNegative ? raw.slice(1) : raw
    const [integerPart, decimalPart] = unsigned.split(".")

    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
    const formatted = decimalPart !== undefined ? `${formattedInteger}.${decimalPart}` : formattedInteger

    return (isNegative ? "-" : "") + formatted
}

interface CurrencyInputProps
    extends Omit<React.ComponentProps<"input">, "value" | "onChange" | "type"> {
    value?: string | number
    onChange?: (value: string) => void
}

const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
    ({ value, onChange, ...props }, ref) => {
        const rawValue = value === undefined || value === null ? "" : String(value)

        return (
            <Input
                {...props}
                ref={ref}
                type="text"
                inputMode="decimal"
                value={toDisplayValue(rawValue)}
                onChange={(e) => onChange?.(toRawValue(e.target.value))}
            />
        )
    }
)
CurrencyInput.displayName = "CurrencyInput"

export { CurrencyInput }
