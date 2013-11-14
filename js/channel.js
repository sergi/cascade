function ChanCtrl($scope) {
  $scope.logs = $scope.channel.logs || [];
  $scope.nicks = [];
  $scope.topic = '';

  var serverObj = $scope.$parent.getServerByName($scope.channel.serverAddress);

  function msg(obj) {
    $scope.logs.push(obj);
    $scope.$$phase || $scope.$apply();
  }

  function isCurrentChannel(obj) {
    return (obj.to === $scope.channel.name) ||
      (obj.from === $scope.channel.name && obj.to === serverObj.ircClient.nick);
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

  $scope.msgUser = function msgUser(user) {
    var alreadyOpen = serverObj.channels.some(function(c) {
      return c.name === user;
    });

    if (alreadyOpen)
      return;

    var channel = {
      name: user,
      serverAddress: $scope.channel.serverAddress,
      privMsg: true
    };

    serverObj.channels.push(channel);
    $scope.switchToChannel(channel.name, $scope.channel.serverAddress);
  };

  var evts = serverObj.observables;
  Rx.Observable.merge(evts.join, evts.part, evts.mode, evts.topic)
    .filter(isCurrentChannel)
    .map(markURL)
    .subscribe(msg);

  var OVNickChange = serverObj.observables.nick
    .filter(function(m) {
      return m.channels.indexOf($scope.channel.name > -1);
    })
    .subscribe(msg);

  var OVChannelMsgs = serverObj.observables.allMsgs
    .filter(isCurrentChannel)
    .map(markNickMentions)
    .map(markURL)
    .subscribe(msg);

  var OVPrivateMsgs = serverObj.observables.privMsgs
    .filter(isCurrentChannel)
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
