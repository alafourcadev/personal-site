import { defineCollection, z } from 'astro:content'

const blog = defineCollection({
    type: 'content',
    schema: z.object({
        title: z.string(),
        description: z.string(),
        tags: z.array(z.string()),
        date: z.date(),
        readTime: z.string(),
        image: z.string(),
        draft: z.boolean().default(false),
    }),
})

export const collections = { blog }
