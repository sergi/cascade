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
    .map(markURL)
    .subscribe(msg);

  var OVChannelMsgs = serverObj.observables.allMsgs
    .filter(isCurrentChannel)
    .map(markNickMentions)
    .map(markURL)
    .subscribe(msg);

  var OVNames = serverObj.observables.names
    .filter(isCurrentChannel)
    .subscribe(function(n) {
    $scope.$$phase || $scope.$apply(function() {
      $scope.nicks = n.nicks;
    });
  });
}
