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
        return await prisma.tagGroup.findMany({
            include: { tags: true },
            orderBy: { id: 'asc' }
        })
    } catch (error) {
        console.error("Failed to fetch tag groups:", error)
        return []
    }
}

export async function saveTagGroup(data: { id?: number, name: string, tagIds: number[] }) {
    try {
        const tagIds = data.tagIds || []
        if (data.id) {
            await prisma.tagGroup.update({
                where: { id: data.id },
                data: {
                    name: data.name,
                    tags: {
                        set: [], // Disconnect all first
                        connect: tagIds.map(id => ({ id }))
                    }
                }
            })
        } else {
            await prisma.tagGroup.create({
                data: {
                    name: data.name,
                    tags: {
                        connect: tagIds.map(id => ({ id }))
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
