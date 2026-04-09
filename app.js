const DATA = window.HIPPOCRATES_DATA;
const summary = [...DATA.summary];
const deaths = [...DATA.deaths];
const storageKey = "hipocrates-progress-final";
const totalMilestones = 4;

let mortalityChart = null;
let ageChart = null;
let hourChart = null;
let contextChart = null;
let sortField = "doctor_id";
let sortDir = "asc";
let lastContrast = null;

const state = loadState();

document.addEventListener("DOMContentLoaded", () => {
  populateDoctorSelectors();
  fillSummaryTable();
  wireEvents();
  byId("notesArea").value = state.notes || "";
  renderEvidenceBoard();
  renderFinalEvidenceChecklist();
  renderCurrentStage();
  updateProgress();
  renderMortalityModule();
  renderCurrentModule();
  renderDraftOutput();
  announce("Expediente cargado. Empieza por el briefing o reinicia el caso si quieres borrar el progreso local.");
});

function loadState() {
  const fallback = {
    started: false,
    unlockedStage: 0,
    currentStage: 0,
    currentModule: "mortality",
    evidences: [],
    notes: "",
    contrastAdded: false,
    finalGenerated: false,
    lastDraft: ""
  };
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey));
    return parsed ? { ...fallback, ...parsed } : fallback;
  } catch {
    return fallback;
  }
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function byId(id) {
  return document.getElementById(id);
}

function qsa(selector) {
  return Array.from(document.querySelectorAll(selector));
}

function announce(message) {
  byId("globalStatus").textContent = message;
}

function wireEvents() {
  byId("startBtn").addEventListener("click", startCase);
  byId("briefingStartBtn").addEventListener("click", startCase);
  byId("resetBtn").addEventListener("click", resetProgress);

  qsa(".stage-link").forEach(btn => {
    btn.addEventListener("click", () => {
      const stage = Number(btn.dataset.stage);
      if (stage <= state.unlockedStage) {
        state.currentStage = stage;
        saveState();
        renderCurrentStage();
      }
    });
  });

  qsa(".module-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      state.currentModule = btn.dataset.module;
      saveState();
      renderCurrentModule();
    });
  });

  ["doctorSelectAge", "doctorSelectHour", "doctorSelectContext", "doctorSelectTest", "finalDoctorSelect"].forEach(id => {
    byId(id).addEventListener("change", () => {
      if (id === "doctorSelectAge") renderAgeModule();
      if (id === "doctorSelectHour") renderHourModule();
      if (id === "doctorSelectContext") renderContextModule();
      if (id === "doctorSelectTest") runSelectedTest();
    });
  });

  byId("indicatorSelect").addEventListener("change", runSelectedTest);
  const runBtn = byId("runTestBtn");
  if (runBtn) runBtn.addEventListener("click", runSelectedTest);

  byId("addMortalityEvidenceBtn").addEventListener("click", addMortalityEvidence);
  byId("addAgeEvidenceBtn").addEventListener("click", addAgeEvidence);
  byId("addHourEvidenceBtn").addEventListener("click", addHourEvidence);
  byId("addContextEvidenceBtn").addEventListener("click", addContextEvidence);
  byId("addContrastEvidenceBtn").addEventListener("click", addContrastEvidence);

  byId("notesArea").addEventListener("input", (e) => {
    state.notes = e.target.value;
    saveState();
  });
  byId("clearNotesBtn").addEventListener("click", () => {
    state.notes = "";
    byId("notesArea").value = "";
    saveState();
    announce("Notas vaciadas.");
  });

  byId("generateDraftBtn").addEventListener("click", generateDraft);
  byId("copyDraftBtn").addEventListener("click", copyDraft);
  byId("downloadDraftBtn").addEventListener("click", downloadDraft);

  byId("summaryTable").addEventListener("click", (event) => {
    const th = event.target.closest("th[data-sort]");
    const row = event.target.closest("tr.table-candidate");
    if (th) {
      const nextField = th.dataset.sort;
      if (sortField === nextField) sortDir = sortDir === "asc" ? "desc" : "asc";
      else {
        sortField = nextField;
        sortDir = nextField === "doctor_id" || nextField === "doctor_practice_type" ? "asc" : "desc";
      }
      fillSummaryTable();
      return;
    }
    if (row) {
      const doctor = row.dataset.doctor;
      setDoctorAcrossModules(doctor);
      announce(`Has fijado ${doctor} como candidato en edad, horario, contexto y contrastes.`);
    }
  });

  byId("evidenceBoard").addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-remove-id]");
    if (!btn) return;
    removeEvidence(btn.dataset.removeId);
  });
}

function startCase() {
  state.started = true;
  state.unlockedStage = Math.max(state.unlockedStage, 1);
  state.currentStage = 1;
  saveState();
  renderCurrentStage();
  updateProgress();
  announce("Sala de análisis desbloqueada. Reúne varias evidencias antes de pasar a contrastes.");
}

function resetProgress() {
  localStorage.removeItem(storageKey);
  Object.assign(state, {
    started: false,
    unlockedStage: 0,
    currentStage: 0,
    currentModule: "mortality",
    evidences: [],
    notes: "",
    contrastAdded: false,
    finalGenerated: false,
    lastDraft: ""
  });
  lastContrast = null;
  byId("notesArea").value = "";
  qsa("select").forEach(select => {
    if (select.querySelector('option[value=""]')) select.value = "";
  });
  byId("reasoningArea").value = "";
  byId("alternativeArea").value = "";
  clearInlineFeedback();
  fillSummaryTable();
  renderEvidenceBoard();
  renderFinalEvidenceChecklist();
  renderCurrentStage();
  renderCurrentModule();
  renderDraftOutput();
  updateProgress();
  announce("Expediente reiniciado. Todo el progreso local ha sido borrado.");
}

function clearInlineFeedback() {
  ["mortalityFeedback", "ageFeedback", "hourFeedback", "contextFeedback", "contrastFeedback", "finalFeedback"].forEach(id => {
    byId(id).textContent = "";
  });
}

function renderCurrentStage() {
  qsa(".stage-panel").forEach(panel => panel.classList.remove("visible"));
  byId(`stage-${state.currentStage}`).classList.add("visible");
  qsa(".stage-link").forEach(link => {
    const stage = Number(link.dataset.stage);
    link.classList.toggle("active", stage === state.currentStage);
    link.classList.toggle("locked", stage > state.unlockedStage);
  });
  if (state.currentStage === 1) renderCurrentModule();
  if (state.currentStage === 2) runSelectedTest();
  if (state.currentStage === 3) renderFinalEvidenceChecklist();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function updateProgress() {
  const milestones = [state.started, canUnlockContrast(), state.contrastAdded, state.finalGenerated];
  const done = milestones.filter(Boolean).length;
  byId("progressFill").style.width = `${(done / totalMilestones) * 100}%`;
  byId("progressText").textContent = `${done} de ${totalMilestones} hitos completados`;

  if (state.started) state.unlockedStage = Math.max(state.unlockedStage, 1);
  if (canUnlockContrast()) state.unlockedStage = Math.max(state.unlockedStage, 2);
  if (state.contrastAdded) state.unlockedStage = Math.max(state.unlockedStage, 3);
  saveState();
  renderCurrentStage();
}

function renderEvidenceBoard() {
  const container = byId("evidenceBoard");
  byId("evidenceCounter").textContent = `${state.evidences.length} evidencias`;
  if (!state.evidences.length) {
    container.innerHTML = `<div class="placeholder-box">Todavía no has añadido hallazgos al expediente.</div>`;
    return;
  }
  container.innerHTML = state.evidences.map(item => `
    <article class="evidence-item">
      <button class="evidence-remove" data-remove-id="${item.id}" aria-label="Eliminar evidencia">×</button>
      <h4>${item.title}</h4>
      <p>${item.summary}</p>
      <div class="evidence-meta">
        <span class="evidence-chip">${item.kindLabel}</span>
        ${item.doctor ? `<span class="evidence-chip">${item.doctor}</span>` : ""}
      </div>
    </article>
  `).join("");
}

function renderFinalEvidenceChecklist() {
  const box = byId("finalEvidenceChecklist");
  if (!state.evidences.length) {
    box.innerHTML = `<div class="placeholder-box">Añade primero evidencias al expediente.</div>`;
    return;
  }
  box.innerHTML = state.evidences.map((item) => `
    <label class="check-option">
      <input type="checkbox" value="${item.id}" checked>
      <span><strong>${item.title}</strong><br><span class="muted small">${item.summary}</span></span>
    </label>
  `).join("");
}

function removeEvidence(id) {
  state.evidences = state.evidences.filter(item => item.id !== id);
  saveState();
  renderEvidenceBoard();
  renderFinalEvidenceChecklist();
  updateProgress();
  announce("Evidencia eliminada del expediente.");
}

function canUnlockContrast() {
  const kinds = new Set(state.evidences.map(item => item.kind));
  const hasOperational = state.evidences.some(item => item.kind === "hour" || item.kind === "context");
  return kinds.size >= 3 && hasOperational;
}

function upsertEvidence(evidence) {
  const idx = state.evidences.findIndex(item => item.id === evidence.id);
  if (idx >= 0) state.evidences[idx] = evidence;
  else state.evidences.push(evidence);
  saveState();
  renderEvidenceBoard();
  renderFinalEvidenceChecklist();
  updateProgress();
}

function setDoctorAcrossModules(doctor) {
  ["doctorSelectAge", "doctorSelectHour", "doctorSelectContext", "doctorSelectTest", "finalDoctorSelect"].forEach(id => {
    byId(id).value = doctor;
  });
  renderAgeModule();
  renderHourModule();
  renderContextModule();
  runSelectedTest();
  saveState();
}

function populateDoctorSelectors() {
  const doctors = summary.map(d => d.doctor_id).sort();
  const options = ['<option value="">Selecciona un médico</option>'].concat(doctors.map(doc => `<option value="${doc}">${doc}</option>`)).join("");
  ["doctorSelectAge", "doctorSelectHour", "doctorSelectContext", "doctorSelectTest", "finalDoctorSelect"].forEach(id => {
    byId(id).innerHTML = options;
  });
}

function sortRows(rows) {
  return rows.sort((a, b) => {
    const av = a[sortField];
    const bv = b[sortField];
    let result;
    if (typeof av === "string") result = av.localeCompare(bv);
    else result = av - bv;
    return sortDir === "asc" ? result : -result;
  });
}

function fillSummaryTable() {
  const tbody = document.querySelector("#summaryTable tbody");
  const rows = sortRows([...summary]);
  tbody.innerHTML = rows.map(row => `
    <tr class="table-candidate" data-doctor="${row.doctor_id}">
      <td>${row.doctor_id}</td>
      <td>${row.patients}</td>
      <td>${row.deaths}</td>
      <td>${formatPct(row.mortality_rate)}</td>
      <td>${row.doctor_practice_type}</td>
    </tr>
  `).join("");
}

function renderMortalityModule() {
  const ordered = [...summary].sort((a, b) => a.doctor_id.localeCompare(b.doctor_id));
  const labels = ordered.map(d => d.doctor_id);
  const values = ordered.map(d => +(d.mortality_rate * 100).toFixed(2));
  const ctx = byId("mortalityChart");
  if (mortalityChart) mortalityChart.destroy();
  mortalityChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{ data: values, backgroundColor: "rgba(138,182,255,.78)", borderRadius: 8 }]
    },
    options: baseBarOptions("%")
  });

  const rates = ordered.map(d => d.mortality_rate);
  const minRate = Math.min(...rates);
  const maxRate = Math.max(...rates);
  const medianRate = [...rates].sort((a, b) => a - b)[Math.floor(rates.length / 2)];
  byId("mortalityInsight").innerHTML = `
    <div class="stat-item">Rango observado<strong>${formatPct(minRate)} – ${formatPct(maxRate)}</strong></div>
    <div class="stat-item">Qué resume la tasa<strong>Fallecimientos / pacientes asignados en el periodo</strong></div>
    <div class="stat-item">Cómo leerla<strong>Úsala para comparar frecuencia general entre médicos, no para inferir por sí sola un mecanismo o una causa.</strong></div>
  `;
}

function renderCurrentModule() {
  qsa(".module-tab").forEach(tab => tab.classList.toggle("active", tab.dataset.module === state.currentModule));
  qsa(".module-panel").forEach(panel => panel.classList.remove("visible"));
  byId(`module-${state.currentModule}`).classList.add("visible");
  if (state.currentModule === "mortality") renderMortalityModule();
  if (state.currentModule === "age") renderAgeModule();
  if (state.currentModule === "hour") renderHourModule();
  if (state.currentModule === "context") renderContextModule();
}

function getDoctorDeathRecords(doctor) {
  return deaths.filter(d => d.doctor_id === doctor);
}

function getRestDeathRecords(doctor) {
  return deaths.filter(d => d.doctor_id !== doctor);
}

function ageBin(age) {
  if (age < 70) return "<70";
  if (age < 75) return "70–74";
  if (age < 80) return "75–79";
  if (age < 85) return "80–84";
  if (age < 90) return "85–89";
  return "90+";
}

function distribution(records, mapper, orderedKeys) {
  const bins = Object.fromEntries(orderedKeys.map(key => [key, 0]));
  records.forEach(row => { bins[mapper(row)] += 1; });
  const n = records.length || 1;
  return Object.fromEntries(orderedKeys.map(key => [key, +(100 * bins[key] / n).toFixed(1)]));
}

function quantile(sortedArr, q) {
  if (!sortedArr.length) return 0;
  const pos = (sortedArr.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const next = sortedArr[base + 1] !== undefined ? sortedArr[base + 1] : sortedArr[base];
  return sortedArr[base] + rest * (next - sortedArr[base]);
}

function median(arr) {
  return quantile([...arr].sort((a, b) => a - b), 0.5);
}

function iqr(arr) {
  const sorted = [...arr].sort((a, b) => a - b);
  return [quantile(sorted, 0.25), quantile(sorted, 0.75)];
}

function renderAgeModule() {
  const doctor = byId("doctorSelectAge").value;
  const insight = byId("ageInsight");
  const addBtn = byId("addAgeEvidenceBtn");
  if (!doctor) {
    addBtn.disabled = true;
    if (ageChart) ageChart.destroy();
    insight.innerHTML = `<div class="placeholder-box">Selecciona un médico para ver cómo se distribuyen las edades y cómo leer mediana e IQR frente al resto.</div>`;
    return;
  }
  const own = getDoctorDeathRecords(doctor);
  const rest = getRestDeathRecords(doctor);
  const ownAges = own.map(r => r.patient_age);
  const restAges = rest.map(r => r.patient_age);
  const labels = ["<70", "70–74", "75–79", "80–84", "85–89", "90+"];
  const ownDist = distribution(own, row => ageBin(row.patient_age), labels);
  const restDist = distribution(rest, row => ageBin(row.patient_age), labels);

  if (ageChart) ageChart.destroy();
  ageChart = new Chart(byId("ageChart"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: doctor, data: labels.map(l => ownDist[l]), backgroundColor: "rgba(147,240,200,.82)", borderRadius: 8 },
        { label: "Resto", data: labels.map(l => restDist[l]), backgroundColor: "rgba(138,182,255,.74)", borderRadius: 8 }
      ]
    },
    options: comparativeBarOptions("%")
  });

  const ownMedian = median(ownAges);
  const restMedian = median(restAges);
  const [ownQ1, ownQ3] = iqr(ownAges);
  const [restQ1, restQ3] = iqr(restAges);
  insight.innerHTML = `
    <div class="stat-item">Edad mediana (${doctor})<strong>${ownMedian.toFixed(1)} años</strong></div>
    <div class="stat-item">Edad mediana (resto)<strong>${restMedian.toFixed(1)} años</strong></div>
    <div class="stat-item">IQR ${doctor}<strong>${ownQ1.toFixed(1)} – ${ownQ3.toFixed(1)}</strong></div>
    <div class="stat-item">IQR resto<strong>${restQ1.toFixed(1)} – ${restQ3.toFixed(1)}</strong></div>
    <div class="stat-item">Cómo leerlo<strong>Compara mediana e IQR para valorar si el perfil etario de los fallecidos del médico se parece o no al del resto.</strong></div>
  `;
  addBtn.disabled = false;
}

function getHourLabel(hour) {
  if (hour < 6) return "00–05";
  if (hour < 12) return "06–11";
  if (hour < 16) return "12–15";
  if (hour < 20) return "16–19";
  return "20–23";
}

function renderHourModule() {
  const doctor = byId("doctorSelectHour").value;
  const insight = byId("hourInsight");
  const addBtn = byId("addHourEvidenceBtn");
  if (!doctor) {
    addBtn.disabled = true;
    if (hourChart) hourChart.destroy();
    insight.innerHTML = `<div class="placeholder-box">Selecciona un médico para ver cómo se reparte la hora del fallecimiento por franjas frente al resto del sistema.</div>`;
    return;
  }
  const own = getDoctorDeathRecords(doctor);
  const rest = getRestDeathRecords(doctor);
  const labels = ["00–05", "06–11", "12–15", "16–19", "20–23"];
  const ownDist = distribution(own, row => getHourLabel(row.hour_of_death), labels);
  const restDist = distribution(rest, row => getHourLabel(row.hour_of_death), labels);

  if (hourChart) hourChart.destroy();
  hourChart = new Chart(byId("hourChart"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: doctor, data: labels.map(l => ownDist[l]), backgroundColor: "rgba(147,240,200,.82)", borderRadius: 8 },
        { label: "Resto", data: labels.map(l => restDist[l]), backgroundColor: "rgba(138,182,255,.74)", borderRadius: 8 }
      ]
    },
    options: comparativeBarOptions("%")
  });

  const ownMid = proportion(own, r => r.hour_of_death >= 12 && r.hour_of_death < 16);
  const restMid = proportion(rest, r => r.hour_of_death >= 12 && r.hour_of_death < 16);
  insight.innerHTML = `
    <div class="stat-item">Muertes registradas en ${doctor}<strong>${own.length}</strong></div>
    <div class="stat-item">Franja 12:00–15:59 (${doctor})<strong>${formatPct(ownMid)}</strong></div>
    <div class="stat-item">Franja 12:00–15:59 (resto)<strong>${formatPct(restMid)}</strong></div>
    <div class="stat-item">Diferencia observada<strong>${((ownMid - restMid) * 100).toFixed(1)} puntos</strong></div>
    <div class="stat-item">Cómo leerlo<strong>Esta vista compara proporciones por franja horaria. Fíjate en si una franja concentra una parte inusual de los casos respecto al resto.</strong></div>
  `;
  addBtn.disabled = false;
}

function contextSummary(records) {
  return {
    homeVisit: proportion(records, r => Number(r.home_visit_same_day) === 1),
    homeDeath: proportion(records, r => r.place_of_death === "home"),
    hospitalDeath: proportion(records, r => r.place_of_death === "hospital")
  };
}

function renderContextModule() {
  const doctor = byId("doctorSelectContext").value;
  const insight = byId("contextInsight");
  const addBtn = byId("addContextEvidenceBtn");
  if (!doctor) {
    addBtn.disabled = true;
    if (contextChart) contextChart.destroy();
    insight.innerHTML = `<div class="placeholder-box">Selecciona un médico para comparar contexto operativo: visita domiciliaria y lugar del fallecimiento.</div>`;
    return;
  }
  const own = contextSummary(getDoctorDeathRecords(doctor));
  const rest = contextSummary(getRestDeathRecords(doctor));
  const labels = ["Visita domiciliaria", "Muerte en domicilio", "Muerte en hospital"];
  const ownData = [own.homeVisit, own.homeDeath, own.hospitalDeath].map(v => +(100 * v).toFixed(1));
  const restData = [rest.homeVisit, rest.homeDeath, rest.hospitalDeath].map(v => +(100 * v).toFixed(1));

  if (contextChart) contextChart.destroy();
  contextChart = new Chart(byId("contextChart"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: doctor, data: ownData, backgroundColor: "rgba(147,240,200,.82)", borderRadius: 8 },
        { label: "Resto", data: restData, backgroundColor: "rgba(138,182,255,.74)", borderRadius: 8 }
      ]
    },
    options: comparativeBarOptions("%")
  });

  insight.innerHTML = `
    <div class="stat-item">Visita domiciliaria (${doctor})<strong>${formatPct(own.homeVisit)}</strong></div>
    <div class="stat-item">Visita domiciliaria (resto)<strong>${formatPct(rest.homeVisit)}</strong></div>
    <div class="stat-item">Muerte en domicilio (${doctor})<strong>${formatPct(own.homeDeath)}</strong></div>
    <div class="stat-item">Muerte en domicilio (resto)<strong>${formatPct(rest.homeDeath)}</strong></div>
    <div class="stat-item">Cómo leerlo<strong>Estas proporciones describen el contexto de los casos. Compáralas con el resto para valorar si el patrón operativo es parecido o diferente.</strong></div>
  `;
  addBtn.disabled = false;
}

function addMortalityEvidence() {
  const rates = summary.map(item => item.mortality_rate);
  const avg = rates.reduce((a, b) => a + b, 0) / rates.length;
  const medianRate = [...rates].sort((a, b) => a - b)[Math.floor(rates.length / 2)];
  upsertEvidence({
    id: "mortality-overview",
    title: "Tasa bruta: panorama general",
    summary: `Las tasas brutas del sistema oscilan entre ${formatPct(Math.min(...rates))} y ${formatPct(Math.max(...rates))}, con una media aproximada de ${formatPct(avg)} y una mediana de ${formatPct(medianRate)}. Esta evidencia sirve para contextualizar frecuencias globales antes de pasar a variables más específicas.` ,
    strength: "medium",
    kind: "mortality",
    kindLabel: "Descriptiva"
  });
  byId("mortalityFeedback").textContent = "Resumen descriptivo añadido al expediente.";
  announce("Evidencia descriptiva incorporada al expediente.");
}

function addAgeEvidence() {
  const doctor = byId("doctorSelectAge").value;
  if (!doctor) return;
  const ownAges = getDoctorDeathRecords(doctor).map(r => r.patient_age);
  const restAges = getRestDeathRecords(doctor).map(r => r.patient_age);
  const ownMedian = median(ownAges);
  const restMedian = median(restAges);
  const [q1, q3] = iqr(ownAges);
  upsertEvidence({
    id: `age-${doctor}`,
    title: `Edad de fallecidos: ${doctor}`,
    doctor,
    summary: `En ${doctor}, la edad mediana de los fallecidos es ${ownMedian.toFixed(1)} años (resto: ${restMedian.toFixed(1)}). El IQR del médico va de ${q1.toFixed(1)} a ${q3.toFixed(1)} años.` ,
    strength: "weak",
    kind: "age",
    kindLabel: "Edad"
  });
  byId("ageFeedback").textContent = `Hallazgo de edad añadido para ${doctor}.`;
  announce(`Evidencia de edad incorporada para ${doctor}.`);
}

function addHourEvidence() {
  const doctor = byId("doctorSelectHour").value;
  if (!doctor) return;
  const own = getDoctorDeathRecords(doctor);
  const rest = getRestDeathRecords(doctor);
  const ownMid = proportion(own, r => r.hour_of_death >= 12 && r.hour_of_death < 16);
  const restMid = proportion(rest, r => r.hour_of_death >= 12 && r.hour_of_death < 16);
  const diff = ownMid - restMid;
  upsertEvidence({
    id: `hour-${doctor}`,
    title: `Patrón horario: ${doctor}`,
    doctor,
    summary: `${doctor} registra ${formatPct(ownMid)} de muertes entre 12:00 y 15:59 frente a ${formatPct(restMid)} en el resto. La diferencia observada es de ${(diff * 100).toFixed(1)} puntos.` ,
    strength: "medium",
    kind: "hour",
    kindLabel: "Horario"
  });
  byId("hourFeedback").textContent = `Hallazgo horario añadido para ${doctor}.`;
  announce(`Evidencia horaria incorporada para ${doctor}.`);
}

function addContextEvidence() {
  const doctor = byId("doctorSelectContext").value;
  if (!doctor) return;
  const own = contextSummary(getDoctorDeathRecords(doctor));
  const rest = contextSummary(getRestDeathRecords(doctor));
  upsertEvidence({
    id: `context-${doctor}`,
    title: `Visitas y lugar: ${doctor}`,
    doctor,
    summary: `${doctor} registra ${formatPct(own.homeVisit)} de visitas domiciliarias el mismo día frente a ${formatPct(rest.homeVisit)} en el resto. El porcentaje de muertes en domicilio es ${formatPct(own.homeDeath)} frente a ${formatPct(rest.homeDeath)}.` ,
    strength: "medium",
    kind: "context",
    kindLabel: "Contexto"
  });
  byId("contextFeedback").textContent = `Hallazgo contextual añadido para ${doctor}.`;
  announce(`Evidencia contextual incorporada para ${doctor}.`);
}

function baseBarOptions(suffix = "") {
  return {
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: ctx => suffix ? `${ctx.raw.toFixed(1)}${suffix}` : ctx.raw } }
    },
    scales: {
      x: { ticks: { color: "#d7e0f2" }, grid: { display: false } },
      y: { ticks: { color: "#d7e0f2", callback: value => suffix ? `${value}${suffix}` : value }, grid: { color: "rgba(255,255,255,.08)" } }
    }
  };
}

function comparativeBarOptions(suffix = "") {
  return {
    plugins: { legend: { labels: { color: "#eaf0ff" } } },
    scales: {
      x: { ticks: { color: "#d7e0f2", maxRotation: 0, minRotation: 0 }, grid: { display: false } },
      y: { ticks: { color: "#d7e0f2", callback: value => suffix ? `${value}${suffix}` : value }, grid: { color: "rgba(255,255,255,.08)" } }
    }
  };
}

function proportion(records, predicate) {
  if (!records.length) return 0;
  return records.filter(predicate).length / records.length;
}

function formatPct(value) {
  return `${(100 * value).toFixed(1)}%`;
}

function formatP(p) {
  if (p < 0.0001) return "< 0.0001";
  return p.toFixed(4);
}

function getPredicate(indicator) {
  if (indicator === "midday") return row => row.hour_of_death >= 12 && row.hour_of_death < 16;
  if (indicator === "home_visit") return row => Number(row.home_visit_same_day) === 1;
  return row => row.place_of_death === "home";
}

function indicatorLabel(indicator) {
  return {
    midday: "muertes entre 12:00 y 15:59",
    home_visit: "visitas domiciliarias el mismo día",
    home_death: "fallecimientos en domicilio"
  }[indicator];
}

function erf(x) {
  const sign = x >= 0 ? 1 : -1;
  x = Math.abs(x);
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return sign * y;
}

function normalCdf(x) {
  return 0.5 * (1 + erf(x / Math.sqrt(2)));
}

function zTestTwoProp(x1, n1, x2, n2) {
  const pPool = (x1 + x2) / (n1 + n2);
  const se = Math.sqrt(pPool * (1 - pPool) * (1 / n1 + 1 / n2));
  const z = se ? (x1 / n1 - x2 / n2) / se : 0;
  const p = 2 * (1 - normalCdf(Math.abs(z)));
  return { z, p };
}

function wilsonCI(x, n, z = 1.96) {
  const p = x / n;
  const denom = 1 + z * z / n;
  const center = (p + z * z / (2 * n)) / denom;
  const margin = (z * Math.sqrt((p * (1 - p) + z * z / (4 * n)) / n)) / denom;
  return { low: Math.max(0, center - margin), high: Math.min(1, center + margin) };
}

function chiSquare2x2(a, b, c, d) {
  const n = a + b + c + d;
  const numerator = n * Math.pow(a * d - b * c, 2);
  const denominator = (a + b) * (c + d) * (a + c) * (b + d);
  const chi2 = denominator ? numerator / denominator : 0;
  const p = 1 - erf(Math.sqrt(chi2 / 2));
  return { chi2, p };
}

function effectNarrative(diff, p) {
  const direction = diff > 0 ? "la proporción observada en el médico es mayor que en el resto" : (diff < 0 ? "la proporción observada en el médico es menor que en el resto" : "las proporciones observadas son iguales");
  return `En esta comparación, ${direction}. El p-valor indica hasta qué punto una diferencia de este tamaño sería compatible con la hipótesis nula de igualdad exacta de proporciones, suponiendo el modelo de contraste empleado.`;
}

function runSelectedTest() {
  const doctor = byId("doctorSelectTest").value;
  const indicator = byId("indicatorSelect").value;
  const resultsBox = byId("testResults");
  const tableBox = byId("contingencyTable");
  if (!doctor) {
    resultsBox.innerHTML = `<div class="placeholder-box">Selecciona un médico para ver el contraste.</div>`;
    tableBox.innerHTML = `<div class="placeholder-box">La tabla 2×2 aparecerá aquí junto con la formulación del contraste.</div>`;
    lastContrast = null;
    return;
  }

  const own = getDoctorDeathRecords(doctor);
  const rest = getRestDeathRecords(doctor);
  const predicate = getPredicate(indicator);
  const a = own.filter(predicate).length;
  const b = own.length - a;
  const c = rest.filter(predicate).length;
  const d = rest.length - c;
  const p1 = a / own.length;
  const p2 = c / rest.length;
  const diff = p1 - p2;
  const z = zTestTwoProp(a, own.length, c, rest.length);
  const ci1 = wilsonCI(a, own.length);
  const ci2 = wilsonCI(c, rest.length);
  const oddsRatio = (a * d) / Math.max(1, b * c);
  const narrative = effectNarrative(diff, z.p);

  resultsBox.innerHTML = `
    <div class="metric-grid">
      <div class="metric">
        <div class="metric-label">${doctor}</div>
        <div class="metric-value">${formatPct(p1)}</div>
        <div class="tiny-note">IC 95%: ${formatPct(ci1.low)} – ${formatPct(ci1.high)}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Resto del sistema</div>
        <div class="metric-value">${formatPct(p2)}</div>
        <div class="tiny-note">IC 95%: ${formatPct(ci2.low)} – ${formatPct(ci2.high)}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Diferencia de proporciones</div>
        <div class="metric-value">${(diff * 100).toFixed(1)} puntos</div>
        <div class="tiny-note">Es la resta entre proporciones: médico − resto.</div>
      </div>
      <div class="metric">
        <div class="metric-label">Odds ratio</div>
        <div class="metric-value">${oddsRatio.toFixed(2)}</div>
        <div class="tiny-note">Compara las odds de presencia de la señal en ambos grupos.</div>
      </div>
      <div class="metric">
        <div class="metric-label">Prueba z (2 proporciones)</div>
        <div class="metric-value">p = ${formatP(z.p)}</div>
        <div class="tiny-note">z = ${z.z.toFixed(2)} · Contrasta igualdad de proporciones</div>
      </div>
    </div>
    <p class="note">${narrative}</p>
    <p class="note">Lectura minima: el porcentaje describe la magnitud observada; el intervalo de confianza resume precision; el p-valor responde a la compatibilidad con la hipótesis nula; y la conclusión requiere integrar este resultado con el resto del expediente.</p>
  `;

  tableBox.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th></th><th>Señal presente</th><th>Señal ausente</th><th>Total</th></tr>
        </thead>
        <tbody>
          <tr><td>${doctor}</td><td>${a}</td><td>${b}</td><td>${own.length}</td></tr>
          <tr><td>Resto</td><td>${c}</td><td>${d}</td><td>${rest.length}</td></tr>
        </tbody>
      </table>
    </div>
    <p class="tiny-note">Hipótesis nula (H0): la proporción de ${indicatorLabel(indicator)} es la misma en ${doctor} y en el resto del sistema. Hipótesis alternativa (H1): ambas proporciones difieren.</p>
  `;

  lastContrast = {
    id: `contrast-${doctor}-${indicator}`,
    doctor,
    indicator,
    summary: `Contraste para ${indicatorLabel(indicator)}: ${doctor} muestra ${formatPct(p1)} frente a ${formatPct(p2)} en el resto, con diferencia de ${(diff * 100).toFixed(1)} puntos, p(z) = ${formatP(z.p)} y OR ≈ ${oddsRatio.toFixed(2)}.`,
    strength: Math.abs(diff) >= 0.20 && z.p < 0.01 ? "strong" : (z.p < 0.05 ? "medium" : "weak")
  };
}

function addContrastEvidence() {
  if (!lastContrast) {
    byId("contrastFeedback").textContent = "Selecciona primero un medico y un indicador para que se construya la comparacion.";
    return;
  }
  upsertEvidence({
    id: lastContrast.id,
    title: `Contraste inferencial: ${lastContrast.doctor}`,
    doctor: lastContrast.doctor,
    summary: lastContrast.summary,
    strength: lastContrast.strength,
    kind: "contrast",
    kindLabel: "Inferencia"
  });
  state.contrastAdded = true;
  saveState();
  updateProgress();
  byId("contrastFeedback").textContent = "Contraste añadido al expediente.";
  announce(`Contraste inferencial incorporado para ${lastContrast.doctor}.`);
}

function renderDraftOutput() {
  byId("draftOutput").textContent = state.lastDraft || "Todavía no has generado el borrador final.";
}

function generateDraft() {
  const doctor = byId("finalDoctorSelect").value;
  const checked = qsa("#finalEvidenceChecklist input:checked").map(input => input.value);
  const reasoning = byId("reasoningArea").value.trim();
  const alternatives = byId("alternativeArea").value.trim();

  if (!doctor) {
    byId("finalFeedback").textContent = "Selecciona un médico prioritario antes de generar el borrador.";
    return;
  }
  if (checked.length < 2) {
    byId("finalFeedback").textContent = "Marca al menos dos evidencias del expediente para sostener el borrador.";
    return;
  }

  const chosenEvidences = state.evidences.filter(item => checked.includes(item.id));
  const lines = [];
  lines.push("OPERACIÓN HIPÓCRATES — BORRADOR DE INFORME");
  lines.push("");
  lines.push("Pregunta de investigación");
  lines.push("¿Existe algún médico cuyo patrón de mortalidad sea estadísticamente anómalo respecto al resto del sistema y justifique una alerta o investigación formal prioritaria?");
  lines.push("");
  lines.push(`Médico priorizado: ${doctor}`);
  lines.push("");
  lines.push("Evidencias seleccionadas");
  chosenEvidences.forEach(item => lines.push(`- ${item.title}: ${item.summary}`));
  lines.push("");
  lines.push("Justificación analítica");
  lines.push(reasoning || "[Redacta aquí tu argumento principal: qué variables pesan más y cómo integras descriptiva e inferencia.]");
  lines.push("");
  lines.push("Explicaciones alternativas y datos adicionales");
  lines.push(alternatives || "[Redacta aquí explicaciones alternativas plausibles y qué información adicional pedirías antes de una decisión formal.]");
  lines.push("");
  lines.push("Conclusión provisional");
  lines.push(`[Redacta aquí una conclusión prudente sobre ${doctor}. Debe indicar si la evidencia seleccionada justifica o no una alerta estadística y con qué cautelas.]`);
  if (state.notes.trim()) {
    lines.push("");
    lines.push("Notas del analista");
    lines.push(state.notes.trim());
  }

  state.lastDraft = lines.join("\n");
  state.finalGenerated = true;
  saveState();
  updateProgress();
  renderDraftOutput();
  byId("finalFeedback").textContent = "Borrador generado. Puedes copiarlo, editarlo y convertirlo a PDF fuera de la web.";
  announce("Borrador final generado correctamente.");
}

async function copyDraft() {
  if (!state.lastDraft) {
    byId("finalFeedback").textContent = "Genera antes el borrador para poder copiarlo.";
    return;
  }
  try {
    await navigator.clipboard.writeText(state.lastDraft);
    byId("finalFeedback").textContent = "Borrador copiado al portapapeles.";
  } catch {
    byId("finalFeedback").textContent = "No se pudo copiar automáticamente. Usa el botón de descarga si lo prefieres.";
  }
}

function downloadDraft() {
  if (!state.lastDraft) {
    byId("finalFeedback").textContent = "Genera antes el borrador para poder descargarlo.";
    return;
  }
  const blob = new Blob([state.lastDraft], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "operacion_hipocrates_borrador.txt";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  byId("finalFeedback").textContent = "Borrador descargado como archivo de texto.";
}
