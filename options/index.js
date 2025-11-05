// Clean, properly structured options script for Promptiply
(function () {
  "use strict";

  const ERROR_KEY = "promptiply_onboarding_error";
  const STORAGE_ONBOARDING = "onboarding_completed";
  const STORAGE_SETTINGS = "settings";
  const STORAGE_PROFILES = "profiles";
  const STORAGE_PREDEFINED = "predefined_profiles";
  const SCHEMA_VERSION = 1;

  // State
  let isRecordingHotkey = false;
  let recordedHotkey = null;
  let deletedProfilesUndo = null; // For undo functionality
  let undoTimeout = null;
  let wizardState = {
    step: 1,
    editingId: null,
    name: "",
    persona: "",
    tone: "",
    guidelines: [],
  };
  let onboardingState = {
    step: 1,
    selectedMode: "api",
    selectedProvider: "openai",
    apiKey: "",
    model: "",
    profileName: "",
    profilePersona: "",
    profileTone: "",
  };

  // Predefined profiles (loaded from storage or defaults)
  let PREDEFINED_PROFILES = [
    {
      id: "builtin_writer",
      name: "Technical Writer",
      persona: "Senior Technical Writer",
      tone: "clear, concise",
      styleGuidelines: ["Use simple language", "Prefer examples", "No fluff"],
    },
    {
      id: "builtin_dev",
      name: "Dev Helper",
      persona: "Senior Software Engineer",
      tone: "concise, pragmatic",
      styleGuidelines: ["Show code samples", "Explain with steps", "Use bullet lists"],
    },
    {
      id: "builtin_marketing",
      name: "Marketing Copy",
      persona: "Conversion-focused Marketer",
      tone: "excited, persuasive",
      styleGuidelines: ["Short headlines", "Call to action", "A/B test variants"],
    },
  ];

  // Utilities
  function getDefaultHotkey() {
    const platform = navigator.platform.toLowerCase();
    return platform.includes("mac") ? "Ctrl+T" : "Alt+T";
  }

  function capitalize(s) {
    return (s || "").charAt(0).toUpperCase() + (s || "").slice(1);
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function normalizeHotkey(v) {
    const t = (v || "").trim();
    if (!t) return getDefaultHotkey();
    const parts = t.split("+").map((x) => x.trim()).filter(Boolean);
    const keyPart = parts.pop();
    const mods = new Set(parts.map((p) => p.toLowerCase()));
    const order = [];
    if (mods.has("ctrl") || mods.has("control")) order.push("Ctrl");
    if (mods.has("alt") || mods.has("option")) order.push("Alt");
    if (mods.has("shift")) order.push("Shift");
    if (mods.has("meta") || mods.has("cmd") || mods.has("command")) order.push("Meta");
    const key = (keyPart || "R").length === 1 ? keyPart.toUpperCase() : capitalize(keyPart);
    return [...order, key].join("+");
  }

  function formatKeyEvent(e) {
    const parts = [];
    if (e.ctrlKey) parts.push("Ctrl");
    if (e.altKey) parts.push("Alt");
    if (e.shiftKey) parts.push("Shift");
    if (e.metaKey) parts.push("Meta");
    parts.push(e.key.length === 1 ? e.key.toUpperCase() : capitalize(e.key));
    return parts.join("+");
  }

  // Predefined profiles validation and persistence
  function validatePredefinedArray(arr) {
    if (!Array.isArray(arr)) return false;
    return arr.every(p => 
      p && 
      typeof p === 'object' &&
      typeof p.id === 'string' &&
      typeof p.name === 'string' &&
      p.id.length > 0 &&
      p.name.length > 0
    );
  }

  function loadPredefinedProfiles(callback) {
    chrome.storage.local.get([STORAGE_PREDEFINED], (data) => {
      if (data[STORAGE_PREDEFINED] && validatePredefinedArray(data[STORAGE_PREDEFINED])) {
        PREDEFINED_PROFILES = data[STORAGE_PREDEFINED];
        console.log('[promptiply] Loaded predefined profiles from storage');
      } else {
        // Use built-in defaults
        console.log('[promptiply] Using built-in predefined profiles');
        savePredefinedProfiles();
      }
      if (callback) callback();
    });
  }

  function savePredefinedProfiles() {
    chrome.storage.local.set({ [STORAGE_PREDEFINED]: PREDEFINED_PROFILES }, () => {
      console.log('[promptiply] Saved predefined profiles to storage');
    });
  }

  // Import/Export envelope with versioning
  function createExportEnvelope(profiles) {
    return {
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      profiles: profiles
    };
  }

  function parseImportEnvelope(data) {
    try {
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      
      // Handle versioned envelope
      if (parsed.schemaVersion !== undefined) {
        if (parsed.schemaVersion !== SCHEMA_VERSION) {
          throw new Error(`Unsupported schema version: ${parsed.schemaVersion}. Expected ${SCHEMA_VERSION}.`);
        }
        if (!Array.isArray(parsed.profiles)) {
          throw new Error('Invalid envelope: profiles must be an array');
        }
        return parsed.profiles;
      }
      
      // Legacy format: array directly
      if (Array.isArray(parsed)) {
        return parsed;
      }
      
      throw new Error('Invalid import format');
    } catch (e) {
      throw new Error(`Failed to parse import data: ${e.message}`);
    }
  }

  // Toast helper
  function ensureToastContainer() {
    let c = document.getElementById("pr-toast-container");
    if (!c) {
      c = document.createElement("div");
      c.id = "pr-toast-container";
      c.style.position = "fixed";
      c.style.right = "16px";
      c.style.bottom = "16px";
      c.style.zIndex = "99999";
      document.body.appendChild(c);
    }
    return c;
  }

  function showToast(msg, timeout = 1800) {
    try {
      const c = ensureToastContainer();
      const el = document.createElement("div");
      el.textContent = msg;
      el.style.background = "rgba(0,0,0,0.7)";
      el.style.color = "#fff";
      el.style.padding = "8px 12px";
      el.style.borderRadius = "6px";
      el.style.marginTop = "6px";
      el.style.fontSize = "12px";
      el.style.boxShadow = "0 2px 8px rgba(0,0,0,0.4)";
      c.appendChild(el);
      setTimeout(() => {
        try {
          el.remove();
        } catch (_) {}
      }, timeout);
    } catch (_) {}
  }

  // Tab switching
  function selectTab(name) {
    console.log("[promptiply] selectTab ->", name);
    const tabs = document.querySelectorAll(".tab");
    tabs.forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
    
    const panels = {
      general: document.getElementById("tab-general"),
      providers: document.getElementById("tab-providers"),
      profiles: document.getElementById("tab-profiles"),
    };
    
    Object.entries(panels).forEach(([k, el]) => {
      if (el) {
        el.classList.toggle("tab-panel-hidden", k !== name);
      }
    });
  }

  // Settings functions
  function updateProviderDisabled() {
    const mode = document.getElementById("mode");
    const provider = document.getElementById("provider");
    if (!mode || !provider) return;
    const isWebUI = mode.value === "webui";
    const isLocal = mode.value === "local";
    const providerField = provider.closest(".field");
    if (providerField) providerField.classList.toggle("disabled", isWebUI || isLocal);
  }

  function setModelSelect(selectEl, customEl, value) {
    if (!selectEl || !customEl) return;
    const opts = Array.from(selectEl.options).map((o) => o.value);
    if (value && opts.includes(value)) {
      selectEl.value = value;
      customEl.classList.add("custom-input-hidden");
      customEl.value = "";
    } else if (value) {
      selectEl.value = "custom";
      customEl.classList.remove("custom-input-hidden");
      customEl.value = value;
    }
  }

  function getModelValue(selectEl, customEl) {
    if (!selectEl || !customEl) return undefined;
    return selectEl.value === "custom" ? customEl.value.trim() || undefined : selectEl.value;
  }

  function saveSettings() {
    console.log("[promptiply] saveSettings called");
    try {
      const mode = document.getElementById("mode");
      const provider = document.getElementById("provider");
      const openaiKey = document.getElementById("openai-key");
      const openaiModelSelect = document.getElementById("openai-model-select");
      const openaiModelCustom = document.getElementById("openai-model-custom");
      const anthropicKey = document.getElementById("anthropic-key");
      const anthropicModelSelect = document.getElementById("anthropic-model-select");
      const anthropicModelCustom = document.getElementById("anthropic-model-custom");

      const s = {
        mode: mode ? mode.value : "api",
        provider: provider ? provider.value : "openai",
        openaiKey: openaiKey ? openaiKey.value.trim() || undefined : undefined,
        openaiModel: getModelValue(openaiModelSelect, openaiModelCustom),
        anthropicKey: anthropicKey ? anthropicKey.value.trim() || undefined : undefined,
        anthropicModel: getModelValue(anthropicModelSelect, anthropicModelCustom),
        refineHotkey: normalizeHotkey(recordedHotkey || getDefaultHotkey()),
      };

      chrome.storage.local.set({ [STORAGE_SETTINGS]: s }, () => {
        console.log("[promptiply] Settings saved");
        updateHotkeyDisplay();
        showToast("Settings saved");
      });
    } catch (e) {
      console.error("[promptiply] saveSettings error:", e);
    }
  }

  // Hotkey recording
  function updateHotkeyDisplay() {
    const refineHotkeyText = document.getElementById("refine-hotkey-text");
    if (refineHotkeyText) {
      refineHotkeyText.textContent = recordedHotkey || getDefaultHotkey();
    }
  }

  function startRecordingHotkey() {
    if (isRecordingHotkey) return;
    isRecordingHotkey = true;

    const refineHotkeyRecord = document.getElementById("refine-hotkey-record");
    const refineHotkeyRecording = document.getElementById("refine-hotkey-recording");
    const refineHotkeyText = document.getElementById("refine-hotkey-text");
    const refineHotkeyDisplay = document.getElementById("refine-hotkey-display");

    if (refineHotkeyRecord) {
      refineHotkeyRecord.textContent = "Stop";
      refineHotkeyRecord.classList.add("primary");
    }
    if (refineHotkeyRecording) refineHotkeyRecording.classList.add("show");
    if (refineHotkeyText) refineHotkeyText.textContent = "...";
    if (refineHotkeyDisplay) refineHotkeyDisplay.classList.add("recording");

    const keyDownHandler = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) return;
      const combo = formatKeyEvent(e);
      recordedHotkey = normalizeHotkey(combo);
      updateHotkeyDisplay();
      stopRecordingHotkey();
    };

    const keyUpHandler = (e) => {
      if (e.key === "Escape") stopRecordingHotkey();
    };

    window.addEventListener("keydown", keyDownHandler, true);
    window.addEventListener("keyup", keyUpHandler, true);
    window._hotkeyRecorder = { keyDownHandler, keyUpHandler };
  }

  function stopRecordingHotkey() {
    if (!isRecordingHotkey) return;
    isRecordingHotkey = false;

    const refineHotkeyRecord = document.getElementById("refine-hotkey-record");
    const refineHotkeyRecording = document.getElementById("refine-hotkey-recording");
    const refineHotkeyDisplay = document.getElementById("refine-hotkey-display");

    if (refineHotkeyRecord) {
      refineHotkeyRecord.textContent = "Change";
      refineHotkeyRecord.classList.remove("primary");
    }
    if (refineHotkeyRecording) refineHotkeyRecording.classList.remove("show");
    if (refineHotkeyDisplay) refineHotkeyDisplay.classList.remove("recording");
    updateHotkeyDisplay();

    if (window._hotkeyRecorder) {
      window.removeEventListener("keydown", window._hotkeyRecorder.keyDownHandler, true);
      window.removeEventListener("keyup", window._hotkeyRecorder.keyUpHandler, true);
      delete window._hotkeyRecorder;
    }
  }

  // Profile wizard
  function openWizard(existing) {
    console.log("[promptiply] openWizard called");
    wizardState = {
      step: 1,
      editingId: existing?.id || null,
      name: existing?.name || "",
      persona: existing?.persona || "",
      tone: existing?.tone || "",
      guidelines: existing?.styleGuidelines || [],
    };

    const profileModal = document.getElementById("profile-modal");
    const onboardingModal = document.getElementById("onboarding-modal");
    try {
      onboardingModal?.classList.remove("modal-show");
    } catch (_) {}
    profileModal?.classList.add("modal-show");
    setWizardStep(1);
  }

  function closeWizard() {
    const profileModal = document.getElementById("profile-modal");
    profileModal?.classList.remove("modal-show");
  }

  function setWizardStep(step) {
    wizardState.step = Math.max(1, Math.min(3, step));

    const wizardSteps = document.querySelectorAll("#profile-modal .step");
    const wizardBack = document.getElementById("wizard-back");
    const wizardNext = document.getElementById("wizard-next");
    const wizardSave = document.getElementById("wizard-save");
    const wizardBody = document.getElementById("wizard-body");

    wizardSteps.forEach((s) => s.classList.toggle("active", Number(s.dataset.step) === wizardState.step));
    wizardBack?.classList.toggle("tab-panel-hidden", wizardState.step === 1);
    wizardNext?.classList.toggle("tab-panel-hidden", wizardState.step === 3);
    wizardSave?.classList.toggle("wizard-save-hidden", wizardState.step !== 3);

    if (!wizardBody) return;
    wizardBody.innerHTML = "";

    if (wizardState.step === 1) {
      wizardBody.innerHTML = `
        <div class="field">
          <label>Name</label>
          <input id="w-name" type="text" placeholder="e.g., Technical Tutor" value="${escapeHtml(wizardState.name)}" />
        </div>
        <div class="field">
          <label>Tone</label>
          <input id="w-tone" type="text" placeholder="e.g., concise, friendly" value="${escapeHtml(wizardState.tone)}" />
        </div>
        <div class="field">
          <label>Persona</label>
          <input id="w-persona" type="text" placeholder="e.g., Senior AI Engineer" value="${escapeHtml(wizardState.persona)}" />
        </div>
      `;
    } else if (wizardState.step === 2) {
      wizardBody.innerHTML = `
        <div class="field">
          <label>Style guidelines / constraints (one per line)</label>
          <textarea id="w-guidelines">${escapeHtml(wizardState.guidelines.join("\n"))}</textarea>
        </div>
      `;
    } else {
      wizardBody.innerHTML = `
        <div class="field">
          <label>Name</label>
          <input type="text" value="${escapeHtml(wizardState.name)}" disabled />
        </div>
        <div class="field">
          <label>Tone</label>
          <input type="text" value="${escapeHtml(wizardState.tone)}" disabled />
        </div>
        <div class="field">
          <label>Persona</label>
          <input type="text" value="${escapeHtml(wizardState.persona)}" disabled />
        </div>
      `;
    }
  }

  // Onboarding wizard
  function openOnboardingWizard() {
    console.log("[promptiply] openOnboardingWizard called");
    onboardingState = {
      step: 1,
      selectedMode: "api",
      selectedProvider: "openai",
      apiKey: "",
      model: "",
      profileName: "",
      profilePersona: "",
      profileTone: "",
    };

    const onboardingModal = document.getElementById("onboarding-modal");
    onboardingModal?.classList.add("modal-show");
    setOnboardingStep(1);
    showToast("Onboarding opened");
  }

  function closeOnboardingWizard() {
    const onboardingModal = document.getElementById("onboarding-modal");
    onboardingModal?.classList.remove("modal-show");
    chrome.storage.local.set({ [STORAGE_ONBOARDING]: true });
  }

  function setOnboardingStep(step) {
    onboardingState.step = Math.max(1, Math.min(4, step));

    const onboardingSteps = document.querySelectorAll("#onboarding-modal .step");
    const onboardingBack = document.getElementById("onboarding-back");
    const onboardingNext = document.getElementById("onboarding-next");
    const onboardingFinish = document.getElementById("onboarding-finish");

    onboardingSteps.forEach((s) => s.classList.toggle("active", Number(s.dataset.step) === onboardingState.step));
    onboardingBack?.classList.toggle("tab-panel-hidden", onboardingState.step === 1);
    onboardingNext?.classList.toggle("tab-panel-hidden", onboardingState.step === 4);
    onboardingFinish?.classList.toggle("wizard-save-hidden", onboardingState.step !== 4);

    if (onboardingState.step === 1) renderModesStep();
    else if (onboardingState.step === 2) renderSetupStep();
    else if (onboardingState.step === 3) renderProfileStep();
    else renderSuccessStep();
  }

  function renderModesStep() {
    const onboardingBody = document.getElementById("onboarding-body");
    if (!onboardingBody) return;

    onboardingBody.innerHTML = `
      <div class="onboarding-section">
        <h3>Choose Your Refinement Mode</h3>
        <p>promptiply offers three ways to refine your prompts. Choose the one that fits your needs:</p>
      </div>
      <div class="mode-card ${onboardingState.selectedMode === "api" ? "selected" : ""}" data-mode="api" tabindex="0">
        <h3>API Mode</h3>
        <p>Uses your OpenAI or Anthropic API key for fast, reliable refinement. Best for regular use.</p>
        <span class="mode-badge badge-easy">Recommended</span>
      </div>
      <div class="mode-card ${onboardingState.selectedMode === "webui" ? "selected" : ""}" data-mode="webui" tabindex="0">
        <h3>WebUI Mode</h3>
        <p>Opens a background tab to ChatGPT or Claude, sends your prompt, and reads the response. No API key needed.</p>
        <span class="mode-badge badge-simple">Simple Setup</span>
      </div>
      <div class="mode-card ${onboardingState.selectedMode === "local" ? "selected" : ""}" data-mode="local" tabindex="0">
        <h3>Local Mode (Llama 3)</h3>
        <p>Runs entirely in your browser using Llama 3.1 8B model. Completely private and offline after initial download (~5GB).</p>
        <span class="mode-badge badge-private">100% Private</span>
      </div>
    `;

    onboardingBody.querySelectorAll(".mode-card").forEach((card) => {
      card.addEventListener("click", () => {
        onboardingState.selectedMode = card.dataset.mode;
        onboardingBody.querySelectorAll(".mode-card").forEach((c) => c.classList.remove("selected"));
        card.classList.add("selected");
      });
    });
  }

  function renderSetupStep() {
    const onboardingBody = document.getElementById("onboarding-body");
    if (!onboardingBody) return;

    if (onboardingState.selectedMode === "api") {
      onboardingBody.innerHTML = `
        <div class="onboarding-section">
          <h3>API Setup</h3>
          <p>To use API mode, you'll need an API key from your chosen provider. Your API key is stored locally and never leaves your device.</p>
        </div>
        <div class="field">
          <label>Provider</label>
          <select id="ob-provider">
            <option value="openai" ${onboardingState.selectedProvider === "openai" ? "selected" : ""}>OpenAI (ChatGPT)</option>
            <option value="anthropic" ${onboardingState.selectedProvider === "anthropic" ? "selected" : ""}>Anthropic (Claude)</option>
          </select>
        </div>
        <div id="ob-openai-fields" class="${onboardingState.selectedProvider === "openai" ? "" : "hidden"}">
          <div class="field">
            <label>OpenAI API Key</label>
            <input id="ob-openai-key" type="password" placeholder="sk-..." value="${escapeHtml(onboardingState.apiKey)}" />
          </div>
          <div class="field">
            <label>Model</label>
            <select id="ob-openai-model">
              <option value="gpt-5-nano">gpt-5-nano</option>
              <option value="gpt-5-mini">gpt-5-mini</option>
              <option value="gpt-5">gpt-5</option>
            </select>
          </div>
        </div>
        <div id="ob-anthropic-fields" class="${onboardingState.selectedProvider === "anthropic" ? "" : "hidden"}">
          <div class="field">
            <label>Anthropic API Key</label>
            <input id="ob-anthropic-key" type="password" placeholder="sk-ant-..." value="${escapeHtml(onboardingState.apiKey)}" />
          </div>
          <div class="field">
            <label>Model</label>
            <select id="ob-anthropic-model">
              <option value="claude-haiku-4-5">Claude Haiku 4.5</option>
              <option value="claude-sonnet-4-5">Claude Sonnet 4.5</option>
            </select>
          </div>
        </div>
        <p class="muted muted-top-margin muted-small">You can skip this step and set up your API key later in Settings.</p>
      `;

      const obProvider = document.getElementById("ob-provider");
      const obOpenaiFields = document.getElementById("ob-openai-fields");
      const obAnthropicFields = document.getElementById("ob-anthropic-fields");

      if (obProvider) {
        obProvider.addEventListener("change", () => {
          onboardingState.selectedProvider = obProvider.value;
          obOpenaiFields?.classList.toggle("hidden", obProvider.value !== "openai");
          obAnthropicFields?.classList.toggle("hidden", obProvider.value !== "anthropic");
        });
      }
    } else if (onboardingState.selectedMode === "webui") {
      onboardingBody.innerHTML = `
        <div class="onboarding-section">
          <h3>WebUI Mode Setup</h3>
          <p>WebUI mode doesn't require any API keys. Make sure you're logged into ChatGPT or Claude in your browser.</p>
          <div class="field">
            <label>Preferred provider</label>
            <select id="ob-webui-provider">
              <option value="openai" ${onboardingState.selectedProvider === "openai" ? "selected" : ""}>OpenAI (ChatGPT)</option>
              <option value="anthropic" ${onboardingState.selectedProvider === "anthropic" ? "selected" : ""}>Anthropic (Claude)</option>
            </select>
          </div>
        </div>
      `;

      const obWebuiProvider = document.getElementById("ob-webui-provider");
      if (obWebuiProvider) {
        obWebuiProvider.addEventListener("change", () => {
          onboardingState.selectedProvider = obWebuiProvider.value;
        });
      }
    } else {
      onboardingBody.innerHTML = `
        <div class="onboarding-section">
          <h3>Local Mode Setup</h3>
          <p>Local mode runs entirely in your browser. The first time you use it, Llama 3.1 8B will be downloaded (~5GB).</p>
        </div>
      `;
    }
  }

  function renderProfileStep() {
    const onboardingBody = document.getElementById("onboarding-body");
    if (!onboardingBody) return;

    onboardingBody.innerHTML = `
      <div class="onboarding-section">
        <h3>Create Your First Profile</h3>
        <p>Profiles help tailor prompt refinements to your specific needs. You can create more profiles later.</p>
      </div>
      <div class="field">
        <label>Profile Name</label>
        <input id="ob-profile-name" type="text" placeholder="e.g., Technical Tutor" value="${escapeHtml(onboardingState.profileName)}" />
      </div>
      <div class="grid">
        <div class="field">
          <label>Persona (optional)</label>
          <input id="ob-profile-persona" type="text" placeholder="e.g., Senior AI Engineer" value="${escapeHtml(onboardingState.profilePersona)}" />
        </div>
        <div class="field">
          <label>Tone (optional)</label>
          <input id="ob-profile-tone" type="text" placeholder="e.g., concise, friendly" value="${escapeHtml(onboardingState.profileTone)}" />
        </div>
      </div>
      <p class="muted muted-top-margin muted-small">You can skip profile creation and use the default settings.</p>
    `;
  }

  function renderSuccessStep() {
    const onboardingBody = document.getElementById("onboarding-body");
    if (!onboardingBody) return;

    onboardingBody.innerHTML = `
      <div class="onboarding-success">
        <img src="../icons/icon-48.png" alt="promptiply" class="icon-48" />
        <h3>You're All Set!</h3>
        <p>promptiply is ready to help you refine your prompts. Here's what you configured:</p>
        <div class="onboarding-summary">
          <div class="mb-12"><strong>Mode:</strong> ${
            onboardingState.selectedMode === "api" ? "API" :
            onboardingState.selectedMode === "webui" ? "WebUI" : "Local (Llama 3)"
          }</div>
          ${onboardingState.selectedMode === "api" && onboardingState.apiKey ?
            `<div class="mb-12"><strong>Provider:</strong> ${onboardingState.selectedProvider === "openai" ? "OpenAI" : "Anthropic"}</div>` : ""}
          ${onboardingState.profileName ?
            `<div class="mb-12"><strong>Profile:</strong> ${escapeHtml(onboardingState.profileName)}</div>` : ""}
        </div>
        <p class="mt-24">Visit <strong>chat.openai.com</strong> or <strong>claude.ai</strong> and press <strong>Alt+T</strong> to start refining your prompts!</p>
      </div>
    `;
  }

  function handleOnboardingNext() {
    if (onboardingState.step === 2 && onboardingState.selectedMode === "api") {
      const obProvider = document.getElementById("ob-provider");
      if (obProvider) onboardingState.selectedProvider = obProvider.value;

      if (onboardingState.selectedProvider === "openai") {
        const obOpenaiKey = document.getElementById("ob-openai-key");
        const obOpenaiModel = document.getElementById("ob-openai-model");
        if (obOpenaiKey) onboardingState.apiKey = obOpenaiKey.value.trim();
        if (obOpenaiModel) onboardingState.model = obOpenaiModel.value;
      } else {
        const obAnthropicKey = document.getElementById("ob-anthropic-key");
        const obAnthropicModel = document.getElementById("ob-anthropic-model");
        if (obAnthropicKey) onboardingState.apiKey = obAnthropicKey.value.trim();
        if (obAnthropicModel) onboardingState.model = obAnthropicModel.value;
      }
    } else if (onboardingState.step === 3) {
      const obProfileName = document.getElementById("ob-profile-name");
      const obProfilePersona = document.getElementById("ob-profile-persona");
      const obProfileTone = document.getElementById("ob-profile-tone");
      if (obProfileName) onboardingState.profileName = obProfileName.value.trim();
      if (obProfilePersona) onboardingState.profilePersona = obProfilePersona.value.trim();
      if (obProfileTone) onboardingState.profileTone = obProfileTone.value.trim();
    }

    setOnboardingStep(onboardingState.step + 1);
  }

  function finishOnboarding() {
    // Save settings
    chrome.storage.local.get([STORAGE_SETTINGS], (data) => {
      const settings = data[STORAGE_SETTINGS] || {};
      settings.mode = onboardingState.selectedMode;
      if (onboardingState.selectedMode === "api") {
        settings.provider = onboardingState.selectedProvider;
        if (onboardingState.apiKey) {
          if (onboardingState.selectedProvider === "openai") {
            settings.openaiKey = onboardingState.apiKey;
            settings.openaiModel = onboardingState.model || "gpt-5-nano";
          } else {
            settings.anthropicKey = onboardingState.apiKey;
            settings.anthropicModel = onboardingState.model || "claude-haiku-4-5";
          }
        }
      }
      chrome.storage.local.set({ [STORAGE_SETTINGS]: settings });
    });

    // Create profile if provided
    if (onboardingState.profileName) {
      chrome.storage.sync.get([STORAGE_PROFILES], (data) => {
        const profiles = data[STORAGE_PROFILES] || { list: [], activeProfileId: null };
        const profileId = `p_${Date.now()}`;
        const newProfile = {
          id: profileId,
          name: onboardingState.profileName,
          persona: onboardingState.profilePersona,
          tone: onboardingState.profileTone,
          styleGuidelines: [],
          constraints: [],
          examples: [],
          domainTags: [],
        };
        profiles.list.push(newProfile);
        if (!profiles.activeProfileId) profiles.activeProfileId = profileId;
        chrome.storage.sync.set({ [STORAGE_PROFILES]: profiles });
      });
    }

    chrome.storage.local.set({ [STORAGE_ONBOARDING]: true });
    closeOnboardingWizard();
    setTimeout(() => location.reload(), 300);
  }

  // Profile rendering
  function renderProfiles(p) {
    const profilesList = document.getElementById("profiles-list");
    if (!profilesList) return;

    profilesList.innerHTML = "";
    if (!p.list.length) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.innerHTML = "No profile, create new one? <br/><br/>";
      const btn = document.createElement("button");
      btn.className = "primary";
      btn.textContent = "Create Profile";
      btn.addEventListener("click", () => openWizard());
      empty.appendChild(btn);
      profilesList.appendChild(empty);
      return;
    }

    p.list.forEach((prof) => {
      const card = document.createElement("div");
      card.className = "card";
      const meta = document.createElement("div");
      meta.className = "meta";
      const title = document.createElement("div");
      title.textContent = prof.name;
      const line = document.createElement("div");
      line.className = "muted";
      line.textContent = [prof.persona, prof.tone].filter(Boolean).join(" • ");
      const chips = document.createElement("div");
      (prof.styleGuidelines || []).slice(0, 3).forEach((g) => {
        const c = document.createElement("span");
        c.className = "chip";
        c.textContent = g;
        chips.appendChild(c);
      });
      meta.appendChild(title);
      meta.appendChild(line);
      meta.appendChild(chips);
      const actions = document.createElement("div");
      const activate = document.createElement("button");
      activate.textContent = p.activeProfileId === prof.id ? "Active" : "Set Active";
      activate.addEventListener("click", () => {
        const updated = { ...p, activeProfileId: prof.id };
        chrome.storage.sync.set({ [STORAGE_PROFILES]: updated }, () => renderProfiles(updated));
      });
      const edit = document.createElement("button");
      edit.textContent = "Edit";
      edit.addEventListener("click", () => openWizard(prof));
      const del = document.createElement("button");
      del.textContent = "Delete";
      del.addEventListener("click", () => {
        const updated = { ...p, list: p.list.filter((x) => x.id !== prof.id) };
        if (updated.activeProfileId === prof.id) updated.activeProfileId = updated.list[0]?.id || null;
        chrome.storage.sync.set({ [STORAGE_PROFILES]: updated }, () => renderProfiles(updated));
      });
      actions.appendChild(activate);
      actions.appendChild(edit);
      actions.appendChild(del);
      card.appendChild(meta);
      card.appendChild(actions);
      profilesList.appendChild(card);
    });
  }

  function renderPredefinedProfiles() {
    const pre = document.getElementById("predefined-list");
    if (!pre) return;

    pre.innerHTML = "";
    PREDEFINED_PROFILES.forEach((p) => {
      const row = document.createElement("div");
      row.className = "card";
      const meta = document.createElement("div");
      meta.className = "meta";
      const title = document.createElement("div");
      title.textContent = p.name;
      const line = document.createElement("div");
      line.className = "muted";
      line.textContent = p.persona;
      meta.appendChild(title);
      meta.appendChild(line);
      const actions = document.createElement("div");
      const useBtn = document.createElement("button");
      useBtn.textContent = "Use";
      useBtn.addEventListener("click", () => importPredefinedProfile(p));
      const importBtn = document.createElement("button");
      importBtn.textContent = "Import";
      importBtn.addEventListener("click", () => importPredefinedProfile(p, { activate: false }));
      actions.appendChild(useBtn);
      actions.appendChild(importBtn);
      row.appendChild(meta);
      row.appendChild(actions);
      pre.appendChild(row);
    });
  }

  function importPredefinedProfile(pref, opts = { activate: true }) {
    chrome.storage.sync.get([STORAGE_PROFILES], (data) => {
      const cur = data[STORAGE_PROFILES] || { list: [], activeProfileId: null };
      const exists = cur.list.find((x) => x.name === pref.name);
      if (exists) {
        if (opts.activate) {
          cur.activeProfileId = exists.id;
          chrome.storage.sync.set({ [STORAGE_PROFILES]: cur }, () => renderProfiles(cur));
        }
        return;
      }
      const id = `p_${Date.now()}_${Math.floor(Math.random() * 9999)}`;
      const newP = {
        id,
        name: pref.name,
        persona: pref.persona,
        tone: pref.tone || "",
        styleGuidelines: pref.styleGuidelines || [],
        constraints: [],
        examples: [],
        domainTags: [],
        // Metadata for tracking imports
        importedFromPredefined: true,
        predefinedId: pref.id,
        importedAt: new Date().toISOString()
      };
      cur.list.push(newP);
      if (opts.activate && !cur.activeProfileId) cur.activeProfileId = newP.id;
      chrome.storage.sync.set({ [STORAGE_PROFILES]: cur }, () => {
        renderProfiles(cur);
        showToast(`Imported "${pref.name}"`);
      });
    });
  }

  function importAllPredefined() {
    PREDEFINED_PROFILES.forEach((p) => importPredefinedProfile(p, { activate: false }));
  }

  // Restore Defaults with confirmation and undo
  function showRestoreConfirmation() {
    chrome.storage.sync.get([STORAGE_PROFILES], (data) => {
      const cur = data[STORAGE_PROFILES] || { list: [], activeProfileId: null };
      const toDelete = cur.list.filter(p => p.importedFromPredefined === true);
      
      if (toDelete.length === 0) {
        showToast('No imported predefined profiles to restore');
        return;
      }

      // Create confirmation modal
      const modal = document.createElement('div');
      modal.className = 'modal modal-show';
      modal.id = 'restore-confirm-modal';
      modal.innerHTML = `
        <div class="dialog">
          <div class="title-flex">
            <img src="../icons/icon-48.png" alt="promptiply" class="icon-48" />
            <div>Restore Defaults</div>
          </div>
          <div class="onboarding-section">
            <p>This will remove <strong>${toDelete.length}</strong> imported predefined profile(s):</p>
            <div class="list" style="max-height: 200px; overflow-y: auto; margin: 16px 0;">
              ${toDelete.map(p => `
                <div class="card" style="padding: 8px 12px; margin: 4px 0;">
                  <div><strong>${escapeHtml(p.name)}</strong></div>
                  <div class="muted" style="font-size: 12px;">${escapeHtml(p.persona || '')}</div>
                </div>
              `).join('')}
            </div>
            <p class="muted">You'll be able to undo this action for 10 seconds.</p>
          </div>
          <div class="actions actions-space-between actions-top-margin">
            <button id="restore-cancel">Cancel</button>
            <button id="restore-confirm" class="primary">Restore Defaults</button>
          </div>
        </div>
      `;
      
      document.body.appendChild(modal);
      
      // Wire up buttons
      document.getElementById('restore-cancel').addEventListener('click', () => {
        modal.remove();
      });
      
      document.getElementById('restore-confirm').addEventListener('click', () => {
        modal.remove();
        restoreDefaults(toDelete);
      });
    });
  }

  function restoreDefaults(toDelete) {
    chrome.storage.sync.get([STORAGE_PROFILES], (data) => {
      const cur = data[STORAGE_PROFILES] || { list: [], activeProfileId: null };
      
      // Store for undo
      deletedProfilesUndo = [...toDelete];
      
      // Remove imported profiles
      const remaining = cur.list.filter(p => !p.importedFromPredefined);
      const updated = {
        list: remaining,
        activeProfileId: remaining.some(p => p.id === cur.activeProfileId) ? cur.activeProfileId : (remaining[0]?.id || null)
      };
      
      chrome.storage.sync.set({ [STORAGE_PROFILES]: updated }, () => {
        renderProfiles(updated);
        showUndoToast(toDelete.length);
        console.log('[promptiply] Restored defaults, removed', toDelete.length, 'profiles');
      });
    });
  }

  function showUndoToast(count) {
    // Clear any existing undo timeout
    if (undoTimeout) {
      clearTimeout(undoTimeout);
      undoTimeout = null;
    }

    const container = ensureToastContainer();
    const el = document.createElement('div');
    el.className = 'toast-undo';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.innerHTML = `
      <span>Removed ${count} profile(s)</span>
      <button id="undo-restore" style="margin-left: 12px; padding: 4px 8px; background: #fff; color: #000; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">Undo</button>
    `;
    el.style.background = 'rgba(0,0,0,0.85)';
    el.style.color = '#fff';
    el.style.padding = '12px 16px';
    el.style.borderRadius = '6px';
    el.style.marginTop = '6px';
    el.style.fontSize = '14px';
    el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.4)';
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    
    container.appendChild(el);
    
    // Wire up undo button
    document.getElementById('undo-restore').addEventListener('click', () => {
      undoRestore();
      el.remove();
    });
    
    // Auto-remove after 10 seconds
    undoTimeout = setTimeout(() => {
      try {
        el.remove();
        deletedProfilesUndo = null;
      } catch (_) {}
    }, 10000);
  }

  function undoRestore() {
    if (!deletedProfilesUndo || deletedProfilesUndo.length === 0) {
      showToast('Nothing to undo');
      return;
    }
    
    chrome.storage.sync.get([STORAGE_PROFILES], (data) => {
      const cur = data[STORAGE_PROFILES] || { list: [], activeProfileId: null };
      
      // Restore deleted profiles
      const updated = {
        list: [...cur.list, ...deletedProfilesUndo],
        activeProfileId: cur.activeProfileId
      };
      
      chrome.storage.sync.set({ [STORAGE_PROFILES]: updated }, () => {
        renderProfiles(updated);
        showToast(`Restored ${deletedProfilesUndo.length} profile(s)`);
        console.log('[promptiply] Undo restore: added back', deletedProfilesUndo.length, 'profiles');
        deletedProfilesUndo = null;
      });
    });
    
    if (undoTimeout) {
      clearTimeout(undoTimeout);
      undoTimeout = null;
    }
  }

  // Robust event binding
  function attachCoreListeners() {
    try {
      console.log("[promptiply] attachCoreListeners: attempting to bind core UI");
      let attachedAny = false;

      // Tab switching
      const tabEls = Array.from(document.querySelectorAll(".tab"));
      tabEls.forEach((t) => {
        if (!t.dataset.prAttached) {
          t.addEventListener("click", () => selectTab(t.dataset.tab));
          t.dataset.prAttached = "1";
          attachedAny = true;
        }
      });

      // Buttons
      const runBtn = document.getElementById("run-onboarding");
      if (runBtn && !runBtn.dataset.prAttached) {
        runBtn.addEventListener("click", () => {
          try {
            openOnboardingWizard();
          } catch (e) {
            console.error("openOnboardingWizard failed", e);
          }
        });
        runBtn.dataset.prAttached = "1";
        console.log("[promptiply] attachCoreListeners: bound run-onboarding");
        attachedAny = true;
      }

      const saveBtn = document.getElementById("save-settings");
      if (saveBtn && !saveBtn.dataset.prAttached) {
        saveBtn.addEventListener("click", () => {
          try {
            saveSettings();
          } catch (e) {
            console.error("saveSettings failed", e);
          }
        });
        saveBtn.dataset.prAttached = "1";
        console.log("[promptiply] attachCoreListeners: bound save-settings");
        attachedAny = true;
      }

      const saveProvBtn = document.getElementById("save-providers-settings");
      if (saveProvBtn && !saveProvBtn.dataset.prAttached) {
        saveProvBtn.addEventListener("click", () => {
          try {
            saveSettings();
          } catch (e) {
            console.error("saveProvidersSettings failed", e);
          }
        });
        saveProvBtn.dataset.prAttached = "1";
        console.log("[promptiply] attachCoreListeners: bound save-providers-settings");
        attachedAny = true;
      }

      const newProfileBtn = document.getElementById("new-profile");
      if (newProfileBtn && !newProfileBtn.dataset.prAttached) {
        newProfileBtn.addEventListener("click", () => {
          try {
            openWizard();
          } catch (e) {
            console.error("openWizard failed", e);
          }
        });
        newProfileBtn.dataset.prAttached = "1";
        console.log("[promptiply] attachCoreListeners: bound new-profile");
        attachedAny = true;
      }

      const refineHotkeyRecord = document.getElementById("refine-hotkey-record");
      if (refineHotkeyRecord && !refineHotkeyRecord.dataset.prAttached) {
        refineHotkeyRecord.addEventListener("click", () => {
          if (isRecordingHotkey) stopRecordingHotkey();
          else startRecordingHotkey();
        });
        refineHotkeyRecord.dataset.prAttached = "1";
        attachedAny = true;
      }

      // Mode change handler
      const mode = document.getElementById("mode");
      if (mode && !mode.dataset.prAttached) {
        mode.addEventListener("change", () => {
          updateProviderDisabled();
          chrome.storage.local.get([STORAGE_SETTINGS], (data) => {
            const cur = data[STORAGE_SETTINGS] || {};
            cur.mode = mode.value;
            chrome.storage.local.set({ [STORAGE_SETTINGS]: cur });
          });
        });
        mode.dataset.prAttached = "1";
        attachedAny = true;
      }

      // Model select handlers
      const openaiModelSelect = document.getElementById("openai-model-select");
      const openaiModelCustom = document.getElementById("openai-model-custom");
      if (openaiModelSelect && !openaiModelSelect.dataset.prAttached) {
        openaiModelSelect.addEventListener("change", () => {
          if (openaiModelSelect.value === "custom") {
            openaiModelCustom?.classList.remove("custom-input-hidden");
          } else {
            openaiModelCustom?.classList.add("custom-input-hidden");
          }
        });
        openaiModelSelect.dataset.prAttached = "1";
      }

      const anthropicModelSelect = document.getElementById("anthropic-model-select");
      const anthropicModelCustom = document.getElementById("anthropic-model-custom");
      if (anthropicModelSelect && !anthropicModelSelect.dataset.prAttached) {
        anthropicModelSelect.addEventListener("change", () => {
          if (anthropicModelSelect.value === "custom") {
            anthropicModelCustom?.classList.remove("custom-input-hidden");
          } else {
            anthropicModelCustom?.classList.add("custom-input-hidden");
          }
        });
        anthropicModelSelect.dataset.prAttached = "1";
      }

      // Wizard buttons
      const wizardCancel = document.getElementById("wizard-cancel");
      if (wizardCancel && !wizardCancel.dataset.prAttached) {
        wizardCancel.addEventListener("click", closeWizard);
        wizardCancel.dataset.prAttached = "1";
      }

      const wizardBack = document.getElementById("wizard-back");
      if (wizardBack && !wizardBack.dataset.prAttached) {
        wizardBack.addEventListener("click", () => setWizardStep(wizardState.step - 1));
        wizardBack.dataset.prAttached = "1";
      }

      const wizardNext = document.getElementById("wizard-next");
      if (wizardNext && !wizardNext.dataset.prAttached) {
        wizardNext.addEventListener("click", () => {
          // Capture current inputs
          if (wizardState.step === 1) {
            const name = document.getElementById("w-name")?.value?.trim();
            if (!name) return;
            wizardState.name = name;
            wizardState.persona = document.getElementById("w-persona")?.value?.trim() || "";
            wizardState.tone = document.getElementById("w-tone")?.value?.trim() || "";
          } else if (wizardState.step === 2) {
            wizardState.guidelines = (document.getElementById("w-guidelines")?.value || "")
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean);
          }
          setWizardStep(wizardState.step + 1);
        });
        wizardNext.dataset.prAttached = "1";
      }

      const wizardSave = document.getElementById("wizard-save");
      if (wizardSave && !wizardSave.dataset.prAttached) {
        wizardSave.addEventListener("click", () => {
          chrome.storage.sync.get([STORAGE_PROFILES], (data) => {
            const cur = data[STORAGE_PROFILES] || { list: [], activeProfileId: null };
            if (wizardState.editingId) {
              const idx = cur.list.findIndex((p) => p.id === wizardState.editingId);
              if (idx >= 0) {
                cur.list[idx] = {
                  ...cur.list[idx],
                  name: wizardState.name,
                  persona: wizardState.persona,
                  tone: wizardState.tone,
                  styleGuidelines: wizardState.guidelines,
                };
              }
            } else {
              const id = `p_${Date.now()}`;
              const prof = {
                id,
                name: wizardState.name,
                persona: wizardState.persona,
                tone: wizardState.tone,
                styleGuidelines: wizardState.guidelines || [],
                constraints: [],
                examples: [],
                domainTags: [],
              };
              cur.list.push(prof);
              if (!cur.activeProfileId) cur.activeProfileId = id;
            }
            chrome.storage.sync.set({ [STORAGE_PROFILES]: cur }, () => {
              renderProfiles(cur);
              closeWizard();
            });
          });
        });
        wizardSave.dataset.prAttached = "1";
      }

      // Onboarding buttons
      const onboardingSkip = document.getElementById("onboarding-skip");
      if (onboardingSkip && !onboardingSkip.dataset.prAttached) {
        onboardingSkip.addEventListener("click", closeOnboardingWizard);
        onboardingSkip.dataset.prAttached = "1";
      }

      const onboardingBack = document.getElementById("onboarding-back");
      if (onboardingBack && !onboardingBack.dataset.prAttached) {
        onboardingBack.addEventListener("click", () => setOnboardingStep(onboardingState.step - 1));
        onboardingBack.dataset.prAttached = "1";
      }

      const onboardingNext = document.getElementById("onboarding-next");
      if (onboardingNext && !onboardingNext.dataset.prAttached) {
        onboardingNext.addEventListener("click", handleOnboardingNext);
        onboardingNext.dataset.prAttached = "1";
      }

      const onboardingFinish = document.getElementById("onboarding-finish");
      if (onboardingFinish && !onboardingFinish.dataset.prAttached) {
        onboardingFinish.addEventListener("click", finishOnboarding);
        onboardingFinish.dataset.prAttached = "1";
      }

      // Import all predefined profiles button
      const importAllBtn = document.getElementById("import-all-predefined");
      if (importAllBtn && !importAllBtn.dataset.prAttached) {
        importAllBtn.addEventListener("click", importAllPredefined);
        importAllBtn.dataset.prAttached = "1";
      }

      // Restore Defaults button
      const restoreBtn = document.getElementById("restore-defaults");
      if (restoreBtn && !restoreBtn.dataset.prAttached) {
        restoreBtn.addEventListener("click", showRestoreConfirmation);
        restoreBtn.dataset.prAttached = "1";
        console.log("[promptiply] attachCoreListeners: bound restore-defaults");
      }

      const success = attachedAny && tabEls.length > 0;
      console.log("[promptiply] attachCoreListeners result:", { attachedAny, tabCount: tabEls.length, success });
      return success;
    } catch (e) {
      console.warn("attachCoreListeners error", e);
      return false;
    }
  }

  // Initialize: Try immediate, then DOMContentLoaded, then MutationObserver
  if (!attachCoreListeners()) {
    document.addEventListener("DOMContentLoaded", attachCoreListeners);
    try {
      const mo = new MutationObserver((mutations, obs) => {
        if (attachCoreListeners()) obs.disconnect();
      });
      mo.observe(document.documentElement || document.body, { childList: true, subtree: true });
      setTimeout(() => mo.disconnect(), 5000);
    } catch (_) {}
  }

  // Delegated click handler as last-resort fallback
  document.addEventListener(
    "click",
    (ev) => {
      try {
        const target = ev.target;
        if (!target || !target.closest) return;

        const tab = target.closest(".tab");
        if (tab && tab.dataset && tab.dataset.tab) {
          console.log("[promptiply] delegated tab click ->", tab.dataset.tab);
          selectTab(tab.dataset.tab);
          return;
        }

        if (target.closest("#run-onboarding")) {
          console.log("[promptiply] delegated click: run-onboarding");
          try {
            openOnboardingWizard();
          } catch (e) {
            console.error(e);
          }
          return;
        }

        if (target.closest("#save-settings")) {
          console.log("[promptiply] delegated click: save-settings");
          try {
            saveSettings();
          } catch (e) {
            console.error(e);
          }
          return;
        }

        if (target.closest("#save-providers-settings")) {
          console.log("[promptiply] delegated click: save-providers-settings");
          try {
            saveSettings();
          } catch (e) {
            console.error(e);
          }
          return;
        }

        if (target.closest("#new-profile")) {
          console.log("[promptiply] delegated click: new-profile");
          try {
            openWizard();
          } catch (e) {
            console.error(e);
          }
          return;
        }

        if (target.closest("#restore-defaults")) {
          console.log("[promptiply] delegated click: restore-defaults");
          try {
            showRestoreConfirmation();
          } catch (e) {
            console.error(e);
          }
          return;
        }
      } catch (e) {
        /* ignore */
      }
    },
    true
  );

  // Load initial data
  chrome.storage.local.get([STORAGE_SETTINGS], (data) => {
    const s = data[STORAGE_SETTINGS] || { mode: "api" };
    const mode = document.getElementById("mode");
    const provider = document.getElementById("provider");
    const openaiKey = document.getElementById("openai-key");
    const openaiModelSelect = document.getElementById("openai-model-select");
    const openaiModelCustom = document.getElementById("openai-model-custom");
    const anthropicKey = document.getElementById("anthropic-key");
    const anthropicModelSelect = document.getElementById("anthropic-model-select");
    const anthropicModelCustom = document.getElementById("anthropic-model-custom");

    if (mode) mode.value = s.mode || "api";
    if (provider) provider.value = s.provider || (s.openaiKey ? "openai" : s.anthropicKey ? "anthropic" : "openai");
    if (openaiKey) openaiKey.value = s.openaiKey || "";
    if (openaiModelSelect && openaiModelCustom) setModelSelect(openaiModelSelect, openaiModelCustom, s.openaiModel || "gpt-5-nano");
    if (anthropicKey) anthropicKey.value = s.anthropicKey || "";
    if (anthropicModelSelect && anthropicModelCustom) setModelSelect(anthropicModelSelect, anthropicModelCustom, s.anthropicModel || "claude-haiku-4-5");
    recordedHotkey = s.refineHotkey || getDefaultHotkey();
    updateHotkeyDisplay();
    updateProviderDisabled();
  });

  chrome.storage.sync.get([STORAGE_PROFILES], (data) => {
    const p = data[STORAGE_PROFILES] || { list: [], activeProfileId: null };
    renderProfiles(p);
  });

  // Load predefined profiles from storage, then render
  loadPredefinedProfiles(() => {
    renderPredefinedProfiles();
  });

  // Display version
  const versionEl = document.getElementById("version");
  if (versionEl && chrome.runtime?.getManifest) {
    const m = chrome.runtime.getManifest();
    if (m?.version) versionEl.textContent = `v${m.version}`;
  }

  // Auto-open onboarding on first load
  try {
    chrome.storage.local.get([STORAGE_ONBOARDING], (data) => {
      if (!data[STORAGE_ONBOARDING]) setTimeout(() => openOnboardingWizard(), 500);
    });
  } catch (_) {}

  console.log("[promptiply] Options script loaded");
  window.__PR_OPTIONS_LOADED = true;
})();
