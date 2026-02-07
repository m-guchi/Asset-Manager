import { getServerSession } from "next-auth"
import { authOptions } from "@/auth"
import { redirect } from "next/navigation"

export async function getCurrentUserId(): Promise<string> {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
        redirect("/asset-manager/login")
    }

    return session.user.id
}

export async function getCurrentUser() {
    const session = await getServerSession(authOptions)
    return session?.user ?? null
}
