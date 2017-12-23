# Host
**Host** is an entity to host [**Applications**](./application.md) on various environments (Node event loop or [Napa zones](https://github.com/Microsoft/napajs/blob/master/docs/api/zone.md#intro) or mixed)

Its programming interface `Host` is defined in [`lib/host.ts`](../../lib/host.md) as:

```ts
/// <summary> Interface for application host. </summary>
export interface Host {
    /// <summary> Register an application instance in current host. </summary>
    /// <param name="appModulePath"> full module path of a winery application.</param>
    /// <param name="appInstanceNames"> a list of strings used as names of application instances.</param>
    /// <param name="zone"> zone to run the app. If undefined, use current isolate. </param>
    register(
        appModulePath: string, 
        appInstanceNames: string[], 
        zone: napa.zone.Zone): Promise<void>;

    /// <summary> Serve a request. </summary>
    /// <param name="request"> A JSON string or a request object. </param>
    serve(request: string | wire.Request): Promise<wire.Response>;

    /// <summary> Get application instance names served by this host. </param>
    applicationInstanceNames: string[];
}
```
## Configuring a Host

## Application Hosting
### Registration
A host can host multiple applications at the same time, each application can be registered with multiple instance names (aliases). Decoupling application instance name from applicaton module name gives us the flexibility to switch modules without impacting user inputs, since instance name will be used as the key to dispatch requests to the right application, which is specified by property *"application"* from [`Request`](./request.md#basic-fields).

To support computation intensive scenarios, host supports dispatching requests to another JavaScripts thread via [Napa zones](https://github.com/Microsoft/napajs/blob/master/docs/api/zone.md#intro). Thus there are three types of hosts underlying to federate requests among multiple JavaScript threads.

These three types of hosts are:
- **Leaf host**: host application in current JavaScript thread.
- **Host proxy**: route requests to remote JavaScript thread (zone worker)
- **Host hub**: route request among leaf host and proxies.

The diagram below depicts their collaborations.

![](../images/hosting.png)

Users don't have to interact with concrete host types, when calling `winery.host()`, it returns a host hub that can be used to register applications in both local thread or remote Napa zones.

Here is an examples to register multiple applications served in multiple zones.

```typescript
import * as napa from 'napajs';
import * as winery from 'winery';

// By using multiple container, we can define different runtime policies.
// Create container1 with default settings.
let zone1 = napa.zone.create('zone1');

// Create container2 with customized settings.
let zone2 = napa.zone.create('zone2', {
        workers: 4,
        maxStackSize: 1048576,      // 1 MB
        maxOldSpaceSize: 33554432,  // 32 MB
        maxSemiSpaceSize: 33554432, // 32 MB
    });

let host = winery.host();

try {
    // Serve an io-intensive-app in Node.JS eventloop.
    await host.register('io-intensive-app', ['example1']);

    // Serve example-app2 using name 'example2' and example-app3 using name 'example3a' in zone1. 
    await host.register('example-app2', ['example2'], zone1);
    await host.register('example-app3', ['example3a'], zone1);

    // Serve example-app3 using name 'example3b' and example-app4 using name 'example4' in zone2. 
    await host.register('example-app3', ['example3b'], zone2);
    await host.register('example-app4', ['example4'], zone2);
}
catch (e) {
    console.log("winery register failed:" + e);
}

```
### Request Serving
With application registered, request serving is straightforward:
```ts

import {Request, Response} from 'winery'

// Create a request.
var request: Request = {
    application: 'example1',
    entrypoint: 'echo',
    input: 'hello, world'
};

// Get a response.
var response: Response = await host.serve(request);
console.log(response);

```