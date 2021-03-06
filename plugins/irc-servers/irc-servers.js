module.exports = function setup(options, imports, register) {
  var fs = require('fs');
  var Rx = require('rx');
  var irc = require('irc');
  var crypto = require('crypto');

  var servers = [];

  /**
   * Creates an Observable from a node event and adds a type and a timestamp to
   * the resulting array value.
   * @param emitter {EventEmitter} Object emitting the event
   * @param ev {String} Event name
   * @returns {Rx.Observable}
   */

  function fromIrcEvent(emitter, ev) {
    return Rx.Node.fromEvent(emitter, ev)
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

  function escapeHTML(text) {
    text = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return text;
  }

  var findURLs = function(text) {
    var re = /((([A-Za-z]{3,9}:(?:\/\/)?)(?:[-;:&=\+\$,\w]+@)?[A-Za-z0-9.-]+|(?:www.|[-;:&=\+\$,\w]+@)[A-Za-z0-9.-]+)((?:\/[\+~%\/.\w-_]*)?\??(?:[-\+=&;%@.\w_]*)#?(?:[\w]*))?)/g;
    return text.match(re);
  };

  function md5(str) {
    return crypto.createHash('md5').update(str).digest('hex');
  }

  function addMetadata(msg) {
    msg.hash = md5(msg.from + msg.to + msg.text + msg.__timestamp);
    msg.urls = findURLs(msg.text) || [];
    return msg;
  }

  var Config = JSON.parse(fs.readFileSync('config.json', {
    encoding: 'utf8'
  }));

  Config.servers.forEach(function(server) {
    var ircClient = new irc.Client(server.address, server.nick, {
      channels: server.channels,
      autoConnect: false,
      showErrors: true
    });

    /*************************************************************
     * Observers dealing with IRC messages from users
     *************************************************************/

    var allMessages = fromIrcEvent(ircClient, 'message').map(function(m) {
      return {
        from: m[0],
        to: m[1],
        text: escapeHTML(m[2]),
        time: m.__timestamp,
      };
    });

    var nonPrivateMessages = allMessages.filter(function(m) {
      return m.to !== ircClient.nick;
    });

    var ownMessages = fromIrcEvent(ircClient, 'selfMessage').map(function(m) {
      return {
        from: ircClient.nick,
        to: m[0],
        text: escapeHTML(m[1]),
        time: m.__timestamp
      };
    });

    var channelMessages = nonPrivateMessages
      .merge(ownMessages)
      .map(addMetadata);

    // Observable for all private messages for which a channel has been created
    // so that we don't have to create a channel first.
    var privMsgs = allMessages.filter(function(m) {
      return m.to === ircClient.nick && _server.channels.some(function(c) {
        return c.name === m.from;
      });
    }).map(addMetadata);

    /*************************************************************
     * Observers dealing with other IRC events
     *************************************************************/

    var OVMotd = fromIrcEvent(ircClient, 'motd').selectMany(function(motd) {
      return Rx.Observable.fromArray(motd[0].split(/\n\r?/));
    }).map(function(m) {
      return {
        text: escapeHTML(m),
        motd: true
      };
    });

    var OVTopic = fromIrcEvent(ircClient, 'topic').map(function(t) {
      return {
        to: t[0],
        topic: t[1],
        from: t[2],
        isMeta: true,
        text: 'Topic is ' + escapeHTML(t[1])
      };
    });

    var OVMode = fromIrcEvent(ircClient, '+mode')
      .merge(fromIrcEvent(ircClient, '-mode'))
      .map(function(m) {
      var obj = {
        action: m.__type[0], // First char ('+' or '-')
        from: m[1] || server.address,
        to: m[0],
        mode: m[2],
        user: m[3],
        isMeta: true
      };
      obj.text = obj.from + ' sets mode ' + obj.action + obj.mode + ' ' +
        (obj.user || '');
      return obj;
    });

    var OVJoin = fromIrcEvent(ircClient, 'join').map(function(j) {
      return {
        to: j[0],
        from: j[1],
        isMeta: true,
        text: '<span class="join-arrow">&rarr;</span>&nbsp;' + '<span class="mention">' + j[1] + '</span> joined the channel'
      };
    });

    var OVPart = fromIrcEvent(ircClient, 'part').map(function(j) {
      return {
        to: j[0],
        from: j[1],
        text: '<span class="part-arrow">&larr;</span>&nbsp;' + '<span class="mention">' + j[1] + '</span> left the channel' +
          (j[2] ? ' (' + j[2] + ').' : ''),
        isMeta: true
      };
    });

    var OVNames = fromIrcEvent(ircClient, 'names').map(function(n) {
      return {
        to: n[0],
        nicks: n[1]
      };
    });

    var OVQuit = fromIrcEvent(ircClient, 'quit').map(function(n) {
      return {
        to: n[0],
        nicks: n[1]
      };
    });

    var OVNick = fromIrcEvent(ircClient, 'nick').map(function(n) {
      return {
        oldnick: n[0],
        newnick: n[1],
        channels: n[2],
        isMeta: true,
        text: '<span class="nick-change">&#x25cf;</span>&nbsp;' + '<span class="mention">' + n[0] + '</span> is now known as ' + '<span class="mention">' + n[1]
      }
    });

    var codes = ['001', '002', '003', '004', '251', '252', '253', '254', '255',
        '265', '266', 'NOTICE'
    ];

    var OVRaw = fromIrcEvent(ircClient, 'raw').filter(function(r) {
      return codes.indexOf(r[0].rawCommand) > -1;
    }).map(function(r) {
      r[0].args.shift();
      return {
        text: escapeHTML(r[0].args.join(' '))
      };
    });

    var _server = {
      address: server.address,
      ircClient: ircClient,
      channels: [],
      observables: {
        allMessages: allMessages,
        channelMessages: channelMessages,
        privMsgs: privMsgs,
        topic: OVTopic,
        mode: OVMode,
        join: OVJoin,
        part: OVPart,
        names: OVNames,
        motd: OVMotd,
        quit: OVQuit,
        nick: OVNick,
        raw: OVRaw
      }
    };

    servers.push(_server);
  });

  register(null, {
    servers: servers
  });
};
