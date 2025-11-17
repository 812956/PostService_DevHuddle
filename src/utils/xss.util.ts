import DOMPurify from "isomorphic-dompurify";

/**
 * Sanitize user input to prevent XSS attacks
 * Removes potentially dangerous HTML/JavaScript while preserving safe text
 */
export function sanitizeInput(input: string): string {
  if (!input || typeof input !== "string") {
    return "";
  }

  // Configure DOMPurify to be very strict
  const config = {
    ALLOWED_TAGS: [], // No HTML tags allowed
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true, // Keep text content but strip tags
  };

  // Sanitize the input (isomorphic-dompurify works without window)
  const sanitized = DOMPurify.sanitize(input, config);

  // Additional cleanup: remove any remaining HTML entities
  return sanitized
    .replace(/&[#\w]+;/g, "") // Remove HTML entities
    .trim();
}

/**
 * Validate content length
 */
export function validateContentLength(content: string, maxLength: number = 10000): boolean {
  return content.length <= maxLength;
}

/**
 * Check for spam patterns (basic implementation)
 */
export function containsSpamPatterns(content: string): boolean {
  const spamPatterns = [
    /(http|https):\/\/[^\s]+/gi, // URLs
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, // Email addresses
    /(buy|sell|discount|free|click|here|now|limited|offer)/gi, // Common spam words
  ];

  // Count matches
  let matchCount = 0;
  spamPatterns.forEach((pattern) => {
    const matches = content.match(pattern);
    if (matches) {
      matchCount += matches.length;
    }
  });

  // If more than 3 spam indicators, likely spam
  return matchCount > 3;
}