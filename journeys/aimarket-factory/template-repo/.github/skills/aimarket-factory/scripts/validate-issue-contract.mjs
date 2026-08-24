#!/usr/bin/env node
import fs from 'node:fs'; import path from 'node:path';
const args=process.argv.slice(2); const file=args[args.indexOf('--file')+1]||args[0];
if(!file){console.error('usage: validate-issue-contract.mjs --file <issue.md|json> [--labels a,b]');process.exit(2)}
const raw=fs.readFileSync(file,'utf8'); let body=raw, labels=[];
try{const j=JSON.parse(raw);body=j.body||'';labels=j.labels||[]}catch{}
const li=args.indexOf('--labels'); if(li>=0)labels=args[li+1].split(',').filter(Boolean);
const errors=[]; const req=['Stable ID','Parent issue','Dependencies','Owned paths','Approved plan headings','Acceptance commands','Risk','Expected artifacts','Rollback','Budget and TTL impact','Prohibited actions'];
for(const h of req)if(!new RegExp(`(?:^|\\n)#{1,6}\\s*${h}\\s*(?:\\n|$)|(?:^|\\n)${h}:\\s*\\S`,'i').test(body))errors.push(`missing ${h}`);
const id=body.match(/\bF(?:1[0-5]|[0-9])\b/)?.[0]; if(!id)errors.push('stable ID must be F0-F15');
const parentSection=body.match(/(?:^|\n)#{1,6}\s*Parent issue\s*\n([\s\S]*?)(?=\n#{1,6}\s|$)/i)?.[1]||body.match(/(?:^|\n)Parent issue:\s*([^\n]+)/i)?.[1]||'';if(!/#\d+/.test(parentSection))errors.push('parent issue must be #number');
const owned=(body.match(/(?:Owned paths)([\s\S]*?)(?=\n#{1,6}\s|\n[A-Z][^\n]+:\s|$)/i)?.[1]||'');
if(/(^|[\s,`])(?:\*\*|\*|\.|\/)(?:[\s,`]|$)/m.test(owned))errors.push('owned paths are too broad');
if(/\.github\/(?:workflows|agents|skills)|(?:^|\/)factory\/|(?:deploy|cleanup|release)/i.test(owned)&&!/factory-control:\s*approved/i.test(body))errors.push('reserved path lacks factory-control approval');
const acc=(body.match(/Acceptance commands([\s\S]*?)(?=\n#{1,6}\s|\n[A-Z][^\n]+:\s|$)/i)?.[1]||'');if(!/`[^`]+`|(?:node|npm|npx|pnpm|az|gh|curl)\s+\S+/i.test(acc))errors.push('acceptance commands must be executable');
if(labels.length){const states=labels.filter(x=>x.startsWith('factory:'));if(states.length!==1)errors.push('exactly one factory state label required');if(!states.includes('factory:ready'))errors.push('missing maintainer readiness label')}
if(errors.length){console.error(errors.join('\n'));process.exit(1)} console.log(`PASS issue contract ${id}`);
