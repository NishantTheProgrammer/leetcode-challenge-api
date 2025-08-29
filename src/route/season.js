import { Router } from "express";
import { createSeason, getSeasonList } from "../controller/season.js";

const router = new Router();

router.post('/', createSeason);
router.get('/', getSeasonList);

export default router;