import { z } from 'zod';

const nonEmptyStringSchema = z.string().min(1);
const manifestEntrySchema = <Category extends z.ZodType>(categorySchema: Category) =>
    z
        .object({
            file: nonEmptyStringSchema,
            category: categorySchema
        })
        .strict();

const manifestEntriesSchema = <Category extends z.ZodType>(categorySchema: Category) =>
    z.record(nonEmptyStringSchema, manifestEntrySchema(categorySchema));

const matchTierRangeSchema = z
    .tuple([z.number().int().positive(), z.number().int().positive()])
    .refine(([minimum, maximum]) => minimum <= maximum, 'minimum depth must not exceed maximum depth');

export const sfxManifestSchema = z
    .object({
        version: z.number().int().positive(),
        entries: manifestEntriesSchema(z.enum(['flip', 'match', 'mismatch', 'power', 'pressure', 'shuffle'])),
        matchTierDepthRanges: z
            .object({
                'match-tier-low': matchTierRangeSchema,
                'match-tier-mid': matchTierRangeSchema,
                'match-tier-high': matchTierRangeSchema
            })
            .strict()
    })
    .strict();

export const uiSfxManifestSchema = z
    .object({
        version: z.number().int().positive(),
        entries: manifestEntriesSchema(z.enum(['ui', 'menu']))
    })
    .strict();
