export interface ISendService {
  /**
   * Send a post to selected connections
   * Creates notifications for each recipient
   */
  sendPost(
    postId: string,
    senderId: string,
    recipientIds: string[],
    message?: string
  ): Promise<{
    success: boolean;
    sentTo: string[];
    message?: string;
  }>;
}

