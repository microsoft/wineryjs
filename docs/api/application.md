# Application
In Winery.js, `Application` is an entity that manages a list of service methods and resources for a specific problem domain. It consists of
- an application-level `ObjectContext`: which manages a collection of existing objects (service methods and resources) and defines object creation behaviors.
- a collection of `Metrics`: application-level metrics for service monitoring

## Object Context
`ObjectContext` (see [interface](./lib/object-context.ts)) encapsultes all aspects that can be dependency injected at runtime. 

It holds an `ObjectFactory` to describe object creation behaviors, and an `ObjectProvider` to take care object provisioning  from a URI. 

It also provide a registry for service methods (`EntryPoint`s) and manages resources by a collection of `NamedObject`, which can be referenced at request serving time by name. 

Multiple `ObjectContext` instances are chained as `[request-level, request-plan-level, application-level, host-level]`. Prior context can override latter context.

### Object Factory
TBD

### Object Provider
`ObjectProvider` is similar to `ObjectFactory`, instead of working on object of a type, it creates objects based on protocol from a URI.

For example, in URI "doc://abcde", "doc" is the protocol, "abcde" is path that carry information on what/how the object can be created.

The reason we introduce URI based objets is to advocate a human-readable way to identify and share objects.

### Named Objects
TBD

#### Entry Points
`EntryPoint` is a special `NamedObject` that can be exposed as service method.

```typescript
export interface EntryPoint {
    (input?: any, requestContext?: RequestContext): any
}
```
JSON input to construct an entrypoint.
```json
{
    "_type": "Entrypoint",
    "moduleName": "a-module",
    "functionName": "someNamespace.aEntrypoint",
    "displayRank": 1,
    "executionStack": [
        "finalizeResponse",
        "executeEntryPoint"
    ]
}
```