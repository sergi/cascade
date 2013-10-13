'use strict';

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
  return document.getElementById('channel-pane-' + cleanName(name));
}

function ServerCtrl($scope) {
  $scope.logs = [];

  function msg(obj) {
    obj.time = Date.now();
    $scope.logs.push(obj);
  }

  var ircClient = $scope.$parent.server.ircClient;

  ircClient.on('motd', function(motd) {
    motd = motd.split(/\n\r?/);
    motd.forEach(function(line) {
      msg({ text: line });
    });
    $scope.$apply();
  });

  ircClient.on('raw', function(message) {
    switch (message.rawCommand) {
      case ('001'):
      case ('002'):
      case ('003'):
        msg({ text: message.args[1] });
        break;
    }
  });

  ircClient.on('error', function(message) {
    console.log('ERROR', message);
  });

  ircClient.connect();
}

function ChanCtrl($scope) {
  $scope.logs = [];
  $scope.nicks = [];
  $scope.topic = '';

  function msg(obj) {
    obj.time = Date.now();
    $scope.$apply(function() {
      $scope.logs.push(obj);
    });
  }

  function changeTopic(topic) {
    msg({
      text: 'Topic is ' + topic,
      isMeta: true
    });
  }

  function markMentions(text) {
    var users = Object.keys($scope.nicks);
    for (var i = 0; i < users.length; i++) {
      var re = new RegExp('(\\b' + escapeRegExp(users[i]) + '\\b)');
      if (text.search(re) !== -1) {
        text = text.replace(re, '<span class="mention">$1</span>');
      }
    }

    return text;
  }

  $scope.init = function(channelName, serverName) {
    var _name = channelName;
    var serverObj = $scope.$parent.getServerByName(serverName);
    var ircClient = serverObj.ircClient;

    $scope.serverAddress = serverObj.address;

    if (!ircClient) {
      console.error("No server found for channel " + _name);
      return;
    }

    var onNames = function(nicks) {
      $scope.$apply(function() {
        $scope.nicks = nicks;
      });
    };

    var onTopic = function(channel, topic, nick, message) {
      if (cleanName(channel) === _name) {
        changeTopic(topic);
      }
    };

    var onMessage = function(from, text, message) {
      msg({
        from: from,
        text: markMentions(text)
      });
    };

    var onSelfMessage = function(channel, text) {
      if (cleanName(channel) === _name) {
        msg({
          from: ircClient.nick,
          text: markMentions(text)
        });
      }
    };

    ircClient.on('topic', onTopic);
    ircClient.on('names#' + _name, onNames);
    ircClient.on('message#' + _name, onMessage);
    ircClient.on('selfMessage', onSelfMessage);

    ircClient.on('+mode', function(channel, by, mode, argument, _msg) {
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
    var ircClient = new irc.Client(server.address, server.nick, {
      channels: server.channels,
      autoConnect: false
    });

    var _server = {
      address: server.address,
      ircClient: ircClient,
      channels: []
    };

    ircClient.on('join', function(channel, nick, message) {
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
      return true;
    }
    return false;
  };
}

function InputController($scope) {
  $scope.msg = "";
  $scope.submit = function() {
    var server = $scope.servers.filter(function(s) {
      return s.address === $scope.currentServer;
    })[0];

    if (!server) return;

    server.ircClient.say('#' + $scope.currentChannel, $scope.msg);
  };
}

angular.module('cascade', ['pasvaz.bindonce'])

