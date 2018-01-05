// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as assert from 'assert';
import * as path from 'path';

import { Application, ApplicationConfig } from '../lib/application';
import { HostConfig, Leaf } from '../lib/host';

import { Request } from '../lib/request';
import { RequestContext } from '../lib/request-context';
import { RequestTemplateFileLoader } from '../lib/request-template';

describe('winery/request-context', () => {
    let host = new Leaf(
            HostConfig.fromConfig(
                require.resolve('../config/host.json')));

    describe('#baseless', () => {
        let app = new Application(host.objectContext,
            ApplicationConfig.fromConfig(
            host.settings,
            path.resolve(__dirname, "test-app/app.json")));

        let request: Request = {
            application: "testApp",
            entryPoint: "foo",
            input: "hello world",
            overrideTypes: [
                // Override a type
                {
                    typeName: "TypeB",
                    moduleName: "./test-app",
                    functionName: "types.createB_request"
                },
                // Add a type
                {
                    typeName: "TypeE",
                    moduleName: "./test-app",
                    functionName: "types.createE"
                }
            ],
            overrideProviders: [
                // Override a protocol
                {
                    protocol: "ProtocolB",
                    moduleName: "./test-app",
                    functionName: "providers.provideB_request"
                },
                // Add a protocol
                {
                    protocol: "ProtocolE",
                    moduleName: "./test-app",
                    functionName: "providers.provideE"
                }
            ],
            overrideObjects: [
                // #4: new object using old type
                {
                    name: "object4",
                    value: {
                        _type: "TypeC",
                        value: "abc"
                    }
                },
                // #5: new object using old protocol
                {
                    name: "object5",
                    value: "ProtocolC:/abc"
                },
                // #6: new object using overriden type
                 {
                    name: "object6",
                    value: {
                        _type: "TypeB",
                        value: "def"
                    }
                },
                // #7: new object using overriden protocol
                {
                    name: "object7",
                    value: "ProtocolB:/def"
                },
                // #8: new object using new type
                {
                    name: "object8",
                    value: {
                        _type: "TypeE",
                        value: "abc"
                    }
                },
                // #9: new object using new provider
                {
                    name: "object9",
                    value: "ProtocolE:/abc"
                }
            ]
        };

        let context: RequestContext = new RequestContext(app.defaultRequestTemplate, request);

        it('#basics', () => {
            assert.deepEqual(context.controlFlags, {
                debug: false,
                perf: false
            });
            assert.equal(context.entryPointName, "foo");
            assert.equal(context.input, "hello world");
            assert.equal(context.traceId, "Unknown");
            assert.strictEqual(context.application, app);
            assert.strictEqual(context.entryPoint, context.getEntryPoint('foo'));
            assert.strictEqual(context.request, request);
        });

        // Case#: 0 1 2 3
        // Type:  A D E F
        // app    T T    
        // R        T T  
        describe("#create by types", () => {
            it("#0: existing type", () => {
                assert.equal(context.create({
                    _type: "TypeA",
                    value: "hij"
                }), "A:hij");
            });

            it("#1: overriden type", () => {
                assert.equal(context.create({
                    _type: "TypeB",
                    value: "hi"
                }), "B:request:hi");
            });
            
            it("#2: new type", () => {
                assert.equal(context.create({
                    _type: "TypeE",
                    value: "hi"
                }), "E:hi");
            });

            it("#3: unregistered type", () => {
                assert.throws(() => {
                    context.create({
                    _type: "TypeF",
                    value: 1});
                });
            });
        });

        // Case#: 0 1 2 3
        // Type:  A B E F
        // app    P P    
        // R        P P  
        describe("#create by providers", () => {
            it("#0: existing protocol", () => {
                assert.equal(context.create("ProtocolA:/abc"), "A:abc");
            });

            it("#1: overriden protocol", () => {
                assert.equal(context.create("ProtocolB:/abc"), "B:request:abc");
            });

            it("#2: new protocol", () => {
                assert.equal(context.create("ProtocolE:/abc"), "E:abc");
            });

            it("#3: unregistered protocol", () => {
                assert.throws(() => {
                    context.create("ProtocolF:/abc");
                });
            });
        });

        // Case#  0     1    2    3    4    5    6    7     8    9   10 
        // Obj#   0     1    2    3    4    5    6    7     8    9      
        // Type   A     A    B    B    A    A     B   B     E    E      
        // app   O(T) O(P) O(T)  O(P)  T    P     T   P              N/A
        // R                T     P   O()  O()  O(T) O(P) O(T) O(P)  N/A
        describe("#get", () => {
            it("#0: old object using old type", () => {
                assert.equal(context.get("object0"), "A:abc");
            });

            it("#1: old object using old provider", () => {
                assert.equal(context.get("object1"), "A:abc");
            });

            it("#2: old object with overriden type", () => {
                assert.equal(context.get("object2"), "B:request:abc");
            });

            it("#3: old object with overriden provider", () => {
                assert.equal(context.get("object3"), "B:request:abc");
            });

            it("#4: new object using old type", () => {
                assert.equal(context.get("object4"), "C:app:abc");
            });

            it("#5: new object using old provider", () => {
                assert.equal(context.get("object5"), "C:app:abc");
            });

            it("#6: new object using overriden type", () => {
                assert.equal(context.get("object6"), "B:request:def");
            });

            it("#7: new object using overriden provider", () => {
                assert.equal(context.get("object7"), "B:request:def");
            });

            it("#8: new object using new type", () => {
                assert.equal(context.get("object8"), "E:abc");
            });

            it("#9: new object using new provider", () => {
                assert.equal(context.get("object9"), "E:abc");
            });

            it("#10: object not exist", () => {
                assert.equal(context.get("object10"), null);
            });
        });
    });

    describe("#two-level-inheritance", () => {
        let app = new Application(host.objectContext,
            ApplicationConfig.fromConfig(
            host.settings,
            path.resolve(__dirname, "test-app/app.json")));

        let request: Request = {
            application: "testApp",
            entryPoint: "foo",
            input: "hello world",
            overrideTypes: [
                {
                    typeName: "TypeC",
                    moduleName: "./test-app",
                    functionName: "types.createC_request"
                },
                {
                    typeName: "TypeD",
                    moduleName: "./test-app",
                    functionName: "types.createD_request"
                },
                {
                    typeName: "TypeE",
                    moduleName: "./test-app",
                    functionName: "types.createE"
                }
            ],
            overrideProviders: [
                {
                    protocol: "ProtocolC",
                    moduleName: "./test-app",
                    functionName: "providers.provideC_request"
                },
                {
                    protocol: "ProtocolD",
                    moduleName: "./test-app",
                    functionName: "providers.provideD_request"
                },
                {
                    protocol: "ProtocolE",
                    moduleName: "./test-app",
                    functionName: "providers.provideE"
                }
            ],
            overrideObjects: [
                {
                    name: "object10",
                    value: {
                        _type: "TypeA",
                        value: "abc"
                    }
                },
                {
                    name: "object11",
                    value: "ProtocolA:/abc"
                },
                {
                    name: "object12",
                    value: {
                        _type: "TypeB",
                        value: "abc"
                    }
                },
                {
                    name: "object13",
                    value: "ProtocolB:/abc"
                },
            ]
        };

        let loader = new RequestTemplateFileLoader();
        let template = loader.load(
            path.resolve(__dirname, "test-app/level1.template.json"), 
            appName => app, 
            uri => undefined);

        let context: RequestContext = new RequestContext(template, request);

        // Case#  0  1  2  3  4  5
        // Type   A  B  C  D  E  F
        // app    T  T  T         
        // l0              T      
        // l1        T            
        // R            T  T  T   
        describe("#create by types", () => {
            it("#0: using old type", () => {
                assert.equal(
                    context.create({
                        _type: "TypeA",
                        value: "abc"
                    }),
                    "A:abc");
            });

            it("#1: override app from template", () => {
                assert.equal(
                    context.create({
                        _type: "TypeB",
                        value: "abc"
                    }),
                    "B:l1:abc");
            });

            it("#2: override app from request", () => {
                assert.equal(
                    context.create({
                        _type: "TypeC",
                        value: "abc"
                    }),
                    "C:request:abc");
            });

            it("#3: override template from request", () => {
                assert.equal(
                    context.create({
                        _type: "TypeD",
                        value: "abc"
                    }),
                    "D:request:abc");
            });

            it("#4: add type from request", () => {
                assert.equal(
                    context.create({
                        _type: "TypeE",
                        value: "abc"
                    }),
                    "E:abc");
            });

            it("#4: unregistered type", () => {
                assert.throws(() => {
                    context.create({
                        _type: "TypeF"
                    });
                });
            });
        });

        // Case#  0  1  2  3  4  5
        // Type   A  B  C  D  E  F
        // app    T  T  T         
        // l0              T      
        // l1        T            
        // R            T  T  T   
        describe("#create by providers", () => {
            it("#0: using old type", () => {
                assert.equal(
                    context.create("ProtocolA:/abc"),
                    "A:abc");
            });

            it("#1: override app from template", () => {
                assert.equal(
                    context.create("ProtocolB:/abc"),
                    "B:l1:abc");
            });

            it("#2: override app from request", () => {
                assert.equal(
                    context.create("ProtocolC:/abc"),
                    "C:request:abc");
            });

            it("#3: override template from request", () => {
                assert.equal(
                    context.create("ProtocolD:/abc"),
                    "D:request:abc");
            });

            it("#4: add type from request", () => {
                assert.equal(
                    context.create("ProtocolE:/abc"),
                    "E:abc");
            });

            it("#4: unregistered type", () => {
                assert.throws(() => {
                    context.create("ProtocolF:/abc");
                });
            });
        });

        // Case#  0     1    2    3    4   5    6   7   8    9    10  11  12 13 14
        // Obj#   0     1    2    3    4b  5b   6   7   8    9    10  11  12 13 N/A
        // Type   A     A    B    B    C   C    C   C   X    X    A   A   B   B   
        // app   O(T) O(P) O(T) O(P)  O(T) O(P) T   P             T   P   T   P   
        // l0                                  O() O() O(T) O(P)                  
        // l1                T    P    T    P            T    P           T   P   
        // R                           T    P   T   P            O() O() O() O()  
        describe("#get", () => {
            it("#0: app value from app type", () => {
                assert.equal(context.get("object0"), "A:abc");
            });

            it("#1: app value from app provider", () => {
                assert.equal(context.get("object1"), "A:abc");
            });

            it("#2: app value from template overriden type", () => {
                assert.equal(context.get("object2"), "B:l1:abc");
            });

            it("#3: app value from template overriden provider", () => {
                assert.equal(context.get("object3"), "B:l1:abc");
            });

            it("#4: app value from request overriden type", () => {
                assert.equal(context.get("object4b"), "C:request:abc");
            });

            it("#5: app value from request overriden provider", () => {
                assert.equal(context.get("object5b"), "C:request:abc");
            });

            it("#6: template value from request overriden type", () => {
                assert.equal(context.get("object6"), "C:request:abc");
            });

            it("#7: template value from request overriden provider", () => {
                assert.equal(context.get("object7"), "C:request:abc");
            });

            it("#8: template value from child template overriden type", () => {
                assert.equal(context.get("object8"), "X:l1:abc");
            });

            it("#9: template value from child template overriden provider", () => {
                assert.equal(context.get("object9"), "X:l1:abc");
            });

            it("#10: request value from app type", () => {
                assert.equal(context.get("object10"), "A:abc");
            });

            it("#11: request value from app provider", () => {
                assert.equal(context.get("object11"), "A:abc");
            });

            it("#12: request value from template type", () => {
                assert.equal(context.get("object12"), "B:l1:abc");
            });

            it("#13: request value from template provider", () => {
                assert.equal(context.get("object13"), "B:l1:abc");
            });

            it("#14: unregistered object", () => {
                assert.strictEqual(context.get("objectXXX"), undefined);
            });

        });
    });

    describe('RequestDebugger', () => {
        it('#event', () => {
        });

        it('#detail', () => {
        });

        it('#setLastError', () => {
        });

        it('#getOutput', () => {
        });
    });

    describe('RequestLogger', () => {
        it('#debug', () => {
        });

        it('#info', () => {
        });

        it('#err', () => {
        });

        it('#warn', () => {
        });
    });
});

