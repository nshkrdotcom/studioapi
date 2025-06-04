# Chrome Extension Debug Instructions

## How to View Debug Output

1. **Open Chrome DevTools**:
   - Navigate to `https://aistudio.google.com` in Chrome
   - Press `F12` or right-click and select "Inspect" to open DevTools
   - Click on the **Console** tab

2. **Run the CLI**:
   ```bash
   python ai_studio_cli.py --prompt "What is the capital of France?"
   ```

3. **Watch Console Output**:
   All debug messages will be prefixed with `[AI Studio DEBUG]` and will show:
   - When the extension scripts load
   - Input field detection attempts
   - Prompt sending process
   - Response detection and validation
   - What text is being captured as "responses"

## Key Debug Information to Look For

- **Input Field Detection**: Shows if the extension can find the AI Studio input field
- **Prompt Sending**: Shows if the prompt is actually being entered and sent
- **Response Detection**: Shows what text the extension is finding on the page
- **Response Validation**: Shows why certain text is or isn't considered a valid AI response

## Troubleshooting Steps

1. **If no input field is found**:
   - Check if you're logged into AI Studio
   - Check if the page has fully loaded
   - Look for any error messages in the console

2. **If wrong text is captured**:
   - Look at the "Response analysis" debug output
   - Check what selectors are finding elements
   - See what text is being extracted from each element

3. **If prompt isn't being sent**:
   - Check if the send button is found
   - Look for any JavaScript errors
   - Verify the input value is being set correctly

## Expected Flow

1. `[AI Studio DEBUG] Content script loaded`
2. `[AI Studio DEBUG] Page ready, injecting script...`
3. `[AI Studio DEBUG] Page controller initialized`
4. `[AI Studio DEBUG] Processing command: SEND_PROMPT`
5. `[AI Studio DEBUG] Finding input field...`
6. `[AI Studio DEBUG] Found visible input field...`
7. `[AI Studio DEBUG] Setting input value...`
8. `[AI Studio DEBUG] Looking for send button...`
9. `[AI Studio DEBUG] Prompt sent successfully...`
10. `[AI Studio DEBUG] Checking for new responses...`
11. `[AI Studio DEBUG] New AI response detected...`

Copy the entire console output and provide it back for analysis. 