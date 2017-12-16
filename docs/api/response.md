# Response

`Response` is a plain JavaScript object to describe responses returned from an `Application`.

It's defined in [`./lib/wire.ts`](../../lib/wire.ts) as following:

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
For succeeded requests, users will mostly care about the `output` property.
But for failed requests, `responseCode` and `errorMessage` may be useful to indicate the error.

If `controlFlags.debug` is set to true in `Request`, `debugInfo` will be present, which is defined as:

```ts

/// <summary> Exception information in response. </summary>
export type ExceptionInfo = {
    stack: string;
    message: string;
    fileName?: string;
    lineNumber?: number;
    columnNumber?: number;
}

/// <summary> Debug event in DebugInfo. </summary>
export type DebugEvent = {
    eventTime: Date;
    logLevel: string;
    message: string;
}

/// <summary> Debug information when debug flag is on. </summary>
export type DebugInfo = {
    exception: ExceptionInfo;
    events: DebugEvent[];
    details: { [key: string]: any };
    machineName: string;
}
```

If `controlFlags.perf` is set to true in `Request`, `perfInfo` will be present, now we only have total latency as perf data, but more may be added in future.

```ts
/// <summary> Write performance numbers when perf flag is on. </summary>
export type PerfInfo = {
    processingLatencyInMS: number;
}
```

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
