import { spawn } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";
const env={...process.env,
  NODE_ENV:"production", APP_ORIGIN:"https://paper-audit.example",AUTH_MODE:"supabase",PAYMENT_MODE:"dodo-test",
  DATABASE_URL:"postgresql://audit:audit@127.0.0.1:54329/audit?sslmode=disable",
  DATABASE_POOL_MAX:"1",
  SUPABASE_URL:"https://audit.invalid", SUPABASE_SERVICE_ROLE_KEY:"audit-fixture-only",
  DODO_PAYMENTS_API_KEY:"audit-fixture-only",DODO_PRODUCT_ID:"audit-product",DODO_BUSINESS_ID:"audit-business",
  DODO_PAYMENTS_WEBHOOK_KEY:`whsec_${Buffer.from("audit-fixture-webhook-secret").toString("base64")}`,
  SUPPORT_EMAIL:"support@audit.example",JOB_SECRET:"audit-worker-fixture-secret-32-characters",
  NODE_OPTIONS:`--import=${pathToFileURL(path.resolve("scripts/audit-provider-preload.mjs")).href}`,
};
delete env.PAPER_TEST_ORIGIN;
delete env.DODO_PAYMENTS_BASE_URL;
const child=spawn(process.execPath,["node_modules/next/dist/bin/next","start","--hostname","127.0.0.1","-p","3002"],{env,stdio:"inherit",windowsHide:true});
child.on("exit",code=>process.exit(code??1));
process.on("SIGINT",()=>child.kill("SIGINT"));
