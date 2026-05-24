'use strict';

// ── State ──────────────────────────────────────────────────────────────────

const state = {
  questions: [],
  cloud: null,
  orgProfile: null,
  domains: [],
  currentDomainIndex: 0,
  answers: {},   // { questionId: 'yes' | 'partial' | 'no' }
  scores: {},    // { domainName: { score, max, pct, rag } }
  overallPct: 0,
  aiKey: null,   // held in memory only, never persisted
};

// ── Boot ───────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  loadQuestions();
  setupWelcomeScreen();
  setupApiModal();
  broadcastHeight();
});

window.addEventListener('resize', broadcastHeight);

function broadcastHeight() {
  const height = document.body.scrollHeight;
  window.parent.postMessage({ type: 'resize', height: height }, 'https://arnav.au');
}

async function loadQuestions() {
  try {
    const resp = await fetch('data/questions.json');
    if (!resp.ok) throw new Error('Failed to load questions');
    state.questions = await resp.json();
  } catch (e) {
    // If running file:// protocol fetch may fail — show user a friendly message
    showScreen('screen-welcome');
    document.querySelector('.welcome-hero .tagline').textContent =
      'Unable to load questions. Please serve from a web server or GitHub Pages.';
  }
  showScreen('screen-welcome');
}

// ── Screen helpers ─────────────────────────────────────────────────────────

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(id);
  if (target) {
    target.classList.add('active');
    setTimeout(broadcastHeight, 50);
  }
}

// ── Welcome Screen ─────────────────────────────────────────────────────────

function setupWelcomeScreen() {
  const cloudBtns = document.querySelectorAll('.cloud-btn');
  const profileBtns = document.querySelectorAll('.profile-btn');
  const startBtn = document.getElementById('btn-start');

  cloudBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      cloudBtns.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      state.cloud = btn.dataset.value;
      updateStartButton();
    });
  });

  profileBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      profileBtns.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      state.orgProfile = btn.dataset.value;
      updateStartButton();
    });
  });

  startBtn.addEventListener('click', startQuestionnaire);
}

function updateStartButton() {
  const startBtn = document.getElementById('btn-start');
  startBtn.disabled = !(state.cloud && state.orgProfile);
}

// ── Questionnaire ──────────────────────────────────────────────────────────

function startQuestionnaire() {
  // Filter questions to selected cloud platform
  const filtered = state.questions.filter(q =>
    q.cloud.includes(state.cloud) || q.cloud.includes('multi')
  );

  // Group by domain preserving order
  const domainMap = new Map();
  filtered.forEach(q => {
    if (!domainMap.has(q.domain)) domainMap.set(q.domain, []);
    domainMap.get(q.domain).push(q);
  });
  state.domains = Array.from(domainMap.entries()).map(([name, questions]) => ({ name, questions }));
  state.currentDomainIndex = 0;
  state.answers = {};

  renderDomain();
  showScreen('screen-questionnaire');
}

function renderDomain() {
  const domain = state.domains[state.currentDomainIndex];
  const totalDomains = state.domains.length;
  const pct = Math.round((state.currentDomainIndex / totalDomains) * 100);

  // Progress
  document.getElementById('progress-fill').style.width = pct + '%';
  document.getElementById('domain-name').textContent = domain.name;
  document.getElementById('domain-step').textContent =
    `Domain ${state.currentDomainIndex + 1} of ${totalDomains}`;

  // Question cards
  const list = document.getElementById('question-list');
  list.innerHTML = '';
  domain.questions.forEach(q => {
    list.appendChild(buildQuestionCard(q));
  });

  // Nav buttons
  const backBtn = document.getElementById('btn-back');
  const nextBtn = document.getElementById('btn-next');
  backBtn.disabled = state.currentDomainIndex === 0;
  nextBtn.textContent = state.currentDomainIndex === totalDomains - 1 ? 'View Results' : 'Next';
  updateNextButton();
}

function buildQuestionCard(q) {
  const card = document.createElement('div');
  card.className = 'question-card';
  card.dataset.id = q.id;
  if (state.answers[q.id]) card.classList.add('answered');

  const weightLabel = q.weight === 3 ? 'Critical' : q.weight === 2 ? 'Important' : 'Good Practice';

  card.innerHTML = `
    <div class="question-weight weight-${q.weight}">
      <span class="weight-dot"></span>${weightLabel}
    </div>
    <div class="question-text">${escHtml(q.text)}</div>
    <div class="answer-btns">
      <button class="answer-btn yes${state.answers[q.id] === 'yes' ? ' active' : ''}" data-answer="yes" data-qid="${escHtml(q.id)}">Yes</button>
      <button class="answer-btn partial${state.answers[q.id] === 'partial' ? ' active' : ''}" data-answer="partial" data-qid="${escHtml(q.id)}">Partial</button>
      <button class="answer-btn no${state.answers[q.id] === 'no' ? ' active' : ''}" data-answer="no" data-qid="${escHtml(q.id)}">No</button>
    </div>
  `;

  card.querySelectorAll('.answer-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const qid = btn.dataset.qid;
      const answer = btn.dataset.answer;
      state.answers[qid] = answer;
      // Update UI for this card
      card.querySelectorAll('.answer-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      card.classList.add('answered');
      updateNextButton();
      setTimeout(broadcastHeight, 50);
    });
  });

  return card;
}

function updateNextButton() {
  const domain = state.domains[state.currentDomainIndex];
  const allAnswered = domain.questions.every(q => state.answers[q.id]);
  document.getElementById('btn-next').disabled = !allAnswered;
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-next').addEventListener('click', () => {
    if (state.currentDomainIndex < state.domains.length - 1) {
      state.currentDomainIndex++;
      renderDomain();
      window.scrollTo(0, 0);
    } else {
      computeScores();
      renderResults();
      showScreen('screen-results');
      window.scrollTo(0, 0);
    }
  });

  document.getElementById('btn-back').addEventListener('click', () => {
    if (state.currentDomainIndex > 0) {
      state.currentDomainIndex--;
      renderDomain();
      window.scrollTo(0, 0);
    }
  });

  document.getElementById('btn-restart').addEventListener('click', () => {
    state.answers = {};
    state.cloud = null;
    state.orgProfile = null;
    document.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
    document.getElementById('btn-start').disabled = true;
    document.getElementById('ai-panel').classList.remove('visible');
    document.getElementById('ai-panel').innerHTML = '';
    showScreen('screen-welcome');
    window.scrollTo(0, 0);
  });
});

// ── Scoring Engine ─────────────────────────────────────────────────────────

function computeScores() {
  let totalWeightedScore = 0;
  let totalWeightedMax = 0;

  state.domains.forEach(domain => {
    let score = 0;
    let max = 0;
    domain.questions.forEach(q => {
      const ans = state.answers[q.id] || 'no';
      max += q.weight;
      if (ans === 'yes') score += q.weight;
      else if (ans === 'partial') score += q.weight * 0.5;
    });
    const pct = max > 0 ? Math.round((score / max) * 100) : 0;
    const rag = pct >= 75 ? 'green' : pct >= 40 ? 'amber' : 'red';
    state.scores[domain.name] = { score, max, pct, rag };
    totalWeightedScore += score;
    totalWeightedMax += max;
  });

  state.overallPct = totalWeightedMax > 0
    ? Math.round((totalWeightedScore / totalWeightedMax) * 100)
    : 0;
}

function ragClass(pct) {
  return pct >= 75 ? 'rag-green' : pct >= 40 ? 'rag-amber' : 'rag-red';
}

// ── Results Screen ─────────────────────────────────────────────────────────

function renderResults() {
  renderOverallScore();
  renderDomainBars();
  renderQuickWins();
  renderFindings();
  setTimeout(broadcastHeight, 100);
}

function renderOverallScore() {
  const pct = state.overallPct;
  const ragCls = ragClass(pct);
  const label = pct >= 75 ? 'Good' : pct >= 40 ? 'Needs Improvement' : 'At Risk';

  const valueEl = document.getElementById('overall-score-value');
  valueEl.textContent = pct + '%';
  valueEl.className = 'overall-score-value ' + ragCls;

  const badgeEl = document.getElementById('overall-score-badge');
  badgeEl.textContent = label;
  badgeEl.className = 'overall-score-badge';

  const block = document.querySelector('.overall-score-block');
  block.className = 'overall-score-block ' + ragCls;
}

function renderDomainBars() {
  const container = document.getElementById('domain-bars');
  container.innerHTML = '';
  state.domains.forEach(domain => {
    const { pct, rag } = state.scores[domain.name];
    const row = document.createElement('div');
    row.className = 'domain-bar-row';
    row.innerHTML = `
      <div class="domain-bar-name" title="${escHtml(domain.name)}">${escHtml(domain.name)}</div>
      <div class="domain-bar-track">
        <div class="domain-bar-fill rag-${rag}" style="width:${pct}%"></div>
      </div>
      <div class="domain-bar-pct rag-${rag}">${pct}%</div>
    `;
    container.appendChild(row);
  });
}

function renderQuickWins() {
  // Top 3: weight-3 questions answered No (highest impact, unanswered)
  const gaps = [];
  state.domains.forEach(domain => {
    domain.questions.forEach(q => {
      const ans = state.answers[q.id] || 'no';
      if (ans === 'no' && q.weight === 3) {
        gaps.push({ q, domain: domain.name });
      }
    });
  });
  // Limit to 3
  const wins = gaps.slice(0, 3);

  const container = document.getElementById('quick-wins-list');
  container.innerHTML = '';

  if (wins.length === 0) {
    container.innerHTML = '<p style="color:var(--green);font-size:0.88rem;">No critical gaps found — all critical controls are at least partially implemented.</p>';
    return;
  }

  wins.forEach(({ q, domain }) => {
    const card = document.createElement('div');
    card.className = 'quick-win-card';
    card.innerHTML = `
      <div class="quick-win-header">
        <span class="quick-win-id">${escHtml(q.id)}</span>
        <span style="font-size:0.72rem;color:var(--text-muted);">${escHtml(domain)}</span>
      </div>
      <div class="quick-win-text">${escHtml(q.text)}</div>
      <div class="quick-win-remediation">${escHtml(q.remediation)}</div>
      <a class="quick-win-link" href="${escHtml(q.secframe_link)}" target="_blank" rel="noopener">
        View control detail on SecFrame →
      </a>
    `;
    container.appendChild(card);
  });
}

function renderFindings() {
  const redAmberContainer = document.getElementById('findings-list');
  const greenContainer = document.getElementById('covered-list');
  redAmberContainer.innerHTML = '';
  greenContainer.innerHTML = '';

  state.domains.forEach(domain => {
    const { pct, rag } = state.scores[domain.name];
    const isGreen = rag === 'green';
    const container = isGreen ? greenContainer : redAmberContainer;
    const group = buildDomainGroup(domain, pct, rag, !isGreen);
    container.appendChild(group);
  });

  if (redAmberContainer.children.length === 0) {
    redAmberContainer.innerHTML = '<p style="color:var(--green);font-size:0.88rem;padding:8px 0;">All domains are performing well.</p>';
  }
  if (greenContainer.children.length === 0) {
    greenContainer.innerHTML = '<p style="color:var(--text-muted);font-size:0.88rem;padding:8px 0;">No domains at green yet — keep working through the findings above.</p>';
  }
}

function buildDomainGroup(domain, pct, rag, openByDefault) {
  const group = document.createElement('div');
  group.className = `domain-group rag-${rag}${openByDefault ? ' open' : ''}`;

  const header = document.createElement('button');
  header.className = 'domain-group-header';
  header.innerHTML = `
    <div class="domain-group-left">
      <div class="domain-rag-dot"></div>
      <span class="domain-group-name">${escHtml(domain.name)}</span>
    </div>
    <div class="domain-group-right">
      <span class="domain-score-chip">${pct}%</span>
      <span class="chevron">▼</span>
    </div>
  `;
  header.addEventListener('click', () => {
    group.classList.toggle('open');
    setTimeout(broadcastHeight, 50);
  });

  const body = document.createElement('div');
  body.className = 'domain-group-body';

  domain.questions.forEach(q => {
    const ans = state.answers[q.id] || 'no';
    const item = document.createElement('div');
    item.className = 'finding-item';
    const tagClass = ans === 'yes' ? 'tag-yes' : ans === 'partial' ? 'tag-partial' : 'tag-no';
    const tagLabel = ans === 'yes' ? 'Yes' : ans === 'partial' ? 'Partial' : 'No';
    item.innerHTML = `
      <div class="finding-top">
        <span class="finding-id">${escHtml(q.id)}</span>
        <span class="finding-answer-tag ${tagClass}">${tagLabel}</span>
        <span class="finding-text">${escHtml(q.text)}</span>
      </div>
      ${ans !== 'yes' ? `<div class="finding-remediation">${escHtml(q.remediation)}</div>
      <a class="finding-link" href="${escHtml(q.secframe_link)}" target="_blank" rel="noopener">View on SecFrame →</a>` : ''}
    `;
    body.appendChild(item);
  });

  group.appendChild(header);
  group.appendChild(body);
  return group;
}

// ── Download Report ────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-download').addEventListener('click', downloadReport);
});

function downloadReport() {
  const lines = [];
  const now = new Date().toLocaleDateString('en-AU', { year: 'numeric', month: 'long', day: 'numeric' });

  lines.push('SecPosture — Cloud Security Posture Report');
  lines.push('==========================================');
  lines.push(`Generated: ${now}`);
  lines.push(`Cloud Platform: ${state.cloud}`);
  lines.push(`Org Profile: ${state.orgProfile}`);
  lines.push('');
  lines.push(`Overall Score: ${state.overallPct}%`);
  lines.push('');
  lines.push('Domain Scores');
  lines.push('-------------');
  state.domains.forEach(d => {
    const { pct, rag } = state.scores[d.name];
    lines.push(`  ${d.name}: ${pct}% [${rag.toUpperCase()}]`);
  });
  lines.push('');
  lines.push('Findings');
  lines.push('--------');
  state.domains.forEach(domain => {
    const { rag } = state.scores[domain.name];
    if (rag !== 'green') {
      lines.push(`\n[${domain.name}]`);
      domain.questions.forEach(q => {
        const ans = state.answers[q.id] || 'no';
        if (ans !== 'yes') {
          lines.push(`  [${ans.toUpperCase()}] ${q.id}: ${q.text}`);
          lines.push(`  Remediation: ${q.remediation}`);
          lines.push('');
        }
      });
    }
  });
  lines.push('');
  lines.push('---');
  lines.push('Report generated by SecPosture — https://secposture.arnav.au');
  lines.push('© 2026 arnav.au — Free to use — No data is collected or stored');

  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'secposture-report.txt';
  a.click();
  URL.revokeObjectURL(url);
}

// ── AI Summary ─────────────────────────────────────────────────────────────

function setupApiModal() {
  const btnAi = document.getElementById('btn-ai-summary');
  const modal = document.getElementById('modal-api-key');
  const btnCancel = document.getElementById('btn-modal-cancel');
  const btnSubmit = document.getElementById('btn-modal-submit');
  const keyInput = document.getElementById('api-key-input');

  btnAi.addEventListener('click', () => {
    keyInput.value = '';
    modal.classList.add('open');
    setTimeout(() => keyInput.focus(), 100);
  });

  btnCancel.addEventListener('click', () => modal.classList.remove('open'));

  modal.addEventListener('click', e => {
    if (e.target === modal) modal.classList.remove('open');
  });

  keyInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') btnSubmit.click();
  });

  btnSubmit.addEventListener('click', () => {
    const key = keyInput.value.trim();
    if (!key.startsWith('sk-')) {
      keyInput.style.borderColor = 'var(--red)';
      return;
    }
    keyInput.style.borderColor = '';
    state.aiKey = key;
    modal.classList.remove('open');
    generateAiSummary();
  });
}

async function generateAiSummary() {
  const panel = document.getElementById('ai-panel');
  panel.classList.add('visible');
  panel.innerHTML = `
    <div class="ai-panel-title">✦ AI Executive Summary</div>
    <div class="ai-loading"><div class="spinner"></div>Generating summary with Claude…</div>
  `;
  broadcastHeight();

  const prompt = buildAiPrompt();

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': state.aiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error?.message || `API error ${resp.status}`);
    }

    const data = await resp.json();
    const text = data.content?.[0]?.text || '';
    renderAiResponse(text);
  } catch (e) {
    panel.innerHTML = `
      <div class="ai-panel-title">✦ AI Executive Summary</div>
      <div class="ai-error">Could not generate summary: ${escHtml(e.message)}. Check your API key and try again.</div>
    `;
  }
  broadcastHeight();
}

function buildAiPrompt() {
  const domainSummary = state.domains.map(d => {
    const { pct, rag } = state.scores[d.name];
    return `- ${d.name}: ${pct}% (${rag})`;
  }).join('\n');

  const gaps = [];
  state.domains.forEach(domain => {
    domain.questions.forEach(q => {
      const ans = state.answers[q.id] || 'no';
      if (ans !== 'yes') {
        gaps.push(`[${ans.toUpperCase()}] ${q.domain} — ${q.text}`);
      }
    });
  });

  return `You are a cloud security advisor. A ${state.orgProfile} organisation using ${state.cloud} cloud has completed a security posture assessment.

Overall score: ${state.overallPct}%

Domain scores:
${domainSummary}

Gaps identified (questions not answered Yes):
${gaps.slice(0, 20).join('\n')}

Please provide:
1. A 3-paragraph executive summary of the organisation's security posture. Be direct, professional, and specific to the findings above.
2. A section titled "Top 5 Prioritised Remediation Actions" listing the 5 most important steps with an effort estimate (Low / Medium / High) for each.

Format using plain text with clear headings. Keep the total response under 800 words.`;
}

function renderAiResponse(text) {
  const panel = document.getElementById('ai-panel');

  // Convert basic markdown-like formatting to safe HTML
  const html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/^#{1,4} (.+)$/gm, '<h4>$1</h4>')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/^[-•]\s+(.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>(\n|$))+/g, s => `<ul>${s}</ul>`)
    .replace(/\n\n+/g, '</p><p>')
    .replace(/\n/g, '<br>');

  panel.innerHTML = `
    <div class="ai-panel-title">✦ AI Executive Summary</div>
    <div class="ai-content"><p>${html}</p></div>
  `;
}

// ── Utility ────────────────────────────────────────────────────────────────

function escHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
