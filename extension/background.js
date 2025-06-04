// background.js - Service Worker for command processing
class AIStudioBridge {
  constructor() {
    this.isActive = false;
    this.commandCheckInterval = null;
    this.init();
  }

  init() {
    console.log('[AI Studio DEBUG] Background script loaded');
    
    // Handle extension startup
    chrome.runtime.onStartup.addListener(() => {
      this.startCommandMonitoring();
    });

    chrome.runtime.onInstalled.addListener(() => {
      this.startCommandMonitoring();
    });

    // Handle messages from content script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log('[AI Studio DEBUG] Background received message:', message.type);
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep channel open for async response
    });

    this.startCommandMonitoring();
  }

  startCommandMonitoring() {
    if (this.commandCheckInterval) return;
    
    this.isActive = true;
    console.log('[AI Studio DEBUG] Starting command monitoring via HTTP...');
    
    // Check for commands every 500ms for responsiveness
    this.commandCheckInterval = setInterval(() => {
      this.checkForCommands();
    }, 500);
    
    // Update badge
    chrome.action.setBadgeText({ text: 'ON' });
    chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
  }

  async checkForCommands() {
    try {
      // Poll the Python CLI's HTTP server for commands
      const response = await fetch('http://localhost:8889/api/command', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        const command = await response.json();
        if (command && command.type) {
          console.log('[AI Studio DEBUG] Found command via HTTP:', command);
          await this.processCommand(command);
        } else {
          // Show heartbeat every 10 seconds (20 polls * 500ms = 10s)
          if (!this.pollCount) this.pollCount = 0;
          this.pollCount++;
          if (this.pollCount % 20 === 0) {
            console.log('[AI Studio DEBUG] ❤️ Heartbeat - polling for commands...');
          }
        }
      } else {
        // Show heartbeat every 10 seconds when CLI not running
        if (!this.pollCount) this.pollCount = 0;
        this.pollCount++;
        if (this.pollCount % 20 === 0) {
          console.log('[AI Studio DEBUG] ❤️ Heartbeat - CLI not running, continuing to poll...');
        }
      }
    } catch (error) {
      // Show heartbeat every 10 seconds when connection fails
      if (!this.pollCount) this.pollCount = 0;
      this.pollCount++;
      if (this.pollCount % 20 === 0) {
        console.log('[AI Studio DEBUG] ❤️ Heartbeat - waiting for CLI to start...');
      }
    }
  }

  async processCommand(command) {
    console.log('[AI Studio DEBUG] Processing command:', command.type);
    
    try {
      switch (command.type) {
        case 'SEND_PROMPT':
          await this.sendPromptToActiveTab(command.data);
          break;
        case 'START_NEW_CHAT':
          await this.startNewChatInActiveTab();
          break;
        case 'CHECK_AUTH':
          await this.checkAuthenticationInActiveTab();
          break;
        case 'TEST_COMMAND':
          console.log('[AI Studio DEBUG] Test command received:', command.data);
          break;
      }
    } catch (error) {
      console.error('[AI Studio DEBUG] Error processing command:', error);
    }
  }

  async sendPromptToActiveTab(promptData) {
    console.log('[AI Studio DEBUG] Sending prompt to active tab:', promptData);
    
    // First try active tab
    let tabs = await chrome.tabs.query({ 
      active: true, 
      url: 'https://aistudio.google.com/*' 
    });
    
    // If no active AI Studio tab, try any AI Studio tab
    if (tabs.length === 0) {
      console.log('[AI Studio DEBUG] No active AI Studio tab found, trying any AI Studio tab...');
      tabs = await chrome.tabs.query({ url: 'https://aistudio.google.com/*' });
    }
    
    if (tabs.length === 0) {
      console.error('[AI Studio DEBUG] No AI Studio tabs found at all');
      this.sendErrorResponse('No AI Studio tabs found');
      return;
    }
    
    // Try each tab until one works
    for (let i = 0; i < tabs.length; i++) {
      const tab = tabs[i];
      console.log(`[AI Studio DEBUG] Trying tab ${i + 1}/${tabs.length}: ${tab.title}`);
      
      try {
        // Send message with response handling
        const response = await chrome.tabs.sendMessage(tab.id, {
          type: 'SEND_PROMPT',
          data: promptData
        });
        
        console.log('[AI Studio DEBUG] Message sent successfully to tab:', tab.title);
        return; // Success!
        
      } catch (error) {
        console.log(`[AI Studio DEBUG] Failed to send to tab ${i + 1}: ${error.message}`);
        
        if (i === tabs.length - 1) {
          // This was the last tab and it failed
          console.error('[AI Studio DEBUG] All tabs failed, sending error response');
          this.sendErrorResponse('Failed to communicate with any AI Studio tab. Please reload the page.');
        }
      }
    }
  }

  async startNewChatInActiveTab() {
    const tabs = await chrome.tabs.query({ 
      active: true, 
      url: 'https://aistudio.google.com/*' 
    });
    
    if (tabs.length > 0) {
      chrome.tabs.sendMessage(tabs[0].id, {
        type: 'START_NEW_CHAT'
      });
    }
  }

  async checkAuthenticationInActiveTab() {
    const tabs = await chrome.tabs.query({ 
      active: true, 
      url: 'https://aistudio.google.com/*' 
    });
    
    if (tabs.length > 0) {
      chrome.tabs.sendMessage(tabs[0].id, {
        type: 'CHECK_AUTH'
      });
    }
  }

  async handleMessage(message, sender, sendResponse) {
    try {
      switch (message.type) {
        case 'RESPONSE_RECEIVED':
          console.log('[AI Studio DEBUG] Response received, sending to Python...');
          await this.sendResponseToPython(message.data);
          sendResponse({ success: true });
          break;
        case 'AUTH_STATUS':
          console.log('[AI Studio DEBUG] Auth status received:', message.data);
          sendResponse({ success: true, authenticated: message.data.authenticated });
          break;
        default:
          console.log('[AI Studio DEBUG] Unknown message type:', message.type);
          sendResponse({ error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('[AI Studio DEBUG] Error handling message:', error);
      sendResponse({ error: error.message });
    }
  }

  async sendResponseToPython(responseData) {
    try {
      console.log('[AI Studio DEBUG] Sending response to Python CLI:', responseData.content.substring(0, 50) + '...');
      
      // Send to Python CLI via HTTP
      const response = await fetch('http://localhost:8889/api/response', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: responseData.content,
          timestamp: new Date().toISOString(),
          metadata: responseData.metadata || {}
        })
      });
      
      if (response.ok) {
        console.log('[AI Studio DEBUG] Response sent to Python successfully');
      } else {
        console.error('[AI Studio DEBUG] Failed to send response to Python:', response.status);
      }
    } catch (error) {
      console.error('[AI Studio DEBUG] Failed to send response to Python:', error);
    }
  }

  sendErrorResponse(errorMessage) {
    console.log('[AI Studio DEBUG] Sending error response to Python CLI:', errorMessage);
    
    // Send error response to Python CLI
    fetch('http://localhost:8889/api/response', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: `ERROR: ${errorMessage}`,
        timestamp: new Date().toISOString(),
        metadata: { error: true }
      })
    }).catch(err => {
      console.error('[AI Studio DEBUG] Failed to send error to Python CLI:', err);
    });
  }
}

// Initialize the bridge
new AIStudioBridge();