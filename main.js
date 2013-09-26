'use strict';

var events = require('events');
var async = require('async');
var irc = require('irc');

require('nw.gui').Window.get().showDevTools()

function cleanName(name) {
  return name[0] === '#' ?
    name.substr(1, name.length - 1) : name;
}

function getCurrentChannelEl(name) {
  var el = document.getElementById('channel-pane-' + cleanName(name));
  return el;
}

function ChanCtrl($scope, ircService) {
  var client = ircService.client;
  var _name;

  function msg(obj) {
    obj.time = moment().format('H:mm:ss');
    $scope.$apply(function() {
      $scope.logs.push(obj);
    });
  }

  $scope.logs = [];
  $scope.nicks = [];

  $scope.init = function(_name) {
    client.on('names#' + _name, function(nicks) {
      $scope.$apply(function() {
        $scope.nicks = nicks;
      });
    });

    client.on('topic', function(channel, topic, nick, msg) {
      if (channel === _name) {
        msg({
          text: 'Topic is ' + topic,
          isMeta: true
        });
      }
    });

    client.on('message#' + _name, function(from, text, message) {
      var usernames = Object.keys($scope.nicks);
      for (var i = 0; i < usernames.length; i++) {
        var re = new RegExp('(' + escapeRegExp(usernames[i]) + ')');
        if (text.search(re) !== -1) {
          text = text.replace(re, '<b>$1</b>');
        }
      }

      msg({
        from: from,
        text: text,
      });
    });
  };
}

function ChannelCtrl($scope, $compile, ircService) {
  $scope.currentChannel = null;
  $scope.channels = [];

  $scope.switchToChannel = function(name) {
    $scope.currentChannel = cleanName(name);

    var el = getCurrentChannelEl(name);
    setTimeout(function() {
      el.scrollTop = el.scrollHeight;
    }, 10);
  };

  $scope.isCurrentChannel = function(name) {
    return $scope.currentChannel &&
      $scope.currentChannel === cleanName(name);
  };

  function createChannel(channel, isServer) {
    var name = cleanName(channel);
    if (!document.getElementById('channel-pane-' + name)) {
      var el = $compile(
        '<div id="channel-pane-' + name + '" ' +
        'class="channel-content ' + (isServer ? 'server-line" ' : '" ') +
        'ng-controller="ChanCtrl" ' +
        'ng-init="init(\'' + name + '\')" ' +
        'ng-include src="\'view-channel.html\'" ' +
        'ng-show="isCurrentChannel(\'' + name + '\')">' +
        '</div>')($scope)[0];

      document.getElementById('channel-main').appendChild(el)
    }

    $scope.$apply(function() {
      if ($scope.channels.indexOf(channel) === -1) {
        $scope.channels.push(channel);
      }

      if (!$scope.currentChannel) {
        $scope.currentChannel = name;
      }
    });

    return channel;
  }

  var client = ircService.client;
  client.on('motd', function(motd) {
    motd = motd.split(/\n\r?/);
    motd.forEach(function(line) {
      ircService.eventEmitter.emit('serverMessage', line);
    });
  });

  /*
  client.on('+mode', function(channel, by, mode, argument, msg) {
    var ch = createChannel(channel);
    by = by || ircService.server;
    var line = by + ' sets mode +' + mode;

    var usernames = Object.keys(ch.users);
    if (argument && usernames.indexOf(argument) !== -1) {
      line += ' argument';
    }

    ch.log.push({
      time: moment().format('H:mm:ss'),
      text: line,
      isMeta: true
    });
  });
*/

  ircService.eventEmitter.on('serverMessage', function(line) {
    /*    $scope.channels['  ' + ircService.server].log.push({*/
    //time: moment().format('H:mm:ss'),
    //from: '',
    //text: line,
    //});
    /*$scope.$apply();*/
  });

  client.on('join', function(channel, nick, message) {
    var ch = createChannel(channel);
    if (nick === client.nick) {
      console.log('JOIN', channel, nick);
      $scope.$apply(function() {
        $scope.currentChannel = cleanName(channel);
      });
    }
  });

  client.on('registered', function(message) {
    createChannel('  ' + ircService.server, true);
  });


  client.on('raw', function(msg) {
    if (msg.server && !ircService.server) {
      ircService.server = msg.server;
      createChannel('  ' + msg.server, true);
    }

    switch (msg.rawCommand) {
      case ('001'):
      case ('002'):
      case ('003'):
        ircService.eventEmitter.emit('serverMessage', msg.args[1]);
        break;
    }
  });

  client.on('error', function(message) {
    console.log('ERROR', message);
  });

  client.connect();
}

angular.module("cascade", ['pasvaz.bindonce'])
  .service('ircService', function() {
  var server = this.server = 'chat.freenode.net';
  this.client = new irc.Client(server, 'sergi_222', {
    channels: ['#ubuntu', '#ubuntu22'],
    autoConnect: false
  });

  this.eventEmitter = new events.EventEmitter();
});

/*
mod.factory('pubsub', function() {
  var cache = {};
  return {
    publish: function(topic, args) {
      cache[topic] && cache[topic].forEach(function() {
        this.apply(null, args || []);
      });
    },

    subscribe: function(topic, callback) {
      if (!cache[topic]) {
        cache[topic] = [];
      }
      cache[topic].push(callback);
      return [topic, callback];
    },

    unsubscribe: function(handle) {
      var t = handle[0];
      cache[t] && cache[t].forEach(function(idx) {
        if (this == handle[1]) {
          cache[t].splice(idx, 1);
        }
      });
    }
  };
});
*/
