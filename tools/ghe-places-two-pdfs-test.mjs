import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {readFileSync} from "node:fs";
import vm from "node:vm";

const places=readFileSync("places.html","utf8");
const legacy=readFileSync("places-export.html","utf8");
const backend=readFileSync("supabase/functions/stip-places/index.ts","utf8");

// Approved PDF is exactly the same binary the visitor is allowed to receive.
const approved=readFileSync("pdf/ghe-visiter-les-lieux-4-pages-validees.pdf");
assert.equal(approved.subarray(0,5).toString("ascii"),"%PDF-");
assert.equal(createHash("sha256").update(approved).digest("hex"),
 "eea73e5d75593bdeda77adac4a3ab2926c39a066ac60f9b077e9dc72cce743a9");
assert.match(backend,/APPROVED_VISITOR_PDF_SHA256='eea73e5d75593bdeda77adac4a3ab2926c39a066ac60f9b077e9dc72cce743a9'/);
assert.match(backend,/APPROVED_MASTER_PDF_SHA256='7462b0cbe78d0b3f069d62968ce140eaf6acc6dc0e212fe9c7e37a2d6ff3366d'/);
assert(backend.includes("APPROVED_PRO_DICTIONARY_PAGES=[10,11,12,2,3,5,6,7,8,14,15]"));
assert(backend.includes("if(cleanScope(body.scope).mode==='all')return await exactValidatedPdfResponse(false)"));
assert(backend.includes("if(cleanScope(body.scope).mode==='all')return await exactValidatedPdfResponse(true)"));
assert(backend.includes("if(session.app_level!=='pro')return json({error:'Export réservé à l’accès professionnel.'},403)"));
assert(backend.includes("for(const page of dictionaryPages)combined.addPage(page)"));
assert(backend.includes("combined.getPageCount()!==15"));

// Exactly two audience choices; selection happens on Visiter les lieux itself.
assert.match(places,/id="placesPdfVisitor"/);
assert.match(places,/id="placesPdfPro"/);
assert.equal((places.match(/class="places-pdf-choice"/g)||[]).length,2);
assert.match(places,/function generateChosenPdf\(audience,viewer,token=''/);
assert.match(places,/function chooseVisitorPdf\(\)/);
assert.match(places,/\{action:audience==='visitor'\?'export_public_pdf':'export_pdf',scope:\{mode:'all'\}\}/);
assert.match(places,/if\(audience==='pro'\)\{/);
assert.match(places,/headers\['x-stip-session'\]=token/);
assert.match(places,/if\(await proSessionValid\(token\)\)\{await generateChosenPdf\('pro'/);
assert.match(places,/if\(!await proSessionValid\(data.session_token\)\)/);
assert.match(places,/\/\^\\d\{6\}\$\//,"professional code must be exactly six digits");
assert.match(places,/blob\.slice\(0,5\)\.text\(\)!=='%PDF-'/,"reject non-PDF payloads");
assert.match(places,/URL\.createObjectURL\(blob\)/);
assert.match(places,/pdfDialog\.close\(\)/);
assert.doesNotMatch(places,/goPdf\(|new URL\('places-export\.html'/,"no second export wizard navigation");
assert.match(places,/oldPdfAudience==='visitor'/);
assert.match(places,/oldPdfAudience==='pro'/);

// Legacy bookmarks redirect back to the canonical choice, never a third PDF screen.
assert.match(legacy,/location\.replace\(target\.href\)/);
assert.match(legacy,/target\.searchParams\.set\("pdf",audience\)/);
for(const discarded of ["data-open-scope","data-format","formatStep","actionStep","GHE complet","xlsx"]){
 assert(!legacy.includes(discarded),"legacy page must not offer "+discarded);
}

// Server still enforces its own rights; UI state is not authorization.
assert.match(backend,/if\(session\.app_level!=='pro'\)return json\(\{error:'Export réservé à l’accès professionnel\.'\},403\)/);
assert.match(backend,/bootstrap\(\['public'\],'public_share','visitor'\)/);

for(const [filename,html] of [["places.html",places],["places-export.html",legacy]]){
 const snippets=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).filter(s=>s.trim());
 assert(snippets.length,filename+" has at least one inline script");
 for(const source of snippets)assert.doesNotThrow(()=>new vm.Script(source,{filename}),filename+" JavaScript parses");
}
console.log("PASS — only two direct GHE PDFs; legacy wizard removed; pro authorization kept.");
