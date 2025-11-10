const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });


let allScoreboards = {}; 
let allTimers = {}; 
let activeConnections = {}; 

const DEFAULT_STATE = {
  homeTeam: "Takım A",
  awayTeam: "Takım B",
  homeColor: "#0066ff",
  awayColor: "#ff3333",
  homeLogo: "",
  awayLogo: "",
  homeLogoBgColor: "#ffffff",
  awayLogoBgColor: "#ffffff",
  sponsorLogo: "",
  homeScore: 0,
  awayScore: 0,
  timer: 0,
  half: 1,
  isTimerRunning: false,
  extra1: 0,
  extra2: 0,
  extraTimer: 0,
  isExtraTimeRunning: false,
  extra: 0,
  isScoreboardVisible: true,
  matchStatusMessage: "",
  isStatusMessageVisible: false,
  isStatusMessageAnimating: false,
  timerBgColor: "#02271f",
  timerOpacity: 1,
  teamBgColor: "#033931",
  teamOpacity: 1,
  extraTimeBgColor: "#8B0000",
  extraTimeOpacity: 1,
  scoreboardBgColor: "#141414",
  scoreboardOpacity: 1
};

function generateRandomId() {
  return Math.random().toString(36).substring(2, 10);
}

function broadcastState(id) {
  if (!activeConnections[id] || !allScoreboards[id]) return;

  const stateJson = JSON.stringify({ action: "state", state: allScoreboards[id] });
  activeConnections[id].forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(stateJson);
    }
  });
}

function stopAllTimers(id) {
  if (allTimers[id]) {
    clearInterval(allTimers[id]);
    delete allTimers[id];
  }
  if (allScoreboards[id]) {
    allScoreboards[id].isTimerRunning = false;
    allScoreboards[id].isExtraTimeRunning = false;
  }
}

function startTimer(id) {
  if (!allScoreboards[id]) return;
  
  const currentState = allScoreboards[id];
  stopAllTimers(id);

  currentState.isTimerRunning = true;
  currentState.isExtraTimeRunning = false;

  allTimers[id] = setInterval(() => {
    if (!allScoreboards[id]) { 
        stopAllTimers(id);
        return;
    }
    
    if (currentState.isTimerRunning) {
      currentState.timer++;

      
      if (currentState.half === 1 && currentState.timer >= 45 * 60) {
        if (currentState.extra1 > 0) {
          stopAllTimers(id);
          startExtraTimeTimer(id, currentState.extra1 * 60);
        } else {
          stopAllTimers(id);
        }
      } else if (currentState.half === 2 && currentState.timer >= 90 * 60) {
        if (currentState.extra2 > 0) {
          stopAllTimers(id);
          startExtraTimeTimer(id, currentState.extra2 * 60);
        } else {
          stopAllTimers(id);
        }
      }
    }
    broadcastState(id);
  }, 1000);
}

function startExtraTimeTimer(id, durationInSeconds) {
  if (!allScoreboards[id]) return;

  const currentState = allScoreboards[id];
  stopAllTimers(id);

  currentState.isExtraTimeRunning = true;
  currentState.extraTimer = 0;
  currentState.extra = durationInSeconds / 60; 
  
  allTimers[id] = setInterval(() => {
    if (!allScoreboards[id]) {
        stopAllTimers(id);
        return;
    }
    
    currentState.extraTimer++;
    if (currentState.extraTimer >= durationInSeconds) {
      stopAllTimers(id);
      currentState.isExtraTimeRunning = false;
    }
    broadcastState(id);
  }, 1000);
}

function resetAll(id) {
  stopAllTimers(id);
  allScoreboards[id] = JSON.parse(JSON.stringify(DEFAULT_STATE)); 
}



app.use(express.static(path.join(__dirname, "public")));


app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});


app.get("/new", (req, res) => {
  let newId = generateRandomId();
  while (allScoreboards[newId]) { 
    newId = generateRandomId();
  }
  
  allScoreboards[newId] = JSON.parse(JSON.stringify(DEFAULT_STATE));
  activeConnections[newId] = [];
  allTimers[newId] = null; 

  console.log(`Yeni skorbord oluşturuldu: ID=${newId}`);
  res.redirect(`/control/${newId}`); 
});


app.get("/board/:id", (req, res) => {
  const boardId = req.params.id;
  if (allScoreboards[boardId]) {
    res.sendFile(path.join(__dirname, "public", "scoreboard.html"));
  } else {
    res.status(404).send("Hata: Bu Skorbord ID'si bulunamadı. Ana sayfaya dönün: <a href='/'>Başlangıç</a>");
  }
});


app.get("/control/:id", (req, res) => {
  const boardId = req.params.id;
  if (allScoreboards[boardId]) {
    res.sendFile(path.join(__dirname, "public", "control.html"));
  } else {
    res.status(404).send("Hata: Bu Skorbord ID'si bulunamadı. Ana sayfaya dönün: <a href='/'>Başlangıç</a>");
  }
});




wss.on("connection", (ws, req) => {
  
  const boardId = req.url.substring(1); 
  
  if (!boardId || !allScoreboards[boardId]) {
    console.log(`Bağlantı reddedildi: Geçersiz ID: ${boardId}`);
    ws.close();
    return;
  }

  if (!activeConnections[boardId]) {
    activeConnections[boardId] = [];
  }
  activeConnections[boardId].push(ws);
  
  console.log(`İstemci bağlandı. ID: ${boardId}.`);

  ws.send(JSON.stringify({ action: "init", state: allScoreboards[boardId] }));


  ws.on("message", (message) => {
    let data;
    try {
      data = JSON.parse(message);
    } catch (e) {
      console.error("Geçersiz JSON alındı:", message);
      return;
    }

    if (!data.action) return;
    
    let currentState = allScoreboards[boardId];

    switch (data.action) {
      case "updateTeamNames":
        currentState.homeTeam = data.homeTeamName;
        currentState.awayTeam = data.awayTeamName;
        break;
      case "updateScores":
        currentState.homeScore = data.homeScore;
        currentState.awayScore = data.awayScore;
        break;
      case "updateColors":
        currentState.homeColor = data.homeColor;
        currentState.awayColor = data.awayColor;
        break;
      case "updateBackgroundColors":
        currentState.timerBgColor = data.timerBgColor;
        currentState.timerOpacity = data.timerOpacity;
        currentState.teamBgColor = data.teamBgColor;
        currentState.teamOpacity = data.teamOpacity;
        currentState.extraTimeBgColor = data.extraTimeBgColor;
        currentState.extraTimeOpacity = data.extraTimeOpacity;
        currentState.scoreboardBgColor = data.scoreboardBgColor;
        currentState.scoreboardOpacity = data.scoreboardOpacity;
        break;
      case "resetBackgroundColors":
        currentState.timerBgColor = DEFAULT_STATE.timerBgColor;
        currentState.timerOpacity = DEFAULT_STATE.timerOpacity;
        currentState.teamBgColor = DEFAULT_STATE.teamBgColor;
        currentState.teamOpacity = DEFAULT_STATE.teamOpacity;
        currentState.extraTimeBgColor = DEFAULT_STATE.extraTimeBgColor;
        currentState.extraTimeOpacity = DEFAULT_STATE.extraTimeOpacity;
        currentState.scoreboardBgColor = DEFAULT_STATE.scoreboardBgColor;
        currentState.scoreboardOpacity = DEFAULT_STATE.scoreboardOpacity;
        break;
      case "uploadLogo":
        if (data.team === "home") currentState.homeLogo = data.logo;
        else currentState.awayLogo = data.logo;
        break;
      case "removeLogo":
        if (data.team === "home") currentState.homeLogo = "";
        else currentState.awayLogo = "";
        break;
      case "uploadSponsorLogo":
        currentState.sponsorLogo = data.logo;
        break;
      case "removeSponsorLogo":
        currentState.sponsorLogo = "";
        break;
      case "toggleScoreboard":
        currentState.isScoreboardVisible = !currentState.isScoreboardVisible;
        break;
      case "toggleTimer":
        if (currentState.isExtraTimeRunning || currentState.isTimerRunning) {
          stopAllTimers(boardId);
        } else {
          startTimer(boardId);
        }
        break;
      case "resetTimer":
        stopAllTimers(boardId);
        currentState.timer = 0;
        break;
      case "setManualTimer":
        stopAllTimers(boardId);
        currentState.timer = (data.minutes * 60) + data.seconds;
        break;
      case "setExtraTimes":
        currentState.extra1 = data.extra1;
        currentState.extra2 = data.extra2;
        break;
      case "resetExtraTime":
        stopAllTimers(boardId);
        currentState.isExtraTimeRunning = false;
        currentState.extraTimer = 0;
        currentState.extra = 0;
        break;
      case "startFirstHalf":
        stopAllTimers(boardId);
        currentState.half = 1;
        currentState.timer = 0;
        break;
      case "startSecondHalf":
        stopAllTimers(boardId);
        currentState.half = 2;
        currentState.timer = 45 * 60;
        break;
      case "showHalfTime":
        stopAllTimers(boardId);
        currentState.matchStatusMessage = "DEVRE ARASI";
        currentState.isStatusMessageVisible = true;
        break;
      case "showFullTime":
        stopAllTimers(boardId);
        currentState.matchStatusMessage = "MAÇ SONU";
        currentState.isStatusMessageVisible = true;
        break;
      case "hideStatusMessage":
        currentState.isStatusMessageVisible = false;
        currentState.matchStatusMessage = "";
        break;
      case "resetAll":
        resetAll(boardId);
        break;
    }

    broadcastState(boardId);
  });

  ws.on("close", () => {
    activeConnections[boardId] = activeConnections[boardId].filter(conn => conn !== ws);
    console.log(`İstemci bağlantısı kesildi. ID: ${boardId}.`);
    
    if (activeConnections[boardId].length === 0) {
        stopAllTimers(boardId);
    }
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Sunucu ${PORT} portunda çalışıyor.`);

});

