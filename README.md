# Winery.js

Winery.js is a framework to enable services to run experiments in parallel with serving production traffic. Besides A/B testing, Winery.js supports experimentation at per-request level, which minimizes turnaround time as code evolves. Winery.js also provides a structure for creating applications declaratively, with the access to [Napa.js](https://github.com/Microsoft/napajs) capabilities, such as multi-threading, pluggable logging, metric, and etc. Before Winery.js was branched out as an open source project, it has been used in Bing to empower feature experiments for machine learned models.

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
## Why Winery.js
The goal of Winery.js is to take experimentation agility to the extreme, which needs the ability to change a wide range of behaviors (logics, resources) instantly without impacting production service quality. This framework is an implementation of ideas discussed in white paper [Continuous modification: a process to build constantly evoling services](https://github.com/daiyip/continuous-modification).


## Features
- Support per-request dependency injection for rapid development
- Support per-request-plan dependency injection for A/B testing
- Rich dependency injection capabilities: parameters, objects, functions
- Declarative application development
- Flexible flow control: Entrypoint with stacked interceptors
- Built-in metric and request logging support
- Hosting application on Napa zone for computation heavy scenarios

## Architecture
As an application framework, Winery.js has following concepts at high level: 
- [`Host`](./docs/api/host.md): component to host applications, which receives requests and dispatch to the right application
- [`Application`](./docs/api/application.md): entity that manages a list of service methods and resources for a specific problem domain
- [`Request`](./docs/api/request.md): plain JavaScript object to describe request sent to an `Application`
- [`Response`](./docs/api/response.md): plain JavaScript object to describe response return from an `Application`

![Winery.js Architecture](./docs/images/arch.png)

## Tutorials
- [Writing Winery.js applications step by step](./docs/tutorial/step-by-step/.md)

# Contribute
You can contribute to Winery.js in following ways:

* [Report issues](https://github.com/Microsoft/wineryjs/issues) and help us verify fixes as they are checked in.
* Review the [source code changes](https://github.com/Microsoft/wineryjs/pulls).
* Contribute bug fixes.

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/). For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact opencode@microsoft.com with any additional questions or comments.

# License
Copyright (c) Microsoft Corporation. All rights reserved.

Licensed under the [MIT](https://github.com/Microsoft/napajs/blob/master/LICENSE.txt) License.
