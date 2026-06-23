import { $, api } from '../utils.js';
import { store, setStatus } from '../store/index.js';

const PRESETS = [
  { name: 'AIand', endpoint: 'https://api.aiand.com/v1', model: 'deepseek-ai/deepseek-v4-pro' },
  { name: 'OpenAI', endpoint: 'https://api.openai.com/v1', model: 'gpt-4o' },
  { name: 'Anthropic', endpoint: 'https://api.anthropic.com/v1', model: 'claude-3-5-sonnet-20241022' },
  { name: 'OpenRouter', endpoint: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o-mini' },
  { name: 'Ollama', endpoint: 'http://localhost:11434/v1', model: 'llama3.1' },
];

export function initSettings() {
  $('settingsBtn').addEventListener('click', openSettings);
  $('cancelSettings').addEventListener('click', () => $('settingsDlg').close());
  $('saveSettings').addEventListener('click', saveSettings);

  const wrap = $('providerPresets');
  PRESETS.forEach((p) => {
    const b = document.createElement('button');
    b.className = 'sm secondary';
    b.textContent = p.name;
    b.addEventListener('click', () => {
      $('endpoint').value = p.endpoint;
      $('model').value = p.model;
    });
    wrap.appendChild(b);
  });

  store.subscribe((state) => {
    if (!state.user) {
      $('settingsBtn').disabled = true;
      $('settingsBtn').title = 'Sign in to configure AI provider';
    } else {
      $('settingsBtn').disabled = false;
      $('settingsBtn').title = '';
    }
  });
}

function openSettings() {
  const settings = store.get('settings') || {};
  $('endpoint').value = settings.providerEndpoint || '';
  $('model').value = settings.providerModel || '';
  $('apiKey').value = '';
  $('settingsDlg').showModal();
}

async function saveSettings() {
  try {
    const body = {
      providerEndpoint: $('endpoint').value.trim(),
      providerModel: $('model').value.trim(),
      apiKey: $('apiKey').value.trim(),
    };

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
