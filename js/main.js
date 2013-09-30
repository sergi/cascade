'use strict';

var events = require('events');
var irc = require('irc');
var gui = require('nw.gui');
var fs = require('fs');

gui.Window.get().showDevTools()
gui.Window.get().menu = new gui.Menu({ type: 'menubar' });

var Config = JSON.parse(fs.readFileSync('config.json', { encoding: 'utf8' }));

function cleanName(name) {
  return name[0] === '#' ?
    name.substr(1, name.length - 1) : name;
}

function getCurrentChannelEl(name) {
  var el = document.getElementById('channel-pane-' + cleanName(name));
  return el;
}

function ServerCtrl($scope) {
  $scope.logs = [];

  function msg(obj) {
    obj.time = moment().format('H:mm:ss');
    $scope.logs.push(obj);
  }

  var ircServer = $scope.$parent.server.ircServer;

  ircServer.on('motd', function(motd) {
    motd = motd.split(/\n\r?/);
    motd.forEach(function(line) {
      msg({ text: line });
    });
    $scope.$apply();
  });

  ircServer.on('raw', function(message) {
    switch (message.rawCommand) {
      case ('001'):
      case ('002'):
      case ('003'):
        msg({ text: message.args[1] });
        break;
    }
  });

  ircServer.on('error', function(message) {
    console.log('ERROR', message);
  });

  ircServer.connect();
}

function ChanCtrl($scope) {
  $scope.logs = [];
  $scope.nicks = [];
  $scope.topic = '';

  $scope.init = function(channelName, serverName) {
    var _name = channelName;
    var serverObj = $scope.$parent.getServerByName(serverName);
    var ircServer = serverObj.ircServer;

    $scope.serverAddress = serverObj.address;

    function msg(obj) {
      obj.time = moment().format('H:mm:ss');
      $scope.$apply(function() {
        $scope.logs.push(obj);
      });
    }

    if (!ircServer) {
      console.error("No server found for channel " + _name);
      return;
    }

    ircServer.on('names#' + _name, function(nicks) {
      $scope.$apply(function() {
        $scope.nicks = nicks;
      });
    });

    ircServer.on('topic', function(channel, topic, nick, message) {
      channel = cleanName(channel);
      if (channel === _name) {
        msg({
          text: 'Topic is ' + topic,
          isMeta: true
        });
      }
    });

    ircServer.on('message#' + _name, function(from, text, message) {
      var usernames = Object.keys($scope.nicks);
      for (var i = 0; i < usernames.length; i++) {
        var re = new RegExp('(' + escapeRegExp(usernames[i]) + ')');
        if (text.search(re) !== -1) {
          text = text.replace(re, '<b>$1</b>');
        }
      }

      msg({
        from: from,
        text: text
      });
    });

    ircServer.on('+mode', function(channel, by, mode, argument, _msg) {
      var usernames = Object.keys($scope.nicks);
      by = by || serverObj.address;
      var line = by + ' sets mode +' + mode;

      if (argument && usernames.indexOf(argument) !== -1) {
        line += ' ' + argument;
      }

      msg({
        text: line,
        isMeta: true
      });
    });
  }
}

function AppController($scope, $compile) {
  $scope.servers = [];
  $scope.getServerByName = function(name) {
    var servers = $scope.servers;
    for (var i = 0; i < servers.length; i++) {
      if (servers[i].address === name)
        return servers[i];
    }
  };

  Config.servers.forEach(function(server) {
    var ircServer = new irc.Client(server.address, server.nick, {
      channels: server.channels,
      autoConnect: false
    });

    var _server = {
      address: server.address,
      ircServer: ircServer,
      channels: []
    };

    ircServer.on('join', function(channel, nick, message) {
        channel = cleanName(channel);
        var channelExists = _server.channels.some(function(c) {
          return c === channel;
        });

        if (channelExists) return;

        if (!document.getElementById('channel-pane-' + channel)) {
          var el = $compile(
            '<div id="channel-pane-' + channel + '" ' +
              'class="channel-content" ' +
              'ng-controller="ChanCtrl" ' +
              'ng-init="init(\'' + channel + '\', \'' + server.address + '\')"' +
              'ng-include src="\'views/view-channel.html\'" ' +
              'ng-show="isCurrentChannel(\'' + channel + '\', \'' + server.address + '\')">' +
              '</div>')($scope)[0];

          document.getElementById('channel-main').appendChild(el);
        }

        $scope.$apply(function() {
          _server.channels.push(channel);
          if (!$scope.currentChannel) {
            $scope.switchToChannel(channel, server.address);
          }
        });
      }
    );

    $scope.servers.push(_server);
  });

  $scope.currentServer = null;
  $scope.currentChannel = null;

  $scope.switchToChannel = function(name, server) {
    $scope.currentServer = server;
    $scope.currentChannel = cleanName(name);
    document.title = 'Cascade IRC - #' + $scope.currentChannel;

    var el = getCurrentChannelEl(name);
    if (el) {
      setTimeout(function() {
        el.scrollTop = el.scrollHeight;
      }, 10);
    }
  };

  $scope.isCurrentChannel = function(channelName, server) {
    if ($scope.currentServer === server &&
      $scope.currentChannel === cleanName(channelName)) {
      return true
    }
    return false;
  };
}

angular.module('cascade', ['pasvaz.bindonce'])

