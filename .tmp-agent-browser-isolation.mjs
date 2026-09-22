import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
const timeout=(p,label,ms=10000)=>Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej(new Error("TIMEOUT "+label)),ms))]);
async function mk(name){
  console.log("CONNECT_START",name);
  const transport=new StdioClientTransport({command:"agent-browser",args:["mcp"],env:process.env,stderr:"pipe"});
  transport.stderr?.on("data",d=>process.stderr.write("["+name+" stderr] "+d.toString()));
  const client=new Client({name,version:"1"});
  await timeout(client.connect(transport),"connect "+name);
  console.log("CONNECT_OK",name);
  return {client,transport};
}
async function call(c,name,args={}) {
  console.log("CALL_START",name,JSON.stringify(args));
  const r=await timeout(c.callTool({name,arguments:args}),name,15000);
  console.log("CALL_OK",name);
  return r.content?.map(x=>x.text??"").join("") ?? JSON.stringify(r);
}
let a,b;
try {
  a=await mk("probe-a");
  b=await mk("probe-b");
  console.log("A_OPEN", await call(a.client,"agent_browser_open",{url:"https://example.com"}));
  console.log("A_URL1", await call(a.client,"agent_browser_get_url",{}));
  console.log("B_OPEN", await call(b.client,"agent_browser_open",{url:"https://www.iana.org/help/example-domains"}));
  console.log("B_URL", await call(b.client,"agent_browser_get_url",{}));
  console.log("A_URL2", await call(a.client,"agent_browser_get_url",{}));
} catch(e) {
  console.error("PROBE_ERROR", e?.stack ?? e);
} finally {
  if(a) await a.client.close().catch(()=>{});
  if(b) await b.client.close().catch(()=>{});
}
