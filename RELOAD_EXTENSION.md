# How to Reload the Chrome Extension

## Quick Steps:

1. **Open Chrome Extensions page**:
   - Type `chrome://extensions/` in address bar and press Enter

2. **Find "AI Studio CLI Bridge"** in the list

3. **Click the circular reload button** (🔄) next to the extension

4. **Verify reload**:
   - Go back to `https://aistudio.google.com`
   - Open DevTools (F12 → Console tab)
   - Look for new debug messages starting with `[AI Studio DEBUG]`

## Alternative Method:

1. Toggle the extension OFF and back ON
2. Or remove and re-add the extension folder

## After Reloading:

Run the CLI command again:
```bash
python ai_studio_cli.py --prompt "What is the capital of France?"
```

The console should now show improved debug messages and filter out promotional content properly. 