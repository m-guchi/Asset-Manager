"use client"

import React from "react"
import {
    Dialog,
    DialogContent,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronRight, ChevronLeft } from "lucide-react"
import { TUTORIAL_STEPS } from "@/components/tutorial-steps"
import { useTutorial } from "@/components/tutorial-provider"

export function TutorialDialog() {
    const { open, currentStep, totalSteps, isLastStep, onOpenChange, next, back, skip } = useTutorial()

    if (!open) return null

    const step = TUTORIAL_STEPS[currentStep]

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
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
                                {step.icon}
                            </div>
                            <div className="space-y-4">
                                <h2 className="text-2xl font-bold tracking-tight text-foreground">
                                    {step.title}
                                </h2>
                                <p className="text-muted-foreground leading-relaxed px-4">
                                    {step.description}
                                </p>
                            </div>
                        </motion.div>
                    </AnimatePresence>

                    <div className="flex items-center gap-2 mt-8 mb-4">
                        {Array.from({ length: totalSteps }).map((_, i) => (
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
                                onClick={back}
                            >
                                <ChevronLeft className="mr-2 h-4 w-4" />
                                戻る
                            </Button>
                        )}
                        <Button
                            className="flex-1 rounded-2xl h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg shadow-primary/20 transition-all active:scale-[0.98]"
                            onClick={next}
                        >
                            {isLastStep ? "はじめる" : "次へ"}
                            {!isLastStep && <ChevronRight className="ml-2 h-4 w-4" />}
                        </Button>
                    </div>

                    {!isLastStep && (
                        <button
                            type="button"
                            onClick={skip}
                            className="mt-4 text-sm text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline"
                        >
                            スキップ
                        </button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
