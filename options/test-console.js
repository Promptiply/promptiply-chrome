// Promptiply Options Page Test Script
// Paste this into DevTools Console to test button functionality

(function testPromptiply() {
  console.log('%c=== Promptiply Options Test ===', 'color: blue; font-weight: bold');
  
  const tests = [];
  
  // Test 1: Check if buttons exist
  console.log('\n%c1. Checking if buttons exist...', 'color: green');
  const buttons = {
    'save-settings': document.getElementById('save-settings'),
    'save-providers-settings': document.getElementById('save-providers-settings'),
    'run-onboarding': document.getElementById('run-onboarding'),
    'new-profile': document.getElementById('new-profile')
  };
  
  Object.entries(buttons).forEach(([id, el]) => {
    if (el) {
      console.log(`  ✓ Button #${id} exists`);
      tests.push({ name: `Button #${id} exists`, passed: true });
    } else {
      console.error(`  ✗ Button #${id} NOT FOUND`);
      tests.push({ name: `Button #${id} exists`, passed: false });
    }
  });
  
  // Test 2: Check if tabs exist
  console.log('\n%c2. Checking if tabs exist...', 'color: green');
  const tabs = document.querySelectorAll('.tab');
  console.log(`  Found ${tabs.length} tab elements`);
  tabs.forEach((tab, idx) => {
    const tabName = tab.dataset.tab;
    console.log(`  ✓ Tab ${idx + 1}: ${tabName}`);
  });
  tests.push({ name: 'Tabs exist', passed: tabs.length >= 3 });
  
  // Test 3: Check if tab panels exist
  console.log('\n%c3. Checking if tab panels exist...', 'color: green');
  const panels = {
    'tab-general': document.getElementById('tab-general'),
    'tab-providers': document.getElementById('tab-providers'),
    'tab-profiles': document.getElementById('tab-profiles')
  };
  
  Object.entries(panels).forEach(([id, el]) => {
    if (el) {
      console.log(`  ✓ Panel #${id} exists`);
      tests.push({ name: `Panel #${id} exists`, passed: true });
    } else {
      console.error(`  ✗ Panel #${id} NOT FOUND`);
      tests.push({ name: `Panel #${id} exists`, passed: false });
    }
  });
  
  // Test 4: Click Save Settings button
  console.log('\n%c4. Testing Save Settings button...', 'color: green');
  if (buttons['save-settings']) {
    buttons['save-settings'].click();
    console.log('  ✓ Clicked Save Settings button');
    tests.push({ name: 'Save Settings click', passed: true });
  } else {
    console.error('  ✗ Cannot test - button not found');
    tests.push({ name: 'Save Settings click', passed: false });
  }
  
  // Test 5: Click Run Onboarding button
  console.log('\n%c5. Testing Run Onboarding Wizard button...', 'color: green');
  if (buttons['run-onboarding']) {
    buttons['run-onboarding'].click();
    console.log('  ✓ Clicked Run Onboarding Wizard button');
    
    // Check if modal appeared
    setTimeout(() => {
      const modal = document.getElementById('onboarding-modal');
      const isVisible = modal && modal.classList.contains('modal-show');
      if (isVisible) {
        console.log('  ✓ Onboarding modal opened');
        tests.push({ name: 'Onboarding modal opens', passed: true });
        // Close the modal
        const skipBtn = document.getElementById('onboarding-skip');
        if (skipBtn) skipBtn.click();
      } else {
        console.error('  ✗ Onboarding modal did NOT open');
        tests.push({ name: 'Onboarding modal opens', passed: false });
      }
    }, 100);
  } else {
    console.error('  ✗ Cannot test - button not found');
    tests.push({ name: 'Run Onboarding click', passed: false });
  }
  
  // Test 6: Switch to Providers tab
  console.log('\n%c6. Testing tab switching to Providers...', 'color: green');
  const providersTab = document.querySelector('.tab[data-tab="providers"]');
  if (providersTab) {
    providersTab.click();
    console.log('  ✓ Clicked Providers tab');
    setTimeout(() => {
      const panel = document.getElementById('tab-providers');
      const isVisible = panel && !panel.classList.contains('tab-panel-hidden');
      if (isVisible) {
        console.log('  ✓ Providers panel is visible');
        tests.push({ name: 'Providers tab switch', passed: true });
      } else {
        console.error('  ✗ Providers panel is NOT visible');
        tests.push({ name: 'Providers tab switch', passed: false });
      }
    }, 100);
  } else {
    console.error('  ✗ Cannot test - tab not found');
    tests.push({ name: 'Providers tab switch', passed: false });
  }
  
  // Test 7: Switch to Profiles tab
  console.log('\n%c7. Testing tab switching to Profiles...', 'color: green');
  const profilesTab = document.querySelector('.tab[data-tab="profiles"]');
  if (profilesTab) {
    profilesTab.click();
    console.log('  ✓ Clicked Profiles tab');
    setTimeout(() => {
      const panel = document.getElementById('tab-profiles');
      const isVisible = panel && !panel.classList.contains('tab-panel-hidden');
      if (isVisible) {
        console.log('  ✓ Profiles panel is visible');
        tests.push({ name: 'Profiles tab switch', passed: true });
      } else {
        console.error('  ✗ Profiles panel is NOT visible');
        tests.push({ name: 'Profiles tab switch', passed: false });
      }
    }, 100);
  } else {
    console.error('  ✗ Cannot test - tab not found');
    tests.push({ name: 'Profiles tab switch', passed: false });
  }
  
  // Test 8: Click New Profile button
  console.log('\n%c8. Testing New Profile button...', 'color: green');
  if (buttons['new-profile']) {
    buttons['new-profile'].click();
    console.log('  ✓ Clicked New Profile button');
    
    // Check if modal appeared
    setTimeout(() => {
      const modal = document.getElementById('profile-modal');
      const isVisible = modal && modal.classList.contains('modal-show');
      if (isVisible) {
        console.log('  ✓ Profile wizard modal opened');
        tests.push({ name: 'Profile wizard opens', passed: true });
        // Close the modal
        const cancelBtn = document.getElementById('wizard-cancel');
        if (cancelBtn) cancelBtn.click();
      } else {
        console.error('  ✗ Profile wizard modal did NOT open');
        tests.push({ name: 'Profile wizard opens', passed: false });
      }
    }, 100);
  } else {
    console.error('  ✗ Cannot test - button not found');
    tests.push({ name: 'New Profile click', passed: false });
  }
  
  // Test 9: Check storage
  console.log('\n%c9. Checking chrome.storage...', 'color: green');
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.local.get(['settings'], (data) => {
      console.log('  Settings from storage:', data.settings || 'None');
      tests.push({ name: 'Chrome storage accessible', passed: true });
    });
  } else {
    console.error('  ✗ chrome.storage not available');
    tests.push({ name: 'Chrome storage accessible', passed: false });
  }
  
  // Summary
  setTimeout(() => {
    console.log('\n%c=== Test Summary ===', 'color: blue; font-weight: bold');
    const passed = tests.filter(t => t.passed).length;
    const failed = tests.filter(t => !t.passed).length;
    console.log(`Total tests: ${tests.length}`);
    console.log(`%cPassed: ${passed}`, 'color: green; font-weight: bold');
    if (failed > 0) {
      console.log(`%cFailed: ${failed}`, 'color: red; font-weight: bold');
      console.log('\nFailed tests:');
      tests.filter(t => !t.passed).forEach(t => {
        console.error(`  ✗ ${t.name}`);
      });
    } else {
      console.log('%c✓ All tests passed!', 'color: green; font-weight: bold; font-size: 14px');
    }
  }, 500);
})();
