import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
    loader: glob({ pattern: '**/[^_]*.{md,mdx}', base: "./src/content/blog" }),
    schema: z.object({
        title: z.string(),
        description: z.string(),
        tags: z.array(z.string()),
        date: z.coerce.date(),
        readTime: z.string().optional(),
        image: z.string(),
        draft: z.boolean().default(false),
        day: z.number().optional(),
    }),
})

export const collections = { blog };
