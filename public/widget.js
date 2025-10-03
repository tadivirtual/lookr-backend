(function() {
  'use strict';

  // Get the site key and color from the script tag
  const scriptTag = document.currentScript;
  const siteKey = scriptTag.getAttribute('data-key');
  const buttonColor = scriptTag.getAttribute('data-color') || '#000000';

  if (!siteKey) {
    console.error('Lookr Widget: data-key attribute is required');
    return;
  }

  // Determine text color based on background brightness
  function getTextColor(hexColor) {
    // Convert hex to RGB
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    // Calculate relative luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    // Return black text for light backgrounds, white for dark
    return luminance > 0.5 ? '#000000' : '#FFFFFF';
  }

  const textColor = getTextColor(buttonColor);

  // Create styles
  const styles = `
    #lookr-widget-button {
      position: fixed;
      bottom: 24px;
      right: 24px;
      height: 30px;
      background: ${buttonColor};
      color: ${textColor};
      border: none;
      border-radius: 20px;
      padding: 10px 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      font-size: 15px;
      font-weight: 600;
      line-height: 1.2;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
      cursor: pointer;
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      transition: all 0.3s ease;
    }

    #lookr-widget-button:hover {
      background: ${buttonColor};
      opacity: 0.9;
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
    }

    #lookr-modal {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.6);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 1000000;
      backdrop-filter: blur(4px);
    }

    #lookr-modal.active {
      display: flex;
    }

    #lookr-modal-content {
      background: white;
      border-radius: 16px;
      width: 90%;
      max-width: 500px;
      max-height: 80vh;
      overflow: hidden;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      display: flex;
      flex-direction: column;
    }

    #lookr-modal-header {
      padding: 20px 24px;
      border-bottom: 1px solid #e5e7eb;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    #lookr-modal-header h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #1f2937;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    #lookr-close-button {
      background: none;
      border: none;
      font-size: 24px;
      color: #6b7280;
      cursor: pointer;
      padding: 0;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 6px;
      transition: background 0.2s;
    }

    #lookr-close-button:hover {
      background: #f3f4f6;
    }

    #lookr-modal-body {
      padding: 24px;
      flex: 1;
      overflow-y: auto;
    }

    #lookr-search-input {
      width: 100%;
      padding: 14px 16px;
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      font-size: 15px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      transition: border-color 0.2s;
      outline: none;
    }

    #lookr-search-input:focus {
      border-color: #000000;
    }

    #lookr-search-button {
      width: 100%;
      margin-top: 12px;
      padding: 14px;
      background: #000000;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      transition: all 0.3s;
    }

    #lookr-search-button:hover {
      background: #333333;
    }

    #lookr-search-button:disabled {
      background: #9ca3af;
      cursor: not-allowed;
    }

    #lookr-suggestions {
      margin-top: 16px;
    }

    #lookr-suggestions-label {
      font-size: 13px;
      color: #6b7280;
      margin-bottom: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .lookr-suggestion-btn {
      display: block;
      width: 100%;
      text-align: left;
      padding: 10px 14px;
      margin-bottom: 8px;
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      font-size: 14px;
      color: #374151;
      cursor: pointer;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      transition: all 0.2s;
    }

    .lookr-suggestion-btn:hover {
      background: #f3f4f6;
      border-color: #d1d5db;
    }

    #lookr-answer {
      margin-top: 20px;
      padding: 16px;
      background: #f9fafb;
      border-radius: 8px;
      line-height: 1.6;
      color: #1f2937;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: none;
    }

    #lookr-answer.visible {
      display: block;
    }

    #lookr-loading {
      margin-top: 20px;
      text-align: center;
      color: #6b7280;
      display: none;
    }

    #lookr-loading.visible {
      display: block;
    }

    #lookr-error {
      margin-top: 20px;
      padding: 16px;
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 8px;
      color: #991b1b;
      display: none;
    }

    #lookr-error.visible {
      display: block;
    }

    @media (max-width: 640px) {
      #lookr-widget-button {
        bottom: 16px;
        right: 16px;
        padding: 12px 16px;
        font-size: 14px;
      }

      #lookr-modal-content {
        width: 95%;
        max-height: 85vh;
      }
    }
  `;

  // Inject styles
  const styleSheet = document.createElement('style');
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);

  // Create widget button
  const button = document.createElement('button');
  button.id = 'lookr-widget-button';
  button.innerHTML = '<span style="font-size: 18px;">✨</span><span>Ask AI</span>';

  // Create modal
  const modal = document.createElement('div');
  modal.id = 'lookr-modal';
  modal.innerHTML = `
    <div id="lookr-modal-content">
      <div id="lookr-modal-header">
        <h3>✨ Ask AI</h3>
        <button id="lookr-close-button">&times;</button>
      </div>
      <div id="lookr-modal-body">
        <input 
          type="text" 
          id="lookr-search-input" 
          placeholder="Ask a question about this website..."
        />
        <button id="lookr-search-button">Search</button>
        <div id="lookr-suggestions">
          <div id="lookr-suggestions-label">Suggested questions:</div>
          <button class="lookr-suggestion-btn" data-question="What are your pricing plans?">What are your pricing plans?</button>
          <button class="lookr-suggestion-btn" data-question="How does this work?">How does this work?</button>
          <button class="lookr-suggestion-btn" data-question="How do I get started?">How do I get started?</button>
        </div>
        <div id="lookr-loading">Searching...</div>
        <div id="lookr-error"></div>
        <div id="lookr-answer"></div>
      </div>
    </div>
  `;

  // Add to page
  document.body.appendChild(button);
  document.body.appendChild(modal);

  // Get elements
  const closeButton = document.getElementById('lookr-close-button');
  const searchInput = document.getElementById('lookr-search-input');
  const searchButton = document.getElementById('lookr-search-button');
  const loadingDiv = document.getElementById('lookr-loading');
  const errorDiv = document.getElementById('lookr-error');
  const answerDiv = document.getElementById('lookr-answer');
  const suggestionButtons = document.querySelectorAll('.lookr-suggestion-btn');
  const suggestionsDiv = document.getElementById('lookr-suggestions');

  // Open modal
  button.addEventListener('click', () => {
    modal.classList.add('active');
    searchInput.focus();
  });

  // Close modal
  closeButton.addEventListener('click', () => {
    modal.classList.remove('active');
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('active');
    }
  });

  // Handle search
  async function handleSearch() {
    const question = searchInput.value.trim();
    
    if (!question) {
      return;
    }

    // Reset UI
    answerDiv.classList.remove('visible');
    errorDiv.classList.remove('visible');
    suggestionsDiv.style.display = 'none';
    loadingDiv.classList.add('visible');
    searchButton.disabled = true;

    try {
      const response = await fetch('https://lookr-backend-tadis-projects-fd06034e.vercel.app/api/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          siteKey: siteKey,
          question: question,
          url: window.location.href
        })
      });

      const data = await response.json();

      loadingDiv.classList.remove('visible');

      if (response.ok) {
        // Strip markdown formatting and clean up the text
        const cleanAnswer = data.answer
          .replace(/\*\*/g, '')  // Remove bold markdown
          .replace(/\*/g, '')    // Remove italic markdown
          .replace(/#{1,6}\s/g, '') // Remove heading markers
          .trim();
        
        answerDiv.textContent = cleanAnswer;
        answerDiv.classList.add('visible');
      } else {
        errorDiv.textContent = data.error || 'Failed to get answer. Please try again.';
        errorDiv.classList.add('visible');
      }
    } catch (error) {
      loadingDiv.classList.remove('visible');
      errorDiv.textContent = 'Network error. Please check your connection.';
      errorDiv.classList.add('visible');
    } finally {
      searchButton.disabled = false;
    }
  }

  searchButton.addEventListener('click', handleSearch);
  
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  });

  // Handle suggestion button clicks
  suggestionButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const question = btn.getAttribute('data-question');
      searchInput.value = question;
      handleSearch();
    });
  });

})();
