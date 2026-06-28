// Interactive walkthrough / onboarding tour
// Highlights elements one at a time with a spotlight overlay and tooltip

const STEPS = [
  {
    target: '#settingsBtnDashboard',
    title: 'Top Bar',
    body: 'Here are your tools: Help (?), Theme toggle (sun/moon), and Settings (gear) where you can configure your AI key and sign out.',
    view: 'dashboard',
    position: 'bottom',
  },
  {
    target: '#newProjectBtnDashboard',
    title: 'Create a Project',
    body: 'Click this button to create a new project. You\'ll be asked to name it, then you\'ll be taken to the map.',
    view: 'dashboard',
    waitFor: 'navigate:map',
    hideNext: true,
  },
  {
    target: '#map',
    title: 'Navigate the Map',
    body: 'Use <strong>scroll</strong> to zoom and <strong>right-click drag</strong> to pan around the map. Left-click drag moves the selection box once you\'ve placed it.',
    view: 'map',
    position: 'right',
  },
  {
    target: '#map',
    title: 'Click to Place a Marker',
    body: 'Click anywhere on the map to drop a marker at that spot — the blue selection box will appear around it. This is the quickest way to pick a location without typing.',
    view: 'map',
    position: 'right',
  },
  {
    target: '#addressInput',
    title: 'Or Search by Address',
    body: 'Prefer to search? Type an address or place name here. Use <strong>arrow keys</strong> to browse suggestions and <strong>Enter</strong> to select. Either way works — click the map or search, it\'s up to you.',
    view: 'map',
    position: 'right',
  },
  {
    target: '#detailSelector',
    title: 'Detail Level',
    body: 'Draft (90m, fastest), Standard (30m, balanced), or Survey (10m lidar, US only). Pick based on your needs.',
    view: 'map',
    position: 'right',
  },
  {
    target: '.area-inputs',
    title: 'Area Size',
    body: 'Set the size of your terrain area. Supports km, meters, miles, feet, and acres. The blue box on the map shows your selection. Use the dropdown to change units.',
    view: 'map',
    position: 'right',
  },
  {
    target: '#generateBtn',
    title: 'Generate Terrain',
    body: 'Click Generate to create a 3D model from real elevation data. This may take a few seconds. You\'ll be taken to the Studio view when ready.',
    view: 'map',
    waitFor: 'navigate:studio',
    hideNext: true,
  },
  {
    target: '#scene',
    title: '3D Terrain',
    body: 'Your terrain renders here with elevation colors. Green = low, white = high. Drag to orbit, scroll to zoom. The red arrow points true north.',
    view: 'studio',
    position: 'right',
  },
  {
    target: '#toggleMapPreview',
    title: 'Site Map Preview',
    body: 'Click to see a preview of the map area you selected, so you can reference it without going back.',
    view: 'studio',
    position: 'right',
  },
  {
    target: '.exports',
    title: 'Export',
    body: 'Download your terrain as OBJ, STL, or Heightmap for use in other 3D software like Blender, Unity, or Unreal.',
    view: 'studio',
    position: 'right',
  },
  {
    target: '#versionList',
    title: 'Generation History',
    body: 'Each time you regenerate, the old version is saved here. Click the eye icon to load a previous version.',
    view: 'studio',
    position: 'right',
  },
  {
    target: '#saveBtnStudio',
    title: 'Save',
    body: 'Save your project manually. Your work also auto-saves when you change the area or location. That\'s it — you\'re ready to go!',
    view: 'studio',
    position: 'bottom',
  },
];

let overlay = null;
let tooltip = null;
let currentStep = 0;
let isActive = false;
let waitTimer = null;

export function startWalkthrough() {
  if (isActive) return;
  isActive = true;
  currentStep = 0;

  overlay = document.createElement('div');
  overlay.className = 'walkthrough-overlay';
  overlay.style.pointerEvents = 'none';
  document.body.appendChild(overlay);

  tooltip = document.createElement('div');
  tooltip.className = 'walkthrough-tooltip';
  document.body.appendChild(tooltip);

  showStep();
}

export function endWalkthrough() {
  isActive = false;
  if (waitTimer) {
    clearInterval(waitTimer);
    waitTimer = null;
  }
  if (overlay) {
    overlay.remove();
    overlay = null;
  }
  if (tooltip) {
    tooltip.remove();
    tooltip = null;
  }
  localStorage.setItem('cs-walkthrough-done', '1');
}

function showStep() {
  if (!isActive) return;
  if (currentStep >= STEPS.length) {
    endWalkthrough();
    return;
  }

  const step = STEPS[currentStep];

  if (step.view) {
    import('../router.js').then(({ navigate, getCurrentView }) => {
      if (getCurrentView() !== step.view) {
        navigate(step.view);
      }
      setTimeout(() => positionStep(step), 500);
    });
  } else {
    positionStep(step);
  }
}

function positionStep(step) {
  if (!isActive) return;
  const target = document.querySelector(step.target);

  if (!target) {
    currentStep++;
    showStep();
    return;
  }

  const rect = target.getBoundingClientRect();
  const padding = 8;

  const highlight = {
    top: rect.top - padding,
    left: rect.left - padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
  };

  const total = currentStep + 1;
  const totalSteps = STEPS.length;

  let nextLabel = 'Next';
  if (step.hideNext) {
    nextLabel = '';
  } else if (total === totalSteps) {
    nextLabel = 'Finish';
  }

  tooltip.innerHTML = `
    <div class="walkthrough-progress">Step ${total} of ${totalSteps}</div>
    <h4>${step.title}</h4>
    <p>${step.body}</p>
    <div class="walkthrough-actions">
      <button class="ghost sm walkthrough-skip">Skip</button>
      ${nextLabel ? `<button class="primary sm walkthrough-next">${nextLabel}</button>` : ''}
    </div>
  `;

  positionTooltip(highlight, step);

  const l = highlight.left;
  const t = highlight.top;
  const r = l + highlight.width;
  const b = t + highlight.height;

  overlay.style.clipPath = `polygon(0% 0%, 0% 100%, ${l}px 100%, ${l}px ${t}px, ${r}px ${t}px, ${r}px ${b}px, ${l}px ${b}px, ${l}px 100%, 100% 100%, 100% 0%)`;

  tooltip.querySelector('.walkthrough-next')?.addEventListener('click', () => {
    currentStep++;
    showStep();
  });

  tooltip.querySelector('.walkthrough-skip')?.addEventListener('click', endWalkthrough);

  if (step.waitFor) {
    const [type, viewName] = step.waitFor.split(':');
    if (type === 'navigate') {
      import('../router.js').then(({ getCurrentView }) => {
        if (waitTimer) clearInterval(waitTimer);
        waitTimer = setInterval(() => {
          if (!isActive) {
            clearInterval(waitTimer);
            return;
          }
          if (getCurrentView() === viewName) {
            clearInterval(waitTimer);
            waitTimer = null;
            currentStep++;
            showStep();
          }
        }, 300);
      });
    }
  }
}

function positionTooltip(highlight, step) {
  const tipRect = tooltip.getBoundingClientRect();
  const margin = 16;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let top;
  let left;

  switch (step.position) {
    case 'right':
      top = highlight.top;
      left = highlight.left + highlight.width + margin;
      if (left + tipRect.width > vw - margin) {
        left = highlight.left - tipRect.width - margin;
      }
      break;
    case 'left':
      top = highlight.top;
      left = highlight.left - tipRect.width - margin;
      if (left < margin) {
        left = highlight.left + highlight.width + margin;
      }
      break;
    case 'bottom':
      top = highlight.top + highlight.height + margin;
      left = highlight.left;
      break;
    default:
      top = highlight.top + highlight.height + margin;
      left = highlight.left;
  }

  if (top + tipRect.height > vh - margin) {
    top = Math.max(margin, highlight.top - tipRect.height - margin);
  }
  if (left + tipRect.width > vw - margin) {
    left = vw - tipRect.width - margin;
  }
  if (left < margin) left = margin;

  tooltip.style.top = `${top}px`;
  tooltip.style.left = `${left}px`;
}

export function shouldShowWalkthrough() {
  try {
    return !localStorage.getItem('cs-walkthrough-done');
  } catch {
    return false;
  }
}
