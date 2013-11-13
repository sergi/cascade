function AppController($scope) {
  $scope.servers = Servers;

  function getChannelByName(name, server) {
    for (var i = 0; i < server.channels.length; i++)
      if (server.channels[i].name === name)
        return server.channels[i];
  }

  // Iterate through the servers in the config file definition and create a
  // server object for each one.
  $scope.servers.forEach(function(server) {
    var ircClient = server.ircClient;
    var serverName = server.serverAddress;

    /**
     * Increments the `unread` counter in channels that are not the current
     * one.
     */
    var OVMsgCounter = server.observables._userMsgs.filter(function(m) {
      return !$scope.isCurrentChannel(m.to, serverName);
    }).subscribe(function(obj) {
        var channel = getChannelByName(obj.to, serverName);
        if (channel) {
          channel.unread += 1;
        }
      });

    /**
     * Observable for private messages that don't have a channel created yet.
     * We will create a channel with the first message buffered in first.
     */
    var OVPrivMsgNoChannel =
      server.observables._userMsgs.filter(function(m) {
        return m.to === ircClient.nick && server.channels.every(function(c) {
          return c.name !== m.from;
        });
      }).subscribe(function createNewChannel(j) {
          var channel = {
            name: j.from,
            serverAddress: server.address,
            privMsg: true,
            logs: [j],
            unread: 0
          };

          server.channels.push(channel);
          $scope.switchToChannel(channel.name, server.address);
          $scope.$$phase || $scope.$apply();
        });

    /**
     * Observable to all the join events in which the user is the one joining.
     * It opens a channelin that case and switches to it if there is no channel
     * selected yet.
     */
    var OVAddChannel = server.observables.join.filter(function(j) {
      return j.from === ircClient.nick;
    }).subscribe(function(j) {
        var channel = {
          name: j.to,
          serverAddress: server.address,
          unread: 0
        };

        $scope.$$phase || $scope.$apply(function() {
          server.channels.push(channel);
          if (!$scope.currentChannel) {
            $scope.switchToChannel(channel.name, server.address);
          }
        });
      });
  });

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

  $scope.getChannelByName = function(name, serverName) {
    var _server = $scope.getServerByName(serverName);
    if (!_server || !_server.channels.length) return;

    for (var i = 0; i < _server.channels.length; i++) {
      if (_server.channels[i].name === name) {
        return _server.channels[i];
      }
    }
  };

  $scope.switchToChannel = function(name, server) {
    $scope.currentServer = server;
    $scope.currentChannel = name;
    document.title = 'Cascade IRC - ' + $scope.currentChannel;

    // Set number of unread messages to 0
    var channelObj = $scope.getChannelByName(name, server);
    if (channelObj) {
      channelObj.unread = 0;
    }

    // Scroll to the bottom of the screen
    var el = document.getElementById('channel-pane-' + name);
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
      $scope.currentChannel === name;
  };

  $scope.isServerSelected = function(serverName) {
    return $scope.currentServer == serverName && !$scope.currentChannel;
  };
}

