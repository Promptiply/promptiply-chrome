(function(){
  // Consolidated options page script
  const STORAGE_SETTINGS = 'settings';
  const STORAGE_PROFILES = 'profiles';
  const STORAGE_ONBOARDING = 'onboarding_completed';

  // Elements
  const $mode = document.getElementById('mode');
  const $openaiKey = document.getElementById('openai-key');
  const $openaiModelSelect = document.getElementById('openai-model-select');
  const $openaiModelCustom = document.getElementById('openai-model-custom');
  const $anthropicKey = document.getElementById('anthropic-key');
  const $anthropicModelSelect = document.getElementById('anthropic-model-select');
  const $anthropicModelCustom = document.getElementById('anthropic-model-custom');
  const $provider = document.getElementById('provider');
  const $refineHotkeyText = document.getElementById('refine-hotkey-text');
  const $refineHotkeyDisplay = document.getElementById('refine-hotkey-display');
  const $refineHotkeyRecord = document.getElementById('refine-hotkey-record');
  const $refineHotkeyRecording = document.getElementById('refine-hotkey-recording');
  const $saveSettings = document.getElementById('save-settings');
  const $saveProvidersSettings = document.getElementById('save-providers-settings');

  const $profilesList = document.getElementById('profiles-list');
  const $newProfile = document.getElementById('new-profile');
  const $profileModal = document.getElementById('profile-modal');
  const $wizardBody = document.getElementById('wizard-body');
  const $wizardCancel = document.getElementById('wizard-cancel');
  const $wizardBack = document.getElementById('wizard-back');
  const $wizardNext = document.getElementById('wizard-next');
  const $wizardSave = document.getElementById('wizard-save');
  const $wizardSteps = Array.from(document.querySelectorAll('#profile-modal .step'));

  const $tabs = Array.from(document.querySelectorAll('.tab'));
  const $tabPanels = {
    general: document.getElementById('tab-general'),
    providers: document.getElementById('tab-providers'),
    profiles: document.getElementById('tab-profiles')
  };
  const $version = document.getElementById('version');

  // Onboarding elements
  const $onboardingModal = document.getElementById('onboarding-modal');
  const $onboardingBody = document.getElementById('onboarding-body');
  const $onboardingSkip = document.getElementById('onboarding-skip');
  const $onboardingBack = document.getElementById('onboarding-back');
  const $onboardingNext = document.getElementById('onboarding-next');
  const $onboardingFinish = document.getElementById('onboarding-finish');
  const $onboardingSteps = Array.from(document.querySelectorAll('#onboarding-modal .step'));
  const $runOnboarding = document.getElementById('run-onboarding');

  // State
  let isRecordingHotkey = false;
  let recordedHotkey = null;
  let wizardState = { step: 1, editingId: null, name: '', persona: '', tone: '', guidelines: [] };
  let onboardingState = { step: 1, selectedMode: 'api', selectedProvider: 'openai', apiKey: '', model: '', profileName: '', profilePersona: '', profileTone: '' };

  // Predefined profiles (example set) - can be extended
  const PREDEFINED_PROFILES = [
    { id: 'builtin_writer', name: 'Technical Writer', persona: 'Senior Technical Writer', tone: 'clear, concise', styleGuidelines: ['Use simple language','Prefer examples','No fluff'] },
    { id: 'builtin_dev', name: 'Dev Helper', persona: 'Senior Software Engineer', tone: 'concise, pragmatic', styleGuidelines: ['Show code samples','Explain with steps','Use bullet lists'] },
    { id: 'builtin_marketing', name: 'Marketing Copy', persona: 'Conversion-focused Marketer', tone: 'excited, persuasive', styleGuidelines: ['Short headlines','Call to action','A/B test variants'] }
  ];

  // Utilities
  function getDefaultHotkey() { const platform = navigator.platform.toLowerCase(); return platform.includes('mac') ? 'Ctrl+T' : 'Alt+T'; }
  function capitalize(s){ return (s||'').charAt(0).toUpperCase() + (s||'').slice(1); }
  function escapeHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  // Validation for imported predefined profiles
  function validatePredefinedArray(arr){
    if(!Array.isArray(arr)) return { valid:false, reason: 'Not an array' };
    const out = [];
    for(let i=0;i<arr.length;i++){
      const it = arr[i];
      if(!it || typeof it !== 'object') return { valid:false, reason: `Item ${i} is not an object` };
      const id = it.id && String(it.id).trim() ? String(it.id).trim() : `builtin_${Math.random().toString(36).slice(2,7)}`;
      const name = it.name && String(it.name).trim(); if(!name) return { valid:false, reason: `Item ${i} missing name` };
      const persona = it.persona ? String(it.persona) : '';
      const tone = it.tone ? String(it.tone) : '';
      const sg = Array.isArray(it.styleGuidelines) ? it.styleGuidelines.map(s=>String(s)) : (it.styleGuidelines ? String(it.styleGuidelines).split('\n').map(s=>s.trim()).filter(Boolean) : []);
      out.push({ id, name, persona, tone, styleGuidelines: sg });
    }
    return { valid:true, list: out };
  }

  // Toast helper
  // Toast helper using CSS transitions
  function showToast(message, type='success', title){
    try{
      const container = document.getElementById('toast-container'); if(!container) return alert(message);
      const t = document.createElement('div'); t.className = 'toast ' + (type==='error' ? 'error' : 'success');
      const icon = document.createElement('div'); icon.className = 'icon'; icon.textContent = type==='error' ? '!' : '✓';
      const content = document.createElement('div'); content.className = 'content'; if(title){ const h = document.createElement('div'); h.className='title'; h.textContent = title; content.appendChild(h); }
      const m = document.createElement('div'); m.textContent = message; content.appendChild(m);
      t.appendChild(icon); t.appendChild(content);
      container.appendChild(t);
      // Force a reflow then add show class to trigger transition
      window.requestAnimationFrame(()=> t.classList.add('show'));
      // Auto dismiss after 4.2s with a smooth exit
      const dismiss = ()=>{ t.classList.remove('show'); t.classList.add('exit'); setTimeout(()=>{ try{ t.remove(); }catch(_){} }, 260); };
      const timeoutId = setTimeout(dismiss, 4200);
      // allow click to dismiss
      t.addEventListener('click', ()=>{ clearTimeout(timeoutId); dismiss(); });
    } catch(e){ console.warn('toast failed', e); }
  }

  function normalizeHotkey(v){
    const t = (v||'').trim(); if(!t) return getDefaultHotkey();
    const parts = t.split('+').map(x=>x.trim()).filter(Boolean);
    const keyPart = parts.pop(); const mods = new Set(parts.map(p=>p.toLowerCase())); const order = [];
    if(mods.has('ctrl')||mods.has('control')) order.push('Ctrl');
    if(mods.has('alt')||mods.has('option')) order.push('Alt');
    if(mods.has('shift')) order.push('Shift');
    if(mods.has('meta')||mods.has('cmd')||mods.has('command')) order.push('Meta');
    const key = (keyPart||'R').length===1 ? keyPart.toUpperCase() : capitalize(keyPart);
    return [...order, key].join('+');
  }

  function formatKeyEvent(e){
    const parts = [];
    if (e.ctrlKey) parts.push('Ctrl'); if (e.altKey) parts.push('Alt'); if (e.shiftKey) parts.push('Shift'); if (e.metaKey) parts.push('Meta');
    let key = e.key; if(!key||key==='Unidentified') key = e.code?.replace(/^(Key|Digit)/,'')||'Unknown';
    const keyMap = {' ':'Space','Enter':'Enter','Escape':'Escape','Tab':'Tab','Backspace':'Backspace','Delete':'Delete'};
    if (keyMap[key]) key = keyMap[key]; else if (key.length===1) key = key.toUpperCase();
    parts.push(key); return parts.join('+');
  }

  // Tabs
  $tabs.forEach(t=>t.addEventListener('click', ()=>selectTab(t.dataset.tab)));
  function selectTab(name){ $tabs.forEach(t=>t.classList.toggle('active', t.dataset.tab===name)); Object.entries($tabPanels).forEach(([k,el])=>{ if(el){ el.classList.toggle('tab-panel-hidden', k!==name); } }); }

  // Provider disabling
  function updateProviderDisabled(){ if(!$mode||!$provider) return; const isWebUI = $mode.value==='webui'; const isLocal = $mode.value==='local'; const $providerField = $provider.closest('.field'); if($providerField) $providerField.classList.toggle('disabled', isWebUI||isLocal); }

  // Model selectors
  function setModelSelect(selectEl, customEl, value){ const opts = Array.from(selectEl.options).map(o=>o.value); if(value && opts.includes(value)){ selectEl.value = value; customEl.classList.add('custom-input-hidden'); customEl.value = ''; } else if(value){ selectEl.value = 'custom'; customEl.classList.remove('custom-input-hidden'); customEl.value = value; } else { selectEl.value = opts[0]; customEl.classList.add('custom-input-hidden'); customEl.value = ''; } }
  function getModelValue(selectEl, customEl){ return selectEl.value==='custom' ? (customEl.value.trim()||undefined) : selectEl.value; }

  // Load settings and profiles
  chrome.storage.local.get([STORAGE_SETTINGS], (data)=>{
    const s = data[STORAGE_SETTINGS]||{mode:'api'}; if($mode) $mode.value = s.mode||'api'; if($provider) $provider.value = s.provider||(s.openaiKey?'openai':(s.anthropicKey?'anthropic':'openai'));
    if($openaiKey) $openaiKey.value = s.openaiKey||''; if($openaiModelSelect && $openaiModelCustom) setModelSelect($openaiModelSelect,$openaiModelCustom,s.openaiModel||'gpt-5-nano');
    if($anthropicKey) $anthropicKey.value = s.anthropicKey||''; if($anthropicModelSelect && $anthropicModelCustom) setModelSelect($anthropicModelSelect,$anthropicModelCustom,s.anthropicModel||'claude-haiku-4-5');
    recordedHotkey = s.refineHotkey || getDefaultHotkey(); updateHotkeyDisplay(); updateProviderDisabled();
  });

  chrome.storage.sync.get([STORAGE_PROFILES], (data)=>{ const p = data[STORAGE_PROFILES]||{list:[],activeProfileId:null}; renderProfiles(p); });
  // Render built-in predefined profile list
  renderPredefinedProfiles();

  // Schema versioning for export/import
  const EXPORT_SCHEMA_VERSION = 1;
  function buildExportEnvelope(list){ return { schemaVersion: EXPORT_SCHEMA_VERSION, exportedAt: new Date().toISOString(), profiles: list }; }
  function parseImportEnvelope(obj){ // accepts either envelope or raw array
    if(!obj) return { valid:false, reason:'Empty payload' };
    if(Array.isArray(obj)) return validatePredefinedArray(obj);
    if(typeof obj === 'object' && Array.isArray(obj.profiles)) return validatePredefinedArray(obj.profiles);
    return { valid:false, reason:'Unexpected JSON shape' };
  }

  if($version && chrome.runtime?.getManifest){ const m = chrome.runtime.getManifest(); if(m?.version) $version.textContent = `v${m.version}`; }

  function saveSettings(){ const s = { mode: $mode.value, provider: $provider.value, openaiKey: $openaiKey.value.trim()||undefined, openaiModel: getModelValue($openaiModelSelect,$openaiModelCustom), anthropicKey: $anthropicKey.value.trim()||undefined, anthropicModel: getModelValue($anthropicModelSelect,$anthropicModelCustom), refineHotkey: normalizeHotkey(recordedHotkey||getDefaultHotkey()) }; chrome.storage.local.set({[STORAGE_SETTINGS]:s}); if(recordedHotkey){ recordedHotkey = s.refineHotkey; updateHotkeyDisplay(); } }
  if($saveSettings) $saveSettings.addEventListener('click', saveSettings); if($saveProvidersSettings) $saveProvidersSettings.addEventListener('click', saveSettings);
  if($mode) $mode.addEventListener('change', ()=>{ updateProviderDisabled(); chrome.storage.local.get([STORAGE_SETTINGS], (data)=>{ const cur = data[STORAGE_SETTINGS]||{}; cur.mode = $mode.value; chrome.storage.local.set({[STORAGE_SETTINGS]:cur}); }); });

  // Hotkey recording
  function updateHotkeyDisplay(){ if($refineHotkeyText) $refineHotkeyText.textContent = recordedHotkey||getDefaultHotkey(); }
  function startRecordingHotkey(){ if(isRecordingHotkey) return; isRecordingHotkey=true; if($refineHotkeyRecord) { $refineHotkeyRecord.textContent='Stop'; $refineHotkeyRecord.classList.add('primary'); } if($refineHotkeyRecording) $refineHotkeyRecording.classList.add('show'); if($refineHotkeyText) $refineHotkeyText.textContent='...'; if($refineHotkeyDisplay) $refineHotkeyDisplay.classList.add('recording');
    const keyDownHandler = (e)=>{ e.preventDefault(); e.stopPropagation(); if(['Control','Alt','Shift','Meta'].includes(e.key)) return; const combo = formatKeyEvent(e); recordedHotkey = normalizeHotkey(combo); updateHotkeyDisplay(); stopRecordingHotkey(); };
    const keyUpHandler = (e)=>{ if(e.key==='Escape') stopRecordingHotkey(); };
    window.addEventListener('keydown', keyDownHandler, true); window.addEventListener('keyup', keyUpHandler, true); window._hotkeyRecorder = {keyDownHandler,keyUpHandler};
  }
  function stopRecordingHotkey(){ if(!isRecordingHotkey) return; isRecordingHotkey=false; if($refineHotkeyRecord){ $refineHotkeyRecord.textContent='Change'; $refineHotkeyRecord.classList.remove('primary'); } if($refineHotkeyRecording) $refineHotkeyRecording.classList.remove('show'); if($refineHotkeyDisplay) $refineHotkeyDisplay.classList.remove('recording'); updateHotkeyDisplay(); if(window._hotkeyRecorder){ window.removeEventListener('keydown', window._hotkeyRecorder.keyDownHandler, true); window.removeEventListener('keyup', window._hotkeyRecorder.keyUpHandler, true); delete window._hotkeyRecorder; } }
  if($refineHotkeyRecord) $refineHotkeyRecord.addEventListener('click', ()=>{ if(isRecordingHotkey) stopRecordingHotkey(); else startRecordingHotkey(); });

  // Wizard rendering & lifecycle
  function renderProfiles(p){ if(!$profilesList) return; $profilesList.innerHTML = ''; if(!p.list.length){ const empty = document.createElement('div'); empty.className='empty'; empty.innerHTML = 'No profile, create new one? <br/><br/>'; const btn = document.createElement('button'); btn.className='primary'; btn.textContent='Create Profile'; btn.addEventListener('click', ()=>openWizard()); empty.appendChild(btn); $profilesList.appendChild(empty); return; } p.list.forEach(prof=>{ const card=document.createElement('div'); card.className='card'; const meta=document.createElement('div'); meta.className='meta'; const title=document.createElement('div'); title.textContent=prof.name; const line=document.createElement('div'); line.className='muted'; line.textContent=[prof.persona,prof.tone].filter(Boolean).join(' • '); const chips=document.createElement('div'); (prof.styleGuidelines||[]).slice(0,3).forEach(g=>{ const c=document.createElement('span'); c.className='chip'; c.textContent=g; chips.appendChild(c); }); meta.appendChild(title); meta.appendChild(line); meta.appendChild(chips); const actions=document.createElement('div'); const activate=document.createElement('button'); activate.textContent = p.activeProfileId===prof.id ? 'Active' : 'Set Active'; activate.addEventListener('click', ()=>{ const updated = {...p, activeProfileId: prof.id}; chrome.storage.sync.set({[STORAGE_PROFILES]: updated}, ()=>renderProfiles(updated)); }); const edit=document.createElement('button'); edit.textContent='Edit'; edit.addEventListener('click', ()=>openWizard(prof)); const del=document.createElement('button'); del.textContent='Delete'; del.addEventListener('click', ()=>{ const updated={...p, list: p.list.filter(x=>x.id!==prof.id)}; if(updated.activeProfileId===prof.id) updated.activeProfileId = updated.list[0]?.id||null; chrome.storage.sync.set({[STORAGE_PROFILES]: updated}, ()=>renderProfiles(updated)); }); actions.appendChild(activate); actions.appendChild(edit); actions.appendChild(del); card.appendChild(meta); card.appendChild(actions); $profilesList.appendChild(card); }); }

  // Render predefined profiles UI
  function renderPredefinedProfiles(){ const $pre = document.getElementById('predefined-list'); if(!$pre) return; $pre.innerHTML = ''; PREDEFINED_PROFILES.forEach(p=>{ const row = document.createElement('div'); row.className='card'; const meta = document.createElement('div'); meta.className='meta'; const title = document.createElement('div'); title.textContent = p.name; const line = document.createElement('div'); line.className='muted'; line.textContent = p.persona; meta.appendChild(title); meta.appendChild(line); const actions = document.createElement('div'); const useBtn = document.createElement('button'); useBtn.textContent = 'Use'; useBtn.addEventListener('click', ()=>importPredefinedProfile(p)); const importBtn = document.createElement('button'); importBtn.textContent = 'Import'; importBtn.addEventListener('click', ()=>importPredefinedProfile(p, { activate:false })); actions.appendChild(useBtn); actions.appendChild(importBtn); row.appendChild(meta); row.appendChild(actions); $pre.appendChild(row); });
    const importAll = document.getElementById('import-all-predefined'); if(importAll){ importAll.addEventListener('click', importAllPredefined); }
    // Manage button
    const manageBtn = document.getElementById('manage-predefined'); if(manageBtn){ manageBtn.addEventListener('click', openManagePredefined); }

    // File import
  const fileInput = document.getElementById('predefined-file'); if(fileInput){ fileInput.addEventListener('change', (ev)=>{ const f = ev.target.files && ev.target.files[0]; if(!f) return; const reader = new FileReader(); reader.onload = (e)=>{ try{ const raw = JSON.parse(e.target.result); const parsed = parseImportEnvelope(raw); if(parsed.valid){ PREDEFINED_PROFILES.splice(0,PREDEFINED_PROFILES.length, ...parsed.list); renderPredefinedProfiles(); showToast('Predefined profiles loaded from file','success'); } else { showToast('Invalid file: '+parsed.reason,'error'); } } catch(err){ showToast('Failed to parse JSON: '+err.message,'error'); } }; reader.readAsText(f); }); }

    // URL import
  const urlInput = document.getElementById('predefined-url'); const urlLoad = document.getElementById('predefined-url-load'); const urlSpinner = document.getElementById('predefined-url-spinner'); if(urlLoad && urlInput){ urlLoad.addEventListener('click', async ()=>{ const u = urlInput.value.trim(); if(!u) return showToast('Enter a URL to load','error'); try{ urlSpinner.hidden = false; // insert spinner (already present)
    // fetch with timeout
        const controller = new AbortController(); const timeout = setTimeout(()=>controller.abort(), 12000);
    const resp = await fetch(u, { signal: controller.signal }); clearTimeout(timeout);
        if(!resp.ok) { urlSpinner.style.display='none'; return showToast('Failed to fetch URL: '+resp.status+' '+resp.statusText,'error'); }
        const contentType = resp.headers.get('content-type') || '';
        if(!contentType.includes('application/json') && !contentType.includes('text/json')){ // still try to parse but warn
          // continue
        }
        const raw = await resp.json(); const parsed = parseImportEnvelope(raw); if(parsed.valid){ PREDEFINED_PROFILES.splice(0,PREDEFINED_PROFILES.length, ...parsed.list); renderPredefinedProfiles(); showToast('Loaded predefined profiles from URL','success'); } else { showToast('Invalid JSON from URL: '+parsed.reason,'error'); }
        urlSpinner.hidden = true;
      } catch(err){ urlSpinner.style.display='none'; if(err.name==='AbortError') showToast('Request timed out (12s)','error'); else showToast('Failed to load URL: '+err.message,'error'); } }); }

    // Export button
    const exportBtn = document.getElementById('export-predefined'); if(exportBtn){ exportBtn.addEventListener('click', ()=>{ try{ const envelope = buildExportEnvelope(PREDEFINED_PROFILES); const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'promptiply-predefined-profiles.json'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); showToast('Export started','success'); } catch(err){ showToast('Export failed: '+err.message,'error'); } }); }

    // Restore defaults with confirmation modal
    const restoreBtn = document.getElementById('restore-predefined'); const restoreModal = document.getElementById('restore-modal'); const restoreCancel = document.getElementById('restore-cancel'); const restoreConfirm = document.getElementById('restore-confirm'); const restoreDeleteImported = document.getElementById('restore-delete-imported');
    if(restoreBtn && restoreModal && restoreCancel && restoreConfirm){ restoreBtn.addEventListener('click', ()=>{ restoreModal.classList.add('modal-show'); restoreDeleteImported.checked = false; });
      restoreCancel.addEventListener('click', ()=>{ restoreModal.classList.remove('modal-show'); });
      restoreConfirm.addEventListener('click', async ()=>{
        // perform restore: replace builtins, and optionally delete imported profiles from storage
        PREDEFINED_PROFILES.splice(0,PREDEFINED_PROFILES.length, 
          { id: 'builtin_writer', name: 'Technical Writer', persona: 'Senior Technical Writer', tone: 'clear, concise', styleGuidelines: ['Use simple language','Prefer examples','No fluff'] },
          { id: 'builtin_dev', name: 'Dev Helper', persona: 'Senior Software Engineer', tone: 'concise, pragmatic', styleGuidelines: ['Show code samples','Explain with steps','Use bullet lists'] },
          { id: 'builtin_marketing', name: 'Marketing Copy', persona: 'Conversion-focused Marketer', tone: 'excited, persuasive', styleGuidelines: ['Short headlines','Call to action','A/B test variants'] }
        ); renderPredefinedProfiles();
        restoreModal.classList.remove('modal-show');
        showToast('Predefined profiles restored to defaults','success');
        if(restoreDeleteImported.checked){
          // remove profiles from chrome.storage.sync that match by name (imported ones)
          chrome.storage.sync.get([STORAGE_PROFILES], (data)=>{
            const cur = data[STORAGE_PROFILES] || { list: [], activeProfileId: null };
            const namesToRemove = new Set(['Technical Writer','Dev Helper','Marketing Copy']);
            const remaining = cur.list.filter(p=> !namesToRemove.has(p.name));
            const updated = { ...cur, list: remaining, activeProfileId: remaining[0]?.id || null };
            chrome.storage.sync.set({ [STORAGE_PROFILES]: updated }, ()=>{ renderProfiles(updated); showToast('Removed imported profiles','success'); });
          });
        }
      });
    }
  }

  // Import a predefined profile into storage (avoid id conflicts)
  function importPredefinedProfile(pref, opts={ activate:true }){
    chrome.storage.sync.get([STORAGE_PROFILES], (data)=>{
      const cur = data[STORAGE_PROFILES] || { list: [], activeProfileId: null };
      // If already exists by name, just activate or return
      const exists = cur.list.find(x=>x.name===pref.name);
      if(exists){ if(opts.activate){ cur.activeProfileId = exists.id; chrome.storage.sync.set({ [STORAGE_PROFILES]: cur }, ()=>{ renderProfiles(cur); }); } return; }
      const id = `p_${Date.now()}_${Math.floor(Math.random()*9999)}`;
      const newP = { id, name: pref.name, persona: pref.persona, tone: pref.tone||'', styleGuidelines: pref.styleGuidelines||[], constraints: [], examples: [], domainTags: [] };
      cur.list.push(newP);
      if(opts.activate && !cur.activeProfileId) cur.activeProfileId = newP.id;
      chrome.storage.sync.set({ [STORAGE_PROFILES]: cur }, ()=>{ renderProfiles(cur); });
    });
  }

  function importAllPredefined(){ PREDEFINED_PROFILES.forEach(p=> importPredefinedProfile(p,{ activate:false })); }

  // Manage predefined modal
  function openManagePredefined(){ const modal = document.getElementById('predefined-modal'); const list = document.getElementById('predefined-manage-list'); if(!modal||!list) return; list.innerHTML=''; PREDEFINED_PROFILES.forEach((p,idx)=>{ const row = document.createElement('div'); row.style.display='flex'; row.style.gap='8px'; row.style.marginBottom='8px'; const name = document.createElement('input'); name.type='text'; name.value = p.name; name.style.flex='1'; const persona = document.createElement('input'); persona.type='text'; persona.value = p.persona; persona.style.width='260px'; const del = document.createElement('button'); del.textContent='Delete'; del.addEventListener('click', ()=>{ PREDEFINED_PROFILES.splice(idx,1); openManagePredefined(); renderPredefinedProfiles(); }); row.appendChild(name); row.appendChild(persona); row.appendChild(del); list.appendChild(row); }); modal.classList.add('modal-show');
    // Build richer edit rows (name, persona, tone, guidelines textarea)
    const saveBtn = document.getElementById('predefined-manage-save'); const cancelBtn = document.getElementById('predefined-manage-cancel');
    saveBtn?.addEventListener('click', ()=>{
      const rows = Array.from(list.querySelectorAll('div')); const newList = [];
      rows.forEach((r, i)=>{
        const nameIn = r.querySelector('.m-name'); const personaIn = r.querySelector('.m-persona'); const toneIn = r.querySelector('.m-tone'); const guideIn = r.querySelector('.m-guides');
        if(nameIn && nameIn.value.trim()){
          const guides = (guideIn?.value||'').split('\n').map(s=>s.trim()).filter(Boolean);
          newList.push({ id: PREDEFINED_PROFILES[i]?.id || `builtin_${Math.random().toString(36).slice(2,7)}`, name: nameIn.value.trim(), persona: personaIn?.value.trim()||'', tone: toneIn?.value.trim()||'', styleGuidelines: guides });
        }
      });
      // Validate resulting list
      const validated = validatePredefinedArray(newList);
      if(!validated.valid){ showToast('Validation failed: '+validated.reason,'error'); return; }
      PREDEFINED_PROFILES.splice(0,PREDEFINED_PROFILES.length, ...validated.list);
      renderPredefinedProfiles(); modal.classList.remove('modal-show'); showToast('Predefined profiles updated','success');
    });
    cancelBtn?.addEventListener('click', ()=>{ modal.classList.remove('modal-show'); });
    // populate rows with richer fields
    list.innerHTML = '';
    PREDEFINED_PROFILES.forEach((p, idx)=>{
      const row = document.createElement('div'); row.style.display='flex'; row.style.gap='8px'; row.style.marginBottom='8px';
      const name = document.createElement('input'); name.type='text'; name.className='m-name'; name.value = p.name; name.style.flex='1';
      const persona = document.createElement('input'); persona.type='text'; persona.className='m-persona'; persona.value = p.persona; persona.style.width='220px';
      const tone = document.createElement('input'); tone.type='text'; tone.className='m-tone'; tone.value = p.tone||''; tone.style.width='160px';
      const guides = document.createElement('textarea'); guides.className='m-guides'; guides.placeholder = 'One guideline per line'; guides.value = (p.styleGuidelines||[]).join('\n'); guides.style.width='260px';
      const del = document.createElement('button'); del.textContent='Delete'; del.addEventListener('click', ()=>{ PREDEFINED_PROFILES.splice(idx,1); openManagePredefined(); renderPredefinedProfiles(); });
      row.appendChild(name); row.appendChild(persona); row.appendChild(tone); row.appendChild(guides); row.appendChild(del); list.appendChild(row);
    });
  }

  function openWizard(existing){ wizardState = { step:1, editingId: existing?.id||null, name: existing?.name||'', persona: existing?.persona||'', tone: existing?.tone||'', guidelines: existing?.styleGuidelines||[] }; try{ $onboardingModal?.classList.remove('modal-show'); } catch(_){} $profileModal?.classList.add('modal-show'); setWizardStep(1); }
  function closeWizard(){ $profileModal?.classList.remove('modal-show'); }

  function setWizardStep(step){ wizardState.step = Math.max(1, Math.min(3, step)); $wizardSteps.forEach(s=>s.classList.toggle('active', Number(s.dataset.step)===wizardState.step)); $wizardBack?.classList.toggle('tab-panel-hidden', wizardState.step===1); $wizardNext?.classList.toggle('tab-panel-hidden', wizardState.step===3); $wizardSave?.classList.toggle('wizard-save-hidden', wizardState.step!==3);
    // render content for current step
    if(wizardState.step===1){ $wizardBody.innerHTML = `
      <div class="grid">
        <div class="field"><label>Name</label><input id="w-name" type="text" placeholder="e.g., Technical Tutor" value="${escapeHtml(wizardState.name)}"/></div>
        <div class="field"><label>Tone</label><input id="w-tone" type="text" placeholder="e.g., concise, friendly" value="${escapeHtml(wizardState.tone)}"/></div>
      </div>
      <div class="field"><label>Persona</label><input id="w-persona" type="text" placeholder="e.g., Senior AI Engineer" value="${escapeHtml(wizardState.persona)}"/></div>
    `; }
    else if(wizardState.step===2){ $wizardBody.innerHTML = `
      <div class="field"><label>Style guidelines / constraints (one per line)</label><textarea id="w-guidelines">${escapeHtml((wizardState.guidelines||[]).join('\n'))}</textarea></div>
    `; }
    else { $wizardBody.innerHTML = `
      <div class="grid">
        <div class="field"><label>Name</label><input type="text" value="${escapeHtml(wizardState.name)}" disabled/></div>
        <div class="field"><label>Tone</label><input type="text" value="${escapeHtml(wizardState.tone)}" disabled/></div>
      </div>
      <div class="field"><label>Persona</label><input type="text" value="${escapeHtml(wizardState.persona)}" disabled/></div>
      <div class="field"><label>Guidelines</label><textarea disabled>${escapeHtml((wizardState.guidelines||[]).join('\n'))}</textarea></div>
    `; }

    // Rebind lightweight handlers for inputs in this dynamic content so state updates correctly
    const nameEl = document.getElementById('w-name'); const toneEl = document.getElementById('w-tone'); const personaEl = document.getElementById('w-persona'); const guideEl = document.getElementById('w-guidelines');
    if(nameEl) nameEl.addEventListener('input', ()=>{ wizardState.name = nameEl.value.trim(); });
    if(toneEl) toneEl.addEventListener('input', ()=>{ wizardState.tone = toneEl.value.trim(); });
    if(personaEl) personaEl.addEventListener('input', ()=>{ wizardState.persona = personaEl.value.trim(); });
    if(guideEl) guideEl.addEventListener('input', ()=>{ wizardState.guidelines = guideEl.value.split('\n').map(s=>s.trim()).filter(Boolean); });
  }

  // Wizard buttons
  $newProfile?.addEventListener('click', ()=>openWizard());
  $wizardCancel?.addEventListener('click', ()=>closeWizard());
  $wizardBack?.addEventListener('click', ()=>setWizardStep(wizardState.step-1));
  $wizardNext?.addEventListener('click', ()=>{
    // Validate and capture current inputs before moving forward
    if(wizardState.step===1){ const name = (document.getElementById('w-name')?.value||'').trim(); if(!name) { return; } wizardState.name = name; wizardState.persona = (document.getElementById('w-persona')?.value||'').trim(); wizardState.tone = (document.getElementById('w-tone')?.value||'').trim(); }
    else if(wizardState.step===2){ wizardState.guidelines = (document.getElementById('w-guidelines')?.value||'').split('\n').map(s=>s.trim()).filter(Boolean); }
    setWizardStep(wizardState.step+1);
  });

  $wizardSave?.addEventListener('click', ()=>{
    chrome.storage.sync.get([STORAGE_PROFILES], (data)=>{
      const cur = data[STORAGE_PROFILES] || { list: [], activeProfileId: null };
      if(wizardState.editingId){ const idx = cur.list.findIndex(p=>p.id===wizardState.editingId); if(idx>=0){ cur.list[idx] = { ...cur.list[idx], name: wizardState.name, persona: wizardState.persona, tone: wizardState.tone, styleGuidelines: wizardState.guidelines }; } }
      else { const id = `p_${Date.now()}`; const prof = { id, name: wizardState.name, persona: wizardState.persona, tone: wizardState.tone, styleGuidelines: wizardState.guidelines || [], constraints: [], examples: [], domainTags: [] }; cur.list.push(prof); if(!cur.activeProfileId) cur.activeProfileId = id; }
      chrome.storage.sync.set({ [STORAGE_PROFILES]: cur }, ()=>{ renderProfiles(cur); closeWizard(); });
    });
  });

  // Onboarding (enhanced)
  function openOnboardingWizard(){ onboardingState = { step:1, selectedMode:'api', selectedProvider:'openai', apiKey:'', model:'', profileName:'', profilePersona:'', profileTone:'' }; $onboardingModal?.classList.add('modal-show'); setOnboardingStep(1); }
  function closeOnboardingWizard(){ $onboardingModal?.classList.remove('modal-show'); chrome.storage.local.set({ [STORAGE_ONBOARDING]: true }); }
  function setOnboardingStep(step){ onboardingState.step = Math.max(1, Math.min(4, step)); $onboardingSteps.forEach(s=>s.classList.toggle('active', Number(s.dataset.step)===onboardingState.step)); $onboardingBack?.classList.toggle('tab-panel-hidden', onboardingState.step===1); $onboardingNext?.classList.toggle('tab-panel-hidden', onboardingState.step===4); $onboardingFinish?.classList.toggle('wizard-save-hidden', onboardingState.step!==4);
    if(onboardingState.step===1) renderModesStep(); else if(onboardingState.step===2) renderSetupStep(); else if(onboardingState.step===3) renderProfileStep(); else renderSuccessStep(); }

  function renderModesStep(){ if(!$onboardingBody) return; $onboardingBody.innerHTML = `
    <div class="onboarding-section">
      <h3>Choose Your Refinement Mode</h3>
      <p>promptiply offers three ways to refine your prompts. Choose the one that fits your needs:</p>
    </div>
    <div class="mode-card ${onboardingState.selectedMode === 'api' ? 'selected' : ''}" data-mode="api">
      <h3>API Mode</h3>
      <p>Uses your OpenAI or Anthropic API key for fast, reliable refinement. Best for regular use.</p>
      <span class="mode-badge badge-easy">Recommended</span>
    </div>
    <div class="mode-card ${onboardingState.selectedMode === 'webui' ? 'selected' : ''}" data-mode="webui">
      <h3>WebUI Mode</h3>
      <p>Opens a background tab to ChatGPT or Claude, sends your prompt, and reads the response. No API key needed.</p>
      <span class="mode-badge badge-simple">Simple Setup</span>
    </div>
    <div class="mode-card ${onboardingState.selectedMode === 'local' ? 'selected' : ''}" data-mode="local">
      <h3>Local Mode (Llama 3)</h3>
      <p>Runs entirely in your browser using Llama 3.1 8B model. Completely private and offline after initial download (~5GB).</p>
      <span class="mode-badge badge-private">100% Private</span>
    </div>
  `;

    Array.from($onboardingBody.querySelectorAll('.mode-card')).forEach(card => {
      card.addEventListener('click', () => {
        const mode = card.dataset.mode;
        onboardingState.selectedMode = mode;
        Array.from($onboardingBody.querySelectorAll('.mode-card')).forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
      });
      card.addEventListener('keydown', (ev) => { if(ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); card.click(); } });
    });
  }

  function renderSetupStep(){ if(!$onboardingBody) return;
    if(onboardingState.selectedMode === 'api'){
      $onboardingBody.innerHTML = `
        <div class="onboarding-section">
          <h3>API Setup</h3>
          <p>To use API mode, you'll need an API key from your chosen provider. Don't worry - your API key is stored locally and never leaves your device.</p>
        </div>
        <div class="field">
          <label>Provider</label>
          <select id="ob-provider">
            <option value="openai" ${onboardingState.selectedProvider === 'openai' ? 'selected' : ''}>OpenAI (ChatGPT)</option>
            <option value="anthropic" ${onboardingState.selectedProvider === 'anthropic' ? 'selected' : ''}>Anthropic (Claude)</option>
          </select>
        </div>
        <div id="ob-openai-fields" style="${onboardingState.selectedProvider === 'openai' ? '' : 'display:none;'}">
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
        <div id="ob-anthropic-fields" style="${onboardingState.selectedProvider === 'anthropic' ? '' : 'display:none;'}">
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
        <p class="muted" style="font-size:12px;margin-top:12px;">You can skip this step and set up your API key later in Settings.</p>
      `;

      const $obProvider = document.getElementById('ob-provider');
      const $obOpenaiFields = document.getElementById('ob-openai-fields');
      const $obAnthropicFields = document.getElementById('ob-anthropic-fields');

      // Ensure the select reflects current state and only the chosen provider block is visible
      if($obProvider){
        $obProvider.value = onboardingState.selectedProvider || 'openai';
        $obOpenaiFields.style.display = ($obProvider.value === 'openai') ? '' : 'none';
        $obAnthropicFields.style.display = ($obProvider.value === 'anthropic') ? '' : 'none';

        $obProvider.addEventListener('change', () => {
          onboardingState.selectedProvider = $obProvider.value;
          $obOpenaiFields.style.display = onboardingState.selectedProvider === 'openai' ? '' : 'none';
          $obAnthropicFields.style.display = onboardingState.selectedProvider === 'anthropic' ? '' : 'none';
        });
        // Pre-select model options if onboardingState.model was set
        const $obOpenaiModel = document.getElementById('ob-openai-model');
        const $obAnthropicModel = document.getElementById('ob-anthropic-model');
        if($obOpenaiModel && onboardingState.model) { Array.from($obOpenaiModel.options).forEach(o=>o.selected = (o.value===onboardingState.model)); }
        if($obAnthropicModel && onboardingState.model) { Array.from($obAnthropicModel.options).forEach(o=>o.selected = (o.value===onboardingState.model)); }
      }
    } else if (onboardingState.selectedMode === 'webui'){
      $onboardingBody.innerHTML = `
        <div class="onboarding-section">
          <h3>WebUI Mode Setup</h3>
          <p>WebUI mode doesn't require any API keys! It works by opening a background tab to ChatGPT or Claude, sending your refinement request, and reading the response.</p>
          <p>Make sure you're logged into ChatGPT or Claude in your browser, and the extension will handle the rest.</p>
        </div>
        <div class="field">
          <label>Preferred Provider</label>
          <select id="ob-webui-provider">
            <option value="chatgpt">ChatGPT (chat.openai.com)</option>
            <option value="claude">Claude (claude.ai)</option>
          </select>
        </div>
        <p class="muted" style="font-size:12px;margin-top:12px;">The extension automatically detects which site you're on and uses it for refinement.</p>
      `;
    } else {
      $onboardingBody.innerHTML = `
        <div class="onboarding-section">
          <h3>Local Mode Setup</h3>
          <p>Local mode runs entirely in your browser using Llama 3.1 8B Instruct model via web-llm. This means:</p>
          <ul style="color:var(--muted);line-height:1.8;margin:0 0 12px 0;">
            <li>Complete privacy - no data leaves your device</li>
            <li>Works offline after initial download</li>
            <li>Requires ~5GB download (one-time)</li>
            <li>Requires WebGPU support (Chrome/Edge 113+)</li>
          </ul>
          <p>The model will be downloaded when you first use local mode. A progress bar will show download status.</p>
        </div>
        <p class="muted" style="font-size:12px;margin-top:12px;">You can start using local mode after completing this wizard. The model download will begin automatically on first use.</p>
      `;
    }
  }

  function renderProfileStep(){ if(!$onboardingBody) return; $onboardingBody.innerHTML = `
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
    <p class="muted" style="font-size:12px;margin-top:12px;">You can skip profile creation and use the default settings, or create a profile later in Settings.</p>
  `;
    const n = $onboardingBody.querySelector('#ob-profile-name'); const p = $onboardingBody.querySelector('#ob-profile-persona'); const t = $onboardingBody.querySelector('#ob-profile-tone'); if(n) n.addEventListener('input', ()=>onboardingState.profileName = n.value.trim()); if(p) p.addEventListener('input', ()=>onboardingState.profilePersona = p.value.trim()); if(t) t.addEventListener('input', ()=>onboardingState.profileTone = t.value.trim()); }

  function renderSuccessStep(){ if(!$onboardingBody) return; $onboardingBody.innerHTML = `
    <div class="onboarding-success">
      <img src="../icons/icon-48.png" alt="promptiply" class="icon-48" />
      <h3>You're All Set!</h3>
      <p>promptiply is ready to help you refine your prompts. Here's what you configured:</p>
      <div style="text-align:left;margin:24px auto;max-width:400px;">
        <div style="margin-bottom:12px;"><strong>Mode:</strong> ${onboardingState.selectedMode === 'api' ? 'API' : onboardingState.selectedMode === 'webui' ? 'WebUI' : 'Local (Llama 3)'}</div>
        ${onboardingState.selectedMode === 'api' && onboardingState.apiKey ? `<div style="margin-bottom:12px;"><strong>Provider:</strong> ${onboardingState.selectedProvider === 'openai' ? 'OpenAI' : 'Anthropic'}</div>` : ''}
        ${onboardingState.profileName ? `<div style="margin-bottom:12px;"><strong>Profile:</strong> ${escapeHtml(onboardingState.profileName)}</div>` : ''}
      </div>
      <p style="margin-top:24px;">Visit <strong>chat.openai.com</strong> or <strong>claude.ai</strong> and press <strong>Alt+T</strong> (or click the Refine button) to start refining your prompts!</p>
    </div>
  `; }

  function handleOnboardingNext(){
    if(onboardingState.step === 2 && onboardingState.selectedMode === 'api'){
      const $obProvider = document.getElementById('ob-provider');
      if($obProvider) onboardingState.selectedProvider = $obProvider.value;

      if(onboardingState.selectedProvider === 'openai'){
        const $obOpenaiKey = document.getElementById('ob-openai-key');
        const $obOpenaiModel = document.getElementById('ob-openai-model');
        if($obOpenaiKey) onboardingState.apiKey = $obOpenaiKey.value.trim();
        if($obOpenaiModel) onboardingState.model = $obOpenaiModel.value;
      } else {
        const $obAnthropicKey = document.getElementById('ob-anthropic-key');
        const $obAnthropicModel = document.getElementById('ob-anthropic-model');
        if($obAnthropicKey) onboardingState.apiKey = $obAnthropicKey.value.trim();
        if($obAnthropicModel) onboardingState.model = $obAnthropicModel.value;
      }
    } else if(onboardingState.step === 3){
      const $obProfileName = document.getElementById('ob-profile-name');
      const $obProfilePersona = document.getElementById('ob-profile-persona');
      const $obProfileTone = document.getElementById('ob-profile-tone');
      if($obProfileName) onboardingState.profileName = $obProfileName.value.trim();
      if($obProfilePersona) onboardingState.profilePersona = $obProfilePersona.value.trim();
      if($obProfileTone) onboardingState.profileTone = $obProfileTone.value.trim();
    }

    setOnboardingStep(onboardingState.step+1);
  }

  // Enhanced: prevent moving forward from step 1 without selecting a mode
  function handleOnboardingNextWrapper(){
    if(onboardingState.step===1){ if(!onboardingState.selectedMode){ // show temporary hint
        const hint = document.createElement('div'); hint.className='onboarding-hint'; hint.textContent = 'Please choose a mode to continue.'; const container = $onboardingBody.querySelector('.onboarding-section'); if(container){ const existing = container.querySelector('.onboarding-hint'); if(!existing) container.appendChild(hint); setTimeout(()=>{ try{ hint.remove(); }catch(_){} }, 2800); }
        return; } }
    handleOnboardingNext();
  }

  // Replace listener to use wrapper
  if($onboardingNext){ $onboardingNext.removeEventListener('click', handleOnboardingNext); $onboardingNext.addEventListener('click', handleOnboardingNextWrapper); }
  

  function finishOnboarding(){
    // Save settings
    chrome.storage.local.get([STORAGE_SETTINGS], (data)=>{
      const settings = data[STORAGE_SETTINGS] || {};
      settings.mode = onboardingState.selectedMode;
      if(onboardingState.selectedMode === 'api'){
        settings.provider = onboardingState.selectedProvider;
        if(onboardingState.apiKey){
          if(onboardingState.selectedProvider === 'openai'){
            settings.openaiKey = onboardingState.apiKey;
            settings.openaiModel = onboardingState.model || 'gpt-5-nano';
          } else {
            settings.anthropicKey = onboardingState.apiKey;
            settings.anthropicModel = onboardingState.model || 'claude-haiku-4-5';
          }
        }
      }
      chrome.storage.local.set({ [STORAGE_SETTINGS]: settings });
    });

    // Create profile if provided
    if(onboardingState.profileName){
      chrome.storage.sync.get([STORAGE_PROFILES], (data)=>{
        const profiles = data[STORAGE_PROFILES] || { list: [], activeProfileId: null };
        const profileId = `p_${Date.now()}`;
        const newProfile = { id: profileId, name: onboardingState.profileName, persona: onboardingState.profilePersona, tone: onboardingState.profileTone, styleGuidelines: [], constraints: [], examples: [], domainTags: [] };
        profiles.list.push(newProfile);
        if(!profiles.activeProfileId) profiles.activeProfileId = profileId;
        chrome.storage.sync.set({ [STORAGE_PROFILES]: profiles }, ()=>{ renderProfiles(profiles); });
      });
    }

    // Mark onboarding complete
    chrome.storage.local.set({ [STORAGE_ONBOARDING]: true });
    closeOnboardingWizard();
    // Reload to apply settings
    setTimeout(()=> location.reload(), 300);
  }

  // Auto-open onboarding on first load if not completed
  try{ chrome.storage.local.get([STORAGE_ONBOARDING], (data)=>{ if(!data[STORAGE_ONBOARDING]) setTimeout(()=>openOnboardingWizard(), 500); }); } catch(_){}

  // Bind onboarding controls
  if($runOnboarding) $runOnboarding.addEventListener('click', ()=>openOnboardingWizard());
  $onboardingSkip?.addEventListener('click', ()=>closeOnboardingWizard());
  $onboardingBack?.addEventListener('click', ()=>setOnboardingStep(onboardingState.step-1));
  // ensure the Next button uses the wrapper (validation) handler
  $onboardingNext?.addEventListener('click', handleOnboardingNextWrapper);
  $onboardingFinish?.addEventListener('click', finishOnboarding);

  // Start onboarding helper exposed for runtime messages
  function startOnboarding(){ try{ $profileModal?.classList.remove('modal-show'); } catch(_){} if($onboardingModal) { openOnboardingWizard(); } else { // fallback: reuse profile wizard
    // show profile modal as a fallback onboarding path
    openWizard(); } }
  try{ window.startOnboarding = startOnboarding; } catch(_){}
  try{ chrome.runtime.onMessage.addListener((msg,sender,sendResponse)=>{ if(msg && msg.type==='PR_START_ONBOARDING'){ startOnboarding(); sendResponse && sendResponse({ok:true}); } }); } catch(_){}

  // Draft helpers
  function saveOnboardingDraft(){ const draft = { wizardState, timestamp: Date.now() }; chrome.storage.local.set({ onboardingDraft: draft }); }
  function loadOnboardingDraft(cb){ chrome.storage.local.get(['onboardingDraft'], (data)=>{ const d = data.onboardingDraft; if(d && d.wizardState) cb(d.wizardState); else cb(null); }); }

  // Hotkey helper referenced earlier: implement formatKeyEvent now
  function formatKeyEvent(e){ const parts=[]; if(e.ctrlKey) parts.push('Ctrl'); if(e.altKey) parts.push('Alt'); if(e.shiftKey) parts.push('Shift'); if(e.metaKey) parts.push('Meta'); let key = e.key; if(!key||key==='Unidentified') key = e.code?.replace(/^(Key|Digit)/,'')||'Unknown'; const keyMap={' ':'Space','Enter':'Enter','Escape':'Escape','Tab':'Tab','Backspace':'Backspace','Delete':'Delete'}; if(keyMap[key]) key=keyMap[key]; else if(key.length===1) key=key.toUpperCase(); parts.push(key); return parts.join('+'); }

  // Diagnostic: detect duplicate IDs in the DOM and show a visible banner to help debugging duplicate UI
  try {
    document.addEventListener('DOMContentLoaded', () => {
      try {
        const idCount = {};
        Array.from(document.querySelectorAll('[id]')).forEach(el => {
          const id = el.id;
          if (!id) return;
          idCount[id] = (idCount[id] || 0) + 1;
        });
        const duplicates = Object.entries(idCount).filter(([k, v]) => v > 1);
        if (duplicates.length) {
          const banner = document.createElement('div');
          banner.style.background = '#ffcc00';
          banner.style.color = '#000';
          banner.style.padding = '8px 12px';
          banner.style.position = 'fixed';
          banner.style.top = '8px';
          banner.style.right = '8px';
          banner.style.zIndex = 9999;
          banner.style.borderRadius = '6px';
          banner.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
          banner.textContent = `Duplicate DOM IDs detected: ${duplicates.map(d => d[0] + '(' + d[1] + ')').join(', ')}`;
          document.body.appendChild(banner);
          console.warn('[promptiply] duplicate DOM IDs', duplicates);
        }
      } catch (e) {
        console.warn('[promptiply] duplicate id check failed', e);
      }
    });
  } catch (e) {
    /* ignore */
  }

})();


