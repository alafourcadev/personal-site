import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { exerciseSchema } from './lib/forja/content/exercise-schema';

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

// La Forja: level 4's exercise content (R1-F). Additive, since `blog` above is
// untouched. The markdown body is the player-facing brief prose; every
// computable admission gate lives in exerciseSchema's superRefine, which
// imports and RUNS the real engine (design D9's build-failing class). A
// content entry that cannot be evaluated does not compile.
const forjaExercises = defineCollection({
    loader: glob({ pattern: '**/*.md', base: './src/content/forja/exercises' }),
    schema: exerciseSchema,
})

export const collections = { blog, forjaExercises };
