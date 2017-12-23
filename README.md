# Winery.js

Winery.js is a framework to enable services to run experiments in parallel with serving production traffic. Besides A/B testing, it supports experimentation at per-request level, which minimizes turnaround time when code evolves fast. Winery.js also provides a structure for creating applications declaratively, with the access to [Napa.js](https://github.com/Microsoft/napajs) capabilities, such as multi-threading, pluggable logging, metric, and etc. Before this work was branched out as an open source project, it has been used in Bing to empower feature experiments for machine learned models.

## Installation
```
npm install winery
```

## Quick Start

```typescript
import * as w from 'winery';

await w.register('example-app', ['example']);

const request: w.Request = {
    application: 'example',
    entrypoint: 'echo',
    input: 'hello, world',
    overrideObjects: {
        'echo': {
            '_type': 'EntryPoint',
            'function': 'function (input) { return input; }'
        }
    }
};

const response: w.Response = await w.serve(request);
console.log(response);
```

## Features
- Support request level dependency injection for rapid development
- Support request template level dependency injection for A/B testing
- Rich dependency injection capabilities: data, functions and behaviors
- Declarative application framework
- Flexible flow control: Entrypoint with stacked interceptors
- Integrated with Napa.js to support computation heavy scenarios
- Multi-tenancy with resource sharing among multiple applications
- Built-in instrumentation and monitoring support


## Overview

Winery.js was built based on the idea of dependency injection at various levels, thus its core is to encapsulate object creation and object retrieval behaviors with an overriding mechanism. White paper [Continuous modification: a process to build constantly evoling services](https://github.com/daiyip/continuous-modification) had discussed this idea in details. 

In Winery.js' implementation, [`ObjectContext`](./docs/api/object-context.md) serves as a container type for these behaviors, whose instances are owned by multiple runtime entities with different lifetime and configurability. These `ObjectContext` objects work collaboratively to form an overriding chain among these entities.

These runtime entities are:
- [`Host`](./docs/api/host.md): a singleton object to host applications. Live long and is configurable at deployment time.
- [`Application`](./docs/api/application.md): multi-instance object that manages resources for request execution and serve user requests. Live long and is configurable at deployment time.
- [`Request Template`](): multi-instance object that manages different parameters and resources for A/B testing. Live long and is configurable at runtime.
- [`Request`](./docs/api/request.md): multi-instance object that describes request from user. Live short and is configurable at runtime.


![Winery.js Architecture](./docs/images/architecture.png)

## Specification
- [Application](./docs/api/application.md)
  - [Concepts](./docs/api/application.md#concepts)
  - [Developing an Application](./docs/api/application.md#develop)
- [Host](./docs/api/host.md)
  - [Concepts](./docs/api/host.md#concepts)
  - [Configuring a Host]((./docs/api/host.md#configuration))
  - [Hosting Applications](./docs/api/host.md#usage)
- [Request Template](./docs/api/request-template.md)
  - [Concepts](./docs/api/request-template.md#concept)
  - [Creating a Request Template](./docs/api/request-template.md#create)
- [Request](./docs/api/request.md)
  - [Concepts](./docs/api/request.md#concepts)
  - [Examples](./docs/api/request.md#examples)
- [Response](./docs/api/response.md)
  - [Concepts](./docs/api/response.md#concepts)
  - [Examples](./docs/api/response.md#examples)
- [Object Context](./docs/api/object-context.md)
  - [Concepts](./docs/api/object-context.md#concepts)
  - [Configuring Object Context](./docs/api/object-context.md#configuration)


# Contribute
You can contribute to Winery.js in following ways:

* [Report issues](https://github.com/Microsoft/wineryjs/issues) and help us verify fixes as they are checked in.
* Review the [source code changes](https://github.com/Microsoft/wineryjs/pulls).
* Contribute bug fixes.

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/). For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact opencode@microsoft.com with any additional questions or comments.

# License
Copyright (c) Microsoft Corporation. All rights reserved.

Licensed under the [MIT](https://github.com/Microsoft/napajs/blob/master/LICENSE.txt) License.
