import type { Request, Response } from "express";
import { esClient } from "../config/esClient.js";

export const searchProblems = async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string) || "";
    const difficulty = req.query.difficulty;
    const tags = req.query.tags ? (req.query.tags as string).split(",") : [];

    const must: any[] = [];
    const filter: any[] = [];

    const isNumber = /^\d+$/.test(q);

    
    if (q && !isNumber) {
      must.push({
        multi_match: {
          query: q,
          fields: ["title^3", "slug^2", "tags", "companies"],
          fuzziness: "AUTO",
        },
      });
    }

        
    if (isNumber) {
      must.push({
        term: {
          frontend_id: Number(q)
        }
      });
    }

    if (difficulty) {
      filter.push({
        term: { difficulty: (difficulty as string).toLowerCase() }
      });
    }

    if (tags.length > 0) {
      filter.push({ terms: { tags } });
    }

    const result = await esClient.search({
      index: "problems",
      size: 50,
      query: {
        bool: {
          must: must.length ? must : [{ match_all: {} }],
          filter,
        },
      },
    });

    const hits = result.hits.hits.map((hit) => ({
      score: hit._score,
      //@ts-ignore
      ...hit._source,
    }));

    res.json({ count: hits.length, results: hits });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Search failed" });
  }
};
