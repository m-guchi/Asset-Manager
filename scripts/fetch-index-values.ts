import { prisma } from "../lib/prisma"
import { syncIndexValues } from "../lib/index-values-sync"

async function main() {
    const indices = await prisma.index.findMany()
    if (indices.length === 0) {
        console.log("登録済みの指数がありません")
        return
    }

    for (const index of indices) {
        try {
            const existingCount = await prisma.indexValue.count({ where: { indexId: index.id } })
            const count = await syncIndexValues(index.id, index.symbol, existingCount > 0 ? "5d" : "max")
            console.log(`✅ ${index.name} (${index.symbol}): ${count}件を取得`)
        } catch (error) {
            console.error(`❌ ${index.name} (${index.symbol}) の取得に失敗`, error)
        }
    }
}

main()
    .catch((error) => {
        console.error(error)
        process.exitCode = 1
    })
    .finally(() => prisma.$disconnect())
