import { Router } from "express";
import { AdminController } from "../controllers/impliments/admin.controller";
import { AdminService } from "../services/impliments/admin.service";
import { AdminRepository } from "../repositories/impliments/admin.repository";
import { PostRepository } from "../repositories/impliments/post.repository";
import { CommentRepository } from "../repositories/impliments/comment.repository";
import { requireAdmin } from "../middleware/admin.middleware";

const router = Router();

// Initialize dependencies
const adminRepository = new AdminRepository();
const postRepository = new PostRepository();
const commentRepository = new CommentRepository();
const adminService = new AdminService(adminRepository, postRepository, commentRepository);
const adminController = new AdminController(adminService);

// All admin routes require superAdmin role (auth handled by API Gateway)
router.use(requireAdmin);

// ==================== REPORTS ====================
router.get("/reports", adminController.listReports.bind(adminController));
router.get("/reports/:reportId", adminController.getReportById.bind(adminController));
router.patch("/reports/:reportId/action", adminController.takeReportAction.bind(adminController));
router.post("/reports/bulk-action", adminController.bulkReportAction.bind(adminController));

// ==================== POSTS ====================
router.get("/posts", adminController.listPosts.bind(adminController));
router.get("/posts/reported", adminController.listReportedPosts.bind(adminController));
router.get("/posts/:postId", adminController.getPostById.bind(adminController));
router.patch("/posts/:postId/hide", adminController.hidePost.bind(adminController));
router.delete("/posts/:postId", adminController.deletePostAdmin.bind(adminController));

// ==================== COMMENTS ====================
router.get("/comments", adminController.listComments.bind(adminController));
router.get("/comments/reported", adminController.listReportedComments.bind(adminController));
router.get("/comments/:commentId", adminController.getCommentById.bind(adminController));
router.delete("/comments/:commentId", adminController.deleteCommentAdmin.bind(adminController));

// ==================== ANALYTICS ====================
router.get("/analytics/dashboard", adminController.getDashboardStats.bind(adminController));
router.get("/analytics/reports-by-reason", adminController.getReportsByReason.bind(adminController));
router.get("/analytics/reports-by-severity", adminController.getReportsBySeverity.bind(adminController));

// ==================== USER-RELATED ADMIN QUERIES ====================
router.get("/users/:userId/reported-content", adminController.getUserReportedContent.bind(adminController));
router.get("/users/:userId/reports", adminController.getUserReportsHistory.bind(adminController));

export default router;

