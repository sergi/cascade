var Mustache = require("mustache");
var fs = require('fs');
var path = require("path");

function AppController($scope) {
  $scope.servers = Servers;

  function getChannelByName(name, server) {
    for (var i = 0; i < server.channels.length; i++)
      if (server.channels[i].name === name)
        return server.channels[i];
  }

  UrlActions.subscribe(function(obj) {
    var action = obj.action;
    var route = '../plugins/' + action.name + '/';
    var msgEl = document.getElementById(obj.hash + '');
    if (!msgEl) return;

    var tr = document.createElement('tr');
    var td = document.createElement('td');
    var iframe = document.createElement('iframe');
    tr.appendChild(td);
    td.appendChild(iframe);
    td.setAttribute('colspan', '2');

    iframe.src = "views/iframe.html";
    if (action.template) {
      var fileContents = fs.readFileSync(
        path.join(process.cwd(), 'plugins', action.name, action.template), {
        encoding: "utf8"
      });

      iframe.addEventListener('load', function(e) {
        iframe.contentDocument.body.innerHTML =
          Mustache.render(fileContents, action.model);

        if (action.css) {
          var cssLink = iframe.contentDocument.createElement("link");
          cssLink.href = route + action.css;
          cssLink.rel = "stylesheet";
          cssLink.type = "text/css";
          iframe.contentDocument.head.appendChild(cssLink);
        }

      });
      msgEl.appendChild(tr);
    }
  })


  // Iterate through the servers in the config file definition and create a
  // server object for each one.
  $scope.servers.forEach(function(server) {
    var ircClient = server.ircClient;
    var serverName = server.serverAddress;

    /**
     * Increments the `unread` counter in channels that are not the current
     * one.
     */
    var OVMsgCounter = server.observables.allMessages.filter(function(m) {
      return !$scope.isCurrentChannel(m.to, serverName);
    }).subscribe(function(obj) {
      var channel = getChannelByName(obj.to, server);
      if (channel) {
        channel.unread += 1;
      }
    });

    /**
     * Observable for private messages that don't have a channel created yet.
     * We will create a channel with the first message buffered in first.
     */
    var OVPrivMsgNoChannel =
      server.observables.allMessages.filter(function(m) {
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
