import { DefaultSession } from "next-auth"

declare module "next-auth" {
    interface Session {
        user: {
            id: string
            hasCompletedTutorial: boolean
        } & DefaultSession["user"]
    }

    interface User {
        id: string
        hasCompletedTutorial: boolean
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        id: string
        hasCompletedTutorial: boolean
    }
}
