# Application
`Application` is an abstraction that manages resources for request execution and serve user requests under a problem domain. It holds
- An [`ObjectContext`](./object-context.md) object as a container for application-level objects, such as `Interceptor`, `EntryPoint`, and etc. 
- A collection of `Metric` for application level monitoring

TODO: add diagram

Based on `Interceptor`s and `Entrypoint`s, a mechanism for routing requests and execute them are established.
## Execution stack

When serving a request, the execution flow is organized into a stack of `Interceptor`s. Each interceptor can shortcircuit the request or relay to next interceptor. The design of interceptors allow us to apply policies like authentication, logging, pre-process and post-process in a configurable way to each `EntryPoint`, yet provide a convenient way to debug requests.

TODO: add diagram.

The default execution stack is configured in `host.json` and can be overriden in `app.json` via property *"defaultExecutionStack"*, which is set to default as:
```json
{
    "defaultExecutionStack": [
        "finalizeResponse",
        "executeEntryPoint"
    ]
}
```
`finalizeResponse` and `executeEntryPoint` here are built-in interceptors registered [here](../../config/builtin-interceptors.json). Users can also register their own interceptors, see [Interceptor Registration](#interceptor-registration).

As an important note, `EntryPoint` is executed by interceptor `executeEntryPoint`, which should always be put at the bottom of execution stack.


Execution stack can also be configured per `EntryPoint` by property *"executionStack"*. Here is an example:
```json
{
    "name": "bar",
    "value": {
        "_type": "EntryPoint",
        "moduleName": "./test-app",
        "functionName": "entrypoints.bar",
        "executionStack": [
            "logRequestResponse",
            "finalizeResponse",
            "executeEntryPoint"
        ]
    }
}
```

### Interceptors

`Interceptor` is an async function that take a `RequestContext` as input, and returns a `Promise` of [`Response`](./response.md). Interceptors are registered as `NamedObject`s, and can be referenced by name in execution stack. 

Its interface is defined as:

```ts
export type Interceptor = (context: RequestContext) => Promise<wire.Response>;
```
#### Implementing an Interceptor
An `Interceptor` can either shortcircuit the execution by returning a `Promise` of `Response`: 

```ts
/// <summary> Interceptor: short circuit. 
/// This interceptor is used for debug purpose when doing per-request override
/// <summary> 
export async function shortCircuit(
    context: app.RequestContext): Promise<wire.Response> {
    return Promise.resolve({
        responseCode: wire.ResponseCode.Success
    });
}
```

Or relay the execution to next interceptor:
```ts
/// <summary> Interceptor: pass through.
/// This interceptor is used for debug purpose when doing per-request override
/// <summary> 
export async function passThrough(
    context: app.RequestContext): Promise<wire.Response> {
    return await context.continueExecution();
}
```

#### <a name="interceptor-registration"></a> Registration

Being an `NamedObject`, `Interceptor` can be registered at all levels from `Host` to `Request`. To register an interceptor, a JSON element shall be added:
```json
{
    "name": "passThrough",
    "description": "Interceptor to pass through current interception. ",
    "value": {
        "_type": "Interceptor",
        "moduleName": "../lib/builtin-interceptors",
        "functionName": "passThrough"
    }
}
```
#### Built-in Interceptors
Here are built-in interceptors to support standard execution stack and most common debug purposes.

| Interceptor name     | Description                                         |
|----------------------|-----------------------------------------------------|
| `executeEntryPoint`  | Locate and call `EntryPoint` and return `Response`  |
| `finalizeResponse`   | Prepare *"debugInfo"* and *"perfInfo*" in `Response`|
| `passThrough`        | Pass through to next interceptor                    |
| `shortCircuit`       | Shortcircuit with a dummy succeeded response        |
| `logRequest`         | Log `Request`                                       |
| `logResponse`        | Log `Response`                                      |
| `logRequestResponse` | Log both `Request` and `Response`                   |

### EntryPoints
`EntryPoint` is a function-type `NamedObject` exposed to user as a service method, whose name can be matched againstproperty *"entrypoint"* from [`Request`](./request.md) to serve request.

Its interface is defined as:
```ts
export type EntryPoint = (requestContext?: RequestContext, input?: any) => any;
```
An `EntryPoint` can be a synchronous function or an asynchrnous function. When it's a synchrounous function, `Host.serve` will return a resolved `Promise` of its return value.

User can use `requestContext` to create objects or retrieve named objects that can be overriden at various levels.
#### Creating new Entry Points

##### Coding
Following code defines a synchronous `EntryPoint`:

filename: `./test.ts`
```ts
export function sum(context: RequestContext, input: number[]): number{
    const s = 0;
    for (const num of input) {
        s += num;
    }
    return s;
}
```

##### <a name="entrypoint-registration"></a>Registration
From `app.json`, add a file entry named `entrypoints.json` (can be any name) under property *"namedObjects"*, and put following content in `entrypoints.json`:
```ts
[
    {
        "name": "sum",
        "description": "Sum a list of numbers.",
        "value": {
            "_type": "EntryPoint",
            "moduleName": "./test",
            "functionName": "sum",
            "displayRank": 900,
            "exampleRequests": [
                {
                    "application": "example",
                    "entryPoint": "sum"
                }
            ]
        }
    }
]

```
##### Send Request
Then user can send request by calling `Host.serve` and get response from your entry point.

*Sample request*:
```json
{
    "application": "example",
    "entrypoint": "sum",
    "input": [1, 2, 3]
}
```

*Expected response*:
```json
{
    "responseCode": 0,
    "output": 6
}
```
#### Built-in Entry Points
Here are built-in entry points which are general for `NamedObject` (like `EntryPoint`) discovery, and so on:

| Entry point name  | Description                                             |
|-------------------|---------------------------------------------------------|
| `listApplication` | List all applications served by current host            |
| `listEntryPoints` | List all entry points for an application                |
| `listNamedObjects`| List all public `NamedObject`                           |
| `listTypes`       | List all registered types for an application            |
| `listProviders`   | List all registered object providers for an application |
| `getNamedObject`  | Get a named object definition by name                   |
| `getType`         | Get an object type definition by type name              |
| `getProvider`     | Get an object provider definition by protocol name      |
## Monitoring
Monitoring is a vital part of service experimentation. Therefore, Winery.js has built-in support for `Metric`. 


### <a name="metric-registration"></a> Registration
Each application can add `Metric` definition in JSON file referenced by property *"metrics"* in `app.json`.

Following JSON element defines a `Metric` named *"requestRate"* of `Rate` type (among `Rate`, `Number` and `Percentile`), whose display name is *"Request Rate"*. 

```json
[
    {
        "name": "requestRate",
        "type": "Rate",
        "displayName": "Request Rate",
        "description": "Request rate",
        "dimensionNames": [
            "application", 
            "entrypoint"]
     }
]
```
 This metric has 2 dimensions: application name and entry point name, which means different application name or entry point name will be accounted separately.
### Accessing Metrics

 Metric can be retrieved at runtime by `requestContext.metric['<metric-name>']` or `application.metric['<metric-name>']`.

Following code increment the metric *"requestRate"* on instance *"example.sum"*.
 ```ts
context.metric['requestRate'].increment(["example", "sum"]);
 ```