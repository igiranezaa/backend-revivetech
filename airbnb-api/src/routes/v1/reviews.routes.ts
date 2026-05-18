import { Router } from "express";
import {
  createReview,
  getListingReviews,
  deleteReview,
  getAllReviews,
  createSystemReview,
  getSystemReviews,
  createTestimonial,
  getTestimonials,
} from "../../controllers/reviews.controller.js";
import { authenticate, requireAdmin } from "../../middlewares/auth.middleware.js";

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Review:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "d2e4f6a8-b0c1-4d3e-8f9a-1b2c3d4e5f6g"
 *         rating:
 *           type: integer
 *           minimum: 1
 *           maximum: 5
 *           example: 5
 *         comment:
 *           type: string
 *           example: "Amazing place, very clean and cozy!"
 *         userId:
 *           type: string
 *           example: "a3f8c2d1-4b5e-4f6a-8c9d-1e2f3a4b5c6d"
 *         listingId:
 *           type: string
 *           example: "b1d8f3a2-6c9e-4a1b-8d7f-3e5b4c2a1d0f"
 *         user:
 *           $ref: '#/components/schemas/User'
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: "2024-04-28T10:00:00Z"
 *     CreateReviewInput:
 *       type: object
 *       required:
 *         - userId
 *         - rating
 *         - comment
 *       properties:
 *         userId:
 *           type: string
 *           example: "a3f8c2d1-4b5e-4f6a-8c9d-1e2f3a4b5c6d"
 *         rating:
 *           type: integer
 *           minimum: 1
 *           maximum: 5
 *           example: 5
 *         comment:
 *           type: string
 *           example: "Amazing place, very clean and cozy!"
 */

/**
 * @swagger
 * /listings/{id}/reviews:
 *   get:
 *     summary: Get all reviews for a listing (paginated)
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Listing ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Paginated reviews with reviewer name and avatar
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Review'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *       404:
 *         $ref: '#/components/schemas/ErrorResponse'
 * 
 *   post:
 *     summary: Create a review for a listing
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Listing ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateReviewInput'
 *     responses:
 *       201:
 *         description: Review created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Review'
 *       400:
 *         $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /reviews/{id}:
 *   delete:
 *     summary: Delete a review
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Review ID
 *     responses:
 *       200:
 *         description: Review deleted successfully
 *       404:
 *         $ref: '#/components/schemas/ErrorResponse'
 */

router.get("/", authenticate, requireAdmin, getAllReviews);

router.get("/listings/:id/reviews", getListingReviews);

router.post("/listings/:id/reviews", authenticate, createReview);

router.get("/system", getSystemReviews);

router.post("/system", authenticate, createSystemReview);

router.get("/testimonials", getTestimonials);

router.post("/testimonials", authenticate, createTestimonial);

router.delete("/:id", authenticate, requireAdmin, deleteReview);

export default router;
