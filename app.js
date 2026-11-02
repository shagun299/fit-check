(() => {
  "use strict";

  const STORAGE_KEY = "fitcheck-data-v1";
  const STARTER = {
    profile: { name: "", height: "", currentWeight: "", goal: "Body recomposition", unit: "kg" },
    targets: { calories: 2000, protein: 120, carbs: 220, fat: 65, water: 2500 },
    meals: [],
    workouts: [],
    weighIns: [],
    waterByDate: {}
  };

  let state = loadState();
  let currentPage = "dashboard";

  function loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return structuredClone(STARTER);
      const parsed = JSON.parse(saved);
      return {
        ...structuredClone(STARTER),
        ...parsed,
        profile: { ...STARTER.profile, ...(parsed.profile || {}) },
        targets: { ...STARTER.targets, ...(parsed.targets || {}) },
        meals: Array.isArray(parsed.meals) ? parsed.meals : [],
        workouts: Array.isArray(parsed.workouts) ? parsed.workouts : [],
        weighIns: Array.isArray(parsed.weighIns) ? parsed.weighIns : [],
        waterByDate: parsed.waterByDate || {}
      };
    } catch (error) {
      console.warn("FitCheck could not read saved data.", error);
      return structuredClone(STARTER);
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (error) {
      toast("Could not save. Your browser storage may be full.");
      return false;
    }
  }

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const number = value => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const round = value => Math.round(number(value) * 10) / 10;
  const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value));
  const safe = value => String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));
  const makeId = () => (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);

  function dateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
  }

  function dateFromKey(key) {
    const parts = String(key || "").split("-").map(Number);
    return new Date(parts[0] || 2000, (parts[1] || 1) - 1, parts[2] || 1);
  }

  function prettyDate(key, options = { day: "numeric", month: "short" }) {
    if (!key) return "Today";
    return dateFromKey(key).toLocaleDateString("en-IN", options);
  }

  function todayMeals() {
    return state.meals.filter(item => item.date === dateKey());
  }

  function todayWorkouts() {
    return state.workouts.filter(item => item.date === dateKey());
  }

  function nutritionTotals(items) {
    return items.reduce((totals, item) => {
      totals.calories += number(item.calories);
      totals.protein += number(item.protein);
      totals.carbs += number(item.carbs);
      totals.fat += number(item.fat);
      return totals;
    }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
  }

  function macroRow(label, current, target, kind, unit) {
    const pct = target > 0 ? clamp(current / target * 100) : 0;
    return "<div class='macro-row'><div class='macro-info'><span class='macro-name'><i class='macro-dot " + kind + "'></i>" + label + "</span><strong>" +
      round(current) + "<small> / " + (target > 0 ? target : "set target") + " " + unit + "</small></strong></div>" +
      "<div class='progress-track'><div class='progress-fill " + kind + "' style='width:" + pct + "%'></div></div></div>";
  }

  function emptyState(icon, title, copy, actionLabel, action) {
    return "<div class='empty-state'><div class='empty-icon'>" + icon + "</div><strong>" + title + "</strong><span>" + copy + "</span>" +
      (actionLabel ? "<div style='margin-top:13px'><button class='btn btn-secondary btn-small' data-action='" + action + "'>" + actionLabel + "</button></div>" : "") +
      "</div>";
  }

  function mealIcon(category) {
    return ({ Breakfast: "☀", Lunch: "◒", Dinner: "☾", Snack: "✳" })[category] || "◉";
  }

  function renderMealItems(items, showDelete = false) {
    if (!items.length) return emptyState("◉", "No meals logged yet", "Add your first meal to start your daily nutrition log.", "Add a meal", "add-meal");
    return "<div class='meal-list'>" + items.slice().sort((a, b) => (a.time || "").localeCompare(b.time || "")).map(item =>
      "<div class='list-item'><div class='list-icon'>" + mealIcon(item.category) + "</div><div class='list-copy'><strong>" + safe(item.name) +
      "</strong><span>" + safe(item.category || "Meal") + (item.time ? " · " + safe(item.time) : "") + "</span></div><div class='list-meta'>" +
      Math.round(number(item.calories)) + " kcal<small>P " + round(item.protein) + "g · C " + round(item.carbs) + "g · F " + round(item.fat) + "g</small></div>" +
      (showDelete ? "<button class='icon-button' data-action='delete-meal' data-id='" + safe(item.id) + "' aria-label='Delete meal'>×</button>" : "") + "</div>"
    ).join("") + "</div>";
  }

  function renderWorkoutItems(items, showDelete = false) {
    if (!items.length) return emptyState("↗", "No workouts logged", "Your training sessions will show up here.", "Log a workout", "add-workout");
    return "<div class='workout-list'>" + items.slice().sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")).map(item => {
      const exerciseCount = (item.exercises || []).length;
      const setCount = (item.exercises || []).reduce((sum, exercise) => sum + number(exercise.sets), 0);
      return "<div class='list-item'><div class='list-icon'>↗</div><div class='list-copy'><strong>" + safe(item.name) +
        "</strong><span>" + safe(item.muscle || "Training") + " · " + exerciseCount + " exercises · " + setCount + " sets</span></div><div class='list-meta'>" +
        safe(item.duration || 0) + " min<small>" + prettyDate(item.date) + "</small></div>" +
        (showDelete ? "<button class='icon-button' data-action='delete-workout' data-id='" + safe(item.id) + "' aria-label='Delete workout'>×</button>" : "") + "</div>";
    }).join("") + "</div>";
  }

  function statCard(label, value, unit, foot, symbol) {
    return "<article class='stat-card'><div class='stat-top'><span>" + label + "</span><span class='stat-symbol'>" + symbol + "</span></div>" +
      "<div class='stat-value'>" + value + " <small>" + unit + "</small></div><div class='stat-foot'>" + foot + "</div></article>";
  }

  function getWeekDays() {
    const days = [];
    for (let offset = 6; offset >= 0; offset--) {
      const date = new Date();
      date.setDate(date.getDate() - offset);
      const key = dateKey(date);
      days.push({ key, date, label: date.toLocaleDateString("en-IN", { weekday: "short" }).slice(0, 2) });
    }
    return days;
  }

  function renderActivityBars() {
    const days = getWeekDays();
    const counts = days.map(day => state.workouts.filter(workout => workout.date === day.key).length);
    const max = Math.max(1, ...counts);
    return "<div class='activity-bars'>" + days.map((day, index) => {
      const height = counts[index] ? Math.max(15, counts[index] / max * 100) : 4;
      return "<div class='activity-day'><div class='activity-bar-wrap'><div class='activity-bar " + (day.key === dateKey() ? "today" : "") +
        "' style='height:" + height + "%'></div></div><span>" + day.label + "</span><small>" + (counts[index] || "·") + "</small></div>";
    }).join("") + "</div>";
  }

  function renderWeightChart(items) {
    const sorted = items.slice().sort((a, b) => a.date.localeCompare(b.date)).slice(-12);
    if (!sorted.length) return "<div class='chart-empty'>Your weigh-ins will create a trend line here.</div>";
    const width = 600, height = 180, left = 38, right = 18, top = 14, bottom = 29;
    const values = sorted.map(item => number(item.weight));
    let min = Math.min(...values), max = Math.max(...values);
    if (min === max) { min -= 1; max += 1; }
    const span = max - min;
    const points = sorted.map((item, index) => {
      const x = sorted.length === 1 ? width / 2 : left + index * (width - left - right) / (sorted.length - 1);
      const y = top + (max - number(item.weight)) / span * (height - top - bottom);
      return { x, y, item };
    });
    const line = points.map(point => point.x + "," + point.y).join(" ");
    const area = "M " + points[0].x + " " + (height - bottom) + " L " + points.map(point => point.x + " " + point.y).join(" L ") +
      " L " + points[points.length - 1].x + " " + (height - bottom) + " Z";
    const grid = [0, 1, 2].map(index => {
      const y = top + index * (height - top - bottom) / 2;
      const value = max - index * span / 2;
      return "<line class='chart-gridline' x1='" + left + "' y1='" + y + "' x2='" + (width - right) + "' y2='" + y + "'/>" +
        "<text class='chart-label' x='0' y='" + (y + 3) + "'>" + round(value) + "</text>";
    }).join("");
    const dots = points.map(point => "<circle class='chart-point' cx='" + point.x + "' cy='" + point.y + "' r='4'><title>" +
      prettyDate(point.item.date, { day: "numeric", month: "short", year: "numeric" }) + ": " + round(point.item.weight) + " " +
      safe(state.profile.unit) + "</title></circle>").join("");
    const labels = points.map((point, index) => index === 0 || index === points.length - 1 || index === Math.floor(points.length / 2)
      ? "<text class='chart-label' text-anchor='middle' x='" + point.x + "' y='" + (height - 6) + "'>" + prettyDate(point.item.date) + "</text>" : "").join("");
    return "<svg viewBox='0 0 " + width + " " + height + "' role='img' aria-label='Weight progress chart'>" +
      "<defs><linearGradient id='chart-gradient' x1='0' x2='0' y1='0' y2='1'><stop offset='0%' stop-color='#c6f36b'/><stop offset='100%' stop-color='#c6f36b' stop-opacity='0'/></linearGradient></defs>" +
      grid + "<path class='chart-area' d='" + area + "'/><polyline class='chart-line' points='" + line + "'/>" + dots + labels + "</svg>";
  }

  function renderDashboard() {
    const meals = todayMeals();
    const workouts = todayWorkouts();
    const totals = nutritionTotals(meals);
    const targets = state.targets;
    const water = number(state.waterByDate[dateKey()]);
    const caloriePct = targets.calories > 0 ? clamp(totals.calories / targets.calories * 100) : 0;
    const circumference = 314.16;
    const profileName = state.profile.name ? safe(state.profile.name) : "there";
    const lastWeight = state.weighIns.slice().sort((a, b) => b.date.localeCompare(a.date))[0];
    const totalSets = workouts.reduce((sum, workout) => sum + (workout.exercises || []).reduce((sub, exercise) => sub + number(exercise.sets), 0), 0);
    const dayCount = state.workouts.filter(item => item.date >= dateKey(new Date(Date.now() - 6 * 86400000))).length;
    return "<div class='page-heading'><div><span class='eyebrow'>MONDAY MINDSET, EVERY DAY</span><h1>Good to see you, " + profileName + ".</h1><p>Your effort adds up. Here is your snapshot for today.</p></div>" +
      "<div class='heading-actions'><button class='btn btn-secondary' data-action='add-meal'>＋ Log food</button><button class='btn btn-primary' data-action='add-workout'>＋ Log workout</button></div></div>" +
      "<div class='grid stats-grid'>" +
      statCard("Calories consumed", Math.round(totals.calories).toLocaleString("en-IN"), "kcal", Math.round(caloriePct) + "% of your daily target", "◉") +
      statCard("Protein so far", round(totals.protein), "g", "Target: " + targets.protein + " g", "✳") +
      statCard("Training sessions", workouts.length, "today", totalSets + " total sets logged today", "↗") +
      statCard("Latest weigh-in", lastWeight ? round(lastWeight.weight) : "—", lastWeight ? state.profile.unit : "", lastWeight ? "Recorded " + prettyDate(lastWeight.date) : "Add your first check-in", "⌁") +
      "</div>" +
      "<div class='grid dashboard-grid'><div>" +
      "<section class='panel'><div class='panel-head'><div><h2>Nutrition at a glance</h2><div class='panel-sub'>Today's intake compared with your targets</div></div><button class='inline-link' data-page='nutrition'>View nutrition →</button></div>" +
      "<div class='macro-layout'><div class='calorie-ring'><svg viewBox='0 0 120 120' aria-hidden='true'><circle class='ring-track' cx='60' cy='60' r='50'></circle><circle class='ring-progress' cx='60' cy='60' r='50' stroke-dasharray='" +
      (circumference * caloriePct / 100) + " " + circumference + "'></circle></svg><div class='ring-center'><strong>" + Math.round(totals.calories).toLocaleString("en-IN") + "</strong><span>kcal eaten</span><small>" +
      Math.max(0, Math.round(targets.calories - totals.calories)) + " kcal left</small></div></div><div class='macro-list'>" +
      macroRow("Protein", totals.protein, targets.protein, "", "g") + macroRow("Carbs", totals.carbs, targets.carbs, "carbs", "g") +
      macroRow("Fat", totals.fat, targets.fat, "fat", "g") + "</div></div></section>" +
      "<section class='panel'><div class='panel-head'><div><h2>Today's meals</h2><div class='panel-sub'>" + meals.length + " entries added</div></div><button class='inline-link' data-action='add-meal'>＋ Add meal</button></div>" +
      renderMealItems(meals) + "</section>" +
      "<section class='panel'><div class='panel-head'><div><h2>Training rhythm</h2><div class='panel-sub'>" + dayCount + " session(s) in the last 7 days</div></div><button class='inline-link' data-page='workouts'>Workout log →</button></div>" +
      renderActivityBars() + "</section></div>" +
      "<div><section class='panel'><div class='panel-head'><div><h2>Hydration</h2><div class='panel-sub'>Small sips, steady progress</div></div><span class='tag blue'>DAILY</span></div>" +
      "<div class='water-card'><div class='water-visual'>♧</div><div class='water-copy'><strong>" + (water / 1000).toFixed(2) + "<small style='font-size:12px;color:#96a58e'> L</small></strong><p>of " + (targets.water / 1000).toFixed(1) + " L daily target</p><div class='progress-track'><div class='progress-fill water' style='width:" + (targets.water ? clamp(water / targets.water * 100) : 0) + "%'></div></div></div></div>" +
      "<div class='water-actions'><button data-action='add-water' data-ml='250'>＋ 250 ml</button><button data-action='add-water' data-ml='500'>＋ 500 ml</button></div></section>" +
      "<section class='panel'><div class='panel-head'><div><h2>Today's training</h2><div class='panel-sub'>" + workouts.length + " session(s) logged</div></div><button class='inline-link' data-action='add-workout'>＋ Add</button></div>" +
      renderWorkoutItems(workouts) + "</section>" +
      "<section class='panel'><div class='panel-head'><div><h2>Weekly focus</h2><div class='panel-sub'>A little consistency goes a long way</div></div></div>" +
      "<div class='week-strip'>" + getWeekDays().map(day => {
        const done = state.workouts.some(item => item.date === day.key);
        return "<div class='week-day " + (day.key === dateKey() ? "today " : "") + (done ? "done" : "") + "'><span>" + day.label + "</span><strong>" + day.date.getDate() + "</strong></div>";
      }).join("") + "</div></section></div></div>";
  }

  function renderWorkouts() {
    const totalSets = state.workouts.reduce((sum, workout) => sum + (workout.exercises || []).reduce((sub, exercise) => sub + number(exercise.sets), 0), 0);
    const totalMinutes = state.workouts.reduce((sum, workout) => sum + number(workout.duration), 0);
    const muscles = [...new Set(state.workouts.map(item => item.muscle).filter(Boolean))];
    return "<div class='page-heading'><div><span class='eyebrow'>SHOW UP. PUT IN THE WORK.</span><h1>Workout log</h1><p>Keep a record of your sessions, exercises, sets and loads.</p></div>" +
      "<div class='heading-actions'><button class='btn btn-primary' data-action='add-workout'>＋ Log workout</button></div></div>" +
      "<div class='grid stats-grid'>" + statCard("Sessions logged", state.workouts.length, "total", "Every session you record", "↗") +
      statCard("Total sets", totalSets, "sets", "Across all logged sessions", "▤") +
      statCard("Training time", Math.round(totalMinutes / 60 * 10) / 10, "hours", "Based on your logged duration", "◷") +
      statCard("Muscle groups", muscles.length, "groups", muscles.length ? muscles.slice(0, 3).map(safe).join(", ") : "Start your first session", "✳") + "</div>" +
      "<div class='page-columns'><section class='panel'><div class='panel-head'><div><h2>Session history</h2><div class='panel-sub'>Most recent sessions first</div></div></div>" +
      renderWorkoutItems(state.workouts, true) + "</section><section class='panel'><div class='panel-head'><div><h2>Training notes</h2><div class='panel-sub'>Build your own routine</div></div></div>" +
      "<div class='notice'><strong>Track the details.</strong><br>Log the exercise, working sets, reps and weight used. Over time this makes it easier to see when you are progressing.</div>" +
      "<div class='divider'></div><div class='small-note'>FitCheck does not prescribe a workout plan. Use this space to record the routine you follow and any notes that matter to you.</div></section></div>";
  }

  function renderNutrition() {
    const meals = todayMeals();
    const totals = nutritionTotals(meals);
    const targets = state.targets;
    const todayKey = dateKey();
    const allDates = [...new Set(state.meals.map(item => item.date))].sort().reverse().slice(0, 7);
    return "<div class='page-heading'><div><span class='eyebrow'>FUEL YOUR TRAINING</span><h1>Nutrition tracker</h1><p>Log what you eat and keep an eye on your daily macros.</p></div>" +
      "<div class='heading-actions'><button class='btn btn-primary' data-action='add-meal'>＋ Add food</button></div></div>" +
      "<div class='grid stats-grid'>" + statCard("Calories", Math.round(totals.calories), "kcal", "Target: " + targets.calories + " kcal", "◉") +
      statCard("Protein", round(totals.protein), "g", "Target: " + targets.protein + " g", "✳") +
      statCard("Carbohydrates", round(totals.carbs), "g", "Target: " + targets.carbs + " g", "⌁") +
      statCard("Fat", round(totals.fat), "g", "Target: " + targets.fat + " g", "◍") + "</div>" +
      "<div class='page-columns'><section class='panel'><div class='panel-head'><div><h2>Food diary</h2><div class='panel-sub'>" + prettyDate(todayKey, { weekday: "long", day: "numeric", month: "long" }) + "</div></div><span class='tag'>" + meals.length + " MEALS</span></div>" +
      renderMealItems(meals, true) + "</section><section class='panel'><div class='panel-head'><div><h2>Macro targets</h2><div class='panel-sub'>Progress for today</div></div><button class='inline-link' data-page='settings'>Edit targets →</button></div>" +
      "<div class='macro-list'>" + macroRow("Calories", totals.calories, targets.calories, "", "kcal") + macroRow("Protein", totals.protein, targets.protein, "", "g") +
      macroRow("Carbs", totals.carbs, targets.carbs, "carbs", "g") + macroRow("Fat", totals.fat, targets.fat, "fat", "g") + "</div>" +
      "<div class='divider'></div><p class='small-note'>Nutrition values are only as accurate as the entries you add. Use food labels or a trusted nutrition database when you need precise estimates.</p></section></div>" +
      "<section class='panel'><div class='panel-head'><div><h2>Recent food log dates</h2><div class='panel-sub'>Your latest days with a saved entry</div></div></div>" +
      (allDates.length ? "<div class='table-scroll'><table class='data-table'><thead><tr><th>DATE</th><th>ENTRIES</th><th>CALORIES</th><th>PROTEIN</th></tr></thead><tbody>" +
        allDates.map(key => { const dayMeals = state.meals.filter(item => item.date === key); const dayTotals = nutritionTotals(dayMeals); return "<tr><td>" + prettyDate(key, { weekday: "short", day: "numeric", month: "short", year: "numeric" }) +
          (key === todayKey ? " <span class='tag'>TODAY</span>" : "") + "</td><td>" + dayMeals.length + "</td><td>" + Math.round(dayTotals.calories) + " kcal</td><td>" + round(dayTotals.protein) + " g</td></tr>"; }).join("") +
        "</tbody></table></div>" : emptyState("◉", "Nothing logged yet", "Your saved food days will appear here.")) + "</section>";
  }

  function renderProgress() {
    const sorted = state.weighIns.slice().sort((a, b) => a.date.localeCompare(b.date));
    const latest = sorted[sorted.length - 1];
    const previous = sorted.length > 1 ? sorted[sorted.length - 2] : null;
    const delta = latest && previous ? round(latest.weight - previous.weight) : null;
    const averageSessions = state.workouts.length;
    const recentWeights = sorted.slice().reverse().slice(0, 8);
    return "<div class='page-heading'><div><span class='eyebrow'>NOTICE THE LITTLE WINS</span><h1>Your progress</h1><p>Track trends over time. One data point never tells the whole story.</p></div>" +
      "<div class='heading-actions'><button class='btn btn-primary' data-action='add-weight'>＋ Add weigh-in</button></div></div>" +
      "<div class='progress-summary'>" +
      "<div class='progress-tile'><span>Latest weight</span><strong>" + (latest ? round(latest.weight) + " " + safe(state.profile.unit) : "—") + "</strong><small>" + (latest ? "Recorded " + prettyDate(latest.date) : "No weigh-ins yet") + "</small></div>" +
      "<div class='progress-tile'><span>Change from previous</span><strong>" + (delta === null ? "—" : (delta > 0 ? "+" : "") + delta + " " + safe(state.profile.unit)) + "</strong><small>" + (delta === null ? "Add another check-in to compare" : "Latest entry vs previous entry") + "</small></div>" +
      "<div class='progress-tile'><span>Sessions recorded</span><strong>" + averageSessions + "</strong><small>All-time workout log</small></div></div>" +
      "<section class='panel' style='margin-top:16px'><div class='panel-head'><div><h2>Weight trend</h2><div class='panel-sub'>Most recent 12 weigh-ins · " + safe(state.profile.unit) + "</div></div><span class='tag'>PROGRESS</span></div>" +
      "<div class='chart-wrap'>" + renderWeightChart(sorted) + "</div></section>" +
      "<section class='panel'><div class='panel-head'><div><h2>Weigh-in history</h2><div class='panel-sub'>Use consistent conditions when comparing entries</div></div></div>" +
      (recentWeights.length ? "<div class='table-scroll'><table class='data-table'><thead><tr><th>DATE</th><th>WEIGHT</th><th>NOTE</th><th></th></tr></thead><tbody>" +
        recentWeights.map(item => "<tr><td>" + prettyDate(item.date, { weekday: "short", day: "numeric", month: "short", year: "numeric" }) + "</td><td><strong>" + round(item.weight) + " " + safe(state.profile.unit) + "</strong></td><td>" + safe(item.note || "—") + "</td><td><button class='inline-link' data-action='delete-weight' data-id='" + safe(item.id) + "'>Remove</button></td></tr>").join("") +
        "</tbody></table></div>" : emptyState("⌁", "Your progress starts here", "Add a weigh-in to create your first trend line.", "Add weigh-in", "add-weight")) +
      "</section><p class='small-note'>Body weight naturally fluctuates. Look at longer-term patterns rather than reacting to a single measurement.</p>";
  }

  function renderSettings() {
    const profile = state.profile, targets = state.targets;
    return "<div class='page-heading'><div><span class='eyebrow'>MAKE IT YOURS</span><h1>Settings</h1><p>Set up your profile, daily targets and data backups.</p></div></div>" +
      "<div class='settings-grid'><section class='panel'><div class='panel-head'><div><h2>Personal profile</h2><div class='panel-sub'>These details stay in this browser</div></div></div>" +
      "<form id='profile-form'><div class='form-grid'>" +
      "<div class='form-field full'><label for='profile-name'>Name or nickname</label><input id='profile-name' name='name' maxlength='40' placeholder='What should FitCheck call you?' value='" + safe(profile.name) + "'></div>" +
      "<div class='form-field'><label for='profile-height'>Height (cm)</label><input id='profile-height' name='height' type='number' min='1' max='250' step='0.1' placeholder='e.g. 165' value='" + safe(profile.height) + "'></div>" +
      "<div class='form-field'><label for='profile-weight'>Current weight (" + safe(profile.unit) + ")</label><input id='profile-weight' name='currentWeight' type='number' min='1' max='500' step='0.1' placeholder='Optional' value='" + safe(profile.currentWeight) + "'></div>" +
      "<div class='form-field'><label for='profile-unit'>Weight unit</label><select id='profile-unit' name='unit'><option value='kg' " + (profile.unit === "kg" ? "selected" : "") + ">Kilograms (kg)</option><option value='lb' " + (profile.unit === "lb" ? "selected" : "") + ">Pounds (lb)</option></select></div>" +
      "<div class='form-field'><label for='profile-goal'>Main focus</label><select id='profile-goal' name='goal'>" +
      ["Body recomposition", "Build muscle", "Improve strength", "General fitness", "Improve endurance", "Maintain routine"].map(goal => "<option " + (profile.goal === goal ? "selected" : "") + ">" + goal + "</option>").join("") +
      "</select></div></div><div class='modal-actions'><button class='btn btn-primary' type='submit'>Save profile</button></div></form>" +
      "<div class='divider'></div><div class='panel-head'><div><h2>Daily targets</h2><div class='panel-sub'>Editable starter values. Set targets appropriate for you.</div></div></div>" +
      "<form id='targets-form'><div class='form-grid'>" +
      [["calories","Calories (kcal)"],["protein","Protein (g)"],["carbs","Carbohydrates (g)"],["fat","Fat (g)"],["water","Water (ml)"]].map(([key,label]) =>
        "<div class='form-field'><label for='target-" + key + "'>" + label + "</label><input id='target-" + key + "' type='number' name='" + key + "' min='0' step='1' value='" + safe(targets[key]) + "'></div>").join("") +
      "</div><div class='modal-actions'><button class='btn btn-primary' type='submit'>Save targets</button></div></form></section>" +
      "<div><section class='panel'><div class='panel-head'><div><h2>Your data</h2><div class='panel-sub'>Back up or move your FitCheck records</div></div></div>" +
      "<div class='notice'><strong>Local-first privacy.</strong><br>Your meals, workouts and weigh-ins are saved in this browser's local storage. They are not uploaded to this website's GitHub repository.</div>" +
      "<div class='setting-actions'><button class='btn btn-secondary' data-action='export-data'>↓ Export backup</button><button class='btn btn-ghost' data-action='import-data'>↑ Import backup</button><input type='file' id='import-file' accept='application/json,.json' hidden></div>" +
      "<div class='divider'></div><div class='setting-row'><div><strong>Records saved</strong><span>Meals, workouts and weigh-ins</span></div><strong>" + (state.meals.length + state.workouts.length + state.weighIns.length) + "</strong></div>" +
      "<div class='setting-row'><div><strong>Clear all local data</strong><span>This cannot be undone without a backup.</span></div><button class='btn btn-danger btn-small' data-action='clear-data'>Clear</button></div></section>" +
      "<section class='panel'><div class='panel-head'><div><h2>About FitCheck</h2><div class='panel-sub'>Your personal fitness companion</div></div></div>" +
      "<p class='small-note'>FitCheck is a personal tracking tool, not medical advice. Calorie, macro and hydration targets are editable placeholders, not recommendations. For individualized targets, consult a qualified professional.</p>" +
      "<div class='divider'></div><p class='small-note'>Tip: Export a backup before clearing browser data or switching devices. Your information does not automatically sync between browsers.</p></section></div></div>";
  }

  function render() {
    const pageLabels = { dashboard: "Overview", workouts: "Workouts", nutrition: "Nutrition", progress: "Progress", settings: "Settings" };
    const page = pageLabels[currentPage] ? currentPage : "dashboard";
    currentPage = page;
    $("#crumb-current").textContent = pageLabels[page];
    $$(".nav-link[data-page]").forEach(button => button.classList.toggle("active", button.dataset.page === page));
    const name = state.profile.name || "Your profile";
    $("#profile-name-mini").textContent = name;
    $("#avatar-initial").textContent = (name.trim()[0] || "F").toUpperCase();
    $("#top-avatar").textContent = (name.trim()[0] || "F").toUpperCase();
    $("#today-label").textContent = new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
    const views = { dashboard: renderDashboard, workouts: renderWorkouts, nutrition: renderNutrition, progress: renderProgress, settings: renderSettings };
    $("#view-root").innerHTML = views[page]();
  }

  function toast(message) {
    const node = document.createElement("div");
    node.className = "toast";
    node.textContent = message;
    $("#toast-region").appendChild(node);
    setTimeout(() => node.remove(), 2800);
  }

  function openModal(title, content, eyebrow = "QUICK ADD") {
    $("#modal-title").textContent = title;
    $("#modal-eyebrow").textContent = eyebrow;
    $("#modal-body").innerHTML = content;
    $("#modal-backdrop").hidden = false;
    document.body.style.overflow = "hidden";
    const first = $("input:not([type=hidden]),select,textarea", $("#modal-body"));
    if (first) setTimeout(() => first.focus(), 30);
  }

  function closeModal() {
    $("#modal-backdrop").hidden = true;
    document.body.style.overflow = "";
  }

  function mealForm() {
    const now = new Date();
    const time = String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
    return "<form id='meal-form'><div class='form-grid'>" +
      "<div class='form-field full'><label for='meal-name'>Food or meal name</label><input id='meal-name' name='name' required maxlength='70' placeholder='e.g. Paneer rice bowl'></div>" +
      "<div class='form-field'><label for='meal-category'>Meal type</label><select id='meal-category' name='category'><option>Breakfast</option><option>Lunch</option><option>Snack</option><option>Dinner</option></select></div>" +
      "<div class='form-field'><label for='meal-time'>Time</label><input id='meal-time' type='time' name='time' value='" + time + "'></div>" +
      "<div class='form-field'><label for='meal-calories'>Calories (kcal)</label><input id='meal-calories' name='calories' type='number' min='0' step='1' placeholder='Optional'></div>" +
      "<div class='form-field'><label for='meal-protein'>Protein (g)</label><input name='protein' type='number' min='0' step='0.1' value='0'></div>" +
      "<div class='form-field'><label for='meal-carbs'>Carbs (g)</label><input name='carbs' type='number' min='0' step='0.1' value='0'></div>" +
      "<div class='form-field'><label for='meal-fat'>Fat (g)</label><input name='fat' type='number' min='0' step='0.1' value='0'></div>" +
      "<div class='form-field full'><span class='form-hint'>Use the food label or a nutrition source for your estimates. If calories are left blank, FitCheck estimates them from macros.</span></div>" +
      "</div><div class='modal-actions'><button type='button' class='btn btn-ghost' data-action='close-modal'>Cancel</button><button class='btn btn-primary' type='submit'>Save meal</button></div></form>";
  }

  function exerciseRow() {
    return "<div class='exercise-row'><div class='form-field'><label>Exercise</label><input name='exerciseName' required placeholder='e.g. Bench press'></div>" +
      "<div class='form-field'><label>Sets</label><input name='sets' type='number' min='1' max='20' value='3' required></div>" +
      "<div class='form-field'><label>Reps</label><input name='reps' type='text' maxlength='18' value='12' required></div>" +
      "<div class='form-field'><label>Load (kg)</label><input name='load' type='number' min='0' step='0.5' value='0'></div>" +
      "<button type='button' class='remove-exercise' data-action='remove-exercise' aria-label='Remove exercise'>×</button></div>";
  }

  function workoutForm() {
    return "<form id='workout-form'><div class='form-grid'>" +
      "<div class='form-field'><label for='workout-name'>Session name</label><input id='workout-name' name='name' required maxlength='60' placeholder='e.g. Push day'></div>" +
      "<div class='form-field'><label for='workout-muscle'>Focus</label><select id='workout-muscle' name='muscle'><option>Chest</option><option>Back</option><option>Shoulders</option><option>Arms</option><option>Legs</option><option>Core</option><option>Full body</option><option>Cardio</option><option>Other</option></select></div>" +
      "<div class='form-field'><label for='workout-duration'>Duration (minutes)</label><input id='workout-duration' name='duration' type='number' min='0' max='600' value='60'></div>" +
      "<div class='form-field'><label for='workout-date'>Date</label><input id='workout-date' name='date' type='date' value='" + dateKey() + "' required></div></div>" +
      "<div class='section-title'>Exercises</div><div class='exercise-builder' id='exercise-builder'>" + exerciseRow() + "</div>" +
      "<button type='button' class='btn btn-secondary btn-small' style='margin-top:10px' data-action='add-exercise'>＋ Add exercise</button>" +
      "<div class='form-field' style='margin-top:14px'><label for='workout-notes'>Session notes (optional)</label><textarea id='workout-notes' name='notes' rows='2' maxlength='300' placeholder='How did the session feel?'></textarea></div>" +
      "<div class='modal-actions'><button type='button' class='btn btn-ghost' data-action='close-modal'>Cancel</button><button class='btn btn-primary' type='submit'>Save workout</button></div></form>";
  }

  function weightForm() {
    return "<form id='weight-form'><div class='form-grid'>" +
      "<div class='form-field'><label for='weighin-value'>Weight (" + safe(state.profile.unit) + ")</label><input id='weighin-value' name='weight' type='number' min='1' max='500' step='0.1' required placeholder='e.g. 68.5'></div>" +
      "<div class='form-field'><label for='weighin-date'>Date</label><input id='weighin-date' name='date' type='date' required value='" + dateKey() + "'></div>" +
      "<div class='form-field full'><label for='weighin-note'>Note (optional)</label><input id='weighin-note' name='note' maxlength='100' placeholder='e.g. Morning, before breakfast'></div>" +
      "</div><div class='modal-actions'><button type='button' class='btn btn-ghost' data-action='close-modal'>Cancel</button><button class='btn btn-primary' type='submit'>Save weigh-in</button></div></form>";
  }

  function addMeal(form) {
    const values = Object.fromEntries(new FormData(form).entries());
    const protein = number(values.protein), carbs = number(values.carbs), fat = number(values.fat);
    const calories = values.calories === "" ? protein * 4 + carbs * 4 + fat * 9 : number(values.calories);
    state.meals.push({
      id: makeId(), date: dateKey(), time: values.time, name: values.name.trim(), category: values.category,
      calories: round(calories), protein: round(protein), carbs: round(carbs), fat: round(fat)
    });
    saveState(); closeModal(); render(); toast("Meal added to your food diary.");
  }

  function addWorkout(form) {
    const values = Object.fromEntries(new FormData(form).entries());
    const rows = $$(".exercise-row", $("#exercise-builder"));
    const exercises = rows.map(row => ({
      name: $("input[name=exerciseName]", row).value.trim(),
      sets: number($("input[name=sets]", row).value),
      reps: $("input[name=reps]", row).value.trim(),
      load: number($("input[name=load]", row).value)
    })).filter(item => item.name);
    if (!exercises.length) { toast("Add at least one exercise."); return; }
    state.workouts.push({
      id: makeId(), createdAt: new Date().toISOString(), date: values.date || dateKey(),
      name: values.name.trim(), muscle: values.muscle, duration: number(values.duration), notes: values.notes.trim(), exercises
    });
    saveState(); closeModal(); render(); toast("Workout saved. Nice work.");
  }

  function addWeight(form) {
    const values = Object.fromEntries(new FormData(form).entries());
    state.weighIns.push({ id: makeId(), date: values.date, weight: number(values.weight), note: values.note.trim() });
    state.profile.currentWeight = values.weight;
    saveState(); closeModal(); render(); toast("Weigh-in saved.");
  }

  function saveProfile(form) {
    const values = Object.fromEntries(new FormData(form).entries());
    state.profile = { ...state.profile, name: values.name.trim(), height: values.height, currentWeight: values.currentWeight, unit: values.unit, goal: values.goal };
    saveState(); render(); toast("Profile updated.");
  }

  function saveTargets(form) {
    const values = Object.fromEntries(new FormData(form).entries());
    Object.keys(state.targets).forEach(key => state.targets[key] = Math.max(0, number(values[key])));
    saveState(); render(); toast("Daily targets updated.");
  }

  function exportData() {
    const payload = { app: "FitCheck", version: 1, exportedAt: new Date().toISOString(), data: state };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "fitcheck-backup-" + dateKey() + ".json";
    document.body.appendChild(link); link.click(); link.remove();
    URL.revokeObjectURL(url);
    toast("Backup exported.");
  }

  function importData(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        const imported = parsed.data || parsed;
        if (!imported || !Array.isArray(imported.meals) || !Array.isArray(imported.workouts)) throw new Error("Invalid backup");
        state = {
          ...structuredClone(STARTER), ...imported,
          profile: { ...STARTER.profile, ...(imported.profile || {}) },
          targets: { ...STARTER.targets, ...(imported.targets || {}) },
          weighIns: Array.isArray(imported.weighIns) ? imported.weighIns : [],
          waterByDate: imported.waterByDate || {}
        };
        saveState(); render(); toast("Backup imported successfully.");
      } catch (error) {
        toast("That file does not look like a FitCheck backup.");
      }
    };
    reader.readAsText(file);
  }

  document.addEventListener("click", event => {
    const pageButton = event.target.closest("[data-page]");
    if (pageButton) {
      event.preventDefault();
      currentPage = pageButton.dataset.page;
      render();
      $("#sidebar").classList.remove("open");
      return;
    }
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const action = button.dataset.action;

    if (action === "add-meal") openModal("Log a meal", mealForm());
    if (action === "add-workout") openModal("Log a workout", workoutForm());
    if (action === "add-weight") openModal("Add weigh-in", weightForm(), "PROGRESS CHECK-IN");
    if (action === "close-modal") closeModal();
    if (action === "add-exercise") $("#exercise-builder").insertAdjacentHTML("beforeend", exerciseRow());
    if (action === "remove-exercise") {
      const rows = $$(".exercise-row", $("#exercise-builder"));
      if (rows.length > 1) button.closest(".exercise-row").remove();
      else toast("Keep at least one exercise row.");
    }
    if (action === "add-water") {
      const key = dateKey();
      state.waterByDate[key] = number(state.waterByDate[key]) + number(button.dataset.ml);
      saveState(); render(); toast(button.dataset.ml + " ml water added.");
    }
    if (action === "delete-meal") {
      state.meals = state.meals.filter(item => item.id !== button.dataset.id);
      saveState(); render(); toast("Meal removed.");
    }
    if (action === "delete-workout") {
      state.workouts = state.workouts.filter(item => item.id !== button.dataset.id);
      saveState(); render(); toast("Workout removed.");
    }
    if (action === "delete-weight") {
      state.weighIns = state.weighIns.filter(item => item.id !== button.dataset.id);
      saveState(); render(); toast("Weigh-in removed.");
    }
    if (action === "export-data") exportData();
    if (action === "import-data") $("#import-file").click();
    if (action === "clear-data") {
      if (confirm("Clear all FitCheck records from this browser? Export a backup first if you may need these records.")) {
        state = structuredClone(STARTER); saveState(); render(); toast("Local FitCheck data cleared.");
      }
    }
  });

  document.addEventListener("submit", event => {
    if (event.target.id === "meal-form") { event.preventDefault(); addMeal(event.target); }
    if (event.target.id === "workout-form") { event.preventDefault(); addWorkout(event.target); }
    if (event.target.id === "weight-form") { event.preventDefault(); addWeight(event.target); }
    if (event.target.id === "profile-form") { event.preventDefault(); saveProfile(event.target); }
    if (event.target.id === "targets-form") { event.preventDefault(); saveTargets(event.target); }
  });

  document.addEventListener("change", event => {
    if (event.target.id === "import-file") {
      importData(event.target.files && event.target.files[0]);
      event.target.value = "";
    }
  });

  $("#modal-close").addEventListener("click", closeModal);
  $("#modal-backdrop").addEventListener("click", event => {
    if (event.target.id === "modal-backdrop") closeModal();
  });
  $("#menu-toggle").addEventListener("click", () => $("#sidebar").classList.toggle("open"));
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !$("#modal-backdrop").hidden) closeModal();
  });

  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
  }

  render();
})();