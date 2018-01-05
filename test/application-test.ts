// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as assert from 'assert';
import * as path from 'path';
import { Application, ApplicationSettings, ApplicationConfig } from '../lib/application';
import * as builtins from '../lib/builtins';
import { HostConfig, Leaf } from '../lib/host';

describe('winery/application', () => {
    let host = new Leaf(
            HostConfig.fromConfig(
                require.resolve('../config/host.json')));

    let appSettings: ApplicationSettings = undefined;
    let app: Application = undefined; 

    describe('ApplicationConfig', () => {
        it('#fromConfig', () => {
            appSettings = ApplicationConfig.fromConfig(host.settings,
                path.resolve(__dirname, "test-app/app.json"));
        });

        it('#getters', () => {
            assert.equal(appSettings.metrics.length, 1);
        })
    });

    describe('Application', () => {
        it('#ctor', () => {
            app = new Application(host.objectContext,
                ApplicationConfig.fromConfig(
                host.settings,
                path.resolve(__dirname, "test-app/app.json")));
        });

        it('#getters', () => {
            assert.equal(app.id, 'test-app');
            assert.equal(Object.keys(app.metrics).length, 1);
        });

        it('#create', () => {
            assert.equal(app.create({
                            _type: "TypeA",
                            value: "abc"
                        }), "A:abc");
            assert.strictEqual(app.create("protocolA:/abc"), "A:abc");
        });

        it('#get', () => {
            assert.equal(app.get('object1'), "A:abc");
        });

        it('#getEntryPoint', () => {
            assert.strictEqual(app.getEntryPoint("listEntryPoints"), builtins.entryPoints.listEntryPoints);
        })
        
        it('#getInterceptor', () => {
            assert.strictEqual(app.getInterceptor("executeEntryPoint"), builtins.interceptors.executeEntryPoint);
        });

        it('#getExecutionStack', () => {
            let stack = app.getExecutionStack('foo');
            assert.equal(stack.length, 2);
            assert.strictEqual(stack[0], builtins.interceptors.finalizeResponse);
            assert.strictEqual(stack[1], builtins.interceptors.executeEntryPoint);

            stack = app.getExecutionStack('bar');
            assert.equal(stack.length, 3);
            assert.strictEqual(stack[0], builtins.interceptors.logRequestResponse);
            assert.strictEqual(stack[1], builtins.interceptors.finalizeResponse);
            assert.strictEqual(stack[2], builtins.interceptors.executeEntryPoint);
        });
    });
});

