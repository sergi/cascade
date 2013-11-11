
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

      client.say($scope.currentChannel, $scope.msg);
    } else {
      var cmd = $scope.msg.match(re)[1].toLowerCase();
      var args = $scope.msg.match(re)[2];

      switch (cmd) {
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
    }
    $scope.msg = '';
  });
}
