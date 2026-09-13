const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

const suits = ['♠', '♥', '♦', '♣'];
const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function getRandomCard() {
    let s = suits[Math.floor(Math.random() * suits.length)];
    let v = values[Math.floor(Math.random() * values.length)];
    return { suit: s, value: v, isRed: (s === '♥' || s === '♦') };
}

let roomState = {
    players: [],
    pot: 0,
    isPlaying: false
};

io.on('connection', (socket) => {
    console.log('Player joined:', socket.id);

    if (roomState.players.length < 2) {
        roomState.players.push({ id: socket.id, cards: [], isPacked: false });
    }
    
    io.emit('updateRoom', {
        playerCount: roomState.players.length,
        pot: roomState.pot,
        isPlaying: roomState.isPlaying
    });

    socket.on('startGame', () => {
        if (roomState.players.length < 2) {
            socket.emit('gameError', 'খেলার জন্য অন্তত ২ জন প্লেয়ার প্রয়োজন!');
            return;
        }

        roomState.pot = 40;
        roomState.isPlaying = true;

        roomState.players.forEach(player => {
            player.isPacked = false;
            player.cards = [getRandomCard(), getRandomCard(), getRandomCard()];
            io.to(player.id).emit('dealCards', player.cards);
        });

        io.emit('updateRoom', {
            playerCount: roomState.players.length,
            pot: roomState.pot,
            isPlaying: roomState.isPlaying
        });
    });

    socket.on('chaal', () => {
        if (!roomState.isPlaying) return;
        roomState.pot += 20;
        io.emit('updateRoom', {
            playerCount: roomState.players.length,
            pot: roomState.pot,
            isPlaying: roomState.isPlaying
        });
    });

    socket.on('pack', () => {
        if (!roomState.isPlaying) return;
        roomState.isPlaying = false;
        let winner = roomState.players.find(p => p.id !== socket.id);
        io.emit('gameOver', { winnerId: winner ? winner.id : null, pot: roomState.pot });
    });

    socket.on('disconnect', () => {
        console.log('Player left:', socket.id);
        roomState.players = roomState.players.filter(p => p.id !== socket.id);
        if (roomState.players.length < 2) {
            roomState.isPlaying = false;
            roomState.pot = 0;
        }
        io.emit('updateRoom', {
            playerCount: roomState.players.length,
            pot: roomState.pot,
            isPlaying: roomState.isPlaying
        });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
