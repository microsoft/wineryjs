// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as assert from 'assert';
import * as path from 'path';

import { ObjectContext } from '../lib/object-context';
import { NamedObject } from '../lib/named-object';
import { Uri, ProviderDef, ProviderRegistry, ProviderConfig } from '../lib/object-provider';

describe('winery/object-provider', () => {
    describe('Uri', () => {
        it('#parse: absolute path with no parameters.', () => {
            let uri = Uri.parse("doc://a/d/e/f");
            assert.equal(uri.path, "/a/d/e/f");
            assert.equal(uri.protocol, "doc");
        });

        it('#parse: relative path with no parameters.', () => {
            let uri = Uri.parse("doc:/a/d/e/f");
            assert.equal(uri.path, "a/d/e/f");
            assert.equal(uri.protocol, "doc");
        });

        it('#parse: absolute path with parameters.', () => {
            let uri = Uri.parse("doc://a/d/e/f?a=1&b=2");
            assert.equal(uri.path, "/a/d/e/f");
            assert.equal(uri.protocol, "doc");
            assert.strictEqual(uri.getParameter("a"), "1");
            assert.strictEqual(uri.getParameter("b"), "2");
        });
        
        it('#parse: bad format.', () => {
            assert.throws(() => {
                Uri.parse("doc//a/d/e/f?a=1&b=2");
            });
        });
    });


    describe('ObjectProviderConfig', () => {
        it('#fromConfigObject: good config', () => {
            let configObject = [
                {
                    protocol: "protocolA",
                    description: "Protocol A",
                    moduleName: "module",
                    functionName: "function",
                    exampleUri: ["protocolA://abc"]

                }
            ]
            let defs = ProviderConfig.fromConfigObject(configObject, true);
            assert.deepEqual(defs, [
                {
                    protocol: "protocolA",
                    description: "Protocol A",
                    moduleName: "module",
                    functionName: "function",
                    exampleUri: ["protocolA://abc"],
                    // Set default property.
                    override: false
                }
            ])
        });

        it('#fromConfigObject: not conform with schema', () => {
            let configObject = [
                {
                    protocol: "protocolA",
                    // Should be moduleName, and missing exampleUri.
                    module: "module",
                    functionName: "function"
                }
            ]
            assert.throws( () => {
                ProviderConfig.fromConfigObject(configObject, true);
            });
        });

        it ('#fromConfig', () => {
            assert.doesNotThrow(() => {
                ProviderConfig.fromConfig(
                    path.resolve(__dirname, "test-app/object-providers.json"));
            });
        });
    });

    describe('ProviderRegistry', () => {
        let provider = new ProviderRegistry();
        
        // ProtocolA support both a single element and an array as input.
        it('#register', () => {
            provider.register('protocolA', 
                (uri: Uri | Uri[]): string | string[] => {
                    if (Array.isArray(uri)) {
                        return uri.map(value => { return value.path; });
                    }
                    return uri.path;
                });

            // ProtocolB needs an ObjectContext to create inner object.
            provider.register('protocolB',
                    (input: Uri, context: ObjectContext): any => {
                        return path.resolve(context.baseDir, input.path);
                    });
        });

        it('#supports', () => {
            // Case insensitive.
            assert(provider.supports('protocolA'));
            assert(provider.supports('ProtocolA'));
            assert(provider.supports('protocola'));

            assert(provider.supports('protocolB'));
            assert(!provider.supports('protocolC'));
        });
        
        it('#provide: unsupported protocol', () => {
            // Create object of unsupported type.
            assert.throws(() => { 
                    provider.provide(Uri.parse("protocolC://abc"));
                }, 
                Error);
        });

        let uriA1 = Uri.parse("protocolA://abc");
        let expectedA1 = "/abc";
        it('#provide: input with single uri', () => {
            // Create object with a single uri. 
            let a1 = provider.provide(uriA1);
            assert.strictEqual(a1, expectedA1);
        });

        it('#provide: case insensitive protocol', () => {
            // Create object with a single uri. 
            let a1 = provider.provide(Uri.parse("PrOtOcOlA://abc"));
            assert.strictEqual(a1, expectedA1);
        });
        
        it('#provide: input with array of uri.', () => {
            // Create an array of objects with an array of uris.
            let uriA2 = Uri.parse("protocolA://cde");
            let arrayA = provider.provide([uriA1, uriA2]);
            assert.deepEqual(arrayA, ["/abc", "/cde"]);
        });

        // Create an object that needs ObjectContext.
        // Create a simple context.
        var context: ObjectContext = {
            create: (input: any): any => {
                return null;
            },
            get: (name: string): NamedObject => {
                return null;
            },
            forEach: (callback: (object: NamedObject) => void) => {
                // Do nothing.
            },
            baseDir: __dirname
        }

        let uriB1 = Uri.parse("protocolB:/file1.txt");
        it('#provide: protocol needs object context', () => {
            assert.equal(provider.provide(uriB1, context), path.resolve(__dirname, "file1.txt"));
        });

        it('#provide: mixed protocol in a Uri array', () => {
            // Create an array of objects of different protocol. 
            assert.throws(() => {
                    provider.provide([uriA1, uriB1], context);
                }, Error);
        });

        it('ProviderRegistry#fromDefinition', () => {
            let defs: ProviderDef[] = [{
                protocol: "protocolA",
                moduleName: "./object-provider-test",
                functionName: "loadA"
            }];
            let provider = ProviderRegistry.fromDefinition(defs, __dirname);
            assert(provider.supports('protocolA'));
            
            let uriA1 = Uri.parse("protocolA://abc")
            assert.equal(provider.provide(uriA1), "/abc");
        });
    });
});

export function loadA(uri: Uri): string {
    return uri.path;
}