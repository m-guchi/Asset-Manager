import { cache } from "react"
import { getServerSession } from "next-auth"
import { authOptions } from "@/auth"

export const getCurrentUserId = cache(async (): Promise<string | null> => {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
        return null
    }

    return session.user.id
})

export const getCurrentUser = cache(async () => {
    const session = await getServerSession(authOptions)
    return session?.user ?? null
})
