import { IShareRepository } from "../repositories/interface/IShareRepository";
import { IPostEnricher } from "./IPostEnricher";

export class ShareEnricher implements IPostEnricher {
  constructor(private _shareRepository: IShareRepository) {}

  async enrich(posts: any[], viewerId?: string): Promise<any[]> {
    if (!viewerId || posts.length === 0) {
      return posts.map((post) => ({
        ...post,
        engagement: {
          ...post.engagement,
          isShared: false,
        },
      }));
    }

    const postIds = posts.map((post) => post.id);
    const userSharesMap =
      (await this._shareRepository.getUserSharesForPosts(viewerId, postIds)) || {};

    return posts.map((post) => ({
      ...post,
      engagement: {
        ...post.engagement,
        isShared: userSharesMap[post.id] ?? false,
      },
    }));
  }
}
