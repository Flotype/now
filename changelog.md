NowJS Version 0.8.0 - 1/16/2012
---------------------------
Changes since 0.7.6:

* Client library now serves minified version by default. Pass option `debug: true` to serve unminified source
* /bin/build.js creates minified now.js in dist folder
* Experimental connect/express session support. Simply pass a connect or express http server in nowjs.initialize and `this.user.session` should be available. Change options `cookieKey` to specificy connect.sid key
* Support passing in options to socket.io on client side, `nowInitialize(uri, {socketio: {/* socket.io options */}});`
* Fix possible DoS exploit with large length argument lists
* Node.js client for NowJS now available in /lib/nodeclient/now.js


NowJS Version 0.7.6 - 11/11/2011
---------------------------
Changes since 0.7.5:

* Fix to client side bug involving forceGetParentVarAtFqn
* Fix to issue involving redeclaration of synced functions
* Socket.io dependency at 0.8.7

NowJS Version 0.7.5
-------------------

NowJS Version 0.7.4 - 8/04/2011
---------------------------
Changes since 0.7.3:

* NowJS client lib can now be used directly without modification. Use `nowInitialize('http://uri:80/', [options]);` to start a connection manually
* Arrays are now handled properly on the server-side.
* Fixed deletion of objects on the server-side.
* Terminal non-leaf nodes are now properly synchronized and sent to clients.
* Various other bugfixes and optimizations.

NowJS Version 0.7.3 - 7/26/2011
---------------------------
Changes since 0.7.2:

* Fixed array passed in as options failing (for socket.io transports options)
* Exclude supports passing in single clientId
* Deletevar bug, GH #111, which prevented initializing fields in `now` to empty objects
* Improved documentation


NowJS Version 0.7.2 - 7/22/2011
---------------------------
Changes since 0.7.1:

* Fix broken exclude


NowJS Version 0.7.1 - 7/22/2011
---------------------------
Changes since 0.7.0:

* Fix bugs in handlers for numeric group name
* Fixed duplicate rv messages
* Added documentation


NowJS Version 0.7.0 - 7/16/2011
---------------------------
Changes since 0.6.1:

* Socket.IO dependency updated to >= 0.7.
* `group.exclude()` implemented. [Usage](http://nowjs.com/jsdoc/symbols/Group.html#exclude)
* `group.hasClient()`, `group.count` modified to be asynchronous
  functions. [Usage](http://nowjs.com/jsdoc/symbols/Group.html#count)
* Exposed more client-side events.
* `everyone.on('join', cb)` and `everyone.on('leave', cb)` have
  replaced of `nowjs.on('connect', cb)` and `nowjs.on('disconnect', cb)`
  (and their aliases, `nowjs.connected(cb)` and `nowjs.disconnected(cb)`).
* Even more performance increases.
* [Added JSDoc documentation](http://nowjs.com/jsdoc/index.html)

NowJS Version 0.6.1 - 6/10/2011
---------------------------

Changes since 0.6:

* Socket.IO dependency updated to 0.6.18.
* Reconnects implemented.
* More bug fixes and performance increases.

NowJS Version 0.6 - 5/14/2011
---------------------------

Changes since 0.5:

* Socket.IO dependency updated to 0.6.17.
* .hasClient(id) and .count added to ClientGroups.
*  See API documentation for further information.
* Various bug fixes and performance increases.

NowJS Version 0.5 - 4/8/2011
---------------------------

Changes since 0.3:

* initialize() optionally accepts `options` parameter.
*  It is possible to set a custom host/port combination in now.js using `options.host` and `options.port`. This overrides the default auto-detected settings.
*  The object set at `options.socketio` is passed to socket.io as a configuration parameter.
* Clients can optionally be prevented from making changes to their now namespace. To enable, set the `options.clientWrite` flag to `false` in the options parameter to `initialize()`
* Users can be added to groups other than `everyone`. Usage of this API is documented in the User Manual.

Bug fixes since 0.3:

* IE compatibility enhanced
* Events properly handled

NowJS Version 0.4
---------------------------
* Various bug fixes and performance issues

NowJS Version 0.3 - 3/18/2011
---------------------------

Changes since version 0.2:

*   **Breaks** Remote functions can no longer use return values. Please pass in and use a callback parameter when you need a return value from your remote call

*   Internet Explorer IE6/7/8 are now supported! There is lower performance when changing the value of a variable inside now, but function calls and remote calls (pushing/pulling) is 100% realtime

Performance Improvements since 0.2:

*   now.js now contains nowUtil.js embedded, reducing number of requests

*   Static files (now.js) are now cached in memory on the server-side, reducing disk reads

*   Reduced per request latency; internal replacing of server/port info with actual server/port is now only done once on server startup
  
Bug fixes since version 0.2:

*   Safari, IE6/7/8, Android, iOS (iPhone/iPad/iPod Touch) Safari now supported. nowUtil.js now contains a minified json2.js shim

*   Rare instances when not all attributes of now on client side would be initialized is now fixed

*   Array.isArray replaced with more flexible array check (thanks andref)

*   Changed uses of `x in y` to `.hasOwnProperty(prop)`

*   Bugs resulting in cross-port setups not working have been fixed


NowJS Version 0.2 - 3/11/2011
---------------------------

Changes since version 0.1:

*   Unified nowLib.js was split into nowClientLib.js and nowServerLib.js

*   In nowServerLib.js, NowWatcher class was replaced with a Harmony Proxy implementation in proxy.js

*   nowClientLib.js continues to use NowWatcher class for namespace traversal.

Known Issues:

*   Server crashes with a "hasOwnProperty of undefined" error when a client abruptly connects.

*   Library does not expose client connect and disconnect events to the developer.

*   Library does not expose any form of unique client ID to the developer.

*   Library does not provide a way to select particular clients or a single client based on filters/criteria.
