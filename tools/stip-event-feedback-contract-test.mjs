import fs from "node:fs";

const read = (p) => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8");
const ui = read("event-feedback.js");
const home = read("home-shell.js");
const api = read("supabase/functions/stip-actions/index.ts");
const loader = read("stip-loader.js");
const manager = read("responsable-event-feedback.js");
const managerPage = read("responsable.html");

const must = (ok, msg) => {
  if (!ok) {
    console.error("STIP event feedback contract:", msg);
    process.exit(1);
  }
};

must(!ui.includes("Je n’étais pas présent"), "legacy presence wording must not return");
must(ui.includes("Accompagnement réalisé"), "intern positive outcome label missing");
must(ui.includes("Accompagnement non réalisé"), "intern non-realized outcome label missing");
must(ui.includes('data-feedback-stage'), "intern outcome needs an observation intake");
must(ui.includes('data-stage-participation'), "observed participation choice missing");
must(ui.includes('data-stage-topic'), "topics learned choice missing");
must(ui.includes('data-stage-next'), "next stage action missing");
must(ui.includes('stageTopics.size > 0'), "stage observation must be complete before save");
must(ui.includes("Bilan de stage —"), "stage observations must survive the legacy backend through note fallback");
must(api.includes('stageReviewValue(input:any)'), "stage review must be validated on the server");
must(api.includes('stage_review:stageReview'), "stage review must be retained as structured snapshot");
must(manager.includes('stageSummary'), "manager must display stage-specific information");
must(ui.includes("Préparer un mail"), "compact mail action missing");
must(ui.includes("Destinataire conseillé"), "mail recipient hierarchy missing");
must(ui.includes("Copies facultatives"), "optional CC hierarchy missing");
must(!ui.includes("profile.rating"), "rating must not drive feedback completion anymore");
must(ui.includes('stip:event-feedback-completed'), "completed feedback must notify the Home planning surface");
must(
  home.includes('window.addEventListener("stip:event-feedback-completed"') &&
    home.includes("resetWeekToCurrent();"),
  "Home must return to the real current week after a completed feedback"
);

must(api.includes("feedback_mode:'outcome'"), "backend must persist outcome semantics");
must(api.includes("outcomeOfAttendance"), "legacy attendance codes must map to explicit outcomes");
must(api.includes("createdByAgentId"), "agenda creator must be available for recipient routing");
must(api.includes("Référent de cet accompagnement"), "intern linked-recipient routing missing");
must(api.includes("bucket:'cc'"), "CC candidates must be classified explicitly");
must(api.includes("Lié au domaine de cet événement"), "domain recipient routing missing");
must(!api.includes("un point nécessite un suivi"), "generic off-topic mail draft must not return");
must(api.includes("Précision :"), "mail draft must be able to include the user's useful precision");

must(
  ui.includes('week.insertAdjacentElement("beforebegin", host)'),
  "feedback must be placed before the week separator"
);
must(
  ui.includes("submit.hidden = false;") && ui.includes("followUp = false"),
  "ordinary feedback should not require an extra follow-up answer"
);
must(
  !ui.includes("data-feedback-dismiss"),
  "pending cards must only disappear after a saved response"
);
must(
  ui.includes("reasonCode === code ?"),
  "selected professional reason must stay visible"
);
must(
  managerPage.includes('id="respEventFeedbackLog"') &&
    manager.includes('action:"manager_event_feedback"') &&
    manager.includes("function exportCsv()"),
  "manager must be able to consult and export official internal feedback"
);

const build = loader.match(/V = "(\d{8})-[^"]+"/);
must(build && build[1] >= "20261001", "feedback cache build predates the outcome runtime");

console.log("STIP event feedback contract: OK");

