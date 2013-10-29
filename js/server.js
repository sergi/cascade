/**
 * Controller for each IRC server instance that the user is connected to
 */
function ServerCtrl($scope) {
  $scope.logs = [];

  function msg(obj) {
    $scope.logs.push(obj);
    $scope.$$phase || $scope.$apply();
  }

  var server = $scope.$parent.server;
  var ircClient = server.ircClient;

  var OVMotd = server.observables.motd
    .map(markURL)
    .subscribe(msg);

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
