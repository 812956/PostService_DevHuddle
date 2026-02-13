import { ILikeRepository } from "../repositories/interface/ILikeRepository";
import { IPostEnricher } from "./IPostEnricher";

export class LikeEnricher implements IPostEnricher {
  constructor(private _likeRepository: ILikeRepository) {}

  async enrich(posts: any[], viewerId?: string): Promise<any[]> {
    if (!viewerId || posts.length === 0) {
      return posts.map((post) => ({
        ...post,
        engagement: {
          ...post.engagement,
          isLiked: false,
        },
      }));
    }

    const postIds = posts.map((post) => post.id);
    const userLikesMap =
      (await this._likeRepository.getUserLikesForPosts(viewerId, postIds)) || {};

    return posts.map((post) => ({
      ...post,
      engagement: {
        ...post.engagement,
        isLiked: userLikesMap[post.id] ?? false,
      },
    }));
  }
}
