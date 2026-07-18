"use client"

import React from "react"
import { useSession } from "next-auth/react"
import { completeTutorial } from "@/app/actions/user-actions"
import { TUTORIAL_STEPS } from "@/components/tutorial-steps"

type TutorialContextValue = {
    open: boolean
    currentStep: number
    totalSteps: number
    isLastStep: boolean
    onOpenChange: (open: boolean) => void
    next: () => void
    back: () => void
    skip: () => void
    /** 完了済みでも、設定画面などから改めてチュートリアルを開く */
    openTutorial: () => void
}

const TutorialContext = React.createContext<TutorialContextValue | null>(null)

export function useTutorial() {
    const ctx = React.useContext(TutorialContext)
    if (!ctx) {
        throw new Error("useTutorial は TutorialProvider の内側で使用してください")
    }
    return ctx
}

export function TutorialProvider({ children }: { children: React.ReactNode }) {
    const { data: session, update } = useSession()
    const [open, setOpen] = React.useState(false)
    const [currentStep, setCurrentStep] = React.useState(0)

    // 初回ログイン時（チュートリアル未完了）は自動的に開く
    React.useEffect(() => {
        if (session?.user && !session.user.hasCompletedTutorial) {
            setOpen(true)
        }
    }, [session])

    const complete = React.useCallback(async () => {
        setOpen(false)
        // 再表示のみのときは、完了済みフラグの再更新をスキップする
        if (session?.user && !session.user.hasCompletedTutorial) {
            await completeTutorial()
            await update({ hasCompletedTutorial: true })
        }
    }, [session, update])

    const next = React.useCallback(() => {
        if (currentStep < TUTORIAL_STEPS.length - 1) {
            setCurrentStep(step => step + 1)
        } else {
            complete()
        }
    }, [currentStep, complete])

    const back = React.useCallback(() => {
        setCurrentStep(step => Math.max(0, step - 1))
    }, [])

    const openTutorial = React.useCallback(() => {
        setCurrentStep(0)
        setOpen(true)
    }, [])

    const onOpenChange = React.useCallback((nextOpen: boolean) => {
        if (nextOpen) {
            setOpen(true)
        } else {
            complete()
        }
    }, [complete])

    const value = React.useMemo<TutorialContextValue>(() => ({
        open,
        currentStep,
        totalSteps: TUTORIAL_STEPS.length,
        isLastStep: currentStep === TUTORIAL_STEPS.length - 1,
        onOpenChange,
        next,
        back,
        skip: complete,
        openTutorial,
    }), [open, currentStep, onOpenChange, next, back, complete, openTutorial])

    return (
        <TutorialContext.Provider value={value}>
            {children}
        </TutorialContext.Provider>
    )
}
