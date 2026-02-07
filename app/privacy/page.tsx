"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"

export default function PrivacyPage() {
    return (
        <div className="container max-w-4xl py-10">
            <Card className="border-border/50 bg-card/50 backdrop-blur-xl">
                <CardHeader className="text-center pb-8">
                    <CardTitle className="text-3xl font-bold tracking-tight">プライバシーポリシー</CardTitle>
                </CardHeader>
                <CardContent>
                    <ScrollArea className="h-[600px] pr-4">
                        <div className="space-y-6 text-muted-foreground leading-relaxed">
                            <section>
                                <h2 className="text-xl font-semibold text-foreground mb-3">1. 個人情報の収集方法</h2>
                                <p>
                                    本サービスでは，ユーザーがGoogleアカウントを使用してログインする際，Googleから提供される名前，メールアドレス，プロフィール画像等の情報を取得します。
                                </p>
                            </section>

                            <section>
                                <h2 className="text-xl font-semibold text-foreground mb-3">2. 個人情報の利用目的</h2>
                                <p>
                                    収集した個人情報は，以下の目的で利用されます。
                                </p>
                                <ul className="list-disc pl-6 mt-2 space-y-1">
                                    <li>本サービスの提供・運営のため</li>
                                    <li>ユーザーからの重要なお問い合わせに回答するため</li>
                                    <li>メンテナンス，重要なお知らせなど必要に応じたご連絡のため</li>
                                    <li>利用規約に違反したユーザーの特定および利用をお断りするため</li>
                                </ul>
                            </section>

                            <section>
                                <h2 className="text-xl font-semibold text-foreground mb-3">3. 個人情報の第三者提供</h2>
                                <p>
                                    当社は，法令に基づき開示することが必要である場合を除き，ユーザーの同意を得ることなく第三者に個人情報を提供することはありません。
                                </p>
                            </section>

                            <section>
                                <h2 className="text-xl font-semibold text-foreground mb-3">4. 個人情報の管理</h2>
                                <p>
                                    当社は，ユーザーの個人情報の漏洩，滅失または毀損の防止その他の個人情報の安全管理のために必要かつ適切な措置を講じます。
                                </p>
                            </section>

                            <section>
                                <h2 className="text-xl font-semibold text-foreground mb-3">5. お問い合わせ窓口</h2>
                                <p>
                                    プライバシーポリシーに関するお問い合わせは，本サービス内のお問い合わせフォームまたは指定の連絡先までお願いいたします。
                                </p>
                            </section>
                        </div>
                    </ScrollArea>
                </CardContent>
            </Card>
        </div>
    )
}
