"use client"

import React from "react"
import {
    Dialog,
    DialogContent,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { motion, AnimatePresence } from "framer-motion"
import { Logo } from "@/components/Logo"
import { Wallet, History, ChevronRight, ChevronLeft, Sparkles } from "lucide-react"
import { completeTutorial } from "@/app/actions/user-actions"
import { useSession } from "next-auth/react"

const steps = [
    {
        title: "ようこそ",
        description: "あなたの資産の推移と構成を管理するためのデモデータを用意しました。このデータを使って、使いかたを簡単にご案内します。",
        icon: <Logo className="h-16 w-16 text-primary" />,
    },
    {
        title: "資産の確認",
        description: "「銀行預金」「S&P500」「個別株」といったカテゴリがすでに作成されています。これらは親子の階層構造で管理することも可能です。",
        icon: <Wallet className="h-12 w-12 text-blue-500" />,
    },
    {
        title: "履歴と推移",
        description: "元本や評価額の変動を記録できます。これにより、ダッシュボードでは美しい資産推移グラフが表示されます。",
        icon: <History className="h-12 w-12 text-purple-500" />,
    },
    {
        title: "タグによる分析",
        description: "「現金」「株式」といった分類タグが設定されています。資産のバランスを一目で把握できます。",
        icon: <Sparkles className="h-12 w-12 text-emerald-500" />,
    }
]

export function TutorialDialog() {
    const { data: session, update } = useSession()
    const [currentStep, setCurrentStep] = React.useState(0)
    const [open, setOpen] = React.useState(false)

    React.useEffect(() => {
        if (session?.user && !session.user.hasCompletedTutorial) {
            setOpen(true)
        }
    }, [session])

    const handleNext = () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(s => s + 1)
        } else {
            handleComplete()
        }
    }

    const handleBack = () => {
        if (currentStep > 0) {
            setCurrentStep(s => s - 1)
        }
    }

    const handleComplete = async () => {
        await completeTutorial()
        // セッションを更新して、次から表示されないようにする
        await update({ hasCompletedTutorial: true })
        setOpen(false)
    }

    if (!open) return null

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden bg-background/95 backdrop-blur-2xl border-border/40 shadow-2xl">
                <div className="relative p-8 flex flex-col items-center text-center">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentStep}
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -10 }}
                            transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                            className="flex flex-col items-center gap-6 py-4 w-full"
                        >
                            <div className="p-5 rounded-[2rem] bg-gradient-to-br from-primary/10 to-primary/5 ring-1 ring-primary/20 shadow-inner">
                                {steps[currentStep].icon}
                            </div>
                            <div className="space-y-4">
                                <h2 className="text-2xl font-bold tracking-tight text-foreground">
                                    {steps[currentStep].title}
                                </h2>
                                <p className="text-muted-foreground leading-relaxed px-4">
                                    {steps[currentStep].description}
                                </p>
                            </div>
                        </motion.div>
                    </AnimatePresence>

                    <div className="flex items-center gap-2 mt-8 mb-4">
                        {steps.map((_, i) => (
                            <div
                                key={i}
                                className={`h-1.5 rounded-full transition-all duration-500 ${i === currentStep
                                    ? "w-8 bg-primary"
                                    : "w-1.5 bg-primary/20"
                                    }`}
                            />
                        ))}
                    </div>

                    <div className="flex w-full gap-3 mt-6">
                        {currentStep > 0 && (
                            <Button
                                variant="ghost"
                                className="flex-1 rounded-2xl h-12 text-muted-foreground hover:text-foreground transition-all"
                                onClick={handleBack}
                            >
                                <ChevronLeft className="mr-2 h-4 w-4" />
                                戻る
                            </Button>
                        )}
                        <Button
                            className="flex-1 rounded-2xl h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg shadow-primary/20 transition-all active:scale-[0.98]"
                            onClick={handleNext}
                        >
                            {currentStep === steps.length - 1 ? "はじめる" : "次へ"}
                            {currentStep !== steps.length - 1 && <ChevronRight className="ml-2 h-4 w-4" />}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
