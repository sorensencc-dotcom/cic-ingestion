#!/usr/bin/env node
/**
 * vectorLayerBootstrap.ts
 * Simple CLI to bring up VectorLayer and run a smoke check.
 */

import { wireVectorLayer } from "./index.js";
import express from "express";

async function main() {
  const app = express();
  app.use(express.json());

  await wireVectorLayer(app);

  console.log("VectorLayer bootstrap complete");
}

main().catch((err) => {
  console.error("Bootstrap error", err);
  process.exit(1);
});


