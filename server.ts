import express from "express";
import { createApp } from "./server/_core/index";

// 显式引入 express，确保 Vercel 能正确识别该入口为 Express 应用。
void express;

const app = createApp();

export default app;
