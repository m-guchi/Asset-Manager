
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Checking '生活防衛' related data...");

    // 1. Get the tag
    const tag = await prisma.tag.findFirst({
        where: { name: { contains: '生活防衛' } },
        include: { categories: true }
    });

    if (!tag) {
        console.log("No tag found matching '生活防衛'");
        return;
    }

    console.log(`Tag found: ${tag.name} (ID: ${tag.id})`);
    console.log(`Categories with this tag: ${tag.categories.length}`);

    // Check Tag Groups
    const groups = await prisma.tagGroup.findMany({
        include: { tags: true }
    });
    console.log(`\n--- TAG GROUPS ---`);
    for (const group of groups) {
        console.log(`Group: ${group.name} (ID: ${group.id})`);
        const tagNames = group.tags.map(t => t.name);
        console.log(`  Tags: ${tagNames.join(', ')}`);

        // Check duplication
        const uniqueTags = new Set(tagNames);
        if (tagNames.length !== uniqueTags.size) {
            console.log("  WARNING: DUPLICATE TAGS IN GROUP!");
        }
    }

    return; // stop

    // 2. Check each category with this tag (Checking all now)
    const allCategories = await prisma.category.findMany({
        include: { tags: true }
    });

    console.log(`\n--- ALL CATEGORIES WITH VALUE ---`);
    for (const cat of allCategories) {
        // Get latest asset
        const asset = await prisma.asset.findFirst({
            where: { categoryId: cat.id },
            orderBy: { recordedAt: 'desc' }
        });

        const val = asset ? Number(asset.currentValue) : 0;
        if (val > 0) {
            console.log(`[${cat.id}] ${cat.name} (Parent: ${cat.parentId}) - Val: ${val.toLocaleString()}`);
            if (cat.tags.length > 0) {
                console.log(`   Tags: ${cat.tags.map(t => t.name).join(', ')}`);
            }
        }
    }

    return; // Stop here for now

    // Original loop
    const targetCat = await prisma.category.findUnique({
        where: { id: 103 },
        include: { tags: true }
    });
    console.log(`\n--- Target Category Check (ID: 103) ---`);
    console.log(`Name: ${targetCat.name}`);
    console.log(`Tags attached:`);
    targetCat.tags.forEach(t => console.log(` - [${t.id}] ${t.name}`));

    // Original loop
    for (const cat of tag.categories) {
        console.log(`\n--- Category: ${cat.name} (ID: ${cat.id}) ---`);
        console.log(`ParentID: ${cat.parentId}`);

        // Check children
        const children = await prisma.category.findMany({
            where: { parentId: cat.id }
        });
        console.log(`Children Count: ${children.length}`);
        children.forEach(c => console.log(`  - Child: ${c.name} (ID: ${c.id})`));

        // Check latest asset value (Own Value)
        const asset = await prisma.asset.findFirst({
            where: { categoryId: cat.id },
            orderBy: { recordedAt: 'desc' }
        });
        console.log(`Own Value (Latest): ${asset ? asset.currentValue : 0}`);
    }

    // 3. Scan all categories to see if any children ALSO have this tag
    // (If Parent has tag AND Child has tag, and logic adds both, that's double counting)
    // Wait, our fix was to ignore Parent's OWN value if it has children.
    // But if Child has the tag, it adds Child's value. 
    // And if Parent has the tag... wait.

    // Logic in history.ts:
    // categories.forEach(cat => {
    //    val = hasChildren ? 0 : cat.ownValue
    //    cat.tags.forEach(tag => points[tag] += val)
    // })

    // If Parent (150) has tag, and has children -> val = 0. Points += 0.
    // If Child (150) has tag, -> val = 150. Points += 150.
    // Total = 150. Correct.

    // What if Parent (150) has tag, and Child (150) does NOT have tag?
    // Parent has children, so val = 0.
    // Child has NO tag.
    // Total = 0. -> This would be WRONG. (If user tagged the Parent intending it to cover children)

}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
