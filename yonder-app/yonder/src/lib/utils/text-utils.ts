/**
 * Truncates text to a specified number of sentences
 * @param text - The text to truncate
 * @param sentenceCount - Number of sentences to keep (default: 3)
 * @returns Truncated text
 */
export function truncateToSentences(text: string, sentenceCount: number = 3): string {
  if (!text) return '';
  
  // Match sentences ending with . ! ? followed by space or end of string
  const sentenceRegex = /[^.!?]+[.!?]+(?=\s|$)/g;
  const sentences = text.match(sentenceRegex);
  
  if (!sentences || sentences.length <= sentenceCount) {
    return text;
  }
  
  return sentences.slice(0, sentenceCount).join(' ').trim();
}

/**
 * Check if text was truncated (has more sentences than the limit)
 * @param text - The text to check
 * @param sentenceCount - Number of sentences limit (default: 3)
 * @returns True if text has more sentences than the limit
 */
export function isTruncated(text: string, sentenceCount: number = 3): boolean {
  if (!text) return false;
  
  const sentenceRegex = /[^.!?]+[.!?]+(?=\s|$)/g;
  const sentences = text.match(sentenceRegex);
  
  return sentences ? sentences.length > sentenceCount : false;
}
