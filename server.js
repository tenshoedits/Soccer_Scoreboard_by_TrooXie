const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, "public")));

let scoreboardState = {
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

let mainTimerInterval;
let extraTimeTimerInterval;

function startTimer() {
  if (scoreboardState.isTimerRunning) return;
  scoreboardState.isTimerRunning = true;
  broadcastState(); 
  mainTimerInterval = setInterval(() => {
    scoreboardState.timer++;
    broadcastState();
    
    const isFirstHalfEnd = scoreboardState.half === 1 && scoreboardState.timer >= 45 * 60;
    const isSecondHalfEnd = scoreboardState.half === 2 && scoreboardState.timer >= 90 * 60;

    if (isFirstHalfEnd || isSecondHalfEnd) {
      const extraTime = scoreboardState.half === 1 ? scoreboardState.extra1 : scoreboardState.extra2;
      
      if (extraTime > 0) {
        clearInterval(mainTimerInterval);
        scoreboardState.isTimerRunning = false;
        startExtraTimeTimer(extraTime);
      } else {
        stopAllTimers();
      }
    }
  }, 1000);
}

function startExtraTimeTimer(extra) {
    if (scoreboardState.isExtraTimeRunning) return;
    scoreboardState.isExtraTimeRunning = true;
    scoreboardState.extra = extra;
    broadcastState(); 
    extraTimeTimerInterval = setInterval(() => {
        scoreboardState.extraTimer++;
        broadcastState();
    }, 1000);
}

function stopAllTimers() {
  clearInterval(mainTimerInterval);
  clearInterval(extraTimeTimerInterval);
  scoreboardState.isTimerRunning = false;
  scoreboardState.isExtraTimeRunning = false;
  broadcastState();
}

function resetAll() {
  stopAllTimers();
  scoreboardState = {
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
  broadcastState();
}

function broadcastState() {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ action: "state", state: scoreboardState }));
    }
  });
}

wss.on("connection", (ws) => {
  console.log("Client connected.");
  ws.send(JSON.stringify({ action: "init", state: scoreboardState }));

  ws.on("message", (message) => {
    const data = JSON.parse(message);
    switch (data.action) {
      case "updateTeamNames":
        scoreboardState.homeTeam = data.homeTeamName;
        scoreboardState.awayTeam = data.awayTeamName;
        broadcastState();
        break;
      case "updateColors":
        scoreboardState.homeColor = data.homeColor;
        scoreboardState.awayColor = data.awayColor;
        broadcastState();
        break;
      case "updateBackgroundColors":
        scoreboardState.timerBgColor = data.timerBgColor;
        scoreboardState.timerOpacity = data.timerOpacity;
        scoreboardState.teamBgColor = data.teamBgColor;
        scoreboardState.teamOpacity = data.teamOpacity;
        scoreboardState.extraTimeBgColor = data.extraTimeBgColor;
        scoreboardState.extraTimeOpacity = data.extraTimeOpacity;
        scoreboardState.scoreboardBgColor = data.scoreboardBgColor;
        scoreboardState.scoreboardOpacity = data.scoreboardOpacity;
        broadcastState();
        break;
      case "resetBackgroundColors":
        scoreboardState.timerBgColor = "#02271f";
        scoreboardState.timerOpacity = 1;
        scoreboardState.teamBgColor = "#033931";
        scoreboardState.teamOpacity = 1;
        scoreboardState.extraTimeBgColor = "#8B0000";
        scoreboardState.extraTimeOpacity = 1;
        scoreboardState.scoreboardBgColor = "#141414";
        scoreboardState.scoreboardOpacity = 1;
        broadcastState();
        break;
      case "updateScores":
        scoreboardState.homeScore = data.homeScore;
        scoreboardState.awayScore = data.awayScore;
        broadcastState();
        break;
      case "uploadLogo":
        scoreboardState[data.team + "Logo"] = data.logo;
        broadcastState();
        break;
      case "uploadSponsorLogo":
        scoreboardState.sponsorLogo = data.logo;
        broadcastState();
        break;
      case "removeSponsorLogo":
        scoreboardState.sponsorLogo = "";
        broadcastState();
        break;
      case "removeLogo":
        scoreboardState[data.team + "Logo"] = "";
        scoreboardState[data.team + "LogoBgColor"] = "#ffffff";
        broadcastState();
        break;
      case "toggleTimer":
        scoreboardState.isTimerRunning ? stopAllTimers() : startTimer();
        break;
      case "resetAll":
        resetAll();
        break;
      case "setExtraTimes":
        scoreboardState.extra1 = data.extra1 || 0;
        scoreboardState.extra2 = data.extra2 || 0;
        broadcastState();
        break;
      case "setManualTimer":
        stopAllTimers();
        scoreboardState.timer = ((data.minutes || 0) * 60) + (data.seconds || 0);
        broadcastState();
        break;
      case "startSecondHalf":
        stopAllTimers();
        scoreboardState.half = 2;
        scoreboardState.timer = 45 * 60;
        scoreboardState.isExtraTimeRunning = false;
        scoreboardState.extraTimer = 0;
        scoreboardState.extra = 0;
        broadcastState();
        break;
      case "startFirstHalf":
        stopAllTimers();
        scoreboardState.half = 1;
        scoreboardState.timer = 0;
        scoreboardState.isExtraTimeRunning = false;
        scoreboardState.extraTimer = 0;
        scoreboardState.extra = 0;
        broadcastState();
        break;
      case "toggleScoreboard":
        scoreboardState.isScoreboardVisible = !scoreboardState.isScoreboardVisible;
        if (scoreboardState.matchStatusMessage !== "") {
          scoreboardState.isStatusMessageAnimating = true;
          setTimeout(() => {
            scoreboardState.isStatusMessageAnimating = false;
            broadcastState();
          }, 500);
        }
        broadcastState();
        break;
      
      case "showHalfTime":
        scoreboardState.matchStatusMessage = "DEVRE ARASI";
        scoreboardState.isStatusMessageVisible = true;
        scoreboardState.isStatusMessageAnimating = true;
        setTimeout(() => {
            scoreboardState.isStatusMessageAnimating = false;
            broadcastState();
        }, 500);
        broadcastState();
        break;
      case "showFullTime":
        scoreboardState.matchStatusMessage = "MAÇ SONU";
        scoreboardState.isStatusMessageVisible = true;
        scoreboardState.isStatusMessageAnimating = true;
        setTimeout(() => {
            scoreboardState.isStatusMessageAnimating = false;
            broadcastState();
        }, 500);
        broadcastState();
        break;
      case "hideStatusMessage":
        scoreboardState.isStatusMessageVisible = false;
        scoreboardState.isStatusMessageAnimating = true;
        setTimeout(() => {
            scoreboardState.matchStatusMessage = "";
            scoreboardState.isStatusMessageAnimating = false;
            broadcastState();
        }, 500);
        broadcastState();
        break;
        
      case "resetExtraTime":
        stopAllTimers();
        scoreboardState.isExtraTimeRunning = false;
        scoreboardState.extraTimer = 0;
        scoreboardState.extra = 0;
        broadcastState();
        break;
    }
  });

  ws.on("close", () => {
    console.log("Client disconnected.");
  });
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

server.listen(8080, () => {
  console.log("Server started on http://localhost:8080");
});