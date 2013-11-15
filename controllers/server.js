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
    .map(escapeHTML)
    .map(markURL)
    .subscribe(msg);

  var OVRaw = server.observables.raw
    .subscribe(msg);

  ircClient.on('error', function(message) {
    console.log('ERROR', message);
  });

  ircClient.connect();
}
