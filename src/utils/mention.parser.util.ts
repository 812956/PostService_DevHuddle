/**
 * Parse @username mentions from text content
 * Returns array of unique usernames (without @ symbol)
 */
export function parseMentions(content: string): string[] {
    if (!content || typeof content !== "string") {
      return [];
    }
  
    // Regex to match @username pattern
    // Matches @ followed by alphanumeric characters, underscores, and dots
    // Username must start with letter or number, can contain underscores and dots
    const mentionRegex = /@([a-zA-Z0-9][a-zA-Z0-9_.]*)/g;
  
    const matches = content.match(mentionRegex);
    if (!matches) {
      return [];
    }
  
    // Extract usernames (remove @ symbol) and deduplicate
    const usernames = matches
      .map((match) => match.substring(1)) // Remove @
      .filter((username) => username.length > 0 && username.length <= 30) // Valid username length
      .filter((username, index, self) => self.indexOf(username) === index); // Deduplicate
  
    return usernames;
  }
  
  /**
   * Validate username format
   */
  export function isValidUsername(username: string): boolean {
    if (!username || username.length === 0 || username.length > 30) {
      return false;
    }
  
    // Username must start with letter or number
    // Can contain letters, numbers, underscores, and dots
    const usernameRegex = /^[a-zA-Z0-9][a-zA-Z0-9_.]*$/;
    return usernameRegex.test(username);
  }