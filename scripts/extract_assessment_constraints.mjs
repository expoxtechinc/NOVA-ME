import fs from "node:fs";
const file = "/home/ubuntu/.mcp/tool-results/2026-08-27_18-49-12.381997402_supabase_execute_sql_62dab5a7.json";
const outer = JSON.parse(fs.readFileSync(file, "utf8"));
const match = outer.result.match(/<untrusted-data-[^>]+>\n([\s\S]*?)\n<\/untrusted-data/);
if (!match) throw new Error("Could not locate structured result");
for (const row of JSON.parse(match[1])) if (row.table_name === "assessments") console.log(JSON.stringify(row));
