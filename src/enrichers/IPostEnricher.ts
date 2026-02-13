export interface IPostEnricher {
  enrich(posts: any[], viewerId?: string): Promise<any[]>;
}
