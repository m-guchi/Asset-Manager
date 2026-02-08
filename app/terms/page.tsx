"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"

export default function TermsPage() {
    return (
        <div className="container mx-auto max-w-4xl py-10 px-4">
            <Card className="border-border/50 bg-card/50 backdrop-blur-xl">
                <CardHeader className="text-center pb-8">
                    <CardTitle className="text-3xl font-bold tracking-tight">利用規約</CardTitle>
                </CardHeader>
                <CardContent>
                    <ScrollArea className="h-[600px] pr-4">
                        <div className="space-y-6 text-muted-foreground leading-relaxed">
                            <section>
                                <h2 className="text-xl font-semibold text-foreground mb-3">第1条（本サービスの目的と性質）</h2>
                                <p>
                                    1. 本サービスは、ユーザーの個人資産状況を可視化し、管理を補助することを目的としたツールです。<br />
                                    2. 本サービスが提供するデータ、グラフ、分析結果は、情報の正確性を期していますが、<strong>投資勧誘や特定の金融商品の売買を推奨するものではありません。</strong>最終的な投資判断は、ユーザー自身の責任において行ってください。
                                </p>
                            </section>

                            <section>
                                <h2 className="text-xl font-semibold text-foreground mb-3">第2条（利用登録とセキュリティ）</h2>
                                <p>
                                    1. ユーザーは、Google認証等の当アプリ指定の方法により、適正に利用登録を行うものとします。<br />
                                    2. 自身のログイン情報の管理はユーザーの自己責任であり、第三者による不正利用によって生じた損害について、当アプリは一切の責任を負いません。
                                </p>
                            </section>

                            <section>
                                <h2 className="text-xl font-semibold text-foreground mb-3">第3条（禁止事項）</h2>
                                <p>
                                    ユーザーは、本サービスの利用にあたり、以下の行為をしてはなりません。
                                </p>
                                <ul className="list-disc pl-6 mt-2 space-y-1">
                                    <li>虚偽の情報を登録、または他者になりすまして利用する行為</li>
                                    <li>逆コンパイルやスクレイピング等、本システムの解析や妨害を目的とした行為</li>
                                    <li>本サービスを反社会的勢力の活動に関連して利用する行為</li>
                                    <li>その他、運営が不適切と判断する行為</li>
                                </ul>
                            </section>

                            <section>
                                <h2 className="text-xl font-semibold text-foreground mb-3">第4条（サービスの中断・変更）</h2>
                                <p>
                                    保守点検、サーバー障害、天災、その他やむを得ない事由により、予告なくサービスの一部または全部を中断・変更することがあります。これによってユーザーに生じた不利益について、当アプリは責任を負いかねます。
                                </p>
                            </section>

                            <section>
                                <h2 className="text-xl font-semibold text-foreground mb-3">第5条（非保証・免責事項）</h2>
                                <p>
                                    1. 当アプリは、本サービスにバグ等の欠陥がないことや、特定の環境での動作を保証するものではありません。<br />
                                    2. 本サービスを利用したこと、または利用できなかったことにより生じた直接的、間接的な損害について、当アプリに故意または重大な過失がある場合を除き、一切の責任を負いません。
                                </p>
                            </section>

                            <section>
                                <h2 className="text-xl font-semibold text-foreground mb-3">第6条（データの管理と削除）</h2>
                                <p>
                                    当アプリは、ユーザーが削除したデータの復旧には応じられません。重要な資産記録については、適宜ご自身でバックアップ等を行うことを推奨します。
                                </p>
                            </section>
                        </div>
                    </ScrollArea>
                </CardContent>
            </Card>
        </div>
    )
}
