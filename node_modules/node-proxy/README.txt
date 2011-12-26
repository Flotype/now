node-proxy is an implementation of Harmony Proxies http://wiki.ecmascript.org/doku.php?id=harmony:proxies
that allows the developer to create "catch-all" property handlers for an object or a function in node.js.

Author: Sam Shull
Repository: http://github.com/samshull/node-proxy
Issues: http://github.com/samshull/node-proxy/issues

*** This does not work appropriately in node versions 0.1.100 - 0.1.102. You will need to install node_version.h in $PREFIX/include/node

Methods:

Object create(ProxyHandler handler [, Object proto ] ) throws Error, TypeError

Function createFunction(ProxyHandler handler, Function callTrap [, Function constructTrap ] ) throws Error, TypeError

Boolean isTrapping(Object obj) throws Error


Additional Methods (for ECMAScript 5 compatibliity): @see http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-262.pdf

Boolean freeze(Object obj) throws Error, TypeError

Boolean seal(Object obj) throws Error, TypeError

Boolean preventExtensions(Object obj) throws Error, TypeError

Boolean isFrozen(Object obj) throws Error, TypeError

Boolean isSealed(Object obj) throws Error, TypeError

Boolean isExtensible(Object obj) throws Error, TypeError

PropertyDescriptor getOwnPropertyDescriptor(Object obj, String name) throws Error, TypeError

Boolean defineProperty(Object obj, String name, PropertyDescriptor pd) throws Error, TypeError

Boolean defineProperties(Object obj, Object descriptors) throws Error, TypeError


More methods:

Object hidden(Object obj, String name [, Object value ] ) throws Error
- Set or retrieve a hidden property on an Object

Object clone(Object obj) throws Error
- Create a shallow copy of an Object

Boolean isProxy(Object obj)
- determine if an object was created by Proxy

Boolean setPrototype(Object obj, Object obj) throws Error
-set the prototype of a given object to the second given object
