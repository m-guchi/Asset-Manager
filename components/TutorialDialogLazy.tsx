"use client"

import dynamic from "next/dynamic"

export const TutorialDialogLazy = dynamic(
    () => import("@/components/TutorialDialog").then(m => m.TutorialDialog),
    { ssr: false }
)
