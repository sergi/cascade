'use strict';

var irc = require('irc');
var gui = require('nw.gui');
var fs = require('fs');
var Rx = require('Rx');

gui.Window.get().menu = new gui.Menu({
  type: 'menubar'
});

var Config = JSON.parse(fs.readFileSync('config.json', {
  encoding: 'utf8'
}));

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
    $scope.logs.push(obj);
    $scope.$$phase || $scope.$apply();
  }

  var server = $scope.$parent.server;
  var ircClient = server.ircClient;

  var OVMotd = server.observables.motd.subscribe(msg);

  ircClient.on('raw', function(message) {
    switch (message.rawCommand) {
      case ('001'):
      case ('002'):
      case ('003'):
        msg({
          text: message.args[1]
        });
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
    $scope.$$phase || $scope.$apply();
  }

  function isCurrentChannel(obj) {
    return cleanName(obj.to) === $scope.channel.name;
  }

  function markNickMentions(obj) {
    var boundaries = obj.text.split(/\b/);
    obj.text = boundaries.map(function(b) {
      if (typeof($scope.nicks[b]) !== 'undefined') {
        return '<span class="mention">' + b + '</span>';
      }
      return b;
    }).join('');
    return obj;
  }

  var serverObj = $scope.$parent.getServerByName($scope.channel.serverAddress);
  var evts = serverObj.observables;

  Rx.Observable.merge(evts.join, evts.part, evts.mode, evts.topic)
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
  // We will store and update all the server metadata in this array.
  $scope.servers = [];

  /**
   * Find server meta object by name (dns address).
   * @param name
   * @returns Object
   */
  $scope.getServerByName = function(name) {
    var servers = $scope.servers;
    for (var i = 0; i < servers.length; i++) {
      if (servers[i].address === name)
        return servers[i];
    }
  };

  // Iterate through the servers in the config file definition and create a
  // server object for each one.
  Config.servers.forEach(function(server) {
    var ircClient = new irc.Client(server.address, server.nick, {
      channels: server.channels,
      autoConnect: false,
      showErrors: true
    });

    function fromIrcEvent(ev) {
      return Rx.Node.fromEvent(ircClient, ev)
        .timestamp()
        .map(function(obj) {
          var arr;
          if (typeof obj.value === 'string')
            arr = [obj.value];
          else
            arr = Array.prototype.slice.call(obj.value);

          arr.__timestamp = obj.timestamp;
          return arr;
        });
    }

    // Below we will create all the observers from IRC events.
    var usersMsgs = fromIrcEvent('message').map(function(m) {
      return {
        from: m[0],
        to: m[1],
        text: m[2],
        time: m.__timestamp
      };
    });

    var ownerMsgs = fromIrcEvent('selfMessage').map(function(m) {
      return {
        from: ircClient.nick,
        to: m[0],
        text: m[1],
        time: m.__timestamp
      };
    });

    var allMsgs = usersMsgs.merge(ownerMsgs);

    var OVMotd = fromIrcEvent('motd').selectMany(function(motd) {
      return Rx.Observable.fromArray(motd[0].split(/\n\r?/));
    }).map(function(m) {
        return {
          text: m,
          motd: true
        };
      });

    var OVTopic = fromIrcEvent('topic').map(function(t) {
      return {
        to: t[0],
        topic: t[1],
        from: t[2],
        isMeta: true,
        text: 'Topic is ' + t[1]
      };
    });

    var OVMode = fromIrcEvent('+mode')
      .map(function(m) {
        m.unshift('+');
        return m;
      }).merge(fromIrcEvent('-mode')
        .map(function(m) {
          m.unshift('-');
          return m;
        }))
      .map(function(m) {
        var obj = {
          action: m[0],
          from: m[2] || server.address,
          to: m[1],
          mode: m[3],
          user: m[4],
          isMeta: true
        };
        obj.text = obj.from + ' sets mode ' + obj.action + obj.mode + ' ' + (obj.user || '');
        return obj;
      });

    var OVJoin = fromIrcEvent('join').map(function(j) {
      return {
        to: j[0],
        from: j[1],
        isMeta: true,
        text: '<span class="join-arrow">&rarr;</span>&nbsp;' + j[1] + ' joined the channel'
      };
    });

    var OVPart = fromIrcEvent('part').map(function(j) {
      return {
        to: j[0],
        from: j[1],
        text: '<span class="part-arrow">&larr;</span>&nbsp;' + j[1] + ' left the channel' + (j[2] ? ' (' + j[2] + ').' : ''),
        isMeta: true
      }
    });

    var OVNames = fromIrcEvent('names').map(function(n) {
      return {
        to: n[0],
        nicks: n[1]
      };
    });

    var OVQuit = fromIrcEvent('quit').map(function(n) {
      return {
        to: n[0],
        nicks: n[1]
      };
    });

    var OVAddChannel = OVJoin.filter(function(j) {
      console.log(j)
      return j.from === ircClient.nick;
    }).subscribe(function(j) {
        var channel = {
          name: cleanName(j.to),
          serverAddress: server.address
        };
        console.log(channel)

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
        names: OVNames,
        motd: OVMotd,
        quit: OVQuit
      }
    };

    $scope.servers.push(_server);
  });

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

  $scope.switchToServer = function(address) {
    $scope.currentServer = address;
    $scope.currentChannel = '';
  };

  $scope.isCurrentChannel = function(name, server) {
    return $scope.currentServer === server &&
      $scope.currentChannel === cleanName(name);
  };

  $scope.isServerSelected = function(serverName) {
    return $scope.currentServer == serverName && !$scope.currentChannel;
  };
}

function InputController($scope) {
  var re = /^\/(\w+)\s*(.+)/;
  $scope.msg = "";

  function getServer() {
    return $scope.servers.filter(function(s) {
      return s.address === $scope.currentServer;
    })[0];
  }

  document.getElementById('submitForm').addEventListener('submit', function(e) {
    var server = getServer();
    if (!server) return;
    var client = server.ircClient;

    var isCommand = $scope.msg.search(re) !== -1;
    if (!isCommand) {
      client.say('#' + $scope.currentChannel, $scope.msg);
    } else {
      var cmd = $scope.msg.match(re)[1].toLowerCase();
      var args = $scope.msg.match(re)[2];
      switch (cmd) {
        case 'join':
          client.join(args);
          break;
        case 'part':
          if (!args || args.trim() === "")
            client.part('#' + $scope.currentChannel);
          else
            client.part(args);
          break;
      }
    }
    $scope.msg = '';
  });
}

angular.module('cascade', ['pasvaz.bindonce'])
