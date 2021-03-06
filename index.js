const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server, {cors: {origin: "*"}});
const { 
  createMultiplayerGameState, 
  multiplayerGameLoop, 
  getMultiplayerUpdatedVelocity 
} = require('./multiplayer-game');
const { makeId } = require("./utils");

app.use(express.static('public'));
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

let FRAME_RATE;
const multiplayerState = {};
const socketRooms = {};
const rooms = {};
let playerOneFoodCount = 0;
let playerTwoFoodCount = 0;
let multiplayerGoal;
let allYouCanEatSeconds = 60;
let isTurning = false;
let playerOneColor = "#88F1D2";
let playerTwoColor = "#FFEF5C";

const port = process.env.PORT || 3000

app.get('/', (req, res) => {
  res.render("index", {message: req.message, tryAgain: false});
});

app.get('/single-player-game', (req, res) => {
  res.render("single-player-game");
});

app.post('/create-game', (req, res) => {
  const nickname = req.body.nicknameOne;
  res.render('multiplayer-game', {
    playerNumber: 1, 
    nickname: nickname,
    joinGame: false
  })
});

app.post('/join-game', (req, res) => {
  const nickname = req.body.nicknameTwo;
  const gameCode = req.body.gameCode

  if(!rooms[gameCode]) {
    res.render('multiplayer-lobby', {nickname: nickname, message: "Invalid code!"})
  } else if (rooms[gameCode].playerCount > 1) {
    res.render('multiplayer-lobby', {nickname: nickname, message: "Room is full!"})
  } else {
    res.render('multiplayer-game', {
      playerNumber: 2, 
      nickname: nickname,
      gameCode: gameCode,
      joinGame: true
    })
  }
});

app.post('/multiplayer-lobby', (req, res) => {
  const nickname = req.body.nickname;
  if(nickname === "") {
    res.render("index", {
      message: "Please enter a nickname to continue", 
      tryAgain: true
    })
  } else if(nickname.length > 10) {
    res.render("index", {
      message: "Nickname cannot be longer than 10 characters", 
      tryAgain: true
    })
  }  
  else {
    res.render("multiplayer-lobby", {nickname: nickname, message: ""});
  }
});
  
io.on('connection', (socket) => {   

  socket.on('startGame', handleStartGame)
  socket.on("keydown", handleKeydown);
  socket.on("newMultiplayerGame", handleNewMultiplayerGame);
  socket.on("joinGame", handleJoinGame);
  socket.on('sendMessage', handleSendMessage);
  socket.on('chosenGameType', handleChosenGameType);
  socket.on('switchPlayerNumber', handleSwitchPlayerNumber);
  socket.on('typing', handleTyping)
  socket.on('setPlayerColors', handleSetPlayerColors);

  function handleSetPlayerColors(data) {
    const playerNumber = data.playerNumber;
    const color = data.color;
    if(!playerNumber) return;
    if(playerNumber === 1) playerOneColor = color;
    if(playerNumber === 2) playerTwoColor = color;
  }
  

  function handleStartGame(game){
    const code = game.code;
    const goal = game.goal;
    const speed = game.speed;
    const gameType = game.gameType;

    if (gameType === "Pedal to the metal") {
      FRAME_RATE = 5
    } else {
      FRAME_RATE = speed + 6
    }
    const settings = {
      goal: goal,
      speed: speed
    }
    multiplayerState[code] = createMultiplayerGameState(gameType, playerOneColor, playerTwoColor);
    multiplayerGoal = goal;

    if(rooms[code].playerCount < 2){
      socket.emit('notEnoughPlayers')
      return;
    }
    io.sockets.in(code).emit("countdown")
    io.sockets.in(code).emit("reset")
    io.sockets.in(code).emit("updatePlayerTwoSettings", settings)
    setTimeout(() => {
      if(gameType === "Pedal to the metal") startMultiplayerGameTimeout(code)
      else startMultiplayerGameInterval(code)
    }, 4000);
  }

  function handleKeydown(keyCode) {
    if(isTurning) return;
    isTurning = true;
    try {
      keyCode = parseInt(keyCode);
    } catch(e) {
      console.error(e);
      return;
    }
    const code = socketRooms[socket.id]
    const vel = getMultiplayerUpdatedVelocity(keyCode, multiplayerState[code], socket.number - 1);
    if(vel) {
      multiplayerState[code].players[socket.number -1].vel = vel;
    }
  }

  function handleTyping(data) {
    socket.broadcast.emit('displayTyping', data)
  }

  function handleNewMultiplayerGame(name) {
    let roomName = makeId(5);
    socketRooms[socket.id] = roomName;
    socket.emit("gameCode", roomName)

    rooms[roomName] = {
      playerCount: 1, 
      playerOneName: name, 
      playerTwoName: null,
      playerOneId: socket.id,
      playerTwoId: null
    }; 
 
    socket.join(roomName);
    socket.number = 1;
    socket.emit("init", 1);
    io.sockets.in(roomName).emit('displayPlayerOne' , name)
  }

  function handleJoinGame(data){

    const gameCode = data.code;
    const playerTwo = data.playerTwoName
    socketRooms[socket.id] = gameCode;
    
    if(!rooms[gameCode]) {
      socket.emit('unknownCode')
      return;
    } else if(rooms[gameCode].playerCount > 1)  {
      socket.emit('tooManyPlayers')
      return;
    }
    
    socket.broadcast.emit('postMessage', {
      message: `${playerTwo} joined the game`,
      messageType: "text",
      author: "server"
    })
    rooms[gameCode].playerCount = 2;
    rooms[gameCode].playerTwoName = playerTwo;
    rooms[gameCode].playerTwoId = socket.id;
    socket.join(gameCode);
    socket.number = 2;
    socket.emit("init", 2);

    io.sockets.in(gameCode)
    .emit('displayPlayerNames', {
      playerOne: rooms[gameCode].playerOneName, 
      playerTwo: playerTwo
    });
  }

  function handleSendMessage(data) {
    const roomName = socketRooms[socket.id];
    io.sockets.in(roomName)
    .emit('postMessage', data)
  }

  function handleSwitchPlayerNumber() {
    socket.number = 1;
  }

  socket.on('disconnecting', () => {
    const code = socketRooms[socket.id];
    if(!rooms[code]) return;
    const room = rooms[code];
    const playerOneName = room.playerOneName;
    const playerTwoName = room.playerTwoName;
    if(room) {
      room.playerCount--
      if(room.playerCount < 1) {
        rooms[code] = null;
        return;
      }
      if(socket.number === 1) {
        socket.broadcast.emit('playerLeft', code)
        socket.broadcast.emit('postMessage', {
          author: "server", 
          message: `${playerOneName} left the game`
        })
        socket.broadcast.emit('displayPlayerNames', {
          playerOne: playerTwoName,
          playerTwo: "Awaiting player..." 
        })
        room.playerOneName = room.playerTwoName;
        room.playerOneId = room.playerTwoId;
        room.playerTwoName = null;
        room.playerTwoId = null;

      }
      if(socket.number === 2) {
        socket.broadcast.emit('playerLeft')
        socket.broadcast.emit('postMessage', {
          author: "server", 
          message: `${playerTwoName} left the game`
        });
        socket.broadcast.emit('displayPlayerNames', {
          playerOne: playerOneName,
          playerTwo: "Awaiting player..." 
        })
        room.playerTwoName = null;
        room.playerTwoId = null;
      }
    }
  })
});


function startMultiplayerGameTimeout(roomName) {
  setTimeout(() => {
    const result = multiplayerGameLoop(multiplayerState[roomName]);
    if(!result.winner) {
      emitMultiplayerGameState(roomName, result.foodEaten);
      if(playerOneFoodCount === multiplayerGoal){
        const winner = 1
        emitMultiplayerGameOver(roomName, winner);
      } 
      else if(playerTwoFoodCount === multiplayerGoal){
        const winner = 2
        emitMultiplayerGameOver(roomName, winner);
      }
      else {
        startMultiplayerGameTimeout(roomName)
      }
    }
    else {
      emitMultiplayerGameOver(roomName, result.winner);
    }
    isTurning = false;
  }, 1000 / FRAME_RATE);
}

function startMultiplayerGameInterval(roomName) {
  let timerIntervalId;
  if(multiplayerState[roomName].gameType === "All you can eat") {
    timerIntervalId = setInterval(() => {
      io.sockets.in(roomName)
      .emit('updateAllYouCanEatTimer', allYouCanEatSeconds)
      allYouCanEatSeconds--
      if(allYouCanEatSeconds < 0 ){
        let winner;
        clearInterval(timerIntervalId)
        if(playerOneFoodCount > playerTwoFoodCount) winner = 1;
        if(playerTwoFoodCount > playerOneFoodCount) winner = 2;
        emitMultiplayerGameOver(roomName, winner, gameIntervalId);
        clearImmediate(timerIntervalId);
        allYouCanEatSeconds = 60;
      } 
    }, 1000);
  }
    const gameIntervalId = setInterval(() => {
    const result = multiplayerGameLoop(multiplayerState[roomName]);
    if(!result.winner) {
      emitMultiplayerGameState(roomName, result.foodEaten)
      if(multiplayerState[roomName].gameType !== "All you can eat"){
        if(playerOneFoodCount === multiplayerGoal){
          const winner = 1
          emitMultiplayerGameOver(roomName, winner, gameIntervalId)
        }
        if(playerTwoFoodCount === multiplayerGoal){
          const winner = 2
          emitMultiplayerGameOver(roomName, winner, gameIntervalId)
        }
      }
    }
    else {
      if(multiplayerState[roomName].gameType === "All you can eat") {
        clearInterval(timerIntervalId);
        allYouCanEatSeconds = 60;
      };
      emitMultiplayerGameOver(roomName, result.winner, gameIntervalId)
    }
    isTurning = false;
  }, 1000 / FRAME_RATE);
}

function emitMultiplayerGameState(gameCode, foodEaten) {
  const gameType = multiplayerState[gameCode].gameType;
  io.sockets.in(gameCode)
  .emit("multiplayerGameState", multiplayerState[gameCode]);
  if(foodEaten === 1) playerOneFoodCount++
  if(foodEaten === 2) playerTwoFoodCount++
  if(gameType === "Pedal to the metal" && foodEaten !== false) FRAME_RATE++
  io.sockets.in(gameCode)
  .emit('updateMultiFoodCount', {playerOne: playerOneFoodCount, playerTwo: playerTwoFoodCount})
}

function emitMultiplayerGameOver(gameCode, winner, intervalId){
  const gameType = multiplayerState[gameCode].gameType;
  io.sockets.in(gameCode)
  .emit("multiplayerGameOver", winner);
  multiplayerState[gameCode] = createMultiplayerGameState(gameType);
  playerOneFoodCount = 0;
  playerTwoFoodCount = 0;
  if(gameType !== "Pedal to the metal") clearInterval(intervalId);
  io.sockets.in(gameCode)
  .emit('updateMultiStats', winner)
}

function handleChosenGameType(data) {
  io.sockets.in(data.gameCode)
  .emit('updateChosenGameType', data.gameType)
}


server.listen(port, () => {
  console.log('listening on port: 3000');
});



