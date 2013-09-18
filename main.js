/*global w2ui */
'use strict';
var events = require('events');
var async = require('async');
var irc = require('irc');

require('nw.gui').Window.get().showDevTools()
var Channels = {};

function Channel(name, nicks) {
  this.userList = new UserList(this);
  this.userList.refresh(nicks);
  this.name = name.replace('#', '');

  var self = this;
  Client.on('message#' + this.name, function(from, message) {
    self.append(FilterBasic({
      from: from,
      message: message,
      channel: '#' + self.name
    }));
  });

  Client.on('join#' + this.name, function(from, message) {
    self.userList.refresh();
  });

  Client.on('part#' + this.name, function(from, message) {
    self.userList.refresh();
  });
};

Channel.prototype.append = function(div) {
  $('#content')[0].appendChild(div);
};

Channel.prototype.getUsers = function() {
  return Client.chans['#' + this.name].users;
};

function ChannelCtrl($scope, ircService) {
  $scope.channels = {};
  $scope.currentChannel = null;
  var channelContent = document.querySelector('.channel-content');

  var switchChannel = $scope.switchToChannel = function(name) {
    if (typeof name !== 'string')
      name = name.name;

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

    if (!$scope.currentChannel) {
      $scope.$apply(function() {
        switchChannel($scope.channels[channel]);
      });
    }

    return $scope.channels[channel];
  }

  var client = ircService.client;
  client.on('names', function(channel, nicks) {
    var ch = createChannel(channel);
    $scope.$apply(function() {
      ch.users = nicks;
      console.log(ch.users);
    });
  });

  client.on('message', function(from, to, text, message) {
    if (Object.keys($scope.channels).indexOf(to) !== -1) {
      $scope.channels[to].log.push({
        time: moment().format('H:mm:ss'),
        from: from,
        to: to,
        text: text,
      });

      // Force update if it is the current channel. There must be another way.
      if ($scope.currentChannel.name === to) {
        $scope.$apply(function() {
          switchChannel($scope.currentChannel);
        });
      }
    }
  });

  client.on('join', function(channel, nick, message) {
    var ch = createChannel(channel);
    if (nick === client.nick) {
      console.log('JOIN', channel, nick);
      $scope.$apply(function() {
        switchChannel(ch);
      });
    }
  });

  client.on('registered', function(message) {
    createChannel('  ' + ircService.server, true);
  });

  client.on('motd', function(motd) {
    motd = motd.split(/\n\r?/);
    motd.forEach(function(line) {
      ircService.eventEmitter.emit('serverMessage', line);
    });
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
  client.connect()
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
