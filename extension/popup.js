// popup.js - Extension popup interface
class PopupController {
  constructor() {
    this.init();
  }

  async init() {
    await this.updateStatus();
    this.setupEventListeners();
    this.loadStats();
    
    // Update status every 3 seconds
    setInterval(() => this.updateStatus(), 3000);
  }

  setupEventListeners() {
    document.getElementById('startNewChat').addEventListener('click', () => {
      this.startNewChat();
    });

    document.getElementById('testConnection').addEventListener('click', () => {
      this.testConnection();
    });
  }

  async updateStatus() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const isOnAIStudio = tab?.url?.includes('aistudio.google.com');

      const statusIndicator = document.getElementById('statusIndicator');
      const statusText = document.getElementById('statusText');

      if (isOnAIStudio) {
        statusIndicator.className = 'status-indicator connected';
        statusText.textContent = 'Connected to AI Studio';
      } else {
        statusIndicator.className = 'status-indicator disconnected';
        statusText.textContent = 'Navigate to aistudio.google.com';
      }

    } catch (error) {
      console.error('Error updating status:', error);
      document.getElementById('statusIndicator').className = 'status-indicator disconnected';
      document.getElementById('statusText').textContent = 'Connection Error';
    }
  }

  async startNewChat() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab?.url?.includes('aistudio.google.com')) {
        alert('Please navigate to aistudio.google.com first');
        return;
      }

      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: () => {
          window.postMessage({
            source: 'ai-studio-content',
            type: 'START_NEW_CHAT'
          }, '*');
          return { success: true };
        }
      });

      const button = document.getElementById('startNewChat');
      const originalText = button.textContent;
      button.textContent = 'Chat Started!';
      button.disabled = true;
      
      setTimeout(() => {
        button.textContent = originalText;
        button.disabled = false;
      }, 2000);

    } catch (error) {
      console.error('Error starting new chat:', error);
      alert('Failed to start new chat. Make sure you\'re on AI Studio.');
    }
  }

  async testConnection() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab?.url?.includes('aistudio.google.com')) {
        alert('Please navigate to aistudio.google.com first');
        return;
      }

      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: () => {
          return {
            url: window.location.href,
            hasInputField: !!document.querySelector('textarea[placeholder*="prompt"], [role="textbox"]'),
            timestamp: new Date().toISOString()
          };
        }
      });

      const testResult = results[0].result;
      
      let message = 'Connection Test Results:\n\n';
      message += `URL: ${testResult.url}\n`;
      message += `Input field: ${testResult.hasInputField ? '✅' : '❌'}\n`;
      message += `Time: ${testResult.timestamp}\n\n`;
      
      if (testResult.hasInputField) {
        message += 'Connection ready! 🚀\n\n';
        message += 'You can now run the Python CLI:\n';
        message += 'python ai_studio_cli.py';
      } else {
        message += 'Please make sure AI Studio is fully loaded.';
      }

      alert(message);

    } catch (error) {
      console.error('Error testing connection:', error);
      alert('Connection test failed: ' + error.message);
    }
  }

  async loadStats() {
    try {
      const result = await chrome.storage.local.get(['promptCount', 'responseCount']);
      
      document.getElementById('promptCount').textContent = result.promptCount || 0;
      document.getElementById('responseCount').textContent = result.responseCount || 0;

    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }
}

// Initialize popup controller when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});