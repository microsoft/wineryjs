// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as assert from 'assert';
import * as path from 'path';

import { NamedObject, NamedObjectConfig, NamedObjectRegistry } from '../lib/named-object';

describe('winery/named-object', () => {
    describe('NamedObjectConfig', () => {
        it('#fromConfigObject: good config', () => {
            let configObject = [
                {
                    name: "object1",
                    value: {
                        _type: "TypeA",
                        value: 1
                    }
                },
                {
                    name: "object2",
                    value: 1
                }
            ]
            
            let defs = NamedObjectConfig.fromConfigObject(configObject, true);
            assert.deepEqual(defs, [
                {
                    name: "object1",
                    value: {
                        _type: "TypeA",
                        value: 1
                    },
                    // Set default values.
                    override: false,
                    private: false
                },
                {
                    name: "object2",
                    value: 1,
                    override: false,
                    private: false
                }
            ])    
        });

        it('#fromConfigObject: not conform with schema', () => {
            let configObject = [
                {
                    name: "object1",
                    // Should be value.
                    valueDef: 1
                }
            ]
            assert.throws( () => {
                NamedObjectConfig.fromConfigObject(configObject, true);
            });    
        });

        it ('#fromConfig', () => {
            assert.doesNotThrow(() => {
                NamedObjectConfig.fromConfig(
                    path.resolve(__dirname, "test-app/objects.json"));
            });
        });
    });

    describe('NamedObjectRegistry', () => {
        let collection = new NamedObjectRegistry();
        let objectA: NamedObject = {
            scope: "global",
            def: {
                name: "objectA",
                value: 1
            },
            value: 1
        }

        it('#has', () => {
            assert(!collection.has('objectA'));
        });

        it('#insert', () => {
            collection.insert(objectA);
            assert(collection.has('objectA'));
        });

        it('#get', () => {
            let output = collection.get("objectA")
            assert.strictEqual(output, objectA);
        });

        it('#forEach', () => {
            collection.forEach((object: NamedObject) => {
                assert.strictEqual(object, objectA);
            });
        })

        it('#fromDefinition', () => {
            let objectContext = {
                create: (input: any): any => {
                    return input;
                },
                get: (name: string): NamedObject => {
                    return null;
                },
                forEach: (callback: (object: NamedObject) => void) => {
                    // Do nothing.
                },
                baseDir: __dirname
            }
            collection = NamedObjectRegistry.fromDefinition(
                "global",
                [{ name: "objectA", value: 1 }], 
                objectContext);
            assert(collection.has('objectA'));
            assert.deepEqual(collection.get('objectA'), objectA);
        })
    });
});