// injected.js - Runs in page context for full DOM access
(function() {
  'use strict';

  class AIStudioPageController {
    constructor() {
      this.setupMessageHandler();
      this.isProcessing = false;
      this.debugMode = true;  // Enable debugging
      console.log('[AI Studio DEBUG] Page controller initialized');
    }

    setupMessageHandler() {
      window.addEventListener('message', (event) => {
        if (event.source !== window) return;
        if (event.data.source === 'ai-studio-content') {
          console.log('[AI Studio DEBUG] Received command:', event.data);
          this.handleCommand(event.data);
        }
      });
    }

    async handleCommand(message) {
      if (this.isProcessing) {
        console.log('[AI Studio DEBUG] Already processing a command, please wait...');
        return;
      }

      try {
        this.isProcessing = true;
        console.log('[AI Studio DEBUG] Processing command:', message.type);
        
        switch (message.type) {
          case 'SEND_PROMPT':
            await this.sendPrompt(message.data.prompt);
            break;
          case 'START_NEW_CHAT':
            await this.startNewChat();
            break;
          case 'CHECK_AUTH':
            await this.checkAuthentication();
            break;
        }
      } catch (error) {
        console.error('[AI Studio DEBUG] Error handling command:', error);
      } finally {
        this.isProcessing = false;
        console.log('[AI Studio DEBUG] Command processing complete');
      }
    }

    async sendPrompt(promptText) {
      try {
        console.log('[AI Studio DEBUG] Starting sendPrompt with text:', promptText.substring(0, 50) + '...');

        // Wait for any ongoing responses to complete
        console.log('[AI Studio DEBUG] Waiting for page stability...');
        await this.waitForPageStability();

        // Find and focus input field
        console.log('[AI Studio DEBUG] Finding input field...');
        const input = await this.findInputField();
        if (!input) {
          throw new Error('Could not find input field');
        }
        console.log('[AI Studio DEBUG] Found input field:', input);

        // Clear any existing content first
        console.log('[AI Studio DEBUG] Clearing input...');
        await this.clearInput(input);
        await this.sleep(500);

        // Set the prompt text
        console.log('[AI Studio DEBUG] Setting input value...');
        await this.setInputValue(input, promptText);
        await this.sleep(500);

        // Verify the text was set
        const currentValue = input.value || input.textContent || input.innerText;
        console.log('[AI Studio DEBUG] Input value after setting:', currentValue.substring(0, 50) + '...');

        // Send the prompt
        console.log('[AI Studio DEBUG] Looking for send button...');
        await this.clickSendButton();

        // Notify success
        console.log('[AI Studio DEBUG] Prompt sent successfully, notifying content script...');
        window.postMessage({
          source: 'ai-studio-injected',
          type: 'PROMPT_SENT',
          data: { prompt: promptText, timestamp: Date.now() }
        }, '*');

        return true;

      } catch (error) {
        console.error('[AI Studio DEBUG] Failed to send prompt:', error);
        throw error;
      }
    }

    async waitForPageStability() {
      console.log('[AI Studio DEBUG] Checking page stability...');
      
      // Wait for any animations or loading to complete
      let lastHeight = document.body.scrollHeight;
      let stableCount = 0;
      
      for (let i = 0; i < 10; i++) {
        await this.sleep(300);
        const currentHeight = document.body.scrollHeight;
        console.log(`[AI Studio DEBUG] Stability check ${i + 1}/10: height ${currentHeight} (was ${lastHeight})`);
        
        if (currentHeight === lastHeight) {
          stableCount++;
          if (stableCount >= 3) {
            console.log('[AI Studio DEBUG] Page appears stable');
            break; // Page seems stable
          }
        } else {
          stableCount = 0;
          lastHeight = currentHeight;
        }
      }
    }

    async findInputField() {
      const selectors = [
        // AI Studio specific selectors
        'textarea[placeholder*="Enter a prompt"]',
        'textarea[placeholder*="Message"]',
        'textarea[placeholder*="Ask"]',
        'div[contenteditable="true"][role="textbox"]',
        'textarea[aria-label*="prompt"]',
        'textarea[aria-label*="message"]',
        // More generic selectors
        'textarea:not([disabled]):not([readonly])',
        '[role="textbox"]:not([readonly])',
        'div[contenteditable="true"]:not([readonly])'
      ];

      // Try multiple times with increasing delays
      for (let attempt = 0; attempt < 5; attempt++) {
        console.log(`[AI Studio DEBUG] Input field search attempt ${attempt + 1}/5`);
        
        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          console.log(`[AI Studio DEBUG] Found ${elements.length} elements for selector: ${selector}`);
          
          for (let i = 0; i < elements.length; i++) {
            const element = elements[i];
            console.log(`[AI Studio DEBUG] Checking element ${i + 1}:`, element);
            
            if (this.isInputFieldVisible(element)) {
              console.log(`[AI Studio DEBUG] Found visible input field with selector: ${selector}`);
              return element;
            } else {
              console.log(`[AI Studio DEBUG] Element ${i + 1} not visible or not interactive`);
            }
          }
        }
        
        if (attempt < 4) {
          console.log(`[AI Studio DEBUG] Input field not found, attempt ${attempt + 1}/5, waiting...`);
          await this.sleep(1000);
        }
      }

      console.error('[AI Studio DEBUG] Could not find input field after 5 attempts');
      
      // Debug: dump current page elements
      console.log('[AI Studio DEBUG] Current page content for debugging:');
      console.log('[AI Studio DEBUG] All textareas:', document.querySelectorAll('textarea'));
      console.log('[AI Studio DEBUG] All contenteditable elements:', document.querySelectorAll('[contenteditable="true"]'));
      console.log('[AI Studio DEBUG] All role=textbox elements:', document.querySelectorAll('[role="textbox"]'));
      
      return null;
    }

    isInputFieldVisible(element) {
      if (!element) {
        console.log('[AI Studio DEBUG] Element is null/undefined');
        return false;
      }
      
      // Check if element is an actual input field
      const isTextarea = element.tagName.toLowerCase() === 'textarea';
      const isContentEditable = element.contentEditable === 'true';
      
      console.log('[AI Studio DEBUG] Element check - isTextarea:', isTextarea, 'isContentEditable:', isContentEditable);
      
      if (!isTextarea && !isContentEditable) {
        console.log('[AI Studio DEBUG] Element is not a valid input type');
        return false;
      }
      
      // Check visibility
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      
      console.log('[AI Studio DEBUG] Element dimensions:', rect);
      console.log('[AI Studio DEBUG] Element styles - display:', style.display, 'visibility:', style.visibility, 'opacity:', style.opacity);
      
      const isVisible = (
        rect.width > 0 &&
        rect.height > 0 &&
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.opacity !== '0' &&
        element.offsetParent !== null
      );

      // Check if it's not disabled or readonly
      const isInteractive = !element.disabled && !element.readOnly;
      console.log('[AI Studio DEBUG] Element interactivity - disabled:', element.disabled, 'readOnly:', element.readOnly);

      // Additional check: make sure it's in viewport or near it
      const isInViewport = (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= window.innerHeight &&
        rect.right <= window.innerWidth
      );

      const isNearViewport = rect.bottom > window.innerHeight * 0.5;

      console.log('[AI Studio DEBUG] Visibility checks - isVisible:', isVisible, 'isInteractive:', isInteractive, 'isInViewport:', isInViewport, 'isNearViewport:', isNearViewport);

      return isVisible && isInteractive && (isInViewport || isNearViewport);
    }

    async clearInput(input) {
      try {
        console.log('[AI Studio DEBUG] Clearing input field...');
        
        // Focus first
        input.focus();
        await this.sleep(100);

        if (input.tagName.toLowerCase() === 'textarea') {
          console.log('[AI Studio DEBUG] Clearing textarea...');
          // For textarea elements
          input.select();
          input.value = '';
          
          // Trigger events
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          console.log('[AI Studio DEBUG] Clearing contenteditable div...');
          // For contenteditable divs
          input.focus();
          
          // Select all content
          const range = document.createRange();
          range.selectNodeContents(input);
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
          
          // Clear content
          input.textContent = '';
          input.innerText = '';
          
          // Trigger events
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }

        await this.sleep(200);
      } catch (error) {
        console.error('Error clearing input:', error);
      }
    }

    async setInputValue(input, value) {
      try {
        // Focus the input
        input.focus();
        await this.sleep(200);
        
        if (input.tagName.toLowerCase() === 'textarea') {
          // For textarea elements
          input.value = value;
          
          // Trigger events to ensure the UI updates
          input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
          input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
          
          // Also trigger keyboard events
          input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, composed: true }));
          input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, composed: true }));
          
        } else {
          // For contenteditable divs
          input.textContent = value;
          input.innerText = value;
          
          // Set cursor to end
          const range = document.createRange();
          const selection = window.getSelection();
          range.selectNodeContents(input);
          range.collapse(false);
          selection.removeAllRanges();
          selection.addRange(range);
          
          // Trigger events
          input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
          input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
          input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, composed: true }));
          input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, composed: true }));
        }

        console.log('Input value set successfully');
        await this.sleep(300);
      } catch (error) {
        console.error('Error setting input value:', error);
        throw error;
      }
    }

    async clickSendButton() {
      const sendSelectors = [
        // AI Studio specific send button selectors
        'button[aria-label*="Send"]',
        'button[title*="Send"]',
        '[data-testid*="send"]',
        '[data-testid*="submit"]',
        // Icon-based selectors
        'button:has(svg[data-icon*="send"])',
        'button:has(svg[class*="send"])',
        'button:has([class*="send"])',
        // More generic selectors
        'button[type="submit"]',
        '.send-button',
        'button:has(svg)',
        // Form submit
        'form button[type="submit"]',
        'form button:last-child'
      ];

      console.log('Looking for send button...');

      for (const selector of sendSelectors) {
        try {
          const elements = document.querySelectorAll(selector);
          for (const element of elements) {
            if (this.isSendButtonVisible(element)) {
              console.log(`Found send button: ${selector}`);
              
              // Scroll into view if needed
              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
              await this.sleep(300);
              
              // Click the button
              element.click();
              console.log('Send button clicked');
              await this.sleep(1000);
              return true;
            }
          }
        } catch (error) {
          console.error(`Error with selector ${selector}:`, error);
        }
      }

      // Fallback: try Enter key on the input
      console.log('Send button not found, trying Enter key...');
      const input = await this.findInputField();
      if (input) {
        input.focus();
        await this.sleep(200);
        
        const enterEvent = new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13,
          bubbles: true,
          composed: true
        });
        
        input.dispatchEvent(enterEvent);
        
        // Also try keyup
        const enterUpEvent = new KeyboardEvent('keyup', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13,
          bubbles: true,
          composed: true
        });
        
        input.dispatchEvent(enterUpEvent);
        
        console.log('Enter key sent');
        await this.sleep(1000);
        return true;
      }

      throw new Error('Could not find send button or send via Enter key');
    }

    isSendButtonVisible(element) {
      if (!element) return false;
      
      // Must be a button
      if (element.tagName.toLowerCase() !== 'button' && element.role !== 'button') {
        return false;
      }
      
      // Check if disabled
      if (element.disabled || element.getAttribute('aria-disabled') === 'true') {
        return false;
      }
      
      // Check visibility
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.opacity !== '0' &&
        element.offsetParent !== null
      );
    }

    async startNewChat() {
      try {
        console.log('Starting new chat...');

        const newChatSelectors = [
          'button[aria-label*="New chat"]',
          'button[aria-label*="New conversation"]',
          'button[title*="New chat"]',
          '[data-testid*="new-chat"]',
          '[data-testid*="new-conversation"]',
          'button:contains("New chat")',
          '.new-chat-button'
        ];

        let clicked = false;
        
        for (const selector of newChatSelectors) {
          const elements = document.querySelectorAll(selector);
          for (const element of elements) {
            if (this.isElementVisible(element)) {
              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
              await this.sleep(500);
              element.click();
              clicked = true;
              break;
            }
          }
          if (clicked) break;
        }

        if (!clicked) {
          // Try finding by text content
          const buttons = document.querySelectorAll('button');
          for (const button of buttons) {
            const text = button.textContent.toLowerCase().trim();
            if ((text.includes('new') && (text.includes('chat') || text.includes('conversation'))) || 
                text === 'new' || text.includes('start')) {
              if (this.isElementVisible(button)) {
                button.scrollIntoView({ behavior: 'smooth', block: 'center' });
                await this.sleep(500);
                button.click();
                clicked = true;
                break;
              }
            }
          }
        }

        if (clicked) {
          console.log('New chat button clicked');
        } else {
          console.log('New chat button not found, continuing anyway');
        }

        await this.sleep(2000);

        window.postMessage({
          source: 'ai-studio-injected',
          type: 'NEW_CHAT_STARTED',
          data: { success: clicked, timestamp: Date.now() }
        }, '*');

        return clicked;

      } catch (error) {
        console.error('Failed to start new chat:', error);
        return false;
      }
    }

    async checkAuthentication() {
      try {
        // Check for login indicators
        const authIndicators = [
          '[data-testid*="user"]',
          '[aria-label*="Account"]',
          '[aria-label*="Profile"]',
          '.user-avatar',
          '[class*="profile"]',
          'button[aria-label*="Google Account"]',
          '[class*="account"]'
        ];

        let authenticated = false;

        for (const selector of authIndicators) {
          if (document.querySelector(selector)) {
            authenticated = true;
            break;
          }
        }

        // Also check if we can see the main chat interface
        if (!authenticated) {
          const chatIndicators = [
            'textarea[placeholder*="prompt"]',
            'textarea[placeholder*="message"]',
            '[role="textbox"]',
            '.chat-input'
          ];

          for (const selector of chatIndicators) {
            if (document.querySelector(selector)) {
              authenticated = true;
              break;
            }
          }
        }

        // Check if we're not on a login page
        if (!authenticated) {
          const loginIndicators = [
            'input[type="email"]',
            'input[type="password"]',
            'button:contains("Sign in")',
            'button:contains("Login")'
          ];

          let onLoginPage = false;
          for (const selector of loginIndicators) {
            if (document.querySelector(selector)) {
              onLoginPage = true;
              break;
            }
          }

          // If not on login page and has basic AI Studio structure, assume authenticated
          if (!onLoginPage && document.querySelector('textarea, [role="textbox"]')) {
            authenticated = true;
          }
        }

        console.log('Authentication check result:', authenticated);

        window.postMessage({
          source: 'ai-studio-injected',
          type: 'AUTH_CHECKED',
          data: { authenticated, timestamp: Date.now() }
        }, '*');

        return authenticated;

      } catch (error) {
        console.error('Failed to check authentication:', error);
        return false;
      }
    }

    isElementVisible(element) {
      if (!element) return false;
      
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.opacity !== '0' &&
        element.offsetParent !== null
      );
    }

    sleep(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }
  }

  // Initialize page controller
  new AIStudioPageController();

})();