import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";

const file=name=>readFileSync(name,"utf8");
const js=file("ghe-date-separator.js");
const scope={window:{}};
vm.runInNewContext(js,scope,{filename:"ghe-date-separator.js"});
const master=scope.window.GHEDateSeparator;
assert.ok(master,"Le template de date doit être disponible globalement");
function clean(html){return html.replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim()}
assert.equal(clean(master.separator("2026-10-20")),"MARDI 20 OCTOBRE");
assert.equal(clean(master.separator("2026-10-19")),"LUNDI 19 OCTOBRE");
assert.equal(clean(master.separator("2026-10-21")),"MERCREDI 21 OCTOBRE");
assert.equal(clean(master.separator("2026-10-23")),"VENDREDI 23 OCTOBRE");
assert.equal(clean(master.separator("2026-11-01")),"DIMANCHE 1 NOVEMBRE");
assert.equal(master.separator("2026-02-30"),"","Date inexistante rejetée");
assert.equal(master.separator(""),"","Pas de séparateur inventé en l'absence de date");
assert.match(master.separator("2026-10-20",{className:"ghe-smart-date-separator",count:3}),/×3/);
assert.match(master.calendar("2026-10-20"),/<b>20<\/b>/);
assert.ok(Object.isFrozen(master));

const choices=file("ghe-smart-choices.js"),drawer=file("ghe-smart-drawer.js");
const home=file("home-shell.js"),feedback=file("event-feedback.js");
const index=file("index.html"),css=file("ghe-smart-drawer.css");
assert.match(choices,/function cardsForView\(key,entries\)/);
assert.match(choices,/\["pending","past","proposals","activities"\]/);
assert.match(choices,/window\.GHEDateSeparator\.separator\(iso\)/);
for(const action of ["pending","past","proposals","activities"]) {
  assert.match(choices,new RegExp('if\\(key==="'+action+'"\\).*date:',"m"),"Menu daté sans source de date : "+action);
}
assert.match(drawer,/window\.GHEDateSeparator\?\.separator\(group\.date/);
assert.match(home,/window\.GHEDateSeparator\.separator\(date,\{className:"ghe-agenda360-date"\}/);
assert.match(feedback,/window\.GHEDateSeparator\.separator\(iso,\{className:"hc-feedback-date-separator"\}/);
assert.match(css,/#gheSmartChoiceDialog\) \.ghe-date-separator/);
const dateIndex=index.indexOf('src="ghe-date-separator.js');
const homeIndex=index.indexOf('src="home-shell.js');
const choicesIndex=index.indexOf('src="ghe-smart-choices.js');
assert.ok(dateIndex>=0 && dateIndex<homeIndex && dateIndex<choicesIndex,"Le template doit charger avant ses utilisateurs");
assert.ok(file("sorties-loisirs.html").includes('ghe-date-separator.js'));
console.log("GHE — template calendrier maître : dates réelles, 4 menus, 3 surfaces, CSS et ordre de chargement OK");
