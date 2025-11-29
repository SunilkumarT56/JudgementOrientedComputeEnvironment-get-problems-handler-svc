import type { Request, Response } from "express";
import { pool } from "../config/postgresClient.js";
import { streamToString } from "../utils/streamToString.js";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { s3 } from "../config/s3Client.js";

export const getProblems = async (req: Request, res: Response) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    const sortBy = (req.query.sortBy as string) || "questionId";
    const orderParam = req.query.order === "asc" ? "ASC" : "DESC";

    let sortColumn = "frontend_id";
    let finalOrder = orderParam;

    switch (sortBy) {
      case "frequency":
        sortColumn = "frequency";
        break;
      case "contestPoint":
        sortColumn = "contest_point";
        break;
      case "difficulty":
        sortColumn = "difficulty_order";
        break;
      case "acceptance":
        sortColumn = "acceptance";
        break;
      case "tags":
        sortColumn =
          "(SELECT MIN(elem) FROM jsonb_array_elements_text(tags) elem)";
        break;
      case "newest":
        sortColumn = "created_at";
        finalOrder = "DESC";
        break;
      case "oldest":
        sortColumn = "created_at";
        finalOrder = "ASC";
        break;
      default:
        sortColumn = "frontend_id";
    }

    const query = `
      SELECT *
      FROM problems
      ORDER BY ${sortColumn} ${finalOrder}, frontend_id ASC
      LIMIT $1 OFFSET $2
    `;

    const result = await pool.query(query, [limit, offset]);

    res.json({
      page,
      limit,
      count: result.rows.length,
      results: result.rows,
    });
  } catch (error) {
    console.error("Error fetching problems:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getProblemById = async (req: Request, res: Response) => {
  try {
    const { problemSlug } = req.params;

    const result = await pool.query(
      `SELECT
         problem_id,
         frontend_id,
         slug,
         difficulty,
         title,
         acceptance,
         is_premium,
         tags,
         likes,
         dislikes,
         companies,
         submission_count,
         upvotes,
         downvotes,
         is_verified
       FROM problems
       WHERE slug = $1`,
      [problemSlug]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Problem not found" });
    }

    const metadata = result.rows[0];

    const difficultyFolder = metadata.difficulty.toLowerCase();
    const paddedId = String(metadata.frontend_id).padStart(4, "0");
    const fileName = `${paddedId}-${metadata.slug}.json`;
    const s3Key = `problems/${difficultyFolder}/${fileName}`;

    const command = new GetObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET!,
      Key: s3Key,
    });

    const s3Response = await s3.send(command);
    const fileContent = await streamToString(s3Response.Body as any);
    const problemJson = JSON.parse(fileContent);

    res.json({
      ...metadata,
      ...problemJson,
    });
  } catch (error) {
    console.error("Error fetching problem:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getSortedProblems = async (req: Request, res: Response) => {
  try {
    const sortBy = (req.query.sortBy as string) || "custom";
    const order = req.query.order === "asc" ? "ASC" : "DESC";

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    let sortColumn = "frontend_id";

    // Sort mapping
    switch (sortBy) {
      case "frequency":
        sortColumn = "frequency";
        break;

      case "contestPoint":
        sortColumn = "contest_point";
        break;

      case "difficulty":
        sortColumn = "difficulty_order";
        break;

      case "acceptance":
        sortColumn = "acceptance";
        break;

      case "questionId":
        sortColumn = "frontend_id";
        break;

      case "tags":
        sortColumn =
          "(SELECT MIN(t) FROM jsonb_array_elements_text(tags) AS t)";
        break;

      case "newest":
        sortColumn = "created_at";
        break;

      case "oldest":
        sortColumn = "created_at";
        break;

      default:
        sortColumn = "frontend_id";
    }

    // If sorting by oldest, invert the order
    const finalOrder = sortBy === "oldest" ? "ASC" : order;

    // Build SQL
    const query = `
      SELECT *
      FROM problems
      ORDER BY ${sortColumn} ${finalOrder}, frontend_id ASC
      LIMIT $1 OFFSET $2
    `;

    const result = await pool.query(query, [limit, offset]);

    res.json({
      page,
      limit,
      count: result.rows.length,
      results: result.rows,
    });
  } catch (error) {
    console.error("Error sorting problems:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
export const getNextProblem = async (req : Request, res : Response) => {
  try {
    const { slug } = req.params;

    // get current
    const current = await pool.query(
      `SELECT frontend_id FROM problems WHERE slug = $1`,
      [slug]
    );
    if (current.rowCount === 0) return res.status(404).json({ error: "Not found" });

    const nextId = current.rows[0].frontend_id + 1;

    const next = await pool.query(
      `SELECT slug, title FROM problems WHERE frontend_id = $1`,
      [nextId]
    );

    if (next.rowCount === 0) return res.json({ next: null });

    res.json({ next: next.rows[0] });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};
export const getPrevProblem = async (req : Request, res : Response) => {
  try {
    const { slug } = req.params;

    const current = await pool.query(
      `SELECT frontend_id FROM problems WHERE slug = $1`,
      [slug]
    );

    const prevId = current.rows[0].frontend_id - 1;

    const prev = await pool.query(
      `SELECT slug, title FROM problems WHERE frontend_id = $1`,
      [prevId]
    );

    if (prev.rowCount === 0) return res.json({ prev: null });

    res.json({ prev: prev.rows[0] });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};
export const getRandomProblem = async (req : Request, res : Response) => {
  try {
    const random = await pool.query(
      `SELECT slug FROM problems ORDER BY RANDOM() LIMIT 1`
    );

    res.json({ random: random.rows[0] });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};