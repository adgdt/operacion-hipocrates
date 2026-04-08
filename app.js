
const DATA = window.HIPPOCRATES_DATA;
const summary = [...DATA.summary];
const deaths = [...DATA.deaths];
const totalStages = 5;
const storageKey = "hipocrates-progress-v1";

const state = loadState();
let mortalityChart, hourChart, contextChart;

document.addEventListener("DOMContentLoaded", () => {
  fillSummaryTable();
  populateDoctorSelectors();
  renderMortalityChart();
  renderHourChart();
  renderContextChart();
  updateInsightsForHour();
  updateInsightsForContext();
  runSelectedTest();
  wireEvents();
  applyProgress();
  renderFinalRecommendation();
});

function loadState() {
  const fallback = { unlocked: 1, completed: {} };
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey));
    return parsed ? { unlocked: parsed.unlocked || 1, completed: parsed.completed || {} } : fallback;
  } catch {
    return fallback;
  }
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function wireEvents() {
  document.getElementById("startBtn").addEventListener("click", () => showStage(1));
  document.getElementById("resetBtn").addEventListener("click", resetProgress);

  document.querySelectorAll(".stage-link").forEach(btn => {
    btn.addEventListener("click", () => {
      const stage = Number(btn.dataset.stage);
      if (stage <= state.unlocked) showStage(stage);
    });
  });

  document.querySelectorAll(".answers").forEach(block => {
    block.addEventListener("click", event => {
      const btn = event.target.closest("button");
      if (!btn) return;
      const questionId = block.dataset.question;
      handleQuestionAnswer(questionId, btn, block);
    });
  });

  document.getElementById("doctorSelectHour").addEventListener("change", () => {
    renderHourChart();
    updateInsightsForHour();
  });

  document.getElementById("doctorSelectContext").addEventListener("change", () => {
    renderContextChart();
    updateInsightsForContext();
  });

  document.getElementById("doctorSelectTest").addEventListener("change", runSelectedTest);
  document.getElementById("indicatorSelect").addEventListener("change", runSelectedTest);
  document.getElementById("runTestBtn").addEventListener("click", runSelectedTest);
}

function resetProgress() {
  localStorage.removeItem(storageKey);
  state.unlocked = 1;
  state.completed = {};
  applyProgress();
  showStage(1);
  document.querySelectorAll(".answers button").forEach(btn => {
    btn.classList.remove("correct", "incorrect");
    btn.disabled = false;
  });
  document.querySelectorAll(".feedback").forEach(el => el.textContent = "");
}

function showStage(stage) {
  document.querySelectorAll(".stage-panel").forEach(panel => panel.classList.remove("visible"));
  document.querySelector(`#stage-${stage}`).classList.add("visible");
  document.querySelectorAll(".stage-link").forEach(link => link.classList.toggle("active", Number(link.dataset.stage) === stage));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function applyProgress() {
  document.querySelectorAll(".stage-link").forEach(link => {
    const stage = Number(link.dataset.stage);
    link.classList.toggle("locked", stage > state.unlocked);
    if (stage > state.unlocked) link.classList.remove("active");
  });
  const completedCount = Object.keys(state.completed).length;
  document.getElementById("progressFill").style.width = `${(completedCount / totalStages) * 100}%`;
  document.getElementById("progressText").textContent = `${completedCount} de ${totalStages} fases completadas`;
  const stageToShow = Math.min(state.unlocked, totalStages);
  showStage(stageToShow);
}

function fillSummaryTable() {
  const tbody = document.querySelector("#summaryTable tbody");
  const rows = [...summary].sort((a,b) => b.mortality_rate - a.mortality_rate);
  tbody.innerHTML = rows.map(row => `
    <tr>
      <td>${row.doctor_id}</td>
      <td>${row.patients}</td>
      <td>${row.deaths}</td>
      <td>${formatPct(row.mortality_rate)}</td>
      <td>${row.doctor_practice_type}</td>
    </tr>
  `).join("");
}

function populateDoctorSelectors() {
  const doctors = summary.map(d => d.doctor_id).sort();
  ["doctorSelectHour","doctorSelectContext","doctorSelectTest"].forEach(id => {
    const select = document.getElementById(id);
    select.innerHTML = doctors.map(doc => `<option value="${doc}" ${doc === "D13" ? "selected" : ""}>${doc}</option>`).join("");
  });
}

function renderMortalityChart() {
  const ordered = [...summary].sort((a,b) => b.mortality_rate - a.mortality_rate);
  const labels = ordered.map(d => d.doctor_id);
  const values = ordered.map(d => +(d.mortality_rate * 100).toFixed(2));
  const colors = ordered.map(d => d.doctor_id === "D13" ? "rgba(142,240,207,0.85)" : "rgba(110,168,254,0.75)");
  const ctx = document.getElementById("mortalityChart");
  if (mortalityChart) mortalityChart.destroy();
  mortalityChart = new Chart(ctx, {
    type: "bar",
    data: { labels, datasets: [{ data: values, backgroundColor: colors, borderRadius: 8 }] },
    options: {
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (context) => `${context.raw.toFixed(2)}%` } }
      },
      scales: {
        x: { ticks: { color: "#d7e0f2" }, grid: { display: false } },
        y: {
          ticks: { color: "#d7e0f2", callback: (value) => `${value}%` },
          grid: { color: "rgba(255,255,255,.08)" }
        }
      }
    }
  });
}

function getHourLabel(hour) {
  if (hour < 6) return "00-05";
  if (hour < 12) return "06-11";
  if (hour < 16) return "12-15";
  if (hour < 20) return "16-19";
  return "20-23";
}

function getDoctorDeathRecords(doctor) {
  return deaths.filter(d => d.doctor_id === doctor);
}

function getRestDeathRecords(doctor) {
  return deaths.filter(d => d.doctor_id !== doctor);
}

function hourDistribution(records) {
  const bins = { "00-05":0, "06-11":0, "12-15":0, "16-19":0, "20-23":0 };
  records.forEach(r => bins[getHourLabel(r.hour_of_death)]++);
  const n = records.length || 1;
  return Object.fromEntries(Object.entries(bins).map(([k,v]) => [k, +(v/n*100).toFixed(1)]));
}

function renderHourChart() {
  const doctor = document.getElementById("doctorSelectHour").value;
  const own = hourDistribution(getDoctorDeathRecords(doctor));
  const rest = hourDistribution(getRestDeathRecords(doctor));
  const labels = Object.keys(own);
  const ctx = document.getElementById("hourChart");
  if (hourChart) hourChart.destroy();
  hourChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: `${doctor}`, data: labels.map(l => own[l]), backgroundColor: "rgba(142,240,207,.82)", borderRadius: 8 },
        { label: "Resto", data: labels.map(l => rest[l]), backgroundColor: "rgba(110,168,254,.7)", borderRadius: 8 }
      ]
    },
    options: {
      plugins:{ legend:{ labels:{ color:"#eaf0ff"} } },
      scales:{
        x:{ ticks:{ color:"#d7e0f2" }, grid:{ display:false } },
        y:{ ticks:{ color:"#d7e0f2", callback:v => `${v}%` }, grid:{ color:"rgba(255,255,255,.08)" } }
      }
    }
  });
}

function updateInsightsForHour() {
  const doctor = document.getElementById("doctorSelectHour").value;
  const own = getDoctorDeathRecords(doctor);
  const rest = getRestDeathRecords(doctor);
  const ownMid = proportion(own, r => r.hour_of_death >= 12 && r.hour_of_death < 16);
  const restMid = proportion(rest, r => r.hour_of_death >= 12 && r.hour_of_death < 16);
  const box = document.getElementById("hourInsight");
  box.innerHTML = `
    <div class="stat-item">Muertes del médico seleccionado<strong>${own.length}</strong></div>
    <div class="stat-item">Franja 12:00–15:59 en ${doctor}<strong>${formatPct(ownMid)}</strong></div>
    <div class="stat-item">Franja 12:00–15:59 en el resto<strong>${formatPct(restMid)}</strong></div>
  `;
}

function contextSummary(records) {
  return {
    homeVisit: proportion(records, r => Number(r.home_visit_same_day) === 1),
    homeDeath: proportion(records, r => r.place_of_death === "home"),
    hospitalDeath: proportion(records, r => r.place_of_death === "hospital")
  };
}

function renderContextChart() {
  const doctor = document.getElementById("doctorSelectContext").value;
  const own = contextSummary(getDoctorDeathRecords(doctor));
  const rest = contextSummary(getRestDeathRecords(doctor));
  const labels = ["Visita domiciliaria el mismo día", "Fallecimiento en domicilio", "Fallecimiento en hospital"];
  const ownData = [own.homeVisit, own.homeDeath, own.hospitalDeath].map(x => +(x*100).toFixed(1));
  const restData = [rest.homeVisit, rest.homeDeath, rest.hospitalDeath].map(x => +(x*100).toFixed(1));
  const ctx = document.getElementById("contextChart");
  if (contextChart) contextChart.destroy();
  contextChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: doctor, data: ownData, backgroundColor: "rgba(142,240,207,.82)", borderRadius: 8 },
        { label: "Resto", data: restData, backgroundColor: "rgba(110,168,254,.7)", borderRadius: 8 }
      ]
    },
    options: {
      plugins:{ legend:{ labels:{ color:"#eaf0ff"} } },
      scales:{
        x:{ ticks:{ color:"#d7e0f2", maxRotation:0, minRotation:0 }, grid:{ display:false } },
        y:{ ticks:{ color:"#d7e0f2", callback:v => `${v}%` }, grid:{ color:"rgba(255,255,255,.08)" } }
      }
    }
  });
}

function updateInsightsForContext() {
  const doctor = document.getElementById("doctorSelectContext").value;
  const own = contextSummary(getDoctorDeathRecords(doctor));
  const rest = contextSummary(getRestDeathRecords(doctor));
  const box = document.getElementById("contextInsight");
  box.innerHTML = `
    <div class="stat-item">Visita domiciliaria en ${doctor}<strong>${formatPct(own.homeVisit)}</strong></div>
    <div class="stat-item">Visita domiciliaria en el resto<strong>${formatPct(rest.homeVisit)}</strong></div>
    <div class="stat-item">Fallecimiento en domicilio (${doctor})<strong>${formatPct(own.homeDeath)}</strong></div>
  `;
}

function proportion(records, predicate) {
  if (!records.length) return 0;
  return records.filter(predicate).length / records.length;
}

function formatPct(value) {
  return `${(value*100).toFixed(1)}%`;
}

function formatP(p) {
  if (p < 0.0001) return "< 0.0001";
  return p.toFixed(4);
}

function runSelectedTest() {
  const doctor = document.getElementById("doctorSelectTest").value;
  const indicator = document.getElementById("indicatorSelect").value;
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
  const or = (a * d) / Math.max(1, (b * c));
  const z = zTestTwoProp(a, own.length, c, rest.length);
  const ci1 = wilsonCI(a, own.length);
  const ci2 = wilsonCI(c, rest.length);

  document.getElementById("testResults").innerHTML = `
    <div class="metric-grid">
      <div class="metric">
        <div class="metric-label">${doctor}</div>
        <div class="metric-value">${formatPct(p1)}</div>
        <div class="note">IC 95%: ${formatPct(ci1.low)} – ${formatPct(ci1.high)}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Resto del sistema</div>
        <div class="metric-value">${formatPct(p2)}</div>
        <div class="note">IC 95%: ${formatPct(ci2.low)} – ${formatPct(ci2.high)}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Diferencia de proporciones</div>
        <div class="metric-value">${(diff*100).toFixed(1)} puntos</div>
        <div class="note">La magnitud importa tanto como el p-valor.</div>
      </div>
      <div class="metric">
        <div class="metric-label">Prueba z (2 proporciones)</div>
        <div class="metric-value">p = ${formatP(z.p)}</div>
        <div class="note">Estadístico z = ${z.z.toFixed(2)} · OR ≈ ${or.toFixed(2)}</div>
      </div>
    </div>
    <p class="note">${interpretIndicator(indicator, doctor, p1, p2, z.p)}</p>
  `;

  document.getElementById("contingencyTable").innerHTML = `
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
  `;
}

function interpretIndicator(indicator, doctor, p1, p2, pvalue) {
  const labelMap = {
    midday: "la concentración de muertes entre 12:00 y 15:59",
    home_visit: "las visitas domiciliarias el mismo día",
    home_death: "los fallecimientos en domicilio"
  };
  const strength = pvalue < 0.01 ? "fuerte" : (pvalue < 0.05 ? "moderada" : "débil");
  return `Para ${doctor}, ${labelMap[indicator]} muestra una señal ${strength}: ${formatPct(p1)} frente a ${formatPct(p2)} en el resto. Esto apoya una alerta estadística, pero sigue sin demostrar causalidad.`;
}

function getPredicate(indicator) {
  if (indicator === "midday") return r => r.hour_of_death >= 12 && r.hour_of_death < 16;
  if (indicator === "home_visit") return r => Number(r.home_visit_same_day) === 1;
  return r => r.place_of_death === "home";
}

function normalCdf(x) {
  return 0.5 * (1 + erf(x / Math.sqrt(2)));
}

function erf(x) {
  const sign = x >= 0 ? 1 : -1;
  x = Math.abs(x);
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return sign * y;
}

function zTestTwoProp(x1, n1, x2, n2) {
  const pPool = (x1 + x2) / (n1 + n2);
  const se = Math.sqrt(pPool * (1 - pPool) * (1/n1 + 1/n2));
  const z = se ? (x1/n1 - x2/n2) / se : 0;
  const p = 2 * (1 - normalCdf(Math.abs(z)));
  return { z, p };
}

function wilsonCI(x, n, z=1.96) {
  const p = x / n;
  const denom = 1 + z*z/n;
  const center = (p + z*z/(2*n)) / denom;
  const margin = (z * Math.sqrt((p*(1-p) + z*z/(4*n)) / n)) / denom;
  return { low: Math.max(0, center - margin), high: Math.min(1, center + margin) };
}

function handleQuestionAnswer(questionId, btn, block) {
  const feedback = document.getElementById(`feedback-${questionId}`);
  const isCorrect = btn.dataset.correct === "true";

  block.querySelectorAll("button").forEach(b => {
    b.disabled = true;
    if (b === btn) b.classList.add(isCorrect ? "correct" : "incorrect");
    if (b.dataset.correct === "true") b.classList.add("correct");
  });

  if (isCorrect) {
    feedback.textContent = correctMessage(questionId);
    const stage = Number(questionId.replace("q", ""));
    state.completed[`stage${stage}`] = true;
    state.unlocked = Math.max(state.unlocked, Math.min(totalStages, stage + 1));
    saveState();
    applyProgress();
    if (stage < totalStages) {
      setTimeout(() => showStage(stage + 1), 900);
    }
  } else {
    feedback.textContent = incorrectMessage(questionId);
  }
}

function correctMessage(questionId) {
  const messages = {
    q1: "Correcto. La tasa bruta sirve para priorizar revisión, pero no basta para acusar.",
    q2: "Correcto. D13 concentra una proporción excepcional de muertes en la franja central del día.",
    q3: "Correcto. La visita domiciliaria el mismo día refuerza el patrón y no parece una simple casualidad.",
    q4: "Correcto. Una señal fuerte apoya la alerta, no una conclusión causal definitiva.",
    q5: "Correcto. D13 es el mejor candidato para una investigación formal prioritaria."
  };
  return messages[questionId];
}

function incorrectMessage(questionId) {
  const messages = {
    q1: "No del todo. La tasa más alta orienta, pero no permite saltar de anomalía a culpabilidad.",
    q2: "Revisa la comparación horaria: hay un médico con una concentración mucho más marcada en 12:00–15:59.",
    q3: "Revisa el gráfico contextual: la variable más potente no es demográfica, sino operacional.",
    q4: "Cuidado: p pequeño no equivale a prueba de culpabilidad. Sigue haciendo falta interpretación prudente.",
    q5: "Revisa el conjunto de evidencias: la alerta más consistente no depende solo de la tasa bruta."
  };
  return messages[questionId];
}

function renderFinalRecommendation() {
  const d13 = getDoctorDeathRecords("D13");
  const rest = getRestDeathRecords("D13");
  const midday = zTestTwoProp(
    d13.filter(r => r.hour_of_death >= 12 && r.hour_of_death < 16).length, d13.length,
    rest.filter(r => r.hour_of_death >= 12 && r.hour_of_death < 16).length, rest.length
  );
  const homeVisit = zTestTwoProp(
    d13.filter(r => Number(r.home_visit_same_day) === 1).length, d13.length,
    rest.filter(r => Number(r.home_visit_same_day) === 1).length, rest.length
  );
  document.getElementById("finalRecommendation").innerHTML = `
    <p><strong>Conclusión sugerida:</strong> D13 presenta el patrón estadísticamente más anómalo del sistema y debería ser elevado a investigación formal prioritaria.</p>
    <p>La alerta no se apoya solo en la tasa bruta de mortalidad, sino en un <strong>patrón consistente de anomalías</strong>:</p>
    <ul>
      <li>tasa de mortalidad bruta alta, pero no tan extrema como para cerrar el caso por sí sola;</li>
      <li>concentración muy elevada de muertes entre 12:00 y 15:59 (p = ${formatP(midday.p)});</li>
      <li>proporción muy alta de visitas domiciliarias el mismo día (p = ${formatP(homeVisit.p)}).</li>
    </ul>
    <p>El informe final debe insistir en que esto <strong>justifica investigar</strong>, no atribuir culpabilidad.</p>
  `;
}
