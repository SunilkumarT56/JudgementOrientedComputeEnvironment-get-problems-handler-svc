import express from "express";
import {
  getProblems,
  getProblemById,
  getNextProblem,
  getPrevProblem,
  getRandomProblem,
} from "../controllers/problemSetController.js";

const router = express.Router();

router.get("/", getProblems);
router.get("/random", getRandomProblem);
router.get("/:slug/next", getNextProblem);
router.get("/:slug/prev", getPrevProblem);
router.get("/:problemSlug", getProblemById);

export default router;
