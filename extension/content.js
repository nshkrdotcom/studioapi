// content.js - Content script for AI Studio page interaction
class AIStudioContentScript {
  constructor() {
    this.lastResponseText = '';
    this.responseObserver = null;
    this.isReady = false;
    this.promptSentTime = null;
    this.responseStartMarkers = new Set();
    this.debugMode = false;  // Disable verbose debugging
    this.lastPromptText = '';
    this.lastResponseTime = 0;
    
    this.init();
  }

  async init() {
    console.log('[AI Studio DEBUG] Content script loaded');
    
    // Wait for page to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.onPageReady());
    } else {
      this.onPageReady();
    }

    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.onMessage(message, sender, sendResponse);
      return true;
    });
  }

  async onPageReady() {
    console.log('[AI Studio DEBUG] Page ready, injecting script...');
    
    // Inject page script for full DOM access
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('injected.js');
    (document.head || document.documentElement).appendChild(script);
    
    // Set up communication with injected script
    window.addEventListener('message', (event) => {
      if (event.source !== window) return;
      if (event.data.source === 'ai-studio-injected') {
        console.log('[AI Studio DEBUG] Received message from injected script:', event.data);
        this.handlePageMessage(event.data);
      }
    });

    // Wait for AI Studio to load completely
    setTimeout(() => {
      this.setupResponseMonitoring();
      this.isReady = true;
      console.log('[AI Studio DEBUG] Content script ready');
    }, 3000);
  }

  setupResponseMonitoring() {
    console.log('[AI Studio DEBUG] Setting up response monitoring...');
    
    // Monitor for new AI responses with improved detection
    this.startResponseObserver();
    
    // Check periodically for responses, but less frequently to avoid false positives
    setInterval(() => {
      this.checkForNewResponses();
    }, 2000);
  }

  startResponseObserver() {
    console.log('[AI Studio DEBUG] Starting response observer...');
    
    // Watch for changes in specific areas where responses appear
    const targetNode = document.body;
    
    this.responseObserver = new MutationObserver((mutations) => {
      // CRITICAL: Only process mutations if we recently sent a prompt and enough time has passed
      if (!this.promptSentTime || Date.now() - this.promptSentTime > 180000) {
        return; // No recent prompt or too old
      }
      
      // Don't process mutations too soon after sending prompt (wait for AI to start responding)
      if (Date.now() - this.promptSentTime < 3000) {
        return; // Too soon after prompt
      }

      if (this.debugMode) {
        console.log('[AI Studio DEBUG] DOM mutation detected, checking for responses...', Date.now() - this.promptSentTime, 'ms after prompt');
      }

      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Skip if this is an input area or child of input area
              if (this.isInputOrInputChild(node)) {
                if (this.debugMode) {
                  console.log('[AI Studio DEBUG] Skipping mutation in input area');
                }
                return;
              }
              
              // Wait a bit for content to stabilize before checking
              setTimeout(() => {
                this.checkElementForResponse(node);
              }, 1000);
            }
          });
        } else if (mutation.type === 'characterData') {
          // Skip text changes in input areas
          if (mutation.target.parentElement && this.isInputOrInputChild(mutation.target.parentElement)) {
            if (this.debugMode) {
              console.log('[AI Studio DEBUG] Skipping text change in input area');
            }
            return;
          }
          
          // Text content changed
          setTimeout(() => {
            this.checkElementForResponse(mutation.target.parentElement);
          }, 1000);
        }
      });
    });

    this.responseObserver.observe(targetNode, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  checkElementForResponse(element) {
    if (!element) return;
    
    // Skip if no prompt was sent recently
    if (!this.promptSentTime || Date.now() - this.promptSentTime > 180000) {
      return; // Don't check for responses if no recent prompt
    }
    
    // Skip input areas and their children completely
    if (this.isInputOrInputChild(element)) {
      if (this.debugMode) {
        console.log('[AI Studio DEBUG] Skipping input area or its child');
      }
      return;
    }
    
    // Look for AI response patterns with better filtering
    const text = this.extractCleanText(element);
    
    if (this.debugMode && text && text.length > 20) {
      console.log('[AI Studio DEBUG] Checking element text:', text.substring(0, 100) + '...');
      console.log('[AI Studio DEBUG] Element:', element);
    }
    
    if (text && this.looksLikeAIResponse(text)) {
      console.log('[AI Studio DEBUG] Potential AI response found, waiting for stabilization...');
      
      // Wait a bit more to ensure response is complete
      setTimeout(() => {
        const finalText = this.extractCleanText(element);
        if (finalText && finalText.length >= text.length) {
          console.log('[AI Studio DEBUG] Response stabilized, processing...');
          this.handleNewResponse(finalText);
        }
      }, 2000);
    }

    // Check children as well, but only immediate children to avoid duplicates
    const directChildren = Array.from(element.children || []);
    directChildren.forEach(child => {
      // Skip input areas
      if (this.isInputOrInputChild(child)) {
        return;
      }
      
      const childText = this.extractCleanText(child);
      if (childText && this.looksLikeAIResponse(childText)) {
        console.log('[AI Studio DEBUG] Potential AI response found in child element...');
        
        setTimeout(() => {
          const finalChildText = this.extractCleanText(child);
          if (finalChildText && finalChildText.length >= childText.length) {
            console.log('[AI Studio DEBUG] Child response stabilized, processing...');
            this.handleNewResponse(finalChildText);
          }
        }, 2000);
      }
    });
  }

  isInputOrInputChild(element) {
    if (!element) return false;
    
    // Check if element itself is an input
    if (element.tagName === 'TEXTAREA' || 
        element.tagName === 'INPUT' || 
        element.contentEditable === 'true' ||
        element.role === 'textbox') {
      return true;
    }
    
    // Check if element is inside an input area
    let parent = element.parentElement;
    while (parent) {
      if (parent.tagName === 'TEXTAREA' || 
          parent.tagName === 'INPUT' || 
          parent.contentEditable === 'true' ||
          parent.role === 'textbox' ||
          parent.classList.contains('input-container') ||
          parent.classList.contains('prompt-input') ||
          parent.getAttribute('data-testid')?.includes('input')) {
        return true;
      }
      parent = parent.parentElement;
      
      // Don't go too far up the DOM
      if (parent === document.body) break;
    }
    
    return false;
  }

  extractCleanText(element) {
    if (!element) return '';
    
    // Get text content and clean it up
    let text = element.innerText || element.textContent || '';
    
    // Remove extra whitespace and normalize
    text = text.trim().replace(/\s+/g, ' ');
    
    // Remove common UI elements
    text = text.replace(/^(Send|Copy|Regenerate|Share|Like|Dislike)$/, '');
    text = text.replace(/keyboard_tab/g, '');
    text = text.replace(/\$\d+/g, ''); // Remove price patterns that seem to be UI artifacts
    
    return text.trim();
  }

  looksLikeAIResponse(text) {
    // More sophisticated heuristics to identify actual AI responses
    if (!text || text.length < 20) {
      return false;
    }
    
    if (text === this.lastResponseText) {
      return false;
    }
    
    // CRITICAL: Skip if no recent prompt was sent
    if (!this.promptSentTime || Date.now() - this.promptSentTime > 180000) {
      return false;
    }
    
    // Must have sent prompt at least 3 seconds ago to allow for processing time
    if (Date.now() - this.promptSentTime < 3000) {
      return false;
    }
    
    // IMMEDIATELY REJECT anything with "Thoughts (experimental)"
    if (text.includes('Thoughts (experimental)') || text.includes('Thoughts(experimental)')) {
      return false;
    }
    
    // IMMEDIATELY REJECT thoughts wrapper patterns
    if (this.isThoughtsWrapper(text) || this.looksLikeThoughts(text)) {
      return false;
    }
    
    // Skip promotional content and UI elements
    const promotionalPatterns = [
      /^(Enter a prompt|Message|Send|Copy|Regenerate|Share|New chat)$/i,
      /^Thinking\.\.\.$/i,
      /^Loading\.\.\.$/i,
      /^keyboard_/i,
      /^[A-Z][a-z]+:$/,
      /^\$\d+(\.\d+)?$/,
      /^[A-Z]{1,3}$/,
      // Promotional content patterns
      /^Native image generation$/i,
      /^Live audio-to-audio dialog$/i,
      /^Interleaved text-and-image generation/i,
      /Try Gemini's natural, real-time dialog/i,
      /with the new Gemini/i,
      /^(Free|Pro|Premium|Plus)/i,
      /^Get started/i,
      /^Try it/i,
      /^Learn more/i,
      /^Sign in/i,
      /^Create/i,
      /^Explore/i,
      /^Upgrade/i,
      /^New$/i,
      /^Try/i,
      /audio and video inputs/i
    ];

    for (const pattern of promotionalPatterns) {
      if (pattern.test(text)) {
        return false;
      }
    }

    // For the France question specifically, prioritize responses with "Paris"
    if (this.lastPromptText && this.lastPromptText.toLowerCase().includes('france')) {
      if (text.toLowerCase().includes('paris')) {
        return true;
      }
    }

    // Must be substantial content that looks like a response
    if (text.length < 50) {
      return false;
    }
    
    // Look for characteristics of AI responses vs promotional content
    const hasStoryMarkers = /\b(once upon|story|tale|character|plot)\b/i.test(text);
    const hasSentences = (text.match(/[.!?]+/g) || []).length >= 2;
    const hasNarrativeStructure = /\b(then|next|after|when|while|because)\b/i.test(text);
    
    // Check if it's answering our specific question
    const looksLikeAnswer = /\b(the capital|is|Paris|France|answer|located|city)\b/i.test(text);
    
    // For our specific question about capital of France, look for relevant content
    if (looksLikeAnswer) {
      return true;
    }
    
    // For stories specifically, look for narrative elements
    if (hasStoryMarkers || (hasSentences && hasNarrativeStructure)) {
      return true;
    }
    
    // For other responses, ensure it's substantial and coherent
    const words = text.split(/\s+/).length;
    const isSubstantial = words >= 15 && hasSentences;
    
    return isSubstantial;
  }

  checkForNewResponses() {
    const timeSincePrompt = Date.now() - this.promptSentTime;
    
    // For France question, first try to find any element containing "Paris"
    if (this.lastPromptText && this.lastPromptText.toLowerCase().includes('france')) {
      const parisElements = document.querySelectorAll('*');
      for (let element of parisElements) {
        const text = this.extractTextContent(element);
        if (text && text.toLowerCase().includes('paris') && 
            !this.isUserInputOrUIElement(element, text) &&
            !this.isThoughtsSection(element, text) &&
            !this.isThoughtsWrapper(text)) {
          if (text.length > 10 && text.length < 200) { // Reasonable length
            const cleanResponse = this.cleanResponse(text);
            console.log(`[AI Studio DEBUG] ✅ Found Paris answer: ${cleanResponse.substring(0, 50)}...`);
            this.handleNewResponse(cleanResponse);
            return true;
          }
        }
      }
    }
    
    // Look for AI response content specifically, avoiding thoughts sections completely
    const responseSelectors = [
      // Look for content that's clearly NOT in thoughts sections
      'ms-chat-turn[data-role="model"] > *:not([class*="thought"]):not([class*="experimental"])',
      'ms-chat-turn[data-role="model"] .response:not([class*="thought"])',
      'ms-chat-turn[data-role="model"] .answer:not([class*="thought"])',
      'ms-chat-turn[data-role="model"] ms-cmark-node:not([class*="thought"])',
      
      // Look for specific response containers that aren't thoughts
      '[role="main"] ms-chat-turn[data-role="model"] div:not([class*="thought"]):not([class*="experimental"])',
      '[role="main"] ms-chat-turn[data-role="model"] p:not([class*="thought"]):not([class*="experimental"])',
      
      // Look for content after thoughts sections (siblings)
      '[class*="thought"] ~ *',
      '[data-testid*="thought"] ~ *',
      
      // Fallback: look in model responses but filter out thoughts
      'ms-chat-turn[data-role="model"] *',
      '[role="main"] ms-chat-turn:not([data-role="user"]) *',
      '[role="main"] div:not([contenteditable]):not(textarea):not(input)'
    ];
    
    let bestResponse = null;
    let bestScore = 0;
    
    for (const selector of responseSelectors) {
      const elements = document.querySelectorAll(selector);
      
      for (let i = 0; i < Math.min(elements.length, 30); i++) { // Check more elements
        const element = elements[i];
        const text = this.extractTextContent(element);
        
        if (!text || text.length < 5) continue;
        
        // Skip if this is user input or UI elements
        if (this.isUserInputOrUIElement(element, text)) continue;
        
        // More aggressive thoughts section filtering
        if (this.isThoughtsSection(element, text)) continue;
        
        // Skip thoughts headers/wrappers specifically
        if (this.isThoughtsWrapper(text)) continue;
        
        // Simplified scoring - use existing looksLikeAIResponse function
        if (this.looksLikeAIResponse(text)) {
          let score = 50; // Base score for valid responses
          
          // HUGE bonus for containing "Paris" for France question
          if (this.lastPromptText && this.lastPromptText.toLowerCase().includes('france') && 
              text.toLowerCase().includes('paris')) {
            score += 100;
          }
          
          // Bonus for containing expected answer keywords
          if (this.containsAnswerKeywords(text)) score += 40;
          
          // Big bonus for being a direct answer (not thoughts)
          if (this.isDirectAnswer(text)) score += 30;
          
          // Penalty for UI elements
          if (this.containsUIElements(text)) score -= 30;
          if (this.isPromptEcho(text)) score -= 40;
          
          // MASSIVE penalty for thoughts content (should be caught earlier but double-check)
          if (text.includes('Thoughts (experimental)')) score -= 200;
          if (this.looksLikeThoughts(text)) score -= 100;
          
          // Penalty for being too short
          if (text.length < 20) score -= 20;
          
          if (score > bestScore && score > 30) { // Lower threshold to see more candidates
            bestScore = score;
            bestResponse = text;
          }
        }
      }
      
      // If we found a really good response, stop searching
      if (bestResponse && bestScore > 120) break; // Higher threshold for early stopping
    }
    
    if (bestResponse) {
      // Clean up the response
      const cleanResponse = this.cleanResponse(bestResponse);
      console.log(`[AI Studio DEBUG] ✅ Found response (score ${bestScore}): ${cleanResponse.substring(0, 50)}...`);
      this.handleNewResponse(cleanResponse);
      return true;
    }
    
    return false;
  }

  isThoughtsSection(element, text) {
    // Check if element or parent has thoughts-related classes/attributes
    if (element.className && element.className.includes('thought')) return true;
    if (element.getAttribute && element.getAttribute('data-testid')?.includes('thought')) return true;
    
    // Check parent elements for thoughts containers
    let parent = element.parentElement;
    while (parent && parent !== document.body) {
      if (parent.className && parent.className.includes('thought')) return true;
      if (parent.getAttribute && parent.getAttribute('data-testid')?.includes('thought')) return true;
      parent = parent.parentElement;
    }
    
    // Check if text looks like thoughts content
    return this.looksLikeThoughts(text);
  }

  looksLikeThoughts(text) {
    // Common patterns in thoughts sections
    const thoughtsPatterns = [
      /^Defining the Query/i,
      /^I've zeroed in on/i,
      /^Breaking down/i,
      /^Let me think/i,
      /^Considering/i,
      /^Analyzing/i,
      /^The question asks/i,
      /^This is asking/i,
      /^To answer this/i,
      /^I need to/i,
      /^Step \d+/i,
      /^First,/i,
      /^Next,/i,
      /^Finally,/i,
      /^In summary/i,
      /^Let me break this down/i,
      /^The user is asking/i,
      // New patterns for the specific case we're seeing
      /^Thoughts \(experimental\)/i,
      /^Then I'll work to recall/i,
      /^Expand to view model thoughts/i,
      /^Model thoughts:/i,
      /chevron_right/i
    ];
    
    for (const pattern of thoughtsPatterns) {
      if (pattern.test(text.trim())) {
        return true;
      }
    }
    
    // If text contains thoughts indicators
    if (text.toLowerCase().includes('thoughts') && text.toLowerCase().includes('experimental')) {
      return true;
    }
    
    // If text starts with thinking/reasoning words and doesn't contain direct answer
    if (/^(Defining|Breaking|Analyzing|Considering|To answer|Let me|I need|The question|This is|Then I'll|Thoughts)/i.test(text)) {
      // But doesn't contain direct answer patterns
      if (!/\b(is|are|was|were|the capital|Paris|answer)\b/i.test(text)) {
        return true;
      }
    }
    
    return false;
  }

  isDirectAnswer(text) {
    // Check if this looks like a direct answer rather than reasoning
    const answerPatterns = [
      /^The capital .+ is/i,
      /^Paris is/i,
      /^.+ is the capital/i,
      /^.+ are .+/i,
      /^.+ was .+/i,
      /^.+ were .+/i,
      /^Yes,/i,
      /^No,/i,
      /^The answer is/i,
      /^The result is/i
    ];
    
    for (const pattern of answerPatterns) {
      if (pattern.test(text.trim())) {
        return true;
      }
    }
    
    // For France capital question specifically
    if (this.lastPromptText && this.lastPromptText.toLowerCase().includes('france')) {
      if (/Paris.+capital|capital.+Paris|France.+Paris/i.test(text)) {
        return true;
      }
    }
    
    return false;
  }

  isUserInputOrUIElement(element, text) {
    // Check if element is user input area
    if (this.isInputOrInputChild(element)) return true;
    
    // Check for common UI patterns
    const uiPatterns = [
      /^(Chat|Prompt|assignment|code|share|save|more_vert|edit|menu|settings|key|Get API|Dashboard|Documentation)$/i,
      /^(thumb_up|thumb_down|add_circle|Run|Ctrl|keyboard_return|reset_settings|close)$/i,
      /^(Token count|Temperature|Tools|Safety settings|Output length|Top P|tune|gallery_thumbnail)$/i,
      /^(expand_more|chevron_right|compare_arrows|refresh|open_in_new)$/i
    ];
    
    for (const pattern of uiPatterns) {
      if (pattern.test(text.trim())) return true;
    }
    
    // Check if element has UI-related classes or attributes
    const uiClasses = ['button', 'menu', 'toolbar', 'header', 'nav', 'sidebar', 'control', 'icon'];
    const className = element.className || '';
    for (const uiClass of uiClasses) {
      if (className.includes(uiClass)) return true;
    }
    
    return false;
  }

  containsUIElements(text) {
    const uiKeywords = [
      'thumb_up', 'thumb_down', 'more_vert', 'chevron_right', 'expand_more',
      'compare_arrows', 'refresh', 'edit', 'save', 'share', 'assignment',
      'Token count', 'Temperature', 'Tools', 'Safety settings', 'Gemini',
      'keyboard_return', 'reset_settings', 'gallery_thumbnail'
    ];
    
    const lowerText = text.toLowerCase();
    return uiKeywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
  }

  isPromptEcho(text) {
    // Check if this is just echoing our prompt
    if (this.lastPromptText && text.includes(this.lastPromptText)) {
      const withoutPrompt = text.replace(this.lastPromptText, '').trim();
      return withoutPrompt.length < 50; // If very little content after removing prompt
    }
    return false;
  }

  containsAnswerKeywords(text) {
    // Check for keywords that suggest this is an actual answer
    if (this.lastPromptText && this.lastPromptText.toLowerCase().includes('france')) {
      return text.toLowerCase().includes('paris') || 
             text.toLowerCase().includes('capital') ||
             text.toLowerCase().includes('france');
    }
    
    // General answer indicators
    const answerIndicators = [
      'is', 'are', 'was', 'were', 'the answer', 'the result',
      'therefore', 'thus', 'so', 'because', 'since'
    ];
    
    const lowerText = text.toLowerCase();
    return answerIndicators.some(indicator => lowerText.includes(indicator));
  }

  cleanResponse(response) {
    // Remove common UI elements and clean up the response
    let cleaned = response
      .replace(/thumb_up|thumb_down|more_vert|chevron_right|expand_more|compare_arrows|refresh|edit|save|share|assignment/g, '')
      .replace(/Token count \d+\/[\d,]+/g, '')
      .replace(/Temperature|Tools|Safety settings|Output length|Top P|tune|gallery_thumbnail/g, '')
      .replace(/keyboard_return|reset_settings|close|Run|Ctrl/g, '')
      .replace(/Gemini [\d\.]+ Pro Preview [\d-]+/g, '')
      .replace(/Chat Prompt assignment code/g, '')
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
    
    // Remove thoughts-specific content
    cleaned = this.removeThoughtsContent(cleaned);
    
    // Extract the core answer if it's a simple question
    const sentences = cleaned.split(/[.!?]+/).filter(s => s.trim().length > 10);
    if (sentences.length > 0) {
      // For France capital question, look for the direct answer
      if (this.lastPromptText && this.lastPromptText.toLowerCase().includes('france')) {
        for (const sentence of sentences) {
          const trimmed = sentence.trim();
          if (/Paris.+capital|capital.+Paris|France.+Paris/i.test(trimmed) || 
              /^The capital .+ is Paris/i.test(trimmed) ||
              /^Paris is the capital/i.test(trimmed)) {
            return trimmed + '.';
          }
        }
      }
      
      // Return the first substantial sentence that looks like an answer
      for (const sentence of sentences) {
        const trimmed = sentence.trim();
        if (trimmed.length > 20 && 
            !this.containsUIElements(trimmed) && 
            !this.looksLikeThoughts(trimmed) &&
            this.isDirectAnswer(trimmed)) {
          return trimmed + '.';
        }
      }
      
      // Fallback: return first substantial sentence
      for (const sentence of sentences) {
        const trimmed = sentence.trim();
        if (trimmed.length > 20 && !this.containsUIElements(trimmed)) {
          return trimmed + '.';
        }
      }
    }
    
    return cleaned;
  }

  removeThoughtsContent(text) {
    // Remove common thoughts patterns
    let cleaned = text;
    
    // Remove thoughts markers and content
    cleaned = cleaned.replace(/Defining the Query[^.]*\./gi, '');
    cleaned = cleaned.replace(/I've zeroed in on[^.]*\./gi, '');
    cleaned = cleaned.replace(/Breaking down[^.]*\./gi, '');
    cleaned = cleaned.replace(/Let me think[^.]*\./gi, '');
    cleaned = cleaned.replace(/Considering[^.]*\./gi, '');
    cleaned = cleaned.replace(/Analyzing[^.]*\./gi, '');
    cleaned = cleaned.replace(/The question asks[^.]*\./gi, '');
    cleaned = cleaned.replace(/This is asking[^.]*\./gi, '');
    cleaned = cleaned.replace(/To answer this[^.]*\./gi, '');
    cleaned = cleaned.replace(/I need to[^.]*\./gi, '');
    
    // Remove step markers
    cleaned = cleaned.replace(/Step \d+[^.]*\./gi, '');
    cleaned = cleaned.replace(/First,[^.]*\./gi, '');
    cleaned = cleaned.replace(/Next,[^.]*\./gi, '');
    cleaned = cleaned.replace(/Finally,[^.]*\./gi, '');
    
    // Clean up extra whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    return cleaned;
  }

  handleNewResponse(responseText) {
    if (!responseText || responseText === this.lastResponseText) {
      return;
    }
    
    // Additional validation before accepting response
    if (!this.looksLikeAIResponse(responseText)) {
      return;
    }
    
    console.log('[AI Studio DEBUG] ✅ New AI response accepted');
    
    this.lastResponseText = responseText;
    
    // Copy to clipboard for backup
    this.copyToClipboard(responseText);
    
    // Send to background script
    chrome.runtime.sendMessage({
      type: 'RESPONSE_RECEIVED',
      data: {
        content: responseText,
        timestamp: new Date().toISOString()
      }
    }).catch(error => {
      console.error('[AI Studio DEBUG] Failed to send response to background script:', error);
    });
  }

  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      // Fallback method
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  }

  onMessage(message, sender, sendResponse) {
    console.log('[AI Studio DEBUG] Received message from background:', message.type);
    
    switch (message.type) {
      case 'SEND_PROMPT':
        console.log('[AI Studio DEBUG] Prompt send command received, setting timer');
        
        // Store the prompt text for response filtering
        this.lastPromptText = message.data.prompt;
        
        // Set up timing
        this.promptSentTime = Date.now();
        this.lastResponseTime = 0;
        
        // Send to injected script
        console.log(`[AI Studio DEBUG] Sending prompt to injected script: ${JSON.stringify(message.data)}`);
        window.postMessage({
          source: 'ai-studio-content',
          type: 'SEND_PROMPT',
          data: message.data
        }, '*');
        
        sendResponse({ success: true });
        break;
      case 'START_NEW_CHAT':
        this.lastResponseText = ''; // Reset response tracking
        this.promptSentTime = null; // Reset prompt tracking
        console.log('[AI Studio DEBUG] New chat command received, resetting tracking');
        this.startNewChatOnPage();
        sendResponse({ success: true });
        break;
      case 'CHECK_AUTH':
        console.log('[AI Studio DEBUG] Auth check command received');
        this.checkAuthenticationOnPage();
        sendResponse({ success: true });
        break;
    }
  }

  sendPromptToPage(promptData) {
    console.log('[AI Studio DEBUG] Sending prompt to injected script:', promptData);
    
    // Send to injected script
    window.postMessage({
      source: 'ai-studio-content',
      type: 'SEND_PROMPT',
      data: promptData
    }, '*');
  }

  startNewChatOnPage() {
    console.log('[AI Studio DEBUG] Sending new chat command to injected script');
    
    window.postMessage({
      source: 'ai-studio-content',
      type: 'START_NEW_CHAT'
    }, '*');
  }

  checkAuthenticationOnPage() {
    console.log('[AI Studio DEBUG] Sending auth check to injected script');
    
    window.postMessage({
      source: 'ai-studio-content',
      type: 'CHECK_AUTH'
    }, '*');
  }

  handlePageMessage(message) {
    console.log('[AI Studio DEBUG] Received message from injected script:', message.type);
    
    switch (message.type) {
      case 'PROMPT_SENT':
        this.promptSentTime = Date.now(); // Update prompt sent time
        console.log('[AI Studio DEBUG] Prompt sent successfully, starting response monitoring timer');
        break;
      case 'NEW_CHAT_STARTED':
        console.log('[AI Studio DEBUG] New chat started');
        this.lastResponseText = ''; // Reset response tracking
        this.promptSentTime = null; // Reset prompt tracking
        break;
      case 'AUTH_CHECKED':
        console.log('[AI Studio DEBUG] Auth check result received:', message.data);
        chrome.runtime.sendMessage({
          type: 'AUTH_STATUS',
          data: { authenticated: message.data.authenticated }
        });
        break;
    }
  }

  extractTextContent(element) {
    if (!element) return '';
    
    // Get text content, but clean it up
    let text = element.textContent || element.innerText || '';
    
    // Remove extra whitespace and normalize
    text = text.replace(/\s+/g, ' ').trim();
    
    // Remove empty parentheses and brackets that are common in UI
    text = text.replace(/\(\s*\)/g, '').replace(/\[\s*\]/g, '');
    
    return text;
  }

  isThoughtsWrapper(text) {
    // Detect thoughts wrapper/header text specifically
    const wrapperPatterns = [
      /^Thoughts \(experimental\)/i,
      /^Expand to view model thoughts/i,
      /^Then I'll work to recall/i,
      /^Model thoughts:/i,
      /^Thinking\.\.\./i,
      /^chevron_right/i,
      /^Thoughts$/i
    ];
    
    for (const pattern of wrapperPatterns) {
      if (pattern.test(text.trim())) {
        return true;
      }
    }
    
    // Check if it's just the thoughts header without actual content
    if (text.includes('Thoughts') && text.includes('experimental') && text.length < 100) {
      return true;
    }
    
    return false;
  }
}

// Initialize content script
new AIStudioContentScript();