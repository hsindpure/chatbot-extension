define([
  "qlik",
  "jquery"
], function (qlik, $) {
  "use strict";

  // *********** Replace with your OpenAI API Key *************
  const OPENAI_API_KEY = "<YOUR_OPENAI_API_KEY>";
  // **********************************************************

  // Utility: jsPDF CDN loader for PDF export
  function loadJsPDF() {
    return new Promise((resolve, reject) => {
      if (window.jspdf) {
        resolve(window.jspdf);
        return;
      }
      let script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
      script.onload = () => resolve(window.jspdf);
      script.onerror = () => reject(new Error("Failed to load jsPDF"));
      document.head.appendChild(script);
    });
  }

  return {
    initialProperties: {},
    definition: {
      type: "items",
      component: "accordion",
      items: {
        settings: {
          uses: "settings"
        }
      }
    },
    support: {
      snapshot: true,
      export: true,
      exportData: true
    },

    paint: async function ($element, layout) {
      var self = this;
      var app = qlik.currApp();

      // Remove previous chatbot container if exists
      $element.empty();

      // Insert HTML structure into the extension container:
      // Because Qlik Sense extension does not load external HTML file natively,
      // you can place the entire chatbot-extension.html content here or load dynamically.
      // For now, I assume you'll load chatbot-extension.html content into the container by your own mechanism.
      // If you want, you can do ajax load or inject HTML string here.

      // For demonstration, inject HTML directly here (from chatbot-extension.html file content):

      const html = `
        <div id="qs-chatbot-icon" title="Chatbot">
          <svg viewBox="0 0 24 24"><path d="M12 3C7.03 3 3 6.58 3 11c0 1.54.78 2.97 2.21 4.09L4 19l4.94-1.44A9.306 9.306 0 0 0 12 20c4.97 0 9-3.58 9-8s-4.03-9-9-9zM10 11v2H8v-2h2zm4 0v2h-2v-2h2z"/></svg>
        </div>
        <div id="qs-chatbot-container" aria-live="polite" aria-atomic="true" role="dialog" tabindex="0" aria-label="Chatbot Window" >
          <div id="qs-chatbot-header">
            <button type="button" aria-label="Close Chatbot" class="close-btn">&times;</button>
            <div class="app-name"></div>
          </div>
          <select id="role-select" aria-label="Select your role">
            <option value="analyst">Role: Analyst</option>
            <option value="hr">Role: HR</option>
            <option value="guest">Role: Guest</option>
          </select>
          <div id="qs-chatbot-body"></div>
          <button id="download-chat-btn" aria-label="Download chat history as PDF">Download Chat History (PDF)</button>
          <div class="chat-input-area" role="form" aria-label="Chat input area">
            <input type="text" placeholder="Ask your question..." aria-label="Chat input" autocomplete="off" />
            <button type="button" aria-label="Voice input" title="Voice input (hold to talk)">
              <svg viewBox="0 0 24 24"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 14 0h-2zM12 19v3m-4 0h8"/></svg>
            </button>
            <button type="button" aria-label="Send message" title="Send message">
              <svg viewBox="0 0 24 24"><path d="M2 21l21-9L2 3v7l15 2-15 2z"/></svg>
            </button>
          </div>
        </div>
      `;

      $element.append(html);

      // Append CSS dynamically into head (Remove this if you load CSS externally)
      var style = `
        /* Paste the full CSS content from chatbot-extension.css here to make inline styles if needed */
        #qs-chatbot-icon {
          position: fixed;
          bottom: 25px;
          right: 25px;
          width: 60px;
          height: 60px;
          background: #0078d4;
          border-radius: 50%;
          cursor: pointer;
          box-shadow: 0 4px 6px rgba(0,0,0,0.3);
          z-index: 1300;
          display: flex;
          justify-content: center;
          align-items: center;
          transition: background-color 0.3s ease;
        }
        #qs-chatbot-icon:hover {
          background: #005a9e;
        }
        #qs-chatbot-icon svg {
          fill: white;
          width: 28px;
          height: 28px;
        }
        #qs-chatbot-container {
          position: fixed;
          bottom: 100px;
          right: 25px;
          width: 380px;
          max-height: 500px;
          background: white;
          border-radius: 10px;
          box-shadow: 0 0 15px rgba(0,0,0,0.25);
          display: flex;
          flex-direction: column;
          font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
          opacity: 0;
          transform: translateY(40px);
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          z-index: 1300;
          overflow: hidden;
        }
        #qs-chatbot-container.open {
          opacity: 1;
          transform: translateY(0);
        }
        #qs-chatbot-header {
          background: #0078d4;
          color: white;
          padding: 10px 15px;
          font-weight: 700;
          font-size: 1.2em;
          display: flex;
          align-items: center;
          justify-content: space-between;
          user-select: none;
        }
        #qs-chatbot-header .app-name {
          flex: 1;
          text-align: center;
          font-weight: 700;
          font-size: 1.2em;
        }
        #qs-chatbot-header button.close-btn {
          background: transparent;
          border: none;
          color: white;
          font-size: 1.4em;
          cursor: pointer;
          user-select: none;
        }
        #qs-chatbot-body {
          flex: 1;
          padding: 10px 15px;
          background: #f7f7f7;
          overflow-y: auto;
        }
        .chat-message {
          margin-bottom: 12px;
          max-width: 90%;
          clear: both;
        }
        .chat-message.user {
          float: right;
          background: #0078d4;
          color: white;
          border-radius: 15px 15px 0 15px;
          padding: 8px 12px;
          font-size: 0.9em;
          position: relative;
          word-wrap: break-word;
        }
        .chat-message.bot {
          float: left;
          background: #e1e1e1;
          color: #222;
          border-radius: 15px 15px 15px 0;
          padding: 8px 12px;
          font-size: 0.9em;
          position: relative;
          word-wrap: break-word;
        }
        .chat-message .author-info {
          font-size: 0.75em;
          font-weight: 600;
          margin-bottom: 3px;
          display: flex;
          align-items: center;
        }
        .chat-message .author-info img {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          margin-right: 6px;
        }
        .chat-input-area {
          display: flex;
          padding: 8px 10px;
          background: #fff;
          border-top: 1px solid #ddd;
        }
        .chat-input-area input[type="text"] {
          flex: 1;
          border: 1px solid #ddd;
          border-radius: 20px;
          padding: 8px 15px;
          font-size: 1em;
          outline: none;
          transition: border-color 0.3s ease;
        }
        .chat-input-area input[type="text"]:focus {
          border-color: #0078d4;
        }
        .chat-input-area button {
          background: #0078d4;
          border: none;
          color: white;
          margin-left: 8px;
          border-radius: 50%;
          width: 36px;
          height: 36px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background-color 0.3s ease;
          user-select: none;
          outline: none;
        }
        .chat-input-area button:hover {
          background: #005a9e;
        }
        .chat-input-area button svg {
          width: 20px;
          height: 20px;
          fill: white;
        }
        #role-select {
          margin: 5px 15px 10px 15px;
          font-size: 1em;
          padding: 5px 8px;
          border-radius: 5px;
          border: 1px solid #ddd;
          width: calc(100% - 40px);
          outline: none;
          transition: border-color 0.3s ease;
        }
        #role-select:focus {
          border-color: #0078d4;
        }
        #download-chat-btn {
          background: #0078d4;
          border: none;
          color: white;
          margin: 10px 15px;
          padding: 8px 12px;
          font-weight: 600;
          border-radius: 6px;
          cursor: pointer;
          user-select: none;
          outline: none;
          transition: background-color 0.3s ease;
          width: calc(100% - 30px);
        }
        #download-chat-btn:hover {
          background: #005a9e;
        }
      `;
      $("<style>").html(style).appendTo("head");

      // Cache selectors
      var chatbotIcon = $element.find("#qs-chatbot-icon");
      var container = $element.find("#qs-chatbot-container");
      var chatbotBody = $element.find("#qs-chatbot-body");
      var inputBox = $element.find("input[type=text]");
      var sendBtn = $element.find("button[aria-label='Send message']");
      var voiceBtn = $element.find("button[aria-label='Voice input']");
      var closeBtn = $element.find("button.close-btn");
      var roleSelect = $element.find("#role-select");
      var downloadBtn = $element.find("#download-chat-btn");

      // Store chat messages as array of {role:'user'|'bot', text:'', timestamp, userName}
      var chatHistory = [];

      // User info
      var userName = qlik.navigation.getEffectiveUserId ? qlik.navigation.getEffectiveUserId() : "User";

      // Simulated user icon (can be customized)
      var userIconUrl = "https://cdn-icons-png.flaticon.com/512/147/147144.png";

      // Fill app name in header
      try {
        var appLayout = await app.getAppLayout();
        container.find(".app-name").text(appLayout.qTitle || "Qlik Sense Chatbot");
      } catch (e) {
        container.find(".app-name").text("Qlik Sense Chatbot");
      }

      // Smooth scroll function to keep chat scroll on bottom
      function scrollChatBottom() {
        chatbotBody.stop().animate({ scrollTop: chatbotBody[0].scrollHeight }, 300);
      }

      // Append chat message bubble
      function appendMessage(text, sender = "bot", customUserName) {
        var authorName = sender === "user" ? (customUserName || userName) : "Chatbot";
        var isUser = sender === "user";
        var msg = $(`
          <div class="chat-message ${sender}" role="article" aria-label="${authorName} says: ${text}">
            <div class="author-info">
              <img src="${isUser ? userIconUrl : 'https://cdn-icons-png.flaticon.com/512/4712/4712027.png'}" alt="${authorName}"/>
              <span>${authorName}</span>
            </div>
            <div class="message-text"></div>
          </div>
        `);
        msg.find(".message-text").text(text);
        chatbotBody.append(msg);
        scrollChatBottom();
        chatHistory.push({ role: sender, text: text, timestamp: new Date(), userName: authorName });
      }

      // Show loading indicator in chat
      function showLoading() {
        var loader = $(`
          <div class="chat-message bot loading-message" aria-live="polite" aria-atomic="true" style="color:#666;font-style:italic;">
            Chatbot is typing...
          </div>
        `);
        chatbotBody.append(loader);
        scrollChatBottom();
        return loader;
      }

      // Remove loading indicator
      function removeLoading(loader) {
        if (loader) loader.remove();
      }

      // Toggle chatbot container open/close with animation
      function toggleChatbot(show) {
        if (show) {
          container.addClass("open");
          inputBox.focus();
        } else {
          container.removeClass("open");
        }
      }

      // Chatbot icon click toggles container
      chatbotIcon.on("click", function () {
        if (container.hasClass("open")) {
          toggleChatbot(false);
        } else {
          toggleChatbot(true);
        }
      });

      // Close button hides chatbot
      closeBtn.on("click", function () {
        toggleChatbot(false);
      });

      // Function: Fetch all objects data from app (with paging to limit rows) - returns data summary object
      async function fetchAllObjectsData() {
        let resultData = [];
        try {
          // Get list of all visualization objects in app
          let appsObjects = await app.getObjectList("visualization");

          for (let obj of appsObjects.qAppObjectList.qItems) {
            try {
              let model = await app.getObject(obj.qInfo.qId);
              let layout = await model.getLayout();

              if (
                layout.qHyperCube &&
                layout.qHyperCube.qSize.qcy > 0 &&
                layout.qHyperCube.qMeasureInfo.length > 0
              ) {
                let qTop = 0;
                let qHeight = Math.min(layout.qHyperCube.qSize.qcy, 30); // Limit rows to 30
                let qWidth = layout.qHyperCube.qSize.qcx;

                let pageDef = [{ qTop, qLeft: 0, qHeight, qWidth }];
                let dataPages = await model.getHyperCubeData("/qHyperCubeDef", pageDef);

                resultData.push({
                  id: layout.qInfo.qId,
                  title: layout.title || layout.qInfo.qId,
                  columns: layout.qHyperCube.qDimensionInfo.concat(layout.qHyperCube.qMeasureInfo).map(f => f.qFallbackTitle),
                  data: dataPages[0].qMatrix
                });
              }
            } catch (exObj) {
              // continue
            }
          }
        } catch (e) {
          return null;
        }
        return resultData;
      }

      // Function: Simple Data Comparison (Qlik app data vs external data simulation)
      function compareMarketData(appData, userQuery) {
        const marketData = {
          "sales growth": "The external market indicates a 5% increase in sales compared to last quarter.",
          "employee attrition": "Industry average attrition rate stands at 12%, while your app shows 8%.",
          "customer satisfaction": "Market surveys report customer satisfaction of 85%, your app reports 87%."
        };

        for (let key in marketData) {
          if (userQuery.toLowerCase().includes(key)) {
            return marketData[key];
          }
        }

        return "No relevant external market data found for your query.";
      }

      // Function: Generate chart or table from app data (simplified)
      function generateChartTable(appData, query) {
        if (!appData || appData.length === 0) return "<i>No app data available to generate chart or table.</i>";

        if (query.toLowerCase().includes("table")) {
          var html = "<table border='1' cellpadding='4' cellspacing='0' style='border-collapse: collapse; width: 100%;'>";
          let obj = appData[0];
          html += "<thead><tr>";
          obj.columns.forEach(col => html += `<th>${col}</th>`);
          html += "</tr></thead><tbody>";
          obj.data.forEach(row => {
            html += "<tr>";
            row.forEach(cell => html += `<td>${cell.qText}</td>`);
            html += "</tr>";
          });
          html += "</tbody></table>";
          return html;
        } else {
          let obj = appData[0];
          if (!obj || obj.columns.length < 2) return "<i>Not enough data to generate chart.</i>";

          let barHtml = `<div style="width:100%;font-size: 0.9em;">`;
          let maxVal = 0;
          let rows = obj.data;
          rows.forEach(r => {
            let val = parseFloat(r[1].qNum);
            if (!isNaN(val) && val > maxVal) maxVal = val;
          });
          rows.forEach(r => {
            let label = r[0].qText;
            let val = parseFloat(r[1].qNum);
            if (isNaN(val)) val = 0;
            let widthPercent = maxVal > 0 ? (val / maxVal) * 100 : 0;
            barHtml += `<div style="margin-bottom:6px;">
              <div style="font-weight:600;">${label} (${val})</div>
              <div style="background:#0078d4; height: 18px; width: ${widthPercent}%; border-radius: 3px;"></div>
            </div>`;
          });
          barHtml += `</div>`;
          return barHtml;
        }
      }

      // Function: Send user query + data + preprompt to OpenAI API
      async function callOpenAI(queryText, appDataSummary, selectedRole) {
        try {
          let rolePrompt = "";
          switch (selectedRole) {
            case "analyst":
              rolePrompt = "You are a Qlik Sense data analyst assistant.";
              break;
            case "hr":
              rolePrompt = "You are a human resources assistant.";
              break;
            default:
              rolePrompt = "You are a helpful assistant.";
          }

          let summaryText = "";
          if (appDataSummary && appDataSummary.length > 0) {
            summaryText = "App data objects:\n";
            appDataSummary.forEach(obj => {
              summaryText += `- ${obj.title}: ${obj.data.length} rows, ${obj.columns.length} cols\n`;
            });
          } else {
            summaryText = "No app data available.";
          }

          let messages = [
            { role: "system", content: rolePrompt + " Use provided data carefully to answer user questions." },
            { role: "user", content: "Here is a summary of app data:\n" + summaryText },
            { role: "user", content: "User question: " + queryText }
          ];

          const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer " + OPENAI_API_KEY,
            },
            body: JSON.stringify({
              model: "gpt-4",
              messages: messages,
              temperature: 0.7,
              max_tokens: 1000
            }),
          });

          if (!response.ok) {
            throw new Error("OpenAI API error: " + response.statusText);
          }

          const json = await response.json();
          const answer = json.choices && json.choices.length > 0 ? json.choices[0].message.content : "Sorry, no answer received.";
          return answer;
        } catch (err) {
          return "Error fetching AI response: " + err.message;
        }
      }

      // Function: Perform Qlik selections via Capability API based on chatbot commands
      async function performQlikCommand(commandText) {
        try {
          commandText = commandText.toLowerCase();

          if (commandText.includes("clear selections")) {
            await app.clearAll();
            return "All selections cleared.";
          }

          let filterMatch = commandText.match(/filter (.+?) to (.+)/);
          if (filterMatch) {
            let field = filterMatch[1];
            let value = filterMatch[2];
            await app.field(field).selectValues([{ qText: value }], true, true);
            return `Filtered Field "${field}" to "${value}".`;
          }

          let selectMatch = commandText.match(/select (.+?) (.+)/);
          if (selectMatch) {
            let field = selectMatch[1];
            let value = selectMatch[2];
            await app.field(field).selectValues([{ qText: value }], true, true);
            return `Selected "${value}" in field "${field}".`;
          }

          return null;
        } catch (e) {
          return "Error performing Qlik command: " + e.message;
        }
      }

      // Process user input, fetch data, call AI, handle Qlik commands, generate responses
      async function handleUserQuery(query) {
        appendMessage(query, "user", userName);
        let loadingIndicator = showLoading();

        try {
          let appDataSummary = await fetchAllObjectsData();
          let qlikCommandResponse = await performQlikCommand(query);
          if (qlikCommandResponse) {
            removeLoading(loadingIndicator);
            appendMessage(qlikCommandResponse, "bot");
            return;
          }
          let comparison = compareMarketData(appDataSummary, query);
          let lowerQuery = query.toLowerCase();
          let chartContent = null;
          if (lowerQuery.includes("generate chart") || lowerQuery.includes("generate table") || lowerQuery.includes("show chart") || lowerQuery.includes("show table")) {
            chartContent = generateChartTable(appDataSummary, query);
          }
          let selectedRole = roleSelect.val();
          let aiAnswer = await callOpenAI(query + "\n\n" + comparison, appDataSummary, selectedRole);
          removeLoading(loadingIndicator);
          appendMessage(aiAnswer, "bot");
          if (chartContent) {
            let chartMsg = $(`<div class="chat-message bot" style="clear:both;">${chartContent}</div>`);
            chatbotBody.append(chartMsg);
            scrollChatBottom();
            chatHistory.push({ role: "bot", text: chartContent, timestamp: new Date(), userName: "Chatbot" });
          }
        } catch (err) {
          removeLoading(loadingIndicator);
          appendMessage("An error occurred: " + err.message, "bot");
        }
      }

      // Send message from input box
      function sendMessage() {
        var msg = inputBox.val().trim();
        if (msg === "") return;
        inputBox.val("");
        handleUserQuery(msg);
      }

      // Event bindings
      sendBtn.on("click", sendMessage);
      inputBox.on("keypress", function (e) {
        if (e.which === 13) {
          e.preventDefault();
          sendMessage();
        }
      });

      // Voice input using Web Speech API
      var recognition = null;
      var recognizing = false;

      try {
        recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
      } catch (e) {
        recognition = null;
      }

      if (recognition) {
        recognition.lang = "en-US";
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = function () {
          recognizing = true;
          voiceBtn.css("background", "#005a9e");
        };
        recognition.onend = function () {
          recognizing = false;
          voiceBtn.css("background", "#0078d4");
        };
        recognition.onerror = function (event) {
          recognizing = false;
          voiceBtn.css("background", "#0078d4");
          appendMessage("Voice recognition error: " + event.error, "bot");
        };
        recognition.onresult = function (event) {
          if (event.results.length > 0) {
            let transcript = event.results[0][0].transcript;
            inputBox.val(transcript);
            sendMessage();
          }
        };

        voiceBtn.on("mousedown touchstart", function () {
          if (!recognizing) recognition.start();
        });
        voiceBtn.on("mouseup touchend", function () {
          if (recognizing) recognition.stop();
        });
      } else {
        voiceBtn.attr("disabled", true);
        voiceBtn.attr("title", "Voice input not supported in this browser");
        voiceBtn.css("background", "#ccc");
      }

      // Download chat history to PDF with jsPDF
      downloadBtn.on("click", async function () {
        if (chatHistory.length === 0) {
          alert("No chat history available.");
          return;
        }
        try {
          const { jsPDF } = await loadJsPDF();
          let doc = new jsPDF();
          doc.setFontSize(14);
          doc.text("Qlik Sense Chat History", 10, 15);
          doc.setFontSize(10);
          doc.text("App: " + (container.find(".app-name").text() || "Qlik Sense"), 10, 23);
          doc.text("Date: " + new Date().toLocaleString(), 10, 30);

          let y = 40;
          chatHistory.forEach(msg => {
            let prefix = msg.role === "user" ? `${msg.userName} (You):` : "Chatbot:";
            let lines = doc.splitTextToSize(prefix + " " + msg.text, 180);
            if (y + (lines.length * 7) > 280) {
              doc.addPage();
              y = 10;
            }
            doc.text(lines, 10, y);
            y += lines.length * 7;
          });

          doc.save("qliksense-chat-history.pdf");
        } catch (e) {
          alert("Error generating PDF: " + e.message);
        }
      });

      // Initialize chatbot closed and show welcome message
      toggleChatbot(false);
      appendMessage("Hello! I'm your Qlik Sense chatbot. Ask me anything about your data or app.", "bot");
    },
  };
});
