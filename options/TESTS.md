# Profile Management Tests

This document provides test cases and validation scripts for the profile management features.

## Quick Console Tests

### Test Import/Export

Paste this in the DevTools Console to test export/import functionality:

```javascript
// Test 1: Export profiles
console.log('Test 1: Export profiles');
document.getElementById('export-profiles')?.click();
console.log('✓ Export button clicked - check for download');

// Test 2: Open import modal
setTimeout(() => {
  console.log('\nTest 2: Import modal');
  document.getElementById('import-profiles')?.click();
  setTimeout(() => {
    const modal = document.getElementById('import-modal');
    if (modal && modal.classList.contains('modal-show')) {
      console.log('✓ Import modal opened');
      // Close it
      document.getElementById('import-cancel')?.click();
      console.log('✓ Import modal closed');
    } else {
      console.error('✗ Import modal did not open');
    }
  }, 500);
}, 1000);
```

### Test Restore Defaults

```javascript
// Test restore defaults flow
console.log('Test: Restore Defaults');
document.getElementById('restore-defaults')?.click();

setTimeout(() => {
  const modal = document.getElementById('restore-confirm-modal');
  if (modal) {
    console.log('✓ Restore confirmation modal opened');
    // Cancel it (don't actually delete)
    document.getElementById('restore-cancel')?.click();
    console.log('✓ Restore cancelled');
  } else {
    console.log('ℹ No imported profiles to restore, or modal failed to open');
  }
}, 500);
```

### Test Profile Import from JSON

```javascript
// Test importing a profile from JSON
const testProfile = {
  schemaVersion: 1,
  exportedAt: new Date().toISOString(),
  profiles: [{
    name: "Test Profile " + Date.now(),
    persona: "Test Persona",
    tone: "friendly",
    styleGuidelines: ["Test guideline 1", "Test guideline 2"]
  }]
};

// Open import modal
document.getElementById('import-profiles')?.click();

setTimeout(() => {
  // Paste JSON
  const jsonInput = document.getElementById('import-json');
  if (jsonInput) {
    jsonInput.value = JSON.stringify(testProfile, null, 2);
    console.log('✓ Test JSON pasted');
    
    // Click import (uncomment to actually import)
    // document.getElementById('import-execute')?.click();
    // console.log('✓ Import executed');
    
    // Close modal
    document.getElementById('import-cancel')?.click();
    console.log('✓ Test complete - modal closed (import not executed)');
  }
}, 500);
```

## Validation Function Tests

### Test validatePredefinedArray()

The validation function is not exported, but we can test the behavior indirectly by checking storage:

```javascript
// Check predefined profiles in storage
chrome.storage.local.get(['predefined_profiles'], (data) => {
  console.log('Predefined profiles in storage:', data.predefined_profiles);
  
  if (data.predefined_profiles) {
    const isValid = Array.isArray(data.predefined_profiles) &&
                   data.predefined_profiles.every(p => 
                     p && 
                     typeof p === 'object' &&
                     typeof p.id === 'string' &&
                     typeof p.name === 'string' &&
                     p.id.length > 0 &&
                     p.name.length > 0
                   );
    
    console.log(isValid ? '✓ Validation passed' : '✗ Validation failed');
  } else {
    console.log('ℹ No predefined profiles in storage');
  }
});
```

### Test parseImportEnvelope()

Test various import formats:

```javascript
// Test valid v1 envelope
const validEnvelope = {
  schemaVersion: 1,
  exportedAt: "2024-11-05T12:00:00Z",
  profiles: [
    { name: "Test", persona: "Tester" }
  ]
};

// Test legacy array format
const legacyFormat = [
  { name: "Test", persona: "Tester" }
];

// Test invalid format
const invalidFormat = { foo: "bar" };

// Test unsupported version
const futureVersion = {
  schemaVersion: 999,
  profiles: []
};

console.log('Test parsing formats:');
console.log('1. Valid envelope:', validEnvelope);
console.log('2. Legacy array:', legacyFormat);
console.log('3. Invalid format:', invalidFormat);
console.log('4. Future version:', futureVersion);
console.log('\nPaste JSON into import modal to test actual parsing');
```

## Manual Test Checklist

### Restore Defaults Tests

- [ ] **Test 1: No imported profiles**
  1. Ensure no imported profiles exist
  2. Click "Restore Defaults"
  3. Expected: Toast says "No imported predefined profiles to restore"

- [ ] **Test 2: With imported profiles**
  1. Import at least one predefined profile
  2. Click "Restore Defaults"
  3. Expected: Confirmation modal shows with profile list
  4. Click "Cancel"
  5. Expected: Modal closes, profiles unchanged

- [ ] **Test 3: Confirm restore**
  1. Import a predefined profile
  2. Click "Restore Defaults"
  3. Click "Restore Defaults" in modal
  4. Expected: Modal closes, toast shows "Removed N profile(s)" with Undo button
  5. Verify: Imported profile removed from list

- [ ] **Test 4: Undo restore**
  1. Import a predefined profile
  2. Restore defaults
  3. Click "Undo" button in toast (within 10 seconds)
  4. Expected: Profile restored, toast says "Restored N profile(s)"

- [ ] **Test 5: Undo timeout**
  1. Import a predefined profile
  2. Restore defaults
  3. Wait 10 seconds
  4. Expected: Undo toast disappears, undo no longer possible

- [ ] **Test 6: User profiles safe**
  1. Create a custom profile (not imported)
  2. Import a predefined profile
  3. Restore defaults
  4. Expected: Only imported profile removed, custom profile remains

### Import/Export Tests

- [ ] **Test 7: Export profiles**
  1. Create or import at least one profile
  2. Click "Export Profiles"
  3. Expected: JSON file downloads
  4. Open file and verify structure (schemaVersion, exportedAt, profiles)

- [ ] **Test 8: Import from file**
  1. Export profiles (Test 7)
  2. Click "Import Profiles"
  3. Select "From File"
  4. Choose exported file
  5. Click "Import"
  6. Expected: Success message with count (may skip duplicates)

- [ ] **Test 9: Import from JSON**
  1. Copy JSON from an export file
  2. Click "Import Profiles"
  3. Paste into "Paste JSON" textarea
  4. Click "Import"
  5. Expected: Success message with count

- [ ] **Test 10: Import from URL (valid)**
  1. Host an export JSON on a public URL with CORS enabled
  2. Click "Import Profiles"
  3. Paste URL into "From URL" field
  4. Click "Import"
  5. Expected: Success message with count

- [ ] **Test 11: Import from URL (CORS blocked)**
  1. Use a URL that doesn't support CORS
  2. Click "Import Profiles"
  3. Paste URL
  4. Click "Import"
  5. Expected: Error message mentioning CORS, suggests alternatives

- [ ] **Test 12: Invalid JSON**
  1. Click "Import Profiles"
  2. Paste invalid JSON (e.g., `{broken`)
  3. Click "Import"
  4. Expected: Error message "Invalid JSON: ..."

- [ ] **Test 13: Future schema version**
  1. Create JSON with `schemaVersion: 999`
  2. Import via paste
  3. Expected: Error "Unsupported schema version: 999"

- [ ] **Test 14: Duplicate names**
  1. Export profiles
  2. Import the same file again
  3. Expected: "Imported 0 profile(s), skipped N duplicate(s)"

### Accessibility Tests

- [ ] **Test 15: Keyboard navigation**
  1. Tab through all buttons and inputs
  2. Expected: All controls reachable via keyboard
  3. Press Enter on buttons
  4. Expected: Buttons activate

- [ ] **Test 16: Modal focus trap**
  1. Open import or restore modal
  2. Press Tab repeatedly
  3. Expected: Focus cycles within modal
  4. Press Escape
  5. Expected: Modal closes

- [ ] **Test 17: Screen reader labels**
  1. Inspect modal elements
  2. Verify `role="dialog"`, `aria-labelledby` present
  3. Verify form labels have `for` or `aria-label`
  4. Verify status messages have `role="status"`, `aria-live`

### Persistence Tests

- [ ] **Test 18: Predefined profiles persist**
  1. Open Options page
  2. Note predefined profiles shown
  3. Reload page
  4. Expected: Same predefined profiles shown

- [ ] **Test 19: Imported metadata persists**
  1. Import a predefined profile
  2. Export profiles
  3. Check JSON for `importedFromPredefined`, `predefinedId`, `importedAt`
  4. Expected: Metadata fields present

## Automated Test Suite

For developers, here's a more comprehensive test that can be run in the console:

```javascript
(async function runTests() {
  const results = [];
  
  function test(name, fn) {
    try {
      fn();
      results.push({ name, status: 'PASS' });
      console.log(`✓ ${name}`);
    } catch (e) {
      results.push({ name, status: 'FAIL', error: e.message });
      console.error(`✗ ${name}:`, e.message);
    }
  }
  
  console.log('%c=== Profile Management Test Suite ===', 'color: blue; font-weight: bold');
  
  // Test 1: Buttons exist
  test('Buttons exist', () => {
    const buttons = ['export-profiles', 'import-profiles', 'restore-defaults', 'new-profile'];
    buttons.forEach(id => {
      if (!document.getElementById(id)) {
        throw new Error(`Button #${id} not found`);
      }
    });
  });
  
  // Test 2: Predefined profiles rendered
  test('Predefined profiles rendered', () => {
    const list = document.getElementById('predefined-list');
    if (!list) throw new Error('Predefined list not found');
    const cards = list.querySelectorAll('.card');
    if (cards.length === 0) throw new Error('No predefined profiles rendered');
  });
  
  // Test 3: Export button clickable
  test('Export button clickable', () => {
    const btn = document.getElementById('export-profiles');
    if (!btn || btn.disabled) throw new Error('Export button not clickable');
  });
  
  // Test 4: Import modal opens
  test('Import modal opens', () => {
    document.getElementById('import-profiles')?.click();
    setTimeout(() => {
      const modal = document.getElementById('import-modal');
      if (!modal || !modal.classList.contains('modal-show')) {
        throw new Error('Import modal did not open');
      }
      document.getElementById('import-cancel')?.click();
    }, 100);
  });
  
  // Test 5: Check storage structure
  test('Storage structure valid', (done) => {
    chrome.storage.local.get(['predefined_profiles'], (data) => {
      if (!data.predefined_profiles) {
        throw new Error('No predefined profiles in storage');
      }
      if (!Array.isArray(data.predefined_profiles)) {
        throw new Error('Predefined profiles not an array');
      }
    });
  });
  
  // Summary
  setTimeout(() => {
    console.log('\n%c=== Test Summary ===', 'color: blue; font-weight: bold');
    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    console.log(`Total: ${results.length}, Passed: ${passed}, Failed: ${failed}`);
    
    if (failed > 0) {
      console.log('\n%cFailed tests:', 'color: red; font-weight: bold');
      results.filter(r => r.status === 'FAIL').forEach(r => {
        console.error(`  ✗ ${r.name}: ${r.error}`);
      });
    } else {
      console.log('\n%c✓ All tests passed!', 'color: green; font-weight: bold; font-size: 14px');
    }
  }, 1000);
})();
```

## Edge Cases to Test

1. **Empty profile list**: Export when no profiles exist
2. **Very large import**: Import 100+ profiles
3. **Network timeout**: URL import with slow/failing server
4. **Malformed JSON**: Various invalid JSON formats
5. **Missing required fields**: Profiles without name/persona
6. **Special characters**: Profile names with emojis, Unicode, HTML
7. **Concurrent operations**: Export while import modal open
8. **Rapid clicks**: Click Restore Defaults multiple times quickly
9. **Browser refresh during operation**: Reload during import
10. **Storage quota**: Import when approaching storage limit

## Performance Tests

1. **Import large file**: Time to import 1000 profiles
2. **Render speed**: Time to render 100 profiles in list
3. **Export speed**: Time to export 1000 profiles
4. **Validation speed**: Time to validate 1000 profiles

## Security Tests

1. **XSS in profile names**: Create profile with `<script>alert('xss')</script>` as name
2. **JSON injection**: Try importing malicious JSON structures
3. **File size limits**: Import extremely large files (>10MB)
4. **Infinite loops**: Circular references in import data

---

**Note**: These tests are designed for manual execution in Chrome DevTools. For automated testing, consider setting up a test harness with Chrome Extensions API mocks.
