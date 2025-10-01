// Lookr.ai Widget - Embeddable AI Search
(function() {
  'use strict';
  
  // Get the API key from the script tag
  const scripts = document.getElementsByTagName('script');
  const currentScript = scripts[scripts.length - 1];
  const siteKey = currentScript.getAttribute('data-key');
  
  if (!siteKey) {
    console.error('Lookr.ai: Missing data-key attribute');
    return;
  }

  // Configuration
  const API_URL = 'https://lookr-backend.vercel.app/api/query';
  
  // Create the widget container
  const widgetContainer = document.createElement('div');
  widgetContainer.id = 'lookr-widget';
  widgetContainer.innerHTML = `
    <div class="lookr-trigger" id="lookr-trigger">
      <span class="lookr-trigger-text">Ask AI</span>
      <span class="lookr-sparkle">✨</span>
    </div>
    
    <div class="lookr-overlay" id="lookr-overlay">
      <div class="lookr-modal">
        <button class="lookr-close" id="lookr-close">×</button>
        <div class="lookr-search-container">
          <input 
            type="text" 
            class="lookr-search-input" 
            id="lookr-input"
            placeholder="Ask anything..."
            autocomplete="off"
          />
          <button class="lookr-search-btn" id="lookr-search-btn">✨</button>
        </div>
        <div class="lookr-response-container" id="lookr-response">
          <div class="lookr-suggestions">
            <p class="lookr-suggestions-title">Try asking:</p>
            <button class="lookr-suggestion">What are your pricing plans?</button>
            <button class="lookr-suggestion">How does this work?</button>
            <button class="lookr-suggestion">Do you offer support?</button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Add styles
  const style = document.createElement('style');
  style.textContent = `
    #lookr-widget * {
      box-sizing: border-box;
      margin: 0;
    }

    .lookr-trigger {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 18px 5px;
      border-radius: 50px;
      display: flex;
      align-items: center;
      gap: 14px;
      cursor: pointer;
      box-shadow: 0 8px 24px rgba(102, 126, 234, 0.35);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 16px;
      font-weight: 600;
      z-index: 999998;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      border: none;
      letter-spacing: 0.3px;
    }

    .lookr-trigger:hover {
      transform: translateY(-4px) scale(1.05);
      box-shadow: 0 12px 32px rgba(102, 126, 234, 0.45);
    }

    .lookr-sparkle {
      font-size: 20px;
      animation: sparkle 2s ease-in-out infinite;
    }

    @keyframes sparkle {
      0%, 100% { transform: rotate(0deg) scale(1); }
      25% { transform: rotate(-10deg) scale(1.1); }
      75% { transform: rotate(10deg) scale(1.1); }
    }

    .lookr-overlay {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(4px);
      z-index: 999999;
      animation: fadeIn 0.2s ease;
    }

    .lookr-overlay.active {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .lookr-modal {
      background: white;
      border-radius: 16px;
      width: 100%;
      max-width: 600px;
      max-height: 80vh;
      overflow: hidden;
      box-shadow: 0 24px 64px rgba(0, 0, 0, 0.25);
      animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      display: flex;
      flex-direction: column;
      position: relative;
    }

    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(40px) scale(0.95);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    .lookr-close {
      position: absolute;
      top: 16px;
      right: 16px;
      background: none;
      border: none;
      font-size: 32px;
      color: #8898aa;
      cursor: pointer;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
      transition: all 0.2s;
      z-index: 10;
    }

    .lookr-close:hover {
      background: #f6f9fc;
      color: #425466;
    }

    .lookr-search-container {
      padding: 32px;
      border-bottom: 2px solid #f6f9fc;
      display: flex;
      gap: 16px;
      align-items: center;
    }

    .lookr-search-input {
      flex: 1;
      border: 2px solid #e6ebf1;
      border-radius: 12px;
      padding: 16px 20px;
      font-size: 16px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      color: #0a2540;
      transition: all 0.2s;
      outline: none;
    }

    .lookr-search-input:focus {
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }

    .lookr-search-input::placeholder {
      color: #8898aa;
    }

    .lookr-search-btn {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border: none;
      border-radius: 12px;
      width: 52px;
      height: 52px;
      font-size: 24px;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .lookr-search-btn:hover {
      transform: scale(1.1);
      box-shadow: 0 8px 16px rgba(102, 126, 234, 0.3);
    }

    .lookr-search-btn:active {
      transform: scale(0.95);
    }

    .lookr-response-container {
      padding: 24px;
      overflow-y: auto;
      max-height: calc(80vh - 120px);
      min-height: 200px;
    }

    .lookr-suggestions {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .lookr-suggestions-title {
      font-size: 14px;
      color: #8898aa;
      font-weight: 500;
      margin-bottom: 4px;
    }

    .lookr-suggestion {
      background: #f6f9fc;
      border: 1px solid #e6ebf1;
      border-radius: 10px;
      padding: 14px 18px;
      font-size: 15px;
      color: #425466;
      text-align: left;
      cursor: pointer;
      transition: all 0.2s;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }

    .lookr-suggestion:hover {
      background: white;
      border-color: #667eea;
      transform: translateX(4px);
    }

    .lookr-loading {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 20px;
      color: #8898aa;
      font-size: 15px;
    }

    .lookr-loading-dots {
      display: flex;
      gap: 6px;
    }

    .lookr-loading-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #667eea;
      animation: bounce 1.4s ease-in-out infinite;
    }

    .lookr-loading-dot:nth-child(2) {
      animation-delay: 0.2s;
    }

    .lookr-loading-dot:nth-child(3) {
      animation-delay: 0.4s;
    }

    @keyframes bounce {
      0%, 80%, 100% { transform: translateY(0); opacity: 0.5; }
      40% { transform: translateY(-10px); opacity: 1; }
    }

    .lookr-answer {
      background: #f6f9fc;
      border-left: 4px solid #667eea;
      border-radius: 8px;
      padding: 20px;
      font-size: 15px;
      line-height: 1.7;
      color: #425466;
      animation: fadeIn 0.3s ease;
    }

    .lookr-answer p {
      margin-bottom: 12px;
    }

    .lookr-answer p:last-child {
      margin-bottom: 0;
    }

    .lookr-error {
      background: #fff5f5;
      border-left: 4px solid #ef4444;
      border-radius: 8px;
      padding: 20px;
      font-size: 15px;
      color: #dc2626;
    }

    .lookr-feedback {
      display: flex;
      gap: 12px;
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid #e6ebf1;
    }

    .lookr-feedback-text {
      font-size: 13px;
      color: #8898aa;
      flex: 1;
    }

    .lookr-feedback-btn {
      background: none;
      border: 1px solid #e6ebf1;
      border-radius: 6px;
      padding: 6px 12px;
      font-size: 18px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .lookr-feedback-btn:hover {
      background: #f6f9fc;
      transform: scale(1.1);
    }

    @media (max-width: 640px) {
      .lookr-trigger {
        bottom: 16px;
        right: 16px;
        padding: 12px 20px;
        font-size: 14px;
      }

      .lookr-modal {
        max-width: 100%;
        max-height: 90vh;
        margin: 0 12px;
      }

      .lookr-search-container {
        padding: 16px;
      }

      .lookr-search-input {
        padding: 14px 16px;
        font-size: 15px;
      }

      .lookr-search-btn {
        width: 48px;
        height: 48px;
      }
    }
  `;

  document.head.appendChild(style);
  document.body.appendChild(widgetContainer);

  // Get elements
  const trigger = document.getElementById('lookr-trigger');
  const overlay = document.getElementById('lookr-overlay');
  const closeBtn = document.getElementById('lookr-close');
  const input = document.getElementById('lookr-input');
  const searchBtn = document.getElementById('lookr-search-btn');
  const responseContainer = document.getElementById('lookr-response');
  const suggestions = document.querySelectorAll('.lookr-suggestion');

  // Open modal
  trigger.addEventListener('click', function() {
    overlay.classList.add('active');
    setTimeout(() => input.focus(), 100);
  });

  // Close modal
  closeBtn.addEventListener('click', function() {
    overlay.classList.remove('active');
  });

  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) {
      overlay.classList.remove('active');
    }
  });

  // Handle ESC key
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && overlay.classList.contains('active')) {
      overlay.classList.remove('active');
    }
  });

  // Handle search
  async function handleSearch(question) {
    if (!question.trim()) return;

    // Show loading
    responseContainer.innerHTML = `
      <div class="lookr-loading">
        <div class="lookr-loading-dots">
          <div class="lookr-loading-dot"></div>
          <div class="lookr-loading-dot"></div>
          <div class="lookr-loading-dot"></div>
        </div>
        <span>Finding answer...</span>
      </div>
    `;

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: question,
          siteKey: siteKey,
          url: window.location.href
        })
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      // Show answer
      responseContainer.innerHTML = `
        <div class="lookr-answer">
          <p>${data.answer}</p>
          <div class="lookr-feedback">
            <span class="lookr-feedback-text">Was this helpful?</span>
            <button class="lookr-feedback-btn" data-feedback="positive">👍</button>
            <button class="lookr-feedback-btn" data-feedback="negative">👎</button>
          </div>
        </div>
      `;

      // Add feedback listeners
      const feedbackBtns = responseContainer.querySelectorAll('.lookr-feedback-btn');
      feedbackBtns.forEach(btn => {
        btn.addEventListener('click', function() {
          const feedback = this.getAttribute('data-feedback');
          sendFeedback(question, data.answer, feedback);
          this.style.transform = 'scale(1.3)';
          this.disabled = true;
        });
      });

    } catch (error) {
      console.error('Lookr.ai error:', error);
      responseContainer.innerHTML = `
        <div class="lookr-error">
          Sorry, something went wrong. Please try again or contact support.
        </div>
      `;
    }

    // Clear input
    input.value = '';
  }

  // Send feedback (optional)
  async function sendFeedback(question, answer, feedback) {
    try {
      await fetch(API_URL.replace('/query', '/feedback'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question,
          answer,
          feedback,
          siteKey
        })
      });
    } catch (error) {
      console.error('Feedback error:', error);
    }
  }

  // Event listeners
  searchBtn.addEventListener('click', function() {
    handleSearch(input.value);
  });

  input.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      handleSearch(input.value);
    }
  });

  // Suggestion clicks
  suggestions.forEach(suggestion => {
    suggestion.addEventListener('click', function() {
      input.value = this.textContent;
      handleSearch(this.textContent);
    });
  });

  console.log('✨ Lookr.ai widget loaded successfully');

})();
