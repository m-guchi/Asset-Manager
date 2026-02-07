"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

// --- Tags Legacy (Deprecated) ---
// These are kept empty or simple to prevent build errors until fully removed

export async function getTags() {
    return []
}

export async function saveTag(_data: any) {
    return { success: false, error: "Deprecated" }
}

export async function deleteTag(id: number) {
    return { success: false, error: "Deprecated" }
}

// --- Tag Groups (New Schema) ---

export async function getTagGroups() {
    try {
        const groups = await prisma.tagGroup.findMany({
            include: {
                options: {
                    orderBy: { order: 'asc' }
                }
            },
            orderBy: { order: 'asc' }
        });

        return groups.map((g) => ({
            id: g.id,
            name: g.name,
            order: g.order,
            options: g.options.map((o) => ({
                id: o.id,
                name: o.name,
                order: o.order
            }))
        }));
    } catch (error) {
        console.error("Failed to fetch tag groups:", error);
        return [];
    }
}

export async function saveTagGroup(data: { id?: number, name: string, options: { id?: number, name: string }[] }) {
    try {
        let savedGroup;
        if (data.id) {
            savedGroup = await prisma.$transaction(async (tx) => {
                await tx.tagGroup.update({
                    where: { id: data.id! },
                    data: { name: data.name }
                })

                // 2. Handle Options
                const incomingOptions = data.options || []
                const incomingIds = incomingOptions.filter(o => o.id).map(o => o.id)

                // Delete removed options
                await tx.categoryTag.deleteMany({
                    where: {
                        tagGroupId: data.id!,
                        tagOptionId: { notIn: incomingIds as number[] }
                    }
                })
                await tx.tagOption.deleteMany({
                    where: {
                        tagGroupId: data.id!,
                        id: { notIn: incomingIds as number[] }
                    }
                })

                // Update existing or Create new
                for (let i = 0; i < incomingOptions.length; i++) {
                    const opt = incomingOptions[i];
                    if (opt.id) {
                        await tx.tagOption.update({
                            where: { id: opt.id },
                            data: { name: opt.name, order: i }
                        })
                    } else {
                        await tx.tagOption.create({
                            data: {
                                tagGroupId: data.id!,
                                name: opt.name,
                                order: i
                            }
                        })
                    }
                }

                return await tx.tagGroup.findUnique({
                    where: { id: data.id },
                    include: { options: { orderBy: { order: 'asc' } } } as any
                })
            })
        } else {
            // Create New Group
            // Fetch max order to place at the end
            const maxOrderVal = await prisma.tagGroup.aggregate({
                _max: { order: true }
            })
            const nextOrder = (maxOrderVal._max?.order ?? -1) + 1

            savedGroup = await prisma.tagGroup.create({
                data: {
                    name: data.name,
                    order: nextOrder,
                    options: {
                        create: (data.options || []).map((opt, idx) => ({
                            name: opt.name,
                            order: idx
                        }))
                    }
                },
                include: {
                    options: { orderBy: { order: 'asc' } }
                }
            })
        }
        revalidatePath("/assets")
        revalidatePath("/")
        return { success: true, group: savedGroup }
    } catch (error) {
        console.error("Failed to save tag group:", error)
        try {
            // Fallback error logging to stringify if it's an object
            console.error(JSON.stringify(error, null, 2))
        } catch { }
        return { success: false, error }
    }
}

export async function deleteTagGroup(id: number) {
    try {
        await prisma.tagGroup.delete({ where: { id } })
        revalidatePath("/assets")
        return { success: true }
    } catch (error) {
        console.error("Failed to delete tag group:", error)
        return { success: false }
    }
}

export async function reorderTagGroupsAction(items: { id: number, order: number }[]) {
    try {
        await prisma.$transaction(
            items.map(item =>
                (prisma as any).tagGroup.update({
                    where: { id: item.id },
                    data: { order: item.order }
                })
            )
        );
        revalidatePath("/assets");
        return { success: true };
    } catch (error) {
        console.error("Failed to reorder tag groups", error)
        return { success: false }
    }
}

export async function renameTagGroup(id: number, name: string) {
    try {
        await prisma.tagGroup.update({
            where: { id },
            data: { name }
        })
        revalidatePath("/assets")
        revalidatePath("/")
        return { success: true }
    } catch (error) {
        console.error("Failed to rename tag group:", error)
        return { success: false, error }
    }
}

export async function getAssetsForTagGroup(groupId: number) {
    try {
        // 1. Fetch all raw
        const categories = await prisma.category.findMany({
            select: { id: true, name: true, parentId: true, color: true, order: true }
        })

        // 2. Sort Hierarchically to match Main List
        const roots = categories
            .filter((c) => !c.parentId)
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

        const childrenMap = new Map<number, any[]>();
        categories.forEach((c) => {
            if (c.parentId) {
                const existing = childrenMap.get(c.parentId) || [];
                existing.push(c);
                childrenMap.set(c.parentId, existing);
            }
        });

        const sorted: any[] = [];
        roots.forEach((root) => {
            sorted.push(root);
            const children = (childrenMap.get(root.id) || []).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
            sorted.push(...children);
        });

        const existingTags = await prisma.categoryTag.findMany({
            where: { tagGroupId: groupId }
        })

        return sorted.map((cat) => {
            const tag = existingTags.find((t) => t.categoryId === cat.id)
            return {
                id: cat.id,
                name: cat.name,
                color: cat.color,
                parentId: cat.parentId,
                currentOptionId: tag?.tagOptionId || null
            }
        })
    } catch (e) {
        console.error(e)
        return []
    }
}

export async function updateAssetTagMappings(groupId: number, mappings: { categoryId: number, optionId: number | null }[]) {
    try {
        await prisma.$transaction(async (tx) => {
            for (const m of mappings) {
                if (m.optionId === null) {
                    await (tx as any).categoryTag.deleteMany({
                        where: { categoryId: m.categoryId, tagGroupId: groupId }
                    })
                } else {
                    await (tx as any).categoryTag.upsert({
                        where: {
                            categoryId_tagGroupId: {
                                categoryId: m.categoryId,
                                tagGroupId: groupId
                            }
                        },
                        create: {
                            categoryId: m.categoryId,
                            tagGroupId: groupId,
                            tagOptionId: m.optionId
                        },
                        update: {
                            tagOptionId: m.optionId
                        }
                    })
                }
            }
        })
        revalidatePath("/assets")
        revalidatePath("/")
        return { success: true }
    } catch (e) {
        console.error("Failed to update mappings:", e)
        return { success: false, error: e }
    }
}
