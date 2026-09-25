import { semanticClassify, semanticText } from "./semantic.ts";
import type { DialogContext } from "./core.ts";

function eq(actual:unknown, expected:unknown, label:string){
  const a=JSON.stringify(actual),e=JSON.stringify(expected);
  if(a!==e)throw new Error(`${label}\nexpected ${e}\nactual   ${a}`);
}
const I=(q:string,ctx:DialogContext={})=>semanticClassify(q,ctx).intent;
eq(I("kan son mes prochaine vacance"),"leave_lookup","typo leave");
eq(I("vacances ?"),"leave_lookup","fragment leave");
eq(I("prochain RTT"),"leave_lookup","rtt");
eq(I("prochain repos"),"leave_lookup","rest");
eq(I("ki bosse avc moi mardi"),"colleagues","typo colleagues");
eq(I("num yael stp"),"contact","short contact");
eq(I("je peux appeler Yael ?"),"contact","call contact");
eq(I("irm c ou"),"place","short place");
eq(I("irm chemin"),"place","place route");
eq(I("qui fait soir demain"),"shift_roster","shift roster natural");
eq(I("liste des J4 demain"),"shift_roster","shift roster fragment");
eq(I("je veux passer en soir mardi"),"exchange","exchange without keyword");
eq(I("qui peut prendre mon mardi"),"exchange","natural exchange candidate request");
eq(I("soir mardi",{last_intent:"exchange"}),"exchange","exchange followup");
eq(I("message yael"),"messaging_help","message");
eq(I("change ma photo"),"app_navigation","photo app");
eq(semanticClassify("change ma photo").app,"profile_photo","photo target");
eq(semanticClassify("synchro calendrier").app,"calendar_subscribe","calendar target");
eq(semanticClassify("ouvre admin").app,"admin","admin target only, permission checked later");
eq(I("demain ?"),"planning","minimal date fragment");
eq(semanticText("ki bosse avc moi stp"),"qui travaille avec moi","shorthand normalization");
console.log("semantic tests: ok");
