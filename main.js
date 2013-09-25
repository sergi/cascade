'use strict';

var events = require('events');
var async = require('async');
var irc = require('irc');

require('nw.gui').Window.get().showDevTools()
var Channels = {};

function ChannelListCtrl($scope, ircService) {
  var client = ircService.client;

}

function ChannelCtrl($scope, $compile, ircService) {
  $scope.channels = {};
  $scope.currentChannel = null;

  function getCurrentChannelEl(name) {
    var el = document.getElementById('channel-pane-' + getChannelName(name));
    return el;
  }

  function getChannelName(name) {
    return name[0] === '#' ?
      name.substr(1, name.length - 1) : name;
  }

  $scope.switchToChannel = function(name) {
    var channelContent = getCurrentChannelEl(name);
    if ($scope.channels[name]) {
      $scope.currentChannel = $scope.channels[name];
      setTimeout(function() {
        channelContent.scrollTop = channelContent.scrollHeight;
      }, 10);
    }
  };

  function createChannel(channel, isServer) {
    if (!$scope.channels[channel]) {
      $scope.channels[channel] = {
        name: channel,
        lines: [],
        log: [],
        users: [],
        isServer: !! isServer
      };
    }

    $scope.isCurrentChannel = function isCurrentChannel(name) {
      if ($scope.currentChannel && ($scope.currentChannel.name === name) ||
        $scope.currentChannel.name === '#' + name) {
        return true;
      }
      return false;
    };

    var channelName = getChannelName(channel);
    if (!document.getElementById('channel-pane-' + channelName)) {
      var el = $compile(
        '<div id="channel-pane-' + channelName + '" ' +
        'class="channel-content ' + (isServer ? 'server-line' : '') +
        '" ng-include src="\'view-channel.html\'" ' +
        'ng-show="isCurrentChannel(\'' + channelName + '\')">' +
        '</div>')($scope)[0];

      document.getElementById('channel-main').appendChild(el);
    }

    if (!$scope.currentChannel) {
      $scope.$apply(function() {
        $scope.currentChannel = $scope.channels[channel];
      });
    }

    return $scope.channels[channel];
  }

  var client = ircService.client;
  client.on('motd', function(motd) {
    motd = motd.split(/\n\r?/);
    motd.forEach(function(line) {
      ircService.eventEmitter.emit('serverMessage', line);
    });
  });

  client.on('names', function(channel, nicks) {
    var ch = createChannel(channel);
    $scope.$apply(function() {
      ch.users = nicks;
      console.log(ch.users);
    });
  });

  client.on('message', function(from, to, text, message) {
    if (Object.keys($scope.channels).indexOf(to) !== -1) {
      var ch = $scope.channels[to];
      var usernames = Object.keys(ch.users);
      for (var i = 0; i < usernames.length; i++) {
        var re = new RegExp('(' + escapeRegExp(usernames[i]) + ')');
        if (text.search(re) !== -1) {
          text = text.replace(re, '<b>$1</b>');
        }
      }

      $scope.channels[to].log.push({
        time: moment().format('H:mm:ss'),
        from: from,
        to: to,
        text: text,
      });

      // Force update if it is the current channel. There must be another way.
      if ($scope.currentChannel.name === to) {
        $scope.$apply(function() {
          $scope.currentChannel = $scope.channels[to];
        });
      }
    }
  });
  ircService.eventEmitter.on('serverMessage', function(line) {
    $scope.$apply(function() {
      $scope.channels['  ' + ircService.server].log.push({
        time: moment().format('H:mm:ss'),
        from: '',
        to: '',
        text: line,
      });
    });
  });

  client.on('join', function(channel, nick, message) {
    var ch = createChannel(channel);
    if (nick === client.nick) {
      console.log('JOIN', channel, nick);
      $scope.$apply(function() {
        $scope.currentChannel = ch;
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
