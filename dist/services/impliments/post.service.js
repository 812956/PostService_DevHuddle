"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostSerive = void 0;
const post_mapper_1 = require("../../mapper/post.mapper");
const create_post_dto_1 = require("../../dto/create.post.dto");
class PostSerive {
    constructor(postRepository) {
        this.postRepository = postRepository;
    }
    async createPost(req) {
        const dto = create_post_dto_1.CreatePostSchema.parse(req);
        const prismaInput = post_mapper_1.PostMapper.toPost(dto, "123");
        this.postRepository.createPostLogics(prismaInput);
    }
}
exports.PostSerive = PostSerive;
