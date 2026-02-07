"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"

export default function TermsPage() {
    return (
        <div className="container max-w-4xl py-10">
            <Card className="border-border/50 bg-card/50 backdrop-blur-xl">
                <CardHeader className="text-center pb-8">
                    <CardTitle className="text-3xl font-bold tracking-tight">利用規約</CardTitle>
                </CardHeader>
                <CardContent>
                    <ScrollArea className="h-[600px] pr-4">
                        <div className="space-y-6 text-muted-foreground leading-relaxed">
                            <section>
                                <h2 className="text-xl font-semibold text-foreground mb-3">第1条（適用）</h2>
                                <p>
                                    この利用規約（以下，「本規約」といいます。）は，本サービスの提供条件及び本サービスの利用に関する当事者間の権利義務関係を定めるものです。ユーザーは，本サービスを利用することにより，本規約の全ての記載内容に同意したものとみなされます。
                                </p>
                            </section>

                            <section>
                                <h2 className="text-xl font-semibold text-foreground mb-3">第2条（利用登録）</h2>
                                <p>
                                    本サービスにおいては，登録希望者が本規約に同意の上，当社の定める方法によって利用登録を申請し，当社がこれを承認することによって，利用登録が完了するものとします。
                                </p>
                            </section>

                            <section>
                                <h2 className="text-xl font-semibold text-foreground mb-3">第3条（禁止事項）</h2>
                                <p>
                                    ユーザーは，本サービスの利用にあたり，以下の行為をしてはなりません。
                                </p>
                                <ul className="list-disc pl-6 mt-2 space-y-1">
                                    <li>法令または公序良俗に違反する行為</li>
                                    <li>犯罪行為に関連する行為</li>
                                    <li>本サービスの内容等，本サービスに含まれる著作権，商標権ほか知的財産権を侵害する行為</li>
                                    <li>当社のサーバーまたはネットワークの機能を破壊したり，妨害したりする行為</li>
                                    <li>本サービスによって得られた情報を商業的に利用する行為</li>
                                    <li>不正アクセスをし，またはこれを試みる行為</li>
                                </ul>
                            </section>

                            <section>
                                <h2 className="text-xl font-semibold text-foreground mb-3">第4条（本サービスの提供の停止等）</h2>
                                <p>
                                    当社は，以下のいずれかの事由があると判断した場合，ユーザーに事前に通知することなく本サービスの全部または一部の提供を停止または中断することができるものとします。
                                </p>
                                <ul className="list-disc pl-6 mt-2 space-y-1">
                                    <li>本サービスに係るコンピュータシステムの保守点検または更新を行う場合</li>
                                    <li>地震，落雷，火災，停電または天災などの不可抗力により，本サービスの提供が困難となった場合</li>
                                    <li>コンピュータまたは通信回線等が事故により停止した場合</li>
                                    <li>その他，当社が本サービスの提供が困難と判断した場合</li>
                                </ul>
                            </section>

                            <section>
                                <h2 className="text-xl font-semibold text-foreground mb-3">第5条（免責事項）</h2>
                                <p>
                                    当社は，本サービスに事実上または法律上の瑕疵（安全性，信頼性，正確性，完全性，有効性，特定の目的への適合性，セキュリティなどに関する欠陥，エラーやバグ，権利侵害などを含みます。）がないことを明示的にも黙示的にも保証しておりません。
                                </p>
                            </section>
                        </div>
                    </ScrollArea>
                </CardContent>
            </Card>
        </div>
    )
}
