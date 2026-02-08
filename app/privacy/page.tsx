"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"

export default function PrivacyPage() {
    return (
        <div className="container mx-auto max-w-4xl py-10 px-4">
            <Card className="border-border/50 bg-card/50 backdrop-blur-xl">
                <CardHeader className="text-center pb-8">
                    <CardTitle className="text-3xl font-bold tracking-tight">プライバシーポリシー</CardTitle>
                </CardHeader>
                <CardContent>
                    <ScrollArea className="h-[600px] pr-4">
                        <div className="space-y-6 text-muted-foreground leading-relaxed">
                            <section>
                                <h2 className="text-xl font-semibold text-foreground mb-3">1. 収集する情報</h2>
                                <p>
                                    本サービス（以下「当アプリ」）は、サービスの提供・向上のため、以下の情報を取得・利用します。
                                </p>
                                <ul className="list-disc pl-6 mt-2 space-y-1">
                                    <li><strong>アカウント情報:</strong> Google認証を通じて提供される名前、メールアドレス、プロフィール画像。</li>
                                    <li><strong>資産データ:</strong> ユーザーが入力した資産額、カテゴリ、取引履歴、メモ等。</li>
                                    <li><strong>技術的情報:</strong> ブラウザの種類、IPアドレス、Cookie（クッキー）、およびローカルストレージに保存されるセッション情報。</li>
                                </ul>
                            </section>

                            <section>
                                <h2 className="text-xl font-semibold text-foreground mb-3">2. 情報の利用目的</h2>
                                <p>
                                    取得した情報を、以下の目的の範囲内で利用します。
                                </p>
                                <ul className="list-disc pl-6 mt-2 space-y-1">
                                    <li>資産管理機能の提供とデータの永続的保存</li>
                                    <li>ユーザー認証とセキュリティの確保</li>
                                    <li>サービスに関する重要なお知らせやアップデート情報の通知</li>
                                    <li>利用状況の分析によるUX向上および機能改善</li>
                                </ul>
                            </section>

                            <section>
                                <h2 className="text-xl font-semibold text-foreground mb-3">3. データの安全性と管理</h2>
                                <p>
                                    当アプリは、ユーザーデータの安全性を最優先事項として扱い、以下の措置を講じます。
                                </p>
                                <ul className="list-disc pl-6 mt-2 space-y-1">
                                    <li><strong>暗号化:</strong> 通信はSSL/TLSによって暗号化され、データベースへのアクセスは厳格に制限されています。</li>
                                    <li><strong>認証保護:</strong> JWT（JSON Web Token）および安全なCookieを利用し、なりすましや不正アクセスを防止します。</li>
                                    <li><strong>保存場所:</strong> ユーザーのデータは、信頼性の高いクラウドインフラストラクチャ上のMySQLデータベースに安全に保存されます。</li>
                                </ul>
                            </section>

                            <section>
                                <h2 className="text-xl font-semibold text-foreground mb-3">4. 第三者への開示</h2>
                                <p>
                                    法令に基づき開示が必要な場合、または機密保持契約を締結した業務委託先に対してサービス運営に必要な範囲で開示する場合を除き、ユーザーの同意なく個人情報を第三者に提供することはありません。
                                </p>
                            </section>

                            <section>
                                <h2 className="text-xl font-semibold text-foreground mb-3">5. ユーザーの権利</h2>
                                <p>
                                    ユーザーは、設定画面から自身のプロフィール情報を編集し、またアカウント削除機能を利用して、収集されたすべてのデータをいつでも消去することができます。
                                </p>
                            </section>

                            <section>
                                <h2 className="text-xl font-semibold text-foreground mb-3">6. Google Analyticsの利用</h2>
                                <p>
                                    当アプリでは、利用状況の分析とサービス向上のため、Googleによるアクセス解析ツール「Googleアナリティクス」を利用しています。このGoogleアナリティクスはデータの収集のためにCookieを使用しています。このデータは匿名で収集されており、個人を特定するものではありません。
                                </p>
                            </section>

                            <section>
                                <h2 className="text-xl font-semibold text-foreground mb-3">7. 改定と連絡先</h2>
                                <p>
                                    本ポリシーは、必要に応じて更新されることがあります。重要な変更がある場合はアプリ内でお知らせします。ご質問は設定メニューの「フィードバック」または公式サポートまでお問い合わせください。
                                </p>
                            </section>
                        </div>
                    </ScrollArea>
                </CardContent>
            </Card>
        </div>
    )
}
