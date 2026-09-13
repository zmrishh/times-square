// Read-only verification of protected originals, after isolated audit servers stop.
import {readFile,writeFile,stat} from "node:fs/promises";
import {createHash} from "node:crypto";
const baseline=JSON.parse(await readFile("artifacts/audit/protected-data-baseline.json","utf8"));
const changed=[];
for(const file of baseline) {
  try {
    const info=await stat(file.path);
    const hash=createHash("sha256").update(await readFile(file.path)).digest("hex").toUpperCase();
    if(info.size!==file.length||hash!==file.sha256) changed.push(file.path);
  } catch {changed.push(file.path);}
}
const report={date:new Date().toISOString(),method:"SHA-256 and length comparison before restarting the original application with the additive migration",files:baseline.length,changed,passed:changed.length===0};
await writeFile("artifacts/audit/data-preservation.json",JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
if(changed.length)process.exitCode=1;
