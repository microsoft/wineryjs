// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as app from '../lib/application';
import * as builtins from '../lib/builtins';
import { Request } from '../lib/request';
import { Response, ResponseCode } from '../lib/response';
import { HostConfig, Host, Leaf, Proxy, Hub } from '../lib/host';

import * as path from 'path';
import * as napa from 'napajs';
import * as assert from 'assert';

describe('winery/host', () => {
    describe('HostConfig', () => {
        it('#fromConfig', () => {
            let hostSettings = HostConfig.fromConfig(
                require.resolve("../config/host.json"));

            assert.equal(hostSettings.allowPerRequestOverride, true);
            assert.deepEqual(hostSettings.defaultExecutionStack, [
                "finalizeResponse",
                "executeEntryPoint"
            ]);
            assert.equal(hostSettings.baseDir, path.dirname(require.resolve('../config/host.json')));
            assert.equal(hostSettings.throwExceptionOnError, true);
        });
    });

    describe('Leaf', () => {
        let host: Host = undefined;
        it('#ctor', () => {
            host = new Leaf(
                HostConfig.fromConfig(
                    require.resolve('../config/host.json'))
            );
        });

        it('#register: success', () => {
            host.register(
                path.resolve(__dirname, './test-app'), 
                ["testApp"]);
        });

        it('#register: fail - duplicated instance name', () => {
            assert.throws(() => {
                host.register(
                    path.resolve(__dirname, './test-app'),
                    ["testApp"]);
            });
        });
            
        it('#register: fail - register for another container.', () => {
            assert.throws(() => {
                host.register(
                    path.resolve(__dirname, './test-app'), 
                    ["testApp"], 
                    napa.zone.create('zone1'))
            });
        });

        it('#serve: sync entrypoint', (done) => {
            host.serve({
                application: "testApp",
                entryPoint: "foo",
                input: "hello world"
            }).then((response: Response) => {
                assert.equal(response.responseCode, ResponseCode.Success);
                assert.equal(response.output, 'hello world');
                done();
            });
        });
        
        it('#serve: async entrypoint', (done) => {
            host.serve({
                application: "testApp",
                entryPoint: "bar",
                input: "hello world"
            }).then((response: Response) => {
                assert.equal(response.responseCode, ResponseCode.Success);
                assert.equal(response.output, "hello world");
                done();
            });
        });

        it('#serve: bad request - malformat JSON ', (done) => {
            host.serve(`{
                "application": "testApp",
                "entryPoint": "foo",
            }`).catch((error: Error) => {
                done(error.message.startsWith("Unexpected token }") ? undefined : error);
            });
        });
        
        it('#serve: bad request - not registered application ', (done) => {
            host.serve({
                application: "testApp2",
                entryPoint: "foo"
            }).catch((error: Error) => {
                done(error.message === "'testApp2' is not a known application"? undefined: error);
            });
        });

        it('#serve: bad request - entryPoint not found ', (done) => {
            host.serve({
                application: "testApp",
                entryPoint: "foo2"
            }).catch((error: Error) => {
                done(error.message === "Entrypoint does not exist: 'foo2'" ? undefined: error);
            });
        });

        it('#serve: application throws exception ', (done) => {
            host.serve({
                application: "testApp",
                entryPoint: "alwaysThrow"
            }).catch((error) => {
                done(error.message === "You hit an always-throw entrypoint."? undefined: error);
            });
        });

        it('#applicationInstanceNames', () => {
            assert.deepEqual(host.applicationInstanceNames, ["testApp"]);
        });
    });

    describe('Proxy', () => {
        let host: Host = undefined;
        let zone: napa.zone.Zone = napa.zone.create('zone2');
        it('#ctor', () => {
            host = new Proxy(zone);
        });

        it('#register: success', () => {
            return host.register(
                path.resolve(__dirname, './test-app'), 
                ["testApp"]);
        }).timeout(0);

        // Bug: https://github.com/Microsoft/napajs/issues/158 
        // Broadcast will succeed even register will fail.
        it.skip('#register: fail - duplicated instance name', (done) => {
            host.register(
                path.resolve(__dirname, './test-app'),
                ["testApp"]);
        });
            
        // Bug: Broadcast shall support synchronized version.
        it.skip('#register: fail - register for another container.', (done) => {
            host.register(
                path.resolve(__dirname, './test-app'), 
                ["testApp"], 
                napa.zone.create('zone3'));
        });

        it('#serve: sync entrypoint', (done) => {
            host.serve({
                application: "testApp",
                entryPoint: "foo",
                input: "hello world"
            }).then((response: Response) => {
                assert.equal(response.responseCode, ResponseCode.Success);
                assert.equal(response.output, 'hello world');
                done();
            }).catch((e) => {
                done(e);
            });
        }).timeout(0);
        
        // TODO: setTimeout is not supported in Napa workers.
        it.skip('#serve: async entrypoint', (done) => {
            host.serve({
                application: "testApp",
                entryPoint: "bar",
                input: "hello world"
            }).then((response: Response) => {
                assert.equal(response.responseCode, ResponseCode.Success);
                assert.equal(response.output, "hello world");
                done();
            }).catch((e) => {
                done(e);
            });
        });

        // Bug: https://github.com/Microsoft/wineryjs/issues/1
        it('#serve: bad request - malformat JSON ', (done) => {
            host.serve(`{
                "application": "testApp",
                "entryPoint": "foo",
            }`).catch((error: string) => {
                done(error.startsWith("SyntaxError: Unexpected token }") ? undefined : error);
            });
        }).timeout(0);
        
        it('#serve: bad request - not registered application', (done) => {
            host.serve({
                application: "testApp2",
                entryPoint: "foo"
            }).catch((error: string) => {
                done(error === "Error: Application 'testApp2' is not registered for serving" ? undefined: error);
            });
        }).timeout(0);

        it('#serve: bad request - entryPoint not found ', (done) => {
            host.serve({
                application: "testApp",
                entryPoint: "foo2"
            }).catch((error: string) => {
                done(error === "Error: Entrypoint does not exist: 'foo2'" ? undefined : error);
            });
        }).timeout(0);

        it('#serve: application throws exception ', (done) => {
            host.serve({
                application: "testApp",
                entryPoint: "alwaysThrow"
            }).catch((error: string) => {
                done(error === "Error: You hit an always-throw entrypoint." ? undefined : error);
            });
        }).timeout(0);

        it('#applicationInstanceNames', () => {
            assert.deepEqual(host.applicationInstanceNames, ["testApp"]);
        });
    });

    describe("Hub", () => {
        let host: Host = undefined;
        let zone: napa.zone.Zone = napa.zone.create('zone4');

        it('#ctor', () => {
            host = new Hub(
                HostConfig.fromConfig(
                    require.resolve('../config/host.json')));
        });

        it('#register: local', () => {
            return host.register(
                path.resolve(__dirname, './test-app'), 
                ["testApp"]);
        });

        it('#register: remote', () => {
            return host.register(
                path.resolve(__dirname, './test-app'), 
                ["testApp2"],
                zone);
        }).timeout(0);

        it('#register: local - fail - duplicated instance name', (done) => {
            assert.throws(() => {
                host.register(
                path.resolve(__dirname, './test-app'), 
                ["testApp"])
            });
        }).timeout(0);

        // Bug: https://github.com/Microsoft/napajs/issues/158 
        // Broadcast will succeed even register will fail.
        it.skip('#register: remote - fail - duplicated instance name', (done) => {
            assert.throws(() => {
                host.register(
                    path.resolve(__dirname, './test-app'), 
                    ["testApp2"],
                    zone);
            });
        });

        it('#serve: local - sync entrypoint', (done) => {
            host.serve({
                application: "testApp",
                entryPoint: "foo",
                input: "hello world"
            }).then((response: Response) => {
                assert.equal(response.responseCode, ResponseCode.Success);
                assert.equal(response.output, 'hello world');
                done();
            }).catch((e) => {
                done(e);
            });
        }).timeout(0);

        it('#serve: remote - sync entrypoint', (done) => {
            host.serve({
                application: "testApp2",
                entryPoint: "foo",
                input: "hello world"
            }).then((response: Response) => {
                assert.equal(response.responseCode, ResponseCode.Success);
                assert.equal(response.output, 'hello world');
                done();
            }).catch((e) => {
                done(e);
            });
        }).timeout(0);

        it('#serve: request template', (done) => {
            host.serve({
                base: path.resolve(__dirname, "test-app/level1.template.json"),
                entryPoint: "foo",
                input: "hello world"
            }).then((response: Response) => {
                assert.equal(response.responseCode, ResponseCode.Success);
                assert.equal(response.output, 'hello world');
                done();
            }).catch((e) => {
                done(e);
            });
        }).timeout(0);

        it('#applicationInstanceNames', () => {
            assert.deepEqual(host.applicationInstanceNames, ["testApp", "testApp2"]);
        });
    });
});