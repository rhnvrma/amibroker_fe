'use server';

/**
 * @fileOverview Generates tags for a watchlist item based on its name and category using GenAI.
 *
 * - generateTagsForWatchlistItem - A function that generates tags for a watchlist item.
 * - GenerateTagsForWatchlistItemInput - The input type for the generateTagsForWatchlistItem function.
 * - GenerateTagsForWatchlistItemOutput - The return type for the generateTagsForWatchlistItem function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateTagsForWatchlistItemInputSchema = z.object({
  name: z.string().describe('The name of the watchlist item.'),
  category: z.string().describe('The category of the watchlist item.'),
});
export type GenerateTagsForWatchlistItemInput = z.infer<
  typeof GenerateTagsForWatchlistItemInputSchema
>;

const GenerateTagsForWatchlistItemOutputSchema = z.object({
  tags: z
    .array(z.string())
    .describe(
      'A list of suggested tags for the watchlist item, including general-purpose and dynamic tags.'
    ),
});
export type GenerateTagsForWatchlistItemOutput = z.infer<
  typeof GenerateTagsForWatchlistItemOutputSchema
>;

export async function generateTagsForWatchlistItem(
  input: GenerateTagsForWatchlistItemInput
): Promise<GenerateTagsForWatchlistItemOutput> {
  return generateTagsForWatchlistItemFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateTagsForWatchlistItemPrompt',
  input: {schema: GenerateTagsForWatchlistItemInputSchema},
  output: {schema: GenerateTagsForWatchlistItemOutputSchema},
  prompt: `You are a helpful assistant that generates tags for watchlist items.

  Based on the name and category of the item, suggest a list of tags that would be helpful for organizing and categorizing the item.

  Include a few general-purpose tags as well as dynamic tags that are specific to the item.

  Name: {{{name}}}
  Category: {{{category}}}
  `, // Removed Handlebars helper usage for array formatting
});

const generateTagsForWatchlistItemFlow = ai.defineFlow(
  {
    name: 'generateTagsForWatchlistItemFlow',
    inputSchema: GenerateTagsForWatchlistItemInputSchema,
    outputSchema: GenerateTagsForWatchlistItemOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
