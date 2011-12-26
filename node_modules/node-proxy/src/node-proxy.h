/**
 *
 *
 *
 *  @author Sam Shull <http://samshull.blogspot.com/>
 *  @version 0.1
 *
 *  @copyright Copyright (c) 2009 Sam Shull <http://samshull.blogspot.com/>
 *  @license <http://www.opensource.org/licenses/mit-license.html>
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the "Software"), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *
 *  The above copyright notice and this permission notice shall be included in
 *  all copies or substantial portions of the Software.
 *
 *  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *  THE SOFTWARE.
 *
 *
 *  CHANGES:
 */

#ifndef NODE_PROXY_H // NOLINT
#define NODE_PROXY_H


#include <v8.h>
#include <node.h>
#include <node_version.h>

#define THREXCW(str) ThrowException(Exception::Error(str))
#define THREXC(str) THREXCW(String::New(str))
#define THR_TYPE_ERROR(str) \
  ThrowException(Exception::TypeError(String::New(str)))
#define PROXY_NODE_PSYMBOL(s) \
  Persistent<String>::New(String::NewSymbol(s))

// had to redefine NODE_VERSION_AT_LEAST here because of missing parenthesis
#define PROXY_NODE_VERSION_AT_LEAST(major, minor, patch) \
  (((major) < NODE_MAJOR_VERSION) \
    || ((major) == NODE_MAJOR_VERSION && (minor) < NODE_MINOR_VERSION) \
    || ((major) == NODE_MAJOR_VERSION && (minor) == NODE_MINOR_VERSION && \
    (patch) <= NODE_PATCH_VERSION))

// using namespace v8;
namespace v8 {

class NodeProxy {
  public:
  // fundamental traps
  static Persistent<String> getOwnPropertyDescriptor;
  static Persistent<String> getPropertyDescriptor;
  static Persistent<String> getOwnPropertyNames;
  static Persistent<String> getPropertyNames;
  static Persistent<String> defineProperty;
  static Persistent<String> delete_;
  static Persistent<String> fix;
  // derived traps
  static Persistent<String> has;
  static Persistent<String> hasOwn;
  static Persistent<String> get;
  static Persistent<String> set;
  static Persistent<String> enumerate;
  static Persistent<String> keys;
  // string identifiers
  static Persistent<String> callTrap;
  static Persistent<String> constructorTrap;
  static Persistent<String> value;
  static Persistent<String> writable;
  static Persistent<String> enumerable;
  static Persistent<String> configurable;
  static Persistent<String> name;
  static Persistent<String> trapping;
  static Persistent<String> sealed;
  static Persistent<String> frozen;
  static Persistent<String> extensible;
  static Persistent<String> seal;
  static Persistent<String> freeze;
  static Persistent<String> preventExtensions;
  static Persistent<String> isTrapping;
  static Persistent<String> isSealed;
  static Persistent<String> isFrozen;
  static Persistent<String> isExtensible;
  static Persistent<String> isProxy;
  static Persistent<String> hidden;
  static Persistent<String> hiddenPrivate;
  static Persistent<ObjectTemplate> ObjectCreator;
  static Persistent<ObjectTemplate> FunctionCreator;
  static void Init(Handle<Object> target);

  protected:
  NodeProxy();
  ~NodeProxy();
  static Handle<Integer>
    GetPropertyAttributeFromPropertyDescriptor(Local<Object> pd);
  static Local<Value> CorrectPropertyDescriptor(Local<Object> pd);
  static Handle<Value> ValidateProxyHandler(Local<Object> handler);
  static Handle<Value> Clone(const Arguments& args);
  static Handle<Value> Hidden(const Arguments& args);
  static Handle<Value> Create(const Arguments& args);
  static Handle<Value> SetPrototype(const Arguments& args);
  static Handle<Value> CreateFunction(const Arguments& args);
  static Handle<Value> Freeze(const Arguments& args);
  static Handle<Value> IsLocked(const Arguments& args);
  static Handle<Value> IsProxy(const Arguments& args);
  static Handle<Value> GetOwnPropertyDescriptor(const Arguments& args);
  static Handle<Value> DefineProperty(const Arguments& args);
  static Handle<Value> DefineProperties(const Arguments& args);
  static Handle<Value> New(const Arguments& args);
  static Handle<Value>
    GetNamedProperty(Local<String> name, const AccessorInfo &info);
  static Handle<Value>
    SetNamedProperty(Local<String> name,
             Local<Value> value,
             const AccessorInfo &info);
  static Handle<Boolean>
    QueryNamedProperty(Local<String> name,
               const AccessorInfo &info);
  static Handle<Integer>
    QueryNamedPropertyInteger(Local<String> name,
                  const AccessorInfo &info);
  static Handle<Boolean>
    DeleteNamedProperty(Local<String> name,
              const AccessorInfo &info);
  static Handle<Array>
    EnumerateNamedProperties(const AccessorInfo  &info);
  static Handle<Value>
    GetIndexedProperty(uint32_t index,
               const AccessorInfo &info);
  static Handle<Value>
    SetIndexedProperty(uint32_t index,
               Local<Value> value,
               const AccessorInfo &info);
  static Handle<Boolean>
    QueryIndexedProperty(uint32_t index,
               const AccessorInfo &info);
  static Handle<Integer>
    QueryIndexedPropertyInteger(uint32_t index,
                  const AccessorInfo &info);
  static Handle<Boolean>
    DeleteIndexedProperty(uint32_t index,
                const AccessorInfo &info);

  static Local<Value> CallPropertyDescriptorGet(Local<Value> descriptor,
              Handle<Object> context,
              Local<Value> args[1]);
  static Local<Value> CallPropertyDescriptorSet(Local<Value> descriptor,
              Handle<Object> context,
              Local<Value> name,
              Local<Value> value);
};
}

extern "C" void init(v8::Handle<v8::Object> target);

#endif // NODE_CLASSTEMPLATE_H // NOLINT
