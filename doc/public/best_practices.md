Coding Patterns and Best Practices
==================================
The NowJS syntax and semantics are intended to integrate naturally into your application's existing coding patterns. However, there are some coding patterns and best practices that you may find useful.

The "broadcast and receive" pattern
-----------------------------------
When building chatroom-style applications, it is common to broadcast a single user's action to all connected clients. This is commonly done like so:
**On the client**:

    now.receiveBroadcast = function(message){
      //Render message in the UI or process it some other way
    }

**On the server**:

    everyone.now.sendBroadcast = function(message){
      everyone.now.receiveBroadcast(message);
    }
    
    
Efficiency Considerations
-------------------------
It is the goal of NowJS to make the shared namespaces as carefree and easy to use as possible. However, if your application is running slowly or you are coding with performance in mind, here are a few considerations.

1. Avoid deeply nested structures inside the `now` namespace
Setting or modifying variables that lie inside multiple levels of nested objects and arrays is inefficient. NowJS must traverse these deep structures to watch for changes, serialize the structure when a value is changed, deserialize it on the receiving end, and traverse it again to merge the changes on the receiving end. Keep your structures at most 2-3 levels deep.

2. Sync values using remote function calls rather than using synced variables.
As described above, some amount of traversal is required to synchronize variables in the `now` namespace. If you need to rapidly set a value on one client and then immediately use that value on the other clients, consider using the "broadcast and receive" coding pattern. Function calls are much faster than using variable syncing.

3. The Internet will always be slower than the local machine
We try to make remote functions and variables as natural to use as local ones. But the reality is that the latency for any remote action is 6 orders of magnitude longer than the same action done locally. Try to execute things locally when possible.

Further Reading
----------------------
Now that you've read the Best Practices guide, try the NowJS [User Manual](http://nowjs.com/doc) and [Quick Start](http://nowjs.com/guide)

Have more questions? You can reach us in #nowjs on freenode