import { Router } from "express";
import {
  getAllListings,
  searchListings,
  getListingById,
  createListing,
  updateListing,
  deleteListing,
  getAdminListings,
} from "../../controllers/listings.controller.js";
import { getListingsStats } from "../../controllers/stats.controller.js";
import { authenticate, requireHost, requireAdmin } from "../../middlewares/auth.middleware.js";

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Listing:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "b1d8f3a2-6c9e-4a1b-8d7f-3e5b4c2a1d0f"
 *         title:
 *           type: string
 *           example: "Cozy Beachfront Cottage"
 *         description:
 *           type: string
 *           example: "A beautiful cottage with amazing ocean views."
 *         location:
 *           type: string
 *           example: "Malibu, CA"
 *         pricePerNight:
 *           type: number
 *           example: 150.0
 *         guests:
 *           type: integer
 *           example: 4
 *         type:
 *           $ref: '#/components/schemas/ListingType'
 *         amenities:
 *           type: array
 *           items:
 *             type: string
 *           example: ["WiFi", "Kitchen", "Free Parking"]
 *         rating:
 *           type: number
 *           nullable: true
 *           example: 4.8
 *         userId:
 *           type: string
 *           example: "a3f8c2d1-4b5e-4f6a-8c9d-1e2f3a4b5c6d"
 *         host:
 *           $ref: '#/components/schemas/User'
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: "2024-04-28T10:00:00Z"
 *     CreateListingInput:
 *       type: object
 *       required: [title, description, location, pricePerNight, guests, type, amenities]
 *       properties:
 *         title:
 *           type: string
 *           example: "Cozy Beachfront Cottage"
 *         description:
 *           type: string
 *           example: "A beautiful cottage with amazing ocean views."
 *         location:
 *           type: string
 *           example: "Malibu, CA"
 *         pricePerNight:
 *           type: number
 *           example: 150.0
 *         guests:
 *           type: integer
 *           example: 4
 *         type:
 *           $ref: '#/components/schemas/ListingType'
 *         amenities:
 *           type: array
 *           items:
 *             type: string
 *           example: ["WiFi", "Kitchen", "Free Parking"]
 */

/**
 * @swagger
 * /listings:
 *   get:
 *     summary: Get all listings with optional filters
 *     tags: [Listings]
 *     parameters:
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
 *       - in: query
 *         name: location
 *         schema:
 *           type: string
 *         description: Filter by location
 *       - in: query
 *         name: type
 *         schema:
 *           $ref: '#/components/schemas/ListingType'
 *         description: Filter by listing type
 *       - in: query
 *         name: minPrice
 *         schema:
 *           type: number
 *         description: Minimum price per night
 *       - in: query
 *         name: maxPrice
 *         schema:
 *           type: number
 *         description: Maximum price per night
 *       - in: query
 *         name: guests
 *         schema:
 *           type: integer
 *         description: Minimum number of guests
 *     responses:
 *       200:
 *         description: List of listings
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Listing'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 */
router.get("/", getAllListings);

/**
 * @swagger
 * /listings/search:
 *   get:
 *     summary: Search listings by location, type, price range, guests
 *     tags: [Listings]
 *     parameters:
 *       - in: query
 *         name: location
 *         schema:
 *           type: string
 *       - in: query
 *         name: type
 *         schema:
 *           $ref: '#/components/schemas/ListingType'
 *       - in: query
 *         name: minPrice
 *         schema:
 *           type: number
 *       - in: query
 *         name: maxPrice
 *         schema:
 *           type: number
 *       - in: query
 *         name: guests
 *         schema:
 *           type: integer
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
 *         description: Search results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Listing'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 */
router.get("/search", searchListings);

/**
 * @swagger
 * /listings/stats:
 *   get:
 *     summary: Get listing statistics
 *     tags: [Listings]
 *     responses:
 *       200:
 *         description: Statistics summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalListings:
 *                   type: integer
 *                 averagePrice:
 *                   type: number
 *                 byLocation:
 *                   type: array
 *                 byType:
 *                   type: array
 */
router.get("/stats", getListingsStats);

/**
 * @swagger
 * /listings/{id}:
 *   get:
 *     summary: Get listing by ID
 *     tags: [Listings]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Listing details with host and reviews
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Listing'
 *       404:
 *         $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/admin", authenticate, requireAdmin, getAdminListings);

/**
 * @swagger
 * /listings/{id}:
 *   get:
 *     summary: Get listing by ID
 *     tags: [Listings]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Listing details with host and reviews
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Listing'
 *       404:
 *         $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/:id", getListingById);

/**
 * @swagger
 * /listings:
 *   post:
 *     summary: Create a new listing
 *     tags: [Listings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateListingInput'
 *     responses:
 *       201:
 *         description: Listing created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Listing'
 *       400:
 *         $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/", authenticate, createListing);

/**
 * @swagger
 * /listings/{id}:
 *   put:
 *     summary: Update a listing
 *     tags: [Listings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateListingInput'
 *     responses:
 *       200:
 *         description: Listing updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Listing'
 *       401:
 *         $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         $ref: '#/components/schemas/ErrorResponse'
 */
router.put("/:id", authenticate, updateListing);

/**
 * @swagger
 * /listings/{id}:
 *   delete:
 *     summary: Delete a listing
 *     tags: [Listings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
     *     responses:
 *       200:
 *         description: Listing deleted successfully
 *       401:
 *         $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         $ref: '#/components/schemas/ErrorResponse'
 */
router.delete("/:id", authenticate, deleteListing);

export default router;
