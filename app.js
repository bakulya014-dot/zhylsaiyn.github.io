// Chatbot configuration.
// The real Gemini API key lives on the server in GEMINI_API_KEY.
const GEMINI_MODEL = "gemini-2.5-flash";

const modeToggle = document.querySelector("#modeToggle");
const metricValues = document.querySelectorAll("[data-count]");
const revealTargets = document.querySelectorAll(".section, .hero-copy, .hero-panel");

const quadraticChart = document.querySelector("#quadraticChart");
const equationLine = document.querySelector("#equationLine");
const quadraticInsights = document.querySelector("#quadraticInsights");
const coefA = document.querySelector("#coefA");
const coefB = document.querySelector("#coefB");
const coefC = document.querySelector("#coefC");

const studyHours = document.querySelector("#studyHours");
const practiceTests = document.querySelector("#practiceTests");
const consistency = document.querySelector("#consistency");
const predictionValue = document.querySelector("#predictionValue");
const predictionExplanation = document.querySelector("#predictionExplanation");

const blockForm = document.querySelector("#blockForm");
const studentName = document.querySelector("#studentName");
const achievementName = document.querySelector("#achievementName");
const achievementScore = document.querySelector("#achievementScore");
const chainRail = document.querySelector("#chainRail");

const tutorSection = document.querySelector("#tutor");
const apiStatus = document.querySelector("#apiStatus");
const modePills = document.querySelectorAll(".mode-pill");
const checkSolutionButton = document.querySelector("#checkSolutionButton");
const exampleButtons = document.querySelectorAll(".example-chip");
const topicChip = document.querySelector("#topicChip");
const chatFeed = document.querySelector("#chatFeed");
const chatForm = document.querySelector("#chatForm");
const userPrompt = document.querySelector("#userPrompt");
const clearChatButton = document.querySelector("#clearChatButton");
const sendPromptButton = document.querySelector("#sendPromptButton");

const functionForm = document.querySelector("#functionForm");
const functionInput = document.querySelector("#functionInput");
const functionStatus = document.querySelector("#functionStatus");
const functionChart = document.querySelector("#functionChart");
const useFunctionInChat = document.querySelector("#useFunctionInChat");

let activeMode = "explain";
let thinkingMessageNode = null;

function updateModeLabel() {
  modeToggle.textContent = document.body.classList.contains("dark-mode") ? "Dark Mode" : "Light Mode";
}

modeToggle.addEventListener("click", () => {
  document.body.classList.toggle("dark-mode");
  updateModeLabel();
});

updateModeLabel();

function setApiStatus(message, type = "") {
  apiStatus.textContent = `Status: ${message}`;
  apiStatus.classList.remove("status-ok", "status-error");
  if (type) {
    apiStatus.classList.add(type);
  }
}

setApiStatus("waiting for backend");

function animateMetrics() {
  metricValues.forEach((node) => {
    const target = Number(node.dataset.count);
    let current = 0;
    const step = Math.max(1, Math.ceil(target / 32));

    const timer = window.setInterval(() => {
      current += step;
      if (current >= target) {
        current = target;
        window.clearInterval(timer);
      }
      node.textContent = current;
    }, 32);
  });
}

function setupReveal() {
  revealTargets.forEach((target) => target.classList.add("reveal"));

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
      }
    });
  }, { threshold: 0.18 });

  revealTargets.forEach((target) => observer.observe(target));
}

function getCurrentTopic() {
  const topic = tutorSection?.dataset.topic || "general algebra";
  topicChip.textContent = `Topic: ${topic.charAt(0).toUpperCase()}${topic.slice(1)}`;
  return topic;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatAiText(text) {
  const safe = escapeHtml(text);
  return safe
    .replace(/\n/g, "<br>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
}

function scrollChatToBottom() {
  chatFeed.scrollTop = chatFeed.scrollHeight;
}

function queueMathTypeset() {
  if (window.MathJax?.typesetPromise) {
    window.MathJax.typesetPromise([chatFeed]).catch(() => {});
  }
}

function createMessage(role, html, extraClass = "") {
  const article = document.createElement("article");
  article.className = `chat-message ${role} ${extraClass}`.trim();

  const roleLabel = document.createElement("span");
  roleLabel.className = "chat-role";
  roleLabel.textContent = role === "user" ? "You" : "AI Tutor";

  const body = document.createElement("div");
  body.className = "chat-body";
  body.innerHTML = html;

  article.append(roleLabel, body);
  chatFeed.appendChild(article);
  scrollChatToBottom();
  queueMathTypeset();
  return article;
}

function showThinkingMessage() {
  thinkingMessageNode = createMessage(
    "ai",
    '<div class="typing-indicator" aria-label="Thinking"><span></span><span></span><span></span></div><p>Thinking...</p>',
    "thinking"
  );
}

function removeThinkingMessage() {
  if (thinkingMessageNode) {
    thinkingMessageNode.remove();
    thinkingMessageNode = null;
  }
}

function typeAiMessage(text) {
  const node = createMessage("ai", "<p></p>");
  const paragraph = node.querySelector("p");
  let index = 0;

  const timer = window.setInterval(() => {
    index += 3;
    paragraph.innerHTML = formatAiText(text.slice(0, index));
    scrollChatToBottom();

    if (index >= text.length) {
      window.clearInterval(timer);
      paragraph.innerHTML = formatAiText(text);
      queueMathTypeset();
    }
  }, 12);
}

function setMode(mode) {
  activeMode = mode;
  modePills.forEach((pill) => {
    pill.classList.toggle("is-active", pill.dataset.mode === mode);
  });
}

function getModeInstruction() {
  if (activeMode === "fast") {
    return "Mode: Solve fast. Give the shortest correct solution with clear numbered steps and a concise final answer.";
  }

  if (activeMode === "check") {
    return "Mode: Check answer. Carefully inspect the student's work, point out mistakes, explain why they are mistakes, and show the corrected method.";
  }

  return "Mode: Explain simply. Teach clearly with supportive step-by-step reasoning and simple language.";
}

function buildSystemPrompt() {
  const topic = getCurrentTopic();
  return [
    "You are a professional math tutor. Always explain step-by-step, clearly, and simply. Focus on understanding.",
    `User is currently learning ${topic}.`,
    getModeInstruction(),
    "When solving, break the method into steps, explain each step, and give the final answer.",
    "If the user asks to check a solution, identify mistakes, explain why they are wrong, and show the correct method.",
    "If the prompt includes a function, mention graph features when useful.",
    "Use readable formatting and keep the explanation educational."
  ].join(" ");
}

async function callGemini(prompt) {
  setApiStatus("contacting backend...");

  let response;
  try {
    response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        prompt,
        systemPrompt: buildSystemPrompt(),
        model: GEMINI_MODEL
      })
    });
  } catch (networkError) {
    setApiStatus("backend network error", "status-error");
    throw new Error(`Network error: ${networkError.message}. Start your local server and check that /api/chat is reachable.`);
  }

  let data;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    setApiStatus(`backend error ${response.status}`, "status-error");
    throw new Error(data?.error || `Chat request failed with status ${response.status}.`);
  }

  const text = data?.text?.trim();

  if (!text) {
    setApiStatus("backend returned empty content", "status-error");
    throw new Error("The backend returned an empty response.");
  }

  setApiStatus("backend connected successfully", "status-ok");
  return text;
}

function extractExpression(rawInput) {
  return rawInput
    .trim()
    .replace(/\s+/g, "")
    .replace(/^y=/i, "")
    .replace(/^f\(x\)=/i, "");
}

function normalizeExpression(expression) {
  return expression
    .replace(/\^/g, "**")
    .replace(/(\d)(x)/gi, "$1*$2")
    .replace(/(\))(\w)/g, "$1*$2")
    .replace(/(\w)(\()/g, "$1*$2")
    .replace(/(\d)(\()/g, "$1*$2");
}

function isExpressionSafe(expression) {
  return /^[0-9x+\-*/().*\s]+$/i.test(expression);
}

function evaluateExpression(expression, x) {
  const normalized = normalizeExpression(expression).replaceAll("x", `(${x})`);
  return Function(`"use strict"; return (${normalized});`)();
}

function renderSvgFunction(chartNode, expression, strokeColor = "var(--teal)") {
  const safeExpression = extractExpression(expression);

  if (!isExpressionSafe(safeExpression)) {
    throw new Error("Only numeric expressions with x, parentheses, +, -, *, /, and ^ are supported.");
  }

  const width = 320;
  const height = 220;
  const originX = width / 2;
  const originY = height / 2;
  const scale = 20;
  const points = [];

  for (let x = -8; x <= 8; x += 0.15) {
    const y = evaluateExpression(safeExpression, x);
    if (Number.isFinite(y)) {
      points.push(`${(originX + x * scale).toFixed(2)},${(originY - y * scale).toFixed(2)}`);
    }
  }

  if (points.length < 2) {
    throw new Error("The function could not be graphed from the current input.");
  }

  chartNode.innerHTML = `
    <line x1="0" y1="${originY}" x2="${width}" y2="${originY}" stroke="currentColor" stroke-opacity="0.25" />
    <line x1="${originX}" y1="0" x2="${originX}" y2="${height}" stroke="currentColor" stroke-opacity="0.25" />
    <polyline fill="none" stroke="${strokeColor}" stroke-width="3" points="${points.join(" ")}" />
  `;
}

function drawQuadratic() {
  let a = Number(coefA.value);
  const b = Number(coefB.value);
  const c = Number(coefC.value);

  if (a === 0) {
    a = 1;
    coefA.value = "1";
  }

  equationLine.textContent = `f(x) = ${a}x^2 ${b >= 0 ? "+" : "-"} ${Math.abs(b)}x ${c >= 0 ? "+" : "-"} ${Math.abs(c)}`;

  const width = 320;
  const height = 220;
  const originX = width / 2;
  const originY = height / 2;
  const scale = 18;
  const points = [];

  for (let x = -8; x <= 8; x += 0.25) {
    const y = a * x * x + b * x + c;
    points.push(`${(originX + x * scale).toFixed(2)},${(originY - y * scale).toFixed(2)}`);
  }

  const discriminant = b * b - 4 * a * c;
  const vertexX = -b / (2 * a);
  const vertexY = a * vertexX * vertexX + b * vertexX + c;

  let rootsText = "No real roots";
  if (discriminant === 0) {
    rootsText = `One real root at x = ${(-b / (2 * a)).toFixed(2)}`;
  } else if (discriminant > 0) {
    const root1 = ((-b + Math.sqrt(discriminant)) / (2 * a)).toFixed(2);
    const root2 = ((-b - Math.sqrt(discriminant)) / (2 * a)).toFixed(2);
    rootsText = `Two real roots at x = ${root1} and x = ${root2}`;
  }

  quadraticChart.innerHTML = `
    <line x1="0" y1="${originY}" x2="${width}" y2="${originY}" stroke="currentColor" stroke-opacity="0.25" />
    <line x1="${originX}" y1="0" x2="${originX}" y2="${height}" stroke="currentColor" stroke-opacity="0.25" />
    <polyline fill="none" stroke="var(--coral)" stroke-width="3" points="${points.join(" ")}" />
    <circle cx="${(originX + vertexX * scale).toFixed(2)}" cy="${(originY - vertexY * scale).toFixed(2)}" r="5" fill="var(--teal)" />
  `;

  quadraticInsights.innerHTML = `
    <strong>Graph insight</strong><br>
    Vertex: (${vertexX.toFixed(2)}, ${vertexY.toFixed(2)})<br>
    ${rootsText}<br>
    The parabola opens ${a > 0 ? "upward" : "downward"}, which is ideal for explaining turning points and optimization.
  `;
}

function updatePrediction() {
  const hours = Number(studyHours.value);
  const tests = Number(practiceTests.value);
  const consistencyScore = Number(consistency.value);

  const predicted = Math.max(
    0,
    Math.min(100, Math.round(hours * 4.6 + tests * 5.2 + consistencyScore * 0.32))
  );

  predictionValue.textContent = predicted;

  let band = "needs support";
  if (predicted >= 85) {
    band = "high mastery";
  } else if (predicted >= 65) {
    band = "stable progress";
  }

  predictionExplanation.textContent =
    `The model reads ${hours} study hours, ${tests} practice tests, and ${consistencyScore}% consistency as ${band}. ` +
    `This reinforces the product story: AI interprets learning behavior, then the ledger can store key milestones.`;
}

function hashString(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return `0x${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

const chain = [
  {
    student: "Genesis",
    achievement: "Portfolio Initialized",
    score: 100,
    previousHash: "0x00000000"
  }
];

function renderChain() {
  chainRail.innerHTML = chain
    .map((block, index) => {
      const blockHash = hashString(`${block.student}|${block.achievement}|${block.score}|${block.previousHash}`);
      return `
        <article class="block-card">
          <span class="block-index">Block ${index}</span>
          <h3>${block.achievement}</h3>
          <p>${block.student} / score ${block.score}</p>
          <span class="hash-line">prev: ${block.previousHash}</span>
          <span class="hash-line">hash: ${blockHash}</span>
        </article>
      `;
    })
    .join("");
}

function seedChat() {
  chatFeed.innerHTML = "";
  createMessage(
    "ai",
    "<p>Welcome. I can solve math step by step, explain simply, check your own solution for mistakes, and help with graph interpretation. Start the backend server, keep your Gemini key on the server, and ask your first question.</p>"
  );
  createMessage(
    "ai",
    "<p>Example: <code>Solve x^2 - 5x + 6 = 0 step by step</code> or <code>Check my solution: I said the roots are 2 and 5</code>.</p>"
  );
}

async function handlePromptSubmission(prompt) {
  const trimmedPrompt = prompt.trim();
  if (!trimmedPrompt) {
    return;
  }

  createMessage("user", `<p>${formatAiText(trimmedPrompt)}</p>`);
  userPrompt.value = "";
  sendPromptButton.disabled = true;
  showThinkingMessage();

  try {
    const aiText = await callGemini(trimmedPrompt);
    removeThinkingMessage();
    typeAiMessage(aiText);
  } catch (error) {
    removeThinkingMessage();
    console.error("Gemini chat error:", error);
    createMessage("ai", `<p>${formatAiText(error.message)}</p>`, "error");
  } finally {
    sendPromptButton.disabled = false;
  }
}

async function checkBackendHealth() {
  try {
    const response = await fetch("/api/health");
    const data = await response.json();

    if (response.ok && data?.configured) {
      setApiStatus("backend ready", "status-ok");
      return;
    }

    if (response.ok) {
      setApiStatus("backend reachable, key missing", "status-error");
      return;
    }

    setApiStatus("backend health check failed", "status-error");
  } catch {
    setApiStatus("backend offline", "status-error");
  }
}

modePills.forEach((pill) => {
  pill.addEventListener("click", () => {
    setMode(pill.dataset.mode);
  });
});

checkSolutionButton.addEventListener("click", () => {
  setMode("check");
  userPrompt.value = "Check my solution:\n\nProblem:\n\nMy work:\n";
  userPrompt.focus();
});

exampleButtons.forEach((button) => {
  button.addEventListener("click", () => {
    userPrompt.value = button.dataset.example;
    userPrompt.focus();
  });
});

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await handlePromptSubmission(userPrompt.value);
});

clearChatButton.addEventListener("click", () => {
  seedChat();
});

functionForm.addEventListener("submit", (event) => {
  event.preventDefault();

  try {
    renderSvgFunction(functionChart, functionInput.value, "var(--teal)");
    functionStatus.textContent = `Graphed: ${functionInput.value}`;
  } catch (error) {
    functionChart.innerHTML = "";
    functionStatus.textContent = error.message;
  }
});

useFunctionInChat.addEventListener("click", () => {
  userPrompt.value = `Explain this function and its graph: ${functionInput.value}`;
  userPrompt.focus();
});

blockForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const previous = chain[chain.length - 1];
  const previousHash = hashString(`${previous.student}|${previous.achievement}|${previous.score}|${previous.previousHash}`);

  chain.push({
    student: studentName.value.trim() || "Anonymous",
    achievement: achievementName.value.trim() || "Learning milestone",
    score: Math.max(0, Math.min(100, Number(achievementScore.value) || 0)),
    previousHash
  });

  renderChain();
});

[coefA, coefB, coefC].forEach((input) => input.addEventListener("input", drawQuadratic));
[studyHours, practiceTests, consistency].forEach((input) => input.addEventListener("input", updatePrediction));

animateMetrics();
setupReveal();
getCurrentTopic();
drawQuadratic();
updatePrediction();
renderChain();
seedChat();
checkBackendHealth();

try {
  renderSvgFunction(functionChart, functionInput.value, "var(--teal)");
  functionStatus.textContent = `Graphed: ${functionInput.value}`;
} catch (error) {
  functionStatus.textContent = error.message;
}
