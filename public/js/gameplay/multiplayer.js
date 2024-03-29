import * as DOM from "../domElements.js"
import * as G from "./game.js";

const socket = io('https://snake-race.herokuapp.com');
// const socket = io('http://localhost:3000');

socket.on('countdown', G.handleCountdown); // displays countdown when star game button is clicked
socket.on('multiplayerGameState', G.handleGameState); // receives updated game state from server with every frame
socket.on('multiplayerGameOver', handleMultiplayerGameOver);
socket.on('gameCode', handleGameCode); //sets game code from server as text in a p element only visible to player 1
socket.on('unknownCode', handleUnknownCode);
socket.on('tooManyPlayers', handleTooManyPlayers);
socket.on('displayPlayerOne', handleDisplayPlayerOne) // displays playe rone name when a game is created 
socket.on('displayPlayerNames', handleDisplayPlayerNames) // displays both player names when a second player joins
socket.on('notEnoughPlayers', handleNotEnoughtPlayers)
socket.on('updateMultiFoodCount', handleUpdateMultiFoodCount)
socket.on('updateMultiStats', handleUpdateMultiStats);
socket.on('init', handleInit);
socket.on('updatePlayerTwoSettings', handleUpdatePlayerTwoSettings);// when player one changes settings it shows on player two
socket.on('updateAllYouCanEatTimer', G.handleUpdateAllYouCanEatTimer);
socket.on('updateChosenGameType', handleUpdateChosenGameType);
socket.on('playerLeft', handlePlayerLeft);
socket.on('displayTyping', handleDisplayTyping);

socket.on('postMessage', handlePostMessage)


let playerNumber = parseInt(DOM.playerNumber.value); 
let multiStats = {
    playerOne: {wins: 0, losses: 0},
    playerTwo: {wins: 0, losses: 0}
}
let mobile = window.screen.width < 993 ? true : false
let typing, typingTimeout;
const GIPHY_API_KEY = "XZ1XB9l5SzJmOWNCfvS7TiNhAz3fbG0q"
let originalGifs = [];
let gifStills = [];



document.addEventListener('keydown', multiplayerKeydown);
document.addEventListener('keyup', userTyping)

G.init(playerNumber);

if(playerNumber === 1) {
    DOM.gameTypeHeader.style.display = "none";
    socket.emit('newMultiplayerGame', DOM.nickname.value);
} else if (playerNumber === 2) {
    const data = {
        code: DOM.gameCode.value,
        playerTwoName: DOM.nickname.value
    }
    socket.emit('joinGame', data);
}

DOM.multiplayerSnakeColors.forEach(color => {
    color.addEventListener('click', () => {
        DOM.multiplayerSnakeColors.forEach(color => {
            color.classList.remove("color-active")
        })
        color.classList.add("color-active")
        DOM.snakeColorDisplay.style.backgroundColor = getComputedStyle(color).backgroundColor;
        console.log(DOM.snakeColorDisplay)
        const data = {
            playerNumber: playerNumber,
            color: getComputedStyle(color).backgroundColor
        }
        socket.emit('setPlayerColors', data)
    });
    if(color.classList.contains("color-active")) {
        DOM.snakeColorDisplay.style.backgroundColor = getComputedStyle(color).backgroundColor;
    }
});

DOM.startGameBtn.addEventListener('click', startGame); 
DOM.playAgainBtn.addEventListener('click', startGame);

function startGame() {
    if(!mobile) {
        DOM.startGameBtn.style.display = "none";
        DOM.playAgainBtn.classList.add("button-disabled");
        DOM.playAgainBtn.style.display = "block";
    } else {
        DOM.mobileStartGameBtn.innerHTML = "Play again";
    }
    const gameSettings = {
        speed: parseInt(DOM.speedInput.value),
        gameType: DOM.currentGameType.innerHTML,
        code: DOM.yourGameCode.innerHTML.split(" ")[2],
        goal: parseInt(DOM.goalInput.value)
    }
    socket.emit('startGame', gameSettings);
}

function multiplayerKeydown(e) {
    const keyCode = e.keyCode;
    switch(keyCode){
        case 37: case 39: case 38:  case 40: 
            e.preventDefault(); 
            socket.emit('keydown', keyCode)
         break; 
         case 13: 
         if(DOM.messageInput === document.activeElement) {
            sendMessage();
         }
         if(DOM.gifSearchInput === document.activeElement) {
            fetchGifs();
         }
        default: break; 
    }
}


function handlePlayerLeft(code) {
    playerNumber = 1;
    if(!mobile) {
        DOM.startGameBtn.style.display = "block";
    } else {
        DOM.mobileStartGameBtn.style.display = "block"
        DOM.currentGameType.style.display = "none";
    }
    DOM.gameTypeDropdown.style.display = "block";
    DOM.goalSetting.classList.remove("player-2-settings");
    DOM.speedSetting.classList.remove("player-2-settings");
    DOM.gameTypeHeader.style.display = "none";
    DOM.yourGameCode.innerHTML = "Game code: " + code;
    socket.emit('switchPlayerNumber')
}

function handleDisplayPlayerOne(name) {
    DOM.player1.innerHTML = name;
}

function handleDisplayPlayerNames(data) {
    DOM.player1.innerHTML = data.playerOne;
    DOM.player2.innerHTML = data.playerTwo;
    if(data.playerTwo === "Awaiting player..."){
        DOM.player2.parentElement.style.backgroundColor = "#a7a7a7";
    } else {
        DOM.player2.parentElement.style.backgroundColor = "#B4DE3E";
    }
}

function handleUpdatePlayerTwoSettings(settings) {
    if(playerNumber === 2) {
        DOM.goalInput.value = settings.goal;
        DOM.speedInput.value = settings.speed;
    }
}

function handleNotEnoughtPlayers(){
    if(!mobile) {
        DOM.startGameBtn.style.display = "block";
        DOM.playAgainBtn.style.display = "none";
    } else {
        DOM.mobileStartGameBtn.innerHTML = "Start game"
    }
    DOM.gameMessage.innerHTML = "Not enough players"
    setTimeout(() => {
        DOM.gameMessage.innerHTML = ""
    }, 2000);
}

function handleInit(playerNumber) {
    if(playerNumber === 1) {
        DOM.goalSetting.classList.remove("player-2-settings");
        DOM.speedSetting.classList.remove("player-2-settings");
        if(!mobile) DOM.startGameBtn.style.display = "block";
        DOM.gameTypeDropdown.style.display = "block";
        DOM.gameTypeHeader.style.display = "none";
    } else { 
        DOM.goalSetting.classList.add("player-2-settings");
        DOM.speedSetting.classList.add("player-2-settings");
        DOM.startGameBtn.style.display = "none";
        DOM.gameTypeDropdown.style.display = "none";
        DOM.gameTypeHeader.style.display = "block";
        DOM.mobileStartGameBtn.style.display = "none";
        DOM.currentGameType.style.display = "block"
    }
}

function handleUpdateChosenGameType(gameType) {
    DOM.currentGameType.innerHTML = gameType;
}

function handleUpdateMultiFoodCount(data) {
    DOM.playerOneFoodCount.innerHTML = data.playerOne
    DOM.playerTwoFoodCount.innerHTML = data.playerTwo
}

function handleUpdateMultiStats(winner) {

    if(winner === 1) {
        multiStats.playerOne.wins++ 
        multiStats.playerTwo.losses++ 
    } 
    if (winner === 2){
        multiStats.playerOne.losses++ 
        multiStats.playerTwo.wins++ 
    }
    if(playerNumber === 1) {
        DOM.wins.innerHTML = multiStats.playerOne.wins
        DOM.losses.innerHTML = multiStats.playerOne.losses
    }
    if(playerNumber === 2) {
        DOM.wins.innerHTML = multiStats.playerTwo.wins
        DOM.losses.innerHTML = multiStats.playerTwo.losses
    }
} 

function handleMultiplayerGameOver(winner) {
    DOM.playAgainBtn.classList.remove("button-disabled");

    if (winner === playerNumber) {
        DOM.gameMessage.innerHTML = "You<br>win!"
    } else {
        DOM.gameMessage.innerHTML = "You<br>lose"
    }
}

function handleGameCode(roomCode) {
    DOM.yourGameCode.innerHTML = `Game code: ${roomCode}`
}

function handleUnknownCode() {
    reset();
}

function handleTooManyPlayers() {
    reset();
    DOM.codeInputMessage.style.opacity = "1";
    DOM.codeInputMessage.innerHTML = "Room is full"
}

function reset() {
    playerNumber = null;
    DOM.gameCode.value = '';
}

//CHAT ///////////////////////////////////////////////////////////

DOM.sendMessageBtn.addEventListener('click', sendMessage)

function sendMessage() {
    const data = {
        message: DOM.messageInput.value,
        messageType: "text",
        author: playerNumber
    }
    if(data.message === "") {return;};
    socket.emit('sendMessage', data);
    DOM.messageInput.value = "";
    DOM.messageInput.focus();
}

function handlePostMessage(data) {
    const type = data.messageType;
    const author = data.author;
    const message = data.message;
    const url = data.url;
    const stillUrl = data.stillUrl;
    createNewMessage(type, author, message, url, stillUrl);
    setTimeout(() => {
        scrollMessages();
    }, 200);
}

function scrollMessages() {
    DOM.sentMessagesContainer.scrollTop = DOM.sentMessagesContainer.scrollHeight;
}

function createNewMessage(type, author, message, url, stillUrl) {
    const newMessage = document.createElement("div");
    newMessage.classList.add("chat-message");
    if(type === "text") {
        DOM.displayTyping.innerHTML = "";
        const textMessageContent = document.createElement("p");
        textMessageContent.innerHTML = message
        newMessage.appendChild(textMessageContent);
        DOM.sentMessagesContainer.appendChild(newMessage);
    }
    if(type === "gif") {
        const gifMessageContent = document.createElement("img");
        gifMessageContent.src = url;
        gifMessageContent.classList.add("gif-message__img")
        newMessage.classList.add("gif-message");
        newMessage.appendChild(gifMessageContent);
        DOM.sentMessagesContainer.appendChild(newMessage);
        if(!mobile) {
            setTimeout(() => {
                gifMessageContent.src = stillUrl
                gifMessageContent.addEventListener('mouseenter', () => {
                    gifMessageContent.src = url
                });
                gifMessageContent.addEventListener('mouseleave', () => {
                    gifMessageContent.src = stillUrl
                });
            }, 6000);
        }
    }

    if(author === playerNumber){
        newMessage.classList.add("outgoing-message");
    } 
    if(author !== playerNumber && author !== "server") {
        newMessage.classList.add("incoming-message");
        if(!DOM.gameChat.classList.contains("mobile-chat-open")) {
            DOM.mobileChatBtn.classList.add("notification")
        }
    } 
    if(author === "server") {
        newMessage.classList.add("server-message");
        if(mobile){
            DOM.alertMessage.innerHTML = message;
            DOM.alert.classList.add("show-message")
        }
    }
}

function userTyping(e) {
    if(e.keyCode === 13) return;
    if(DOM.messageInput === document.activeElement) {
        typing = true;
        socket.emit('typing', {nickname: DOM.nickname.value, typing: typing})
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
            typing = false;
            socket.emit('typing', {nickname: DOM.nickname.value, typing: typing})
        }, 3000);
     }
}

function handleDisplayTyping(data) {
    if(data.typing === true) {
        DOM.displayTyping.innerHTML = `${data.nickname} is typing...`
    } else {
        DOM.displayTyping.innerHTML = ""
    }
}


if(mobile) {
    DOM.gifSearchInput.addEventListener('input', fetchGifs)
}
DOM.gifBtn.addEventListener('click', toggleGifs);

function toggleGifs() {
    DOM.gifDisplay.classList.toggle("show-flex");
    DOM.messageInput.classList.toggle("input-hidden");
    DOM.gifSearchInput.classList.toggle("input-hidden");
    DOM.gifBtn.classList.toggle("active-gif-button");
    DOM.messageInput.focus()
    DOM.gifSearchInput.focus()
    DOM.gifSearchInput.value = "";
}

DOM.gifImages.forEach(img => {
    img.addEventListener('click', () => {
        const index = DOM.gifImages.indexOf(img);
        const data = {
            stillUrl: gifStills[index],
            url: originalGifs[index],
            messageType: "gif",
            author: playerNumber
        }
        toggleGifs();
        socket.emit('sendMessage', data);
        DOM.gifImages.forEach(img => {
            img.style.display = "none";
        });
    });
});

function fetchGifs() {
    let gifSearchValue = DOM.gifSearchInput.value.trim();
    let url = `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&limit=20&q=${gifSearchValue}`
    fetch(url)
    .then(response => response.json())
    .then(content => {
        let index = 0
        DOM.gifImages.forEach(img => {
            const url = content.data[index].images.fixed_width_downsampled.url
            const alt = content.data[index].title
            img.src = url;
            img.alt = alt;
            originalGifs[index] = content.data[index].images.original.url;
            gifStills[index] = content.data[index].images.downsized_still.url;
            index++
            img.style.display = "block";
        });
        DOM.gifDisplay.scroll({
            top: 0,
            behavior: 'smooth'
        });
        console.log(content.data)
    })
    .catch(err => {
        console.log(err);
    })
}


DOM.gameTypeOptions.forEach(option => {
    option.addEventListener('click', () => {
        if(option.innerHTML === "Pedal to the metal") {
            DOM.speedInput.disabled = true;
            DOM.goalInput.disabled = false;
        } 
        if (option.innerHTML === "All you can eat"){
            DOM.goalInput.disabled = true;
            DOM.speedInput.disabled = false;
        }
        if(option.innerHTML === "Classic" || option.innerHTML === "Live bait") {
            DOM.goalInput.disabled = false;
            DOM.speedInput.disabled = false;
        }
        DOM.gameTypeOptions.forEach( option => {
            option.classList.remove("option-active")
        });
        option.classList.add("option-active") 
        DOM.currentGameType.innerHTML = option.innerHTML;
        const data = {
            gameCode: DOM.yourGameCode.innerHTML.split(" ")[2],
            gameType: option.innerHTML
        }
        socket.emit('chosenGameType', data)
    })
});

//Mobile //////////////////////////////////////////////////////////

if(mobile) {


    DOM.mobileChatBtn.addEventListener('click', () => {
        DOM.gameChat.classList.add("mobile-chat-open")
        DOM.mobileChatBtn.classList.remove("notification");
    });

    DOM.closeChatBtn.addEventListener('click', () => {
        DOM.gameChat.classList.remove("mobile-chat-open")
    });

    DOM.mobileSendMessageBtn.addEventListener('click', sendMessage)

    DOM.mobileStartGameBtn.addEventListener('click', startGame);
    
    DOM.mobileSettingsBtn.addEventListener('click', () => {
        DOM.gameSettings.style.left = "50%";
        DOM.gameSettings.style.transform = "translateX(-50%)";
    });
   
    
    DOM.backArrow.addEventListener('click', () => {
        DOM.gameSettings.style.left = "-110%";
    });
    
    DOM.mobileControlArrows.forEach(arrow => {
        arrow.addEventListener('click', () => {
            let keyCode;
            if(arrow.classList.contains("up")){
                keyCode = 38;
            }
            if(arrow.classList.contains("down")){
                keyCode = 40;
            }
            if(arrow.classList.contains("left")){
                keyCode = 37;
            }
            if(arrow.classList.contains("right")){
                keyCode = 39;
            }
            socket.emit('keydown', keyCode)
        });
    });
}

