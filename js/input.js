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
    var msg = $scope.msg;
    $scope.msg = '';

    var isCommand = msg.search(re) !== -1;
    if (isCommand) {
      var cmd = msg.match(re)[1].toLowerCase();
      var args = msg.match(re)[2];

      switch (cmd) {
        case 'nick':
          client.send(cmd, args);
          break;
        case 'join':
          client.join(args);
          break;
        case 'part':
          if (!args || args.trim() === "")
            client.part($scope.currentChannel);
          else
            client.part(args);
          break;
      }
    } else {
      client.say($scope.currentChannel, msg);
    }
  });
}
