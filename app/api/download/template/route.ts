import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    console.log("[API] Download template request received");
    const { searchParams } = new URL(req.url);
    const assetIdStr = searchParams.get('assetId');
    console.log(`[API] assetIdStr: ${assetIdStr}`);

    const assetId = assetIdStr && !isNaN(parseInt(assetIdStr)) ? parseInt(assetIdStr) : undefined;

    try {
        const header = "日付,入金額,出金額,売却額,評価額,メモ";
        const example1 = "2024-01-01,100000,,,,初期入金";
        const example2 = "2024-02-01,,,,105000,月次評価";
        const example3 = "2024-03-01,,10000,12000,,一部売却";

        const rows = [header, example1, example2, example3];
        let filename = "import_template";

        // Check if we need to append history for a specific asset
        if (assetId) {
            console.log(`[API] Fetching data for assetId: ${assetId}`);
            try {
                // Get Asset Name for filename
                const category = await prisma.category.findUnique({
                    where: { id: assetId },
                    select: { name: true }
                });

                if (category) {
                    filename = `template_${category.name}`;
                }

                // Fetch recent history for this asset
                const transactions = await prisma.transaction.findMany({
                    where: { categoryId: assetId },
                    orderBy: { transactedAt: 'desc' },
                    take: 10
                });
                const valuations = await prisma.asset.findMany({
                    where: { categoryId: assetId },
                    orderBy: { recordedAt: 'desc' },
                    take: 10
                });

                if (transactions.length > 0 || valuations.length > 0) {
                    // Add spacer
                    rows.push("");
                    rows.push("--- 以下は現在の登録データ（参考） ---");
                    rows.push(header);

                    const history: { date: Date, deposit: string, withdraw: string, sell: string, val: string, memo: string }[] = [];

                    transactions.forEach(t => {
                        const isDeposit = t.type === 'DEPOSIT';
                        const isWithdraw = t.type === 'WITHDRAW';
                        let sell = "";
                        if (isWithdraw && t.realizedGain !== null) {
                            sell = (t.realizedGain + t.amount).toString();
                        }

                        history.push({
                            date: t.transactedAt,
                            deposit: isDeposit ? t.amount.toString() : "",
                            withdraw: isWithdraw ? t.amount.toString() : "",
                            sell: sell,
                            val: "",
                            memo: t.memo || ""
                        });
                    });

                    valuations.forEach(v => {
                        history.push({
                            date: v.recordedAt,
                            deposit: "",
                            withdraw: "",
                            sell: "",
                            val: v.currentValue.toString(),
                            memo: "(評価額履歴)"
                        });
                    });

                    // Sort descending
                    history.sort((a, b) => b.date.getTime() - a.date.getTime());

                    history.forEach(h => {
                        rows.push([
                            h.date.toISOString().split('T')[0],
                            h.deposit,
                            h.withdraw,
                            h.sell,
                            h.val,
                            h.memo
                        ].join(","));
                    });
                }
            } catch (e) {
                console.error("[API] Failed to fetch history for template:", e);
                // Continue generating template without history
            }
        }

        const csvContent = rows.join("\n");
        // Add BOM for Excel compatibility
        const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
        const finalCsv = Buffer.concat([Buffer.from(bom), Buffer.from(csvContent, 'utf-8')]);

        // Encode filename for Content-Disposition (Handle Japanese characters)
        const encodedFilename = encodeURIComponent(filename + ".csv");
        console.log(`[API] Returning CSV: ${filename}.csv, Size: ${finalCsv.length} bytes`);

        const response = new NextResponse(finalCsv);
        response.headers.set('Content-Type', 'text/csv; charset=utf-8');
        // Fallback filename and UTF-8 filename
        response.headers.set('Content-Disposition', `attachment; filename="${filename}.csv"; filename*=UTF-8''${encodedFilename}`);

        return response;

    } catch (error) {
        console.error("[API] Template generation error:", error);
        return new NextResponse("Failed to generate template: " + String(error), { status: 500, headers: { 'Content-Type': 'text/plain' } });
    }
}
