import { Router } from "express";
import { createUser, getUserList } from "../controller/user.js";

const router = new Router();

router.post('/', createUser);
router.get('/', getUserList);

export default router;