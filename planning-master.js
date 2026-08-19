(()=>{'use strict';
const SHIFT={
 M:{label:'Matin',time:'06:50–14:40',tone:'blue'},
 J:{label:'Journée',time:'08:30–16:20',tone:'green'},
 J4:{label:'J4',time:'10:10–18:00',tone:'orange'},
 S:{label:'Soir',time:'13:30–21:00',tone:'yellow'},
 N:{label:'Nuit',time:'21:00–06:50',tone:'purple'},
 RH:{label:'Repos',time:'',tone:'rest'},RTT:{label:'RTT',time:'',tone:'rest'},RTTA:{label:'RTTA',time:'',tone:'rest'},RC:{label:'RC',time:'',tone:'rest'},CA:{label:'Congé',time:'',tone:'rest'},RF:{label:'RF',time:'',tone:'rest'},AA:{label:'AA',time:'',tone:'rest'},MA:{label:'Maladie',time:'',tone:'rest'},RTA:{label:'RTA',time:'',tone:'rest'},SYR:{label:'SYR',time:'',tone:'rest'},DA:{label:'DA',time:'',tone:'rest'},ABS:{label:'Absence',time:'',tone:'rest'}
};
const ORDER=['M','J','J4','S','N','RH','RTT','RTTA','RC','CA','RF','AA','MA','RTA','SYR','DA','ABS'];
window.STIPPlanningMaster=Object.freeze({SHIFT:Object.freeze(SHIFT),ORDER:Object.freeze(ORDER),weekendTogether:true,source:'Supabase planning-pdf / Drive 09_IMAGES_SHIFTS'});
})();