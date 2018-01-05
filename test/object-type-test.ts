// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as assert from 'assert';
import * as path from 'path';

import { ObjectContext } from '../lib/object-context';
import { NamedObject } from '../lib/named-object';
import { ObjectWithType, TypeConfig, TypeDef, TypeRegistry } from '../lib/object-type';

describe('winery/object-type', () => {
    describe('ObjectTypeConfig', () => {
        it('#fromConfigObject: good config', () => {
            let configObject = [
                {
                    typeName: "TypeA",
                    description: "Type A",
                    moduleName: "module",
                    functionName: "function",
                    exampleObjects: [{
                        _type: "TypeA",
                        value: 1
                    }]
                }
            ]
            let defs = TypeConfig.fromConfigObject(configObject, true);
            assert.deepEqual(defs, [
                {
                    typeName: "TypeA",
                    description: "Type A",
                    moduleName: "module",
                    functionName: "function",
                    // Set default property.
                    override: false,
                    exampleObjects: [{
                        _type: "TypeA",
                        value: 1
                    }]
                }
            ])
        });

        it('#fromConfigObject: not conform with schema', () => {
            let configObject = [
                {
                    // Should be typeName, missing exampleObjects
                    type: "TypeA",
                    moduleName: "module",
                    functionName: "function"
                }
            ]
            assert.throws(() => {
                 TypeConfig.fromConfigObject(configObject, true);
            });
        });

        it ('#fromConfig', () => {
            assert.doesNotThrow(() => {
                TypeConfig.fromConfig(
                    path.resolve(__dirname, "test-app/object-types.json"));
            });
        });
    });
    describe('TypeRegistry', () => {
        let factory = new TypeRegistry();
        it('#register', () => {
            // TypeA constructor support both a single element and an array as input.
            type TypeAInput = { "_type": "TypeA", "value": number}; 
            factory.register('TypeA', 
                (input: TypeAInput | TypeAInput[]): number | number[] => {
                    if (Array.isArray(input)) {
                        return input.map(value => { return value.value; });
                    }
                    return input.value;
                });

            // TypeB constructor needs an ObjectContext to create inner object.
            factory.register('TypeB',
                    (input: {"_type": "TypeB", "value": ObjectWithType}, context: ObjectContext): any => {
                        return context.create(input.value);
                    });
        });

        it('#supports', () => {
            assert(factory.supports('TypeA'));
            assert(factory.supports('TypeB'));
            assert(!factory.supports('TypeC'));
        });
        
        it('#create: unsupported type', () => {
            // Create object of unsupported type.
            assert.throws(() => { 
                    factory.create({'_type': 'TypeC'})
                }, 
                Error);
        });

        let inputA1 = { "_type": "TypeA", "value": 1};
        let expectedA1 = 1;
        it('#create: input as single element', () => {
            // Create object with a single element. 
            let a1 = factory.create(inputA1);
            assert.equal(a1, expectedA1);
        });

        it('#create: input as array', () => {
            // Create an array of objects of the same type.
            let inputA2 = { "_type": "TypeA", "value": 2};
            let arrayA = factory.create([inputA1, inputA2]);
            assert.deepEqual(arrayA, [1, 2]);
        });

        // Create an object that needs ObjectContext.
        // Create a simple context.
        var context: ObjectContext = {
            create: (input: any): any => {
                return factory.create(<ObjectWithType>input);
            },
            get: (name: string): NamedObject => {
                return null;
            },
            forEach: (callback: (object: NamedObject) => void) => {
                // Do nothing.
            },
            baseDir: __dirname
        }

        let inputB1 = {"_type": "TypeB", "value": inputA1};
        it('#create: constructor needs a context object.', () => {
            assert.equal(factory.create(inputB1, context), expectedA1);
        });

        it('#create: array input with different types.', () => {
            // Create an array of objects of different type. 
            assert.throws(() => {
                    factory.create([inputA1, inputB1], context);
                }, Error);
        });

        it('#fromDefinition', () => {
            let defs: TypeDef[] = [{
                typeName: "TypeA",
                moduleName: "./object-type-test",
                functionName: "createA"
            }];
            factory = TypeRegistry.fromDefinition(defs, __dirname);
            assert(factory.supports('TypeA'));
            
            let inputA1 = { "_type": "TypeA", "value": 1};
            assert.equal(factory.create(inputA1), 1);
        });
    });
});

export function createA(input: {_type: "TypeA", value: number}) {
    return input.value;
}