import { readFileSync } from "node:fs";

const csv = readFileSync(new URL("./register_v2.csv", import.meta.url), "utf8")
  .trim()
  .split("\n")
  .slice(1);

for (const line of csv) {
  const [id, title, actors, mode] = line.split(",");
  console.log(`TICKET ${id}: ${title} [${actors}/${mode}]`);
}
console.log(`Cut ${csv.length} ticket stubs.`);
