# Promptiply Profiles - Technical Notes

## Overview

This document explains the predefined profiles system, import/export functionality, restore defaults behavior, and recommended workflows for the Promptiply Options page.

## Predefined Profiles

### What Are Predefined Profiles?

Predefined profiles are built-in prompt refinement profiles that ship with Promptiply. They provide starting points for common use cases like technical writing, development assistance, and marketing copy.

### Built-in Profiles

The extension includes three predefined profiles:

1. **Technical Writer** - Senior Technical Writer persona, clear and concise tone
2. **Dev Helper** - Senior Software Engineer persona, concise and pragmatic tone  
3. **Marketing Copy** - Conversion-focused Marketer persona, excited and persuasive tone

### Storage and Persistence

- Predefined profiles are stored in `chrome.storage.local` under the key `predefined_profiles`
- On first load, the built-in profiles are saved to storage
- Subsequent loads retrieve profiles from storage, allowing for customization
- If storage is corrupted or missing required fields, the extension falls back to built-in defaults

### Metadata Tracking

When you import a predefined profile (via "Use" or "Import" buttons), the system adds metadata to track its origin:

```javascript
{
  id: "p_1234567890_1234",
  name: "Technical Writer",
  persona: "Senior Technical Writer",
  tone: "clear, concise",
  styleGuidelines: ["Use simple language", "Prefer examples", "No fluff"],
  // Metadata fields:
  importedFromPredefined: true,      // Identifies this as an imported predefined profile
  predefinedId: "builtin_writer",    // Original predefined profile ID
  importedAt: "2024-11-05T12:00:00Z" // Import timestamp
}
```

This metadata enables reliable identification for Restore Defaults operations.

## Restore Defaults

### What It Does

The "Restore Defaults" feature removes imported predefined profiles from your profile list, allowing you to start fresh.

### How It Works

1. **Click "Restore Defaults"** - Opens a confirmation modal
2. **Preview** - Lists all profiles that will be removed (name + persona)
3. **Confirm** - Removes only profiles with `importedFromPredefined: true`
4. **Undo** - Shows a toast with an "Undo" button for 10 seconds
5. **Cleanup** - After 10 seconds, the undo option expires

### Safety Features

- **Metadata-based deletion**: Only removes profiles marked with `importedFromPredefined: true`
- **Confirmation modal**: Preview exactly what will be deleted before proceeding
- **Undo window**: 10-second grace period to reverse the operation
- **User-created profiles are safe**: Custom profiles without the metadata flag are never deleted

### Fallback Behavior

If a profile lacks the `importedFromPredefined` metadata (legacy profiles from older versions), Restore Defaults will NOT delete it. This is a safety feature to prevent accidental data loss.

### Migration for Existing Profiles

If you have existing imported profiles without metadata:

1. They will continue to work normally
2. They won't be affected by Restore Defaults
3. To make them restorable, delete and re-import them (the new import will add metadata)

## Import/Export

### Export Format

Profiles are exported in a versioned envelope format:

```json
{
  "schemaVersion": 1,
  "exportedAt": "2024-11-05T12:00:00Z",
  "profiles": [
    {
      "id": "p_1234567890_1234",
      "name": "My Profile",
      "persona": "Expert Developer",
      "tone": "friendly, helpful",
      "styleGuidelines": ["Be concise", "Use examples"],
      "constraints": [],
      "examples": [],
      "domainTags": []
    }
  ]
}
```

### Schema Versioning

- **Current version**: 1
- **Future compatibility**: The `schemaVersion` field enables safe migrations when the format changes
- **Legacy support**: The importer can handle both the envelope format and legacy array-only formats

### Import Methods

The import modal supports three input methods:

#### 1. From URL

Load profiles directly from a URL:

```
https://example.com/my-profiles.json
```

**CORS Limitations**: 
- Browser security may block loading from some URLs
- If CORS fails, the error message suggests using file upload or paste instead
- The import modal provides clear error messages with HTTP status codes

#### 2. From File

Upload a JSON file from your computer:
- Click "Choose File" and select your `.json` export
- The file is read client-side (never uploaded to a server)

#### 3. Paste JSON

Paste JSON data directly into the text area:
- Useful when CORS blocks URL loading
- Allows quick testing with sample data
- Validates JSON syntax before import

### Import Behavior

- **Duplicate prevention**: Profiles with matching names are skipped
- **Metadata preservation**: Imported profiles retain their `importedFromPredefined` and `predefinedId` if present
- **Timestamp added**: All imports get an `importedAt` timestamp
- **Feedback**: Toast shows count of imported and skipped profiles

### Error Handling

The importer provides detailed error messages for common issues:

- **Invalid JSON**: Syntax error details
- **Unsupported schema**: Version mismatch information
- **Missing profiles array**: Format validation error
- **Network errors**: HTTP status and CORS hints
- **Missing required fields**: Validation errors for incomplete profiles

## Workflows

### Starting Fresh

To remove all imported predefined profiles and start over:

1. Navigate to Profiles tab
2. Click "Restore Defaults"
3. Review the list of profiles to be removed
4. Click "Restore Defaults" to confirm
5. If you change your mind, click "Undo" within 10 seconds

### Sharing Profiles

To share your customized profiles with others:

1. Click "Export Profiles" 
2. Save the JSON file
3. Share the file (email, cloud storage, GitHub gist, etc.)
4. Recipients click "Import Profiles" → "From File" → select your file

### URL-Based Profile Distribution

To distribute profiles via URL:

1. Export your profiles
2. Host the JSON file on a public URL (must support CORS)
3. Share the URL
4. Recipients click "Import Profiles" → "From URL" → paste URL

**Note**: Many hosting services don't support CORS. If loading fails, share the JSON content instead and have users paste it.

### Backing Up Profiles

Recommended backup workflow:

1. Export profiles monthly (or before major changes)
2. Name files with dates: `promptiply-profiles-2024-11-05.json`
3. Store in cloud storage or version control
4. Import from backup if needed

### Collaborative Profile Development

For teams developing shared profile libraries:

1. Create profiles in Promptiply
2. Export to JSON
3. Commit to version control (e.g., Git repository)
4. Team members import from repository URL or file
5. Iterate and update as needed

## Accessibility

The import/export UI includes ARIA labels and screen reader support:

- **Modal dialogs**: `role="dialog"` with `aria-labelledby`
- **Status messages**: `role="status"` with `aria-live="polite"`
- **Form fields**: Proper labels with `aria-describedby` for hints
- **Focus management**: Modal traps focus and returns it on close
- **Keyboard navigation**: All controls accessible via keyboard

## Validation

### Profile Validation

Valid profiles must have:
- `name` (string, non-empty)
- Optional fields: `persona`, `tone`, `styleGuidelines`, `constraints`, `examples`, `domainTags`

### Predefined Profiles Validation

The `validatePredefinedArray()` function ensures:
- Array type
- Each item is an object
- Each item has `id` (non-empty string)
- Each item has `name` (non-empty string)

### Import Envelope Validation

The `parseImportEnvelope()` function:
- Accepts both versioned envelopes and legacy arrays
- Validates `schemaVersion` matches expected version
- Ensures `profiles` is an array
- Provides clear error messages for invalid data

## Troubleshooting

### Restore Defaults Does Nothing

**Symptom**: Clicking "Restore Defaults" shows "No imported predefined profiles to restore"

**Cause**: Your profiles don't have the `importedFromPredefined` metadata

**Solution**: 
1. Export your existing profiles (backup)
2. Delete the profiles you want to be restorable
3. Re-import them using "Import all" or individual "Import" buttons
4. Restore Defaults will now recognize them

### CORS Errors on URL Import

**Symptom**: "Failed to load from URL" error mentioning CORS

**Cause**: The server hosting the JSON doesn't allow cross-origin requests

**Solutions**:
1. Download the file and use "From File" import
2. Copy the JSON content and use "Paste JSON" import
3. Host the file on a CORS-enabled service (e.g., GitHub raw URLs often work)

### Import Shows "No profiles found"

**Symptom**: Import succeeds but says 0 profiles imported

**Causes**:
1. The JSON has an empty `profiles` array
2. All profiles in the file already exist (name matches)

**Solutions**:
1. Verify the JSON file contains profiles
2. Check if profiles with the same names already exist
3. Rename or delete existing profiles before importing

### Undo Button Doesn't Appear

**Symptom**: After Restore Defaults, no Undo button shown

**Cause**: Toast notifications may be blocked or hidden

**Solution**: Check browser console for errors. Toast container should appear at bottom-right.

## Advanced Topics

### Custom Predefined Profiles

You can customize the built-in predefined profiles:

1. The profiles are stored in `chrome.storage.local` under `predefined_profiles`
2. Load them with `chrome.storage.local.get(['predefined_profiles'])`
3. Modify the array
4. Save with `chrome.storage.local.set({ predefined_profiles: customArray })`
5. Reload the Options page to see changes

**Warning**: Invalid data will be rejected and fall back to built-ins.

### Schema Version Migration

When `schemaVersion` changes in future releases:

1. The importer checks the version
2. If unsupported, shows an error message
3. Future versions may include migration logic
4. Old exports remain readable if migration is implemented

### Profile ID Generation

Profile IDs are generated as: `p_${timestamp}_${random4digits}`

Example: `p_1699180800000_4829`

This ensures:
- Uniqueness across devices
- Chronological sorting
- Human readability for debugging

## Security Considerations

### Storage Permissions

- Profiles are stored in `chrome.storage.sync` (syncs across devices if enabled)
- Predefined profiles are stored in `chrome.storage.local` (device-specific)
- No data is sent to external servers

### Import Safety

- All imports are client-side (no server uploads)
- JSON is parsed and validated before storage
- Malicious JSON cannot execute code (parsed safely)
- Invalid data is rejected with error messages

### Privacy

- Your profiles never leave your browser
- Export files are generated client-side
- Sharing exports is manual (you control distribution)
- No telemetry or tracking of profiles

## Future Enhancements

Potential future features (not yet implemented):

1. **Curated Gallery**: Browse and import profiles from a community gallery
2. **Profile Sharing Links**: Generate shareable links for single profiles
3. **Auto-updates**: Subscribe to profile libraries for automatic updates
4. **Conflict Resolution**: Choose which profile to keep on name conflicts
5. **Bulk Operations**: Select multiple profiles for export/delete
6. **Search and Filter**: Find profiles by tags, persona, or keywords
7. **Profile Templates**: Create new profiles from templates
8. **Version History**: Track changes to profiles over time

## Support

For issues, questions, or suggestions:

1. Check this NOTES.md file for guidance
2. Review console logs (`[promptiply]` prefix)
3. Open an issue on GitHub
4. Include export files (if relevant) for troubleshooting

---

**Last Updated**: 2024-11-05  
**Schema Version**: 1  
**Document Version**: 1.0
