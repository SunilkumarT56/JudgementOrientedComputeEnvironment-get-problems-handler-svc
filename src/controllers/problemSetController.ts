import type { Request, Response } from "express";
import { pool } from "../config/db.js";
import { streamToString } from "../utils/streamToString.js";
import { GetObjectCommand} from "@aws-sdk/client-s3";
import { s3 } from "../config/s3.js";

export const getProblemSet = async (req: Request, res: Response) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 100;
    const offset = (page - 1) * limit;
    const result = await pool.query(
      `SELECT
          problem_id,
          title,
          difficulty,
          acceptance,
          is_premium
       FROM problems
       ORDER BY problem_id ASC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    res.json(result.rows);
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