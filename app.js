(() => {
  "use strict";

  const STORAGE_KEY = "fitcheck-data-v1";
  const STARTER = {
    profile: { name: "", height: "", currentWeight: "", goal: "Body recomposition", unit: "kg" },
    targets: { calories: 2000, protein: 120, carbs: 220, fat: 65, water: 2500 },
    meals: [], workouts: [], weighIns: [], waterByDate: {}, reminders: [],
    routines: [], savedMeals: [], customFoods: [], plannedMeals: [], measurements: [], progressPhotos: [], theme: "dark"
  };

  const FOOD_LIBRARY = [
    {id:"roti",name:"Whole-wheat roti",serving:"1 medium",calories:110,protein:3.2,carbs:22,fat:1.2},
    {id:"rice",name:"Cooked rice",serving:"150 g",calories:195,protein:4,carbs:43,fat:0.4},
    {id:"dal",name:"Cooked dal",serving:"150 g",calories:160,protein:9,carbs:24,fat:3.5},
    {id:"milk",name:"Cow milk",serving:"250 ml",calories:150,protein:8,carbs:12,fat:8},
    {id:"banana",name:"Banana",serving:"1 medium",calories:105,protein:1.3,carbs:27,fat:0.4},
    {id:"egg",name:"Boiled egg",serving:"1 large",calories:72,protein:6.3,carbs:0.4,fat:4.8},
    {id:"curd",name:"Plain curd",serving:"200 g",calories:122,protein:7,carbs:9,fat:6},
    {id:"chana",name:"Roasted chana",serving:"30 g",calories:120,protein:6,carbs:18,fat:2},
    {id:"paneer",name:"Paneer",serving:"100 g",calories:265,protein:18,carbs:4,fat:20},
    {id:"soya",name:"Soya chunks (dry)",serving:"50 g",calories:173,protein:26,carbs:17,fat:0.5},
    {id:"oats",name:"Rolled oats",serving:"40 g",calories:154,protein:5,carbs:27,fat:3},
    {id:"peanuts",name:"Peanuts",serving:"30 g",calories:170,protein:7,carbs:5,fat:15},
    {id:"apple",name:"Apple",serving:"1 medium",calories:95,protein:0.5,carbs:25,fat:0.3},
    {id:"veg",name:"Mixed vegetables",serving:"150 g",calories:80,protein:3,carbs:12,fat:2},
    {id:"bread",name:"Whole-wheat bread",serving:"2 slices",calories:160,protein:6,carbs:28,fat:2},
    {id:"shake",name:"Banana milk shake",serving:"300 ml",calories:270,protein:10,carbs:43,fat:7}
  ];

  const EXERCISE_LIBRARY = {
    Chest:["Barbell bench press","Incline dumbbell press","Decline bench press","Cable chest fly","Push-ups"],
    Back:["Lat pulldown","Seated cable row","One-arm dumbbell row","Chest-supported row","Back extension"],
    Shoulders:["Seated shoulder press","Dumbbell lateral raise","Rear-delt fly","Front raise","Face pull"],
    Biceps:["Barbell curl","Alternating dumbbell curl","Hammer curl","Incline dumbbell curl","Cable curl"],
    Triceps:["Rope pushdown","Overhead cable extension","Skull crusher","Close-grip bench press","Dumbbell kickback"],
    Legs:["Barbell squat","Leg press","Romanian deadlift","Leg extension","Leg curl"],
    Core:["Plank","Cable crunch","Hanging knee raise","Reverse crunch","Dead bug"]
  };

  let state = loadState();
  let currentPage = "dashboard";
  let editingRoutineId = null;
  let calendarOffset = 0;
  let restRemaining = 90;
  let restPreset = 90;
  let restEndAt = 0;
  let restInterval = null;

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return clone(STARTER);
      const parsed = JSON.parse(raw);
      return {
        ...clone(STARTER), ...parsed,
        profile: {...STARTER.profile,...(parsed.profile || {})},
        targets: {...STARTER.targets,...(parsed.targets || {})},
        meals: Array.isArray(parsed.meals) ? parsed.meals : [],
        workouts: Array.isArray(parsed.workouts) ? parsed.workouts : [],
        weighIns: Array.isArray(parsed.weighIns) ? parsed.weighIns : [],
        waterByDate: parsed.waterByDate || {},
        reminders: Array.isArray(parsed.reminders) ? parsed.reminders : [],
        routines: Array.isArray(parsed.routines) ? parsed.routines : [],
        savedMeals: Array.isArray(parsed.savedMeals) ? parsed.savedMeals : [],
        customFoods: Array.isArray(parsed.customFoods) ? parsed.customFoods : [],
        plannedMeals: Array.isArray(parsed.plannedMeals) ? parsed.plannedMeals : [],
        measurements: Array.isArray(parsed.measurements) ? parsed.measurements : [],
        progressPhotos: Array.isArray(parsed.progressPhotos) ? parsed.progressPhotos : [],
        theme: parsed.theme === "light" ? "light" : "dark"
      };
    } catch (error) {
      console.warn("FitCheck could not read saved data.",error);
      return clone(STARTER);
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY,JSON.stringify(state));
      return true;
    } catch (error) {
      toast("Could not save. Export a backup and check browser storage.");
      return false;
    }
  }

  const $ = (selector,root=document) => root.querySelector(selector);
  const $$ = (selector,root=document) => Array.from(root.querySelectorAll(selector));
  const num = value => { const n=Number(value); return Number.isFinite(n)?n:0; };
  const round = value => Math.round(num(value)*10)/10;
  const clamp = (value,min=0,max=100) => Math.min(max,Math.max(min,value));
  const safe = value => String(value ?? "").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  const makeId = () => window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : String(Date.now())+Math.random().toString(16).slice(2);

  function dateKey(date=new Date()) {
    return date.getFullYear()+"-"+String(date.getMonth()+1).padStart(2,"0")+"-"+String(date.getDate()).padStart(2,"0");
  }
  function dateFromKey(key) {
    const p=String(key||"").split("-").map(Number);
    return new Date(p[0]||2000,(p[1]||1)-1,p[2]||1);
  }
  function prettyDate(key,options={day:"numeric",month:"short"}) {
    return key ? dateFromKey(key).toLocaleDateString("en-IN",options) : "Today";
  }
  function todayMeals() { return state.meals.filter(x=>x.date===dateKey()); }
  function todayWorkouts() { return state.workouts.filter(x=>x.date===dateKey()); }
  function nutritionTotals(items) {
    return items.reduce((t,x)=>{t.calories+=num(x.calories);t.protein+=num(x.protein);t.carbs+=num(x.carbs);t.fat+=num(x.fat);return t;},{calories:0,protein:0,carbs:0,fat:0});
  }
  function statCard(label,value,unit,foot,symbol) {
    return "<article class='stat-card'><div class='stat-top'><span>"+label+"</span><span class='stat-symbol'>"+symbol+"</span></div><div class='stat-value'>"+value+" <small>"+unit+"</small></div><div class='stat-foot'>"+foot+"</div></article>";
  }
  function emptyState(icon,title,copy,actionLabel,action) {
    return "<div class='empty-state'><div class='empty-icon'>"+icon+"</div><strong>"+title+"</strong><span>"+copy+"</span>"+(actionLabel?"<div style='margin-top:13px'><button class='btn btn-secondary btn-small' data-action='"+action+"'>"+actionLabel+"</button></div>":"")+"</div>";
  }
  function macroRow(label,current,target,kind,unit) {
    const pct=target>0?clamp(current/target*100):0;
    return "<div class='macro-row'><div class='macro-info'><span class='macro-name'><i class='macro-dot "+kind+"'></i>"+label+"</span><strong>"+round(current)+"<small> / "+target+" "+unit+"</small></strong></div><div class='progress-track'><div class='progress-fill "+kind+"' style='width:"+pct+"%'></div></div></div>";
  }
  function toast(message) {
    const node=document.createElement("div");
    node.className="toast";node.textContent=message;
    $("#toast-region").appendChild(node);
    setTimeout(()=>node.remove(),2800);
  }
  function openModal(title,content,eyebrow="QUICK ADD") {
    $("#modal-title").textContent=title;$("#modal-eyebrow").textContent=eyebrow;
    $("#modal-body").innerHTML=content;$("#modal-backdrop").hidden=false;document.body.style.overflow="hidden";
    const first=$("input:not([type=hidden]),select,textarea",$("#modal-body"));
    if(first) setTimeout(()=>first.focus(),30);
  }
  function closeModal() { $("#modal-backdrop").hidden=true;document.body.style.overflow=""; }
  function formValues(form) { return Object.fromEntries(new FormData(form).entries()); }

  function mealIcon(category) { return ({Breakfast:"☀",Lunch:"◒",Dinner:"☾",Snack:"✳"})[category]||"◉"; }
  function renderMealItems(items,showDelete=false) {
    if(!items.length) return emptyState("◉","No meals logged yet","Add your first meal to start your daily nutrition log.","Add a meal","add-meal");
    return "<div class='meal-list'>"+items.slice().sort((a,b)=>(a.time||"").localeCompare(b.time||"")).map(item=>
      "<div class='list-item'><div class='list-icon'>"+mealIcon(item.category)+"</div><div class='list-copy'><strong>"+safe(item.name)+"</strong><span>"+safe(item.category||"Meal")+" · "+prettyDate(item.date)+(item.time?" · "+safe(item.time):"")+"</span></div><div class='list-meta'>"+Math.round(num(item.calories))+" kcal<small>P "+round(item.protein)+"g · C "+round(item.carbs)+"g · F "+round(item.fat)+"g</small></div>"+
      (showDelete?"<button class='icon-button' data-action='delete-meal' data-id='"+safe(item.id)+"' aria-label='Delete meal'>×</button>":"")+"</div>"
    ).join("")+"</div>";
  }

  function lastSevenDays() {
    const days=[];
    for(let i=6;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);days.push({date:d,key:dateKey(d),label:d.toLocaleDateString("en-IN",{weekday:"short"}).slice(0,2)});}
    return days;
  }
  function weeklyStats() {
    const days=lastSevenDays(), keys=days.map(x=>x.key);
    const workouts=state.workouts.filter(x=>keys.includes(x.date));
    const loggedDays=days.filter(d=>state.meals.some(x=>x.date===d.key));
    const totalsByDay=loggedDays.map(d=>nutritionTotals(state.meals.filter(x=>x.date===d.key)));
    const avg=totalsByDay.length?totalsByDay.reduce((t,x)=>({calories:t.calories+x.calories,protein:t.protein+x.protein}),{calories:0,protein:0}):{calories:0,protein:0};
    const water=days.reduce((sum,d)=>sum+num(state.waterByDate[d.key]),0);
    return {days,workouts,loggedDays:loggedDays.length,avgCalories:loggedDays.length?avg.calories/loggedDays.length:0,avgProtein:loggedDays.length?avg.protein/loggedDays.length:0,avgWater:water/7};
  }
  function renderActivityBars() {
    const days=lastSevenDays(),counts=days.map(d=>state.workouts.filter(x=>x.date===d.key).length),max=Math.max(1,...counts);
    return "<div class='activity-bars'>"+days.map((d,i)=>"<div class='activity-day'><div class='activity-bar-wrap'><div class='activity-bar "+(d.key===dateKey()?"today":"")+"' style='height:"+Math.max(4,counts[i]/max*100)+"%'></div></div><span>"+d.label+"</span><small>"+(counts[i]||"·")+"</small></div>").join("")+"</div>";
  }
  function renderWeeklySnapshot() {
    const w=weeklyStats();
    return "<section class='panel'><div class='panel-head'><div><h2>Your last 7 days</h2><div class='panel-sub'>A quick consistency snapshot, not a pass-or-fail score</div></div><span class='tag'>WEEKLY</span></div><div class='weekly-mini-grid'>"+
      "<div><strong>"+w.workouts.length+"</strong><span>workout sessions</span></div><div><strong>"+Math.round(w.avgProtein)+" g</strong><span>protein / logged day</span></div><div><strong>"+Math.round(w.avgCalories)+"</strong><span>calories / logged day</span></div><div><strong>"+(w.avgWater/1000).toFixed(1)+" L</strong><span>water / day</span></div></div></section>";
  }

  function renderDashboard() {
    const meals=todayMeals(),workouts=todayWorkouts(),totals=nutritionTotals(meals),targets=state.targets;
    const water=num(state.waterByDate[dateKey()]);
    const lastWeight=state.weighIns.slice().sort((a,b)=>b.date.localeCompare(a.date))[0];
    const first=(state.profile.name||"there").trim().split(/\s+/)[0];
    const totalSets=workouts.reduce((s,w)=>s+(w.exercises||[]).reduce((a,e)=>a+num(e.sets),0),0);
    const pct=targets.calories?clamp(totals.calories/targets.calories*100):0;
    const circumference=314.16;
    return "<div class='page-heading'><div><span class='eyebrow'>YOUR PERSONAL FITNESS SPACE</span><h1>Good to see you, "+safe(first)+".</h1><p>Small consistent actions. Clear progress. Your snapshot for today.</p></div><div class='heading-actions'><button class='btn btn-secondary' data-action='add-meal'>＋ Log food</button><button class='btn btn-primary' data-action='add-workout'>＋ Log workout</button></div></div>"+
      "<div class='grid stats-grid'>"+statCard("Calories consumed",Math.round(totals.calories).toLocaleString("en-IN"),"kcal",Math.round(pct)+"% of daily target","◉")+statCard("Protein so far",round(totals.protein),"g","Target: "+targets.protein+" g","✳")+statCard("Training sessions",workouts.length,"today",totalSets+" working sets today","↗")+statCard("Latest weigh-in",lastWeight?round(lastWeight.weight):"—",lastWeight?state.profile.unit:"",lastWeight?"Recorded "+prettyDate(lastWeight.date):"Add your first check-in","⌁")+"</div>"+
      "<div class='grid dashboard-grid'><div><section class='panel'><div class='panel-head'><div><h2>Nutrition at a glance</h2><div class='panel-sub'>Today's intake compared with your targets</div></div><button class='inline-link' data-page='nutrition'>View nutrition →</button></div><div class='macro-layout'><div class='calorie-ring'><svg viewBox='0 0 120 120' aria-hidden='true'><circle class='ring-track' cx='60' cy='60' r='50'></circle><circle class='ring-progress' cx='60' cy='60' r='50' stroke-dasharray='"+(circumference*pct/100)+" "+circumference+"'></circle></svg><div class='ring-center'><strong>"+Math.round(totals.calories).toLocaleString("en-IN")+"</strong><span>kcal eaten</span><small>"+Math.max(0,Math.round(targets.calories-totals.calories))+" kcal left</small></div></div><div class='macro-list'>"+macroRow("Protein",totals.protein,targets.protein,"","g")+macroRow("Carbs",totals.carbs,targets.carbs,"carbs","g")+macroRow("Fat",totals.fat,targets.fat,"fat","g")+"</div></div></section>"+
      "<section class='panel'><div class='panel-head'><div><h2>Today's meals</h2><div class='panel-sub'>"+meals.length+" entries added</div></div><button class='inline-link' data-action='add-meal'>＋ Add meal</button></div>"+renderMealItems(meals)+"</section>"+
      "<section class='panel'><div class='panel-head'><div><h2>Training rhythm</h2><div class='panel-sub'>Sessions across the last seven days</div></div><button class='inline-link' data-page='workouts'>Workout studio →</button></div>"+renderActivityBars()+"</section></div>"+
      "<div><section class='panel'><div class='panel-head'><div><h2>Hydration</h2><div class='panel-sub'>Small sips, steady progress</div></div><span class='tag blue'>DAILY</span></div><div class='water-card'><div class='water-visual'>♧</div><div class='water-copy'><strong>"+(water/1000).toFixed(2)+"<small style='font-size:12px;color:#96a58e'> L</small></strong><p>of "+(targets.water/1000).toFixed(1)+" L daily target</p><div class='progress-track'><div class='progress-fill water' style='width:"+(targets.water?clamp(water/targets.water*100):0)+"%'></div></div></div></div><div class='water-actions'><button data-action='add-water' data-ml='250'>＋ 250 ml</button><button data-action='add-water' data-ml='500'>＋ 500 ml</button></div></section>"+
      "<section class='panel'><div class='panel-head'><div><h2>Today's training</h2><div class='panel-sub'>"+workouts.length+" session(s) logged</div></div><button class='inline-link' data-action='add-workout'>＋ Add</button></div>"+renderWorkoutItems(workouts,false)+"</section>"+
      renderWeeklySnapshot()+"</div></div>";
  }

  function renderWorkoutItems(items,showActions=false) {
    if(!items.length) return emptyState("↗","No workouts logged","Start from a saved routine or log a workout from scratch.","Log your first workout","add-workout");
    return "<div class='workout-list'>"+items.slice().sort((a,b)=>(b.createdAt||b.date||"").localeCompare(a.createdAt||a.date||"")).map(item=>{
      const exercises=item.exercises||[],sets=exercises.reduce((s,e)=>s+normaliseSets(e).length,0);
      const breakdown=exercises.map(e=>{
        const details=normaliseSets(e);
        return "<div class='workout-exercise-detail'><strong>"+safe(e.name)+"</strong><div>"+details.map((x,i)=>"<span>Set "+(i+1)+": "+safe(x.reps)+" reps × "+round(x.weight)+" kg</span>").join("")+"</div></div>";
      }).join("");
      return "<article class='workout-history-card'><div class='list-item'><div class='list-icon'>↗</div><div class='list-copy'><strong>"+safe(item.name)+"</strong><span>"+safe(item.muscle||"Training")+" · "+exercises.length+" exercises · "+sets+" sets</span></div><div class='list-meta'>"+safe(item.duration||0)+" min<small>"+prettyDate(item.date)+"</small></div>"+
        (showActions?"<button class='icon-button' data-action='edit-workout' data-id='"+safe(item.id)+"' aria-label='Edit workout'>✎</button><button class='icon-button' data-action='delete-workout' data-id='"+safe(item.id)+"' aria-label='Delete workout'>×</button>":"")+"</div><details class='workout-breakdown'><summary>View set-by-set log</summary><div class='workout-breakdown-list'>"+breakdown+"</div>"+(item.notes?"<p class='workout-saved-note'>"+safe(item.notes)+"</p>":"")+"</details></article>";
    }).join("")+"</div>";
  }

  function normaliseSets(exercise) {
    if(Array.isArray(exercise.setDetails)&&exercise.setDetails.length) return exercise.setDetails.map(s=>({reps:num(s.reps),weight:num(s.weight)}));
    const reps=String(exercise.reps||"12").split(/[\/,]/).map(x=>num(x.trim())).filter(Boolean);
    const count=Math.max(1,num(exercise.sets)||3);
    return Array.from({length:count},(_,i)=>({reps:reps[i]||reps[reps.length-1]||12,weight:num(exercise.load)}));
  }

  function previousExercise(name,beforeDate) {
    const match=[];
    state.workouts.filter(w=>w.date<beforeDate).forEach(w=>(w.exercises||[]).forEach(e=>{
      if(e.name.toLowerCase()===name.toLowerCase()) normaliseSets(e).forEach(s=>match.push({date:w.date,weight:s.weight,reps:s.reps}));
    }));
    return match.sort((a,b)=>b.date.localeCompare(a.date))[0]||null;
  }
  function bestExerciseRecords() {
    const best={};
    state.workouts.forEach(w=>(w.exercises||[]).forEach(e=>normaliseSets(e).forEach(s=>{
      const k=e.name.toLowerCase();
      if(!best[k]||s.weight>best[k].weight) best[k]={name:e.name,weight:s.weight,reps:s.reps,date:w.date};
    })));
    return Object.values(best).sort((a,b)=>b.weight-a.weight).slice(0,8);
  }

  function setRow(index,set={}) {
    return "<div class='set-entry'><span class='set-number'>"+(index+1)+"</span><label><span>Reps</span><input name='setReps' type='number' min='1' max='200' value='"+safe(set.reps||12)+"' required></label><label><span>Weight kg</span><input name='setWeight' type='number' min='0' step='0.5' value='"+safe(set.weight||0)+"'></label><button type='button' class='icon-button set-remove' data-action='remove-set' aria-label='Remove set'>×</button></div>";
  }
  function exerciseRow(exercise={}) {
    const sets=normaliseSets(exercise.name?exercise:{sets:3,reps:"20 / 15 / 12",load:0});
    const prev=exercise.name?previousExercise(exercise.name,dateKey()):null;
    return "<div class='exercise-entry'><div class='exercise-entry-head'><label class='exercise-name-field'><span>Exercise name</span><input name='exerciseName' required maxlength='70' placeholder='e.g. Bench press' value='"+safe(exercise.name||"")+"'></label><button type='button' class='icon-button exercise-remove' data-action='remove-exercise' aria-label='Remove exercise'>×</button></div>"+
      (prev?"<div class='previous-performance'>Last time · "+prettyDate(prev.date)+" · "+prev.weight+" kg × "+prev.reps+" reps</div>":"")+
      "<div class='set-entry-heading'><span>SET</span><span>REPS</span><span>LOAD (KG)</span><span></span></div><div class='set-entry-list'>"+sets.map((s,i)=>setRow(i,s)).join("")+"</div>"+
      "<button type='button' class='inline-link add-set-link' data-action='add-set'>＋ Add set</button></div>";
  }
  function workoutForm(workout=null) {
    const exercises=workout?(workout.exercises||[]):[];
    const rows=exercises.length?exercises.map(exerciseRow).join(""):exerciseRow();
    const focuses=["Chest","Back","Shoulders","Biceps","Triceps","Legs","Core","Full body","Cardio","Other"];
    return "<form id='workout-form' data-editing='"+safe(workout?workout.id:"")+"'><div class='form-grid'><div class='form-field'><label for='workout-name'>Session name</label><input id='workout-name' name='name' required maxlength='60' placeholder='e.g. Chest day' value='"+safe(workout?workout.name:"")+"'></div>"+
      "<div class='form-field'><label for='workout-muscle'>Focus</label><select id='workout-muscle' name='muscle'>"+focuses.map(n=>"<option "+(workout&&workout.muscle===n?"selected":"")+">"+n+"</option>").join("")+"</select></div>"+
      "<div class='form-field'><label for='workout-duration'>Duration (minutes)</label><input id='workout-duration' name='duration' type='number' min='0' max='600' value='"+safe(workout?workout.duration:60)+"'></div>"+
      "<div class='form-field'><label for='workout-date'>Date</label><input id='workout-date' name='date' type='date' value='"+safe(workout?workout.date:dateKey())+"' required></div></div>"+
      "<div class='section-title'>Exercises and working sets</div><div class='exercise-builder' id='exercise-builder'>"+rows+"</div><button type='button' class='btn btn-secondary btn-small' style='margin-top:12px' data-action='add-exercise'>＋ Add exercise</button>"+
      "<div class='form-field' style='margin-top:14px'><label for='workout-notes'>Session notes</label><textarea id='workout-notes' name='notes' rows='2' maxlength='500' placeholder='How did the session feel?'>"+safe(workout?workout.notes:"")+"</textarea></div>"+
      "<div class='modal-actions'><button type='button' class='btn btn-ghost' data-action='close-modal'>Cancel</button><button class='btn btn-primary' type='submit'>"+(workout?"Update workout":"Save workout")+"</button></div></form>";
  }

  function routineExerciseCard(name,savedExercise,defaultSelected=false) {
    const active=Boolean(savedExercise)||defaultSelected,sets=savedExercise?normaliseSets(savedExercise):[{reps:20,weight:0},{reps:15,weight:0},{reps:12,weight:0}];
    return "<div class='routine-exercise-card' data-exercise='"+safe(name)+"'><label class='routine-exercise-top'><input class='routine-check' type='checkbox' "+(active?"checked":"")+"><span>"+safe(name)+"</span><i>✓</i></label>"+
      "<div class='routine-exercise-fields'><label>Sets<input data-routine-sets type='number' min='1' max='20' value='"+sets.length+"' "+(active?"":"disabled")+"></label>"+
      "<label>Reps (slash separated)<input data-routine-reps maxlength='30' value='"+sets.map(x=>x.reps).join(" / ")+"' "+(active?"":"disabled")+"></label>"+
      "<label>Load kg<input data-routine-load type='number' min='0' step='0.5' value='"+(savedExercise?savedExercise.load||0:0)+"' "+(active?"":"disabled")+"></label></div></div>";
  }
  function customRoutineRow(x={}) {
    return "<div class='routine-custom-row'><input data-custom-name maxlength='60' placeholder='Your custom exercise' value='"+safe(x.name||"")+"'><input data-custom-sets type='number' min='1' max='20' value='"+safe(x.sets||3)+"' aria-label='Sets'><input data-custom-reps maxlength='30' value='"+safe(x.reps||"20 / 15 / 12")+"' aria-label='Reps'><input data-custom-load type='number' min='0' step='0.5' value='"+safe(x.load||0)+"' aria-label='Load in kilograms'><button type='button' class='remove-exercise' data-action='remove-custom-routine-exercise'>×</button></div>";
  }
  function routineBuilder(routine=null) {
    const muscle=routine?routine.muscle:"Chest",names=EXERCISE_LIBRARY[muscle]||[];
    const selected=routine?(routine.exercises||[]):[];
    const cards=names.map(name=>{
      const saved=selected.find(x=>x.name===name);
      return routine?routineExerciseCard(name,saved||null,false):routineExerciseCard(name,null,true);
    }).join("");
    const custom=selected.filter(x=>!names.includes(x.name));
    return "<form id='routine-form' data-editing='"+safe(routine?routine.id:"")+"'><div class='routine-builder-head'><div><span class='eyebrow'>YOUR TRAINING BLUEPRINT</span><h3>"+(routine?"Edit routine":"Create a routine")+"</h3><p>Choose exercises, define your sets and save this training day.</p></div>"+(routine?"<button type='button' class='btn btn-ghost btn-small' data-action='cancel-routine-edit'>Cancel</button>":"")+"</div>"+
      "<div class='form-grid routine-form-fields'><div class='form-field'><label for='routine-name'>Routine name</label><input id='routine-name' name='name' required maxlength='50' value='"+safe(routine?routine.name:muscle+" day")+"'></div><div class='form-field'><label for='routine-muscle'>Muscle group</label><select id='routine-muscle' name='muscle' data-previous='"+safe(muscle)+"'>"+Object.keys(EXERCISE_LIBRARY).map(m=>"<option "+(m===muscle?"selected":"")+">"+m+"</option>").join("")+"</select></div></div>"+
      "<div class='routine-library-head'><div><strong>Exercise library</strong><span>Five options for each muscle group</span></div><span class='tag'>SET YOUR PLAN</span></div><div class='routine-exercise-grid' id='routine-exercise-grid'>"+cards+"</div>"+
      "<div class='routine-library-head custom-head'><div><strong>Custom exercises</strong><span>Add movements outside the library</span></div><button type='button' class='btn btn-secondary btn-small' data-action='add-custom-routine-exercise'>＋ Add custom</button></div><div class='routine-custom-list' id='routine-custom-list'>"+custom.map(customRoutineRow).join("")+"</div>"+
      "<div class='form-field routine-notes-field'><label for='routine-notes'>Training notes</label><textarea id='routine-notes' name='notes' rows='3' maxlength='500' placeholder='Cues, warm-up, rest time or exercise substitutions...'>"+safe(routine?routine.notes:"")+"</textarea></div>"+
      "<div class='routine-form-footer'><span class='small-note'>Saved on this device and included in your backup.</span><button class='btn btn-primary' type='submit'>"+(routine?"Update routine":"Save routine")+"</button></div></form>";
  }
  function renderSavedRoutines() {
    if(!state.routines.length)return emptyState("＋","No routines saved","Build a training day and save it to reuse later.");
    return "<div class='saved-routine-list'>"+state.routines.map(r=>{
      const count=(r.exercises||[]).length,sets=(r.exercises||[]).reduce((s,e)=>s+num(e.sets),0);
      return "<article class='saved-routine-card'><div class='saved-routine-top'><div><span class='routine-muscle-tag'>"+safe(r.muscle)+"</span><h4>"+safe(r.name)+"</h4></div><button class='icon-button' data-action='edit-routine' data-id='"+safe(r.id)+"' aria-label='Edit routine'>✎</button></div><p>"+count+" exercises · "+sets+" sets</p><div class='routine-exercise-chips'>"+(r.exercises||[]).slice(0,5).map(e=>"<span>"+safe(e.name)+"</span>").join("")+"</div>"+
        (r.notes?"<div class='saved-routine-note'>"+safe(r.notes)+"</div>":"")+"<div class='saved-routine-actions'><button class='btn btn-primary btn-small' data-action='start-routine' data-id='"+safe(r.id)+"'>Start workout ↗</button><button class='btn btn-ghost btn-small' data-action='delete-routine' data-id='"+safe(r.id)+"'>Delete</button></div></article>";
    }).join("")+"</div>";
  }
  function saveRoutine(form) {
    const v=formValues(form),editing=form.dataset.editing||"";
    const selected=$$(".routine-exercise-card",form).filter(card=>$(".routine-check",card).checked).map(card=>{
      const sets=Math.max(1,num($("[data-routine-sets]",card).value));
      const reps=String($("[data-routine-reps]",card).value||"12").split(/[\/,]/).map(x=>num(x.trim())).filter(Boolean);
      const load=num($("[data-routine-load]",card).value);
      const setDetails=Array.from({length:sets},(_,i)=>({reps:reps[i]||reps[reps.length-1]||12,weight:load}));
      return {name:card.dataset.exercise,sets,reps:$("[data-routine-reps]",card).value,load,setDetails};
    });
    const custom=$$(".routine-custom-row",form).map(row=>{
      const sets=Math.max(1,num($("[data-custom-sets]",row).value)),reps=num($("[data-custom-reps]",row).value.split(/[\/,]/)[0])||12,load=num($("[data-custom-load]",row).value);
      return {name:$("[data-custom-name]",row).value.trim(),sets,reps:String($("[data-custom-reps]",row).value),load,setDetails:Array.from({length:sets},()=>({reps,weight:load}))};
    }).filter(x=>x.name);
    const exercises=selected.concat(custom);
    if(!exercises.length){toast("Select at least one exercise.");return;}
    const item={id:editing||makeId(),name:v.name.trim(),muscle:v.muscle,notes:v.notes.trim(),exercises,updatedAt:new Date().toISOString()};
    const index=state.routines.findIndex(x=>x.id===editing);
    if(index>=0)state.routines[index]=item;else state.routines.unshift(item);
    editingRoutineId=null;saveState();render();toast(index>=0?"Routine updated.":"Routine saved.");
  }

  function getMonthDate(offset=0) { const d=new Date();return new Date(d.getFullYear(),d.getMonth()+offset,1); }
  function renderWorkoutCalendar() {
    const month=getMonthDate(calendarOffset),year=month.getFullYear(),m=month.getMonth(),first=new Date(year,m,1),daysInMonth=new Date(year,m+1,0).getDate();
    const offset=(first.getDay()+6)%7,labels=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
    let cells=labels.map(x=>"<div class='calendar-weekday'>"+x+"</div>").join("");
    for(let i=0;i<offset;i++)cells+="<div class='calendar-cell muted-cell'></div>";
    for(let day=1;day<=daysInMonth;day++){
      const key=dateKey(new Date(year,m,day)),sessions=state.workouts.filter(w=>w.date===key),isToday=key===dateKey();
      cells+="<div class='calendar-cell "+(isToday?"calendar-today ":"")+(sessions.length?"has-training":"")+"' title='"+sessions.length+" workouts'><span>"+day+"</span>"+(sessions.length?"<i>"+sessions.length+"</i>":"")+"</div>";
    }
    return "<section class='panel'><div class='panel-head'><div><h2>Workout calendar</h2><div class='panel-sub'>Your training days at a glance</div></div><div class='calendar-controls'><button class='icon-button' data-action='calendar-prev' aria-label='Previous month'>‹</button><strong>"+month.toLocaleDateString("en-IN",{month:"long",year:"numeric"})+"</strong><button class='icon-button' data-action='calendar-next' aria-label='Next month'>›</button></div></div><div class='calendar-grid'>"+cells+"</div></section>";
  }
  function renderPersonalRecords() {
    const records=bestExerciseRecords();
    if(!records.length)return emptyState("★","No personal records yet","Your heaviest recorded set for each exercise will appear here.");
    return "<div class='pr-list'>"+records.slice(0,6).map(r=>"<div><span>"+safe(r.name)+"</span><strong>"+round(r.weight)+" kg</strong><small>"+r.reps+" reps · "+prettyDate(r.date)+"</small></div>").join("")+"</div>";
  }

  function formatClock(seconds) {
    const mm=String(Math.floor(seconds/60)).padStart(2,"0"),ss=String(seconds%60).padStart(2,"0");
    return mm+":"+ss;
  }
  function renderRestTimer() {
    return "<section class='panel rest-timer-panel'><div class='panel-head'><div><h2>Rest timer</h2><div class='panel-sub'>A simple timer between working sets</div></div><span class='tag'>TRAINING TOOL</span></div><div class='rest-timer-layout'><div class='rest-timer-display' id='rest-timer-display'>"+formatClock(restRemaining)+"</div><div class='rest-timer-controls'><div class='rest-presets'><button data-action='rest-preset' data-seconds='60'>60s</button><button data-action='rest-preset' data-seconds='90'>90s</button><button data-action='rest-preset' data-seconds='120'>120s</button></div><div class='rest-main-actions'><button class='btn btn-primary' id='rest-start-button' data-action='rest-start'>Start</button><button class='btn btn-ghost btn-small' data-action='rest-reset'>Reset</button></div></div></div></section>";
  }
  function updateRestTimer() {
    const display=$("#rest-timer-display"),start=$("#rest-start-button");
    if(display)display.textContent=formatClock(restRemaining);
    if(start)start.textContent=restInterval?"Pause":"Start";
  }
  function stopRestTimer() {
    if(restInterval!==null){clearInterval(restInterval);restInterval=null;}
    restEndAt=0;updateRestTimer();
  }
  function startRestTimer() {
    if(restInterval!==null){restRemaining=Math.max(0,Math.ceil((restEndAt-Date.now())/1000));stopRestTimer();return;}
    if(restRemaining<=0)restRemaining=restPreset;
    restEndAt=Date.now()+restRemaining*1000;
    restInterval=setInterval(()=>{
      restRemaining=Math.max(0,Math.ceil((restEndAt-Date.now())/1000));updateRestTimer();
      if(restRemaining===0){
        stopRestTimer();
        if("Notification" in window&&Notification.permission==="granted")new Notification("FitCheck · Rest complete",{body:"Your next set is ready when you are.",icon:"./icon.svg"});
        else toast("Rest complete. Ready for your next set?");
      }
    },250);
    updateRestTimer();
  }

  function renderWorkouts() {
    const totalSets=state.workouts.reduce((s,w)=>s+(w.exercises||[]).reduce((a,e)=>a+normaliseSets(e).length,0),0);
    const minutes=state.workouts.reduce((s,w)=>s+num(w.duration),0);
    const editing=editingRoutineId?state.routines.find(x=>x.id===editingRoutineId):null;
    return "<div class='page-heading'><div><span class='eyebrow'>SHOW UP. PUT IN THE WORK.</span><h1>Workout studio</h1><p>Plan training days, log each working set and keep your strength moving.</p></div><div class='heading-actions'><button class='btn btn-secondary' data-action='add-workout'>＋ Quick log</button></div></div>"+
      "<div class='grid stats-grid'>"+statCard("Sessions logged",state.workouts.length,"total","Every session you record","↗")+statCard("Working sets",totalSets,"sets","Across all logged sessions","▤")+statCard("Training time",Math.round(minutes/60*10)/10,"hours","Based on logged duration","◷")+statCard("Saved routines",state.routines.length,"plans","Reusable training days","✳")+"</div>"+
      "<section class='panel routine-studio-panel'><div class='panel-head'><div><span class='eyebrow'>PLAN · SAVE · REPEAT</span><h2>Routine studio</h2><div class='panel-sub'>Build a routine once and load it into your workout when you train.</div></div><span class='tag'>PERSONAL PLAN BUILDER</span></div><div class='routine-studio-grid'><div class='routine-builder-column'>"+routineBuilder(editing)+"</div><aside class='routine-saved-column'><div class='saved-routine-heading'><div><h3>Saved routines</h3><p>"+state.routines.length+" training day(s) ready</p></div><span class='saved-count'>"+state.routines.length+"</span></div>"+renderSavedRoutines()+"</aside></div></section>"+
      "<div class='grid workout-lower-grid'>"+renderWorkoutCalendar()+"<section class='panel'><div class='panel-head'><div><h2>Personal records</h2><div class='panel-sub'>Heaviest logged set by exercise</div></div><span class='tag'>STRENGTH</span></div>"+renderPersonalRecords()+"</section></div><div class='rest-timer-slot'>"+renderRestTimer()+"</div>"+
      "<section class='panel session-history-panel'><div class='panel-head'><div><h2>Session history</h2><div class='panel-sub'>Open a workout to inspect each set or edit it.</div></div><button class='inline-link' data-action='add-workout'>＋ Log workout</button></div>"+renderWorkoutItems(state.workouts,true)+"</section>";
  }

  function foodItem(id) { return FOOD_LIBRARY.concat(state.customFoods).find(f=>f.id===id); }
  function foodCard(food) {
    return "<article class='food-card' data-food-card data-search='"+safe(food.name.toLowerCase())+"'><div><strong>"+safe(food.name)+"</strong><span>"+safe(food.serving||"1 serving")+"</span></div><div class='food-card-macros'><b>"+food.calories+" kcal</b><small>P "+food.protein+"g · C "+food.carbs+"g · F "+food.fat+"g</small></div><button class='btn btn-secondary btn-small' data-action='add-food' data-id='"+safe(food.id)+"'>＋ Add</button></article>";
  }
  function savedMealCard(preset) {
    return "<article class='saved-meal-card'><div><strong>"+safe(preset.name)+"</strong><span>"+Math.round(preset.calories)+" kcal · "+round(preset.protein)+"g protein</span></div><button class='btn btn-primary btn-small' data-action='use-saved-meal' data-id='"+safe(preset.id)+"'>Add today</button><button class='icon-button' data-action='delete-saved-meal' data-id='"+safe(preset.id)+"' aria-label='Remove saved meal'>×</button></article>";
  }
  function renderPlanner() {
    const planned=state.plannedMeals.filter(p=>p.date>=dateKey()).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time)).slice(0,5);
    return "<section class='panel'><div class='panel-head'><div><h2>Meal planner</h2><div class='panel-sub'>Plan a meal ahead so you know what's coming.</div></div><button class='btn btn-secondary btn-small' data-action='plan-meal'>＋ Plan meal</button></div>"+
      (planned.length?"<div class='planned-meals'>"+planned.map(p=>"<div class='planned-meal'><div><strong>"+safe(p.name)+"</strong><span>"+prettyDate(p.date,{weekday:"short",day:"numeric",month:"short"})+" · "+safe(p.time||"Any time")+" · "+safe(p.category)+"</span></div><button class='icon-button' data-action='delete-planned-meal' data-id='"+safe(p.id)+"'>×</button></div>").join("")+"</div>":emptyState("▦","No upcoming meals","Add a meal plan for a future day.","Plan a meal","plan-meal"))+"</section>";
  }
  function renderNutrition() {
    const meals=todayMeals(),totals=nutritionTotals(meals),targets=state.targets,dates=[...new Set(state.meals.map(x=>x.date))].sort().reverse().slice(0,7);
    const foods=FOOD_LIBRARY.concat(state.customFoods);
    return "<div class='page-heading'><div><span class='eyebrow'>FUEL YOUR TRAINING</span><h1>Nutrition tracker</h1><p>Search your food library, save meals you repeat and plan ahead.</p></div><div class='heading-actions'><button class='btn btn-primary' data-action='add-meal'>＋ Custom meal</button></div></div>"+
      "<div class='grid stats-grid'>"+statCard("Calories",Math.round(totals.calories),"kcal","Target: "+targets.calories+" kcal","◉")+statCard("Protein",round(totals.protein),"g","Target: "+targets.protein+" g","✳")+statCard("Carbohydrates",round(totals.carbs),"g","Target: "+targets.carbs+" g","⌁")+statCard("Fat",round(totals.fat),"g","Target: "+targets.fat+" g","◍")+"</div>"+
      "<section class='panel food-library-panel'><div class='panel-head'><div><h2>Food library</h2><div class='panel-sub'>Common foods with estimated nutrition per serving. Check labels for accuracy.</div></div><button class='btn btn-secondary btn-small' data-action='add-custom-food'>＋ Custom food</button></div>"+
      "<input class='search-input' id='food-search' type='search' placeholder='Search roti, rice, paneer, eggs, milk...' autocomplete='off'><div class='food-library-grid' id='food-library-grid'>"+foods.map(foodCard).join("")+"</div></section>"+
      "<div class='grid nutrition-two-col'><section class='panel'><div class='panel-head'><div><h2>Today's food diary</h2><div class='panel-sub'>"+prettyDate(dateKey(),{weekday:"long",day:"numeric",month:"long"})+" · "+meals.length+" entries</div></div><span class='tag'>TODAY</span></div>"+renderMealItems(meals,true)+"</section>"+
      "<section class='panel'><div class='panel-head'><div><h2>Macro targets</h2><div class='panel-sub'>Today's progress</div></div><button class='inline-link' data-page='settings'>Edit targets →</button></div><div class='macro-list'>"+macroRow("Calories",totals.calories,targets.calories,"","kcal")+macroRow("Protein",totals.protein,targets.protein,"","g")+macroRow("Carbs",totals.carbs,targets.carbs,"carbs","g")+macroRow("Fat",totals.fat,targets.fat,"fat","g")+"</div></section></div>"+
      "<section class='panel'><div class='panel-head'><div><h2>Saved meals</h2><div class='panel-sub'>One-tap logging for meals you often repeat</div></div></div>"+(state.savedMeals.length?"<div class='saved-meal-list'>"+state.savedMeals.map(savedMealCard).join("")+"</div>":emptyState("✳","No saved meals yet","Tick 'Save as quick meal' when adding a meal to keep it here."))+"</section>"+
      renderPlanner()+
      "<section class='panel'><div class='panel-head'><div><h2>Recent food log dates</h2><div class='panel-sub'>Your latest days with a saved entry</div></div></div>"+(dates.length?"<div class='table-scroll'><table class='data-table'><thead><tr><th>DATE</th><th>ENTRIES</th><th>CALORIES</th><th>PROTEIN</th></tr></thead><tbody>"+dates.map(key=>{const d=state.meals.filter(x=>x.date===key),t=nutritionTotals(d);return "<tr><td>"+prettyDate(key,{weekday:"short",day:"numeric",month:"short",year:"numeric"})+"</td><td>"+d.length+"</td><td>"+Math.round(t.calories)+" kcal</td><td>"+round(t.protein)+" g</td></tr>";}).join("")+"</tbody></table></div>":emptyState("◉","Nothing logged yet","Your saved food days appear here."))+"</section>";
  }

  function weightChart(items) {
    const rows=items.slice().sort((a,b)=>a.date.localeCompare(b.date)).slice(-12);
    if(!rows.length)return "<div class='chart-empty'>Add weigh-ins to see your weight trend.</div>";
    let min=Math.min(...rows.map(x=>num(x.weight))),max=Math.max(...rows.map(x=>num(x.weight)));
    if(min===max){min-=1;max+=1;}
    const W=600,H=180,left=38,right=18,top=14,bottom=29,span=max-min;
    const points=rows.map((r,i)=>({x:rows.length===1?W/2:left+i*(W-left-right)/(rows.length-1),y:top+(max-num(r.weight))/span*(H-top-bottom),r}));
    const grid=[0,1,2].map(i=>{const y=top+i*(H-top-bottom)/2;return "<line class='chart-gridline' x1='"+left+"' y1='"+y+"' x2='"+(W-right)+"' y2='"+y+"'/><text class='chart-label' x='0' y='"+(y+3)+"'>"+round(max-i*span/2)+"</text>";}).join("");
    return "<svg viewBox='0 0 "+W+" "+H+"' role='img' aria-label='Weight progress chart'><defs><linearGradient id='chart-gradient' x1='0' x2='0' y1='0' y2='1'><stop offset='0%' stop-color='#c6f36b'/><stop offset='100%' stop-color='#c6f36b' stop-opacity='0'/></linearGradient></defs>"+grid+
      "<path class='chart-area' d='M "+points[0].x+" "+(H-bottom)+" L "+points.map(p=>p.x+" "+p.y).join(" L ")+" L "+points[points.length-1].x+" "+(H-bottom)+" Z'/>"+
      "<polyline class='chart-line' points='"+points.map(p=>p.x+","+p.y).join(" ")+"'/>"+points.map(p=>"<circle class='chart-point' cx='"+p.x+"' cy='"+p.y+"' r='4'><title>"+prettyDate(p.r.date)+" · "+round(p.r.weight)+" "+safe(state.profile.unit)+"</title></circle>").join("")+"</svg>";
  }
  function measurementSummary() {
    const latest=state.measurements.slice().sort((a,b)=>b.date.localeCompare(a.date))[0];
    const fields=[["waist","Waist"],["chest","Chest"],["arms","Arms"],["thigh","Thigh"]];
    if(!latest)return "<div class='measurement-empty'>No body measurements yet. Add a check-in to track changes beyond scale weight.</div>";
    return "<div class='measurement-grid'>"+fields.map(([key,label])=>"<div><span>"+label+"</span><strong>"+(latest[key]?round(latest[key])+" cm":"—")+"</strong></div>").join("")+"</div><p class='small-note'>Latest check-in · "+prettyDate(latest.date)+"</p>";
  }
  function renderWeeklyInsights() {
    const w=weeklyStats(),target=state.targets;
    const proteinPct=target.protein?Math.round(w.avgProtein/target.protein*100):0;
    const calPct=target.calories?Math.round(w.avgCalories/target.calories*100):0;
    return "<section class='panel'><div class='panel-head'><div><h2>Weekly insights</h2><div class='panel-sub'>Based on logged data from the last seven days.</div></div><span class='tag'>7 DAYS</span></div><div class='weekly-insight-grid'>"+
      "<div><strong>"+w.workouts.length+"</strong><span>training sessions</span><small>Logged workouts</small></div><div><strong>"+Math.round(w.avgProtein)+" g</strong><span>average protein</span><small>"+(w.loggedDays?proteinPct+"% of target on logged days":"No meals logged yet")+"</small></div><div><strong>"+Math.round(w.avgCalories)+"</strong><span>average calories</span><small>"+(w.loggedDays?calPct+"% of target on logged days":"No meals logged yet")+"</small></div><div><strong>"+(w.avgWater/1000).toFixed(1)+" L</strong><span>average water</span><small>Daily average across the week</small></div></div>"+
      "<p class='small-note'>Averages use days with a food entry for nutrition, and all seven days for water. Missing logs are not counted as zero food intake.</p></section>";
  }

  function progressPhotoForm() {
    return "<form id='progress-photo-form'><div class='form-grid'><div class='form-field full'><label>Photo</label><input name='photo' type='file' accept='image/*' required><span class='form-hint'>Choose a clear progress photo. FitCheck compresses it and stores it privately in this browser.</span></div><div class='form-field'><label>Date</label><input name='date' type='date' value='"+dateKey()+"' required></div><div class='form-field'><label>Label</label><input name='label' maxlength='40' placeholder='e.g. Monthly check-in'></div></div><div class='modal-actions'><button type='button' class='btn btn-ghost' data-action='close-modal'>Cancel</button><button class='btn btn-primary' type='submit'>Save photo locally</button></div></form>";
  }
  function compressPhoto(dataUrl) {
    return new Promise((resolve,reject)=>{
      const image=new Image();
      image.onload=()=>{
        const max=1000,scale=Math.min(1,max/Math.max(image.width,image.height));
        const canvas=document.createElement("canvas");
        canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));
        const ctx=canvas.getContext("2d");ctx.drawImage(image,0,0,canvas.width,canvas.height);
        resolve(canvas.toDataURL("image/jpeg",0.68));
      };
      image.onerror=()=>reject(new Error("Image could not be read"));image.src=dataUrl;
    });
  }
  function saveProgressPhoto(form) {
    const values=formValues(form),file=form.querySelector("input[name=photo]").files[0];
    if(!file){toast("Choose a photo first.");return;}
    if(!file.type.startsWith("image/")){toast("Choose an image file.");return;}
    const reader=new FileReader();
    reader.onload=async()=>{
      try{
        const data=await compressPhoto(reader.result),photo={id:makeId(),date:values.date,label:values.label.trim()||"Progress check-in",data};
        const used=state.progressPhotos.reduce((sum,x)=>sum+(x.data||"").length,0);
        if(used+data.length>3500000){toast("Photo storage is nearly full. Export a backup and remove older photos.");return;}
        state.progressPhotos.push(photo);saveState();closeModal();render();toast("Progress photo saved privately.");
      }catch(error){toast("Could not process that photo. Try another image.");}
    };
    reader.onerror=()=>toast("Could not read that photo.");reader.readAsDataURL(file);
  }
  function renderProgressPhotos() {
    if(!state.progressPhotos.length)return emptyState("▧","No progress photos yet","Save a private monthly check-in photo to compare changes over time.","＋ Add progress photo","add-progress-photo");
    return "<div class='progress-photo-grid'>"+state.progressPhotos.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(photo=>
      "<article class='progress-photo-card'><img src='"+safe(photo.data)+"' alt='Private progress check-in from "+safe(prettyDate(photo.date))+"' loading='lazy'><div><strong>"+safe(photo.label)+"</strong><span>"+prettyDate(photo.date,{day:"numeric",month:"short",year:"numeric"})+"</span><button class='inline-link' data-action='delete-progress-photo' data-id='"+safe(photo.id)+"'>Remove</button></div></article>"
    ).join("")+"</div>";
  }

  function renderProgress() {
    const weights=state.weighIns.slice().sort((a,b)=>a.date.localeCompare(b.date)),latest=weights[weights.length-1],previous=weights.length>1?weights[weights.length-2]:null;
    const delta=latest&&previous?round(latest.weight-previous.weight):null;
    const recent=weights.slice().reverse().slice(0,8);
    return "<div class='page-heading'><div><span class='eyebrow'>NOTICE THE LITTLE WINS</span><h1>Your progress</h1><p>Look at strength, measurements and habits together. One number never tells the whole story.</p></div><div class='heading-actions'><button class='btn btn-ghost' data-action='add-progress-photo'>＋ Progress photo</button><button class='btn btn-secondary' data-action='add-measurements'>＋ Body measurements</button><button class='btn btn-primary' data-action='add-weight'>＋ Weigh-in</button></div></div>"+
      "<div class='progress-summary'><div class='progress-tile'><span>Latest weight</span><strong>"+(latest?round(latest.weight)+" "+safe(state.profile.unit):"—")+"</strong><small>"+(latest?prettyDate(latest.date):"No weigh-ins yet")+"</small></div><div class='progress-tile'><span>Change from previous</span><strong>"+(delta===null?"—":(delta>0?"+":"")+delta+" "+safe(state.profile.unit))+"</strong><small>"+(delta===null?"Add another check-in to compare":"Latest vs previous")+"</small></div><div class='progress-tile'><span>Sessions logged</span><strong>"+state.workouts.length+"</strong><small>All-time training history</small></div></div>"+
      "<section class='panel' style='margin-top:16px'><div class='panel-head'><div><h2>Weight trend</h2><div class='panel-sub'>Most recent 12 weigh-ins · "+safe(state.profile.unit)+"</div></div><span class='tag'>PROGRESS</span></div><div class='chart-wrap'>"+weightChart(weights)+"</div></section>"+
      "<div class='grid progress-two-col'><section class='panel'><div class='panel-head'><div><h2>Body measurements</h2><div class='panel-sub'>Track waist, chest, arms and thigh in centimetres.</div></div><button class='inline-link' data-action='add-measurements'>＋ Add</button></div>"+measurementSummary()+"</section>"+renderWeeklyInsights()+"</div>"+
      "<section class='panel'><div class='panel-head'><div><h2>Weigh-in history</h2><div class='panel-sub'>Consistent conditions make comparisons more useful.</div></div></div>"+(recent.length?"<div class='table-scroll'><table class='data-table'><thead><tr><th>DATE</th><th>WEIGHT</th><th>NOTE</th><th></th></tr></thead><tbody>"+recent.map(x=>"<tr><td>"+prettyDate(x.date,{weekday:"short",day:"numeric",month:"short",year:"numeric"})+"</td><td><strong>"+round(x.weight)+" "+safe(state.profile.unit)+"</strong></td><td>"+safe(x.note||"—")+"</td><td><button class='inline-link' data-action='delete-weight' data-id='"+safe(x.id)+"'>Remove</button></td></tr>").join("")+"</tbody></table></div>":emptyState("⌁","Your progress starts here","Add a weigh-in to create your first trend line.","Add weigh-in","add-weight"))+"</section>"+
      (state.measurements.length?"<section class='panel'><div class='panel-head'><div><h2>Measurement history</h2><div class='panel-sub'>Saved body check-ins</div></div></div><div class='table-scroll'><table class='data-table'><thead><tr><th>DATE</th><th>WAIST</th><th>CHEST</th><th>ARMS</th><th>THIGH</th><th></th></tr></thead><tbody>"+state.measurements.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8).map(x=>"<tr><td>"+prettyDate(x.date)+"</td><td>"+(x.waist||"—")+"</td><td>"+(x.chest||"—")+"</td><td>"+(x.arms||"—")+"</td><td>"+(x.thigh||"—")+"</td><td><button class='inline-link' data-action='delete-measurement' data-id='"+safe(x.id)+"'>Remove</button></td></tr>").join("")+"</tbody></table></div></section>":"")+
      "<section class='panel'><div class='panel-head'><div><h2>Progress photos</h2><div class='panel-sub'>Private check-ins stored in this browser only.</div></div><button class='inline-link' data-action='add-progress-photo'>＋ Add photo</button></div>"+renderProgressPhotos()+"</section>"+
      "<p class='small-note'>Body weight naturally fluctuates. Look at longer-term patterns rather than reacting to a single measurement.</p>";
  }

  function renderReminders() {
    const permission=("Notification" in window)?Notification.permission:"unsupported";
    const button=permission==="default"?"<button class='btn btn-primary btn-small' data-action='enable-notifications'>Enable notifications</button>":permission==="granted"?"<span class='tag'>NOTIFICATIONS ON</span>":"<span class='tag orange'>NOTIFICATIONS OFF</span>";
    const rows=state.reminders.slice().sort((a,b)=>a.time.localeCompare(b.time));
    return "<div class='page-heading'><div><span class='eyebrow'>A LITTLE NUDGE, RIGHT ON TIME</span><h1>Reminders</h1><p>Build routines for training, meals, water and recovery.</p></div><div class='heading-actions'><button class='btn btn-primary' data-action='add-reminder'>＋ Add reminder</button></div></div>"+
      "<div class='grid stats-grid'>"+statCard("Saved reminders",rows.length,"total","Your personal routine","◷")+statCard("Active reminders",rows.filter(x=>x.enabled).length,"active","Paused reminders stay saved","✓")+statCard("Notification access",permission==="granted"?"On":"Off","","Browser permission","◉")+statCard("Reminder storage","Local","only","Included in backups","⌑")+"</div>"+
      "<section class='panel'><div class='panel-head'><div><h2>Your reminder schedule</h2><div class='panel-sub'>Reminders are checked while FitCheck is open.</div></div>"+button+"</div><div class='notice reminder-notice'><strong>Heads up:</strong> browser notifications require permission. This local version cannot send alerts while the browser is completely closed.</div>"+
      (rows.length?"<div class='reminder-list'>"+rows.map(r=>"<article class='reminder-item "+(r.enabled?"":"is-disabled")+"'><div class='list-icon'>"+({Water:"♧",Meal:"◉",Workout:"↗",Supplements:"✳",Other:"◷"}[r.category]||"◷")+"</div><div class='reminder-copy'><strong>"+safe(r.title)+"</strong><span>"+safe(r.category)+" · "+(r.frequency==="weekdays"?"Weekdays":r.frequency==="once"?"Once · "+prettyDate(r.date):"Every day")+"</span></div><div class='reminder-time'>"+safe(r.time)+"<small>"+(r.enabled?"Active":"Paused")+"</small></div><button class='btn btn-ghost btn-small' data-action='toggle-reminder' data-id='"+safe(r.id)+"'>"+(r.enabled?"Pause":"Resume")+"</button><button class='icon-button' data-action='delete-reminder' data-id='"+safe(r.id)+"'>×</button></article>").join("")+"</div>":emptyState("◷","No reminders yet","Add reminders for the habits you want to keep.","＋ Add reminder","add-reminder"))+"</section>";
  }

  function renderSettings() {
    const p=state.profile,t=state.targets;
    return "<div class='page-heading'><div><span class='eyebrow'>MAKE IT YOURS</span><h1>Settings</h1><p>Profile, daily targets, appearance and data backups.</p></div></div>"+
      "<div class='settings-grid'><section class='panel'><div class='panel-head'><div><h2>Personal profile</h2><div class='panel-sub'>Saved only in this browser</div></div></div><form id='profile-form'><div class='form-grid'>"+
      "<div class='form-field full'><label for='profile-name'>Name or nickname</label><input id='profile-name' name='name' maxlength='40' value='"+safe(p.name)+"' placeholder='What should FitCheck call you?'></div>"+
      "<div class='form-field'><label for='profile-height'>Height (cm)</label><input id='profile-height' name='height' type='number' min='1' max='250' step='0.1' value='"+safe(p.height)+"'></div><div class='form-field'><label for='profile-weight'>Current weight ("+safe(p.unit)+")</label><input id='profile-weight' name='currentWeight' type='number' min='1' max='500' step='0.1' value='"+safe(p.currentWeight)+"'></div>"+
      "<div class='form-field'><label for='profile-unit'>Weight unit</label><select id='profile-unit' name='unit'><option value='kg' "+(p.unit==="kg"?"selected":"")+">Kilograms (kg)</option><option value='lb' "+(p.unit==="lb"?"selected":"")+">Pounds (lb)</option></select></div><div class='form-field'><label for='profile-goal'>Main focus</label><select id='profile-goal' name='goal'>"+["Body recomposition","Build muscle","Improve strength","General fitness","Improve endurance","Maintain routine"].map(g=>"<option "+(p.goal===g?"selected":"")+">"+g+"</option>").join("")+"</select></div></div><div class='modal-actions'><button class='btn btn-primary' type='submit'>Save profile</button></div></form>"+
      "<div class='divider'></div><div class='panel-head'><div><h2>Daily targets</h2><div class='panel-sub'>Editable starter values. They are not personal medical advice.</div></div></div><form id='targets-form'><div class='form-grid'>"+[["calories","Calories (kcal)"],["protein","Protein (g)"],["carbs","Carbohydrates (g)"],["fat","Fat (g)"],["water","Water (ml)"]].map(([k,l])=>"<div class='form-field'><label for='target-"+k+"'>"+l+"</label><input id='target-"+k+"' name='"+k+"' type='number' min='0' step='1' value='"+safe(t[k])+"'></div>").join("")+"</div><div class='modal-actions'><button class='btn btn-primary' type='submit'>Save targets</button></div></form></section>"+
      "<div><section class='panel'><div class='panel-head'><div><h2>Appearance</h2><div class='panel-sub'>Choose the interface that feels right.</div></div></div><div class='theme-choice-row'><button class='theme-choice "+(state.theme==="dark"?"selected":"")+"' data-action='set-theme' data-theme='dark'><span class='theme-swatch dark-swatch'></span><strong>Dark</strong><small>Deep charcoal + lime</small></button><button class='theme-choice "+(state.theme==="light"?"selected":"")+"' data-action='set-theme' data-theme='light'><span class='theme-swatch light-swatch'></span><strong>Light</strong><small>Clean neutral surfaces</small></button></div></section>"+
      "<section class='panel'><div class='panel-head'><div><h2>Your data</h2><div class='panel-sub'>Back up or move your records.</div></div></div><div class='notice'><strong>Local-first privacy.</strong><br>Your meals, workouts and measurements stay in browser storage. They are not uploaded to GitHub.</div><div class='setting-actions'><button class='btn btn-secondary' data-action='export-data'>↓ Export backup</button><button class='btn btn-ghost' data-action='import-data'>↑ Import backup</button><input type='file' id='import-file' accept='application/json,.json' hidden></div><div class='divider'></div><div class='setting-row'><div><strong>Saved records</strong><span>Meals, workouts, routines, reminders and more</span></div><strong>"+(state.meals.length+state.workouts.length+state.weighIns.length+state.routines.length+state.reminders.length)+"</strong></div><div class='setting-row'><div><strong>Clear all local data</strong><span>This cannot be undone without a backup.</span></div><button class='btn btn-danger btn-small' data-action='clear-data'>Clear</button></div></section>"+
      "<section class='panel'><div class='panel-head'><div><h2>About FitCheck</h2></div></div><p class='small-note'>FitCheck is a personal tracking tool, not medical advice. Food library values are estimates. Use food labels for accuracy and consult a qualified professional for individualized targets.</p><p class='small-note'>Data does not automatically sync between devices. Export a backup before switching browsers or clearing site data.</p></section></div></div>";
  }

  function render() {
    const labels={dashboard:"Overview",workouts:"Workouts",nutrition:"Nutrition",progress:"Progress",reminders:"Reminders",settings:"Settings"};
    if(!labels[currentPage])currentPage="dashboard";
    document.body.classList.toggle("theme-light",state.theme==="light");
    $("#crumb-current").textContent=labels[currentPage];
    $$(".nav-link[data-page],.mobile-nav button[data-page]").forEach(b=>b.classList.toggle("active",b.dataset.page===currentPage));
    const name=state.profile.name||"Your profile";
    $("#profile-name-mini").textContent=name;
    $("#avatar-initial").textContent=(name.trim()[0]||"F").toUpperCase();
    $("#top-avatar").textContent=(name.trim()[0]||"F").toUpperCase();
    $("#today-label").textContent=new Date().toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short"});
    const themeButton=$("#theme-toggle");
    if(themeButton){themeButton.textContent=state.theme==="dark"?"☼":"☾";themeButton.title=state.theme==="dark"?"Switch to light theme":"Switch to dark theme";}
    const views={dashboard:renderDashboard,workouts:renderWorkouts,nutrition:renderNutrition,progress:renderProgress,reminders:renderReminders,settings:renderSettings};
    $("#view-root").innerHTML=views[currentPage]();
  }

  function mealForm(food=null) {
    const now=new Date(),time=String(now.getHours()).padStart(2,"0")+":"+String(now.getMinutes()).padStart(2,"0");
    const name=food?food.name:"",cal=food?food.calories:"",protein=food?food.protein:0,carbs=food?food.carbs:0,fat=food?food.fat:0;
    return "<form id='meal-form' data-food-id='"+safe(food?food.id:"")+"'><div class='form-grid'><div class='form-field full'><label for='meal-name'>Food or meal name</label><input id='meal-name' name='name' required maxlength='70' value='"+safe(name)+"' placeholder='e.g. Paneer rice bowl'></div>"+
      "<div class='form-field'><label for='meal-category'>Meal type</label><select id='meal-category' name='category'><option>Breakfast</option><option>Lunch</option><option>Snack</option><option>Dinner</option></select></div><div class='form-field'><label for='meal-date'>Date</label><input id='meal-date' name='date' type='date' value='"+dateKey()+"' required></div>"+
      "<div class='form-field'><label for='meal-time'>Time</label><input id='meal-time' type='time' name='time' value='"+time+"'></div><div class='form-field'><label for='meal-quantity'>Servings / quantity</label><input id='meal-quantity' name='quantity' type='number' min='0.1' max='30' step='0.1' value='1'></div>"+
      "<div class='form-field'><label for='meal-calories'>Calories (kcal)</label><input id='meal-calories' name='calories' type='number' min='0' step='1' value='"+safe(cal)+"' placeholder='Optional'></div><div class='form-field'><label for='meal-protein'>Protein (g)</label><input name='protein' type='number' min='0' step='0.1' value='"+safe(protein)+"'></div>"+
      "<div class='form-field'><label for='meal-carbs'>Carbs (g)</label><input name='carbs' type='number' min='0' step='0.1' value='"+safe(carbs)+"'></div><div class='form-field'><label for='meal-fat'>Fat (g)</label><input name='fat' type='number' min='0' step='0.1' value='"+safe(fat)+"'></div>"+
      "<div class='form-field full checkbox-field'><label><input type='checkbox' name='savePreset' value='yes'> Save this meal as a quick preset</label></div><div class='form-field full'><span class='form-hint'>Values are per serving. Quantity multiplies the macros. Estimates vary by recipe and portion size.</span></div></div>"+
      "<div class='modal-actions'><button type='button' class='btn btn-ghost' data-action='close-modal'>Cancel</button><button class='btn btn-primary' type='submit'>Save food entry</button></div></form>";
  }
  function addMeal(form) {
    const v=formValues(form),q=Math.max(0.1,num(v.quantity)||1),p=num(v.protein)*q,c=num(v.carbs)*q,f=num(v.fat)*q;
    const calories=v.calories===""?(p*4+c*4+f*9):num(v.calories)*q;
    const item={id:makeId(),date:v.date||dateKey(),time:v.time,name:v.name.trim(),category:v.category,calories:round(calories),protein:round(p),carbs:round(c),fat:round(f)};
    state.meals.push(item);
    if(v.savePreset==="yes"&&!state.savedMeals.some(x=>x.name.toLowerCase()===item.name.toLowerCase())){
      state.savedMeals.push({id:makeId(),name:item.name,category:item.category,calories:item.calories,protein:item.protein,carbs:item.carbs,fat:item.fat});
    }
    saveState();closeModal();render();toast("Food entry saved.");
  }
  function customFoodForm() {
    return "<form id='custom-food-form'><div class='form-grid'><div class='form-field full'><label>Food name</label><input name='name' required maxlength='60' placeholder='e.g. Homemade poha'></div>"+
      "<div class='form-field'><label>Serving description</label><input name='serving' value='1 serving' maxlength='30'></div>"+["calories","protein","carbs","fat"].map(k=>"<div class='form-field'><label>"+({calories:"Calories (kcal)",protein:"Protein (g)",carbs:"Carbs (g)",fat:"Fat (g)"}[k])+"</label><input name='"+k+"' type='number' min='0' step='0.1' required></div>").join("")+"</div><div class='modal-actions'><button type='button' class='btn btn-ghost' data-action='close-modal'>Cancel</button><button class='btn btn-primary' type='submit'>Save food</button></div></form>";
  }
  function planMealForm() {
    return "<form id='plan-meal-form'><div class='form-grid'><div class='form-field full'><label>Meal name</label><input name='name' required maxlength='60' placeholder='e.g. Dal, rice and curd'></div><div class='form-field'><label>Date</label><input name='date' type='date' min='"+dateKey()+"' value='"+dateKey()+"' required></div><div class='form-field'><label>Time</label><input name='time' type='time' value='19:00'></div><div class='form-field full'><label>Meal type</label><select name='category'><option>Breakfast</option><option>Lunch</option><option>Snack</option><option>Dinner</option></select></div></div><div class='modal-actions'><button type='button' class='btn btn-ghost' data-action='close-modal'>Cancel</button><button class='btn btn-primary' type='submit'>Add to plan</button></div></form>";
  }
  function addCustomFood(form) {
    const v=formValues(form),food={id:makeId(),name:v.name.trim(),serving:v.serving||"1 serving",calories:num(v.calories),protein:num(v.protein),carbs:num(v.carbs),fat:num(v.fat)};
    state.customFoods.push(food);saveState();closeModal();render();toast("Custom food added to your library.");
  }

  function workoutForm(workout=null) {
    const exercises=workout?(workout.exercises||[]):[];
    const rows=exercises.length?exercises.map(exerciseRow).join(""):exerciseRow();
    const focuses=["Chest","Back","Shoulders","Biceps","Triceps","Legs","Core","Full body","Cardio","Other"];
    return "<form id='workout-form' data-editing='"+safe(workout?workout.id:"")+"'><div class='form-grid'><div class='form-field'><label for='workout-name'>Session name</label><input id='workout-name' name='name' required maxlength='60' placeholder='e.g. Chest day' value='"+safe(workout?workout.name:"")+"'></div>"+
      "<div class='form-field'><label for='workout-muscle'>Focus</label><select id='workout-muscle' name='muscle'>"+focuses.map(n=>"<option "+(workout&&workout.muscle===n?"selected":"")+">"+n+"</option>").join("")+"</select></div>"+
      "<div class='form-field'><label for='workout-duration'>Duration (minutes)</label><input id='workout-duration' name='duration' type='number' min='0' max='600' value='"+safe(workout?workout.duration:60)+"'></div>"+
      "<div class='form-field'><label for='workout-date'>Date</label><input id='workout-date' name='date' type='date' value='"+safe(workout?workout.date:dateKey())+"' required></div></div>"+
      "<div class='section-title'>Exercises and working sets</div><div class='exercise-builder' id='exercise-builder'>"+rows+"</div><button type='button' class='btn btn-secondary btn-small' style='margin-top:12px' data-action='add-exercise'>＋ Add exercise</button>"+
      "<div class='form-field' style='margin-top:14px'><label for='workout-notes'>Session notes</label><textarea id='workout-notes' name='notes' rows='2' maxlength='500' placeholder='How did the session feel?'>"+safe(workout?workout.notes:"")+"</textarea></div>"+
      "<div class='modal-actions'><button type='button' class='btn btn-ghost' data-action='close-modal'>Cancel</button><button class='btn btn-primary' type='submit'>"+(workout?"Update workout":"Save workout")+"</button></div></form>";
  }
  function addWorkout(form) {
    const v=formValues(form),editing=form.dataset.editing||"";
    const exercises=$$(".exercise-entry",$("#exercise-builder")).map(row=>{
      const details=$$(".set-entry",row).map(set=>({reps:num($("input[name=setReps]",set).value),weight:num($("input[name=setWeight]",set).value)}));
      return {name:$("input[name=exerciseName]",row).value.trim(),sets:details.length,reps:details.map(x=>x.reps).join(" / "),load:details.length?details[details.length-1].weight:0,setDetails:details};
    }).filter(x=>x.name&&x.sets);
    if(!exercises.length){toast("Add at least one exercise with a working set.");return;}
    const item={id:editing||makeId(),createdAt:editing?(state.workouts.find(x=>x.id===editing)?.createdAt||new Date().toISOString()):new Date().toISOString(),date:v.date||dateKey(),name:v.name.trim(),muscle:v.muscle,duration:num(v.duration),notes:v.notes.trim(),exercises};
    const idx=state.workouts.findIndex(x=>x.id===editing);
    if(idx>=0)state.workouts[idx]=item;else state.workouts.push(item);
    saveState();closeModal();render();toast(idx>=0?"Workout updated.":"Workout saved. Nice work.");
  }
  function addWeight(form) {
    const v=formValues(form);state.weighIns.push({id:makeId(),date:v.date,weight:num(v.weight),note:v.note.trim()});state.profile.currentWeight=v.weight;
    saveState();closeModal();render();toast("Weigh-in saved.");
  }
  function measurementsForm() {
    return "<form id='measurements-form'><div class='form-grid'><div class='form-field'><label>Date</label><input name='date' type='date' value='"+dateKey()+"' required></div>"+[["waist","Waist (cm)"],["chest","Chest (cm)"],["arms","Arms (cm)"],["thigh","Thigh (cm)"]].map(([k,l])=>"<div class='form-field'><label>"+l+"</label><input name='"+k+"' type='number' min='0' max='250' step='0.1' placeholder='Optional'></div>").join("")+"<div class='form-field full'><label>Note</label><input name='note' maxlength='100' placeholder='e.g. Morning check-in'></div></div><p class='small-note'>Enter measurements under consistent conditions. Leave any field blank if you did not measure it.</p><div class='modal-actions'><button type='button' class='btn btn-ghost' data-action='close-modal'>Cancel</button><button class='btn btn-primary' type='submit'>Save measurements</button></div></form>";
  }

  function reminderForm() {
    const now=new Date(),time=String(now.getHours()).padStart(2,"0")+":"+String(now.getMinutes()).padStart(2,"0");
    return "<form id='reminder-form'><div class='form-grid'><div class='form-field full'><label>Reminder name</label><input name='title' required maxlength='60' placeholder='e.g. Morning workout'></div><div class='form-field'><label>Category</label><select name='category'><option>Water</option><option>Meal</option><option>Workout</option><option>Supplements</option><option>Other</option></select></div><div class='form-field'><label>Time</label><input name='time' type='time' required value='"+time+"'></div><div class='form-field'><label>Repeat</label><select id='reminder-frequency' name='frequency'><option value='daily'>Every day</option><option value='weekdays'>Weekdays</option><option value='once'>Only once</option></select></div><div class='form-field' id='reminder-date-wrap' hidden><label>Date</label><input id='reminder-date' name='date' type='date' min='"+dateKey()+"' value='"+dateKey()+"'></div></div><div class='modal-actions'><button type='button' class='btn btn-ghost' data-action='close-modal'>Cancel</button><button class='btn btn-primary' type='submit'>Save reminder</button></div></form>";
  }
  function addReminder(form) {
    const v=formValues(form);
    if(v.frequency==="once"&&!v.date){toast("Choose a date.");return;}
    state.reminders.push({id:makeId(),title:v.title.trim(),category:v.category,time:v.time,frequency:v.frequency,date:v.frequency==="once"?v.date:"",enabled:true,lastFired:""});
    saveState();closeModal();render();toast("Reminder saved.");
  }
  async function enableNotifications() {
    if(!("Notification" in window)){toast("This browser does not support notifications.");return;}
    try{const result=await Notification.requestPermission();render();toast(result==="granted"?"Notifications enabled.":"Notification permission was not granted.");}catch(e){toast("Could not request notification permission.");}
  }
  function checkReminders() {
    if(!("Notification" in window)||Notification.permission!=="granted")return;
    const now=new Date(),today=dateKey(now),hm=String(now.getHours()).padStart(2,"0")+":"+String(now.getMinutes()).padStart(2,"0");
    let changed=false;
    state.reminders.forEach(r=>{
      if(!r.enabled||r.lastFired===today+" "+r.time)return;
      if(r.frequency==="once"&&r.date!==today)return;
      if(r.frequency==="weekdays"&&(now.getDay()===0||now.getDay()===6))return;
      if(r.time!==hm)return;
      r.lastFired=today+" "+r.time;if(r.frequency==="once")r.enabled=false;changed=true;
      const title="FitCheck · "+r.title,options={body:r.category+" reminder",icon:"./icon.svg",tag:"fitcheck-"+r.id};
      if("serviceWorker" in navigator)navigator.serviceWorker.ready.then(reg=>reg.showNotification(title,options)).catch(()=>new Notification(title,options));
      else new Notification(title,options);
    });
    if(changed){saveState();if(currentPage==="reminders")render();}
  }

  function weightForm() {
    return "<form id='weight-form'><div class='form-grid'><div class='form-field'><label>Weight ("+safe(state.profile.unit)+")</label><input name='weight' type='number' min='1' max='500' step='0.1' required placeholder='e.g. 66.0'></div><div class='form-field'><label>Date</label><input name='date' type='date' required value='"+dateKey()+"'></div><div class='form-field full'><label>Note</label><input name='note' maxlength='100' placeholder='e.g. Morning, before breakfast'></div></div><div class='modal-actions'><button type='button' class='btn btn-ghost' data-action='close-modal'>Cancel</button><button class='btn btn-primary' type='submit'>Save weigh-in</button></div></form>";
  }
  function saveProfile(form) {const v=formValues(form);state.profile={...state.profile,name:v.name.trim(),height:v.height,currentWeight:v.currentWeight,unit:v.unit,goal:v.goal};saveState();render();toast("Profile updated.");}
  function saveTargets(form) {const v=formValues(form);Object.keys(state.targets).forEach(k=>state.targets[k]=Math.max(0,num(v[k])));saveState();render();toast("Targets updated.");}
  function exportData() {
    const blob=new Blob([JSON.stringify({app:"FitCheck",version:2,exportedAt:new Date().toISOString(),data:state},null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download="fitcheck-backup-"+dateKey()+".json";document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);toast("Backup exported.");
  }
  function importData(file) {
    if(!file)return;
    const reader=new FileReader();
    reader.onload=()=>{
      try{
        const parsed=JSON.parse(reader.result),d=parsed.data||parsed;
        if(!d||!Array.isArray(d.meals)||!Array.isArray(d.workouts))throw new Error("Invalid backup");
        state={...clone(STARTER),...d,profile:{...STARTER.profile,...(d.profile||{})},targets:{...STARTER.targets,...(d.targets||{})},
          meals:Array.isArray(d.meals)?d.meals:[],workouts:Array.isArray(d.workouts)?d.workouts:[],weighIns:Array.isArray(d.weighIns)?d.weighIns:[],
          waterByDate:d.waterByDate||{},reminders:Array.isArray(d.reminders)?d.reminders:[],routines:Array.isArray(d.routines)?d.routines:[],
          savedMeals:Array.isArray(d.savedMeals)?d.savedMeals:[],customFoods:Array.isArray(d.customFoods)?d.customFoods:[],
          plannedMeals:Array.isArray(d.plannedMeals)?d.plannedMeals:[],measurements:Array.isArray(d.measurements)?d.measurements:[],progressPhotos:Array.isArray(d.progressPhotos)?d.progressPhotos:[],theme:d.theme==="light"?"light":"dark"};
        saveState();render();toast("Backup imported.");
      }catch(e){toast("That file is not a valid FitCheck backup.");}
    };
    reader.readAsText(file);
  }

  function openFood(id) {const food=foodItem(id);if(food)openModal("Add "+food.name,mealForm(food),"FOOD LIBRARY");}
  function useSavedMeal(id) {
    const p=state.savedMeals.find(x=>x.id===id);if(!p)return;
    state.meals.push({id:makeId(),date:dateKey(),time:"",name:p.name,category:p.category||"Snack",calories:p.calories,protein:p.protein,carbs:p.carbs,fat:p.fat});
    saveState();render();toast(p.name+" added to today's diary.");
  }
  function saveCustomFood(form) {const v=formValues(form);state.customFoods.push({id:makeId(),name:v.name.trim(),serving:v.serving||"1 serving",calories:num(v.calories),protein:num(v.protein),carbs:num(v.carbs),fat:num(v.fat)});saveState();closeModal();render();toast("Custom food saved.");}
  function savePlannedMeal(form) {const v=formValues(form);state.plannedMeals.push({id:makeId(),name:v.name.trim(),date:v.date,time:v.time,category:v.category});saveState();closeModal();render();toast("Meal added to your planner.");}
  function saveMeasurements(form) {
    const v=formValues(form),item={id:makeId(),date:v.date,note:v.note.trim(),waist:num(v.waist)||null,chest:num(v.chest)||null,arms:num(v.arms)||null,thigh:num(v.thigh)||null};
    if(!item.waist&&!item.chest&&!item.arms&&!item.thigh){toast("Enter at least one measurement.");return;}
    state.measurements.push(item);saveState();closeModal();render();toast("Body measurements saved.");
  }

  document.addEventListener("click",event=>{
    const page=event.target.closest("[data-page]");
    if(page){event.preventDefault();currentPage=page.dataset.page;render();$("#sidebar").classList.remove("open");return;}
    const button=event.target.closest("[data-action]");
    if(!button)return;
    const action=button.dataset.action,id=button.dataset.id;
    if(action==="add-meal")openModal("Log a meal",mealForm());
    if(action==="add-food")openFood(id);
    if(action==="add-custom-food")openModal("Add custom food",customFoodForm(),"YOUR FOOD LIBRARY");
    if(action==="add-custom-exercise"){$("#routine-custom-list").insertAdjacentHTML("beforeend",customRoutineRow());}
    if(action==="add-workout")openModal("Log a workout",workoutForm());
    if(action==="add-weight")openModal("Add weigh-in",weightForm(),"PROGRESS CHECK-IN");
    if(action==="add-measurements")openModal("Body measurements",measurementsForm(),"PROGRESS CHECK-IN");
    if(action==="add-progress-photo")openModal("Add progress photo",progressPhotoForm(),"PRIVATE PROGRESS CHECK-IN");
    if(action==="add-reminder")openModal("Create a reminder",reminderForm(),"BUILD YOUR ROUTINE");
    if(action==="enable-notifications")enableNotifications();
    if(action==="plan-meal")openModal("Plan a meal",planMealForm(),"MEAL PLANNER");
    if(action==="close-modal")closeModal();
    if(action==="add-exercise")$("#exercise-builder").insertAdjacentHTML("beforeend",exerciseRow());
    if(action==="remove-exercise"){const rows=$$(".exercise-entry",$("#exercise-builder"));if(rows.length>1)button.closest(".exercise-entry").remove();else toast("Keep at least one exercise.");}
    if(action==="add-set"){const row=button.closest(".exercise-entry"),list=$(".set-entry-list",row),index=$$(".set-entry",list).length;list.insertAdjacentHTML("beforeend",setRow(index,{reps:12,weight:0}));}
    if(action==="remove-set"){const list=button.closest(".set-entry-list");if($$(".set-entry",list).length>1)button.closest(".set-entry").remove();else toast("Each exercise needs at least one set.");}
    if(action==="add-custom-routine-exercise")$("#routine-custom-list").insertAdjacentHTML("beforeend",customRoutineRow());
    if(action==="remove-custom-routine-exercise")button.closest(".routine-custom-row").remove();
    if(action==="edit-routine"){editingRoutineId=id;render();$("#routine-form").scrollIntoView({behavior:"smooth",block:"start"});}
    if(action==="cancel-routine-edit"){editingRoutineId=null;render();}
    if(action==="delete-routine"){if(confirm("Delete this saved routine? Completed workout history stays untouched.")){state.routines=state.routines.filter(x=>x.id!==id);if(editingRoutineId===id)editingRoutineId=null;saveState();render();toast("Routine deleted.");}}
    if(action==="start-routine"){const r=state.routines.find(x=>x.id===id);if(r)openModal("Start "+r.name,workoutForm({name:r.name,muscle:r.muscle,date:dateKey(),duration:60,notes:r.notes,exercises:r.exercises}));}
    if(action==="edit-workout"){const w=state.workouts.find(x=>x.id===id);if(w)openModal("Edit workout",workoutForm(w),"UPDATE YOUR SESSION");}
    if(action==="delete-workout"){state.workouts=state.workouts.filter(x=>x.id!==id);saveState();render();toast("Workout removed.");}
    if(action==="delete-meal"){state.meals=state.meals.filter(x=>x.id!==id);saveState();render();toast("Meal removed.");}
    if(action==="delete-weight"){state.weighIns=state.weighIns.filter(x=>x.id!==id);saveState();render();toast("Weigh-in removed.");}
    if(action==="delete-measurement"){state.measurements=state.measurements.filter(x=>x.id!==id);saveState();render();toast("Measurement removed.");}
    if(action==="delete-progress-photo"){state.progressPhotos=state.progressPhotos.filter(x=>x.id!==id);saveState();render();toast("Progress photo removed.");}
    if(action==="use-saved-meal")useSavedMeal(id);
    if(action==="delete-saved-meal"){state.savedMeals=state.savedMeals.filter(x=>x.id!==id);saveState();render();toast("Saved meal removed.");}
    if(action==="delete-planned-meal"){state.plannedMeals=state.plannedMeals.filter(x=>x.id!==id);saveState();render();}
    if(action==="toggle-reminder"){const r=state.reminders.find(x=>x.id===id);if(r){r.enabled=!r.enabled;saveState();render();toast(r.enabled?"Reminder resumed.":"Reminder paused.");}}
    if(action==="delete-reminder"){state.reminders=state.reminders.filter(x=>x.id!==id);saveState();render();toast("Reminder deleted.");}
    if(action==="add-water"){const key=dateKey();state.waterByDate[key]=num(state.waterByDate[key])+num(button.dataset.ml);saveState();render();toast(button.dataset.ml+" ml water added.");}
    if(action==="calendar-prev"){calendarOffset--;render();}
    if(action==="calendar-next"){calendarOffset++;render();}
    if(action==="rest-preset"){restPreset=num(button.dataset.seconds);restRemaining=restPreset;stopRestTimer();updateRestTimer();}
    if(action==="rest-start")startRestTimer();
    if(action==="rest-reset"){stopRestTimer();restRemaining=restPreset;updateRestTimer();}
    if(action==="set-theme"){state.theme=button.dataset.theme==="light"?"light":"dark";saveState();render();toast(state.theme==="light"?"Light theme enabled.":"Dark theme enabled.");}
    if(action==="toggle-theme"){state.theme=state.theme==="dark"?"light":"dark";saveState();render();}
    if(action==="export-data")exportData();
    if(action==="import-data")$("#import-file").click();
    if(action==="clear-data"&&confirm("Clear all FitCheck records from this browser? Export a backup first if you may need these records.")){state=clone(STARTER);saveState();render();toast("Local FitCheck data cleared.");}
  });

  document.addEventListener("input",event=>{
    if(event.target.id==="food-search"){
      const q=event.target.value.trim().toLowerCase();
      $$("[data-food-card]").forEach(card=>{card.hidden=!card.dataset.search.includes(q);});
    }
  });

  document.addEventListener("submit",event=>{
    const id=event.target.id;
    if(id==="meal-form"){event.preventDefault();addMeal(event.target);}
    if(id==="workout-form"){event.preventDefault();addWorkout(event.target);}
    if(id==="routine-form"){event.preventDefault();saveRoutine(event.target);}
    if(id==="weight-form"){event.preventDefault();addWeight(event.target);}
    if(id==="measurements-form"){event.preventDefault();saveMeasurements(event.target);}
    if(id==="progress-photo-form"){event.preventDefault();saveProgressPhoto(event.target);}
    if(id==="reminder-form"){event.preventDefault();addReminder(event.target);}
    if(id==="custom-food-form"){event.preventDefault();saveCustomFood(event.target);}
    if(id==="plan-meal-form"){event.preventDefault();savePlannedMeal(event.target);}
    if(id==="profile-form"){event.preventDefault();saveProfile(event.target);}
    if(id==="targets-form"){event.preventDefault();saveTargets(event.target);}
  });

  document.addEventListener("change",event=>{
    if(event.target.id==="routine-muscle"){
      const form=$("#routine-form"),old=event.target.dataset.previous||"Chest",name=$("#routine-name").value.trim();
      if(!name||name===old+" day")$("#routine-name").value=event.target.value+" day";
      event.target.dataset.previous=event.target.value;
      $("#routine-exercise-grid").innerHTML=EXERCISE_LIBRARY[event.target.value].map(x=>routineExerciseCard(x,null,true)).join("");
    }
    if(event.target.classList.contains("routine-check")){
      const card=event.target.closest(".routine-exercise-card");
      $$("input:not(.routine-check)",card).forEach(x=>{x.disabled=!event.target.checked;});
    }
    if(event.target.id==="reminder-frequency"){
      const once=event.target.value==="once";$("#reminder-date-wrap").hidden=!once;$("#reminder-date").required=once;
    }
    if(event.target.id==="import-file"){importData(event.target.files&&event.target.files[0]);event.target.value="";}
  });

  $("#modal-close").addEventListener("click",closeModal);
  $("#modal-backdrop").addEventListener("click",event=>{if(event.target.id==="modal-backdrop")closeModal();});
  $("#menu-toggle").addEventListener("click",()=>$("#sidebar").classList.toggle("open"));
  $("#theme-toggle").addEventListener("click",()=>{state.theme=state.theme==="dark"?"light":"dark";saveState();render();});
  document.addEventListener("keydown",event=>{if(event.key==="Escape"&&!$("#modal-backdrop").hidden)closeModal();});

  if("serviceWorker" in navigator && location.protocol.startsWith("http"))window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
  render();checkReminders();window.setInterval(checkReminders,15000);
})();