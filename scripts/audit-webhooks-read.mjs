import DodoPayments from "dodopayments";
import {writeFile} from "node:fs/promises";
if(process.env.PAYMENT_MODE!=="dodo-test")throw new Error("Test API reads only");
const client=new DodoPayments({baseURL:null,bearerToken:process.env.DODO_PAYMENTS_API_KEY,environment:"test_mode",maxRetries:0,timeout:15000});
const endpoints=[];
for await(const endpoint of client.webhooks.list({limit:20})) {
  const secret=await client.webhooks.retrieveSecret(endpoint.id);
  endpoints.push({host:new URL(endpoint.url).hostname,disabled:endpoint.disabled??false,filters:endpoint.filter_types,configuredSecretMatches:secret.secret===process.env.DODO_PAYMENTS_WEBHOOK_KEY});
  if(endpoints.length>=20)break;
}
const report={date:new Date().toISOString(),method:"Read-only real Dodo test endpoint configuration; URLs/keys redacted",endpoints};
await writeFile("artifacts/audit/dodo-webhook-configuration.json",JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
