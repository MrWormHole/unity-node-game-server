let Connection = require('./Connection.js');
let Player = require('./Player.js');
let Util = require('./Util.js'); //for logging

let LobbyBase = require('./lobby/LobbyBase.js');
let GameLobby = require('./lobby/GameLobby.js');
let GameLobbySettings = require('./lobby/GameLobbySettings.js');

module.exports = class Server {

    constructor(versionNumber) {
        this.version = versionNumber;
        this.connections = [];
        this.lobbies = [];
        this.lobbies[0] = new LobbyBase(0);
    }

    onConnected(socket) {
        let server = this;
        
        let connection = new Connection();
        connection.socket = socket;
        connection.player = new Player(); 
        connection.server = server;

        let player = connection.player;
        let lobbies = server.lobbies;
        server.connections[player.id] = connection;
        
        Util.logSuccess('[SERVER-INFO] Player ' + player.debugPlayerInformation() + ' has connected');

        socket.join(player.lobby);
        connection.lobby = lobbies[player.lobby];
        connection.lobby.onEnterLobby(connection);

        return connection;
    }

    onDisconnected(connection = Connection) {
        let server = this;
        let id = connection.player.id;
        delete server.connections[id];

        Util.logSuccess('[SERVER-INFO] Player ' + connection.player.debugPlayerInformation() + ' has disconnected');

        connection.socket.broadcast.to(connection.player.lobby).emit('disconnected', {
            id: id
        });

        server.lobbies[connection.player.lobby].onLeaveLobby(connection);
    }

    onAttemptToJoinGame(connection = Connection) {
        let server = this;
        let lobbyFound = false;

        let gameLobbies = server.lobbies.filter(item => {
            return item instanceof GameLobby;
        });
        Util.logWarning('[SERVER-INFO] Found (' + gameLobbies.length + ') lobbies on the server');

        gameLobbies.forEach(lobby => {
            if(!lobbyFound) {
                let canJoin = lobby.canEnterLobby(connection);

                if(canJoin) {
                    lobbyFound = true;
                    server.onSwitchLobby(connection, lobby.id);
                }
            }
        });

        if(!lobbyFound) {
            Util.logWarning('[SERVER-INFO] Creating a new game lobby');
            let gamelobby = new GameLobby(gameLobbies.length + 1, new GameLobbySettings('Eliminate all', 4, 20));
            server.lobbies.push(gamelobby);
            server.onSwitchLobby(connection, gamelobby.id);
        }
    }

    onSwitchLobby(connection = Connection, lobbyID) {
        let server = this;
        let lobbies = server.lobbies;

        connection.socket.join(lobbyID);
        connection.lobby = lobbies[lobbyID];

        lobbies[connection.player.lobby].onLeaveLobby(connection);
        lobbies[lobbyID].onEnterLobby(connection);
    }

};