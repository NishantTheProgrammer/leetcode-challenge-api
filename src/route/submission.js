import { Router } from "express";
import {  getSubmissionList } from "../controller/submission.js";

const router = new Router();

router.get('/', getSubmissionList);

export default router;