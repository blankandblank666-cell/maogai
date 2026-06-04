const questions = Array.isArray(window.MAOGAI_QUESTIONS) ? window.MAOGAI_QUESTIONS : [];

const STORAGE_KEY = "maogai-quiz-state-v2";
const LEGACY_STORAGE_KEY = "maogai-quiz-state-v1";
const AUTO_NEXT_DELAY_MS = 650;
const typeNames = {
  single: "单选",
  multiple: "多选",
  judge: "判断",
};

const els = {
  totalCount: document.querySelector("#totalCount"),
  doneCount: document.querySelector("#doneCount"),
  wrongCount: document.querySelector("#wrongCount"),
  modeSelect: document.querySelector("#modeSelect"),
  unitSelect: document.querySelector("#unitSelect"),
  typeSelect: document.querySelector("#typeSelect"),
  shuffleBtn: document.querySelector("#shuffleBtn"),
  resetBtn: document.querySelector("#resetBtn"),
  questionIndex: document.querySelector("#questionIndex"),
  questionTags: document.querySelector("#questionTags"),
  questionStem: document.querySelector("#questionStem"),
  answerForm: document.querySelector("#answerForm"),
  feedback: document.querySelector("#feedback"),
  submitBtn: document.querySelector("#submitBtn"),
  nextBtn: document.querySelector("#nextBtn"),
  wrongBookCount: document.querySelector("#wrongBookCount"),
  wrongBookList: document.querySelector("#wrongBookList"),
  searchInput: document.querySelector("#searchInput"),
  questionList: document.querySelector("#questionList"),
};

let state = loadState();
let filtered = [];
let currentIndex = 0;
let submitted = false;
let autoNextTimer = null;

function loadState() {
  const saved = readSavedState(STORAGE_KEY) || readSavedState(LEGACY_STORAGE_KEY) || {};
  return {
    done: new Set(saved.done || []),
    wrong: new Set(saved.wrong || []),
    mistakes: saved.mistakes || {},
  };
}

function readSavedState(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}

function saveState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      done: [...state.done],
      wrong: [...state.wrong],
      mistakes: state.mistakes,
    }),
  );
}

function pruneState() {
  const validIds = new Set(questions.map((q) => q.id));
  state.done = new Set([...state.done].filter((id) => validIds.has(id)));
  state.wrong = new Set([...state.wrong].filter((id) => validIds.has(id)));
  state.mistakes = Object.fromEntries(Object.entries(state.mistakes).filter(([id]) => validIds.has(id)));
  saveState();
}

function normalizeUnit(unit) {
  return unit === null || unit === undefined ? "未分单元" : `第 ${unit} 单元`;
}

function fillUnitSelect() {
  const units = [...new Set(questions.map((q) => q.unit).filter((unit) => unit !== null && unit !== undefined))]
    .sort((a, b) => a - b);
  for (const unit of units) {
    const option = document.createElement("option");
    option.value = String(unit);
    option.textContent = `第 ${unit} 单元`;
    els.unitSelect.append(option);
  }
  if (questions.some((q) => q.unit === null || q.unit === undefined)) {
    const option = document.createElement("option");
    option.value = "unknown";
    option.textContent = "未分单元";
    els.unitSelect.append(option);
  }
}

function applyFilters(keepCurrent = false) {
  clearAutoNext();
  const previousId = filtered[currentIndex]?.id;
  const mode = els.modeSelect.value;
  const unit = els.unitSelect.value;
  const type = els.typeSelect.value;

  filtered = questions.filter((q) => {
    if (mode === "wrong" && !state.wrong.has(q.id)) return false;
    if (type !== "all" && q.type !== type) return false;
    if (unit !== "all") {
      if (unit === "unknown" && q.unit !== null && q.unit !== undefined) return false;
      if (unit !== "unknown" && String(q.unit) !== unit) return false;
    }
    return true;
  });

  currentIndex = 0;
  if (keepCurrent && previousId) {
    const nextIndex = filtered.findIndex((q) => q.id === previousId);
    currentIndex = nextIndex >= 0 ? nextIndex : 0;
  }
  submitted = false;
  render();
}

function currentQuestion() {
  return filtered[currentIndex];
}

function renderStats() {
  els.totalCount.textContent = questions.length;
  els.doneCount.textContent = state.done.size;
  els.wrongCount.textContent = state.wrong.size;
}

function renderQuestion() {
  const q = currentQuestion();
  els.answerForm.innerHTML = "";
  els.feedback.hidden = true;
  els.feedback.className = "feedback";

  if (!q) {
    els.questionIndex.textContent = "第 0 / 0 题";
    els.questionTags.textContent = "";
    els.questionStem.textContent = els.modeSelect.value === "wrong" ? "当前没有错题。" : "当前筛选条件下没有题目。";
    els.submitBtn.disabled = true;
    els.nextBtn.disabled = true;
    return;
  }

  els.submitBtn.disabled = false;
  els.nextBtn.disabled = filtered.length <= 1;
  els.questionIndex.textContent = `第 ${currentIndex + 1} / ${filtered.length} 题`;
  els.questionTags.textContent = `${normalizeUnit(q.unit)} · ${typeNames[q.type] || q.type} · ${q.source}`;
  els.questionStem.textContent = q.stem;

  for (const [label, text] of Object.entries(q.options)) {
    const row = document.createElement("label");
    row.className = "option";
    row.dataset.option = label;

    const input = document.createElement("input");
    input.type = q.type === "multiple" ? "checkbox" : "radio";
    input.name = "answer";
    input.value = label;

    const content = document.createElement("span");
    content.innerHTML = `<strong>${escapeHtml(label)}</strong>${escapeHtml(text)}`;

    row.append(input, content);
    els.answerForm.append(row);
  }
}

function renderWrongBook() {
  const wrongQuestions = [...state.wrong].map((id) => questions.find((q) => q.id === id)).filter(Boolean);
  els.wrongBookCount.textContent = `${wrongQuestions.length} 道`;
  els.wrongBookList.innerHTML = "";

  if (!wrongQuestions.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "还没有错题。答错后会自动记录在这里。";
    els.wrongBookList.append(empty);
    return;
  }

  for (const q of wrongQuestions) {
    const mistake = state.mistakes[q.id] || {};
    const selected = mistake.selected || [];
    const card = document.createElement("article");
    card.className = "wrongbook-item";
    card.innerHTML = `
      <div class="wrongbook-head">
        <span class="badge wrong">${typeNames[q.type]}</span>
        <small>${normalizeUnit(q.unit)} · 错 ${mistake.count || 1} 次</small>
      </div>
      <h3>${escapeHtml(q.stem)}</h3>
      <div class="answer-compare">
        <div>
          <span>错选</span>
          <p>${answerText(q, selected) || "暂无错选记录"}</p>
        </div>
        <div>
          <span>正确</span>
          <p>${answerText(q, q.answer)}</p>
        </div>
      </div>
      <button type="button" data-review="${q.id}">重刷这题</button>
    `;
    card.querySelector("button").addEventListener("click", () => reviewWrongQuestion(q.id));
    els.wrongBookList.append(card);
  }
}

function renderList() {
  const q = currentQuestion();
  const term = els.searchInput.value.trim().toLowerCase();
  const pool = filtered.filter((item) => {
    if (!term) return true;
    const haystack = `${item.stem} ${Object.values(item.options).join(" ")}`.toLowerCase();
    return haystack.includes(term);
  });

  els.questionList.innerHTML = "";
  if (!pool.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "没有匹配的题目。";
    els.questionList.append(empty);
    return;
  }

  for (const item of pool) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `list-item${q?.id === item.id ? " current" : ""}`;
    button.innerHTML = `
      <span class="badge${state.wrong.has(item.id) ? " wrong" : ""}">${typeNames[item.type]}</span>
      <span>${escapeHtml(item.stem)}</span>
      <small>${normalizeUnit(item.unit)}</small>
    `;
    button.addEventListener("click", () => {
      currentIndex = filtered.findIndex((candidate) => candidate.id === item.id);
      submitted = false;
      render();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    els.questionList.append(button);
  }
}

function render() {
  renderStats();
  renderQuestion();
  renderWrongBook();
  renderList();
}

function selectedAnswers() {
  return [...els.answerForm.querySelectorAll("input:checked")].map((input) => input.value).sort(answerSort);
}

function submitAnswer() {
  const q = currentQuestion();
  if (!q || submitted) return;

  const selected = selectedAnswers();
  if (!selected.length) {
    els.feedback.hidden = false;
    els.feedback.className = "feedback bad";
    els.feedback.textContent = "先选一个答案再提交。";
    return;
  }

  const correct = arraysEqual(selected, q.answer);
  state.done.add(q.id);
  if (correct) {
    state.wrong.delete(q.id);
    delete state.mistakes[q.id];
  } else {
    const previous = state.mistakes[q.id];
    state.wrong.add(q.id);
    state.mistakes[q.id] = {
      selected,
      correct: q.answer,
      count: (previous?.count || 0) + 1,
      updatedAt: new Date().toISOString(),
    };
  }
  saveState();
  submitted = true;

  for (const row of els.answerForm.querySelectorAll(".option")) {
    const label = row.dataset.option;
    if (q.answer.includes(label)) row.classList.add("correct");
    if (selected.includes(label) && !q.answer.includes(label)) row.classList.add("wrong");
    row.querySelector("input").disabled = true;
  }

  els.feedback.hidden = false;
  els.feedback.className = `feedback ${correct ? "good" : "bad"}`;
  els.feedback.textContent = correct
    ? "答对了，已从错题本移除。"
    : `答错了，正确答案：${q.answer.join("、")}。已加入错题本。`;

  if (correct && els.modeSelect.value === "wrong") {
    filtered = filtered.filter((item) => item.id !== q.id);
    currentIndex = Math.min(currentIndex, Math.max(filtered.length - 1, 0));
    if (!filtered.length) {
      autoNextTimer = window.setTimeout(() => {
        submitted = false;
        render();
      }, AUTO_NEXT_DELAY_MS);
      return;
    }
    autoNextTimer = window.setTimeout(() => {
      submitted = false;
      render();
    }, AUTO_NEXT_DELAY_MS);
    return;
  }

  renderStats();
  renderWrongBook();
  renderList();

  if (correct && filtered.length > 1) {
    autoNextTimer = window.setTimeout(nextQuestion, AUTO_NEXT_DELAY_MS);
  }
}

function nextQuestion() {
  clearAutoNext();
  if (!filtered.length) return;
  currentIndex = (currentIndex + 1) % filtered.length;
  submitted = false;
  render();
}

function shuffleQuestion() {
  clearAutoNext();
  if (!filtered.length) return;
  const next = Math.floor(Math.random() * filtered.length);
  currentIndex = filtered.length > 1 && next === currentIndex ? (next + 1) % filtered.length : next;
  submitted = false;
  render();
}

function reviewWrongQuestion(id) {
  clearAutoNext();
  els.modeSelect.value = "wrong";
  els.unitSelect.value = "all";
  els.typeSelect.value = "all";
  applyFilters();
  const nextIndex = filtered.findIndex((q) => q.id === id);
  if (nextIndex >= 0) {
    currentIndex = nextIndex;
    submitted = false;
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function resetProgress() {
  clearAutoNext();
  if (!confirm("确定清空本机的已刷、错题和错选记录吗？")) return;
  state = { done: new Set(), wrong: new Set(), mistakes: {} };
  saveState();
  applyFilters();
}

function answerText(question, labels) {
  return labels.map((label) => `${label}. ${question.options[label] || label}`).join("；");
}

function clearAutoNext() {
  if (autoNextTimer !== null) {
    window.clearTimeout(autoNextTimer);
    autoNextTimer = null;
  }
}

function answerSort(left, right) {
  const order = ["A", "B", "C", "D", "E", "正确", "错误"];
  return order.indexOf(left) - order.indexOf(right);
}

function arraysEqual(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

pruneState();
fillUnitSelect();
applyFilters();

els.modeSelect.addEventListener("change", () => applyFilters());
els.unitSelect.addEventListener("change", () => applyFilters());
els.typeSelect.addEventListener("change", () => applyFilters());
els.searchInput.addEventListener("input", renderList);
els.submitBtn.addEventListener("click", submitAnswer);
els.nextBtn.addEventListener("click", nextQuestion);
els.shuffleBtn.addEventListener("click", shuffleQuestion);
els.resetBtn.addEventListener("click", resetProgress);
