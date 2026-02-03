import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
    const categories = await prisma.category.findMany()
    console.log("Categories count:", categories.length)
    console.log("Categories sample:", categories.slice(0, 3).map(c => ({ id: c.id, name: c.name, parentId: c.parentId })))

    const assets = await prisma.asset.findMany()
    console.log("Assets count:", assets.length)
}

main().catch(console.error)
