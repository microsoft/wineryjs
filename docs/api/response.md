# Response

`Response` is a plain JavaScript object to describe responses returned from an `Application`.

It's defined by [JSON schema](../../schema/response.schema.json) or interface  [`Response`](../../lib/wire.ts) as following:

```ts
// <summary> Response code </summary>
export enum ResponseCode {
    // Success.
    Success = 0,

    // Internal error.
    InternalError = 1,

    // Server side timeout.
    ProcessTimeout = 2,

    // Throttled due to policy.
    Throttled = 3,

    // Error caused by bad input.
    InputError = 4
}

/// <summary> Interface for response </summary>
export interface Response {
    /// <summary> Response code </summary>
    responseCode: ResponseCode;

    /// <summary> Error message if response code is not Success. </summary>
    errorMessage?: string;

    /// <summary> Output from entrypoint. </summary>
    output?: any;

    /// <summary> Debug information. </summary>
    debugInfo?: DebugInfo;

    /// <summary> Performance numbers. </summary>
    perfInfo?: PerfInfo;
}
```
## Basic Fields

| Property Name | Present | Description   |
|---------------|----------------|---------------|
| responseCode  | Always              | Response code |
| errorMessage  | When responseCode is not 0 (success)              | A brief message on why request had failed|
| output        | When entrypoint function has a return value              | Entrypoint return value |
| debugInfo     | When `controlFlags.debug` set to `true` | Exception details, event logs for current request |
| perfInfo      | When `controlFlags.perf` set to `true` | Updated metrics for current request |

## Debug Information
When `controlFlags.debug` is set to `true`, `debugInfo` is returned containing 3 optional fields:
| Property name | Present                  | Description                                |
|---------------|--------------------------|--------------------------------------------|
| exception     | When exception is thrown | Exception details                          |
| events        | Always                   | Output from `context.debug` sorted by time |
| details       | Always                   | Key/value pairs from `context.detail`      |
### Exception
Property *"exception"* is an object with following fields:
| Property name | Type   | Description                                  |
|---------------|--------|----------------------------------------------|
| stack         | string | stack trace                                  |
| message       | string | exception message                            |
| fileName      | string | file name from where exception is thrown     |
| lineNumber    | number | line number from where exception is thrown   |
| columnNumber  | number | column number from where exception is thrown |
### Events
Property *\"events\"* is an array of objects with following fields:
| Property name | Type   | Description                             |
|---------------|--------|-----------------------------------------|
| eventTime     | Date   | time when event is logged               |
| logLevel      | string | "debug", "info", "warning", or "error"  |
| message       | string | message of the event                    |

### Performance Information
When `controlFlags.perf` is set to `true`, `perfInfo` will be filled. It's a dictionary of key/values, the keys are the display name of metrics, and the values are the value of these metrics.

## Examples:

Example 1: a succeeded response without a return value.
```ts
{
    responseCode: 0
}
```

Example 2: a succeeded response with a string value returned from its entry point.

```ts
{
    responseCode: 0,
    output: "hello winery"
}
```

Example 3: a failed response due to entry point cannot find a module `abc` via `require`.

```ts
{
    responseCode: 1,
    errorMessage: "Error: Cannot find module 'abc'"
}
```

Example 4: a succeeded response with debug on and perf on.
```ts
{
    responseCode: 0,
    debugInfo: {
        events: [
            {
                eventTime: "2017-12-16T00:02:12:596Z",
                logLevel: "Info",
                message: "Request started."
            },
            {
                eventTime: "2017-12-16T00:02:12:597Z",
                logLevel: "Info",
                message: "Request completed."
            }
        ],
        detail: {
            "user-debug-key1": 123,
            "user-debug-key2": "abc"
        }
    },
    perfInfo: {
        processingLatencyInMS: 1
    }
}
```

Example 5: a failed response with debug on.
```ts
{
    responseCode: 1,
    errorMessage: "Error: Cannot find module 'abc'",
    debugInfo: {
        exception: {
            stack: "at Function.Module._resolveFilename (module.js:485:15) at Function.Module._load (module.js:437:25) at Module.require (module.js:513:17) at require (internal/module.js:11:18) at repl:1:1 at ContextifyScript.Script.runInThisContext (vm.js:44:33) at REPLServer.defaultEval (repl.js:239:29) at bound (domain.js:301:14) at REPLServer.runBound [as eval] (domain.js:314:12) at REPLServer.onLine (repl.js:433:10)",
            message: "Error: Cannot find module 'abc'",
            fileName: "/home/test.js",
            lineNumber: 123,
            columnNumber: 12
        }
    }
}
```
