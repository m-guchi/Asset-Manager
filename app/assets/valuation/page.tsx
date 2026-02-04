"use client"

import React, { useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "sonner"
import { getCategories } from "@/app/actions/categories"
import { updateValuation } from "@/app/actions/assets"

export default function BulkValuationPage() {
    const router = useRouter()
    const [categories, setCategories] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [valuations, setValuations] = useState<Record<number, number>>({})
    const [recordedAt, setRecordedAt] = useState(new Date().toISOString().slice(0, 10))
    const [isSaving, setIsSaving] = useState(false)

    const fetchData = useCallback(async () => {
        setIsLoading(true)
        try {
            const catData = await getCategories()
            setCategories(catData)
        } catch (err) {
            console.error("Fetch error:", err)
            toast.error("データの取得に失敗しました")
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    const handleSave = async () => {
        setIsSaving(true)
        try {
            const dateObj = new Date(recordedAt)
            // Ensure time is set to noon to avoid timezone shift issues on the date part
            dateObj.setHours(12, 0, 0, 0)

            const entries = Object.entries(valuations)
            for (const [id, val] of entries) {
                await updateValuation(parseInt(id), val, dateObj)
            }

            toast.success("評価額を更新しました")
            setValuations({})
            fetchData()
            router.push('/assets') // 完了したら戻るか、留まるか。今回は一覧に戻るのが自然かもですが、連続入力も考慮して留まる選択肢もあり。とりあえず留まります。
        } catch (err) {
            toast.error("更新に失敗しました")
        } finally {
            setIsSaving(false)
        }
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">読み込み中...</span>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-6 p-4 md:p-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">一括評価額更新</h1>
                <p className="text-muted-foreground">
                    複数の資産の評価額を一度に更新します。
                </p>
            </div>

            <Card>
                <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <CardTitle>入力フォーム</CardTitle>
                    <div className="flex items-center gap-2">
                        <Label htmlFor="valuation-date" className="text-sm whitespace-nowrap">更新基準日:</Label>
                        <Input
                            id="valuation-date"
                            type="date"
                            className="w-[150px]"
                            value={recordedAt}
                            onChange={(e) => setRecordedAt(e.target.value)}
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>資産</TableHead>
                                <TableHead className="text-right">前回（現在）</TableHead>
                                <TableHead className="text-right">今回の評価額</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {categories.map((cat) => (
                                <TableRow key={cat.id}>
                                    <TableCell className="font-medium">{cat.name}</TableCell>
                                    <TableCell className="text-right opacity-50 text-xs">
                                        ¥{Number(cat.currentValue).toLocaleString()}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Input
                                            type="number"
                                            className="text-right w-32 ml-auto h-8"
                                            placeholder={cat.currentValue.toString()}
                                            value={valuations[cat.id] || ""}
                                            onChange={(e) => setValuations({ ...valuations, [cat.id]: parseFloat(e.target.value) })}
                                        />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
                <CardFooter className="flex justify-end border-t pt-4">
                    <Button disabled={isSaving || Object.keys(valuations).length === 0} onClick={handleSave}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {Object.keys(valuations).length}件の評価額を一括保存
                    </Button>
                </CardFooter>
            </Card>
        </div>
    )
}
