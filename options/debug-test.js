// Diagnostic test script - paste in DevTools Console

console.log('=== DIAGNOSTIC TEST START ===');

// Check if buttons exist
console.log('1. Button Elements:');
console.log('  restore-defaults:', document.getElementById('restore-defaults'));
console.log('  import-profiles:', document.getElementById('import-profiles'));
console.log('  export-profiles:', document.getElementById('export-profiles'));

// Check if they have event listeners attached (data-pr-attached attribute)
console.log('\n2. Event Listener Attachment Status:');
const restoreBtn = document.getElementById('restore-defaults');
const importBtn = document.getElementById('import-profiles');
const exportBtn = document.getElementById('export-profiles');

if (restoreBtn) console.log('  restore-defaults.dataset.prAttached:', restoreBtn.dataset.prAttached);
if (importBtn) console.log('  import-profiles.dataset.prAttached:', importBtn.dataset.prAttached);
if (exportBtn) console.log('  export-profiles.dataset.prAttached:', exportBtn.dataset.prAttached);

// Try clicking them directly
console.log('\n3. Testing Direct Clicks:');
if (restoreBtn) {
  console.log('  Clicking restore-defaults...');
  restoreBtn.click();
}

setTimeout(() => {
  if (importBtn) {
    console.log('  Clicking import-profiles...');
    importBtn.click();
  }
}, 500);

setTimeout(() => {
  if (exportBtn) {
    console.log('  Clicking export-profiles...');
    exportBtn.click();
  }
}, 1000);

console.log('\n=== DIAGNOSTIC TEST END ===');
console.log('Watch for modals to appear. If they don\'t, check the Network and Console tabs for errors.');
