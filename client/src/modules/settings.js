import { $, api } from '../utils.js';
import { store, setStatus } from '../store/index.js';

const PRESETS = [
  { name: 'AIand', endpoint: 'https://api.aiand.com/v1', model: 'zai-org/glm-5.2', modelsEndpoint: '/providers/aiand/models' },
  { name: 'OpenAI', endpoint: 'https://api.openai.com/v1', model: 'gpt-4o', singleModel: true },
  { name: 'Anthropic', endpoint: 'https://api.anthropic.com/v1', model: 'claude-3-5-sonnet-20241022', singleModel: true },
  { name: 'OpenRouter', endpoint: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o-mini', singleModel: true },
  { name: 'Ollama', endpoint: 'http://localhost:11434/v1', model: 'llama3.1', singleModel: true },
];

let currentModels = [];

export function initSettings() {
  $('settingsBtn')?.addEventListener('click', openSettings);
  $('settingsBtnDashboard')?.addEventListener('click', openSettings);
  $('cancelSettings')?.addEventListener('click', () => $('settingsDlg')?.close());
  $('saveSettings')?.addEventListener('click', saveSettings);

  $('newKeyBtn')?.addEventListener('click', () => {
    const input = $('apiKey');
    input.disabled = false;
    input.value = '';
    input.focus();
    $('newKeyBtn').style.display = 'none';
    const keyStatus = $('apiKeyStatus');
    if (keyStatus) {
      keyStatus.textContent = 'Enter a new API key.';
      keyStatus.classList.remove('saved');
    }
  });

  const wrap = $('providerPresets');
  if (wrap) {
    PRESETS.forEach((p) => {
      const b = document.createElement('button');
      b.className = 'sm secondary';
      b.textContent = p.name;
      b.addEventListener('click', () => applyPreset(p));
      wrap.appendChild(b);
    });
  }

  $('modelSelect')?.addEventListener('change', () => {
    const val = $('modelSelect').value;
    const input = $('model');
    if (val === 'custom') {
      input.style.display = 'block';
    } else {
      input.style.display = 'none';
      input.value = val;
    }
  });

  store.subscribe((state) => {
    const btn = $('settingsBtn') || $('settingsBtnDashboard');
    if (!btn) return;
    if (!state.user) {
      btn.disabled = true;
      btn.title = 'Sign in to configure AI provider';
    } else {
      btn.disabled = false;
      btn.title = '';
    }
  });
}

async function openSettings() {
  const settings = store.get('settings') || {};
  $('endpoint').value = settings.providerEndpoint || '';
  $('model').value = settings.providerModel || '';
  $('apiKey').value = '';

  const keyInput = $('apiKey');
  const newKeyBtn = $('newKeyBtn');
  const keyStatus = $('apiKeyStatus');

  if (settings.hasApiKey) {
    keyInput.disabled = true;
    keyInput.value = '';
    keyInput.placeholder = '• • • • • • • •';
    if (newKeyBtn) newKeyBtn.style.display = '';
    if (keyStatus) {
      keyStatus.textContent = 'Key saved. Click "New Key" to replace it.';
      keyStatus.classList.add('saved');
    }
  } else {
    keyInput.disabled = false;
    keyInput.value = '';
    keyInput.placeholder = 'sk-...';
    if (newKeyBtn) newKeyBtn.style.display = 'none';
    if (keyStatus) {
      keyStatus.textContent = '';
      keyStatus.classList.remove('saved');
    }
  }

  const matchPreset = PRESETS.find((p) => p.endpoint === settings.providerEndpoint);
  if (matchPreset) {
    await applyPreset(matchPreset, false);
    updateModelSelect(settings.providerModel);
  } else if (!$('endpoint').value) {
    await applyPreset(PRESETS[0], false);
  } else {
    showCustomModelOnly(settings.providerModel);
  }

  $('settingsDlg').showModal();
}

async function applyPreset(preset, updateInputs = true) {
  if (updateInputs) {
    $('endpoint').value = preset.endpoint;
  }

  if (preset.singleModel) {
    currentModels = [{ id: preset.model, name: preset.model }];
    populateModelSelect();
    if (updateInputs) {
      $('modelSelect').value = preset.model;
      $('model').style.display = 'none';
      $('model').value = preset.model;
    }
  } else if (preset.modelsEndpoint) {
    await loadModels(preset.modelsEndpoint);
    if (updateInputs) {
      updateModelSelect(preset.model);
    }
  }
}

async function loadModels(endpoint) {
  try {
    const data = await api(endpoint);
    currentModels = data.models || [];
    populateModelSelect();
  } catch {
    currentModels = [];
    clearModels();
  }
}

function clearModels() {
  const select = $('modelSelect');
  select.innerHTML = '<option value="custom">Custom…</option>';
}

function populateModelSelect() {
  const select = $('modelSelect');
  select.innerHTML = '';

  if (currentModels.length <= 1) {
    currentModels.forEach((m) => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.name || m.id;
      select.appendChild(opt);
    });
  } else {
    currentModels.forEach((m) => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.name || m.id;
      select.appendChild(opt);
    });
    const customOpt = document.createElement('option');
    customOpt.value = 'custom';
    customOpt.textContent = 'Custom…';
    select.appendChild(customOpt);
  }
}

function showCustomModelOnly(currentModel) {
  const select = $('modelSelect');
  select.innerHTML = '<option value="custom">Custom…</option>';
  select.value = 'custom';
  $('model').style.display = 'block';
  $('model').value = currentModel || '';
}

function updateModelSelect(currentModel) {
  const select = $('modelSelect');
  const input = $('model');
  const match = currentModels.find((m) => m.id === currentModel);

  if (match) {
    select.value = match.id;
    input.style.display = 'none';
    input.value = match.id;
  } else if (currentModel) {
    if (currentModels.length <= 1) {
      showCustomModelOnly(currentModel);
    } else {
      select.value = 'custom';
      input.style.display = 'block';
      input.value = currentModel;
    }
  }
}

async function saveSettings() {
  try {
    const modelSelect = $('modelSelect');
    let model = $('model').value.trim();
    if (modelSelect && modelSelect.value !== 'custom') {
      model = modelSelect.value;
    }

    const body = {
      providerEndpoint: $('endpoint').value.trim(),
      providerModel: model,
    };

    const apiKey = $('apiKey').value.trim();
    if (apiKey) {
      body.apiKey = apiKey;
    }

    const data = await api('/auth/settings', {
      method: 'PATCH',
      body: JSON.stringify(body),
    });

    store.set({ settings: data.settings });
    $('settingsDlg').close();
    setStatus('Settings saved.', 'ok');
  } catch (e) {
    setStatus('Failed to save settings: ' + e.message, 'error');
  }
}
