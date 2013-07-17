/*global w2ui */
'use strict';

var irc = require('irc');
var Channels = {};

function Channel(name, nicks) {
  this.userList = new UserList(this);
  this.userList.refresh(nicks);
  this.name = name.replace('#', '');

  var self = this;
  Client.on('message#' + this.name, function(from, message) {
    self.append(FilterBasic({
      from: from,
      message: message,
      channel: '#' + self.name
    }));
  });

  Client.on('join#' + this.name, function(from, message) {
    self.userList.refresh();
  });

  Client.on('part#' + this.name, function(from, message) {
    self.userList.refresh();
  });
};

Channel.prototype.append = function(div) {
  $('#layout_layout_panel_main .w2ui-panel-content')[0]
  .appendChild(div);
};

Channel.prototype.getUsers = function() {
  return Client.chans['#' + this.name].users;
};

var Client = new irc.Client('chat.freenode.net', 'sergi_222', {
  channels: ['#ubuntu']
});

Client.on('registered', function(message) {
  w2ui.sidebar.add({
    id: message.server,
    text: message.server
  });

  Client.on('names', function(channel, nicks) {
    if (!Channels[channel])
      Channels[channel] = new Channel(channel, nicks);

    w2ui.sidebar.add(message.server, {
      id: channel,
      text: channel
    });
  });

  Client.on('join', function(channel, nick, data) {
    if (nick !== Client.nick) return;
  });
});


