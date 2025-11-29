import express from "express";
import { searchProblems } from "../controllers/problemSearchController.js";

const router = express.Router();

router.get("/search", searchProblems);

export default router;