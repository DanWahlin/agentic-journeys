#!/usr/bin/env node
import fs from 'node:fs';
const args=process.argv.slice(2), file=args[args.indexOf('--file')+1]||args[0]; if(!file){console.error('usage: validate-pr-contract.mjs --file <pr.md|json> [--changed-paths file]');process.exit(2)}
const raw=fs.readFileSync(file,'utf8');let body=raw,draft=true;try{const j=JSON.parse(raw);body=j.body||'';draft=j.draft!==false}catch{}
const e=[];const links=[...body.matchAll(/\b(?:close[sd]?|fixe?[sd]?|resolve[sd]?)\s+#(\d+)/gi)].map(x=>x[1]);if(links.length!==1)e.push('PR must link exactly one factory issue with Closes #N');
for(const h of ['Stable ID','Owned paths','Changed paths','Deterministic evidence','Rollback','Budget / TTL impact','Prohibited actions attestation'])if(!new RegExp(h.replace('/','\\/'),'i').test(body))e.push(`missing ${h}`);
if(!draft)e.push('factory PR must remain draft until a human marks ready');if(!/\bF(?:1[0-5]|[0-9])\b/.test(body))e.push('missing F0-F15 stable ID');
if(/gh\s+stack\s+merge|auto.?merge|merge\s+without/i.test(body))e.push('prohibited merge instruction');
const pi=args.indexOf('--changed-paths');if(pi>=0){const paths=fs.readFileSync(args[pi+1],'utf8').split(/\r?\n/).filter(Boolean);const reserved=paths.filter(p=>/^(?:\.github\/(?:workflows|agents|skills)\/|factory\/|scripts\/(?:setup|deploy|cleanup|release))/.test(p));if(reserved.length&&!/Reserved-path change approved by maintainer:\s*Yes/i.test(body))e.push(`unapproved reserved paths: ${reserved.join(', ')}`)}
if(e.length){console.error(e.join('\n'));process.exit(1)}console.log(`PASS PR contract issue #${links[0]}`);
