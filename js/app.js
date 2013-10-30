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
          arr.__type = ev;
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
      .merge(fromIrcEvent('-mode'))
      .map(function(m) {
        var obj = {
          action: m.__type[0], // First char ('+' or '-')
          from: m[1] || server.address,
          to: m[0],
          mode: m[2],
          user: m[3],
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
        text: '<span class="join-arrow">&rarr;</span>&nbsp;' +
          '<span class="mention">' + j[1] + '</span> joined the channel'
      };
    });

    var OVPart = fromIrcEvent('part').map(function(j) {
      return {
        to: j[0],
        from: j[1],
        text: '<span class="part-arrow">&larr;</span>&nbsp;' +
          '<span class="mention">' + j[1] + '</span> left the channel' +
          (j[2] ? ' (' + j[2] + ').' : ''),
        isMeta: true
      };
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

    var codes = ['001', '002', '003', '004', '251', '252', '253', '254', '255',
      '265', '266', 'NOTICE'];

    var OVRaw = fromIrcEvent('raw').filter(function(r) {
      return codes.indexOf(r[0].rawCommand) > -1;
    }).map(function(r) {
        r[0].args.shift();
        return { text: r[0].args.join(' ') };
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
        names: OVNames,
        motd: OVMotd,
        quit: OVQuit,
        raw: OVRaw
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
