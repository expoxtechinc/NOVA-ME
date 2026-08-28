import { readFile, writeFile } from "node:fs/promises";
const migrationPath = "/home/ubuntu/nova-international-university/docs/supabase/20260828_niu_ai_visual_assets.sql";
const rpcPath = "/home/ubuntu/nova-international-university/docs/supabase/20260828_niu_ai_draft_package_rpc.sql";
const outputPath = "/home/ubuntu/nova-international-university/.mcp-ai-visual-assets-migration.json";
const visualSql = await readFile(migrationPath, "utf8");
const rpcSql = await readFile(rpcPath, "utf8");
const payload = { project_id: "oevgnonkqpvfvjsmovpw", name: "niu_ai_visual_assets_20260828b", query: `${visualSql}\n${rpcSql}` };
await writeFile(outputPath, JSON.stringify(payload, null, 2) + "\n");
