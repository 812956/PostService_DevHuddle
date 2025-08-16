"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostController = void 0;
class PostController {
    constructor(postService) {
        this.postService = postService;
    }
    async feedPosting(req) {
        console.log('this is the req data,', req.post);
        await this.postService.createPost(req);
        return {
            message: "hello "
        };
    }
}
exports.PostController = PostController;
