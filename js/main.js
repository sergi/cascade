'use strict';

var irc = require('irc');
var gui = require('nw.gui');
var fs = require('fs');
var Rx = require('Rx');

gui.Window.get().menu = new gui.Menu({ type: 'menubar' });

var Config = JSON.parse(fs.readFileSync('config.json', { encoding: 'utf8' }));

function cleanName(name) {
  if (name[0] === '#')
    return name.substr(1, name.length - 1);

  return name;
}

function getChannelEl(name) {
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
    $scope.logs.push(obj);
  }

  function isCurrentChannel(obj) {
    return cleanName(obj.to) === $scope.channel.name;
  }

  function markNickMentions(obj) {
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

    obj.text = markMentions(obj.text);
    return obj;
  }

  var serverObj = $scope.$parent.getServerByName($scope.channel.serverAddress);
  var evts = serverObj.observables;

  Rx.Observable.merge(evts.join, evts.mode, evts.topic)
    .filter(isCurrentChannel)
    .subscribe(msg);

  var OVChannelMsgs = serverObj.observables.allMsgs
    .filter(isCurrentChannel)
    .map(markNickMentions)
    .subscribe(msg);

  var OVNames = serverObj.observables.names
    .filter(isCurrentChannel)
    .subscribe(function(n) {
      $scope.$$phase || $scope.$apply(function() {
        $scope.nicks = n.nicks;
      });
    });
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

    function fromIrcEvent(ev) {
      return Rx.Node.fromEvent(ircClient, ev);
    }

    var usersMsgs = fromIrcEvent('message').map(function(m) {
      return { from: m[0], to: m[1], text: m[2], time: Date.now() };
    });
    var ownerMsgs = fromIrcEvent('selfMessage').map(function(m) {
      return { from: ircClient.nick, to: m[0], text: m[1], time: Date.now() };
    });

    var allMsgs = Rx.Observable.merge(usersMsgs, ownerMsgs);
    var OVTopic = fromIrcEvent('topic').map(function(t) {
      return {
        to: t[0],
        topic: t[1],
        from: t[2],
        isMeta: true,
        text: 'Topic is ' + t[1]
      };
    });

    var OVMode = Rx.Observable.merge(
        fromIrcEvent('+mode').map(function(m) {
          m = Array.prototype.slice.call(m);
          m.unshift('+');
          return m;
        }),
        fromIrcEvent('-mode').map(function(m) {
          m = Array.prototype.slice.call(m);
          m.unshift('-');
          return m;
        })
      ).map(function(m) {
        var obj = {
          action: m[0],
          from: m[2] || server.address,
          to: m[1],
          mode: m[3],
          user: m[4],
          isMeta: true
        };
        obj.text = obj.from + ' sets mode ' + obj.action + obj.mode + ' ' + ( obj.user || '');
        return obj;
      });

    var OVJoin = fromIrcEvent('join').map(function(j) {
      return {
        to: j[0],
        from: j[1],
        isMeta: true,
        text: '&rarr;&nbsp' + j[1] + ' joined the channel.'
      };
    });

    var OVPart = fromIrcEvent('part').map(function(j) {
      return {
        to: j[0], from: j[1], text: j[0] + ' left the channel' +
          (j[2] ? ' (' + j[2] + ').' : '') + '.', isMeta: true
      }
    });

    var OVNames = fromIrcEvent('names').map(function(n) {
      return { to: n[0], nicks: n[1] };
    });

    var OVQuit = fromIrcEvent('quit').map(function(n) {
      return { to: n[0], nicks: n[1] };
    });

    var OVAddChannel = OVJoin.filter(function(j) {
      return j.from === ircClient.nick;
    }).subscribe(function(j) {
        var channel = {
          name: cleanName(j.to),
          serverAddress: server.address
        };

        $scope.$$phase || $scope.$apply(function() {
          _server.channels.push(channel);
          if (!$scope.currentChannel) {
            $scope.switchToChannel(channel.name, server.address);
          }
        });
      });

    var _server = {
      address: server.address,
      ircClient: ircClient,
      channels: [],
      observables: {
        allMsgs: allMsgs,
        topic: OVTopic,
        mode: OVMode,
        join: OVJoin,
        part: OVPart,
        names: OVNames
      }
    };

    $scope.servers.push(_server);
  });

  $scope.currentServer = null;
  $scope.currentChannel = null;

  $scope.switchToChannel = function(name, server) {
    $scope.currentServer = server;
    $scope.currentChannel = cleanName(name);
    document.title = 'Cascade IRC - #' + $scope.currentChannel;
    var el = getChannelEl(name);
    if (el) {
      setTimeout(function() {
        el.scrollTop = el.scrollHeight;
      }, 10);
    }
  };

  $scope.isCurrentChannel = function(channelName, server) {
    return $scope.currentServer === server &&
      $scope.currentChannel === cleanName(channelName);
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

