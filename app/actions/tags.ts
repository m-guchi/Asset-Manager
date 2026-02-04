"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

// --- Tags ---

export async function getTags() {
    try {
        return await prisma.tag.findMany({
            orderBy: { id: 'asc' }
        })
    } catch (error) {
        console.error("Failed to fetch tags:", error)
        return []
    }
}

export async function saveTag(data: { id?: number, name: string, color: string }) {
    try {
        if (data.id) {
            await prisma.tag.update({
                where: { id: data.id },
                data: { name: data.name, color: data.color }
            })
        } else {
            await prisma.tag.create({
                data: { name: data.name, color: data.color }
            })
        }
        revalidatePath("/assets")
        return { success: true }
    } catch (error) {
        console.error("Failed to save tag:", error)
        return { success: false }
    }
}

export async function deleteTag(id: number) {
    try {
        await prisma.tag.delete({ where: { id } })
        revalidatePath("/assets")
        return { success: true }
    } catch (error) {
        console.error("Failed to delete tag:", error)
        return { success: false }
    }
}

// --- Tag Groups ---

export async function getTagGroups() {
    try {
        const groups = await prisma.tagGroup.findMany({
            include: {
                items: {
                    include: { tag: true },
                    orderBy: { order: 'asc' }
                }
            },
            orderBy: { id: 'asc' }
        })

        // Map to flat structure for frontend compatibility
        return groups.map((g: any) => ({
            id: g.id,
            name: g.name,
            tags: g.items.map((item: any) => item.tag)
        }))
    } catch (error) {
        console.error("Failed to fetch tag groups:", error)
        return []
    }
}

export async function saveTagGroup(data: { id?: number, name: string, tagIds: number[] }) {
    try {
        const tagIds = data.tagIds || []
        if (data.id) {
            // Update: Delete existing items and recreate to update order easily
            await prisma.$transaction([
                prisma.tagGroup.update({
                    where: { id: data.id },
                    data: { name: data.name }
                }),
                prisma.tagGroupItem.deleteMany({
                    where: { tagGroupId: data.id }
                }),
                prisma.tagGroupItem.createMany({
                    data: tagIds.map((tagId, index) => ({
                        tagGroupId: data.id!,
                        tagId: tagId,
                        order: index
                    }))
                })
            ])
        } else {
            await prisma.tagGroup.create({
                data: {
                    name: data.name,
                    items: {
                        create: tagIds.map((tagId, index) => ({
                            tag: { connect: { id: tagId } },
                            order: index
                        }))
                    }
                }
            })
        }
        revalidatePath("/assets")
        revalidatePath("/")
        return { success: true }
    } catch (error) {
        console.error("Failed to save tag group:", error)
        return { success: false }
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
