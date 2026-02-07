import { getServerSession } from "next-auth"
import { authOptions } from "@/auth"

export async function getCurrentUserId(): Promise<string> {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
        throw new Error("Unauthorized: User not authenticated")
    }

    return session.user.id
}

export async function getCurrentUser() {
    const session = await getServerSession(authOptions)
    return session?.user ?? null
}
