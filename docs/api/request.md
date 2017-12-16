# Request

`Request` is a plain JavaScript object to describe requests sent to an `Application`.

It's defined in [`./lib/wire.ts`](../../lib/wire.ts) as following:

```ts
/// <summary> Interface for control flags. </summary>
export type ControlFlags = {
    /// <summary> Enable debugging or not. Set to false by default. </summary>
    debug?: boolean;

    /// <summary> Return performance numbers or not. Set to false by default. </summary>
    perf?: boolean;
}

/// <summary> Interface for winery request. </summary>
export interface Request {
    /// <summary> Registered application instance name </summary>
    application: string;

    /// <summary> Entry point name </summary>
    entryPoint: string;

    /// <summary> Trace ID </summary>
    traceId?: string;

    /// <summary> User input as the 1st argument passing to entry point function </summary>
    input?: any;

    /// <summary> Control flags </summary>
    controlFlags?: ControlFlags;

    /// <summary> Overridden types </summary>
    overrideTypes?: objectModel.TypeDefinition[];

    /// <summary> Overridden named objects </summary>
    overrideObjects?: objectModel.NamedObjectDefinition[];

    /// <summary> Overridden providers </summary>
    overrideProviders?: objectModel.ProviderDefinition[];
}
```
### Input for Overriding Data and Behaviors
Further, all information carried in the request for dependency injection are under properties named `overrideXXX`. In particular, 3 types of override are supported:
- `overrideTypes`: override object creation behaviors. See [`ObjectFactory`](./application.md#object-factory)
- `overrideProviders`: override object provisioning behaviors from URI. See [`ObjectProvider`](./application.md#object-provider).
- `overrideObjects`: override named objects. See [`NamedObject`](./application.md#named-object).

Interfaces of these override information are defined as following:

[`./lib/object-type.ts`](../../lib/object-type.ts)
```ts
/// <summary> Object type definition to register a type in Napa. </summary>
export interface TypeDefinition {
    /// <summary> Type name to apply this constructor. </summary>
    typeName: string;

    /// <summary> Description of this type. </summary>
    description?: string;

    /// <summary> Constructor module name. </summary>
    moduleName: string;

    /// <summary> Constructor function name. </summary>
    functionName: string;

    /// <summary> If this definition overrides a previous type definition with the same type name. 
    /// This may be useful if you borrow definition file from other apps and want to override individual ones.
    /// </summary>
    override?: boolean;

    /// <summary> Example input object for human consumption. </summary>
    exampleObjects?: any[];
}
```

[`./lib/object-provider.ts`](../../lib/object-provider.ts)

```ts
/// <summary> Object provider definition to register a URI based object provider in Napa. </summary>
export interface ProviderDefinition {
    /// <summary> </summary>
    protocol: string;

    /// <summary> Description of this protocol. </summary>
    description?: string;

    /// <summary> Provider module name. </summary>
    moduleName: string;

    /// <summary> Provider function name. </summary>
    functionName: string;

    /// <summary> If this provider overrides a previous declared provider with the same protocol name. 
    /// This may be useful if you borrow definition file from other apps and want to override individual ones.
    /// </summary>
    override?: boolean;

    /// <summary> Example URI for human consumption. </summary>
    exampleUri?: string[];
}
```

[`./lib/named-object.ts`](../../lib/named-object.ts)
```ts
/// <summary> Interface for Named object definition. </summary>
export interface NamedObjectDefinition {
    /// <summary> Name or key to retrieve this object. </summary>
    name: string;

    /// <summary> Description for this object. </summary>
    description?: string;

    /// <summary> If this object is private, means that cannot be listed by entry points `listNamedObjects`. </summary>
    private?: boolean;

    /// <summary> If this object overrides a previous object definition with the same name. 
    /// This may be useful if you borrow definition file from other apps and want to override individual ones.
    /// </summary>
    override?: boolean;

    /// <summary> Value of this named object, which is described by plain JavaScript object or URI.
    /// The plain JavaScript object / URI can be constructed by registered ObjectFactory and ObjectProvider.
    /// </summary>
    value: any;

    /// <summary> Dependency from current definition to object context. This is calculated automatically.</summary>
    dependencies?: ObjectContextDependency;
}
```

## Examples

Example 1: a simple request with only application / entryPoint.
```ts
{
    application: "example",
    entryPoint: "keepAlive"
}
```

Example 2: a request for summing a list of numbers.
```ts
{
    application: "math",
    entryPoint: "sum",
    input: [1, 2]
}
```

Example 3: a request that override an entry point.
```ts
{
    application: "example",
    entryPoint: "echo",
    input: "hello",
    overrideObjects: [
        {
            "name": "echo",
            "value": {
                "_type": "EntryPoint",
                "function": "function(input) { return input + ', winery'; }"
            }
        }
    ]
}
```

Example 4: a request that override an object creator.
```ts
{
    application: "example",
    entryPoint: "echo",
    input: "hello",
    overrideTypes: [
        {
            "typeName": "Document",
            "moduleName": "some-doc",
            "functionName": "create"
        }
    ]
}
```


Example 5: a request that override an object provider.
```ts
{
    application: "example",
    entryPoint: "echo",
    input: "hello",
    overrideProviders: [
        {
            "protocol": "ftp",
            "moduleName": "ftp-client",
            "functionName": "get"
        }
    ]
}
```

Example 6: returning debug information and performance information.
```ts
{
    application: "example",
    entryPoint: "doSomething",
    controlFlags: {
        debug: true,
        perf: true
    }
}
```